import GObject from 'gi://GObject';
import Clutter from 'gi://Clutter';
import St from 'gi://St';
import { registerGClass } from '../gobject.js';
import { createIconWidget } from '../icons.js';

const ACCENTS = ['#7c6cf0', '#34c759', '#ff9f0a', '#ff375f', '#0a84ff'];
const CARD_LABELS = {
    tasks: { label: 'Tasks', icon: 'tasks' },
    focus: { label: 'Focus timer', icon: 'timer' },
    notepad: { label: 'Notepad', icon: 'notepad' },
    calendar: { label: 'Calendar events', icon: 'calendar' }
};

export class CustomizeView extends St.BoxLayout {
    static {
        registerGClass(this);
    }

    constructor(store, notifyToast) {
        super({
            vertical: false,
            style_class: 'notch-cards-container',
            x_expand: true,
            y_expand: true
        });

        this._store = store;
        this._notifyToast = notifyToast;
        this._buildView();
    }

    _buildView() {
        this.destroy_all_children();
        const settings = this._store.data.settings || {};

        // Card 1: General
        const card1 = new St.BoxLayout({ vertical: true, style_class: 'card c-green card-customize', x_expand: true, y_expand: true });
        const h1 = new St.BoxLayout({ vertical: false, style_class: 'card-head' });
        h1.add_child(createIconWidget('sliders', 20, '#1a1d1a'));
        h1.add_child(new St.Label({ text: 'General', style_class: 'card-title' }));
        card1.add_child(h1);

        card1.add_child(this._makeToggleRow('Sort new tasks with AI', settings.aiSort, val => {
            this._store.update(d => d.settings.aiSort = val);
        }));

        card1.add_child(this._makeToggleRow('Completion sound', settings.sound, val => {
            this._store.update(d => d.settings.sound = val);
        }));

        this.add_child(card1);

        // Card 2: Focus
        const card2 = new St.BoxLayout({ vertical: true, style_class: 'card c-purple card-customize', x_expand: true, y_expand: true });
        const h2 = new St.BoxLayout({ vertical: false, style_class: 'card-head' });
        h2.add_child(createIconWidget('timer', 20, '#1a1d1a'));
        h2.add_child(new St.Label({ text: 'Focus', style_class: 'card-title' }));
        card2.add_child(h2);

        const modeRow = new St.BoxLayout({ vertical: false, style_class: 'settings-row' });
        modeRow.add_child(new St.Label({ text: 'Default timer', x_expand: true, style_class: 'row-label' }));
        const modeBtn = new St.Button({
            label: settings.timerMode || 'Countdown',
            style_class: 'btn-pill-sm'
        });
        modeBtn.connect('clicked', () => {
            const next = (settings.timerMode === 'Countdown') ? 'Stopwatch' : 'Countdown';
            this._store.update(d => d.settings.timerMode = next);
            modeBtn.set_label(next);
            this._notifyToast(`Mode: ${next}`);
        });
        modeRow.add_child(modeBtn);
        card2.add_child(modeRow);

        const durRow = new St.BoxLayout({ vertical: false, style_class: 'settings-row' });
        durRow.add_child(new St.Label({ text: 'Default duration', x_expand: true, style_class: 'row-label' }));
        const stepper = new St.BoxLayout({ vertical: false, style_class: 'stepper-box' });
        const minusBtn = new St.Button({ label: '−', style_class: 'stepper-btn' });
        const durLabel = new St.Label({ text: `${settings.duration || 25} min`, style_class: 'stepper-val' });
        const plusBtn = new St.Button({ label: '+', style_class: 'stepper-btn' });

        minusBtn.connect('clicked', () => {
            const cur = Math.max(5, (this._store.data.settings.duration || 25) - 5);
            this._store.update(d => d.settings.duration = cur);
            durLabel.set_text(`${cur} min`);
        });
        plusBtn.connect('clicked', () => {
            const cur = Math.min(120, (this._store.data.settings.duration || 25) + 5);
            this._store.update(d => d.settings.duration = cur);
            durLabel.set_text(`${cur} min`);
        });

        stepper.add_child(minusBtn);
        stepper.add_child(durLabel);
        stepper.add_child(plusBtn);
        durRow.add_child(stepper);
        card2.add_child(durRow);

        this.add_child(card2);

        // Card 3: Look & Cards
        const card3 = new St.BoxLayout({ vertical: true, style_class: 'card c-blue card-customize', x_expand: true, y_expand: true });
        const h3 = new St.BoxLayout({ vertical: false, style_class: 'card-head' });
        h3.add_child(createIconWidget('grid', 20, '#1a1d1a'));
        h3.add_child(new St.Label({ text: 'Look & Workspace', style_class: 'card-title' }));
        card3.add_child(h3);

        const themeRow = new St.BoxLayout({ vertical: false, style_class: 'settings-row' });
        themeRow.add_child(new St.Label({ text: 'Theme', x_expand: true, style_class: 'row-label' }));
        const themeBtn = new St.Button({
            label: settings.theme || 'Dark',
            style_class: 'btn-pill-sm'
        });
        themeBtn.connect('clicked', () => {
            const themes = ['Dark', 'Midnight', 'Glass'];
            const curIdx = themes.indexOf(settings.theme || 'Dark');
            const nextTheme = themes[(curIdx + 1) % themes.length];
            this._store.update(d => d.settings.theme = nextTheme);
            themeBtn.set_label(nextTheme);
            this._notifyToast(`Theme: ${nextTheme}`);
        });
        themeRow.add_child(themeBtn);
        card3.add_child(themeRow);

        const accentRow = new St.BoxLayout({ vertical: false, style_class: 'settings-row' });
        accentRow.add_child(new St.Label({ text: 'Accent color', x_expand: true, style_class: 'row-label' }));
        const swatchesBox = new St.BoxLayout({ vertical: false, style_class: 'swatches-box' });
        for (const col of ACCENTS) {
            const sw = new St.Button({
                style_class: (settings.accent === col) ? 'swatch on' : 'swatch',
                style: `background-color: ${col};`
            });
            sw.connect('clicked', () => {
                this._store.update(d => d.settings.accent = col);
                this._notifyToast(`Accent color updated`);
                this._buildView();
            });
            swatchesBox.add_child(sw);
        }
        accentRow.add_child(swatchesBox);
        card3.add_child(accentRow);

        card3.add_child(new St.Label({ text: 'Cards visibility:', style_class: 'subhead-label' }));
        const cardsList = this._store.data.cards || [];
        for (const c of cardsList) {
            const info = CARD_LABELS[c.id] || { label: c.id, icon: 'grid' };
            const r = this._makeToggleRow(info.label, c.visible, val => {
                this._store.update(d => {
                    const found = d.cards.find(x => x.id === c.id);
                    if (found) found.visible = val;
                });
            });
            card3.add_child(r);
        }

        this.add_child(card3);
    }

    _makeToggleRow(label, currentVal, onChange) {
        const row = new St.BoxLayout({ vertical: false, style_class: 'settings-row' });
        row.add_child(new St.Label({ text: label, x_expand: true, style_class: 'row-label' }));

        const sw = new St.Button({
            style_class: currentVal ? 'switch-btn on' : 'switch-btn',
            can_focus: true
        });
        const knob = new St.Widget({ style_class: 'switch-knob' });
        sw.set_child(knob);

        sw.connect('clicked', () => {
            const next = !sw.has_style_class_name('on');
            if (next) sw.add_style_class_name('on');
            else sw.remove_style_class_name('on');
            onChange(next);
        });

        row.add_child(sw);
        return row;
    }
}
