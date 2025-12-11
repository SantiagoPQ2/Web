import { useEffect, useState } from "react";
import { supabase } from "../config/supabase";

interface Documento {
  id: string;
  titulo: string;
  archivo_url: string;
  categoria: string | null;
  creado_en: string;
  creado_por: string | null;
}

export default function PDFs() {
  const [docs, setDocs] = useState<Documento[]>([]);
  const [file, setFile] = useState<File | null>(null);
  const [titulo, setTitulo] = useState("");
  const [categoria, setCategoria] = useState("");
  const [loading, setLoading] = useState(false);

  const [pdfUrl, setPdfUrl] = useState<string | null>(null);

  // ============================================================
  // Cargar documentos al entrar
  // ============================================================
  useEffect(() => {
    cargarDocs();
  }, []);

  async function cargarDocs() {
    const { data, error } = await supabase
      .from("documentos")
      .select("*")
      .order("creado_en", { ascending: false });

    console.log("DOCUMENTOS DESDE SUPABASE:", data, "ERROR:", error);

    if (error) {
      console.error("ERROR AL CARGAR DOCS:", error);
      return;
    }

    if (data) setDocs(data);
  }

  // ============================================================
  // Subir PDF
  // ============================================================
  async function subirPDF() {
    if (!file || !titulo.trim()) {
      alert("Falta seleccionar un archivo y/o título.");
      return;
    }

    setLoading(true);

    try {
      const ext = file.name.split(".").pop();
      const nombreArchivo = `${crypto.randomUUID()}.${ext}`;

      // 1) Subir archivo al bucket
      const { error: uploadErr } = await supabase.storage
        .from("documentos_pdf")
        .upload(nombreArchivo, file, {
          contentType: "application/pdf",
        });

      if (uploadErr) throw uploadErr;

      const user = (await supabase.auth.getUser()).data.user;

      // 2) Insertar metadata en tabla
      const { error: insertErr } = await supabase.from("documentos").insert({
        titulo,
        archivo_url: nombreArchivo,
        categoria: categoria || null,
        creado_por: user?.id ?? null,
      });

      if (insertErr) throw insertErr;

      // Reset form
      setTitulo("");
      setCategoria("");
      setFile(null);

      await cargarDocs();
      alert("PDF subido correctamente.");
    } catch (err) {
      console.error("ERROR SUBIENDO PDF:", err);
      alert("Error al subir PDF. Revisá consola.");
    } finally {
      setLoading(false);
    }
  }

  // ============================================================
  // Ver PDF
  // ============================================================
  async function verPDF(path: string) {
    const { data, error } = await supabase.storage
      .from("documentos_pdf")
      .createSignedUrl(path, 3600);

    if (error) {
      console.error("ERROR URL FIRMADA:", error);
      alert("No se pudo abrir el PDF. Revisá las policies del bucket.");
      return;
    }

    setPdfUrl(data?.signedUrl ?? null);
  }

  // ============================================================
  // Borrar PDF
  // ============================================================
  async function borrarPDF(id: string, path: string) {
    if (!confirm("¿Seguro que querés borrar este documento?")) return;

    await supabase.from("documentos").delete().eq("id", id);
    await supabase.storage.from("documentos_pdf").remove([path]);

    cargarDocs();
  }

  // ============================================================
  // RENDER
  // ============================================================
  return (
    <div className="p-4 max-w-2xl mx-auto">

      <h1 className="text-2xl font-bold mb-4 text-center">Documentos PDF</h1>

      {/* ===============================
          Formulario de subida
      =============================== */}
      <div className="bg-white shadow p-4 rounded mb-6">
        <h2 className="font-semibold mb-2">Subir nuevo PDF</h2>

        <input
          type="text"
          placeholder="Título"
          className="border p-2 rounded w-full mb-2"
          value={titulo}
          onChange={(e) => setTitulo(e.target.value)}
        />

        <input
          type="text"
          placeholder="Categoría (opcional)"
          className="border p-2 rounded w-full mb-2"
          value={categoria}
          onChange={(e) => setCategoria(e.target.value)}
        />

        <input
          type="file"
          accept="application/pdf"
          className="mb-2"
          onChange={(e) => e.target.files && setFile(e.target.files[0])}
        />

        <button
          onClick={subirPDF}
          disabled={loading}
          className="bg-red-600 text-white px-4 py-2 rounded w-full"
        >
          {loading ? "Subiendo..." : "Subir PDF"}
        </button>
      </div>

      {/* ===============================
          Listado
      =============================== */}
      <h2 className="text-xl font-bold mb-2">Listado</h2>

      {docs.length === 0 && (
        <p className="text-gray-600">No hay documentos cargados.</p>
      )}

      <div className="space-y-3">
        {docs.map((d) => (
          <div
            key={d.id}
            className="bg-white shadow p-3 rounded flex justify-between items-center"
          >
            <div>
              <p className="font-semibold">{d.titulo}</p>
              {d.categoria && (
                <p className="text-sm text-gray-600">{d.categoria}</p>
              )}
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

      {/* ===============================
          VISOR PDF
      =============================== */}
      {pdfUrl && (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center">
          <div className="bg-white w-11/12 h-5/6 rounded shadow relative">
            <button
              className="absolute top-2 right-2 bg-red-600 text-white px-3 py-1 rounded"
              onClick={() => setPdfUrl(null)}
            >
              Cerrar
            </button>

            <iframe
              src={pdfUrl}
              className="w-full h-full border-none rounded"
            />
          </div>
        </div>
      )}
    </div>
  );
}
