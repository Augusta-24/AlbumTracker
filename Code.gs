// ============================================================
//  Album Journey — Google Apps Script Backend
//  Paste this entire file into your Sheet's Apps Script editor.
//  After pasting: run setOwnerPin() once, then Deploy > New deployment.
// ============================================================

// SS_ID removed — using getActiveSpreadsheet() instead

// ---- GET ----
function doGet(e) {
  var params = e ? e.parameter : {};
  var action = params.action || 'all';
  var result;
  try {
    if      (action === 'journey') result = getJourney();
    else if (action === 'past')    result = getPast();
    else if (action === 'discover')result = getDiscover();
    else if (action === 'revisit') result = getRevisit();
    else if (action === 'listens') result = getListens();
    else if (action === 'all')     result = getAllData();
    else                           result = {error: 'Unknown action: ' + action};
  } catch(err) {
    result = {error: err.message};
  }
  return jsonResponse(result);
}

// ---- POST ----
function doPost(e) {
  var data;
  try { data = JSON.parse(e.postData.contents); }
  catch(err) { return jsonResponse({error: 'Bad JSON'}); }

  var action = data.action;
  var result;
  try {
    if      (action === 'suggest')          result = addSuggestion(data);
    else if (action === 'rate')             result = addRating(data);
    else if (action === 'addDiscover')      result = addToDiscover(data);
    else if (action === 'removeDiscover')   result = removeFromDiscover(data);
    else if (action === 'updateSuggestion') result = updateSuggestionStatus(data);
    else if (action === 'verifyPin')        result = verifyPin(data);
    else if (action === 'logListen')        result = logListen(data);
    else if (action === 'updateListen')     result = updateListen(data);
    else                                    result = {error: 'Unknown action'};
  } catch(err) {
    result = {error: err.message};
  }
  return jsonResponse(result);
}

// ---- HELPERS ----
function jsonResponse(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

function getSheet(name) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName(name);
  if (!sh) throw new Error('Tab "' + name + '" not found in spreadsheet');
  return sh;
}

function sheetToObjects(sheet) {
  var data = sheet.getDataRange().getValues();
  if (data.length < 2) return [];
  var headers = data[0];
  return data.slice(1).map(function(row) {
    var obj = {};
    headers.forEach(function(h, i) { obj[h] = row[i]; });
    return obj;
  });
}

function checkPin(pin) {
  var stored = PropertiesService.getScriptProperties().getProperty('OWNER_PIN');
  return stored && String(pin) === String(stored);
}

// ---- DATA READERS ----
function getJourney() {
  var rows = sheetToObjects(getSheet('Journey'));
  return rows
    .filter(function(r) { return r['Day'] || r['Album Name']; })
    .map(function(r) {
      return {
        d:  r['Day'],
        rk: r['Rank Row'],
        ar: r['Artist Name'],
        al: r['Album Name'],
        sc: r['Rating'],
        hd: (r['Heard?'] === 1 || r['Heard?'] === '1') ? 1 : 0,
        th: r['Thoughts'],
        yr: r['Year'],
        wh: r['Why It Matters / Important Songs'],
        tr: r['Important Tracks'],
        ff: r['Fun Fact'],
        au: r['Album URL'],
        id: r['Album ID'],
        im: r['Spotify Album Image URL'],
        rt: r['Runtime'],
        gn: r['Artist Genres'],
        tc: r['Track Count'] || '',
        dt: r['Date'] ? String(r['Date']) : '',
        yt: r['YouTube'],
        am: r['AppleMusicURL'] || ''
      };
    });
}

function getPast() {
  var rows = sheetToObjects(getSheet('Past Albums'));
  return rows
    .filter(function(r) { return r['Artist'] || r['Album']; })
    .map(function(r) {
      var rel = r['Release_Date'] ? String(r['Release_Date']) : '';
      return {
        ar: r['Artist'],
        al: r['Album'],
        id: r['Spotify_Album_ID'],
        au: r['Spotify_Album_URL'],
        yr: rel.substring(0, 4),
        im: r['Album Art URL'],
        am: r['AppleMusicURL'] || '',
        tc: r['Number of Tracks'] || ''
      };
    });
}

