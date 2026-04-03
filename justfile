# SiYuan Build System
# Usage: just <recipe>    List all: just --list

set dotenv-load := false

# ── Configuration ───────────────────────────────────────────────────────

version     := `jq -r .version app/package.json`
kernel_dir  := "kernel"
app_dir     := "app"
backend_dir := "app/backend"
bin_dir     := "app/backend"

# Auto-detect platform
os   := os()
arch := arch()

# Map to Go and Rust target triples
go_os := if os == "macos" { "darwin" } else if os == "windows" { "windows" } else { "linux" }
go_arch := if arch == "aarch64" { "arm64" } else { "amd64" }

rust_target := if os == "macos" {
    if arch == "aarch64" { "aarch64-apple-darwin" } else { "x86_64-apple-darwin" }
} else if os == "windows" {
    "x86_64-pc-windows-msvc"
} else {
    if arch == "aarch64" { "aarch64-unknown-linux-gnu" } else { "x86_64-unknown-linux-gnu" }
}

kernel_ext := if os == "windows" { ".exe" } else { "" }

# ── Info ────────────────────────────────────────────────────────────────

# Show project info
info:
    @echo "SiYuan v{{version}}"
    @echo "Platform: {{os}}/{{arch}}"
    @echo "Go target: {{go_os}}/{{go_arch}}"
    @echo "Rust target: {{rust_target}}"
    @echo "Kernel binary: SiYuan-Kernel-{{rust_target}}{{kernel_ext}}"

# ── Setup ───────────────────────────────────────────────────────────────

# Install all dependencies (pnpm + cargo)
setup:
    cd {{app_dir}} && pnpm install --no-frozen-lockfile
    cd {{backend_dir}} && cargo fetch

# Install system dependencies (Linux only)
[linux]
setup-system:
    sudo apt-get update
    sudo apt-get install -y \
        libwebkit2gtk-4.1-dev \
        libappindicator3-dev \
        librsvg2-dev \
        patchelf

# ── Kernel (Go sidecar) ────────────────────────────────────────────────

# Build Go kernel for current platform and place as Tauri sidecar
kernel:
    #!/usr/bin/env bash
    set -euo pipefail
    echo "Building kernel for {{go_os}}/{{go_arch}}..."
    cd {{kernel_dir}}
    CGO_ENABLED=1 GOOS={{go_os}} GOARCH={{go_arch}} \
        go build -tags fts5 -v \
        -ldflags "-s -w" \
        -o "../{{bin_dir}}/SiYuan-Kernel-{{rust_target}}{{kernel_ext}}"
    echo "Kernel built: {{bin_dir}}/SiYuan-Kernel-{{rust_target}}{{kernel_ext}}"

# Build kernel for a specific target: just kernel-cross linux amd64
kernel-cross goos goarch:
    #!/usr/bin/env bash
    set -euo pipefail
    if [ "{{goos}}" = "darwin" ] && [ "{{goarch}}" = "arm64" ]; then
        target="aarch64-apple-darwin"
    elif [ "{{goos}}" = "darwin" ] && [ "{{goarch}}" = "amd64" ]; then
        target="x86_64-apple-darwin"
    elif [ "{{goos}}" = "windows" ] && [ "{{goarch}}" = "amd64" ]; then
        target="x86_64-pc-windows-msvc"
    elif [ "{{goos}}" = "linux" ] && [ "{{goarch}}" = "arm64" ]; then
        target="aarch64-unknown-linux-gnu"
    else
        target="x86_64-unknown-linux-gnu"
    fi
    ext=""
    if [ "{{goos}}" = "windows" ]; then ext=".exe"; fi
    ldflags="-s -w"
    if [ "{{goos}}" = "windows" ]; then ldflags="-s -w -H=windowsgui"; fi
    echo "Building kernel for {{goos}}/{{goarch}} (target: $target)..."
    cd {{kernel_dir}}
    CGO_ENABLED=1 GOOS={{goos}} GOARCH={{goarch}} \
        go build -tags fts5 -v \
        -ldflags "$ldflags" \
        -o "../{{bin_dir}}/SiYuan-Kernel-${target}${ext}"
    echo "Kernel built: {{bin_dir}}/SiYuan-Kernel-${target}${ext}"

# Clean kernel sidecar binaries
kernel-clean:
    rm -f {{bin_dir}}/SiYuan-Kernel-*

# ── Frontend ────────────────────────────────────────────────────────────

# Build frontend for Tauri
frontend:
    cd {{app_dir}} && pnpm build:tauri

# Build all frontend targets
frontend-all:
    cd {{app_dir}} && pnpm build

# Dev mode frontend (watching)
frontend-dev:
    cd {{app_dir}} && pnpm dev:tauri

