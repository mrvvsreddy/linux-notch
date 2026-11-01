import GLib from 'gi://GLib';

function formatTime(seconds) {
    const s = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const sec = seconds % 60;
    const pad = n => String(n).padStart(2, '0');
    return s > 0 ? `${s}:${pad(m)}:${pad(sec)}` : `${pad(m)}:${pad(sec)}`;
}

export class TimerManager {
    constructor(store) {
        this._store = store;
        this.running = false;
        this.finished = false;
        this.taskId = null;
        this.startedAt = 0;
        this.accum = 0;
        this.frozenTotal = 0;
        this._timeoutId = 0;
        this._listeners = new Set();
    }

    subscribe(fn) {
        this._listeners.add(fn);
        return () => this._listeners.delete(fn);
    }

    _emit() {
        for (const fn of this._listeners) {
            try {
                fn(this);
            } catch (e) {
                console.error('[NotchOwl] Timer listener error:', e);
            }
        }
    }

    get mode() {
        return this._store.data.settings.timerMode || 'Countdown';
    }

    get idle() {
        return !this.running && this.accum === 0 && !this.finished;
    }

    get paused() {
        return !this.running && this.accum > 0 && !this.finished;
    }

    get task() {
        if (!this.taskId) return null;
        return this._store.data.tasks.find(t => t.id === this.taskId && !t.done) || null;
    }

    computeTotal() {
        const mins = this.task?.minutes || this._store.data.settings.duration || 25;
        return mins * 60 * 1000;
    }

    get totalMs() {
        return this.idle ? this.computeTotal() : this.frozenTotal;
    }

    elapsed() {
        return this.accum + (this.running ? Date.now() - this.startedAt : 0);
    }

    progress() {
        if (this.mode === 'Stopwatch') {
            return (this.elapsed() % 3600000) / 3600000;
        }
        return Math.min(1.0, this.elapsed() / (this.totalMs || 1));
    }

    label() {
        if (this.finished) return 'DONE';
        if (this.mode === 'Stopwatch') {
            return formatTime(Math.floor(this.elapsed() / 1000));
        }
        const remaining = Math.max(0, this.totalMs - this.elapsed());
        return formatTime(Math.ceil(remaining / 1000));
    }

    status() {
        if (this.finished) return 'Complete';
        if (this.running) return this.mode === 'Stopwatch' ? 'Tracking' : 'Focusing';
        if (this.paused) return 'Paused';
        return 'Ready';
    }

    start() {
        if (this.running) return;
        if (this.finished) this.reset();
        if (this.accum === 0) {
            this.frozenTotal = this.computeTotal();
        }
        this.running = true;
        this.startedAt = Date.now();
        this._startTicker();
        this._emit();
    }

    pause() {
        if (!this.running) return;
        this.accum += Date.now() - this.startedAt;
        this.running = false;
        this._stopTicker();
        this._emit();
    }

    toggle() {
        if (this.running) this.pause();
        else this.start();
    }

    reset() {
        if (!this.finished) this.commit();
        this.running = false;
        this.finished = false;
        this.accum = 0;
        this._stopTicker();
        this._emit();
    }

    complete() {
        if (this.idle || this.finished) return;
        if (this.running) {
            this.accum += Date.now() - this.startedAt;
        }
        this.running = false;
        this.commit();
        this.finished = true;
        this._stopTicker();
        this._emit();
    }

    setTask(id) {
        this.taskId = id;
        this._emit();
    }

    fastForward() {
        if (this.mode === 'Countdown') {
            if (this.idle) this.start();
            this.accum = Math.max(0, this.frozenTotal - 5000);
            this.startedAt = Date.now();
            this._emit();
        }
    }

    _startTicker() {
        this._stopTicker();
        this._timeoutId = GLib.timeout_add(GLib.PRIORITY_DEFAULT, 250, () => {
            if (!this.running) return GLib.SOURCE_REMOVE;
            if (this.mode === 'Countdown' && this.elapsed() >= this.frozenTotal) {
                this._finish();
                return GLib.SOURCE_REMOVE;
            }
            this._emit();
            return GLib.SOURCE_CONTINUE;
        });
    }

    _stopTicker() {
        if (this._timeoutId) {
            GLib.Source.remove(this._timeoutId);
            this._timeoutId = 0;
        }
    }

    _finish() {
        this.accum = this.frozenTotal;
        this.running = false;
        this.finished = true;
        this.commit();
        this._playAlertSound();
        this._emit();
    }

    _playAlertSound() {
        if (!this._store.data.settings.sound) return;
        try {
            GLib.spawn_command_line_async("canberra-gtk-play -i complete-media || paplay /usr/share/sounds/freedesktop/stereo/complete.oga || true");
        } catch (e) {
            console.error('[NotchOwl] Sound error:', e);
        }
    }

    commit() {
        const mins = this.elapsed() / 60000;
        if (mins >= 0.5) {
            this._store.update(d => {
                const today = new Date().toISOString().slice(0, 10);
                d.sessions.push({
                    day: today,
                    minutes: Math.round(mins * 10) / 10,
                    at: Date.now()
                });
            });
        }
    }

    destroy() {
        this._stopTicker();
    }
}
