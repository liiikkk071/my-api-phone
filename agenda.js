/* agenda.js —— 日程提醒（仿 iOS「提醒事项」）：今天 / 计划 / 全部 / 已完成、自建列表、重复、优先级、日历视图、到点提醒，可以让 TA 来提醒你 */
(function () {
    'use strict';
    const $ = (id) => document.getElementById(id), esc = (s) => escapeHtml(String(s == null ? '' : s));
    const KEY = 'agendaData', COLORS = ['#ff6b8b', '#ff9f43', '#f6c344', '#5fc58a', '#4aa8e8', '#8a7be0', '#c58a6b', '#8d94a0'];
    const REPEAT = { none: '不重复', day: '每天', week: '每周', month: '每月', year: '每年' }, PRI = ['无', '低', '中', '高'], WK = ['日', '一', '二', '三', '四', '五', '六'];
    const uid = () => 'a' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6), pad = (n) => String(n).padStart(2, '0');
    const ICO = {
        today: '<circle cx="12" cy="12" r="4"/><path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6L7 7M17 17l1.4 1.4M18.4 5.6L17 7M7 17l-1.4 1.4"/>',
        plan: '<rect x="4" y="5.5" width="16" height="14" rx="3"/><path d="M4 10h16M9 3.5v4M15 3.5v4"/>',
        all: '<path d="M5 7h14M5 12h14M5 17h14"/>',
        done: '<path d="M5 12.5l4.5 4.5L19 7"/>'
    };
    function D() {
        let d = null; try { d = JSON.parse(store.getItem(KEY) || 'null'); } catch (e) { }
        if (!d || !Array.isArray(d.items)) d = { lists: [{ id: 'l_def', name: '日常', color: COLORS[0] }, { id: 'l_life', name: '生活', color: COLORS[4] }, { id: 'l_work', name: '工作 / 学习', color: COLORS[1] }], items: [] };
        return d;
    }
    function S(d) { try { store.setItem(KEY, JSON.stringify(d)); } catch (e) { uiAlert('保存失败，空间不够了'); } }
    const T = () => todayStr();
    const listOf = (d, id) => d.lists.find(l => l.id === id) || d.lists[0];
    function nextDate(date, rep) {
        const p = date.split('-').map(Number); let y = p[0], m = p[1], dd = p[2];
        if (rep === 'day') return addDays(date, 1); if (rep === 'week') return addDays(date, 7);
        if (rep === 'month') { m++; if (m > 12) { m = 1; y++; } } else if (rep === 'year') y++;
        const last = new Date(y, m, 0).getDate(); return y + '-' + pad(m) + '-' + pad(Math.min(dd, last));
    }
    function dateLabel(date) {
        if (!date) return ''; const n = dayNum(date) - dayNum(T());
        if (n === 0) return '今天'; if (n === 1) return '明天'; if (n === 2) return '后天'; if (n === -1) return '昨天';
        const p = date.split('-').map(Number), w = new Date(p[0], p[1] - 1, p[2]).getDay();
        return (p[0] !== new Date().getFullYear() ? p[0] + '年' : '') + p[1] + '月' + p[2] + '日 周' + WK[w];
    }
    const dueTs = (it) => it.date ? new Date(it.date + 'T' + (it.time || '09:00') + ':00').getTime() : null;
    const overdue = (it) => !it.done && it.date && (it.date < T() || (it.date === T() && it.time && dueTs(it) < Date.now()));
    function smart(d, k) {
        const t = T(), a = d.items;
        if (k === 'today') return a.filter(i => !i.done && i.date && i.date <= t);
        if (k === 'plan') return a.filter(i => !i.done && i.date && i.date > t);
        if (k === 'all') return a.filter(i => !i.done);
        return a.filter(i => i.done);
    }
    const SM = { today: ['今天', '#4aa8e8'], plan: ['计划', '#ff6b8b'], all: ['全部', '#5a5f6b'], done: ['已完成', '#8d94a0'] };
    const cmp = (a, b) => (a.date || '9999').localeCompare(b.date || '9999') || (a.time || '').localeCompare(b.time || '') || (b.pri || 0) - (a.pri || 0);

    // ---------- 接入桌面 ----------
    try {
        if (allApps.indexOf('agenda') < 0) allApps.push('agenda');
        if (!HOME_APPS.some(a => a.id === 'agenda')) HOME_APPS.push({ id: 'agenda', name: '日程提醒', cls: 'agenda-icon', face: '(•̀ᴗ•́)و', go: () => openApp('agenda') });
        GLYPH.agenda = '<rect x="4.5" y="5" width="15" height="15" rx="3.5"/><path d="M8 3.5v3M16 3.5v3M8.5 13l2.3 2.3 4.7-4.8"/>';
    } catch (e) { }

    // 结构：底部 4 个固定页签 —— 今天（要做的）/ 日历（按日期看）/ 全部（按列表分组，管理列表）/ 已完成。
    // 每条提醒都明确属于一个列表；添加时一定能看到「放入哪个列表」。
    const TABS = [['today', '今天', 'today'], ['cal', '日历', 'plan'], ['all', '全部', 'all'], ['done', '已完成', 'done']];
    let view = { t: 'today', list: '' }, calY, calM, calSel, lastList = '';
    function ensure() {
        if ($('agendaApp')) return;
        const el = document.createElement('div'); el.id = 'agendaApp'; el.className = 'app-screen hidden'; el.style.position = 'absolute';
        el.innerHTML = '<div class="app-header"><button id="agBack">‹ 返回</button><span id="agTitle">日程提醒</span><button class="hdr-btn" id="agSet">设置</button></div><div class="scroll-area xa-body ag-body" id="agBody"></div><button class="xa-fab ag-fab" id="agFab">＋</button><div class="ag-tabs" id="agTabs"></div>';
        ($('callScreen') ? $('callScreen').parentElement : document.body).appendChild(el);
        $('agBack').onclick = () => goHome();
        $('agFab').onclick = () => editSheet(null);
        $('agSet').onclick = settings;
        $('agTabs').onclick = (e) => { const b = e.target.closest('[data-tab]'); if (!b) return; view.t = b.dataset.tab; if (view.t === 'cal' && !calY) { const n = new Date(); calY = n.getFullYear(); calM = n.getMonth(); calSel = T(); } render(); $('agBody').scrollTop = 0; };
        new MutationObserver(() => { if (!el.classList.contains('hidden')) { view = { t: 'today', list: '' }; const n = new Date(); calY = n.getFullYear(); calM = n.getMonth(); calSel = T(); render(); } }).observe(el, { attributes: true, attributeFilter: ['class'] });
    }
    function sheet(html) {
        const app = $('agendaApp'), m = document.createElement('div'); m.className = 'xa-mask'; m.innerHTML = '<div class="xa-sheet">' + html + '</div>';
        m.addEventListener('mousedown', (e) => { if (e.target === m) m.remove(); }); app.appendChild(m); return m;
    }
    function render() {
        const d = D(), body = $('agBody'); if (!body) return;
        const cnt = { today: smart(d, 'today').length, cal: 0, all: smart(d, 'all').length, done: 0 };
        $('agTabs').innerHTML = TABS.map(t => '<button data-tab="' + t[0] + '" class="' + (view.t === t[0] ? 'on' : '') + '"><svg viewBox="0 0 24 24">' + ICO[t[2]] + '</svg><span>' + t[1] + '</span>' + (cnt[t[0]] ? '<i>' + (cnt[t[0]] > 99 ? '99+' : cnt[t[0]]) + '</i>' : '') + '</button>').join('');
        $('agTitle').textContent = '日程提醒';
        $('agFab').style.display = '';
        if (view.t === 'cal') return cal(d, body);
        if (view.t === 'all') return allView(d, body);
        if (view.t === 'done') return doneView(d, body);
        return todayView(d, body);
    }
    // 添加条：输入 + 明确选「放入哪个列表」
    function quickBar(d, defDate) {
        const cur = d.lists.some(l => l.id === (view.list || lastList)) ? (view.list || lastList) : d.lists[0].id;
        return '<div class="ag-quick"><input id="agQ" placeholder="写下一件事，回车添加" maxlength="60"><button id="agQb">添加</button></div><div class="ag-into">放入列表：<select id="agQl">' + d.lists.map(l => '<option value="' + l.id + '"' + (l.id === cur ? ' selected' : '') + '>' + esc(l.name) + '</option>').join('') + '</select>' + (defDate ? '<span class="ag-tag">日期：' + dateLabel(defDate) + '</span>' : '<span class="ag-tag">不设日期</span>') + '</div>';
    }
    function bindQuick(defDate) {
        const q = $('agQ'); if (!q) return;
        const add = () => { const v = q.value.trim(); if (!v) return; const dd = D(), lid = $('agQl').value; lastList = lid; dd.items.push({ id: uid(), title: v, note: '', date: defDate || '', time: '', repeat: 'none', pri: 0, list: lid, done: false, ta: false }); S(dd); const nm = listOf(dd, lid).name; render(); uiAlert('已放入「' + nm + '」', 1200); };
        q.onkeydown = (e) => { if (e.key === 'Enter') add(); }; $('agQb').onclick = add;
    }
    function todayView(d, body) {
        const od = smart(d, 'today').filter(i => i.date < T()).sort(cmp), td = smart(d, 'today').filter(i => i.date === T()).sort(cmp);
        const soon = d.items.filter(i => !i.done && i.date && i.date > T() && dayNum(i.date) - dayNum(T()) <= 7).sort(cmp), nod = d.items.filter(i => !i.done && !i.date).sort(cmp);
        const total = od.length + td.length;
        let h = '<div class="ag-sum"><div><b>' + total + '</b><span>今天要做</span></div><div class="' + (od.length ? 'od' : '') + '"><b>' + od.length + '</b><span>已过期</span></div><div><b>' + soon.length + '</b><span>7 天内</span></div><div><b>' + nod.length + '</b><span>没定日期</span></div></div>';
        h += quickBar(d, T());
        if (od.length) h += '<div class="ag-grp" style="color:#e0556b">已过期 · 先处理这些</div>' + od.map(i => itemRow(d, i)).join('');
        h += '<div class="ag-grp">今天（' + td.length + '）</div>' + (td.length ? td.map(i => itemRow(d, i)).join('') : '<div class="xa-empty" style="padding:14px">' + (od.length ? '今天还没有新的安排' : '今天没有待办，轻松一下吧') + '</div>');
        if (soon.length) h += '<div class="ag-grp">接下来 7 天</div>' + soon.slice(0, 8).map(i => itemRow(d, i)).join('') + (soon.length > 8 ? '<div class="ag-more" data-go="cal">还有 ' + (soon.length - 8) + ' 条，去日历查看 ›</div>' : '');
        if (nod.length) h += '<div class="ag-grp">没定日期</div>' + nod.slice(0, 5).map(i => itemRow(d, i)).join('') + (nod.length > 5 ? '<div class="ag-more" data-go="all">还有 ' + (nod.length - 5) + ' 条，去「全部」查看 ›</div>' : '');
        body.innerHTML = h; bindItems(body); bindQuick(T());
        body.querySelectorAll('[data-go]').forEach(e => e.onclick = () => { view.t = e.dataset.go; if (view.t === 'cal' && !calY) { const n = new Date(); calY = n.getFullYear(); calM = n.getMonth(); calSel = T(); } render(); });
    }
    function itemRow(d, it, color) {
        const l = listOf(d, it.list), when = it.date ? dateLabel(it.date) + (it.time ? ' ' + it.time : '') : '', od = overdue(it);
        return '<div class="ag-it' + (it.done ? ' done' : '') + '" style="--lc:' + (color || l.color) + '" data-id="' + it.id + '"><button class="ag-chk' + (it.done ? ' on' : '') + '" data-chk="' + it.id + '"></button><div class="mid" data-edit="' + it.id + '"><div class="tt">' + (it.pri ? '<b style="color:' + l.color + '">' + '!'.repeat(it.pri) + '</b> ' : '') + esc(it.title) + '</div>' + (it.note ? '<div class="sub">' + esc(it.note.slice(0, 40)) + '</div>' : '') + '<div class="sub' + (od ? ' od' : '') + '"><span class="ag-ltag" style="background:' + l.color + '22;color:' + l.color + '">' + esc(l.name) + '</span>' + [when, it.repeat && it.repeat !== 'none' ? REPEAT[it.repeat] : '', it.ta ? 'TA提醒' : ''].filter(Boolean).map(x => ' · ' + x).join('') + '</div></div></div>';
    }
    function bindItems(body) {
        body.querySelectorAll('[data-chk]').forEach(b => b.onclick = (e) => { e.stopPropagation(); toggle(b.dataset.chk); });
        body.querySelectorAll('[data-edit]').forEach(b => b.onclick = () => editSheet(b.dataset.edit));
    }
    function allView(d, body) {
        const f = view.list && d.lists.some(l => l.id === view.list) ? view.list : '';
        let h = '<div class="ag-chips"><button data-f="" class="' + (f ? '' : 'on') + '">全部 ' + d.items.filter(i => !i.done).length + '</button>' + d.lists.map(l => '<button data-f="' + l.id + '" class="' + (f === l.id ? 'on' : '') + '" style="--lc:' + l.color + '"><i style="background:' + l.color + '"></i>' + esc(l.name) + ' ' + d.items.filter(i => i.list === l.id && !i.done).length + '</button>').join('') + '<button data-newl="1" class="add">＋ 新列表</button></div>';
        view.list = f; h += quickBar(d, '');
        const lists = f ? d.lists.filter(l => l.id === f) : d.lists;
        lists.forEach(l => {
            const a = d.items.filter(i => i.list === l.id && !i.done).sort(cmp);
            h += '<div class="ag-grp ag-lh" style="color:' + l.color + '"><span>' + esc(l.name) + '（' + a.length + '）</span><em data-el="' + l.id + '">编辑列表</em></div>' + (a.length ? a.map(i => itemRow(d, i)).join('') : '<div class="xa-empty" style="padding:12px">这个列表还没有事项</div>');
        });
        body.innerHTML = h; bindItems(body); bindQuick('');
        body.querySelectorAll('[data-f]').forEach(e => e.onclick = () => { view.list = e.dataset.f; render(); });
        body.querySelectorAll('[data-el]').forEach(e => e.onclick = () => listSheet(e.dataset.el));
        body.querySelector('[data-newl]').onclick = () => listSheet(null);
    }
    function doneView(d, body) {
        const items = d.items.filter(i => i.done).sort((a, b) => (b.doneAt || 0) - (a.doneAt || 0));
        let h = '<div class="ag-h"><h2>已完成</h2>' + (items.length ? '<button class="hdr-btn" id="agClear">清空</button>' : '') + '</div>';
        h += items.length ? '<p class="ag-note">点左边的圆圈可以恢复成待办。</p>' + items.map(i => itemRow(d, i)).join('') : '<div class="xa-empty">还没有完成的事项</div>';
        body.innerHTML = h; bindItems(body); $('agFab').style.display = 'none';
        if ($('agClear')) $('agClear').onclick = async () => { if (!(await uiConfirm('清空所有已完成事项吗？'))) return; const dd = D(); dd.items = dd.items.filter(i => !i.done); S(dd); render(); };
    }
    function cal(d, body) {
        const first = new Date(calY, calM, 1).getDay(), dim = new Date(calY, calM + 1, 0).getDate(), pm = new Date(calY, calM, 0).getDate();
        const has = {}; d.items.forEach(i => { if (i.date && !i.done) has[i.date] = 1; });
        let cells = '', i;
        for (i = 0; i < first; i++) cells += '<div class="d o">' + (pm - first + 1 + i) + '</div>';
        for (i = 1; i <= dim; i++) { const ds = calY + '-' + pad(calM + 1) + '-' + pad(i); cells += '<div class="d' + (ds === T() ? ' td' : '') + (ds === calSel ? ' sel' : '') + '" data-d="' + ds + '">' + i + (has[ds] ? '<i></i>' : '') + '</div>'; }
        let h = '<div class="ag-cal"><div class="hd"><button id="agPm">‹</button><span>' + calY + '年' + (calM + 1) + '月</span><button id="agNm">›</button></div><div class="g">' + WK.map(w => '<div class="w">' + w + '</div>').join('') + cells + '</div></div>';
        const day = d.items.filter(x => x.date === calSel).sort(cmp);
        h += '<div class="ag-grp">' + dateLabel(calSel) + '（' + day.length + '）</div>' + (day.length ? day.map(x => itemRow(d, x)).join('') : '<div class="xa-empty" style="padding:18px">这天没有安排</div>');
        h += quickBar(d, calSel);
        body.innerHTML = h; bindItems(body); bindQuick(calSel);
        $('agPm').onclick = () => { calM--; if (calM < 0) { calM = 11; calY--; } render(); }; $('agNm').onclick = () => { calM++; if (calM > 11) { calM = 0; calY++; } render(); };
        body.querySelectorAll('[data-d]').forEach(e => e.onclick = () => { calSel = e.dataset.d; render(); });
    }
    function toggle(id) {
        const d = D(), it = d.items.find(x => x.id === id); if (!it) return;
        if (!it.done && it.repeat && it.repeat !== 'none' && it.date) { it.date = nextDate(it.date, it.repeat); it.fired = ''; uiAlert('已完成，下一次：' + dateLabel(it.date), 1800); }
        else { it.done = !it.done; it.doneAt = it.done ? Date.now() : 0; }
        S(d); render();
    }
    function editSheet(id) {
        const d = D(), it = id ? d.items.find(x => x.id === id) : null, c = getChar(getActiveCharId());
        const dl = d.lists.some(l => l.id === (view.list || lastList)) ? (view.list || lastList) : d.lists[0].id;
        const x = it || { title: '', note: '', date: view.t === 'today' ? T() : view.t === 'cal' ? calSel : '', time: '', repeat: 'none', pri: 0, list: dl, ta: false };
        const opt = (o, cur) => Object.keys(o).map(k => '<option value="' + k + '"' + (String(cur) === String(k) ? ' selected' : '') + '>' + o[k] + '</option>').join('');
        const m = sheet('<h3>' + (it ? '编辑提醒' : '新提醒') + '</h3>'
            + '<div class="xa-row"><input id="aeT" style="text-align:left;max-width:100%;width:100%;font-size:16px" placeholder="标题" value="' + esc(x.title) + '"></div>'
            + '<div class="xa-row"><span>放入列表</span><select id="aeL">' + d.lists.map(l => '<option value="' + l.id + '"' + (l.id === x.list ? ' selected' : '') + '>' + esc(l.name) + '</option>').join('') + '</select></div>'
            + '<div class="xa-row"><textarea id="aeN" placeholder="备注" style="width:100%;border:none;background:transparent;color:var(--text-main);font-size:14px;outline:none;min-height:54px;resize:none;font-family:inherit">' + esc(x.note) + '</textarea></div>'
            + '<div class="xa-row"><span>日期</span><input type="date" id="aeD" value="' + esc(x.date) + '"></div>'
            + '<div class="xa-row"><span>时间</span><input type="time" id="aeTm" value="' + esc(x.time) + '"></div>'
            + '<div class="xa-row"><span>重复</span><select id="aeR">' + opt(REPEAT, x.repeat || 'none') + '</select></div>'
            + '<div class="xa-row"><span>优先级</span><select id="aeP">' + opt(PRI, x.pri || 0) + '</select></div>'
            + '<div class="xa-row"><span>' + (c ? '让 ' + esc(c.name) + ' 来提醒我' : '让 TA 来提醒我') + '</span><input type="checkbox" id="aeTa" class="ios-switch"' + (x.ta ? ' checked' : '') + '></div>'
            + '<div class="xa-btns">' + (it ? '<button class="dan" id="aeDel">删除</button>' : '') + '<button id="aeCancel">取消</button><button class="pri" id="aeOk">保存</button></div>');
        const g = (i) => m.querySelector('#' + i);
        g('aeCancel').onclick = () => m.remove();
        if (it) g('aeDel').onclick = async () => { if (!(await uiConfirm('删除这条提醒？'))) return; const dd = D(); dd.items = dd.items.filter(z => z.id !== id); S(dd); m.remove(); render(); };
        g('aeOk').onclick = () => {
            const t = g('aeT').value.trim(); if (!t) { uiAlert('写个标题吧'); return; }
            const dd = D(), o = { title: t, note: g('aeN').value.trim(), date: g('aeD').value, time: g('aeD').value ? g('aeTm').value : '', repeat: g('aeR').value, pri: +g('aeP').value, list: g('aeL').value, ta: g('aeTa').checked };
            if (g('aeTa').checked && typeof Notification !== 'undefined' && Notification.permission === 'default') { try { Notification.requestPermission(); } catch (e) { } }
            if (it) { const z = dd.items.find(q => q.id === id); Object.assign(z, o, { fired: '' }); } else dd.items.push(Object.assign({ id: uid(), done: false }, o));
            lastList = o.list; S(dd); m.remove(); render();
        };
        setTimeout(() => { if (!it) g('aeT').focus(); }, 80);
    }
    function listSheet(id) {
        const d = D(), l = id ? d.lists.find(x => x.id === id) : null; let col = l ? l.color : COLORS[3];
        const m = sheet('<h3>' + (l ? '编辑列表' : '新建列表') + '</h3><div class="xa-row"><input id="alN" style="text-align:left;max-width:100%;width:100%;font-size:16px" placeholder="列表名称" value="' + esc(l ? l.name : '') + '"></div><div class="cd-colors" id="alC">' + COLORS.map(c => '<i data-c="' + c + '" style="background:' + c + '"' + (c === col ? ' class="on"' : '') + '></i>').join('') + '</div><div class="xa-btns">' + (l && d.lists.length > 1 ? '<button class="dan" id="alDel">删除</button>' : '') + '<button id="alCancel">取消</button><button class="pri" id="alOk">保存</button></div>');
        m.querySelectorAll('#alC i').forEach(i => i.onclick = () => { col = i.dataset.c; m.querySelectorAll('#alC i').forEach(z => z.classList.toggle('on', z === i)); });
        m.querySelector('#alCancel').onclick = () => m.remove();
        if (l && d.lists.length > 1) m.querySelector('#alDel').onclick = async () => { if (!(await uiConfirm('删除列表「' + l.name + '」？里面的提醒也会一起删除'))) return; const dd = D(); dd.lists = dd.lists.filter(x => x.id !== id); dd.items = dd.items.filter(x => x.list !== id); S(dd); m.remove(); view.list = ''; render(); };
        m.querySelector('#alOk').onclick = () => { const n = m.querySelector('#alN').value.trim(); if (!n) { uiAlert('给列表起个名字'); return; } const dd = D(); if (l) { const z = dd.lists.find(x => x.id === id); z.name = n; z.color = col; } else { const nl = { id: uid(), name: n, color: col }; dd.lists.push(nl); view.list = nl.id; lastList = nl.id; } S(dd); m.remove(); render(); };
    }
    function settings() {
        const perm = typeof Notification === 'undefined' ? '当前浏览器不支持' : Notification.permission === 'granted' ? '已开启' : Notification.permission === 'denied' ? '已被浏览器拒绝' : '未开启';
        const m = sheet('<h3>提醒设置</h3><div class="xa-row"><span>系统通知</span><b style="font-size:13px;font-weight:500">' + perm + '</b></div><p style="font-size:12px;color:var(--text-sub);line-height:1.7;margin:4px 4px 10px">小手机是网页，所以只有「小手机打开着」时才会在到点时弹出提醒（页面里的横幅 + 系统通知）。如果勾了「让 TA 来提醒我」，TA 会用自己的口吻发消息提醒你，也会出现在微信聊天里。</p><div class="xa-btns"><button id="stNt">开启系统通知</button><button class="pri" id="stOk">好的</button></div>');
        m.querySelector('#stOk').onclick = () => m.remove();
        m.querySelector('#stNt').onclick = () => { if (typeof Notification === 'undefined') { uiAlert('这个浏览器不支持系统通知'); return; } Notification.requestPermission().then(p => { uiAlert(p === 'granted' ? '系统通知已开启' : '没有开启成功，请在浏览器设置里允许通知'); m.remove(); }); };
    }

    // ---------- 到点提醒 ----------
    async function fire(it) {
        const msg = '提醒：' + it.title + (it.time ? '（' + it.time + '）' : '');
        let sent = false;
        if (it.ta) {
            const c = getChar(getActiveCharId());
            if (c) {
                let text = '到点啦，「' + it.title + '」，别忘了哦～';
                if (typeof API_KEY !== 'undefined' && API_KEY) { try { text = oneLine(await callPersona(c.id, timeContext() + '\n现在到了我设的提醒：「' + it.title + '」' + (it.note ? '（备注：' + it.note + '）' : '') + '。请你用你自己的口吻，像真人一样提醒我去做这件事，一两句话，要带点关心。只输出这句话。', 1.0)) || text; } catch (e) { } }
                try { pushHistory(c.id, { role: 'assistant', content: text }); showBanner(c, text); sent = true; } catch (e) { }
            }
        }
        if (!sent) uiAlert('◔ ' + msg, 6000);
        try { if (typeof Notification !== 'undefined' && Notification.permission === 'granted') new Notification('日程提醒', { body: it.title + (it.note ? '\n' + it.note : '') }); } catch (e) { }
    }
    function tick() {
        try {
            const d = D(), now = Date.now(); let ch = false;
            d.items.forEach(it => {
                if (it.done || !it.date) return; const ts = dueTs(it), key = it.date + ' ' + (it.time || ''); if (it.fired === key || ts > now) return;
                it.fired = key; ch = true; if (now - ts < 6 * 3600 * 1000) fire(it);
            });
            if (ch) { S(d); const a = $('agendaApp'); if (a && !a.classList.contains('hidden')) render(); }
        } catch (e) { }
    }
    ensure(); setInterval(tick, 15000); setTimeout(tick, 2500);
    window.AGENDA = { count: () => smart(D(), 'today').length };
})();
