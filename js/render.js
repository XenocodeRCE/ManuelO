// Rendu des blocs dans la zone de contenu

import { state, REVISION_ALLOWED_BLOCK_TYPES } from './state.js';
import { parseInline, parseMd } from './markdown.js';
import {
    ARGUMENT_ROLE_META,
    computeArgumentStanceMap,
    computeArgumentTreeLayout,
    ensureArgumentMap
} from './argument-map.js';

// ===== HELPER : URL → embed iframe URL =====
function getEmbedUrl(raw) {
    if (!raw) return null;
    try {
        const u = new URL(raw);
        // YouTube
        if (u.hostname === 'youtu.be') {
            const id = u.pathname.slice(1).split('?')[0];
            if (id) return `https://www.youtube-nocookie.com/embed/${id}`;
        }
        if (u.hostname.includes('youtube.com')) {
            const id = u.searchParams.get('v');
            if (id) return `https://www.youtube-nocookie.com/embed/${id}`;
            // already /embed/
            if (u.pathname.startsWith('/embed/')) return u.href;
        }
        // Vimeo
        if (u.hostname === 'vimeo.com') {
            const id = u.pathname.slice(1);
            if (/^\d+$/.test(id)) return `https://player.vimeo.com/video/${id}`;
        }
    } catch (e) {}
    return null;
}

