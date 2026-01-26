import * as XLSX from "xlsx";
import { ExcelData, ClienteData } from "../types";

/**
 * Procesa columnas con comas y las convierte en líneas legibles
 */
export const processColumnContent = (content: string): string => {
  if (!content || typeof content !== "string") return "";
  return content
    .split(",")
    .map((item) => item.trim())
    .filter((item) => item.length > 0)
    .map((item) => `- ${item}`)
    .join("\n");
};

/**
 * Carga y procesa el archivo CSV.xlsx desde /public
 */
export const loadExcelFromPublic = async (): Promise<ExcelData> => {
  try {
    const response = await fetch("/CSV.xlsx");
    if (!response.ok) {
      throw new Error(`Error al cargar CSV.xlsx: ${response.status}`);
    }

    const arrayBuffer = await response.arrayBuffer();
    const workbook = XLSX.read(arrayBuffer, { type: "array" });

    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];

    const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as any[][];
    if (jsonData.length <= 1) {
      throw new Error("El archivo CSV.xlsx está vacío");
    }

    const dataRows = jsonData.slice(1);
    const processedData: ExcelData = {};

    dataRows.forEach((row, index) => {
      if (!row || !row[0]) return;

      const clienteKey = row[0].toString().trim();
      if (!clienteKey) return;

      const deuda = (row[1] ?? "").toString();
      const situacionRaw = (row[2] ?? "").toString();

      // 🔴 MAPEO CORRECTO SEGÚN TU EXCEL
      const estrategicasRaw = (row[3] ?? "").toString(); // D
      const razonSocial = (row[4] ?? "").toString().trim(); // E
      const operativasRaw = (row[5] ?? "").toString(); // F (futuro)
      const escalasRaw = (row[6] ?? "").toString(); // G (futuro)

      const cliente: ClienteData = {
        numero: clienteKey,
        columnaB: deuda,
        columnaC: processColumnContent(situacionRaw),

        // Promos
        columnaD: processColumnContent(estrategicasRaw), // Estratégicas
        columnaF: processColumnContent(operativasRaw),  // Operativas
        columnaG: processColumnContent(escalasRaw),     // Escalas

        razon_social: razonSocial,
      };

      processedData[clienteKey] = cliente;
    });

    console.log(`✅ ${Object.keys(processedData).length} clientes cargados`);
    return processedData;
  } catch (error) {
    console.error("❌ Error al procesar CSV.xlsx:", error);
    throw error;
  }
};

/**
 * Buscar cliente por número
 */
export const searchClient = (
  data: ExcelData,
  numeroCliente: string
): ClienteData | null => {
  const cleanNumber = numeroCliente.trim();
  return data[cleanNumber] || null;
};
