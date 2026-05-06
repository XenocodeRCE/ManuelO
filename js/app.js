// Point d'entrée de l'application ManuelO
// Orchestre les modules, expose les fonctions globales, initialise l'app

import {
    state,
    createDefaultRevisionState,
    normalizeRevisionState,
    REVISION_ALLOWED_BLOCK_TYPES
} from './state.js';
import { renderBlocks, renderSidebar, getPages } from './render.js';
import { moveBlock, toggleVisibility, deleteBlock, selectQcm } from './actions.js';
import { openModal, closeModal, submitBlock } from './modal.js';
import { save, saveNow } from './save.js';
import { toggleVocabTooltip } from './markdown.js';
import { enterPresentation, exitPresentation, presGo } from './presentation.js';
import { openPdfExport, closePdfExport, closePdfExportOnOverlay, launchPrint } from './pdf.js';
import { enterBookView, exitBookView, bookGo, bookGoTo, bookSetTheme } from './book.js';
import {
    addArgumentChild,
    ensureArgumentMap,
    findArgumentNode,
    moveArgumentNode,
    sanitizeArgumentExternalUrl,
    removeArgumentNode,
    toggleArgumentNodeRole,
    toggleArgumentNode,
    updateArgumentNode
} from './argument-map.js';

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
            { type: 'argument-map',       icon: '🗺️', label: 'Carte d\'argument',     desc: 'Arbre visuel de raisonnement',     color: '#eef2ff', tc: '#4f46e5' },
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

const BLOCK_TYPE_LABELS = Object.fromEntries(
    BLOCKS_CATALOG
        .flatMap(cat => cat.blocks || [])
        .filter(block => block.type && block.type !== '__page-break__')
        .map(block => [block.type, block.label])
);

const REVISION_ANSWERS = new Set(['AGAIN', 'HARD', 'GOOD', 'EASY']);
const REVISION_ANSWER_LABELS = {
    AGAIN: 'Encore',
    HARD: 'Difficile',
    GOOD: 'Bien',
    EASY: 'Facile'
};
let _runtimeRevisionSession = null;

// Active category id for insert modal
let _insertActiveCat = BLOCKS_CATALOG[0].id;

// ===== UTILITAIRE UUID =====
function generateId() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
        const r = Math.random() * 16 | 0;
        return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
    });
}

