import { useEffect, useRef, useState } from "react";
import { supabase } from "../config/supabase";

interface Documento {
  id: string;
  titulo: string;
  archivo_url: string;
  carpeta: string;
  creado_en: string;
}

export default function PDFs() {
  const [docs, setDocs] = useState<Documento[]>([]);
  const [carpetas, setCarpetas] = useState<string[]>([]);
  const [carpetaActiva, setCarpetaActiva] = useState("informes");

  const [files, setFiles] = useState<File[]>([]);
  const [loading, setLoading] = useState(false);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);

  const inputRef = useRef<HTMLInputElement>(null);

  // ============================
  // CARGA INICIAL
  // ============================
  useEffect(() => {
    cargarTodo();
  }, []);

  async function cargarTodo() {
    const { data } = await supabase
      .from("documentos")
      .select("*")
      .order("creado_en", { ascending: false });

    if (!data) return;

    setDocs(data);

    const carpetasUnicas = Array.from(
      new Set(data.map((d) => d.carpeta))
    );

    setCarpetas(carpetasUnicas);

    if (!carpetasUnicas.includes(carpetaActiva)) {
      setCarpetaActiva(carpetasUnicas[0] || "informes");
    }
  }

  // ============================
  // MANEJO ARCHIVOS
  // ============================
  function agregarArchivos(nuevos: File[]) {
    const pdfs = nuevos.filter(
      (f) => f.type === "application/pdf"
    );
    setFiles((prev) => [...prev, ...pdfs]);
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault();
    agregarArchivos(Array.from(e.dataTransfer.files));
  }

  function quitarArchivo(index: number) {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  }

  // ============================
  // SUBIR PDFs
  // ============================
  async function subirPDFs() {
    if (files.length === 0) {
      alert("No hay PDFs seleccionados");
      return;
    }

    setLoading(true);

    try {
      for (const file of files) {
        const titulo = file.name.replace(".pdf", "");
        const path = `${carpetaActiva}/${crypto.randomUUID()}.pdf`;

        await supabase.storage
          .from("documentos_pdf")
          .upload(path, file, {
            contentType: "application/pdf",
          });

        await supabase.from("documentos").insert({
          titulo,
          archivo_url: path,
          carpeta: carpetaActiva,
          categoria: "Informes",
        });
      }

      setFiles([]);
      await cargarTodo();
      alert("PDFs subidos correctamente");
    } catch (err) {
      console.error(err);
      alert("Error al subir PDFs");
    } finally {
      setLoading(false);
    }
  }

  // ============================
  // VER PDF
  // ============================
  async function verPDF(path: string) {
    const { data } = await supabase.storage
      .from("documentos_pdf")
      .createSignedUrl(path, 3600);

    setPdfUrl(data?.signedUrl || null);
  }

  // ============================
  // RENDER
  // ============================
  const docsFiltrados = docs.filter(
    (d) => d.carpeta === carpetaActiva
  );

  return (
    <div className="max-w-3xl mx-auto p-4">

      <h1 className="text-2xl font-bold text-center mb-6">
        Documentos PDF
      </h1>

      {/* INPUT CARPETA */}
      <div className="bg-white shadow rounded p-4 mb-4">
        <label className="font-semibold block mb-1">
          ¿A qué carpeta lo querés subir?
        </label>
        <input
          className="border rounded w-full p-2"
          value={carpetaActiva}
          onChange={(e) => setCarpetaActiva(e.target.value.trim())}
        />
        <p className="text-xs text-gray-500 mt-1">
          Si no existe, se crea automáticamente
        </p>
      </div>

      {/* DROP */}
      <div
        onDragOver={(e) => e.preventDefault()}
        onDrop={onDrop}
        className="bg-white border-2 border-dashed rounded p-6 text-center mb-4"
      >
        <p className="mb-2">Arrastrá PDFs acá</p>
        <button
          onClick={() => inputRef.current?.click()}
          className="bg-red-600 text-white px-4 py-2 rounded"
        >
          Elegir archivos
        </button>
        <input
          ref={inputRef}
          type="file"
          accept="application/pdf"
          multiple
          hidden
          onChange={(e) =>
            e.target.files &&
            agregarArchivos(Array.from(e.target.files))
          }
        />
      </div>

      {/* PREVIEW */}
      {files.length > 0 && (
        <div className="bg-white shadow rounded p-4 mb-4">
          <h3 className="font-semibold mb-2">
            Archivos a subir ({files.length})
          </h3>
          <ul className="space-y-2">
            {files.map((f, i) => (
              <li
                key={i}
                className="flex justify-between border rounded p-2"
              >
                <span>{f.name}</span>
                <button
                  onClick={() => quitarArchivo(i)}
                  className="text-sm text-red-600"
                >
                  Quitar
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* SUBIR */}
      <button
        disabled={loading}
        onClick={subirPDFs}
        className="w-full bg-red-600 text-white py-3 rounded mb-6 disabled:opacity-60"
      >
        {loading ? "Subiendo..." : "Subir PDFs"}
      </button>

      {/* CARPETAS */}
      <h2 className="font-bold mb-2">Carpetas</h2>
      <div className="flex gap-2 mb-4 flex-wrap">
        {carpetas.map((c) => (
          <button
            key={c}
            onClick={() => setCarpetaActiva(c)}
            className={`px-4 py-2 rounded shadow text-sm ${
              c === carpetaActiva
                ? "bg-red-600 text-white"
                : "bg-white"
            }`}
          >
            📁 {c}
          </button>
        ))}
      </div>

      {/* LISTADO */}
      <h2 className="font-bold mb-2">
        Archivos en: {carpetaActiva}
      </h2>

      <div className="space-y-2">
        {docsFiltrados.map((d) => (
          <div
            key={d.id}
            className="bg-white shadow rounded p-3 flex justify-between"
          >
            <div>
              <p className="font-semibold">{d.titulo}</p>
              <p className="text-xs text-gray-500">
                {new Date(d.creado_en).toLocaleString()}
              </p>
            </div>
            <button
              onClick={() => verPDF(d.archivo_url)}
              className="text-blue-600"
            >
              Ver
            </button>
          </div>
        ))}
      </div>

      {/* VISOR */}
      {pdfUrl && (
        <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center">
          <div className="bg-white w-11/12 h-5/6 rounded relative">
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
