/* ═══════════════════════════════════════════════════════════════════
   Bible Flora, Fauna & Realia — App Logic
   ═══════════════════════════════════════════════════════════════════ */

// ── State ─────────────────────────────────────────────────────────
let currentBook = 'fauna';
let currentEntryKey = null;
let searchTimeout = null;
let mobilePanel = 'middle';  // which panel is visible on mobile

const BOOK_LABELS = { fauna: 'Fauna', flora: 'Flora', realia: 'Realia' };
const BOOK_ICONS  = { fauna: '🦁', flora: '🌿', realia: '⚒️' };

// ── DOM references ────────────────────────────────────────────────
const $landing       = document.getElementById('landing');
const $app           = document.getElementById('app');
const $entryList     = document.getElementById('entryList');
const $entryContent  = document.getElementById('entryContent');
const $rightContent  = document.getElementById('rightContent');
const $searchInput   = document.getElementById('searchInput');
const $navFilter     = document.getElementById('navFilter');
const $navTitle      = document.getElementById('navTitle');
const $entryCount    = document.getElementById('entryCount');
const $leftPanel     = document.getElementById('leftPanel');
const $rightPanel    = document.getElementById('rightPanel');
const $middlePanel   = document.getElementById('middlePanel');

// ── Search results container ──────────────────────────────────────
const $searchResults = document.createElement('div');
$searchResults.className = 'search-results';
document.getElementById('app').appendChild($searchResults);

// ── Build flat lookup + search index ──────────────────────────────
const entryMap = {};  // "fauna:1.1" → entry object
for (const [book, entries] of Object.entries(DICTIONARY_DATA)) {
  for (const entry of entries) {
    entryMap[`${book}:${entry.key}`] = entry;

    // Pre-compute searchText lazily on first access
    Object.defineProperty(entry, 'searchText', {
      get() {
        if (this._searchText) return this._searchText;
        const parts = [this.title, this.key];
        for (const sec of this.sections) {
          parts.push(sec.heading || '');
          for (const p of sec.paragraphs) {
            parts.push(p.replace(/<[^>]+>/g, ' '));
          }
        }
        for (const ls of this.languageSets) {
          parts.push(ls.lemma || '');
          parts.push(ls.transliteration || '');
        }
        this._searchText = parts.join(' ').toLowerCase().replace(/\s+/g, ' ');
        return this._searchText;
      },
      configurable: true,
    });
  }
}

// ── View switching ────────────────────────────────────────────────

function showLanding() {
  $app.classList.remove('active');
  $landing.classList.add('active');
  document.title = 'Bible Flora, Fauna & Realia — A Digital Reference';
  history.pushState(null, '', '#');
}

function launchApp(book) {
  $landing.classList.remove('active');
  $app.classList.add('active');
  switchBook(book);
}

// ── Book switching ────────────────────────────────────────────────

function switchBook(book) {
  currentBook = book;
  currentEntryKey = null;

  // Update header tabs
  document.querySelectorAll('.book-tab').forEach(tab => {
    tab.classList.toggle('active', tab.dataset.book === book);
  });

  // Update mobile book buttons
  document.querySelectorAll('.mobile-book-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.book === book);
  });

  $navTitle.textContent = BOOK_LABELS[book];

  renderEntryList();
  clearEntry();
  $navFilter.value = '';
  $searchInput.value = '';
  closeSearchResults();

  // Auto-select the first entry — the "0" (contents) entry
  const entries = DICTIONARY_DATA[book];
  if (entries && entries.length > 0) {
    selectEntry(entries[0].key);
  }

  updateHash();
}

// ── Entry list rendering ──────────────────────────────────────────

