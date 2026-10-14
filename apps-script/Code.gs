/**
 * Kochplaner – Speicher in Google Drive
 *
 * Dieses Script speichert Rezepte, Wochenpläne und Einkaufsliste als Datei im
 * Drive-Ordner "Kochplaner" und holt Rezeptseiten für den Link-Import ab.
 *
 * Einrichtung (Kurzfassung, ausführlich in der App unter Einstellungen):
 *  1. Projekteinstellungen (Zahnrad) → Script-Properties → Property "PASSWORT" anlegen
 *  2. Oben die Funktion "einrichten" auswählen → Ausführen → Zugriff erlauben
 *  3. Bereitstellen → Neue Bereitstellung → Web-App
 *     Ausführen als: Ich · Zugriff: Jeder → Bereitstellen → URL kopieren
 */

var APP_VERSION = 1;
var FOLDER_NAME = 'Kochplaner';
var DATA_FILE = 'kochplaner-daten.json';
var IMAGE_FOLDER = 'Bilder';
var BACKUP_FOLDER = 'Backups';
var BACKUPS_TO_KEEP = 14;
var MAX_FETCH_CHARS = 3000000;
var MAX_IMAGE_BYTES = 10 * 1024 * 1024;

/** Einmal im Editor ausführen: legt den Ordner an und fragt die Berechtigungen ab. */
function einrichten() {
  var folder = folder_();
  dataFile_();
  imageFolder_();
  UrlFetchApp.fetch('https://www.google.com/', { muteHttpExceptions: true });
  var pw = PropertiesService.getScriptProperties().getProperty('PASSWORT');
  Logger.log('Ordner: ' + folder.getUrl());
  Logger.log(
    pw
      ? 'Fertig! Jetzt unter "Bereitstellen" die Web-App bereitstellen.'
      : 'Achtung: Es ist noch kein PASSWORT gesetzt (Projekteinstellungen → Script-Properties).'
  );
}

function doGet() {
  return json_({ ok: true, app: 'kochplaner', version: APP_VERSION });
}

function doPost(e) {
  var req;
  try {
    req = JSON.parse(e.postData.contents);
  } catch (err) {
    return json_({ ok: false, error: 'bad_request' });
  }
  var expected = PropertiesService.getScriptProperties().getProperty('PASSWORT');
  if (!expected) return json_({ ok: false, error: 'no_password' });
  if (!req || typeof req.password !== 'string' || !safeEqual_(req.password, expected)) {
    Utilities.sleep(1000);
    return json_({ ok: false, error: 'unauthorized' });
  }
  try {
    switch (req.op) {
      case 'ping':
        return json_({ ok: true, version: APP_VERSION, folderUrl: folder_().getUrl() });
      case 'sync':
        return json_(sync_(req));
      case 'upload':
        return json_(upload_(req));
      case 'saveImageUrl':
        return json_(saveImageUrl_(req));
      case 'image':
        return json_(image_(req));
      case 'deleteImage':
        return json_(deleteImage_(req));
      case 'fetch':
        return json_(fetch_(req));
      default:
        return json_({ ok: false, error: 'unknown_op' });
    }
  } catch (err) {
    return json_({ ok: false, error: 'server', message: String((err && err.message) || err) });
  }
}

// ---------------------------------------------------------------------------
// Sync: every document has an updatedAt (client clock) and a rev (server counter).
// The newest updatedAt wins; clients ask for everything with rev > their last rev.

