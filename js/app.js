// Point d'entrée de l'application ManuelO
// Orchestre les modules, expose les fonctions globales, initialise l'app

import { state } from './state.js';
import { renderBlocks, renderSidebar, getPages } from './render.js';
import { moveBlock, toggleVisibility, deleteBlock, selectQcm } from './actions.js';
import { openModal, closeModal, submitBlock } from './modal.js';
import { save, saveNow } from './save.js';
import { toggleVocabTooltip } from './markdown.js';
import { enterPresentation, exitPresentation, presGo } from './presentation.js';

// ===== CATALOGUE DES BLOCS (pour la modale d'insertion) =====
const BLOCKS_CATALOG = [
    {
        id: 'content', label: 'Texte & contenu', icon: '📄',
        blocks: [
            { type: 'section-title',  icon: '📌', label: 'Titre de section',    desc: 'Titre numéroté de partie',             color: '#ede9fe', tc: '#7c3aed' },
            { type: 'text-intro',     icon: '📄', label: 'Texte',               desc: 'Paragraphe ou introduction',           color: '#f0fdf4', tc: '#16a34a' },
            { type: 'source-text',    icon: '📜', label: 'Texte source',         desc: 'Extrait avec auteur et référence',     color: '#fef3c7', tc: '#b45309' },
            { type: 'citation',       icon: '💬', label: 'Citation',             desc: "Parole d'auteur avec source",          color: '#f0f9ff', tc: '#0284c7' },
            { type: 'image',          icon: '🖼️', label: 'Image',               desc: 'Image avec légende',                   color: '#fff7ed', tc: '#ea580c' },
            { type: 'table',          icon: '📊', label: 'Tableau',              desc: 'Tableau de données structurées',       color: '#f0fdf4', tc: '#15803d' },
            { type: 'link',           icon: '🔗', label: 'Lien / QR Code',       desc: 'Vers une ressource externe',           color: '#f0f9ff', tc: '#0369a1' },
            { type: 'media',          icon: '🎬', label: 'Vidéo / Audio',        desc: 'Ressource multimédia',                 color: '#fdf4ff', tc: '#9333ea' },
            { type: 'diagram',        icon: '📐', label: 'Schéma / Diagramme',   desc: 'Diagramme Mermaid ou légende',         color: '#ecfdf5', tc: '#0f766e' },
            { type: 'timeline',       icon: '🗺️', label: 'Frise chronologique', desc: 'Événements dans le temps',             color: '#fff7ed', tc: '#c2410c' },
        ]
    },
    {
        id: 'pedagogy', label: 'Pédagogie', icon: '🎓',
        blocks: [
            { type: 'objectives',  icon: '🎯', label: 'Objectifs',           desc: "Ce que l'élève saura faire",            color: '#ecfdf5', tc: '#059669' },
            { type: 'summary',     icon: '✅', label: 'À retenir',           desc: 'Encadré de synthèse clé',               color: '#f0fdf4', tc: '#15803d' },
            { type: 'method',      icon: '💡', label: 'Méthode',             desc: 'Étapes à suivre',                       color: '#fffbeb', tc: '#b45309' },
            { type: 'warning',     icon: '⚠️', label: 'Attention / Piège',  desc: 'Erreurs fréquentes à éviter',           color: '#fff1f2', tc: '#be123c' },
            { type: 'recall',      icon: '🧠', label: 'Rappel / Prérequis', desc: "Ce qu'il faut déjà savoir",             color: '#eff6ff', tc: '#1d4ed8' },
            { type: 'biography',   icon: '👤', label: 'Biographie',         desc: 'Auteur ou personnage historique',        color: '#f5f3ff', tc: '#6d28d9' },
            { type: 'example',     icon: '💬', label: 'Exemple',            desc: "Illustration d'une notion",             color: '#ecfeff', tc: '#0e7490' },
            { type: 'definition',  icon: '📖', label: 'Définition',         desc: 'Terme et sa définition',                color: '#ecfdf5', tc: '#059669' },
            { type: 'distinction', icon: '⚖️', label: 'Distinction',        desc: 'Comparaison de deux concepts',          color: '#f5f3ff', tc: '#7c3aed' },
            { type: 'questions',   icon: '❓', label: 'Questions',          desc: 'Liste de questions guidées',             color: '#fff1f2', tc: '#e11d48' },
        ]
    },
    {
        id: 'exercises', label: 'Exercices', icon: '✏️',
        blocks: [
            { type: 'exercise-qcm',       icon: '☑️', label: 'QCM',                 desc: 'Questionnaire à choix multiple',   color: '#fffbeb', tc: '#d97706' },
            { type: 'exercise-written',   icon: '✍️', label: 'Réponse rédigée',      desc: 'Zone de rédaction libre',          color: '#eef2ff', tc: '#4f46e5' },
            { type: 'exercise-fill',      icon: '📝', label: 'Texte à trous',        desc: 'Compléter des espaces vides',      color: '#ecfeff', tc: '#0891b2' },
            { type: 'exercise-truefalse', icon: '✔️', label: 'Vrai / Faux',          desc: 'Affirmations à valider',           color: '#f0fdf4', tc: '#16a34a' },
            { type: 'exercise-match',     icon: '🔀', label: 'Association / Relier', desc: 'Relier deux colonnes',             color: '#fdf4ff', tc: '#9333ea' },
            { type: 'exercise-table',     icon: '📊', label: 'Tableau à compléter',  desc: 'Grille avec cases à remplir',      color: '#eff6ff', tc: '#1d4ed8' },
            { type: 'exercise-document',  icon: '📂', label: 'Étude de document',    desc: 'Document + questions guidées',     color: '#fff7ed', tc: '#c2410c' },
            { type: 'exercise-sort',      icon: '🔢', label: 'Classement',           desc: "Remettre dans l'ordre",            color: '#fdf4ff', tc: '#7c3aed' },
        ]
    },
    {
        id: 'activities', label: 'Activités', icon: '👥',
        blocks: [
            { type: 'activity-group',       icon: '👥', label: 'Travail de groupe', desc: "Consigne d'activité collaborative", color: '#ecfdf5', tc: '#059669' },
            { type: 'activity-oral',        icon: '🎭', label: 'Activité orale',    desc: 'Débat, exposé, jeu de rôle',        color: '#fff7ed', tc: '#c2410c' },
            { type: 'activity-instruction', icon: '📋', label: 'Consigne',          desc: "Instructions d'activité",           color: '#f0f9ff', tc: '#0369a1' },
            { type: 'differentiation',      icon: '⭐', label: 'Différenciation',   desc: 'Variantes selon le niveau',         color: '#fffbeb', tc: '#b45309' },
        ]
    },
    {
        id: 'structure', label: 'Structure', icon: '📖',
        blocks: [
            { type: '__page-break__', icon: '📖', label: 'Nouvelle page', desc: 'Ajouter une nouvelle page au manuel', color: '#eef2ff', tc: '#4f46e5', action: 'insertModalAddPage' },
        ]
    }
];

