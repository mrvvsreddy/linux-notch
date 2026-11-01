import GObject from 'gi://GObject';
import Clutter from 'gi://Clutter';
import St from 'gi://St';
import { registerGClass } from '../gobject.js';
import { createIconWidget } from '../icons.js';

class BarChartWidget extends St.DrawingArea {
    static {
        registerGClass(this);
    }

    constructor(daysData = []) {
        super({ x_expand: true, y_expand: true });
        this._daysData = daysData;
        this.connect('repaint', this._onRepaint.bind(this));
    }

    setDaysData(data) {
        this._daysData = data;
        this.queue_repaint();
    }

    _onRepaint(area) {
        const cr = area.get_context();
        const [w, h] = area.get_surface_size();
        if (w <= 0 || h <= 0 || !this._daysData.length) return;

        const maxMins = Math.max(30, ...this._daysData.map(d => d.minutes));
        const numBars = this._daysData.length;
        const barSpacing = w / numBars;
        const barWidth = Math.min(32, barSpacing * 0.65);
        const bottomLabelHeight = 22;
        const chartHeight = h - bottomLabelHeight - 10;

        for (let i = 0; i < numBars; i++) {
            const item = this._daysData[i];
            const centerX = (i + 0.5) * barSpacing;
            const barHeight = Math.max(6, (item.minutes / maxMins) * chartHeight);
            const x = centerX - (barWidth / 2);
            const y = chartHeight - barHeight + 5;

            if (item.isToday) {
                cr.setSourceRGBA(0.48, 0.42, 0.94, 0.95);
            } else {
                cr.setSourceRGBA(0.1, 0.11, 0.12, 0.35);
            }

            const radius = 6;
            cr.newSubPath();
            cr.arc(x + radius, y + radius, radius, Math.PI, 1.5 * Math.PI);
            cr.arc(x + barWidth - radius, y + radius, radius, 1.5 * Math.PI, 2 * Math.PI);
            cr.arc(x + barWidth - radius, y + barHeight - radius, radius, 0, 0.5 * Math.PI);
            cr.arc(x + radius, y + barHeight - radius, radius, 0.5 * Math.PI, Math.PI);
            cr.closePath();
            cr.fill();

            cr.setSourceRGBA(0.1, 0.11, 0.1, 0.7);
            cr.selectFontFace("Sans", 0, 0);
            cr.setFontSize(11);
            const extents = cr.textExtents(item.label);
            cr.moveTo(centerX - (extents.width / 2), h - 4);
            cr.showText(item.label);
        }
    }
}

export class InsightsView extends St.BoxLayout {
    static {
        registerGClass(this);
    }

    constructor(store) {
        super({
            vertical: false,
            style_class: 'notch-cards-container',
            x_expand: true,
            y_expand: true
        });

        this._store = store;
        this._buildView();
    }

    _buildView() {
        this.destroy_all_children();

        const today = new Date().toISOString().slice(0, 10);
        const sessions = this._store.data.sessions || [];
        const tasks = this._store.data.tasks || [];

        const last7Days = [];
        for (let i = 6; i >= 0; i--) {
            const d = new Date(Date.now() - i * 86400000);
            const key = d.toISOString().slice(0, 10);
            const label = d.toLocaleDateString('en-US', { weekday: 'short' });
            const mins = sessions
                .filter(s => s.day === key)
                .reduce((acc, s) => acc + (s.minutes || 0), 0);
            last7Days.push({ label, minutes: Math.round(mins), isToday: key === today });
        }

        const todayMins = last7Days[6].minutes;
        const todayTasksDone = tasks.filter(t => t.done && t.day === today).length;
        const todaySessions = sessions.filter(s => s.day === today).length;

        const totalWeekMins = last7Days.reduce((acc, d) => acc + d.minutes, 0);
        let streak = 0;
        for (let i = 6; i >= 0; i--) {
            if (last7Days[i].minutes > 0) streak++;
            else if (i !== 6) break;
        }

        const card1 = new St.BoxLayout({ vertical: true, style_class: 'card c-green card-insights', x_expand: true, y_expand: true });
        const h1 = new St.BoxLayout({ vertical: false, style_class: 'card-head' });
        h1.add_child(createIconWidget('timer', 20, '#1a1d1a'));
        h1.add_child(new St.Label({ text: 'Today', style_class: 'card-title' }));
        card1.add_child(h1);

        const statsGrid1 = new St.BoxLayout({ vertical: false, style_class: 'stats-row' });
        statsGrid1.add_child(this._makeStatBox(`${todayMins}m`, 'focused'));
        statsGrid1.add_child(this._makeStatBox(String(todayTasksDone), 'tasks done'));
        statsGrid1.add_child(this._makeStatBox(String(todaySessions), 'sessions'));
        card1.add_child(statsGrid1);
        this.add_child(card1);

        const card2 = new St.BoxLayout({ vertical: true, style_class: 'card c-purple card-insights', x_expand: true, y_expand: true });
        const h2 = new St.BoxLayout({ vertical: false, style_class: 'card-head' });
        h2.add_child(createIconWidget('chart', 20, '#1a1d1a'));
        h2.add_child(new St.Label({ text: 'This week', style_class: 'card-title' }));
        card2.add_child(h2);

        const statsGrid2 = new St.BoxLayout({ vertical: false, style_class: 'stats-row' });
        statsGrid2.add_child(this._makeStatBox(`${totalWeekMins}m`, 'total focus'));
        statsGrid2.add_child(this._makeStatBox(`${streak}d`, 'streak'));
        card2.add_child(statsGrid2);

        const weekTasksDone = tasks.filter(t => t.done).length;
        card2.add_child(new St.Label({
            text: `${weekTasksDone} tasks completed in 7 days`,
            style_class: 'insights-meta'
        }));
        this.add_child(card2);

        const card3 = new St.BoxLayout({ vertical: true, style_class: 'card c-blue card-insights', x_expand: true, y_expand: true });
        const h3 = new St.BoxLayout({ vertical: false, style_class: 'card-head' });
        h3.add_child(createIconWidget('chart', 20, '#1a1d1a'));
        h3.add_child(new St.Label({ text: 'Last 7 days', style_class: 'card-title' }));
        card3.add_child(h3);

        const chart = new BarChartWidget(last7Days);
        card3.add_child(chart);
        this.add_child(card3);
    }

    _makeStatBox(val, label) {
        const box = new St.BoxLayout({ vertical: true, style_class: 'stat-box', x_expand: true });
        box.add_child(new St.Label({ text: val, style_class: 'stat-num' }));
        box.add_child(new St.Label({ text: label, style_class: 'stat-label' }));
        return box;
    }
}
