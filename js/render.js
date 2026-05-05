// Rendu des blocs dans la zone de contenu

import { state } from './state.js';
import { parseInline, parseMd } from './markdown.js';

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

export function renderBlocks() {
    const container = document.getElementById('content-inner');

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
        if (!block.visible && state.mode === 'eleve') continue;
        anyRendered = true;

        const wrapper = document.createElement('div');
        wrapper.className = 'block-wrapper'
            + (canEdit ? ' edit-mode' : '')
            + (!block.visible ? ' hidden-block' : '');
        wrapper.dataset.index = i;
        wrapper.dataset.type  = block.type;
        wrapper.style.animationDelay = `${(i - page.startIdx) * 0.04}s`;

        if (canEdit) {
            wrapper.innerHTML += `
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

        wrapper.innerHTML += renderBlockContent(block);
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
    if (!anyRendered && canEdit) {
        const hint = document.createElement('div');
        hint.className = 'page-empty-hint';
        hint.textContent = 'Page vide — utilisez + pour ajouter un bloc';
        container.appendChild(hint);
    }

    updateCounter();
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

export function updateCounter() {
    const visible = state.blocks.filter(b => b.visible && b.type !== 'page-break').length;
    const total   = state.blocks.filter(b => b.type !== 'page-break').length;
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