function getDiscover() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName('DiscoverQueue');
  if (!sh) return [];
  var rows = sheetToObjects(sh);
  return rows
    .filter(function(r) { return r['Artist'] && !r['Rated']; })
    .map(function(r) {
      return {
        ar: r['Artist'],
        al: r['Album'],
        id: r['SpotifyID'] || '',
        im: r['ArtURL'] || '',
        yr: r['Year'] ? String(r['Year']) : ''
      };
    });
}

function getRevisit() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName('RevisitRatings');
  if (!sh) return [];
  var rows = sheetToObjects(sh);
  return rows
    .filter(function(r) { return r['AlbumID']; })
    .map(function(r) {
      return {
        id: r['AlbumID'],
        ar: r['Artist'],
        al: r['Album'],
        js: r['JourneyScore'],
        rs: r['RevisitScore'],
        dt: r['DateRated'] ? String(r['DateRated']) : ''
      };
    });
}

function updateSuggestionStatus(data) {
  if (!checkPin(data.pin)) return {error: 'Unauthorized'};
  var sh = getSheet('Suggestions');
  var rows = sh.getDataRange().getValues();
  for (var i = 1; i < rows.length; i++) {
    if (rows[i][0] === data.artist && rows[i][1] === data.album) {
      sh.getRange(i + 1, 4).setValue(data.status);
      return {ok: true};
    }
  }
  return {error: 'Not found'};
}

function getSuggestions() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName('Suggestions');
  if (!sh) return [];
  var data = sh.getDataRange().getValues();
  if (data.length < 2) return [];
  var headers = data[0];
  // addSuggestion stores 10 columns; headers may only cover first 5 — use index fallback
  function col(name, fallback) {
    var i = headers.indexOf(name);
    return i !== -1 ? i : fallback;
  }
  var iArtist = col('Artist', 0);
  var iAlbum  = col('Album',  1);
  var iStatus = col('Status', 3);
  var iArtUrl = col('ArtURL',        5);
  var iYear   = col('Year',          6);
  var iSpUrl  = col('SpotifyURL',    7);
  var iSpId   = col('SpotifyID',     8);
  var iAm     = col('AppleMusicURL', 9);
  return data.slice(1)
    .filter(function(row) {
      var status = String(row[iStatus] || '');
      return row[iArtist] && (!status || status === 'pending');
    })
    .map(function(row) {
      return {
        ar: row[iArtist] || '',
        al: row[iAlbum]  || '',
        im: row[iArtUrl] || '',
        yr: row[iYear]   ? String(row[iYear]) : '',
        id: row[iSpId]   || '',
        au: row[iSpUrl]  || '',
        am: row[iAm]     || ''
      };
    });
}

function getAllData() {
  return {
    journey:     getJourney(),
    past:        getPast(),
    discover:    getDiscover(),
    revisit:     getRevisit(),
    suggestions: getSuggestions(),
    listens:     getListens()
  };
}

// ---- LISTENS (diary) ----
// Append-only log of individual listening events. Auto-creates the tab.
var LISTENS_HEADERS = ['Timestamp','AlbumID','Artist','Album','ArtURL','Year',
  'Reaction','Score','FavoriteTrack','Note','Source','Confidence','PrevScore','RevisitFlag'];

function getListensSheet_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName('Listens');
  if (!sh) {
    sh = ss.insertSheet('Listens');
    sh.appendRow(LISTENS_HEADERS);
  }
  return sh;
}

function getListens() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName('Listens');
  if (!sh) return [];
  var rows = sheetToObjects(sh);
  return rows
    .filter(function(r) { return r['Timestamp']; })
    .map(function(r) {
      return {
        ts: String(r['Timestamp']),
        id: r['AlbumID'] || '',
        ar: r['Artist'] || '',
        al: r['Album'] || '',
        im: r['ArtURL'] || '',
        yr: r['Year'] ? String(r['Year']) : '',
        rx: r['Reaction'] || '',
        sc: (r['Score'] === '' || r['Score'] == null) ? null : Number(r['Score']),
        ft: r['FavoriteTrack'] || '',
        nt: r['Note'] || '',
        so: r['Source'] || '',
        cf: r['Confidence'] || '',
        ps: (r['PrevScore'] === '' || r['PrevScore'] == null) ? null : Number(r['PrevScore']),
        rv: r['RevisitFlag'] ? 1 : 0
      };
    });
}