// ===== HELPER : exercise-header label (éditable en mode prof) =====
const PENCIL_SVG = `<svg class="exo-edit-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="11" height="11"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>`;
function exoLabel(block, defaultLabel, color) {
    const canEdit = state.mode === 'prof';
    const title = block.title || defaultLabel;
    const safeDef = defaultLabel.replace(/'/g, "\\'");
    if (canEdit) {
        return `<div class="exercise-label editable" style="color:${color}" data-block-id="${block.id}" onclick="startEditExerciseTitle('${block.id}','${safeDef}')" title="Renommer l'exercice">${title}${PENCIL_SVG}</div>`;
    }
    return `<div class="exercise-label" style="color:${color}">${title}</div>`;
}

// Compute page ranges: [{num, title, subtitle, pbIndex, startIdx, endIdx}]
function getPageRanges() {
    const ranges = [];
    let num = 1, startIdx = 0, pbIndex = -1;
    // Page 1 has its own title stored in meta.page1Title, independent of manual title
    let title    = state.meta.page1Title    || '';
    let subtitle = state.meta.page1Subtitle || '';

    for (let i = 0; i <= state.blocks.length; i++) {
        if (i === state.blocks.length || state.blocks[i].type === 'page-break') {
            ranges.push({ num, title, subtitle, pbIndex, startIdx, endIdx: i });
            if (i < state.blocks.length) {
                num++;
                pbIndex  = i;
                title    = state.blocks[i].title    || '';
                subtitle = state.blocks[i].subtitle || '';
                startIdx = i + 1;
            }
        }
    }
    return ranges;
}

function getRevisionVisibleTypeSet() {
    return new Set(REVISION_ALLOWED_BLOCK_TYPES);
}

function stripMarkdown(raw) {
    return String(raw || '')
        .replace(/\[(.*?)\]\((.*?)\)/g, '$1')
        .replace(/\*\*(.*?)\*\*/g, '$1')
        .replace(/__(.*?)__/g, '$1')
        .replace(/`([^`]+)`/g, '$1')
        .replace(/^[#>\-+\s]+/gm, '')
        .replace(/\s+/g, ' ')
        .trim();
}

function clipText(value, maxLen = 180) {
    const clean = stripMarkdown(value);
    if (clean.length <= maxLen) return clean;
    return `${clean.slice(0, maxLen).trimEnd()}...`;
}

function renderRevisionCompactBlock(block) {
    const titleByType = {
        'section-title': 'Section',
        'definition': 'Definition',
        'distinction': 'Distinction',
        'summary': 'A retenir',
        'warning': 'Attention / Piege',
        'recall': 'Rappel',
        'method': 'Methode',
        'questions': 'Questionnaire',
        'biography': 'Biographie',
        'citation': 'Citation',
        'argument-map': 'Carte d argument',
        'source-text': 'Texte source',
        'text-intro': 'Texte',
        'objectives': 'Objectifs',
        'timeline': 'Frise'
    };

    let heading = titleByType[block.type] || 'Bloc revise';
    let body = '';

    switch (block.type) {
        case 'section-title':
            heading = block.content || heading;
            body = 'Repere de progression du chapitre';
            break;
        case 'definition':
            heading = block.term || heading;
            body = clipText(block.content, 180);
            break;
        case 'distinction':
            heading = `${block.termA || 'Terme A'} / ${block.termB || 'Terme B'}`;
            body = `${clipText(block.explanationA, 110)} ${block.explanationB ? `| ${clipText(block.explanationB, 110)}` : ''}`.trim();
            break;
        case 'summary':
        case 'objectives':
            body = clipText(block.items, 220);
            break;
        case 'warning':
            body = clipText(block.content, 220);
            break;
        case 'recall':
        case 'method':
        case 'text-intro':
        case 'source-text':
        case 'example':
            body = clipText(block.content || block.steps || block.instructions, 220);
            break;
        case 'questions':
            body = clipText(Array.isArray(block.questions) ? block.questions.join(' ; ') : block.questions, 220);
            break;
        case 'biography':
            heading = block.name || heading;
            body = [block.role, block.dates, clipText(block.content, 160)].filter(Boolean).join(' · ');
            break;
        case 'citation':
            body = `${clipText(block.quote, 190)}${block.author ? ` — ${block.author}` : ''}`;
            break;
        case 'argument-map': {
            const map = ensureArgumentMap(block);
            heading = block.title || heading;
            body = clipText(map.thesis?.content || '', 220) || 'These principale disponible en mode carte.';
            break;
        }
        default:
            body = clipText(
                block.content
                || block.prompt
                || block.question
                || block.title
                || block.caption
                || block.instructions,
                220
            );
            break;
    }

    return `<div class="revision-compact-card">
        <div class="revision-compact-head">${heading}</div>
        <div class="revision-compact-meta">${titleByType[block.type] || 'Revision'}</div>
        <div class="revision-compact-body">${parseInline(body || 'Contenu priorise pour la revision.')}</div>
    </div>`;
}

export function renderBlocks() {
    const container = document.getElementById('content-inner');
    const isRevision = state.mode === 'revision';
    const revisionVisibleSet = isRevision ? getRevisionVisibleTypeSet() : null;

    // Clear everything except the edit-banner
    container.querySelectorAll(
        '.block-wrapper, .block-insert-zone, .page-current-header, .page-sheet, .page-empty-hint'
    ).forEach(el => el.remove());

    const ranges  = getPageRanges();
    const total   = ranges.length;
    const cp      = Math.min(Math.max(state.currentPage || 1, 1), total);
    state.currentPage = cp;
    const page    = ranges[cp - 1];

    // Update toolbar indicator
    const indEl = document.getElementById('page-indicator-text');
    if (indEl) indEl.textContent = `Page ${cp} / ${total}`;

    // ── Page header card ──────────────────────────────────────────────────
    const canEdit = state.mode === 'prof';
    const hdr = document.createElement('div');
    hdr.className = 'page-current-header';
    hdr.innerHTML = `
        <div class="pch-badge">
            <span class="pch-num">${cp}</span>
            <span class="pch-total"> / ${total}</span>
        </div>
        <div class="pch-content">
            <div class="pch-title-wrap${canEdit ? ' editable' : ''}"
                 ${canEdit ? `onclick="startEditPageTitle(${page.pbIndex}, 'title')"` : ''}>
                ${page.title
                    ? `<span class="pch-title">${page.title}</span>`
                    : (canEdit ? `<span class="pch-placeholder">Titre de la page…</span>` : '')}
                ${canEdit ? `<svg class="pch-edit-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="12" height="12"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>` : ''}
            </div>
            <div class="pch-subtitle-wrap${canEdit ? ' editable' : ''}"
                 ${canEdit ? `onclick="startEditPageTitle(${page.pbIndex}, 'subtitle')"` : ''}>
                ${page.subtitle
                    ? `<span class="pch-subtitle">${page.subtitle}</span>`
                    : (canEdit ? `<span class="pch-placeholder small">Sous-titre ou description…</span>` : '')}
            </div>
        </div>
        ${canEdit ? `<div class="pch-actions">
            <button class="pch-del-btn" onclick="deleteCurrentPage()" title="Supprimer cette page">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="13" height="13"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                Supprimer la page
            </button>
        </div>` : ''}`;
    container.appendChild(hdr);

    // ── First insert zone (before all blocks on this page) ────────────────
    if (canEdit) {
        // afterIndex = the index just before page.startIdx so new block lands at startIdx
        const firstZoneAfter = page.startIdx === 0 ? -1 : page.startIdx - 1;
        container.appendChild(makeInsertZone(firstZoneAfter));
    }

    // ── Blocks ────────────────────────────────────────────────────────────
    let anyRendered = false;
    for (let i = page.startIdx; i < page.endIdx; i++) {
        const block = state.blocks[i];
        if (!block.visible && state.mode !== 'prof') continue;
        if (isRevision && revisionVisibleSet && !revisionVisibleSet.has(block.type)) continue;
        anyRendered = true;

        const wrapper = document.createElement('div');
        wrapper.className = 'block-wrapper'
            + (canEdit ? ' edit-mode' : '')
            + (isRevision ? ' revision-mode' : '')
            + (!block.visible ? ' hidden-block' : '');
        wrapper.dataset.index = i;
        wrapper.dataset.type  = block.type;
        wrapper.style.animationDelay = `${(i - page.startIdx) * 0.04}s`;

        if (canEdit) {
            wrapper.innerHTML += `
                <button class="block-drag-handle" title="Déplacer le bloc" aria-label="Déplacer le bloc">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="12" height="12"><circle cx="8" cy="6" r="1.2"/><circle cx="16" cy="6" r="1.2"/><circle cx="8" cy="12" r="1.2"/><circle cx="16" cy="12" r="1.2"/><circle cx="8" cy="18" r="1.2"/><circle cx="16" cy="18" r="1.2"/></svg>
                </button>
                <div class="block-controls">
                    <button class="block-ctrl-btn move" onclick="moveBlock(${i}, -1)" title="Monter">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="18 15 12 9 6 15"/></svg>
                    </button>
                    <button class="block-ctrl-btn move" onclick="moveBlock(${i}, 1)" title="Descendre">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"/></svg>
                    </button>
                    <button class="block-ctrl-btn edit" onclick="editBlock(${i})" title="Modifier">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                    </button>
                    <button class="block-ctrl-btn vis" onclick="toggleVisibility(${i})" title="Visibilité">
                        ${block.visible
                            ? '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>'
                            : '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>'
                        }
                    </button>
                    <button class="block-ctrl-btn danger" onclick="deleteBlock(${i})" title="Supprimer">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                    </button>
                </div>`;
        }

        wrapper.innerHTML += isRevision ? renderRevisionCompactBlock(block) : renderBlockContent(block);
        container.appendChild(wrapper);

        if (canEdit) container.appendChild(makeInsertZone(i));
    }

    // Render Mermaid diagrams asynchronously after DOM update
    if (window.mermaid) {
        requestAnimationFrame(() => mermaid.run({ querySelector: '.mermaid:not([data-processed])' }));
    }

    // Init SortableJS on exercise-sort lists (skip if already initialized)
    if (window.Sortable) {
        container.querySelectorAll('.sort-list:not([data-sortable-init])').forEach(el => {
            el.dataset.sortableInit = '1';
            new Sortable(el, { animation: 150, handle: '.sort-handle', ghostClass: 'sort-ghost' });
        });
    }

    // Empty page hint
    if (!anyRendered) {
        const hint = document.createElement('div');
        hint.className = 'page-empty-hint';
        if (canEdit) {
            hint.textContent = 'Page vide — utilisez + pour ajouter un bloc';
        } else if (isRevision) {
            hint.textContent = 'Aucun bloc affiche pour cette page en mode revision.';
        } else {
            hint.textContent = 'Aucun bloc visible sur cette page.';
        }
        container.appendChild(hint);
    }

    updateCounter();

    // ──────────────────────────────────────────────────────────────────────
    // Setup event listeners for Kialo argument-map SVG nodes
    // ──────────────────────────────────────────────────────────────────────
    container.querySelectorAll('.arg-node-svg').forEach(nodeEl => {
        nodeEl.addEventListener('click', (e) => {
            e.stopPropagation();
            const nodeId = nodeEl.getAttribute('data-node-id');
            const blockId = nodeEl.getAttribute('data-block-id');
            if (nodeId && blockId && window.argMapSelectNode) {
                window.argMapSelectNode(blockId, nodeId);
            }
        });

        // Add hover effect
        nodeEl.addEventListener('mouseenter', () => {
            nodeEl.classList.add('hovered');
        });
        nodeEl.addEventListener('mouseleave', () => {
            nodeEl.classList.remove('hovered');
        });
    });
}



function makeInsertZone(afterIndex) {
    const zone = document.createElement('div');
    zone.className = 'block-insert-zone';
    zone.dataset.after = afterIndex;
    zone.innerHTML = `
        <div class="insert-line"></div>
        <button class="block-insert-btn" onclick="insertAt(${afterIndex}, this)" title="Insérer un bloc ici">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" width="14" height="14"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            <span>Insérer un bloc</span>
        </button>
        <div class="insert-line"></div>`;
    return zone;
}

export function renderBlockContent(block) {
    switch (block.type) {
        case 'section-title':
            return `<div class="block-section-title">
                ${block.number ? `<div class="block-section-number">${block.number}</div>` : ''}
                <div class="block-section-text">${block.content}</div>
            </div>`;

        case 'text-intro':
            return `<div class="block-text-intro">${parseMd(block.content)}</div>`;

        case 'source-text':
            return `<div class="block-source-text">
                <div class="source-content">${parseMd(block.content)}</div>
                <div class="source-ref">
                    <span class="author">${block.author}</span>${block.title ? `, <span class="title">${block.title}</span>` : ''}${block.reference ? `, ${block.reference}` : ''}
                </div>
            </div>`;

        case 'image':
            return `<div class="block-image">
                ${block.url
                    ? `<img src="${block.url}" alt="${block.caption || ''}" onerror="this.style.display='none';this.nextElementSibling.style.display='flex'"><div class="placeholder" style="display:none">🖼️</div>`
                    : `<div class="placeholder">🖼️</div>`
                }
                ${block.caption ? `<div class="image-caption">${block.caption}${block.source ? `<div class="image-source">Source : ${block.source}</div>` : ''}</div>` : ''}
            </div>`;

        case 'questions':
            return `<div class="block-questions">
                <div class="block-questions-header">
                    <div class="icon">?</div>
                    <div class="label">Questions</div>
                </div>
                <ol>${block.questions.map(q => `<li>${parseInline(q)}</li>`).join('')}</ol>
            </div>`;

        case 'definition':
            return `<div class="block-definition">
                <div class="block-definition-header">
                    <div class="icon">📖</div>
                    <div class="label">Définition</div>
                </div>
                <div class="term">${block.term}</div>
                <div class="def-content">${parseMd(block.content)}</div>
            </div>`;

        case 'distinction':
            return `<div class="block-distinction">
                <div class="block-distinction-header">
                    <div class="icon">⚖️</div>
                    <div class="label">Distinction conceptuelle</div>
                </div>
                <div class="distinction-grid">
                    <div class="distinction-card">
                        <div class="term">${block.termA}</div>
                        <div class="explanation">${parseMd(block.explanationA)}</div>
                    </div>
                    <div class="distinction-card">
                        <div class="term">${block.termB}</div>
                        <div class="explanation">${parseMd(block.explanationB)}</div>
                    </div>
                </div>
            </div>`;

        case 'exercise-qcm':
            return `<div class="block-exercise-qcm">
                <div class="exercise-header">
                    <div class="icon" style="background:var(--accent)">☑️</div>
                    ${exoLabel(block, 'Exercice — QCM', '#92400e')}
                </div>
                <div class="qcm-question">${parseInline(block.question)}</div>
                <div class="qcm-options">
                    ${block.options.map((opt, i) => `
                        <div class="qcm-option" id="qcm-${block.id}-${i}" onclick="selectQcm('${block.id}', ${i}, ${block.correctIndex})">
                            <span class="letter">${String.fromCharCode(65 + i)}</span>
                            <span>${parseInline(opt)}</span>
                        </div>
                    `).join('')}
                </div>
                <div class="exo-correction">
                    <div class="exo-correction-content">
                        <div class="qcm-correct-hint">✓ Réponse correcte : ${String.fromCharCode(65 + block.correctIndex)}</div>
                    </div>
                    <div class="exo-correction-overlay">
                        <button class="exo-reveal-btn" onclick="revealCorrection(this)">👁 Voir la correction</button>
                    </div>
                </div>
            </div>`;

        case 'exercise-fill': {
            const parts = block.text.split('___');
            let fillHtml = '';
            parts.forEach((part, i) => {
                fillHtml += parseInline(part);
                if (i < block.blanks.length) {
                    const correct = block.blanks[i].correct.replace(/"/g, '&quot;');
                    const options = [block.blanks[i].correct, ...block.blanks[i].distractors].sort(() => Math.random() - 0.5);
                    fillHtml += `<select data-correct="${correct}"><option value="">…</option>${options.map(o => `<option value="${o}">${o}</option>`).join('')}</select>`;
                }
            });
            return `<div class="block-exercise-fill">
                <div class="exercise-header">
                    <div class="icon" style="background:var(--info)">📝</div>
                    ${exoLabel(block, 'Exercice — Texte à trous', '#155e75')}
                </div>
                <div class="fill-text">${fillHtml}</div>
                <button class="exo-check-btn" onclick="checkFill(this)">✔ Vérifier mes réponses</button>
            </div>`;
        }

        case 'exercise-written':
            return `<div class="block-exercise-written">
                <div class="exercise-header">
                    <div class="icon" style="background:var(--primary)">✍️</div>
                    ${exoLabel(block, 'Exercice — Réponse rédigée', 'var(--primary-dark)')}
                </div>
                <div class="written-prompt">${parseMd(block.prompt)}</div>
                <textarea class="written-textarea" rows="${block.lines || 5}" placeholder="Rédigez votre réponse ici…"></textarea>
            </div>`;

        case 'page-break': {
            const idx = state.blocks.indexOf(block);
            const pageNum = state.blocks.slice(0, idx + 1).filter(b => b.type === 'page-break').length + 1;
            const title = block.title || '';
            const subtitle = block.subtitle || '';
            const canEdit = state.mode === 'prof';
            return `<div class="block-page-break">
                <div class="page-break-divider"></div>
                <div class="page-break-header">
                    <div class="page-break-num-badge">Page ${pageNum}</div>
                    <div class="page-break-content">
                        <div class="page-break-title-wrap ${canEdit ? 'editable' : ''}"
                             ${canEdit ? `onclick="startEditPageTitle(${idx}, 'title')"` : ''}>
                            ${title
                                ? `<span class="page-break-title-text">${title}</span>`
                                : (canEdit ? `<span class="page-break-placeholder">Cliquez pour ajouter un titre…</span>` : '')
                            }
                            ${canEdit ? `<svg class="page-break-edit-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="13" height="13"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>` : ''}
                        </div>
                        ${subtitle || canEdit ? `<div class="page-break-subtitle-wrap ${canEdit ? 'editable' : ''}"
                             ${canEdit ? `onclick="startEditPageTitle(${idx}, 'subtitle')"` : ''}>
                            ${subtitle
                                ? `<span class="page-break-subtitle-text">${subtitle}</span>`
                                : (canEdit ? `<span class="page-break-placeholder small">Sous-titre ou description…</span>` : '')
                            }
                        </div>` : ''}
                    </div>
                </div>
            </div>`
        }

        // ===== TEXTE & CONTENU =====

        case 'citation':
            return `<div class="block-citation">
                <div class="citation-mark">"</div>
                <div class="citation-quote">${parseMd(block.quote || '')}</div>
                <div class="citation-attr">
                    ${block.author ? `<span class="citation-author">${block.author}</span>` : ''}
                    ${block.source ? `<span class="citation-source">${block.source}</span>` : ''}
                </div>
            </div>`;

        case 'table': {
            const headers = (block.headers || '').split('|').map(h => h.trim()).filter(Boolean);
            const rows = (block.rows || '').split('\n').filter(r => r.trim());
            return `<div class="block-table">
                ${block.caption ? `<div class="table-caption">${block.caption}</div>` : ''}
                <div class="table-scroll">
                    <table>
                        ${headers.length ? `<thead><tr>${headers.map(h => `<th>${h}</th>`).join('')}</tr></thead>` : ''}
                        <tbody>
                            ${rows.map(r => `<tr>${r.split('|').map(c => `<td>${c.trim()}</td>`).join('')}</tr>`).join('')}
                        </tbody>
                    </table>
                </div>
            </div>`;
        }

        case 'link':
            return `<div class="block-link">
                <div class="link-icon">🔗</div>
                <div class="link-info">
                    <a class="link-label" href="${block.url || '#'}" target="_blank" rel="noopener noreferrer">${block.label || block.url || 'Lien'}</a>
                    ${block.description ? `<div class="link-desc">${block.description}</div>` : ''}
                    ${block.url ? `<div class="link-url-display">${block.url}</div>` : ''}
                </div>
            </div>`;

        case 'media': {
            const embedUrl = getEmbedUrl(block.url || '');
            return `<div class="block-media">
                ${embedUrl
                    ? `<div class="media-embed-wrap">
                        <iframe src="${embedUrl}" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen loading="lazy"></iframe>
                      </div>`
                    : ''}
                <div class="media-info">
                    ${block.title ? `<div class="media-title">${block.title}</div>` : ''}
                    ${block.mediaType ? `<div class="media-type">${block.mediaType}</div>` : ''}
                    ${!embedUrl && block.url ? `<a class="media-url" href="${block.url}" target="_blank" rel="noopener noreferrer">${block.url}</a>` : ''}
                    ${block.description ? `<div class="media-desc">${block.description}</div>` : ''}
                </div>
            </div>`;
        }

        case 'audio': {
            const audioUrl = String(block.url || '').trim();
            return `<div class="block-audio">
                <div class="audio-header">
                    <div class="audio-icon">🎧</div>
                    <div class="audio-header-text">
                        <div class="audio-title">${block.title ? parseInline(block.title) : 'Audio pedagogique'}</div>
                        <div class="audio-type">${block.uploaded ? 'Fichier uploade' : 'Lien externe'}</div>
                    </div>
                </div>
                ${audioUrl
                    ? `<audio class="audio-player" controls preload="metadata" src="${audioUrl}"></audio>
                       <a class="audio-url" href="${audioUrl}" target="_blank" rel="noopener noreferrer">Ouvrir le fichier audio</a>`
                    : `<div class="audio-empty">Aucune source audio renseignee.</div>`
                }
                ${block.description ? `<div class="audio-desc">${parseMd(block.description)}</div>` : ''}
            </div>`;
        }

        case 'diagram': {
            const hasMermaid = !!(block.code && block.code.trim());
            return `<div class="block-diagram">
                <div class="diagram-toolbar">
                    ${block.title ? `<div class="diagram-title">${block.title}</div>` : '<div></div>'}
                    ${hasMermaid ? `<button class="diagram-toggle-btn" onclick="toggleDiagramView(this)">Voir le code</button>` : ''}
                </div>
                ${hasMermaid
                    ? `<div class="diagram-render"><div class="mermaid">${block.code}</div></div>
                       <pre class="diagram-code" style="display:none">${block.code.replace(/</g,'&lt;')}</pre>`
                    : `<div class="diagram-placeholder">📐 Schéma à compléter</div>`}
                ${block.caption ? `<div class="diagram-caption">${block.caption}</div>` : ''}
            </div>`;
        }

        case 'timeline': {
            const events = (block.events || '').split('\n').filter(l => l.trim()).map(l => {
                const sep = l.indexOf('|');
                return { date: sep >= 0 ? l.slice(0, sep).trim() : l.trim(), text: sep >= 0 ? l.slice(sep + 1).trim() : '' };
            });
            return `<div class="block-timeline">
                ${block.title ? `<div class="timeline-title">${block.title}</div>` : ''}
                <div class="timeline-list">
                    ${events.map(ev => `<div class="timeline-event">
                        <div class="timeline-date">${ev.date}</div>
                        <div class="timeline-dot"></div>
                        <div class="timeline-text">${parseInline(ev.text)}</div>
                    </div>`).join('')}
                </div>
            </div>`;
        }

        case 'argument-map':
            return renderArgumentMapBlock(block);

        // ===== PÉDAGOGIE — CALLOUTS =====

        case 'objectives': {
            const items = (block.items || '').split('\n').filter(l => l.trim());
            return `<div class="block-callout" style="--cb:#059669;--cbg:#ecfdf5;--chl:#d1fae5">
                <div class="callout-header">
                    <span class="callout-icon" style="background:var(--chl);color:var(--cb)">🎯</span>
                    <span class="callout-label" style="color:var(--cb)">Objectifs</span>
                </div>
                <ul class="callout-list">${items.map(it => `<li>${parseInline(it)}</li>`).join('')}</ul>
            </div>`;
        }

        case 'summary': {
            const items = (block.items || '').split('\n').filter(l => l.trim());
            return `<div class="block-callout" style="--cb:#15803d;--cbg:#f0fdf4;--chl:#dcfce7">
                <div class="callout-header">
                    <span class="callout-icon" style="background:var(--chl);color:var(--cb)">✅</span>
                    <span class="callout-label" style="color:var(--cb)">À retenir</span>
                </div>
                <ul class="callout-list callout-list--check">${items.map(it => `<li>${parseInline(it)}</li>`).join('')}</ul>
            </div>`;
        }

        case 'method': {
            const steps = (block.steps || '').split('\n').filter(l => l.trim());
            return `<div class="block-callout" style="--cb:#b45309;--cbg:#fffbeb;--chl:#fef3c7">
                <div class="callout-header">
                    <span class="callout-icon" style="background:var(--chl);color:var(--cb)">💡</span>
                    <span class="callout-label" style="color:var(--cb)">Méthode${block.title ? ' — ' + block.title : ''}</span>
                </div>
                <ol class="callout-list">${steps.map(s => `<li>${parseInline(s)}</li>`).join('')}</ol>
            </div>`;
        }

        case 'warning':
            return `<div class="block-callout" style="--cb:#be123c;--cbg:#fff1f2;--chl:#ffe4e6">
                <div class="callout-header">
                    <span class="callout-icon" style="background:var(--chl);color:var(--cb)">⚠️</span>
                    <span class="callout-label" style="color:var(--cb)">Attention / Piège</span>
                </div>
                <div class="callout-body">${parseMd(block.content || '')}</div>
            </div>`;

        case 'recall':
            return `<div class="block-callout" style="--cb:#1d4ed8;--cbg:#eff6ff;--chl:#dbeafe">
                <div class="callout-header">
                    <span class="callout-icon" style="background:var(--chl);color:var(--cb)">🧠</span>
                    <span class="callout-label" style="color:var(--cb)">Rappel / Prérequis</span>
                </div>
                <div class="callout-body">${parseMd(block.content || '')}</div>
            </div>`;

        case 'biography':
            return `<div class="block-biography">
                <div class="bio-avatar">
                    ${block.avatarUrl
                        ? `<img src="${block.avatarUrl}" alt="${block.name || ''}" onerror="this.style.display='none';this.nextElementSibling.style.display='block'">
                           <span style="display:none">👤</span>`
                        : `<span>👤</span>`}
                </div>
                <div class="bio-info">
                    <div class="bio-name">${block.name || ''}</div>
                    ${block.dates ? `<div class="bio-dates">${block.dates}</div>` : ''}
                    ${block.role ? `<div class="bio-role">${block.role}</div>` : ''}
                    ${block.content ? `<div class="bio-content">${parseMd(block.content)}</div>` : ''}
                </div>
            </div>`;

        case 'example':
            return `<div class="block-callout" style="--cb:#0e7490;--cbg:#ecfeff;--chl:#cffafe">
                <div class="callout-header">
                    <span class="callout-icon" style="background:var(--chl);color:var(--cb)">💬</span>
                    <span class="callout-label" style="color:var(--cb)">Exemple${block.title ? ' — ' + block.title : ''}</span>
                </div>
                <div class="callout-body">${parseMd(block.content || '')}</div>
            </div>`;

        // ===== EXERCICES =====

        case 'exercise-truefalse': {
            const stmts = (block.statements || '').split('\n').filter(l => l.trim());
            const answers = (block.answers || '').split('\n').map(a => a.trim().toUpperCase());
            return `<div class="block-exercise-truefalse">
                <div class="exercise-header">
                    <div class="icon" style="background:#dcfce7;color:#16a34a">✔️</div>
                    ${exoLabel(block, 'Exercice — Vrai / Faux', '#15803d')}
                </div>
                <div class="tf-list">
                    ${stmts.map((s, i) => `<div class="tf-item">
                        <span class="tf-stmt">${parseInline(s)}</span>
                        <div class="tf-btns">
                            <button class="tf-btn" onclick="this.classList.toggle('selected');this.nextElementSibling.classList.remove('selected')">V</button>
                            <button class="tf-btn" onclick="this.classList.toggle('selected');this.previousElementSibling.classList.remove('selected')">F</button>
                        </div>
                        ${answers[i] ? `<div class="exo-correction inline">
                            <div class="exo-correction-content"><span class="tf-answer ${answers[i] === 'V' ? 'tf-v' : 'tf-f'}">${answers[i] === 'V' ? '✓ Vrai' : '✗ Faux'}</span></div>
                            <div class="exo-correction-overlay"><button class="exo-reveal-btn small" onclick="revealCorrection(this)">👁</button></div>
                        </div>` : ''}
                    </div>`).join('')}
                </div>
                ${answers.some(a => a) ? `<button class="exo-check-btn" onclick="checkTrueFalse(this)">✔ Vérifier mes réponses</button>` : ''}
            </div>`;
        }

        case 'exercise-match': {
            const lefts = (block.leftItems || '').split('\n').filter(l => l.trim());
            const rights = (block.rightItems || '').split('\n').filter(l => l.trim());
            const shuffledRights = [...rights].sort(() => Math.random() - 0.5);
            const esc = s => s.replace(/&/g, '&amp;').replace(/"/g, '&quot;');
            return `<div class="block-exercise-match">
                <div class="exercise-header">
                    <div class="icon" style="background:#f3e8ff;color:#9333ea">🔀</div>
                    ${exoLabel(block, 'Exercice — Association / Relier', '#7e22ce')}
                </div>
                <div class="match-rows">
                    ${lefts.map((l, i) => `<div class="match-row">
                        <div class="match-item match-left">${parseInline(l)}</div>
                        <span class="match-arrow">→</span>
                        <select class="match-select" data-correct="${esc(rights[i] || '')}">
                            <option value="">— choisir —</option>
                            ${shuffledRights.map(r => `<option value="${esc(r)}">${r}</option>`).join('')}
                        </select>
                    </div>`).join('')}
                </div>
                <button class="exo-check-btn" onclick="checkMatch(this)">✔ Vérifier les associations</button>
                <div class="exo-correction">
                    <div class="exo-correction-content">
                        <div class="match-corr"><strong>Corr. :</strong> ${lefts.map((l, i) => `${l} → ${rights[i] || '?'}`).join(' | ')}</div>
                    </div>
                    <div class="exo-correction-overlay">
                        <button class="exo-reveal-btn" onclick="revealCorrection(this)">👁 Voir la correction</button>
                    </div>
                </div>
            </div>`;
        }

        case 'exercise-table': {
            const hdr = (block.headers || '').split('|').map(h => h.trim()).filter(Boolean);
            const rows = (block.rows || '').split('\n').filter(r => r.trim());
            return `<div class="block-exercise-table">
                <div class="exercise-header">
                    <div class="icon" style="background:#dbeafe;color:#1d4ed8">📊</div>
                    ${exoLabel(block, 'Exercice — Tableau à compléter', '#1e40af')}
                </div>
                ${block.caption ? `<div class="exo-caption">${block.caption}</div>` : ''}
                <div class="table-scroll">
                    <table class="exo-table">
                        ${hdr.length ? `<thead><tr>${hdr.map(h => `<th>${h}</th>`).join('')}</tr></thead>` : ''}
                        <tbody>
                            ${rows.map(r => `<tr>${r.split('|').map(c => {
                                const cell = c.trim();
                                return cell === '???' ? `<td><input class="fill-cell" placeholder="…"></td>` : `<td>${cell}</td>`;
                            }).join('')}</tr>`).join('')}
                        </tbody>
                    </table>
                </div>
            </div>`;
        }

        case 'exercise-document': {
            const qs = (block.questions || '').split('\n').filter(q => q.trim());
            return `<div class="block-exercise-document">
                <div class="exercise-header">
                    <div class="icon" style="background:#fed7aa;color:#c2410c">📂</div>
                    ${exoLabel(block, 'Étude de document' + (block.docTitle ? ' — ' + block.docTitle : ''), '#9a3412')}
                </div>
                ${block.content ? `<div class="doc-content">${parseMd(block.content)}</div>` : ''}
                ${block.source ? `<div class="doc-source">Source : ${block.source}</div>` : ''}
                ${qs.length ? `<div class="doc-questions">
                    <div class="doc-questions-label">Questions</div>
                    <ol>${qs.map(q => `<li>${parseInline(q)}</li>`).join('')}</ol>
                </div>` : ''}
            </div>`;
        }

        case 'exercise-sort': {
            const items = (block.items || '').split('\n').filter(i => i.trim());
            const display = [...items].sort(() => Math.random() - 0.5);
            const correctJson = encodeURIComponent(JSON.stringify(items));
            return `<div class="block-exercise-sort" data-correct="${correctJson}">
                <div class="exercise-header">
                    <div class="icon" style="background:#f3e8ff;color:#7c3aed">🔢</div>
                    ${exoLabel(block, 'Exercice — Classement', '#6d28d9')}
                </div>
                ${block.instruction ? `<div class="sort-instruction">${block.instruction}</div>` : ''}
                <div class="sort-list">
                    ${display.map(item => `<div class="sort-item" data-value="${item.replace(/"/g, '&quot;')}"><span class="sort-handle">⠿</span><span class="sort-text">${parseInline(item)}</span></div>`).join('')}
                </div>
                <button class="exo-check-btn" onclick="checkSort(this)">✔ Vérifier l'ordre</button>
                <div class="exo-correction">
                    <div class="exo-correction-content">
                        <div class="sort-corr"><strong>Ordre correct :</strong> ${items.map(it => parseInline(it)).join(' → ')}</div>
                    </div>
                    <div class="exo-correction-overlay">
                        <button class="exo-reveal-btn" onclick="revealCorrection(this)">👁 Voir la correction</button>
                    </div>
                </div>
            </div>`;
        }

        // ===== ACTIVITÉS =====

        case 'activity-group':
            return `<div class="block-callout" style="--cb:#059669;--cbg:#ecfdf5;--chl:#d1fae5">
                <div class="callout-header">
                    <span class="callout-icon" style="background:var(--chl);color:var(--cb)">👥</span>
                    <span class="callout-label" style="color:var(--cb)">Travail de groupe${block.title ? ' — ' + block.title : ''}</span>
                    ${block.duration ? `<span class="callout-badge" style="color:var(--cb);background:var(--chl)" onclick="openTimer(this)" title="Démarrer le minuteur">⏱ ${block.duration}</span>` : ''}
                </div>
                ${block.groups ? `<div class="callout-meta">👤 ${block.groups}</div>` : ''}
                ${block.instructions ? `<div class="callout-body">${parseMd(block.instructions)}</div>` : ''}
            </div>`;

        case 'activity-oral':
            return `<div class="block-callout" style="--cb:#c2410c;--cbg:#fff7ed;--chl:#fed7aa">
                <div class="callout-header">
                    <span class="callout-icon" style="background:var(--chl);color:var(--cb)">🎭</span>
                    <span class="callout-label" style="color:var(--cb)">Activité orale${block.activityType ? ' — ' + block.activityType : ''}${block.title ? ' : ' + block.title : ''}</span>
                    ${block.duration ? `<span class="callout-badge" style="color:var(--cb);background:var(--chl)" onclick="openTimer(this)" title="Démarrer le minuteur">⏱ ${block.duration}</span>` : ''}
                </div>
                ${block.instructions ? `<div class="callout-body">${parseMd(block.instructions)}</div>` : ''}
            </div>`;

        case 'activity-instruction':
            return `<div class="block-callout" style="--cb:#0369a1;--cbg:#f0f9ff;--chl:#e0f2fe">
                <div class="callout-header">
                    <span class="callout-icon" style="background:var(--chl);color:var(--cb)">📋</span>
                    <span class="callout-label" style="color:var(--cb)">Consigne${block.title ? ' — ' + block.title : ''}</span>
                </div>
                ${block.instructions ? `<div class="callout-body">${parseMd(block.instructions)}</div>` : ''}
            </div>`;

        case 'differentiation':
            return `<div class="block-differentiation">
                <div class="diff-header">
                    <span>⭐</span> Différenciation pédagogique
                </div>
                <div class="diff-grid">
                    ${block.standard  ? `<div class="diff-card diff-standard"><div class="diff-label">Standard</div><div class="diff-content">${parseMd(block.standard)}</div></div>` : ''}
                    ${block.advanced  ? `<div class="diff-card diff-advanced"><div class="diff-label">Approfondissement</div><div class="diff-content">${parseMd(block.advanced)}</div></div>` : ''}
                    ${block.supported ? `<div class="diff-card diff-supported"><div class="diff-label">Aide</div><div class="diff-content">${parseMd(block.supported)}</div></div>` : ''}
                </div>
            </div>`;

        default:
            return `<div style="padding:12px;color:var(--text-muted);font-style:italic;font-size:13px;">Bloc inconnu (${block.type})</div>`;
    }
}

function escHtml(value) {
    return String(value || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function plainText(value) {
    return String(value || '')
        .replace(/\*\*|__|`|==|~~/g, '')
        .replace(/\{([^|}]+)\|([^}]+)\}/g, '$1')
        .replace(/\[[^\]]+\]\(([^)]+)\)/g, '$1')
        .replace(/<[^>]+>/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

function clipNodeText(value, maxLen = 88) {
    const cleaned = plainText(value);
    if (cleaned.length <= maxLen) return cleaned;
    return `${cleaned.slice(0, maxLen).trimEnd()}...`;
}

function wrapNodeText(value, maxCharsPerLine = 22, maxLines = 3) {
    const words = clipNodeText(value).split(' ').filter(Boolean);
    if (!words.length) return ['Argument'];

    const lines = [];
    let current = '';
    for (const word of words) {
        const next = current ? `${current} ${word}` : word;
        if (next.length <= maxCharsPerLine || !current) {
            current = next;
            continue;
        }
        lines.push(current);
        current = word;
        if (lines.length === maxLines - 1) break;
    }

    if (lines.length < maxLines && current) {
        lines.push(current);
    }

    if (lines.length > maxLines) {
        return lines.slice(0, maxLines);
    }

    if (words.length && lines.length === maxLines) {
        const joined = lines.join(' ');
        if (joined.length < plainText(value).length) {
            lines[maxLines - 1] = `${lines[maxLines - 1].replace(/\.\.\.$/, '')}...`;
        }
    }

    return lines;
}

function renderArgumentMapBlock(block) {
    const map = ensureArgumentMap(block);
    const layout = computeArgumentTreeLayout(map.thesis, 'TREE');
    const stanceById = computeArgumentStanceMap(map.thesis);
    const canEdit = state.mode === 'prof';
    const nodeById = new Map(layout.nodes.map(n => [n.id, n]));
    const nodeWidth = 184;
    const nodeHeight = 66;
    const panelOpen = window.__argMapPanelState?.[String(block.id)] !== false;

    // ──────────────────────────────────────────────────────────────────────
    // 1. RENDER SIBLING GROUPING BACKGROUNDS (gray bubbles)
    // ──────────────────────────────────────────────────────────────────────
    const siblingGroups = new Map();
    layout.nodes.forEach(entry => {
        if (entry.parentId) {
            const key = `parent_${entry.parentId}`;
            if (!siblingGroups.has(key)) {
                siblingGroups.set(key, []);
            }
            siblingGroups.get(key).push(entry);
        }
    });

    const siblingGroupSvg = Array.from(siblingGroups.values())
        .filter(group => group.length > 1) // Only group if > 1 sibling
        .map(group => {
            const xs = group.map(n => n.x);
            const ys = group.map(n => n.y);
            const minX = Math.min(...xs) - 16;
            const maxX = Math.max(...xs) + nodeWidth + 16;
            const minY = Math.min(...ys) - 14;
            const maxY = Math.max(...ys) + nodeHeight + 14;
            
            return `<rect x="${minX}" y="${minY}" width="${maxX - minX}" height="${maxY - minY}" 
                           rx="8" ry="8" fill="rgba(0,0,0,0.05)" stroke="none" class="arg-sibling-group" />`;
        }).join('');

    // ──────────────────────────────────────────────────────────────────────
    // 2. RENDER ORTHOGONAL EDGES (L-shaped paths)
    // ──────────────────────────────────────────────────────────────────────
    const edges = layout.edges.map(edge => {
        const from = nodeById.get(edge.from);
        const to = nodeById.get(edge.to);
        if (!from || !to) return '';

        const toNode = to.node;
        const role = toNode.role === 'OBJECTION' ? 'OBJECTION' : 'SUPPORT';
        const isRootThesis = from.node.role === 'THESIS';

        // Colors for edges based on role
        let edgeColor = '#00796B'; // Default: Pro/Support (teal)
        if (role === 'OBJECTION') {
            edgeColor = '#D84315'; // Con (red-orange)
        }

        // Positions (node centers)
        const x1 = from.x + nodeWidth / 2;
        const y1 = from.y + nodeHeight;
        const x2 = to.x + nodeWidth / 2;
        const y2 = to.y;

        // Orthogonal path: vertical then horizontal
        const midY = (y1 + y2) / 2;
        const d = `M ${x1} ${y1} L ${x1} ${midY} L ${x2} ${midY} L ${x2} ${y2}`;

        return `<path d="${d}" 
                       stroke="${edgeColor}" 
                       stroke-width="2" 
                       fill="none" 
                       stroke-linecap="round"
                       stroke-linejoin="round"
                       class="arg-edge role-${role.toLowerCase()}" />`;
    }).join('');

    // ──────────────────────────────────────────────────────────────────────
    // 3. RENDER RECTANGULAR NODES (SVG rect + text)
    // ──────────────────────────────────────────────────────────────────────
    const nodeElements = layout.nodes.map(entry => {
        const node = entry.node;
        const role = node.role;
        const nodeId = node.id;
        const blockId = block.id;

        // Kialo colors
        let fillColor = '#ffffff';
        let borderColor = '#00796B'; // Default: teal (pro)
        let borderWidth = 2;

        if (role === 'THESIS') {
            fillColor = '#1565C0';    // Blue
            borderColor = '#1565C0';
        } else if (role === 'OBJECTION') {
            fillColor = '#ffffff';
            borderColor = '#D84315';  // Red-orange
        } else {
            // SUPPORT
            fillColor = '#ffffff';
            borderColor = '#00796B';  // Teal
        }

        // Node dimensions
        const rectX = entry.x;
        const rectY = entry.y;

        const nodeText = clipNodeText(node.content || (role === 'THESIS' ? 'Thèse' : 'Nouvel argument'), 90);
        const nodeLines = wrapNodeText(nodeText, 21, 3);
        const textColor = role === 'THESIS' ? '#ffffff' : '#000000';
        const roleShort = role === 'THESIS' ? 'T' : (role === 'OBJECTION' ? '−' : '+');
        const roleLabel = role === 'THESIS' ? 'Thèse' : (role === 'OBJECTION' ? 'Contre' : 'Pour');
        const lineStartY = rectY + 34;
        const tspans = nodeLines.map((line, index) => `<tspan x="${rectX + 14}" dy="${index === 0 ? 0 : 13}">${escHtml(line)}</tspan>`).join('');

        const rectSvg = `<g class="arg-node-svg role-${role.toLowerCase()}" 
                            data-node-id="${escHtml(nodeId)}" 
                            data-block-id="${escHtml(blockId)}"
                            onclick="argMapSelectNode('${escHtml(blockId)}', '${escHtml(nodeId)}')"
                            style="cursor: pointer;">
                    <rect x="${rectX}" y="${rectY}" 
                          width="${nodeWidth}" height="${nodeHeight}" 
                          rx="4" ry="4"
                          fill="${fillColor}" 
                          stroke="${borderColor}" 
                          stroke-width="${borderWidth}"
                          class="arg-rect" />
                      <text x="${rectX + 14}" y="${rectY + 16}"
                          font-size="10"
                          font-weight="800"
                          fill="${textColor}"
                          class="arg-label arg-label-role">${roleShort} ${escHtml(roleLabel)}</text>
                      <text x="${rectX + 14}" y="${lineStartY}"
                          font-size="11"
                          font-weight="600"
                          fill="${textColor}"
                          class="arg-label arg-label-text">${tspans}</text>
                </g>`;

        return rectSvg;
    }).join('');

    // ──────────────────────────────────────────────────────────────────────
    // 4. BUILD COMPLETE SVG
    // ──────────────────────────────────────────────────────────────────────
    const svgContent = `<svg class="argmap-svg-kialo" viewBox="0 0 ${layout.width} ${layout.height}" 
                              style="width: 100%; height: 100%; min-height: 400px;">
        <!-- Sibling grouping backgrounds -->
        <g class="sibling-groups">
            ${siblingGroupSvg}
        </g>
        <!-- Edges (orthogonal paths) -->
        <g class="edges">
            ${edges}
        </g>
        <!-- Nodes (rectangles with text labels) -->
        <g class="nodes">
            ${nodeElements}
        </g>
    </svg>`;

    // ──────────────────────────────────────────────────────────────────────
    // 5. RENDER NODE DETAIL PANEL (pre-filled with thesis)
    // ──────────────────────────────────────────────────────────────────────
    const thesisDetailHTML = buildArgumentNodeDetailPanelHTML(
        block.id,
        map.thesis,
        canEdit
    );
    const nodeDetailPanel = `<div class="argmap-detail-panel" id="argmap-detail-${escHtml(block.id)}">
        ${thesisDetailHTML}
    </div>`;

    // ──────────────────────────────────────────────────────────────────────
    // 6. ASSEMBLE FINAL BLOCK HTML
    // ──────────────────────────────────────────────────────────────────────
    return `<div class="block-argument-map kialo-style${panelOpen ? '' : ' is-panel-collapsed'}" data-block-id="${escHtml(block.id)}">
        <div class="argmap-header">
            <div class="argmap-title-wrap">
                <div class="argmap-title">🗺️ ${escHtml(block.title || 'Carte d\'argument interactive')}</div>
                ${map.isExercise ? '<span class="argmap-badge">Mode exercice</span>' : ''}
            </div>
            <div class="argmap-toolbar">
                <button type="button" class="argmap-toolbar-btn" onclick="argMapToggleDetailPanel('${escHtml(block.id)}')">${panelOpen ? 'Masquer le panneau' : 'Afficher le panneau'}</button>
                ${canEdit ? `<button type="button" class="argmap-toolbar-btn" onclick="argMapEditThesis('${escHtml(block.id)}','${escHtml(map.thesis.id)}')">Modifier thèse</button>` : ''}
            </div>
        </div>

        <div class="argmap-canvas-wrap">
            <div class="argmap-main">
                ${svgContent}
            </div>
            <button type="button" class="argmap-panel-peek" onclick="argMapToggleDetailPanel('${escHtml(block.id)}', true)">Détails</button>
            ${nodeDetailPanel}
        </div>
    </div>`;
}

function buildArgumentNodeDetailPanelHTML(blockId, node, canEdit) {
    const role = node.role;
    const roleLabel = role === 'THESIS' ? 'Thèse' : (role === 'OBJECTION' ? 'Argument contre' : 'Argument pour');
    
    const content = node.content ? parseMd(node.content) : '<em>Aucun contenu</em>';
    const author = node.author ? `<div class="detail-author">— ${escHtml(node.author)}</div>` : '';
    
    // Buttons to add children
    const addButtons = `
        <div class="detail-add-buttons">
            <button type="button" class="btn btn-sm btn-success" onclick="argMapAddNode('${escHtml(blockId)}', '${escHtml(node.id)}', 'SUPPORT')">+ Pour</button>
            <button type="button" class="btn btn-sm btn-danger" onclick="argMapAddNode('${escHtml(blockId)}', '${escHtml(node.id)}', 'OBJECTION')">+ Contre</button>
        </div>
    `;
    
    // Edit button
    const editBtn = canEdit ? `
        <div class="detail-edit-buttons">
            <button type="button" class="btn btn-sm btn-primary" onclick="argMapEditNode('${escHtml(blockId)}', '${escHtml(node.id)}')">✎ Modifier thèse</button>
        </div>
    ` : '';
    
    // Link buttons
    const linkBtns = [
        node.sourceRef ? `<button type="button" class="btn btn-link btn-sm" onclick="argMapJumpToSource('${escHtml(blockId)}', '${escHtml(node.id)}')">📖 Bloc source</button>` : '',
        node.externalUrl ? `<a class="btn btn-link btn-sm" href="${escHtml(node.externalUrl)}" target="_blank" rel="noopener noreferrer">🌐 Lien externe</a>` : ''
    ].filter(Boolean).join('');
    
    const sourceText = node.sourceText ? `<div class="detail-source-text"><small>${parseInline(node.sourceText)}</small></div>` : '';
    
    return `<div class="detail-content">
        <div class="detail-header">
            <span class="detail-role-badge" style="background: #1565C0; color: white; padding: 6px 12px; border-radius: 4px; font-size: 12px; font-weight: 600;">
                ${roleLabel}
            </span>
            <button type="button" class="argmap-detail-close" onclick="argMapToggleDetailPanel('${escHtml(blockId)}', false)">Masquer</button>
        </div>
        <div class="detail-text">${content}</div>
        ${author}
        ${sourceText}
        ${linkBtns ? `<div class="detail-links">${linkBtns}</div>` : ''}
        ${addButtons}
        ${editBtn}
    </div>`;
}

export function updateCounter() {
    const revisionVisibleSet = state.mode === 'revision' ? getRevisionVisibleTypeSet() : null;
    const isCounted = (block) => {
        if (block.type === 'page-break') return false;
        if (state.mode !== 'revision') return true;
        if (!revisionVisibleSet) return true;
        return revisionVisibleSet.has(block.type);
    };
    const visible = state.blocks.filter(b => isCounted(b) && b.visible).length;
    const total   = state.blocks.filter(isCounted).length;
    document.getElementById('block-counter').textContent = `${total} blocs · ${visible} visibles`;
}

export function getPages() {
    return getPageRanges().map(r => ({
        num:        r.num,
        title:      r.title    || `Page ${r.num}`,
        subtitle:   r.subtitle || '',
        blockIndex: r.pbIndex
    }));
}


export function renderSidebar() {
    const m = state.meta;

    const badge = document.getElementById('sidebar-chapter-badge');
    const theme = document.getElementById('sidebar-chapter-theme');
    const title = document.getElementById('sidebar-title');
    const meta  = document.getElementById('sidebar-meta');

    if (badge)  badge.textContent  = m.subject || 'Manuel';
    if (theme)  theme.textContent  = m.level   || '';
    if (title)  title.innerHTML    = m.title    || 'Nouveau manuel';
    if (meta)   meta.innerHTML     = '';

    const perspective = document.getElementById('sidebar-perspective');
    if (perspective) perspective.textContent = '';

    const authorCard = document.getElementById('sidebar-author-card');
    if (authorCard) authorCard.style.display = 'none';
}
