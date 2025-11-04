// src/pages/PlanillaCarga.tsx
import React, { useState } from "react";
import { FileText, Upload, Download, Loader } from "lucide-react";
import { supabase } from "../config/supabase";
import { useAuth } from "../context/AuthContext";

type FnResponse = {
  ok?: boolean;
  downloadUrl?: string;
  rows?: number;
  error?: string;
};

function fmtSize(bytes: number) {
  if (!bytes && bytes !== 0) return "";
  const kb = bytes / 1024;
  if (kb < 1024) return `${kb.toFixed(1)} KB`;
  return `${(kb / 1024).toFixed(2)} MB`;
}

const PlanillaCarga: React.FC = () => {
  const { user } = useAuth();
  const [file, setFile] = useState<File | null>(null);
  const [progress, setProgress] = useState<number>(0);
  const [downloading, setDownloading] = useState(false);
  const [excelUrl, setExcelUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<boolean>(false);
  const [rows, setRows] = useState<number | null>(null);
  const [loading, setLoading] = useState<boolean>(false);

  const isAdmin = user?.role === "admin" || user?.role === "administrador";

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0] || null;
    setFile(f);
    setProgress(0);
    setExcelUrl(null);
    setError(null);
    setSuccess(false);
    setRows(null);
  };

  const handleUpload = async () => {
    if (!file) return;

    setLoading(true);
    setProgress(8);
    setError(null);
    setExcelUrl(null);
    setSuccess(false);
    setRows(null);

    // Simulador de barra de progreso (hasta 90%)
    const tick = setInterval(() => {
      setProgress((p) => (p < 90 ? p + 4 : p));
    }, 350);

    try {
      // 1) Subir PDF a Supabase Storage (bucket privado planillas)
      const ext = file.name.split(".").pop()?.toLowerCase() || "pdf";
      const path = `uploads/${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;

      const { error: upErr } = await supabase.storage
        .from("planillas")
        .upload(path, file, {
          contentType: "application/pdf",
          upsert: false,
          cacheControl: "0",
        });

      if (upErr) throw upErr;

      setProgress(55);

      // 2) Invocar Edge Function en Supabase
      const fnUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/procesar_planilla`;

      const resp = await fetch(fnUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: import.meta.env.VITE_SUPABASE_ANON_KEY!,
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY!}`,
        },
        body: JSON.stringify({ path }),
      });

      if (!resp.ok) {
        const txt = await resp.text().catch(() => "");
        throw new Error(txt || "Error al procesar el archivo");
      }

      const data: FnResponse = await resp.json();

      if (!data.downloadUrl) {
        throw new Error(data.error || "No se recibió URL de descarga");
      }

      setExcelUrl(data.downloadUrl);
      setRows(typeof data.rows === "number" ? data.rows : null);
      setSuccess(true);
      setProgress(100);
    } catch (err: any) {
      console.error(err);
      const msg =
        err?.message ||
        err?.error_description ||
        err?.error ||
        "Hubo un error al procesar el archivo.";
      setError(msg);
      setSuccess(false);
      setProgress(0);
    } finally {
      clearInterval(tick);
      setLoading(false);
    }
  };

  const handleDownload = async () => {
    if (!excelUrl) return;
    try {
      setDownloading(true);
      const a = document.createElement("a");
      a.href = excelUrl;
      a.download = "resumen_planilla_carga.xlsx";
      a.click();
    } finally {
      setDownloading(false);
    }
  };

  if (!isAdmin) {
    return (
      <div className="max-w-2xl mx-auto bg-white p-6 rounded-lg shadow-md mt-6">
        <div className="text-center text-red-600">
          <p className="font-semibold">No autorizado</p>
          <p className="text-sm text-gray-600 mt-1">
            Esta sección solo está disponible para usuarios con rol <b>admin</b>.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto bg-white p-6 rounded-lg shadow-md mt-6">
      <div className="flex items-center gap-3 mb-4">
        <FileText className="text-red-500" size={26} />
        <h2 className="text-xl font-semibold text-gray-800">Planilla de Carga</h2>
      </div>

      <p className="text-gray-600 mb-4">
        Subí un archivo PDF de planilla de carga. El sistema lo procesa en Supabase y genera un Excel con
        <span className="font-medium"> Detalle</span> y <span className="font-medium">Resumen</span>.
      </p>

      <input
        type="file"
        accept="application/pdf"
        onChange={handleFileChange}
        className="mb-4 border border-gray-300 rounded p-2 w-full"
        disabled={loading}
      />

      {file && (
        <div className="flex items-center justify-between text-sm text-gray-600 mb-2">
          <span>📄 {file.name}</span>
          <span>{fmtSize(file.size)}</span>
        </div>
      )}

      {error && <p className="text-red-600 mb-3">{error}</p>}
      {success && (
        <p className="text-green-600 mb-3 font-medium">
          ✅ Procesado correctamente {rows !== null && `(filas detectadas: ${rows})`}.
        </p>
      )}

      <div className="flex items-center gap-2">
        <button
          onClick={handleUpload}
          disabled={!file || loading}
          className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 transition disabled:opacity-50"
        >
          {loading ? <Loader className="animate-spin" size={18} /> : <Upload size={18} />}
          {loading ? "Procesando..." : "Procesar PDF"}
        </button>

        {excelUrl && (
          <button
            onClick={handleDownload}
            className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 transition"
          >
            {downloading ? <Loader className="animate-spin" size={18} /> : <Download size={18} />}
            Descargar Excel
          </button>
        )}
      </div>

      {progress > 0 && (
        <div className="mt-4 w-full bg-gray-200 rounded-full h-3 overflow-hidden">
          <div
            className="bg-red-500 h-3 transition-all duration-500"
            style={{ width: `${progress}%` }}
          />
        </div>
      )}

      <p className="text-xs text-gray-500 mt-3">
        * El PDF se sube al bucket privado <code>planillas</code>. La función Edge genera el Excel y lo
        guarda en <code>planillas-out</code>, devolviendo un link de descarga temporal.
      </p>
    </div>
  );
};

export default PlanillaCarga;
