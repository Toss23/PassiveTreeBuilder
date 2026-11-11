import { state, view } from './state.js';
import { dom } from './dom.js';

export function applyView() {
    const t = `translate(${view.x}px, ${view.y}px) scale(${view.k})`;
    dom.viewport.setAttribute(
        'transform',
        `translate(${view.x},${view.y}) scale(${view.k})`
    );
    if (dom.noteLayer) {
        dom.noteLayer.style.transformOrigin = '0 0';
        dom.noteLayer.style.transform = t;
    }
}

export function toWorld(clientX, clientY) {
    const r = dom.svg.getBoundingClientRect();
    return {
        x: ((clientX - r.left) - view.x) / view.k,
        y: ((clientY - r.top) - view.y) / view.k,
    };
}

export function fitView() {
    if (!state.nodes.length) return;

    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const n of state.nodes) {
        const r = (n.radius || 45) * (n.scale ?? 1);
        minX = Math.min(minX, n.x - r);
        maxX = Math.max(maxX, n.x + r);
        minY = Math.min(minY, n.y - r);
        maxY = Math.max(maxY, n.y + r);
    }
    for (const note of state.notes || []) {
        minX = Math.min(minX, note.x);
        maxX = Math.max(maxX, note.x + note.size);
        minY = Math.min(minY, note.y);
        maxY = Math.max(maxY, note.y + note.size);
    }

    const r = dom.svg.getBoundingClientRect();
    const pad = 100;
    const w = (maxX - minX) + pad * 2;
    const h = (maxY - minY) + pad * 2;
    const k = Math.max(0.15, Math.min(r.width / w, r.height / h, 1.4));
    view.k = k;
    view.x = r.width / 2 - ((minX + maxX) / 2) * k;
    view.y = r.height / 2 - ((minY + maxY) / 2) * k;
    applyView();
}