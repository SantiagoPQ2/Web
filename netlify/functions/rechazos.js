const { google } = require("googleapis");

exports.handler = async (event, context) => {
  // Handle CORS preflight requests
  if (event.httpMethod === "OPTIONS") {
    return {
      statusCode: 200,
      headers: {
        "Access-Control-Allow-Origin": "https://vafoodbot.netlify.app",
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
        "Access-Control-Allow-Methods": "POST, GET, OPTIONS"
      },
      body: ""
    };
  }

  try {
    if (event.httpMethod === "POST") {
      const body = JSON.parse(event.body);
      
      // Extract data in the exact sequence required
      const { cliente, articulo, bultos, bonificacion, nombreVendedor, fecha } = body;

      // Validate all required fields
      if (!cliente || !articulo || !bultos || !bonificacion || !nombreVendedor || !fecha) {
        return {
          statusCode: 400,
          headers: {
            "Access-Control-Allow-Origin": "https://vafoodbot.netlify.app",
            "Content-Type": "application/json"
          },
          body: JSON.stringify({ 
            success: false, 
            error: "Todos los campos son obligatorios" 
          })
        };
      }

      // Validate numeric fields
      if (isNaN(Number(bultos)) || Number(bultos) <= 0) {
        return {
          statusCode: 400,
          headers: {
            "Access-Control-Allow-Origin": "https://vafoodbot.netlify.app",
            "Content-Type": "application/json"
          },
          body: JSON.stringify({ 
            success: false, 
            error: "Bultos debe ser un número válido mayor a 0" 
          })
        };
      }

      if (isNaN(Number(bonificacion)) || Number(bonificacion) < 0) {
        return {
          statusCode: 400,
          headers: {
            "Access-Control-Allow-Origin": "https://vafoodbot.netlify.app",
            "Content-Type": "application/json"
          },
          body: JSON.stringify({ 
            success: false, 
            error: "Bonificación debe ser un número válido mayor o igual a 0" 
          })
        };
      }

      // Configure Google Sheets authentication using environment variables
      const auth = new google.auth.JWT(
        process.env.GOOGLE_CLIENT_EMAIL,
        null,
        process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, "\n"),
        ["https://www.googleapis.com/auth/spreadsheets"]
      );

      const sheets = google.sheets({ version: "v4", auth });
      const spreadsheetId = process.env.SPREADSHEET_ID;

      // Prepare data in exact sequence for Google Sheets
      // Order: Cliente, Artículo, Bultos, Bonificación, Nombre del Vendedor, Fecha
      const rowData = [
        cliente.trim(),
        articulo.trim(), 
        bultos.trim(),
        bonificacion.trim(),
        nombreVendedor.trim(),
        fecha
      ];

      // First, try to get the sheet to check if it exists
      try {
        await sheets.spreadsheets.get({
          spreadsheetId: spreadsheetId,
          ranges: ['bonificaciones!A1:F1']
        });
      } catch (error) {
        // If sheet doesn't exist, create it with headers
        try {
          await sheets.spreadsheets.batchUpdate({
            spreadsheetId: spreadsheetId,
            resource: {
              requests: [{
                addSheet: {
                  properties: {
                    title: 'bonificaciones'
                  }
                }
              }]
            }
          });

          // Add headers in exact sequence
          await sheets.spreadsheets.values.update({
            spreadsheetId: spreadsheetId,
            range: 'bonificaciones!A1:F1',
            valueInputOption: 'USER_ENTERED',
            resource: {
              values: [['Cliente', 'Artículo', 'Bultos', 'Bonificación', 'Nombre del Vendedor', 'Fecha']]
            }
          });
        } catch (createError) {
          console.error('Error creating sheet:', createError);
        }
      }

      // Append the new row to the sheet
      const appendResult = await sheets.spreadsheets.values.append({
        spreadsheetId: spreadsheetId,
        range: "bonificaciones!A:F",
        valueInputOption: "USER_ENTERED",
        resource: {
          values: [rowData]
        }
      });

      console.log('Data successfully saved to Google Sheets:', {
        cliente,
        articulo,
        bultos,
        bonificacion,
        nombreVendedor,
        fecha,
        updatedRows: appendResult.data.updates?.updatedRows
      });

      return {
        statusCode: 200,
        headers: {
          "Access-Control-Allow-Origin": "https://vafoodbot.netlify.app",
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ 
          success: true, 
          message: "Registro de bonificación guardado correctamente",
          data: {
            cliente,
            articulo,
            bultos,
            bonificacion,
            nombreVendedor,
            fecha,
            timestamp: new Date().toISOString()
          }
        })
      };
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
    console.error('Error in rechazos function:', error);
    
    return {
      statusCode: 500,
      headers: {
        "Access-Control-Allow-Origin": "https://vafoodbot.netlify.app",
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ 
        success: false, 
        error: error.message || "Error interno del servidor"
      })
    };
  }
};
