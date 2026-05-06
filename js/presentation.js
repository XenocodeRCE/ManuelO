// Mode présentation — plein écran, un bloc = une slide

import { state, REVISION_ALLOWED_BLOCK_TYPES } from './state.js';
import { renderBlockContent } from './render.js';

let slides   = [];   // blocs visibles à présenter
let current  = 0;    // index courant
let hudTimer = null; // timer auto-hide du HUD

// ─── Entrée ────────────────────────────────────────────────────────────────
export function enterPresentation() {
    const revisionVisibleSet = state.mode === 'revision'
        ? new Set(REVISION_ALLOWED_BLOCK_TYPES)
        : null;

    slides = state.blocks.filter(b => {
        if (b.type === 'page-break') return false;
        if (!b.visible && state.mode !== 'prof') return false;
        if (revisionVisibleSet && !revisionVisibleSet.has(b.type)) return false;
        return true;
    });
    if (!slides.length) return;
    current = 0;

    const overlay = document.getElementById('pres-overlay');
    overlay.classList.add('active');

    // Plein écran
    document.documentElement.requestFullscreen?.().catch(() => {});

    _renderSlide();
    document.addEventListener('keydown', _onKey);
    overlay.addEventListener('mousemove', _onMouseMove);
    _showHud();
}

// ─── Sortie ────────────────────────────────────────────────────────────────
export function exitPresentation() {
    const overlay = document.getElementById('pres-overlay');
    if (!overlay) return;
    overlay.classList.remove('active');
    overlay.removeEventListener('mousemove', _onMouseMove);
    document.removeEventListener('keydown', _onKey);
    clearTimeout(hudTimer);
    if (document.fullscreenElement) {
        document.exitFullscreen?.().catch(() => {});
    }
    // Nettoyer la slide
    const content = document.getElementById('pres-slide-content');
    if (content) content.innerHTML = '';
}

// ─── Navigation publique (appelée depuis onclick HTML) ──────────────────────
export function presGo(dir) {
    _go(dir);
}

// ─── Rendu d'une slide ─────────────────────────────────────────────────────
function _renderSlide() {
    const block   = slides[current];
    const content = document.getElementById('pres-slide-content');
    if (!content) return;

    // Animation de transition
    content.classList.remove('slide-in');
    // Force reflow
    void content.offsetWidth;
    content.innerHTML = renderBlockContent(block);
    content.classList.add('slide-in');

    // Compteur
    const counter = document.getElementById('pres-counter');
    if (counter) counter.textContent = `${current + 1} / ${slides.length}`;

    // Boutons prev/next
    const prev = document.getElementById('pres-prev');
    const next = document.getElementById('pres-next');
    if (prev) prev.disabled = (current === 0);
    if (next) next.disabled = (current === slides.length - 1);

    // Mermaid
    if (window.mermaid) {
        requestAnimationFrame(() =>
            mermaid.run({ querySelector: '#pres-slide-content .mermaid:not([data-processed])' })
        );
    }
}

// ─── Déplacement ───────────────────────────────────────────────────────────
function _go(dir) {
    const next = current + dir;
    if (next < 0 || next >= slides.length) return;
    current = next;
    _renderSlide();
    _showHud();
}

// ─── Clavier ───────────────────────────────────────────────────────────────
function _onKey(e) {
    const overlay = document.getElementById('pres-overlay');
    if (!overlay?.classList.contains('active')) return;

    if (e.key === 'ArrowRight' || e.key === 'ArrowDown' || e.key === ' ') {
        e.preventDefault();
        _go(1);
    } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
        e.preventDefault();
        _go(-1);
    } else if (e.key === 'Escape') {
        // L'Escape quitte aussi le plein écran nativement — on sort du mode aussi
        exitPresentation();
    } else if (e.key === 'f' || e.key === 'F') {
        _toggleFullscreen();
    }
}

// ─── HUD auto-hide ─────────────────────────────────────────────────────────
function _onMouseMove() {
    _showHud();
}

function _showHud() {
    const hud = document.getElementById('pres-hud');
    if (!hud) return;
    hud.classList.add('visible');
    clearTimeout(hudTimer);
    hudTimer = setTimeout(() => hud.classList.remove('visible'), 2800);
}

// ─── Plein écran toggle ────────────────────────────────────────────────────
function _toggleFullscreen() {
    if (document.fullscreenElement) {
        document.exitFullscreen?.().catch(() => {});
    } else {
        document.documentElement.requestFullscreen?.().catch(() => {});
    }
    _updateFullscreenBtn();
}

function _updateFullscreenBtn() {
    const btn = document.getElementById('pres-fullscreen-btn');
    if (!btn) return;
    const isFs = !!document.fullscreenElement;
    btn.title = isFs ? 'Quitter le plein écran (F)' : 'Plein écran (F)';
    btn.classList.toggle('fs-active', isFs);
}

document.addEventListener('fullscreenchange', _updateFullscreenBtn);
