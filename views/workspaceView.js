import GObject from 'gi://GObject';
import Clutter from 'gi://Clutter';
import St from 'gi://St';
import GLib from 'gi://GLib';
import { registerGClass } from '../gobject.js';
import { DotMatrixWidget } from '../dotMatrix.js';
import { createIconWidget } from '../icons.js';

export function parseTaskInput(text) {
    let s = text.trim();
    let mins = null, priority = null, tag = null, remind = null;

    const pMatch = s.match(/(?:^|\s)!(high|medium|low|h|m|l)\b/i);
    if (pMatch) {
        const l = pMatch[1][0].toLowerCase();
        priority = l === 'h' ? 'High' : (l === 'm' ? 'Medium' : 'Low');
        s = s.replace(pMatch[0], ' ');
    }

    const tMatch = s.match(/(?:^|\s)@(work|home|personal)\b/i);
    if (tMatch) {
        const t = tMatch[1].toLowerCase();
        tag = t === 'work' ? 'Work' : (t === 'home' ? 'Home' : 'Personal');
        s = s.replace(tMatch[0], ' ');
    }

    const mMatch = s.match(/(?:^|\s)(\d{1,3})\s?(m|min|mins)\b/i);
    if (mMatch) {
        mins = Math.min(180, parseInt(mMatch[1], 10));
        s = s.replace(mMatch[0], ' ');
    }

    const rMatch = s.match(/(?:^|\s)(\d{1,2})(?::(\d{2}))?\s?(am|pm)\b/i);
    if (rMatch) {
        let hour = parseInt(rMatch[1], 10) % 12;
        if (rMatch[3].toLowerCase() === 'pm') hour += 12;
        const minStr = rMatch[2] || '00';
        remind = `${String(hour).padStart(2, '0')}:${minStr}`;
        s = s.replace(rMatch[0], ' ');
    }

    return {
        title: s.replace(/\s+/g, ' ').trim(),
        minutes: mins,
        priority,
        tag,
        remind
    };
}

function applyStrikethrough(label, text, isDone) {
    if (isDone) {
        label.clutter_text.use_markup = true;
        label.clutter_text.set_markup(`<s>${GLib.markup_escape_text(text, -1)}</s>`);
    } else {
        label.clutter_text.use_markup = false;
        label.set_text(text);
    }
}

function createCircularCheckbox(isDone, onToggle) {
    const chk = new St.Button({
        style_class: isDone ? 'chk-circle on' : 'chk-circle',
        x_align: Clutter.ActorAlign.CENTER,
        y_align: Clutter.ActorAlign.CENTER,
        reactive: true,
        can_focus: true
    });
    chk.set_size(20, 20);

    const updateIcon = done => {
        if (done) {
            const checkIcon = createIconWidget('check', 11, '#ffffff');
            checkIcon.x_align = Clutter.ActorAlign.CENTER;
            checkIcon.y_align = Clutter.ActorAlign.CENTER;
            chk.set_child(checkIcon);
        } else {
            chk.set_child(null);
        }
    };

    updateIcon(isDone);

    chk.connect('clicked', () => onToggle(chk, updateIcon));
    return chk;
}

export class WorkspaceView extends St.BoxLayout {
    static {
        registerGClass(this);
    }

    constructor(store, timerManager, notifyToast) {
        super({
            vertical: false,
            style_class: 'notch-cards-container',
            x_expand: true,
            y_expand: true
        });

        this._store = store;
        this._timer = timerManager;
        this._notifyToast = notifyToast;
        this._taskTab = 'todo';
        this._showAddEvent = false;

        this._buildCards();

        this._storeSub = this._store.subscribe(() => this._updateAll());
        this._timerSub = this._timer.subscribe(() => this._updateTimer());
    }

