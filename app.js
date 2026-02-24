/* ═══════════════════════════════════════════════════════════════════
   Bible Flora, Fauna & Realia — App Logic
   ═══════════════════════════════════════════════════════════════════ */

// ── State ─────────────────────────────────────────────────────────
let currentBook = 'fauna';
let currentEntryKey = null;
let searchTimeout = null;
let mobilePanel = 'middle';  // which panel is visible on mobile
const SOURCE_TERM_MODES = ['original', 'translit', 'both'];
let sourceTermMode = localStorage.getItem('sourceTermMode') || 'both';
if (!SOURCE_TERM_MODES.includes(sourceTermMode)) {
  sourceTermMode = 'both';
}

const BOOK_LABELS = { fauna: 'Fauna', flora: 'Flora', realia: 'Realia', greek: 'Greek', hebrew: 'Hebrew' };
const BOOK_ICONS  = { fauna: '🦁', flora: '🌿', realia: '⚒️', greek: 'ΑΩ', hebrew: 'אב' };
const ENTRY_BOOK_POSITION = { fauna: 0, flora: 1, realia: 2, greek: 3, hebrew: 4 };
let rightPanelTab = 'details';
let lexiconSortMode = localStorage.getItem('lexiconSortMode') || 'alpha';
let accordionMode = localStorage.getItem('accordionMode') === 'true';
let openDomains = new Set(JSON.parse(localStorage.getItem('openDomains') || '[]'));
const entryBackStack = [];

let $entryBackBtn = null;
let $crossRefModal = null;
let $crossRefModalDialog = null;
let $crossRefModalTitle = null;
let $crossRefModalMeta = null;
let $crossRefModalBody = null;
let $crossRefModalOpenBtn = null;

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
const $lexSortBar    = document.getElementById('lexSortBar');

function setLexiconSort(mode) {
  lexiconSortMode = mode;
  localStorage.setItem('lexiconSortMode', mode);
  updateLexiconSortUI();
  renderEntryList($navFilter.value);
}

function toggleAccordionMode(enabled) {
  accordionMode = enabled;
  localStorage.setItem('accordionMode', enabled);
  renderEntryList($navFilter.value);
}

function toggleDomain(domainName) {
  if (openDomains.has(domainName)) {
    openDomains.delete(domainName);
  } else {
    openDomains.add(domainName);
  }
  localStorage.setItem('openDomains', JSON.stringify(Array.from(openDomains)));
  renderEntryList($navFilter.value);
}

function updateLexiconSortUI() {
  if (!$lexSortBar) return;
  const modes = ['alpha', 'strongs', 'domain'];
  modes.forEach(m => {
    const btn = document.getElementById(`sort-${m}`);
    if (btn) btn.classList.toggle('active', lexiconSortMode === m);
  });

  const accToggle = document.getElementById('domainAccordionToggle');
  if (accToggle) {
    accToggle.style.display = (lexiconSortMode === 'domain') ? 'flex' : 'none';
  }
  const accCheckbox = document.getElementById('accordionModeCheckbox');
  if (accCheckbox) accCheckbox.checked = accordionMode;
}

// Parse <strong>Label:</strong> value paragraphs into a fields map
function parseSectionFields(paragraphs) {
  const fields = {};
  const re = /^<strong>([^<:]+):<\/strong>\s*(.*)/s;
  for (const p of (paragraphs || [])) {
    const m = p.match(re);
    if (!m) continue;
    const key = m[1].trim();
    const val = m[2].trim();
    if (Object.prototype.hasOwnProperty.call(fields, key)) {
      if (!Array.isArray(fields[key])) fields[key] = [fields[key]];
      fields[key].push(val);
    } else {
      fields[key] = val;
    }
  }
  return fields;
}

function getPrimaryStrongs(entry) {
  const ls = (entry.languageSets || [])[0];
  return ls ? ((ls.strongs || [])[0] || '') : '';
}

function getLexiconDomainLabel(entry) {
  // Hebrew: semanticDomains populated directly
  const doms = entry.semanticDomains;
  if (doms && doms.length > 0) return doms[0].label || '';
  // Greek: domain in first sense section paragraphs
  for (const sec of (entry.sections || [])) {
    if (sec.contentType === 'sense') {
      const f = parseSectionFields(sec.paragraphs);
      const d = f['Domains'];
      if (d) return Array.isArray(d) ? d[0] : d;
    }
  }
  return '';
}
const REF_BOOK_ORDER = [
  'Gen', 'Exod', 'Lev', 'Num', 'Deut', 'Josh', 'Judg', 'Ruth', '1 Sam', '2 Sam',
  '1 Kgs', '2 Kgs', '1 Chr', '2 Chr', 'Ezra', 'Neh', 'Esth', 'Job', 'Ps', 'Prov',
  'Eccl', 'Song', 'Isa', 'Jer', 'Lam', 'Ezek', 'Dan', 'Hos', 'Joel', 'Amos',
  'Obad', 'Jonah', 'Mic', 'Nah', 'Hab', 'Zeph', 'Hag', 'Zech', 'Mal',
  'Matt', 'Mark', 'Luke', 'John', 'Acts', 'Rom', '1 Cor', '2 Cor', 'Gal',
  'Eph', 'Phil', 'Col', '1 Thess', '2 Thess', '1 Tim', '2 Tim',
  'Titus', 'Phlm', 'Heb', 'Jas', '1 Pet', '2 Pet', '1 John', '2 John', '3 John', 'Jude', 'Rev',
  'Tob', 'Jdt', 'AddEsth', 'Wis', 'Sir', 'Bar', 'EpJer', 'SgThree', 'Sus', 'Bel',
  '1 Macc', '2 Macc', '1 Esd', 'PrMan', 'Ps 151', '3 Macc', '2 Esd', '4 Macc',
];
const REF_BOOK_POSITION = Object.fromEntries(REF_BOOK_ORDER.map((book, idx) => [book, idx]));
const KJV_BOOK_NAMES = {
  'Gen': 'Genesis', 'Exod': 'Exodus', 'Lev': 'Leviticus', 'Num': 'Numbers', 'Deut': 'Deuteronomy',
  'Josh': 'Joshua', 'Judg': 'Judges', 'Ruth': 'Ruth', '1 Sam': '1 Samuel', '2 Sam': '2 Samuel',
  '1 Kgs': '1 Kings', '2 Kgs': '2 Kings', '1 Chr': '1 Chronicles', '2 Chr': '2 Chronicles',
  'Ezra': 'Ezra', 'Neh': 'Nehemiah', 'Esth': 'Esther', 'Job': 'Job', 'Ps': 'Psalms', 'Prov': 'Proverbs',
  'Eccl': 'Ecclesiastes', 'Song': 'Song of Solomon', 'Isa': 'Isaiah', 'Jer': 'Jeremiah', 'Lam': 'Lamentations',
  'Ezek': 'Ezekiel', 'Dan': 'Daniel', 'Hos': 'Hosea', 'Joel': 'Joel', 'Amos': 'Amos',
  'Obad': 'Obadiah', 'Jonah': 'Jonah', 'Mic': 'Micah', 'Nah': 'Nahum', 'Hab': 'Habakkuk',
  'Zeph': 'Zephaniah', 'Hag': 'Haggai', 'Zech': 'Zechariah', 'Mal': 'Malachi',
  'Matt': 'Matthew', 'Mark': 'Mark', 'Luke': 'Luke', 'John': 'John', 'Acts': 'Acts',
  'Rom': 'Romans', '1 Cor': '1 Corinthians', '2 Cor': '2 Corinthians', 'Gal': 'Galatians',
  'Eph': 'Ephesians', 'Phil': 'Philippians', 'Col': 'Colossians', '1 Thess': '1 Thessalonians',
  '2 Thess': '2 Thessalonians', '1 Tim': '1 Timothy', '2 Tim': '2 Timothy', 'Titus': 'Titus',
  'Phlm': 'Philemon', 'Heb': 'Hebrews', 'Jas': 'James', '1 Pet': '1 Peter', '2 Pet': '2 Peter',
  '1 John': '1 John', '2 John': '2 John', '3 John': '3 John', 'Jude': 'Jude', 'Rev': 'Revelation',
};
const REF_BOOK_ALIASES = buildBookAliasMap();
const reverseRefIndex = new Map();
const indexedReferences = [];
const reverseLookupState = {
  query: '',
  results: [],
  error: '',
  matchedVerses: 0,
  verseStatus: 'idle',
  verseError: '',
  verseTexts: [],
};

// ── Search results container ──────────────────────────────────────
const $searchResults = document.createElement('div');
$searchResults.className = 'search-results';
document.getElementById('app').appendChild($searchResults);

// ── Dictionary data (populated lazily) ───────────────────────────
// Thematic books (fauna/flora/realia) are loaded up-front as separate script tags.
// Greek and Hebrew are loaded on-demand when the user first opens those tabs.
const DICTIONARY_DATA = {};

// Track load state: 'loaded' | 'loading' | 'error' | undefined
const _bookLoadState = {};

// ── Build flat lookup + search index ──────────────────────────────
const entryMap = {};  // "fauna:1.1" → entry object
const lemmaIndex = {}; // "language|normalizedTerm" -> [{book,key,title}]

function addLemmaIndex(language, term, entry) {
  const normalized = normalizeTermForIndex(term);
  if (!normalized) return;
  const lang = (language || '').toLowerCase().trim() || 'unknown';
  const langKey = `${lang}|${normalized}`;
  const anyKey = `*|${normalized}`;
  const payload = { book: entry.book, key: entry.key, title: entry.title };

  if (!lemmaIndex[langKey]) lemmaIndex[langKey] = [];
  if (!lemmaIndex[anyKey]) lemmaIndex[anyKey] = [];

  if (!lemmaIndex[langKey].some(v => v.book === payload.book && v.key === payload.key)) {
    lemmaIndex[langKey].push(payload);
  }
  if (!lemmaIndex[anyKey].some(v => v.book === payload.book && v.key === payload.key)) {
    lemmaIndex[anyKey].push(payload);
  }
}