function sync_(req) {
  var lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    var file = dataFile_();
    var db = readDb_(file);
    var since = Number(req.since) || 0;
    var changes = Array.isArray(req.changes) ? req.changes : [];
    var forced = {};
    var changed = false;

    for (var i = 0; i < changes.length; i++) {
      var c = changes[i];
      if (!c || typeof c.coll !== 'string' || typeof c.id !== 'string') continue;
      var key = c.coll + '/' + c.id;
      var cur = db.docs[key];
      var ts = Number(c.updatedAt) || 0;
      if (!cur || ts > cur.updatedAt) {
        db.rev++;
        db.docs[key] = {
          coll: c.coll,
          id: c.id,
          data: c.deleted ? null : c.data === undefined ? null : c.data,
          updatedAt: ts,
          deleted: !!c.deleted,
          rev: db.rev,
        };
        changed = true;
      } else if (ts < cur.updatedAt) {
        // the client has an outdated version -> send it the current one
        forced[key] = true;
      }
    }

    if (changed) {
      backup_(file);
      writeDb_(file, db);
    }

    var out = [];
    for (var k in db.docs) {
      if (db.docs[k].rev > since || forced[k]) out.push(db.docs[k]);
    }
    return { ok: true, rev: db.rev, docs: out };
  } finally {
    lock.releaseLock();
  }
}

function readDb_(file) {
  var text = file.getBlob().getDataAsString('UTF-8');
  if (!text) return { rev: 0, docs: {} };
  var db = JSON.parse(text);
  if (!db || typeof db.rev !== 'number' || typeof db.docs !== 'object') return { rev: 0, docs: {} };
  return db;
}

function writeDb_(file, db) {
  // escape non-ASCII so umlauts survive any encoding round trip
  var text = JSON.stringify(db).replace(/[\u007f-￿]/g, function (ch) {
    return '\\u' + ('0000' + ch.charCodeAt(0).toString(16)).slice(-4);
  });
  file.setContent(text);
}

/** One copy of the data file per day, the last BACKUPS_TO_KEEP are kept. */
function backup_(file) {
  var props = PropertiesService.getScriptProperties();
  var today = Utilities.formatDate(new Date(), Session.getScriptTimeZone() || 'Europe/Berlin', 'yyyy-MM-dd');
  if (props.getProperty('LAST_BACKUP') === today) return;
  var folder = subFolder_(BACKUP_FOLDER);
  file.makeCopy('kochplaner-' + today + '.json', folder);
  props.setProperty('LAST_BACKUP', today);
  var files = [];
  var it = folder.getFiles();
  while (it.hasNext()) files.push(it.next());
  files.sort(function (a, b) {
    return a.getName() < b.getName() ? 1 : -1;
  });
  for (var i = BACKUPS_TO_KEEP; i < files.length; i++) files[i].setTrashed(true);
}

// ---------------------------------------------------------------------------
// Images

function upload_(req) {
  var mime = String(req.mimeType || '');
  if (!/^image\/(jpeg|png|webp|gif)$/.test(mime)) return { ok: false, error: 'bad_type' };
  var bytes = Utilities.base64Decode(String(req.base64 || ''));
  if (!bytes.length || bytes.length > MAX_IMAGE_BYTES) return { ok: false, error: 'too_large' };
  var name = safeName_(req.name) || 'bild';
  var file = imageFolder_().createFile(Utilities.newBlob(bytes, mime, name));
  return publish_(file);
}

