import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import * as XLSX from "https://esm.sh/xlsx@0.18.5";
import * as pdfjsLib from "https://esm.sh/pdfjs-dist@3.11.174/legacy/build/pdf.mjs";

// === CORS HEADERS ===
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

// === SUPABASE CLIENT ===
const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const supabase = createClient(supabaseUrl, supabaseKey);

Deno.serve(async (req) => {
  // 🟢 Manejar preflight request (CORS)
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { path } = await req.json();
    if (!path) {
      return new Response(JSON.stringify({ error: "Falta 'path' en el body" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 1️⃣ Firmar URL para leer el PDF
    const { data: signed, error: urlErr } = await supabase
      .storage
      .from("planillas")
      .createSignedUrl(path, 60 * 30);
    if (urlErr || !signed?.signedUrl) throw urlErr ?? new Error("No se pudo firmar URL del PDF");

    // 2️⃣ Descargar PDF
    const pdfResp = await fetch(signed.signedUrl);
    if (!pdfResp.ok) throw new Error("No se pudo descargar el PDF");
    const pdfBytes = new Uint8Array(await pdfResp.arrayBuffer());

    // 3️⃣ Leer texto del PDF
    const pdf = await pdfjsLib.getDocument({ data: pdfBytes }).promise;
    const allText: string[] = [];
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const content = await page.getTextContent();
      allText.push(
        content.items.map((it: any) => ("str" in it ? it.str : "")).join(" ")
      );
    }

    // 4️⃣ Crear Excel básico
    const ws = XLSX.utils.aoa_to_sheet([["Texto extraído"], ...allText.map((t) => [t])]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "PDF");
    const xlsxBuf = XLSX.write(wb, { type: "array", bookType: "xlsx" });

    // 5️⃣ Subir a planillas-out
    const outKey = `xlsx/${path.replace(/^.+\//, "").replace(/\.pdf$/i, "")}.xlsx`;
    const { error: upErr } = await supabase
      .storage
      .from("planillas-out")
      .upload(outKey, new Blob([xlsxBuf]), { upsert: true });
    if (upErr) throw upErr;

    // 6️⃣ Crear signed URL
    const { data: signedUrl } = await supabase
      .storage
      .from("planillas-out")
      .createSignedUrl(outKey, 60 * 60);

    return new Response(
      JSON.stringify({ ok: true, downloadUrl: signedUrl?.signedUrl }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("❌ ERROR:", e);
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

