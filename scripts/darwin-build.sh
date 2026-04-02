#!/bin/bash

# 启用错误处理：任何命令失败立即退出，并打印错误信息
set -e
trap 'echo "Error occurred at line $LINENO. Command: $BASH_COMMAND"; exit 1' ERR

echo 'Usage: ./darwin-build.sh [--target=<target>]'
echo 'Options:'
echo '  --target=<target>  Build target: amd64, arm64, or all (default: all)'
echo

INITIAL_DIR="$(pwd)"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

TARGET='all'
validate_target() {
    if [[ -z "$1" ]]; then
        echo 'Error: --target option requires a value'
        echo 'Usage: --target=<target>'
        echo 'Examples: --target=amd64'
        exit 1
    elif [[ "$1" != 'amd64' && "$1" != 'arm64' && "$1" != 'all' ]]; then
        echo "Error: Invalid target '$1'"
        echo 'Valid targets are: amd64, arm64, all'
        exit 1
    fi
}

while [[ $# -gt 0 ]]; do
    case $1 in
        --target=*)
            TARGET="${1#*=}"
            validate_target "$TARGET"
            shift
            ;;
        --target)
            TARGET="$2"
            validate_target "$TARGET"
            [ -n "$2" ] && shift 2 || shift
            ;;
        *)
            # Skip unknown options
            shift
            ;;
    esac
done

echo 'Cleaning Builds'
rm -rf "$PROJECT_ROOT/app/build" 2>/dev/null || true
rm -f "$PROJECT_ROOT/app/backend/SiYuan-Kernel-x86_64-apple-darwin" 2>/dev/null || true
rm -f "$PROJECT_ROOT/app/backend/SiYuan-Kernel-aarch64-apple-darwin" 2>/dev/null || true

echo
echo 'Building UI'
cd "$PROJECT_ROOT/app"
pnpm install
pnpm run build:tauri

echo
echo 'Building Kernel'
cd "$PROJECT_ROOT/kernel"
go version
export GO111MODULE=on
export GOPROXY=https://mirrors.aliyun.com/goproxy/
export CGO_ENABLED=1
export GOOS=darwin

if [[ "$TARGET" == 'amd64' || "$TARGET" == 'all' ]]; then
    echo
    echo 'Building Kernel amd64'
    export GOARCH=amd64
    go build -tags fts5 -v -o "../app/backend/SiYuan-Kernel-x86_64-apple-darwin" -ldflags "-s -w" .
fi
if [[ "$TARGET" == 'arm64' || "$TARGET" == 'all' ]]; then
    echo
    echo 'Building Kernel arm64'
    export GOARCH=arm64
    go build -tags fts5 -v -o "../app/backend/SiYuan-Kernel-aarch64-apple-darwin" -ldflags "-s -w" .
fi

echo
echo 'Building Tauri App'
cd "$PROJECT_ROOT/app/backend"
if [[ "$TARGET" == 'amd64' || "$TARGET" == 'all' ]]; then
    echo
    echo 'Building Tauri App amd64'
    cargo tauri build --target x86_64-apple-darwin --bundles dmg
fi
if [[ "$TARGET" == 'arm64' || "$TARGET" == 'all' ]]; then
    echo
    echo 'Building Tauri App arm64'
    cargo tauri build --target aarch64-apple-darwin --bundles dmg
fi

echo
echo '=============================='
echo '      Build successful!'
echo '=============================='

# 返回初始目录
cd "$INITIAL_DIR"