function renderEntryList(filter = '') {
  const entries = DICTIONARY_DATA[currentBook] || [];
  const filterLower = filter.toLowerCase().trim();

  let html = '';
  let count = 0;

  for (const entry of entries) {
    // Skip if filtered
    if (filterLower && !entry.title.toLowerCase().includes(filterLower) &&
        !entry.key.includes(filterLower)) {
      continue;
    }

    count++;
    const depth = Math.min(entry.depth, 3);
    const active = entry.key === currentEntryKey ? ' active' : '';
    const keyDisplay = entry.key === '0' ? '' : entry.key;

    html += `<button class="entry-item depth-${depth}${active}"
                     data-key="${escHtml(entry.key)}"
                     role="option"
                     onclick="selectEntry('${escJs(entry.key)}')">`;
    if (keyDisplay) {
      html += `<span class="entry-key">${escHtml(keyDisplay)}</span>`;
    }
    html += `${escHtml(entry.title)}</button>`;
  }

  $entryList.innerHTML = html;
  $entryCount.textContent = `${count} entries`;
}

// ── Entry selection ───────────────────────────────────────────────

function selectEntry(key) {
  currentEntryKey = key;
  const entry = entryMap[`${currentBook}:${key}`];
  if (!entry) return;

  // Update active state in list
  $entryList.querySelectorAll('.entry-item').forEach(item => {
    item.classList.toggle('active', item.dataset.key === key);
  });

  // Scroll active item into view
  const activeItem = $entryList.querySelector('.entry-item.active');
  if (activeItem) {
    activeItem.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }

  renderEntry(entry);
  renderRightPanel(entry);
  updateHash();

  // On mobile, show middle panel
  if (window.innerWidth <= 768) {
    showMobilePanel('middle');
    closeMobileNav();
  }
}

// Navigate to a cross-reference (possibly in another book)
function navigateTo(target) {
  // Target format: "FAUNA:2.13" or "FLORA:1.5"
  const match = target.match(/^(FAUNA|FLORA|REALIA):(.+)$/i);
  if (match) {
    const book = match[1].toLowerCase();
    const key = match[2];
    if (book !== currentBook) {
      switchBook(book);
    }
    selectEntry(key);
  }
}

// ── Entry content rendering ───────────────────────────────────────

function renderEntry(entry) {
  let html = '';

  // Title block
  html += `<div class="entry-title-block">`;
  html += `<h1>${escHtml(entry.title)}`;
  html += `<span class="entry-book-badge ${entry.book}">${BOOK_LABELS[entry.book]}</span>`;
  html += `</h1>`;
  if (entry.key !== '0') {
    html += `<div class="entry-breadcrumb">${escHtml(entry.book.toUpperCase())} § ${escHtml(entry.key)}</div>`;
  }
  html += `</div>`;

  // Index (sub-entries)
  if (entry.indexItems && entry.indexItems.length > 0) {
    html += `<div class="entry-index">`;
    html += `<div class="entry-index-title">Contents</div>`;
    html += `<ul>`;
    for (const item of entry.indexItems) {
      html += `<li><a class="cross-ref" data-target="${escHtml(item.target)}">${item.label}</a></li>`;
    }
    html += `</ul></div>`;
  }

  // Sections
  for (const sec of entry.sections) {
    html += `<div class="entry-section">`;

    // Section heading
    if (sec.headingHtml) {
      html += `<div class="section-heading">${sec.headingHtml}</div>`;
    }

    // Subheading
    if (sec.subheading) {
      html += `<p class="entry-paragraph"><em>${escHtml(sec.subheading)}</em></p>`;
    }

    // Language sets inline
    if (sec.languageSets && sec.languageSets.length > 0) {
      for (const ls of sec.languageSets) {
        html += `<div class="lang-set-inline">`;
        html += `<span class="lang-label">${escHtml(ls.language)}</span>`;
        html += `<span class="lang-lemma">${escHtml(ls.lemma)}</span>`;
        if (ls.transliteration) {
          html += ` <span class="lang-translit">(${escHtml(ls.transliteration)})</span>`;
        }
        if (ls.references && ls.references.length > 0) {
          html += `<div class="lang-refs">${ls.references.join('; ')}</div>`;
        }
        html += `</div>`;
      }
    }

    // Paragraphs (already HTML)
    for (const p of sec.paragraphs) {
      html += `<p class="entry-paragraph">${p}</p>`;
    }

    html += `</div>`;
  }

  $entryContent.innerHTML = html;

  // Scroll to top
  $middlePanel.scrollTop = 0;

  // Attach cross-ref click handlers
  $entryContent.querySelectorAll('.cross-ref').forEach(el => {
    el.addEventListener('click', () => navigateTo(el.dataset.target));
  });

  document.title = `${entry.title} — ${BOOK_LABELS[entry.book]} — Bible Reference`;
}

