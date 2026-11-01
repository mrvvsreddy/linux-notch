import { Extension } from 'resource:///org/gnome/shell/extensions/extension.js';

let _app = null;

export default class LNotchExtension extends Extension {
    async enable() {
        console.log('[lnotch] Trampoline enabling...');
        const ts = Date.now();
        const { LNotchApp } = await import(`./app.js?v=${ts}`);
        _app = new LNotchApp(this);
        _app.enable();
        console.log('[lnotch] Successfully enabled.');
    }

    disable() {
        console.log('[lnotch] Trampoline disabling...');
        if (_app) {
            _app.disable();
            _app = null;
        }
        console.log('[lnotch] Successfully disabled.');
    }
}
