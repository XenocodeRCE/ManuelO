// Vue Livre — Book View module for ManuelO
// Two pages side by side (desktop) or single page (mobile), keyboard + touch navigation

import { state, REVISION_ALLOWED_BLOCK_TYPES } from './state.js';
import { renderBlockContent } from './render.js';

const BOOK_PAGE_WIDTH = 794;
const BOOK_PAGE_HEIGHT = 1123;
const PAGE_FIT_EPSILON = 2;

// ── Module state ─────────────────────────────────────────────────────────────
let _pages       = [];    // [{num, title, subtitle, blocks[]}]
let _spread      = 0;     // index of the left (or only) page currently shown
let _mode        = 'double'; // 'double' | 'single'
let _hudTimer    = null;
let _resizeTimer = null;
let _touchStartX = null;
let _touchStartFn = null;  // stored so we can removeEventListener
let _touchEndFn   = null;
let _measureHost  = null;

// ── Build page list from state.blocks (with dynamic pagination) ──────────────

function _buildPages() {
    const sourcePages = _buildSourcePages();
    _pages = [];

    sourcePages.forEach(sourcePage => {
        _pages.push(..._paginateSourcePage(sourcePage));
    });

    _pages.forEach((page, i) => {
        page.num = i + 1;
    });
}

function _buildSourcePages() {
    const sourcePages = [];
    const showHidden = state.mode === 'prof';
    const revisionVisibleSet = state.mode === 'revision'
        ? new Set(REVISION_ALLOWED_BLOCK_TYPES)
        : null;
    let pageBlocks   = [];
    let pageTitle    = state.meta.page1Title    || '';
    let pageSubtitle = state.meta.page1Subtitle || '';

    for (let i = 0; i < state.blocks.length; i++) {
        const b = state.blocks[i];
        if (b.type === 'page-break') {
            sourcePages.push({
                sourceNum: sourcePages.length + 1,
                title: pageTitle,
                subtitle: pageSubtitle,
                blocks: pageBlocks
            });
            pageBlocks   = [];
            pageTitle    = b.title    || '';
            pageSubtitle = b.subtitle || '';
        } else if ((showHidden || b.visible !== false) && (!revisionVisibleSet || revisionVisibleSet.has(b.type))) {
            pageBlocks.push(b);
        }
    }

    sourcePages.push({
        sourceNum: sourcePages.length + 1,
        title: pageTitle,
        subtitle: pageSubtitle,
        blocks: pageBlocks
    });

    return sourcePages;
}

function _paginateSourcePage(sourcePage) {
    if (!sourcePage.blocks.length) {
        return [{
            sourceNum: sourcePage.sourceNum,
            title: sourcePage.title,
            subtitle: sourcePage.subtitle,
            runningTitle: sourcePage.title || '',
            continuation: false,
            blocks: []
        }];
    }

    const paginated = [];
    let start = 0;
    let firstSlice = true;

    while (start < sourcePage.blocks.length) {
        const fitCount = _findBestFitCount(sourcePage, start, firstSlice);

        if (fitCount > 0) {
            const chunk = sourcePage.blocks.slice(start, start + fitCount);

            paginated.push({
                sourceNum: sourcePage.sourceNum,
                title: firstSlice ? sourcePage.title : '',
                subtitle: firstSlice ? sourcePage.subtitle : '',
                runningTitle: sourcePage.title || '',
                continuation: !firstSlice,
                blocks: chunk
            });

            start += fitCount;
            firstSlice = false;
            continue;
        }

        // One single block is taller than a book page: split it into visual slices.
        const oversized = _paginateOversizedBlock(sourcePage, sourcePage.blocks[start], firstSlice);
        paginated.push(...oversized);
        start += 1;
        firstSlice = false;
    }

    return paginated;
}

