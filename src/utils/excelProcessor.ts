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
 * Normaliza encabezados para mapear columnas aunque cambie el orden.
 */
const norm = (v: unknown) =>
  (v ?? "")
    .toString()
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/[áàä]/g, "a")
    .replace(/[éèë]/g, "e")
    .replace(/[íìï]/g, "i")
    .replace(/[óòö]/g, "o")
    .replace(/[úùü]/g, "u");

/**
 * Carga y procesa el archivo CSV.xlsx desde /public
 */
export const loadExcelFromPublic = async (): Promise<ExcelData> => {
  try {
    console.log("📂 Intentando cargar /CSV.xlsx desde public...");

    const response = await fetch("/CSV.xlsx");
    if (!response.ok) {
      throw new Error(`Error al cargar CSV.xlsx: ${response.status}`);
    }

    const arrayBuffer = await response.arrayBuffer();
    const workbook = XLSX.read(arrayBuffer, { type: "array" });

    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];

    const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as any[][];
    if (jsonData.length === 0) throw new Error("El archivo CSV.xlsx está vacío");

    const headerRow = jsonData[0] || [];
    const dataRows = jsonData.slice(1);

    // Mapeo por encabezados (si existen)
    const headerIndex: Record<string, number> = {};
    headerRow.forEach((h, idx) => {
      const key = norm(h);
      if (key) headerIndex[key] = idx;
    });

    // Helpers para obtener columna por header posible (sin romper el legacy)
    const pickIdx = (candidates: string[], fallback: number | null) => {
      for (const c of candidates) {
        const k = norm(c);
        if (k in headerIndex) return headerIndex[k];
      }
      return fallback;
    };

    // Legacy fijo:
    // A=0 cliente, B=1 deuda, C=2 situacion, D=3 promos legacy, E=4 razon social
    const idxCliente = pickIdx(["cliente", "numero", "nro", "n°"], 0);
    const idxDeuda = pickIdx(["deuda"], 1);
    const idxSituacion = pickIdx(["situacion", "situación"], 2);

    // Promos nuevas (si existen por header) o por posición E/F/G (4/5/6) si el archivo viene así.
    const idxEstrategicas = pickIdx(["estrategicas", "estrategicas (e)", "promo estrategicas"], 4);
    const idxOperativas = pickIdx(["operativas", "promo operativas"], 5);
    const idxEscalas = pickIdx(["escalas", "promo escalas"], 6);

    // Promos legacy (columna "Promos" típica)
    const idxPromosLegacy = pickIdx(["promos", "promociones"], 3);

    // Razón social: por header si está, si no, legacy col 4
    const idxRazonSocial = pickIdx(["razon social", "razón social"], 4);

    const processedData: ExcelData = {};

    dataRows.forEach((row, index) => {
      if (!row || row.length < 1) return;

      const numeroCliente = row[idxCliente];
      if (!numeroCliente || !numeroCliente.toString().trim()) return;

      const clienteKey = numeroCliente.toString().trim();

      const deuda = (row[idxDeuda] ?? "").toString();
      const situacionRaw = (row[idxSituacion] ?? "").toString();

      // Compatibilidad:
      // - Si hay columnas nuevas E/F/G, las procesamos
      // - Si no, "estrategicas" toma el legacy de Promos
      const estrategicasRaw =
        (row[idxEstrategicas] ?? "").toString().trim() ||
        (row[idxPromosLegacy] ?? "").toString();

      const operativasRaw = (row[idxOperativas] ?? "").toString();
      const escalasRaw = (row[idxEscalas] ?? "").toString();

      const razonSocial = (row[idxRazonSocial] ?? "").toString().trim();

      const cliente: ClienteData = {
        numero: clienteKey,
        columnaB: deuda,
        columnaC: processColumnContent(situacionRaw),
        // legacy:
        columnaD: processColumnContent((row[idxPromosLegacy] ?? "").toString()),
        razon_social: razonSocial,

        // nuevas:
        columnaE: processColumnContent(estrategicasRaw),
        columnaF: processColumnContent(operativasRaw),
        columnaG: processColumnContent(escalasRaw),
      };

      processedData[clienteKey] = cliente;
    });

    console.log(`✅ ${Object.keys(processedData).length} clientes cargados desde CSV.xlsx`);
    return processedData;
  } catch (error) {
    console.error("❌ Error al procesar CSV.xlsx:", error);
    if (error instanceof Error) throw error;
    throw new Error("Error desconocido al cargar CSV.xlsx");
  }
};

/**
 * Buscar cliente por número
 */
export const searchClient = (data: ExcelData, numeroCliente: string): ClienteData | null => {
  const cleanNumber = numeroCliente.trim();
  const cliente = data[cleanNumber];

  if (cliente) {
    console.log(`🔎 Cliente encontrado:`, cliente);
  } else {
    console.warn(`⚠️ Cliente ${cleanNumber} no encontrado en Excel.`);
  }

  return cliente || null;
};
