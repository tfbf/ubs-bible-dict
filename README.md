# Bible Flora, Fauna & Realia — Digital Reference

An interactive, mobile-first web application for exploring **animals**, **plants**, and **material objects** mentioned in the Bible. Built from the [UBS Open License](https://github.com/ubsicap/ubs-open-license/tree/main/flora-fauna-realia) thematic lexicon data.

> **Live at:** [UBS Bible Dictionaries](https://ubs-bible-dictionaries.vercel.app/)

![License: CC BY-SA 4.0](https://img.shields.io/badge/License-CC%20BY--SA%204.0-lightgrey.svg)
![Content: UBS](https://img.shields.io/badge/Content-United%20Bible%20Societies-blue)
![Built by: TFBF](https://img.shields.io/badge/Built%20by-The%20Free%20Bible%20Foundation-green)

---

## Overview

This project makes three scholarly handbooks — originally published by the **United Bible Societies** for Bible translators — freely accessible through a modern, searchable web interface:

| Book | Entries | Source Work | Author |
|------|--------:|-------------|--------|
| **Fauna** | 114 | *All Creatures Great and Small: Living Things in the Bible* | Edward R. Hope (© 2005) |
| **Flora** | 141 | *Each According to its Kind: Plants and Trees in the Bible* | Robert Koops (© 2012) |
| **Realia** | 507 | *The Works of Their Hands: Man-made Things in the Bible* | Ray Pritz (© 2009) |

**762 entries** covering the natural and cultural world of Scripture, complete with:

- Original **Hebrew**, **Aramaic**, **Greek**, and **Latin** terms
- Transliterations and linguistic analysis
- **Comprehensive Bible verse references** (decoded from UBS reference codes)
- Detailed discussion and translation guidance
- Internal **cross-references** between related entries

---

## Features

- **Three-panel layout** — Entry navigator (left), article content (middle), references & language info (right)
- **Full-text search** — Instant search across all three books with highlighted results
- **Cross-reference navigation** — Click any cross-reference to jump directly to the linked entry
- **Mobile-first responsive design** — Collapsible panels with bottom navigation on small screens
- **Keyboard shortcuts** — `/` to search, `Alt+↑/↓` to navigate entries, `Esc` to close panels
- **URL hash routing** — Shareable deep links to any entry (e.g., `#fauna/2.13`)
- **Optional Strong’s enrichment** — Attach Strong’s IDs to lemmas and open them directly in BibleHub
- **Zero dependencies** — Pure HTML, CSS, and vanilla JavaScript; no frameworks or build tools needed at runtime
- **Offline-capable** — Fully static; works from the local filesystem or any web server

---

## Project Structure

```
flora-fauna-realia/
├── index.html      # Single-page application (landing + dictionary browser)
├── styles.css      # Mobile-first responsive styles
├── app.js          # Application logic (search, navigation, rendering)
├── data.js         # Auto-generated dictionary data (all 762 entries)
└── README.md
```

### Build Pipeline

The `data.js` file is generated from the UBS XML sources by a Python script:

```
ubs-open-license/flora-fauna-realia/XML/
├── FAUNA_en.xml      # Source XML
├── FLORA_en.xml
├── REALIA_en.xml
├── strongs_map.json   # Optional lemma → Strong's mapping (user-provided)
└── build_site.py     # XML → data.js generator
```

---

## Getting Started

### Quick Start (no build needed)

If you already have the `data.js` file, just open `index.html` in a browser:

```bash
# Serve locally (Python 3)
cd flora-fauna-realia
python -m http.server 8899

# Then visit http://localhost:8899
```

### Rebuilding data.js from XML

Requires **Python 3.9+** and the UBS XML source files.

```bash
cd ubs-open-license/flora-fauna-realia/XML
python build_site.py
```

This parses all three XML files and writes `data.js` to the app directory. 

If `strongs_map.json` exists, Strong’s IDs are embedded per language set and shown in the right sidebar as external links.

### Strong’s Mapping (Optional)

To enable Strong’s integration:

1. Copy `ubs-open-license/flora-fauna-realia/XML/strongs_map.template.json` to `strongs_map.json`.
2. Add mappings by **language + lemma/transliteration**.
3. Re-run `python build_site.py`.

Expected schema:

```json
{
  "Hebrew": {
    "בְּהֵמָה": ["H0929"],
    "behemah": ["H0929"]
  },
  "Greek": {
    "ζῷον": ["G2226"],
    "zōon": ["G2226"]
  }
}
```

Notes:

- IDs are normalized to `H####` / `G####` format.
- Multiple IDs per lemma are supported.
- When available, the app adds quick links to BibleHub (`https://biblehub.com/hebrew/####.htm` or `https://biblehub.com/greek/####.htm`).
Parsing FAUNA_en.xml...  → 114 entries
Parsing FLORA_en.xml...  → 141 entries
Parsing REALIA_en.xml... → 507 entries

✓ Generated data.js
  Total entries: 762
  File size: 3.4 MB

---

## Keyboard Shortcuts

| Key | Action |
|-----|--------|
| `/` | Focus the search bar |
| `Esc` | Close search results or side panels |
| `Alt + ↑` | Previous entry |
| `Alt + ↓` | Next entry |

---

## Bible Reference Decoding

The UBS XML stores scripture references as 14-character codes:

```
Position:  BBB CCC VVV WWWWW
Example:   026 016 010 00012  →  Ezek 16:10
```

- **BBB** — Book number (001 = Genesis … 066 = Revelation, 067+ = Deuterocanon)
- **CCC** — Chapter
- **VVV** — Verse
- **WWWWW** — Word position (used for alignment; stripped in display)

Optional single-letter prefixes: `H` (Hebrew), `G` (Greek), etc.

The build script decodes all references into human-readable format (e.g., "Gen 1:28", "Rev 4:6").

---

## Content License

The dictionary content is © **United Bible Societies, 2025**, released under the [Creative Commons Attribution-ShareAlike 4.0 International License (CC BY-SA 4.0)](http://creativecommons.org/licenses/by-sa/4.0/).

Source: [github.com/ubsicap/ubs-open-license](https://github.com/ubsicap/ubs-open-license/tree/main/flora-fauna-realia)

### Attribution

- **Animals in the Bible** — Adapted from *All Creatures Great and Small: Living Things in the Bible* by Edward R. Hope © 2005 United Bible Societies
- **Plants and Trees in the Bible** — Adapted from *Each According to its Kind: Plants and Trees in the Bible* by Robert Koops © 2012 United Bible Societies
- **Human-made Things in the Bible** — Adapted from *The Works of Their Hands: Man-made Things in the Bible* by Ray Pritz © 2009 United Bible Societies

---

## Developed By

**The Free Bible Foundation** (TFBF)
[https://tfbf.in](https://tfbf.in)
