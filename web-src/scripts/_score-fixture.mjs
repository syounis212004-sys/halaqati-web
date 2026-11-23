/* Loads the shared scoring function from src/core/runtime.js (a classic script) so module tests can use window.computeRecitationV7 like the app does. */
import fs from 'node:fs';
import vm from 'node:vm';
const core = fs.readFileSync(new URL('../src/core/runtime.js', import.meta.url), 'utf8');
const start = core.indexOf('function recitationLineCountV6'), end = core.indexOf('function computeRecitationV6', start);
const ctx = { Math, Number, Set, Array, String, console, window: {} };
vm.runInNewContext(core.slice(start, end) + '\nwindow.computeRecitationV7 = computeRecitationV7;', ctx);
globalThis.computeRecitationV7 = ctx.window.computeRecitationV7;
