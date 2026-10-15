/* memory.js —— 「回忆」：时间胶囊 + 回忆册；外卖里的「TA 替你点」。数据都只存在你自己的浏览器里 */
(function () {
    'use strict';
    const $ = (id) => document.getElementById(id), esc = (s) => escapeHtml(String(s == null ? '' : s));
    const cid = () => getActiveCharId(), who = () => activeCharName() || 'TA';
    const Lget = () => { const c = getChar(cid()); return c ? lifeOf(c) : null; };
    const ymd = (ts) => { const d = new Date(ts); return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate()); };
    const diff = (a, b) => dayNum(a) - dayNum(b);
    const cn = (ds) => { const p = ds.split('-'); return p[0] + '年' + (+p[1]) + '月' + (+p[2]) + '日'; };
    const ICON = {
        lock: '<path d="M7 11V8a5 5 0 0 1 10 0v3"/><rect x="5" y="11" width="14" height="9" rx="3"/><path d="M12 15v2"/>',
        mail: '<rect x="3.5" y="6" width="17" height="12" rx="3"/><path d="M4 8l8 5.5L20 8"/>',
        plus: '<path d="M12 6v12M6 12h12"/>', photo: '<rect x="4" y="5" width="16" height="14" rx="3"/><circle cx="9" cy="10" r="1.6"/><path d="M5 17l5-4.5 3.5 3 2.5-2L20 17"/>',
        heart: '<path d="M12 19s-6.5-3.9-6.5-8.6A3.4 3.4 0 0 1 12 8.5a3.4 3.4 0 0 1 6.5 1.9C18.5 15.1 12 19 12 19z"/>', book: '<path d="M6 4.5h10.5A1.5 1.5 0 0 1 18 6v13H7.5A1.5 1.5 0 0 1 6 17.5z"/><path d="M6 17.5A1.5 1.5 0 0 1 7.5 16H18"/>',
        bag: '<path d="M6 8h12l-1 11H7z"/><path d="M9 8V7a3 3 0 0 1 6 0v1"/>'
    };
    const svg = (n, s) => '<svg class="li" width="' + (s || 18) + '" height="' + (s || 18) + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">' + ICON[n] + '</svg>';

    // ---------- 把「回忆」接进桌面 ----------
    try {
        if (allApps.indexOf('memo') < 0) allApps.push('memo');
        if (!HOME_APPS.some(a => a.id === 'memo')) HOME_APPS.push({ id: 'memo', name: '回忆', cls: 'memo-icon', face: '(´ω`)', go: () => openApp('memo') });
        GLYPH.memo = '<rect x="4" y="5.5" width="16" height="13" rx="3.5"/><path d="M4.5 8.5L12 13l7.5-4.5"/>';
    } catch (e) {}

    let tab = 'cap', vy, vm;
    function ensure() {
        if ($('memoApp')) return;
        const el = document.createElement('div'); el.id = 'memoApp'; el.className = 'app-screen hidden';
        el.innerHTML = '<div class="app-header"><button onclick="goHome()">‹ 返回</button><span>回忆</span><button class="hdr-btn" id="mmAdd">写封信</button></div>'
            + '<div class="mm-tabs"><button data-t="cap" class="on">时间胶囊</button><button data-t="book">回忆册</button></div><div class="scroll-area padded" id="mmBody"></div>';
        ($('callScreen') ? $('callScreen').parentElement : document.body).appendChild(el);
        el.querySelectorAll('.mm-tabs button').forEach(b => b.onclick = () => { tab = b.dataset.t; render(); });
        $('mmAdd').onclick = () => { if (tab === 'cap') sheet('me'); else genNote(); };
        new MutationObserver(() => { if (!el.classList.contains('hidden')) { const n = new Date(); if (vy == null) { vy = n.getFullYear(); vm = n.getMonth(); } render(); } }).observe(el, { attributes: true, attributeFilter: ['class'] });
    }
    function render() {
        const el = $('memoApp'); if (!el) return;
        el.querySelectorAll('.mm-tabs button').forEach(b => b.classList.toggle('on', b.dataset.t === tab));
        $('mmAdd').textContent = tab === 'cap' ? '写封信' : 'TA手记';
        if (!cid()) { $('mmBody').innerHTML = '<div class="stg-empty">先去通讯录创建并选择一个角色吧</div>'; return; }
        tab === 'cap' ? renderCap() : renderBook();
    }

    // =====================================================================
    //  时间胶囊
    // =====================================================================
    const caps = () => ((Lget() || {}).capsules || []);
    function renderCap() {
        const list = caps().slice(), t = todayStr(), body = $('mmBody');
        const due = (c) => !c.openedTs && c.openOn <= t;
        list.sort((a, b) => (due(b) - due(a)) || ((!!a.openedTs - !!b.openedTs)) || (a.openOn < b.openOn ? -1 : 1));
        let h = '<div class="mm-hero"><b>时间胶囊</b><p>把想说的话、一张照片封起来，到了日子才能拆开。<br>' + esc(who()) + ' 也会偷偷往里放信。</p></div>'
            + '<div class="stg-btns"><button id="mmMe">' + svg('mail', 16) + ' 写给未来的我们</button><button class="ghost" id="mmTa">让 ' + esc(who()) + ' 也封一封</button></div>';
        if (!list.length) h += '<div class="stg-empty">还没有胶囊。<br>现在封一封，几个月后再拆开，会很幸福的。</div>';
        h += list.map(c => {
            const d = due(c), left = diff(c.openOn, t), mine = c.by === 'me';
            const state = c.openedTs ? '已拆开' : d ? '可以拆啦' : '还有 ' + left + ' 天';
            const title = c.openedTs || mine ? esc(c.title || '一封信') : esc(who()) + ' 封的信';
            return '<div class="mm-cap ' + (c.openedTs ? 'opened' : d ? 'due' : 'locked') + '" data-id="' + c.id + '"><div class="mm-seal">' + svg(c.openedTs ? 'mail' : d ? 'heart' : 'lock', 22) + '</div><div class="mm-capi"><b>' + title + '</b><small>' + (mine ? '我封的' : esc(who()) + ' 封的') + ' · ' + cn(ymd(c.ts)) + ' 封存</small><small>' + cn(c.openOn) + ' 开启</small></div><i>' + state + '</i></div>';
        }).join('');
        body.innerHTML = h;
        $('mmMe').onclick = () => sheet('me'); $('mmTa').onclick = () => sheet('ta');
        body.querySelectorAll('.mm-cap').forEach(e => e.onclick = () => openCap(e.dataset.id));
    }
    function sheet(by) {
        if (!cid()) { uiAlert('请先创建并选择一个角色'); return; }
        stageOpen(by === 'me' ? '写给未来的我们' : who() + ' 的胶囊', (b) => {
            let img = '', days = 30;
            const presets = [[7, '一周后'], [30, '一个月后'], [100, '100 天后'], [180, '半年后'], [365, '一年后']];
            b.innerHTML = (by === 'me' ? '<input id="cpTitle" class="input-text" maxlength="16" placeholder="给这封信起个名字（选填）"><textarea id="cpText" rows="7" placeholder="写给未来的我们…想说的话、现在的心情、对那时的期待。"></textarea><div class="mm-pick"><button id="cpImgBtn" class="ghost">' + svg('photo', 16) + ' 放一张照片</button><input id="cpImg" type="file" accept="image/*" style="display:none"><div id="cpPrev"></div></div>'
                : '<p class="hint-line">' + esc(who()) + ' 会根据你们最近的聊天和日常，写一封给未来的信，封好后你看不到内容，要等到日子到了才能拆。</p>')
                + '<div class="stg-sub">什么时候可以拆开</div><div class="mm-days">' + presets.map(p => '<button data-d="' + p[0] + '"' + (p[0] === 30 ? ' class="on"' : '') + '>' + p[1] + '</button>').join('') + '</div>'
                + '<div class="stg-sub">或者自己选日期</div><input id="cpDate" type="date" class="input-text" min="' + addDays(todayStr(), 1) + '">'
                + '<div class="stg-btns"><button id="cpOk">' + svg('lock', 16) + ' 封存</button></div>';
            b.querySelectorAll('.mm-days button').forEach(x => x.onclick = () => { days = +x.dataset.d; $('cpDate').value = ''; b.querySelectorAll('.mm-days button').forEach(y => y.classList.toggle('on', y === x)); });
            $('cpDate').onchange = () => { if ($('cpDate').value) b.querySelectorAll('.mm-days button').forEach(y => y.classList.remove('on')); };
            if (by === 'me') {
                $('cpImgBtn').onclick = () => $('cpImg').click();
                $('cpImg').onchange = () => { const f = $('cpImg').files[0]; if (!f) return; shrink(f).then(u => { img = u; $('cpPrev').innerHTML = '<img src="' + u + '">'; }); };
            }
            $('cpOk').onclick = async () => {
                const openOn = $('cpDate').value || addDays(todayStr(), days); if (openOn <= todayStr()) { uiAlert('开启日期要选在今天之后哦'); return; }
                const cap = { id: lifeId(), by, ts: Date.now(), openOn };
                if (by === 'me') {
                    cap.text = $('cpText').value.trim(); cap.title = $('cpTitle').value.trim(); cap.img = img;
                    if (!cap.text && !img) { uiAlert('写点什么，或者放张照片吧'); return; }
                } else {
                    if (needKey()) return; $('cpOk').disabled = true; $('cpOk').textContent = who() + ' 在写…';
                    try {
                        const n = diff(openOn, todayStr());
                        const t = await callPersona(cid(), '请你以角色本人的口吻，给「' + n + ' 天后的我」写一封信，会被封进时间胶囊，到 ' + cn(openOn) + ' 才拆开。要求：像你平时跟我说话那样口语、温柔、有感情，120~220 字；只能写真实发生过、你确实知道的事（可以提我们最近聊过的），不要编造没发生过的经历；可以写对那天的期待、小约定、想对那时的我说的话。只输出信的正文，不要标题，不要解释。', 1.0);
                        cap.text = String(t).trim(); cap.title = '';
                        if (!cap.text) throw new Error('empty');
                    } catch (e) { $('cpOk').disabled = false; $('cpOk').innerHTML = svg('lock', 16) + ' 封存'; uiAlert('这次没写成功，再试一次吧'); return; }
                }
                lifeUpdate(cid(), (L) => { L.capsules = L.capsules || []; L.capsules.push(cap); });
                try { addIntimacy(cid(), 2); logActivity(cid(), 'capsule', by === 'me' ? '我封了一封时间胶囊，' + cn(openOn) + '开启' : '你给我封了一封时间胶囊，' + cn(openOn) + '开启'); } catch (e) {}
                stageClose(); uiAlert('已封存，' + cn(openOn) + ' 见～');
            };
        }, render);
    }
    function shrink(file) {
        return new Promise((ok) => { const r = new FileReader(); r.onload = () => { const im = new Image(); im.onload = () => { const k = Math.min(1, 900 / Math.max(im.width, im.height)), cv = document.createElement('canvas'); cv.width = Math.round(im.width * k); cv.height = Math.round(im.height * k); cv.getContext('2d').drawImage(im, 0, 0, cv.width, cv.height); ok(cv.toDataURL('image/jpeg', .78)); }; im.onerror = () => ok(''); im.src = r.result; }; r.onerror = () => ok(''); r.readAsDataURL(file); });
    }
    function openCap(id) {
        const c = caps().find(x => x.id === id); if (!c) return; const t = todayStr();
        if (!c.openedTs && c.openOn > t) {
            stageOpen('还没到时间', (b) => { b.innerHTML = '<div class="mm-locked"><div class="mm-bigseal">' + svg('lock', 44) + '</div><h3>还要等 ' + diff(c.openOn, t) + ' 天</h3><p>' + cn(c.openOn) + ' 才能拆开。<br>' + (c.by === 'me' ? '你写下的话，会好好替你收着。' : esc(who()) + ' 说：不许偷看，到时候给你个惊喜。') + '</p><div class="stg-btns"><button class="ghost" id="cpDel">不想留了，撕掉</button></div></div>'; $('cpDel').onclick = async () => { if (await uiConfirm('撕掉这封还没拆的胶囊吗？')) { lifeUpdate(cid(), (L) => { L.capsules = L.capsules.filter(x => x.id !== id); }); stageClose(); } }; }, render);
            return;
        }
        const first = !c.openedTs; if (first) lifeUpdate(cid(), (L) => { const x = L.capsules.find(y => y.id === id); if (x) x.openedTs = Date.now(); });
        stageOpen(c.by === 'me' ? (c.title || '写给未来的我们') : who() + ' 写给你的信', (b) => {
            const paper = '<div class="mm-env' + (first ? ' fresh' : '') + '"><div class="mm-letter"><small>' + cn(ymd(c.ts)) + ' 封存 · ' + cn(c.openOn) + ' 开启</small><p>' + esc(c.text || '').replace(/\n/g, '<br>') + '</p>' + (c.img ? '<img class="mm-limg" src="' + c.img + '">' : '') + '<div class="mm-sign">—— ' + (c.by === 'me' ? '过去的我' : esc(who())) + '</div></div></div>';
            b.innerHTML = paper + '<div id="cpReply"></div><div class="stg-btns"><button class="ghost" id="cpDel2">删除</button></div>';
            $('cpDel2').onclick = async () => { if (await uiConfirm('删除这封信吗？不能恢复哦。')) { lifeUpdate(cid(), (L) => { L.capsules = L.capsules.filter(x => x.id !== id); }); stageClose(); } };
            const showRe = (r) => { $('cpReply').innerHTML = '<div class="td-react"><div class="bub-av">' + esc(who().slice(0, 1)) + '</div><div class="bub">' + esc(r) + '</div></div>'; };
            if (c.reply) showRe(c.reply);
            else if (c.by === 'me' && API_KEY) {
                $('cpReply').innerHTML = '<div class="stg-load"><div class="spin"></div>' + esc(who()) + ' 在看你写的信…</div>';
                callPersona(cid(), '我把一封信封进时间胶囊，今天拆开了。写信时间：' + cn(ymd(c.ts)) + '，今天：' + cn(t) + '。信的内容：「' + (c.text || '（只有一张照片）') + '」。请你以角色本人的口吻，像刚和我一起读完这封信那样回应我，口语、真诚、有感情，不超过60字；只能根据信里写的和你已知的事回应，不要编造。只输出回应。', 1.0)
                    .then(r => { r = oneLine(r); if (!r) { $('cpReply').innerHTML = ''; return; } lifeUpdate(cid(), (L) => { const x = L.capsules.find(y => y.id === id); if (x) x.reply = r; }); showRe(r); addIntimacy(cid(), 2); })
                    .catch(() => { $('cpReply').innerHTML = ''; });
            }
        }, render);
    }
    // 到期提醒
    const notified = {};
    function checkDue(silent) {
        try {
            const t = todayStr(); getChars().forEach(ch => { const cs = (lifeOf(ch).capsules || []).filter(c => !c.openedTs && c.openOn <= t && !notified[c.id]); cs.forEach(c => { notified[c.id] = 1; });
                if (cs.length && !silent) showBanner(ch, '有 ' + cs.length + ' 封时间胶囊到日子啦，去「回忆」里拆开吧'); });
        } catch (e) {}
    }
    setTimeout(() => checkDue(false), 3500); setInterval(() => checkDue(false), 5 * 60 * 1000);

    // =====================================================================
    //  回忆册（按月自动整理）
    // =====================================================================
    function monthData(c, y, m) {
        const L = lifeOf(c), pre = y + '-' + pad2(m + 1) + '-', inM = (ds) => ds && String(ds).indexOf(pre) === 0;
        const hist = (c.chatHistory || []).filter(x => x.ts && (x.role === 'user' || x.role === 'assistant') && inM(ymd(x.ts)));
        const byDay = {}; hist.forEach(x => { const d = ymd(x.ts); byDay[d] = (byDay[d] || 0) + 1; });
        const bestDay = Object.keys(byDay).sort((a, b) => byDay[b] - byDay[a])[0];
        const firstUser = hist.find(x => x.role === 'user' && x.content && x.content.indexOf('[') !== 0);
        const mor = (L.checkin.morning || []).filter(inM).length, nig = (L.checkin.night || []).filter(inM).length;
        const photos = (L.photos || []).filter(p => inM(ymd(p.ts))), diary = (L.diary || []).filter(d => inM(d.date || ymd(d.ts)));
        const days = (L.days || []).filter(d => { try { const dt = d.date; const mm = String(dt).split('-'); return d.yearly ? (+mm[1] === m + 1) : inM(dt); } catch (e) { return false; } });
        const cs = (L.capsules || []), sealed = cs.filter(x => inM(ymd(x.ts))), opened = cs.filter(x => x.openedTs && inM(ymd(x.openedTs)));
        const orders = (L.orders || []).filter(o => inM(ymd(o.ts)));
        const vows = (L.vows || []).filter(v => v.done && inM(ymd(v.doneTs || v.ts)));
        const places = (L.places || []).filter(p => p.date && inM(p.date) && p.type !== 'want'), dplans = (L.dates || []).filter(x => x.done && inM(ymd(x.ts)));
        return { places, dplans, L, hist, byDay, bestDay, firstUser, mor, nig, photos, diary, days, sealed, opened, orders, vows, nu: hist.filter(x => x.role === 'user').length, na: hist.filter(x => x.role === 'assistant').length };
    }
    function renderBook() {
        const c = getChar(cid()), body = $('mmBody'); if (!c) return; const key = vy + '-' + pad2(vm + 1), d = monthData(c, vy, vm), L = d.L;
        const all = (c.chatHistory || []).filter(x => x.ts), first = all.length ? all[0].ts : null, together = first ? diff(todayStr(), ymd(first)) + 1 : 0;
        let h = '<div class="mm-total"><div><b>' + (together || '—') + '</b><span>认识第几天</span></div><div><b>' + (c.chatHistory || []).filter(x => x.role === 'user' || x.role === 'assistant').length + '</b><span>说过的话</span></div><div><b>' + ((L.checkin.morning || []).length + (L.checkin.night || []).length) + '</b><span>早晚安</span></div></div>';
        h += '<div class="mm-mhead"><button id="mbPrev">‹</button><b>' + vy + ' 年 ' + (vm + 1) + ' 月</b><button id="mbNext">›</button></div>';
        const empty = !d.places.length && !d.dplans.length && !d.hist.length && !d.mor && !d.nig && !d.photos.length && !d.diary.length && !d.days.length && !d.sealed.length && !d.orders.length;
        if (empty) h += '<div class="stg-empty">这个月还没有留下什么。<br>多聊聊天、打打卡、拍拍照，这里会自动长出回忆。</div>';
        else {
            h += '<div class="mm-page"><div class="mm-chips">'
                + '<span>' + svg('heart', 14) + ' 聊了 ' + d.hist.length + ' 句</span>' + (d.mor ? '<span>早安 ' + d.mor + ' 次</span>' : '') + (d.nig ? '<span>晚安 ' + d.nig + ' 次</span>' : '') + (d.photos.length ? '<span>拍立得 ' + d.photos.length + ' 张</span>' : '') + (d.diary.length ? '<span>日记 ' + d.diary.length + ' 篇</span>' : '') + (d.orders.length ? '<span>一起吃了 ' + d.orders.length + ' 顿</span>' : '') + '</div>';
            const ev = [];
            if (d.firstUser) ev.push([ymd(d.firstUser.ts), '这个月我跟 ' + esc(who()) + ' 说的第一句话', '「' + esc(String(d.firstUser.content).slice(0, 40)) + '」']);
            if (d.bestDay) ev.push([d.bestDay, '聊得最久的一天', '一天说了 ' + d.byDay[d.bestDay] + ' 句，舍不得停']);
            d.days.forEach(x => ev.push([x.yearly ? (vy + '-' + String(x.date).slice(5)) : x.date, '纪念日', esc(x.name)]));
            d.vows.forEach(x => ev.push([ymd(x.doneTs || x.ts), '约定做到了', esc(x.text)]));
            d.places.forEach(x => ev.push([x.date, '一起去过', esc(x.name)]));
            d.dplans.forEach(x => ev.push([ymd(x.ts), '约会计划', esc(x.title)]));
            d.sealed.forEach(x => ev.push([ymd(x.ts), '封存了一封胶囊', cn(x.openOn) + ' 开启']));
            d.opened.forEach(x => ev.push([ymd(x.openedTs), '拆开了一封胶囊', esc(x.by === 'me' ? (x.title || '给未来的信') : who() + ' 的信')]));
            d.orders.forEach(x => ev.push([ymd(x.ts), x.mine ? '我点了外卖' : who() + ' 替我点了外卖', esc(x.item) + ' · ¥' + x.price]));
            d.photos.forEach(x => ev.push([ymd(x.ts), '拍立得：' + esc(x.scene || '一张照片'), esc(x.caption || '')]));
            d.diary.forEach(x => ev.push([x.date || ymd(x.ts), esc(who()) + ' 的日记', esc(String(x.text).slice(0, 56)) + (String(x.text).length > 56 ? '…' : '')]));
            ev.sort((a, b) => a[0] < b[0] ? -1 : 1);
            h += '<div class="mm-tl">' + ev.map(e => '<div class="mm-ev"><i>' + (+e[0].slice(8)) + '日</i><div><b>' + e[1] + '</b>' + (e[2] ? '<p>' + e[2] + '</p>' : '') + '</div></div>').join('') + '</div></div>';
        }
        const note = (L.memoNotes || {})[key];
        h += '<div class="mm-note"><div class="mm-nh"><b>' + esc(who()) + ' 的月度手记</b>' + (note ? '<button id="mbRe">重写</button>' : '') + '</div>' + (note ? '<p>' + esc(note.text).replace(/\n/g, '<br>') + '</p>' : '<p class="mm-nempty">让 ' + esc(who()) + ' 翻翻这个月，写几句心里话。</p><div class="stg-btns"><button id="mbGen">请 ' + esc(who()) + ' 写手记</button></div>') + '</div>';
        body.innerHTML = h;
        $('mbPrev').onclick = () => { vm--; if (vm < 0) { vm = 11; vy--; } render(); }; $('mbNext').onclick = () => { vm++; if (vm > 11) { vm = 0; vy++; } render(); };
        if ($('mbGen')) $('mbGen').onclick = genNote; if ($('mbRe')) $('mbRe').onclick = genNote;
    }
    async function genNote() {
        if (tab !== 'book') { tab = 'book'; render(); }
        if (!cid() || needKey()) return; const c = getChar(cid()), key = vy + '-' + pad2(vm + 1), d = monthData(c, vy, vm), btn = $('mbGen') || $('mbRe');
        if (btn) { btn.disabled = true; btn.textContent = who() + ' 在写…'; }
        const facts = ['聊天 ' + d.hist.length + ' 句（我说 ' + d.nu + '，你说 ' + d.na + '）', d.mor ? '早安打卡 ' + d.mor + ' 次' : '', d.nig ? '晚安打卡 ' + d.nig + ' 次' : '', d.bestDay ? '聊得最多的一天是 ' + cn(d.bestDay) + '（' + d.byDay[d.bestDay] + ' 句）' : '', d.days.length ? '纪念日：' + d.days.map(x => x.name).join('、') : '', d.vows.length ? '做到的约定：' + d.vows.map(x => x.text).join('、') : '', d.orders.length ? '点过的外卖：' + d.orders.map(x => x.item).join('、') : '', d.photos.length ? '你拍过的照片：' + d.photos.map(x => x.scene).join('、') : '', d.sealed.length ? '封存了 ' + d.sealed.length + ' 封时间胶囊' : '', d.opened.length ? '拆开了 ' + d.opened.length + ' 封时间胶囊' : ''].filter(Boolean).join('；');
        const sample = d.hist.filter(x => x.role === 'user' && x.content && x.content.indexOf('[') !== 0).slice(-8).map(x => '「' + String(x.content).slice(0, 36) + '」').join(' ');
        try {
            const t = await callPersona(cid(), '请你以角色本人的口吻，写一段「' + vy + '年' + (vm + 1) + '月我们的手记」，像在手账本上写给我的悄悄话，100~180 字，口语、温柔、有细节。只能依据下面的真实记录和你已知的事来写，没有的事不要编。这个月的记录：' + (facts || '几乎没有记录') + '。我这个月说过的一些话：' + (sample || '（无）') + '。只输出手记正文。', 1.0);
            const txt = String(t).trim(); if (!txt) throw new Error('empty');
            lifeUpdate(cid(), (L) => { L.memoNotes = L.memoNotes || {}; L.memoNotes[key] = { text: txt, ts: Date.now() }; }); addIntimacy(cid(), 2);
        } catch (e) { uiAlert('手记没写成功，稍后再试'); }
        if (!$('memoApp').classList.contains('hidden')) render();
    }

    // =====================================================================
    //  外卖：TA 替你点（模拟下单 + 配送进度；真实外卖请用下面的跳转）
    // =====================================================================
    const STAGES = [[0, '已下单', '等待商家接单'], [6, '商家已接单', '正在备餐'], [18, '备餐中', '后厨在忙了'], [36, '骑手已取餐', '正在往你这里赶'], [60, '已送达', '趁热吃吧']];
    const stageOf = (o) => { const s = (Date.now() - o.ts) / 1000; let i = 0; STAGES.forEach((x, k) => { if (s >= x[0]) i = k; }); return i; };
    function candidates() {
        const out = []; merchants.forEach(m => { if (m.cat !== '美食' && m.cat !== '闪购') return; (menuData[m.name] || []).forEach(d => out.push({ m: m.name, name: d.name, price: d.price })); }); return out;
    }
    function slot() { const h = new Date().getHours(); return h < 5 ? '深夜' : h < 10 ? '早餐' : h < 14 ? '午饭' : h < 17 ? '下午茶' : h < 21 ? '晚饭' : '夜宵'; }
    function localPick(cs) {
        const s = slot(), pool = cs.filter(x => s === '下午茶' ? /茶|奶昔|圣代|柠檬|可乐/.test(x.name) : s === '早餐' ? /生煎|薯条|鸡腿堡/.test(x.name) : s === '夜宵' || s === '深夜' ? /麻辣|酸辣|鸡翅|琵琶/.test(x.name) : /饭|麻辣|堡|生煎|琵琶/.test(x.name));
        const p = (pool.length ? pool : cs); return p[Math.floor(Math.random() * p.length)];
    }
    async function taPick(skip) {
        const cs = candidates().filter(x => !skip || !skip.some(k => k === x.m + '|' + x.name)), c = getChar(cid());
        if (!API_KEY) return Object.assign({}, localPick(cs), { note: '' });
        const wx = getWeather(), likes = (c.notebook || []).map(n => n.fact).slice(0, 8).join('；') || '暂无',
            last = (Lget().orders || []).slice(-3).map(o => o.item).join('、') || '无';
        const list = cs.map((x, i) => i + '. ' + x.m + '：' + x.name + ' ¥' + x.price).join('\n');
        try {
            const t = await callPersona(cid(), '现在是' + slot() + '时间' + (wx ? '，我这边天气' + wxInfo(wx.code)[0] + ' ' + wx.temp + '°' : '') + '。你要替我在外卖软件里点一份我现在最需要的，要贴心、符合你的性格和你对我的了解（我的口味记录：' + likes + '；最近点过：' + last + '，别重复）。只能从下面的菜单里选：\n' + list + '\n只输出 JSON：{"i":菜单序号,"note":"你想附在餐上的留言，像随手写的小纸条，口语、有你的语气，不超过40字"}', 1.0);
            const o = parseJSONLoose(t), x = o && cs[+o.i]; if (!x) throw new Error('bad');
            return Object.assign({}, x, { note: oneLine(o.note || '') });
        } catch (e) { return Object.assign({}, localPick(cs), { note: '' }); }
    }
    const orders = () => (Lget() || {}).orders || [];
    function trackerHtml(o) {
        const k = stageOf(o), left = Math.max(0, Math.ceil(60 - (Date.now() - o.ts) / 1000));
        return '<div class="tk-track">' + STAGES.map((s, i) => '<div class="tk-st' + (i < k ? ' done' : i === k ? ' now' : '') + '"><i></i><div><b>' + s[1] + '</b>' + (i === k ? '<small>' + s[2] + '</small>' : '') + '</div></div>').join('') + '</div>' + (k < 4 ? '<p class="hint-line" style="text-align:center">预计还有约 ' + left + ' 秒（模拟配送，加速播放）</p>' : '');
    }
    function realLinks(item) {
        return '<div class="tk-real"><p class="hint-line">想真的吃到？下面是真实外卖入口（这个小手机本身不能付款）：</p><div class="stg-btns"><button class="ghost" id="tkCopy">复制菜名</button><a class="tk-a" href="https://waimai.meituan.com/" target="_blank" rel="noopener">美团外卖</a><a class="tk-a" href="https://www.ele.me/" target="_blank" rel="noopener">饿了么</a></div></div>';
    }
    function bindCopy(item) { const b = $('tkCopy'); if (b) b.onclick = () => { try { navigator.clipboard.writeText(item); b.textContent = '已复制'; } catch (e) { uiAlert(item); } }; }
    async function taOrderFlow(skip) {
        if (!cid()) { uiAlert('请先创建并选择一个角色'); return; }
        stageOpen(who() + ' 替你点', async (b) => {
            b.innerHTML = '<div class="stg-load"><div class="spin"></div>' + esc(who()) + ' 在翻外卖软件…</div>';
            const pick = await taPick(skip); if (!b.isConnected) return;
            const key = pick.m + '|' + pick.name; skip = (skip || []).concat([key]);
            b.innerHTML = '<div class="tk-card"><small>' + esc(who()) + ' 替你选的' + slot() + '</small><h3>' + esc(pick.name) + '</h3><p>' + esc(pick.m) + ' · ¥' + pick.price + '</p>' + (pick.note ? '<div class="tk-note">' + esc(pick.note) + '<em>—— ' + esc(who()) + '</em></div>' : '') + '</div>'
                + '<div class="stg-btns"><button class="ghost" id="tkAgain">换一个</button><button id="tkGo">' + svg('bag', 16) + ' 收下，下单 ¥' + pick.price + '</button></div>' + realLinks(pick.name);
            bindCopy(pick.name); $('tkAgain').onclick = () => taOrderFlow(skip);
            $('tkGo').onclick = () => {
                const o = { id: lifeId(), ts: Date.now(), item: pick.name, merchant: pick.m, price: pick.price, note: pick.note, forMe: true };
                lifeUpdate(cid(), (L) => { L.orders = L.orders || []; L.orders.push(o); L.orders = L.orders.slice(-60); });
                try { logActivity(cid(), 'takeout', '你替我点了外卖「' + o.item + '」'); addIntimacy(cid(), 1); } catch (e) {}
                trackOrder(o.id);
            };
        }, null);
    }
    function trackOrder(id) {
        const o = orders().find(x => x.id === id); if (!o) return;
        stageOpen('配送进度', (b) => {
            const draw = () => { const cur = orders().find(x => x.id === id) || o; b.innerHTML = '<div class="tk-card slim"><h3>' + esc(cur.item) + '</h3><p>' + esc(cur.merchant) + ' · ¥' + cur.price + '</p></div>' + trackerHtml(cur) + (cur.react ? '<div class="td-react"><div class="bub-av">' + esc(who().slice(0, 1)) + '</div><div class="bub">' + esc(cur.react) + '</div></div>' : '') + realLinks(cur.item); bindCopy(cur.item); };
            draw(); const iv = setInterval(() => { if (!$('stgB') || !$('stgB').isConnected || $('stgB') !== b) { clearInterval(iv); return; } draw(); if (stageOf(orders().find(x => x.id === id) || o) >= 4 && (orders().find(x => x.id === id) || {}).react !== undefined) clearInterval(iv); }, 1000);
        }, null);
    }
    // 送达后：TA 说一句话（无论你在不在这个页面）
    const reacting = {};
    async function tickOrders() {
        try {
            const chars = getChars();
            for (const ch of chars) for (const o of (lifeOf(ch).orders || [])) {
                if (o.react !== undefined || reacting[o.id] || stageOf(o) < 4) continue; reacting[o.id] = 1;
                let r = '';
                if (API_KEY) { try { r = oneLine(await callPersona(ch.id, '我之前让你替我点的外卖「' + o.item + '」（' + o.merchant + '）刚刚送到了' + (o.note ? '，你附的留言是：「' + o.note + '」' : '') + '。请你以角色本人的口吻跟我说一句，提醒我趁热吃、问问我合不合口味，口语、温柔，不超过40字。只输出这句话。', 1.0)); } catch (e) {} }
                lifeUpdate(ch.id, (L) => { const x = (L.orders || []).find(y => y.id === o.id); if (x) x.react = r || ''; });
                if (r) { addFeed(ch.id, r, '外卖送到了'); showBanner(ch, '外卖到啦：' + r); } else showBanner(ch, '你的外卖「' + o.item + '」送到啦，趁热吃～');
            }
        } catch (e) {}
    }
    setInterval(tickOrders, 4000);

    function injectTakeout() {
        const sa = document.querySelector('#takeoutApp .scroll-area'); if (!sa || $('tkTa')) return;
        const card = document.createElement('div'); card.id = 'tkTa'; card.className = 'tk-ta';
        card.innerHTML = '<div class="tk-ta-main"><div><b>让 TA 替你点</b><small>不知道吃什么？让 TA 看看你现在需要什么</small></div><button id="tkTaGo">交给 TA</button></div><div id="tkTaHist"></div>';
        sa.insertBefore(card, sa.firstChild); $('tkTaGo').onclick = () => taOrderFlow();
        const draw = () => { const os = orders().filter(o => !o.mine).slice(-3).reverse(); $('tkTaHist').innerHTML = os.length ? os.map(o => '<div class="tk-h" data-id="' + o.id + '"><span>' + esc(o.item) + '</span><i>' + (stageOf(o) >= 4 ? '已送达' : STAGES[stageOf(o)][1]) + '</i></div>').join('') : ''; $('tkTaHist').querySelectorAll('.tk-h').forEach(e => e.onclick = () => trackOrder(e.dataset.id)); };
        draw(); new MutationObserver(() => { const a = $('takeoutApp'); if (a && !a.classList.contains('hidden')) draw(); }).observe($('takeoutApp'), { attributes: true, attributeFilter: ['class'] });
    }
    // 自己在外卖 app 里下单，也记进回忆册
    if (typeof window.placeOrder === 'function') {
        const po = window.placeOrder;
        window.placeOrder = function (item, price) {
            try { const forMe = ((document.getElementById('takeoutTarget') || {}).value || 'self') !== 'ta'; if (cid()) lifeUpdate(cid(), (L) => { L.orders = L.orders || []; L.orders.push({ id: lifeId(), ts: Date.now(), item, merchant: '', price, forMe: true, mine: true, react: '' }); L.orders = L.orders.slice(-60); }); } catch (e) {}
            return po.apply(this, arguments);
        };
    }
    ensure(); injectTakeout();
})();
