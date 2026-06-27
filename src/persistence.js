// Voyage persistence — the browser localStorage I/O for the save. Every access is
// guarded: a private-mode / disabled / full localStorage must never crash the game —
// it just sails on without persistence. The save *schema* (shape, versioning,
// validation) lives in save.js so it unit-tests DOM-free; this module is only the
// thin storage wiring around it.
import { serialize, deserialize, SAVE_KEY } from './save.js';

export function createPersistence(state) {
  function load() {
    try { return deserialize(localStorage.getItem(SAVE_KEY)); } catch { return null; }
  }
  function write() {
    try { localStorage.setItem(SAVE_KEY, serialize(state)); } catch { /* storage unavailable — sail on */ }
  }
  function clear() {
    try { localStorage.removeItem(SAVE_KEY); } catch { /* ignore */ }
  }
  return { load, write, clear };
}
