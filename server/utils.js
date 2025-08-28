const { GoogleSpreadsheet } = require('google-spreadsheet');
const { JWT } = require('google-auth-library');

// Configuración de Google Sheets
const SPREADSHEET_ID = process.env.GOOGLE_SPREADSHEET_ID || 'tu-spreadsheet-id';
const GOOGLE_SERVICE_ACCOUNT_EMAIL = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
const GOOGLE_PRIVATE_KEY = process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n');

// Inicializar autenticación JWT
const serviceAccountAuth = new JWT({
  email: GOOGLE_SERVICE_ACCOUNT_EMAIL,
  key: GOOGLE_PRIVATE_KEY,
  scopes: ['https://www.googleapis.com/auth/spreadsheets'],
});

/**
 * Obtiene el documento de Google Sheets
 * @returns {GoogleSpreadsheet} Documento de Google Sheets
 */
async function getSpreadsheet() {
  try {
    const doc = new GoogleSpreadsheet(SPREADSHEET_ID, serviceAccountAuth);
    await doc.loadInfo();
    return doc;
  } catch (error) {
    console.error('Error al conectar con Google Sheets:', error);
    throw new Error('No se pudo conectar con Google Sheets');
  }
}

/**
 * Agrega una fila al final de la hoja de cálculo
 * @param {Array} values - Array con los valores a agregar [cliente, motivo, fecha]
 * @returns {Object} Resultado de la operación
 */
async function appendToSheet(values) {
  try {
    if (!values || !Array.isArray(values) || values.length !== 3) {
      throw new Error('Se requieren exactamente 3 valores: [cliente, motivo, fecha]');
    }

    const [cliente, motivo, fecha] = values;
    
    // Validar que los valores no estén vacíos
    if (!cliente || !motivo || !fecha) {
      throw new Error('Todos los campos son obligatorios');
    }

    const doc = await getSpreadsheet();
    const sheet = doc.sheetsByIndex[0]; // Primera hoja

    // Agregar timestamp
    const timestamp = new Date().toISOString();
    
    // Agregar fila con los datos
    const newRow = await sheet.addRow({
      'Cliente': cliente,
      'Motivo': motivo,
      'Fecha': fecha,
      'Timestamp': timestamp
    });

    console.log('Fila agregada exitosamente:', {
      cliente,
      motivo,
      fecha,
      timestamp
    });

    return {
      success: true,
      data: {
        cliente,
        motivo,
        fecha,
        timestamp,
        rowNumber: newRow.rowNumber
      }
    };

  } catch (error) {
    console.error('Error en appendToSheet:', error);
    throw error;
  }
}

/**
 * Obtiene todos los rechazos de la hoja de cálculo
 * @returns {Array} Array con todos los rechazos
 */
async function getAllRejections() {
  try {
    const doc = await getSpreadsheet();
    const sheet = doc.sheetsByIndex[0]; // Primera hoja
    
    const rows = await sheet.getRows();
    
    const rejections = rows.map(row => ({
      cliente: row.get('Cliente') || '',
      motivo: row.get('Motivo') || '',
      fecha: row.get('Fecha') || '',
      timestamp: row.get('Timestamp') || ''
    }));

    return rejections;

  } catch (error) {
    console.error('Error en getAllRejections:', error);
    throw error;
  }
}

/**
 * Obtiene rechazos filtrados por fecha
 * @param {string} startDate - Fecha de inicio (YYYY-MM-DD)
 * @param {string} endDate - Fecha de fin (YYYY-MM-DD)
 * @returns {Array} Array con rechazos filtrados
 */
async function getRejectionsByDateRange(startDate, endDate) {
  try {
    const allRejections = await getAllRejections();
    
    const filtered = allRejections.filter(rejection => {
      const rejectionDate = new Date(rejection.fecha);
      const start = new Date(startDate);
      const end = new Date(endDate);
      
      return rejectionDate >= start && rejectionDate <= end;
    });

    return filtered;

  } catch (error) {
    console.error('Error en getRejectionsByDateRange:', error);
    throw error;
  }
}

/**
 * Inicializa la hoja de cálculo con headers si no existen
 * @returns {Object} Resultado de la operación
 */
async function initializeSheet() {
  try {
    const doc = await getSpreadsheet();
    const sheet = doc.sheetsByIndex[0];
    
    // Verificar si ya tiene headers
    const rows = await sheet.getRows();
    
    if (rows.length === 0) {
      // Agregar headers
      await sheet.setHeaderRow(['Cliente', 'Motivo', 'Fecha', 'Timestamp']);
      console.log('Headers inicializados en la hoja de cálculo');
    }

    return { success: true, message: 'Hoja inicializada correctamente' };

  } catch (error) {
    console.error('Error en initializeSheet:', error);
    throw error;
  }
}

module.exports = {
  appendToSheet,
  getAllRejections,
  getRejectionsByDateRange,
  initializeSheet
};