function logListen(data) {
  if (!checkPin(data.pin)) return {error: 'Unauthorized'};
  var sh = getListensSheet_();
  var ts = data.ts || new Date().toISOString();
  // Duplicate guard: same album within the same listen event
  var rows = sh.getDataRange().getValues();
  for (var i = rows.length - 1; i >= 1; i--) {
    if (String(rows[i][0]) === String(ts) && String(rows[i][1]) === String(data.albumId || '')) {
      return {ok: true, duplicate: true, ts: ts};
    }
  }
  sh.appendRow([
    ts,
    data.albumId || '',
    data.artist || '',
    data.album || '',
    data.artUrl || '',
    data.year || '',
    data.reaction || '',
    (data.score === 0 || data.score) ? data.score : '',
    data.favTrack || '',
    data.note || '',
    data.source || '',
    data.confidence || '',
    (data.prevScore === 0 || data.prevScore) ? data.prevScore : '',
    data.revisitFlag ? 1 : ''
  ]);
  if (data.source === 'discover') markDiscoverRated(data.albumId, data.artist, data.album);
  return {ok: true, ts: ts};
}

// Enrich a just-logged listen (score, favorite track, note, revisit flag, reaction)
function updateListen(data) {
  if (!checkPin(data.pin)) return {error: 'Unauthorized'};
  var sh = getListensSheet_();
  var rows = sh.getDataRange().getValues();
  var COL = {reaction: 7, score: 8, favTrack: 9, note: 10, revisitFlag: 14};
  for (var i = rows.length - 1; i >= 1; i--) {
    if (String(rows[i][0]) === String(data.ts) && String(rows[i][1]) === String(data.albumId || '')) {
      if ('reaction'    in data) sh.getRange(i + 1, COL.reaction).setValue(data.reaction || '');
      if ('score'       in data) sh.getRange(i + 1, COL.score).setValue((data.score === 0 || data.score) ? data.score : '');
      if ('favTrack'    in data) sh.getRange(i + 1, COL.favTrack).setValue(data.favTrack || '');
      if ('note'        in data) sh.getRange(i + 1, COL.note).setValue(data.note || '');
      if ('revisitFlag' in data) sh.getRange(i + 1, COL.revisitFlag).setValue(data.revisitFlag ? 1 : '');
      return {ok: true};
    }
  }
  return {error: 'Listen not found'};
}

function verifyPin(data) {
  return checkPin(data.pin) ? {ok: true} : {error: 'Unauthorized'};
}

// ---- WRITERS ----
function addSuggestion(data) {
  // Public — no PIN required
  var sh = getSheet('Suggestions');
  var spotifyId = '';
  if (data.spotifyUrl) {
    var m = String(data.spotifyUrl).match(/album\/([A-Za-z0-9]+)/);
    if (m) spotifyId = m[1];
  }
  sh.appendRow([
    data.artist     || '',
    data.album      || '',
    new Date().toLocaleDateString('en-US'),
    'pending',
    data.notes      || '',
    data.artUrl     || '',
    data.year       || '',
    data.spotifyUrl || '',
    spotifyId,
    data.amUrl      || ''
  ]);
  return {ok: true};
}

function addRating(data) {
  if (!checkPin(data.pin)) return {error: 'Unauthorized'};
  var sh = getSheet('RevisitRatings');
  // Update if row already exists for this album
  var rows = sh.getDataRange().getValues();
  for (var i = 1; i < rows.length; i++) {
    if (String(rows[i][0]) === String(data.albumId)) {
      sh.getRange(i + 1, 5).setValue(data.score);
      sh.getRange(i + 1, 6).setValue(new Date().toLocaleDateString('en-US'));
      return {ok: true, updated: true};
    }
  }
  sh.appendRow([
    data.albumId      || '',
    data.artist       || '',
    data.album        || '',
    data.journeyScore || '',
    data.score        || '',
    new Date().toLocaleDateString('en-US')
  ]);
  if (data.source === 'discover') markDiscoverRated(data.albumId, data.artist, data.album);
  return {ok: true};
}

