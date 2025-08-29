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
      
      // Extract data in the exact sequence required for Rechazos
      const { transporte, cliente, motivoRechazo, monto } = body;

      // Validate all required fields
      if (!transporte || !cliente || !motivoRechazo || !monto) {
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

      // Validate numeric field
      if (isNaN(Number(monto)) || Number(monto) < 0) {
        return {
          statusCode: 400,
          headers: {
            "Access-Control-Allow-Origin": "https://vafoodbot.netlify.app",
            "Content-Type": "application/json"
          },
          body: JSON.stringify({ 
            success: false, 
            error: "Monto debe ser un número válido mayor o igual a 0" 
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
      // Order: Transporte, Cliente, Motivo de Rechazo, Monto
      const rowData = [
        transporte.trim(),
        cliente.trim(), 
        motivoRechazo.trim(),
        monto.trim()
      ];

      // First, try to get the sheet to check if it exists
      try {
        await sheets.spreadsheets.get({
          spreadsheetId: spreadsheetId,
          ranges: ['Rechazos!A1:D1']
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
                    title: 'Rechazos'
                  }
                }
              }]
            }
          });

          // Add headers in exact sequence
          await sheets.spreadsheets.values.update({
            spreadsheetId: spreadsheetId,
            range: 'Rechazos!A1:D1',
            valueInputOption: 'USER_ENTERED',
            resource: {
              values: [['Transporte', 'Cliente', 'Motivo de Rechazo', 'Monto']]
            }
          });
        } catch (createError) {
          console.error('Error creating Rechazos sheet:', createError);
        }
      }

      // Append the new row to the sheet
      const appendResult = await sheets.spreadsheets.values.append({
        spreadsheetId: spreadsheetId,
        range: "Rechazos!A:D",
        valueInputOption: "USER_ENTERED",
        resource: {
          values: [rowData]
        }
      });

      console.log('Rechazo data successfully saved to Google Sheets:', {
        transporte,
        cliente,
        motivoRechazo,
        monto,
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
          message: "Registro de rechazo guardado correctamente",
          data: {
            transporte,
            cliente,
            motivoRechazo,
            monto,
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
    console.error('Error in rechazos-transport function:', error);
    
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