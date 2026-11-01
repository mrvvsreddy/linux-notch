import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import Shell from 'gi://Shell';
import Meta from 'gi://Meta';
import Clutter from 'gi://Clutter';

import { Store } from './store.js';
import { TimerManager } from './timer.js';
import { NotchPanel } from './notchPanel.js';
import { NotchIndicator } from './indicator.js';

export class LNotchApp {
    constructor(extension) {
        this.extension = extension;
        this.path = extension.path;
        this._globalKeyId = 0;
    }

    enable() {
        this._store = new Store();
        this._timer = new TimerManager(this._store);

        // 1. Create the expanded Notch panel overlay
        this._panel = new NotchPanel(this.path, this._store, this._timer);
        Main.layoutManager.modalDialogGroup.add_child(this._panel);

        // 2. Create the pill notch button inside GNOME Shell top bar
        this._indicator = new NotchIndicator(
            this.path,
            this._store,
            this._timer,
            () => this._panel.toggle()
        );

        // Add to the right box of top panel (near indicators & stats)
        Main.panel.addToStatusArea('lnotch', this._indicator, 0, 'right');

        // Global hotkey: Alt + \ or Alt + N toggles the notch from anywhere!
        this._globalKeyId = global.stage.connect('captured-event', (stage, event) => {
            if (event.type() === Clutter.EventType.KEY_PRESS) {
                const symbol = event.get_key_symbol();
                const state = event.get_state();
                const isAlt = (state & Clutter.ModifierType.MOD1_MASK) !== 0;

                if (isAlt && (symbol === Clutter.KEY_backslash || symbol === Clutter.KEY_n || symbol === Clutter.KEY_N)) {
                    if (this._panel) this._panel.toggle();
                    return Clutter.EVENT_STOP;
                }
            }
            return Clutter.EVENT_PROPAGATE;
        });
    }

    disable() {
        if (this._globalKeyId) {
            global.stage.disconnect(this._globalKeyId);
            this._globalKeyId = 0;
        }

        if (this._indicator) {
            this._indicator.destroy();
            this._indicator = null;
        }

        if (this._panel) {
            this._panel.destroy();
            this._panel = null;
        }

        if (this._timer) {
            this._timer.destroy();
            this._timer = null;
        }

        this._store = null;
    }
}