// Active category id for insert modal
let _insertActiveCat = BLOCKS_CATALOG[0].id;

// ===== UTILITAIRE UUID =====
function generateId() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
        const r = Math.random() * 16 | 0;
        return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
    });
}

// ===== REFRESH (renderBlocks + sommaire synchronisé) =====
function refresh() {
    renderBlocks();
    renderSidebarSommaire();
}

// ===== MODE =====
function setMode(m) {
    state.mode = m;
    document.getElementById('btn-prof').classList.toggle('active', m === 'prof');
    document.getElementById('btn-eleve').classList.toggle('active', m === 'eleve');
    document.getElementById('edit-info').style.display = m === 'prof' ? 'block' : 'none';
    document.getElementById('edit-banner').style.display = m === 'prof' ? 'flex' : 'none';
    const fab = document.getElementById('fab-zone');
    if (fab) fab.style.display = m === 'prof' ? 'flex' : 'none';
    refresh();
    initSortable();
}

// ===== EDITION D'UN BLOC EXISTANT =====
function editBlock(index) {
    const block = state.blocks[index];
    state.editingIndex = index;

    // Sérialiser les champs complexes en texte pour le formulaire
    const values = { ...block };
    if (Array.isArray(block.questions)) values.questions = block.questions.join('\n');
    if (Array.isArray(block.options))   values.options   = block.options.join('\n');
    if (Array.isArray(block.blanks))    values.blanks    = block.blanks.map(b => [b.correct, ...b.distractors].join('|')).join('\n');

    openModal(block.type, values);
}

// ===== PAGES =====
function updatePageIndicator() {
    // handled inside renderBlocks()
}

function navigatePage(dir) {
    const total = getPages().length;
    state.currentPage = Math.max(1, Math.min(total, (state.currentPage || 1) + dir));
    refresh();
    document.getElementById('content-area').scrollTo({ top: 0, behavior: 'instant' });
}

function addPageBreak() {
    // Always appends at the very end of the manual
    state.blocks.push({ type: 'page-break', id: ++state.idCounter, visible: true, title: '', subtitle: '' });
    state.currentPage = getPages().length; // navigate to the new page
    refresh();
    save();
}