function buildBookAliasMap() {
  const aliases = {};
  const addAlias = (alias, canonical) => {
    const key = (alias || '').toLowerCase().replace(/\./g, '').replace(/\s+/g, ' ').trim();
    if (!key) return;
    aliases[key] = canonical;
  };

  for (const canonical of REF_BOOK_ORDER) {
    addAlias(canonical, canonical);
  }

  const fullNames = {
    genesis: 'Gen', exodus: 'Exod', leviticus: 'Lev', numbers: 'Num', deuteronomy: 'Deut',
    joshua: 'Josh', judges: 'Judg', ruth: 'Ruth',
    '1 samuel': '1 Sam', '2 samuel': '2 Sam',
    '1 kings': '1 Kgs', '2 kings': '2 Kgs',
    '1 chronicles': '1 Chr', '2 chronicles': '2 Chr',
    ezra: 'Ezra', nehemiah: 'Neh', esther: 'Esth', job: 'Job', psalm: 'Ps', psalms: 'Ps',
    proverbs: 'Prov', ecclesiastes: 'Eccl', song: 'Song',
    'song of solomon': 'Song', isaiah: 'Isa', jeremiah: 'Jer', lamentations: 'Lam', ezekiel: 'Ezek',
    daniel: 'Dan', hosea: 'Hos', joel: 'Joel', amos: 'Amos', obadiah: 'Obad', jonah: 'Jonah',
    micah: 'Mic', nahum: 'Nah', habakkuk: 'Hab', zephaniah: 'Zeph', haggai: 'Hag',
    zechariah: 'Zech', malachi: 'Mal', matthew: 'Matt', mark: 'Mark', luke: 'Luke', john: 'John',
    acts: 'Acts', romans: 'Rom', '1 corinthians': '1 Cor', '2 corinthians': '2 Cor',
    galatians: 'Gal', ephesians: 'Eph', philippians: 'Phil', colossians: 'Col',
    '1 thessalonians': '1 Thess', '2 thessalonians': '2 Thess', '1 timothy': '1 Tim',
    '2 timothy': '2 Tim', titus: 'Titus', philemon: 'Phlm', hebrews: 'Heb', james: 'Jas',
    '1 peter': '1 Pet', '2 peter': '2 Pet', '1 john': '1 John', '2 john': '2 John',
    '3 john': '3 John', jude: 'Jude', revelation: 'Rev',
  };

  for (const [alias, canonical] of Object.entries(fullNames)) {
    addAlias(alias, canonical);
  }

  return aliases;
}

function normalizeBookToken(book) {
  const key = (book || '').toLowerCase().replace(/\./g, '').replace(/\s+/g, ' ').trim();
  return REF_BOOK_ALIASES[key] || '';
}

function parseReferenceUnit(text, context = {}) {
  const normalized = (text || '').trim().replace(/\s+/g, ' ');
  if (!normalized) return null;

  const full = normalized.match(/^(.+?)\s+(\d+):(\d+)$/);
  if (full) {
    const book = normalizeBookToken(full[1]);
    const chapter = parseInt(full[2], 10);
    const verse = parseInt(full[3], 10);
    if (!book || !Number.isFinite(chapter) || !Number.isFinite(verse)) return null;
    return { book, chapter, verse };
  }

  if (context.book) {
    const chapterVerse = normalized.match(/^(\d+):(\d+)$/);
    if (chapterVerse) {
      const chapter = parseInt(chapterVerse[1], 10);
      const verse = parseInt(chapterVerse[2], 10);
      if (!Number.isFinite(chapter) || !Number.isFinite(verse)) return null;
      return { book: context.book, chapter, verse };
    }

    const verseOnly = normalized.match(/^(\d+)$/);
    if (verseOnly && Number.isFinite(context.chapter)) {
      const verse = parseInt(verseOnly[1], 10);
      if (!Number.isFinite(verse)) return null;
      return { book: context.book, chapter: context.chapter, verse };
    }
  }

  return null;
}

function makeVerseKey(ref) {
  return `${ref.book}|${ref.chapter}|${ref.verse}`;
}

function compareReferences(a, b) {
  const bookA = REF_BOOK_POSITION[a.book] ?? Number.MAX_SAFE_INTEGER;
  const bookB = REF_BOOK_POSITION[b.book] ?? Number.MAX_SAFE_INTEGER;
  if (bookA !== bookB) return bookA - bookB;
  if (a.chapter !== b.chapter) return a.chapter - b.chapter;
  return a.verse - b.verse;
}

function indexEntryReference(referenceText, entry) {
  const parsed = parseReferenceUnit(referenceText);
  if (!parsed) return;

  const verseKey = makeVerseKey(parsed);
  if (!reverseRefIndex.has(verseKey)) {
    reverseRefIndex.set(verseKey, []);
    indexedReferences.push({ ...parsed, verseKey });
  }

  const entryId = `${entry.book}:${entry.key}`;
  const bucket = reverseRefIndex.get(verseKey);
  if (!bucket.some(item => item.id === entryId)) {
    bucket.push({ id: entryId, book: entry.book, key: entry.key, title: entry.title });
  }
}

function registerBook(book, entries) {
  DICTIONARY_DATA[book] = entries;
  _bookLoadState[book] = 'loaded';
  for (const entry of entries) {
    entryMap[`${book}:${entry.key}`] = entry;

    for (const ls of (entry.languageSets || [])) {
      addLemmaIndex(ls.language, ls.lemma, entry);
      addLemmaIndex(ls.language, ls.transliteration, entry);
    }

    for (const referenceText of (entry.references || [])) {
      indexEntryReference(referenceText, entry);
    }

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

// Lazy-load a per-book data file (<book> = 'greek' or 'hebrew').
// Returns a Promise that resolves when the book is ready.
function loadBookData(book) {
  if (_bookLoadState[book] === 'loaded') return Promise.resolve();
  if (_bookLoadState[book] === 'loading') {
    // Return a promise that polls until done
    return new Promise((resolve, reject) => {
      const interval = setInterval(() => {
        if (_bookLoadState[book] === 'loaded') { clearInterval(interval); resolve(); }
        else if (_bookLoadState[book] === 'error') { clearInterval(interval); reject(new Error(`Failed to load ${book}`)); }
      }, 50);
    });
  }

  _bookLoadState[book] = 'loading';
  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = `data-${book}.js`;
    script.onload = () => {
      const varName = `DICTIONARY_DATA_${book.toUpperCase()}`;
      const data = window[varName];
      if (!data) {
        _bookLoadState[book] = 'error';
        reject(new Error(`${varName} not defined after loading`));
        return;
      }
      registerBook(book, data);
      resolve();
    };
    script.onerror = () => {
      _bookLoadState[book] = 'error';
      reject(new Error(`Failed to load data-${book}.js`));
    };
    document.head.appendChild(script);
  });
}

// Register the always-available thematic books
registerBook('fauna', typeof DICTIONARY_DATA_FAUNA !== 'undefined' ? DICTIONARY_DATA_FAUNA : []);
registerBook('flora', typeof DICTIONARY_DATA_FLORA !== 'undefined' ? DICTIONARY_DATA_FLORA : []);
registerBook('realia', typeof DICTIONARY_DATA_REALIA !== 'undefined' ? DICTIONARY_DATA_REALIA : []);

// ── View switching ────────────────────────────────────────────────

function showLanding(pushHistory = true) {
  $app.classList.remove('active');
  $landing.classList.add('active');
  document.title = 'Bible Flora, Fauna & Realia — A Digital Reference';
  if (pushHistory) {
    history.pushState(null, '', '#');
  }
}

function launchApp(book) {
  $landing.classList.remove('active');
  $app.classList.add('active');
  switchBook(book, { recordBack: false, pushHistory: false });
}

// ── Book switching ────────────────────────────────────────────────

function switchBook(book, options = {}) {
  const { recordBack = true, initialKey = null, pushHistory = true } = options;
  if (recordBack && currentEntryKey !== null && book !== currentBook) {
    pushEntryHistory(currentBook, currentEntryKey);
  }

  currentBook = book;
  currentEntryKey = null;
  updateEntryBackButton();

  const isLexicon = (book === 'greek' || book === 'hebrew');
  if ($lexSortBar) {
    $lexSortBar.style.display = isLexicon ? 'flex' : 'none';
    if (isLexicon) updateLexiconSortUI();
  }

  // Update header tabs
  document.querySelectorAll('.book-tab').forEach(tab => {
    tab.classList.toggle('active', tab.dataset.book === book);
  });

  // Update mobile book buttons
  document.querySelectorAll('.mobile-book-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.book === book);
  });

  $navTitle.textContent = BOOK_LABELS[book];

  // For lazy books (greek/hebrew), show a loading state while fetching
  if (_bookLoadState[book] !== 'loaded') {
    renderEntryList();
    clearEntry();
    $navFilter.value = '';
    $searchInput.value = '';
    closeSearchResults();

    // Show a loading placeholder
    $entryList.innerHTML = '<div class="entry-list-loading"><div class="loading-spinner"></div><p>Loading ' + BOOK_LABELS[book] + ' dictionary…</p></div>';

    loadBookData(book).then(() => {
      if (currentBook !== book) return; // user navigated away
      renderEntryList();
      const entries = DICTIONARY_DATA[book];
      if (entries && entries.length > 0) {
        const targetKey = initialKey && entries.some(e => e.key === initialKey) ? initialKey : entries[0].key;
        selectEntry(targetKey, { pushHistory });
      }
      updateHash();
    }).catch(err => {
      if (currentBook !== book) return;
      $entryList.innerHTML = '<div class="entry-list-error"><p>Failed to load ' + BOOK_LABELS[book] + ' data.</p></div>';
      console.error(err);
    });
    return;
  }

  renderEntryList();
  clearEntry();
  $navFilter.value = '';
  $searchInput.value = '';
  closeSearchResults();

  // Auto-select the first entry — the "0" (contents) entry
  const entries = DICTIONARY_DATA[book];
  if (entries && entries.length > 0) {
    const targetKey = initialKey && entries.some(e => e.key === initialKey) ? initialKey : entries[0].key;
    selectEntry(targetKey, { pushHistory });
  }

  updateHash();
}