function saveImageUrl_(req) {
  var url = String(req.url || '');
  if (!/^https?:\/\//i.test(url)) return { ok: false, error: 'bad_url' };
  var res = UrlFetchApp.fetch(url, { muteHttpExceptions: true, followRedirects: true, headers: browserHeaders_() });
  if (res.getResponseCode() >= 400) return { ok: false, error: 'http_' + res.getResponseCode() };
  var blob = res.getBlob();
  var mime = String(blob.getContentType() || '');
  if (!/^image\//.test(mime)) return { ok: false, error: 'bad_type' };
  if (blob.getBytes().length > MAX_IMAGE_BYTES) return { ok: false, error: 'too_large' };
  blob.setName(safeName_(req.name) || 'bild');
  return publish_(imageFolder_().createFile(blob));
}

function publish_(file) {
  var shared = true;
  try {
    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  } catch (err) {
    shared = false;
  }
  var id = file.getId();
  return { ok: true, id: id, url: shared ? 'https://lh3.googleusercontent.com/d/' + id : '', shared: shared };
}

/** Fallback when the direct link cannot be shown: return the image itself. */
function image_(req) {
  var file = ownImage_(req.id);
  if (!file) return { ok: false, error: 'not_found' };
  var blob = file.getBlob();
  return { ok: true, mimeType: blob.getContentType(), base64: Utilities.base64Encode(blob.getBytes()) };
}

function deleteImage_(req) {
  var file = ownImage_(req.id);
  if (file) file.setTrashed(true);
  return { ok: true };
}

/** Only files inside the Kochplaner/Bilder folder may be read or deleted. */
function ownImage_(id) {
  if (typeof id !== 'string' || !/^[\w-]{10,}$/.test(id)) return null;
  var file;
  try {
    file = DriveApp.getFileById(id);
  } catch (err) {
    return null;
  }
  var folderId = imageFolder_().getId();
  var parents = file.getParents();
  while (parents.hasNext()) {
    if (parents.next().getId() === folderId) return file;
  }
  return null;
}

// ---------------------------------------------------------------------------
// Recipe import: fetch the page, the app extracts the recipe.

function fetch_(req) {
  var url = String(req.url || '');
  if (!/^https?:\/\//i.test(url)) return { ok: false, error: 'bad_url' };
  var res = UrlFetchApp.fetch(url, { muteHttpExceptions: true, followRedirects: true, headers: browserHeaders_() });
  var body = res.getContentText();
  if (/charset=["']?iso-8859-1/i.test(body.slice(0, 2000))) body = res.getContentText('ISO-8859-1');
  if (body.length > MAX_FETCH_CHARS) body = body.slice(0, MAX_FETCH_CHARS);
  return { ok: true, status: res.getResponseCode(), body: body };
}

function browserHeaders_() {
  return {
    'User-Agent':
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36',
    'Accept-Language': 'de-DE,de;q=0.9,en;q=0.6',
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/*,*/*;q=0.8',
  };
}

// ---------------------------------------------------------------------------
// Drive helpers (ids are cached in the script properties)

function folder_() {
  var props = PropertiesService.getScriptProperties();
  var id = props.getProperty('FOLDER_ID');
  if (id) {
    try {
      var f = DriveApp.getFolderById(id);
      if (!f.isTrashed()) return f;
    } catch (err) {
      // fall through and look it up again
    }
  }
  var it = DriveApp.getRootFolder().getFoldersByName(FOLDER_NAME);
  var folder = it.hasNext() ? it.next() : DriveApp.getRootFolder().createFolder(FOLDER_NAME);
  props.setProperty('FOLDER_ID', folder.getId());
  return folder;
}

function subFolder_(name) {
  var parent = folder_();
  var it = parent.getFoldersByName(name);
  return it.hasNext() ? it.next() : parent.createFolder(name);
}

function imageFolder_() {
  return subFolder_(IMAGE_FOLDER);
}

function dataFile_() {
  var props = PropertiesService.getScriptProperties();
  var id = props.getProperty('DATA_FILE_ID');
  if (id) {
    try {
      var f = DriveApp.getFileById(id);
      if (!f.isTrashed()) return f;
    } catch (err) {
      // fall through
    }
  }
  var folder = folder_();
  var it = folder.getFilesByName(DATA_FILE);
  var file = it.hasNext() ? it.next() : folder.createFile(DATA_FILE, '{"rev":0,"docs":{}}', 'application/json');
  props.setProperty('DATA_FILE_ID', file.getId());
  return file;
}

// ---------------------------------------------------------------------------

function safeName_(name) {
  return String(name || '')
    .replace(/[^\w.\-äöüÄÖÜß ]+/g, '')
    .slice(0, 80);
}

function safeEqual_(a, b) {
  if (a.length !== b.length) return false;
  var diff = 0;
  for (var i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