function insertPageBreakAtIndex() {
    // Used by insert modal — inserts at state.insertIndex
    const idx = typeof state.insertIndex === 'number' ? state.insertIndex + 1 : state.blocks.length;
    state.blocks.splice(idx, 0, { type: 'page-break', id: ++state.idCounter, visible: true, title: '', subtitle: '' });
    const newPageNum = state.blocks.slice(0, idx + 1).filter(b => b.type === 'page-break').length + 1;
    state.currentPage = newPageNum;
    refresh();
    save();
}

function deleteCurrentPage() {
    const cp = state.currentPage || 1;
    if (cp === 1) {
        // Can't delete page 1 — just clear its blocks
        if (!confirm('Supprimer tous les blocs de la page 1 ?')) return;
        const firstPB = state.blocks.findIndex(b => b.type === 'page-break');
        const end = firstPB === -1 ? state.blocks.length : firstPB;
        state.blocks.splice(0, end);
    } else {
        // Find the page-break that starts this page and remove it + its blocks
        const pbCount = cp - 1;
        let found = 0;
        let pbIdx = -1;
        for (let i = 0; i < state.blocks.length; i++) {
            if (state.blocks[i].type === 'page-break') {
                found++;
                if (found === pbCount) { pbIdx = i; break; }
            }
        }
        if (pbIdx === -1) return;
        // Find end of this page (next page-break or end)
        let endIdx = state.blocks.length;
        for (let i = pbIdx + 1; i < state.blocks.length; i++) {
            if (state.blocks[i].type === 'page-break') { endIdx = i; break; }
        }
        if (!confirm(`Supprimer la page ${cp} et ses ${endIdx - pbIdx - 1} bloc(s) ?`)) return;
        state.blocks.splice(pbIdx, endIdx - pbIdx);
        state.currentPage = Math.max(1, cp - 1);
    }
    refresh();
    save();
}

// ===== INSERT MODAL (remplace context menu) =====
function _renderInsertCats() {
    const nav = document.getElementById('insert-cats');
    if (!nav) return;
    nav.innerHTML = BLOCKS_CATALOG.map(cat => `
        <button class="insert-cat-btn${cat.id === _insertActiveCat ? ' active' : ''}"
                onclick="window._insertSelectCat('${cat.id}')">
            <span>${cat.icon}</span>
            <span>${cat.label}</span>
        </button>
    `).join('<div class="insert-cats-divider" style="display:none"></div>');
}

function _renderInsertItems(catId) {
    const panel = document.getElementById('insert-items-panel');
    if (!panel) return;
    const cat = BLOCKS_CATALOG.find(c => c.id === catId);
    if (!cat) return;
    panel.innerHTML = cat.blocks.map(b => `
        <button class="insert-block-item" onclick="${b.action ? b.action + '()' : "insertModalOpenBlock('" + b.type + "')"}">
            <span class="insert-block-icon" style="background:${b.color};color:${b.tc}">${b.icon}</span>
            <span class="insert-block-info">
                <span class="insert-block-name">${b.label}</span>
                <span class="insert-block-desc">${b.desc}</span>
            </span>
        </button>
    `).join('');
}

function filterInsertBlocks(query) {
    const panel = document.getElementById('insert-items-panel');
    if (!panel) return;
    const q = query.trim().toLowerCase();
    if (!q) {
        _renderInsertItems(_insertActiveCat);
        return;
    }
    const results = [];
    BLOCKS_CATALOG.forEach(cat => {
        cat.blocks.forEach(b => {
            if (b.label.toLowerCase().includes(q) || b.desc.toLowerCase().includes(q)) {
                results.push({ ...b, catLabel: cat.label });
            }
        });
    });
    if (!results.length) {
        panel.innerHTML = `<div class="insert-no-results">Aucun résultat pour « ${query} »</div>`;
        return;
    }
    panel.innerHTML = results.map(b => `
        <button class="insert-block-item" onclick="${b.action ? b.action + '()' : "insertModalOpenBlock('" + b.type + "')"}">
            <span class="insert-block-icon" style="background:${b.color};color:${b.tc}">${b.icon}</span>
            <span class="insert-block-info">
                <span class="insert-block-name">${b.label}</span>
                <span class="insert-block-desc">${b.desc} · ${b.catLabel}</span>
            </span>
        </button>
    `).join('');
}

window._insertSelectCat = function(catId) {
    _insertActiveCat = catId;
    _renderInsertCats();
    _renderInsertItems(catId);
};

function showInsertModal() {
    _renderInsertCats();
    _renderInsertItems(_insertActiveCat);
    const searchEl = document.getElementById('insert-search');
    if (searchEl) searchEl.value = '';
    document.getElementById('insert-modal-overlay').classList.add('show');
}

