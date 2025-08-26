import * as XLSX from 'xlsx';
import { ExcelData, ClienteData } from '../types';

/**
 * Procesa el contenido de las columnas C y D convirtiendo comas a saltos de línea
 * @param content - Contenido original con comas
 * @returns Contenido con saltos de línea
 */
export const processColumnContent = (content: string): string => {
  if (!content || typeof content !== 'string') return '';
  return content.split(',').map(item => item.trim()).join('\n');
};

/**
 * Carga y procesa un archivo Excel desde una URL de GitHub
 * @param url - URL del archivo Excel en GitHub
 * @returns Datos procesados del Excel
 */
export const loadExcelFromGitHub = async (url: string): Promise<ExcelData> => {
  try {
    // Convertir URL de GitHub a URL raw para acceso directo
    const rawUrl = url.replace('github.com', 'raw.githubusercontent.com').replace('/blob/', '/');
    
    // Cargar el archivo desde GitHub
    const response = await fetch(rawUrl);
    
    if (!response.ok) {
      throw new Error(`Error al cargar archivo: ${response.status} ${response.statusText}`);
    }

    const arrayBuffer = await response.arrayBuffer();
    const workbook = XLSX.read(arrayBuffer, { type: 'array' });
    
    // Obtener la primera hoja
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    
    // Convertir a JSON
    const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as string[][];
    
    // Validar estructura del archivo
    if (jsonData.length === 0) {
      throw new Error('El archivo Excel está vacío');
    }

    // Verificar que tenga exactamente 4 columnas
    const firstRow = jsonData[0];
    if (!firstRow || firstRow.length !== 4) {
      throw new Error('El archivo debe tener exactamente 4 columnas (A, B, C, D)');
    }

    // Procesar datos (saltear encabezados si existen)
    const processedData: ExcelData = {};
    const dataRows = jsonData.slice(1); // Saltar primera fila (encabezados)

    dataRows.forEach((row, index) => {
      if (row && row.length >= 4) {
        const [numeroCliente, columnaB, columnaC, columnaD] = row;
        
        // Validar que el número de cliente existe
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
    console.error('Error al procesar archivo Excel:', error);
    throw new Error(
      error instanceof Error 
        ? error.message 
        : 'Error desconocido al cargar el archivo Excel'
    );
  }
};

/**
 * Busca un cliente por su número
 * @param data - Datos del Excel
 * @param numeroCliente - Número del cliente a buscar
 * @returns Datos del cliente o null si no se encuentra
 */
export const searchClient = (data: ExcelData, numeroCliente: string): ClienteData | null => {
  const cleanNumber = numeroCliente.trim();
  return data[cleanNumber] || null;
};