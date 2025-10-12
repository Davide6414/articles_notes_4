/**
 * Google Apps Script Web App for storing article data in Drive as JSON.
 *
 * Data model (per DOI key):
 * {
 *   "<DOI>": {
 *     // Crossref fields (DOI, title, ...)
 *     // user_notes: [...]
 *     // dettagli: {...}
 *     // dati_variabili: [...]
 *   },
 *   ...
 * }
 */

const CONFIG = {
  FILE_NAME: 'articles_notes_data.json',
  FOLDER_NAME: 'ArticlesNotes',
  INDENT: 2,
};

function doGet(e) {
  try {
    const op = (e && e.parameter && e.parameter.op) || (e && e.parameter && e.parameter.action) || 'health';
    if (op === 'health') {
      return json_({ ok: true, status: 'Web App is running', now: new Date().toISOString() });
    }
    if (op === 'all') {
      const db = readDb_();
      return json_({ ok: true, data: db });
    }
    if (op === 'byDoi') {
      const doi = (e.parameter && e.parameter.doi) || '';
      if (!doi) return badRequest_('missing doi');
      const db = readDb_();
      return json_({ ok: true, data: db[doi] || null });
    }
    if (op === 'save') {
      // Convenience GET save: op=save&doi=...&data=<urlencoded JSON>
      // Supports chunked params: d1=..., d2=..., ... joined in order when 'data' missing.
      const doi = (e.parameter && e.parameter.doi) || '';
      let raw = (e.parameter && e.parameter.data) || '';
      if (!raw) {
        // join d1..dN if present
        const parts = [];
        for (var i = 1; i <= 99; i++) {
          var key = 'd' + i;
          if (e.parameter && key in e.parameter) {
            parts.push(e.parameter[key]);
          } else {
            break;
          }
        }
        if (parts.length) raw = parts.join('');
      }
      if (!doi || !raw) return badRequest_('missing doi or data');
      let record;
      try { record = JSON.parse(raw); } catch (err) { return badRequest_('invalid json data'); }
      upsertRecord_(doi, record);
      return json_({ ok: true, saved: doi });
    }
    return json_({ ok: false, error: 'unknown_op', op });
  } catch (err) {
    return error_(err);
  }
}

function doPost(e) {
  try {
    const body = parseBody_(e);
    const op = body.op || body.action || 'save';
    if (op === 'save') {
      const doi = body.doi || (body.record && body.record.DOI) || body.record?.doi || '';
      const record = body.record || null;
      if (!doi || !record) return badRequest_('missing doi or record');
      upsertRecord_(doi, record);
      return json_({ ok: true, saved: doi });
    }
    if (op === 'bulkSave') {
      // Accepts { records: { doi: record, ... } }
      const records = body.records || body.db || null;
      if (!records || typeof records !== 'object') return badRequest_('missing records');
      const lock = LockService.getScriptLock();
      lock.waitLock(20 * 1000);
      try {
        const db = readDb_();
        Object.keys(records).forEach(function (doi) {
          db[doi] = records[doi];
        });
        writeDb_(db);
      } finally {
        lock.releaseLock();
      }
      return json_({ ok: true, savedCount: Object.keys(records).length });
    }
    if (op === 'all') {
      const db = readDb_();
      return json_({ ok: true, data: db });
    }
    return json_({ ok: false, error: 'unknown_op', op });
  } catch (err) {
    return error_(err);
  }
}

// Helpers

function json_(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

function badRequest_(msg) {
  return json_({ ok: false, error: 'bad_request', message: msg });
}

function error_(err) {
  return json_({ ok: false, error: ('' + err) });
}

function parseBody_(e) {
  if (!e || !e.postData || !e.postData.contents) return {};
  const ct = (e.postData.type || '').toLowerCase();
  const raw = e.postData.contents || '';
  if (ct.indexOf('application/json') >= 0) {
    try { return JSON.parse(raw); } catch (_) { return {}; }
  }
  // Fallback form-urlencoded
  const params = raw.split('&').reduce(function (acc, pair) {
    const m = pair.split('=');
    if (m.length === 2) acc[decodeURIComponent(m[0])] = decodeURIComponent(m[1]);
    return acc;
  }, {});
  if (params.record) {
    try { params.record = JSON.parse(params.record); } catch (_) {}
  }
  if (params.records) {
    try { params.records = JSON.parse(params.records); } catch (_) {}
  }
  return params;
}

function getOrCreateFolder_() {
  const it = DriveApp.getFoldersByName(CONFIG.FOLDER_NAME);
  if (it.hasNext()) return it.next();
  return DriveApp.createFolder(CONFIG.FOLDER_NAME);
}

function getDbFile_() {
  const folder = getOrCreateFolder_();
  const files = folder.getFilesByName(CONFIG.FILE_NAME);
  if (files.hasNext()) return files.next();
  return folder.createFile(CONFIG.FILE_NAME, '{}', MimeType.PLAIN_TEXT);
}

function readDb_() {
  const file = getDbFile_();
  try {
    const txt = file.getBlob().getDataAsString('UTF-8') || '{}';
    const obj = JSON.parse(txt);
    if (obj && typeof obj === 'object') return obj;
    return {};
  } catch (err) {
    return {};
  }
}

function writeDb_(obj) {
  const file = getDbFile_();
  const lock = LockService.getScriptLock();
  lock.waitLock(20 * 1000);
  try {
    file.setContent(JSON.stringify(obj, null, CONFIG.INDENT) + '\n');
  } finally {
    lock.releaseLock();
  }
}

function upsertRecord_(doi, record) {
  const lock = LockService.getScriptLock();
  lock.waitLock(20 * 1000);
  try {
    const db = readDb_();
    db[String(doi)] = record;
    writeDb_(db);
  } finally {
    lock.releaseLock();
  }
}