// ── Entry list rendering ──────────────────────────────────────────

function renderEntryList(filter = '') {
  const allEntries = DICTIONARY_DATA[currentBook] || [];
  const isLexicon = (currentBook === 'greek' || currentBook === 'hebrew');
  const filterLower = filter.toLowerCase().trim();

  // Filter
  let entries = allEntries.filter(entry => {
    if (!filterLower) return true;
    if (entry.title.toLowerCase().includes(filterLower)) return true;
    const strongs = getPrimaryStrongs(entry).toLowerCase();
    if (strongs && strongs.includes(filterLower)) return true;
    if (isLexicon && getLexiconDomainLabel(entry).toLowerCase().includes(filterLower)) return true;
    return false;
  });

  let html = '';
  let lastDomain = null;
  let inGroup = false;

  if (isLexicon) {
    // Sort
    if (lexiconSortMode === 'strongs') {
      entries = [...entries].sort((a, b) => {
        const sa = getPrimaryStrongs(a) || 'Z9999';
        const sb = getPrimaryStrongs(b) || 'Z9999';
        return sa.localeCompare(sb);
      });
    } else if (lexiconSortMode === 'domain') {
      entries = [...entries].sort((a, b) => {
        const da = getLexiconDomainLabel(a) || '\uFFFF';
        const db = getLexiconDomainLabel(b) || '\uFFFF';
        if (da !== db) return da.localeCompare(db);
        return (getPrimaryStrongs(a) || a.title).localeCompare(getPrimaryStrongs(b) || b.title);
      });
    }
  }

  for (const entry of entries) {
    const depth = isLexicon ? 0 : Math.min(entry.depth, 3);
    const active = entry.key === currentEntryKey ? ' active' : '';

    // Domain group header
    if (isLexicon && lexiconSortMode === 'domain') {
      const dom = getLexiconDomainLabel(entry) || '(Unclassified)';
      if (dom !== lastDomain) {
        if (inGroup) {
          html += `</div>`; // Close previous group
        }
        
        const isOpen = !accordionMode || openDomains.has(dom);
        const accordionClass = accordionMode ? ' is-accordion' : '';
        const openClass = isOpen ? ' is-open' : '';
        const onclick = accordionMode ? ` onclick="toggleDomain('${escJs(dom)}'); event.stopPropagation();"` : '';
        
        html += `<button class="lex-domain-header${accordionClass}${openClass}"${onclick}>${escHtml(dom)}</button>`;
        html += `<div class="lex-domain-group${isOpen ? '' : ' is-collapsed'}">`;
        
        lastDomain = dom;
        inGroup = true;
      }
    }

    html += `<button class="entry-item depth-${depth}${active}"
                     data-key="${escHtml(entry.key)}"
                     role="option"
                     onclick="selectEntry('${escJs(entry.key)}')">`;

    if (isLexicon) {
      const strongs = getPrimaryStrongs(entry);
      if (strongs) {
        html += `<span class="entry-key entry-key-strongs">${escHtml(strongs)}</span>`;
      }
    } else {
      const keyDisplay = entry.key === '0' ? '' : entry.key;
      if (keyDisplay) html += `<span class="entry-key">${escHtml(keyDisplay)}</span>`;
    }

    html += `${escHtml(entry.title)}</button>`;
  }

  if (inGroup) {
    html += `</div>`;
  }

  $entryList.innerHTML = html;
  $entryCount.textContent = `${entries.length} entries`;
}

// ── Entry selection ───────────────────────────────────────────────

function selectEntry(key, options = {}) {
  const { pushHistory = true } = options;
  if (pushHistory && currentEntryKey !== null && currentEntryKey !== key) {
    pushEntryHistory(currentBook, currentEntryKey);
  }

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
  updateEntryBackButton();

  // On mobile, show middle panel
  if (window.innerWidth <= 768) {
    showMobilePanel('middle');
    closeMobileNav();
  }
}

function pushEntryHistory(book, key) {
  if (!book || key === null || key === undefined || key === '') return;
  const last = entryBackStack[entryBackStack.length - 1];
  if (last && last.book === book && last.key === key) return;
  entryBackStack.push({ book, key });
  if (entryBackStack.length > 250) {
    entryBackStack.shift();
  }
}

function goBackEntry() {
  if (entryBackStack.length === 0) return;
  const previous = entryBackStack.pop();
  if (!previous) return;
  switchBook(previous.book, {
    recordBack: false,
    initialKey: previous.key,
    pushHistory: false,
  });
}

function updateEntryBackButton() {
  if (!$entryBackBtn) return;
  $entryBackBtn.disabled = entryBackStack.length === 0;
}

// Navigate to a cross-reference (possibly in another book)
function navigateTo(target) {
  // Target format: "FAUNA:2.13", "GREEK:abc123", or "GREEK:lemma:μαρτυρέω"
  const match = target.match(/^(FAUNA|FLORA|REALIA|GREEK|HEBREW):(.+)$/i);
  if (match) {
    const book = match[1].toLowerCase();
    const rest = match[2];

    const doNav = () => {
      // Lemma-based lookup: "lemma:μαρτυρέω"
      if (rest.startsWith('lemma:')) {
        const lemma = rest.slice(6);
        const hit = resolveLemmaHit(book, lemma);
        if (hit) selectEntry(hit.key);
        return;
      }
      selectEntry(rest);
    };

    if (_bookLoadState[book] !== 'loaded') {
      if (book !== currentBook) switchBook(book);
      loadBookData(book).then(doNav);
    } else {
      if (book !== currentBook) switchBook(book);
      doNav();
    }
  }
}

async function resolveEntryFromTarget(target) {
  const match = (target || '').match(/^(FAUNA|FLORA|REALIA|GREEK|HEBREW):(.+)$/i);
  if (!match) return null;

  const book = match[1].toLowerCase();
  const rest = match[2];

  if (_bookLoadState[book] !== 'loaded') {
    await loadBookData(book);
  }

  if (rest.startsWith('lemma:')) {
    const lemma = rest.slice(6);
    const hit = resolveLemmaHit(book, lemma);
    if (!hit) return null;
    return entryMap[`${hit.book}:${hit.key}`] || null;
  }

  return entryMap[`${book}:${rest}`] || null;
}

function ensureCrossRefModal() {
  if ($crossRefModal) return;

  const modal = document.createElement('div');
  modal.className = 'xref-modal';
  modal.innerHTML = `
    <div class="xref-modal-backdrop" data-close-modal="1"></div>
    <div class="xref-modal-dialog" role="dialog" aria-modal="true" aria-label="Cross reference preview">
      <div class="xref-modal-header">
        <div class="xref-modal-title-wrap">
          <div class="xref-modal-title"></div>
          <div class="xref-modal-meta"></div>
        </div>
        <div class="xref-modal-actions">
          <button class="xref-modal-open" type="button">Open Entry</button>
          <button class="btn-icon xref-modal-close" type="button" aria-label="Close preview">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>
      </div>
      <div class="xref-modal-body"></div>
    </div>`;
  document.body.appendChild(modal);

  $crossRefModal = modal;
  $crossRefModalDialog = modal.querySelector('.xref-modal-dialog');
  $crossRefModalTitle = modal.querySelector('.xref-modal-title');
  $crossRefModalMeta = modal.querySelector('.xref-modal-meta');
  $crossRefModalBody = modal.querySelector('.xref-modal-body');
  $crossRefModalOpenBtn = modal.querySelector('.xref-modal-open');

  modal.querySelectorAll('[data-close-modal], .xref-modal-close').forEach(el => {
    el.addEventListener('click', () => closeCrossRefModal());
  });

  $crossRefModalOpenBtn.addEventListener('click', () => {
    const target = $crossRefModalOpenBtn.dataset.target || '';
    if (!target) return;
    closeCrossRefModal();
    navigateTo(target);
  });
}

function isCrossRefModalVisible() {
  return !!($crossRefModal && $crossRefModal.classList.contains('visible'));
}

function closeCrossRefModal() {
  if (!$crossRefModal) return;
  $crossRefModal.classList.remove('visible');
}

