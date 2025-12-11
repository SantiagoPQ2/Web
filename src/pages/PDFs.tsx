import { useEffect, useState } from "react";
import { supabase } from "../config/supabase";

interface Documento {
  id: string;
  titulo: string;
  archivo_url: string;
  categoria: string | null;
  creado_en: string;
  creado_por: string;
}

export default function PDFs() {
  const [docs, setDocs] = useState<Documento[]>([]);
  const [file, setFile] = useState<File | null>(null);
  const [titulo, setTitulo] = useState("");
  const [categoria, setCategoria] = useState("");
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Cargar documentos al abrir
  useEffect(() => {
    cargarDocs();
  }, []);

  async function cargarDocs() {
    const { data, error } = await supabase
      .from("documentos")
      .select("*")
      .order("creado_en", { ascending: false });

    if (!error) setDocs(data);
  }

  async function subirPDF() {
    if (!file || !titulo) {
      alert("Falta título o archivo.");
      return;
    }

    setLoading(true);

    try {
      const ext = file.name.split(".").pop();
      const nombre = `${crypto.randomUUID()}.${ext}`;

      // 1. Subir archivo
      const { error: uploadErr } = await supabase.storage
        .from("documentos_pdf")
        .upload(nombre, file, {
          contentType: "application/pdf",
        });

      if (uploadErr) throw uploadErr;

      const user = (await supabase.auth.getUser()).data.user;

      // 2. Guardar metadata
      const { error: dbErr } = await supabase.from("documentos").insert({
        titulo,
        archivo_url: nombre,
        categoria: categoria || null,
        creado_por: user?.id,
      });

      if (dbErr) throw dbErr;

      setTitulo("");
      setCategoria("");
      setFile(null);

      await cargarDocs();
      alert("PDF subido correctamente.");
    } catch (err) {
      console.error(err);
      alert("Error al subir el PDF.");
    } finally {
      setLoading(false);
    }
  }

  // Obtener URL firmada del PDF
  async function verPDF(path: string) {
    const { data } = await supabase.storage
      .from("documentos_pdf")
      .createSignedUrl(path, 3600);

    if (data?.signedUrl) setPdfUrl(data.signedUrl);
  }

  // Borrar documento
  async function borrarPDF(id: string, path: string) {
    if (!confirm("¿Seguro que querés borrar este documento?")) return;

    await supabase.from("documentos").delete().eq("id", id);
    await supabase.storage.from("documentos_pdf").remove([path]);

    cargarDocs();
  }

  return (
    <div className="p-4 max-w-3xl mx-auto">

      <h1 className="text-2xl font-bold mb-4">Documentos PDF</h1>

      {/* Subir PDF */}
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
          onChange={(e) => e.target.files && setFile(e.target.files[0])}
          className="mb-2"
        />

        <button
          onClick={subirPDF}
          disabled={loading}
          className="bg-red-600 text-white px-4 py-2 rounded w-full"
        >
          {loading ? "Subiendo..." : "Subir PDF"}
        </button>
      </div>

      {/* Lista de PDFs */}
      <h2 className="text-xl font-bold mb-2">Listado</h2>

      <div className="space-y-3">
        {docs.map((d) => (
          <div
            key={d.id}
            className="bg-white shadow p-3 rounded flex justify-between items-center"
          >
            <div>
              <p className="font-semibold">{d.titulo}</p>
              <p className="text-sm text-gray-600">{d.categoria}</p>
              <p className="text-xs text-gray-500">{d.creado_en}</p>
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

      {/* VISOR DE PDF */}
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
