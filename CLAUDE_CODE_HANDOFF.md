# Album Journey — Claude Code Handoff

## What We're Building
A personal single-page web app documenting a completed "500 album listening challenge."
The person listened to 500 albums over 335 days (Apr 27 2025 → Jun 13 2026) and wants
a beautiful, scrollable recap site. No backend needed. Pure HTML/CSS/JS, self-contained.

---

## Current Status
- The **Journey page** is mostly designed and built but has one persistent JS bug (see below)
- The **History** and **Up Next** pages are designed but NOT yet built
- The file is: `album_journey.html` (provided alongside this doc)

---

## The One Bug to Fix First
**Safari throws `Unexpected identifier 'drawRoad'`** which stops all JS execution.

The cause: a backslash-escaped apostrophe `\'` inside a `//` comment in the script block.
Search for `milestone\'s` in the script and change it to `milestone center` or remove the apostrophe.
After fixing, confirm in browser console that `drawRoad` runs and `journeyCards.querySelectorAll('.milestone').length` returns 19.

### Road Drawing Logic (critical)
The fretboard road uses two stacked `<canvas>` elements inside `#roadWrap`:
- `#roadCanvas` — draws the fretboard once on load, never cleared
- `#travCanvas` — draws the glowing traveler dot on scroll, cleared each frame

**The measurement that must work:**
```javascript
const milestones = Array.from(cards.querySelectorAll(".milestone")); // must be 19
const H = cards.scrollHeight; // must be ~8000-12000px, NOT 451px
```

If `H` is still ~451, it means only 1 milestone is inside `#journeyCards` in the DOM —
check the HTML closing tags around the journey cards section. There was a truncated `</`
tag that caused the browser to misparse the structure.

Milestone Y positions must use `offsetTop` walking up to `#roadWrap`, NOT `getBoundingClientRect`
(which returns wrong values for off-screen elements at page load).

---

## Design System

### Colors (CSS vars)
```css
--bg: #0b1520
--surface: #141f2e
--surface2: #1a2a3d
--border: rgba(91,155,248,0.11)
--border-mid: rgba(91,155,248,0.3)
--blue: #2D6BE4
--sky: #5B9BF8
--pale: #A8D4FF
--text: #F0F7FF
--muted: #7A9CC0
--dim: #3D5A78
--gold: #F5C842
--red: #E07070
--purple: #a78bfa
```

### Typography
- Body: system-ui / -apple-system
- Era decade numbers: **Playfair Display** (Google Font) — serif, 900 weight, 54px

### Layout
- Max width: 480px, centered, mobile-first
- Background: `position:fixed` SVG with music symbols (treble clefs, notes, vinyl rings,
  guitar outlines) in era colors at ~0.20-0.28 opacity
- Background parallax: `bgSvg.style.transform = translateY(scrollY * 0.15)` on scroll

---

## Journey Page — Full Spec

### Sections (top to bottom):

**1. Hero**
- Eyebrow: `500 albums · Apr 27, 2025 — Jun 13, 2026`
- 4 stat pills: `335 days`, `324 artists`, `29 scored 90+`, `avg 72`

**2. Vinyl (Blackbird)**
- Spinning vinyl record with Alter Bridge Blackbird album art on the label
- Tap to pause spin
- Score pill: `100 / 100` in gold
- Embedded Spotify iframe: album `21lOBQT94kjWSiYQbpm3RG`

**3. Score Distribution Chart**
- Bar chart by decade (10s, 20s ... 100s)
- Data: `[[10,3],[20,2],[30,6],[40,19],[50,41],[60,107],[70,186],[80,107],[90,28],[100,1]]`
- 70s bar = purple, 100 bar = gold, rest = surface2

**4. Timeline Chart (interactive)**
- Canvas, x=Day 1-335, y=Score 0-100
- Smooth bezier line, gradient purple→blue→gold
- Gold dot at the one 100 (Blackbird, Day 271)
- Hover/touch shows tooltip: score, album name, artist, day number
- Data: all 500 albums from CSV columns: Day, Rating, Artist Name, Album Name

**5. Journey Road**
- Vertically scrolling fretboard road drawn on canvas
- Winding left/right between milestone cards
- 7 era sections, each with:
  - Big Playfair era decade number (e.g. "1950s") in era color
  - Small uppercase label (e.g. "BIRTH OF ROCK")
  - Album count
  - Horizontal scrolling flyby strip of top albums from that era
- 19 milestone cards total (see list below)
- Cards: full-width album art banner (140px), gradient fade bottom,
  score badge + album + artist overlaid on art, track listing below
- Inactive cards: scale(0.86), opacity 0.35
- Active card (in viewport center): scale(1), opacity 1
- Glowing traveler dot moves along road as you scroll

**Era colors:**
- 1950s: #f5a623 (amber)
- 1960s: #a78bfa (purple)
- 1970s: #fb923c (orange)
- 1980s: #f472b6 (pink)
- 1990s: #6ee7b7 (teal)
- 2000s: #5B9BF8 (blue)
- 2010s: #F5C842 (gold)

