/* album.js —— 相册：我自己管理 / 和某位 TA 一起管理；TA 也能往共同相册里放照片、给照片留言 */
(function () {
    'use strict';
    const $ = (id) => document.getElementById(id), esc = (s) => escapeHtml(String(s == null ? '' : s));
    const IDX = 'albumIndex', PK = 'albumPhotos_', SET = 'albumSettings';
    const uid = (p) => (p || 'a') + Date.now().toString(36) + Math.random().toString(36).slice(2, 5);
    const pad = (n) => String(n).padStart(2, '0');
    const fmt = (ts) => { const d = new Date(ts); return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); };
    const hueOf = (s) => { let h = 0; s = String(s); for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) % 360; return h; };

    // ---------- 数据：索引一个键，每本相册的照片各一个键（改一张不用重写全部） ----------
    function I() { let d = null; try { d = JSON.parse(store.getItem(IDX) || 'null'); } catch (e) { } if (!d || !Array.isArray(d.albums)) d = { albums: [] }; return d; }
    function SI(d) { try { store.setItem(IDX, JSON.stringify(d)); } catch (e) { uiAlert('保存失败，空间不够了'); } }
    function P(id) { try { const a = JSON.parse(store.getItem(PK + id) || '[]'); return Array.isArray(a) ? a : []; } catch (e) { return []; } }
    function SP(id, arr) { try { store.setItem(PK + id, JSON.stringify(arr)); } catch (e) { uiAlert('保存失败，空间不够了'); } }
    function cfg() { let c = {}; try { c = JSON.parse(store.getItem(SET) || '{}'); } catch (e) { } return { autoReact: c.autoReact !== false }; }
    function saveCfg(c) { try { store.setItem(SET, JSON.stringify(c)); } catch (e) { } }
    function ensureDefault() {
        const d = I();
        if (!d.albums.some(a => a.kind === 'mine')) { d.albums.unshift({ id: uid(), name: '我的相册', kind: 'mine', charId: '', created: Date.now(), cover: '' }); SI(d); }
        return d;
    }
    const charOf = (id) => { try { return getChar(id); } catch (e) { return null; } };
    const nameOfBy = (by) => { if (by === 'me') return store.getItem('myName') || '我'; const c = charOf(by); return c ? c.name : 'TA'; };

    // ---------- 桌面入口 ----------
    try {
        if (allApps.indexOf('album') < 0) allApps.push('album');
        if (!HOME_APPS.some(a => a.id === 'album')) HOME_APPS.push({ id: 'album', name: '相册', cls: 'album-icon', face: '(◕‿◕)', go: () => { view = { t: 'list' }; openApp('album'); } });
        GLYPH.album = '<rect x="3.5" y="5" width="17" height="14" rx="2.6"/><circle cx="9" cy="10.2" r="1.6"/><path d="M4.5 17.2l4.6-4.3 3.7 3.3 2.8-2.4 3.9 3.4"/>';
    } catch (e) { }

    let view = { t: 'list' }, filter = 'all', selMode = false, sel = {};

    function ensure() {
        if ($('albumApp')) return;
        const el = document.createElement('div'); el.id = 'albumApp'; el.className = 'app-screen hidden'; el.style.position = 'absolute';
        el.innerHTML = '<div class="app-header"><button id="alBack">‹ 返回</button><span id="alTitle">相册</span><button class="hdr-btn" id="alMore">更多</button></div><div class="scroll-area xa-body" id="alBody"></div><button class="xa-fab" id="alFab">＋</button>';
        ($('callScreen') ? $('callScreen').parentElement : document.body).appendChild(el);
        $('alBack').onclick = back; $('alMore').onclick = more; $('alFab').onclick = () => view.t === 'list' ? newAlbum() : pickFiles();
        new MutationObserver(() => { if (!el.classList.contains('hidden')) render(); }).observe(el, { attributes: true, attributeFilter: ['class'] });
    }
    function back() { if (view.t === 'album') { if (selMode) { selMode = false; sel = {}; render(); return; } view = { t: 'list' }; render(); } else goHome(); }
    function sheet(html, tall) { const app = $('albumApp'), m = document.createElement('div'); m.className = 'xa-mask'; m.innerHTML = '<div class="xa-sheet' + (tall ? ' tall' : '') + '">' + html + '</div>'; m.addEventListener('mousedown', (e) => { if (e.target === m) m.remove(); }); app.appendChild(m); return m; }

    // ---------- 列表页 ----------
    function coverOf(a, photos) {
        if (a.cover) { const p = photos.find(x => x.id === a.cover); if (p) return p.src; }
        return photos.length ? photos[photos.length - 1].src : '';
    }
    function renderList() {
        const d = ensureDefault(), body = $('alBody');
        $('alTitle').textContent = '相册'; $('alFab').style.display = ''; $('alMore').style.display = '';
        const list = d.albums.filter(a => filter === 'all' || (filter === 'mine' ? a.kind === 'mine' : a.kind === 'shared'));
        let h = '<div class="al-tabs">' + [['all', '全部'], ['mine', '我的'], ['shared', '和 TA 的']].map(t => '<button data-f="' + t[0] + '"' + (filter === t[0] ? ' class="on"' : '') + '>' + t[1] + '</button>').join('') + '</div>';
        if (!list.length) h += '<div class="xa-empty">这里还没有相册<br>点右下角「＋」新建一本，可以自己管理，也可以和某位 TA 一起管理</div>';
        else h += '<div class="al-grid">' + list.map(a => {
            const ph = P(a.id), cv = coverOf(a, ph), c = a.kind === 'shared' ? charOf(a.charId) : null;
            const hue = hueOf(a.name);
            return '<div class="al-card" data-id="' + a.id + '"><div class="al-cover" style="' + (cv ? 'background-image:url(&quot;' + cv + '&quot;)' : 'background:linear-gradient(145deg,hsl(' + hue + ',70%,86%),hsl(' + ((hue + 45) % 360) + ',65%,78%))') + '">' + (cv ? '' : '<span class="al-ph">' + (a.kind === 'shared' ? '♡' : '✧') + '</span>') + (c ? '<span class="al-av">' + charAvatarInner(c) + '</span>' : '') + '</div><div class="al-nm">' + esc(a.name) + '</div><div class="al-sub">' + ph.length + ' 张 · ' + (a.kind === 'shared' ? '和 ' + esc(c ? c.name : 'TA') + ' 一起' : '仅自己') + '</div></div>';
        }).join('') + '</div>';
        body.innerHTML = h;
        body.querySelectorAll('[data-f]').forEach(b => b.onclick = () => { filter = b.dataset.f; render(); });
        body.querySelectorAll('.al-card').forEach(c => c.onclick = () => { view = { t: 'album', id: c.dataset.id }; selMode = false; sel = {}; render(); });
    }

    // ---------- 相册详情 ----------
    function curAlbum() { return view.t === 'album' ? I().albums.find(a => a.id === view.id) : null; }
    function renderAlbum() {
        const a = curAlbum(); if (!a) { view = { t: 'list' }; return renderList(); }
        const ph = P(a.id), body = $('alBody'), c = a.kind === 'shared' ? charOf(a.charId) : null;
        $('alTitle').textContent = a.name; $('alFab').style.display = selMode ? 'none' : ''; $('alMore').style.display = '';
        let h = '';
        if (c) h += '<div class="al-who"><span class="avatar-small">' + myAvatarInner() + '</span><i>♡</i><span class="avatar-small">' + charAvatarInner(c) + '</span><div>和 <b>' + esc(c.name) + '</b> 一起管理 · 你们都可以往里放照片</div></div>';
        h += '<div class="al-ops">' + (selMode ? '<button id="alSelAll">全选</button><button id="alSelCancel">取消选择</button>' : '<button id="alUp">上传照片</button>' + (c ? '<button id="alTa">让 ' + esc(c.name) + ' 放一张</button>' : '') + (ph.length ? '<button id="alSel">选择</button>' : '')) + '</div>';
        if (!ph.length) h += '<div class="xa-empty">还没有照片<br>点「上传照片」或右下角「＋」添加' + (c ? '，也可以让 ' + esc(c.name) + ' 放一张他/她想放的' : '') + '</div>';
        else {
            const sorted = ph.slice().sort((x, y) => y.ts - x.ts);
            h += '<div class="al-photos">' + sorted.map(p => '<div class="al-p' + (sel[p.id] ? ' sel' : '') + '" data-id="' + p.id + '" style="background-image:url(&quot;' + p.src + '&quot;)">' + (p.by !== 'me' ? '<span class="al-by">' + esc(nameOfBy(p.by).slice(0, 2)) + '</span>' : '') + (p.comments && p.comments.length ? '<span class="al-cm">' + p.comments.length + '</span>' : '') + (selMode ? '<span class="al-ck">' + (sel[p.id] ? '✓' : '') + '</span>' : '') + '</div>').join('') + '</div>';
        }
        if (selMode) { const n = Object.keys(sel).length; h += '<div class="al-selbar"><button id="alMv"' + (n ? '' : ' disabled') + '>移动到…</button><button class="dan" id="alRm"' + (n ? '' : ' disabled') + '>删除（' + n + '）</button></div>'; }
        body.innerHTML = h;
        const q = (i) => body.querySelector('#' + i);
        if (q('alUp')) q('alUp').onclick = pickFiles; if (q('alTa')) q('alTa').onclick = () => taUpload(a);
        if (q('alSel')) q('alSel').onclick = () => { selMode = true; sel = {}; render(); };
        if (q('alSelCancel')) q('alSelCancel').onclick = () => { selMode = false; sel = {}; render(); };
        if (q('alSelAll')) q('alSelAll').onclick = () => { ph.forEach(p => sel[p.id] = 1); render(); };
        if (q('alRm')) q('alRm').onclick = async () => { const ids = Object.keys(sel); if (!ids.length) return; if (!(await uiConfirm('删除选中的 ' + ids.length + ' 张照片？'))) return; SP(a.id, P(a.id).filter(p => !sel[p.id])); selMode = false; sel = {}; render(); };
        if (q('alMv')) q('alMv').onclick = () => moveTo(a, Object.keys(sel));
        body.querySelectorAll('.al-p').forEach(e => e.onclick = () => { if (selMode) { if (sel[e.dataset.id]) delete sel[e.dataset.id]; else sel[e.dataset.id] = 1; render(); } else viewer(a.id, e.dataset.id); });
    }
    function render() { ensure(); if (!$('albumApp') || $('albumApp').classList.contains('hidden')) { /* 仍然渲染，便于预加载 */ } view.t === 'album' ? renderAlbum() : renderList(); }

    // ---------- 新建 / 管理 ----------
    function newAlbum() {
        const chars = getChars(); let kind = 'mine', cid = chars[0] ? chars[0].id : '';
        const m = sheet('<h3>新建相册</h3><div class="xa-row"><input id="naN" style="text-align:left;max-width:100%;width:100%;font-size:16px" placeholder="相册名称，例如：旅行 / 我们的回忆"></div><div class="cd-chip al-kind" id="naK"><button data-k="mine" class="on">只有我自己</button><button data-k="shared">和 TA 一起管理</button></div><div id="naC" class="hidden"><div class="xa-title">选择一起管理的人</div><div class="xa-chips" id="naL">' + (chars.length ? chars.map(c => '<button data-c="' + esc(c.id) + '">' + esc(c.name) + '</button>').join('') : '<span style="font-size:12px;color:var(--text-sub)">还没有角色，先去创建一个</span>') + '</div></div><div class="xa-btns"><button id="naX">取消</button><button class="pri" id="naOk">创建</button></div>');
        const g = (i) => m.querySelector('#' + i);
        const sync = () => { m.querySelectorAll('#naK button').forEach(b => b.classList.toggle('on', b.dataset.k === kind)); g('naC').classList.toggle('hidden', kind !== 'shared'); m.querySelectorAll('#naL button').forEach(b => b.classList.toggle('on', b.dataset.c === cid)); };
        m.querySelectorAll('#naK button').forEach(b => b.onclick = () => { kind = b.dataset.k; sync(); });
        m.querySelectorAll('#naL button').forEach(b => b.onclick = () => { cid = b.dataset.c; sync(); }); sync();
        g('naX').onclick = () => m.remove();
        g('naOk').onclick = () => {
            let n = g('naN').value.trim();
            if (kind === 'shared' && !cid) { uiAlert('先选一位一起管理的人'); return; }
            if (!n) n = kind === 'shared' ? '和 ' + ((charOf(cid) || {}).name || 'TA') + ' 的相册' : '新相册';
            const d = I(), a = { id: uid(), name: n.slice(0, 20), kind: kind, charId: kind === 'shared' ? cid : '', created: Date.now(), cover: '' };
            d.albums.push(a); SI(d); m.remove(); view = { t: 'album', id: a.id }; render();
        };
    }
    function more() {
        const a = curAlbum(), c = cfg();
        let h = '<h3>' + (a ? '相册设置' : '更多') + '</h3><div class="xa-btns" style="flex-direction:column">';
        if (a) {
            h += '<button id="mrRn">重命名</button>';
            if (a.kind === 'shared') h += '<button id="mrCh">更换一起管理的人</button>';
            else h += '<button id="mrSh">改成和 TA 一起管理</button>';
            h += '<button class="dan" id="mrDel">删除这本相册</button>';
        }
        h += '<button id="mrAuto">' + (c.autoReact ? '✓ ' : '') + '在共同相册上传后，TA 自动留言</button></div>';
        const m = sheet(h), g = (i) => m.querySelector('#' + i);
        if (g('mrAuto')) g('mrAuto').onclick = () => { c.autoReact = !c.autoReact; saveCfg(c); m.remove(); uiAlert(c.autoReact ? '已开启：你在共同相册上传照片后，TA 会留一句话' : '已关闭'); };
        if (!a) return;
        g('mrRn').onclick = async () => { m.remove(); const n = await uiPrompt('相册名称：', a.name); if (!n || !n.trim()) return; const d = I(); d.albums.find(x => x.id === a.id).name = n.trim().slice(0, 20); SI(d); render(); };
        const pickChar = (title, done) => { m.remove(); const chars = getChars(); if (!chars.length) { uiAlert('还没有角色'); return; } const mm = sheet('<h3>' + title + '</h3><div class="xa-chips">' + chars.map(c => '<button data-c="' + esc(c.id) + '">' + esc(c.name) + '</button>').join('') + '</div>'); mm.querySelectorAll('[data-c]').forEach(b => b.onclick = () => { mm.remove(); done(b.dataset.c); }); };
        if (g('mrCh')) g('mrCh').onclick = () => pickChar('和谁一起管理', (cid) => { const d = I(), x = d.albums.find(z => z.id === a.id); x.charId = cid; SI(d); render(); });
        if (g('mrSh')) g('mrSh').onclick = () => pickChar('和谁一起管理', (cid) => { const d = I(), x = d.albums.find(z => z.id === a.id); x.kind = 'shared'; x.charId = cid; SI(d); render(); });
        g('mrDel').onclick = async () => { m.remove(); if (!(await uiConfirm('删除相册「' + a.name + '」和里面的全部照片？'))) return; const d = I(); d.albums = d.albums.filter(x => x.id !== a.id); SI(d); try { store.removeItem(PK + a.id); } catch (e) { } view = { t: 'list' }; render(); };
    }
    function moveTo(a, ids) {
        const d = I(), others = d.albums.filter(x => x.id !== a.id);
        if (!others.length) { uiAlert('没有别的相册了，先新建一本'); return; }
        const m = sheet('<h3>移动到</h3><div class="xa-chips">' + others.map(o => '<button data-id="' + o.id + '">' + esc(o.name) + '</button>').join('') + '</div>');
        m.querySelectorAll('[data-id]').forEach(b => b.onclick = () => {
            const mv = P(a.id).filter(p => ids.indexOf(p.id) >= 0), rest = P(a.id).filter(p => ids.indexOf(p.id) < 0);
            SP(b.dataset.id, P(b.dataset.id).concat(mv)); SP(a.id, rest); m.remove(); selMode = false; sel = {}; render(); uiAlert('已移动 ' + mv.length + ' 张');
        });
    }

    // ---------- 上传 ----------
    function compressFile(file) {
        return new Promise((resolve) => {
            const fr = new FileReader();
            fr.onload = () => {
                const raw = fr.result, img = new Image();
                img.onload = () => {
                    try {
                        const sc = Math.min(1, 1280 / Math.max(img.width, img.height)), cv = document.createElement('canvas');
                        cv.width = Math.max(1, Math.round(img.width * sc)); cv.height = Math.max(1, Math.round(img.height * sc));
                        cv.getContext('2d').drawImage(img, 0, 0, cv.width, cv.height);
                        const alpha = /png|webp|gif/i.test(file.type || '');
                        let u = cv.toDataURL(alpha ? 'image/webp' : 'image/jpeg', 0.85);
                        if (alpha && u.indexOf('image/webp') < 0) u = cv.toDataURL('image/png');
                        resolve(u);
                    } catch (e) { resolve(raw); }
                };
                img.onerror = () => resolve(null); img.src = raw;
            };
            fr.onerror = () => resolve(null); fr.readAsDataURL(file);
        });
    }
    function pickFiles() {
        const a = curAlbum(); if (!a) return;
        let f = $('alFile'); if (!f) { f = document.createElement('input'); f.type = 'file'; f.id = 'alFile'; f.accept = 'image/*'; f.multiple = true; f.style.display = 'none'; $('albumApp').appendChild(f); }
        f.onchange = async () => {
            const files = Array.prototype.slice.call(f.files || []); f.value = ''; if (!files.length) return;
            uiAlert('正在处理 ' + files.length + ' 张照片…', 1500);
            const added = [];
            for (const file of files) { const u = await compressFile(file); if (u) added.push({ id: uid('p'), src: u, by: 'me', cap: '', ts: Date.now() + added.length }); }
            if (!added.length) { uiAlert('没有读到图片'); return; }
            SP(a.id, P(a.id).concat(added)); render();
            if (a.kind === 'shared' && cfg().autoReact && typeof API_KEY !== 'undefined' && API_KEY) { const last = added[added.length - 1]; react(a, last).catch(() => { }); }
        };
        f.click();
    }

    // ---------- TA 的反应 / TA 放照片 ----------
    async function react(a, p) {
        const c = charOf(a.charId); if (!c) throw new Error('找不到这个角色');
        if (typeof API_KEY === 'undefined' || !API_KEY) throw new Error('请先在设置里填 API Key');
        const base = '我把这张照片放进了我们的相册「' + a.name + '」' + (p.cap ? '，我写的说明：' + p.cap : '') + '。请你以角色身份，像发微信那样自然地回应：说说看到照片的感受，可以问一句或调侃一句，一到两句话。只写说出口的话，不要括号动作描写。';
        let content; const vm = typeof visionMode === 'function' ? visionMode() : 'main';
        if (p.gen) content = base + '（这是一张你自己放的照片，画面：' + p.desc + '）';
        else if (vm === 'main') content = [{ type: 'text', text: base }, { type: 'image_url', image_url: { url: p.src } }];
        else if (vm === 'sep') { let d = ''; try { d = await describeImage(p.src); } catch (e) { } content = base + (d ? '（照片内容：' + d + '）' : ''); }
        else content = base;
        let sys = personaSystem(c); try { sys += ONLINE_RULES + personaTail(c); } catch (e) { }
        let out;
        try { out = await chatCompletion([{ role: 'system', content: sys }, { role: 'user', content: content }], 1.0); }
        catch (e) { if (Array.isArray(content)) out = await chatCompletion([{ role: 'system', content: sys }, { role: 'user', content: base }], 1.0); else throw e; }
        let t = String(out || '').trim(); try { t = ChatX.stripActions(t).trim(); } catch (e) { }
        if (!t) throw new Error('没有收到回复');
        const arr = P(a.id), x = arr.find(z => z.id === p.id); if (!x) return t;
        (x.comments = x.comments || []).push({ by: c.id, text: t, ts: Date.now() }); SP(a.id, arr);
        if (view.t === 'album' && view.id === a.id) { render(); if ($('alViewer') && $('alViewer').dataset.pid === p.id) viewer(a.id, p.id); }
        return t;
    }
    function drawCard(desc, who) {
        const cv = document.createElement('canvas'); cv.width = 800; cv.height = 800; const x = cv.getContext('2d'), h = hueOf(desc);
        const g = x.createLinearGradient(0, 0, 800, 800); g.addColorStop(0, 'hsl(' + h + ',72%,84%)'); g.addColorStop(1, 'hsl(' + ((h + 55) % 360) + ',68%,72%)'); x.fillStyle = g; x.fillRect(0, 0, 800, 800);
        x.fillStyle = 'rgba(255,255,255,.28)'; x.beginPath(); x.arc(640, 150, 170, 0, 7); x.fill(); x.beginPath(); x.arc(120, 700, 130, 0, 7); x.fill();
        x.fillStyle = 'rgba(40,30,45,.82)'; x.textAlign = 'center'; x.font = '600 38px sans-serif';
        const chars = Array.from(String(desc)), lines = []; let cur = ''; chars.forEach(ch => { cur += ch; if (cur.length >= 14) { lines.push(cur); cur = ''; } }); if (cur) lines.push(cur);
        const ls = lines.slice(0, 7), y0 = 400 - (ls.length - 1) * 30; ls.forEach((l, i) => x.fillText(l, 400, y0 + i * 60));
        x.font = '26px sans-serif'; x.fillStyle = 'rgba(40,30,45,.55)'; x.fillText(who + ' 拍的照片', 400, 740);
        return cv.toDataURL('image/jpeg', 0.88);
    }
    function sget(k, d) { try { const v = store.getItem(k); return v == null ? d : v; } catch (e) { return d; } }
    async function genPhoto(desc, who) {
        const mode = sget('imgGenMode', 'card'), prompt = desc + '，高清，柔和自然光，细节丰富';
        const shrink = (u) => new Promise(r => { const im = new Image(); im.onload = () => { try { const sc = Math.min(1, 1024 / Math.max(im.width, im.height)), cv = document.createElement('canvas'); cv.width = Math.round(im.width * sc); cv.height = Math.round(im.height * sc); cv.getContext('2d').drawImage(im, 0, 0, cv.width, cv.height); r(cv.toDataURL('image/jpeg', 0.85)); } catch (e) { r(u); } }; im.onerror = () => r(null); im.src = u; });
        try {
            if (mode === 'free') {
                const res = await fetch('https://image.pollinations.ai/prompt/' + encodeURIComponent(prompt) + '?width=768&height=768&nologo=true&seed=' + (Date.now() % 99999));
                if (res.ok) { const b = await res.blob(), u = await new Promise(r => { const fr = new FileReader(); fr.onload = () => r(fr.result); fr.readAsDataURL(b); }); const s = await shrink(u); if (s) return { src: s, gen: false }; }
            } else if (mode === 'api') {
                let base = String(sget('imgGenUrl', '') || '').trim().replace(/\/+$/, ''); const key = sget('imgGenKey', '') || (typeof API_KEY !== 'undefined' ? API_KEY : '');
                if (base) {
                    if (!/\/images\/generations$/.test(base)) base += '/images/generations';
                    const res = await fetch(base, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + key }, body: JSON.stringify({ model: sget('imgGenModel', '') || 'dall-e-3', prompt: prompt, n: 1, size: '1024x1024', response_format: 'b64_json' }) });
                    if (res.ok) { const j = await res.json(), d = j.data && j.data[0]; if (d && d.b64_json) { const s = await shrink('data:image/png;base64,' + d.b64_json); if (s) return { src: s, gen: false }; } }
                }
            }
        } catch (e) { }
        return { src: drawCard(desc, who), gen: true };
    }
    async function taUpload(a) {
        const c = charOf(a.charId); if (!c) { uiAlert('找不到这个角色'); return; }
        if (typeof API_KEY === 'undefined' || !API_KEY) { uiAlert('请先在设置里填 API Key'); return; }
        const btn = $('alTa'); if (btn) { btn.disabled = true; btn.textContent = c.name + ' 正在挑照片…'; }
        try {
            const ph = P(a.id), caps = ph.slice(-6).map(p => '- ' + (p.by === 'me' ? '我' : '你') + '放的：' + (p.cap || p.desc || '一张照片')).join('\n');
            const out = await chatCompletion([{ role: 'system', content: personaSystem(c) }, { role: 'user', content: '我们有一本共同相册「' + a.name + '」，里面已有：\n' + (caps || '（还没有照片）') + '\n请你以角色身份，往相册里放一张你想放的照片（比如你拍的、你们的回忆、你今天看到的东西）。要符合你的人设和我们的关系。只输出 JSON：{"desc":"照片画面的具体描述（中文，30~80字，人物/场景/光线/细节）","cap":"你给照片写的一句话说明（口语，20字以内，不要括号动作）"}' }], 1.0);
            const j = parseJSONLoose(out); if (!j || !j.desc) throw new Error('TA 这次没挑好，再试一次');
            const r = await genPhoto(String(j.desc).slice(0, 200), c.name), arr = P(a.id);
            arr.push({ id: uid('p'), src: r.src, by: c.id, cap: String(j.cap || '').slice(0, 40), desc: String(j.desc).slice(0, 200), gen: r.gen, ts: Date.now() }); SP(a.id, arr);
            render(); uiAlert(c.name + ' 放了一张照片进来');
        } catch (e) { uiAlert('失败：' + (e && e.message || e)); render(); }
    }

    // ---------- 大图查看 ----------
    function viewer(aid, pid) {
        const a = I().albums.find(x => x.id === aid), arr = P(aid), p = arr.find(x => x.id === pid); if (!a || !p) return;
        const old = $('alViewer'); if (old) old.remove();
        const v = document.createElement('div'); v.id = 'alViewer'; v.className = 'al-viewer'; v.dataset.pid = pid;
        const sorted = arr.slice().sort((x, y) => y.ts - x.ts), idx = sorted.findIndex(x => x.id === pid);
        const cms = (p.comments || []).map(c => '<div class="al-c"><b>' + esc(nameOfBy(c.by)) + '</b>' + esc(c.text) + '</div>').join('');
        v.innerHTML = '<div class="al-vt"><button id="vX">✕</button><span>' + (idx + 1) + ' / ' + sorted.length + '</span><span></span></div><div class="al-vi"><img src="' + p.src + '"><button class="al-nav l" id="vP"' + (idx <= 0 ? ' disabled' : '') + '>‹</button><button class="al-nav r" id="vN"' + (idx >= sorted.length - 1 ? ' disabled' : '') + '>›</button></div>'
            + '<div class="al-vb"><div class="al-vm">' + esc(nameOfBy(p.by)) + ' 放入 · ' + fmt(p.ts) + (p.gen ? ' · TA 拍的（示意图）' : '') + '</div>' + (p.cap ? '<div class="al-vc">' + esc(p.cap) + '</div>' : '') + (p.gen && p.desc ? '<div class="al-vd">' + esc(p.desc) + '</div>' : '') + cms
            + '<div class="al-vbtn"><button id="vCap">写说明</button>' + ((a.kind === 'shared' || getChars().length) ? '<button id="vTa">让 TA 看看</button>' : '') + '<button id="vCv">设为封面</button><button id="vDl">保存</button><button class="dan" id="vDel">删除</button></div></div>';
        $('albumApp').appendChild(v);
        const g = (i) => v.querySelector('#' + i), go = (d) => { const t = sorted[idx + d]; if (t) viewer(aid, t.id); };
        g('vX').onclick = () => v.remove(); g('vP').onclick = () => go(-1); g('vN').onclick = () => go(1);
        let sx = null; v.querySelector('.al-vi').addEventListener('touchstart', (e) => { sx = e.touches[0].clientX; }, { passive: true });
        v.querySelector('.al-vi').addEventListener('touchend', (e) => { if (sx == null) return; const dx = e.changedTouches[0].clientX - sx; sx = null; if (Math.abs(dx) > 50) go(dx < 0 ? 1 : -1); });
        g('vCap').onclick = async () => { const t = await uiPrompt('这张照片的说明：', p.cap || ''); if (t === null) return; const ar = P(aid), x = ar.find(z => z.id === pid); x.cap = t.trim().slice(0, 60); SP(aid, ar); viewer(aid, pid); render(); };
        g('vCv').onclick = () => { const d = I(), x = d.albums.find(z => z.id === aid); x.cover = pid; SI(d); uiAlert('已设为封面'); render(); };
        g('vDl').onclick = () => { const l = document.createElement('a'); l.href = p.src; l.download = 'photo_' + fmt(p.ts) + '.' + (p.src.indexOf('image/webp') > 0 ? 'webp' : p.src.indexOf('image/png') > 0 ? 'png' : 'jpg'); document.body.appendChild(l); l.click(); l.remove(); };
        g('vDel').onclick = async () => { if (!(await uiConfirm('删除这张照片？'))) return; SP(aid, P(aid).filter(z => z.id !== pid)); v.remove(); render(); };
        if (g('vTa')) g('vTa').onclick = () => {
            const run = async (cid) => {
                const target = a.kind === 'shared' ? a : Object.assign({}, a, { charId: cid }), b = g('vTa');
                if (b) { b.disabled = true; b.textContent = '等 TA 回应…'; }
                try { await react(target, p); } catch (e) { uiAlert('失败：' + (e && e.message || e)); if (b) { b.disabled = false; b.textContent = '让 TA 看看'; } }
            };
            if (a.kind === 'shared') run(a.charId);
            else { const chars = getChars(), m = sheet('<h3>让谁来看</h3><div class="xa-chips">' + chars.map(c => '<button data-c="' + esc(c.id) + '">' + esc(c.name) + '</button>').join('') + '</div>'); m.querySelectorAll('[data-c]').forEach(b => b.onclick = () => { m.remove(); run(b.dataset.c); }); }
        };
    }

    // ---------- 给聊天用：TA 知道共同相册里有什么 ----------
    window.albumContext = function (c) {
        try {
            const d = I(), mine = d.albums.filter(a => a.kind === 'shared' && a.charId === c.id); if (!mine.length) return '';
            const lines = [];
            mine.slice(0, 3).forEach(a => {
                const ph = P(a.id).sort((x, y) => y.ts - x.ts).slice(0, 4);
                lines.push('「' + a.name + '」共 ' + P(a.id).length + ' 张' + (ph.length ? '，最近：' + ph.map(p => (p.by === 'me' ? '我放了' : '你放了') + (p.cap || p.desc || '一张照片')).join('；') : ''));
            });
            return '\n【我们的共同相册】' + lines.join(' | ') + '（可以自然地提起相册里的照片，但不要编造里面没有的内容）';
        } catch (e) { return ''; }
    };
    ensure();
    window.ALBUM = { open: () => { view = { t: 'list' }; openApp('album'); } };
})();
