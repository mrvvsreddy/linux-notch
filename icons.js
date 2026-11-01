import Gio from 'gi://Gio';
import St from 'gi://St';
import GLib from 'gi://GLib';

const SVG_ICONS = {
    sliders: '<path d="M4 6h8M18 6h2M4 12h2M12 12h8M4 18h10M20 18h0"/><circle cx="15" cy="6" r="2"/><circle cx="9" cy="12" r="2"/><circle cx="17" cy="18" r="2"/>',
    timer: '<circle cx="12" cy="13" r="8"/><path d="M12 9v4l2.5 2M9 2.5h6"/>',
    grid: '<rect x="3" y="5" width="8" height="14" rx="2"/><rect x="14" y="5" width="7" height="6" rx="1.5"/><rect x="14" y="14" width="7" height="5" rx="1.5"/>',
    notepad: '<path d="M12 4H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-6"/><path d="M18.5 3.5a2.1 2.1 0 0 1 3 3L12 16l-4 1 1-4z"/>',
    tasks: '<path d="M4 7l1.5 1.5L8 6M4 15l1.5 1.5L8 14M12 7h8M12 15h8"/>',
    calendar: '<rect x="4" y="5" width="16" height="15" rx="2.5"/><path d="M4 10h16M9 3v4M15 3v4"/>',
    bug: '<rect x="8" y="8" width="8" height="11" rx="4"/><path d="M9 8a3 3 0 0 1 6 0M4 13h4M16 13h4M5 7l3 2M19 7l-3 2M5 19l3-2M19 19l-3-2"/>',
    close: '<path d="M6 6l12 12M18 6L6 18"/>',
    play: '<path d="M8 5l11 7-11 7z" fill="currentColor"/>',
    pause: '<path d="M8 5v14M16 5v14" stroke-width="3.2"/>',
    trash: '<path d="M5 7h14M10 7V4h4v3M7 7l1 13h8l1-13"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
    chart: '<path d="M5 20V10M12 20V4M19 20v-7"/>',
    chevL: '<path d="M15 5l-7 7 7 7"/>',
    chevR: '<path d="M9 5l7 7-7 7"/>',
    flag: '<path d="M6 21V4M6 5h11l-2 4 2 4H6" fill="currentColor"/>',
    briefcase: '<rect x="3" y="7" width="18" height="13" rx="2.5"/><path d="M9 7V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2M3 13h18"/>',
    home: '<path d="M4 11l8-7 8 7v8a1 1 0 0 1-1 1h-4v-6h-6v6H5a1 1 0 0 1-1-1z"/>',
    user: '<circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 4-6 8-6s8 2 8 6"/>',
    mic: '<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3"/>',
    more: '<circle cx="5" cy="12" r="1.6" fill="currentColor"/><circle cx="12" cy="12" r="1.6" fill="currentColor"/><circle cx="19" cy="12" r="1.6" fill="currentColor"/>',
    refresh: '<path d="M20 11a8 8 0 0 0-14.5-4M4 4v4h4M4 13a8 8 0 0 0 14.5 4M20 20v-4h-4"/>',
    lines: '<path d="M5 7h14M5 12h14M5 17h9"/>',
    bell: '<path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 0 1-3.46 0"/>',
    edit: '<path d="M12 20h9M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/>',
    checkCircle: '<path d="M22 11.08V12a10 10 0 1 1-5.93-9.14M22 4L12 14.01l-3-3"/>'
};

const _iconCache = new Map();

export function getSvgIcon(name, size = 18, color = 'currentColor') {
    const key = `${name}-${size}-${color}`;
    if (_iconCache.has(key)) {
        return _iconCache.get(key);
    }

    const pathData = SVG_ICONS[name] || '';
    const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="${size}" height="${size}" fill="none" stroke="${color}" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
    ${pathData}
</svg>`;

    const bytes = new GLib.Bytes(new TextEncoder().encode(svg));
    const stream = Gio.MemoryInputStream.new_from_bytes(bytes);
    const gicon = Gio.BytesIcon.new(bytes);
    _iconCache.set(key, gicon);
    return gicon;
}

export function createIconWidget(name, size = 18, color = '#1a1d1a') {
    const gicon = getSvgIcon(name, size, color);
    return new St.Icon({
        gicon,
        icon_size: size,
        style: `width: ${size}px; height: ${size}px;`
    });
}