    _buildCards() {
        this.destroy_all_children();

        const cardsConfig = this._store.data.cards || [];
        const isVisible = id => {
            const c = cardsConfig.find(item => item.id === id);
            return c ? c.visible : true;
        };

        if (isVisible('tasks')) {
            this._tasksCard = this._buildTasksCard();
            this.add_child(this._tasksCard);
        }
        if (isVisible('focus')) {
            this._focusCard = this._buildFocusCard();
            this.add_child(this._focusCard);
        }
        if (isVisible('notepad')) {
            this._notepadCard = this._buildNotepadCard();
            this.add_child(this._notepadCard);
        }
        if (isVisible('calendar')) {
            this._calendarCard = this._buildCalendarCard();
            this.add_child(this._calendarCard);
        }
    }

    /* ---------------------- TASKS CARD ---------------------- */
    _buildTasksCard() {
        const card = new St.BoxLayout({
            vertical: true,
            style_class: 'card c-green card-tasks',
            x_expand: true,
            y_expand: true
        });

        // Top notch bar
        const notchBar = new St.Widget({ style_class: 'card-notch-bar' });
        card.add_child(notchBar);

        // Header: "Today's tasks" + Date Switcher Pill (< 📅 30 Oct >)
        const head = new St.BoxLayout({ vertical: false, style_class: 'card-head' });
        const title = new St.Label({ text: "Today's tasks", style_class: 'card-title', x_expand: true });
        head.add_child(title);

        const datePill = new St.BoxLayout({ vertical: false, style_class: 'tasks-date-pill' });
        const prevDay = new St.Button({ style_class: 'task-action-btn sm' });
        prevDay.set_child(createIconWidget('chevL', 12, '#1a1d1a'));
        const dateLbl = new St.Label({
            text: `📅 ${new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}`,
            style_class: 'tasks-date-txt'
        });
        const nextDay = new St.Button({ style_class: 'task-action-btn sm' });
        nextDay.set_child(createIconWidget('chevR', 12, '#1a1d1a'));
        datePill.add_child(prevDay);
        datePill.add_child(dateLbl);
        datePill.add_child(nextDay);
        head.add_child(datePill);
        card.add_child(head);

        // Tabs Pill: [ To do  2 | Completed  1 ]
        const tabsBox = new St.BoxLayout({ vertical: false, style_class: 'tabs-pill' });
        this._todoTabBtn = new St.Button({
            label: `To do  ${this._getTasks(false).length}`,
            style_class: this._taskTab === 'todo' ? 'tab-btn on' : 'tab-btn'
        });
        this._todoTabBtn.connect('clicked', () => {
            this._taskTab = 'todo';
            this._refreshTasksList();
        });

        this._doneTabBtn = new St.Button({
            label: `Completed  ${this._getTasks(true).length}`,
            style_class: this._taskTab === 'done' ? 'tab-btn on' : 'tab-btn'
        });
        this._doneTabBtn.connect('clicked', () => {
            this._taskTab = 'done';
            this._refreshTasksList();
        });

        tabsBox.add_child(this._todoTabBtn);
        tabsBox.add_child(this._doneTabBtn);
        card.add_child(tabsBox);

        // Scrollable list
        this._tasksScroll = new St.ScrollView({
            x_expand: true,
            y_expand: true,
            style_class: 'card-scroll'
        });
        this._tasksList = new St.BoxLayout({ vertical: true, style_class: 'tasks-list' });
        this._tasksScroll.set_child(this._tasksList);
        card.add_child(this._tasksScroll);

        // Footer: [+ Add a task...] [🎙] [Drag to reorder]
        const foot = new St.BoxLayout({ vertical: false, style_class: 'tasks-foot-bar' });
        foot.add_child(createIconWidget('plus', 15, '#1a1d1a'));
        this._taskEntry = new St.Entry({
            hint_text: 'Add a task...',
            style_class: 'add-input',
            x_expand: true,
            can_focus: true
        });
        this._taskEntry.clutter_text.connect('activate', () => {
            const raw = this._taskEntry.get_text();
            if (raw && raw.trim()) {
                const parsed = parseTaskInput(raw);
                if (parsed.title) {
                    this._store.update(d => {
                        d.tasks.push({
                            id: Math.random().toString(36).slice(2, 9),
                            title: parsed.title,
                            minutes: parsed.minutes,
                            priority: parsed.priority,
                            tag: parsed.tag,
                            remind: parsed.remind,
                            done: false,
                            day: new Date().toISOString().slice(0, 10)
                        });
                    });
                    this._taskEntry.set_text('');
                    this._notifyToast('Task added');
                }
            }
        });
        foot.add_child(this._taskEntry);

        const micBtn = new St.Button({ style_class: 'task-action-btn' });
        micBtn.set_child(createIconWidget('mic', 15, 'rgba(26,29,26,0.7)'));
        foot.add_child(micBtn);

        const reorderHint = new St.Label({
            text: 'Drag to reorder',
            style_class: 'tasks-reorder-hint'
        });
        foot.add_child(reorderHint);
        card.add_child(foot);

        this._refreshTasksList();
        return card;
    }

