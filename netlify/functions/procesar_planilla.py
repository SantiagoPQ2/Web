import re
import unicodedata
import tempfile
import base64
import json
from pathlib import Path
from typing import List, Dict, Tuple, Optional
import pandas as pd
import pdfplumber

# ───────────────────────────────
# Función principal de Netlify
# ───────────────────────────────
def handler(event, context):
    try:
        # Decodificar el PDF recibido (base64)
        body = event.get("body")
        if event.get("isBase64Encoded"):
            pdf_bytes = base64.b64decode(body)
        else:
            pdf_bytes = body.encode("latin1")

        # Guardar PDF temporalmente
        tmp_pdf = tempfile.NamedTemporaryFile(delete=False, suffix=".pdf")
        tmp_pdf.write(pdf_bytes)
        tmp_pdf.close()

        # Generar Excel temporal
        tmp_xlsx = tempfile.NamedTemporaryFile(delete=False, suffix=".xlsx")
        run_extraction(tmp_pdf.name, tmp_xlsx.name)

        # Leer Excel para devolver al frontend
        with open(tmp_xlsx.name, "rb") as f:
            excel_bytes = f.read()

        return {
            "statusCode": 200,
            "headers": {
                "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                "Content-Disposition": "attachment; filename=resumen_planilla_carga.xlsx"
            },
            "isBase64Encoded": True,
            "body": base64.b64encode(excel_bytes).decode("utf-8")
        }

    except Exception as e:
        return {
            "statusCode": 500,
            "body": json.dumps({"error": str(e)})
        }


# ───────────────────────────────
# Lógica interna (tu código original adaptado)
# ───────────────────────────────
X_TOL = 1.7
Y_TOL = 1.7
BULTOS_WINDOW_LEFT = 70

def normalize(s: str) -> str:
    return "".join(c for c in unicodedata.normalize("NFKD", s) if not unicodedata.combining(c))

def is_planilla_header_text(text: str, header_lines: int = 15) -> bool:
    if not text:
        return False
    head = "\n".join(text.splitlines()[:header_lines])
    head_norm = re.sub(r"\s+", " ", head.upper())
    if "PLANILLA DE CARGA" not in head_norm:
        return False
    if "COMPOSICION DE CARGA" in head_norm:
        return False
    if "PLANILLA ADMINISTRATIVA" in head_norm:
        return False
    return True

def find_columns(words) -> Tuple[Optional[float], Optional[float], Optional[float], Optional[float]]:
    sku_x = desc_x = a_cargar_x = None
    bultos_x_candidates: List[float] = []
    for w in words:
        t = normalize(w["text"]).upper().strip()
        x = w["x0"]
        if t == "SKU" and sku_x is None:
            sku_x = x
        elif t.startswith("DESCRIPCION") and desc_x is None:
            desc_x = x
        elif t == "BULTOS":
            bultos_x_candidates.append(x)
        elif t in {"A", "CARGAR", "A CARGAR"}:
            a_cargar_x = x if a_cargar_x is None else max(a_cargar_x, x)
    left_bultos_x = min(bultos_x_candidates) if bultos_x_candidates else None
    return sku_x, desc_x, left_bultos_x, a_cargar_x

def extract_transporte(words, line_tol: float = 5.0) -> Optional[str]:
    idxs = [i for i, w in enumerate(words) if normalize(w["text"]).lower().startswith("transporte")]
    if not idxs:
        return None
    i = idxs[0]
    base_top = words[i]["top"]
    out = []
    for j in range(i + 1, min(i + 25, len(words))):
        w = words[j]
        if abs(w["top"] - base_top) > line_tol:
            break
        t_norm = normalize(w["text"]).strip()
        if not t_norm or t_norm.endswith(":"):
            continue
        if t_norm.upper() in {"CHOFER", "KM"}:
            break
        out.append(w["text"])
    return " ".join(out).strip(" |") or None

