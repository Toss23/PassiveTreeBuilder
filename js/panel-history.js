import { dom } from './dom.js';
import { canUndo, canRedo } from './history.js';

export function updateHistoryButtons() {
  dom.btnUndo.disabled = !canUndo();
  dom.btnRedo.disabled = !canRedo();
}