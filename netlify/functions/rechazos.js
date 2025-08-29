const { google } = require("googleapis");

exports.handler = async (event) => {
  try {
    if (event.httpMethod === "POST") {
      const body = JSON.parse(event.body);
      const { cliente, motivo, fecha } = body;

      if (!cliente || !motivo || !fecha) {
        return {
          statusCode: 400,
          body: JSON.stringify({ success: false, error: "Faltan campos" })
        };
      }

      // Autenticación con variables de entorno
      const auth = new google.auth.JWT(
        process.env.GOOGLE_CLIENT_EMAIL,
        null,
        process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, "\n"),
        ["https://www.googleapis.com/auth/spreadsheets"]
      );

      const sheets = google.sheets({ version: "v4", auth });

      await sheets.spreadsheets.values.append({
        spreadsheetId: process.env.SPREADSHEET_ID,
        range: "Bonificaciones!A:C",
        valueInputOption: "USER_ENTERED",
        resource: {
          values: [[cliente, motivo, fecha]]
        }
      });

      return {
        statusCode: 200,
        body: JSON.stringify({ success: true, message: "Registro guardado" })
      };
    }

    return { statusCode: 405, body: "Method Not Allowed" };
  } catch (error) {
    console.error(error);
    return { statusCode: 500, body: JSON.stringify({ success: false, error: error.message }) };
  }
};

