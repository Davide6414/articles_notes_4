// Simple toast utility
(function (global) {
  const containerId = 'toast-container';
  function ensureContainer() {
    let el = document.getElementById(containerId);
    if (!el) {
      el = document.createElement('div');
      el.id = containerId;
      el.className = 'toast-container';
      document.body.appendChild(el);
    }
    return el;
  }

  let counter = 0;
  function show(message, type = 'info', opts = {}) {
    const id = 't_' + (++counter);
    const container = ensureContainer();
    const t = document.createElement('div');
    t.className = `toast ${type}`;
    t.id = id;
    t.innerHTML = `<span class="dot"></span><div class="content"><div class="title">${escapeHtml(message)}</div></div><button class="close" aria-label="Chiudi">×</button>`;
    t.querySelector('.close').onclick = () => dismiss(id);
    container.appendChild(t);
    const duration = opts.duration == null ? (type === 'error' ? 5000 : 2500) : opts.duration;
    if (duration > 0) setTimeout(() => dismiss(id), duration);
    return id;
  }

  function loading(message = 'Caricamento...') {
    return show(message, 'info', { duration: 0 });
  }

  function update(id, message, type) {
    const t = document.getElementById(id);
    if (!t) return;
    if (type) t.className = `toast ${type}`;
    const title = t.querySelector('.title');
    if (title) title.textContent = message;
  }

  function dismiss(id) {
    const t = document.getElementById(id);
    if (t && t.parentNode) t.parentNode.removeChild(t);
  }

  function success(msg, opts) { return show(msg, 'success', opts); }
  function error(msg, opts) { return show(msg, 'error', opts); }
  function info(msg, opts) { return show(msg, 'info', opts); }

  function escapeHtml(s){
    return String(s).replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
  }

  global.Toast = { show, success, error, info, loading, update, dismiss };
})(window);