function buildCrossRefPreview(entry) {
  if (!entry) return '<p class="entry-paragraph">Entry unavailable.</p>';

  if (entry.book === 'greek' || entry.book === 'hebrew') {
    const baseFormSections = (entry.sections || []).filter(s => s.contentType === 'base-form');
    const senseSections = (entry.sections || []).filter(s => s.contentType === 'sense');

    const posLabels = [];
    for (const bf of baseFormSections) {
      const f = parseSectionFields(bf.paragraphs);
      const pos = Array.isArray(f['Part of Speech']) ? f['Part of Speech'][0] : f['Part of Speech'];
      if (pos && !posLabels.includes(pos)) posLabels.push(pos);
    }

    const inflections = [];
    for (const bf of baseFormSections) {
      const f = parseSectionFields(bf.paragraphs);
      const infl = Array.isArray(f['Inflections']) ? f['Inflections'][0] : f['Inflections'];
      if (infl && !inflections.includes(infl)) inflections.push(infl);
    }

    let translit = '';
    const firstLs = (entry.languageSets || [])[0];
    if (firstLs && firstLs.transliteration) {
      translit = firstLs.transliteration;
    }

    let html = '';
    html += `<div class="lex-entry-header">`;
    html += `<div class="lex-title-row">`;
    html += `<h1><span class="lex-lemma">${escHtml(entry.title)}</span>`;
    if (translit) {
      html += `<span class="lex-translit">${escHtml(translit)}</span>`;
    }
    html += `<span class="entry-book-badge ${entry.book}">${BOOK_LABELS[entry.book]}</span>`;
    html += `</h1>`;
    html += `</div>`;

    if (posLabels.length > 0) {
      html += `<div class="lex-pos-row">`;
      for (const pos of posLabels) {
        html += `<span class="lex-pos-badge">${escHtml(pos)}</span>`;
      }
      html += `</div>`;
    }

    if (inflections.length > 0) {
      html += `<div class="lex-inflections">`;
      html += `<span class="lex-inflections-label">Inflections</span>`;
      const renderedInfls = inflections.map(infl => {
        return infl.split('|').map(s => s.trim()).filter(Boolean)
          .map(s => `<span>${escHtml(s)}</span>`).join(' <span class="lex-infl-sep">·</span> ');
      }).join('; ');
      html += `<span class="lex-inflections-val">${renderedInfls}</span>`;
      html += `</div>`;
    }
    html += `</div>`;

    const hasMultipleSenses = senseSections.length > 1;
    for (let si = 0; si < senseSections.length; si++) {
      const f = parseSectionFields(senseSections[si].paragraphs);

      const domStr = Array.isArray(f['Domains']) ? f['Domains'][0] : (f['Domains'] || '');
      const subStr = Array.isArray(f['Subdomains']) ? f['Subdomains'][0] : (f['Subdomains'] || '');
      const coreStr = Array.isArray(f['Core Domains']) ? f['Core Domains'][0] : (f['Core Domains'] || '');
      const domLabel = domStr || coreStr || '';

      const glossStr = Array.isArray(f['Glosses']) ? f['Glosses'].join('; ') : (f['Glosses'] || '');
      const defStr = Array.isArray(f['Definition']) ? f['Definition'].join(' ') : (f['Definition'] || '');
      const collocStr = Array.isArray(f['Collocations']) ? f['Collocations'].join('; ') : (f['Collocations'] || '');
      const commentStr = Array.isArray(f['Comments']) ? f['Comments'].join(' ') : (f['Comments'] || '');

      html += `<div class="lex-sense${hasMultipleSenses ? ' has-num' : ''}">`;
      if (hasMultipleSenses) html += `<div class="lex-sense-num">${si + 1}</div>`;
      html += `<div class="lex-sense-body">`;

      if (domLabel || subStr) {
        html += `<div class="lex-domain-chips">`;
        if (domLabel) html += `<span class="lex-domain-chip">${domLabel}</span>`;
        if (subStr && subStr !== domLabel) html += `<span class="lex-domain-chip lex-chip-sub">${subStr}</span>`;
        html += `</div>`;
      }

      if (glossStr) html += `<div class="lex-glosses">${glossStr}</div>`;
      if (defStr) html += `<div class="lex-definition">${defStr}</div>`;
      if (collocStr) html += `<div class="lex-colloc"><span class="lex-colloc-label">Collocations</span>${collocStr}</div>`;
      if (commentStr) html += `<div class="lex-comment">${commentStr}</div>`;

      html += `</div></div>`;
    }

    return `<div class="entry-content xref-entry-content">${html}</div>`;
  }

  let html = '';
  const visibleSections = (entry.sections || []).filter(sec => !isReferencesSection(sec));
  const compactTerms = buildCompactTerms(entry.languageSets || []);

  html += `<div class="entry-title-block">`;
  html += `<h1>${escHtml(entry.title)}`;
  html += `<span class="entry-book-badge ${entry.book}">${BOOK_LABELS[entry.book]}</span>`;
  html += `</h1>`;
  if (entry.key !== '0') {
    html += `<div class="entry-breadcrumb">${escHtml(entry.book.toUpperCase())} § ${escHtml(entry.key)}</div>`;
  }
  html += `</div>`;

  if (compactTerms.length > 0 && ['fauna', 'flora', 'realia'].includes(entry.book)) {
    html += `<div class="entry-term-strip">`;
    html += `<div class="entry-term-strip-head">`;
    html += `<div class="entry-term-strip-label">Source Terms</div>`;
    html += `<div class="entry-term-control">`;
    html += `<span class="entry-term-control-text">Script</span>`;
    html += `<select class="entry-term-select" aria-label="Source term script mode">`;
    html += `<option value="original"${sourceTermMode === 'original' ? ' selected' : ''}>Original</option>`;
    html += `<option value="translit"${sourceTermMode === 'translit' ? ' selected' : ''}>Translit</option>`;
    html += `<option value="both"${sourceTermMode === 'both' ? ' selected' : ''}>Both</option>`;
    html += `</select>`;
    html += `</div></div>`;
    for (const group of compactTerms) {
      html += `<div class="entry-term-group">`;
      html += `<span class="entry-term-lang">${escHtml(group.language)}</span>`;
      for (const item of group.items) {
        const lemma = (item.lemma || '').trim();
        const translitItem = (item.transliteration || '').trim();

        if (sourceTermMode === 'both' && lemma && translitItem && normalizeTermForIndex(lemma) !== normalizeTermForIndex(translitItem)) {
          html += `<button class="entry-term-chip" data-language="${escHtml(group.language)}" data-lemma="${escHtml(lemma)}" data-translit="${escHtml(translitItem)}" data-prefer="lemma" title="Open related entry">${escHtml(lemma)}</button>`;
          html += `<button class="entry-term-chip is-translit" data-language="${escHtml(group.language)}" data-lemma="${escHtml(lemma)}" data-translit="${escHtml(translitItem)}" data-prefer="translit" title="Open related entry">${escHtml(translitItem)}</button>`;
          continue;
        }

        const label = getSourceTermLabel(item, sourceTermMode);
        if (!label) continue;
        const prefer = sourceTermMode === 'translit' ? 'translit' : 'lemma';
        const translitClass = sourceTermMode === 'translit' ? ' is-translit' : '';
        html += `<button class="entry-term-chip${translitClass}" data-language="${escHtml(group.language)}" data-lemma="${escHtml(lemma)}" data-translit="${escHtml(translitItem)}" data-prefer="${prefer}" title="Open related entry">${escHtml(label)}</button>`;
      }
      html += `</div>`;
    }
    html += `</div>`;
  }

  if (entry.indexItems && entry.indexItems.length > 0) {
    html += `<div class="entry-index">`;
    html += `<div class="entry-index-title">Contents</div>`;
    html += `<ul>`;
    for (const item of entry.indexItems) {
      html += `<li><a class="cross-ref" data-target="${escHtml(item.target)}">${item.label}</a></li>`;
    }
    html += `</ul></div>`;
  }

  for (const sec of visibleSections) {
    html += `<div class="entry-section">`;
    if (sec.headingHtml) {
      html += `<div class="section-heading">${sec.headingHtml}</div>`;
    }
    if (sec.subheading) {
      html += `<p class="entry-paragraph"><em>${escHtml(sec.subheading)}</em></p>`;
    }
    if (sec.languageSets && sec.languageSets.length > 0) {
      for (const ls of sec.languageSets) {
        html += `<div class="lang-set-inline">`;
        html += `<span class="lang-label">${escHtml(ls.language)}</span>`;
        html += `<span class="lang-lemma">${escHtml(ls.lemma)}</span>`;
        if (ls.transliteration) {
          html += ` <span class="lang-translit">(${escHtml(ls.transliteration)})</span>`;
        }
        html += `</div>`;
      }
    }
    for (const p of sec.paragraphs) {
      html += `<p class="entry-paragraph">${p}</p>`;
    }
    html += `</div>`;
  }

  return `<div class="entry-content xref-entry-content">${html}</div>`;
}

async function openCrossRefModal(target) {
  ensureCrossRefModal();
  $crossRefModal.classList.add('visible');
  $crossRefModalTitle.textContent = 'Loading…';
  $crossRefModalMeta.textContent = '';
  $crossRefModalBody.innerHTML = '<div class="xref-modal-loading">Loading cross-reference…</div>';
  $crossRefModalOpenBtn.disabled = true;
  $crossRefModalOpenBtn.dataset.target = '';

  try {
    const entry = await resolveEntryFromTarget(target);
    if (!entry) {
      $crossRefModalTitle.textContent = 'Entry not found';
      $crossRefModalMeta.textContent = '';
      $crossRefModalBody.innerHTML = '<p class="entry-paragraph">The referenced entry could not be resolved.</p>';
      return;
    }

    $crossRefModalTitle.textContent = entry.title;
    $crossRefModalMeta.textContent = `${BOOK_LABELS[entry.book]} · ${entry.key}`;
    $crossRefModalBody.innerHTML = buildCrossRefPreview(entry);
    $crossRefModalOpenBtn.disabled = false;
    $crossRefModalOpenBtn.dataset.target = `${entry.book.toUpperCase()}:${entry.key}`;

    $crossRefModalBody.querySelectorAll('.cross-ref').forEach(el => {
      el.addEventListener('click', () => openCrossRefModal(el.dataset.target));
    });

    $crossRefModalBody.querySelectorAll('.entry-term-chip').forEach(el => {
      el.addEventListener('click', () => {
        const lemma = el.dataset.lemma || '';
        const translit = el.dataset.translit || '';
        const language = el.dataset.language || '';
        const prefer = el.dataset.prefer || (sourceTermMode === 'translit' ? 'translit' : 'lemma');
        const primary = prefer === 'translit' ? translit : lemma;
        const secondary = prefer === 'translit' ? lemma : translit;
        const target = findLinkedEntryForTerm(primary, language, entry) || findLinkedEntryForTerm(secondary, language, entry);
        if (!target) return;
        openCrossRefModal(`${target.book.toUpperCase()}:${target.key}`);
      });
    });

    const modeSelect = $crossRefModalBody.querySelector('.entry-term-select');
    if (modeSelect) {
      modeSelect.addEventListener('change', () => {
        const mode = modeSelect.value;
        if (!SOURCE_TERM_MODES.includes(mode)) return;
        if (mode !== sourceTermMode) {
          sourceTermMode = mode;
          localStorage.setItem('sourceTermMode', sourceTermMode);
          openCrossRefModal(target);
        }
      });
    }

    $crossRefModalBody.querySelectorAll('.scripture-ref').forEach(el => {
      el.addEventListener('click', () => {
        const reference = (el.dataset.reference || el.textContent || '').trim();
        if (!reference) return;
        closeCrossRefModal();
        performReferenceLookup(reference);
        rightPanelTab = 'lookup';
        const liveEntry = entryMap[`${currentBook}:${currentEntryKey}`];
        if (liveEntry) {
          renderRightPanel(liveEntry);
        }
        fetchLookupVerseText(reference);
      });
    });
  } catch (error) {
    $crossRefModalTitle.textContent = 'Preview unavailable';
    $crossRefModalMeta.textContent = '';
    $crossRefModalBody.innerHTML = '<p class="entry-paragraph">Could not load the referenced entry right now.</p>';
  }
}

