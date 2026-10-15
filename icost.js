/* icost.js —— iCost 记账（仿真实 iCost：明细 / 报表 / 记一笔 / 资产 / 我的；分类图标、数字键盘、预算、多账本、账户转账、导出），还能让 TA 点评你的账单 */
(function () {
    'use strict';
    const $ = (id) => document.getElementById(id), esc = (s) => escapeHtml(String(s == null ? '' : s));
    const KEY = 'icostData', uid = () => 'x' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5), pad = (n) => String(n).padStart(2, '0');
    const IC = {
        food: '<path d="M4 11h16a8 8 0 0 1-16 0z"/><path d="M9 3l4 7M13 3l4 7"/>',
        transport: '<rect x="5" y="4" width="14" height="13" rx="3"/><path d="M5 11h14M8.5 20l1-3M15.5 20l-1-3M9 14h.01M15 14h.01"/>',
        shop: '<path d="M6 8.5h12l-1 10.5H7z"/><path d="M9 8.5V7.5a3 3 0 0 1 6 0v1"/>',
        fun: '<path d="M7 8h10a4 4 0 0 1 4 4v1.5a2.5 2.5 0 0 1-4.4 1.6L15.5 14h-7l-1.1 1.1A2.5 2.5 0 0 1 3 13.5V12a4 4 0 0 1 4-4z"/><path d="M8 10.5v3M6.5 12h3M16 11.3h.01M18 12.7h.01"/>',
        home: '<path d="M4 11l8-6.5 8 6.5v8a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1z"/><path d="M10 20v-5h4v5"/>',
        phone: '<path d="M6 4h3.6l1.5 4-2 1.4a10 10 0 0 0 5.5 5.5L16 12.9l4 1.5V18a2 2 0 0 1-2 2A14 14 0 0 1 4 6a2 2 0 0 1 2-2z"/>',
        med: '<rect x="4.5" y="4.5" width="15" height="15" rx="4"/><path d="M12 8.5v7M8.5 12h7"/>',
        study: '<path d="M5 5.5A1.5 1.5 0 0 1 6.5 4H19v13.5H6.5A1.5 1.5 0 0 0 5 19z"/><path d="M5 19a1.5 1.5 0 0 0 1.5 1.5H19v-3M9 8.5h6"/>',
        social: '<circle cx="9" cy="9" r="3"/><path d="M3.5 19a5.5 5.5 0 0 1 11 0M16 6.5a3 3 0 0 1 0 5.5M17.5 14.2A5.5 5.5 0 0 1 20.5 19"/>',
        travel: '<path d="M21 4L3 11l7 3 3 7z"/><path d="M10 14l11-10"/>',
        beauty: '<path d="M12 4l1.9 4.9 5.1 1.6-5.1 1.7L12 17.5l-1.9-5.3L5 10.5l5.1-1.6z"/><path d="M18.5 16.5v3M17 18h3"/>',
        pet: '<circle cx="7" cy="10" r="1.7"/><circle cx="11" cy="6.5" r="1.7"/><circle cx="15.5" cy="7" r="1.7"/><circle cx="18.5" cy="11" r="1.7"/><path d="M8 17c0-3 2.5-5 5-5s4 2 4 4.5c0 2-1.5 3-3 2.5-1-.3-1.5-.7-2.5-.7s-1.5.4-2.5.7C8.5 19.5 8 18.5 8 17z"/>',
        digital: '<rect x="5" y="5" width="14" height="10" rx="2"/><path d="M3 19h18"/>',
        gift: '<rect x="4" y="9" width="16" height="11" rx="2"/><path d="M12 9v11M3.5 9h17M12 9c-2-4-6-3.5-5 0 .4 1.4 3.5 1 5 0zM12 9c2-4 6-3.5 5 0-.4 1.4-3.5 1-5 0z"/>',
        daily: '<path d="M5 9h14l-1.5 10h-11z"/><path d="M8 9l1.5-4h5L16 9"/>',
        other: '<circle cx="6" cy="12" r="1.2"/><circle cx="12" cy="12" r="1.2"/><circle cx="18" cy="12" r="1.2"/>',
        salary: '<rect x="4" y="6.5" width="16" height="12" rx="3"/><path d="M4 10h16M16 14.2h.01"/>',
        bonus: '<path d="M12 4l2.4 5 5.4.7-4 3.8 1 5.4-4.8-2.7-4.8 2.7 1-5.4-4-3.8 5.4-.7z"/>',
        part: '<circle cx="12" cy="12" r="8"/><path d="M12 8v4.5l3 1.5"/>',
        invest: '<path d="M4 17l5-5 4 3 7-8"/><path d="M15 7h5v5"/>',
        red: '<rect x="6" y="3.5" width="12" height="17" rx="2.5"/><path d="M6 9c4 2.5 8 2.5 12 0"/><circle cx="12" cy="11.5" r="1.5"/>',
        refund: '<path d="M5 12a7 7 0 1 0 2.2-5"/><path d="M5 5v4h4"/>',
        coffee: '<path d="M5 10h11v4a5 5 0 0 1-5 5h-1a5 5 0 0 1-5-5z"/><path d="M16 11h1.5a2.3 2.3 0 0 1 0 4.6H16M8 4.5c0 1 1 1 1 2.2M12 4.5c0 1 1 1 1 2.2"/>',
        music: '<path d="M9 17V6l10-2v11"/><circle cx="6.5" cy="17.5" r="2.5"/><circle cx="16.5" cy="15.5" r="2.5"/>',
        heart: '<path d="M12 19.5s-7-4.3-7-9.6A3.8 3.8 0 0 1 12 7.8a3.8 3.8 0 0 1 7 2.1c0 5.3-7 9.6-7 9.6z"/>',
        sport: '<circle cx="12" cy="12" r="8"/><path d="M4 12h16M12 4c3 3 3 13 0 16M12 4c-3 3-3 13 0 16"/>',
        swap: '<path d="M6 8h12l-3-3M18 16H6l3 3"/>'
    };
    const ICN = Object.keys(IC).filter(k => k !== 'swap');
    const svg = (k) => '<svg viewBox="0 0 24 24">' + (IC[k] || IC.other) + '</svg>';
    const DEF_OUT = [['food', '餐饮', '#ff8a65'], ['transport', '交通', '#4aa8e8'], ['shop', '购物', '#ff6b8b'], ['fun', '娱乐', '#8a7be0'], ['home', '居家', '#5fc58a'], ['phone', '通讯', '#26a69a'], ['med', '医疗', '#ef5350'], ['study', '学习', '#7986cb'], ['social', '人情', '#ffa726'], ['travel', '旅行', '#29b6f6'], ['beauty', '美容', '#f06292'], ['pet', '宠物', '#a1887f'], ['digital', '数码', '#78909c'], ['gift', '礼物', '#ec407a'], ['daily', '日用', '#9ccc65'], ['other', '其他', '#8d94a0']];
    const DEF_IN = [['salary', '工资', '#5fc58a'], ['bonus', '奖金', '#f6c344'], ['part', '兼职', '#4aa8e8'], ['invest', '理财', '#8a7be0'], ['red', '红包', '#ef5350'], ['refund', '退款', '#26a69a'], ['other', '其他', '#8d94a0']];
    const ACC0 = [['现金', '#8d94a0'], ['微信', '#5fc58a'], ['支付宝', '#4aa8e8'], ['银行卡', '#ff9f43']];
    const PAL = ['#ff8a65', '#4aa8e8', '#ff6b8b', '#8a7be0', '#5fc58a', '#26a69a', '#ef5350', '#f6c344', '#a1887f', '#78909c'];
    function D() {
        let d = null; try { d = JSON.parse(store.getItem(KEY) || 'null'); } catch (e) { }
        if (!d || !Array.isArray(d.tx)) {
            d = { ledgers: [{ id: 'lg1', name: '日常账本' }], cur: 'lg1', accounts: ACC0.map((a, i) => ({ id: 'ac' + i, name: a[0], color: a[1], init: 0 })), cats: { out: DEF_OUT.map((c, i) => ({ id: 'o' + i, ic: c[0], name: c[1], color: c[2] })), in: DEF_IN.map((c, i) => ({ id: 'i' + i, ic: c[0], name: c[1], color: c[2] })) }, tx: [], budget: {}, lastAcc: 'ac1' };
        }
        d.budget = d.budget || {}; return d;
    }
    function S(d) { try { store.setItem(KEY, JSON.stringify(d)); } catch (e) { uiAlert('保存失败，空间不够了'); } }
    const money = (n, sign) => (sign && n > 0 ? '+' : '') + (Math.round(n * 100) / 100).toLocaleString('zh-CN', { minimumFractionDigits: Math.abs(n) % 1 ? 2 : 0, maximumFractionDigits: 2 });
    const T = () => todayStr(), WK = '日一二三四五六';
    const catOf = (d, t, id) => (d.cats[t] || []).find(c => c.id === id) || { name: '其他', ic: 'other', color: '#8d94a0' };
    const accOf = (d, id) => d.accounts.find(a => a.id === id) || { name: '(已删除)', color: '#8d94a0' };
    const txs = (d) => d.tx.filter(x => x.lg === d.cur);
    function sum(a, t) { return a.filter(x => x.type === t).reduce((s, x) => s + x.amt, 0); }
    function balance(d, ac) { let b = +ac.init || 0; d.tx.forEach(x => { if (x.type === 'out' && x.acc === ac.id) b -= x.amt; else if (x.type === 'in' && x.acc === ac.id) b += x.amt; else if (x.type === 'tr') { if (x.acc === ac.id) b -= x.amt; if (x.to === ac.id) b += x.amt; } }); return b; }

    try {
        if (allApps.indexOf('icost') < 0) allApps.push('icost');
        if (!HOME_APPS.some(a => a.id === 'icost')) HOME_APPS.push({ id: 'icost', name: 'iCost', cls: 'icost-icon', face: '(｡•̀ᴗ-)✧', go: () => openApp('icost') });
        GLYPH.icost = '<circle cx="12" cy="12" r="8.5"/><path d="M14.8 9.2c-.6-.8-1.6-1.2-2.8-1.2-1.7 0-2.8.9-2.8 2.1 0 3 5.8 1.3 5.8 4.2 0 1.3-1.2 2.2-3 2.2-1.3 0-2.4-.5-3-1.4M12 6.5V8M12 16v1.5"/>';
    } catch (e) { }

    let tab = 'bill', ym = T().slice(0, 7), sp = 'm', st = 'out', taText = '', taBusy = false;
    function ensure() {
        if ($('icostApp')) return;
        const el = document.createElement('div'); el.id = 'icostApp'; el.className = 'app-screen hidden'; el.style.position = 'absolute';
        el.innerHTML = '<div class="app-header"><button onclick="goHome()">‹ 返回</button><span id="icTitle">iCost</span><button class="hdr-btn" id="icLg">账本</button></div><div class="scroll-area xa-body" id="icBody" style="padding-bottom:110px"></div>'
            + '<div class="ic-nav"><button data-t="bill" class="on"><svg viewBox="0 0 24 24"><path d="M6 4h12v16l-3-2-3 2-3-2-3 2z"/><path d="M9 9h6M9 13h4"/></svg>明细</button><button data-t="stat"><svg viewBox="0 0 24 24"><path d="M5 20V11M12 20V5M19 20v-6"/></svg>报表</button><button class="add" id="icAdd"><svg viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg></button><button data-t="acc"><svg viewBox="0 0 24 24"><rect x="4" y="6.5" width="16" height="12" rx="3"/><path d="M4 10h16M16 14.2h.01"/></svg>资产</button><button data-t="me"><svg viewBox="0 0 24 24"><circle cx="12" cy="9" r="3.5"/><path d="M5 20a7 7 0 0 1 14 0"/></svg>我的</button></div>';
        ($('callScreen') ? $('callScreen').parentElement : document.body).appendChild(el);
        el.querySelectorAll('.ic-nav [data-t]').forEach(b => b.onclick = () => { tab = b.dataset.t; render(); });
        $('icAdd').onclick = () => addSheet(null); $('icLg').onclick = ledgerSheet;
        new MutationObserver(() => { if (!el.classList.contains('hidden')) render(); }).observe(el, { attributes: true, attributeFilter: ['class'] });
    }
    function render() {
        const d = D(), body = $('icBody'); if (!body) return;
        $('icostApp').querySelectorAll('.ic-nav [data-t]').forEach(b => b.classList.toggle('on', b.dataset.t === tab));
        const lg = d.ledgers.find(l => l.id === d.cur) || d.ledgers[0]; $('icTitle').textContent = tab === 'me' ? '我的' : tab === 'acc' ? '资产' : tab === 'stat' ? '报表' : lg.name; $('icLg').style.visibility = (tab === 'bill' || tab === 'stat') ? 'visible' : 'hidden';
        if (tab === 'bill') bill(d, body); else if (tab === 'stat') stat(d, body); else if (tab === 'acc') acc(d, body); else me(d, body);
    }
    const shiftYm = (s, n) => { let y = +s.slice(0, 4), m = +s.slice(5, 7) + n; while (m > 12) { m -= 12; y++; } while (m < 1) { m += 12; y--; } return y + '-' + pad(m); };
    function txRow(d, x) {
        if (x.type === 'tr') return '<div class="ic-tx" data-id="' + x.id + '"><span class="ic-ico" style="background:#8d94a0">' + svg('swap') + '</span><div class="l"><b>转账</b><span>' + esc(accOf(d, x.acc).name) + ' → ' + esc(accOf(d, x.to).name) + (x.note ? ' · ' + esc(x.note) : '') + '</span></div><div class="a tr">' + money(x.amt) + '</div></div>';
        const c = catOf(d, x.type, x.cat);
        return '<div class="ic-tx" data-id="' + x.id + '"><span class="ic-ico" style="background:' + c.color + '">' + svg(c.ic) + '</span><div class="l"><b>' + esc(c.name) + '</b><span>' + esc(accOf(d, x.acc).name) + (x.note ? ' · ' + esc(x.note) : '') + '</span></div><div class="a ' + (x.type === 'in' ? 'in' : '') + '">' + (x.type === 'in' ? '+' : '-') + money(x.amt) + '</div></div>';
    }
    function bill(d, body) {
        const a = txs(d).filter(x => x.date.slice(0, 7) === ym), out = sum(a, 'out'), inn = sum(a, 'in'), bud = +d.budget[d.cur] || 0, isNow = ym === T().slice(0, 7);
        let h = '<div class="ic-top"><div class="m"><button id="icPm">‹</button><span>' + ym.slice(0, 4) + '年' + +ym.slice(5) + '月 · 支出</span><button id="icNm">›</button></div><div class="big">' + money(out) + '</div><div class="row3"><div>收入<b>' + money(inn) + '</b></div><div>结余<b>' + money(inn - out) + '</b></div>' + (isNow && out ? '<div>日均支出<b>' + money(out / new Date().getDate()) + '</b></div>' : '') + '</div>';
        if (bud) { const pct = Math.min(100, out / bud * 100); h += '<div class="ic-bud' + (out > bud ? ' over' : '') + '">月预算 ' + money(bud) + ' · ' + (out > bud ? '已超支 ' + money(out - bud) : '还剩 ' + money(bud - out)) + '<div class="bar"><i style="width:' + pct + '%"></i></div></div>'; }
        h += '</div>';
        if (!a.length) h += '<div class="xa-empty">这个月还没有账单<br>点下面中间的「＋」记一笔吧</div>';
        else {
            const by = {}; a.forEach(x => (by[x.date] = by[x.date] || []).push(x));
            Object.keys(by).sort().reverse().forEach(k => { const o = sum(by[k], 'out'), i2 = sum(by[k], 'in'), w = WK[new Date(k + 'T00:00:00').getDay()]; h += '<div class="ic-day"><span>' + +k.slice(5, 7) + '月' + +k.slice(8) + '日 周' + w + (k === T() ? ' · 今天' : '') + '</span><span>' + (o ? '支出 ' + money(o) : '') + (o && i2 ? '  ' : '') + (i2 ? '收入 ' + money(i2) : '') + '</span></div>' + by[k].sort((p, q) => (q.time || '').localeCompare(p.time || '')).map(x => txRow(d, x)).join(''); });
        }
        body.innerHTML = h;
        $('icPm').onclick = () => { ym = shiftYm(ym, -1); render(); }; $('icNm').onclick = () => { ym = shiftYm(ym, 1); render(); };
        body.querySelectorAll('[data-id]').forEach(e => e.onclick = () => addSheet(e.dataset.id));
    }
    function stat(d, body) {
        const key = sp === 'm' ? ym : ym.slice(0, 4), a = txs(d).filter(x => x.date.indexOf(key) === 0 && x.type === st), total = sum(a, st);
        const by = {}; a.forEach(x => by[x.cat] = (by[x.cat] || 0) + x.amt); const rows = Object.keys(by).map(k => ({ c: catOf(d, st, k), v: by[k] })).sort((p, q) => q.v - p.v);
        let h = '<div class="cd-seg"><button data-sp="m" class="' + (sp === 'm' ? 'on' : '') + '">月</button><button data-sp="y" class="' + (sp === 'y' ? 'on' : '') + '">年</button></div><div class="cd-seg"><button data-st="out" class="' + (st === 'out' ? 'on' : '') + '">支出</button><button data-st="in" class="' + (st === 'in' ? 'on' : '') + '">收入</button></div>';
        h += '<div class="ic-top" style="padding:10px 16px"><div class="m"><button id="icPm">‹</button><span>' + (sp === 'm' ? ym.slice(0, 4) + '年' + +ym.slice(5) + '月' : ym.slice(0, 4) + '年') + '</span><button id="icNm">›</button></div></div>';
        if (!total) h += '<div class="xa-empty">这段时间没有' + (st === 'out' ? '支出' : '收入') + '记录</div>';
        else {
            let off = 0; const ring = rows.map(r => { const p = r.v / total * 100, s = '<circle cx="21" cy="21" r="15.9155" fill="none" stroke="' + r.c.color + '" stroke-width="5" stroke-dasharray="' + p + ' ' + (100 - p) + '" stroke-dashoffset="' + (-off) + '"/>'; off += p; return s; }).join('');
            h += '<div class="ic-donut"><svg width="190" height="190" viewBox="0 0 42 42" style="transform:rotate(-90deg)"><circle cx="21" cy="21" r="15.9155" fill="none" stroke="var(--accent-soft)" stroke-width="5"/>' + ring + '</svg><div class="ct"><span>' + (st === 'out' ? '总支出' : '总收入') + '</span><b>' + money(total) + '</b></div></div>';
            h += rows.map(r => '<div class="ic-rank"><span class="ic-ico" style="background:' + r.c.color + ';width:34px;height:34px;border-radius:50%">' + svg(r.c.ic) + '</span><div class="l"><div><span>' + esc(r.c.name) + ' <em>' + (r.v / total * 100).toFixed(1) + '%</em></span><b>' + money(r.v) + '</b></div><div class="bar"><i style="width:' + (r.v / rows[0].v * 100) + '%;background:' + r.c.color + '"></i></div></div></div>').join('');
            // 趋势
            const n = sp === 'm' ? new Date(+ym.slice(0, 4), +ym.slice(5), 0).getDate() : 12, arr = new Array(n).fill(0);
            a.forEach(x => { const i = sp === 'm' ? +x.date.slice(8) - 1 : +x.date.slice(5, 7) - 1; arr[i] += x.amt; }); const mx = Math.max.apply(null, arr) || 1;
            h += '<div class="xa-title">' + (sp === 'm' ? '每日走势' : '每月走势') + '</div><div class="ic-bars">' + arr.map((v, i) => '<i title="' + (i + 1) + (sp === 'm' ? '日 ' : '月 ') + money(v) + '" style="height:' + Math.max(2, v / mx * 100) + '%"></i>').join('') + '</div><div style="display:flex;justify-content:space-between;font-size:11px;color:var(--text-sub)"><span>1' + (sp === 'm' ? '日' : '月') + '</span><span>' + n + (sp === 'm' ? '日' : '月') + '</span></div>';
        }
        const c = getChar(getActiveCharId());
        h += '<div class="xa-btns"><button id="icTa">' + (taBusy ? (c ? c.name : 'TA') + ' 正在看账单…' : '让 ' + (c ? esc(c.name) : 'TA') + ' 点评这' + (sp === 'm' ? '个月' : '一年') + '的账单') + '</button></div>' + (taText ? '<div class="ic-ta">' + esc(taText) + '</div>' : '');
        body.innerHTML = h;
        body.querySelectorAll('[data-sp]').forEach(b => b.onclick = () => { sp = b.dataset.sp; taText = ''; render(); }); body.querySelectorAll('[data-st]').forEach(b => b.onclick = () => { st = b.dataset.st; render(); });
        $('icPm').onclick = () => { ym = sp === 'm' ? shiftYm(ym, -1) : shiftYm(ym, -12); taText = ''; render(); }; $('icNm').onclick = () => { ym = sp === 'm' ? shiftYm(ym, 1) : shiftYm(ym, 12); taText = ''; render(); };
        $('icTa').onclick = () => taReview(d, key, rows);
    }
    async function taReview(d, key, rows) {
        const c = getChar(getActiveCharId()); if (!c) { uiAlert('先创建并选择一个角色'); return; } if (typeof API_KEY === 'undefined' || !API_KEY) { uiAlert('先在设置里填好 API Key'); return; } if (taBusy) return;
        const all = txs(d).filter(x => x.date.indexOf(key) === 0), out = sum(all, 'out'), inn = sum(all, 'in'); if (!all.length) { uiAlert('这段时间还没有账单可以点评'); return; }
        const outs = all.filter(x => x.type === 'out'), big = outs.slice().sort((p, q) => q.amt - p.amt)[0], bud = +d.budget[d.cur] || 0;
        const desc = '统计区间：' + key + '\n总支出 ' + money(out) + '，总收入 ' + money(inn) + '，共 ' + all.length + ' 笔。\n支出分类前几名：' + (rows.length ? rows.slice(0, 4).map(r => r.c.name + ' ' + money(r.v)).join('、') : '无') + '。\n' + (big ? '最大的一笔支出：' + catOf(d, 'out', big.cat).name + ' ' + money(big.amt) + (big.note ? '（' + big.note + '）' : '') + '。\n' : '') + (sp === 'm' && bud ? '本月预算 ' + money(bud) + '，' + (out > bud ? '已超支 ' + money(out - bud) : '还剩 ' + money(bud - out)) + '。' : '');
        taBusy = true; taText = ''; render();
        try { taText = String(await callPersona(c.id, timeContext() + '\n这是我的记账统计，请你用你自己的口吻点评一下我的消费：夸夸我做得好的地方，温柔地提醒花得有点多的地方，再给一两条具体的小建议（比如少点外卖、给自己留点零花）。像真人聊天，不要列清单，不超过120字。\n' + desc, 1.0)).trim(); }
        catch (e) { taText = '点评失败：' + (e.message || e); }
        taBusy = false; render();
    }
    function acc(d, body) {
        const tot = d.accounts.reduce((s, a) => s + balance(d, a), 0);
        let h = '<div class="ic-top"><div class="m"><span>总资产</span></div><div class="big">' + money(tot) + '</div><div class="row3"><div>账户数<b>' + d.accounts.length + '</b></div></div></div>';
        h += d.accounts.map(a => '<div class="ic-acc" data-a="' + a.id + '"><span class="ic-ico" style="background:' + a.color + ';border-radius:50%;font-size:15px;font-weight:700">' + esc(a.name.slice(0, 1)) + '</span><div class="l"><b>' + esc(a.name) + '</b><span>初始 ' + money(+a.init || 0) + '</span></div><div class="a">' + money(balance(d, a)) + '</div></div>').join('');
        h += '<div class="xa-btns"><button id="acNew">＋ 添加账户</button></div>';
        body.innerHTML = h; $('acNew').onclick = () => accSheet(null); body.querySelectorAll('[data-a]').forEach(e => e.onclick = () => accSheet(e.dataset.a));
    }
    function accSheet(id) {
        const d = D(), a = id ? d.accounts.find(x => x.id === id) : null; let col = a ? a.color : PAL[d.accounts.length % PAL.length];
        const m = sheet('<h3>' + (a ? '编辑账户' : '添加账户') + '</h3><div class="xa-row"><span>名称</span><input id="asN" placeholder="例如：招商银行" value="' + esc(a ? a.name : '') + '"></div><div class="xa-row"><span>初始余额</span><input id="asI" type="number" inputmode="decimal" placeholder="0" value="' + (a ? (+a.init || 0) : '') + '"></div><div class="cd-colors" id="asC">' + PAL.map(c => '<i data-c="' + c + '" style="background:' + c + '"' + (c === col ? ' class="on"' : '') + '></i>').join('') + '</div><div class="xa-btns">' + (a && d.accounts.length > 1 ? '<button class="dan" id="asD">删除</button>' : '') + '<button id="asX">取消</button><button class="pri" id="asOk">保存</button></div>');
        m.querySelectorAll('#asC i').forEach(i => i.onclick = () => { col = i.dataset.c; m.querySelectorAll('#asC i').forEach(z => z.classList.toggle('on', z === i)); });
        m.querySelector('#asX').onclick = () => m.remove();
        if (a && d.accounts.length > 1) m.querySelector('#asD').onclick = async () => { if (!(await uiConfirm('删除账户「' + a.name + '」？账单记录会保留，但会显示为已删除账户'))) return; const dd = D(); dd.accounts = dd.accounts.filter(x => x.id !== id); S(dd); m.remove(); render(); };
        m.querySelector('#asOk').onclick = () => { const n = m.querySelector('#asN').value.trim(); if (!n) { uiAlert('写个账户名称'); return; } const dd = D(), init = parseFloat(m.querySelector('#asI').value) || 0; if (a) Object.assign(dd.accounts.find(x => x.id === id), { name: n, init: init, color: col }); else dd.accounts.push({ id: uid(), name: n, init: init, color: col }); S(dd); m.remove(); render(); };
    }
    function me(d, body) {
        const lg = d.ledgers.find(l => l.id === d.cur) || d.ledgers[0], all = txs(d), bud = +d.budget[d.cur] || 0;
        let h = '<div class="ic-top"><div class="m"><span>' + esc(lg.name) + '</span></div><div class="big">' + all.length + ' <span style="font-size:15px">笔账单</span></div><div class="row3"><div>累计支出<b>' + money(sum(all, 'out')) + '</b></div><div>累计收入<b>' + money(sum(all, 'in')) + '</b></div></div></div>';
        h += '<div class="ag-list"><div class="li-row" id="meBud"><b>月预算</b><em>' + (bud ? money(bud) : '未设置') + '</em><span style="color:var(--text-sub)">›</span></div><div class="li-row" id="meLg"><b>账本管理</b><em>' + d.ledgers.length + ' 个</em><span style="color:var(--text-sub)">›</span></div><div class="li-row" id="meCat"><b>分类管理</b><em>' + (d.cats.out.length + d.cats.in.length) + ' 个</em><span style="color:var(--text-sub)">›</span></div><div class="li-row" id="meCsv"><b>导出账单（CSV，可用 Excel 打开）</b><span style="color:var(--text-sub)">›</span></div><div class="li-row" id="meClr"><b style="color:#d9534f">清空当前账本</b><span style="color:var(--text-sub)">›</span></div></div>';
        h += '<p class="xa-empty" style="padding:14px 6px;font-size:12px">账单只保存在你自己的浏览器里；换设备或清缓存前，请到「设置 → 数据备份」导出备份文件。</p>';
        body.innerHTML = h;
        $('meBud').onclick = async () => { const v = await uiPrompt('每月预算（元），填 0 取消预算', bud || '', { placeholder: '例如 3000' }); if (v == null) return; const n = parseFloat(v); if (isNaN(n) || n < 0) { uiAlert('请输入数字'); return; } const dd = D(); dd.budget[dd.cur] = n; S(dd); render(); };
        $('meLg').onclick = ledgerSheet; $('meCat').onclick = catSheet;
        $('meCsv').onclick = () => { const dd = D(), rows = [['日期', '时间', '类型', '分类', '金额', '账户', '转入账户', '备注']].concat(txs(dd).slice().sort((p, q) => (p.date + (p.time || '')).localeCompare(q.date + (q.time || ''))).map(x => [x.date, x.time || '', x.type === 'out' ? '支出' : x.type === 'in' ? '收入' : '转账', x.type === 'tr' ? '' : catOf(dd, x.type, x.cat).name, x.amt, accOf(dd, x.acc).name, x.type === 'tr' ? accOf(dd, x.to).name : '', x.note || '']));
            const csv = '﻿' + rows.map(r => r.map(c => '"' + String(c).replace(/"/g, '""') + '"').join(',')).join('\n'); const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' })); a.download = 'iCost账单_' + T() + '.csv'; document.body.appendChild(a); a.click(); a.remove(); };
        $('meClr').onclick = async () => { if (!(await uiConfirm('清空当前账本里的所有账单吗？不能恢复'))) return; const dd = D(); dd.tx = dd.tx.filter(x => x.lg !== dd.cur); S(dd); render(); };
    }
    function sheet(html) { const app = $('icostApp'), m = document.createElement('div'); m.className = 'xa-mask'; m.innerHTML = '<div class="xa-sheet">' + html + '</div>'; m.addEventListener('mousedown', (e) => { if (e.target === m) m.remove(); }); app.appendChild(m); return m; }
    function ledgerSheet() {
        const d = D(), m = sheet('<h3>账本</h3><div id="lgL">' + d.ledgers.map(l => '<div class="xa-row" data-l="' + l.id + '" style="cursor:pointer"><b style="font-weight:' + (l.id === d.cur ? 700 : 400) + ';color:var(--text-main)">' + esc(l.name) + (l.id === d.cur ? '（当前）' : '') + '</b><span style="color:var(--text-sub)">' + d.tx.filter(x => x.lg === l.id).length + ' 笔</span></div>').join('') + '</div><div class="xa-btns"><button id="lgNew">＋ 新账本</button><button id="lgRen">重命名当前</button></div><div class="xa-btns"><button class="dan" id="lgDel">删除当前账本</button><button class="pri" id="lgOk">完成</button></div>');
        m.querySelector('#lgOk').onclick = () => m.remove();
        m.querySelectorAll('[data-l]').forEach(e => e.onclick = () => { const dd = D(); dd.cur = e.dataset.l; S(dd); m.remove(); render(); });
        m.querySelector('#lgNew').onclick = async () => { const n = await uiPrompt('新账本名称（例如：旅行基金、两个人的账本）', ''); if (!n || !n.trim()) return; const dd = D(), id = uid(); dd.ledgers.push({ id: id, name: n.trim().slice(0, 12) }); dd.cur = id; S(dd); m.remove(); render(); };
        m.querySelector('#lgRen').onclick = async () => { const dd = D(), l = dd.ledgers.find(x => x.id === dd.cur); const n = await uiPrompt('账本名称', l.name); if (!n || !n.trim()) return; l.name = n.trim().slice(0, 12); S(dd); m.remove(); render(); };
        m.querySelector('#lgDel').onclick = async () => { const dd = D(); if (dd.ledgers.length < 2) { uiAlert('至少要留一个账本'); return; } const l = dd.ledgers.find(x => x.id === dd.cur); if (!(await uiConfirm('删除账本「' + l.name + '」和里面的所有账单？'))) return; dd.ledgers = dd.ledgers.filter(x => x.id !== dd.cur); dd.tx = dd.tx.filter(x => x.lg !== dd.cur); dd.cur = dd.ledgers[0].id; S(dd); m.remove(); render(); };
    }
    function catSheet() {
        let t = 'out';
        const m = sheet('<h3>分类管理</h3><div class="cd-seg"><button data-t="out" class="on">支出</button><button data-t="in">收入</button></div><div id="ctL"></div><div class="xa-btns"><button id="ctNew">＋ 自定义分类</button><button class="pri" id="ctOk">完成</button></div>');
        const draw = () => { const d = D(); m.querySelector('#ctL').innerHTML = '<div class="ic-cats" style="padding:0;overflow:visible">' + d.cats[t].map(c => '<button class="ic-cat on" data-c="' + c.id + '"><span class="ic-ico" style="background:' + c.color + '">' + svg(c.ic) + '</span>' + esc(c.name) + '</button>').join('') + '</div><p style="font-size:12px;color:var(--text-sub);margin:10px 4px 0">点分类可以删除</p>'; m.querySelectorAll('#ctL [data-c]').forEach(b => b.onclick = async () => { const dd = D(); if (dd.cats[t].length < 2) { uiAlert('至少保留一个分类'); return; } const c = dd.cats[t].find(z => z.id === b.dataset.c); if (!(await uiConfirm('删除分类「' + c.name + '」？已有账单会显示为「其他」'))) return; dd.cats[t] = dd.cats[t].filter(z => z.id !== c.id); S(dd); draw(); }); };
        m.querySelectorAll('.cd-seg [data-t]').forEach(b => b.onclick = () => { t = b.dataset.t; m.querySelectorAll('.cd-seg [data-t]').forEach(z => z.classList.toggle('on', z === b)); draw(); }); draw();
        m.querySelector('#ctOk').onclick = () => m.remove();
        m.querySelector('#ctNew').onclick = () => {
            let ic = 'coffee', col = PAL[0];
            const m2 = sheet('<h3>自定义' + (t === 'out' ? '支出' : '收入') + '分类</h3><div class="xa-row"><span>名称</span><input id="cnN" maxlength="6" placeholder="例如：奶茶"></div><div class="ic-cats" id="cnI" style="padding:0;overflow:visible">' + ICN.map(k => '<button class="ic-cat' + (k === ic ? ' on' : '') + '" data-k="' + k + '"><span class="ic-ico" style="background:#8d94a0">' + svg(k) + '</span></button>').join('') + '</div><div class="cd-colors" id="cnC" style="margin-top:12px">' + PAL.map(c => '<i data-c="' + c + '" style="background:' + c + '"' + (c === col ? ' class="on"' : '') + '></i>').join('') + '</div><div class="xa-btns"><button id="cnX">取消</button><button class="pri" id="cnOk">添加</button></div>');
            m2.querySelectorAll('#cnI [data-k]').forEach(b => b.onclick = () => { ic = b.dataset.k; m2.querySelectorAll('#cnI [data-k]').forEach(z => z.classList.toggle('on', z === b)); });
            m2.querySelectorAll('#cnC i').forEach(i => i.onclick = () => { col = i.dataset.c; m2.querySelectorAll('#cnC i').forEach(z => z.classList.toggle('on', z === i)); });
            m2.querySelector('#cnX').onclick = () => m2.remove();
            m2.querySelector('#cnOk').onclick = () => { const n = m2.querySelector('#cnN').value.trim(); if (!n) { uiAlert('写个分类名称'); return; } const dd = D(); dd.cats[t].push({ id: uid(), ic: ic, name: n, color: col }); S(dd); m2.remove(); draw(); };
        };
    }
    // ---------- 记一笔 ----------
    function evalExpr(s) {
        s = String(s || '0'); if (!/^[0-9.+\-]+$/.test(s)) return NaN; const nums = s.split(/[+\-]/), ops = s.match(/[+\-]/g) || []; let r = parseFloat(nums[0]) || 0;
        for (let i = 0; i < ops.length; i++) { const v = parseFloat(nums[i + 1]); if (isNaN(v)) continue; r = ops[i] === '+' ? r + v : r - v; } return Math.round(r * 100) / 100;
    }
    function addSheet(id) {
        const d = D(), old = id ? d.tx.find(x => x.id === id) : null, app = $('icostApp');
        let type = old ? old.type : 'out', cat = old ? old.cat : null, accId = old ? old.acc : (d.accounts.some(a => a.id === d.lastAcc) ? d.lastAcc : d.accounts[0].id), to = old ? old.to : null, expr = old ? String(old.amt) : '', date = old ? old.date : T(), note = old ? old.note || '' : '';
        if (!to) to = (d.accounts.find(a => a.id !== accId) || d.accounts[0]).id;
        const el = document.createElement('div'); el.className = 'ic-add'; app.appendChild(el);
        const pickAcc = async (title, cur) => { const dd = D(); const v = await uiChoose(title, dd.accounts.map(a => ({ label: a.name, v: a.id, primary: a.id === cur }))); return v || cur; };
        function draw() {
            const dd = D(), cs = dd.cats[type] || [], sel = type === 'tr' ? null : (cs.find(c => c.id === cat) || (cat = cs[0] && cs[0].id, cs[0])), isOp = /[+\-]/.test(expr.replace(/^-/, ''));
            el.innerHTML = '<div class="hd"><button id="adX">取消</button><div class="tp">' + [['out', '支出'], ['in', '收入'], ['tr', '转账']].map(t => '<button data-t="' + t[0] + '" class="' + (type === t[0] ? 'on' : '') + '">' + t[1] + '</button>').join('') + '</div>' + (old ? '<button id="adDel" style="color:#d9534f">删除</button>' : '<span style="width:44px"></span>') + '</div>'
                + (type === 'tr' ? '<div class="ic-cats" style="grid-template-columns:1fr;padding:30px 20px;text-align:center;color:var(--text-sub);font-size:14px;line-height:2">从「' + esc(accOf(dd, accId).name) + '」转到「' + esc(accOf(dd, to).name) + '」<br><span style="font-size:12px">转账不计入收支，只改变两个账户的余额</span></div>' : '<div class="ic-cats">' + cs.map(c => '<button class="ic-cat' + (c.id === cat ? ' on' : '') + '" data-c="' + c.id + '"><span class="ic-ico" style="background:' + c.color + '">' + svg(c.ic) + '</span>' + esc(c.name) + '</button>').join('') + '</div>')
                + '<div class="ic-pad"><div class="ic-amt">' + (sel ? '<span class="ic-ico" style="background:' + sel.color + '">' + svg(sel.ic) + '</span>' : '<span class="ic-ico" style="background:#8d94a0">' + svg('swap') + '</span>') + '<input id="adN" placeholder="添加备注…" maxlength="40" value="' + esc(note) + '"><b id="adA">' + (expr || '0') + '</b></div>'
                + '<div class="ic-chips"><button id="adAcc">' + (type === 'tr' ? '转出：' : '账户：') + esc(accOf(dd, accId).name) + '</button>' + (type === 'tr' ? '<button id="adTo">转入：' + esc(accOf(dd, to).name) + '</button>' : '') + '<label>' + (date === T() ? '今天' : date.slice(5)) + '<input type="date" id="adD" value="' + date + '"></label></div>'
                + '<div class="ic-keys">' + ['7', '8', '9', 'del', '4', '5', '6', '+', '1', '2', '3', 'ok', '-', '0', '.'].map(k => k === 'ok' ? '<button class="ok" data-k="ok">' + (isOp ? '=' : '完成') + '</button>' : '<button data-k="' + k + '" class="' + (k === '+' || k === '-' ? 'op' : '') + '">' + (k === 'del' ? '⌫' : k === '-' ? '−' : k === '+' ? '＋' : k) + '</button>').join('') + '</div></div>';
            el.querySelector('#adX').onclick = () => el.remove();
            el.querySelectorAll('.tp [data-t]').forEach(b => b.onclick = () => { note = el.querySelector('#adN').value; type = b.dataset.t; cat = null; draw(); });
            el.querySelectorAll('[data-c]').forEach(b => b.onclick = () => { note = el.querySelector('#adN').value; cat = b.dataset.c; draw(); });
            if (old) el.querySelector('#adDel').onclick = async () => { if (!(await uiConfirm('删除这笔账单？'))) return; const z = D(); z.tx = z.tx.filter(x => x.id !== id); S(z); el.remove(); render(); };
            el.querySelector('#adAcc').onclick = async () => { note = el.querySelector('#adN').value; accId = await pickAcc(type === 'tr' ? '从哪个账户转出' : '选择账户', accId); draw(); };
            if (type === 'tr') el.querySelector('#adTo').onclick = async () => { note = el.querySelector('#adN').value; to = await pickAcc('转入哪个账户', to); draw(); };
            el.querySelector('#adD').onchange = (e) => { note = el.querySelector('#adN').value; if (e.target.value) date = e.target.value; draw(); };
            el.querySelector('#adN').oninput = (e) => { note = e.target.value; };
            el.querySelectorAll('.ic-keys [data-k]').forEach(b => b.onclick = () => {
                const k = b.dataset.k; note = el.querySelector('#adN').value;
                if (k === 'del') expr = expr.slice(0, -1);
                else if (k === 'ok') {
                    if (/[+\-]/.test(expr.replace(/^-/, ''))) { const r = evalExpr(expr); expr = isNaN(r) ? '' : String(Math.max(0, r)); }
                    else { save(); return; }
                } else if (k === '+' || k === '-') { if (!expr) return; if (/[+\-.]$/.test(expr)) expr = expr.slice(0, -1); expr += k; }
                else if (k === '.') { const last = expr.split(/[+\-]/).pop(); if (last.indexOf('.') >= 0) return; expr += last === '' ? '0.' : '.'; }
                else { const last = expr.split(/[+\-]/).pop(); if (last.indexOf('.') >= 0 && last.split('.')[1].length >= 2) return; if (last === '0') expr = expr.slice(0, -1); if (expr.length > 14) return; expr += k; }
                el.querySelector('#adA').textContent = expr || '0'; const ok = el.querySelector('.ic-keys .ok'); if (ok) ok.textContent = /[+\-]/.test(expr.replace(/^-/, '')) ? '=' : '完成';
            });
        }
        function save() {
            const amt = evalExpr(expr); if (!(amt > 0)) { uiAlert('先输入金额'); return; }
            if (type === 'tr' && accId === to) { uiAlert('转出和转入不能是同一个账户'); return; }
            const dd = D(), o = { type: type, amt: amt, acc: accId, date: date, note: note.trim(), lg: dd.cur }; if (type === 'tr') o.to = to; else o.cat = cat;
            if (old) { const z = dd.tx.find(x => x.id === id); delete z.cat; delete z.to; Object.assign(z, o); } else dd.tx.push(Object.assign({ id: uid(), time: pad(new Date().getHours()) + ':' + pad(new Date().getMinutes()) }, o));
            dd.lastAcc = accId; S(dd); el.remove(); ym = date.slice(0, 7); if (tab !== 'bill' && tab !== 'stat') tab = 'bill'; render(); uiAlert(old ? '已修改' : '记好啦', 1200);
        }
        draw();
    }
    ensure();
})();
