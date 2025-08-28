const { google } = require('googleapis');
const path = require('path');

// --- Configuración de Google Sheets ---
const SPREADSHEET_ID = '1_9rPIkCMcjJKfhFZTJRwgqXKQaPsICpV6UewPk-GLT0';
const SHEET_NAME = 'Bonificaciones'; // Nombre de la hoja específica

// --- Autenticación global ---
const auth = new google.auth.GoogleAuth({
  keyFile: path.join(__dirname, 'google.json'),
  scopes: ['https://www.googleapis.com/auth/spreadsheets']
});

// Inicializar cliente de Google Sheets
const sheets = google.sheets({ version: 'v4', auth });

/**
 * Obtiene el cliente autenticado de Google Sheets
 * @returns {Object} Cliente de Google Sheets autenticado
 */
async function getSheetsClient() {
  try {
    const authClient = await auth.getClient();
    return google.sheets({ version: 'v4', auth: authClient });
  } catch (error) {
    console.error('Error al autenticar con Google Sheets:', error);
    throw new Error('No se pudo autenticar con Google Sheets');
  }
}

/**
 * Verifica si la hoja "bonificaciones" existe, si no la crea
 * @returns {Promise<boolean>} True si la hoja existe o fue creada exitosamente
 */
async function ensureSheetExists() {
  try {
    const sheetsClient = await getSheetsClient();
    
    // Obtener información del spreadsheet
    const spreadsheet = await sheetsClient.spreadsheets.get({
      spreadsheetId: SPREADSHEET_ID
    });
    
    // Verificar si la hoja "bonificaciones" existe
    const sheetExists = spreadsheet.data.sheets.some(
      sheet => sheet.properties.title === SHEET_NAME
    );
    
    if (!sheetExists) {
      console.log(`Creando hoja "${SHEET_NAME}"...`);
      
      // Crear la hoja "bonificaciones"
      await sheetsClient.spreadsheets.batchUpdate({
        spreadsheetId: SPREADSHEET_ID,
        resource: {
          requests: [{
            addSheet: {
              properties: {
                title: SHEET_NAME
              }
            }
          }]
        }
      });
      
      // Agregar headers a la nueva hoja
      await sheetsClient.spreadsheets.values.update({
        spreadsheetId: SPREADSHEET_ID,
        range: `${SHEET_NAME}!A1:D1`,
        valueInputOption: 'RAW',
        resource: {
          values: [['Cliente', 'Motivo', 'Fecha', 'Timestamp']]
        }
      });
      
      console.log(`✅ Hoja "${SHEET_NAME}" creada exitosamente con headers`);
    }
    
    return true;
  } catch (error) {
    console.error('Error al verificar/crear la hoja:', error);
    throw error;
  }
}

/**
 * Agrega una fila al final de la hoja "bonificaciones"
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

    // Asegurar que la hoja existe
    await ensureSheetExists();

    const sheetsClient = await getSheetsClient();
    
    // Agregar timestamp
    const timestamp = new Date().toISOString();
    
    // Preparar los datos para insertar
    const rowData = [cliente, motivo, fecha, timestamp];
    
    // Agregar fila a la hoja "bonificaciones"
    const result = await sheetsClient.spreadsheets.values.append({
      spreadsheetId: SPREADSHEET_ID,
      range: `${SHEET_NAME}!A:D`,
      valueInputOption: 'RAW',
      insertDataOption: 'INSERT_ROWS',
      resource: {
        values: [rowData]
      }
    });

    console.log('✅ Fila agregada exitosamente a la hoja "bonificaciones":', {
      cliente,
      motivo,
      fecha,
      timestamp,
      range: result.data.updates.updatedRange
    });

    return {
      success: true,
      data: {
        cliente,
        motivo,
        fecha,
        timestamp,
        range: result.data.updates.updatedRange,
        updatedRows: result.data.updates.updatedRows
      }
    };

  } catch (error) {
    console.error('❌ Error en appendToSheet:', error);
    throw error;
  }
}

/**
 * Obtiene todos los rechazos de la hoja "bonificaciones"
 * @returns {Array} Array con todos los rechazos
 */
async function getAllRejections() {
  try {
    // Asegurar que la hoja existe
    await ensureSheetExists();

    const sheetsClient = await getSheetsClient();
    
    // Obtener todos los datos de la hoja "bonificaciones"
    const result = await sheetsClient.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: `${SHEET_NAME}!A:D`
    });

    const rows = result.data.values || [];
    
    // Saltar la primera fila (headers) si existe
    const dataRows = rows.length > 1 ? rows.slice(1) : [];
    
    const rejections = dataRows.map(row => ({
      cliente: row[0] || '',
      motivo: row[1] || '',
      fecha: row[2] || '',
      timestamp: row[3] || ''
    }));

    console.log(`📊 Obtenidos ${rejections.length} registros de la hoja "bonificaciones"`);
    return rejections;

  } catch (error) {
    console.error('❌ Error en getAllRejections:', error);
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
      if (!rejection.fecha) return false;
      
      const rejectionDate = new Date(rejection.fecha);
      const start = new Date(startDate);
      const end = new Date(endDate);
      
      return rejectionDate >= start && rejectionDate <= end;
    });

    console.log(`📅 Filtrados ${filtered.length} registros entre ${startDate} y ${endDate}`);
    return filtered;

  } catch (error) {
    console.error('❌ Error en getRejectionsByDateRange:', error);
    throw error;
  }
}

/**
 * Inicializa la hoja "bonificaciones" con headers si no existe
 * @returns {Object} Resultado de la operación
 */
async function initializeSheet() {
  try {
    await ensureSheetExists();
    return { 
      success: true, 
      message: `Hoja "${SHEET_NAME}" inicializada correctamente` 
    };
  } catch (error) {
    console.error('❌ Error en initializeSheet:', error);
    throw error;
  }
}

/**
 * Función de prueba para verificar la conexión
 * @returns {Object} Resultado de la prueba
 */
async function testConnection() {
  try {
    const sheetsClient = await getSheetsClient();
    
    // Obtener información básica del spreadsheet
    const spreadsheet = await sheetsClient.spreadsheets.get({
      spreadsheetId: SPREADSHEET_ID
    });
    
    console.log('🔗 Conexión exitosa con Google Sheets');
    console.log(`📋 Spreadsheet: ${spreadsheet.data.properties.title}`);
    console.log(`📊 Hojas disponibles: ${spreadsheet.data.sheets.map(s => s.properties.title).join(', ')}`);
    
    return {
      success: true,
      spreadsheetTitle: spreadsheet.data.properties.title,
      sheets: spreadsheet.data.sheets.map(s => s.properties.title)
    };
    
  } catch (error) {
    console.error('❌ Error al probar conexión:', error);
    throw error;
  }
}

module.exports = {
  appendToSheet,
  getAllRejections,
  getRejectionsByDateRange,
  initializeSheet,
  testConnection,
  SPREADSHEET_ID,
  SHEET_NAME
};
