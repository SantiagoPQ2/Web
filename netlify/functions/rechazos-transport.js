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
      const { transporte, cliente, motivoRechazo, monto, fecha } = body;

      // Validate all required fields
      if (!transporte || !cliente || !motivoRechazo || !monto || !fecha) {
        return {
          statusCode: 400,
          headers: {
            "Access-Control-Allow-Origin": "https://vafoodbot.netlify.app",
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            success: false,
            error: "Todos los campos son obligatorios (transporte, cliente, motivo, monto, fecha)"
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
      const rowData = [
        transporte.trim(),
        cliente.trim(),
        motivoRechazo.trim(),
        monto.trim(),
        fecha.trim()
      ];

      // Ensure sheet exists (if not, create it)
      try {
        await sheets.spreadsheets.get({
          spreadsheetId: spreadsheetId,
          ranges: ['Rechazos!A1:E1']
        });
      } catch (error) {
        try {
          await sheets.spreadsheets.batchUpdate({
            spreadsheetId: spreadsheetId,
            resource: {
              requests: [{
                addSheet: { properties: { title: 'Rechazos' } }
              }]
            }
          });

          await sheets.spreadsheets.values.update({
            spreadsheetId: spreadsheetId,
            range: 'Rechazos!A1:E1',
            valueInputOption: 'USER_ENTERED',
            resource: {
              values: [['Transporte', 'Cliente', 'Motivo de Rechazo', 'Monto', 'Fecha']]
            }
          });
        } catch (createError) {
          console.error('Error creating Rechazos sheet:', createError);
        }
      }

      // Append the new row
      await sheets.spreadsheets.values.append({
        spreadsheetId: spreadsheetId,
        range: "Rechazos!A:E",
        valueInputOption: "USER_ENTERED",
        resource: { values: [rowData] }
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
            fecha, // 🔥 ahora sí incluido correctamente
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