// ── Lexicon entry renderer (Greek / Hebrew) ──────────────────────

function renderLexiconEntry(entry) {
  const baseFormSections = (entry.sections || []).filter(s => s.contentType === 'base-form');
  const senseSections    = (entry.sections || []).filter(s => s.contentType === 'sense');

  // Collect unique POS labels across all base forms
  const posLabels = [];
  for (const bf of baseFormSections) {
    const f = parseSectionFields(bf.paragraphs);
    const pos = Array.isArray(f['Part of Speech']) ? f['Part of Speech'][0] : f['Part of Speech'];
    if (pos && !posLabels.includes(pos)) posLabels.push(pos);
  }

  // Inflections — collect from all base forms, deduplicate
  const inflections = [];
  for (const bf of baseFormSections) {
    const f = parseSectionFields(bf.paragraphs);
    const infl = Array.isArray(f['Inflections']) ? f['Inflections'][0] : f['Inflections'];
    if (infl && !inflections.includes(infl)) inflections.push(infl);
  }

  // Get transliteration from first language set if present
  let translit = '';
  const firstLs = (entry.languageSets || [])[0];
  if (firstLs && firstLs.transliteration) {
    translit = firstLs.transliteration;
  }

  let html = '';
  html += `<div class="lex-entry-header">`;
  html += `<div class="lex-title-row">`;
  html += `<h1><span class="lex-lemma">${escHtml(entry.title)}</span>`;
  if (translit) {
    html += `<span class="lex-translit">${escHtml(translit)}</span>`;
  }
  html += `<span class="entry-book-badge ${entry.book}">${BOOK_LABELS[entry.book]}</span>`;
  html += `</h1>`;
  html += `</div>`; // lex-title-row

  if (posLabels.length > 0) {
    html += `<div class="lex-pos-row">`;
    for (const pos of posLabels) {
      html += `<span class="lex-pos-badge">${escHtml(pos)}</span>`;
    }
    html += `</div>`;
  }

  if (inflections.length > 0) {
    html += `<div class="lex-inflections">`;
    html += `<span class="lex-inflections-label">Inflections</span>`;
    const renderedInfls = inflections.map(infl => {
      return infl.split('|').map(s => s.trim()).filter(Boolean)
        .map(s => `<span>${escHtml(s)}</span>`).join(' <span class="lex-infl-sep">·</span> ');
    }).join('; ');
    html += `<span class="lex-inflections-val">${renderedInfls}</span>`;
    html += `</div>`;
  }
  html += `</div>`; // lex-entry-header

  // Senses
  const hasMultipleSenses = senseSections.length > 1;
  for (let si = 0; si < senseSections.length; si++) {
    const f = parseSectionFields(senseSections[si].paragraphs);

    const domStr  = Array.isArray(f['Domains'])     ? f['Domains'][0]     : (f['Domains'] || '');
    const subStr  = Array.isArray(f['Subdomains'])  ? f['Subdomains'][0]  : (f['Subdomains'] || '');
    const coreStr = Array.isArray(f['Core Domains'])? f['Core Domains'][0]: (f['Core Domains'] || '');
    const domLabel = domStr || coreStr || '';

    const glossStr   = Array.isArray(f['Glosses'])     ? f['Glosses'].join('; ')     : (f['Glosses'] || '');
    const defStr     = Array.isArray(f['Definition'])  ? f['Definition'].join(' ')   : (f['Definition'] || '');
    const collocStr  = Array.isArray(f['Collocations'])? f['Collocations'].join('; '): (f['Collocations'] || '');
    const commentStr = Array.isArray(f['Comments'])    ? f['Comments'].join(' ')     : (f['Comments'] || '');

    html += `<div class="lex-sense${hasMultipleSenses ? ' has-num' : ''}">`;
    if (hasMultipleSenses) html += `<div class="lex-sense-num">${si + 1}</div>`;
    html += `<div class="lex-sense-body">`;

    if (domLabel || subStr) {
      html += `<div class="lex-domain-chips">`;
      if (domLabel) html += `<span class="lex-domain-chip">${domLabel}</span>`;
      if (subStr && subStr !== domLabel) html += `<span class="lex-domain-chip lex-chip-sub">${subStr}</span>`;
      html += `</div>`;
    }

    if (glossStr) html += `<div class="lex-glosses">${glossStr}</div>`;
    if (defStr)   html += `<div class="lex-definition">${defStr}</div>`;
    if (collocStr) html += `<div class="lex-colloc"><span class="lex-colloc-label">Collocations</span>${collocStr}</div>`;
    if (commentStr) html += `<div class="lex-comment">${commentStr}</div>`;

    html += `</div></div>`; // lex-sense-body, lex-sense
  }

  $entryContent.innerHTML = html;
  $middlePanel.scrollTop = 0;
  document.title = `${entry.title} — ${BOOK_LABELS[entry.book]} — Bible Reference`;

  // Attach click handlers for cross-ref links generated from {L:...} codes
  $entryContent.querySelectorAll('.cross-ref').forEach(el => {
    el.addEventListener('click', () => openCrossRefModal(el.dataset.target));
  });

  // Attach click handlers for scripture refs generated from {S:...} codes
  $entryContent.querySelectorAll('.scripture-ref').forEach(el => {
    el.addEventListener('click', () => {
      const reference = (el.dataset.reference || el.textContent || '').trim();
      if (!reference) return;
      performReferenceLookup(reference);
      rightPanelTab = 'lookup';
      const liveEntry = entryMap[`${currentBook}:${currentEntryKey}`];
      if (liveEntry) {
        renderRightPanel(liveEntry);
      }
      fetchLookupVerseText(reference);
    });
  });
}

// ── Entry content rendering ───────────────────────────────────────