function _findBestFitCount(sourcePage, startIndex, withChapterHeader) {
    const remaining = sourcePage.blocks.length - startIndex;
    if (remaining <= 0) return 0;

    let low = 1;
    let high = remaining;
    let best = 0;

    while (low <= high) {
        const mid = Math.floor((low + high) / 2);
        const chunk = sourcePage.blocks.slice(startIndex, startIndex + mid);
        const fits = _candidateFits(sourcePage, chunk, withChapterHeader);

        if (fits) {
            best = mid;
            low = mid + 1;
        } else {
            high = mid - 1;
        }
    }

    return best;
}

function _paginateOversizedBlock(sourcePage, block, withChapterHeader) {
    const metrics = _measureBlockForSlicing(sourcePage, block, withChapterHeader);
    if (!metrics || metrics.sliceHeight <= 0 || metrics.blockHeight <= 0) {
        // Safe fallback: keep the raw block if measurement failed.
        return [{
            sourceNum: sourcePage.sourceNum,
            title: withChapterHeader ? sourcePage.title : '',
            subtitle: withChapterHeader ? sourcePage.subtitle : '',
            runningTitle: sourcePage.title || '',
            continuation: !withChapterHeader,
            blocks: [block]
        }];
    }

    const pages = [];
    const sliceHeight = Math.max(1, Math.floor(metrics.sliceHeight));
    const totalParts = Math.max(1, Math.ceil(metrics.blockHeight / sliceHeight));

    for (let part = 0; part < totalParts; part++) {
        const offset = part * sliceHeight;
        const remaining = Math.max(1, metrics.blockHeight - offset);
        const viewport = Math.min(sliceHeight, remaining);
        const firstPart = part === 0;

        pages.push({
            sourceNum: sourcePage.sourceNum,
            title: withChapterHeader && firstPart ? sourcePage.title : '',
            subtitle: withChapterHeader && firstPart ? sourcePage.subtitle : '',
            runningTitle: sourcePage.title || '',
            continuation: !(withChapterHeader && firstPart),
            blocks: [{
                __bookSlice: true,
                block,
                offset,
                viewport,
                part: part + 1,
                totalParts
            }]
        });
    }

    return pages;
}

function _measureBlockForSlicing(sourcePage, block, withChapterHeader) {
    const host = _ensureMeasureHost();
    if (!host) return null;

    const candidatePage = {
        title: withChapterHeader ? sourcePage.title : '',
        subtitle: withChapterHeader ? sourcePage.subtitle : '',
        runningTitle: sourcePage.title || '',
        continuation: !withChapterHeader,
        blocks: [block]
    };

    host.innerHTML = `<div class="book-page book-page-left">${_renderPage(candidatePage, 0, 'left')}</div>`;
    const blockEl = host.querySelector('.book-block');
    const blocksArea = host.querySelector('.book-blocks');

    if (!blockEl || !blocksArea) return null;

    return {
        blockHeight: Math.ceil(blockEl.getBoundingClientRect().height),
        sliceHeight: Math.floor(blocksArea.clientHeight)
    };
}

function _candidateFits(sourcePage, blocks, withChapterHeader) {
    const host = _ensureMeasureHost();
    if (!host) return true;

    const candidatePage = {
        title: withChapterHeader ? sourcePage.title : '',
        subtitle: withChapterHeader ? sourcePage.subtitle : '',
        runningTitle: sourcePage.title || '',
        continuation: !withChapterHeader,
        blocks
    };

    host.innerHTML = `<div class="book-page book-page-left">${_renderPage(candidatePage, 0, 'left')}</div>`;
    const inner = host.querySelector('.book-page-inner');
    if (!inner) return true;

    return inner.scrollHeight <= inner.clientHeight + PAGE_FIT_EPSILON;
}

function _ensureMeasureHost() {
    const overlay = document.getElementById('book-overlay');
    if (!overlay) return null;

    if (_measureHost && _measureHost.isConnected) return _measureHost;

    _measureHost = document.createElement('div');
    _measureHost.id = 'book-measure-host';
    _measureHost.setAttribute('aria-hidden', 'true');
    overlay.appendChild(_measureHost);
    return _measureHost;
}

