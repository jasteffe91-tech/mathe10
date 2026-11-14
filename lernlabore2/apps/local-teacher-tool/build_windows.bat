@echo off
REM ====================================================================
REM  Baut Lernlabor-Lehrerprogramm.exe (Windows 10/11)
REM  Voraussetzung NUR für den Bau: Python 3.12 von python.org
REM  Die fertige EXE braucht später KEIN Python.
REM ====================================================================
cd /d "%~dp0"
py -3.12 -m venv .venv-build || goto :fehler
call .venv-build\Scripts\activate.bat
python -m pip install --upgrade pip
python -m pip install -r requirements.txt pyinstaller==6.16.0 || goto :fehler
pyinstaller --noconfirm --clean lernlabor-lehrerprogramm.spec || goto :fehler
echo.
echo Fertig: dist\Lernlabor-Lehrerprogramm.exe
certutil -hashfile dist\Lernlabor-Lehrerprogramm.exe SHA256
goto :eof
:fehler
echo Der Bau ist fehlgeschlagen. Siehe Meldungen oben.
exit /b 1
