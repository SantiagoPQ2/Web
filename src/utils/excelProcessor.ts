import * as XLSX from 'xlsx';
import { ExcelData, ClienteData } from '../types';
import { CONFIG } from '../config/constants';

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
 * Convierte una URL de GitHub a diferentes formatos para intentar acceso
 * @param url - URL original de GitHub
 * @returns Array de URLs para intentar
 */
const getGitHubUrls = (url: string): string[] => {
  const urls: string[] = [];
  
  // URL original
  urls.push(url);
  
  // Convertir a raw.githubusercontent.com
  if (url.includes('github.com') && url.includes('/blob/')) {
    const rawUrl = url
      .replace('github.com', 'raw.githubusercontent.com')
      .replace('/blob/', '/');
    urls.push(rawUrl);
  }
  
  // Intentar con ?raw=true
  urls.push(`${url}?raw=true`);
  
  // Intentar descarga directa
  urls.push(url.replace('/blob/', '/raw/'));
  
  return [...new Set(urls)]; // Eliminar duplicados
};

/**
 * Carga y procesa un archivo Excel desde una URL de GitHub
 * @param url - URL del archivo Excel en GitHub
 * @returns Datos procesados del Excel
 */
export const loadExcelFromGitHub = async (url: string): Promise<ExcelData> => {
  try {
    const urlsToTry = getGitHubUrls(url);
    let response: Response | null = null;
    let lastError: Error | null = null;
    
    // Intentar cada URL hasta que una funcione
    for (const tryUrl of urlsToTry) {
      try {
        console.log(`Intentando cargar desde: ${tryUrl}`);
        
        const fetchResponse = await fetch(tryUrl, {
          method: 'GET',
          headers: {
            'Accept': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel,*/*',
          },
        });
        
        if (fetchResponse.ok) {
          response = fetchResponse;
          console.log(`✅ Archivo cargado exitosamente desde: ${tryUrl}`);
          break;
        } else {
          console.log(`❌ Error ${fetchResponse.status} en: ${tryUrl}`);
        }
      } catch (error) {
        console.log(`❌ Error de red en: ${tryUrl}`, error);
        lastError = error instanceof Error ? error : new Error('Error desconocido');
      }
    }
    
    if (!response) {
      throw new Error(`No se pudo acceder al archivo Excel. Posibles causas:
      
1. El repositorio es privado - Necesitas hacer el repositorio público
2. La URL no es correcta - Verifica que el archivo existe en GitHub
3. Problemas de red - Intenta más tarde

URL intentada: ${url}

Para solucionarlo:
• Ve a tu repositorio en GitHub
• Haz click en "Settings" 
• Scroll hasta "Danger Zone"
• Haz click en "Change repository visibility"
• Selecciona "Make public"

Error técnico: ${lastError?.message || 'No se pudo conectar'}`);
    }

    let arrayBuffer: ArrayBuffer;
    try {
      arrayBuffer = await response.arrayBuffer();
    } catch (error) {
      throw new Error('Error al leer el contenido del archivo. Verifica que sea un archivo Excel válido.');
    }
    
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

    // Verificar que tenga al menos 4 columnas
    const firstRow = jsonData[0];
    if (!firstRow || firstRow.length < 4) {
      throw new Error('El archivo debe tener al menos 4 columnas (A, B, C, D). Se usarán solo las primeras 4 columnas.');
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
    if (error instanceof Error) {
      throw error;
    }
    throw new Error('Error desconocido al cargar el archivo Excel');
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