function _destroyMeasureHost() {
    if (_measureHost && _measureHost.isConnected) {
        _measureHost.remove();
    }
    _measureHost = null;
}

function _detectMode() {
    _mode = window.innerWidth >= 1024 ? 'double' : 'single';
}

// ── Enter / Exit ─────────────────────────────────────────────────────────────

export function enterBookView() {
    const overlay = document.getElementById('book-overlay');
    if (!overlay) return;

    overlay.classList.add('active');
    _buildPages();
    if (!_pages.length) {
        _destroyMeasureHost();
        overlay.classList.remove('active');
        return;
    }

    _spread = 0;
    _detectMode();

    document.documentElement.requestFullscreen?.().catch(() => {});

    // Sync theme selector
    _applyTheme('light');
    const sel = document.getElementById('book-theme-select');
    if (sel) sel.value = 'light';

    // HUD title
    const titleEl = document.getElementById('book-hud-title');
    if (titleEl) titleEl.textContent = state.meta.title || '';

    _buildThumbnails();
    _renderSpread(false);

    // Touch / swipe
    const stage = document.getElementById('book-stage');
    if (stage) {
        _touchStartFn = e => { _touchStartX = e.changedTouches[0].clientX; };
        _touchEndFn   = e => {
            if (_touchStartX === null) return;
            const dx = e.changedTouches[0].clientX - _touchStartX;
            _touchStartX = null;
            if (Math.abs(dx) < 50) return;
            bookGo(dx < 0 ? 1 : -1);
        };
        stage.addEventListener('touchstart', _touchStartFn, { passive: true });
        stage.addEventListener('touchend',   _touchEndFn);
    }

    document.addEventListener('keydown', _onKey);
    overlay.addEventListener('mousemove', _onMouseMove);
    window.addEventListener('resize', _onResize);
    _showHud();
}

export function exitBookView() {
    const overlay = document.getElementById('book-overlay');
    if (!overlay) return;
    overlay.classList.remove('active');
    overlay.removeEventListener('mousemove', _onMouseMove);
    document.removeEventListener('keydown', _onKey);
    window.removeEventListener('resize', _onResize);
    clearTimeout(_hudTimer);
    clearTimeout(_resizeTimer);

    const stage = document.getElementById('book-stage');
    if (stage && _touchStartFn) {
        stage.removeEventListener('touchstart', _touchStartFn);
        stage.removeEventListener('touchend',   _touchEndFn);
    }
    _touchStartFn = null;
    _touchEndFn   = null;

    if (document.fullscreenElement) {
        document.exitFullscreen?.().catch(() => {});
    }

    _destroyMeasureHost();
}

// ── Navigation (public) ───────────────────────────────────────────────────────

export function bookGo(delta) {
    const step = _mode === 'double' ? 2 : 1;
    const next = _spread + delta * step;
    if (next < 0 || next >= _pages.length) return;
    _spread = next;
    _renderSpread(true, delta > 0);
    _showHud();
}

export function bookGoTo(pageIndex) {
    let target = pageIndex;
    if (_mode === 'double') target = Math.floor(pageIndex / 2) * 2;
    target = Math.max(0, Math.min(target, _pages.length - 1));
    if (target === _spread) return;
    const forward = target > _spread;
    _spread = target;
    _renderSpread(true, forward);
    _showHud();
}

// ── Theme (public) ────────────────────────────────────────────────────────────

export function bookSetTheme(theme) {
    _applyTheme(theme);
}

function _applyTheme(theme) {
    const overlay = document.getElementById('book-overlay');
    overlay.classList.remove('book-theme-light', 'book-theme-sepia', 'book-theme-dark');
    overlay.classList.add(`book-theme-${theme}`);
}

// ── Spread rendering ──────────────────────────────────────────────────────────

