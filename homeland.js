/* homeland.js —— 「小家园」：独立桌面 app。像素小屋 + 庭院，可以自己布置、捏小人，TA 也会自己动、自己布置。
   数据存在 life.couple.home（每个角色一份）；爱心和「同居小屋」共用 life.couple.hearts。 */
(function () {
    'use strict';
    const A = window.HLA, I = window.HLI; if (!A || !I) return;
    const $ = (id) => document.getElementById(id), esc = (s) => escapeHtml(String(s == null ? '' : s));
    const cid = () => { const s = store.getItem('homelandChar'); return s && getChar(s) ? s : getActiveCharId(); }, who = () => { const c = getChar(cid()); return c ? c.name : 'TA'; };
    const rnd = (a, b) => a + Math.floor(Math.random() * (b - a + 1)), pick = (a) => a[Math.floor(Math.random() * a.length)];
    const IT = I.ITEMS, SW = A.SW, SH = A.SH, FT = A.FT, GT = A.GT;
    const DPN = { morning: '早晨', day: '白天', evening: '傍晚', night: '深夜' };
    const heartSvg = (s, c) => '<svg class="li" width="' + (s || 13) + '" height="' + (s || 13) + '" viewBox="0 0 24 24" fill="' + (c || 'currentColor') + '" stroke="none"><path d="M12 20.5s-7.5-4.5-7.5-10A4.1 4.1 0 0 1 12 8a4.1 4.1 0 0 1 7.5 2.5c0 5.5-7.5 10-7.5 10z"/></svg>';

    // ---------- 接入桌面 ----------
    try {
        if (allApps.indexOf('homeland') < 0) allApps.push('homeland');
        if (!HOME_APPS.some(a => a.id === 'homeland')) { const i = HOME_APPS.findIndex(a => a.id === 'intimate'); HOME_APPS.splice(i >= 0 ? i + 1 : HOME_APPS.length, 0, { id: 'homeland', name: '小家园', cls: 'homeland-icon', face: '(◕ᴗ◕)', go: () => openApp('homeland') }); }
        GLYPH.homeland = '<path d="M4 11l8-6.5 8 6.5"/><path d="M6 10v9h12v-9"/><path d="M12 17s-3-1.8-3-3.9a1.7 1.7 0 0 1 3-.9 1.7 1.7 0 0 1 3 .9c0 2.1-3 3.9-3 3.9z"/>';
    } catch (e) {}

    // ---------- 数据 ----------
    const coupleK = () => { const c = getChar(cid()); if (!c) return {}; const L = lifeOf(c); return L.couple || {}; };
    const hearts = () => coupleK().hearts || 0;
    function refreshHN() { const el = $('hlHeart'); if (el) el.innerHTML = heartSvg(13) + ' ' + hearts(); }
    function addHearts(n) { lifeUpdate(cid(), (L) => { L.couple = L.couple || {}; L.couple.hearts = (L.couple.hearts || 0) + n; }); refreshHN(); }
    function reward() { // 一起互动：每天最多 3 次爱心 + 亲密度
        let g = 0; lifeUpdate(cid(), (L) => { L.couple = L.couple || {}; const k = L.couple, t = todayStr(); k.homeDay = k.homeDay || {}; if (k.homeDay.d !== t) k.homeDay = { d: t, n: 0 }; if (k.homeDay.n < 3) { k.homeDay.n++; k.hearts = (k.hearts || 0) + 1; g = 1; } });
        if (g) { try { addIntimacy(cid(), 1); } catch (e) {} } refreshHN(); return g;
    }
    let uid = 0; const nid = () => 'i' + Date.now().toString(36) + (uid++);
    let S = null;
    function defaults() {
        const own = {}, mk = (list) => list.map(a => { own[a[0]] = 1; return { id: nid(), k: a[0], x: a[1], y: a[2], c: null, flip: !!a[3] }; });
        return {
            v: 2, tm: 'auto', auto: true, own: own, av: {}, log: [], day: {},
            in: { wall: { c: '#fbf1e6', pat: 'stripe' }, floor: { c: '#e7cfae', pat: 'wood' }, items: mk([['window', 40, 34], ['frame', 112, 28], ['sofa', 120, 104], ['flamp', 158, 104], ['plant1', 14, 104], ['teatable', 46, 120], ['rug1', 96, 132]]) },
            out: { ground: { c: '#9fd28c' }, items: mk([['tree', 30, 88], ['flowers', 112, 84], ['bench', 120, 112], ['bush', 62, 80]]) }
        };
    }
    function loadS() {
        const c = getChar(cid()), raw = c && lifeOf(c).couple && lifeOf(c).couple.home;
        S = raw && raw.v === 2 ? JSON.parse(JSON.stringify(raw)) : defaults();
        S.own = S.own || {}; S.av = S.av || {}; S.log = S.log || []; S.day = S.day || {}; S.in = S.in || defaults().in; S.out = S.out || defaults().out;
        ['in', 'out'].forEach(r => { S[r].items = (S[r].items || []).filter(it => IT[it.k]); });
        if (!raw || raw.v !== 2) saveS();
    }
    function saveS() { lifeUpdate(cid(), (L) => { L.couple = L.couple || {}; L.couple.home = S; }); }
    const owned = (k) => !IT[k].price || !!S.own[k];
    function logAdd(text) { S.log.push({ ts: Date.now(), text: text }); if (S.log.length > 40) S.log.shift(); saveS(); }

    // ---------- 状态 ----------
    let roomKey = 'in', edit = false, sel = null, panelName = null, panelTab = {}, isOpen = false, timer = null, cv = null, cx = null, aiAt = 0, tog = null, curAct = '';
    const E = { me: null, ta: null }, parts = [], bgCache = {};
    const dOf = (it) => IT[it.k];
    const curDp = () => (S && S.tm && S.tm !== 'auto') ? S.tm : A.dayPartOf();
    const R = () => S[roomKey];
    function bbox(it) { const d = dOf(it); return d.layer === 'wall' ? { x0: it.x - d.w / 2, y0: it.y - d.h / 2, x1: it.x + d.w / 2, y1: it.y + d.h / 2 } : { x0: it.x - d.w / 2, y0: it.y - d.h, x1: it.x + d.w / 2, y1: it.y }; }
    const ORD = { rug: 0, wall: 1, floor: 2 };
    function clampPos(it) {
        const d = dOf(it); it.x = Math.round(A.clamp(it.x, d.w / 2, SW - d.w / 2));
        if (d.layer === 'wall') it.y = Math.round(A.clamp(it.y, d.h / 2 + 3, (roomKey === 'in' ? FT : GT) - d.h / 2 - 2));
        else it.y = Math.round(A.clamp(it.y, (roomKey === 'in' ? FT : GT) + (d.layer === 'rug' ? d.h : 8), SH - 1));
    }
    function overlapArea(a, b) { const w = Math.min(a.x1, b.x1) - Math.max(a.x0, b.x0), h = Math.min(a.y1, b.y1) - Math.max(a.y0, b.y0); return w > 0 && h > 0 ? w * h : 0; }
    function freeSpot(roomName, d) {
        const Rm = S[roomName], tmp = { k: d.k, x: 0, y: 0 }; let best = null, bs = 1e9;
        for (let n = 0; n < 70; n++) {
            tmp.x = rnd(Math.ceil(d.w / 2) + 4, SW - Math.ceil(d.w / 2) - 4);
            if (d.layer === 'wall') tmp.y = rnd(Math.ceil(d.h / 2) + 4, (roomName === 'in' ? FT : GT) - Math.ceil(d.h / 2) - 3);
            else tmp.y = rnd(((roomName === 'in' ? FT : GT) + (d.layer === 'rug' ? d.h : 12)), SH - 3);
            const b = bbox(tmp); let sc = 0; Rm.items.forEach(o => { const od = dOf(o); if ((od.layer === 'wall') !== (d.layer === 'wall')) return; if (od.layer === 'rug' || d.layer === 'rug') { sc += overlapArea(b, bbox(o)) * .15; return; } sc += overlapArea(b, bbox(o)); });
            if (sc < bs) { bs = sc; best = { x: tmp.x, y: tmp.y }; if (sc === 0) break; }
        } return best || { x: SW / 2, y: SH - 10 };
    }
    function roomOf(d) { return d.where === 'out' ? 'out' : d.where === 'in' ? 'in' : roomKey; }
    function addItem(k, opt) {
        const d = IT[k], rm = roomOf(d), p = (opt && opt.x != null) ? { x: opt.x, y: opt.y } : freeSpot(rm, d), it = { id: nid(), k: k, x: p.x, y: p.y, c: (opt && opt.c) || null, flip: false };
        const keep = roomKey; roomKey = rm; clampPos(it); roomKey = keep; S[rm].items.push(it); saveS(); return it;
    }

    // ---------- 小人实体 ----------
    function mkEnt(w) { return { w: w, x: 30, y: FT + 40, tx: 30, ty: FT + 40, pose: 'stand', spot: null, frame: 0, say: '', sayT: 0, next: Date.now() + 4000, stay: 0, bob: 0, arrived: true, busy: false }; }
    const avOf = (w) => A.cleanAvatar(S.av[w], w === 'ta' ? 'ta' : 'me');
    function findItem(id) { for (const r of ['in', 'out']) { const it = S[r].items.find(x => x.id === id); if (it) return { it: it, room: r }; } return null; }
    function spotPos(it, sp) { const x = it.x + (it.flip ? -sp.dx : sp.dx), y = sp.pose === 'stand' ? it.y + sp.dy : it.y + sp.dy - sp.lift; return { x: x, y: y }; }
    function occupied(it, idx, except) { return ['me', 'ta'].some(w => w !== except && E[w] && E[w].spot && E[w].spot.id === it.id && E[w].spot.idx === idx); }
    function setSpot(e, it, idx) { const sp = dOf(it).spots[idx], p = spotPos(it, sp); e.spot = { id: it.id, idx: idx }; e.tx = p.x; e.ty = p.y; e.arrived = false; e.pose = 'stand'; }
    function goTo(e, x, y) { e.spot = null; e.pose = 'stand'; const lo = roomKey === 'in' ? FT + 6 : GT + 10; e.tx = A.clamp(x, 12, SW - 12); e.ty = A.clamp(y, lo, SH - 2); e.arrived = false; }
    function moveEnt(e) {
        const dx = e.tx - e.x, dy = e.ty - e.y, d = Math.hypot(dx, dy);
        if (d > 1.2) { const sp = Math.min(d, 2.4); e.x += dx / d * sp; e.y += dy / d * sp; e.frame = (Math.floor(Date.now() / 160) % 2) + 1; e.pose = 'stand'; e.arrived = false; }
        else { if (!e.arrived) { e.x = e.tx; e.y = e.ty; e.arrived = true; } e.frame = 0; if (e.spot) { const f = findItem(e.spot.id); if (f) e.pose = dOf(f.it).spots[e.spot.idx].pose; else { e.spot = null; e.pose = 'stand'; } } else e.pose = 'stand'; }
        if (e.sayT && Date.now() > e.sayT) { e.say = ''; e.sayT = 0; }
    }
    const act = (e) => { if (e.spot) { const f = findItem(e.spot.id); if (f) { const sp = dOf(f.it).spots[e.spot.idx]; return sp.act || (sp.pose === 'sit' ? '坐着休息' : sp.pose === 'sleep' ? '在睡觉' : '站在' + dOf(f.it).n + '旁边'); } } return ''; };
    function speak(w, text, ms) { const e = E[w]; if (!e || !text) return; e.say = text; e.sayT = Date.now() + (ms || 5200); const b = $('hlBub_' + w); if (b) { b.textContent = text; b.classList.toggle('inv', !!(w === 'ta' && tog && tog.invite)); } }

    // ---------- 渲染 ----------
    function getBg(Rm, dp) {
        const key = roomKey + dp + JSON.stringify(roomKey === 'in' ? [Rm.wall, Rm.floor] : Rm.ground); if (bgCache[key]) return bgCache[key];
        if (Object.keys(bgCache).length > 12) Object.keys(bgCache).forEach(k => delete bgCache[k]);
        return (bgCache[key] = roomKey === 'in' ? A.bgInside(Rm, dp) : A.bgGarden(Rm, dp));
    }
    function drawItem(it, dp, nowD, fr) {
        const d = dOf(it), s = A.itemSprite(it.k, it.c || d.c, { on: !!it.on, dp: dp, now: nowD, frame: fr }); if (!s) return;
        const left = Math.round(it.x - d.w / 2) - 1, top = (d.layer === 'wall' ? Math.round(it.y - d.h / 2) : Math.round(it.y - d.h)) - 1;
        if (it.flip) { cx.save(); cx.translate(Math.round(it.x) * 2, 0); cx.scale(-1, 1); cx.drawImage(s.c, left, top); cx.restore(); } else cx.drawImage(s.c, left, top);
    }
    function drawChar(e, ctx2) {
        const s = A.charSprite(avOf(e.w), e.pose, e.pose === 'stand' ? e.frame : 0), bob = e.bob ? (Math.floor(Date.now() / 200) % 2) : 0, x = Math.round(e.x - s.w / 2), y = Math.round(e.y - s.h + 1 - bob);
        ctx2.drawImage(s.c, x, y);
        if (e.pose === 'sleep' && e.spot) { const f = findItem(e.spot.id), sp = f && dOf(f.it).spots[e.spot.idx]; if (sp && sp.blanket) { const col = (f.it.c || dOf(f.it).c), bx = x + 13, by = y + 5, bw = s.w - 14, bh = s.h - 8; ctx2.fillStyle = A.shade(col, -.42); ctx2.fillRect(bx - 1, by - 1, bw + 2, bh + 2); ctx2.fillStyle = A.shade(col, .1); ctx2.fillRect(bx, by, bw, bh); ctx2.fillStyle = A.shade(col, .3); ctx2.fillRect(bx, by, bw, 1); ctx2.fillStyle = A.shade(col, -.14); ctx2.fillRect(bx + 4, by + 1, 1, bh - 1); ctx2.fillRect(bx + 9, by + 1, 1, bh - 1); } }
    }
    const HEART = ['.XX.XX.', 'XXXXXXX', 'XXXXXXX', '.XXXXX.', '..XXX..', '...X...'], NOTE = ['..XXX', '..X.X', '..X..', 'XXX..', 'XXX..'], ZZZ = ['XXXX', '..X.', '.X..', 'XXXX'], SPARK = ['.X.', 'XXX', '.X.'];
    function drawPart(p) {
        const pat = p.kind === 'note' ? NOTE : p.kind === 'zzz' ? ZZZ : p.kind === 'spark' ? SPARK : HEART, col = p.kind === 'note' ? '#8fb6e8' : p.kind === 'zzz' ? '#b5b5e8' : p.kind === 'spark' ? '#ffe27a' : '#ff7fa0';
        cx.globalAlpha = Math.max(0, Math.min(1, p.life / 14)); cx.fillStyle = col; pat.forEach((r, j) => { for (let i = 0; i < r.length; i++) if (r[i] === 'X') cx.fillRect(Math.round(p.x) + i, Math.round(p.y) + j, 1, 1); }); cx.globalAlpha = 1;
    }
    function burst(x, y, kind, n) { for (let i = 0; i < (n || 4); i++) parts.push({ x: x + rnd(-8, 8), y: y + rnd(-4, 4), vy: -(0.35 + Math.random() * .5), vx: (Math.random() - .5) * .4, life: 28 + rnd(0, 14), kind: kind || 'heart' }); }
    function render(forPhoto) {
        const Rm = R(), dp = curDp(), nowD = new Date(), fr = Math.floor(Date.now() / 450) % 2;
        cx.imageSmoothingEnabled = false; cx.drawImage(getBg(Rm, dp), 0, 0);
        const items = Rm.items.slice().sort((a, b) => { const oa = ORD[dOf(a).layer] ?? 2, ob = ORD[dOf(b).layer] ?? 2; return oa !== ob ? oa - ob : a.y - b.y; });
        items.filter(it => dOf(it).layer !== 'floor').forEach(it => drawItem(it, dp, nowD, fr));
        const q = items.filter(it => dOf(it).layer === 'floor').map(it => ({ y: it.y, it: it }));
        ['me', 'ta'].forEach(w => { const e = E[w]; let key = e.y; if (e.spot) { const f = findItem(e.spot.id); if (f) key = Math.max(e.y, f.it.y + .5); } q.push({ y: key + .1, e: e }); });
        q.sort((a, b) => a.y - b.y).forEach(o => o.it ? drawItem(o.it, dp, nowD, fr) : drawChar(o.e, cx));
        // 光线：夜晚/傍晚压暗，再叠加灯光
        if (dp === 'night') { cx.fillStyle = 'rgba(16,20,58,.36)'; cx.fillRect(0, 0, SW, SH); } else if (dp === 'evening') { cx.fillStyle = 'rgba(255,130,90,.10)'; cx.fillRect(0, 0, SW, SH); } else if (dp === 'morning') { cx.fillStyle = 'rgba(255,225,205,.08)'; cx.fillRect(0, 0, SW, SH); }
        items.forEach(it => { const d = dOf(it), g = d.glow; if (!g) return; let a = g.always ? 1 : dp === 'night' ? 1 : dp === 'evening' ? .55 : 0; if (it.k === 'tvstand') return; if (a) { const b = bbox(it); A.glowDraw(cx, b.x0 + g.x, b.y0 + g.y, g.r, g.c, g.a * a); } });
        const tv = items.find(it => it.k === 'tvstand' && it.on); if (tv) { const b = bbox(tv); A.glowDraw(cx, b.x0 + 20, b.y0 + 9, 30, '#9ccbff', .4); }
        parts.forEach(drawPart);
        if (!forPhoto && edit && sel) { const it = Rm.items.find(x => x.id === sel); if (it) { const b = bbox(it); cx.strokeStyle = '#fff'; cx.lineWidth = 1; cx.setLineDash([2, 2]); cx.strokeRect(Math.round(b.x0) - 1.5, Math.round(b.y0) - 1.5, Math.round(b.x1 - b.x0) + 3, Math.round(b.y1 - b.y0) + 3); cx.strokeStyle = '#e85a8a'; cx.lineDashOffset = 2; cx.strokeRect(Math.round(b.x0) - 1.5, Math.round(b.y0) - 1.5, Math.round(b.x1 - b.x0) + 3, Math.round(b.y1 - b.y0) + 3); cx.setLineDash([]); cx.lineDashOffset = 0; } }
        if (!forPhoto && edit) { cx.fillStyle = 'rgba(255,255,255,.07)'; for (let i = 8; i < SW; i += 8) cx.fillRect(i, 0, 1, SH); for (let j = 8; j < SH; j += 8) cx.fillRect(0, j, SW, 1); }
    }

    // ---------- 主循环 ----------
    function tick() {
        if (!isOpen || !S) return;
        moveEnt(E.me); moveEnt(E.ta);
        for (let i = parts.length - 1; i >= 0; i--) { const p = parts[i]; p.x += p.vx; p.y += p.vy; if (--p.life <= 0) parts.splice(i, 1); }
        ['me', 'ta'].forEach(w => { const e = E[w]; if (e.pose === 'sleep' && Math.random() < .03) burst(e.x + 6, e.y - 16, 'zzz', 1); });
        if (tog) togTick(); else autonomy();
        const st = $('hlStatus'); if (st) { const a = tog && tog.done ? (tog.g.n + '中') : (act(E.ta) || (E.ta.arrived ? '在小屋里发呆' : '在走动')); const t = who() + ' ' + a; if (st.dataset.t !== t) { st.dataset.t = t; st.textContent = t; } }
        render(); placeBubbles();
    }
    function placeBubbles() {
        ['me', 'ta'].forEach(w => { const b = $('hlBub_' + w), e = E[w]; if (!b) return; const s = A.charSprite(avOf(w), e.pose, 0), vis = !!e.say; b.classList.toggle('on', vis); if (!vis) return; b.style.left = (e.x / SW * 100) + '%'; b.style.top = ((e.y - s.h - 2) / SH * 100) + '%'; });
    }

    // ---------- TA 自己动 ----------
    function spotWeight(it, sp, dp) {
        const u = dOf(it).use || ''; let w = 1;
        if (dp === 'night') w = u === 'bed' ? 9 : (u === 'sofa' || u === 'fire') ? 1.2 : .5;
        else if (dp === 'morning') w = ['counter', 'plant', 'dresser', 'fridge', 'desk'].indexOf(u) >= 0 ? 3 : u === 'bed' ? .05 : 1;
        else if (dp === 'day') w = ['desk', 'shelf', 'piano', 'tv', 'sofa', 'plant', 'swing', 'bench', 'hammock'].indexOf(u) >= 0 ? 2.2 : u === 'bed' ? .08 : 1;
        else w = ['sofa', 'tv', 'tea', 'fire', 'counter', 'bench'].indexOf(u) >= 0 ? 3 : u === 'bed' ? .15 : 1;
        return w;
    }
    const IDLE = { sofa: ['软软的，不想起来', '这个沙发真舒服'], bed: ['zzz…'], tea: ['茶还烫着呢', '想等你一起喝'], desk: ['在写点什么', '嘘，我在想事情'], shelf: ['这本我想借给你', '翻到有意思的了'], plant: ['长高了一点点', '给它们浇点水'], tv: ['这个节目还挺好笑', '你要不要一起看？'], piano: ['弹一首给你听', '♪'], fire: ['暖暖的', '火光好看'], counter: ['今天想做点好吃的', '尝尝咸淡'], rug: ['坐在地上也不错'], bench: ['晒晒太阳', '风好舒服'], swing: ['荡高一点～'], hammock: ['晃啊晃'], dresser: ['今天穿什么好呢'], fridge: ['有没有冰淇淋'], tent: ['在这里发呆'] };
    const VISIT = ['你在看什么呀', '过来坐一会儿嘛', '想你了，就过来看看', '你今天有点可爱', '要不要一起做点什么？', '我在这儿呢'];
    function autonomy() {
        const t = E.ta; if (!S.auto || t.busy || Date.now() < t.next) return;
        const dp = curDp(), Rm = R(), r = Math.random(); t.next = Date.now() + rnd(15000, 30000);
        if (t.spot && Date.now() < t.stay && r < .8) return;
        if (r < .5) {
            const cand = []; Rm.items.forEach(it => { const d = dOf(it); (d.spots || []).forEach((sp, i) => { if (!occupied(it, i, 'ta') && !(E.me.spot && E.me.spot.id === it.id && E.me.spot.idx === i)) cand.push({ it: it, i: i, w: spotWeight(it, sp, dp) }); }); });
            if (cand.length) { let tot = cand.reduce((a, c) => a + c.w, 0), x = Math.random() * tot, ch = cand[0]; for (const c of cand) { x -= c.w; if (x <= 0) { ch = c; break; } } setSpot(t, ch.it, ch.i); t.stay = Date.now() + rnd(20000, 45000); const u = dOf(ch.it).use; if (Math.random() < .5 && IDLE[u]) setTimeout(() => speak('ta', pick(IDLE[u])), 2500); return; }
        }
        if (r < .72) { goTo(t, rnd(20, SW - 20), rnd((roomKey === 'in' ? FT : GT) + 14, SH - 6)); return; }
        if (r < .94) { // 来找我
            const side = E.me.x > SW / 2 ? -14 : 14; goTo(t, E.me.x + side, E.me.y);
            if (Math.random() < .35) { const k = pick(TOGS.filter(g => g.free || findUse(g.use))); setTimeout(() => { if (tog) return; tog = { g: k, invite: true, t0: Date.now(), done: false, wait: true }; speak('ta', k.inv || ('一起' + k.n + '吧？'), 9000); }, 1800); }
            else setTimeout(() => speak('ta', pick(VISIT)), 1800); return;
        }
        const b = Math.random(); speak('ta', pick(['今天过得好快', '你猜我在想什么', '嗯…再待一会儿', '这里好安静']));
    }

    // ---------- 一起做 ----------
    const TOGS = [
        { k: 'hug', n: '抱抱', free: true, fx: 'heart', ai: '我走过去抱了抱你。', fb: ['让我抱一会儿', '你身上暖暖的'] },
        { k: 'hand', n: '牵手', free: true, fx: 'heart', ai: '我牵起了你的手。', fb: ['手给我', '这样就不会走丢啦'] },
        { k: 'pat', n: '摸摸头', free: true, fx: 'spark', ai: '我摸了摸你的头。', fb: ['乖', '摸摸，辛苦啦'] },
        { k: 'dance', n: '一起跳舞', free: true, fx: 'note', ai: '我们在小家园里随便跳起舞来。', fb: ['跟着我转一圈', '嘿嘿，没人看见'] },
        { k: 'sofa', n: '靠在一起', use: 'sofa', ai: '我们并排坐在沙发上，靠在一起。', fb: ['就这样靠着吧', '你的肩膀刚刚好'], inv: '过来，靠着我嘛' },
        { k: 'tv', n: '一起看电影', use: 'tv', ai: '我们在电视前一起看电影。', fb: ['这段我看过，要不要剧透', '你别睡着啦'], inv: '要不要一起看个电影？' },
        { k: 'tea', n: '喝茶聊天', use: 'tea', ai: '我们坐在茶桌前喝茶聊天。', fb: ['茶刚好', '再给你添一杯'], inv: '喝杯茶吗？我泡好了' },
        { k: 'rug', n: '坐地毯上', use: 'rug', ai: '我们坐在地毯上聊天。', fb: ['坐地上更自在', '这样离你近一点'] },
        { k: 'bed', n: '一起午睡', use: 'bed', ai: '我们一起躺在床上，准备睡一会儿。', fb: ['晚安…不对现在是白天', '抱着睡好不好'], inv: '好困，要不要一起睡会儿' },
        { k: 'counter', n: '一起做饭', use: 'counter', ai: '我们在厨台前一起做饭。', fb: ['你负责尝味道', '别偷吃呀'], inv: '一起做饭吗？' },
        { k: 'piano', n: '听我弹琴', use: 'piano', fx: 'note', ai: '我坐在钢琴前，弹琴给你听。', fb: ['这首是为你弹的', '听出来是什么了吗'], inv: '想不想听我弹首曲子' },
        { k: 'shelf', n: '一起翻书', use: 'shelf', ai: '我们站在书架前一起翻书。', fb: ['这本你肯定喜欢', '念一段给你听'] },
        { k: 'plant', n: '一起浇花', use: 'plant', ai: '我们一起给植物浇水。', fb: ['它们也会想你的', '慢一点，别淹了'] },
        { k: 'fire', n: '围着火取暖', use: 'fire', ai: '我们围着火取暖。', fb: ['火光里的你很好看', '再靠近一点就暖了'] },
        { k: 'bench', n: '并排坐着', use: 'bench', ai: '我们在庭院的长椅上并排坐着。', fb: ['晒着太阳啥也不想', '风里有花香'] },
        { k: 'swing', n: '陪我荡秋千', use: 'swing', ai: '我在秋千上，你在旁边陪着。', fb: ['推我一下嘛', '好高好高！'], inv: '来推我荡秋千' },
        { k: 'hammock', n: '吊床晃晃', use: 'hammock', ai: '我们在吊床边消磨时间。', fb: ['晃啊晃就睡着了'] },
        { k: 'tent', n: '帐篷发呆', use: 'tent', ai: '我们在帐篷边发呆。', fb: ['这里像秘密基地'] }
    ];
    function findUse(use) { for (const r of [roomKey, roomKey === 'in' ? 'out' : 'in']) { const it = S[r].items.find(x => dOf(x).use === use && (dOf(x).spots || []).length); if (it) return { it: it, room: r }; } return null; }
    function switchRoom(k, keep) {
        roomKey = k; sel = null; E.me.spot = null; E.ta.spot = null; E.me.x = 6; E.me.y = (k === 'in' ? FT + 40 : GT + 36); E.ta.x = -4; E.ta.y = E.me.y - 8; goTo(E.me, 30, E.me.y); goTo(E.ta, 14, E.me.y - 8);
        const tabs = $('hlRoomTabs'); if (tabs) tabs.querySelectorAll('button').forEach(b => b.classList.toggle('on', b.dataset.r === k)); if (!keep) { tog = null; renderPanel(); }
    }
    function startTogether(g) {
        if (tog && !tog.invite) return; E.ta.busy = true; E.ta.next = Date.now() + 40000;
        if (!g.free) {
            const f = findUse(g.use); if (!f) { uiAlert('小家园里还没有能「' + g.n + '」的家具，去商店买一个吧'); E.ta.busy = false; return; }
            if (f.room !== roomKey) switchRoom(f.room, true);
            const d = dOf(f.it), n = d.spots.length;
            if (n >= 2) { setSpot(E.me, f.it, 0); setSpot(E.ta, f.it, 1); } else { setSpot(E.ta, f.it, 0); const p = spotPos(f.it, d.spots[0]); goTo(E.me, p.x + (p.x > SW / 2 ? -17 : 17), p.y); }
            if (f.it.k === 'tvstand') f.it.on = true; tog = { g: g, t0: Date.now(), done: false, it: f.it };
        } else { const side = E.me.x > SW / 2 ? -13 : 13; E.me.spot = null; goTo(E.ta, E.me.x + side, E.me.y); tog = { g: g, t0: Date.now(), done: false }; }
        closePanel();
    }
    async function togTick() {
        if (tog.wait && tog.invite) { if (Date.now() - tog.t0 > 12000) { tog = null; E.ta.busy = false; E.ta.next = Date.now() + 6000; const b = $('hlBub_ta'); if (b) b.classList.remove('inv'); } return; }
        const g = tog.g;
        if (!tog.done) {
            const ok = E.me.arrived && E.ta.arrived, to = Date.now() - tog.t0 > 14000; if (!ok && !to) return;
            tog.done = true; tog.tDone = Date.now(); const mx = (E.me.x + E.ta.x) / 2, my = Math.min(E.me.y, E.ta.y) - 18;
            burst(mx, my, g.fx || 'heart', g.k === 'hug' ? 8 : 5); if (g.k === 'dance') { E.me.bob = 1; E.ta.bob = 1; } if (g.k === 'pat') speak('me', '( ˘ω˘ )', 3000);
            const gain = reward(); if (gain) { burst(mx, my - 6, 'heart', 2); uiAlert('小家园互动 +1 爱心', 1600); }
            logAdd((g.k === 'hug' ? '和你抱了抱' : '和你' + g.n) + (gain ? '（+1♥）' : ''));
            const fb = pick(g.fb); speak('ta', fb, 5200); const line = await aiLine(ctxText() + g.ai + '请你以角色本人的口吻说一句话，口语、有感情，不超过30字，只输出这句话。', null, 9000);
            if (line && tog && tog.g === g) speak('ta', line, 6500); return;
        }
        if (Date.now() - tog.tDone > 12000) { E.me.bob = 0; E.ta.bob = 0; E.ta.busy = false; E.ta.next = Date.now() + 8000; const it = tog.it; if (it && it.k === 'tvstand') it.on = false; tog = null; }
    }
    function ctxText() { const a = act(E.ta); return '【小家园·像素小屋】我(用户)和你(角色)住在一起。现在是' + DPN[curDp()] + '，我们在' + (roomKey === 'in' ? '室内' : '庭院') + (a ? '，你' + a : '') + '。'; }
    async function aiLine(task, fallback, gap) {
        if (!API_KEY || Date.now() - aiAt < (gap || 20000)) return fallback; aiAt = Date.now();
        try { const r = oneLine(await callPersona(cid(), task, 1.0)); return r || fallback; } catch (e) { return fallback; }
    }

    // ---------- 点击交互 ----------
    function toLogical(ev) { const r = cv.getBoundingClientRect(); return { x: (ev.clientX - r.left) / r.width * SW, y: (ev.clientY - r.top) / r.height * SH }; }
    function hitItem(p) { const l = R().items.slice().sort((a, b) => { const oa = ORD[dOf(a).layer] ?? 2, ob = ORD[dOf(b).layer] ?? 2; return oa !== ob ? oa - ob : a.y - b.y; }).reverse(); return l.find(it => { const b = bbox(it); return p.x >= b.x0 && p.x <= b.x1 && p.y >= b.y0 && p.y <= b.y1; }) || null; }
    function hitChar(p, w) { const e = E[w], s = A.charSprite(avOf(w), e.pose, 0); return p.x >= e.x - s.w / 2 && p.x <= e.x + s.w / 2 && p.y >= e.y - s.h && p.y <= e.y + 2; }
    let drag = null;
    function onDown(ev) {
        if (!S) return; ev.preventDefault(); const p = toLogical(ev);
        if (edit) { const it = hitItem(p); if (it) { sel = it.id; drag = { id: it.id, dx: it.x - p.x, dy: it.y - p.y, moved: false }; try { cv.setPointerCapture(ev.pointerId); } catch (e) {} } else sel = null; renderPanel(); return; }
        drag = { tap: true, p: p, t: Date.now() };
    }
    function onMove(ev) {
        if (!drag || !drag.id) return; const p = toLogical(ev), it = R().items.find(x => x.id === drag.id); if (!it) return;
        it.x = Math.round((p.x + drag.dx) / 1) ; it.y = Math.round(p.y + drag.dy); clampPos(it); drag.moved = true;
    }
    function onUp(ev) {
        if (!drag) return; const d = drag; drag = null;
        if (d.id) { if (d.moved) saveS(); return; }
        if (d.tap && !edit) playTap(d.p);
    }
    function playTap(p) {
        const b = $('hlBub_ta'); if (tog && tog.invite && tog.wait && hitChar(p, 'ta')) { const g = tog.g; tog = null; E.ta.busy = false; b.classList.remove('inv'); startTogether(g); return; }
        if (hitChar(p, 'ta')) { pokeTA(); return; }
        if (hitChar(p, 'me')) { speak('me', pick(['嗯？', '今天也要好好的', '想换身衣服了']), 2600); return; }
        const it = hitItem(p);
        if (it && (dOf(it).spots || []).length) { const d = dOf(it); let idx = d.spots.findIndex((sp, i) => !occupied(it, i, 'me')); if (idx < 0) idx = 0; setSpot(E.me, it, idx); if (it.k === 'tvstand') { it.on = !it.on; } return; }
        if (it && (it.k === 'tvstand' || dOf(it).use === 'fire' || dOf(it).use === 'tv')) { it.on = !it.on; return; }
        goTo(E.me, p.x, p.y);
    }
    async function pokeTA() {
        const e = E.ta; e.busy = true; e.next = Date.now() + 12000; burst(e.x, e.y - 24, 'heart', 3); const fb = pick(['诶？干嘛戳我', '嗯？在呢', '再戳就要还手了哦', '想我啦']); speak('ta', fb, 4000);
        const line = await aiLine(ctxText() + '我戳了你一下。请你以角色本人的口吻说一句话，口语、有感情，不超过25字，只输出这句话。', null, 12000); if (line) speak('ta', line, 5500); e.busy = false;
    }

    // ---------- 界面 ----------
    function ensure() {
        if ($('homelandApp')) return;
        const el = document.createElement('div'); el.id = 'homelandApp'; el.className = 'app-screen hidden';
        el.innerHTML = '<div class="app-header"><button onclick="goHome()">‹ 返回</button><span id="hlTitle">小家园</span><span style="display:flex;align-items:center;gap:6px"><button class="hdr-btn" id="hlSwitch">换人</button><span class="hl-heart" id="hlHeart"></span></span></div>'
            + '<div class="hl-rooms" id="hlRoomTabs"><button data-r="in" class="on">室内</button><button data-r="out">庭院</button><i></i><button data-r="tm" id="hlTm">时间：现实</button></div>'
            + '<div class="hl-stage" id="hlStage"><canvas id="hlCv" width="' + SW + '" height="' + SH + '"></canvas><div class="hl-bub" id="hlBub_ta"></div><div class="hl-bub me" id="hlBub_me"></div></div>'
            + '<div class="hl-status" id="hlStatus"></div>'
            + '<div class="hl-bar" id="hlBar"><button data-p="edit">布置</button><button data-p="shop">商店</button><button data-p="tog">一起</button><button data-p="look">小人</button><button data-p="ta">TA</button><button data-p="snap">拍照</button></div>'
            + '<div class="hl-panel" id="hlPanel"></div><div class="hl-layer hidden" id="hlLayer"></div>';
        ($('callScreen') ? $('callScreen').parentElement : document.body).appendChild(el);
        cv = $('hlCv'); cx = cv.getContext('2d'); cv.style.imageRendering = 'pixelated';
        cv.addEventListener('pointerdown', onDown); cv.addEventListener('pointermove', onMove); cv.addEventListener('pointerup', onUp); cv.addEventListener('pointercancel', () => { drag = null; });
        $('hlBub_ta').onclick = () => { if (tog && tog.invite && tog.wait) { const g = tog.g; tog = null; E.ta.busy = false; $('hlBub_ta').classList.remove('inv'); startTogether(g); } };
        $('hlRoomTabs').querySelectorAll('button').forEach(b => b.onclick = () => {
            if (b.dataset.r === 'tm') { const o = ['auto', 'morning', 'day', 'evening', 'night'], n = o[(o.indexOf(S.tm || 'auto') + 1) % o.length]; S.tm = n; saveS(); b.textContent = '时间：' + (n === 'auto' ? '现实' : DPN[n]); return; }
            switchRoom(b.dataset.r);
        });
        $('hlSwitch').onclick = async () => {
            const cs = getChars(); if (cs.length < 2) { uiAlert('现在只有一个角色～先去通讯录添加更多角色，就能选和谁一起住啦'); return; }
            const v = await uiChoose('和谁一起住小家园？（每个人的家是分开的，各自保存）', cs.map(c => ({ label: c.name, v: c.id, primary: c.id === cid() })).concat([{ label: '取消', v: '' }]));
            if (!v || v === cid()) return; store.setItem('homelandChar', v); onClose(); onOpen();
        };
        $('hlBar').querySelectorAll('button').forEach(b => b.onclick = () => barClick(b.dataset.p));
        new MutationObserver(() => { if (!el.classList.contains('hidden')) onOpen(); else onClose(); }).observe(el, { attributes: true, attributeFilter: ['class'] });
    }
    function onOpen() {
        if (!cid()) { uiAlert('请先创建并选择一个角色'); goHome(); return; }
        loadS(); if (!S.starter) { S.starter = 1; saveS(); addHearts(20); setTimeout(() => uiAlert('搬进小家园的见面礼：+20 爱心', 2600), 1200); } isOpen = true; roomKey = 'in'; edit = false; sel = null; tog = null; parts.length = 0; E.me = mkEnt('me'); E.ta = mkEnt('ta');
        E.me.x = E.me.tx = 60; E.me.y = E.me.ty = FT + 44; E.ta.x = E.ta.tx = 130; E.ta.y = E.ta.ty = FT + 40;
        $('hlTitle').textContent = who() + ' 的小家园'; $('hlTm').textContent = '时间：' + (S.tm === 'auto' || !S.tm ? '现实' : DPN[S.tm]); $('hlRoomTabs').querySelectorAll('button[data-r="in"],button[data-r="out"]').forEach(b => b.classList.toggle('on', b.dataset.r === 'in'));
        refreshHN(); closePanel(); $('hlBar').querySelector('[data-p="edit"]').classList.remove('on');
        // 先摆在合适的位置：TA 一般在做自己的事
        const dp = curDp(); const t = E.ta; t.next = 0; autonomy(); if (t.spot) { const f = findItem(t.spot.id); if (f) { const p = spotPos(f.it, dOf(f.it).spots[t.spot.idx]); t.x = t.tx = p.x; t.y = t.ty = p.y; t.arrived = true; } } t.next = Date.now() + 8000;
        clearInterval(timer); timer = setInterval(tick, 125); tick();
        setTimeout(() => { if (isOpen) welcome(); }, 900);
    }
    function onClose() { isOpen = false; clearInterval(timer); closePanel(); }
    async function welcome() {
        if (!S.auto) return; const fb = pick(['你来啦～', '回来啦，我等你好一会儿了', '欢迎回家']); speak('ta', fb, 4200);
        const t0 = S.day.d !== todayStr(); if (t0) { S.day = { d: todayStr(), dec: 0 }; saveS(); }
        if ((S.day.dec || 0) < 2 && Date.now() - (S.lastDecor || 0) > 6 * 3600 * 1000) setTimeout(() => { if (isOpen) taDecorate(false); }, 5200);
    }
    function barClick(p) {
        if (p === 'snap') { snap(); return; }
        if (p === 'look') { openLook(); return; }
        if (p === 'edit') { edit = !edit; sel = null; $('hlBar').querySelector('[data-p="edit"]').classList.toggle('on', edit); if (edit) openPanel('edit'); else closePanel(); return; }
        if (edit && p !== 'edit') { edit = false; $('hlBar').querySelector('[data-p="edit"]').classList.remove('on'); }
        if (panelName === p) { closePanel(); return; } openPanel(p);
    }
    function openPanel(n) { panelName = n; $('hlPanel').classList.remove('hidden'); $('hlBar').querySelectorAll('button').forEach(b => b.classList.toggle('on', b.dataset.p === n || (b.dataset.p === 'edit' && edit))); renderPanel(); }
    function closePanel() { panelName = null; const p = $('hlPanel'); if (p) { p.classList.remove('hidden'); p.innerHTML = '<p class="hl-hint">点点画面里的 TA 和家具试试：点地面我会走过去，点家具会坐下；TA 也会自己动。<br>下面的按钮可以布置家具、逛商店、一起互动、捏小人、拍照。</p>'; } if ($('hlBar')) $('hlBar').querySelectorAll('button').forEach(b => b.classList.toggle('on', b.dataset.p === 'edit' && edit)); }
    function tabsHtml(list, cur) { return '<div class="hl-tabs">' + list.map(t => '<button data-t="' + t[0] + '"' + (cur === t[0] ? ' class="on"' : '') + '>' + t[1] + '</button>').join('') + '</div>'; }
    const colorRow = (id, cur, presets) => '<div class="hl-sw" data-id="' + id + '">' + presets.map(c => '<i data-c="' + c + '" style="background:' + c + '"' + (cur && cur.toLowerCase() === c ? ' class="on"' : '') + '></i>').join('') + '<label class="hl-cu"><input type="color" value="' + (/^#[0-9a-f]{6}$/i.test(cur || '') ? cur : '#ffffff') + '"><span>自定</span></label></div>';
    function bindColor(root, id, fn) { const row = root.querySelector('.hl-sw[data-id="' + id + '"]'); if (!row) return; row.querySelectorAll('i').forEach(i => i.onclick = () => fn(i.dataset.c)); const inp = row.querySelector('input'); inp.oninput = () => fn(inp.value); inp.onchange = () => fn(inp.value); }
    function renderPanel() {
        const P = $('hlPanel'); if (!P || !panelName) return;
        const t = (panelTab[panelName] || ''), room = R();
        if (panelName === 'edit') {
            const sub = t || 'item', it = sel && room.items.find(x => x.id === sel);
            let h = tabsHtml([['item', '家具'], ['wall', roomKey === 'in' ? '墙面地面' : '草地']], sub);
            if (sub === 'item') {
                if (!it) h += '<p class="hl-hint">拖动家具来摆放，点一下选中后可以翻转、换色、收起。<br>想要新家具？去「商店」用爱心换～</p><button class="hl-btn" data-a="done">布置好了</button>';
                else { const d = dOf(it); h += '<div class="hl-sel"><b>' + esc(d.n) + '</b><div class="hl-row"><button data-a="flip">翻转</button><button data-a="copy">再来一个</button><button data-a="del">收起来</button><button data-a="done">完成</button></div>' + (d.pal === false ? '' : '<div class="hl-sub">颜色</div>' + colorRow('ic', it.c || d.c, ['#ffffff', '#f6c9d4', '#f0a9b8', '#e87f8f', '#ffd9a0', '#ffe08a', '#bfe0b4', '#8fc096', '#9bbbd9', '#c7b8e6', '#d9c7ad', '#4a4a55']) + '<button class="hl-mini" data-a="rc">恢复原色</button>') + '</div>'; }
            } else if (roomKey === 'in') {
                h += '<div class="hl-sub">墙面颜色</div>' + colorRow('wc', room.wall.c, A.WALL_PRESETS) + '<div class="hl-sub">墙面花纹</div>' + chips('wp', A.WALL_PATS, room.wall.pat) + '<div class="hl-sub">地面颜色</div>' + colorRow('fc', room.floor.c, A.FLOOR_PRESETS) + '<div class="hl-sub">地面花纹</div>' + chips('fp', A.FLOOR_PATS, room.floor.pat);
            } else h += '<div class="hl-sub">草地颜色</div>' + colorRow('gc', room.ground.c, A.GROUND_PRESETS);
            P.innerHTML = h; bindTabs(P, 'edit');
            P.querySelectorAll('[data-a]').forEach(b => b.onclick = () => editAct(b.dataset.a));
            if (it) { bindColor(P, 'ic', (c) => { it.c = c; saveS(); }); }
            bindColor(P, 'wc', (c) => { room.wall.c = c; saveS(); }); bindColor(P, 'fc', (c) => { room.floor.c = c; saveS(); }); bindColor(P, 'gc', (c) => { room.ground.c = c; saveS(); });
            bindChips(P, 'wp', (v) => { room.wall.pat = v; saveS(); renderPanel(); }); bindChips(P, 'fp', (v) => { room.floor.pat = v; saveS(); renderPanel(); });
        } else if (panelName === 'shop') {
            const cat = t || 'all', cats = [['all', '全部']].concat(I.CATS);
            let h = '<div class="hl-shophd"><span>用爱心换家具</span><b>' + heartSvg(13) + ' ' + hearts() + '</b></div>' + tabsHtml(cats, cat) + '<div class="hl-grid" id="hlGrid"></div><p class="hl-hint">买过的家具可以重复摆放。每天和 TA 互动、玩「每日小默契」「心跳共振」都能攒爱心。</p>';
            P.innerHTML = h; bindTabs(P, 'shop');
            const grid = $('hlGrid'); Object.keys(IT).filter(k => { const d = IT[k]; if (cat !== 'all' && d.cat !== cat) return false; return d.where === 'both' || d.where === roomKey; }).sort((a, b) => IT[a].price - IT[b].price).forEach(k => {
                const d = IT[k], own = owned(k), cell = document.createElement('div'); cell.className = 'hl-cell' + (own ? ' own' : '');
                const s = A.itemSprite(k, d.c, { dp: 'day', now: new Date(), frame: 0 }), c2 = document.createElement('canvas'); const sc = Math.min(2, 56 / s.w, 44 / s.h); c2.width = s.w; c2.height = s.h; c2.getContext('2d').drawImage(s.c, 0, 0); c2.style.width = Math.round(s.w * sc) + 'px'; c2.style.height = Math.round(s.h * sc) + 'px';
                const th = document.createElement('div'); th.className = 'hl-th'; th.appendChild(c2); cell.appendChild(th);
                cell.insertAdjacentHTML('beforeend', '<span>' + esc(d.n) + '</span><em>' + (own ? (d.price ? '已拥有 · 放一个' : '免费 · 放一个') : heartSvg(11) + ' ' + d.price) + '</em>'); cell.onclick = () => shopTap(k); grid.appendChild(cell);
            });
        } else if (panelName === 'tog') {
            let h = '<div class="hl-sub" style="margin-top:2px">和 ' + esc(who()) + ' 一起做点什么（每天前 3 次有爱心）</div><div class="hl-tog">';
            TOGS.forEach(g => { const ok = g.free || findUse(g.use); h += '<button data-g="' + g.k + '"' + (ok ? '' : ' class="dim"') + '>' + g.n + '</button>'; }); h += '</div><p class="hl-hint">灰色的是还没有对应家具，点一下会告诉你缺什么。TA 有时也会主动来邀请你。</p>';
            P.innerHTML = h; P.querySelectorAll('[data-g]').forEach(b => b.onclick = () => startTogether(TOGS.find(g => g.k === b.dataset.g)));
        } else if (panelName === 'ta') {
            const log = S.log.slice(-8).reverse();
            P.innerHTML = '<div class="hl-sel"><b>' + esc(who()) + '</b><div class="hl-row"><button data-a="dec">让 TA 布置一下</button><button data-a="look">让 TA 自己换装</button></div><label class="hl-switch"><input type="checkbox" id="hlAuto"' + (S.auto ? ' checked' : '') + '><span>TA 主动一点（自己走动、邀请我、偶尔添置家具）</span></label></div><div class="hl-sub">最近的动态</div><div class="hl-log">' + (log.length ? log.map(l => '<p><i>' + new Date(l.ts).toLocaleString('zh-CN', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' }) + '</i>' + esc(l.text) + '</p>').join('') : '<p class="hl-hint">还没有动态，等 TA 自己动一动吧</p>') + '</div>';
            $('hlAuto').onchange = (e) => { S.auto = e.target.checked; saveS(); }; P.querySelector('[data-a="dec"]').onclick = () => taDecorate(true); P.querySelector('[data-a="look"]').onclick = () => taPickLook();
        }
    }
    const chips = (id, list, cur) => '<div class="hl-chips" data-id="' + id + '">' + list.map(o => '<button data-v="' + o[0] + '"' + (cur === o[0] ? ' class="on"' : '') + '>' + o[1] + '</button>').join('') + '</div>';
    function bindChips(root, id, fn) { const r = root.querySelector('.hl-chips[data-id="' + id + '"]'); if (r) r.querySelectorAll('button').forEach(b => b.onclick = () => fn(b.dataset.v)); }
    function bindTabs(root, name) { root.querySelectorAll('.hl-tabs button').forEach(b => b.onclick = () => { panelTab[name] = b.dataset.t; renderPanel(); }); }
    function editAct(a) {
        const room = R(), it = room.items.find(x => x.id === sel);
        if (a === 'done') { edit = false; sel = null; closePanel(); return; }
        if (!it) return;
        if (a === 'flip') it.flip = !it.flip; else if (a === 'rc') it.c = null; else if (a === 'copy') { const n = addItem(it.k, { x: it.x + 8, y: it.y + 6, c: it.c }); n.flip = it.flip; sel = n.id; }
        else if (a === 'del') { room.items = room.items.filter(x => x !== it); sel = null; }
        saveS(); renderPanel();
    }
    async function shopTap(k) {
        const d = IT[k], rm = roomOf(d);
        if (!owned(k)) { if (hearts() < d.price) { uiAlert('爱心不够啦，先去和 TA 互动攒一攒～'); return; } if (!(await uiConfirm('用 ' + d.price + ' 个爱心换「' + d.n + '」吗？', { ok: '换' }))) return; addHearts(-d.price); S.own[k] = 1; }
        if (rm !== roomKey) switchRoom(rm); const it = addItem(k); edit = true; sel = it.id; $('hlBar').querySelector('[data-p="edit"]').classList.add('on'); panelTab.edit = 'item'; openPanel('edit'); uiAlert('已放进' + (rm === 'in' ? '室内' : '庭院') + '，拖动调整位置', 1800);
    }

    // ---------- TA 布置 / 换装 ----------
    let decBusy = false;
    async function taDecorate(manual) {
        if (decBusy) return; const day = S.day; if (day.d !== todayStr()) { S.day = { d: todayStr(), dec: 0 }; } if ((S.day.dec || 0) >= (manual ? 5 : 2)) { if (manual) uiAlert('TA 今天已经布置很多次啦，明天再来吧'); return; }
        decBusy = true; const rm = roomKey, avail = Object.keys(IT).filter(k => IT[k].where === 'both' || IT[k].where === rm), cur = R().items.map(it => dOf(it).n).join('、') || '空空的';
        if (manual) uiAlert(who() + ' 在想怎么布置…', 1500);
        let res = null;
        if (API_KEY) {
            try {
                const cat = avail.map(k => k + ':' + IT[k].n + '(' + (I.CATS.find(c => c[0] === IT[k].cat) || [0, ''])[1] + ')').join('，');
                const raw = await callPersona(cid(), ctxText() + '你想按自己的喜好，给我们的' + (rm === 'in' ? '室内小屋' : '庭院') + '添置 1-2 件东西（当作送给我的小惊喜，不用花我的爱心），也可以顺手换个墙面/地板颜色。现在已有：' + cur + '。可选家具(id:名字)：' + cat + '。画布宽176高144，室内墙面在上方y<76、地面y在76-144，落地家具的 y 是脚底、x 是中心；墙饰 y 是中心。请只输出 JSON，不要其他文字：{"say":"一句话，用你的口吻说说为什么这么布置，不超过30字","add":[{"k":"家具id","x":数字,"y":数字,"c":"可选#RRGGBB"}],"wall":"可选#RRGGBB","floor":"可选#RRGGBB"}', 1.0);
                res = parseJSONLoose(raw);
            } catch (e) { res = null; }
        }
        const added = [];
        const okc = (c) => /^#[0-9a-f]{6}$/i.test(String(c || ''));
        if (res && Array.isArray(res.add)) res.add.slice(0, 2).forEach(a => { if (!a || !IT[a.k] || !avail.includes(a.k)) return; const d = IT[a.k]; const o = { c: okc(a.c) ? a.c : null }; const it = addItem(a.k, o); if (typeof a.x === 'number' && typeof a.y === 'number') { const bx = it.x, by = it.y; it.x = a.x; it.y = a.y; const keep = roomKey; roomKey = roomOf(d); clampPos(it); roomKey = keep; const b = bbox(it); const clash = S[roomOf(d)].items.some(o2 => o2 !== it && (dOf(o2).layer === 'wall') === (d.layer === 'wall') && dOf(o2).layer !== 'rug' && d.layer !== 'rug' && overlapArea(b, bbox(o2)) > 120); if (clash) { it.x = bx; it.y = by; } } S.own[a.k] = 1; added.push(d.n); });
        if (!added.length) { // 本地兜底：挑一件还没摆的小东西
            const have = new Set(R().items.map(i => i.k)), pool = avail.filter(k => !have.has(k) && IT[k].price <= 22 && IT[k].cat !== 'bed'); if (pool.length) { const k = pick(pool), it = addItem(k); S.own[k] = 1; added.push(IT[k].n); }
        }
        if (res && okc(res.wall) && rm === 'in' && Math.random() < .6) { R().wall.c = res.wall; added.push('墙面颜色'); }
        if (res && okc(res.floor) && rm === 'in' && Math.random() < .6) { R().floor.c = res.floor; added.push('地面颜色'); }
        S.day.dec = (S.day.dec || 0) + 1; S.lastDecor = Date.now(); const say = (res && res.say && String(res.say).slice(0, 40)) || pick(['看到这个就想到你了', '摆在这里应该不错', '给你的小惊喜～']);
        logAdd('布置了小家园：' + (added.join('、') || '稍微挪了挪')); decBusy = false; saveS();
        if (added.length && S[rm].items.length) { const last = S[rm].items[S[rm].items.length - 1]; const b = bbox(last); goTo(E.ta, last.x + 16, Math.max(roomKey === 'in' ? FT + 14 : GT + 16, Math.min(SH - 4, last.y + 4))); burst(last.x, b.y0, 'spark', 5); }
        speak('ta', say, 7000); if (panelName) renderPanel();
    }
    async function taPickLook() {
        if (!window.HLCHAR) return; const old = avOf('ta'); let av = null;
        if (API_KEY) {
            uiAlert(who() + ' 在挑造型…', 1500);
            try {
                const L = (arr) => arr.map(x => x[0] + ':' + x[1]).join(','), raw = await callPersona(cid(), '请你按自己的性格和审美，给自己的像素小人选一套造型。只能用下面的 id。hair发型(' + L(A.HAIRS) + ')；eyes眼睛(' + L(A.EYES) + ')；mouth嘴巴(' + L(A.MOUTHS) + ')；brow眉毛(' + L(A.BROWS) + ')；top上衣(' + L(A.TOPS) + ')；bot下装(' + L(A.BOTS) + ')；sock袜子(' + L(A.SOCKS) + ')；hat帽子(' + L(A.HATS) + ')；clip发夹(' + L(A.CLIPS) + ')；face脸饰(' + L(A.FACES) + ')；neck颈饰(' + L(A.NECKS) + ')。颜色都用 #RRGGBB：skin肤色、hc发色、ec瞳色、tc上衣色、ac点缀色、bc下装色、hatc帽子色。blush腮红(true/false)。只输出 JSON，例如 {"hair":"bob","hc":"#5a3b2e","eyes":"round","ec":"#4a7fb0","mouth":"smile","brow":"none","blush":true,"top":"hoodie","tc":"#9bbbd9","bot":"pants","bc":"#2f3447","skin":"#f7d2b8","say":"一句话说说为什么这么穿"}', 1.0);
                av = parseJSONLoose(raw);
            } catch (e) { av = null; }
        }
        let say = av && av.say; if (!av) { av = A.randomAvatar(); say = '换个造型，怎么样？'; }
        delete av.say; const nu = A.cleanAvatar(Object.assign({}, old, av, { custom: null }), 'ta'); S.av.ta = nu; logAdd('换了一套新造型'); saveS(); speak('ta', String(say || '好看吗？').slice(0, 40), 7000); burst(E.ta.x, E.ta.y - 20, 'spark', 5);
    }
    function openLook() { if (!window.HLCHAR) { uiAlert('小人编辑器没加载出来，请刷新试试'); return; } window.HLCHAR.open({ S: () => S, setAv: (w, av) => { S.av[w] = av; saveS(); }, who: who, layer: $('hlLayer') }); }

    // ---------- 拍照 ----------
    function snap() {
        render(true); const c = document.createElement('canvas'); c.width = SW * 4; c.height = SH * 4; const x = c.getContext('2d'); x.imageSmoothingEnabled = false; x.drawImage(cv, 0, 0, SW * 4, SH * 4);
        x.fillStyle = 'rgba(255,255,255,.88)'; x.fillRect(0, SH * 4 - 30, SW * 4, 30); x.fillStyle = '#6b4a3a'; x.font = 'bold 15px sans-serif'; x.fillText(who() + ' 和我 · ' + new Date().toLocaleDateString('zh-CN'), 12, SH * 4 - 10);
        const url = c.toDataURL('image/png'), L = $('hlLayer'); L.innerHTML = '<div class="hl-photo"><img src="' + url + '"><div class="hl-row"><a class="hl-btn" download="小家园合影.png" href="' + url + '">保存图片</a><button class="hl-btn alt" id="hlPhX">关闭</button></div><p class="hl-hint">手机上也可以长按图片保存</p></div>'; L.classList.remove('hidden'); $('hlPhX').onclick = () => L.classList.add('hidden');
        burst(E.me.x, E.me.y - 20, 'spark', 3); speak('ta', pick(['咔嚓～', '这张我要留着', '笑一个']), 3000);
    }

    // ---------- 导出给小人编辑器 / 外部 ----------
    window.HL = { open: () => openApp('homeland'), state: () => S, save: saveS, avOf: avOf, speak: speak, burst: burst };
    window.openHomeland = () => openApp('homeland');
    ensure();
})();
