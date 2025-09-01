const { google } = require("googleapis");

exports.handler = async (event, context) => {
  // Handle CORS preflight requests
  if (event.httpMethod === "OPTIONS") {
    return {
      statusCode: 200,
      headers: {
        "Access-Control-Allow-Origin": "https://vafoodbot.netlify.app",
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
        "Access-Control-Allow-Methods": "GET, OPTIONS"
      },
      body: ""
    };
  }

  try {
    if (event.httpMethod === "GET") {
      // Configure Google Sheets authentication using environment variables
      const auth = new google.auth.JWT(
        process.env.GOOGLE_CLIENT_EMAIL,
        null,
        process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, "\n"),
        ["https://www.googleapis.com/auth/spreadsheets"]
      );

      const sheets = google.sheets({ version: "v4", auth });
      const spreadsheetId = process.env.SPREADSHEET_ID;

      try {
        // Get all data from Rechazos sheet
        const response = await sheets.spreadsheets.values.get({
          spreadsheetId: spreadsheetId,
          range: 'Rechazos!A:D', // Transporte, Cliente, Motivo, Monto
        });

        const rows = response.data.values || [];
        
        // Skip header row and process data
        const rechazos = rows.slice(1).map(row => ({
          transporte: row[0] || '',
          cliente: row[1] || '',
          motivoRechazo: row[2] || '',
          monto: row[3] || '0'
        }));

        console.log(`Successfully retrieved ${rechazos.length} rechazos from Google Sheets`);

        return {
          statusCode: 200,
          headers: {
            "Access-Control-Allow-Origin": "https://vafoodbot.netlify.app",
            "Content-Type": "application/json"
          },
          body: JSON.stringify({ 
            success: true,
            rechazos: rechazos,
            total: rechazos.length
          })
        };

      } catch (sheetsError) {
        console.error('Error accessing Rechazos sheet:', sheetsError);
        
        // If sheet doesn't exist, return empty array
        if (sheetsError.message && sheetsError.message.includes('Unable to parse range')) {
          return {
            statusCode: 200,
            headers: {
              "Access-Control-Allow-Origin": "https://vafoodbot.netlify.app",
              "Content-Type": "application/json"
            },
            body: JSON.stringify({ 
              success: true,
              rechazos: [],
              total: 0,
              message: "La hoja 'Rechazos' no existe aún. Se creará automáticamente al registrar el primer rechazo."
            })
          };
        }

        throw sheetsError;
      }
    }

    // Method not allowed
    return {
      statusCode: 405,
      headers: {
        "Access-Control-Allow-Origin": "https://vafoodbot.netlify.app",
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ 
        success: false, 
        error: "Method Not Allowed" 
      })
    };

  } catch (error) {
    console.error('Error in get-rechazos function:', error);
    
    return {
      statusCode: 500,
      headers: {
        "Access-Control-Allow-Origin": "https://vafoodbot.netlify.app",
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ 
        success: false, 
        error: error.message || "Error interno del servidor al obtener rechazos"
      })
    };
  }
};