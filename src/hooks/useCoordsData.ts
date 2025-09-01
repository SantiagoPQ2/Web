import { useState, useEffect } from "react";
import * as XLSX from "xlsx";

interface ClienteCoords {
  cliente: string;
  coordX: string;
  coordY: string;
}

export const useCoordsData = () => {
  const [data, setData] = useState<ClienteCoords[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadExcel = async () => {
      try {
        const response = await fetch("/F96.xlsx");
        if (!response.ok) throw new Error("No se pudo cargar F96.xlsx");

        const arrayBuffer = await response.arrayBuffer();
        const workbook = XLSX.read(arrayBuffer, { type: "array" });

        // Leer primera hoja
        const worksheet = workbook.Sheets[workbook.SheetNames[0]];
        const jsonData = XLSX.utils.sheet_to_json<any>(worksheet, { header: 1 });

        // Suponemos estructura:
        // Columna A: Cliente
        // Columna B: Coord X
        // Columna C: Coord Y
        const clientes: ClienteCoords[] = (jsonData as any[])
          .slice(1) // saltear encabezado
          .map((row) => ({
            cliente: row[0]?.toString() || "",
            coordX: row[1]?.toString() || "",
            coordY: row[2]?.toString() || "",
          }))
          .filter((row) => row.cliente);

        setData(clientes);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Error desconocido");
      } finally {
        setLoading(false);
      }
    };

    loadExcel();
  }, []);

  return { data, loading, error };
};