function addToDiscover(data) {
  if (!checkPin(data.pin)) return {error: 'Unauthorized'};
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName('DiscoverQueue');
  if (!sh) {
    sh = ss.insertSheet('DiscoverQueue');
    sh.appendRow(['Artist','Album','SpotifyID','ArtURL','Year','DateAdded','Rated']);
  }
  sh.appendRow([
    data.artist  || '',
    data.album   || '',
    data.id      || '',
    data.im      || '',
    data.yr      || '',
    new Date().toLocaleDateString('en-US'),
    ''
  ]);
  return {ok: true};
}

function removeFromDiscover(data) {
  if (!checkPin(data.pin)) return {error: 'Unauthorized'};
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName('DiscoverQueue');
  if (!sh) return {error: 'DiscoverQueue tab not found'};
  var rows = sh.getDataRange().getValues();
  for (var i = rows.length - 1; i >= 1; i--) {
    if (rows[i][0] === data.artist && rows[i][1] === data.album) {
      sh.deleteRow(i + 1);
      return {ok: true};
    }
  }
  return {error: 'Album not found in queue'};
}

function markDiscoverRated(id, artist, album) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName('DiscoverQueue');
  if (!sh) return;
  var rows = sh.getDataRange().getValues();
  for (var i = 1; i < rows.length; i++) {
    if ((id && String(rows[i][2]) === String(id)) ||
        (rows[i][0] === artist && rows[i][1] === album)) {
      sh.getRange(i + 1, 7).setValue('Y');
      return;
    }
  }
}

// ---- ONE-TIME SETUP ----
// Run this function ONCE from the Apps Script editor to set your PIN.
// Then delete or comment out the PIN value before sharing the script.
function setOwnerPin() {
  var pin = 'CHANGE_ME_TO_YOUR_PIN';  // <-- set your PIN here, then run this function
  PropertiesService.getScriptProperties().setProperty('OWNER_PIN', pin);
  Logger.log('PIN set successfully. You can now remove the PIN value from this function.');
}

// ---- APPLE MUSIC BATCH ENRICHMENT ----
// Run enrichJourneyWithAppleMusic() then enrichPastAlbumsWithAppleMusic()
// from the Apps Script editor. Re-run if it times out — it skips already-filled rows.

// Run testEnrichFirstRow() first to confirm auth works, then run the full enrichment.
function testEnrichFirstRow() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName('Journey');
  var data = sh.getDataRange().getValues();
  Logger.log('Journey headers: ' + JSON.stringify(data[0]));
  var aIdx = data[0].indexOf('Artist Name');
  var alIdx = data[0].indexOf('Album Name');
  Logger.log('artistCol idx=' + aIdx + '  albumCol idx=' + alIdx);
  var artist = String(data[1][aIdx] || '').trim();
  var album  = String(data[1][alIdx] || '').trim();
  Logger.log('Testing row 2: ' + artist + ' — ' + album);
  var url = 'https://itunes.apple.com/search?term=' +
    encodeURIComponent(artist + ' ' + album) + '&entity=album&limit=3&country=us';
  var resp = UrlFetchApp.fetch(url, {muteHttpExceptions: true});
  var res  = JSON.parse(resp.getContentText());
  Logger.log('iTunes returned ' + (res.results ? res.results.length : 0) + ' results');
  if (res.results && res.results.length) {
    Logger.log('Apple Music URL: ' + res.results[0].collectionViewUrl);
    Logger.log('Artwork URL: ' + (res.results[0].artworkUrl100 || '').replace('100x100bb','600x600bb'));
  }
}

