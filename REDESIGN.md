# Album Journey v4 — Redesign & Implementation Document

Date: 2026-07-12

## 1. Audit of the current product

**Files**
- `album_journey.html` — the live app (2,635 lines, single file). Four bottom tabs: **Queue** (Past Albums / Revisit / Discover sub-tabs + "On Air" player + Randomizer + public suggestion form), **Journey** (completed 500-album retrospective: hero stats, score distribution, fretboard road with 19 milestone cards and 7 era sections), **History** (searchable/sortable/filterable table of all 500 + re-listens), **Grid** (7-column artwork mosaic with lightbox).
- `Code.gs` — Apps Script backend on the Google Sheet (`1-4m0w…IOw`). GET `?action=all` returns `{journey, past, discover, revisit, suggestions}`. POST actions: `suggest` (public), `rate`, `addDiscover`, `removeDiscover`, `updateSuggestion` (PIN-gated via Script Properties). Also contains iTunes enrichment utilities.
- Older builds (`album_journey-10.html`, `album_journey_v2_stable.html`) are archives.

**Data (Google Sheets tabs)**
- `Journey` — 500 rows, 27 cols. Coverage: Rating 500, Date 500, Year 500, Album ID/art 500, Runtime 460, Genres 475, Track Count 479, `Heard?` 23.
- `Past Albums` — 248 albums known before the journey (release date, track count, art, Spotify ID).
- `DiscoverQueue` — owner-curated queue (currently empty).
- `RevisitRatings` — re-listen scores keyed to AlbumID (currently empty).
- `Suggestions` — public suggestions with status pending/added/declined.

**Current behavior worth noting**
- Every owner write prompts for the PIN — heavy for frequent use.
- Rating is a `prompt()` dialog asking for a 1–100 number — the definition of homework.
- `RevisitRatings` stores one row per album and **overwrites** the score on re-rate — taste-over-time history is lost.
- Recording a listen requires finding the album in a list first. No Spotify awareness.
- `renderRecentlyListened()` exists but is dead code (its DOM elements were removed).
- The Queue page is the de-facto "active" surface but reads as three inventory lists.

## 2. Functionality that must be preserved

1. Journey retrospective page exactly as designed (road, eras, charts, milestones).
2. Full searchable/sortable/filterable 500-album table with expandable rows (Why It Matters, tracks, links).
3. Artwork grid + zoom lightbox.
4. Randomizer ("choose for me").
5. Past Albums / Revisit / Discover pools and their semantics.
6. Public suggestion form (iTunes search + random) and owner accept/decline.
7. Owner add/remove on DiscoverQueue.
8. Scoring 1–100 with Journey-vs-now comparison display.
9. Spotify/Apple Music links and embeds.
10. PIN-protected owner writes; public read/suggest.
11. Existing backend actions keep working (old clients unaffected).

## 3. Information architecture (v4)

Five tabs, mobile-first bottom nav:

| Tab | Role |
|---|---|
| **Listen** | Home. Detected-listen prompt → Tonight's possibilities → Randomizer & Crate → browsing shelves. |
| **Diary** | Listening diary (new `Listens` data), merged with journey dates & revisit history. Milestones. |
| **Discover** | Suggestions inbox (owner), public suggestion form, Discover queue. |
| **Library** | Utilities: search, filters, table (old History) and grid (old Grid) as view toggle. |
| **Journey** | The completed retrospective, untouched. |

Rationale vs. the suggested structure: kept as proposed; "Queue" dissolves into Listen (its pools become shelves) and Discover (its suggestion machinery). The table/grid merge into one Library tab because both are "deliberate lookup" tools.

## 4. Principal user flows

