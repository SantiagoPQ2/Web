import * as XLSX from 'xlsx';
import { ExcelData, ClienteData } from '../types';

/**
 * Procesa las columnas de texto con comas y las convierte en líneas legibles
 */
export const processColumnContent = (content: string): string => {
  if (!content || typeof content !== 'string') return '';
  return content
    .split(',')
    .map((item) => item.trim())
    .filter((item) => item.length > 0)
    .map((item) => `- ${item}`)
    .join('\n');
};

/**
 * Carga y procesa el archivo CSV.xlsx desde /public
 */
export const loadExcelFromPublic = async (): Promise<ExcelData> => {
  try {
    console.log('📂 Intentando cargar /CSV.xlsx desde public...');

    const response = await fetch('/CSV.xlsx');
    if (!response.ok) {
      throw new Error(`Error al cargar CSV.xlsx: ${response.status}`);
    }

    const arrayBuffer = await response.arrayBuffer();
    const workbook = XLSX.read(arrayBuffer, { type: 'array' });

    // Leer la primera hoja
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];

    const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as string[][];
    if (jsonData.length === 0) {
      throw new Error('El archivo CSV.xlsx está vacío');
    }

    // Procesar filas (omitir encabezados)
    const processedData: ExcelData = {};
    const dataRows = jsonData.slice(1);

    dataRows.forEach((row, index) => {
      if (row && row.length >= 5) {
        // A = número, B = deuda, C = situación, D = promos, E = razón social
        const [numeroCliente, columnaB, columnaC, columnaD, razonSocial] = row;

        if (numeroCliente && numeroCliente.toString().trim()) {
          const clienteKey = numeroCliente.toString().trim();

          processedData[clienteKey] = {
            numero: clienteKey,
            columnaB: (columnaB || '').toString(), // deuda
            columnaC: processColumnContent((columnaC || '').toString()), // situación
            columnaD: processColumnContent((columnaD || '').toString()), // promos
            razon_social: (razonSocial || '').toString().trim(), // 👈 columna E (Razón Social)
          };
        }
      } else {
        console.warn(`Fila ${index + 2} ignorada: formato incompleto`);
      }
    });

    console.log(`✅ ${Object.keys(processedData).length} clientes cargados desde CSV.xlsx`);
    return processedData;
  } catch (error) {
    console.error('❌ Error al procesar CSV.xlsx:', error);
    if (error instanceof Error) throw error;
    throw new Error('Error desconocido al cargar CSV.xlsx');
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
