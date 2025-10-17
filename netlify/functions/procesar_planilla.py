import os
import tempfile
import subprocess
from flask import Response
import json

def handler(event, context):
    try:
        # Guardar PDF temporalmente
        pdf_bytes = event['body']
        tmp_pdf = tempfile.NamedTemporaryFile(delete=False, suffix=".pdf")
        tmp_pdf.write(bytes(pdf_bytes, 'utf-8'))
        tmp_pdf.close()

        tmp_xlsx = tmp_pdf.name.replace(".pdf", ".xlsx")

        # Ejecutar el script original de Python que me pasaste
        subprocess.run(["python3", "process_planilla.py", tmp_pdf.name, tmp_xlsx], check=True)

        with open(tmp_xlsx, "rb") as f:
            data = f.read()

        return {
            "statusCode": 200,
            "headers": {"Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"},
            "body": data.decode("latin1"),
            "isBase64Encoded": False,
        }
    except Exception as e:
        return {
            "statusCode": 500,
            "body": json.dumps({"error": str(e)}),
        }
