// Minimal client for Google Apps Script backend storing JSON in Drive
(function (global) {
  const GAS_BASE = "https://script.google.com/macros/s/AKfycbxdltI8iJc5V47dLZqStX_-5L1_zK-0CQGQCIMyuKjKWlbGy6SmBd80W1qv4i15f1lW/exec";
  const DEBUG = true;
  function dlog() { try { if (DEBUG && console && console.log) console.log('[DataService]', ...arguments); } catch(_){} }

  function normalizeRecordForSave(doi, record) {
    try {
      const r = record || {};
      const out = {
        DOI: (doi || r.DOI || r.doi || '').trim(),
        title: Array.isArray(r.title) ? r.title : (r.title ? [r.title] : []),
        abstract: r.abstract != null ? r.abstract : null,
      };
      // Preserve custom 'cartella' field if provided
      if (typeof r.cartella === 'string') out.cartella = r.cartella;
      if (Array.isArray(r.user_notes)) out.user_notes = r.user_notes;
      if (Array.isArray(r.user_glossario)) out.user_glossario = r.user_glossario;
      if (r.dettagli && typeof r.dettagli === 'object') out.dettagli = r.dettagli;
      if (Array.isArray(r.dati_variabili)) out.dati_variabili = r.dati_variabili;
      return out;
    } catch (_) {
      return { DOI: (doi || '').trim() };
    }
  }

  async function getAll() {
    const url = `${GAS_BASE}?op=all&_=${Date.now()}`;
    dlog('GET all ->', GAS_BASE);
    const res = await fetch(url, { method: 'GET', credentials: 'omit' });
    if (!res.ok) throw new Error('getAll failed: ' + res.status);
    const data = await res.json();
    const db = (data && (data.data || data)) || {};
    dlog('GET all ok, keys:', Object.keys(db).length);
    return db;
  }

  async function getByDoi(doi) {
    const url = `${GAS_BASE}?op=byDoi&doi=${encodeURIComponent(doi)}&_=${Date.now()}`;
    dlog('GET byDoi ->', doi);
    const res = await fetch(url, { method: 'GET', credentials: 'omit' });
    if (!res.ok) throw new Error('getByDoi failed: ' + res.status);
    const data = await res.json();
    const rec = (data && data.data) || null;
    dlog('GET byDoi ok?', !!rec);
    return rec;
  }

  async function saveRecord(doi, record) {
    const payload = normalizeRecordForSave(doi, record);
    dlog('SAVE start', payload.DOI, { notes: !!payload.user_notes, dettagli: !!payload.dettagli, vars: !!payload.dati_variabili, cartella: (typeof payload.cartella === 'string') ? payload.cartella : undefined });

    // Prefer POST form-urlencoded first (simple request, evita preflight CORS)
    try {
      dlog('SAVE try POST form-urlencoded');
      const body = `op=save&doi=${encodeURIComponent(payload.DOI)}&record=${encodeURIComponent(JSON.stringify(payload))}`;
      const resForm = await fetch(GAS_BASE, {
        method: 'POST',
        credentials: 'omit',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8' },
        body,
      });
      if (resForm.ok) {
        const out = await resForm.json().catch(() => ({ ok: true }));
        dlog('SAVE POST FORM ok');
        return out;
      }
    } catch (e) {
      dlog('SAVE POST FORM failed', e && e.message);
    }

    // Tentativo POST JSON (se supportato dalla tua distribuzione GAS)
    try {
      dlog('SAVE try POST JSON');
      const res = await fetch(GAS_BASE, {
        method: 'POST',
        credentials: 'omit',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ op: 'save', doi: payload.DOI, record: payload }),
      });
      if (res.ok) {
        const out = await res.json().catch(() => ({ ok: true }));
        dlog('SAVE POST JSON ok');
        return out;
      }
    } catch (e) {
      dlog('SAVE POST JSON failed (2)', e && e.message);
    }
    // Fallback GET (urlencoded data). Use chunking to avoid URL length limits
    const jsonStr = JSON.stringify(payload);
    const enc = (s) => encodeURIComponent(s);
    let url = `${GAS_BASE}?op=save&doi=${encodeURIComponent(payload.DOI)}`;
    if (jsonStr.length <= 1200) {
      url += `&data=${enc(jsonStr)}`;
    } else {
      const chunkSize = 1000; // before encoding
      let idx = 0, part = 1;
      while (idx < jsonStr.length && part < 100) {
        const chunk = jsonStr.slice(idx, idx + chunkSize);
        url += `&d${part}=${enc(chunk)}`;
        idx += chunkSize; part += 1;
      }
    }
    // If URL becomes too long, abort with guidance
    if (url.length > 7000) {
      dlog('SAVE GET aborted: url too long', url.length);
      throw new Error('Payload troppo grande per GET; abilita POST (consigliato) o riduci il record.');
    }
    dlog('SAVE try GET (chunked?) urlLen=', url.length);
    const res2 = await fetch(url, { method: 'GET', credentials: 'omit' });
    if (!res2.ok) throw new Error('saveRecord fallback GET failed: ' + res2.status);
    const out2 = await res2.json().catch(() => ({ ok: true }));
    dlog('SAVE GET ok');
    return out2;
  }

  global.DataService = { GAS_BASE, getAll, getByDoi, saveRecord };
})(window);