function closeInsertModal(e) {
    if (!e || e.target === document.getElementById('insert-modal-overlay')) {
        document.getElementById('insert-modal-overlay').classList.remove('show');
    }
}

function insertModalOpenBlock(type) {
    closeInsertModal();
    openModal(type);
}

function insertModalAddPage() {
    closeInsertModal();
    insertPageBreakAtIndex();
}

// ===== INSERTION VIA BOUTON + =====
function insertAt(index, btn) {
    event.stopPropagation();
    state.insertIndex = index;
    showInsertModal();
}

// ===== CONTEXT MENU (clic droit) =====
function showContextMenu(e) {
    if (state.mode !== 'prof') return;
    e.preventDefault();
    const wrappers = document.querySelectorAll('.block-wrapper');
    state.insertIndex = state.blocks.length - 1;
    wrappers.forEach(w => {
        const rect = w.getBoundingClientRect();
        if (e.clientY > rect.top + rect.height / 2) {
            state.insertIndex = parseInt(w.dataset.index);
        }
    });
    showInsertModal();
}

// ===== SOMMAIRE INLINE =====
function renderSidebarSommaire() {
    const list = document.getElementById('sidebar-sommaire-list');
    if (!list) return;
    const pages = getPages();
    list.innerHTML = '';
    pages.forEach(page => {
        const item = document.createElement('div');
        item.className = 'sidebar-sommaire-item' + (page.num === (state.currentPage || 1) ? ' active' : '');
        item.innerHTML = `
            <span class="sidebar-sommaire-num">${page.num}</span>
            <span class="sidebar-sommaire-title${page.title ? '' : ' no-title'}">${page.title || `Page ${page.num}`}</span>`;
        item.addEventListener('click', () => {
            state.currentPage = page.num;
            refresh();
            document.getElementById('content-area').scrollTo({ top: 0, behavior: 'instant' });
        });
        list.appendChild(item);
    });
}

function closeSommaire() {} // conservé pour compatibilité Escape