    _getTasks(completed) {
        return (this._store.data.tasks || []).filter(t => Boolean(t.done) === completed);
    }

    _refreshTasksList() {
        this._tasksList.destroy_all_children();

        const isDone = this._taskTab === 'done';
        const tasks = this._getTasks(isDone);

        this._todoTabBtn.style_class = !isDone ? 'tab-btn on' : 'tab-btn';
        this._doneTabBtn.style_class = isDone ? 'tab-btn on' : 'tab-btn';
        this._todoTabBtn.set_label(`To do  ${this._getTasks(false).length}`);
        this._doneTabBtn.set_label(`Completed  ${this._getTasks(true).length}`);

        if (tasks.length === 0) {
            const empty = new St.Label({
                text: isDone ? 'Nothing completed yet.' : 'All clear! Add a task below.',
                style_class: 'empty-notice'
            });
            this._tasksList.add_child(empty);
            return;
        }

        for (const task of tasks) {
            const item = new St.BoxLayout({
                vertical: false,
                style_class: task.done ? 'task-item done' : 'task-item'
            });

            const mainBox = new St.BoxLayout({ vertical: true, x_expand: true, style_class: 'task-main' });
            const titleLbl = new St.Label({
                text: task.title,
                style_class: task.done ? 'task-title done' : 'task-title'
            });
            applyStrikethrough(titleLbl, task.title, task.done);
            mainBox.add_child(titleLbl);

            const metaBox = new St.BoxLayout({ vertical: false, style_class: 'task-meta' });
            if (task.minutes) {
                const minLbl = new St.Label({ text: `Focused · ${task.minutes}m`, style_class: 'task-meta-txt' });
                metaBox.add_child(minLbl);
            }
            if (task.priority) {
                const pBox = new St.BoxLayout({ vertical: false, style_class: 'task-chip priority' });
                pBox.add_child(createIconWidget('flag', 11, '#1a1d1a'));
                pBox.add_child(new St.Label({ text: task.priority }));
                metaBox.add_child(pBox);
            }
            if (task.tag) {
                const tBox = new St.BoxLayout({ vertical: false, style_class: 'task-chip tag' });
                tBox.add_child(createIconWidget(task.tag === 'Work' ? 'briefcase' : 'home', 11, '#1a1d1a'));
                tBox.add_child(new St.Label({ text: task.tag }));
                metaBox.add_child(tBox);
            }
            if (task.remind) {
                const rBox = new St.BoxLayout({ vertical: false, style_class: 'task-chip remind' });
                rBox.add_child(createIconWidget('bell', 11, '#1a1d1a'));
                rBox.add_child(new St.Label({ text: task.remind }));
                metaBox.add_child(rBox);
            }
            if (metaBox.get_children().length > 0) mainBox.add_child(metaBox);

            // Circular Checkbox on the left
            const chk = createCircularCheckbox(task.done, (btn, updateIcon) => {
                task.done = !task.done;
                btn.style_class = task.done ? 'chk-circle on' : 'chk-circle';
                updateIcon(task.done);
                applyStrikethrough(titleLbl, task.title, task.done);
                if (task.done) {
                    item.add_style_class_name('done');
                    task.doneAt = Date.now();
                } else {
                    item.remove_style_class_name('done');
                    task.doneAt = null;
                }

                // Smooth delay before switching tabs so user sees the tick and strikethrough!
                GLib.timeout_add(GLib.PRIORITY_DEFAULT, 420, () => {
                    this._store.update(d => {
                        const t = d.tasks.find(x => x.id === task.id);
                        if (t) {
                            t.done = task.done;
                            t.doneAt = task.doneAt;
                        }
                    });
                    return GLib.SOURCE_REMOVE;
                });
            });
            item.add_child(chk);
            item.add_child(mainBox);

            // Action buttons on the right: Play, Edit, More
            const actionsBox = new St.BoxLayout({ vertical: false, style_class: 'task-actions' });
            if (!task.done) {
                const playBtn = new St.Button({ style_class: 'task-action-btn' });
                playBtn.set_child(createIconWidget('play', 12, '#1a1d1a'));
                playBtn.connect('clicked', () => {
                    this._timer.setTask(task.id);
                    if (!this._timer.running) this._timer.start();
                    this._notifyToast(`Focused on: ${task.title}`);
                });
                actionsBox.add_child(playBtn);
            }

            const editBtn = new St.Button({ style_class: 'task-action-btn' });
            editBtn.set_child(createIconWidget('edit', 12, 'rgba(26,29,26,0.7)'));
            editBtn.connect('clicked', () => {
                this._taskEntry.set_text(task.title);
                this._taskEntry.grab_key_focus();
            });
            actionsBox.add_child(editBtn);

            const moreBtn = new St.Button({ style_class: 'task-action-btn' });
            moreBtn.set_child(createIconWidget('more', 12, 'rgba(26,29,26,0.7)'));
            moreBtn.connect('clicked', () => {
                this._store.update(d => {
                    d.tasks = d.tasks.filter(x => x.id !== task.id);
                });
                this._notifyToast('Task removed');
            });
            actionsBox.add_child(moreBtn);

            item.add_child(actionsBox);
            this._tasksList.add_child(item);
        }
    }

