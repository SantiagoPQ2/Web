// ===============================================
// 🌐 SUPABASE EDGE FUNCTION: procesar_planilla
// ===============================================
// - Recibe { path } => ruta PDF en bucket "planillas"
// - Extrae texto del PDF con pdfjs
// - Crea Excel (Detalle + Resumen)
// - Sube el Excel al bucket "planillas-out"
// - Devuelve URL firmada para descargarlo
// ===============================================

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import * as XLSX from "https://esm.sh/xlsx@0.18.5";
import * as pdfjsLib from "https://esm.sh/pdfjs-dist@3.11.174/legacy/build/pdf.mjs";

// ---------- CONFIGURACIÓN ----------
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!; // usar Service Role
const supabase = createClient(supabaseUrl, supabaseKey);

// ---------- FUNCIONES AUXILIARES ----------

function normalize(s: string) {
  return s.normalize("NFKD").replace(/[\u0300-\u036f]/g, "");
}

function isPlanillaHeader(text: string): boolean {
  const head = text.split("\n").slice(0, 15).join(" ").toUpperCase();
  return head.includes("PLANILLA DE CARGA") &&
         !head.includes("COMPOSICION DE CARGA") &&
         !head.includes("PLANILLA ADMINISTRATIVA");
}

async function fetchPDFText(pdfBytes: Uint8Array): Promise<string[]> {
  const loadingTask = pdfjsLib.getDocument({ data: pdfBytes });
  const pdf = await loadingTask.promise;
  const pages: string[] = [];
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    const texts = content.items
      .map((it: any) => ("str" in it ? it.str : ""))
      .join(" ")
      .replace(/\s+/g, " ")
      .trim();
    pages.push(texts);
  }
  return pages;
}

type Row = {
  Transporte: string | null;
  "Codigo de articulo": string;
  Descripcion: string;
  Bultos: number;
};

function parseRowsFromPages(pages: string[]): Row[] {
  let currentTransporte: string | null = null;
  const rows: Row[] = [];

  for (const pageText of pages) {
    const raw = normalize(pageText).toUpperCase();
    if (!isPlanillaHeader(raw)) continue;

    const tMatch = raw.match(/TRANSPORTE[:\s]+([A-Z0-9 \-\.]+)/);
    if (tMatch) currentTransporte = tMatch[1].trim();

    const itemRegex = /(\b\d{2,}\b)[^\d]{0,40}([A-Z0-9 \-\.,]+?)(?:\s+(\b\d{1,5}\b))(?=\s|$)/g;
    let m: RegExpExecArray | null;

    while ((m = itemRegex.exec(raw)) !== null) {
      const sku = m[1];
      let desc = m[2].trim();
      const bultos = parseInt(m[3], 10);

      if (/^\d{2,}\s*-\s*/.test(sku)) continue;
      if (!desc || desc.length < 2) continue;
      if (isNaN(bultos)) continue;

      desc = desc.replace(/\s+/g, " ").trim();

      rows.push({
        Transporte: currentTransporte,
        "Codigo de articulo": sku,
        Descripcion: desc,
        Bultos: bultos,
      });
    }
  }
  return rows;
}

async function makeXlsxAndUpload(outKey: string, rows: Row[]): Promise<string> {
  const detalleAOA = [
    ["Transporte", "Codigo de articulo", "Descripcion", "Bultos"],
    ...rows.map((r) => [r.Transporte ?? "", r["Codigo de articulo"], r.Descripcion, r.Bultos]),
  ];

  const resumenMap = new Map<string, number>();
  for (const r of rows) {
    const key = `${r.Transporte ?? ""}|||${r["Codigo de articulo"]}|||${r.Descripcion}`;
    resumenMap.set(key, (resumenMap.get(key) ?? 0) + r.Bultos);
  }

  const resumenAOA = [
    ["Transporte", "Codigo de articulo", "Descripcion", "Bultos"],
    ...Array.from(resumenMap.entries()).map(([k, total]) => {
      const [t, sku, d] = k.split("|||");
      return [t, sku, d, total];
    }),
  ];

  const wb = XLSX.utils.book_new();
  const wsDetalle = XLSX.utils.aoa_to_sheet(detalleAOA);
  const wsResumen = XLSX.utils.aoa_to_sheet(resumenAOA);
  XLSX.utils.book_append_sheet(wb, wsDetalle, "Detalle");
  XLSX.utils.book_append_sheet(wb, wsResumen, "Resumen");

  const xlsxBuf = XLSX.write(wb, { type: "array", bookType: "xlsx" }) as ArrayBuffer;

  const { error: upErr } = await supabase.storage
    .from("planillas-out")
    .upload(outKey, new Blob([xlsxBuf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }), {
      upsert: true,
    });
  if (upErr) throw upErr;

  const { data: signed, error: urlErr } = await supabase
    .storage
    .from("planillas-out")
    .createSignedUrl(outKey, 60 * 60);

  if (urlErr) throw urlErr;

  return signed.signedUrl;
}

// ---------- MANEJO PRINCIPAL ----------

Deno.serve(async (req) => {
  // ✅ Manejar preflight CORS
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { path } = await req.json();
    if (!path) {
      return new Response(JSON.stringify({ error: "Falta 'path' del PDF en el bucket planillas" }), {
        status: 400,
        headers: { "content-type": "application/json", ...corsHeaders },
      });
    }

    // 1️⃣ Crear URL firmada para leer el PDF
    const { data: signed, error: urlErr } = await supabase
      .storage
      .from("planillas")
      .createSignedUrl(path, 60 * 30);
    if (urlErr || !signed?.signedUrl) throw urlErr ?? new Error("No se pudo firmar URL del PDF");

    // 2️⃣ Descargar PDF
    const pdfResp = await fetch(signed.signedUrl);
    if (!pdfResp.ok) throw new Error("No se pudo descargar el PDF");
    const pdfBytes = new Uint8Array(await pdfResp.arrayBuffer());

    // 3️⃣ Parsear texto y generar filas
    const pagesText = await fetchPDFText(pdfBytes);
    const rows = parseRowsFromPages(pagesText);

    // 4️⃣ Subir XLSX y devolver URL
    const baseName = path.replace(/^.+\//, "").replace(/\.pdf$/i, "");
    const outKey = `xlsx/${baseName}.xlsx`;
    const downloadUrl = await makeXlsxAndUpload(outKey, rows);

    return new Response(JSON.stringify({ ok: true, downloadUrl, rows: rows.length }), {
      status: 200,
      headers: { "content-type": "application/json", ...corsHeaders },
    });
  } catch (e) {
    console.error("❌ Error procesando planilla:", e);
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 400,
      headers: { "content-type": "application/json", ...corsHeaders },
    });
  }
});
