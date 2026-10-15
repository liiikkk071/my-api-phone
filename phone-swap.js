/* phone-swap.js —— 「互查手机」页面版：顶号切换
 * 我看 TA 的手机：备忘录/相册/微信/浏览器/订单/音乐/通话/健康，每个 app 都能点进去看详情（内容由 TA 的人设生成并保存）。
 * TA 看我的手机：展示你小手机里真实的聊天、相册、订单、足迹、使用时长、电量天气，由你决定开放哪些，TA 会翻看并说出感受。
 * 只新增，不改动其他功能；出错时只影响本页面。 */
(function () {
    'use strict';
    const $ = (id) => document.getElementById(id), esc = (s) => escapeHtml(String(s == null ? '' : s));
    const cid = () => getActiveCharId(), who = () => activeCharName() || 'TA';
    const Lget = () => { const c = getChar(cid()); return c ? lifeOf(c) : null; };
    const sleep = (ms) => new Promise(r => setTimeout(r, ms));
    const IC = {
        memo: 'M6 3h9l4 4v14H6zM14 3v5h5M9 12h7M9 16h7', album: 'M4 5h16v14H4zM4 16l5-5 4 4 3-3 4 4M9 9.5h.01', chat: 'M4 5h16v11H9l-5 4z',
        browser: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM3 12h18M12 3c3 3 3 15 0 18M12 3c-3 3-3 15 0 18', order: 'M5 8h14l-1 12H6zM9 8a3 3 0 0 1 6 0',
        music: 'M9 18V6l10-2v12M9 18a2.5 2.5 0 1 1-5 0 2.5 2.5 0 0 1 5 0zM19 16a2.5 2.5 0 1 1-5 0 2.5 2.5 0 0 1 5 0z', screen: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM12 7v5l3 2', health: 'M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.5A4 4 0 0 1 19 10c0 5.6-7 10-7 10z',
        call: 'M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2z', usage: 'M4 20V10M10 20V4M16 20v-7M22 20H2',
        status: 'M8 3h8a1 1 0 0 1 1 1v16a1 1 0 0 1-1 1H8a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1zM11 18h2', map: 'M9 5.5L4 7.5v11l5-2 6 2 5-2v-11l-5 2zM9 5.5v11M15 7.5v11'
    };
    const svg = (k, s) => '<svg viewBox="0 0 24 24" width="' + (s || 26) + '" height="' + (s || 26) + '" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="' + IC[k] + '"/></svg>';
    const TA_APPS = [['memo', '备忘录'], ['album', '相册'], ['chat', '微信'], ['browser', '浏览器'], ['order', '外卖购物'], ['music', '音乐'], ['call', '通话'], ['screen', '屏幕时间'], ['health', '健康']];
    const ME_APPS = [['chat', '微信'], ['album', '相册'], ['order', '订单'], ['map', '足迹'], ['usage', '使用时长'], ['status', '电量天气']];
    const SPEC = {
        memo: ['备忘录里的 4 条备忘（待办、随手记、心情碎碎念都可以，符合你的性格和近期生活，不要写给任何人看）', '{"items":[{"title":"标题8字内","text":"内容60字内","time":"MM-DD HH:mm"}]}', (o) => o.items],
        album: ['相册里最近的 6 张照片', '{"items":[{"scene":"画面描述40字内","place":"拍摄地点","time":"MM-DD HH:mm","note":"你当时的心情15字内"}]}', (o) => o.items],
        chat: ['微信里和 4 个别人（朋友/同事/家人，不是我）的聊天，每个对话 4~6 条，内容是你们的日常', '{"threads":[{"name":"对方称呼","time":"HH:mm","msgs":[{"from":"them或self","text":"内容"}]}]}', (o) => o.threads],
        browser: ['浏览器里最近的 16 条搜索或浏览记录（按时间从新到旧，跨今天/昨天/前天，生活化、符合你的兴趣和近况；偶尔可以自然出现和我有关的内容），另外还有 4 条你已经删掉的搜索记录（是你不太想被人看到的小心思或小尴尬，但要健康无害）', '{"items":[{"q":"搜索词或网页标题","day":"今天或昨天或前天","time":"HH:mm"}],"deleted":[{"q":"已删除的搜索词","day":"今天或昨天或前天","time":"HH:mm"}]}', (o) => o.items],
        order: ['外卖/购物 app 里最近 10 笔订单（是你自己买的，不是给我点的，外卖和网购都要有，价格符合真实水平）', '{"items":[{"shop":"商家","item":"商品","price":12,"type":"外卖或网购","time":"MM-DD HH:mm"}]}', (o) => o.items],
        screen: ['屏幕使用时间页面（今天的数据，要符合你的作息、职业和性格：熬夜党就让最晚在线时间很晚，工作忙就让办公类 app 占比高；hours 是 24 个数字，每个是该小时使用的分钟数 0~60，要和作息吻合；各 app 分钟数加起来约等于 total）', '{"total":总分钟数,"pickups":拿起手机次数,"latest":"最晚在线时间HH:mm","apps":[{"name":"app名","min":分钟数}],"hours":[24个数字],"note":"一句话点评你今天的手机使用，20字内"}', (o) => o.apps],
        music: ['音乐 app 里正在听的歌，以及最近播放的 6 首（要是真实存在的歌）', '{"now":"歌名 - 歌手","items":[{"song":"歌名","artist":"歌手"}]}', (o) => o.items],
        call: ['通话记录最近 5 条（对方是别人、快递、客服之类，不要是我）', '{"items":[{"name":"对方","dir":"in或out或miss","time":"MM-DD HH:mm","dur":"通话时长，未接留空"}]}', (o) => o.items]
    };
    // ---------- 接入桌面 ----------
    try {
        if (allApps.indexOf('swap') < 0) allApps.push('swap');
        if (!HOME_APPS.some(a => a.id === 'swap')) HOME_APPS.push({ id: 'swap', name: '互查手机', cls: 'swap-icon', face: '(⊙ᴗ⊙)', go: () => window.openSwap('ta') });
        GLYPH.swap = '<path d="' + IC.status + '"/><path d="M3 9l-1.5 1.5L3 12M21 12l1.5-1.5L21 9"/>';
    } catch (e) {}

    let mode = 'ta', page = null, thread = null, secret = false, booted = false, reacts = 0, busy = false;
    const sess = { chosen: false };
    // ---------- 权限（TA 看我的手机时开放哪些） ----------
    const SW_PERM = [['chat', '聊天记录'], ['album', '相册'], ['order', '订单'], ['map', '地图足迹']];
    function perm() { let p = {}; try { p = JSON.parse(store.getItem('swapPerm') || '{}'); } catch (e) {} const o = {}; SW_PERM.forEach(i => { o[i[0]] = p[i[0]] !== false; }); return o; }
    function openOf(k) {
        if (mode === 'ta') return true; const p = perm(), pk = (typeof peekPerm === 'function') ? peekPerm() : { battery: 1, net: 1, usage: 1, weather: 1 };
        if (k === 'usage') return !!pk.usage; if (k === 'status') return !!(pk.battery || pk.net || pk.weather); return p[k] !== false;
    }
    // ---------- 外壳 ----------
    function ensure() {
        if ($('swapApp')) return; const el = document.createElement('div'); el.id = 'swapApp'; el.className = 'app-screen hidden';
        el.innerHTML = '<div class="app-header"><button id="swBack">‹ 返回</button><span id="swTitle">互查手机</span><button class="hdr-btn" id="swFlip">顶号</button></div><div class="scroll-area" id="swBody"></div>';
        ($('callScreen') ? $('callScreen').parentElement : document.body).appendChild(el);
        $('swBack').onclick = () => { if (thread != null) { thread = null; renderPage(); } else if (page) { page = null; render(); } else leave(); };
        $('swFlip').onclick = () => { if (busy) return; mode = mode === 'ta' ? 'me' : 'ta'; page = null; thread = null; render(); if (mode === 'ta') ask(); };
        new MutationObserver(() => { if (!el.classList.contains('hidden')) onShow(); }).observe(el, { attributes: true, attributeFilter: ['class'] });
    }
    function leave() { try { if (typeof switchToolkitTab === 'function') { openApp('toolkit'); switchToolkitTab('peek'); return; } } catch (e) {} goHome(); }
    async function ask() {
        if (mode !== 'ta' || sess.chosen) return;
        const c = getChar(cid()); if (!c) return;
        const v = await uiChoose('你要翻看「' + c.name + '」的手机，要让 TA 知道吗？', [{ label: '让 TA 知道', v: 'know', primary: true }, { label: '偷偷看，不让 TA 知道', v: 'secret' }, { label: '算了', v: null }]);
        if (!v) { mode = 'me'; render(); return; } sess.chosen = true; secret = v === 'secret'; reacts = 0; render();
    }
    function onShow() {
        if (!cid()) { $('swBody').innerHTML = '<div class="stg-empty">先去通讯录创建并选择一个角色吧</div>'; return; }
        if (!booted) { booted = true; sess.chosen = false; } render(); if (mode === 'ta' && !sess.chosen) ask();
    }
    window.openSwap = (m) => { ensure(); mode = m === 'me' ? 'me' : 'ta'; page = null; thread = null; sess.chosen = false; booted = true; openApp('swap'); };
    const clock = () => { const d = new Date(); return pad2(d.getHours()) + ':' + pad2(d.getMinutes()); };
    function seed(str) { let h = 2166136261; for (const ch of String(str)) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); } return () => { h ^= h << 13; h ^= h >>> 17; h ^= h << 5; return ((h >>> 0) % 10000) / 10000; }; }
    function render() {
        const body = $('swBody'); if (!body) return; const c = getChar(cid()); if (!c) { body.innerHTML = '<div class="stg-empty">先去通讯录创建并选择一个角色吧</div>'; return; }
        $('swTitle').textContent = mode === 'ta' ? c.name + ' 的手机' : '我的手机';
        $('swFlip').textContent = mode === 'ta' ? '顶号 ⇄ 我的' : '顶号 ⇄ TA'; if (page) { renderPage(); return; }
        const apps = mode === 'ta' ? TA_APPS : ME_APPS, bat = mode === 'ta' ? (30 + Math.floor(seed(cid() + new Date().getHours() + todayStr())() * 60)) : ((typeof batteryNow === 'function' && batteryNow()) || {}).level;
        let h = '<div class="sw-phone"><div class="sw-st"><span>' + clock() + '</span><span>' + (mode === 'ta' ? esc(c.name) : '我') + '</span><span>' + (bat != null ? bat + '%' : '') + '</span></div><div class="sw-hello">' + (mode === 'ta' ? (secret ? '偷偷看中…' : esc(c.name) + ' 知道你在看') : 'TA 正在登录你的手机') + '</div><div class="sw-grid">'
            + apps.map(a => { const ok = openOf(a[0]); return '<button class="sw-app' + (ok ? '' : ' lock') + '" data-k="' + a[0] + '"><i>' + svg(a[0]) + (ok ? '' : '<u>锁</u>') + '</i><span>' + a[1] + '</span></button>'; }).join('') + '</div></div>';
        if (mode === 'me') {
            h += '<div class="sw-act"><button class="btn-primary" id="swBrowse">让 ' + esc(c.name) + ' 翻翻我的手机</button><button class="btn-secondary" id="swPerm">开放范围</button></div><p class="hint-line">锁住的 app TA 看不到。你也可以点开任何一个 app，看看 TA 看到的样子。</p>';
            const log = (((lifeOf(c).peek || {}).log) || []).slice(0, 5);
            h += '<p class="section-title">' + esc(c.name) + ' 翻过我的手机</p>' + (log.length ? log.map(l => '<div class="sw-log"><small>' + fmtTs(l.ts) + ' · ' + esc(l.reason || '') + (l.refused ? ' · 被我拒绝了' : '') + '</small><b>' + esc((l.saw || []).slice(0, 4).join(' · ') || '（什么都没看到）') + '</b><p>' + esc(l.say || '') + '</p></div>').join('') : '<div class="stg-empty" style="padding:12px">TA 还没有翻过</div>');
        } else h += '<p class="hint-line">点任意 app 进去看。内容是 TA 手机里本来就有的东西，生成后会保存，再次打开不会变。</p>';
        body.innerHTML = h;
        body.querySelectorAll('.sw-app').forEach(b => b.onclick = () => { if (!openOf(b.dataset.k)) { uiAlert('这个 app 你没有对 TA 开放'); return; } page = b.dataset.k; thread = null; renderPage(); });
        if (mode === 'me') { $('swBrowse').onclick = taBrowse; $('swPerm').onclick = permSheet; }
    }
    function permSheet() {
        stageOpen('开放范围', (b) => {
            const p = perm(), pk = typeof peekPerm === 'function' ? peekPerm() : {};
            b.innerHTML = '<p class="hint-line">关掉的 app，TA 就看不到里面的内容。</p>' + SW_PERM.map(i => '<div class="pk-permrow"><span>' + i[1] + '</span><input type="checkbox" class="ios-switch" data-sp="' + i[0] + '" ' + (p[i[0]] ? 'checked' : '') + '></div>').join('') + (typeof PEEK_ITEMS !== 'undefined' ? PEEK_ITEMS.map(i => '<div class="pk-permrow"><span>' + i[1] + '</span><input type="checkbox" class="ios-switch" data-pk="' + i[0] + '" ' + (pk[i[0]] ? 'checked' : '') + '></div>').join('') : '');
            b.querySelectorAll('[data-sp]').forEach(x => x.onchange = () => { const q = perm(); q[x.dataset.sp] = x.checked; store.setItem('swapPerm', JSON.stringify(q)); });
            b.querySelectorAll('[data-pk]').forEach(x => x.onchange = () => { const q = peekPerm(); q[x.dataset.pk] = x.checked; store.setItem('peekPerm', JSON.stringify(q)); });
        }, render);
    }
    // ---------- TA 手机内容（生成并保存） ----------
    async function gen(key) {
        const c = getChar(cid()), L = lifeOf(c), saved = (L.swapPhone || {})[key]; if (saved && saved.data) return saved.data;
        if (key === 'health') {
            const d = new Date(), r = seed(cid() + todayStr()), frac = (d.getHours() * 60 + d.getMinutes()) / 1440, data = { steps: Math.round(frac * 9000 + r() * 1800), sleep: (6 + r() * 2.2).toFixed(1), cal: Math.round(frac * 420 + r() * 80), hr: 62 + Math.floor(r() * 18), water: Math.min(8, Math.round(frac * 7 + r() * 2)) };
            lifeUpdate(cid(), (L2) => { L2.swapPhone = L2.swapPhone || {}; L2.swapPhone[key] = { ts: Date.now(), day: todayStr(), data }; }); return data;
        }
        if (!API_KEY) throw new Error('需要先在「设置」里填好 API Key，才能生成 TA 手机里的内容');
        const sp = SPEC[key];
        const txt = await callPersona(cid(), '【生成任务】下面是你自己手机里本来就存在的一份内容，你只是把它创作出来，并不知道、也不需要关心有没有人在看。\n要求：像手机里真实存在的东西，符合你的性格、职业和近期生活；不要对任何「看的人」说话，不要提到被查看；对话里的人不要是我。\n当前时间：' + timeContext() + '（内容里的时间要和此刻相符，不要晚于现在）\n内容：' + sp[0] + '\n只输出 JSON：' + sp[1], 1.0);
        const o = parseJSONLoose(txt), data = o && sp[2](o) ? o : null; if (!data || !(sp[2](o) || []).length) throw new Error('这次没生成成功，点右上角刷新再试');
        lifeUpdate(cid(), (L2) => { L2.swapPhone = L2.swapPhone || {}; L2.swapPhone[key] = { ts: Date.now(), data }; }); return o;
    }
    function hueOf(s) { const r = seed(s)(); return Math.floor(r * 360); }
    function pageHead(t, extra) { return '<div class="sw-ph"><b>' + t + '</b>' + (extra || '') + '</div>'; }
    function sayBox() { return '<div class="sw-say" id="swSay"></div>'; }
    async function renderPage() {
        const body = $('swBody'), k = page; if (!k) return; const apps = mode === 'ta' ? TA_APPS : ME_APPS, nm = (apps.find(a => a[0] === k) || [0, k])[1];
        $('swTitle').textContent = nm;
        body.innerHTML = '<div class="sw-pg" id="swPg"><div class="stg-load"><div class="spin"></div>打开中…</div></div>' + sayBox();
        const pg = $('swPg');
        try {
            let html;
            if (mode === 'ta') {
                const data = await gen(k); if (page !== k) return; html = taHtml(k, data);
                if (k !== 'health') html += '<div class="stg-btns"><button class="ghost" id="swRef">换一批内容</button></div>';
            } else html = meHtml(k);
            pg.innerHTML = html; bindPage(k);
            if (mode === 'ta' && !secret && thread == null) knowReact(k);
        } catch (e) { pg.innerHTML = '<div class="stg-empty">' + esc(e.message || '出错了') + '</div>'; }
    }
    function bindPage(k) {
        const pg = $('swPg'); if (!pg) return;
        pg.querySelectorAll('[data-th]').forEach(e => e.onclick = () => { thread = +e.dataset.th; renderPage(); });
        pg.querySelectorAll('[data-ph]').forEach(e => e.onclick = () => photoView(+e.dataset.ph));
        pg.querySelectorAll('[data-dl]').forEach(e => e.onclick = () => e.classList.toggle('open'));
        pg.querySelectorAll('[data-nt]').forEach(e => e.onclick = () => e.classList.toggle('open'));
        const r = $('swRef'); if (r) r.onclick = async () => { if (needKey()) return; lifeUpdate(cid(), (L) => { if (L.swapPhone) delete L.swapPhone[k]; }); renderPage(); };
    }
    function taHtml(k, o) {
        if (k === 'memo') return pageHead('备忘录 · ' + o.items.length + ' 条') + o.items.map(m => '<div class="sw-note" data-nt="1"><b>' + esc(m.title) + '</b><small>' + esc(m.time) + '</small><p>' + esc(m.text) + '</p></div>').join('');
        if (k === 'album') return pageHead('相册 · 最近') + '<div class="sw-photos">' + o.items.map((p, i) => '<button class="sw-ph-t" data-ph="' + i + '" style="--h:' + hueOf(p.scene) + '"><span>' + esc(String(p.scene).slice(0, 14)) + '</span><i>' + esc(p.time) + '</i></button>').join('') + '</div>';
        if (k === 'chat') {
            if (thread != null && o.threads[thread]) { const t = o.threads[thread]; return pageHead(esc(t.name)) + '<div class="sw-chat">' + (t.msgs || []).map(m => '<div class="sw-b ' + (m.from === 'self' ? 'self' : '') + '">' + esc(m.text) + '</div>').join('') + '</div>'; }
            return pageHead('微信') + o.threads.map((t, i) => '<div class="sw-row" data-th="' + i + '"><i style="--h:' + hueOf(t.name) + '">' + esc(String(t.name).slice(0, 1)) + '</i><div><b>' + esc(t.name) + '</b><p>' + esc(((t.msgs || []).slice(-1)[0] || {}).text || '') + '</p></div><small>' + esc(t.time || '') + '</small></div>').join('');
        }
        if (k === 'browser') {
            const days = ['今天', '昨天', '前天'], grp = {}; o.items.forEach(b => { const d = days.includes(b.day) ? b.day : '更早'; (grp[d] = grp[d] || []).push(b); });
            const del = (o.deleted || []).filter(x => x && x.q);
            return pageHead('浏览记录 · ' + o.items.length + ' 条') + days.concat(['更早']).filter(d => grp[d]).map(d => '<div class="sw-day">' + d + '</div>' + grp[d].map(b => '<div class="sw-line"><span>' + svg('browser', 16) + '</span><b>' + esc(b.q) + '</b><small>' + esc(b.time) + '</small></div>').join('')).join('')
                + (del.length ? '<div class="sw-del" data-dl="1"><div class="sw-delh"><b>最近删除（' + del.length + '）</b><small>点开看看 TA 删掉了什么</small></div><div class="sw-delb">' + del.map(b => '<div class="sw-line miss"><span>' + svg('browser', 16) + '</span><b>' + esc(b.q) + '</b><small>' + esc(b.day || '') + ' ' + esc(b.time || '') + '</small></div>').join('') + '</div></div>' : '');
        }
        if (k === 'order') {
            const tot = o.items.reduce((a, b) => a + (parseFloat(b.price) || 0), 0), ft = o.items.filter(b => b.type === '外卖'), ot = o.items.filter(b => b.type !== '外卖');
            return pageHead('购买记录 · ' + o.items.length + ' 笔') + '<div class="sw-kv k3"><div><b>¥' + Math.round(tot) + '</b><small>累计花费</small></div><div><b>' + ft.length + '</b><small>外卖</small></div><div><b>' + ot.length + '</b><small>网购</small></div></div>' + o.items.map(b => '<div class="sw-order"><b>' + esc(b.item) + '</b><small>' + esc(b.type === '外卖' ? '外卖' : '网购') + ' · ' + esc(b.shop) + ' · ' + esc(b.time) + '</small><em>¥' + esc(b.price) + '</em></div>').join('');
        }
        if (k === 'screen') {
            const apps = (o.apps || []).slice(0, 8), mx = Math.max(1, ...apps.map(a => +a.min || 0)), hrs = (Array.isArray(o.hours) && o.hours.length === 24 ? o.hours : new Array(24).fill(0)).map(v => Math.max(0, Math.min(60, +v || 0))), hm = Math.max(10, ...hrs), tot = +o.total || apps.reduce((a, b) => a + (+b.min || 0), 0);
            return pageHead('屏幕使用时间') + '<div class="sw-kv k3"><div><b>' + (tot >= 60 ? Math.floor(tot / 60) + 'h' + (tot % 60) : tot + 'm') + '</b><small>今日总时长</small></div><div><b>' + esc(o.pickups || '—') + '</b><small>拿起次数</small></div><div><b>' + esc(o.latest || '—') + '</b><small>最晚在线</small></div></div><div class="sw-bars">' + hrs.map((v, h) => '<i style="height:' + Math.max(3, Math.round(v / hm * 100)) + '%" title="' + h + '点"></i>').join('') + '</div><div class="sw-axis"><span>0</span><span>6</span><span>12</span><span>18</span><span>24</span></div>'
                + pageHead('应用使用排行') + apps.map(a => '<div class="sw-ub"><div><b>' + esc(a.name) + '</b><small>' + (a.min >= 60 ? Math.floor(a.min / 60) + '小时' + (a.min % 60) + '分' : a.min + '分钟') + '</small></div><i><u style="width:' + Math.round((+a.min || 0) / mx * 100) + '%"></u></i></div>').join('') + (o.note ? '<p class="hint-line">' + esc(o.note) + '</p>' : '');
        }
        if (k === 'music') return pageHead('正在听') + '<div class="sw-now"><div class="sw-disc"></div><b>' + esc(o.now || '') + '</b></div>' + pageHead('最近播放') + (o.items || []).map((m, i) => '<div class="sw-line"><span>' + (i + 1) + '</span><b>' + esc(m.song) + '</b><small>' + esc(m.artist) + '</small></div>').join('');
        if (k === 'call') return pageHead('通话记录') + o.items.map(m => '<div class="sw-line ' + (m.dir === 'miss' ? 'miss' : '') + '"><span>' + svg('call', 16) + '</span><b>' + esc(m.name) + '</b><small>' + (m.dir === 'in' ? '呼入' : m.dir === 'out' ? '呼出' : '未接') + ' · ' + esc(m.time) + (m.dur ? ' · ' + esc(m.dur) : '') + '</small></div>').join('');
        if (k === 'health') { const g = Math.min(100, Math.round(o.steps / 100)); return pageHead('今日健康') + '<div class="sw-ring" style="--p:' + g + '"><b>' + o.steps + '</b><small>步</small></div><div class="sw-kv"><div><b>' + o.sleep + 'h</b><small>昨晚睡眠</small></div><div><b>' + o.cal + '</b><small>千卡</small></div><div><b>' + o.hr + '</b><small>静息心率</small></div><div><b>' + o.water + '/8</b><small>喝水（杯）</small></div></div>'; }
        return '';
    }
    function photoView(i) {
        const o = ((((Lget() || {}).swapPhone || {}).album || {}).data || {}).items || [], p = o[i]; if (!p) return;
        stageOpen('照片', (b) => { b.innerHTML = '<div class="sw-bigph" style="--h:' + hueOf(p.scene) + '"><span>' + esc(p.scene) + '</span></div><div class="mp-detail"><small>' + esc(p.time) + (p.place ? ' · ' + esc(p.place) : '') + '</small></div>' + (p.note ? '<p class="mp-note">心情：' + esc(p.note) + '</p>' : ''); }, null);
    }
    // ---------- 我的手机（真实数据） ----------
    function meHtml(k) {
        const c = getChar(cid()), L = lifeOf(c);
        if (k === 'chat') {
            const cs = getChars();
            if (thread != null && cs[thread]) { const h = (cs[thread].chatHistory || []).slice(-14); return pageHead(esc(cs[thread].name)) + '<div class="sw-chat">' + (h.length ? h.map(m => '<div class="sw-b ' + (m.role === 'user' ? 'self' : '') + '">' + esc(String(m.content || '').slice(0, 160)) + '</div>').join('') : '<div class="stg-empty">还没有聊天</div>') + '</div>'; }
            return pageHead('微信') + cs.map((x, i) => { const last = (x.chatHistory || []).slice(-1)[0]; return '<div class="sw-row" data-th="' + i + '"><i style="--h:' + hueOf(x.name) + '">' + esc(x.name.slice(0, 1)) + '</i><div><b>' + esc(x.name) + '</b><p>' + esc(last ? String(last.content || '').slice(0, 30) : '暂无消息') + '</p></div></div>'; }).join('');
        }
        if (k === 'album') { const ps = (L.photos || []).slice(-9).reverse(); return pageHead('相册') + (ps.length ? '<div class="sw-photos">' + ps.map((p, i) => '<button class="sw-ph-t" style="--h:' + hueOf(p.scene || p.caption || i) + '"><span>' + esc(String(p.scene || p.caption || '').slice(0, 14)) + '</span><i>' + esc(p.caption ? String(p.caption).slice(0, 10) : '') + '</i></button>').join('') + '</div>' : '<div class="stg-empty">相册还是空的</div>'); }
        if (k === 'order') { const os = (L.orders || []).slice(-8).reverse(); return pageHead('订单') + (os.length ? os.map(o => '<div class="sw-order"><b>' + esc(o.item) + '</b><small>' + (o.mine ? '我点的' : esc(c.name) + ' 替我点的') + ' · ' + fmtTs(o.ts) + '</small><em>¥' + esc(o.price) + '</em></div>').join('') : '<div class="stg-empty">还没有订单</div>'); }
        if (k === 'map') { const ps = (L.places || []).slice(-8).reverse(); return pageHead('我们的足迹 · ' + (L.places || []).length) + (ps.length ? ps.map(p => '<div class="sw-line"><span>' + svg('map', 16) + '</span><b>' + esc(p.name) + '</b><small>' + ({ went: '去过', want: '想去', mark: '纪念' }[p.type] || '') + '</small></div>').join('') : '<div class="stg-empty">还没有地点</div>'); }
        if (k === 'usage') { const u = usageStats(), mx = Math.max(1, ...u.hours); return pageHead('今日使用 ' + fmtMin(u.totalMin)) + '<div class="sw-bars">' + u.hours.map((v, h) => '<i style="height:' + Math.max(3, Math.round(v / mx * 100)) + '%" title="' + h + '点"></i>').join('') + '</div><div class="sw-axis"><span>0</span><span>6</span><span>12</span><span>18</span><span>24</span></div><div class="sw-kv"><div><b>' + u.opens + '</b><small>今日打开</small></div><div><b>' + u.curMin + '</b><small>本次连续(分)</small></div><div><b>' + (u.latestNight ? pad2(new Date(u.latestNight).getHours()) + ':' + pad2(new Date(u.latestNight).getMinutes()) : '无') + '</b><small>最近熬夜</small></div></div>'; }
        if (k === 'status') { const s = peekSnapshot(false); return pageHead('电量 / 网络 / 天气') + (s.saw.length ? s.saw.map(t => '<div class="sw-line"><span>•</span><b>' + esc(t) + '</b></div>').join('') : '<div class="stg-empty">没有开放的项目或暂时读不到</div>'); }
        return '';
    }
    // ---------- 我看 TA 手机：让 TA 知道时的反应 ----------
    async function knowReact(k) {
        if (!API_KEY || reacts >= 3) return; reacts++; const id = cid(), c = getChar(id), nm = (TA_APPS.find(a => a[0] === k) || [0, k])[1];
        try { logActivity(id, 'peek', '我当着你的面翻看了你手机里的' + nm); bumpMood(id, -1); } catch (e) {}
        try {
            const r = oneLine(await callPersona(id, '我刚刚当着你的面翻开了你手机里的「' + nm + '」，看到了：' + sumTa(k).slice(0, 260) + '。请你以角色本人的口吻反应：可以害羞、嘴硬、吃醋、无奈或大方，取决于你的性格和内容；口语，1~2句，不超过50字；只输出这句话。', 1.0));
            if (!r) return; pushHistory(id, { role: 'assistant', content: r }); try { renderChatList(); } catch (e) {}
            const b = $('swSay'); if (b && page === k) b.innerHTML = '<div class="td-react"><div class="bub-av">' + esc(c.name.slice(0, 1)) + '</div><div class="bub">' + esc(r) + '</div></div>';
        } catch (e) {}
    }
    function sumTa(k) { const o = (((Lget() || {}).swapPhone || {})[k] || {}).data || {}; try { return JSON.stringify(o).replace(/[{}"\[\]]/g, ' ').replace(/\s+/g, ' '); } catch (e) { return ''; } }
    function sumMe(k) {
        const c = getChar(cid()), L = lifeOf(c);
        if (k === 'chat') return getChars().map(x => x.name + '：' + (((x.chatHistory || []).slice(-1)[0] || {}).content || '暂无').slice(0, 24)).join('；');
        if (k === 'album') return (L.photos || []).slice(-4).map(p => p.scene || p.caption).join('、') || '相册是空的';
        if (k === 'order') return (L.orders || []).slice(-4).map(o => o.item).join('、') || '没有订单';
        if (k === 'map') return (L.places || []).slice(-5).map(p => p.name).join('、') || '没有足迹';
        if (k === 'usage') { const u = usageStats(); return '今天用了' + fmtMin(u.totalMin) + '，打开' + u.opens + '次' + (u.latestNight ? '，最近熬夜到' + pad2(new Date(u.latestNight).getHours()) + '点' : ''); }
        if (k === 'status') return peekSnapshot(false).saw.join('，');
        return '';
    }
    // ---------- TA 翻我的手机 ----------
    async function taBrowse() {
        if (needKey() || busy) return; const id = cid(), c = getChar(id), open = ME_APPS.filter(a => openOf(a[0]));
        if (!open.length) { uiAlert('你没有开放任何 app，TA 没得看哦（点「开放范围」打开）'); return; }
        busy = true; $('swBrowse').disabled = true; $('swBrowse').textContent = c.name + ' 拿起了你的手机…';
        const pick = open.slice().sort(() => Math.random() - .5).slice(0, Math.min(3, open.length)), seen = [];
        try { await fetchWeather(false); } catch (e) {}
        for (const a of pick) {
            const btn = document.querySelector('.sw-app[data-k="' + a[0] + '"]'); if (btn) btn.classList.add('tap');
            await sleep(700); page = a[0]; thread = null; renderPage(); await sleep(2200); seen.push(a);
            page = null; thread = null; render(); await sleep(300);
        }
        const sums = seen.map(a => '【' + a[1] + '】' + sumMe(a[0]).slice(0, 160)).join('\n'); let res = null;
        try { res = parseJSONLoose(await callPersona(id, timeContext() + '\n你刚刚拿起我的手机，依次翻看了下面几个 app（这是真实内容）：\n' + sums + '\n请以你的人设和我们的关系，对看到的东西自然地做出反应：口语，可以关心、吃醋、调侃或唠叨，不要说"数据""系统"。只输出 JSON：{"say":"总的来说你发给我的一两句话","each":{' + seen.map(a => '"' + a[0] + '":"对这个app的一句感受(20字内)"').join(',') + '}}', 1.0)); } catch (e) {}
        const say = res && String(res.say || '').trim(), each = (res && res.each) || {};
        busy = false;
        if (!say) { uiAlert('这次 TA 没来得及说话，稍后再试'); render(); return; }
        pushHistory(id, { role: 'assistant', content: say }); try { renderChatList(); } catch (e) {}
        peekRecord(id, { ts: Date.now(), reason: '你让我翻你的手机', saw: seen.map(a => a[1]), say: say, act: '' }); try { bumpMood(id, 1); addIntimacy(id, 1); } catch (e) {}
        render();
        stageOpen('TA 的感受', (b) => { b.innerHTML = seen.map(a => '<p class="hint-line" style="margin:10px 0 4px">看了「' + a[1] + '」</p><div class="td-react"><div class="bub-av">' + esc(c.name.slice(0, 1)) + '</div><div class="bub">' + esc(each[a[0]] || '……') + '</div></div>').join('') + '<div class="td-react" style="margin-top:12px"><div class="bub-av">' + esc(c.name.slice(0, 1)) + '</div><div class="bub">' + esc(say) + '</div></div><p class="hint-line">这句话也已经发到聊天里了。</p>'; }, null);
    }
    // ---------- 入口：查岗页面里加按钮（不改动原有逻辑） ----------
    function patchPeekEntry() {
        try {
            if (typeof renderPeek === 'function' && !renderPeek.__sw) {
                const old = renderPeek; const nf = function () { old.apply(this, arguments); try { const box = document.getElementById('mcpPeekBody'); if (box && !box.querySelector('#swEnterMe') && box.firstChild) { const d = document.createElement('div'); d.className = 'sw-entry'; d.innerHTML = '<button class="btn-primary" id="swEnterMe">打开我的手机页面，让 TA 翻</button><button class="btn-secondary" id="swEnterTa">去看 TA 的手机</button>'; box.insertBefore(d, box.firstChild); d.querySelector('#swEnterMe').onclick = () => window.openSwap('me'); d.querySelector('#swEnterTa').onclick = () => window.openSwap('ta'); } } catch (e) {} }; nf.__sw = 1; window.renderPeek = nf; try { renderPeek = nf; } catch (e) {}
            }
            const tp = document.getElementById('toolkitPeek');
            if (tp && !tp.querySelector('#swToolBtn')) { const b = document.createElement('button'); b.id = 'swToolBtn'; b.className = 'btn-primary'; b.style.margin = '0 0 12px'; b.textContent = '进入 TA 的手机（页面版，可顶号）'; b.onclick = () => window.openSwap('ta'); tp.insertBefore(b, tp.firstChild); }
        } catch (e) {}
    }
    ensure(); patchPeekEntry();
})();