// ===== EDITION TITRE DE PAGE (inline) =====
function startEditPageTitle(pbIndex, field) {
    if (state.mode !== 'prof') return;
    const header = document.querySelector('.page-current-header');
    if (!header) return;
    const isTitle = field === 'title';
    const wrap = header.querySelector(isTitle ? '.pch-title-wrap' : '.pch-subtitle-wrap');
    if (!wrap) return;
    let current;
    if (pbIndex === -1) {
        // Page 1 — titre/sous-titre indépendants du titre du manuel
        current = isTitle ? (state.meta.page1Title || '') : (state.meta.page1Subtitle || '');
    } else {
        current = state.blocks[pbIndex][field] || '';
    }
    const escaped = current.replace(/"/g, '&quot;');
    wrap.innerHTML = `<input class="page-break-inline-input${isTitle ? '' : ' small'}" value="${escaped}" placeholder="${isTitle ? 'Titre de la page…' : 'Sous-titre…'}" />`;
    const input = wrap.querySelector('input');
    input.focus(); input.select();
    const saveVal = (val) => {
        if (pbIndex === -1) {
            if (isTitle) state.meta.page1Title    = val.trim();
            else         state.meta.page1Subtitle = val.trim();
        } else {
            state.blocks[pbIndex][field] = val.trim();
        }
        refresh();
        save();
    };
    input.addEventListener('blur', () => saveVal(input.value));
    input.addEventListener('keydown', e => {
        if (e.key === 'Enter') { e.preventDefault(); input.blur(); }
        if (e.key === 'Escape') { refresh(); }
    });
    input.addEventListener('click', e => e.stopPropagation());
}
let sortableInstance = null;

function initSortable() {
    if (sortableInstance) { sortableInstance.destroy(); sortableInstance = null; }
    if (state.mode !== 'prof') return;

    sortableInstance = Sortable.create(document.getElementById('content-inner'), {
        animation: 150,
        handle: '.block-wrapper',
        draggable: '.block-wrapper',
        filter: '.block-insert-zone, .page-current-header',
        ghostClass: 'sortable-ghost',
        chosenClass: 'sortable-chosen',
        onEnd() {
            const wrappers = [...document.querySelectorAll('#content-inner > .block-wrapper')];
            if (!wrappers.length) return;
            // Find current page range
            const cp = state.currentPage || 1;
            const pbIndices = state.blocks
                .map((b, i) => b.type === 'page-break' ? i : -1)
                .filter(i => i >= 0);
            const startIdx = cp === 1 ? 0 : pbIndices[cp - 2] + 1;
            const endIdx   = cp > pbIndices.length ? state.blocks.length : pbIndices[cp - 1];
            const newPageBlocks = wrappers
                .map(w => state.blocks[parseInt(w.dataset.index)])
                .filter(Boolean);
            if (newPageBlocks.length === endIdx - startIdx) {
                state.blocks.splice(startIdx, endIdx - startIdx, ...newPageBlocks);
                refresh();
                save();
            }
        }
    });
}

// ===== EXPOSITION GLOBALE (pour les handlers onclick inline) =====
window.setMode = setMode;
window.showContextMenu = showContextMenu;
window.insertAt = insertAt;
window.editBlock = editBlock;
window.moveBlock = moveBlock;
window.toggleVisibility = toggleVisibility;
window.deleteBlock = deleteBlock;
window.selectQcm = selectQcm;
window.openModal = openModal;
window.closeModal = closeModal;
window.submitBlock = submitBlock;
window.navigatePage = navigatePage;
window.addPageBreak = addPageBreak;
window.deleteCurrentPage = deleteCurrentPage;
window.insertPageBreakAtIndex = insertPageBreakAtIndex;
window.closeSommaire = closeSommaire;
window.closeInsertModal = closeInsertModal;
window.insertModalOpenBlock = insertModalOpenBlock;
window.insertModalAddPage = insertModalAddPage;
window.filterInsertBlocks = filterInsertBlocks;
window.startEditPageTitle = startEditPageTitle;

// ===== INLINE RENAME — EXERCICE =====
function startEditExerciseTitle(blockId, defaultLabel) {
    if (state.mode !== 'prof') return;
    const label = document.querySelector(`.exercise-label[data-block-id="${blockId}"]`);
    if (!label) return;
    const block = state.blocks.find(b => b.id === blockId);
    if (!block) return;
    const current = block.title || '';
    const color = label.style.color;
    label.innerHTML = `<input class="exo-title-input" value="${current.replace(/"/g, '&quot;')}" placeholder="${defaultLabel.replace(/"/g, '&quot;')}" />`;
    label.classList.add('editing');
    const input = label.querySelector('input');
    input.focus(); input.select();
    const saveVal = () => {
        block.title = input.value.trim();
        refresh();
        save();
    };
    input.addEventListener('blur', saveVal);
    input.addEventListener('keydown', e => {
        if (e.key === 'Enter') { e.preventDefault(); input.blur(); }
        if (e.key === 'Escape') { block.title = current; refresh(); }
    });
    input.addEventListener('click', e => e.stopPropagation());
}
window.startEditExerciseTitle = startEditExerciseTitle;

// ===== TOGGLE SIDEBARS =====
function toggleSidebarLeft() {
    const el = document.querySelector('.sidebar-left');
    const btn = document.getElementById('btn-toggle-left');
    el.classList.toggle('collapsed');
    btn.classList.toggle('active', el.classList.contains('collapsed'));
}

function toggleSommaireOnMobile() {
    const sidebar = document.querySelector('.sidebar-left');
    const btn = document.getElementById('btn-sommaire-mobile');
    sidebar.classList.toggle('mobile-open');
    btn.classList.toggle('active', sidebar.classList.contains('mobile-open'));
}

window.toggleSidebarLeft = toggleSidebarLeft;
window.toggleSommaireOnMobile = toggleSommaireOnMobile;

// ===== DARK MODE =====
function toggleDarkMode() {
    const isDark = document.documentElement.dataset.theme === 'dark';
    const next   = isDark ? 'light' : 'dark';
    document.documentElement.dataset.theme = next;
    document.getElementById('dark-toggle-icon').textContent = next === 'dark' ? '☀️' : '🌙';
    localStorage.setItem('theme', next);
}

(function applyInitialTheme() {
    const saved = localStorage.getItem('theme');
    if (saved === 'dark') {
        document.documentElement.dataset.theme = 'dark';
        const icon = document.getElementById('dark-toggle-icon');
        if (icon) icon.textContent = '☀️';
    }
})();

window.toggleDarkMode = toggleDarkMode;

// ===== EXERCICE — RÉVÉLER LA CORRECTION =====
function revealCorrection(btn) {
    const exo = btn.closest('.exo-correction');
    showConfirmReveal(() => exo.classList.add('revealed'));
}

function showConfirmReveal(onConfirm) {
    const overlay = document.getElementById('confirm-overlay');
    overlay.classList.add('active');
    const okBtn     = document.getElementById('confirm-ok-btn');
    const cancelBtn = document.getElementById('confirm-cancel-btn');
    function cleanup() {
        overlay.classList.remove('active');
        okBtn.removeEventListener('click', onOk);
        cancelBtn.removeEventListener('click', onCancel);
        overlay.removeEventListener('click', onOutside);
    }
    function onOk()      { cleanup(); onConfirm(); }
    function onCancel()  { cleanup(); }
    function onOutside(e){ if (e.target === overlay) cleanup(); }
    okBtn.addEventListener('click', onOk);
    cancelBtn.addEventListener('click', onCancel);
    overlay.addEventListener('click', onOutside);
}

// ===== TOAST (remplace alert() pour ne pas quitter le plein écran) =====
function showToast(msg, type = 'info') {
    let container = document.getElementById('toast-container');
    if (!container) {
        container = document.createElement('div');
        container.id = 'toast-container';
        document.body.appendChild(container);
    }
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.textContent = msg;
    container.appendChild(toast);
    // Force reflow for animation
    void toast.offsetWidth;
    toast.classList.add('toast-show');
    setTimeout(() => {
        toast.classList.remove('toast-show');
        toast.addEventListener('transitionend', () => toast.remove(), { once: true });
    }, 3000);
}

// ===== EXERCICE — VÉRIFIER VRAI / FAUX =====
function checkTrueFalse(btn) {
    const container = btn.closest('.block-exercise-truefalse');
    const items = container.querySelectorAll('.tf-item');
    let correct = 0, total = 0, unanswered = 0;
    items.forEach(item => {
        const correctSpan = item.querySelector('.tf-answer');
        if (!correctSpan) return; // pas de correction définie pour cet item
        total++;
        const correctAnswer = correctSpan.classList.contains('tf-v') ? 'V' : 'F';
        const vBtn = item.querySelector('.tf-btn:first-child');
        const fBtn = item.querySelector('.tf-btn:last-child');
        const selectedV = vBtn.classList.contains('selected');
        const selectedF = fBtn.classList.contains('selected');
        // Reset previous feedback
        vBtn.classList.remove('tf-correct', 'tf-wrong');
        fBtn.classList.remove('tf-correct', 'tf-wrong');
        if (!selectedV && !selectedF) { unanswered++; return; }
        const chosen = selectedV ? 'V' : 'F';
        if (chosen === correctAnswer) {
            correct++;
            (selectedV ? vBtn : fBtn).classList.add('tf-correct');
        } else {
            (selectedV ? vBtn : fBtn).classList.add('tf-wrong');
        }
    });
    if (unanswered > 0) {
        showToast(`Répondez à toutes les affirmations (${unanswered} sans réponse).`, 'warn');
        return;
    }
    if (correct === total) {
        showToast('✅ Bravo ! Toutes les réponses sont correctes.', 'success');
    } else {
        showToast(`${correct} / ${total} correctes. Les erreurs sont en rouge.`, 'error');
    }
}

// ===== EXERCICE — VÉRIFIER TEXTE À TROUS =====
function checkFill(btn) {
    const container = btn.closest('.block-exercise-fill');
    const selects = container.querySelectorAll('.fill-text select');
    let correct = 0, total = selects.length, unanswered = 0;
    selects.forEach(sel => {
        const expected = sel.dataset.correct;
        sel.classList.remove('fill-correct', 'fill-wrong');
        if (!sel.value) { unanswered++; return; }
        if (sel.value === expected) { sel.classList.add('fill-correct'); correct++; }
        else sel.classList.add('fill-wrong');
    });
    if (unanswered > 0) {
        showToast(`Complétez tous les trous avant de vérifier (${unanswered} non rempli${unanswered > 1 ? 's' : ''}).`, 'warn');
        return;
    }
    if (correct === total) {
        showToast('✅ Bravo ! Toutes les réponses sont correctes.', 'success');
    } else {
        showToast(`${correct} / ${total} correctes. Les réponses incorrectes sont surlignées en rouge.`, 'error');
    }
}

function checkSort(btn) {
    const container = btn.closest('.block-exercise-sort');
    const correct = JSON.parse(decodeURIComponent(container.dataset.correct));
    const current = Array.from(container.querySelectorAll('.sort-list .sort-item'))
        .map(el => el.dataset.value);
    if (correct.every((v, i) => v === current[i])) {
        showToast('✅ Bravo ! L\'ordre est correct.', 'success');
    } else {
        showToast('❌ Ce n\'est pas le bon ordre. Réessayez ou regardez la correction.', 'error');
    }
}

function checkMatch(btn) {
    const container = btn.closest('.block-exercise-match');
    const selects = container.querySelectorAll('.match-select');
    let correct = 0, total = selects.length, unanswered = 0;
    selects.forEach(sel => {
        sel.classList.remove('fill-correct', 'fill-wrong');
        if (!sel.value) { unanswered++; return; }
        if (sel.value === sel.dataset.correct) { sel.classList.add('fill-correct'); correct++; }
        else sel.classList.add('fill-wrong');
    });
    if (unanswered > 0) {
        showToast(`Complétez toutes les associations avant de vérifier (${unanswered} non remplie${unanswered > 1 ? 's' : ''}).`, 'warn');
        return;
    }
    if (correct === total) {
        showToast('✅ Bravo ! Toutes les associations sont correctes.', 'success');
    } else {
        showToast(`${correct} / ${total} correctes. Les erreurs sont surlignées en rouge.`, 'error');
    }
}

// ===== DIAGRAMME — BASCULER CODE ↔ RENDU =====
function toggleDiagramView(btn) {
    const container = btn.closest('.block-diagram');
    const render = container.querySelector('.diagram-render');
    const code   = container.querySelector('.diagram-code');
    const showingRender = render && render.style.display !== 'none';
    if (render) render.style.display = showingRender ? 'none' : 'block';
    if (code)   code.style.display   = showingRender ? 'block' : 'none';
    btn.textContent = showingRender ? 'Voir le diagramme' : 'Voir le code';
}

window.revealCorrection   = revealCorrection;
window.checkTrueFalse     = checkTrueFalse;
window.checkFill          = checkFill;
window.checkSort          = checkSort;
window.checkMatch         = checkMatch;
window.toggleDiagramView  = toggleDiagramView;

// ===== TIMER =====
let _timerTotal     = 0;
let _timerRemaining = 0;
let _timerInterval  = null;
let _timerRunning   = false;

function parseDuration(str) {
    str = str.replace(/⏱\s*/g, '').trim().toLowerCase();
    const hm = str.match(/(\d+)\s*h(?:eures?)?\s*(\d+)?(?:\s*min(?:utes?)?)?/);
    if (hm) return parseInt(hm[1]) * 3600 + parseInt(hm[2] || 0) * 60;
    const m = str.match(/(\d+)\s*(?:min(?:utes?)?|mn)/);
    if (m) return parseInt(m[1]) * 60;
    const n = parseInt(str);
    return (!isNaN(n) && n > 0) ? n * 60 : 0;
}

function openTimer(badge) {
    const secs = parseDuration(badge.textContent);
    if (!secs) return;
    clearInterval(_timerInterval);
    _timerInterval = null;
    _timerRunning  = false;
    _timerTotal    = secs;
    _timerRemaining = secs;
    const labelEl = badge.closest('.callout-header')?.querySelector('.callout-label');
    document.getElementById('timer-label').textContent = labelEl ? labelEl.textContent.trim() : 'Minuteur';
    document.getElementById('timer-main-btn').textContent = '▶';
    document.getElementById('timer-display').classList.remove('timer-done');
    document.getElementById('timer-ring-prog').classList.remove('timer-done');
    _updateTimerDisplay();
    document.getElementById('timer-overlay').classList.add('active');
}

function closeTimer() {
    clearInterval(_timerInterval);
    _timerInterval = null;
    _timerRunning  = false;
    document.getElementById('timer-overlay').classList.remove('active');
}

function closeTimerOnOverlay(e) {
    if (e.target === document.getElementById('timer-overlay')) closeTimer();
}

function toggleTimer() {
    if (_timerRunning) {
        clearInterval(_timerInterval);
        _timerInterval = null;
        _timerRunning  = false;
        document.getElementById('timer-main-btn').textContent = '▶';
    } else {
        if (_timerRemaining <= 0) return;
        _timerRunning = true;
        document.getElementById('timer-main-btn').textContent = '⏸';
        _timerInterval = setInterval(() => {
            _timerRemaining--;
            _updateTimerDisplay();
            if (_timerRemaining <= 0) {
                clearInterval(_timerInterval);
                _timerRunning = false;
                document.getElementById('timer-main-btn').textContent = '▶';
                document.getElementById('timer-display').classList.add('timer-done');
                document.getElementById('timer-ring-prog').classList.add('timer-done');
                try {
                    const ctx = new AudioContext();
                    [0, 0.35, 0.7].forEach(t => {
                        const o = ctx.createOscillator();
                        const g = ctx.createGain();
                        o.connect(g); g.connect(ctx.destination);
                        o.frequency.value = 880;
                        g.gain.setValueAtTime(0.4, ctx.currentTime + t);
                        g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + t + 0.25);
                        o.start(ctx.currentTime + t);
                        o.stop(ctx.currentTime + t + 0.25);
                    });
                } catch(err) {}
            }
        }, 1000);
    }
}