- **Choose for me** → Randomizer button → quick-view sheet of one pick (with "why"), → Listen on Spotify / spin again.
- **Choose a direction** → shelf row (e.g. Forgotten favorites) → horizontal browse → tap cover → quick view → Listen / Save / Similar. Each shelf has "Surprise me from here". Shelf header opens the full collection overlay.
- **Free browse** → Crate mode: full-screen cover flipping (tap/swipe = next, never recorded as a preference), optional direction chips (Familiar / New / Highly rated / decade / Short).
- **Listen** → "Listen on Spotify" opens the album and records a *pending choice* (localStorage) used to boost detection confidence.
- **React** → on open/focus, Spotify sync finds recent album listens → compact dismissible prompt: "You listened to *X*. How did it land?" → one tap on a reaction chip records the listen. Optional expansion: score, favorite track, note, revisit-someday, comparison with previous score.
- **Revisit** → shelves explain *why* resurfaced; after a revisit with a prior score the primary choices are Better now / About the same / Not as strong (score optional).
- **Remember** → Diary shows entries with artwork, reaction, score changes (old → new), source, notes.

## 5. Album state model

An album (identified by Spotify album ID, falling back to artist|album key) moves through:

```
                    ┌────────────┐
 suggestion ──────▶ │  candidate │  (Suggestions pending / DiscoverQueue / Past Albums / never-listened)
                    └─────┬──────┘
        save-for-later ◀──┤  (localStorage shelf)
                          ▼
                    ┌────────────┐
   "Listen" tap ──▶ │  pending   │  (chosen on the site, awaiting detection; expires 48h)
                    └─────┬──────┘
                          ▼
                    ┌────────────┐
 Spotify sync ────▶ │  detected  │  (high/medium confidence; prompt shown, dedup-guarded)
                    └─────┬──────┘
              dismiss ◀───┤───▶ react (1 tap) ──▶ ┌──────────┐
                          │                       │  logged   │ → Listens row (append-only)
                          ▼                       └────┬─────┘
                       ignored                          ▼
                                                 optional enrich (score/track/note/revisit-someday)
                                                        ▼
                                                  diary / “worth another listen” / forgotten-favorites cycles
```

Journey albums additionally carry their immutable 2025-26 rating; new listens never overwrite it.

## 6. Spotify authentication & sync architecture

- **Authorization Code with PKCE** — the current Spotify-recommended flow for browser apps. No client secret exists at all (public client), so nothing secret ships in the page. The owner registers a free Spotify app once and pastes the **Client ID** into the site's Settings (stored in `localStorage`, owner's browser only).
- Redirect URI = the page's own HTTPS URL (shown in Settings for copy-paste into the Spotify dashboard). Spotify requires HTTPS (or loopback) — `file://` won't work; the deployed site URL is used.
- **Scopes (minimum):** `user-read-recently-played`, `user-read-currently-playing`.
- Tokens: access token + refresh token in `localStorage`; refreshed via the token endpoint (CORS-enabled by Spotify for PKCE). Expired/revoked auth → quiet "Reconnect Spotify" chip, never a blocking error.
- **Sync triggers:** page load and `visibilitychange → visible`, throttled to ≥60s apart. No background polling, no notifications, no server infrastructure.
- Sync fetches `/me/player/recently-played?limit=50` (with stored `after` cursor) and `/me/player/currently-playing`; currently-playing albums are held back from prompting (still in progress).

## 7. Listen-inference rules & confidence model

Group the recent-plays feed by `track.album.id`; for each group compute: distinct tracks `n`, album total `T` (from the track payload), coverage `pct = n/T`, consecutiveness (played_at order vs track_number), session span, and whether the album matches a *pending choice* from the site.

- **High confidence** ("You listened to *X*. How did it land?"): `pct ≥ 0.6 && n ≥ 4`, or `n ≥ 6`, or pending-choice match with `n ≥ 2`.
- **Medium** ("Were you listening to *X*?"): `n ≥ 3`, or `pct ≥ 0.5 && n ≥ 2`.
- **Ignored:** `n ≤ 2` incidental tracks (no pending match); albums currently playing; albums whose prompt was already handled.
- **Dedup:** a handled-key (`albumId|day`) set in localStorage covers reacted *and* dismissed prompts; a Listens entry for the same album within 36h also suppresses. At most 3 prompts queue at once, newest first.
- Language never claims completion; high confidence says "listened", medium asks.

