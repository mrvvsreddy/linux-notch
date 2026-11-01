import GObject from 'gi://GObject';

let _counter = 0;

/**
 * Safely registers a GObject subclass with a unique GTypeName
 * so that live extension reloads never collide in GLib's GType registry.
 */
export function registerGClass(optionsOrClass, maybeClass) {
    const options = maybeClass ? optionsOrClass : {};
    const cls = maybeClass ? maybeClass : optionsOrClass;

    if (!options.GTypeName) {
        _counter++;
        options.GTypeName = `LNotch_${cls.name || 'Widget'}_${Date.now()}_${_counter}`;
    }

    return GObject.registerClass(options, cls);
}
