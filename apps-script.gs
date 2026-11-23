/**
 * Christmas Dinner Sign-Up: Google Apps Script backend.
 *
 * Setup (first time):
 * 1. Create a new Google Sheet.
 * 2. Extensions > Apps Script. Delete what's there, paste this whole file, and save.
 * 3. Deploy > New deployment > type "Web app".
 *    Execute as: Me. Who has access: Anyone. Then click Deploy and authorize.
 * 4. Copy the Web app URL (ends in /exec) into SCRIPT_URL in index.html.
 *
 * Updating this script later: paste the new version, save, then
 * Deploy > Manage deployments > Edit (pencil) > Version: New version > Deploy.
 * That keeps the same URL. ("New deployment" would make a new URL.)
 *
 * Tabs (created automatically):
 * - Responses:    date sign-ups and restaurant suggestions. Delete a row to remove someone.
 * - Poll Options: type the approved restaurants in column A, one per row, under the header.
 *                 The ranked-choice poll shows exactly these. Leave it empty to hide voting.
 * - Votes:        each voter's ranking. Delete a row to remove a vote.
 */

var SHEET_NAME = 'Responses';
var HEADERS = ['Updated', 'Token', 'Name', 'Dec 13', 'Dec 27', 'Restaurant 1', 'Restaurant 2', 'Restaurant 3'];
var OPTIONS_SHEET = 'Poll Options';
var VOTES_SHEET = 'Votes';
var MAX_OPTIONS = 15;

function sheet_(name, headers) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName(name);
  if (!sh) {
    sh = ss.insertSheet(name);
    sh.appendRow(headers);
    sh.setFrozenRows(1);
  }
  return sh;
}

function getSheet_() { return sheet_(SHEET_NAME, HEADERS); }
function getOptionsSheet_() { return sheet_(OPTIONS_SHEET, ['Approved restaurant (one per row)']); }
function getVotesSheet_() {
  var h = ['Updated', 'Token', 'Name'];
  for (var i = 1; i <= MAX_OPTIONS; i++) h.push('Choice ' + i);
  return sheet_(VOTES_SHEET, h);
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

function clean_(v, max) {
  var s = String(v == null ? '' : v).replace(/\s+/g, ' ').trim().slice(0, max);
  // Stop text being read as a spreadsheet formula.
  if (/^[=+\-@]/.test(s)) s = "'" + s;
  return s;
}

function unescape_(v) {
  var s = String(v == null ? '' : v);
  return s.charAt(0) === "'" ? s.slice(1) : s;
}

// Approved poll options from the "Poll Options" tab (column A, below the header).
function getOptions_() {
  var sh = getOptionsSheet_();
  if (sh.getLastRow() < 2) return [];
  var seen = {};
  return sh.getRange(2, 1, sh.getLastRow() - 1, 1).getValues()
    .map(function (r) { return unescape_(r[0]).replace(/\s+/g, ' ').trim().slice(0, 80); })
    .filter(function (o) {
      var k = o.toLowerCase();
      if (!o || seen[k]) return false;
      seen[k] = true;
      return true;
    })
    .slice(0, MAX_OPTIONS);
}

function findRow_(sh, token) {
  if (sh.getLastRow() < 2) return -1;
  var tokens = sh.getRange(2, 2, sh.getLastRow() - 1, 1).getValues();
  for (var i = 0; i < tokens.length; i++) {
    if (String(tokens[i][0]) === token) return i + 2;
  }
  return -1;
}

// GET: everyone's answers, the poll options, and the anonymous ballots (tokens are never sent out).
function doGet() {
  var values = getSheet_().getDataRange().getValues().slice(1);
  var rows = values
    .filter(function (r) { return String(r[2]).trim() !== ''; })
    .map(function (r) {
      return {
        name: unescape_(r[2]),
        d13: r[3] === 'Yes',
        d27: r[4] === 'Yes',
        places: [r[5], r[6], r[7]].map(unescape_).filter(function (p) { return p.trim() !== ''; }),
        at: r[0] instanceof Date ? r[0].getTime() : 0
      };
    });

  var options = getOptions_();
  var valid = {};
  options.forEach(function (o) { valid[o] = true; });
  var votes = getVotesSheet_().getDataRange().getValues().slice(1)
    .map(function (r) {
      var seen = {};
      return r.slice(3).map(unescape_).filter(function (c) {
        if (!valid[c] || seen[c]) return false;
        seen[c] = true;
        return true;
      });
    })
    .filter(function (ranking) { return ranking.length > 0; })
    .map(function (ranking) { return { ranking: ranking }; });

  return json_({ ok: true, rows: rows, options: options, votes: votes });
}

// POST: save/remove a sign-up, or save/remove a ranked vote, keyed by the browser's private token.
function doPost(e) {
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(10000);
  } catch (err) {
    return json_({ ok: false, error: 'busy' });
  }
  try {
    var body = JSON.parse((e && e.postData && e.postData.contents) || '{}');
    var token = String(body.token || '');
    if (!/^[A-Za-z0-9_-]{16,64}$/.test(token)) return json_({ ok: false, error: 'bad_token' });

    // ----- Ranked-choice poll -----
    if (body.action === 'vote' || body.action === 'unvote') {
      var vs = getVotesSheet_();
      var vRow = findRow_(vs, token);
      if (body.action === 'unvote') {
        if (vRow > 0) vs.deleteRow(vRow);
        return json_({ ok: true });
      }
      var voter = clean_(body.name, 60);
      if (!voter) return json_({ ok: false, error: 'missing_name' });
      var options = getOptions_();
      if (!options.length) return json_({ ok: false, error: 'poll_closed' });
      var valid = {};
      options.forEach(function (o) { valid[o] = true; });
      var seen = {};
      var ranking = (Array.isArray(body.ranking) ? body.ranking : [])
        .map(function (c) { return String(c); })
        .filter(function (c) {
          if (!valid[c] || seen[c]) return false;
          seen[c] = true;
          return true;
        });
      if (!ranking.length) return json_({ ok: false, error: 'empty_ranking' });
      var vRowData = [new Date(), token, voter];
      for (var j = 0; j < MAX_OPTIONS; j++) vRowData.push(ranking[j] ? clean_(ranking[j], 80) : '');
      if (vRow > 0) {
        vs.getRange(vRow, 1, 1, vRowData.length).setValues([vRowData]);
      } else {
        if (vs.getLastRow() > 500) return json_({ ok: false, error: 'full' });
        vs.appendRow(vRowData);
      }
      return json_({ ok: true });
    }

    // ----- Date sign-up and restaurant suggestions -----
    var sh = getSheet_();
    var rowIndex = findRow_(sh, token);

    if (body.action === 'delete') {
      if (rowIndex > 0) sh.deleteRow(rowIndex);
      return json_({ ok: true });
    }

    var name = clean_(body.name, 60);
    if (!name) return json_({ ok: false, error: 'missing_name' });
    var places = (Array.isArray(body.places) ? body.places : []).slice(0, 3).map(function (p) { return clean_(p, 80); });
    while (places.length < 3) places.push('');

    var row = [new Date(), token, name, body.d13 === true ? 'Yes' : '', body.d27 === true ? 'Yes' : ''].concat(places);
    if (rowIndex > 0) {
      sh.getRange(rowIndex, 1, 1, row.length).setValues([row]);
    } else {
      if (sh.getLastRow() > 500) return json_({ ok: false, error: 'full' });
      sh.appendRow(row);
    }
    return json_({ ok: true });
  } catch (err) {
    return json_({ ok: false, error: 'server' });
  } finally {
    lock.releaseLock();
  }
}
