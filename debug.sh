#!/usr/bin/env bash
set -e

UUID="lnotch@mrvvsreddy.dev"
EXT_DIR="$HOME/.local/share/gnome-shell/extensions/$UUID"
SRC_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

usage() {
    echo "NotchOwl GNOME Extension Debug & Dev Tool"
    echo "Usage: $0 [live|unit|install|reload|status|errors|logs|test]"
    echo ""
    echo "Commands:"
    echo "  live     - Run real-time nested GNOME Shell with live hot-reloading (zero restarts!)"
    echo "  unit     - Run the automated test suite with GJS (17 assertions)"
    echo "  install  - Sync files directly to extension directory"
    echo "  reload   - Disable and enable extension in the running GNOME Shell"
    echo "  status   - Show current extension state (ACTIVE, ERROR, etc.)"
    echo "  errors   - Query GNOME Shell DBus for registered extension errors"
    echo "  logs     - Show recent journal logs for NotchOwl and GNOME Shell"
    echo "  test     - Run unit tests -> install -> reload -> status -> errors"
    exit 1
}

cmd_unit() {
    echo "==> Running automated test suite with GJS..."
    GI_TYPELIB_PATH=/usr/lib64/gnome-shell:/usr/lib64/mutter-18 \
    LD_LIBRARY_PATH=/usr/lib64/gnome-shell:/usr/lib64/mutter-18 \
    gjs -m "$SRC_DIR/tests/run_tests.js"
}

cmd_install() {
    echo "==> Syncing files to $EXT_DIR..."
    mkdir -p "$EXT_DIR"
    rsync -av --delete \
        --exclude '.git' \
        --exclude 'node_modules' \
        --exclude '*.zip' \
        --exclude 'debug.sh' \
        "$SRC_DIR/" "$EXT_DIR/"
    echo "==> Files synced."
}

cmd_reload() {
    echo "==> Reloading extension $UUID..."
    gnome-extensions disable "$UUID" 2>/dev/null || true
    sleep 0.4
    gnome-extensions enable "$UUID"
    echo "==> Reload command issued."
}

cmd_status() {
    echo "==> Extension Status:"
    gnome-extensions info "$UUID"
}

cmd_errors() {
    echo "==> Querying DBus for extension errors:"
    ERRORS=$(busctl --user call org.gnome.Shell /org/gnome/Shell org.gnome.Shell.Extensions GetExtensionErrors s "$UUID" 2>/dev/null || true)
    if [[ "$ERRORS" == *"as 0"* ]] || [[ -z "$ERRORS" ]]; then
        echo "✅ No errors recorded in GNOME Shell for $UUID"
    else
        echo "⚠️ Errors detected:"
        echo "$ERRORS"
    fi
}

cmd_logs() {
    echo "==> Last 40 lines of journal logs matching NotchOwl:"
    journalctl --user -b -n 40 --no-pager -g "(NotchOwl|notchowl)" || true
}

cmd_test() {
    cmd_unit
    echo ""
    cmd_install
    cmd_reload
    sleep 0.5
    cmd_status
    echo ""
    cmd_errors
}

case "$1" in
    live)    "$SRC_DIR/live.sh" ;;
    unit)    cmd_unit ;;
    install) cmd_install ;;
    reload)  cmd_reload ;;
    status)  cmd_status ;;
    errors)  cmd_errors ;;
    logs)    cmd_logs ;;
    test)    cmd_test ;;
    *)       usage ;;
esac
