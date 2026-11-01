import GLib from 'gi://GLib';
import Gio from 'gi://Gio';

function getTodayString() {
    const d = new Date();
    const pad = n => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function generateId() {
    return Math.random().toString(36).slice(2, 9);
}

const DEFAULT_STATE = {
    settings: {
        launchAtLogin: true,
        openWith: 'Click',
        shortcut: 'Alt+N',
        dayStart: '6:00 AM',
        unfinished: 'Ask me',
        aiSort: true,
        timerMode: 'Countdown',
        duration: 25,
        sound: true,
        calendarAccess: true,
        notifications: true,
        theme: 'Dark',
        accent: '#7c6cf0'
    },
    cards: [
        { id: 'tasks', visible: true },
        { id: 'focus', visible: true },
        { id: 'notepad', visible: true },
        { id: 'calendar', visible: true }
    ],
    notes: "Lead the landing page with the notch\nIdea: a weekly review every Friday\nAsk Sam about the API",
    tasks: [
        {
            id: generateId(),
            title: "Prep slides for design review",
            minutes: 45,
            priority: "High",
            tag: "Work",
            done: false,
            day: getTodayString()
        },
        {
            id: generateId(),
            title: "Pay electricity bill",
            priority: null,
            tag: "Home",
            remind: "18:30",
            done: false,
            day: getTodayString()
        },
        {
            id: generateId(),
            title: "Reply to Sam about the API",
            priority: "Medium",
            tag: "Work",
            done: true,
            doneAt: Date.now(),
            day: getTodayString()
        }
    ],
    events: [
        { id: generateId(), title: "Design review", start: "15:00", end: "15:30", done: false },
        { id: generateId(), title: "1:1 with Sam", start: "16:30", end: "17:00", done: false },
        { id: generateId(), title: "Dinner with Ana", start: "19:30", end: "21:00", done: false }
    ],
    sessions: [
        { day: getTodayString(), minutes: 45, at: Date.now() - 3600000 }
    ]
};

export class Store {
    constructor() {
        this._listeners = new Set();
        this._dirPath = GLib.build_filenamev([GLib.get_user_data_dir(), 'lnotch']);
        this._filePath = GLib.build_filenamev([this._dirPath, 'data.json']);
        this.data = this._load();
    }

    subscribe(listener) {
        this._listeners.add(listener);
        return () => this._listeners.delete(listener);
    }

    notify() {
        for (const listener of this._listeners) {
            try {
                listener(this.data);
            } catch (err) {
                console.error('[NotchOwl] Listener error:', err);
            }
        }
        this._save();
    }

    update(callback) {
        callback(this.data);
        this.notify();
    }

    _load() {
        try {
            const file = Gio.File.new_for_path(this._filePath);
            if (file.query_exists(null)) {
                const [success, contents] = file.load_contents(null);
                if (success) {
                    const text = new TextDecoder().decode(contents);
                    const parsed = JSON.parse(text);
                    return {
                        ...DEFAULT_STATE,
                        ...parsed,
                        settings: { ...DEFAULT_STATE.settings, ...(parsed.settings || {}) }
                    };
                }
            }
        } catch (e) {
            console.error('[NotchOwl] Error loading data:', e);
        }
        return JSON.parse(JSON.stringify(DEFAULT_STATE));
    }

    _save() {
        try {
            const dir = Gio.File.new_for_path(this._dirPath);
            if (!dir.query_exists(null)) {
                dir.make_directory_with_parents(null);
            }
            const file = Gio.File.new_for_path(this._filePath);
            const json = JSON.stringify(this.data, null, 2);
            file.replace_contents(json, null, false, Gio.FileCreateFlags.REPLACE_DESTINATION, null);
        } catch (e) {
            console.error('[NotchOwl] Error saving data:', e);
        }
    }

    reset() {
        this.data = JSON.parse(JSON.stringify(DEFAULT_STATE));
        this.notify();
    }
}
