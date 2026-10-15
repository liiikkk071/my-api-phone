/* 存储层：IndexedDB 为主（容量远大于 localStorage 的 5MB），内存缓存保证同步读写，写入异步落盘 */
(function () {
  const DB = 'xsj-store', ST = 'kv';
  const cache = new Map();
  let db = null, pending = new Map(), timer = null, failed = false;
  function open() {
    return new Promise((res, rej) => {
      const r = indexedDB.open(DB, 1);
      r.onupgradeneeded = () => r.result.createObjectStore(ST);
      r.onsuccess = () => res(r.result);
      r.onerror = () => rej(r.error);
    });
  }
  function flush() {
    timer = null;
    if (!db || !pending.size) return;
    const batch = pending; pending = new Map();
    try {
      const tx = db.transaction(ST, 'readwrite'), os = tx.objectStore(ST);
      batch.forEach((v, k) => v === null ? os.delete(k) : os.put(v, k));
      tx.onerror = tx.onabort = () => { failed = true; };
    } catch (e) { failed = true; }
  }
  function queue(k, v) { pending.set(k, v); if (!timer) timer = setTimeout(flush, 150); }
  window.addEventListener('pagehide', flush);
  document.addEventListener('visibilitychange', () => { if (document.hidden) flush(); });
  const store = {
    getItem: k => cache.has(k) ? cache.get(k) : null,
    setItem: (k, v) => { v = String(v); cache.set(k, v); queue(k, v); },
    removeItem: k => { cache.delete(k); queue(k, null); },
    clear: () => { cache.forEach((_, k) => queue(k, null)); cache.clear(); },
    key: i => Array.from(cache.keys())[i] || null,
    get length() { return cache.size; },
    estimate: () => (navigator.storage && navigator.storage.estimate) ? navigator.storage.estimate() : Promise.resolve(null),
    flush
  };
  window.store = store;
  window.storeReady = (async function () {
    try {
      db = await open();
      await new Promise((res, rej) => {
        const os = db.transaction(ST).objectStore(ST), req = os.openCursor();
        req.onsuccess = () => { const c = req.result; if (c) { cache.set(c.key, c.value); c.continue(); } else res(); };
        req.onerror = () => rej(req.error);
      });
      // 一次性迁移旧的 localStorage 数据
      if (!cache.has('__migrated')) {
        try { for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); cache.set(k, localStorage.getItem(k)); queue(k, localStorage.getItem(k)); } } catch (e) {}
        cache.set('__migrated', '1'); queue('__migrated', '1'); flush();
      }
      if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {});
    } catch (e) {
      // IndexedDB 不可用时退回 localStorage
      try { for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); cache.set(k, localStorage.getItem(k)); } } catch (e2) {}
      store.setItem = (k, v) => { v = String(v); cache.set(k, v); try { localStorage.setItem(k, v); } catch (e3) { throw e3; } };
      store.removeItem = k => { cache.delete(k); try { localStorage.removeItem(k); } catch (e3) {} };
    }
  })();
})();
