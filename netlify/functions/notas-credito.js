const { google } = require("googleapis");

exports.handler = async (event) => {
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
      const { cliente, numeroNC, monto, descripcion, fecha } = body;

      if (!cliente || !numeroNC || !monto || !descripcion || !fecha) {
        return {
          statusCode: 400,
          headers: { "Access-Control-Allow-Origin": "https://vafoodbot.netlify.app" },
          body: JSON.stringify({ success: false, error: "Todos los campos son obligatorios" })
        };
      }

      const auth = new google.auth.JWT(
        process.env.GOOGLE_CLIENT_EMAIL,
        null,
        process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, "\n"),
        ["https://www.googleapis.com/auth/spreadsheets"]
      );

      const sheets = google.sheets({ version: "v4", auth });
      const spreadsheetId = process.env.SPREADSHEET_ID;

      const rowData = [
        cliente.trim(),
        numeroNC.trim(),
        monto.trim(),
        descripcion.trim(),
        fecha.trim()
      ];

      await sheets.spreadsheets.values.append({
        spreadsheetId,
        range: "NC!A:E",
        valueInputOption: "USER_ENTERED",
        resource: { values: [rowData] }
      });

      return {
        statusCode: 200,
        headers: { "Access-Control-Allow-Origin": "https://vafoodbot.netlify.app" },
        body: JSON.stringify({ success: true, message: "Nota de crédito registrada correctamente" })
      };
    }

    return { statusCode: 405, body: "Method Not Allowed" };
  } catch (error) {
    console.error("Error en notas-credito:", error);
    return {
      statusCode: 500,
      headers: { "Access-Control-Allow-Origin": "https://vafoodbot.netlify.app" },
      body: JSON.stringify({ success: false, error: error.message })
    };
  }
};