**19 Milestone Cards:**
| Side  | Artist                        | Album                      | Score | Badge        | Tracks |
|-------|-------------------------------|----------------------------|-------|--------------|--------|
| left  | Buddy Holly and the Crickets  | The "Chirping" Crickets    | 81    | Album #1     | That'll Be the Day · Peggy Sue |
| right | Frank Sinatra                 | In the Wee Small Hours     | 86    | 50s best     | In the Wee Small Hours · I Get Along Without You |
| right | The Beatles                   | Abbey Road                 | 93    | Beatles best | Come Together · Here Comes the Sun · Something |
| left  | Creedence Clearwater Revival  | Willy and the Poor Boys    | 92    | CCR best     | Down on the Corner · Fortunate Son |
| right | Led Zeppelin                  | Physical Graffiti          | 93    | Zeppelin best| Kashmir · Trampled Under Foot |
| left  | Pink Floyd                    | Dark Side of the Moon      | 89    |              | Money · Time · The Great Gig in the Sky |
| right | Aerosmith                     | Rocks                      | 95    |              | Back in the Saddle · Last Child |
| left  | Bob Dylan (3 albums)          | Various                    | 15-18 | red badge    | Highway 61 · Like a Rolling Stone |
| right | AC/DC                         | Back in Black              | 88    |              | Back in Black · You Shook Me All Night Long |
| left  | Guns N Roses                  | Appetite for Destruction   | 84    |              | Welcome to the Jungle · Sweet Child O Mine |
| right | Nirvana                       | Nevermind                  | 95    |              | Smells Like Teen Spirit · Come as You Are |
| left  | Pearl Jam                     | Ten                        | 98    | #2 all time  | Alive · Even Flow · Jeremy · Black |
| right | Jeff Buckley                  | Grace                      | 96    |              | Grace · Last Goodbye · Hallelujah |
| left  | Creed                         | Human Clay                 | 97    |              | Higher · With Arms Wide Open |
| right | Audioslave                    | Audioslave                 | 96    |              | Cochise · Like a Stone · Show Me How to Live |
| left  | John Mayer                    | Continuum                  | 95    |              | Gravity · Slow Dancing in a Burning Room |
| right | Alter Bridge                  | Blackbird                  | 100   | gold - PERFECT | Rise Today · Watch Over You · Blackbird |
| left  | Arctic Monkeys                | AM                         | 94    |              | Do I Wanna Know? · R U Mine? |
| right | Adele                         | 21                         | 93    |              | Rolling in the Deep · Someone Like You |

**6. Finish Card**
- Date: June 13, 2026
- Subtitle: Day 335 · 500 albums · 324 artists
- 4 stats: 29 scored 90+ / 1 perfect 100 / 13 Beatles albums / 15 lowest (Dylan)
- NO album #500 info — just summary stats

---

## History Page — Spec

Full searchable/sortable table of all 500 albums.

**Columns to show:** Day, Rank, Artist, Album, Score, Year, Date listened

**Features:**
- Search box (filters artist + album name live)
- Sort by any column (click header)
- Color-coded score badges (red <50, yellow 50-69, blue 70-89, gold 90+)
- Album art thumbnail (32px) from Spotify image URL in CSV
- Clicking a row could expand to show the "Why It Matters" and "Important Tracks" text
- Same dark navy design as Journey page

---

## Up Next Page — Spec

A flexible backlog/wishlist of albums to listen to in the future.

**Features:**
- Add albums manually (artist + album name fields)
- Optional: search Spotify API to auto-fill album art
- Mark as listened (moves to history)
- Reorder / prioritize
- Persisted to localStorage
- Same dark design

---

## Navigation
Three tabs at the top or bottom:
- **Journey** (this page)
- **History** (500 album table)
- **Up Next** (backlog)

Suggest a fixed bottom tab bar for mobile, or a sticky top nav.
Keep it minimal — just icons + labels.

---

## Data Source
**CSV file:** `500_Albums_-_Music-3.csv`

Key columns:
- `Day` — day number (1-335)
- `Rank Row` — ranking
- `Artist Name`
- `Album Name`
- `Rating` — score out of 100
- `Date` — date listened
- `Year` — album release year
- `Spotify Album Image URL` — direct image URL
- `Album ID` — Spotify album ID
- `Album URL` — Spotify URL
- `Thoughts` — personal notes
- `Why It Matters / Important Songs` — factual context
- `Important Tracks` — semicolon-separated track names
- `Fun Fact`

**Yes, provide the CSV to Claude Code** — it needs it to build the History page
and to inline the timeline data for the Journey page.

---

## Tech Stack
- Pure HTML/CSS/JS — no frameworks, no build step
- Self-contained single file (CSS + JS inline)
- Google Fonts: Playfair Display (loaded via link tag)
- Spotify embed iframe for Blackbird
- Spotify CDN for album art images (already in CSV)
- No backend, no API calls needed
- Target: works in Safari on iPhone and Chrome on desktop

---

## What NOT to Do
- Don't use keyboard/piano texture on the road — fretboard only
- Don't use getBoundingClientRect for road point measurement (use offsetTop)
- Don't put non-ASCII characters (═══, etc.) in JS — Safari chokes on them
- Don't use backslash-escaped apostrophes (') in JS comments
- Don't clear roadCanvas on scroll — only clear travCanvas
- Don't show "Album #500" in the finish card
- Don't show artist names next to dates in the hero
- Don't use emojis in era headers
- Don't use pill/badge shape for era labels — plain text only


---

## How to Start Claude Code

1. Install Claude Code from https://claude.ai/download
2. Open Terminal (Cmd+Space → type "Terminal" → Enter)
3. Type this and hit Enter:
   ```
   cd /Users/kevinseverino/Documents/Album_Journey
   ```
4. Then type and hit Enter:
   ```
   claude
   ```
5. Send this as your first message:

> "Read CLAUDE_CODE_HANDOFF.md and the CSV file 500_Albums_-_Music-3.csv. Build the full album journey web app from scratch based on the spec. Start by fixing the JS bug described, then build all three pages: Journey, History, and Up Next."

Claude Code will generate all the files directly into /Users/kevinseverino/Documents/Album_Journey.
You do not need to move or copy anything manually.