    /* ---------------------- FOCUS TIMER CARD ---------------------- */
    _buildFocusCard() {
        const card = new St.BoxLayout({
            vertical: true,
            style_class: 'card c-purple card-timer',
            x_expand: true,
            y_expand: true
        });

        // Top notch bar
        const notchBar = new St.Widget({ style_class: 'card-notch-bar' });
        card.add_child(notchBar);

        const head = new St.BoxLayout({ vertical: false, style_class: 'card-head' });
        head.add_child(createIconWidget('timer', 20, '#1a1d1a'));
        this._timerTargetLabel = new St.Label({
            text: this._timer.task ? this._timer.task.title : 'Free focus',
            style_class: 'card-title',
            x_expand: true
        });
        head.add_child(this._timerTargetLabel);
        card.add_child(head);

        this._dotMatrix = new DotMatrixWidget({
            text: this._timer.label(),
            style_class: 'timer-dotmatrix',
            activeColor: [0.1, 0.11, 0.1, 0.95],
            dimColor: [0.1, 0.11, 0.1, 0.08]
        });
        this._dotMatrix.set_size(200, 52);
        card.add_child(this._dotMatrix);

        this._timerStatusLabel = new St.Label({
            text: this._timer.status(),
            style_class: 'timer-status'
        });
        card.add_child(this._timerStatusLabel);

        this._pbarTrack = new St.BoxLayout({ style_class: 'pbar-track' });
        this._pbarFill = new St.BoxLayout({ style_class: 'pbar-fill' });
        this._pbarTrack.add_child(this._pbarFill);
        card.add_child(this._pbarTrack);

        const ctrls = new St.BoxLayout({ vertical: false, style_class: 'timer-controls' });
        this._startBtn = new St.Button({ style_class: 'timer-btn-primary' });
        this._startBtnBox = new St.BoxLayout({ vertical: false, style_class: 'timer-btn-content' });
        this._startBtnIcon = createIconWidget(this._timer.running ? 'pause' : 'play', 16, '#ffffff');
        this._startBtnLabel = new St.Label({ text: this._timer.running ? 'Pause' : (this._timer.paused ? 'Resume' : 'Start') });
        this._startBtnBox.add_child(this._startBtnIcon);
        this._startBtnBox.add_child(this._startBtnLabel);
        this._startBtn.set_child(this._startBtnBox);
        this._startBtn.connect('clicked', () => this._timer.toggle());
        ctrls.add_child(this._startBtn);

        this._finishBtn = new St.Button({ style_class: 'timer-btn-finish' });
        this._finishBtn.set_child(createIconWidget('check', 18, '#ffffff'));
        this._finishBtn.connect('clicked', () => {
            this._timer.complete();
            this._notifyToast('Session completed & saved');
        });
        ctrls.add_child(this._finishBtn);
        card.add_child(ctrls);

        const presetsBox = new St.BoxLayout({ vertical: false, style_class: 'timer-presets' });
        for (const m of [15, 25, 45, 60]) {
            const btn = new St.Button({ label: `${m}m`, style_class: 'preset-btn' });
            btn.connect('clicked', () => {
                this._store.update(d => d.settings.duration = m);
                this._timer.reset();
                this._notifyToast(`Duration set to ${m} min`);
            });
            presetsBox.add_child(btn);
        }
        card.add_child(presetsBox);

        return card;
    }

