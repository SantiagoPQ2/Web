import * as XLSX from 'xlsx';
import { ExcelData, ClienteData } from '../types';
import { CONFIG } from '../config/constants';

/**
 * Procesa el contenido de las columnas C y D convirtiendo comas a saltos de línea
 * y agregando guiones al inicio de cada línea para mejor legibilidad
 */
export const processColumnContent = (content: string): string => {
  if (!content || typeof content !== 'string') return '';
  return content.split(',')
    .map(item => item.trim())
    .filter(item => item.length > 0)
    .map(item => `- ${item}`)
    .join('\n');
};

/**
 * Carga y procesa un archivo Excel desde /public (ej: /CSV.xlsx)
 */
export const loadExcelFromPublic = async (url: string): Promise<ExcelData> => {
  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Accept': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel,*/*',
      },
    });

    if (!response.ok) {
      throw new Error(`No se pudo acceder al archivo Excel: ${response.status}`);
    }

    const arrayBuffer = await response.arrayBuffer();
    const workbook = XLSX.read(arrayBuffer, { type: 'array' });

    // Primera hoja
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];

    // JSON bruto
    const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as string[][];

    // Validar
    if (jsonData.length === 0) {
      throw new Error('El archivo Excel está vacío');
    }

    const processedData: ExcelData = {};
    const dataRows = jsonData.slice(1); // saltar encabezado

    dataRows.forEach(row => {
      if (row && row.length >= 4) {
        const [numeroCliente, columnaB, columnaC, columnaD] = row;
        if (numeroCliente && numeroCliente.toString().trim()) {
          const clienteKey = numeroCliente.toString().trim();
          processedData[clienteKey] = {
            numero: clienteKey,
            columnaB: (columnaB || '').toString(),
            columnaC: processColumnContent((columnaC || '').toString()),
            columnaD: processColumnContent((columnaD || '').toString())
          };
        }
      }
    });

    if (Object.keys(processedData).length === 0) {
      throw new Error('No se encontraron datos válidos en el archivo');
    }

    return processedData;

  } catch (error) {
    console.error('Error al procesar CSV.xlsx:', error);
    throw error;
  }
};

/**
 * Busca un cliente por su número
 */
export const searchClient = (data: ExcelData, numeroCliente: string): ClienteData | null => {
  const cleanNumber = numeroCliente.trim();
  return data[cleanNumber] || null;
};
