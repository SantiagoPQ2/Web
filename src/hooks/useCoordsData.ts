import { useState, useEffect } from "react";
import * as XLSX from "xlsx";

interface CoordsData {
  cliente: string;
  coordX: string;
  coordY: string;
  direccion: string;
}

export const useCoordsData = () => {
  const [data, setData] = useState<CoordsData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadExcel = async () => {
      try {
        setLoading(true);
        setError(null);

        console.log("📂 Cargando archivo F96.xlsx desde /public...");

        const response = await fetch("/F96.xlsx");
        if (!response.ok) throw new Error(`Error al cargar F96.xlsx: ${response.status}`);

        const arrayBuffer = await response.arrayBuffer();
        const workbook = XLSX.read(arrayBuffer, { type: "array" });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as string[][];

        if (jsonData.length === 0) throw new Error("El archivo F96.xlsx está vacío");

        // Detectar encabezados
        const headers = jsonData[0].map((h) => h?.toString().trim().toLowerCase());
        const rows = jsonData.slice(1);

        // Buscar índices de columnas relevantes
        const idxCliente = headers.findIndex((h) => h.includes("cliente"));
        const idxCoordX = headers.findIndex((h) => h.includes("x"));
        const idxCoordY = headers.findIndex((h) => h.includes("y"));
        const idxDireccion = headers.findIndex((h) => h.includes("direccion") || h.includes("dirección"));

        const parsed: CoordsData[] = rows
          .map((row) => ({
            cliente: row[idxCliente]?.toString().trim() || "",
            coordX: row[idxCoordX]?.toString().trim() || "",
            coordY: row[idxCoordY]?.toString().trim() || "",
            direccion: row[idxDireccion]?.toString().trim() || "",
          }))
          .filter((r) => r.cliente);

        setData(parsed);
        console.log(`✅ ${parsed.length} filas cargadas de F96.xlsx`);
      } catch (err) {
        console.error("❌ Error cargando coordenadas:", err);
        setError(err instanceof Error ? err.message : "Error desconocido al leer el archivo");
      } finally {
        setLoading(false);
      }
    };

    loadExcel();
  }, []);

  return { data, loading, error };
};
