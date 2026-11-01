import Clutter from 'gi://Clutter';
import St from 'gi://St';
import * as PanelMenu from 'resource:///org/gnome/shell/ui/panelMenu.js';
import { registerGClass } from './gobject.js';
import { DotMatrixWidget } from './dotMatrix.js';

export class NotchIndicator extends PanelMenu.Button {
    static {
        registerGClass(this);
    }

    constructor(extensionPath, store, timerManager, onToggle) {
        super(0.5, 'lnotch', true);

        this._extensionPath = extensionPath;
        this._store = store;
        this._timer = timerManager;
        this._onToggle = onToggle;

        this.add_style_class_name('notch-panel-button');

        // Pure clean pill container with guaranteed layout size
        this._pillBox = new St.BoxLayout({
            vertical: false,
            style_class: 'notch-shell-pill',
            y_align: Clutter.ActorAlign.CENTER,
            x_align: Clutter.ActorAlign.CENTER,
            reactive: true,
            track_hover: true
        });

        // Pill center indicator bar (visible when idle - camera notch / dynamic island bar)
        this._pillDot = new St.Widget({
            style_class: 'notch-pill-dot',
            y_align: Clutter.ActorAlign.CENTER,
            x_align: Clutter.ActorAlign.CENTER,
            visible: true
        });
        this._pillDot.set_size(18, 4);
        this._pillBox.add_child(this._pillDot);

        // Mini dot-matrix timer (visible only when timer is running/active)
        this._timerDotMatrix = new DotMatrixWidget({
            text: '25:00',
            style_class: 'notch-shell-dotmatrix',
            activeColor: [1.0, 1.0, 1.0, 0.95],
            dimColor: [1.0, 1.0, 1.0, 0.15],
            visible: false
        });
        this._timerDotMatrix.set_size(60, 16);
        this._pillBox.add_child(this._timerDotMatrix);

        this.add_child(this._pillBox);

        // Click handler to toggle the panel
        const triggerToggle = () => {
            console.log('[NotchOwl] Pill clicked! Toggling Notch panel...');
            if (this._onToggle) this._onToggle();
        };

        this.connect('button-press-event', (actor, event) => {
            if (event.get_button() === 1) {
                triggerToggle();
                return Clutter.EVENT_STOP;
            }
            return Clutter.EVENT_PROPAGATE;
        });

        this._pillBox.connect('button-press-event', (actor, event) => {
            if (event.get_button() === 1) {
                triggerToggle();
                return Clutter.EVENT_STOP;
            }
            return Clutter.EVENT_PROPAGATE;
        });

        this.connect('touch-event', () => {
            triggerToggle();
            return Clutter.EVENT_STOP;
        });

        // Watch timer & store
        this._timerSub = this._timer.subscribe(() => this._updateState());
        this._storeSub = this._store.subscribe(() => this._updateState());

        this._updateState();
    }

    _updateState() {
        const hasTimer = !this._timer.idle;
        const isRunning = this._timer.running;

        if (hasTimer) {
            this._pillBox.add_style_class_name('has-timer');
            if (isRunning) {
                this._pillBox.add_style_class_name('running');
            } else {
                this._pillBox.remove_style_class_name('running');
            }

            this._pillDot.visible = false;
            this._timerDotMatrix.setText(this._timer.label());
            this._timerDotMatrix.visible = true;
        } else {
            this._pillBox.remove_style_class_name('has-timer');
            this._pillBox.remove_style_class_name('running');
            this._timerDotMatrix.visible = false;
            this._pillDot.visible = true;
        }
    }

    destroy() {
        if (this._timerSub) this._timerSub();
        if (this._storeSub) this._storeSub();
        super.destroy();
    }
}
