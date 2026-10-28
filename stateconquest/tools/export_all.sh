#!/usr/bin/env bash
# Exportiert alle Plattformen nach build/ und packt die Ergebnisse nach dist/.
# Aufruf:  GODOT=/pfad/zu/godot tools/export_all.sh
set -euo pipefail
cd "$(dirname "$0")/.."
GODOT="${GODOT:-godot}"
mkdir -p build/web build/windows build/linux build/android dist
touch build/.gdignore dist/.gdignore
"$GODOT" --headless --path . --import >/dev/null 2>&1 || true
"$GODOT" --headless --path . --export-release "Web" build/web/index.html
"$GODOT" --headless --path . --export-release "Windows Desktop" build/windows/StateConquest.exe
"$GODOT" --headless --path . --export-release "Linux" build/linux/StateConquest.x86_64
"$GODOT" --headless --path . --export-debug "Android" build/android/StateConquest.apk || echo "Android-Export übersprungen (SDK/JDK in den Editoreinstellungen eintragen)"
rm -rf dist/web && mkdir -p dist/web && cp build/web/index.* dist/web/ && rm -f dist/web/*.import
(cd build/windows && rm -f ../../dist/StateConquest-Windows.zip && zip -q -9 ../../dist/StateConquest-Windows.zip StateConquest.exe)
[ -f build/android/StateConquest.apk ] && cp build/android/StateConquest.apk dist/
echo "Fertig: $(ls dist)"
