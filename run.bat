@echo off
echo Installing dependencies...
pip install -r requirements.txt
echo Installing Playwright Chromium browser...
python -m playwright install chromium
echo.
echo Starting Invoice Maker on http://localhost:7765
echo Press Ctrl+C to stop.
echo.
python app.py