    _updateTimer() {
        if (!this._dotMatrix) return;
        this._dotMatrix.setText(this._timer.label());
        this._timerStatusLabel.set_text(this._timer.status());
        this._timerTargetLabel.set_text(this._timer.task ? this._timer.task.title : 'Free focus');

        const isRunning = this._timer.running;
        this._startBtnBox.destroy_all_children();
        this._startBtnBox.add_child(createIconWidget(isRunning ? 'pause' : 'play', 16, '#ffffff'));
        this._startBtnBox.add_child(new St.Label({ text: isRunning ? 'Pause' : (this._timer.paused ? 'Resume' : 'Start') }));

        const p = this._timer.progress();
        const percent = Math.round(p * 100);
        this._pbarFill.style = `width: ${Math.max(4, percent)}%;`;
    }

    /* ---------------------- NOTEPAD CARD ---------------------- */
    _buildNotepadCard() {
        const card = new St.BoxLayout({
            vertical: true,
            style_class: 'card c-olive card-notepad',
            x_expand: true,
            y_expand: true
        });

        // Top notch bar
        const notchBar = new St.Widget({ style_class: 'card-notch-bar' });
        card.add_child(notchBar);

        // Header: Notepad icon + "Notepad"
        const head = new St.BoxLayout({ vertical: false, style_class: 'card-head' });
        head.add_child(createIconWidget('notepad', 20, '#1a1d1a'));
        head.add_child(new St.Label({ text: 'Notepad', style_class: 'card-title', x_expand: true }));
        card.add_child(head);

        // Date Subheader + Divider Line
        const dateBox = new St.BoxLayout({ vertical: true, style_class: 'notepad-date-box' });
        const dateStr = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
        dateBox.add_child(new St.Label({ text: dateStr, style_class: 'notepad-date' }));
        const dateDivider = new St.Widget({ style_class: 'notepad-date-divider' });
        dateBox.add_child(dateDivider);
        card.add_child(dateBox);

        // Text box container (St.BoxLayout inside card)
        const noteBox = new St.BoxLayout({
            vertical: true,
            x_expand: true,
            y_expand: true,
            style_class: 'notepad-box'
        });

        this._notepadEntry = new St.Entry({
            text: this._store.data.notes || '',
            hint_text: 'Jot something down...',
            style_class: 'notepad-entry',
            can_focus: true,
            x_expand: true,
            y_expand: true
        });

        if (this._notepadEntry.clutter_text) {
            this._notepadEntry.clutter_text.set_single_line_mode(false);
            this._notepadEntry.clutter_text.set_activatable(false);
            this._notepadEntry.clutter_text.set_line_wrap(true);
        }

        const updateWordCount = text => {
            const words = text.trim() ? text.trim().split(/\s+/).length : 0;
            this._wordCountLabel.set_text(`${words} words`);
        };

        this._notepadEntry.clutter_text.connect('text-changed', () => {
            const text = this._notepadEntry.get_text();
            this._store.update(d => d.notes = text);
            updateWordCount(text);
        });

        noteBox.add_child(this._notepadEntry);
        card.add_child(noteBox);

        // Footer: [lines] [18 words] [🎙]
        const foot = new St.BoxLayout({ vertical: false, style_class: 'notepad-foot' });
        foot.add_child(createIconWidget('lines', 15, 'rgba(26,29,26,0.6)'));
        this._wordCountLabel = new St.Label({
            text: '0 words',
            style_class: 'notepad-words',
            x_expand: true
        });
        foot.add_child(this._wordCountLabel);

        const micBtn = new St.Button({ style_class: 'task-action-btn' });
        micBtn.set_child(createIconWidget('mic', 16, '#1a1d1a'));
        foot.add_child(micBtn);

        card.add_child(foot);

        updateWordCount(this._store.data.notes || '');
        return card;
    }