// Enriches a sheet with Apple Music URLs AND album artwork URLs in a single pass.
// imageCol: the sheet column name to write artwork into (may already exist but be empty).
function enrichSheet_(sheetName, artistCol, albumCol, imageCol) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName(sheetName);
  if (!sh) { Logger.log('Sheet not found: ' + sheetName); return; }
  var data = sh.getDataRange().getValues();
  var headers = data[0];

  var aIdx  = headers.indexOf(artistCol);
  var alIdx = headers.indexOf(albumCol);
  if (aIdx === -1 || alIdx === -1) {
    Logger.log('ERROR: Column not found. artistCol="' + artistCol + '" idx=' + aIdx +
               '  albumCol="' + albumCol + '" idx=' + alIdx);
    Logger.log('Available headers: ' + JSON.stringify(headers));
    return;
  }

  // Apple Music column — add if missing
  var amIdx = headers.indexOf('AppleMusicURL');
  if (amIdx === -1) {
    amIdx = headers.length;
    sh.getRange(1, amIdx + 1).setValue('AppleMusicURL');
    SpreadsheetApp.flush();
    Logger.log('Added AppleMusicURL column at col ' + (amIdx + 1));
  }

  // Image column — use existing column by name; do not add new column
  var imIdx = imageCol ? headers.indexOf(imageCol) : -1;

  Logger.log(sheetName + ': aIdx=' + aIdx + ' alIdx=' + alIdx +
             ' amIdx=' + amIdx + ' imIdx=' + imIdx + ' rows=' + (data.length - 1));

  var enriched = 0, skipped = 0, errors = 0;
  var deadline = new Date().getTime() + 5 * 60 * 1000;

  for (var i = 1; i < data.length; i++) {
    if (new Date().getTime() > deadline) {
      Logger.log('Time limit. Enriched ' + enriched + '. Re-run to continue.');
      break;
    }
    var artist = String(data[i][aIdx]  || '').trim();
    var album  = String(data[i][alIdx] || '').trim();
    if (!artist || !album) { skipped++; continue; }

    var existingAm = String(data[i][amIdx] || '').trim();
    var existingIm = (imIdx >= 0) ? String(data[i][imIdx] || '').trim() : '';
    // Skip row only if both columns are already filled
    if (existingAm && (imIdx < 0 || existingIm)) { skipped++; continue; }

    try {
      var url = 'https://itunes.apple.com/search?term=' +
        encodeURIComponent(artist + ' ' + album) +
        '&entity=album&limit=3&country=us';
      var resp = UrlFetchApp.fetch(url, {muteHttpExceptions: true});
      var body = resp.getContentText();
      if (resp.getResponseCode() === 429 || body.indexOf('{') !== 0) {
        Logger.log('Rate limited at row ' + (i+1) + '. Sleeping 8s...');
        Utilities.sleep(8000);
        errors++;
        continue;
      }
      var res = JSON.parse(body);

      var amUrl = '', artUrl = '';
      if (res.results && res.results.length) {
        var best = null;
        for (var j = 0; j < res.results.length; j++) {
          var r = res.results[j];
          var aMatch = r.artistName.toLowerCase().replace(/[^a-z0-9]/g,'').indexOf(
            artist.toLowerCase().replace(/[^a-z0-9]/g,'')) >= 0;
          var lMatch = r.collectionName.toLowerCase().replace(/[^a-z0-9]/g,'').indexOf(
            album.toLowerCase().replace(/[^a-z0-9]/g,'')) >= 0;
          if (aMatch && lMatch) { best = r; break; }
        }
        if (!best) best = res.results[0];
        amUrl  = best.collectionViewUrl || '';
        artUrl = (best.artworkUrl100 || '').replace('100x100bb', '600x600bb');
      }

      if (!existingAm) sh.getRange(i + 1, amIdx + 1).setValue(amUrl);
      if (imIdx >= 0 && !existingIm) sh.getRange(i + 1, imIdx + 1).setValue(artUrl);
      enriched++;
      if (enriched % 10 === 0) Logger.log('Progress: enriched ' + enriched);
      Utilities.sleep(800);
    } catch(e) {
      Logger.log('Error row ' + (i+1) + ': ' + e);
      errors++;
    }
  }
  Logger.log(sheetName + ' done. Enriched:' + enriched + ' Skipped:' + skipped + ' Errors:' + errors);
}

// Fills AppleMusicURL + Spotify Album Image URL for all Journey albums
function enrichJourneyWithAppleMusic() {
  enrichSheet_('Journey', 'Artist Name', 'Album Name', 'Spotify Album Image URL');
}

// Fills AppleMusicURL + Album Art URL for all Past Albums
function enrichPastAlbumsWithAppleMusic() {
  enrichSheet_('Past Albums', 'Artist', 'Album', 'Album Art URL');
}
