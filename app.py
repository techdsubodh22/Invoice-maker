import os
import json
import io
import re
from datetime import date
from flask import Flask, render_template, request, jsonify, send_file, abort

app = Flask(__name__)

INVOICE_COUNTER_FILE = os.path.join(os.path.dirname(__file__), 'invoice_counter.json')


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _load_counter():
    if os.path.exists(INVOICE_COUNTER_FILE):
        with open(INVOICE_COUNTER_FILE, 'r') as f:
            return json.load(f)
    return {"year": date.today().year, "seq": 0}


def _save_counter(data):
    with open(INVOICE_COUNTER_FILE, 'w') as f:
        json.dump(data, f)


def _next_invoice_number():
    data = _load_counter()
    current_year = date.today().year
    if data.get("year") != current_year:
        data = {"year": current_year, "seq": 0}
    data["seq"] += 1
    _save_counter(data)
    return f"INV-{data['year']}-{data['seq']:03d}"


def _peek_invoice_number():
    """Return what the *next* number would be without incrementing."""
    data = _load_counter()
    current_year = date.today().year
    if data.get("year") != current_year:
        seq = 1
    else:
        seq = data.get("seq", 0) + 1
    return f"INV-{current_year}-{seq:03d}"


def _sanitize(data: dict) -> dict:
    """Coerce numeric fields and calculate derived totals.

    Items have an 'item_type' field: 'service' or 'expense'.
    GST applies only to service items. Expenses are reimbursements.
    """
    items = data.get("items", [])
    services_subtotal = 0.0
    expenses_subtotal = 0.0

    for item in items:
        try:
            qty  = float(item.get("quantity", 0) or 0)
            rate = float(item.get("rate", 0) or 0)
        except (ValueError, TypeError):
            qty, rate = 0.0, 0.0
        item["quantity"] = qty
        item["rate"]     = rate
        item["amount"]   = round(qty * rate, 2)
        if item.get("item_type") == "expense":
            expenses_subtotal += item["amount"]
        else:
            item["item_type"] = "service"
            services_subtotal += item["amount"]

    data["services_subtotal"] = round(services_subtotal, 2)
    data["expenses_subtotal"] = round(expenses_subtotal, 2)
    data["subtotal"]          = round(services_subtotal + expenses_subtotal, 2)
    data["has_expenses"]      = expenses_subtotal > 0

    gst_mode = data.get("gst_mode", False)

    if gst_mode:
        gst_type = data.get("gst_type", "cgst_sgst")
        # GST on services only
        if gst_type == "cgst_sgst":
            cgst = round(services_subtotal * 9 / 100, 2)
            sgst = round(services_subtotal * 9 / 100, 2)
            igst = 0.0
        else:
            cgst = 0.0
            sgst = 0.0
            igst = round(services_subtotal * 18 / 100, 2)
        data["cgst"]       = cgst
        data["sgst"]       = sgst
        data["igst"]       = igst
        data["total_gst"]  = round(cgst + sgst + igst, 2)
        data["grand_total"] = round(services_subtotal + expenses_subtotal + data["total_gst"], 2)
    else:
        data["grand_total"] = round(services_subtotal + expenses_subtotal, 2)

    return data


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------

@app.route("/")
def index():
    next_num = _peek_invoice_number()
    today = date.today().isoformat()
    return render_template("index.html", next_invoice_number=next_num, today=today)


@app.route("/api/next-invoice-number")
def api_next_invoice_number():
    return jsonify({"invoice_number": _peek_invoice_number()})


@app.route("/preview", methods=["POST"])
def preview():
    data = request.get_json(force=True)
    data = _sanitize(data)
    template_name = data.get("template", "classic")
    allowed = {"classic", "modern", "minimal", "corporate"}
    if template_name not in allowed:
        template_name = "classic"
    return render_template("preview.html", d=data, template=template_name)


def _inline_css_html(html_string, template_name):
    """Replace the <link> stylesheet tag with an inlined <style> block.
    Also strips Google Fonts @import so weasyprint doesn't need internet access."""
    css_path = os.path.join(app.static_folder, 'css', f'invoice-{template_name}.css')
    with open(css_path, 'r', encoding='utf-8') as f:
        css_content = f.read()
    # Remove Google Fonts imports (fail gracefully without internet)
    css_content = re.sub(r'@import\s+url\([^)]+\);\s*', '', css_content)
    html_string = re.sub(
        r'<link[^>]+invoice-[^.]+\.css[^>]*>',
        f'<style>{css_content}</style>',
        html_string
    )
    return html_string


@app.route("/export/pdf", methods=["POST"])
def export_pdf():
    try:
        from weasyprint import HTML
    except ImportError:
        abort(500, "weasyprint is not installed. Run: pip install weasyprint")

    data = request.get_json(force=True)
    data = _sanitize(data)
    template_name = data.get("template", "classic")
    allowed = {"classic", "modern", "minimal", "corporate"}
    if template_name not in allowed:
        template_name = "classic"

    if not data.get("invoice_number"):
        data["invoice_number"] = _next_invoice_number()

    html_string = render_template("preview.html", d=data, template=template_name)
    html_string = _inline_css_html(html_string, template_name)

    pdf_bytes = HTML(string=html_string).write_pdf()

    inv_num = re.sub(r'[^A-Za-z0-9_-]', '_', data.get("invoice_number", "invoice"))
    filename = f"{inv_num}.pdf"
    return send_file(
        io.BytesIO(pdf_bytes),
        mimetype="application/pdf",
        as_attachment=True,
        download_name=filename
    )


@app.route("/export/docx", methods=["POST"])
def export_docx():
    try:
        from weasyprint import HTML
        from pdf2docx import Converter
    except ImportError:
        abort(500, "Required packages missing. Run: pip install weasyprint pdf2docx")

    import tempfile

    data = request.get_json(force=True)
    data = _sanitize(data)
    template_name = data.get("template", "classic")
    allowed = {"classic", "modern", "minimal", "corporate"}
    if template_name not in allowed:
        template_name = "classic"

    if not data.get("invoice_number"):
        data["invoice_number"] = _next_invoice_number()

    html_string = render_template("preview.html", d=data, template=template_name)
    html_string = _inline_css_html(html_string, template_name)

    pdf_bytes = HTML(string=html_string).write_pdf()

    pdf_fd, pdf_path = tempfile.mkstemp(suffix='.pdf')
    docx_fd, docx_path = tempfile.mkstemp(suffix='.docx')
    try:
        os.write(pdf_fd, pdf_bytes)
        os.close(pdf_fd)
        os.close(docx_fd)

        cv = Converter(pdf_path)
        cv.convert(docx_path, start=0, end=None)
        cv.close()

        with open(docx_path, 'rb') as f:
            docx_bytes = f.read()
    finally:
        if os.path.exists(pdf_path):
            os.unlink(pdf_path)
        if os.path.exists(docx_path):
            os.unlink(docx_path)

    inv_num = re.sub(r'[^A-Za-z0-9_-]', '_', data.get("invoice_number", "invoice"))
    filename = f"{inv_num}.docx"
    return send_file(
        io.BytesIO(docx_bytes),
        mimetype="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        as_attachment=True,
        download_name=filename
    )


if __name__ == "__main__":
    app.run(debug=True, port=7765)