function escHtml(value) {
    return String(value || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function ensureRevisionState() {
    const current = state.revision || createDefaultRevisionState();
    const currentHasSession = !!(current?.session && typeof current.session === 'object');
    const runtimeSession = current?.session && typeof current.session === 'object'
        ? current.session
        : (_runtimeRevisionSession && typeof _runtimeRevisionSession === 'object' ? _runtimeRevisionSession : null);

    state.revision = normalizeRevisionState(current, { preserveRuntimeSession: true });
    const normalizedHasSession = !!(state.revision.session && typeof state.revision.session === 'object');
    let restored = false;
    if (!state.revision.session && runtimeSession) {
        // Defensive fallback: never drop an active in-memory session during frequent re-normalization.
        state.revision.session = runtimeSession;
        restored = true;
    }
    if (state.revision.session && typeof state.revision.session === 'object') {
        _runtimeRevisionSession = state.revision.session;
    }
    if (typeof revisionDebug === 'function') {
        revisionDebug('ensureRevisionState', {
            currentHasSession,
            guardHasSession: !!runtimeSession,
            normalizedHasSession,
            restored,
            finalHasSession: !!state.revision.session
        });
    }
    return state.revision;
}

function getRevisionConfig() {
    return ensureRevisionState().config;
}

function getRevisionUserId() {
    const revision = ensureRevisionState();
    return revision.currentUserId || 'eleve-local';
}

function getManualBlockTypes() {
    return [...new Set(
        state.blocks
            .map(block => block?.type)
            .filter(type => type && type !== 'page-break')
    )];
}

function getBlockTypeLabel(type) {
    return BLOCK_TYPE_LABELS[type] || type;
}

function getBlockById(blockId) {
    return state.blocks.find(block => String(block.id) === String(blockId)) || null;
}

function getBlockTypeById(blockId) {
    return getBlockById(blockId)?.type || '';
}

function getBlockPreviewLabel(block) {
    if (!block) return '';
    if (block.type === 'section-title') return block.content || '';
    if (block.type === 'definition') return block.term || '';
    if (block.type === 'distinction') return `${block.termA || ''} / ${block.termB || ''}`.trim();
    if (block.type === 'questions') {
        if (Array.isArray(block.questions)) return block.questions[0] || '';
        return String(block.questions || '').split('\n')[0] || '';
    }
    return block.title || block.question || block.caption || block.prompt || block.content || '';
}

function shortText(value, maxLen = 120) {
    const cleaned = String(value || '').replace(/\s+/g, ' ').trim();
    if (cleaned.length <= maxLen) return cleaned;
    return `${cleaned.slice(0, maxLen).trimEnd()}...`;
}

// ===== REFRESH (renderBlocks + sommaire synchronisé) =====
function refresh() {
    ensureRevisionState();
    renderBlocks();
    renderSidebarSommaire();
    renderRevisionPanel();
}

// ===== MODE =====
function setMode(m) {
    const safeMode = m === 'eleve' || m === 'revision' ? m : 'prof';
    state.mode = safeMode;
    document.getElementById('btn-prof').classList.toggle('active', safeMode === 'prof');
    document.getElementById('btn-eleve').classList.toggle('active', safeMode === 'eleve');
    const revisionBtn = document.getElementById('btn-revision');
    if (revisionBtn) revisionBtn.classList.toggle('active', safeMode === 'revision');
    const isProf = safeMode === 'prof';
    document.getElementById('edit-info').style.display = isProf ? 'block' : 'none';
    document.getElementById('edit-banner').style.display = isProf ? 'flex' : 'none';
    const fab = document.getElementById('fab-zone');
    if (fab) fab.style.display = isProf ? 'flex' : 'none';
    const revisionConfigBtn = document.getElementById('btn-revision-config');
    if (revisionConfigBtn) revisionConfigBtn.style.display = isProf ? 'inline-flex' : 'none';
    document.body.classList.toggle('mode-revision', safeMode === 'revision');
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
    if (block.type === 'argument-map') {
        const map = ensureArgumentMap(block);
        const root = map.thesis || {};
        const support = (root.children || []).find(n => n.role === 'SUPPORT');
        const objection = (root.children || []).find(n => n.role === 'OBJECTION');
        values.title = block.title || '';
        values.thesis = root.content || '';
        values.hints = [support?.content || '', objection?.content || ''].filter(Boolean).join('\n');
        values.isExercise = map.isExercise ? 'oui' : 'non';
    }

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
        handle: '.block-drag-handle',
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

// ===== MODE REVISION =====
let _revisionConfigModal = null;
const REVISION_ALLOWED_TYPE_SET = new Set(REVISION_ALLOWED_BLOCK_TYPES);

const REVISION_DEBUG = true;
function revisionDebug(...args) {
    if (!REVISION_DEBUG) return;
    console.log('[revision-debug]', ...args);
}

function _bindRevisionPanelEvents(panel) {
    if (!panel) return;
    revisionDebug('bind panel events', { mode: state.mode, panelId: panel.id });

    panel.onclick = evt => {
        const target = evt.target;
        if (!(target instanceof Element)) return;
        const actionBtn = target.closest('[data-revision-action]');
        if (!actionBtn || !panel.contains(actionBtn)) return;

        const action = String(actionBtn.dataset.revisionAction || '');
        revisionDebug('panel click action', {
            action,
            tag: actionBtn.tagName,
            text: String(actionBtn.textContent || '').trim()
        });
        if (action === 'start') {
            startRevisionSession();
            return;
        }
        if (action === 'stop') {
            stopRevisionSession();
            return;
        }
        if (action === 'flip') {
            flipRevisionCard();
            return;
        }
        if (action === 'answer') {
            answerRevisionCard(String(actionBtn.dataset.answer || '').toUpperCase());
        }
    };
}

function _ensureProgressBucket(userId) {
    const revision = ensureRevisionState();
    if (!revision.progressByUser[userId]) revision.progressByUser[userId] = {};
    return revision.progressByUser[userId];
}

function _defaultCardProgress() {
    return {
        repetitions: 0,
        easeFactor: 2.5,
        interval: 0,
        lapses: 0,
        nextReviewAt: Date.now(),
        lastReviewedAt: null,
        history: []
    };
}

function _shuffle(array) {
    const result = [...array];
    for (let i = result.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [result[i], result[j]] = [result[j], result[i]];
    }
    return result;
}

function _stripMarkdownLite(raw) {
    return String(raw || '')
        .replace(/\[(.*?)\]\((.*?)\)/g, '$1')
        .replace(/\*\*(.*?)\*\*/g, '$1')
        .replace(/__(.*?)__/g, '$1')
        .replace(/`([^`]+)`/g, '$1')
        .replace(/==([^=]+)==/g, '$1')
        .replace(/\{([^|}]+)\|([^}]+)\}/g, '$1')
        .replace(/<[^>]+>/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

function _getRevisionCardAnswer(block) {
    if (!block) return '';

    if (block.type === 'summary') {
        const items = String(block.items || '')
            .split('\n')
            .map(item => _stripMarkdownLite(item))
            .filter(Boolean);
        return items.join(' ; ');
    }

    if (block.type === 'warning' || block.type === 'recall') {
        return _stripMarkdownLite(block.content || '');
    }

    return '';
}

function _buildRevisionCardFromBlock(block) {
    const front = String(block?.flashcard || '').trim();
    const back = _getRevisionCardAnswer(block);
    if (!front || !back) return null;

    return {
        id: `block-${String(block.id)}`,
        sourceBlocId: String(block.id || ''),
        sourceType: block.type,
        front,
        back,
        category: getBlockTypeLabel(block.type)
    };
}

function _getRevisionCardsByConfig() {
    const cards = state.blocks
        .filter(block => {
            if (!block || block.type === 'page-break') return false;
            if (!REVISION_ALLOWED_TYPE_SET.has(block.type)) return false;
            if (block.visible === false) return false;
            return true;
        })
        .map(_buildRevisionCardFromBlock)
        .filter(Boolean);

    revisionDebug('cards by config', {
        totalBlocks: Array.isArray(state.blocks) ? state.blocks.length : 0,
        generatedCards: cards.length
    });

    return cards;
}

function _getDueRevisionCards() {
    const revision = ensureRevisionState();
    const config = revision.config;
    const userId = getRevisionUserId();
    const progress = _ensureProgressBucket(userId);
    const now = Date.now();

    const cards = _getRevisionCardsByConfig().filter(card => {
        if (!config.useSpacedRepetition) return true;
        const entry = progress[card.id];
        if (!entry) return true;
        return Number(entry.nextReviewAt || 0) <= now;
    });

    if (config.useSpacedRepetition) {
        cards.sort((a, b) => {
            const aNext = Number(progress[a.id]?.nextReviewAt || 0);
            const bNext = Number(progress[b.id]?.nextReviewAt || 0);
            return aNext - bNext;
        });
    }

    return cards;
}

function _processRevisionAnswer(previousProgress, answer, responseTime) {
    const qualityMap = { AGAIN: 0, HARD: 1, GOOD: 2, EASY: 3 };
    const quality = qualityMap[answer] ?? 2;
    const current = {
        ..._defaultCardProgress(),
        ...(previousProgress || {})
    };

    let repetitions = Math.max(0, Number(current.repetitions) || 0);
    let interval = Math.max(0, Number(current.interval) || 0);
    let easeFactor = Math.max(1.3, Number(current.easeFactor) || 2.5);
    let lapses = Math.max(0, Number(current.lapses) || 0);

    if (answer === 'AGAIN') {
        repetitions = 0;
        interval = 1;
        lapses += 1;
        easeFactor = Math.max(1.3, easeFactor - 0.2);
    } else {
        if (repetitions === 0) {
            interval = 1;
        } else if (repetitions === 1) {
            interval = 3;
        } else {
            const multiplier = answer === 'HARD'
                ? Math.max(1.15, easeFactor - 0.2)
                : (answer === 'EASY' ? easeFactor + 0.22 : easeFactor);
            interval = Math.max(1, Math.round(interval * multiplier));
        }
        repetitions += 1;

        const diff = 3 - quality;
        easeFactor = Math.max(1.3, easeFactor + (0.1 - diff * (0.08 + diff * 0.02)));
        if (answer === 'HARD') easeFactor = Math.max(1.3, easeFactor - 0.05);
        if (answer === 'EASY') easeFactor += 0.1;
    }

    const now = Date.now();
    const history = Array.isArray(current.history) ? [...current.history] : [];
    history.push({
        timestamp: now,
        answer,
        responseTime: Math.max(0, Number(responseTime) || 0)
    });

    return {
        repetitions,
        easeFactor,
        interval,
        lapses,
        nextReviewAt: now + interval * 24 * 60 * 60 * 1000,
        lastReviewedAt: now,
        history
    };
}

function _finishRevisionSession() {
    const revision = ensureRevisionState();
    if (!revision.session) return;
    revision.session.isFinished = true;
    revision.session.finishedAt = Date.now();
}

function startRevisionSession() {
    try {
        revisionDebug('startRevisionSession called', { mode: state.mode });
        const config = getRevisionConfig();
        let cards = _getDueRevisionCards();
        revisionDebug('due cards computed', { dueCount: cards.length });

        if (!cards.length) {
            cards = _getRevisionCardsByConfig();
            revisionDebug('fallback cards computed', { fallbackCount: cards.length });
        }
        if (!cards.length) {
            revisionDebug('no cards available, abort start');
            showToast('Aucune flashcard configuree dans les blocs de revision.', 'warn');
            return;
        }

        if (config.shuffleCards) {
            revisionDebug('shuffle enabled, shuffling cards', { count: cards.length });
            cards = _shuffle(cards);
        }

        const revision = ensureRevisionState();
        revision.session = {
            startedAt: Date.now(),
            finishedAt: null,
            isFinished: false,
            flipped: false,
            queue: cards,
            currentIndex: 0,
            answeredCount: 0,
            correctCount: 0,
            incorrectCount: 0,
            cardShownAt: Date.now()
        };
        _runtimeRevisionSession = revision.session;

        revisionDebug('session created', {
            queueLength: revision.session.queue.length,
            currentIndex: revision.session.currentIndex
        });

        renderRevisionPanel();
    } catch (err) {
        console.error('[revision/start]', err);
        revisionDebug('startRevisionSession error', { message: err?.message || String(err) });
        showToast(`Erreur au demarrage: ${err?.message || 'inconnue'}`, 'error');
    }
}

function stopRevisionSession() {
    const revision = ensureRevisionState();
    revision.session = null;
    _runtimeRevisionSession = null;
    renderRevisionPanel();
}

function flipRevisionCard() {
    const session = ensureRevisionState().session;
    if (!session || session.isFinished) return;
    session.flipped = !session.flipped;
    renderRevisionPanel();
}

function answerRevisionCard(answer) {
    if (!REVISION_ANSWERS.has(answer)) return;

    const revision = ensureRevisionState();
    const session = revision.session;
    if (!session || session.isFinished) return;

    const currentCard = session.queue[session.currentIndex];
    if (!currentCard) {
        _finishRevisionSession();
        renderRevisionPanel();
        return;
    }

    const userId = getRevisionUserId();
    const bucket = _ensureProgressBucket(userId);
    const responseTime = Date.now() - Number(session.cardShownAt || Date.now());
    const prevProgress = bucket[currentCard.id] || _defaultCardProgress();
    bucket[currentCard.id] = _processRevisionAnswer(prevProgress, answer, responseTime);

    session.answeredCount += 1;
    if (answer === 'GOOD' || answer === 'EASY') session.correctCount += 1;
    else session.incorrectCount += 1;

    if (answer === 'AGAIN' && session.queue.length > 1) {
        const insertionOffset = 2 + Math.floor(Math.random() * 4);
        const insertionIndex = Math.min(session.currentIndex + insertionOffset, session.queue.length);
        session.queue.splice(insertionIndex, 0, currentCard);
    }

    session.currentIndex += 1;
    session.flipped = false;
    session.cardShownAt = Date.now();

    const maxMinutes = Number(revision.config.sessionDuration) || 0;
    if (maxMinutes > 0) {
        const elapsedMs = Date.now() - Number(session.startedAt || Date.now());
        if (elapsedMs >= maxMinutes * 60 * 1000) {
            _finishRevisionSession();
        }
    }

    if (session.currentIndex >= session.queue.length) {
        _finishRevisionSession();
    }

    save();
    renderRevisionPanel();
}

function _formatSessionTimer(sessionStartedAt, sessionDurationMin) {
    const maxMs = Math.max(0, Number(sessionDurationMin) || 0) * 60 * 1000;
    if (!maxMs) return 'Session libre';
    const elapsed = Date.now() - Number(sessionStartedAt || Date.now());
    const remaining = Math.max(0, maxMs - elapsed);
    const mm = Math.floor(remaining / 60000);
    const ss = Math.floor((remaining % 60000) / 1000);
    return `Temps restant: ${String(mm).padStart(2, '0')}:${String(ss).padStart(2, '0')}`;
}

function renderRevisionPanel() {
    const panel = document.getElementById('revision-panel');
    if (!panel) {
        revisionDebug('renderRevisionPanel: panel not found');
        return;
    }
    _bindRevisionPanelEvents(panel);

    if (state.mode !== 'revision') {
        revisionDebug('renderRevisionPanel: hidden because mode is not revision', { mode: state.mode });
        panel.style.display = 'none';
        panel.innerHTML = '';
        return;
    }

    panel.style.display = 'block';
    const revision = ensureRevisionState();
    const dueCards = _getDueRevisionCards();
    const availableCards = _getRevisionCardsByConfig();
    const session = revision.session;
    revisionDebug('renderRevisionPanel snapshot', {
        mode: state.mode,
        dueCount: dueCards.length,
        availableCount: availableCards.length,
        hasSession: !!session,
        sessionFinished: !!session?.isFinished
    });

    if (!availableCards.length) {
        panel.innerHTML = `
            <div class="revision-panel-header">
                <div>
                    <div class="revision-panel-title">Mode revision actif</div>
                    <div class="revision-panel-subtitle">Aucune flashcard configuree dans les blocs autorises.</div>
                </div>
            </div>
            <div class="revision-empty">Le professeur doit renseigner le champ Flashcard (question) dans les blocs A retenir, Attention / Piege et Rappel / Prerequis.</div>`;
        return;
    }

    if (!session || session.isFinished) {
        const scoreLine = session?.isFinished
            ? `<span class="revision-stat">Derniere session: ${session.correctCount} bonnes / ${session.incorrectCount} difficiles</span>`
            : '';
        panel.innerHTML = `
            <div class="revision-panel-header">
                <div>
                    <div class="revision-panel-title">Mode revision actif</div>
                    <div class="revision-panel-subtitle">Cartes generees depuis les blocs A retenir, Attention / Piege et Rappel / Prerequis.</div>
                </div>
                <div class="revision-panel-actions">
                    <button class="revision-panel-btn" type="button" data-revision-action="start">Demarrer la session</button>
                </div>
            </div>
            <div class="revision-session-stats">
                <span class="revision-stat">Cartes dues: ${dueCards.length}</span>
                <span class="revision-stat">Cartes disponibles: ${availableCards.length}</span>
                ${scoreLine}
            </div>
            <div class="revision-empty">Session en popup: cliquez sur Demarrer, puis cliquez sur la carte pour voir la reponse.</div>`;
        return;
    }

    const currentCard = session.queue[session.currentIndex];
    if (!currentCard) {
        _finishRevisionSession();
        renderRevisionPanel();
        return;
    }

    const faceLabel = session.flipped ? 'Reponse' : 'Question';
    const text = session.flipped ? currentCard.back : currentCard.front;
    const sourceLabel = currentCard.category || getBlockTypeLabel(currentCard.sourceType || '');
    const timerText = _formatSessionTimer(session.startedAt, revision.config.sessionDuration);

    panel.innerHTML = `
        <div class="revision-panel-header">
            <div>
                <div class="revision-panel-title">Session en cours</div>
                <div class="revision-panel-subtitle">${timerText}</div>
            </div>
            <div class="revision-panel-actions">
                <button class="revision-panel-btn" type="button" data-revision-action="stop">Arreter</button>
            </div>
        </div>
        <div class="revision-session-stats">
            <span class="revision-stat">Carte ${session.currentIndex + 1} / ${session.queue.length}</span>
            <span class="revision-stat">Bonnes: ${session.correctCount}</span>
            <span class="revision-stat">A retravailler: ${session.incorrectCount}</span>
        </div>
        <div class="revision-modal-overlay active revision-study-overlay">
            <div class="revision-modal revision-study-modal" role="dialog" aria-modal="true" aria-label="Session de revision flashcard">
                <div class="revision-modal-header">
                    <h3>Carte ${session.currentIndex + 1} / ${session.queue.length}</h3>
                    <button class="revision-modal-close" type="button" data-revision-action="stop" aria-label="Fermer la session">×</button>
                </div>
                <div class="revision-modal-body">
                    <button class="revision-flashcard ${session.flipped ? 'is-back' : 'is-front'}" type="button" data-revision-action="flip">
                        <div class="revision-card-face">${faceLabel}</div>
                        <div class="revision-card-text">${escHtml(text)}</div>
                        <div class="revision-card-meta">Source: ${escHtml(sourceLabel || 'Bloc pedagogique')}</div>
                        <div class="revision-flashcard-hint">Cliquez sur la carte pour ${session.flipped ? 'revenir a la question' : 'voir la reponse'}.</div>
                    </button>
                    ${session.flipped
                        ? `<div class="revision-answer-row">
                            <button class="revision-answer-btn again" type="button" data-revision-action="answer" data-answer="AGAIN">${REVISION_ANSWER_LABELS.AGAIN}</button>
                            <button class="revision-answer-btn hard" type="button" data-revision-action="answer" data-answer="HARD">${REVISION_ANSWER_LABELS.HARD}</button>
                            <button class="revision-answer-btn good" type="button" data-revision-action="answer" data-answer="GOOD">${REVISION_ANSWER_LABELS.GOOD}</button>
                            <button class="revision-answer-btn easy" type="button" data-revision-action="answer" data-answer="EASY">${REVISION_ANSWER_LABELS.EASY}</button>
                        </div>`
                        : ''
                    }
                </div>
            </div>
        </div>`;
}

function _ensureRevisionConfigModal() {
    if (_revisionConfigModal) return _revisionConfigModal;

    const overlay = document.createElement('div');
    overlay.id = 'revision-config-overlay';
    overlay.className = 'revision-modal-overlay';
    overlay.innerHTML = `
        <div class="revision-modal" role="dialog" aria-modal="true" aria-labelledby="revision-config-title">
            <div class="revision-modal-header">
                <h3 id="revision-config-title">Configuration du mode revision</h3>
                <button class="revision-modal-close" type="button" data-action="close">×</button>
            </div>
            <div class="revision-modal-body">
                <section class="revision-section">
                    <h4>Blocs inclus automatiquement</h4>
                    <div id="revision-fixed-types" class="revision-session-stats"></div>
                </section>
                <section class="revision-section">
                    <h4>Configuration des flashcards</h4>
                    <div class="revision-empty">Les flashcards ne s ajoutent plus ici. Renseignez le champ Flashcard (question) dans les blocs A retenir, Attention / Piege et Rappel / Prerequis.</div>
                </section>
                <section class="revision-section">
                    <h4>Options de session</h4>
                    <div class="revision-inline-options">
                        <label><input type="checkbox" id="revision-shuffle-cards"> Melanger les cartes</label>
                        <label><input type="checkbox" id="revision-use-srs"> Activer repetition espacee</label>
                        <label>Durée (min)
                            <input type="number" min="1" max="180" id="revision-session-duration" class="revision-number-input">
                        </label>
                    </div>
                </section>
                <section class="revision-section">
                    <h4>Etat actuel</h4>
                    <div class="revision-session-stats" id="revision-config-stats"></div>
                </section>
                <div class="revision-modal-footer">
                    <button class="btn btn-ghost" type="button" data-action="cancel">Fermer</button>
                    <button class="btn btn-primary" type="button" data-action="save">Enregistrer</button>
                </div>
            </div>
        </div>`;

    document.body.appendChild(overlay);

    const close = () => overlay.classList.remove('active');
    overlay._close = close;

    overlay.addEventListener('click', evt => {
        if (evt.target === overlay) close();
    });

    overlay.querySelector('[data-action="close"]').addEventListener('click', close);
    overlay.querySelector('[data-action="cancel"]').addEventListener('click', close);

    overlay.querySelector('[data-action="save"]').addEventListener('click', () => {
        const revision = ensureRevisionState();
        revision.config.visibleBlocTypes = [...REVISION_ALLOWED_BLOCK_TYPES];
        revision.config.flashcardSources = [...REVISION_ALLOWED_BLOCK_TYPES];
        revision.config.shuffleCards = !!overlay.querySelector('#revision-shuffle-cards')?.checked;
        revision.config.useSpacedRepetition = !!overlay.querySelector('#revision-use-srs')?.checked;
        revision.config.sessionDuration = Math.max(
            1,
            Number(overlay.querySelector('#revision-session-duration')?.value) || 15
        );

        save();
        refresh();
        close();
    });

    _revisionConfigModal = overlay;
    return overlay;
}

function _renderRevisionConfigModal() {
    const overlay = _ensureRevisionConfigModal();
    const revision = ensureRevisionState();
    const config = revision.config;
    const fixedTypesWrap = overlay.querySelector('#revision-fixed-types');
    fixedTypesWrap.innerHTML = REVISION_ALLOWED_BLOCK_TYPES.map(type =>
        `<span class="revision-stat">${escHtml(getBlockTypeLabel(type))}</span>`
    ).join('');

    overlay.querySelector('#revision-shuffle-cards').checked = !!config.shuffleCards;
    overlay.querySelector('#revision-use-srs').checked = !!config.useSpacedRepetition;
    overlay.querySelector('#revision-session-duration').value = Math.max(1, Number(config.sessionDuration) || 15);

    const stats = overlay.querySelector('#revision-config-stats');
    const availableCards = _getRevisionCardsByConfig();
    const dueCards = _getDueRevisionCards();
    stats.innerHTML = `
        <span class="revision-stat">Cartes configurees: ${availableCards.length}</span>
        <span class="revision-stat">Cartes dues: ${dueCards.length}</span>`;
}

function openRevisionConfigModal() {
    if (state.mode !== 'prof') {
        showToast('Passez en mode prof pour configurer la revision.', 'warn');
        return;
    }
    const overlay = _ensureRevisionConfigModal();
    _renderRevisionConfigModal();
    overlay.classList.add('active');
}

function closeRevisionConfigModal() {
    if (_revisionConfigModal?._close) _revisionConfigModal._close();
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
window.openRevisionConfigModal = openRevisionConfigModal;
window.startRevisionSession = startRevisionSession;
window.stopRevisionSession = stopRevisionSession;
window.flipRevisionCard = flipRevisionCard;
window.answerRevisionCard = answerRevisionCard;

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

// ===== CARTE D'ARGUMENT — INTERACTIONS =====
function _getBlockIndexById(blockId) {
    return state.blocks.findIndex(b => String(b.id) === String(blockId));
}

function _withArgumentMap(blockId, mutator, { persist = true } = {}) {
    const idx = _getBlockIndexById(blockId);
    if (idx < 0) return false;
    const block = state.blocks[idx];
    if (block.type !== 'argument-map') return false;
    const map = ensureArgumentMap(block);
    const changed = mutator(block, map);
    if (!changed) return false;
    refresh();
    if (persist) save();
    return true;
}

function argMapAddNode(blockId, parentId, role) {
    if (state.mode !== 'prof') {
        showToast('Passez en mode prof pour modifier la carte.', 'warn');
        return;
    }

    _withArgumentMap(blockId, (_block, map) => {
        const node = addArgumentChild(map.thesis, parentId, role, {
            author: 'Prof',
            isPlaceholder: true
        });
        if (!node) {
            showToast('Nœud parent introuvable.', 'error');
            return false;
        }
        return true;
    });
}

let _argMapDragNode = null;

function _readArgMapDragPayload(evt) {
    if (_argMapDragNode?.blockId && _argMapDragNode?.nodeId) {
        return {
            blockId: String(_argMapDragNode.blockId),
            nodeId: String(_argMapDragNode.nodeId)
        };
    }

    if (!evt?.dataTransfer) return null;
    const raw = evt.dataTransfer.getData('application/x-manuelo-argnode')
        || evt.dataTransfer.getData('text/plain');
    if (!raw) return null;

    try {
        const parsed = JSON.parse(raw);
        if (parsed?.blockId && parsed?.nodeId) {
            return {
                blockId: String(parsed.blockId),
                nodeId: String(parsed.nodeId)
            };
        }
    } catch (_err) {
        const parts = raw.split('::');
        if (parts.length === 2 && parts[0] && parts[1]) {
            return {
                blockId: String(parts[0]),
                nodeId: String(parts[1])
            };
        }
    }

    return null;
}

function argMapStartNodeDrag(blockIdOrEvent, nodeId, evtMaybe) {
    let blockId = blockIdOrEvent;
    let evt = evtMaybe;

    if (blockIdOrEvent && typeof blockIdOrEvent === 'object' && blockIdOrEvent.type === 'dragstart') {
        evt = blockIdOrEvent;
    }

    if (state.mode !== 'prof') return;

    const dragNodeEl = evt?.currentTarget?.closest
        ? evt.currentTarget.closest('.arg-node')
        : (evt?.target?.closest ? evt.target.closest('.arg-node') : null);

    const safeBlockId = String((dragNodeEl?.dataset.blockId || blockId || '')).trim();
    const safeNodeId = String((dragNodeEl?.dataset.nodeId || nodeId || '')).trim();
    if (!safeBlockId || !safeNodeId) return;

    _argMapDragNode = { blockId: safeBlockId, nodeId: safeNodeId };
    if (evt?.stopPropagation) evt.stopPropagation();
    if (dragNodeEl) dragNodeEl.classList.add('is-dragging');

    if (evt?.dataTransfer) {
        evt.dataTransfer.effectAllowed = 'move';
        const rawPayload = JSON.stringify(_argMapDragNode);
        evt.dataTransfer.setData('application/x-manuelo-argnode', rawPayload);
        evt.dataTransfer.setData('text/plain', `${safeBlockId}::${safeNodeId}`);
    }
}

function argMapEndNodeDrag() {
    document.querySelectorAll('.arg-node.is-dragging, .arg-node.drag-over').forEach(el => {
        el.classList.remove('is-dragging', 'drag-over');
    });
    _argMapDragNode = null;
}

function argMapAllowNodeDrop(evt) {
    if (evt?.preventDefault) evt.preventDefault();
    if (evt?.stopPropagation) evt.stopPropagation();
    if (evt?.dataTransfer) evt.dataTransfer.dropEffect = 'move';
}

function argMapEnterNodeDropTarget(evt) {
    const target = evt?.currentTarget || (evt?.target?.closest ? evt.target.closest('.arg-node') : null);
    if (!target) return;
    if (evt?.preventDefault) evt.preventDefault();
    target.classList.add('drag-over');
}

function argMapLeaveNodeDropTarget(evt) {
    const target = evt?.currentTarget || (evt?.target?.closest ? evt.target.closest('.arg-node') : null);
    if (!target) return;
    target.classList.remove('drag-over');
}

function argMapDropNode(blockIdOrEvent, targetNodeId, evtMaybe) {
    let blockId = blockIdOrEvent;
    let evt = evtMaybe;

    if (blockIdOrEvent && typeof blockIdOrEvent === 'object' && blockIdOrEvent.type === 'drop') {
        evt = blockIdOrEvent;
        const targetNodeEl = evt?.currentTarget?.closest
            ? evt.currentTarget.closest('.arg-node')
            : (evt?.target?.closest ? evt.target.closest('.arg-node') : null);
        blockId = targetNodeEl?.dataset.blockId;
        targetNodeId = targetNodeEl?.dataset.nodeId;
    }

    if (evt?.preventDefault) evt.preventDefault();
    if (evt?.stopPropagation) evt.stopPropagation();

    const dragPayload = _readArgMapDragPayload(evt);
    if (state.mode !== 'prof' || !dragPayload) return;

    const safeBlockId = String(blockId || '').trim();
    const safeTargetNodeId = String(targetNodeId || '').trim();
    if (!safeBlockId || !safeTargetNodeId) {
        _argMapDragNode = null;
        return;
    }

    if (String(dragPayload.blockId) !== safeBlockId) {
        _argMapDragNode = null;
        return;
    }

    // No-op: dropped on the same node.
    if (String(dragPayload.nodeId) === safeTargetNodeId) {
        document.querySelectorAll('.arg-node.drag-over').forEach(el => el.classList.remove('drag-over'));
        _argMapDragNode = null;
        return;
    }

    _withArgumentMap(safeBlockId, (_block, map) => {
        const moved = moveArgumentNode(map.thesis, dragPayload.nodeId, safeTargetNodeId);
        if (!moved) {
            showToast('Déplacement impossible pour ce nœud.', 'warn');
            return false;
        }
        return true;
    });

    document.querySelectorAll('.arg-node.drag-over').forEach(el => el.classList.remove('drag-over'));
    _argMapDragNode = null;
}

let _argNodeEditModal = null;
let _argNodeEditModalEscHandler = null;

function _ensureArgNodeEditModal() {
    if (_argNodeEditModal) return _argNodeEditModal;

    const overlay = document.createElement('div');
    overlay.id = 'arg-node-modal-overlay';
    overlay.className = 'arg-node-modal-overlay';
    overlay.innerHTML = `
        <div class="arg-node-modal" role="dialog" aria-modal="true" aria-labelledby="arg-node-modal-title">
            <div class="arg-node-modal-header">
                <h3 id="arg-node-modal-title">Modifier le nœud</h3>
                <button type="button" class="arg-node-modal-close" data-action="close" aria-label="Fermer">×</button>
            </div>
            <form class="arg-node-modal-form">
                <label>
                    Texte de l'argument
                    <textarea name="content" rows="4" placeholder="Saisissez l'argument..."></textarea>
                </label>
                <label>
                    Auteur (optionnel)
                    <input type="text" name="author" placeholder="Ex: Kant" />
                </label>
                <label>
                    ID bloc source ManuelO (optionnel)
                    <input type="text" name="sourceRef" placeholder="Ex: b42" />
                </label>
                <label>
                    Lien externe (optionnel)
                    <input type="url" name="externalUrl" placeholder="https://..." />
                </label>
                <label>
                    Texte source libre (optionnel)
                    <textarea name="sourceText" rows="3" placeholder="Citation ou note de source..."></textarea>
                </label>
                <div class="arg-node-modal-actions">
                    <button type="button" class="arg-node-modal-btn secondary" data-action="cancel">Annuler</button>
                    <button type="submit" class="arg-node-modal-btn primary">Enregistrer</button>
                </div>
            </form>
        </div>`;

    document.body.appendChild(overlay);

    const close = () => {
        overlay.classList.remove('active');
        overlay._onSave = null;
        if (_argNodeEditModalEscHandler) {
            document.removeEventListener('keydown', _argNodeEditModalEscHandler);
            _argNodeEditModalEscHandler = null;
        }
    };

    overlay.addEventListener('click', evt => {
        if (evt.target === overlay) close();
    });

    overlay.querySelector('[data-action="close"]').addEventListener('click', close);
    overlay.querySelector('[data-action="cancel"]').addEventListener('click', close);

    overlay.querySelector('form').addEventListener('submit', evt => {
        evt.preventDefault();
        if (typeof overlay._onSave !== 'function') {
            close();
            return;
        }

        const values = {
            content: overlay.querySelector('[name="content"]').value,
            author: overlay.querySelector('[name="author"]').value,
            sourceRef: overlay.querySelector('[name="sourceRef"]').value,
            externalUrl: overlay.querySelector('[name="externalUrl"]').value,
            sourceText: overlay.querySelector('[name="sourceText"]').value
        };

        const shouldClose = overlay._onSave(values);
        if (shouldClose !== false) close();
    });

    overlay._close = close;
    _argNodeEditModal = overlay;
    return overlay;
}

function _openArgNodeEditModal(initialValues, onSave) {
    const overlay = _ensureArgNodeEditModal();
    overlay.querySelector('[name="content"]').value = initialValues.content || '';
    overlay.querySelector('[name="author"]').value = initialValues.author || '';
    overlay.querySelector('[name="sourceRef"]').value = initialValues.sourceRef || '';
    overlay.querySelector('[name="externalUrl"]').value = initialValues.externalUrl || '';
    overlay.querySelector('[name="sourceText"]').value = initialValues.sourceText || '';
    overlay._onSave = onSave;
    overlay.classList.add('active');

    _argNodeEditModalEscHandler = evt => {
        if (evt.key !== 'Escape') return;
        evt.preventDefault();
        overlay._close();
    };
    document.addEventListener('keydown', _argNodeEditModalEscHandler);

    requestAnimationFrame(() => {
        overlay.querySelector('[name="content"]').focus();
        overlay.querySelector('[name="content"]').select();
    });
}

function argMapToggleNode(blockId, nodeId) {
    _withArgumentMap(blockId, (_block, map) => {
        const ok = toggleArgumentNode(map.thesis, nodeId);
        if (!ok) {
            showToast('Nœud introuvable.', 'error');
            return false;
        }
        return true;
    });
}

function argMapDeleteNode(blockId, nodeId) {
    if (state.mode !== 'prof') {
        showToast('Passez en mode prof pour supprimer un nœud.', 'warn');
        return;
    }

    _withArgumentMap(blockId, (_block, map) => {
        const ok = removeArgumentNode(map.thesis, nodeId);
        if (!ok) {
            showToast('La thèse centrale ne peut pas être supprimée.', 'warn');
            return false;
        }
        return true;
    });
}

function argMapEditNode(blockId, nodeId) {
    if (state.mode !== 'prof') {
        showToast('Passez en mode prof pour éditer un nœud.', 'warn');
        return;
    }

    const idx = _getBlockIndexById(blockId);
    if (idx < 0) return;
    const block = state.blocks[idx];
    const map = ensureArgumentMap(block);
    const found = findArgumentNode(map.thesis, nodeId);
    if (!found || !found.node) {
        showToast('Nœud introuvable.', 'error');
        return;
    }

    const node = found.node;

    _openArgNodeEditModal({
        content: node.content || '',
        author: node.author || '',
        sourceRef: node.sourceRef || '',
        externalUrl: node.externalUrl || '',
        sourceText: node.sourceText || ''
    }, values => {
        const rawExternalUrl = String(values.externalUrl || '').trim();
        const cleanUrl = sanitizeArgumentExternalUrl(rawExternalUrl);
        if (rawExternalUrl && !cleanUrl) {
            showToast('URL externe invalide (http/https uniquement).', 'error');
            return false;
        }

        const updated = _withArgumentMap(blockId, (_b, m) => updateArgumentNode(m.thesis, nodeId, {
            content: String(values.content || '').trim(),
            author: String(values.author || '').trim(),
            sourceRef: String(values.sourceRef || '').trim(),
            externalUrl: cleanUrl,
            sourceText: String(values.sourceText || '').trim(),
            isPlaceholder: !String(values.content || '').trim()
        }));

        if (!updated) {
            showToast('Nœud introuvable.', 'error');
            return false;
        }
        return true;
    });
}

function argMapToggleNodeRoleAction(blockId, nodeId) {
    if (state.mode !== 'prof') return;
    _withArgumentMap(blockId, (_block, map) => {
        const ok = toggleArgumentNodeRole(map.thesis, nodeId);
        return !!ok;
    });
}

function argMapJumpToSource(blockId, nodeId) {
    const idx = _getBlockIndexById(blockId);
    if (idx < 0) return;
    const block = state.blocks[idx];
    const map = ensureArgumentMap(block);
    const found = findArgumentNode(map.thesis, nodeId);
    if (!found || !found.node) return;

    const node = found.node;
    let missingBlockRef = false;

    if (node.sourceRef) {
        const targetIndex = _getBlockIndexById(node.sourceRef);
        if (targetIndex < 0) {
            missingBlockRef = true;
        } else {
            state.currentPage = state.blocks.slice(0, targetIndex + 1).filter(b => b.type === 'page-break').length + 1;
            refresh();
            requestAnimationFrame(() => {
                const wrap = document.querySelector(`.block-wrapper[data-index="${targetIndex}"]`);
                if (!wrap) return;
                wrap.scrollIntoView({ behavior: 'smooth', block: 'center' });
                wrap.classList.add('argmap-target-pulse');
                setTimeout(() => wrap.classList.remove('argmap-target-pulse'), 1400);
            });
            return;
        }
    }

    const safeExternalUrl = sanitizeArgumentExternalUrl(node.externalUrl);
    if (safeExternalUrl) {
        window.open(safeExternalUrl, '_blank', 'noopener,noreferrer');
        return;
    }

    if (node.sourceText) {
        showToast(node.sourceText, 'info');
        return;
    }

    if (missingBlockRef) {
        showToast(`Bloc source introuvable: ${node.sourceRef}`, 'error');
        return;
    }

    showToast('Aucune source liée à ce nœud.', 'info');
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
window.argMapAddNode = argMapAddNode;
window.argMapStartNodeDrag = argMapStartNodeDrag;
window.argMapEndNodeDrag = argMapEndNodeDrag;
window.argMapAllowNodeDrop = argMapAllowNodeDrop;
window.argMapEnterNodeDropTarget = argMapEnterNodeDropTarget;
window.argMapLeaveNodeDropTarget = argMapLeaveNodeDropTarget;
window.argMapDropNode = argMapDropNode;
window.argMapToggleNode = argMapToggleNode;
window.argMapDeleteNode = argMapDeleteNode;
window.argMapEditNode = argMapEditNode;
window.argMapToggleNodeRole = argMapToggleNodeRoleAction;
window.argMapJumpToSource = argMapJumpToSource;

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
window.openPdfExport          = openPdfExport;
window.closePdfExport         = closePdfExport;
window.closePdfExportOnOverlay = closePdfExportOnOverlay;
window.launchPrint            = launchPrint;
window.enterBookView  = enterBookView;
window.exitBookView   = exitBookView;
window.bookGo         = bookGo;
window.bookGoTo       = bookGoTo;
window.bookSetTheme   = bookSetTheme;
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
        closeRevisionConfigModal();
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
        state.revision = normalizeRevisionState(data.revision || createDefaultRevisionState());
        _runtimeRevisionSession = null;
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
        state.revision = createDefaultRevisionState();
        _runtimeRevisionSession = null;
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
    setMode(state.mode || 'prof');
})();