function renderEntry(entry, options = {}) {
  // Dedicated renderer for Greek/Hebrew lexicons
  if (entry.book === 'greek' || entry.book === 'hebrew') {
    renderLexiconEntry(entry);
    return;
  }

  const resetScroll = options.resetScroll !== false;
  let html = '';

  const visibleSections = (entry.sections || []).filter(sec => !isReferencesSection(sec));
  const compactTerms = buildCompactTerms(entry.languageSets || []);

  // Title block
  html += `<div class="entry-title-block">`;
  html += `<h1>${escHtml(entry.title)}`;
  html += `<span class="entry-book-badge ${entry.book}">${BOOK_LABELS[entry.book]}</span>`;
  html += `</h1>`;
  if (entry.key !== '0') {
    html += `<div class="entry-breadcrumb">${escHtml(entry.book.toUpperCase())} § ${escHtml(entry.key)}</div>`;
  }
  html += `</div>`;

  // Compact terms strip (instead of bulky References section)
  if (compactTerms.length > 0 && ['fauna', 'flora', 'realia'].includes(entry.book)) {
    const modeLabel = sourceTermMode === 'original' ? 'Original' : sourceTermMode === 'translit' ? 'Translit' : 'Both';
    html += `<div class="entry-term-strip">`;
    html += `<div class="entry-term-strip-head">`;
    html += `<div class="entry-term-strip-label">Source Terms</div>`;
    html += `<div class="entry-term-control">`;
    html += `<span class="entry-term-control-text">Script</span>`;
    html += `<select class="entry-term-select" aria-label="Source term script mode">`;
    html += `<option value="original"${sourceTermMode === 'original' ? ' selected' : ''}>Original</option>`;
    html += `<option value="translit"${sourceTermMode === 'translit' ? ' selected' : ''}>Translit</option>`;
    html += `<option value="both"${sourceTermMode === 'both' ? ' selected' : ''}>Both</option>`;
    html += `</select>`;
    html += `</div></div>`;
    for (const group of compactTerms) {
      html += `<div class="entry-term-group">`;
      html += `<span class="entry-term-lang">${escHtml(group.language)}</span>`;
      for (const item of group.items) {
        const lemma = (item.lemma || '').trim();
        const translit = (item.transliteration || '').trim();

        if (sourceTermMode === 'both' && lemma && translit && normalizeTermForIndex(lemma) !== normalizeTermForIndex(translit)) {
          html += `<button class="entry-term-chip" data-language="${escHtml(group.language)}" data-lemma="${escHtml(lemma)}" data-translit="${escHtml(translit)}" data-prefer="lemma" title="Open related entry">${escHtml(lemma)}</button>`;
          html += `<button class="entry-term-chip is-translit" data-language="${escHtml(group.language)}" data-lemma="${escHtml(lemma)}" data-translit="${escHtml(translit)}" data-prefer="translit" title="Open related entry">${escHtml(translit)}</button>`;
          continue;
        }

        const label = getSourceTermLabel(item, sourceTermMode);
        if (!label) continue;
        const prefer = sourceTermMode === 'translit' ? 'translit' : 'lemma';
        const translitClass = sourceTermMode === 'translit' ? ' is-translit' : '';
        html += `<button class="entry-term-chip${translitClass}" data-language="${escHtml(group.language)}" data-lemma="${escHtml(lemma)}" data-translit="${escHtml(translit)}" data-prefer="${prefer}" title="Open related entry">${escHtml(label)}</button>`;
      }
      html += `</div>`;
    }
    html += `</div>`;
  }

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
  for (const sec of visibleSections) {
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

  if (resetScroll) {
    $middlePanel.scrollTop = 0;
  }

  // Attach cross-ref click handlers
  $entryContent.querySelectorAll('.cross-ref').forEach(el => {
    el.addEventListener('click', () => openCrossRefModal(el.dataset.target));
  });

  $entryContent.querySelectorAll('.entry-term-chip').forEach(el => {
    el.addEventListener('click', () => {
      const lemma = el.dataset.lemma || '';
      const translit = el.dataset.translit || '';
      const language = el.dataset.language || '';
      const prefer = el.dataset.prefer || (sourceTermMode === 'translit' ? 'translit' : 'lemma');
      const primary = prefer === 'translit' ? translit : lemma;
      const secondary = prefer === 'translit' ? lemma : translit;
      const target = findLinkedEntryForTerm(primary, language, entry) || findLinkedEntryForTerm(secondary, language, entry);
      if (!target) return;
      if (target.book !== currentBook) {
        switchBook(target.book);
      }
      selectEntry(target.key);
    });
  });

  const modeSelect = $entryContent.querySelector('.entry-term-select');
  if (modeSelect) {
    modeSelect.addEventListener('change', () => {
      const mode = modeSelect.value;
      if (!SOURCE_TERM_MODES.includes(mode)) return;
      if (mode !== sourceTermMode) {
        sourceTermMode = mode;
        localStorage.setItem('sourceTermMode', sourceTermMode);
        renderEntry(entry, { resetScroll: false });
      }
    });
  }

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

function parseReferenceQuery(query) {
  const cleaned = (query || '').trim().replace(/[–—]/g, '-').replace(/\s*\-\s*/g, '-').replace(/\s+/g, ' ');
  if (!cleaned) {
    return { error: 'Enter a reference like John 3:16 or John 3:16-18.' };
  }

  const dashIndex = cleaned.indexOf('-');
  if (dashIndex === -1) {
    const single = parseReferenceUnit(cleaned);
    if (!single) {
      return { error: 'Reference format not recognized. Use Book Chapter:Verse.' };
    }
    return { start: single, end: single };
  }

  const left = cleaned.slice(0, dashIndex).trim();
  const right = cleaned.slice(dashIndex + 1).trim();
  const start = parseReferenceUnit(left);
  if (!start) {
    return { error: 'Range start is invalid. Try John 3:16-18.' };
  }

  const end = parseReferenceUnit(right, { book: start.book, chapter: start.chapter });
  if (!end) {
    return { error: 'Range end is invalid. Use verse only, chapter:verse, or full reference.' };
  }

  if (compareReferences(start, end) <= 0) {
    return { start, end };
  }
  return { start: end, end: start };
}

function formatSingleReference(ref) {
  return `${ref.book} ${ref.chapter}:${ref.verse}`;
}

function formatLookupRangeLabel(start, end) {
  if (!start || !end) return '';
  if (start.book === end.book && start.chapter === end.chapter && start.verse === end.verse) {
    return formatSingleReference(start);
  }
  if (start.book === end.book && start.chapter === end.chapter) {
    return `${start.book} ${start.chapter}:${start.verse}-${end.verse}`;
  }
  if (start.book === end.book) {
    return `${start.book} ${start.chapter}:${start.verse}-${end.chapter}:${end.verse}`;
  }
  return `${formatSingleReference(start)} - ${formatSingleReference(end)}`;
}

function toKjvBookName(book) {
  return KJV_BOOK_NAMES[book] || book;
}

function formatReferenceForBibleApi(start, end) {
  if (!start || !end) return '';
  const startBook = toKjvBookName(start.book);
  const endBook = toKjvBookName(end.book);

  if (start.book === end.book && start.chapter === end.chapter && start.verse === end.verse) {
    return `${startBook} ${start.chapter}:${start.verse}`;
  }
  if (start.book === end.book && start.chapter === end.chapter) {
    return `${startBook} ${start.chapter}:${start.verse}-${end.verse}`;
  }
  if (start.book === end.book) {
    return `${startBook} ${start.chapter}:${start.verse}-${end.chapter}:${end.verse}`;
  }
  return `${startBook} ${start.chapter}:${start.verse}-${endBook} ${end.chapter}:${end.verse}`;
}

function normalizeVerseText(text) {
  return (text || '').toString().replace(/\s+/g, ' ').trim();
}

async function fetchLookupVerseText(rawQuery) {
  const query = (rawQuery || '').trim();
  if (!query) {
    reverseLookupState.verseStatus = 'idle';
    reverseLookupState.verseTexts = [];
    reverseLookupState.verseError = '';
    return;
  }

  const parsed = parseReferenceQuery(query);
  if (parsed.error) {
    reverseLookupState.verseStatus = 'error';
    reverseLookupState.verseTexts = [];
    reverseLookupState.verseError = parsed.error;
    return;
  }

  const lookupToken = `${formatLookupRangeLabel(parsed.start, parsed.end)}|${Date.now()}`;
  reverseLookupState._lookupToken = lookupToken;
  reverseLookupState.verseStatus = 'loading';
  reverseLookupState.verseTexts = [];
  reverseLookupState.verseError = '';
  const liveEntry = entryMap[`${currentBook}:${currentEntryKey}`];
  if (liveEntry) {
    renderRightPanel(liveEntry);
  }

  const apiReference = formatReferenceForBibleApi(parsed.start, parsed.end);
  const endpoint = `https://bible-api.com/${encodeURIComponent(apiReference)}?translation=kjv`;

  try {
    const response = await fetch(endpoint);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    const payload = await response.json();
    if (reverseLookupState._lookupToken !== lookupToken || reverseLookupState.query !== query) {
      return;
    }

    const verses = [];
    if (Array.isArray(payload.verses) && payload.verses.length > 0) {
      for (const verse of payload.verses) {
        const bookName = verse.book_name || '';
        const chapter = verse.chapter;
        const number = verse.verse;
        if (!bookName || !Number.isFinite(chapter) || !Number.isFinite(number)) continue;
        verses.push({
          label: `${bookName} ${chapter}:${number}`,
          text: normalizeVerseText(verse.text),
        });
      }
    } else if (payload.text) {
      const fallbackLabel = payload.reference || formatLookupRangeLabel(parsed.start, parsed.end);
      verses.push({ label: fallbackLabel, text: normalizeVerseText(payload.text) });
    }

    reverseLookupState.verseTexts = verses;
    reverseLookupState.verseStatus = verses.length > 0 ? 'ready' : 'error';
    reverseLookupState.verseError = verses.length > 0 ? '' : 'Verse text is unavailable for this reference in KJV via the current service.';
  } catch (error) {
    if (reverseLookupState._lookupToken !== lookupToken || reverseLookupState.query !== query) {
      return;
    }
    reverseLookupState.verseStatus = 'error';
    reverseLookupState.verseTexts = [];
    reverseLookupState.verseError = 'Could not load verse text right now. Please try again.';
  }

  const latestEntry = entryMap[`${currentBook}:${currentEntryKey}`];
  if (latestEntry) {
    renderRightPanel(latestEntry);
  }
}

function parseEntryKeySegments(key) {
  return (key || '')
    .split('.')
    .map(v => parseInt(v, 10))
    .map(v => (Number.isFinite(v) ? v : Number.MAX_SAFE_INTEGER));
}

function compareLookupEntries(a, b) {
  const bookPosA = ENTRY_BOOK_POSITION[a.book] ?? Number.MAX_SAFE_INTEGER;
  const bookPosB = ENTRY_BOOK_POSITION[b.book] ?? Number.MAX_SAFE_INTEGER;
  if (bookPosA !== bookPosB) return bookPosA - bookPosB;

  const segA = parseEntryKeySegments(a.key);
  const segB = parseEntryKeySegments(b.key);
  const maxLen = Math.max(segA.length, segB.length);
  for (let i = 0; i < maxLen; i += 1) {
    const va = segA[i] ?? -1;
    const vb = segB[i] ?? -1;
    if (va !== vb) return va - vb;
  }

  return a.title.localeCompare(b.title);
}

function performReferenceLookup(rawQuery) {
  const query = (rawQuery || '').trim();
  reverseLookupState.query = query;
  reverseLookupState.error = '';
  reverseLookupState.results = [];
  reverseLookupState.matchedVerses = 0;
  reverseLookupState.verseStatus = query ? 'loading' : 'idle';
  reverseLookupState.verseError = '';
  reverseLookupState.verseTexts = [];

  const parsed = parseReferenceQuery(query);
  if (parsed.error) {
    reverseLookupState.error = parsed.error;
    return;
  }

  const matchedEntries = new Map();
  let matchedVerses = 0;

  for (const ref of indexedReferences) {
    if (compareReferences(ref, parsed.start) < 0) continue;
    if (compareReferences(ref, parsed.end) > 0) continue;
    matchedVerses += 1;

    const entries = reverseRefIndex.get(ref.verseKey) || [];
    for (const entry of entries) {
      if (!matchedEntries.has(entry.id)) {
        matchedEntries.set(entry.id, entry);
      }
    }
  }

  reverseLookupState.matchedVerses = matchedVerses;
  reverseLookupState.results = Array.from(matchedEntries.values()).sort(compareLookupEntries);
}

function renderReverseLookupSection() {
  const state = reverseLookupState;
  let html = '';

  html += `<div class="right-section right-ref-lookup">`;
  html += `<div class="right-section-title">Reference Lookup</div>`;
  html += `<form class="ref-lookup-form">`;
  html += `<input type="search" class="ref-lookup-input" name="reference" placeholder="e.g. John 3:16 or John 3:16-18" value="${escHtml(state.query)}" autocomplete="off" spellcheck="false">`;
  html += `<button type="submit" class="ref-lookup-btn">Find Entries</button>`;
  html += `</form>`;
  html += `<div class="ref-lookup-hint">Supports verse and verse ranges.</div>`;

  if (state.error) {
    html += `<div class="ref-lookup-message is-error">${escHtml(state.error)}</div>`;
  } else if (state.query) {
    if (state.results.length > 0) {
      html += `<div class="ref-lookup-message">${state.results.length} entries across ${state.matchedVerses} verse${state.matchedVerses === 1 ? '' : 's'}.</div>`;
      html += `<div class="ref-lookup-results">`;
      for (const result of state.results) {
        const active = currentBook === result.book && currentEntryKey === result.key ? ' is-active' : '';
        html += `<button class="ref-lookup-item${active}" data-book="${escHtml(result.book)}" data-key="${escHtml(result.key)}" type="button">`;
        html += `<span class="ref-lookup-item-title">${escHtml(result.title)}</span>`;
        html += `<span class="ref-lookup-item-meta">${escHtml(BOOK_LABELS[result.book])} · ${escHtml(result.key)}</span>`;
        html += `</button>`;
      }
      html += `</div>`;
    } else {
      html += `<div class="ref-lookup-message">No entries found for this reference.</div>`;
    }

    html += `<div class="ref-lookup-verses">`;
    html += `<div class="ref-lookup-verses-title">Verse Text (KJV)</div>`;
    if (state.verseStatus === 'loading') {
      html += `<div class="ref-lookup-message">Loading verse text…</div>`;
    } else if (state.verseStatus === 'error') {
      html += `<div class="ref-lookup-message is-error">${escHtml(state.verseError || 'Verse text could not be loaded.')}</div>`;
    } else if (state.verseTexts.length > 0) {
      html += `<div class="ref-lookup-verse-list">`;
      for (const verse of state.verseTexts) {
        html += `<div class="ref-lookup-verse-item">`;
        html += `<div class="ref-lookup-verse-label">${escHtml(verse.label)}</div>`;
        html += `<div class="ref-lookup-verse-text">${escHtml(verse.text)}</div>`;
        html += `</div>`;
      }
      html += `</div>`;
    }
    html += `</div>`;
  }

  html += `</div>`;
  return html;
}

function renderMetadataSection(entry) {
  const meta = entry.meta || {};
  const semanticDomains = Array.isArray(entry.semanticDomains) ? entry.semanticDomains : [];
  const hasMeta = semanticDomains.length > 0 || (meta && Object.keys(meta).length > 0);
  if (!hasMeta) return '';

  let html = '<div class="right-section">';
  html += '<div class="right-section-title">Lexical Metadata</div>';

  if (semanticDomains.length > 0) {
    html += '<div class="right-meta-group">';
    html += '<div class="right-meta-label">Semantic Domains</div>';
    html += '<div class="right-meta-chip-list">';
    for (const domain of semanticDomains.slice(0, 24)) {
      const code = (domain.code || '').trim();
      const label = (domain.label || '').trim();
      const text = [code, label].filter(Boolean).join(' · ');
      if (text) {
        html += `<span class="right-meta-chip">${escHtml(text)}</span>`;
      }
    }
    html += '</div></div>';
  }

  const metaRows = [
    ['Entry ID', meta.entryId],
    ['Version', meta.version],
    ['Alphabet Position', meta.alphaPos],
    ['Has Aramaic', meta.hasAramaic],
    ['In LXX', meta.inLXX],
  ];
  for (const [label, value] of metaRows) {
    if (!value) continue;
    html += `<div class="right-meta-row"><span class="right-meta-k">${escHtml(label)}</span><span class="right-meta-v">${escHtml(String(value))}</span></div>`;
  }

  const listRows = [
    ['Authors', meta.authors],
    ['Contributors', meta.contributors],
    ['Alternate Lemmas', meta.alternateLemmas],
    ['Main Links', meta.mainLinks],
    ['Editorial Notes', meta.notes],
  ];
  for (const [label, values] of listRows) {
    if (!Array.isArray(values) || values.length === 0) continue;
    html += `<div class="right-meta-group"><div class="right-meta-label">${escHtml(label)}</div>`;
    html += '<ul class="right-meta-list">';
    for (const value of values.slice(0, 20)) {
      html += `<li>${escHtml(value)}</li>`;
    }
    html += '</ul></div>';
  }

  html += '</div>';
  return html;
}

function renderRelatedEntriesSection(entry) {
  const relatedEntries = Array.isArray(entry.relatedEntries) ? entry.relatedEntries : [];
  const crossRefs = Array.isArray(entry.crossRefs) ? entry.crossRefs : [];
  if (relatedEntries.length === 0 && crossRefs.length === 0) {
    return '<div class="right-section"><div class="right-section-title">Related</div><div class="ref-lookup-message">No related entries available.</div></div>';
  }

  let html = '';
  if (relatedEntries.length > 0) {
    html += '<div class="right-section">';
    html += `<div class="right-section-title">Semantic Related Entries (${relatedEntries.length})</div>`;
    html += '<div class="right-related-list">';
    for (const related of relatedEntries.slice(0, 20)) {
      const matchedRefs = Array.isArray(related.matchedRefs) ? related.matchedRefs : [];
      html += `<button class="right-related-item" type="button" data-book="${escHtml(related.book)}" data-key="${escHtml(related.key)}">`;
      html += `<span class="right-related-title">${escHtml(related.title)}</span>`;
      html += `<span class="right-related-meta">${escHtml(BOOK_LABELS[related.book] || related.book)} · ${escHtml(related.key)}</span>`;
      if (matchedRefs.length > 0) {
        html += `<span class="right-related-match">Shared refs: ${escHtml(matchedRefs.slice(0, 3).join('; '))}</span>`;
      }
      html += '</button>';
    }
    html += '</div></div>';
  }

  if (crossRefs.length > 0) {
    html += `<div class="right-section">`;
    html += `<div class="right-section-title">Cross References</div>`;
    for (const target of crossRefs) {
      const targetEntry = resolveTarget(target);
      const label = targetEntry ? targetEntry.title : target;
      html += `<a class="right-crossref-item" data-target="${escHtml(target)}">${escHtml(label)}</a>`;
    }
    html += `</div>`;
  }

  return html;
}

function getRightPanelTabs(entry) {
  const tabs = [
    { id: 'details', label: 'Details' },
    { id: 'lookup', label: 'Lookup' },
  ];
  const hasRelated = (entry.relatedEntries && entry.relatedEntries.length > 0) || (entry.crossRefs && entry.crossRefs.length > 0);
  const hasMeta = (entry.semanticDomains && entry.semanticDomains.length > 0) || (entry.meta && Object.keys(entry.meta).length > 0);
  if (hasRelated || hasMeta) {
    tabs.push({ id: 'related', label: 'Related' });
  }
  return tabs;
}

function renderRightDetails(entry) {
  let html = '';

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
          html += `<button class="right-ref-item right-ref-lookup-trigger" type="button" data-reference="${escHtml(ref)}">${escHtml(ref)}</button>`;
        }
        html += `</div>`;
      }

      if (ls.strongs && ls.strongs.length > 0) {
        html += `<div class="right-strongs-list">`;
        for (const strongsId of ls.strongs) {
          const id = escHtml(strongsId);
          const bhLink = strongsBibleHubUrl(strongsId);
          html += `<a class="right-strongs-item" href="${bhLink}" target="_blank" rel="noopener" title="Open ${id} on BibleHub">${id}</a>`;
        }
        html += `</div>`;
      }
      html += `</div>`;
    }
    html += `</div>`;
  }

  // For lexicon books Strong's already shown inline in languageSet card above — skip duplicate section
  const isLexiconEntry = (entry.book === 'greek' || entry.book === 'hebrew');
  if (!isLexiconEntry) {
    const entryStrongs = collectEntryStrongs(entry);
    if (entryStrongs.length > 0) {
      html += `<div class="right-section">`;
      html += `<div class="right-section-title">Strong's Links (${entryStrongs.length})</div>`;
      html += `<div class="right-strongs-list">`;
      for (const strongsId of entryStrongs) {
        const id = escHtml(strongsId);
        html += `<a class="right-strongs-item" href="${strongsBibleHubUrl(strongsId)}" target="_blank" rel="noopener">BibleHub ${id}</a>`;
      }
      html += `</div></div>`;
    }
  }

  if (entry.references && entry.references.length > 0) {
    html += `<div class="right-section">`;
    html += `<div class="right-section-title">Scripture References (${entry.references.length})</div>`;
    html += `<div class="right-ref-list">`;
    for (const ref of entry.references) {
      html += `<button class="right-ref-item right-ref-lookup-trigger" type="button" data-reference="${escHtml(ref)}">${escHtml(ref)}</button>`;
    }
    html += `</div></div>`;
  }

  html += renderMetadataSection(entry);
  return html;
}

