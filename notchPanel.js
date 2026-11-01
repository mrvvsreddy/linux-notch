import GObject from 'gi://GObject';
import Clutter from 'gi://Clutter';
import St from 'gi://St';
import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';

import { registerGClass } from './gobject.js';
import { createIconWidget } from './icons.js';
import { WorkspaceView } from './views/workspaceView.js';
import { InsightsView } from './views/insightsView.js';
import { CustomizeView } from './views/customizeView.js';

export class NotchPanel extends St.Widget {
    static {
        registerGClass(this);
    }

    constructor(extensionPath, store, timerManager) {
        super({
            style_class: 'notch-panel-wrapper',
            reactive: true,
            can_focus: true,
            visible: false,
            layout_manager: new Clutter.BinLayout(),
            x_expand: true,
            y_expand: true,
        });

        const constraint = new Clutter.BindConstraint({
            source: global.stage,
            coordinate: Clutter.BindCoordinate.ALL,
        });
        this.add_constraint(constraint);

        this._extensionPath = extensionPath;
        this._store = store;
        this._timer = timerManager;
        this._activeTab = 'workspace';
        this._stageEventId = 0;
        this._toastTimeoutId = 0;

        // 1. Full-screen click-to-dismiss Backdrop
        this._backdrop = new St.Widget({
            style_class: 'notch-panel-backdrop',
            reactive: true,
            x_expand: true,
            y_expand: true,
        });
        this._backdrop.connect('button-press-event', () => {
            this.close();
            return Clutter.EVENT_STOP;
        });
        this._backdrop.connect('touch-event', () => {
            this.close();
            return Clutter.EVENT_STOP;
        });
        this.add_child(this._backdrop);

        // 2. The Main Notch Card (centered at top of screen)
        this._card = new St.BoxLayout({
            vertical: true,
            style_class: 'notch-main-panel',
            reactive: true,
            can_focus: true,
            x_align: Clutter.ActorAlign.CENTER,
            y_align: Clutter.ActorAlign.START,
            margin_top: 36,
        });
        this.add_child(this._card);

        this._buildHeader();
        this._buildBody();
        this._buildToast();

        // 3. Safety: Automatically close if session locks or overview opens
        Main.sessionMode.connectObject('updated', () => {
            if (Main.sessionMode.isLocked) {
                this.close();
            }
        }, this);

        Main.overview.connectObject('showing', () => {
            this.close();
        }, this);
    }

    _buildHeader() {
        const head = new St.BoxLayout({ vertical: false, style_class: 'notch-head' });

        // Logo
        const logoFile = Gio.File.new_for_path(GLib.build_filenamev([this._extensionPath, 'icons', 'notchowl-logo.svg']));
        const logoIcon = new St.Icon({
            gicon: new Gio.FileIcon({ file: logoFile }),
            icon_size: 34,
            style_class: 'notch-logo'
        });
        head.add_child(logoIcon);

        // Title
        const titleLbl = new St.Label({ text: 'lnotch', style_class: 'notch-app-name' });
        head.add_child(titleLbl);

        // Debug bug button
        const bugBtn = new St.Button({ style_class: 'notch-icon-btn', reactive: true, can_focus: true });
        const bugIcon = createIconWidget('bug', 16, 'rgba(255,255,255,0.8)');
        bugIcon.reactive = false;
        bugBtn.set_child(bugIcon);
        bugBtn.connect('clicked', () => {
            this._timer.fastForward();
            this.showToast('Timer fast-forwarded (5s left)');
        });
        bugBtn.connect('button-press-event', () => {
            this._timer.fastForward();
            this.showToast('Timer fast-forwarded (5s left)');
            return Clutter.EVENT_STOP;
        });
        head.add_child(bugBtn);

        // Spacer
        const spacer = new St.Widget({ x_expand: true });
        head.add_child(spacer);

        // Segmented tabs: [ Workspace | Insights | Customize ]
        const seg = new St.BoxLayout({ vertical: false, style_class: 'notch-seg' });
        const tabs = [
            { id: 'workspace', label: 'Workspace' },
            { id: 'insights', label: 'Insights' },
            { id: 'customize', label: 'Customize' }
        ];

        this._tabButtons = {};
        for (const t of tabs) {
            const btn = new St.Button({
                label: t.label,
                style_class: (t.id === this._activeTab) ? 'notch-seg-btn on' : 'notch-seg-btn',
                reactive: true,
                can_focus: true,
                track_hover: true
            });
            btn.connect('clicked', () => {
                console.log(`[lnotch] Tab clicked: ${t.id}`);
                this.switchTab(t.id);
            });
            btn.connect('button-press-event', () => {
                console.log(`[lnotch] Tab button-press: ${t.id}`);
                this.switchTab(t.id);
                return Clutter.EVENT_STOP;
            });
            seg.add_child(btn);
            this._tabButtons[t.id] = btn;
        }
        head.add_child(seg);

        // Prominent Close button
        const closeBtn = new St.Button({
            style_class: 'notch-icon-btn notch-close-btn',
            reactive: true,
            can_focus: true,
            track_hover: true
        });
        const closeIcon = createIconWidget('close', 18, '#ffffff');
        closeIcon.reactive = false;
        closeBtn.set_child(closeIcon);
        closeBtn.connect('clicked', () => {
            console.log('[lnotch] Close button clicked!');
            this.close();
        });
        closeBtn.connect('button-press-event', () => {
            console.log('[lnotch] Close button pressed!');
            this.close();
            return Clutter.EVENT_STOP;
        });
        head.add_child(closeBtn);

        this._card.add_child(head);
    }