function resetTimer() {
    clearInterval(_timerInterval);
    _timerInterval = null;
    _timerRunning  = false;
    _timerRemaining = _timerTotal;
    document.getElementById('timer-main-btn').textContent = '▶';
    document.getElementById('timer-display').classList.remove('timer-done');
    document.getElementById('timer-ring-prog').classList.remove('timer-done');
    _updateTimerDisplay();
}

function _updateTimerDisplay() {
    const h = Math.floor(_timerRemaining / 3600);
    const m = Math.floor((_timerRemaining % 3600) / 60);
    const s = _timerRemaining % 60;
    document.getElementById('timer-display').textContent = h > 0
        ? `${h}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`
        : `${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
    const circ = 2 * Math.PI * 54;
    const ratio = _timerTotal > 0 ? _timerRemaining / _timerTotal : 1;
    document.getElementById('timer-ring-prog').style.strokeDashoffset = circ * (1 - ratio);
}

window.openTimer         = openTimer;
window.closeTimer        = closeTimer;
window.closeTimerOnOverlay = closeTimerOnOverlay;
window.toggleTimer       = toggleTimer;
window.resetTimer        = resetTimer;

// ===== MARKDOWN INLINE — helpers globaux =====
window.toggleVocabTooltip = toggleVocabTooltip;

// ===== MODE PRÉSENTATION — globals =====
window.enterPresentation = enterPresentation;
window.exitPresentation  = exitPresentation;
window.presGo            = presGo;
window.presToggleFullscreen = function() {
    if (document.fullscreenElement) {
        document.exitFullscreen?.().catch(() => {});
    } else {
        document.documentElement.requestFullscreen?.().catch(() => {});
    }
};

// Outil de mise en forme dans la barre d'outils des textareas
window.mdWrap = function(action, id) {
    const ta = document.getElementById(id);
    if (!ta) return;
    const start = ta.selectionStart;
    const end   = ta.selectionEnd;
    const selected = ta.value.slice(start, end);
    let before, after, placeholder;
    switch (action) {
        case 'bold':   before = '**'; after = '**'; placeholder = 'texte en gras'; break;
        case 'italic': before = '*';  after = '*';  placeholder = 'texte en italique'; break;
        case 'mark':   before = '=='; after = '=='; placeholder = 'texte surligné'; break;
        case 'link':   before = '[';  after = '](https://...)'; placeholder = 'texte du lien'; break;
        case 'vocab': {
            // eslint-disable-next-line no-alert
            const tooltip = prompt('Définition / explication du terme :');
            if (tooltip === null) return;
            before = '{'; after = `|${tooltip}}`; placeholder = 'terme'; break;
        }
        default: return;
    }
    const text = selected || placeholder;
    ta.value = ta.value.slice(0, start) + before + text + after + ta.value.slice(end);
    ta.focus();
    ta.setSelectionRange(start + before.length, start + before.length + text.length);
};

// ===== ÉVÉNEMENTS =====
document.addEventListener('click', (e) => {
    // Ferme les tooltips vocab ouverts au clic en dehors
    document.querySelectorAll('.vocab-term.vocab-open').forEach(t => t.classList.remove('vocab-open'));

    // Ferme le sommaire mobile si on clique en dehors
    const sidebar = document.querySelector('.sidebar-left');
    const mobileBtn = document.getElementById('btn-sommaire-mobile');
    if (sidebar?.classList.contains('mobile-open')
        && !sidebar.contains(e.target)
        && e.target !== mobileBtn
        && !mobileBtn?.contains(e.target)) {
        sidebar.classList.remove('mobile-open');
        mobileBtn?.classList.remove('active');
    }
});

document.getElementById('modal-overlay').addEventListener('click', function (e) {
    if (e.target === this) closeModal();
});

document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') {
        closeModal();
        closeInsertModal();
        closeSommaire();
    }
});

window.addEventListener('beforeunload', () => saveNow());

// ===== CHARGEMENT DU MANUEL =====
async function loadManual(id) {
    try {
        const res = await fetch(`api/load.php?id=${encodeURIComponent(id)}`);
        if (!res.ok) throw new Error('Not found');
        const data = await res.json();

        Object.assign(state.meta, data.meta || {});
        state.meta.id = id;
        if (Array.isArray(data.blocks)) {
            state.blocks.length = 0;
            data.blocks.forEach(b => state.blocks.push(b));
            data.blocks.forEach(b => {
                const n = parseInt(String(b.id).replace(/\D/g, ''));
                if (n > state.idCounter) state.idCounter = n;
            });
        }
    } catch (err) {
        console.warn('[load] Nouveau manuel :', err.message);
        state.meta.id = id;
        state.meta.createdAt = Math.floor(Date.now() / 1000);
    }
}

// ===== INITIALISATION =====
(async () => {
    const params = new URLSearchParams(window.location.search);
    const id = params.get('id');

    if (!id) {
        window.location.replace('index.html');
        return;
    }

    await loadManual(id);
    renderSidebar();
    refresh();
    initSortable();
})();
