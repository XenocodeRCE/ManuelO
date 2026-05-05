// Sauvegarde automatique du manuel via l'API PHP

import { state } from './state.js';

const SAVE_URL = 'api/save.php';
let _debounceTimer = null;
let _saveIndicator = null;

function getIndicator() {
    if (!_saveIndicator) _saveIndicator = document.getElementById('save-indicator');
    return _saveIndicator;
}

function setStatus(status) {
    const el = getIndicator();
    if (!el) return;
    el.className = 'save-indicator ' + status;
    const labels = { saving: '⏳ Enregistrement…', saved: '✓ Enregistré', error: '⚠️ Erreur' };
    el.textContent = labels[status] || '';
}

export async function saveNow() {
    if (!state.meta.id) return;

    state.meta.updatedAt = Math.floor(Date.now() / 1000);
    setStatus('saving');

    try {
        const res = await fetch(SAVE_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id: state.meta.id, data: { meta: state.meta, blocks: state.blocks } })
        });

        const json = await res.json();
        if (!res.ok || !json.ok) throw new Error(json.error || 'Save failed');

        setStatus('saved');
        // Effacer l'indicateur après 3s
        setTimeout(() => {
            const el = getIndicator();
            if (el && el.classList.contains('saved')) el.className = 'save-indicator';
        }, 3000);
    } catch (err) {
        console.error('[save]', err);
        setStatus('error');
    }
}

// Version avec debounce 1s — à appeler après chaque mutation
export function save() {
    clearTimeout(_debounceTimer);
    _debounceTimer = setTimeout(saveNow, 1000);
}
