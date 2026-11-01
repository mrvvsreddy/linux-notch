import GLib from 'gi://GLib';
import GObject from 'gi://GObject';

import { Store } from '../store.js';
import { TimerManager } from '../timer.js';
import { registerGClass } from '../gobject.js';
import { FONT_MAP } from '../dotMatrix.js';
import { parseTaskInput } from '../views/workspaceView.js';

let passed = 0;
let failed = 0;

function assert(desc, condition) {
    if (condition) {
        print(`  ✅ ${desc}`);
        passed++;
    } else {
        printerr(`  ❌ FAIL: ${desc}`);
        failed++;
    }
}

print('========================================================');
print('Running NotchOwl Integration & Feature Test Suite');
print('========================================================\n');

// 1. Store Test
print('[1/5] Testing Store State & Persistence...');
const store = new Store();
assert('Store initializes with valid data schema', Boolean(store.data && store.data.tasks && store.data.settings));
assert('Default tasks list has items', store.data.tasks.length >= 3);

const initialCount = store.data.tasks.length;
store.update(d => {
    d.tasks.push({
        id: 'test-1',
        title: 'Test task',
        completed: false,
        priority: 'High',
        tag: 'Work',
        minutes: 25,
        created: Date.now()
    });
});
assert('Store reactive update adds task', store.data.tasks.length === initialCount + 1);

store.update(d => {
    d.notes = 'Automated test note entry';
});
assert('Notepad content updates reactively', store.data.notes === 'Automated test note entry');

// 2. TimerManager Test
print('\n[2/5] Testing Focus Timer Engine...');
const timer = new TimerManager(store);
assert('Timer starts idle with default 25:00', timer.idle && timer.label() === '25:00');

timer.start();
assert('Timer starts running', timer.running && !timer.idle);

timer.fastForward();
assert('Fast-forward leaves 5 seconds remaining', timer.label() === '00:05');

timer.pause();
assert('Timer pauses correctly', !timer.running);

timer.reset();
assert('Timer resets back to 25:00 and idle state', timer.idle && timer.label() === '25:00');

// 3. Quick-Add NLP Parser Test
print('\n[3/5] Testing Task Quick-Add Parser (!priority @tag mins time)...');
const parsed = parseTaskInput('Ship landing page !high @work 45m 4:30pm');
assert('Parses title correctly', parsed.title === 'Ship landing page');
assert('Parses priority !high -> High', parsed.priority === 'High');
assert('Parses tag @work -> Work', parsed.tag === 'Work');
assert('Parses duration 45m -> 45', parsed.minutes === 45);
assert('Parses reminder time 4:30pm -> 16:30', parsed.remind === '16:30');

// 4. DotMatrix Font Map Test
print('\n[4/5] Testing DotMatrix Font Map Glyphs...');
const requiredGlyphs = ['0','1','2','3','4','5','6','7','8','9',':','D','O','N','E'];
let glyphsOk = true;
for (const g of requiredGlyphs) {
    if (!FONT_MAP[g] || FONT_MAP[g].length !== 7) glyphsOk = false;
}
assert('All digits, colon, and DONE glyphs exist and have 7 vertical dots', glyphsOk);

// 5. Safe GType Dynamic Registration (Multi-Reload Simulation)
print('\n[5/5] Testing Safe GType Reload Isolation (registerGClass)...');
let col1, col2, col3;
class TestReloadWidgetA extends GObject.Object {
    static { col1 = registerGClass(this); }
}
class TestReloadWidgetB extends GObject.Object {
    static { col2 = registerGClass(this); }
}
class TestReloadWidgetC extends GObject.Object {
    static { col3 = registerGClass(this); }
}

assert('Multiple re-evaluations generate distinct GType names',
    col1.$gtype.name !== col2.$gtype.name && col2.$gtype.name !== col3.$gtype.name);
assert('GType names start with LNotch prefix', col1.$gtype.name.startsWith('LNotch_'));

print('\n========================================================');
print(`Test Results: ${passed} passed, ${failed} failed.`);
print('========================================================');

if (failed > 0) {
    throw new Error('Test suite failed');
}
