import St from 'gi://St';
import { registerGClass } from './gobject.js';

export const FONT_MAP = {
    '0': ["01110","10001","10011","10101","11001","10001","01110"],
    '1': ["00100","01100","00100","00100","00100","00100","01110"],
    '2': ["01110","10001","00001","00010","00100","01000","11111"],
    '3': ["11110","00001","00001","01110","00001","00001","11110"],
    '4': ["00010","00110","01010","10010","11111","00010","00010"],
    '5': ["11111","10000","11110","00001","00001","10001","01110"],
    '6': ["00110","01000","10000","11110","10001","10001","01110"],
    '7': ["11111","00001","00010","00100","01000","01000","01000"],
    '8': ["01110","10001","10001","01110","10001","10001","01110"],
    '9': ["01110","10001","10001","01111","00001","00010","01100"],
    ':': ["0","0","1","0","1","0","0"],
    'D': ["11110","10001","10001","10001","10001","10001","11110"],
    'O': ["01110","10001","10001","10001","10001","10001","01110"],
    'N': ["10001","11001","10101","10011","10001","10001","10001"],
    'E': ["11111","10000","10000","11110","10000","10000","11111"]
};

export class DotMatrixWidget extends St.DrawingArea {
    static {
        registerGClass(this);
    }

    constructor(params = {}) {
        const { text = "25:00", activeColor = [0.1, 0.11, 0.1, 0.92], dimColor = [0.1, 0.11, 0.1, 0.08], ...rest } = params;
        super(rest);
        this._text = String(text);
        this._activeColor = activeColor;
        this._dimColor = dimColor;
        this.connect('repaint', this._onRepaint.bind(this));
    }

    setText(text) {
        if (this._text !== text) {
            this._text = String(text);
            this.queue_repaint();
        }
    }

    setColors(active, dim) {
        this._activeColor = active;
        this._dimColor = dim;
        this.queue_repaint();
    }

    _onRepaint(area) {
        const cr = area.get_context();
        const [width, height] = area.get_surface_size();
        if (width <= 0 || height <= 0) return;

        let totalCols = 0;
        for (const ch of this._text) {
            const pattern = FONT_MAP[ch];
            if (!pattern) {
                totalCols += 3;
            } else {
                totalCols += pattern[0].length + 1;
            }
        }
        totalCols = Math.max(1, totalCols - 1);
        const rows = 7;

        const dotPitchX = width / totalCols;
        const dotPitchY = height / rows;
        const dotPitch = Math.min(dotPitchX, dotPitchY);
        const dotRadius = dotPitch * 0.35;

        const startX = (width - (totalCols * dotPitch)) / 2;
        const startY = (height - (rows * dotPitch)) / 2;

        let colOffset = 0;
        for (const ch of this._text) {
            const pattern = FONT_MAP[ch];
            if (!pattern) {
                colOffset += 3;
                continue;
            }

            const charCols = pattern[0].length;
            for (let r = 0; r < rows; r++) {
                for (let c = 0; c < charCols; c++) {
                    const isOn = pattern[r][c] === '1';
                    const color = isOn ? this._activeColor : this._dimColor;
                    cr.setSourceRGBA(color[0], color[1], color[2], color[3]);

                    const cx = startX + (colOffset + c + 0.5) * dotPitch;
                    const cy = startY + (r + 0.5) * dotPitch;

                    cr.arc(cx, cy, dotRadius, 0, 2 * Math.PI);
                    cr.fill();
                }
            }
            colOffset += charCols + 1;
        }
    }
}
