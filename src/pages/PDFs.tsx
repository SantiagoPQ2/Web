import { useEffect, useState } from "react";
import { supabase } from "../config/supabase";

interface Documento {
  id: string;
  titulo: string;
  archivo_url: string;
  categoria: string | null;
  creado_en: string;
}

export default function PDFs() {
  const [docs, setDocs] = useState<Documento[]>([]);
  const [files, setFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);

  // ============================================================
  // Cargar documentos
  // ============================================================
  useEffect(() => {
    cargarDocs();
  }, []);

  async function cargarDocs() {
    const { data } = await supabase
      .from("documentos")
      .select("*")
      .order("creado_en", { ascending: false });

    setDocs(data ?? []);
  }

  // ============================================================
  // Helpers
  // ============================================================
  function agregarArchivos(nuevos: File[]) {
    setFiles((prev) => {
      const existentes = prev.map((f) => f.name + f.size);
      const filtrados = nuevos.filter(
        (f) => !existentes.includes(f.name + f.size)
      );
      return [...prev, ...filtrados];
    });
  }

  // ============================================================
  // Drag & Drop
  // ============================================================
  function handleDrop(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(false);

    const droppedFiles = Array.from(e.dataTransfer.files).filter(
      (f) => f.type === "application/pdf"
    );

    agregarArchivos(droppedFiles);
  }

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    if (!e.target.files) return;

    const selectedFiles = Array.from(e.target.files).filter(
      (f) => f.type === "application/pdf"
    );

    agregarArchivos(selectedFiles);
    e.target.value = ""; // importante
  }

  function removeFile(index: number) {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  }

  // ============================================================
  // Subida en lote
  // ============================================================
  async function subirPDFs() {
    if (files.length === 0) {
      alert("No hay PDFs para subir");
      return;
    }

    setUploading(true);
    setProgress(0);

    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, "0");

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const ext = file.name.split(".").pop();
      const uuid = crypto.randomUUID();

      const storagePath = `${year}/${month}/${uuid}.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from("documentos_pdf")
        .upload(storagePath, file, {
          contentType: "application/pdf",
        });

      if (!uploadError) {
        const titulo = file.name.replace(/\.pdf$/i, "");

        await supabase.from("documentos").insert({
          titulo,
          archivo_url: storagePath,
          categoria: "Informe",
        });
      }

      setProgress(Math.round(((i + 1) / files.length) * 100));
    }

    setFiles([]);
    setUploading(false);
    await cargarDocs();
  }

  // ============================================================
  // Ver PDF
  // ============================================================
  async function verPDF(path: string) {
    const { data } = await supabase.storage
      .from("documentos_pdf")
      .createSignedUrl(path, 3600);

    setPdfUrl(data?.signedUrl ?? null);
  }

  // ============================================================
  // Borrar
  // ============================================================
  async function borrarPDF(id: string, path: string) {
    if (!confirm("¿Borrar este documento?")) return;

    await supabase.from("documentos").delete().eq("id", id);
    await supabase.storage.from("documentos_pdf").remove([path]);
    cargarDocs();
  }

  // ============================================================
  // RENDER
  // ============================================================
  return (
    <div className="p-6 max-w-3xl mx-auto">
      <h1 className="text-2xl font-bold text-center mb-6">
        Documentos PDF
      </h1>

      {/* DROPZONE */}
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        className={`border-2 border-dashed rounded-lg p-6 text-center transition
          ${dragOver ? "border-red-600 bg-red-50" : "border-gray-300 bg-white"}
        `}
      >
        <p className="font-medium mb-2">
          Arrastrá PDFs acá o seleccioná archivos
        </p>

        <input
          id="pdfInput"
          type="file"
          accept="application/pdf"
          multiple
          onChange={handleFileSelect}
          className="hidden"
        />

        <label
          htmlFor="pdfInput"
          className="inline-block mt-2 px-4 py-2 bg-red-600 text-white rounded cursor-pointer"
        >
          Seleccionar PDFs
        </label>
      </div>

      {/* PREVIEW */}
      {files.length > 0 && (
        <div className="mt-4 space-y-2">
          {files.map((f, i) => (
            <div
              key={i}
              className="flex justify-between items-center bg-white shadow p-2 rounded"
            >
              <span className="text-sm truncate">{f.name}</span>
              <button
                onClick={() => removeFile(i)}
                className="text-red-600 text-sm"
              >
                Quitar
              </button>
            </div>
          ))}
        </div>
      )}

      {/* PROGRESO */}
      {uploading && (
        <div className="mt-4">
          <div className="w-full bg-gray-200 rounded-full h-3">
            <div
              className="bg-red-600 h-3 rounded-full transition-all"
              style={{ width: `${progress}%` }}
            />
          </div>
          <p className="text-center text-sm mt-1">{progress}%</p>
        </div>
      )}

      <button
        onClick={subirPDFs}
        disabled={uploading || files.length === 0}
        className="mt-4 w-full bg-red-600 text-white py-2 rounded disabled:opacity-50"
      >
        {uploading ? "Subiendo PDFs..." : "Subir PDFs"}
      </button>

      {/* LISTADO */}
      <h2 className="text-xl font-bold mt-8 mb-3">Listado</h2>

      {docs.length === 0 && (
        <p className="text-gray-600">No hay documentos cargados.</p>
      )}

      <div className="space-y-3">
        {docs.map((d) => (
          <div
            key={d.id}
            className="bg-white shadow rounded p-3 flex justify-between items-center"
          >
            <div>
              <p className="font-semibold">{d.titulo}</p>
              <p className="text-sm text-gray-600">{d.categoria}</p>
              <p className="text-xs text-gray-500">
                {new Date(d.creado_en).toLocaleString()}
              </p>
            </div>

            <div className="flex gap-2">
              <button
                className="bg-blue-600 text-white px-3 py-1 rounded"
                onClick={() => verPDF(d.archivo_url)}
              >
                Ver
              </button>
              <button
                className="bg-gray-600 text-white px-3 py-1 rounded"
                onClick={() => borrarPDF(d.id, d.archivo_url)}
              >
                Borrar
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* VISOR */}
      {pdfUrl && (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50">
          <div className="bg-white w-11/12 h-5/6 rounded shadow relative">
            <button
              className="absolute top-2 right-2 bg-red-600 text-white px-3 py-1 rounded"
              onClick={() => setPdfUrl(null)}
            >
              Cerrar
            </button>
            <iframe src={pdfUrl} className="w-full h-full rounded" />
          </div>
        </div>
      )}
    </div>
  );
}