// ── Right panel rendering ─────────────────────────────────────────

function renderRightPanel(entry) {
  const tabs = getRightPanelTabs(entry);
  if (!tabs.some(tab => tab.id === rightPanelTab)) {
    rightPanelTab = 'details';
  }

  let html = '<div class="right-tabbar">';
  for (const tab of tabs) {
    const active = rightPanelTab === tab.id ? ' active' : '';
    html += `<button class="right-tab-btn${active}" data-tab="${tab.id}" type="button">${escHtml(tab.label)}</button>`;
  }
  html += '</div>';

  if (rightPanelTab === 'lookup') {
    html += renderReverseLookupSection();
  } else if (rightPanelTab === 'related') {
    html += renderRelatedEntriesSection(entry);
  } else {
    html += renderRightDetails(entry);
  }

  html += `<div class="right-attribution">`;
  html += `© United Bible Societies, 2025.<br>`;
  html += `<a href="http://creativecommons.org/licenses/by-sa/4.0/" target="_blank" rel="noopener">CC BY-SA 4.0</a><br>`;
  html += `Developed by <a href="https://tfbf.in" target="_blank" rel="noopener">TFBF</a>`;
  html += `</div>`;

  $rightContent.innerHTML = html;

  $rightContent.querySelectorAll('.right-tab-btn').forEach(el => {
    el.addEventListener('click', () => {
      const nextTab = el.dataset.tab;
      if (!nextTab || nextTab === rightPanelTab) return;
      rightPanelTab = nextTab;
      renderRightPanel(entry);
    });
  });

  const lookupForm = $rightContent.querySelector('.ref-lookup-form');
  if (lookupForm) {
    lookupForm.addEventListener('submit', (event) => {
      event.preventDefault();
      const input = lookupForm.querySelector('.ref-lookup-input');
      const query = input ? input.value : '';
      performReferenceLookup(query);
      rightPanelTab = 'lookup';
      renderRightPanel(entry);
      fetchLookupVerseText(query);
    });
  }

  $rightContent.querySelectorAll('.right-ref-lookup-trigger').forEach(el => {
    el.addEventListener('click', () => {
      const reference = (el.dataset.reference || '').trim();
      if (!reference) return;
      performReferenceLookup(reference);
      rightPanelTab = 'lookup';
      renderRightPanel(entry);
      fetchLookupVerseText(reference);
    });
  });

  $rightContent.querySelectorAll('.ref-lookup-item').forEach(el => {
    el.addEventListener('click', () => {
      const book = el.dataset.book;
      const key = el.dataset.key;
      if (!book || !key) return;
      if (_bookLoadState[book] !== 'loaded') {
        switchBook(book);
        loadBookData(book).then(() => selectEntry(key));
      } else {
        if (book !== currentBook) switchBook(book);
        selectEntry(key);
      }
    });
  });

  $rightContent.querySelectorAll('.right-related-item').forEach(el => {
    el.addEventListener('click', () => {
      const book = el.dataset.book;
      const key = el.dataset.key;
      if (!book || !key) return;
      if (_bookLoadState[book] !== 'loaded') {
        switchBook(book);
        loadBookData(book).then(() => selectEntry(key));
      } else {
        if (book !== currentBook) switchBook(book);
        selectEntry(key);
      }
    });
  });

  // Attach cross-ref handlers in right panel
  $rightContent.querySelectorAll('.right-crossref-item').forEach(el => {
    el.addEventListener('click', () => navigateTo(el.dataset.target));
  });
}

