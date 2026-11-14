/**
 * Christmas Dinner Sign-Up: Google Apps Script backend.
 *
 * Setup:
 * 1. Create a new Google Sheet.
 * 2. Extensions > Apps Script. Delete what's there, paste this whole file, and save.
 * 3. Deploy > New deployment > type "Web app".
 *    Execute as: Me. Who has access: Anyone. Then click Deploy and authorize.
 * 4. Copy the Web app URL (ends in /exec) into SCRIPT_URL in christmas-dinner.html.
 *
 * Responses land in a "Responses" tab. To remove someone, delete their row in the sheet.
 * If you edit this script later, use Deploy > Manage deployments > Edit > New version
 * so the same URL keeps working.
 */

var SHEET_NAME = 'Responses';
var HEADERS = ['Updated', 'Token', 'Name', 'Dec 13', 'Dec 27', 'Restaurant 1', 'Restaurant 2', 'Restaurant 3'];

function getSheet_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName(SHEET_NAME);
  if (!sh) {
    sh = ss.insertSheet(SHEET_NAME);
    sh.appendRow(HEADERS);
    sh.setFrozenRows(1);
  }
  return sh;
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

// GET: everyone's answers (tokens are never sent out).
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
  return json_({ ok: true, rows: rows });
}

// POST: save or remove one person's answer, keyed by their private token.
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

    var sh = getSheet_();
    var tokens = sh.getLastRow() > 1 ? sh.getRange(2, 2, sh.getLastRow() - 1, 1).getValues() : [];
    var rowIndex = -1;
    for (var i = 0; i < tokens.length; i++) {
      if (String(tokens[i][0]) === token) { rowIndex = i + 2; break; }
    }

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
