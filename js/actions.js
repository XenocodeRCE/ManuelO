// Actions sur les blocs (déplacer, masquer, supprimer, QCM)

import { state } from './state.js';
import { renderBlocks } from './render.js';
import { save } from './save.js';

export function moveBlock(index, dir) {
    const newIndex = index + dir;
    if (newIndex < 0 || newIndex >= state.blocks.length) return;
    [state.blocks[index], state.blocks[newIndex]] = [state.blocks[newIndex], state.blocks[index]];
    renderBlocks();
    save();
}

export function toggleVisibility(index) {
    state.blocks[index].visible = !state.blocks[index].visible;
    renderBlocks();
    save();
}

export function deleteBlock(index) {
    state.blocks.splice(index, 1);
    renderBlocks();
    save();
}

export function selectQcm(blockId, selected, correct) {
    const opts = document.querySelectorAll(`[id^="qcm-${blockId}-"]`);
    opts.forEach((el, i) => {
        el.classList.remove('selected-correct', 'selected-wrong');
        if (i === selected) {
            el.classList.add(i === correct ? 'selected-correct' : 'selected-wrong');
        }
    });
}