function _renderSpread(animate, forward = true) {
    const spread = document.getElementById('book-spread');
    if (!spread) return;
    const left  = document.getElementById('book-left');
    const right = document.getElementById('book-right');
    const spine = spread.querySelector('.book-spine');

    // Remove animation classes and force reflow before re-adding
    spread.classList.remove('slide-in-fwd', 'slide-in-back');
    void spread.offsetWidth;

    if (_mode === 'double') {
        left.className  = 'book-page book-page-left';
        right.className = 'book-page book-page-right';
        right.style.display = '';
        if (spine) spine.style.display = '';
        left.innerHTML  = _renderPage(_pages[_spread],     _spread,     'left');
        right.innerHTML = _renderPage(_pages[_spread + 1], _spread + 1, 'right');
    } else {
        left.className  = 'book-page book-page-center';
        right.style.display = 'none';
        if (spine) spine.style.display = 'none';
        left.innerHTML = _renderPage(_pages[_spread], _spread, 'center');
    }

    if (animate) {
        spread.classList.add(forward ? 'slide-in-fwd' : 'slide-in-back');
    }

    _scalePages();
    _updateCounter();
    _updateThumbnails();

    if (window.mermaid) {
        requestAnimationFrame(() =>
            mermaid.run({ querySelector: '#book-spread .mermaid:not([data-processed])' })
        );
    }
}

function _renderPage(page, idx, side) {
    if (!page) {
        // Empty right page at end of odd-count manuals
        return `<div class="book-page-inner"><div class="book-page-blank"></div></div>`;
    }

    const blocks = page.blocks.map(item => _renderBlockItem(item)).join('');

    const runningLeft  = side === 'left'   ? `<span class="book-running">${_esc(state.meta.title || '')}</span>` : '';
    const runningRight = side === 'right'  ? `<span class="book-running book-running-right">${_esc(page.runningTitle || page.title || '')}</span>` : '';
    const runningCenter = side === 'center' ? `<span class="book-running">${_esc(state.meta.title || '')}</span>` : '';

    const pageNumAlignClass = side === 'right' ? 'book-pagenum-right' : '';

    return `<div class="book-page-inner">
        <div class="book-page-header-line">
            ${runningLeft}${runningRight}${runningCenter}
        </div>
        ${page.title ? `<div class="book-page-chapter-title">${_esc(page.title)}</div>` : ''}
        ${page.subtitle ? `<div class="book-page-chapter-subtitle">${_esc(page.subtitle)}</div>` : ''}
        <div class="book-blocks">
            ${blocks || '<div class="book-page-empty-hint">Page vide</div>'}
        </div>
        <div class="book-page-footer-line">
            <span class="book-pagenum ${pageNumAlignClass}">${idx + 1}</span>
        </div>
    </div>`;
}

function _renderBlockItem(item) {
    if (item && item.__bookSlice) {
        const safeOffset = Math.max(0, Math.floor(item.offset || 0));
        const safeViewport = Math.max(1, Math.floor(item.viewport || 1));
        return `<div class="book-block book-block-slice">
            <div class="book-block-slice-viewport" style="height:${safeViewport}px;">
                <div class="book-block-slice-content" style="transform: translateY(-${safeOffset}px);">
                    ${renderBlockContent(item.block)}
                </div>
            </div>
        </div>`;
    }

    return `<div class="book-block">${renderBlockContent(item)}</div>`;
}

// ── Counter & thumbnail bar ───────────────────────────────────────────────────

function _updateCounter() {
    const el = document.getElementById('book-counter');
    if (!el) return;
    const total = _pages.length;
    if (_mode === 'double' && _spread + 1 < total) {
        el.textContent = `${_spread + 1} – ${_spread + 2}  /  ${total}`;
    } else {
        el.textContent = `${_spread + 1}  /  ${total}`;
    }
    const prev = document.getElementById('book-prev-btn');
    const next = document.getElementById('book-next-btn');
    if (prev) prev.disabled = (_spread === 0);
    if (next) {
        const step = _mode === 'double' ? 2 : 1;
        next.disabled = (_spread + step >= _pages.length);
    }
}

