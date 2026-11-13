@echo off
REM Startet das Lehrerprogramm direkt mit Python (Alternative zur EXE)
cd /d "%~dp0"
if not exist .venv\Scripts\python.exe (
  py -3.12 -m venv .venv
  .venv\Scripts\python -m pip install -r requirements.txt
)
.venv\Scripts\pythonw.exe start_lehrerprogramm.py
