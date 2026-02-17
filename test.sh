#!/usr/bin/env bash
set -euo pipefail

# ====== CONFIG ======
# Input directory containing large JPG/JPEG files (gallery originals)
IN_DIR="${1:-assets/gallery/originals}"

# Output directory for optimized images (keeps originals untouched)
OUT_DIR="${2:-assets/gallery/optimized}"

# JPEG quality target (75–85 typical for photos)
QUALITY="${QUALITY:-82}"

# Long-edge sizes to generate per image (responsive variants)
# Example: 480/768 for mobile, 1024/1440 for desktop, 1920 if you truly need it.
SIZES=(480 768 1024 1440)

# ====== TOOLS ======
# Prefer mozjpeg's cjpeg if present; otherwise use ImageMagick.
HAVE_CJPEG=0
command -v cjpeg >/dev/null 2>&1 && HAVE_CJPEG=1
command -v magick >/dev/null 2>&1 || { echo "Missing: ImageMagick (magick). Install: sudo dnf install -y imagemagick"; exit 1; }

mkdir -p "$OUT_DIR"

shopt -s nullglob
mapfile -t FILES < <(find "$IN_DIR" -maxdepth 1 -type f \( -iname '*.jpg' -o -iname '*.jpeg' \) -print | sort)

if [ "${#FILES[@]}" -eq 0 ]; then
  echo "No JPG/JPEG files found in: $IN_DIR"
  exit 1
fi

echo "Input:  $IN_DIR"
echo "Output: $OUT_DIR"
echo "Quality: $QUALITY"
echo "Sizes:  ${SIZES[*]}"
echo

for SRC in "${FILES[@]}"; do
  BASE="$(basename "$SRC")"
  NAME="${BASE%.*}"

  echo "==> $BASE"

  # Normalize orientation once to a temp (handles phone EXIF rotations)
  TMP="$(mktemp --suffix=".jpg")"
  magick "$SRC" -auto-orient -strip "$TMP"

  for W in "${SIZES[@]}"; do
    OUT="$OUT_DIR/${NAME}-${W}.jpg"

    # Resize by long edge: width=W, height auto, no upscaling
    # We use scale Wx> so smaller images are not enlarged.
    if [ "$HAVE_CJPEG" -eq 1 ]; then
      # Create resized temp PNG, then encode with mozjpeg for smaller JPGs
      TP="$(mktemp --suffix=".png")"
      magick "$TMP" -resize "${W}x>" "$TP"
      cjpeg -quality "$QUALITY" -progressive -optimize -outfile "$OUT" "$TP"
      rm -f "$TP"
    else
      # ImageMagick-only pipeline (still fine)
      magick "$TMP" -resize "${W}x>" -quality "$QUALITY" -interlace Plane "$OUT"
    fi
  done

  rm -f "$TMP"
done

echo
echo "Done. Generated variants in: $OUT_DIR"
echo "Example output names: image-480.jpg image-768.jpg image-1024.jpg image-1440.jpg"
