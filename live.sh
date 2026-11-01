#!/usr/bin/env bash
set -e

UUID="lnotch@mrvvsreddy.dev"
EXT_DIR="$HOME/.local/share/gnome-shell/extensions/$UUID"
SRC_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "=========================================================="
echo " LNotch Live Development & Auto-Reload Watcher"
echo "=========================================================="
echo ""

# 1. Sync files to extension directory
echo "--> Syncing files to $EXT_DIR..."
mkdir -p "$EXT_DIR"
rsync -av --delete \
    --exclude '.git' \
    --exclude 'node_modules' \
    --exclude '*.zip' \
    --exclude 'debug.sh' \
    --exclude 'live.sh' \
    "$SRC_DIR/" "$EXT_DIR/"

# 2. Reload extension on your actual host desktop
echo "--> Reloading $UUID on your GNOME top bar..."
gnome-extensions disable "$UUID" 2>/dev/null || true
sleep 0.4
gnome-extensions enable "$UUID"
echo "✓ Extension is active on your top panel right now!"
echo "  Shortcut: Press Alt+\ or Alt+N to toggle the Notch"
echo ""
echo "Commands while running:"
echo "  - Save any file in $SRC_DIR to instantly hot-reload"
echo "  - Press 'r' + Enter to manually reload"
echo "  - Press 'q' + Enter or Ctrl+C to exit"
echo "=========================================================="

# File watcher loop
LAST_CHECKSUM=""
get_checksum() {
    find "$SRC_DIR" -maxdepth 3 \( -name "*.js" -o -name "*.css" -o -name "*.json" \) -not -path "*/.*" -exec stat -c "%Y %n" {} + | sort | sha1sum
}
LAST_CHECKSUM=$(get_checksum)

# Background journal logger
journalctl --user -b -f -n 0 --no-pager -g "\[lnotch\]" &
LOG_PID=$!

cleanup() {
    echo ""
    echo "Exiting live watcher..."
    if [ -n "$LOG_PID" ]; then
        kill "$LOG_PID" 2>/dev/null || true
    fi
    exit 0
}
trap cleanup SIGINT SIGTERM EXIT

while true; do
    if read -t 1 -n 1 user_input 2>/dev/null; then
        if [ "$user_input" = "q" ] || [ "$user_input" = "Q" ]; then
            break
        elif [ "$user_input" = "r" ] || [ "$user_input" = "R" ]; then
            echo ""
            echo "--> Manual reload requested..."
            rsync -av --delete --exclude '.git' --exclude '*.zip' --exclude 'debug.sh' --exclude 'live.sh' "$SRC_DIR/" "$EXT_DIR/" >/dev/null
            gnome-extensions disable "$UUID" 2>/dev/null || true
            sleep 0.3
            gnome-extensions enable "$UUID"
            LAST_CHECKSUM=$(get_checksum)
            continue
        fi
    fi

    CURRENT_CHECKSUM=$(get_checksum)
    if [ "$CURRENT_CHECKSUM" != "$LAST_CHECKSUM" ]; then
        echo ""
        echo "--> Code change detected! Hot-reloading extension..."
        rsync -av --delete --exclude '.git' --exclude '*.zip' --exclude 'debug.sh' --exclude 'live.sh' "$SRC_DIR/" "$EXT_DIR/" >/dev/null
        gnome-extensions disable "$UUID" 2>/dev/null || true
        sleep 0.3
        gnome-extensions enable "$UUID"
        LAST_CHECKSUM="$CURRENT_CHECKSUM"
    fi
done
