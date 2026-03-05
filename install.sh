#!/bin/sh
# Wraps CLI installer — https://get.wraps.dev
# Usage: curl -fsSL https://get.wraps.dev | sh
set -eu

INSTALL_DIR="$HOME/.wraps"
REPO="wraps-team/wraps"

# --- Utilities ---

has() { command -v "$1" >/dev/null 2>&1; }

info() { printf '%s\n' "$1"; }
bold() { printf '\033[1m%s\033[0m\n' "$1"; }
err() { printf '\033[1;31merror\033[0m: %s\n' "$1" >&2; }

abort() {
  err "$1"
  exit 1
}

cleanup() {
  [ -n "${TMPDIR_CREATED:-}" ] && rm -rf "$TMPDIR_CREATED"
}
trap cleanup EXIT

# --- HTTP helper ---

fetch() {
  url="$1"; dest="$2"
  if has curl; then
    curl -fsSL --retry 3 -o "$dest" "$url"
  elif has wget; then
    wget -qO "$dest" "$url"
  else
    abort "curl or wget is required"
  fi
}

fetch_text() {
  url="$1"
  if has curl; then
    curl -fsSL --retry 3 "$url"
  elif has wget; then
    wget -qO- "$url"
  fi
}

# --- Detect platform ---

detect_platform() {
  OS="$(uname -s)"
  case "$OS" in
    Linux*)  PLATFORM="linux" ;;
    Darwin*) PLATFORM="darwin" ;;
    *)       abort "Unsupported operating system: $OS" ;;
  esac

  MACHINE="$(uname -m)"
  case "$MACHINE" in
    x86_64)         ARCH="x64" ;;
    aarch64|arm64)  ARCH="arm64" ;;
    *)              abort "Unsupported architecture: $MACHINE" ;;
  esac

  info "Detected platform: ${PLATFORM}-${ARCH}"
}

# --- Determine version ---

resolve_version() {
  if [ -n "${WRAPS_VERSION:-}" ]; then
    VERSION="$WRAPS_VERSION"
    info "Using specified version: $VERSION"
    return
  fi

  info "Fetching latest release..."
  RELEASES="$(fetch_text "https://api.github.com/repos/${REPO}/releases")" \
    || abort "Failed to fetch releases from GitHub"

  # Find the latest cli-vX.Y.Z tag and extract version
  VERSION="$(printf '%s' "$RELEASES" \
    | grep -o '"tag_name":\s*"cli-v[^"]*"' \
    | head -n1 \
    | sed 's/.*cli-v\([^"]*\)".*/\1/')"

  [ -n "$VERSION" ] || abort "Could not determine latest CLI version"
  info "Latest version: $VERSION"
}

# --- Download & verify ---

download_and_verify() {
  TARBALL="wraps-${VERSION}-${PLATFORM}-${ARCH}.tar.gz"
  BASE_URL="https://github.com/${REPO}/releases/download/cli-v${VERSION}"

  TMPDIR_CREATED="$(mktemp -d)"

  info "Downloading ${TARBALL}..."
  fetch "${BASE_URL}/${TARBALL}" "${TMPDIR_CREATED}/${TARBALL}"
  fetch "${BASE_URL}/CHECKSUMS.sha256" "${TMPDIR_CREATED}/CHECKSUMS.sha256"

  info "Verifying checksum..."
  EXPECTED="$(grep "$TARBALL" "${TMPDIR_CREATED}/CHECKSUMS.sha256" | awk '{print $1}')"
  [ -n "$EXPECTED" ] || abort "Tarball not found in CHECKSUMS.sha256"

  if has sha256sum; then
    ACTUAL="$(sha256sum "${TMPDIR_CREATED}/${TARBALL}" | awk '{print $1}')"
  elif has shasum; then
    ACTUAL="$(shasum -a 256 "${TMPDIR_CREATED}/${TARBALL}" | awk '{print $1}')"
  else
    abort "sha256sum or shasum is required to verify download"
  fi

  [ "$EXPECTED" = "$ACTUAL" ] || abort "Checksum mismatch (expected ${EXPECTED}, got ${ACTUAL})"
  info "Checksum verified."
}

# --- Install ---

install_wraps() {
  has tar || abort "tar is required"

  mkdir -p "$INSTALL_DIR"

  info "Installing to ${INSTALL_DIR}..."
  tar -xzf "${TMPDIR_CREATED}/${TARBALL}" --strip-components=1 -C "$INSTALL_DIR"

  chmod +x "$INSTALL_DIR/bin/wraps" 2>/dev/null || true
  chmod +x "$INSTALL_DIR/runtime/node" 2>/dev/null || true
}

# --- PATH setup ---

setup_path() {
  case ":${PATH}:" in
    *":${INSTALL_DIR}/bin:"*) return ;;
  esac

  LINE="export PATH=\"\$HOME/.wraps/bin:\$PATH\""

  # Try shell config files in order of preference
  for rc in "$HOME/.zshrc" "$HOME/.bashrc" "$HOME/.bash_profile" "$HOME/.profile"; do
    if [ -f "$rc" ]; then
      # Don't add twice
      if ! grep -qF '.wraps/bin' "$rc" 2>/dev/null; then
        printf '\n# Wraps CLI\n%s\n' "$LINE" >> "$rc"
        info "Added to PATH in ${rc}"
      fi
      return
    fi
  done

  # Fallback: create .profile
  printf '\n# Wraps CLI\n%s\n' "$LINE" >> "$HOME/.profile"
  info "Added to PATH in ~/.profile"
}

# --- Main ---

main() {
  bold "Wraps CLI Installer"
  echo ""

  detect_platform
  resolve_version
  download_and_verify
  install_wraps
  setup_path

  echo ""
  bold "Wraps CLI v${VERSION} installed successfully!"
  echo ""
  info "Run 'wraps --help' to get started."
  echo ""
  case ":${PATH}:" in
    *":${INSTALL_DIR}/bin:"*) ;;
    *)
      info "If this is a new installation, restart your shell or run:"
      info "  export PATH=\"\$HOME/.wraps/bin:\$PATH\""
      ;;
  esac
}

main