# Lint frontend
lint:
    cd {{app_dir}} && pnpm lint

# ── Tauri (Rust backend) ───────────────────────────────────────────────

# Check Rust backend compiles
check:
    cd {{backend_dir}} && cargo check

# Build Tauri app (debug, no bundle)
build-debug: kernel frontend
    cd {{backend_dir}} && cargo build

# Run Tauri in dev mode (requires kernel running separately or built sidecar)
dev: kernel
    cd {{backend_dir}} && cargo tauri dev

# ── Packaging ───────────────────────────────────────────────────────────

# Build release bundle for current platform
dist: kernel frontend
    cd {{backend_dir}} && cargo tauri build --target {{rust_target}}

# Build only a specific bundle format: just dist-fmt dmg
dist-fmt format: kernel frontend
    cd {{backend_dir}} && cargo tauri build --target {{rust_target}} --bundles {{format}}

# macOS: build DMG for current arch (one-shot: setup → kernel → frontend → bundle)
[macos]
dist-dmg:
    #!/usr/bin/env bash
    set -euo pipefail

    target="{{rust_target}}"
    echo "==> [1/4] Installing dependencies..."
    cd {{app_dir}} && pnpm install --no-frozen-lockfile
    cd -

    echo "==> [2/4] Building Go kernel for {{go_os}}/{{go_arch}}..."
    cd {{kernel_dir}}
    CGO_ENABLED=1 GOOS={{go_os}} GOARCH={{go_arch}} \
        go build -tags fts5 -v \
        -ldflags "-s -w -X github.com/siyuan-note/siyuan/kernel/util.Mode=prod" \
        -o "../{{bin_dir}}/SiYuan-Kernel-${target}"
    cd -

    echo "==> [3/4] Building frontend..."
    cd {{app_dir}} && pnpm build:tauri
    cd -

    echo "==> [4/4] Building Tauri bundle (dmg)..."
    cd {{backend_dir}} && cargo tauri build --target "$target" --bundles dmg

    echo ""
    echo "=== Build complete ==="
    dmg=$(find {{backend_dir}}/target/"$target"/release/bundle/dmg -name "*.dmg" 2>/dev/null | head -1)
    app=$(find {{backend_dir}}/target/"$target"/release/bundle/macos -name "*.app" 2>/dev/null | head -1)
    [ -n "$dmg" ] && echo "DMG: $dmg"
    [ -n "$app" ] && echo "APP: $app"

# macOS: build DMG for both x86_64 and arm64 (universal)
[macos]
dist-dmg-universal:
    #!/usr/bin/env bash
    set -euo pipefail

    echo "==> Installing dependencies..."
    cd {{app_dir}} && pnpm install --no-frozen-lockfile
    cd -

    echo "==> Building frontend..."
    cd {{app_dir}} && pnpm build:tauri
    cd -

    for pair in "amd64:x86_64-apple-darwin" "arm64:aarch64-apple-darwin"; do
        goarch="${pair%%:*}"
        target="${pair##*:}"

        echo ""
        echo "==> Building kernel for darwin/$goarch..."
        cd {{kernel_dir}}
        CGO_ENABLED=1 GOOS=darwin GOARCH="$goarch" \
            go build -tags fts5 -v \
            -ldflags "-s -w -X github.com/siyuan-note/siyuan/kernel/util.Mode=prod" \
            -o "../{{bin_dir}}/SiYuan-Kernel-${target}"
        cd -

        echo "==> Building Tauri bundle ($target)..."
        rustup target add "$target" 2>/dev/null || true
        cd {{backend_dir}} && cargo tauri build --target "$target" --bundles dmg
        cd -
    done

    echo ""
    echo "=== Build complete ==="
    find {{backend_dir}}/target/*/release/bundle/dmg -name "*.dmg" 2>/dev/null | while read f; do echo "DMG: $f"; done
    find {{backend_dir}}/target/*/release/bundle/macos -name "*.app" 2>/dev/null | while read f; do echo "APP: $f"; done

# Linux: build AppImage + deb
[linux]
dist-linux: kernel frontend
    cd {{backend_dir}} && cargo tauri build --target {{rust_target}} --bundles deb,appimage

# Windows: build MSI
[windows]
dist-msi: kernel frontend
    cd {{backend_dir}} && cargo tauri build --target {{rust_target}} --bundles msi

# ── Cleanup ─────────────────────────────────────────────────────────────

# Clean all build artifacts
clean:
    cd {{backend_dir}} && cargo clean
    rm -rf {{app_dir}}/stage/build/app
    rm -rf {{app_dir}}/stage/build/desktop
    rm -rf {{app_dir}}/stage/build/mobile

# Clean everything including node_modules
clean-all: clean
    rm -rf {{app_dir}}/node_modules
