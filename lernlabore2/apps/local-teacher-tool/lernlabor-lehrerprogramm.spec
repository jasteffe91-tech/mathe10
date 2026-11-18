# PyInstaller-Bauplan für das Lehrerprogramm (eine einzelne EXE, ohne Konsolenfenster).
# Aufruf: pyinstaller --noconfirm lernlabor-lehrerprogramm.spec
from PyInstaller.utils.hooks import collect_data_files, collect_submodules

datas = collect_data_files("reportlab") + [("lernlabor_lehrer/demo_datensatz.json", "lernlabor_lehrer")]
hidden = (collect_submodules("keyring.backends") + collect_submodules("reportlab.graphics.barcode")
          + ["_argon2_cffi_bindings", "argon2.low_level"])

a = Analysis(["start_lehrerprogramm.py"], pathex=["."], datas=datas, hiddenimports=hidden,
             excludes=["pytest", "numpy", "matplotlib"], noarchive=False)
pyz = PYZ(a.pure)
exe = EXE(pyz, a.scripts, a.binaries, a.datas, [], name="Lernlabor-Lehrerprogramm",
          console=False, upx=False, strip=False, runtime_tmpdir=None)
