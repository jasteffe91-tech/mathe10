#!/usr/bin/env bash
# Richtet die Medienbibliothek projektübergreifend ein (idempotent, überschreibt nichts Fremdes):
#   1. ~/Unterrichtsmedien/Mathe-Physik  -> Symlink auf diesen Ordner (falls noch nicht vorhanden)
#   2. ~/.local/bin/media                -> Kommandozeile
#   3. ~/.claude/skills/medienbibliothek -> Claude-Code-Skill (global für alle Projekte)
#   4. ~/.claude/CLAUDE.md               -> kurzer Hinweisblock (zwischen Markierungen, ersetzbar)
#   5. Suchindex aufbauen und Selbsttest
# Optional: --ohne-claude-md  (Schritt 4 auslassen)
set -euo pipefail
SRC="$(cd "$(dirname "$(readlink -f "${BASH_SOURCE[0]}")")" && pwd)"
ZIEL="${MEDIA_LIB_HOME:-$HOME/Unterrichtsmedien/Mathe-Physik}"
OHNE_MD=0
[[ "${1:-}" == "--ohne-claude-md" ]] && OHNE_MD=1

echo "Medienbibliothek: $SRC"

# 1. Zentraler Speicherort
mkdir -p "$(dirname "$ZIEL")"
if [[ -L "$ZIEL" ]]; then
  echo "✓ $ZIEL ist bereits ein Link auf $(readlink -f "$ZIEL")"
elif [[ -e "$ZIEL" ]]; then
  if [[ "$(readlink -f "$ZIEL")" == "$SRC" ]]; then
    echo "✓ $ZIEL ist die Bibliothek selbst"
  else
    echo "! $ZIEL existiert bereits und ist kein Link – wird NICHT verändert."
    echo "  (Bestehende Bibliothek prüfen; ggf. MEDIA_LIB_HOME=… ./install.sh verwenden)"
  fi
else
  ln -s "$SRC" "$ZIEL"
  echo "✓ Link angelegt: $ZIEL -> $SRC"
fi

# 2. Kommandozeile
mkdir -p "$HOME/.local/bin"
ln -sf "$SRC/bin/media" "$HOME/.local/bin/media"
chmod +x "$SRC/bin/media"
echo "✓ Befehl: $HOME/.local/bin/media"
case ":$PATH:" in *":$HOME/.local/bin:"*) ;; *) echo "  Hinweis: ~/.local/bin in den PATH aufnehmen (z. B. in ~/.bashrc / ~/.zshrc).";; esac

# 3. Globale Skill
SK="$HOME/.claude/skills/medienbibliothek"
mkdir -p "$SK"
cp "$SRC/skill/SKILL.md" "$SK/SKILL.md"
echo "✓ Skill installiert: $SK/SKILL.md"

# 4. Hinweis in der globalen CLAUDE.md (zwischen Markierungen, idempotent)
if [[ $OHNE_MD -eq 0 ]]; then
  MD="$HOME/.claude/CLAUDE.md"
  touch "$MD"
  BLOCK="<!-- medienbibliothek:start -->
## Unterrichtsmedien Mathematik/Physik
Beim Erstellen von Mathematik- oder Physikmaterial zuerst die lizenzgeprüfte Medienbibliothek nutzen
(Skill \`medienbibliothek\`, Befehl \`media search … --json\`, Bibliothek: $ZIEL).
Vorhandene passende Medien wiederverwenden, Bildnachweise mit \`media verzeichnis\` erzeugen,
neue gute Eigenproduktionen mit \`media add --eigen\` aufnehmen. Standardprofil \`offen\`.
<!-- medienbibliothek:ende -->"
  python3 - "$MD" "$BLOCK" <<'PY'
import re, sys
p, block = sys.argv[1], sys.argv[2]
s = open(p, encoding="utf-8").read()
if "<!-- medienbibliothek:start -->" in s:
    s = re.sub(r"<!-- medienbibliothek:start -->.*?<!-- medienbibliothek:ende -->", block, s, flags=re.S)
else:
    s = (s.rstrip() + "\n\n" if s.strip() else "") + block + "\n"
open(p, "w", encoding="utf-8").write(s)
PY
  echo "✓ Hinweis in $MD aktualisiert"
fi

# 5. Index + Selbsttest
"$SRC/bin/media" rebuild
"$SRC/bin/media" search "Parabel" --limit 1 >/dev/null && echo "✓ Selbsttest: Suche funktioniert"
echo "Fertig. Weboberfläche: $SRC/index.html (Doppelklick) oder: media serve"