function clearEntry() {
  $entryContent.innerHTML = `
    <div class="empty-state">
      <div class="empty-icon">📖</div>
      <h3>Select an entry</h3>
      <p>Choose an entry from the left panel to view its content.</p>
    </div>`;
  $rightContent.innerHTML = `
    <div class="empty-state small">
      <p>Reference details will appear here when you view an entry.</p>
    </div>`;
}

// ── Right panel rendering ─────────────────────────────────────────

function renderRightPanel(entry) {
  let html = '';

  // Language sets
  if (entry.languageSets && entry.languageSets.length > 0) {
    html += `<div class="right-section">`;
    html += `<div class="right-section-title">Original Languages</div>`;

    for (const ls of entry.languageSets) {
      html += `<div class="right-lang-card">`;
      html += `<div class="right-lang-header">`;
      html += `<span class="right-lang-label">${escHtml(ls.language)}</span>`;
      html += `<span class="right-lang-lemma">${escHtml(ls.lemma)}</span>`;
      if (ls.transliteration) {
        html += `<span class="right-lang-translit">(${escHtml(ls.transliteration)})</span>`;
      }
      html += `</div>`;

      if (ls.references && ls.references.length > 0) {
        html += `<div class="right-ref-list">`;
        for (const ref of ls.references) {
          html += `<span class="right-ref-item">${escHtml(ref)}</span>`;
        }
        html += `</div>`;
      }
      html += `</div>`;
    }
    html += `</div>`;
  }

  // All unique references
  if (entry.references && entry.references.length > 0) {
    html += `<div class="right-section">`;
    html += `<div class="right-section-title">Scripture References (${entry.references.length})</div>`;
    html += `<div class="right-ref-list">`;
    for (const ref of entry.references) {
      html += `<span class="right-ref-item">${escHtml(ref)}</span>`;
    }
    html += `</div></div>`;
  }

  // Cross references
  if (entry.crossRefs && entry.crossRefs.length > 0) {
    html += `<div class="right-section">`;
    html += `<div class="right-section-title">Cross References</div>`;
    for (const target of entry.crossRefs) {
      // Try to resolve the target to a title
      const targetEntry = resolveTarget(target);
      const label = targetEntry ? targetEntry.title : target;
      html += `<a class="right-crossref-item" data-target="${escHtml(target)}">${escHtml(label)}</a>`;
    }
    html += `</div>`;
  }

  // Attribution
  html += `<div class="right-attribution">`;
  html += `© United Bible Societies, 2025.<br>`;
  html += `<a href="http://creativecommons.org/licenses/by-sa/4.0/" target="_blank" rel="noopener">CC BY-SA 4.0</a><br>`;
  html += `Developed by <a href="https://tfbf.in" target="_blank" rel="noopener">TFBF</a>`;
  html += `</div>`;

  $rightContent.innerHTML = html;

  // Attach cross-ref handlers in right panel
  $rightContent.querySelectorAll('.right-crossref-item').forEach(el => {
    el.addEventListener('click', () => navigateTo(el.dataset.target));
  });
}

function resolveTarget(target) {
  // Target format: "FAUNA:2.13"
  const match = target.match(/^(FAUNA|FLORA|REALIA):(.+)$/i);
  if (match) {
    const book = match[1].toLowerCase();
    const key = match[2];
    return entryMap[`${book}:${key}`];
  }
  return null;
}

// ── Search ────────────────────────────────────────────────────────