    /* ---------------------- CALENDAR EVENTS CARD ---------------------- */
    _buildCalendarCard() {
        const card = new St.BoxLayout({
            vertical: true,
            style_class: 'card c-blue card-calendar',
            x_expand: true,
            y_expand: true
        });

        // Top notch bar
        const notchBar = new St.Widget({ style_class: 'card-notch-bar' });
        card.add_child(notchBar);

        // Header: Calendar icon + "Events" + more button
        const head = new St.BoxLayout({ vertical: false, style_class: 'card-head' });
        head.add_child(createIconWidget('calendar', 20, '#1a1d1a'));
        head.add_child(new St.Label({ text: 'Events', style_class: 'card-title', x_expand: true }));

        const moreBtn = new St.Button({ style_class: 'card-mini-btn' });
        moreBtn.set_child(createIconWidget('more', 16, '#1a1d1a'));
        head.add_child(moreBtn);

        const addEvBtn = new St.Button({ style_class: 'card-mini-btn' });
        addEvBtn.set_child(createIconWidget('plus', 16, '#1a1d1a'));
        addEvBtn.connect('clicked', () => {
            this._showAddEvent = !this._showAddEvent;
            this._addEventBox.visible = this._showAddEvent;
        });
        head.add_child(addEvBtn);
        card.add_child(head);

        // Subheader row: [TODAY]    [Fri 30]
        const subRow = new St.BoxLayout({ vertical: false, style_class: 'ev-subhead-row' });
        subRow.add_child(new St.Label({ text: 'TODAY', style_class: 'ev-today-lbl', x_expand: true }));
        const dayStr = new Date().toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric' });
        subRow.add_child(new St.Label({ text: dayStr, style_class: 'ev-day-lbl' }));
        card.add_child(subRow);

        // Add event collapsible form
        this._addEventBox = new St.BoxLayout({ vertical: true, style_class: 'ev-add-form', visible: this._showAddEvent });
        this._evTitleEntry = new St.Entry({ hint_text: 'Event title', style_class: 'add-input' });
        const timeRow = new St.BoxLayout({ vertical: false, style_class: 'ev-times-row' });
        this._evStartEntry = new St.Entry({ text: '10:00', style_class: 'add-input sm' });
        this._evEndEntry = new St.Entry({ text: '10:30', style_class: 'add-input sm' });
        timeRow.add_child(this._evStartEntry);
        timeRow.add_child(this._evEndEntry);

        const formBtns = new St.BoxLayout({ vertical: false, style_class: 'ev-form-actions' });
        const cancelBtn = new St.Button({ label: 'Cancel', style_class: 'btn-ghost-sm' });
        cancelBtn.connect('clicked', () => {
            this._showAddEvent = false;
            this._addEventBox.visible = false;
        });
        const saveEvBtn = new St.Button({ label: 'Add', style_class: 'btn-primary-sm' });
        saveEvBtn.connect('clicked', () => {
            const title = this._evTitleEntry.get_text().trim();
            if (title) {
                this._store.update(d => {
                    d.events.push({
                        id: Math.random().toString(36).slice(2, 9),
                        title,
                        start: this._evStartEntry.get_text().trim() || '10:00',
                        end: this._evEndEntry.get_text().trim() || '10:30',
                        done: false
                    });
                });
                this._evTitleEntry.set_text('');
                this._showAddEvent = false;
                this._addEventBox.visible = false;
                this._refreshEventsList();
                this._notifyToast('Event added');
            }
        });
        formBtns.add_child(cancelBtn);
        formBtns.add_child(saveEvBtn);

        this._addEventBox.add_child(this._evTitleEntry);
        this._addEventBox.add_child(timeRow);
        this._addEventBox.add_child(formBtns);
        card.add_child(this._addEventBox);

        // Events scroll list
        const scroll = new St.ScrollView({ x_expand: true, y_expand: true, style_class: 'card-scroll' });
        this._eventsList = new St.BoxLayout({ vertical: true, style_class: 'events-list' });
        scroll.set_child(this._eventsList);
        card.add_child(scroll);

        // Footer: [✓ Connected]    [↻]
        const evFoot = new St.BoxLayout({ vertical: false, style_class: 'ev-foot' });
        const connBox = new St.BoxLayout({ vertical: false, style_class: 'ev-conn-box', x_expand: true });
        connBox.add_child(createIconWidget('checkCircle', 14, 'rgba(26,29,26,0.6)'));
        connBox.add_child(new St.Label({ text: 'Connected', style_class: 'ev-conn-txt' }));
        evFoot.add_child(connBox);

        const refreshBtn = new St.Button({ style_class: 'task-action-btn' });
        refreshBtn.set_child(createIconWidget('refresh', 14, 'rgba(26,29,26,0.6)'));
        refreshBtn.connect('clicked', () => {
            this._refreshEventsList();
            this._notifyToast('Calendar synced');
        });
        evFoot.add_child(refreshBtn);
        card.add_child(evFoot);

        this._refreshEventsList();
        return card;
    }

