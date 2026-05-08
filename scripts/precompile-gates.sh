#!/usr/bin/env bash
# precompile-gates.sh — blocking gates that MUST pass before xelatex/tectonic.
#
# Run from the project working directory (the directory that contains docs/).
# Exits non-zero on any failure and prints a remediation hint per gate.
#
# Gates:
#   1. logo extracted   — docs/.logo-verified sentinel exists (created by Step 4a).
#   2. colors extracted — docs/userguide-colors.sty no longer contains bundled
#                         purple template colors.
#   3. images present   — every PNG referenced by \ugScreenshot{...} or
#                         \includegraphics{...} in docs/sections/*.tex exists.
#
# Gate 4 (dummy-data ledger drained) is enforced separately by
# scripts/validate-guide-structure.mjs. Set UG_ALLOW_LEDGER_LEAKS=1 to bypass
# during mid-iteration draft compiles.
#
# Usage:
#   bash scripts/precompile-gates.sh

set -u

DOCS_DIR="${UG_DOCS_DIR:-docs}"

# ---- Gate 1: logo extracted -------------------------------------------------
if [ ! -f "$DOCS_DIR/.logo-verified" ]; then
  echo "ERROR: $DOCS_DIR/.logo-verified not found."
  echo "Go back to Step 4a: extract the target app's logo from the live web,"
  echo "save to $DOCS_DIR/img/original-logo.png, then create $DOCS_DIR/.logo-verified."
  exit 1
fi
echo "OK: logo extracted ($(cat "$DOCS_DIR/.logo-verified"))"

# ---- Gate 2: colors customized ---------------------------------------------
if grep -q "4A148C\|Purple Theme\|ugPrimary.*Deep purple" "$DOCS_DIR/userguide-colors.sty" 2>/dev/null; then
  echo "ERROR: $DOCS_DIR/userguide-colors.sty still contains bundled template colors (purple #4A148C)."
  echo "Go back to Step 4b: extract the target app's brand colors from the live web"
  echo "and rewrite $DOCS_DIR/userguide-colors.sty before compiling."
  exit 1
fi
echo "OK: colors customized."

# ---- Gate 3: every referenced PNG exists -----------------------------------
MISSING=0
for TEX_FILE in "$DOCS_DIR"/sections/*.tex; do
  [ -f "$TEX_FILE" ] || continue
  while IFS= read -r match; do
    PNG_PATH="$DOCS_DIR/${match}"
    if [ ! -f "$PNG_PATH" ]; then
      echo "ERROR: missing image: $PNG_PATH (referenced in $TEX_FILE)"
      MISSING=$((MISSING + 1))
    fi
  done < <(grep -oP '(?<=\\ugScreenshot\{)[^}]+' "$TEX_FILE" 2>/dev/null)
  while IFS= read -r match; do
    PNG_PATH="$DOCS_DIR/${match}"
    if [ ! -f "$PNG_PATH" ]; then
      echo "ERROR: missing image: $PNG_PATH (referenced in $TEX_FILE)"
      MISSING=$((MISSING + 1))
    fi
  done < <(grep -oP '(?<=\\includegraphics(\[[^\]]*\])?\{)[^}]+' "$TEX_FILE" 2>/dev/null)
done
if [ "$MISSING" -gt 0 ]; then
  echo "ERROR: $MISSING missing PNG file(s). Fix paths or recapture before compiling."
  echo "Missing images produce garbled text in the PDF."
  exit 1
fi
echo "OK: all referenced images exist."

echo "All pre-compile gates passed. Safe to run xelatex/tectonic."