## 8. Data-model changes (additive only — no destructive migration)

**New Sheet tab `Listens`** (auto-created by the script on first write):
`Timestamp | AlbumID | Artist | Album | ArtURL | Year | Reaction | Score | FavoriteTrack | Note | Source | Confidence | PrevScore | RevisitFlag`
Append-only; edits update the matching row by Timestamp+AlbumID within the session.

**Code.gs additions (existing actions untouched):**
- GET: `getListens()` added to `getAllData()` payload as `listens`.
- POST `logListen` (PIN) — one-tap reaction write.
- POST `updateListen` (PIN) — progressive enrichment of a just-logged row.
- POST `verifyPin` — lets the client validate & cache the PIN once ("owner mode").
- `getPast()` now also returns track count + full release date (extra fields, old clients ignore them).

`RevisitRatings` is kept read-compatible (old score comparisons still display) but new scores land in `Listens`, which preserves history instead of overwriting. **Owner action required after code update: re-deploy the Apps Script web app (Deploy → Manage deployments → Edit → New version).**

## 9. Implementation plan

1. Archive current `album_journey.html` → `album_journey_v3_stable.html`.
2. Extend `Code.gs` (additive).
3. Rebuild `album_journey.html`:
   - retained wholesale: Journey page, table engine, grid+lightbox, suggestion form, randomizer pool logic, PIN modal, design tokens;
   - new: Listen home (prompt card, Tonight's possibilities, shelves engine, crate mode, quick-view sheet), Diary, owner mode, Spotify module (PKCE + sync + inference), reaction sheet.
4. Shelves are data-driven with minimum-size gates (a shelf renders only when it has ≥4 members) so they evolve with the data and never fabricate precision.
5. Test with a local server + the live Apps Script backend, plus a `?mock=spotify` harness that injects synthetic recently-played data to exercise detection, confidence tiers, dedup, and reactions end-to-end without credentials.
6. Visual pass at 375×812 and desktop; reduced-motion support.

## 10. Deploy checklist (owner actions)

1. **Apps Script**: open the Sheet's Apps Script editor, replace the code with the updated `Code.gs`, then **Deploy → Manage deployments → Edit → New version → Deploy**. (The `Listens` tab is auto-created on the first logged listen — no manual sheet work.)
2. **Site**: publish the new `album_journey.html` wherever the current one is hosted (same URL keeps everything working).
3. **Owner mode**: open the site → gear → Enter PIN (check "Remember on this device"). One-time per browser.
4. **Spotify** (optional but recommended): create an app at developer.spotify.com/dashboard → add the site's exact HTTPS URL as a Redirect URI → gear → Connect Spotify → paste the Client ID. Scopes requested: recently-played + currently-playing only.
5. **Dev harness**: append `#mock=spotify` to the URL to demo detection with synthetic data; mock mode never writes to the spreadsheet.

Rollback: the previous build is preserved verbatim as `album_journey_v3_stable.html`; the old backend actions are untouched, so the old HTML keeps working against the updated script.

## 11. Material assumptions & risks

- **Assumption:** the site is served over HTTPS (required for Spotify redirect). The Apps Script URL continues to work from that origin (it already does).
- **Assumption:** single-owner product; owner-mode PIN cached in the owner's browser is an acceptable trade for one-tap logging. Visitors never see owner controls.
- **Risk:** Spotify `recently-played` returns only the last 50 plays and drops history >24h in some cases — long gaps between visits can miss listens. Mitigated by the `after` cursor and honest "no detection" behavior (manual log from quick view remains one tap).
- **Risk:** Spotify deprecated audio-features for new apps — energetic/mellow browsing is **not** built (unsupported precision).
- **Risk:** re-deploying Apps Script requires a manual step by the owner; until then the new front end degrades gracefully (reactions queue an error toast; reads work).
- **Risk:** album IDs differ between Spotify releases (remasters). Matching falls back to normalized artist+album name.
