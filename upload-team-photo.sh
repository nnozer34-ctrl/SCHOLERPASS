#!/bin/bash
# Team Photo Upload Helper
# This script helps you upload your team photo to the About section

if [ $# -eq 0 ]; then
    echo "🖼️  ScholarPass Team Photo Uploader"
    echo "====================================="
    echo ""
    echo "Usage: ./upload-team-photo.sh <path-to-image>"
    echo ""
    echo "Supported formats: JPG, PNG, JPEG, WebP"
    echo ""
    echo "Example:"
    echo "  ./upload-team-photo.sh ~/Downloads/team-photo.jpg"
    echo "  ./upload-team-photo.sh ./my-photo.png"
    exit 0
fi

IMAGE_PATH="$1"
PUBLIC_DIR="$(dirname "$0")/frontend/public"

# Check if file exists
if [ ! -f "$IMAGE_PATH" ]; then
    echo "❌ Error: File not found: $IMAGE_PATH"
    exit 1
fi

# Check file extension
EXTENSION="${IMAGE_PATH##*.}"
EXTENSION=$(echo "$EXTENSION" | tr '[:upper:]' '[:lower:]')

case "$EXTENSION" in
    jpg|jpeg|png|webp)
        ;;
    *)
        echo "❌ Error: Unsupported file format. Use JPG, PNG, JPEG, or WebP"
        exit 1
        ;;
esac

# Copy the file
cp "$IMAGE_PATH" "$PUBLIC_DIR/team.jpg"

if [ $? -eq 0 ]; then
    echo "✅ Team photo uploaded successfully!"
    echo "📁 Saved to: $PUBLIC_DIR/team.jpg"
    echo ""
    echo "Next steps:"
    echo "1. Run: cd frontend && npm run dev"
    echo "2. Visit: http://localhost:3000"
    echo "3. Navigate to 'Sertifikalar' section to see your photo"
else
    echo "❌ Error: Failed to copy file"
    exit 1
fi
