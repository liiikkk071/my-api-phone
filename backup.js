/* backup.js —— 数据备份 / 还原（设置页最上面）
 * 导出：把小手机里所有数据（角色、聊天、家园、地图、匿名匹配……）存成一个 JSON 文件；
 * 导入：完全还原 / 只补充缺少的；还会每天自动留一份本地快照（最近 3 天），误操作时可一键恢复。
 * API Key 默认不放进备份文件（发给别人/内测时更安全）。只新增，不改动其他功能。 */
(function () {
    'use strict';
    var SECRET = ['customApiKey'], LS_KEYS = ['xsj_boot', 'xsj_splash'], SNAP_DB = 'xsj-snap', SNAP_ST = 'snaps';
    function $(i) { return document.getElementById(i); }
    function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
    function toast(m, ms) { try { uiAlert(m, ms); } catch (e) { alert(m); } }
    function pad(n) { return ('0' + n).slice(-2); }
    function stamp(t) { var d = new Date(t || Date.now()); return d.getFullYear() + pad(d.getMonth() + 1) + pad(d.getDate()) + '-' + pad(d.getHours()) + pad(d.getMinutes()); }
    function collect(withKey) {
        var keys = {}, n = store.length, all = []; for (var i = 0; i < n; i++) all.push(store.key(i));
        all.forEach(function (k) { if (!k || k === '__migrated') return; if (!withKey && SECRET.indexOf(k) >= 0) return; var v = store.getItem(k); if (v != null) keys[k] = v; });
        var ls = {}; LS_KEYS.forEach(function (k) { try { var v = localStorage.getItem(k); if (v != null) ls[k] = v; } catch (e) {} });
        return { app: 'xsj-backup', ver: 2, ts: Date.now(), withKey: !!withKey, keys: keys, ls: ls };
    }
    function summary(b) { var c = []; try { c = JSON.parse(b.keys.characters || '[]'); } catch (e) {} var msgs = 0; c.forEach(function (x) { msgs += (x.chatHistory || []).length; }); return { chars: c.length, msgs: msgs, keys: Object.keys(b.keys || {}).length }; }
    function download(obj, name) {
        var blob = new Blob([JSON.stringify(obj)], { type: 'application/json' }), u = URL.createObjectURL(blob), a = document.createElement('a');
        a.href = u; a.download = name; document.body.appendChild(a); a.click(); a.remove(); setTimeout(function () { URL.revokeObjectURL(u); }, 4000);
    }
    function exportAll(withKey) {
        try { store.flush && store.flush(); var b = collect(withKey), s = summary(b); download(b, '凛凛机备份-' + stamp() + '.json'); store.setItem('lastBackupTs', String(Date.now())); toast('已导出：' + s.chars + ' 个角色、' + s.msgs + ' 条聊天记录。请把文件存到安全的地方（网盘/聊天文件传输助手）', 4500); paint(); }
        catch (e) { toast('导出失败：' + (e.message || e)); }
    }
    function apply(b, mode) {
        var keep = {}; SECRET.forEach(function (k) { var v = store.getItem(k); if (v != null) keep[k] = v; });
        if (mode === 'full') {
            store.clear();
            Object.keys(b.keys).forEach(function (k) { store.setItem(k, b.keys[k]); });
            SECRET.forEach(function (k) { if (b.keys[k] == null && keep[k] != null) store.setItem(k, keep[k]); });
            store.setItem('__migrated', '1');
            Object.keys(b.ls || {}).forEach(function (k) { try { localStorage.setItem(k, b.ls[k]); } catch (e) {} });
        } else {
            Object.keys(b.keys).forEach(function (k) {
                if (k === 'characters') { try { var cur = JSON.parse(store.getItem('characters') || '[]'), inc = JSON.parse(b.keys.characters || '[]'), ids = {}; cur.forEach(function (c) { ids[c.id] = 1; }); inc.forEach(function (c) { if (!ids[c.id]) cur.push(c); }); store.setItem('characters', JSON.stringify(cur)); } catch (e) {} return; }
                if (store.getItem(k) == null) store.setItem(k, b.keys[k]);
            });
        }
        store.flush && store.flush(); toast('还原完成，正在重新载入…', 1800); setTimeout(function () { location.reload(); }, 900);
    }
    function validate(b) { return b && b.app === 'xsj-backup' && b.keys && typeof b.keys === 'object'; }
    async function restore(b, from) {
        if (!validate(b)) { toast('这不是凛凛机的备份文件'); return; } var s = summary(b);
        var m = await uiChoose((from || '备份') + '（' + new Date(b.ts).toLocaleString() + '）包含 ' + s.chars + ' 个角色、' + s.msgs + ' 条聊天记录。怎么还原？', [{ label: '完全还原（替换现有数据）', v: 'full', primary: true }, { label: '只补充缺少的内容', v: 'merge' }, { label: '取消', v: null }]);
        if (!m) return;
        if (m === 'full') { var ok = await uiConfirm('会用备份替换现在的所有数据。为了保险，我会先自动下载一份「还原前的备份」，继续吗？', { ok: '继续还原', cancel: '取消' }); if (!ok) return; try { download(collect(true), '还原前自动备份-' + stamp() + '.json'); } catch (e) {} await new Promise(function (r) { setTimeout(r, 600); }); }
        apply(b, m);
    }
    function importFile(file) {
        var r = new FileReader(); r.onerror = function () { toast('文件读取失败'); };
        r.onload = function () { var b = null; try { b = JSON.parse(r.result); } catch (e) {} if (!b) { toast('这个文件打不开，请确认是凛凛机导出的 .json 备份'); return; } restore(b, '这份备份'); };
        r.readAsText(file);
    }

    // ---------- 每日本地快照（最近 3 天） ----------
    function snapOpen() { return new Promise(function (res, rej) { try { var r = indexedDB.open(SNAP_DB, 1); r.onupgradeneeded = function () { r.result.createObjectStore(SNAP_ST, { keyPath: 'day' }); }; r.onsuccess = function () { res(r.result); }; r.onerror = function () { rej(r.error); }; } catch (e) { rej(e); } }); }
    function snapAll(db) { return new Promise(function (res) { try { var q = db.transaction(SNAP_ST).objectStore(SNAP_ST).getAll(); q.onsuccess = function () { res((q.result || []).sort(function (a, b) { return b.ts - a.ts; })); }; q.onerror = function () { res([]); }; } catch (e) { res([]); } }); }
    async function snapshot() {
        try {
            if (window.storeReady) await window.storeReady; var chars = []; try { chars = JSON.parse(store.getItem('characters') || '[]'); } catch (e) {} if (!chars.length) return;
            var db = await snapOpen(), list = await snapAll(db), day = new Date().toDateString(); if (list.some(function (s) { return s.day === day; })) return;
            var b = collect(false), tx = db.transaction(SNAP_ST, 'readwrite'), os = tx.objectStore(SNAP_ST); os.put({ day: day, ts: Date.now(), json: JSON.stringify(b), chars: summary(b).chars });
            list.slice(2).forEach(function (s) { os.delete(s.day); });
        } catch (e) {}
    }
    async function listSnaps() { try { return await snapAll(await snapOpen()); } catch (e) { return []; } }

    // ---------- 设置页 ----------
    function daysAgo(ts) { if (!ts) return null; return Math.floor((Date.now() - ts) / 86400000); }
    function paint() {
        var box = $('bkSet'); if (!box) return; var last = Number(store.getItem('lastBackupTs') || 0), d = daysAgo(last);
        $('bkLast').textContent = last ? '上次导出：' + (d === 0 ? '今天' : d + ' 天前') + '（' + new Date(last).toLocaleDateString() + '）' : '你还没有导出过备份，建议现在导出一份';
        $('bkLast').style.color = (!last || d > 7) ? '#e0607e' : '';
        listSnaps().then(function (ls) { $('bkSnaps').innerHTML = ls.length ? ls.map(function (s, i) { return '<div class="bk-snap"><span>' + new Date(s.ts).toLocaleString() + ' · ' + s.chars + ' 个角色</span><button data-i="' + i + '">恢复</button></div>'; }).join('') : '<p class="hint-line">每天第一次打开会自动留一份快照，还没有。</p>'; $('bkSnaps').querySelectorAll('button').forEach(function (b) { b.onclick = function () { var s = ls[+b.dataset.i]; try { restore(JSON.parse(s.json), '自动快照'); } catch (e) { toast('这份快照读取失败'); } }; }); });
        try { store.estimate().then(function (e) { if (e && e.usage != null) $('bkUse').textContent = '已占用存储：' + (e.usage / 1048576).toFixed(1) + ' MB' + (e.quota ? ' / 约 ' + Math.round(e.quota / 1048576) + ' MB 可用' : ''); }); } catch (e) {}
    }
    function inject() {
        try {
            var app = $('settingsApp'); if (!app) return; var area = app.querySelector('.scroll-area'); if (!area || $('bkSet')) return;
            var box = document.createElement('div'); box.id = 'bkSet';
            box.innerHTML = '<p class="section-title">数据备份与还原</p><p class="hint-line" id="bkLast" style="margin:4px 2px"></p><p class="hint-line" id="bkUse" style="margin:0 2px 6px"></p>'
                + '<div class="cell-group"><div class="cell-item"><span>备份文件里包含 API Key</span><input type="checkbox" id="bkKey" class="ios-switch"></div></div>'
                + '<div class="bk-row"><button class="btn-primary" id="bkExp" style="margin:0">导出备份文件</button><button class="btn-secondary" id="bkImp" style="margin:0">导入备份</button></div><input type="file" id="bkFile" accept=".json,application/json" style="display:none">'
                + '<p class="hint-line">备份包含所有角色、聊天记录、家园、地图、匿名匹配等数据。换设备、清缓存、更新前都建议先导出。不勾选 API Key 时，备份可以放心分享给别人。</p>'
                + '<div class="bs-lab" style="font-size:12px;color:var(--text-sub);margin:8px 2px 4px">自动快照（本机，最近 3 天）</div><div id="bkSnaps"></div>';
            var ref = area.querySelector('.section-title'); while (ref && ref.parentNode !== area) ref = ref.parentNode; area.insertBefore(box, ref || area.firstChild);
            $('bkExp').onclick = function () { exportAll($('bkKey').checked); }; $('bkImp').onclick = function () { $('bkFile').click(); };
            $('bkFile').onchange = function () { var f = this.files && this.files[0]; if (f) importFile(f); this.value = ''; };
            paint();
        } catch (e) {}
    }
    var obs = null; try { obs = new MutationObserver(function () { var a = $('settingsApp'); if (a && !a.classList.contains('hidden')) paint(); }); document.addEventListener('DOMContentLoaded', function () { var a = $('settingsApp'); if (a) obs.observe(a, { attributes: true, attributeFilter: ['class'] }); }); } catch (e) {}
    document.addEventListener('DOMContentLoaded', inject); setTimeout(inject, 1500); setTimeout(inject, 4000);
    // 提醒：超过 7 天没导出
    setTimeout(function () {
        try { var chars = JSON.parse(store.getItem('characters') || '[]'); if (!chars.length) return; var last = Number(store.getItem('lastBackupTs') || 0), today = new Date().toDateString(); if (store.getItem('bkNudge') === today) return; if (!last || Date.now() - last > 7 * 86400000) { store.setItem('bkNudge', today); toast('已经有一阵子没备份啦，去「设置」最上面导出一份吧', 4500); } } catch (e) {}
    }, 9000);
    inject(); setTimeout(snapshot, 6000);
    window.xsjBackup = { export: exportAll, snapshot: snapshot };
})();
