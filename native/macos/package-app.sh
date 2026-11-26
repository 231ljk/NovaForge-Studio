#!/usr/bin/env bash
set -euo pipefail

PRODUCT="${1:?用法: package-app.sh <product> <app-name> <bundle-id> [version] [arch]}"
APP_NAME="${2:?缺少 App 名称}"
BUNDLE_ID="${3:?缺少 Bundle ID}"
VERSION="${4:-0.1.0}"
ARCH_MODE="${5:-native}"
ROOT="$(cd "$(dirname "$0")" && pwd)"

BUILD_ARGS=()
case "$ARCH_MODE" in
  native) ;;
  arm64) BUILD_ARGS=(--arch arm64) ;;
  x86_64) BUILD_ARGS=(--arch x86_64) ;;
  universal) BUILD_ARGS=(--arch arm64 --arch x86_64) ;;
  *) echo "未知架构: $ARCH_MODE" >&2; exit 1 ;;
esac

cd "$ROOT"
if [ ${#BUILD_ARGS[@]} -eq 0 ]; then
  swift build -c release --product "$PRODUCT"
  BIN_DIR="$(swift build -c release --product "$PRODUCT" --show-bin-path)"
else
  swift build -c release --product "$PRODUCT" "${BUILD_ARGS[@]}"
  BIN_DIR="$(swift build -c release --product "$PRODUCT" "${BUILD_ARGS[@]}" --show-bin-path)"
fi
BINARY="$BIN_DIR/$PRODUCT"
test -f "$BINARY"

ARCHS="$(lipo -archs "$BINARY")"
echo "二进制架构: $ARCHS"

APP_DIR="$ROOT/build/$ARCH_MODE/$APP_NAME.app"
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
ZIP_NAME="${APP_NAME// /-}-native-$VERSION-macos-$ARCH_MODE.zip"
rm -f "$ZIP_NAME"
(cd "$ARCH_MODE" && zip -qry "../$ZIP_NAME" "$APP_NAME.app")
ls -lh "$ZIP_NAME"