function doSearch(query) {
  query = query.trim().toLowerCase();

  if (!query || query.length < 2) {
    closeSearchResults();
    return;
  }

  const results = [];
  const terms = query.split(/\s+/);

  // Search across ALL books
  for (const [book, entries] of Object.entries(DICTIONARY_DATA)) {
    for (const entry of entries) {
      // Check if all terms are found in search text
      const text = entry.searchText;
      let score = 0;
      let allMatch = true;

      for (const term of terms) {
        const idx = text.indexOf(term);
        if (idx === -1) {
          allMatch = false;
          break;
        }
        // Score: title match > content match
        if (entry.title.toLowerCase().includes(term)) {
          score += 10;
        } else {
          score += 1;
        }
      }

      if (allMatch) {
        results.push({ ...entry, score });
      }
    }
  }

  // Sort by score desc
  results.sort((a, b) => b.score - a.score);

  showSearchResults(results.slice(0, 30), query);
}

function showSearchResults(results, query) {
  if (results.length === 0) {
    $searchResults.innerHTML = `<div class="search-no-results">No entries found for "<strong>${escHtml(query)}</strong>"</div>`;
    $searchResults.classList.add('visible');
    return;
  }

  let html = '';
  for (const r of results) {
    // Build snippet from first paragraph
    let snippet = '';
    for (const sec of r.sections) {
      for (const p of sec.paragraphs) {
        if (p) {
          snippet = p.replace(/<[^>]+>/g, '').substring(0, 120);
          break;
        }
      }
      if (snippet) break;
    }

    // Highlight query terms in title and snippet
    const terms = query.split(/\s+/);
    let titleHtml = escHtml(r.title);
    let snippetHtml = escHtml(snippet);
    for (const term of terms) {
      const re = new RegExp(`(${escRegex(term)})`, 'gi');
      titleHtml = titleHtml.replace(re, '<mark>$1</mark>');
      snippetHtml = snippetHtml.replace(re, '<mark>$1</mark>');
    }

    html += `<button class="search-result-item" data-book="${r.book}" data-key="${escHtml(r.key)}">`;
    html += `<div><span class="result-title">${titleHtml}</span>`;
    html += `<span class="result-book">${BOOK_LABELS[r.book]}</span></div>`;
    if (snippet) {
      html += `<div class="result-snippet">${snippetHtml}…</div>`;
    }
    html += `</button>`;
  }

  $searchResults.innerHTML = html;
  $searchResults.classList.add('visible');

  // Attach handlers
  $searchResults.querySelectorAll('.search-result-item').forEach(item => {
    item.addEventListener('click', () => {
      const book = item.dataset.book;
      const key = item.dataset.key;
      closeSearchResults();
      $searchInput.value = '';
      if (book !== currentBook) {
        currentBook = book;
        document.querySelectorAll('.book-tab').forEach(t => t.classList.toggle('active', t.dataset.book === book));
        document.querySelectorAll('.mobile-book-btn').forEach(b => b.classList.toggle('active', b.dataset.book === book));
        $navTitle.textContent = BOOK_LABELS[book];
        renderEntryList();
      }
      selectEntry(key);
    });
  });
}

function closeSearchResults() {
  $searchResults.classList.remove('visible');
  $searchResults.innerHTML = '';
}


// ── Navigation filter ─────────────────────────────────────────────

$navFilter.addEventListener('input', () => {
  renderEntryList($navFilter.value);
});

// ── Search input ──────────────────────────────────────────────────

$searchInput.addEventListener('input', () => {
  clearTimeout(searchTimeout);
  searchTimeout = setTimeout(() => doSearch($searchInput.value), 200);
});

$searchInput.addEventListener('focus', () => {
  if ($searchInput.value.trim().length >= 2) {
    doSearch($searchInput.value);
  }
});

// Close search on click outside
document.addEventListener('click', (e) => {
  if (!$searchResults.contains(e.target) && e.target !== $searchInput) {
    closeSearchResults();
  }
});


// ── Mobile navigation ─────────────────────────────────────────────

function toggleMobileNav() {
  const isOpen = $leftPanel.classList.toggle('open');
  document.querySelector('.mobile-overlay').classList.toggle('visible', isOpen);
}

function closeMobileNav() {
  $leftPanel.classList.remove('open');
  document.querySelector('.mobile-overlay').classList.remove('visible');
}