function resolveTarget(target) {
  // Target format: "FAUNA:2.13"
  const match = target.match(/^(FAUNA|FLORA|REALIA|GREEK|HEBREW):(.+)$/i);
  if (match) {
    const book = match[1].toLowerCase();
    const key = match[2];
    return entryMap[`${book}:${key}`];
  }
  return null;
}

function strongsBibleHubUrl(strongsId) {
  const normalized = normalizeStrongsId(strongsId);
  if (!normalized) return 'https://biblehub.com';
  const prefix = normalized[0].toUpperCase();
  const num = parseInt(normalized.slice(1), 10);
  if (!Number.isFinite(num)) return 'https://biblehub.com';
  const langPath = prefix === 'H' ? 'hebrew' : prefix === 'G' ? 'greek' : '';
  if (!langPath) return 'https://biblehub.com';
  return `https://biblehub.com/${langPath}/${num}.htm`;
}

function normalizeStrongsId(strongsId) {
  const raw = (strongsId || '').toString().trim().toUpperCase().replace(/\s+/g, '');
  const match = raw.match(/^([HG])(\d{1,5})$/);
  if (!match) return '';
  const [, prefix, digits] = match;
  return `${prefix}${parseInt(digits, 10).toString().padStart(4, '0')}`;
}

function normalizeTermForIndex(term) {
  if (!term) return '';
  return term
    .toString()
    .normalize('NFD')
    .replace(/\p{M}+/gu, '')
    .replace(/[\u200e\u200f\u202a-\u202e]/g, '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
}

function resolveLemmaHit(book, lemma) {
  const normalized = normalizeTermForIndex(lemma);
  if (!normalized) return null;

  const langKey = `${book}|${normalized}`;
  const hits = lemmaIndex[langKey] || lemmaIndex[`*|${normalized}`] || [];
  const indexedHit = hits.find(h => h.book === book) || hits[0];
  if (indexedHit) return indexedHit;

  const entries = DICTIONARY_DATA[book] || [];
  const entryByTitle = entries.find(e => normalizeTermForIndex(e.title) === normalized);
  if (entryByTitle) {
    return { book, key: entryByTitle.key, title: entryByTitle.title };
  }

  const entryByLanguageSet = entries.find(e => (e.languageSets || []).some(ls => {
    return normalizeTermForIndex(ls.lemma) === normalized || normalizeTermForIndex(ls.transliteration) === normalized;
  }));
  if (entryByLanguageSet) {
    return { book, key: entryByLanguageSet.key, title: entryByLanguageSet.title };
  }

  return null;
}

function isReferencesSection(sec) {
  if (!sec) return false;
  const contentType = (sec.contentType || '').toLowerCase();
  const headingRaw = (sec.heading || sec.headingHtml || '').toString();
  const headingText = headingRaw.replace(/<[^>]+>/g, '').trim().toLowerCase();
  return contentType === 'references' || headingText === 'references:' || headingText === 'references';
}

function buildCompactTerms(languageSets) {
  const groups = new Map();
  for (const ls of (languageSets || [])) {
    const language = (ls.language || 'Other').trim() || 'Other';
    const lemma = (ls.lemma || '').trim();
    const transliteration = (ls.transliteration || '').trim();
    const lemmaNorm = normalizeTermForIndex(lemma);
    const translitNorm = normalizeTermForIndex(transliteration);
    if (!lemmaNorm && !translitNorm) continue;

    if (!groups.has(language)) groups.set(language, new Map());
    const map = groups.get(language);
    const key = `${lemmaNorm}|${translitNorm}`;
    if (!map.has(key)) {
      map.set(key, { lemma, transliteration });
    }
  }

  return Array.from(groups.entries()).map(([language, termMap]) => ({
    language,
    items: Array.from(termMap.values()).slice(0, 12),
  })).filter(group => group.items.length > 0);
}

function getSourceTermLabel(item, mode) {
  const lemma = (item.lemma || '').trim();
  const translit = (item.transliteration || '').trim();
  if (mode === 'original') {
    return lemma || translit;
  }
  if (mode === 'translit') {
    return translit || lemma;
  }
  if (lemma && translit && normalizeTermForIndex(lemma) !== normalizeTermForIndex(translit)) {
    return `${lemma} · ${translit}`;
  }
  return lemma || translit;
}

function findLinkedEntryForTerm(term, language, currentEntry) {
  const normalized = normalizeTermForIndex(term);
  if (!normalized) return null;

  const langKey = `${(language || '').toLowerCase().trim()}|${normalized}`;
  const anyKey = `*|${normalized}`;

  const candidates = [
    ...(lemmaIndex[langKey] || []),
    ...(lemmaIndex[anyKey] || []),
  ];

  const unique = [];
  for (const c of candidates) {
    if (!unique.some(v => v.book === c.book && v.key === c.key)) {
      unique.push(c);
    }
  }

  const preferred = unique.find(c => c.book === currentBook && !(c.book === currentEntry.book && c.key === currentEntry.key))
    || unique.find(c => !(c.book === currentEntry.book && c.key === currentEntry.key))
    || null;

  return preferred;
}

function collectEntryStrongs(entry) {
  const values = [];
  if (!entry || !entry.languageSets) return values;
  for (const ls of entry.languageSets) {
    if (ls.strongs && Array.isArray(ls.strongs)) {
      for (const id of ls.strongs) {
        const normalized = normalizeStrongsId(id);
        if (normalized) values.push(normalized);
      }
    }
  }
  return Array.from(new Set(values));
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
        switchBook(book, { initialKey: key, pushHistory: true });
      } else {
        selectEntry(key);
      }
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
    if (isCrossRefModalVisible()) {
      closeCrossRefModal();
    } else if ($searchResults.classList.contains('visible')) {
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

  // Alt+Left goes back to previous selected entry
  if (e.altKey && e.key === 'ArrowLeft') {
    e.preventDefault();
    goBackEntry();
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
      history.pushState(null, '', hash);
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
    if (book in BOOK_LABELS) {
      $landing.classList.remove('active');
      $app.classList.add('active');
      switchBook(book, {
        recordBack: false,
        initialKey: key,
        pushHistory: false,
      });
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

function injectEntryBackButton() {
  const header = document.querySelector('.app-header');
  const homeBtn = header?.querySelector('.header-home');
  if (!header || !homeBtn) return;

  const backBtn = document.createElement('button');
  backBtn.className = 'btn-icon header-back';
  backBtn.type = 'button';
  backBtn.title = 'Back to previous entry (Alt+Left)';
  backBtn.setAttribute('aria-label', 'Back to previous entry');
  backBtn.innerHTML = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"></polyline></svg>';
  backBtn.addEventListener('click', () => goBackEntry());

  homeBtn.insertAdjacentElement('afterend', backBtn);
  $entryBackBtn = backBtn;
  updateEntryBackButton();
}


// ── Initialize ────────────────────────────────────────────────────

function init() {
  injectEntryBackButton();
  injectMobileBookSelector();

  window.addEventListener('popstate', () => {
    if (!handleHash()) {
      showLanding(false);
    }
  });

  // Try hash-based routing first
  if (!handleHash()) {
    // Show landing page by default
    showLanding();
  }
}

init();
