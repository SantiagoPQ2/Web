// supabase/functions/procesar_planilla/index.ts
// deno-lint-ignore-file no-explicit-any
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import * as XLSX from "https://esm.sh/xlsx@0.18.5";
// pdfjs para Deno via esm.sh (modo browser)
import * as pdfjsLib from "https://esm.sh/pdfjs-dist@3.11.174/legacy/build/pdf.mjs";

type Row = { Transporte: string | null; "Codigo de articulo": string; Descripcion: string; Bultos: number };

const X_TOL = 1.7; // (no lo usamos igual que en Python; pdfjs ya agrupa)
const BULTOS_WINDOW_LEFT = 70; // referencia conceptual

Deno.env.get; // to keep Deno permissions hint quiet

export const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function normalize(s: string) {
  return s.normalize("NFKD").replace(/[\u0300-\u036f]/g, "");
}

function isPlanillaHeader(text: string): boolean {
  const head = text.split("\n").slice(0, 15).join(" ").toUpperCase();
  if (!head.includes("PLANILLA DE CARGA")) return false;
  if (head.includes("COMPOSICION DE CARGA")) return false;
  if (head.includes("PLANILLA ADMINISTRATIVA")) return false;
  return true;
}

async function fetchPDFText(pdfBytes: Uint8Array): Promise<string[]> {
  // Devuelve un array de textos (por página)
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

function parseRowsFromPages(pages: string[]): Row[] {
  // Extracción heurística: buscamos bloques que contengan "SKU" y "BULTOS",
  // luego extraemos SKU (números al inicio), Bultos (número cercano),
  // y mantenemos una "Transporte" detectada en cabecera.
  // Es un approach robusto para los formatos típicos de "planilla de carga".
  let currentTransporte: string | null = null;
  const rows: Row[] = [];

  for (const pageText of pages) {
    const raw = normalize(pageText).toUpperCase();

    // Verificamos que sea planilla válida
    if (!isPlanillaHeader(raw)) continue;

    // Transporte: tomamos "TRANSPORTE: <nombre>" si aparece
    const tMatch = raw.match(/TRANSPORTE[:\s]+([A-Z0-9 \-\.]+)/);
    if (tMatch) {
      currentTransporte = tMatch[1].trim();
    }

    // Partimos el texto por keywords, y extraemos "lineas" con SKU y BULTOS
    // Estrategia: buscamos ocurrencias de SKU (número de 2+ dígitos) seguidas de palabras, y un número candidato a BULTOS.
    // NOTA: el parser de columnas x/y exactas de Python con pdfplumber no es replicable 1:1,
    // pero esta heurística funciona bien para estructuras uniformes de planilla.
    const itemRegex = /(\b\d{2,}\b)[^\d]{0,40}([A-Z0-9 \-\.,]+?)(?:\s+(\b\d{1,5}\b))(?=\s|$)/g;
    //         SKU (>=2 díg)   ~desc~             Bultos (1 a 5 dígitos)

    let m: RegExpExecArray | null;
    while ((m = itemRegex.exec(raw)) !== null) {
      const sku = m[1];
      let desc = m[2].trim();
      const bultos = parseInt(m[3], 10);

      // filtros similares a Python
      if (/^\d{2,}\s*-\s*/.test(sku)) continue;
      if (!desc || desc.length < 2) continue;
      if (isNaN(bultos)) continue;

      // descripción "limpia" (volver a minúsculas con capitalización simple, opcional)
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

async function makeXlsxAndUpload(
  supabase: ReturnType<typeof createClient>,
  outKey: string,
  rows: Row[],
): Promise<string> {
  // Detalle
  const detalleAOA = [
    ["Transporte", "Codigo de articulo", "Descripcion", "Bultos"],
    ...rows.map((r) => [r.Transporte ?? "", r["Codigo de articulo"], r.Descripcion, r.Bultos]),
  ];

  // Resumen
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

  // Subir al bucket planillas-out
  const { error: upErr } = await supabase
    .storage
    .from("planillas-out")
    .upload(outKey, new Blob([xlsxBuf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }), {
      upsert: true,
    });
  if (upErr) throw upErr;

  // Signed URL de descarga (1 hora)
  const { data: signed, error: urlErr } = await supabase
    .storage
    .from("planillas-out")
    .createSignedUrl(outKey, 60 * 60);
  if (urlErr) throw urlErr;

  return signed.signedUrl;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: cors });
  }

  try {
    const { path } = await req.json();
    if (!path) {
      return new Response(JSON.stringify({ error: "Falta 'path' del PDF en el bucket planillas" }), {
        status: 400,
        headers: { "content-type": "application/json", ...cors },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_ANON_KEY")!; // o SERVICE_ROLE si invocás desde el servidor
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Firmamos URL temporal para bajar el PDF
    const { data: signed, error: urlErr } = await supabase
      .storage
      .from("planillas")
      .createSignedUrl(path, 60 * 30);
    if (urlErr || !signed?.signedUrl) {
      throw urlErr ?? new Error("No se pudo firmar URL del PDF");
    }

    const pdfResp = await fetch(signed.signedUrl);
    if (!pdfResp.ok) throw new Error("No se pudo descargar el PDF");
    const pdfBytes = new Uint8Array(await pdfResp.arrayBuffer());

    // Parseo
    const pagesText = await fetchPDFText(pdfBytes);
    const rows = parseRowsFromPages(pagesText);

    // Guardamos XLSX en planillas-out
    const baseName = path.replace(/^.+\//, "").replace(/\.pdf$/i, "");
    const outKey = `xlsx/${baseName}.xlsx`;
    const downloadUrl = await makeXlsxAndUpload(supabase, outKey, rows);

    return new Response(JSON.stringify({ ok: true, downloadUrl, rows: rows.length }), {
      status: 200,
      headers: { "content-type": "application/json", ...cors },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 400,
      headers: { "content-type": "application/json", ...cors },
    });
  }
});