    _buildBody() {
        this._body = new St.BoxLayout({
            vertical: true,
            style_class: 'notch-body',
            x_expand: true,
            y_expand: true
        });
        this._card.add_child(this._body);
        this._renderActiveTab();
    }

    _buildToast() {
        this._toast = new St.Label({
            text: '',
            style_class: 'notch-toast',
            x_align: Clutter.ActorAlign.CENTER,
            y_align: Clutter.ActorAlign.END,
            margin_bottom: 28,
            visible: false
        });
        this.add_child(this._toast);
    }

    showToast(message) {
        if (this._toastTimeoutId) {
            GLib.Source.remove(this._toastTimeoutId);
            this._toastTimeoutId = 0;
        }
        this._toast.set_text(message);
        this._toast.visible = true;
        this._toast.opacity = 255;

        this._toastTimeoutId = GLib.timeout_add(GLib.PRIORITY_DEFAULT, 2400, () => {
            this._toast.ease({
                opacity: 0,
                duration: 300,
                mode: Clutter.AnimationMode.EASE_OUT_QUAD,
                onComplete: () => {
                    this._toast.visible = false;
                }
            });
            this._toastTimeoutId = 0;
            return GLib.SOURCE_REMOVE;
        });
    }

    switchTab(tabId) {
        if (this._activeTab === tabId) return;
        this._activeTab = tabId;

        for (const [id, btn] of Object.entries(this._tabButtons)) {
            if (id === tabId) btn.add_style_class_name('on');
            else btn.remove_style_class_name('on');
        }

        this._renderActiveTab();
    }

    _renderActiveTab() {
        this._body.destroy_all_children();

        if (this._activeTab === 'workspace') {
            this._currentView = new WorkspaceView(this._store, this._timer, msg => this.showToast(msg));
        } else if (this._activeTab === 'insights') {
            this._currentView = new InsightsView(this._store);
        } else if (this._activeTab === 'customize') {
            this._currentView = new CustomizeView(this._store, msg => this.showToast(msg));
        }

        if (this._currentView) {
            this._body.add_child(this._currentView);
        }
    }

    open() {
        console.log('[lnotch] Opening Notch panel dialog...');
        const monitor = Main.layoutManager.primaryMonitor;
        if (!monitor) return;

        const panelWidth = Math.min(1160, monitor.width - 32);
        const panelHeight = Math.min(560, monitor.height - 64);
        this._card.set_size(panelWidth, panelHeight);

        this.visible = true;
        this._card.opacity = 0;
        this._card.translation_y = -35;

        // Global Escape key capture listener (only intercepts Escape, passes all system keys!)
        if (this._stageEventId) {
            global.stage.disconnect(this._stageEventId);
            this._stageEventId = 0;
        }
        this._stageEventId = global.stage.connect('captured-event', (stage, event) => {
            if (event.type() === Clutter.EventType.KEY_PRESS) {
                if (event.get_key_symbol() === Clutter.KEY_Escape) {
                    this.close();
                    return Clutter.EVENT_STOP;
                }
            }
            return Clutter.EVENT_PROPAGATE;
        });

        // Spring animation open
        this._card.ease({
            opacity: 255,
            translation_y: 0,
            duration: 380,
            mode: Clutter.AnimationMode.EASE_OUT_CUBIC
        });

        this._renderActiveTab();
    }

    close() {
        console.log('[lnotch] Closing Notch panel dialog...');
        if (!this.visible) return;

        // Disconnect global stage key listener
        if (this._stageEventId) {
            global.stage.disconnect(this._stageEventId);
            this._stageEventId = 0;
        }

        // Immediately hide
        this.visible = false;
        this._card.opacity = 0;
        this._card.translation_y = -35;
    }

    toggle() {
        if (this.visible) this.close();
        else this.open();
    }

    destroy() {
        Main.sessionMode.disconnectObject(this);
        Main.overview.disconnectObject(this);

        if (this._stageEventId) {
            global.stage.disconnect(this._stageEventId);
            this._stageEventId = 0;
        }
        if (this._toastTimeoutId) {
            GLib.Source.remove(this._toastTimeoutId);
        }
        super.destroy();
    }
}
