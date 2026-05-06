// PDF Export module — ManuelO
// Builds a print-ready DOM area and triggers window.print()
// No external dependencies — pure browser APIs

import { state, REVISION_ALLOWED_BLOCK_TYPES } from './state.js';
import { renderBlockContent } from './render.js';

function _getRevisionVisibleTypeSet() {
    if (state.mode !== 'revision') return null;
    return new Set(REVISION_ALLOWED_BLOCK_TYPES);
}

// ── Open / Close modal ──────────────────────────────────

export function openPdfExport() {
    const overlay = document.getElementById('pdf-modal-overlay');
    // Pre-fill header left with manual title if empty
    const headerInput = document.getElementById('pdf-header-left');
    if (headerInput && !headerInput.value) {
        headerInput.value = state.meta.title || '';
    }
    overlay.classList.add('active');
}

export function closePdfExport() {
    document.getElementById('pdf-modal-overlay').classList.remove('active');
}

export function closePdfExportOnOverlay(e) {
    if (e.target === document.getElementById('pdf-modal-overlay')) closePdfExport();
}

// ── Read config from form ───────────────────────────────

function _readConfig() {
    const v     = id => document.getElementById(id)?.value?.trim() || '';
    const chk   = id => document.getElementById(id)?.checked ?? false;
    const radio = name => document.querySelector(`input[name="${name}"]:checked`)?.value || '';
    return {
        format:      radio('pdf-format')      || 'A4',
        orientation: radio('pdf-orientation') || 'portrait',
        fontSize:    radio('pdf-fontsize')    || 'normal',
        colorMode:   radio('pdf-color')       || 'couleur',
        toc:         chk('pdf-toc'),
        headerLeft:  v('pdf-header-left'),
        watermark:   v('pdf-watermark'),
    };
}

// ── Launch print ────────────────────────────────────────

export function launchPrint() {
    const config = _readConfig();

    // Inject @page rule with chosen size/orientation and font size
    let pageStyle = document.getElementById('pdf-page-style');
    if (!pageStyle) {
        pageStyle = document.createElement('style');
        pageStyle.id = 'pdf-page-style';
        document.head.appendChild(pageStyle);
    }
    const sizeMap = { A4: 'A4', A5: 'A5', LIVRET: 'A4' };
    const fontMap = { normal: '10.5pt', grand: '13pt', 'tres-grand': '15pt' };
    const pageSize  = sizeMap[config.format] || 'A4';
    const fontPt    = fontMap[config.fontSize] || '10.5pt';
    pageStyle.textContent = `
        @page { size: ${pageSize} ${config.orientation}; margin: 2cm 2.5cm; }
        @media print { #pdf-print-area { font-size: ${fontPt}; } }
    `;

    // Color mode body classes (consumed by @media print in pdf.css)
    document.body.classList.remove('pdf-grayscale', 'pdf-bw');
    if (config.colorMode === 'gris') document.body.classList.add('pdf-grayscale');
    if (config.colorMode === 'nb')   document.body.classList.add('pdf-bw');

    // Build the hidden print area
    _buildPrintArea(config);

    // Flag body so CSS hides everything except the print area
    document.body.classList.add('pdf-printing');

    // Close modal, then print
    closePdfExport();
    window.print();

    // Cleanup after user closes the print dialog
    window.addEventListener('afterprint', _cleanup, { once: true });
}

function _cleanup() {
    document.body.classList.remove('pdf-printing', 'pdf-grayscale', 'pdf-bw');
    const area = document.getElementById('pdf-print-area');
    if (area) area.innerHTML = '';
    document.getElementById('pdf-page-style')?.remove();
}

// ── Build print area ────────────────────────────────────