def group_lines(words, y_tol: float = 2.0):
    lines = {}
    for w in words:
        key = round(w["top"] / y_tol) * y_tol
        lines.setdefault(key, []).append(w)
    ordered = []
    for y in sorted(lines.keys()):
        ws = sorted(lines[y], key=lambda x: x["x0"])
        ordered.append((y, ws))
    return ordered

def parse_planilla_page(page, x_tol: float, y_tol: float):
    words = page.extract_words(x_tolerance=x_tol, y_tolerance=y_tol, use_text_flow=True)
    sku_x, desc_x, left_bultos_x, a_cargar_x = find_columns(words)
    if sku_x is None or desc_x is None or left_bultos_x is None:
        return []
    bound_sku_desc = (sku_x + desc_x) / 2
    bultos_left_min = left_bultos_x - 10
    bultos_left_max = left_bultos_x + BULTOS_WINDOW_LEFT
    transporte = extract_transporte(words)
    rows: List[Dict] = []
    for _, ws in group_lines(words, y_tol=y_tol):
        joined_norm = " ".join(normalize(w["text"]).upper() for w in ws)
        if "SKU" in joined_norm and "BULTOS" in joined_norm:
            continue
        if any(term in joined_norm for term in ["COMPOSICION DE CARGA", "PLANILLA ADMINISTRATIVA", "TOTAL ALMACEN"]):
            continue
        sku_tokens  = [w for w in ws if w["x0"] <= bound_sku_desc]
        desc_tokens = [w for w in ws if bound_sku_desc < w["x0"] < bultos_left_min]
        bult_tokens = [w for w in ws if bultos_left_min <= w["x0"] <= bultos_left_max]
        sku_text  = " ".join(w["text"] for w in sku_tokens).strip()
        desc_text = " ".join(w["text"] for w in desc_tokens).strip()
        bult_text = " ".join(w["text"] for w in bult_tokens).strip()
        msku = re.match(r"^\s*(\d{2,})\b", normalize(sku_text))
        if not msku:
            continue
        if re.match(r"^\s*\d{2,}\s*-\s*", normalize(sku_text)):
            continue
        sku = msku.group(1)
        if not desc_text or len(desc_text) < 2:
            continue
        mb = re.search(r"\b(\d{1,5})\b", normalize(bult_text)) or re.search(r"\b(\d{1,5})\b$", normalize(desc_text))
        if not mb:
            continue
        bultos = int(mb.group(1))
        rows.append({"Transporte": transporte, "Codigo de articulo": sku, "Descripcion": desc_text, "Bultos": bultos})
    return rows

def run_extraction(pdf_path: str, out_xlsx: str):
    all_rows: List[Dict] = []
    with pdfplumber.open(pdf_path) as pdf:
        for page in pdf.pages:
            txt = page.extract_text() or ""
            if not is_planilla_header_text(txt):
                continue
            all_rows.extend(parse_planilla_page(page, x_tol=X_TOL, y_tol=Y_TOL))
    if not all_rows:
        empty = pd.DataFrame(columns=["Transporte", "Codigo de articulo", "Descripcion", "Bultos"])
        with pd.ExcelWriter(out_xlsx, engine="xlsxwriter") as writer:
            empty.to_excel(writer, index=False, sheet_name="Detalle")
            empty.to_excel(writer, index=False, sheet_name="Resumen")
        return
    df = pd.DataFrame(all_rows).dropna(subset=["Transporte", "Codigo de articulo", "Descripcion", "Bultos"])
    df["Bultos"] = df["Bultos"].astype(int)
    df = df.sort_values(by=["Transporte", "Codigo de articulo", "Descripcion"]).reset_index(drop=True)
    resumen = df.groupby(["Transporte", "Codigo de articulo", "Descripcion"], as_index=False)["Bultos"].sum()
    with pd.ExcelWriter(out_xlsx, engine="xlsxwriter") as writer:
        df.to_excel(writer, index=False, sheet_name="Detalle")
        resumen.to_excel(writer, index=False, sheet_name="Resumen")