function toggleRightPanel() {
  const isOpen = $rightPanel.classList.toggle('open');
  document.querySelector('.mobile-overlay').classList.toggle('visible', isOpen);
}

function showMobilePanel(panel) {
  mobilePanel = panel;

  // Update bottom tabs
  document.querySelectorAll('.bottom-tab').forEach(tab => {
    tab.classList.toggle('active', tab.dataset.panel === panel);
  });

  closeMobileNav();
  $rightPanel.classList.remove('open');
  document.querySelector('.mobile-overlay').classList.remove('visible');

  if (panel === 'left') {
    $leftPanel.classList.add('open');
    document.querySelector('.mobile-overlay').classList.add('visible');
  } else if (panel === 'right') {
    $rightPanel.classList.add('open');
    document.querySelector('.mobile-overlay').classList.add('visible');
  }
}


// ── Keyboard shortcuts ────────────────────────────────────────────

document.addEventListener('keydown', (e) => {
  // "/" focuses search
  if (e.key === '/' && !isInputFocused()) {
    e.preventDefault();
    $searchInput.focus();
    return;
  }

  // Escape closes search / panels
  if (e.key === 'Escape') {
    if ($searchResults.classList.contains('visible')) {
      closeSearchResults();
      $searchInput.blur();
    } else if ($leftPanel.classList.contains('open')) {
      closeMobileNav();
    } else if ($rightPanel.classList.contains('open')) {
      $rightPanel.classList.remove('open');
      document.querySelector('.mobile-overlay').classList.remove('visible');
    }
    return;
  }

  // Alt+Up / Alt+Down navigate entries
  if (e.altKey && (e.key === 'ArrowUp' || e.key === 'ArrowDown')) {
    e.preventDefault();
    navigateEntry(e.key === 'ArrowDown' ? 1 : -1);
  }
});

function isInputFocused() {
  const tag = document.activeElement?.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA';
}

function navigateEntry(direction) {
  const entries = DICTIONARY_DATA[currentBook];
  if (!entries) return;
  const idx = entries.findIndex(e => e.key === currentEntryKey);
  const next = idx + direction;
  if (next >= 0 && next < entries.length) {
    selectEntry(entries[next].key);
  }
}

// ── URL hash routing ──────────────────────────────────────────────

function updateHash() {
  if (currentEntryKey !== null) {
    const hash = `#${currentBook}/${currentEntryKey}`;
    if (location.hash !== hash) {
      history.replaceState(null, '', hash);
    }
  }
}

function handleHash() {
  const hash = location.hash.replace('#', '');
  if (!hash) return false;

  const parts = hash.split('/');
  if (parts.length >= 2) {
    const book = parts[0];
    const key = parts.slice(1).join('/');
    if (DICTIONARY_DATA[book]) {
      launchApp(book);
      selectEntry(key);
      return true;
    }
  }
  return false;
}

// ── Utility ───────────────────────────────────────────────────────

function escHtml(text) {
  if (!text) return '';
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function escJs(text) {
  return text.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
}

function escRegex(text) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}


// ── Inject mobile book selector into left panel ───────────────────

function injectMobileBookSelector() {
  const selectorDiv = document.createElement('div');
  selectorDiv.className = 'mobile-book-selector';

  for (const [book, label] of Object.entries(BOOK_LABELS)) {
    const btn = document.createElement('button');
    btn.className = `mobile-book-btn${book === currentBook ? ' active' : ''}`;
    btn.dataset.book = book;
    btn.textContent = `${BOOK_ICONS[book]} ${label}`;
    btn.addEventListener('click', () => {
      switchBook(book);
    });
    selectorDiv.appendChild(btn);
  }

  // Insert after panel header
  const panelHeader = $leftPanel.querySelector('.panel-header');
  panelHeader.after(selectorDiv);
}


// ── Initialize ────────────────────────────────────────────────────

function init() {
  injectMobileBookSelector();

  // Try hash-based routing first
  if (!handleHash()) {
    // Show landing page by default
    showLanding();
  }
}

init();
