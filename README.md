# Invoice Maker — Software Consultant Invoice Generator

A local web app to create professional invoices with 4 templates, live preview, and export to PDF or DOCX.
Supports both **with GST** and **without GST** modes (Indian context).

Runs on port **7765** — open in your browser at: `http://localhost:7765`

---

## Quick Start (if Python is already installed)

```bash
# 1. Open a terminal / command prompt in this folder
cd path/to/invoice-maker

# 2. Install dependencies
pip install flask weasyprint python-docx

# 3. Run the app
python app.py

# 4. Open your browser and go to:
http://localhost:7765
```

---

## Step-by-Step Setup (fresh machine)

### Step 1 — Install Python

**Windows:**
1. Go to https://www.python.org/downloads/
2. Download the latest Python 3.x installer (e.g. Python 3.12)
3. Run the installer — **IMPORTANT: check "Add Python to PATH"** before clicking Install
4. Open Command Prompt and verify:
   ```
   python --version
   ```
   You should see something like `Python 3.12.x`

**macOS:**
```bash
# Option A — using Homebrew (recommended)
brew install python

# Option B — download installer from python.org (same as Windows above)
```

**Linux (Ubuntu/Debian):**
```bash
sudo apt update
sudo apt install python3 python3-pip
```

---

### Step 2 — Open a Terminal in this Folder

**Windows:**
- Navigate to the `invoice-maker` folder in File Explorer
- Click the address bar, type `cmd`, press Enter
- OR: right-click inside the folder → "Open in Terminal"

**macOS / Linux:**
- Right-click the folder → "Open Terminal here"
- OR open Terminal and `cd` to the folder

---

### Step 3 — Install Dependencies

```bash
pip install flask weasyprint python-docx
```

If `pip` is not recognized on Windows, try:
```bash
python -m pip install flask weasyprint python-docx
```

If you're on macOS/Linux and `pip` doesn't work, try:
```bash
pip3 install flask weasyprint python-docx
```

---

### Step 4 — Run the App

```bash
python app.py
```

You should see:
```
 * Running on http://127.0.0.1:7765
```

Open your browser and visit: **http://localhost:7765**

---

## Troubleshooting

### "python is not recognized" (Windows)
- You forgot to check **"Add Python to PATH"** during installation
- Fix: Uninstall Python and reinstall — this time check that box
- OR search for "Edit the system environment variables" → Environment Variables → add Python's install path manually

### "pip is not recognized"
```bash
python -m pip install flask weasyprint python-docx
```

### Port already in use
The app uses port 7765. If you see "Address already in use":
```bash
# Find what's using it (Windows)
netstat -ano | findstr :7765

# Kill it (replace PID with the number from above)
taskkill /PID <PID> /F
```

### WeasyPrint issues on Windows
WeasyPrint needs GTK libraries. If PDF export fails:
```bash
pip install weasyprint
```
If it still fails, install GTK for Windows from:
https://github.com/tschoonj/GTK-for-Windows-Runtime-Environment-Installer/releases
Download and run the latest `.exe` installer, then restart your terminal.

### WeasyPrint issues on macOS
```bash
brew install pango libffi cairo
pip install weasyprint
```

### WeasyPrint issues on Linux
```bash
sudo apt install libpango-1.0-0 libpangoft2-1.0-0 libcairo2
pip install weasyprint
```

---

## Using a Virtual Environment (recommended for clean installs)

```bash
# Create virtual environment
python -m venv venv

# Activate it
# Windows:
venv\Scripts\activate
# macOS/Linux:
source venv/bin/activate

# Install dependencies
pip install flask weasyprint python-docx

# Run the app
python app.py

# To deactivate when done
deactivate
```

---

## Features

| Feature | Details |
|---|---|
| Templates | Classic, Modern Blue, Minimal, Corporate |
| GST Mode | Toggle ON/OFF — without GST hides all tax fields completely |
| GST Types | CGST + SGST (intra-state) or IGST (inter-state) at 18% |
| Line Items | Add/remove rows dynamically, auto-calculated amounts |
| Live Preview | Updates as you type (no page reload) |
| Export PDF | High-quality print-ready PDF via WeasyPrint |
| Export DOCX | Editable Word document via python-docx |
| Invoice Numbering | Auto-increments (INV-2026-001), resets each year |
| Persistent Data | Invoice counter saved in `invoice_counter.json` |

---

## File Structure

```
invoice-maker/
  app.py                        # Flask backend, all routes
  requirements.txt              # Python dependencies
  invoice_counter.json          # Auto-created, stores last invoice number
  README.md                     # This file
  templates/
    index.html                  # Main portal UI
    preview.html                # Invoice renderer (all 4 templates)
  static/
    css/
      style.css                 # Portal UI styles
      invoice-classic.css
      invoice-modern.css
      invoice-minimal.css
      invoice-corporate.css
    js/
      app.js                    # Form logic, live preview, calculations
```

---

## Stopping the App

Press `Ctrl + C` in the terminal where `python app.py` is running.
