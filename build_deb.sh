#!/bin/bash
# Script to build Patrold Debian package

# Ensure we have dpkg-deb
if ! command -v dpkg-deb &> /dev/null; then
  echo "Error: dpkg-deb is required but not installed."
  echo "Please install it with: apt-get install dpkg"
  exit 1
fi

# Directory for building the package
BUILD_DIR="patrold-build"
PACKAGE_NAME="patrold"
VERSION="1.0.0"
ARCH="all"

# Remove old build directory if it exists
echo "Cleaning up old build files..."
rm -rf "$BUILD_DIR"
mkdir -p "$BUILD_DIR"

# Copy all files from smmonitor-agent to build directory
echo "Copying files to build directory..."
cp -r smmonitor-agent/* "$BUILD_DIR/"

# Set permissions
echo "Setting permissions..."
find "$BUILD_DIR/DEBIAN" -type f -exec chmod 755 {} \;
chmod 644 "$BUILD_DIR/etc/patrold/config.json"
chmod 644 "$BUILD_DIR/lib/systemd/system/patrold.service"
chmod 755 "$BUILD_DIR/usr/local/bin/patrold"

# Build the package
echo "Building Debian package..."
dpkg-deb --build "$BUILD_DIR" "${PACKAGE_NAME}_${VERSION}_${ARCH}.deb"

# Clean up
echo "Cleaning up..."
rm -rf "$BUILD_DIR"

echo "Done! Package created: ${PACKAGE_NAME}_${VERSION}_${ARCH}.deb"