import { useEffect, useState } from "react";
import { supabase } from "../config/supabase";

interface Documento {
  id: string;
  titulo: string;
  archivo_url: string;
  categoria: string;
  carpeta: string;
  creado_en: string;
}

export default function PDFs() {
  const [docs, setDocs] = useState<Documento[]>([]);
  const [files, setFiles] = useState<File[]>([]);
  const [carpeta, setCarpeta] = useState("informes");
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [carpetaActiva, setCarpetaActiva] = useState<string | null>(null);

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
  function normalizarCarpeta(nombre: string) {
    return nombre
      .trim()
      .toLowerCase()
      .replace(/\s+/g, "-")
      .replace(/[^a-z0-9-_]/g, "");
  }

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
    setDragOver(false);

    const droppedFiles = Array.from(e.dataTransfer.files).filter(
      (f) => f.type === "application/pdf"
    );

    agregarArchivos(droppedFiles);
  }

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    if (!e.target.files) return;
    agregarArchivos(Array.from(e.target.files));
    e.target.value = "";
  }

  // ============================================================
  // Subida
  // ============================================================
  async function subirPDFs() {
    if (!files.length) return;

    const carpetaFinal = normalizarCarpeta(carpeta || "general");

    setUploading(true);
    setProgress(0);

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const ext = file.name.split(".").pop();
      const uuid = crypto.randomUUID();

      const path = `${carpetaFinal}/${uuid}.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from("documentos_pdf")
        .upload(path, file, { contentType: "application/pdf" });

      if (!uploadError) {
        await supabase.from("documentos").insert({
          titulo: file.name.replace(/\.pdf$/i, ""),
          archivo_url: path,
          categoria: "Informe",
          carpeta: carpetaFinal,
        });
      }

      setProgress(Math.round(((i + 1) / files.length) * 100));
    }

    setFiles([]);
    setUploading(false);
    cargarDocs();
  }

  // ============================================================
  // Agrupar por carpeta
  // ============================================================
  const carpetas = Array.from(new Set(docs.map((d) => d.carpeta)));

  // ============================================================
  // Render
  // ============================================================
  return (
    <div className="p-6 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold text-center mb-6">Documentos PDF</h1>

      {/* CARPETA INPUT */}
      <div className="bg-white p-4 rounded shadow mb-4">
        <label className="block font-semibold mb-1">
          ¿A qué carpeta lo querés subir?
        </label>
        <input
          value={carpeta}
          onChange={(e) => setCarpeta(e.target.value)}
          placeholder="Ej: informes, rrhh, facturas"
          className="border rounded p-2 w-full"
        />
        <p className="text-xs text-gray-500 mt-1">
          Si no existe, se crea automáticamente
        </p>
      </div>

      {/* DROPZONE */}
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        className={`border-2 border-dashed rounded-lg p-6 text-center mb-4
          ${dragOver ? "border-red-600 bg-red-50" : "border-gray-300 bg-white"}
        `}
      >
        <p className="mb-2">Arrastrá PDFs acá</p>
        <input
          type="file"
          multiple
          accept="application/pdf"
          onChange={handleFileSelect}
        />
      </div>

      <button
        onClick={subirPDFs}
        disabled={uploading || !files.length}
        className="w-full bg-red-600 text-white py-2 rounded mb-6"
      >
        {uploading ? `Subiendo... ${progress}%` : "Subir PDFs"}
      </button>

      {/* CARPETAS */}
      <h2 className="text-xl font-bold mb-3">Carpetas</h2>

      <div className="grid grid-cols-2 gap-3 mb-6">
        {carpetas.map((c) => (
          <button
            key={c}
            onClick={() => setCarpetaActiva(c)}
            className={`p-3 rounded shadow text-left ${
              carpetaActiva === c
                ? "bg-red-600 text-white"
                : "bg-white"
            }`}
          >
            📁 {c}
          </button>
        ))}
      </div>

      {/* ARCHIVOS */}
      {carpetaActiva && (
        <>
          <h3 className="font-semibold mb-2">
            Archivos en: {carpetaActiva}
          </h3>

          {docs
            .filter((d) => d.carpeta === carpetaActiva)
            .map((d) => (
              <div
                key={d.id}
                className="bg-white p-3 rounded shadow flex justify-between mb-2"
              >
                <span>{d.titulo}</span>
                <button
                  className="text-blue-600"
                  onClick={async () => {
                    const { data } = await supabase.storage
                      .from("documentos_pdf")
                      .createSignedUrl(d.archivo_url, 3600);
                    setPdfUrl(data?.signedUrl ?? null);
                  }}
                >
                  Ver
                </button>
              </div>
            ))}
        </>
      )}

      {/* VISOR */}
      {pdfUrl && (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center">
          <div className="bg-white w-11/12 h-5/6 rounded relative">
            <button
              className="absolute top-2 right-2 bg-red-600 text-white px-3 py-1 rounded"
              onClick={() => setPdfUrl(null)}
            >
              Cerrar
            </button>
            <iframe src={pdfUrl} className="w-full h-full" />
          </div>
        </div>
      )}
    </div>
  );
}