function _buildPrintArea(config) {
    const area = document.getElementById('pdf-print-area');
    area.innerHTML = '';
    const revisionVisibleSet = _getRevisionVisibleTypeSet();

    // Optional fixed header (repeated on every printed page via position:fixed in @media print)
    if (config.headerLeft) {
        const hdr = document.createElement('div');
        hdr.className = 'pdf-page-header';
        hdr.innerHTML = `<span class="pdf-header-left">${_esc(config.headerLeft)}</span>
                         <span class="pdf-header-right">${_esc(state.meta.subject || '')}</span>`;
        area.appendChild(hdr);
    }

    // Optional watermark (fixed, repeated on every page)
    if (config.watermark) {
        const wm = document.createElement('div');
        wm.className = 'pdf-watermark';
        wm.textContent = config.watermark;
        area.appendChild(wm);
    }

    // Optional TOC (on its own page, before content)
    if (config.toc) {
        area.appendChild(_buildTOC());
    }

    // ── Build ALL pages from state.blocks (not from the live DOM) ──
    // This avoids: only-current-page issue, animation delays, edit-mode UI
    const showHidden = state.mode === 'prof'; // in prof mode, print hidden blocks too (greyed)

    state.blocks.forEach(block => {
        if (!showHidden && block.visible === false) return;
        if (revisionVisibleSet && block.type !== 'page-break' && !revisionVisibleSet.has(block.type)) return;

        if (block.type === 'page-break') {
            // Insert a CSS page break + optional page title
            const sep = document.createElement('div');
            sep.className = 'pdf-page-sep';
            if (block.title || block.subtitle) {
                sep.innerHTML =
                    (block.title    ? `<div class="pdf-page-sep-title">${_esc(block.title)}</div>` : '') +
                    (block.subtitle ? `<div class="pdf-page-sep-subtitle">${_esc(block.subtitle)}</div>` : '');
            }
            area.appendChild(sep);
            return;
        }

        const wrapper = document.createElement('div');
        wrapper.className = 'pdf-block' + (block.visible === false ? ' pdf-block-hidden' : '');

        // Use the same render function as the editor — guaranteed correct HTML
        wrapper.innerHTML = renderBlockContent(block);

        // ── Post-process: replace interactive widgets with print equivalents ──

        // iframes / audio / video → placeholder
        wrapper.querySelectorAll('iframe, audio, video').forEach(mediaEl => {
            const src   = mediaEl.getAttribute('src') || mediaEl.src || '';
            const title = wrapper.querySelector('.media-title, h3')?.textContent?.trim() || 'Ressource multimédia';
            mediaEl.replaceWith(_mediaPlaceholderEl(title, src));
        });

        // fill-blank <select> → underline span
        wrapper.querySelectorAll('select.fill-blank').forEach(sel => {
            const span = document.createElement('span');
            span.className = 'pdf-fill-blank';
            span.textContent = '\u00A0'.repeat(10);
            sel.replaceWith(span);
        });

        // Sort-list drag handles are visual noise in print
        wrapper.querySelectorAll('.sort-handle').forEach(el => el.remove());

        // Exo-correction overlays: reveal the answer directly in print (no click needed)
        wrapper.querySelectorAll('.exo-correction').forEach(el => el.classList.add('revealed'));

        // Check buttons not needed in print
        wrapper.querySelectorAll('.exo-check-btn').forEach(el => el.remove());

        area.appendChild(wrapper);
    });
}

// ── Table of contents ───────────────────────────────────

function _buildTOC() {
    const toc = document.createElement('div');
    toc.className = 'pdf-toc';

    const heading = document.createElement('div');
    heading.className = 'pdf-toc-heading';
    heading.textContent = 'Table des matières';
    toc.appendChild(heading);

    let pageNum = 1;
    let count   = 0;
    const showHidden = state.mode === 'prof';
    const revisionVisibleSet = _getRevisionVisibleTypeSet();

    state.blocks.forEach(block => {
        if (!showHidden && block.visible === false) return;
        if (revisionVisibleSet && block.type !== 'page-break' && !revisionVisibleSet.has(block.type)) return;
        if (block.type === 'page-break') { pageNum++; return; }
        if (block.type === 'section-title') {
            count++;
            const entry = document.createElement('div');
            entry.className = 'pdf-toc-entry';
            // section-title stores its text in block.content (not block.title)
            const label = block.content || 'Section sans titre';
            entry.innerHTML =
                `<span class="pdf-toc-num">${count}.</span>` +
                `<span class="pdf-toc-label">${_esc(label)}</span>` +
                `<span class="pdf-toc-dots"></span>` +
                `<span class="pdf-toc-page">p.\u202F${pageNum}</span>`;
            toc.appendChild(entry);
        }
    });

    if (count === 0) {
        const msg = document.createElement('p');
        msg.className = 'pdf-toc-empty';
        msg.textContent = 'Aucun titre de section dans ce manuel.';
        toc.appendChild(msg);
    }

    return toc;
}

// ── Helpers ─────────────────────────────────────────────

function _mediaPlaceholderEl(title, url) {
    const isVideo = /youtube|vimeo|video/i.test(url);
    const icon    = isVideo ? '🎬' : '🔊';
    const short   = url.length > 72 ? url.slice(0, 72) + '…' : url;
    const div = document.createElement('div');
    div.className = 'pdf-media-ph';
    div.innerHTML = `<span class="pdf-media-ph-icon">${icon}</span>
        <div class="pdf-media-ph-info">
            <div class="pdf-media-ph-title">${_esc(title)}</div>
            ${url ? `<div class="pdf-media-ph-url">${_esc(short)}</div>` : ''}
        </div>`;
    return div;
}

function _esc(str) {
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}
