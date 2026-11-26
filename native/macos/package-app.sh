#!/usr/bin/env bash
set -euo pipefail

PRODUCT="${1:?用法: package-app.sh <product> <app-name> <bundle-id> [version]}"
APP_NAME="${2:?缺少 App 名称}"
BUNDLE_ID="${3:?缺少 Bundle ID}"
VERSION="${4:-0.1.0}"
ROOT="$(cd "$(dirname "$0")" && pwd)"

cd "$ROOT"
swift build -c release --product "$PRODUCT"
BIN_DIR="$(swift build -c release --product "$PRODUCT" --show-bin-path)"
BINARY="$BIN_DIR/$PRODUCT"
test -f "$BINARY"

APP_DIR="$ROOT/build/$APP_NAME.app"
rm -rf "$APP_DIR"
mkdir -p "$APP_DIR/Contents/MacOS"
cp "$BINARY" "$APP_DIR/Contents/MacOS/$PRODUCT"
chmod +x "$APP_DIR/Contents/MacOS/$PRODUCT"

cat > "$APP_DIR/Contents/Info.plist" <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>CFBundleDevelopmentRegion</key><string>zh_CN</string>
  <key>CFBundleExecutable</key><string>$PRODUCT</string>
  <key>CFBundleIdentifier</key><string>$BUNDLE_ID</string>
  <key>CFBundleInfoDictionaryVersion</key><string>6.0</string>
  <key>CFBundleName</key><string>$APP_NAME</string>
  <key>CFBundlePackageType</key><string>APPL</string>
  <key>CFBundleShortVersionString</key><string>$VERSION</string>
  <key>CFBundleVersion</key><string>1</string>
  <key>LSMinimumSystemVersion</key><string>12.0</string>
  <key>NSHighResolutionCapable</key><true/>
  <key>NSPrincipalClass</key><string>NSApplication</string>
</dict>
</plist>
PLIST

# 仅做本机可运行的 ad-hoc 签名，不等同于 Apple Developer 签名或公证。
codesign --force --deep --sign - "$APP_DIR"
codesign --verify --deep --strict "$APP_DIR"

cd "$ROOT/build"
ARCH="$(uname -m)"
ZIP_NAME="${APP_NAME// /-}-native-$VERSION-macos-$ARCH.zip"
rm -f "$ZIP_NAME"
zip -qry "$ZIP_NAME" "$APP_NAME.app"
ls -lh "$ZIP_NAME"
