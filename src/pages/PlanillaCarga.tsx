import React, { useState } from "react";
import { FileText, Upload, Download, Loader } from "lucide-react";

const PlanillaCarga: React.FC = () => {
  const [file, setFile] = useState<File | null>(null);
  const [progress, setProgress] = useState<number>(0);
  const [downloading, setDownloading] = useState(false);
  const [excelUrl, setExcelUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile && selectedFile.type === "application/pdf") {
      setFile(selectedFile);
      setProgress(0);
      setError(null);
    } else {
      setError("Por favor seleccioná un archivo PDF válido.");
    }
  };

  const handleUpload = async () => {
    if (!file) return;
    setProgress(5);
    setError(null);
    setExcelUrl(null);

    try {
      // Simular progreso mientras sube y procesa
      const simulateProgress = setInterval(() => {
        setProgress((p) => (p < 90 ? p + 5 : p));
      }, 400);

      const formData = new FormData();
      formData.append("file", file);

      const response = await fetch("/.netlify/functions/procesar_planilla", {
        method: "POST",
        body: formData,
      });

      clearInterval(simulateProgress);

      if (!response.ok) throw new Error("Error al procesar el archivo");

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      setExcelUrl(url);
      setProgress(100);
    } catch (err) {
      console.error(err);
      setError("Hubo un error al procesar el archivo.");
    }
  };

  const handleDownload = () => {
    if (!excelUrl) return;
    setDownloading(true);
    const a = document.createElement("a");
    a.href = excelUrl;
    a.download = "resumen_planilla_carga.xlsx";
    a.click();
    setDownloading(false);
  };

  return (
    <div className="max-w-2xl mx-auto bg-white p-6 rounded-lg shadow-md mt-6">
      <div className="flex items-center gap-3 mb-4">
        <FileText className="text-red-500" size={26} />
        <h2 className="text-xl font-semibold text-gray-800">Planilla de Carga</h2>
      </div>

      <p className="text-gray-600 mb-4">
        Subí un archivo PDF de planilla de carga y el sistema generará un archivo Excel con el detalle y resumen.
      </p>

      <input
        type="file"
        accept="application/pdf"
        onChange={handleFileChange}
        className="mb-4 border border-gray-300 rounded p-2 w-full"
      />

      {file && (
        <div className="flex items-center justify-between text-sm text-gray-600 mb-2">
          <span>📄 {file.name}</span>
          <span>{(file.size / 1024).toFixed(1)} KB</span>
        </div>
      )}

      {error && <p className="text-red-500 mb-4">{error}</p>}

      <button
        onClick={handleUpload}
        disabled={!file}
        className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 transition disabled:opacity-50"
      >
        <Upload size={18} /> Procesar PDF
      </button>

      {progress > 0 && (
        <div className="mt-4 w-full bg-gray-200 rounded-full h-3 overflow-hidden">
          <div
            className="bg-red-500 h-3 transition-all duration-500"
            style={{ width: `${progress}%` }}
          ></div>
        </div>
      )}

      {progress === 100 && excelUrl && (
        <div className="mt-6 flex items-center gap-2">
          <button
            onClick={handleDownload}
            className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 transition"
          >
            {downloading ? <Loader className="animate-spin" size={18} /> : <Download size={18} />}
            Descargar Excel
          </button>
        </div>
      )}
    </div>
  );
};

export default PlanillaCarga;
