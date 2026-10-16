/* shop-extra.js —— 外卖 / 淘宝的扩展：① 自己编辑商品、商家 ② TA 会主动给你买东西（外卖/网购）③ 「TA送我的」列表。
   数据都在你自己的浏览器里。买家/收礼人方向在所有提示词里都写死，不会搞反。 */
(function () {
    'use strict';
    if (typeof products === 'undefined' || typeof merchants === 'undefined') return;
    const $ = (id) => document.getElementById(id), esc = (s) => escapeHtml(String(s == null ? '' : s));
    const KP = 'customProducts', KM = 'customMerchants';
    const ld = (k) => { try { return JSON.parse(store.getItem(k) || '[]') || []; } catch (e) { return []; } };
    const sv = (k, v) => { try { store.setItem(k, JSON.stringify(v)); } catch (e) { uiAlert('保存失败：存储空间不足'); } };
    const uid = () => Date.now() % 1e9 + Math.floor(Math.random() * 1000);
    const KAO = ['(´･ᴗ･)', '(｡•ᴗ•)', '(✿˘ᴗ˘)', '(＾▽＾)', '(ﾉ´ヮ`)', '(๑˃ᴗ˂)', '(｡･ω･｡)', '(◍•ᴗ•◍)'];
    const pick = (a) => a[Math.floor(Math.random() * a.length)];

    // ---------- 样式 ----------
    const st = document.createElement('style');
    st.textContent = '.tc-ic{width:44px;height:44px;border-radius:15px;display:flex;align-items:center;justify-content:center;background:color-mix(in srgb,var(--theme-color) 13%,var(--card-bg));color:var(--theme-color);border:1px solid color-mix(in srgb,var(--theme-color) 18%,transparent);transition:all .15s}'
        + '.tc-ic svg{width:23px;height:23px;fill:none;stroke:currentColor;stroke-width:1.7;stroke-linecap:round;stroke-linejoin:round}'
        + '.takeout-cat:active .tc-ic{transform:scale(.93)}.takeout-cat.active .tc-ic{background:var(--theme-color);color:var(--on-accent,#fff);border-color:transparent}'
        + '.sx-mask{position:absolute;inset:0;z-index:600;background:rgba(0,0,0,.38);display:flex;align-items:flex-end;animation:sxFade .18s}@keyframes sxFade{from{opacity:0}to{opacity:1}}'
        + '.sx-sheet{width:100%;max-height:86%;background:var(--card-bg);color:var(--theme-dark);border-radius:22px 22px 0 0;display:flex;flex-direction:column;animation:sxUp .22s ease-out;padding-bottom:18px}@keyframes sxUp{from{transform:translateY(40px)}to{transform:none}}'
        + '.sx-h{display:flex;align-items:center;justify-content:space-between;padding:16px 18px 8px;font-size:16px}.sx-x{border:none;background:none;font-size:18px;color:var(--text-sub);cursor:pointer;padding:2px 6px}'
        + '.sx-b{overflow-y:auto;padding:4px 18px 8px}.sx-f{padding:6px 18px 0;display:flex;gap:10px}'
        + '.sx-f button,.sx-btn{flex:1;border:none;border-radius:14px;padding:12px;font-size:15px;cursor:pointer;background:linear-gradient(135deg,var(--theme-color),var(--accent2));color:var(--on-accent,#fff)}'
        + '.sx-btn.ghost{background:color-mix(in srgb,var(--theme-color) 12%,var(--card-bg));color:var(--theme-color)}.sx-btn.sm{padding:6px 12px;font-size:12px;flex:none;border-radius:10px}'
        + '.sx-row{display:flex;flex-direction:column;gap:4px;margin:10px 0}.sx-row label{font-size:12px;color:var(--text-sub)}'
        + '.sx-row input,.sx-row textarea,.sx-row select{border:1px solid var(--border-color);background:var(--bg-color);color:var(--theme-dark);border-radius:12px;padding:10px 12px;font-size:14px;font-family:inherit;width:100%}.sx-row textarea{min-height:92px;resize:vertical}'
        + '.sx-chk{display:flex;align-items:center;gap:8px;font-size:14px;margin:12px 0}.sx-chk input{width:18px;height:18px}'
        + '.sx-item{display:flex;align-items:center;gap:10px;padding:10px 0;border-bottom:.5px solid var(--border-color);font-size:14px}.sx-item .t{flex:1;min-width:0}.sx-item .t b{display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.sx-item .t small{color:var(--text-sub);font-size:12px}'
        + '.sx-item .ic{width:38px;height:38px;border-radius:12px;background:var(--bg-color);display:flex;align-items:center;justify-content:center;font-size:11px;flex-shrink:0}'
        + '.sx-empty{text-align:center;color:var(--text-sub);font-size:13px;padding:22px 0}.sx-tip{font-size:12px;color:var(--text-sub);line-height:1.6;margin:6px 0}'
        + '.mine-card{background:var(--card-bg);border-radius:18px;padding:14px;margin:0 10px 10px;display:flex;gap:12px}.mine-card .mi{width:46px;height:46px;border-radius:14px;background:color-mix(in srgb,var(--theme-color) 12%,var(--card-bg));color:var(--theme-color);display:flex;align-items:center;justify-content:center;flex-shrink:0}.mine-card .mi svg{width:24px;height:24px;fill:none;stroke:currentColor;stroke-width:1.7;stroke-linecap:round;stroke-linejoin:round}'
        + '.mine-card b{font-size:14px}.mine-card p{font-size:13px;margin-top:4px;line-height:1.5}.mine-card small{color:var(--text-sub);font-size:11px}';
    document.head.appendChild(st);

    // ---------- 弹层 ----------
    function openPanel(title, render) {
        const m = document.createElement('div'); m.className = 'sx-mask';
        m.innerHTML = '<div class="sx-sheet"><div class="sx-h"><b>' + esc(title) + '</b><button class="sx-x">✕</button></div><div class="sx-b"></div><div class="sx-f"></div></div>';
        (document.querySelector('.phone') || document.body).appendChild(m);
        const body = m.querySelector('.sx-b'), foot = m.querySelector('.sx-f');
        const close = () => { m.remove(); };
        m.querySelector('.sx-x').onclick = close; m.addEventListener('click', (e) => { if (e.target === m) close(); });
        render(body, foot, close); return { m, body, foot, close };
    }
    function formSheet(title, fields, okText) {
        return new Promise((resolve) => {
            let done = false; const fin = (v) => { if (done) return; done = true; resolve(v); };
            const p = openPanel(title, (body, foot, close) => {
                body.innerHTML = fields.map((f) => {
                    if (f.type === 'check') return '<label class="sx-chk"><input type="checkbox" data-k="' + f.k + '"' + (f.value ? ' checked' : '') + '>' + esc(f.label) + '</label>';
                    let ctl;
                    if (f.type === 'textarea') ctl = '<textarea data-k="' + f.k + '" placeholder="' + esc(f.ph || '') + '">' + esc(f.value || '') + '</textarea>';
                    else if (f.type === 'select') ctl = '<select data-k="' + f.k + '">' + f.options.map((o) => '<option value="' + esc(o[0]) + '"' + (o[0] === f.value ? ' selected' : '') + '>' + esc(o[1]) + '</option>').join('') + '</select>';
                    else ctl = '<input data-k="' + f.k + '" type="' + (f.type || 'text') + '"' + (f.type === 'number' ? ' step="0.01" inputmode="decimal"' : '') + ' value="' + esc(f.value == null ? '' : f.value) + '" placeholder="' + esc(f.ph || '') + '">';
                    return '<div class="sx-row"><label>' + esc(f.label) + '</label>' + ctl + '</div>';
                }).join('') + (fields.tip ? '<p class="sx-tip">' + esc(fields.tip) + '</p>' : '');
                foot.innerHTML = '<button class="sx-btn">' + (okText || '保存') + '</button>';
                foot.firstChild.onclick = () => { const o = {}; body.querySelectorAll('[data-k]').forEach((el) => { o[el.dataset.k] = el.type === 'checkbox' ? el.checked : el.value; }); close(); fin(o); };
            });
            const obs = new MutationObserver(() => { if (!document.body.contains(p.m)) { obs.disconnect(); fin(null); } }); obs.observe(document.querySelector('.phone') || document.body, { childList: true });
        });
    }

    // ---------- 把自定义内容并入原有数据 ----------
    function sync() {
        [products, gifts, merchants].forEach((a) => { for (let i = a.length - 1; i >= 0; i--) if (a[i].custom) a.splice(i, 1); });
        Object.keys(menuData).forEach((k) => { if (menuData[k] && menuData[k].custom) delete menuData[k]; });
        ld(KP).forEach((p) => { (p.cat === 'gift' ? gifts : products).push({ id: p.id, title: p.title, price: +p.price || 0, sales: p.sales || '新品', img: p.img || KAO[0], tag: p.tag || '自选', custom: true }); });
        ld(KM).forEach((m) => {
            const ds = (m.dishes || []).filter((d) => d.name);
            merchants.push({ cat: m.cat || '美食', name: m.name, desc: m.desc || '自己开的小店', price: String(ds.length ? Math.min.apply(null, ds.map((d) => +d.price || 0)) : 0), img: m.img || KAO[1], custom: true });
            const arr = ds.map((d, i) => ({ name: d.name, price: +d.price || 0, sales: '自家', img: KAO[i % KAO.length] })); arr.custom = true; menuData[m.name] = arr;
        });
        try { renderMerchants(); } catch (e) {}
        try { const pl = $('productList'), gl = $('giftList'); if (pl && !pl.classList.contains('hidden')) renderProducts(products, 'productList'); if (gl && !gl.classList.contains('hidden')) renderProducts(gifts, 'giftList'); } catch (e) {}
    }

    // ---------- 淘宝：商品管理 ----------
    async function editProduct(p) {
        const v = await formSheet(p ? '编辑商品' : '新增商品', [
            { k: 'title', label: '商品名', value: p ? p.title : '', ph: '例如：奶油色针织开衫' },
            { k: 'price', label: '价格（元）', type: 'number', value: p ? p.price : '' },
            { k: 'cat', label: '放在哪个栏目', type: 'select', value: p ? p.cat : 'rec', options: [['rec', '推荐（我自己买）'], ['gift', '给TA挑礼物']] },
            { k: 'tag', label: '标签（可不填）', value: p ? p.tag : '', ph: '例如：新品 / 手工 / 限量' },
            { k: 'sales', label: '已售（可不填）', value: p ? p.sales : '', ph: '例如：999+' },
            { k: 'img', label: '图标颜文字（可不填）', value: p ? p.img : '', ph: '例如：(´･ᴗ･)' }
        ]);
        if (!v) return false;
        if (!v.title.trim()) { uiAlert('商品名不能为空'); return false; }
        const arr = ld(KP), item = { id: p ? p.id : 10000 + uid(), title: v.title.trim().slice(0, 30), price: Math.max(0, +v.price || 0), cat: v.cat, tag: (v.tag || '').trim().slice(0, 6) || '自选', sales: (v.sales || '').trim() || '新品', img: (v.img || '').trim() || pick(KAO) };
        const i = arr.findIndex((x) => x.id === item.id); if (i >= 0) arr[i] = item; else arr.unshift(item);
        sv(KP, arr); sync(); return true;
    }
    function manageProducts() {
        const draw = (body, foot, close) => {
            const arr = ld(KP);
            body.innerHTML = '<p class="sx-tip">在这里添加你自己的商品，它们会出现在「推荐」或「给TA挑礼物」里，TA 主动给你买东西时也可能会选到。</p>'
                + (arr.length ? arr.map((p) => '<div class="sx-item"><div class="ic">' + esc(p.img) + '</div><div class="t"><b>' + esc(p.title) + '</b><small>¥' + esc(p.price) + ' · ' + (p.cat === 'gift' ? '礼物' : '推荐') + '</small></div><button class="sx-btn sm ghost" data-e="' + p.id + '">编辑</button><button class="sx-btn sm ghost" data-d="' + p.id + '">删除</button></div>').join('') : '<div class="sx-empty">还没有自己的商品</div>')
                + '<div class="sx-chk" style="margin-top:14px"><input type="checkbox" id="sxTaBuy"' + (taBuyOn() ? ' checked' : '') + '><label for="sxTaBuy">允许 TA 主动给我买东西（外卖 / 网购）</label></div>'
                + '<button class="sx-btn ghost" id="sxTaNow" style="width:100%;margin-top:6px">让 TA 现在就给我买点什么</button>';
            foot.innerHTML = '<button class="sx-btn" id="sxAdd">＋ 新增商品</button>';
            foot.querySelector('#sxAdd').onclick = async () => { if (await editProduct(null)) draw(body, foot, close); };
            body.querySelectorAll('[data-e]').forEach((b) => b.onclick = async () => { const p = ld(KP).find((x) => x.id === +b.dataset.e); if (p && await editProduct(p)) draw(body, foot, close); });
            body.querySelectorAll('[data-d]').forEach((b) => b.onclick = async () => { if (!(await uiConfirm('删除这个商品吗？', { ok: '删除' }))) return; sv(KP, ld(KP).filter((x) => x.id !== +b.dataset.d)); sync(); draw(body, foot, close); });
            body.querySelector('#sxTaBuy').onchange = (e) => store.setItem('taBuyOn', e.target.checked ? '1' : '0');
            body.querySelector('#sxTaNow').onclick = () => { close(); taBuy(true); };
        };
        openPanel('我的商品', draw);
    }

    // ---------- 外卖：商家管理 ----------
    async function editMerchant(m) {
        const v = await formSheet(m ? '编辑商家' : '新增商家', [
            { k: 'name', label: '商家名', value: m ? m.name : '', ph: '例如：我家小厨房' },
            { k: 'cat', label: '分类', type: 'select', value: m ? m.cat : '美食', options: [['美食', '美食'], ['团购', '团购'], ['闪购', '闪购'], ['买药', '买药']] },
            { k: 'desc', label: '一句话介绍（可不填）', value: m ? m.desc : '' },
            { k: 'dishes', label: '菜品（每行一个：名称 价格）', type: 'textarea', value: m ? (m.dishes || []).map((d) => d.name + ' ' + d.price).join('\n') : '', ph: '黄焖鸡米饭 18\n冰美式 9.9\n草莓蛋糕 26' },
            { k: 'img', label: '图标颜文字（可不填）', value: m ? m.img : '' }
        ]);
        if (!v) return false;
        const name = v.name.trim(); if (!name) { uiAlert('商家名不能为空'); return false; }
        const ds = v.dishes.split('\n').map((l) => l.trim()).filter(Boolean).map((l) => { const mt = /^(.+?)[\s,，:：]+(\d+(?:\.\d+)?)\s*(?:元|块)?$/.exec(l); return mt ? { name: mt[1].trim(), price: +mt[2] } : null; }).filter(Boolean);
        if (!ds.length) { uiAlert('至少写一个菜品，格式：名称 价格'); return false; }
        const arr = ld(KM);
        if ((merchants.some((x) => x.name === name && !x.custom)) || arr.some((x) => x.name === name && (!m || x.id !== m.id))) { uiAlert('已经有同名商家了，换个名字吧'); return false; }
        const item = { id: m ? m.id : uid(), name: name.slice(0, 14), cat: v.cat, desc: (v.desc || '').trim().slice(0, 20), dishes: ds.slice(0, 30), img: (v.img || '').trim() || pick(KAO) };
        const i = arr.findIndex((x) => x.id === item.id); if (i >= 0) arr[i] = item; else arr.unshift(item);
        sv(KM, arr); sync(); return true;
    }
    function manageMerchants() {
        const draw = (body, foot, close) => {
            const arr = ld(KM);
            body.innerHTML = '<p class="sx-tip">在这里开你自己的小店、加你们爱吃的菜，TA 主动给你点外卖时也可能会选到。</p>'
                + (arr.length ? arr.map((m) => '<div class="sx-item"><div class="ic">' + esc(m.img) + '</div><div class="t"><b>' + esc(m.name) + '</b><small>' + esc(m.cat) + ' · ' + m.dishes.length + ' 个菜品</small></div><button class="sx-btn sm ghost" data-e="' + m.id + '">编辑</button><button class="sx-btn sm ghost" data-d="' + m.id + '">删除</button></div>').join('') : '<div class="sx-empty">还没有自己的商家</div>')
                + '<div class="sx-chk" style="margin-top:14px"><input type="checkbox" id="sxTaBuy"' + (taBuyOn() ? ' checked' : '') + '><label for="sxTaBuy">允许 TA 主动给我买东西（外卖 / 网购）</label></div>'
                + '<button class="sx-btn ghost" id="sxTaNow" style="width:100%;margin-top:6px">让 TA 现在就给我点点什么</button>';
            foot.innerHTML = '<button class="sx-btn" id="sxAdd">＋ 新增商家</button>';
            foot.querySelector('#sxAdd').onclick = async () => { if (await editMerchant(null)) draw(body, foot, close); };
            body.querySelectorAll('[data-e]').forEach((b) => b.onclick = async () => { const m = ld(KM).find((x) => x.id === +b.dataset.e); if (m && await editMerchant(m)) draw(body, foot, close); });
            body.querySelectorAll('[data-d]').forEach((b) => b.onclick = async () => { if (!(await uiConfirm('删除这个商家吗？', { ok: '删除' }))) return; sv(KM, ld(KM).filter((x) => x.id !== +b.dataset.d)); sync(); draw(body, foot, close); });
            body.querySelector('#sxTaBuy').onchange = (e) => store.setItem('taBuyOn', e.target.checked ? '1' : '0');
            body.querySelector('#sxTaNow').onclick = () => { close(); taBuy(true); };
        };
        openPanel('我的商家', draw);
    }

    // =====================================================================
    //  TA 主动给你买东西
    // =====================================================================
    const taBuyOn = () => store.getItem('taBuyOn') !== '0';
    let busy = false;
    function buyState(c) { const L = lifeOf(c); L.taBuy = L.taBuy || { d: '', n: 0, last: 0 }; return L.taBuy; }
    function pickReason(c, force) {
        const now = new Date(), h = now.getHours(), w = (typeof getWeather === 'function') ? getWeather() : null, mood = getMood(c);
        const rs = [];
        if (h >= 11 && h < 13) rs.push({ k: 'takeout', t: '现在是中午饭点，你担心我没好好吃饭' });
        if (h >= 17 && h < 20) rs.push({ k: 'takeout', t: '现在是晚饭时间，你想让我吃点好的' });
        if (h >= 21 || h < 2) rs.push({ k: 'takeout', t: '现在是晚上，我可能还没睡，你想给我点份夜宵或热饮' });
        if (h >= 15 && h < 17) rs.push({ k: 'takeout', t: '下午了，你想给我点杯下午茶' });
        if (w && (w.temp <= 10 || (w.code >= 51 && w.code <= 82))) rs.push({ k: 'shop', t: '我那边' + (w.temp <= 10 ? '很冷（' + w.temp + '°）' : '在下雨') + '，你想买点能让我暖和或方便的东西' });
        if (mood < 40) rs.push({ k: 'any', t: '我最近心情有点低落，你想用一份小礼物哄哄我' });
        if (h >= 8 && h < 22) rs.push({ k: 'shop', t: '你只是突然想给我买点什么，没有特别原因，就是想让我开心' });
        if (force) return pick(rs.length ? rs : [{ k: 'any', t: '你突然想给我买点什么' }]);
        return rs.length ? pick(rs) : null;
    }
    function candidates(kind) {
        const out = { takeout: [], shop: [] };
        merchants.forEach((m) => { (menuData[m.name] || []).forEach((d) => out.takeout.push({ m: m.name, name: d.name, price: d.price })); });
        products.concat(gifts).forEach((p) => out.shop.push({ name: p.title, price: p.price }));
        const sample = (a, n) => a.slice().sort(() => Math.random() - 0.5).slice(0, n);
        return { takeout: kind === 'shop' ? [] : sample(out.takeout, 22), shop: kind === 'takeout' ? [] : sample(out.shop, 16) };
    }
    async function taBuy(force) {
        if (busy) return false; const id = getActiveCharId(), c = id ? getChar(id) : null;
        if (!c || c.blocked) { if (force) uiAlert('先创建并选择一个角色'); return false; }
        if (!API_KEY) { if (force) uiAlert('请先在设置里填 API Key'); return false; }
        const bs = buyState(c), today = todayStr();
        if (!force) {
            if (!taBuyOn() || c.taBuyOn === false) return false;
            if (bs.d !== today) { bs.d = today; bs.n = 0; }
            if (bs.n >= 2 || Date.now() - (bs.last || 0) < 5 * 36e5) return false;
            if (Math.random() > 0.4) return false;
        }
        const reason = pickReason(c, force); if (!reason) return false;
        busy = true;
        try {
            const cand = candidates(reason.k === 'any' ? '' : reason.k);
            const list = (cand.takeout.length ? '【外卖候选】' + cand.takeout.map((x) => x.m + '·' + x.name + ' ¥' + x.price).join('；') + '\n' : '') + (cand.shop.length ? '【网购候选】' + cand.shop.map((x) => x.name + ' ¥' + x.price).join('；') + '\n' : '');
            const ANG = ['用你平时说话的方式随口一提，别太正式', '带点嘴硬或别扭，但能看出在意', '像刚想起来一样，语气随意', '带一点调侃或小吐槽', '只说很短的一两句，留白', '说一个此刻你这边正在发生的小细节再带出买东西', '用你的口头禅或习惯性语气词开头', '先问我一件小事，再顺带说买了东西', '不解释理由，直接说结果，像日常聊天', '带一点撒娇或不好意思，符合你的性格'];
            const hist = (getHistory(id) || []).slice(-4).map((m) => (m.role === 'user' ? '我：' : c.name + '：') + String(m.content).slice(0, 40)).join('\n');
            const prompt = timeContext() + '\n【方向：你是买家/付钱的人，我（用户）是收到的人】' + reason.t + '。你决定主动给我买一样东西。\n' + list
                + (hist ? '【最近聊天，保持连贯】\n' + hist + '\n' : '')
                + '请只从候选里选一个最符合你性格、也最适合此刻时间的（名称必须和候选完全一致；外卖约 30 分钟送达，网购要等快递）。\n'
                + '写 say 时：完全以你自己的人设、说话习惯和与我的关系来说，不要套用通用模板；禁止以「给你买了/给你点了」这类固定句式开头；不要复述我给你的任何提示词；本次风格倾向：' + pick(ANG) + '。\n只输出 JSON：{"kind":"takeout或shop","name":"候选里的名称","say":"你发给我的话，口语，40 字内，要让我明白东西是你买给我的，但表达方式完全由你的性格决定"}';
            const j = parseJSONLoose(await callPersona(id, prompt, 1.1)) || {};
            let kind = j.kind === 'takeout' ? 'takeout' : 'shop', name = String(j.name || ''), price = 0, shop = '';
            const find = (arr) => arr.find((x) => x.name === name) || arr.find((x) => name && (x.name.indexOf(name) >= 0 || name.indexOf(x.name) >= 0));
            let hit = kind === 'takeout' ? find(cand.takeout) : find(cand.shop);
            if (!hit) { const pool = kind === 'takeout' ? cand.takeout : cand.shop; hit = pool.length ? pick(pool) : null; if (!hit) { const o = cand.takeout.length ? cand.takeout : cand.shop; hit = pick(o); kind = cand.takeout.length ? 'takeout' : 'shop'; } }
            if (!hit) return false;
            name = hit.name; price = hit.price; shop = hit.m || '';
            let say = String(j.say || '').trim();
            if (!say) { try { say = String(await callPersona(id, '你刚主动给我' + (kind === 'takeout' ? '点了外卖' : '下单买了') + '「' + name + '」。用你自己的口吻发一句话告诉我，40字内，只输出这句话本身。', 1.1) || '').trim().replace(/^["“]|["”]$/g, ''); } catch (e) {} }
            if (!say) say = '（' + c.name + '没说话，只是悄悄下了单）';
            const what = kind === 'takeout' ? '点了外卖「' + (shop ? shop + '·' : '') + name + '」¥' + price : '下单买了「' + name + '」¥' + price;
            pushHistory(id, { role: 'assistant', content: say + '\n（' + c.name + ' 主动给你' + what + '）' });
            logActivity(id, 'taBuy', '【你（' + c.name + '）→我（用户）】你主动给我' + what + '。买单的是你，收到的是我。');
            lifeUpdate(id, (L) => { L.taBuy = L.taBuy || { d: '', n: 0, last: 0 }; if (L.taBuy.d !== today) { L.taBuy.d = today; L.taBuy.n = 0; } L.taBuy.n++; L.taBuy.last = Date.now(); L.buys = L.buys || []; L.buys.unshift({ ts: Date.now(), kind: kind, name: name, shop: shop, price: price, say: say, why: reason.t }); L.buys = L.buys.slice(0, 40); });
            try { bumpMood(id, 3); } catch (e) {}
            const viewing = chatRoomOpen() && currentChatCharId === id && !currentGroupId;
            if (viewing) { const el = appendMessage(say + '\n（' + what + '）', 'ai-message', currentAiAvatarHTML()); if (el) el.dataset.idx = getHistory(id).length - 1; }
            else showBanner(c, say);
            renderChatList(); renderMine();
            if (force) uiAlert(c.name + ' 给你' + (kind === 'takeout' ? '点了外卖' : '下了单') + '～看看「TA送我的」');
            return true;
        } catch (e) { if (force) uiAlert('TA 这次没买成：' + e.message); return false; } finally { busy = false; }
    }
    window.taBuyForUser = taBuy;

    // ---------- 「TA送我的」列表 ----------
    const IC_FOOD = '<svg viewBox="0 0 24 24"><path d="M4 11h16a8 8 0 0 1-16 0z"/><path d="M9 4c-1 1 1 2 0 3.2M13 4c-1 1 1 2 0 3.2"/></svg>', IC_BAG = '<svg viewBox="0 0 24 24"><path d="M6 8.5h12l-1 10.5H7z"/><path d="M9 8.5V7.5a3 3 0 0 1 6 0v1"/></svg>';
    function renderMine() {
        const box = $('mineList'); if (!box || box.classList.contains('hidden')) return;
        const c = getChar(getActiveCharId()), arr = c ? (lifeOf(c).buys || []) : [];
        box.innerHTML = '<div style="padding:4px 12px 10px"><button class="sx-btn ghost" id="mineNow" style="width:100%">让 ' + esc(c ? c.name : 'TA') + ' 现在给我买点什么</button></div>'
            + (arr.length ? arr.map((b) => '<div class="mine-card"><div class="mi">' + (b.kind === 'takeout' ? IC_FOOD : IC_BAG) + '</div><div><b>' + esc(c.name) + ' 给你' + (b.kind === 'takeout' ? '点了外卖' : '买了') + '</b><p>' + esc((b.shop ? b.shop + '·' : '') + b.name) + ' · ¥' + esc(b.price) + '</p><p style="color:var(--text-sub)">' + esc(b.say) + '</p><small>' + agoText(b.ts) + '</small></div></div>').join('') : '<div class="sx-empty">还没有。TA 想到的时候会主动给你买，也可以点上面的按钮催一催。</div>');
        const nb = $('mineNow'); if (nb) nb.onclick = () => taBuy(true);
    }

    // ---------- 把界面接上 ----------
    function wire() {
        // 外卖分类图标（线条图标，跟随主题色）
        const ICONS = {
            '美食': '<path d="M4 11h16a8 8 0 0 1-16 0z"/><path d="M9 4c-1 1 1 2 0 3.2M13 4c-1 1 1 2 0 3.2"/><path d="M17 3.5l-3 5"/>',
            '团购': '<path d="M4 7.5h16V10a2 2 0 0 0 0 4v2.5H4V14a2 2 0 0 0 0-4z"/><path d="M14.5 8.5v7" stroke-dasharray="1.6 2.2"/>',
            '闪购': '<path d="M13 3L5.5 13.5H11L10 21l7.5-10.5H12z"/>',
            '买药': '<rect x="4" y="4" width="16" height="16" rx="4.5"/><path d="M12 8.5v7M8.5 12h7"/>',
            '全部': '<rect x="4.5" y="4.5" width="6" height="6" rx="1.6"/><rect x="13.5" y="4.5" width="6" height="6" rx="1.6"/><rect x="4.5" y="13.5" width="6" height="6" rx="1.6"/><rect x="13.5" y="13.5" width="6" height="6" rx="1.6"/>'
        };
        document.querySelectorAll('.takeout-cat').forEach((el) => { const d = el.querySelector('.tc-dot'); if (d) { const ic = document.createElement('div'); ic.className = 'tc-ic'; ic.innerHTML = '<svg viewBox="0 0 24 24">' + (ICONS[el.dataset.cat] || ICONS['全部']) + '</svg>'; d.replaceWith(ic); } });
        // 头部「管理」按钮
        [['takeoutApp', manageMerchants, '管理'], ['shoppingApp', manageProducts, '管理']].forEach((x) => {
            const h = $(x[0]) && $(x[0]).querySelector('.app-header'); if (!h || h.querySelector('.sx-mg')) return;
            const sp = h.querySelector('span:last-child'); const b = document.createElement('button'); b.className = 'sx-mg hdr-btn'; b.textContent = x[2]; b.onclick = x[1];
            if (sp && !sp.textContent.trim()) sp.replaceWith(b); else h.appendChild(b);
        });
        // 淘宝：第三个标签
        const tabs = document.querySelector('.taobao-tabs');
        if (tabs && !tabs.querySelector('[data-t="mine"]')) {
            const t = document.createElement('div'); t.className = 'taobao-tab'; t.dataset.t = 'mine'; t.textContent = 'TA送我的'; t.onclick = () => window.switchTaobaoTab(t, 'mine'); tabs.appendChild(t);
            const ml = document.createElement('div'); ml.id = 'mineList'; ml.className = 'hidden'; ml.style.padding = '4px 0'; $('productList').parentNode.insertBefore(ml, $('productDetail'));
        }
        const orig = window.switchTaobaoTab;
        if (orig && !orig._sx) {
            window.switchTaobaoTab = function (el, type) {
                const ml = $('mineList'); if (ml) ml.classList.add('hidden');
                if (type === 'mine') {
                    document.querySelectorAll('.taobao-tab').forEach((t) => t.classList.remove('active')); el.classList.add('active');
                    $('productDetail').classList.add('hidden'); $('productList').classList.add('hidden'); $('giftList').classList.add('hidden'); ml.classList.remove('hidden'); renderMine(); return;
                }
                return orig(el, type);
            }; window.switchTaobaoTab._sx = 1;
        }
        const ob = window.backToShopping; if (ob && !ob._sx) { window.backToShopping = function () { const ml = $('mineList'); if (ml) ml.classList.add('hidden'); return ob(); }; window.backToShopping._sx = 1; }
    }

    // 启动：并入自定义数据、接界面、开启「TA 主动买」的定时检查
    sync(); wire();
    setTimeout(() => { taBuy(false); }, 25000);
    setInterval(() => { try { taBuy(false); } catch (e) {} }, 4 * 60000);
})();