function _buildThumbnails() {
    const bar = document.getElementById('book-thumbnails');
    if (!bar) return;
    bar.innerHTML = '';

    _pages.forEach((page, i) => {
        const baseTitle = page.runningTitle || page.title || `Page ${i + 1}`;
        const thumbLabel = page.continuation ? 'suite' : (page.title || page.runningTitle || '');

        const btn = document.createElement('button');
        btn.className = 'book-thumb';
        btn.title = page.continuation ? `${baseTitle} (suite)` : baseTitle;
        btn.innerHTML = `<span class="book-thumb-num">${i + 1}</span>
            ${thumbLabel ? `<span class="book-thumb-label">${_esc(thumbLabel.slice(0, 18))}</span>` : ''}`;
        btn.addEventListener('click', () => bookGoTo(i));
        bar.appendChild(btn);
    });
}

function _updateThumbnails() {
    const bar = document.getElementById('book-thumbnails');
    if (!bar) return;
    bar.querySelectorAll('.book-thumb').forEach((btn, i) => {
        const active = _mode === 'double'
            ? (i === _spread || i === _spread + 1)
            : (i === _spread);
        btn.classList.toggle('active', active);
    });
    const activeThumb = bar.querySelector('.book-thumb.active');
    activeThumb?.scrollIntoView({ block: 'nearest', inline: 'center', behavior: 'smooth' });
}

// ── Page scaling (no-scroll, scale-to-fit like a real book) ──────────────────

function _scalePages() {
    document.querySelectorAll('#book-spread .book-page-inner').forEach(inner => {
        const page  = inner.parentElement;
        if (!page) return;

        const scale = Math.min(
            page.clientWidth / BOOK_PAGE_WIDTH,
            page.clientHeight / BOOK_PAGE_HEIGHT
        );

        const translateX = Math.max(0, (page.clientWidth - BOOK_PAGE_WIDTH * scale) / 2);
        const translateY = Math.max(0, (page.clientHeight - BOOK_PAGE_HEIGHT * scale) / 2);

        inner.style.transform = `translate(${translateX}px, ${translateY}px) scale(${scale})`;
    });
}

// ── HUD auto-hide ─────────────────────────────────────────────────────────────

function _onMouseMove() { _showHud(); }

function _showHud() {
    const hud    = document.getElementById('book-hud');
    const footer = document.getElementById('book-footer');
    if (hud)    hud.classList.add('visible');
    if (footer) footer.classList.add('visible');
    clearTimeout(_hudTimer);
    _hudTimer = setTimeout(() => {
        hud?.classList.remove('visible');
        footer?.classList.remove('visible');
    }, 3000);
}

// ── Keyboard ──────────────────────────────────────────────────────────────────

function _onKey(e) {
    const overlay = document.getElementById('book-overlay');
    if (!overlay?.classList.contains('active')) return;

    switch (e.key) {
        case 'ArrowRight': case 'ArrowDown': case 'PageDown': case ' ':
            e.preventDefault(); bookGo(1); break;
        case 'ArrowLeft': case 'ArrowUp': case 'PageUp':
            e.preventDefault(); bookGo(-1); break;
        case 'Home':
            e.preventDefault(); bookGoTo(0); break;
        case 'End':
            e.preventDefault(); bookGoTo(_pages.length - 1); break;
        case 'Escape':
            exitBookView(); break;
    }
}

// ── Resize ────────────────────────────────────────────────────────────────────

function _onResize() {
    clearTimeout(_resizeTimer);
    _resizeTimer = setTimeout(() => {
        const prevMode = _mode;
        _detectMode();
        if (prevMode !== _mode) {
            // Re-align to an even spread index when switching to double
            if (_mode === 'double') _spread = Math.floor(_spread / 2) * 2;
        }
        _renderSpread(false);
    }, 200);
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function _esc(str) {
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}
