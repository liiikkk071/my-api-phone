/* home.js —— 桌面：编辑模式（拖动排列 / 调整组件大小）+ 奶油风手写点缀 */
(function () {
    'use strict';
    const $ = (id) => document.getElementById(id), desk = $('desktop'); if (!desk) return;
    const Z = ['s', 'half', 'wide'], ZL = { s: '小', half: '中', wide: '大' };
    const D = { cloud: 'M6 17h11a3.5 3.5 0 0 0 .4-7A5 5 0 0 0 8 9.4 4 4 0 0 0 6 17z', heart: 'M12 19s-6.5-3.9-6.5-8.6A3.4 3.4 0 0 1 12 8.5a3.4 3.4 0 0 1 6.5 1.9C18.5 15.1 12 19 12 19z', star: 'M12 4l2.1 5 5.4.4-4.1 3.5 1.3 5.3L12 15.4 7.3 18.2l1.3-5.3L4.5 9.4 9.9 9z' };
    let editing = false, dr = null, last = null;
    const origOpenEdit = window.openHomeEdit, origRender = window.renderHome;

    // ---------- 渲染包装 ----------
    window.renderHome = function () {
        if (dr && dr.on) return;
        origRender();
        if (desk.classList.contains('cream')) cream();
        dots();
        if (editing) decorate();
    };
    function hello() {
        const h = new Date().getHours();
        return h < 5 ? '夜深啦，早点睡觉 (￣ρ￣)..zzZ' : h < 11 ? '早安，今天也要元气满满 (๑•̀ㅂ•́)و✧' : h < 14 ? '午安～记得好好吃饭 (｡･ω･｡)' : h < 18 ? '下午好，来杯热茶吧 (˘▾˘)' : h < 23 ? '晚上好，今天辛苦啦 (੭ˊᵕˋ)੭' : '该睡觉啦，晚安 (ᴗ_ᴗ)';
    }
    function doodle(kind, style) { return '<svg class="cr-doodle" viewBox="0 0 24 24" style="' + style + '"><path d="' + D[kind] + '"/></svg>'; }
    function cream() { desk.querySelectorAll('.cr-hello,.cr-doodle').forEach(n => n.remove()); }
    function hide(on) { const h = desk.querySelector('.cr-hello'); if (h) h.style.display = on ? 'none' : ''; }


    // ---------- 多页：页点 / 切页 / 增删页 ----------
    function go(n) {
        const h = getHome(), t = Math.max(0, Math.min(h.pages - 1, n)); if (t === (window.homePage || 0)) return;
        const dir = t > (window.homePage || 0) ? 1 : -1; window.homePage = t; const g = $('desktopGrid');
        g.style.transition = 'none'; g.style.transform = 'translateX(' + (dir * 40) + 'px)'; g.style.opacity = '0';
        window.renderHome(); void g.offsetWidth; g.style.transition = 'transform .25s ease,opacity .25s ease'; g.style.transform = ''; g.style.opacity = '';
    }
    function dots() {
        const h = getHome(); let d = $('hmDots');
        if (!d) { d = document.createElement('div'); d.id = 'hmDots'; d.className = 'hm-dots'; desk.insertBefore(d, $('desktopDock')); d.addEventListener('click', (e) => { const b = e.target.closest('[data-pg]'); if (b) go(+b.dataset.pg); else if (e.target.closest('.hm-addpg')) addPage(); }); }
        let o = ''; for (let i = 0; i < h.pages; i++) o += '<i class="hm-dot' + (i === (window.homePage || 0) ? ' on' : '') + '" data-pg="' + i + '"></i>';
        if (editing) o += '<b class="hm-addpg">＋</b>';
        d.innerHTML = o; d.style.visibility = (h.pages > 1 || editing) ? 'visible' : 'hidden';
        const del = $('hmDelPg'); if (del) del.style.display = h.pages > 1 ? '' : 'none';
    }
    function addPage() { const h = getHome(); if (h.pages >= 6) { uiAlert('最多 6 页'); return; } h.pages++; saveHome(h); window.homePage = h.pages - 1; window.renderHome(); }
    function delPage() {
        const h = getHome(); if (h.pages <= 1) return; const p = window.homePage || 0;
        uiConfirm('删除这一页吗？页面上的内容会移到前一页。').then(ok => { if (!ok) return; const hh = getHome(); hh.items.forEach(i => { if (i.page === p) i.page = Math.max(0, p - 1); else if (i.page > p) i.page--; }); hh.pages--; saveHome(hh); window.homePage = Math.max(0, p - 1); window.renderHome(); });
    }
    // 左右滑动切页（非编辑模式）：手指跟着走，松手后超过一定距离就翻页
    (function () {
        let sx = 0, sy = 0, on = false, lock = 0; const g = () => $('desktopGrid');
        const begin = (x, y, tgt) => { if (editing || (tgt && tgt.closest && tgt.closest('#hmFolder,#hmBar,.dock'))) return; sx = x; sy = y; on = true; lock = 0; };
        const move = (x, y) => {
            if (!on) return; const dx = x - sx, dy = y - sy;
            if (!lock && Math.hypot(dx, dy) > 10) lock = Math.abs(dx) > Math.abs(dy) * 1.2 ? 1 : 2;
            if (lock === 1) { const h = getHome(), p = window.homePage || 0, edge = (dx > 0 && p === 0) || (dx < 0 && p >= h.pages - 1); g().style.transition = 'none'; g().style.transform = 'translateX(' + (dx * (edge ? .18 : .55)) + 'px)'; }
        };
        const end = (x, y) => {
            if (!on) return; on = false; const dx = x - sx, dy = y - sy; g().style.transition = 'transform .2s ease'; g().style.transform = '';
            if (lock === 1 && Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.3) go((window.homePage || 0) + (dx < 0 ? 1 : -1));
        };
        desk.addEventListener('touchstart', (e) => { const p = e.touches[0]; begin(p.clientX, p.clientY, e.target); }, { passive: true });
        desk.addEventListener('touchmove', (e) => { const p = e.touches[0]; move(p.clientX, p.clientY); if (lock === 1 && e.cancelable) e.preventDefault(); }, { passive: false });
        desk.addEventListener('touchend', (e) => { const p = e.changedTouches[0]; end(p.clientX, p.clientY); }, { passive: true });
        desk.addEventListener('touchcancel', () => { on = false; g().style.transform = ''; }, { passive: true });
        desk.addEventListener('pointerdown', (e) => { if (e.pointerType === 'mouse') begin(e.clientX, e.clientY, e.target); });
        desk.addEventListener('pointermove', (e) => { if (e.pointerType === 'mouse' && on) move(e.clientX, e.clientY); });
        desk.addEventListener('pointerup', (e) => { if (e.pointerType === 'mouse') end(e.clientX, e.clientY); });
        desk.addEventListener('wheel', (e) => { if (editing || Math.abs(e.deltaX) < 30) return; go((window.homePage || 0) + (e.deltaX > 0 ? 1 : -1)); }, { passive: true });
    })();
    // ---------- 状态栏：信号 / Wi-Fi / 电量 ----------
    (function () {
        const el = document.querySelector('.status-bar .status-icons'); if (!el) return;
        let lvl = 0.86, chg = false;
        const draw = () => { el.innerHTML = '<svg class="sb-ic" width="18" height="12" viewBox="0 0 18 12" fill="currentColor"><rect x="0" y="8" width="3" height="4" rx="1"/><rect x="5" y="5.5" width="3" height="6.5" rx="1"/><rect x="10" y="3" width="3" height="9" rx="1"/><rect x="15" y="0" width="3" height="12" rx="1"/></svg>'
            + '<svg class="sb-ic" width="17" height="12" viewBox="0 0 17 12" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"><path d="M1 4.2a11 11 0 0 1 15 0M3.6 7a7 7 0 0 1 9.8 0"/><circle cx="8.5" cy="10" r="1.2" fill="currentColor" stroke="none"/></svg>'
            + '<span class="sb-bat"><i style="width:' + Math.max(8, Math.round(lvl * 100)) + '%"></i></span>' + (chg ? '<small>⚡</small>' : '') + '<span class="sb-pct">' + Math.round(lvl * 100) + '</span>'; };
        draw();
        if (navigator.getBattery) navigator.getBattery().then(b => { const u = () => { lvl = b.level; chg = b.charging; draw(); }; u(); b.addEventListener('levelchange', u); b.addEventListener('chargingchange', u); }).catch(() => {});
    })();

    // ---------- 编辑模式 ----------
    function bar() {
        let b = $('hmBar');
        if (!b) {
            b = document.createElement('div'); b.id = 'hmBar'; b.className = 'hm-bar hidden';
            b.innerHTML = '<span>拖动排列 · 叠到另一个图标上合并成文件夹 · 拖到屏幕边缘换页</span><button id="hmDelPg">删本页</button><button id="hmMore">更多</button><button id="hmDone">完成</button>';
            desk.appendChild(b); $('hmDone').onclick = exit; $('hmDelPg').onclick = delPage; $('hmMore').onclick = () => { exit(); origOpenEdit(); };
        }
        return b;
    }
    function enter() { if (desk.classList.contains('hidden')) { origOpenEdit(); return; } editing = true; desk.classList.add('editing'); bar().classList.remove('hidden'); window.renderHome(); }
    function exit() { editing = false; dr = null; desk.classList.remove('editing'); bar().classList.add('hidden'); window.renderHome(); }
    window.openHomeEdit = enter;
    new MutationObserver(() => { if (editing && desk.classList.contains('hidden')) { editing = false; desk.classList.remove('editing'); bar().classList.add('hidden'); } }).observe(desk, { attributes: true, attributeFilter: ['class'] });

    function decorate() {
        desk.querySelectorAll('.hw[data-w]').forEach(el => { const it = (getHome().items.find(x => x.id === el.dataset.w)) || {}; el.insertAdjacentHTML('beforeend', '<button class="hm-x" data-act="del">✕</button>' + (it.kind === 'photo' ? '' : '<button class="hm-sz" data-act="size">' + ZL[it.size || 'half'] + ' ⤢</button>')); });
        $('desktopGrid').querySelectorAll('.app-icon').forEach(el => el.insertAdjacentHTML('beforeend', '<button class="hm-x" data-act="hide">−</button>'));
        $('desktopDock').querySelectorAll('.dock-icon').forEach(el => el.insertAdjacentHTML('beforeend', '<button class="hm-x" data-act="undock">−</button>'));
    }
    desk.addEventListener('click', (e) => {
        if (!editing || e.target.closest('#hmBar,#hmDots,#hmFolder')) return;
        e.stopPropagation(); e.preventDefault();
        const fo0 = e.target.closest('[data-fo]');
        if (fo0 && !e.target.closest('.hm-x')) { if (window.HOMEFOLDER) HOMEFOLDER.open(fo0.dataset.fo, true); return; }
        const b = e.target.closest('.hm-x,.hm-sz'); if (!b) return;
        if (fo0) { if (window.HOMEFOLDER) HOMEFOLDER.dissolve(fo0.dataset.fo); return; }
        const item = b.closest('[data-app],[data-w]'); if (!item) return;
        const id = item.dataset.app || item.dataset.w, h = getHome(), act = b.dataset.act, it = h.items.find(x => x.id === id);
        if (act === 'size' && it) { const i = Z.indexOf(it.size || 'half'); it.size = Z[(i + 1) % 3]; }
        else if (act === 'del') { uiConfirm('删除这个小组件吗？').then(ok => { if (!ok) return; const hh = getHome(); hh.items = hh.items.filter(x => x.id !== id); saveHome(hh); window.renderHome(); }); return; }
        else if (act === 'hide') { if (!h.hidden.includes(id)) h.hidden.push(id); }
        else if (act === 'undock') { h.dock = h.dock.filter(x => x !== id); }
        saveHome(h); window.renderHome();
    }, true);

    // ---------- 拖动排列 ----------
    desk.addEventListener('pointerdown', (e) => {
        if (!editing || e.target.closest('.hm-x,.hm-sz,#hmBar,#hmFolder')) return;
        const el = e.target.closest('[data-app],[data-w],[data-fo]'); if (!el) return;
        dr = { el, id: el.dataset.app || el.dataset.w || el.dataset.fo, app: !!el.dataset.app, fo: !!el.dataset.fo, dock: !!el.closest('#desktopDock'), sx: e.clientX, sy: e.clientY, on: false, pid: e.pointerId };
        try { el.setPointerCapture(e.pointerId); } catch (_) {}
    });
    function aim(e) {
        dr.el.style.pointerEvents = 'none'; const x = document.elementFromPoint(e.clientX, e.clientY); dr.el.style.pointerEvents = '';
        if (!x) return null; const dt = x.closest('.hm-dot'); if (dt) return { dot: +dt.dataset.pg }; const it = x.closest('[data-app],[data-w],[data-fo]');
        if (it && it !== dr.el) {
            if (dr.app && (it.dataset.app || it.dataset.fo) && !it.closest('#desktopDock')) { const r = (it.querySelector('.icon-bg') || it).getBoundingClientRect(); if (e.clientX > r.left + r.width * .2 && e.clientX < r.right - r.width * .2 && e.clientY > r.top + r.height * .2 && e.clientY < r.bottom - r.height * .2) return { el: it, merge: true }; }
            return { el: it };
        } if (x.closest('#desktopDock')) return { dock: true }; if (x.closest('#desktopGrid')) return { grid: true }; return null;
    }
    function mark(t) { desk.querySelectorAll('.hm-over,.hm-merge').forEach(x => x.classList.remove('hm-over', 'hm-merge')); if (!t) return; if (t.el) t.el.classList.add(t.merge ? 'hm-merge' : 'hm-over'); else if (t.dot != null) { const d = desk.querySelector('.hm-dot[data-pg="' + t.dot + '"]'); if (d) d.classList.add('hm-over'); } else if (t.dock) $('desktopDock').classList.add('hm-over'); }
    desk.addEventListener('pointermove', (e) => {
        if (!dr) return; const dx = e.clientX - dr.sx, dy = e.clientY - dr.sy;
        if (!dr.on) { if (Math.hypot(dx, dy) < 8) return; dr.on = true; dr.el.classList.add('hm-drag'); }
        dr.el.style.transform = 'translate(' + dx + 'px,' + dy + 'px) scale(1.07)'; last = aim(e); mark(last); edge(e);
    });
    // 拖到屏幕左右边缘停一下，就翻到上一页 / 下一页，手里的图标跟着过去
    let edgeT = null, edgeDir = 0;
    function edge(e) {
        const r = desk.getBoundingClientRect(), dir = e.clientX < r.left + 26 ? -1 : e.clientX > r.right - 26 ? 1 : 0;
        if (dir === edgeDir) return; edgeDir = dir; clearTimeout(edgeT); if (!dir) return;
        edgeT = setTimeout(() => { edgeT = null; if (dr && dr.on && edgeDir === dir) flip(dir, e); }, 650);
    }
    function flip(dir, e) {
        const h = getHome(), cp = window.homePage || 0; let np = cp + dir; if (np >= h.pages && h.pages < 6 && dir > 0) { h.pages++; } np = Math.max(0, Math.min(h.pages - 1, np)); if (np === cp) return;
        const it = h.items.find(x => x.id === dr.id); if (!it) return; it.page = np; if (dr.dock) h.dock = h.dock.filter(x => x !== dr.id); saveHome(h); window.homePage = np;
        const keep = dr; dr = null; window.renderHome();
        const el = desk.querySelector('[data-app="' + keep.id + '"],[data-w="' + keep.id + '"],[data-fo="' + keep.id + '"]'); if (!el) return;
        const rc = el.getBoundingClientRect(); dr = { el, id: keep.id, app: keep.app, fo: keep.fo, dock: false, sx: rc.left + rc.width / 2, sy: rc.top + rc.height / 2, on: true, pid: keep.pid };
        el.classList.add('hm-drag'); el.style.transform = 'translate(' + (e.clientX - dr.sx) + 'px,' + (e.clientY - dr.sy) + 'px) scale(1.07)'; try { el.setPointerCapture(keep.pid); } catch (_) {}
        edgeDir = 0; uiAlert('第 ' + (np + 1) + ' 页', 700);
    }
    function finish(e) {
        clearTimeout(edgeT); edgeDir = 0;
        if (!dr) return; const d = dr, t = d.on ? aim(e) : null; mark(null);
        if (!d.on) { dr = null; return; }
        d.el.classList.remove('hm-drag'); d.el.style.transform = ''; dr = null; commit(d, t);
    }
    desk.addEventListener('pointerup', finish); desk.addEventListener('pointercancel', () => { if (dr) { dr.el.classList.remove('hm-drag'); dr.el.style.transform = ''; dr = null; mark(null); } });
    function mergeInto(h, d, t) {
        const tid = t.el.dataset.app || t.el.dataset.fo, isFo = !!t.el.dataset.fo, pg = window.homePage || 0;
        h.items = h.items.filter(x => !(x.t === 'a' && x.id === d.id)); h.dock = h.dock.filter(x => x !== d.id); h.hidden = h.hidden.filter(x => x !== d.id);
        if (isFo) { const f = h.items.find(x => x.id === tid && x.t === 'f'); if (f && f.apps.indexOf(d.id) < 0) { if (f.apps.length >= 12) { uiAlert('文件夹最多放 12 个应用'); return; } f.apps.push(d.id); } saveHome(h); window.renderHome(); uiAlert('已放进「' + ((f && f.name) || '文件夹') + '」', 1200); return; }
        const i = h.items.findIndex(x => x.t === 'a' && x.id === tid); if (i < 0) { saveHome(h); window.renderHome(); return; }
        const f = { t: 'f', id: 'fo' + Date.now().toString(36), name: '文件夹', apps: [tid, d.id], page: h.items[i].page || pg };
        h.items[i] = f; saveHome(h); window.renderHome();
        uiPrompt('给文件夹起个名字', '文件夹', { placeholder: '例如：我们的小日子' }).then(v => { const hh = getHome(), ff = hh.items.find(x => x.id === f.id); if (ff && v && v.trim()) { ff.name = v.trim().slice(0, 8); saveHome(hh); window.renderHome(); } });
    }
    function commit(d, t) {
        const h = getHome(); const inDock = (id) => h.dock.includes(id);
        const moveItem = (beforeId) => {
            const from = h.items.findIndex(x => x.id === d.id); if (from < 0) return; const item = h.items.splice(from, 1)[0];
            let to = h.items.findIndex(x => x.id === beforeId); if (to < 0) { h.items.push(item); return; }
            const origTo = to >= from ? to + 1 : to; h.items.splice(from < origTo ? to + 1 : to, 0, item);
        };
        if (t && t.merge && t.el && d.app) { mergeInto(h, d, t); return; }
        if (t && t.dot != null) { const it = h.items.find(x => x.id === d.id); if (it) { it.page = t.dot; if (d.dock) h.dock = h.dock.filter(x => x !== d.id); } window.homePage = t.dot; }
        else if (t && t.el) {
            const tid = t.el.dataset.app || t.el.dataset.w, tDock = !!t.el.closest('#desktopDock');
            if (d.dock && tDock) { const f = h.dock.indexOf(d.id); h.dock.splice(f, 1); h.dock.splice(h.dock.indexOf(tid), 0, d.id); }
            else if (!d.dock && tDock) { if (!d.app) uiAlert('组件不能放进 Dock'); else if (!inDock(d.id)) { if (h.dock.length >= 4) uiAlert('Dock 最多放 4 个'); else h.dock.splice(h.dock.indexOf(tid), 0, d.id); } }
            else if (d.dock && !tDock) { h.dock = h.dock.filter(x => x !== d.id); moveItem(tid); }
            else moveItem(tid);
            const cur = h.items.find(x => x.id === d.id); if (cur) cur.page = window.homePage || 0;
        } else if (t && t.dock && !d.dock) { if (!d.app) uiAlert('组件不能放进 Dock'); else if (h.dock.length >= 4) uiAlert('Dock 最多放 4 个'); else h.dock.push(d.id); }
        else if (t && t.grid && d.dock) h.dock = h.dock.filter(x => x !== d.id);
        saveHome(h); window.renderHome();
    }
    window.renderHome();
})();