    _refreshEventsList() {
        this._eventsList.destroy_all_children();
        const events = this._store.data.events || [];

        if (events.length === 0) {
            this._eventsList.add_child(new St.Label({
                text: 'No events today.',
                style_class: 'empty-notice'
            }));
            return;
        }

        for (const ev of events) {
            const row = new St.BoxLayout({ vertical: false, style_class: ev.done ? 'ev-item done' : 'ev-item' });

            const infoBox = new St.BoxLayout({ vertical: true, x_expand: true, style_class: 'ev-info-box' });
            const titleLbl = new St.Label({ text: ev.title, style_class: 'ev-title' });
            applyStrikethrough(titleLbl, ev.title, ev.done);
            infoBox.add_child(titleLbl);
            infoBox.add_child(new St.Label({ text: `${ev.start} – ${ev.end}`, style_class: 'ev-time' }));
            row.add_child(infoBox);

            // Circular Checkbox on the RIGHT side of the event card
            const chk = createCircularCheckbox(ev.done, (btn, updateIcon) => {
                ev.done = !ev.done;
                btn.style_class = ev.done ? 'chk-circle on' : 'chk-circle';
                updateIcon(ev.done);
                applyStrikethrough(titleLbl, ev.title, ev.done);
                if (ev.done) {
                    row.add_style_class_name('done');
                } else {
                    row.remove_style_class_name('done');
                }
                this._store.update(d => {
                    const found = d.events.find(x => x.id === ev.id);
                    if (found) found.done = ev.done;
                });
            });
            row.add_child(chk);

            this._eventsList.add_child(row);
        }
    }

    _updateAll() {
        this._refreshTasksList();
        this._updateTimer();
        this._refreshEventsList();
    }

    destroy() {
        if (this._storeSub) this._storeSub();
        if (this._timerSub) this._timerSub();
        super.destroy();
    }
}
