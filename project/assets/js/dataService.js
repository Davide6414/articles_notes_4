// Minimal client for Google Apps Script backend storing JSON in Drive
(function (global) {
  const GAS_BASE = "https://script.google.com/macros/s/AKfycbxdltI8iJc5V47dLZqStX_-5L1_zK-0CQGQCIMyuKjKWlbGy6SmBd80W1qv4i15f1lW/exec";

  async function getAll() {
    const url = `${GAS_BASE}?op=all&_=${Date.now()}`;
    const res = await fetch(url, { method: 'GET', credentials: 'omit' });
    if (!res.ok) throw new Error('getAll failed: ' + res.status);
    const data = await res.json();
    return (data && (data.data || data)) || {};
  }

  async function getByDoi(doi) {
    const url = `${GAS_BASE}?op=byDoi&doi=${encodeURIComponent(doi)}&_=${Date.now()}`;
    const res = await fetch(url, { method: 'GET', credentials: 'omit' });
    if (!res.ok) throw new Error('getByDoi failed: ' + res.status);
    const data = await res.json();
    return (data && data.data) || null;
  }

  async function saveRecord(doi, record) {
    // Try POST JSON first
    try {
      const res = await fetch(GAS_BASE, {
        method: 'POST',
        credentials: 'omit',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ op: 'save', doi, record }),
      });
      if (res.ok) {
        const out = await res.json().catch(() => ({ ok: true }));
        return out;
      }
    } catch (e) {
      // fall through to alternate strategies
    }

    // Try POST form-urlencoded as alternative
    try {
      const body = `op=save&doi=${encodeURIComponent(doi)}&record=${encodeURIComponent(JSON.stringify(record))}`;
      const resForm = await fetch(GAS_BASE, {
        method: 'POST',
        credentials: 'omit',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8' },
        body,
      });
      if (resForm.ok) {
        const out = await resForm.json().catch(() => ({ ok: true }));
        return out;
      }
    } catch (e) {
      // fall through
    }
    // Fallback GET (urlencoded data). Use chunking to avoid URL length limits
    const jsonStr = JSON.stringify(record);
    const enc = (s) => encodeURIComponent(s);
    let url = `${GAS_BASE}?op=save&doi=${encodeURIComponent(doi)}`;
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
      throw new Error('Payload troppo grande per GET; abilita POST (consigliato) o riduci il record.');
    }
    const res2 = await fetch(url, { method: 'GET', credentials: 'omit' });
    if (!res2.ok) throw new Error('saveRecord fallback GET failed: ' + res2.status);
    const out2 = await res2.json().catch(() => ({ ok: true }));
    return out2;
  }

  global.DataService = { GAS_BASE, getAll, getByDoi, saveRecord };
})(window);
