const { google } = require("googleapis");

exports.handler = async (event, context) => {
  // 🔹 Manejo de preflight CORS
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
      const body = JSON.parse(event.body || "{}");

      // 🔹 Extraer datos esperados
      const { transporte, cliente, motivoRechazo, monto, fecha } = body;

      // 🔹 Validar campos obligatorios
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

      // 🔹 Validar campo numérico
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

      // 🔹 Autenticación Google Sheets
      const auth = new google.auth.JWT(
        process.env.GOOGLE_CLIENT_EMAIL,
        null,
        process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, "\n"),
        ["https://www.googleapis.com/auth/spreadsheets"]
      );

      const sheets = google.sheets({ version: "v4", auth });
      const spreadsheetId = process.env.SPREADSHEET_ID;

      // 🔹 Datos a insertar
      const rowData = [
        transporte.trim(),
        cliente.trim(),
        motivoRechazo.trim(),
        monto.trim(),
        fecha.trim()
      ];

      // 🔹 Verificar existencia de la hoja "Rechazos"
      try {
        await sheets.spreadsheets.get({
          spreadsheetId,
          ranges: ["Rechazos!A1:E1"]
        });
      } catch (error) {
        console.log("Hoja Rechazos no existe, creando...");

        await sheets.spreadsheets.batchUpdate({
          spreadsheetId,
          resource: {
            requests: [{
              addSheet: { properties: { title: "Rechazos" } }
            }]
          }
        });

        // Cabeceras
        await sheets.spreadsheets.values.update({
          spreadsheetId,
          range: "Rechazos!A1:E1",
          valueInputOption: "USER_ENTERED",
          resource: {
            values: [["Transporte", "Cliente", "Motivo de Rechazo", "Monto", "Fecha"]]
          }
        });
      }

      // 🔹 Insertar fila en la hoja
      await sheets.spreadsheets.values.append({
        spreadsheetId,
        range: "Rechazos!A:E",
        valueInputOption: "USER_ENTERED",
        resource: { values: [rowData] }
      });

      // 🔹 Respuesta exitosa
      return {
        statusCode: 200,
        headers: {
          "Access-Control-Allow-Origin": "https://vafoodbot.netlify.app",
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          success: true,
          message: "Registro de rechazo guardado correctamente",
          data: { transporte, cliente, motivoRechazo, monto, fecha, timestamp: new Date().toISOString() }
        })
      };
    }

    // 🔹 Método no permitido
    return {
      statusCode: 405,
      headers: {
        "Access-Control-Allow-Origin": "https://vafoodbot.netlify.app",
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ success: false, error: "Method Not Allowed" })
    };

  } catch (error) {
    console.error("Error en rechazos-transport:", error);

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
