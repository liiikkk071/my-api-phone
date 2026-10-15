/* couple.js —— 亲密空间的「更多互动」：同居小屋 / 心跳共振 / 每日小默契。数据只存在你自己的浏览器里 */
(function () {
    'use strict';
    const $ = (id) => document.getElementById(id), esc = (s) => escapeHtml(String(s == null ? '' : s));
    const cid = () => getActiveCharId(), who = () => activeCharName() || 'TA';
    const rnd = (a, b) => a + Math.floor(Math.random() * (b - a + 1)), pick = (a) => a[Math.floor(Math.random() * a.length)];
    const hash = (s) => { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; };
    const heart = (s, c) => '<svg class="li" width="' + (s || 14) + '" height="' + (s || 14) + '" viewBox="0 0 24 24" fill="' + (c || 'currentColor') + '" stroke="none"><path d="M12 20.5s-7.5-4.5-7.5-10A4.1 4.1 0 0 1 12 8a4.1 4.1 0 0 1 7.5 2.5c0 5.5-7.5 10-7.5 10z"/></svg>';

    // ---------- 数据 ----------
    const C = () => { const c = getChar(cid()); if (!c) return null; const L = lifeOf(c); L.couple = L.couple || {}; const k = L.couple; k.hearts = k.hearts || 0; k.own = k.own || {}; k.put = k.put || {}; k.daily = k.daily || {}; k.streak = k.streak || 0; k.beat = k.beat || {}; return k; };
    const upd = (fn) => lifeUpdate(cid(), (L) => { L.couple = L.couple || {}; const k = L.couple; k.hearts = k.hearts || 0; k.own = k.own || {}; k.put = k.put || {}; k.daily = k.daily || {}; k.beat = k.beat || {}; k.streak = k.streak || 0; return fn(k, L); });
    const addHearts = (n) => upd((k) => { k.hearts += n; });

    // ---------- 入口：注入到亲密空间 ----------
    function inject() {
        const app = $('intimateApp'); if (!app || $('cpMore')) return;
        const sa = app.querySelector('.scroll-area'); if (!sa) return;
        const sec = document.createElement('div'); sec.id = 'cpMore'; sec.className = 'cp-more';
        sec.innerHTML = '<div class="cp-mh"><b>更多互动</b><span id="cpHeartN" class="cp-hn"></span></div><div class="cp-cards">'
            + '<div class="cp-card" data-k="room"><div class="cp-ci"><svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M4 11l8-6.5 8 6.5"/><path d="M6 10v9h12v-9"/><path d="M10 19v-5h4v5"/></svg></div><b>小家园</b><small>像素小屋，能布置能捏人</small></div>'
            + '<div class="cp-card" data-k="beat"><div class="cp-ci">' + heart(26) + '</div><b>心跳共振</b><small>按住，等 TA 跟上</small></div>'
            + '<div class="cp-card" data-k="daily"><div class="cp-ci"><svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><rect x="4.5" y="5.5" width="15" height="14" rx="3"/><path d="M8 3.5v4M16 3.5v4M8.5 13l2.2 2.2L15.5 11"/></svg></div><b>每日小默契</b><small>三个小任务攒爱心</small></div></div>';
        sa.appendChild(sec); sec.querySelectorAll('.cp-card').forEach(e => e.onclick = () => { if (!cid()) { uiAlert('请先创建并选择一个角色'); return; } if (e.dataset.k === 'room' && window.openHomeland) { window.openHomeland(); return; } ({ room: openRoom, beat: openBeat, daily: openDaily })[e.dataset.k](); });
        new MutationObserver(() => { if (!app.classList.contains('hidden')) refreshHN(); }).observe(app, { attributes: true, attributeFilter: ['class'] });
    }
    function refreshHN() { const k = C(), el = $('cpHeartN'); if (el) el.innerHTML = k ? heart(13) + ' ' + k.hearts : ''; }

    // =====================================================================
    //  同居小屋
    // =====================================================================
    const SLOTS = [['rug', '地毯'], ['sofa', '沙发'], ['lamp', '灯'], ['plant', '绿植'], ['deco', '墙面']];
    const PRICE = [0, 20, 50], NAMES = { rug: ['圆形粉毯', '蓝条纹毯', '云朵毯'], sofa: ['奶油沙发', '粉色沙发', '雾蓝沙发'], lamp: ['落地灯', '纸灯笼', '星星灯串'], plant: ['小盆栽', '龟背竹', '吊兰'], deco: ['相框', '爱心彩旗', '小书架'] };
    function itemSvg(slot, v) {
        const S = {
            rug: [
                '<ellipse cx="150" cy="212" rx="78" ry="17" fill="#f6d3dc"/><ellipse cx="150" cy="212" rx="56" ry="11" fill="#fbe7ec"/>',
                '<path d="M78 200h144l14 25H64z" fill="#cfdeeb"/><path d="M84 207h132M80 214h140" stroke="#fff" stroke-width="3" opacity=".7"/>',
                '<path d="M88 214a16 16 0 0 1 8-28 20 20 0 0 1 38-6 20 20 0 0 1 36 6 16 16 0 0 1 8 28z" fill="#fff6ea" stroke="#f0d9c3" stroke-width="2"/><path d="M150 206s-9-5-9-10a4.5 4.5 0 0 1 9-1 4.5 4.5 0 0 1 9 1c0 5-9 10-9 10z" fill="#f0a9b8"/>'],
            sofa: [
                '<rect x="196" y="138" width="92" height="46" rx="14" fill="#f3e6d6"/><rect x="190" y="160" width="104" height="34" rx="12" fill="#ead7bf"/><rect x="198" y="188" width="6" height="8" fill="#b8a48c"/><rect x="280" y="188" width="6" height="8" fill="#b8a48c"/><rect x="204" y="148" width="26" height="18" rx="7" fill="#f9d3dc"/>',
                '<rect x="196" y="138" width="92" height="46" rx="14" fill="#f6c9d4"/><rect x="190" y="160" width="104" height="34" rx="12" fill="#f0b3c3"/><rect x="198" y="188" width="6" height="8" fill="#a67a85"/><rect x="280" y="188" width="6" height="8" fill="#a67a85"/><rect x="258" y="148" width="26" height="18" rx="7" fill="#fff3dc"/>',
                '<rect x="196" y="138" width="92" height="46" rx="14" fill="#cfdeeb"/><rect x="190" y="160" width="104" height="34" rx="12" fill="#b6cadc"/><rect x="198" y="188" width="6" height="8" fill="#7e93a6"/><rect x="280" y="188" width="6" height="8" fill="#7e93a6"/><rect x="204" y="148" width="26" height="18" rx="7" fill="#fbe7ec"/><rect x="236" y="150" width="22" height="16" rx="6" fill="#fff6ea"/>'],
            lamp: [
                '<rect x="171" y="120" width="3" height="76" fill="#b9a58e"/><path d="M158 120l28 0-5-24h-18z" fill="#fff0c9"/><ellipse cx="172" cy="198" rx="12" ry="3.5" fill="#b9a58e"/>',
                '<path d="M172 70v18" stroke="#b9a58e" stroke-width="2"/><ellipse cx="172" cy="104" rx="16" ry="19" fill="#ffd9b3"/><path d="M158 98q14 5 28 0M158 110q14 5 28 0" stroke="#f3b98a" stroke-width="1.6" fill="none"/>',
                '<path d="M120 76q50 18 108 0" stroke="#d9c7a6" stroke-width="2" fill="none"/><g fill="#ffe08a"><path d="M134 84l3 5 5 .5-4 3.5 1.2 5.3-5.2-3-5.2 3 1.2-5.3-4-3.5 5-.5z" transform="translate(0 -2)"/><path d="M176 90l3 5 5 .5-4 3.5 1.2 5.3-5.2-3-5.2 3 1.2-5.3-4-3.5 5-.5z" transform="translate(0 0)"/><path d="M214 84l3 5 5 .5-4 3.5 1.2 5.3-5.2-3-5.2 3 1.2-5.3-4-3.5 5-.5z" transform="translate(0 -2)"/></g>'],
            plant: [
                '<path d="M40 196h28l-4 24H44z" fill="#e8b79c"/><path d="M54 196c-14-16-14-30-2-40 4 14 12 22 2 40zM54 196c12-14 18-24 8-38-6 12-10 22-8 38z" fill="#9cc7a1"/>',
                '<path d="M40 196h28l-4 24H44z" fill="#d9c7ad"/><path d="M54 196c-22-6-30-24-26-40 14 4 22 16 26 40zM54 196c22-6 30-24 26-40-14 4-22 16-26 40zM54 196V138c10 10 10 30 0 58z" fill="#7fb38a"/>',
                '<path d="M28 130h30" stroke="#b9a58e" stroke-width="3"/><path d="M33 130v-8M53 130v-8" stroke="#b9a58e" stroke-width="1.5"/><path d="M34 130c-10 14-4 30-8 44M44 130c0 16 4 28 0 46M54 130c10 12 6 26 12 40" stroke="#8fc096" stroke-width="3" fill="none" stroke-linecap="round"/><path d="M26 174c-3 5-1 9 4 9M44 176c-3 6 0 10 5 9M66 170c3 4 8 5 9 0" fill="#8fc096" stroke="#8fc096" stroke-width="3" stroke-linecap="round"/>'],
            deco: [
                '<rect x="214" y="66" width="52" height="40" rx="4" fill="#fff" stroke="#d9c7ad" stroke-width="3"/><path d="M220 100l14-14 10 10 8-8 8 12z" fill="#cfe3d2"/><circle cx="250" cy="78" r="5" fill="#ffd9a0"/>',
                '<path d="M196 70q46 16 92 0" stroke="#d9c7ad" stroke-width="2" fill="none"/><g><path d="M206 77l8 0-4 9z" fill="#f0a9b8"/><path d="M226 82l8 0-4 9z" fill="#cfdeeb"/><path d="M246 84l8 0-4 9z" fill="#ffe08a"/><path d="M266 82l8 0-4 9z" fill="#f0a9b8"/><path d="M282 77l8 0-4 9z" fill="#cfdeeb"/></g>',
                '<rect x="208" y="92" width="68" height="4" fill="#d9c7ad"/><rect x="214" y="72" width="8" height="20" fill="#f0a9b8"/><rect x="224" y="76" width="7" height="16" fill="#cfdeeb"/><rect x="233" y="70" width="8" height="22" fill="#ffe08a"/><path d="M252 92c0-10 6-14 12-14s10 6 8 14z" fill="#fff" stroke="#d9c7ad" stroke-width="1.6"/>']
        };
        return S[slot][v] || '';
    }
    function dayPart() { const h = new Date().getHours(); return h >= 6 && h < 10 ? 'morning' : h >= 10 && h < 17 ? 'day' : h >= 17 && h < 22 ? 'evening' : 'night'; }
    const SKY = { morning: ['#fde7d6', '#cfe3f3'], day: ['#bfe0f6', '#e8f5fb'], evening: ['#f7b996', '#9f8bc2'], night: ['#2b3558', '#4b5788'] };
    const WALL = { morning: '#fbf1e6', day: '#fbf4ec', evening: '#f6e3d6', night: '#d9d3e6' };
    function roomSvg(k) {
        const dp = dayPart(), sky = SKY[dp], put = k.put || {};
        let s = '<svg viewBox="0 0 320 260" class="cp-room-svg"><defs><linearGradient id="cpSky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="' + sky[0] + '"/><stop offset="1" stop-color="' + sky[1] + '"/></linearGradient></defs>'
            + '<rect width="320" height="190" fill="' + WALL[dp] + '"/><rect y="190" width="320" height="70" fill="' + (dp === 'night' ? '#b9a98f' : '#e7cfae') + '"/><path d="M0 190h320" stroke="#d4bb98" stroke-width="2"/>'
            + '<g stroke="#d4bb98" stroke-width="1" opacity=".55"><path d="M0 208h320M0 228h320M0 248h320M60 190l-30 70M140 190l-20 70M220 190l20 70M300 190l30 70"/></g>'
            + '<rect x="30" y="40" width="96" height="86" rx="8" fill="url(#cpSky)" stroke="#fff" stroke-width="6"/><path d="M78 40v86M30 83h96" stroke="#fff" stroke-width="4"/>'
            + (dp === 'night' ? '<path d="M96 62a12 12 0 1 0 8 18 10 10 0 0 1-8-18z" fill="#fff6c9"/><g fill="#fff" opacity=".9"><circle cx="48" cy="58" r="1.6"/><circle cx="62" cy="100" r="1.4"/><circle cx="110" cy="104" r="1.6"/></g>' : dp === 'evening' ? '<circle cx="100" cy="106" r="13" fill="#ffd9a0" opacity=".95"/>' : '<circle cx="104" cy="64" r="11" fill="#ffe9a8"/><path d="M44 104q10-12 22-6 6-9 18-2 10-2 14 8z" fill="#fff" opacity=".9"/>')
            + '<path d="M20 36q40-12 116 0v10H20z" fill="#f0a9b8" opacity=".55"/>';
        SLOTS.forEach(sl => { s += '<g class="cp-it">' + itemSvg(sl[0], put[sl[0]] || 0) + '</g>'; });
        s += '</svg>'; return s;
    }
    const ACT = {
        morning: { t: '在窗边泡咖啡', say: ['早呀，咖啡刚好', '今天也慢慢开始吧'], pos: [18, 60] },
        day: { t: '坐在沙发上看书', say: ['这本书有点好看', '晒着太阳有点困'], pos: [72, 54] },
        evening: { t: '窝在沙发里放空', say: ['今天也辛苦啦', '晚上想吃点什么'], pos: [72, 54] },
        night: { t: '在地毯上抱着靠垫打瞌睡', say: ['zzz…再待一会儿', '该睡觉啦'], pos: [46, 78] }
    };
    const TOG = { movie: ['一起看电影', [66, 54]], tea: ['一起喝茶', [44, 76]], daze: ['一起发呆', [50, 60]], lean: ['靠一靠', [72, 54]] };
    function openRoom() {
        stageOpen('同居小屋', (b) => {
            let scene = null, busy = false;
            const draw = () => {
                const k = C(), c = getChar(cid()), a = scene ? { t: TOG[scene][0], pos: TOG[scene][1] } : ACT[dayPart()];
                b.innerHTML = '<div class="cp-room-wrap"><div class="cp-room">' + roomSvg(k) + '<div class="cp-ta" id="cpTA" style="left:' + a.pos[0] + '%;top:' + a.pos[1] + '%"><span class="cp-av">' + charAvatarInner(c) + '</span><i class="cp-body"></i><em id="cpSay"></em></div>' + (scene ? '<div class="cp-ta me" style="left:' + (a.pos[0] + 12) + '%;top:' + a.pos[1] + '%"><span class="cp-av">' + myAvatarInner() + '</span><i class="cp-body"></i></div>' : '') + '</div></div>'
                    + '<p class="cp-status">' + esc(who()) + ' ' + esc(a.t) + '</p><div class="cp-acts">' + Object.keys(TOG).map(x => '<button data-a="' + x + '"' + (scene === x ? ' class="on"' : '') + '>' + TOG[x][0] + '</button>').join('') + '</div><div id="cpRe"></div>'
                    + '<div class="stg-sub">布置小屋 <span class="cp-hn">' + heart(13) + ' ' + k.hearts + '</span></div>' + SLOTS.map(sl => '<div class="cp-slot"><b>' + sl[1] + '</b><div>' + [0, 1, 2].map(v => { const own = v === 0 || (k.own[sl[0]] || []).indexOf(v) >= 0, cur = (k.put[sl[0]] || 0) === v; return '<button data-s="' + sl[0] + '" data-v="' + v + '" class="' + (cur ? 'on' : '') + (own ? '' : ' lock') + '">' + NAMES[sl[0]][v] + (own ? '' : '<small>' + heart(10) + PRICE[v] + '</small>') + '</button>'; }).join('') + '</div></div>').join('');
                b.querySelectorAll('.cp-acts button').forEach(x => x.onclick = () => together(x.dataset.a));
                b.querySelectorAll('.cp-slot button').forEach(x => x.onclick = () => buy(x.dataset.s, +x.dataset.v));
                $('cpTA').onclick = touch; if (!scene) $('cpSay').textContent = pick(ACT[dayPart()].say);
            };
            const buy = async (sl, v) => {
                const k = C(), own = v === 0 || (k.own[sl] || []).indexOf(v) >= 0;
                if (!own) { if (k.hearts < PRICE[v]) { uiAlert('爱心不够啦，去「每日小默契」和「心跳共振」攒一攒'); return; } if (!(await uiConfirm('用 ' + PRICE[v] + ' 个爱心换「' + NAMES[sl][v] + '」吗？', { ok: '换' }))) return; upd((kk) => { kk.hearts -= PRICE[v]; (kk.own[sl] = kk.own[sl] || []).push(v); }); }
                upd((kk) => { kk.put[sl] = v; }); draw(); refreshHN();
            };
            const line = async (task, fallback) => {
                const box = $('cpRe'); if (!box) return; const set = (t) => { if ($('cpRe')) $('cpRe').innerHTML = '<div class="td-react"><div class="bub-av">' + esc(who().slice(0, 1)) + '</div><div class="bub">' + esc(t) + '</div></div>'; };
                if (!API_KEY) { set(fallback); return; } box.innerHTML = '<div class="stg-load"><div class="spin"></div>' + esc(who()) + ' 在回应…</div>';
                try { const r = oneLine(await callPersona(cid(), task + '请你以角色本人的口吻说一句话，口语、有感情、符合你们现在的关系，不超过40字，只输出这句话。', 1.0)); set(r || fallback); } catch (e) { set(fallback); }
            };
            const touch = async () => { if (busy) return; busy = true; const ta = $('cpTA'); if (ta) { ta.classList.add('boop'); setTimeout(() => ta.classList.remove('boop'), 500); } const a = scene ? TOG[scene][0] : ACT[dayPart()].t; await line('我们在小屋里，你正在' + a + '，我伸手轻轻点了点你。', pick(['诶，干嘛突然戳我～', '被你发现我在偷看你啦', '过来，让我抱一下'])); busy = false; };
            const together = async (a) => { if (busy) return; busy = true; scene = a; draw(); const gain = upd((k) => { const t = todayStr(); k.homeDay = k.homeDay || {}; if (k.homeDay.d !== t) k.homeDay = { d: t, n: 0 }; if (k.homeDay.n < 3) { k.homeDay.n++; k.hearts += 1; return 1; } return 0; }); if (gain) { try { addIntimacy(cid(), 1); } catch (e) {} } refreshHN(); await line('我们在小屋里' + TOG[a][0] + '。', pick(['这样待着就很好', '再靠近一点点', '时间要是慢一点就好了'])); busy = false; };
            draw();
        }, refreshHN);
    }

    // =====================================================================
    //  心跳共振
    // =====================================================================
    function openBeat() {
        stageOpen('心跳共振', (b) => {
            const c = getChar(cid());
            b.innerHTML = '<p class="hint-line" style="text-align:center">按住中间的心，等 TA 的心跳慢慢跟上你。（心跳是模拟的小浪漫）</p><div class="bt-stage"><div class="bt-side"><span class="cp-av">' + myAvatarInner() + '</span><b id="btMe">-- bpm</b></div><div class="bt-core" id="btCore"><svg class="bt-ring" viewBox="0 0 120 120"><circle cx="60" cy="60" r="54" fill="none" stroke="var(--border-color)" stroke-width="5"/><circle id="btProg" cx="60" cy="60" r="54" fill="none" stroke="var(--theme-color)" stroke-width="5" stroke-linecap="round" stroke-dasharray="339.3" stroke-dashoffset="339.3" transform="rotate(-90 60 60)"/></svg><div class="bt-heart" id="btHeart">' + heart(44) + '</div></div><div class="bt-side"><span class="cp-av">' + charAvatarInner(c) + '</span><b id="btTa">-- bpm</b></div></div><p class="bt-tip" id="btTip">按住不放</p><div id="btRe"></div>';
            const k = C(), today = todayStr(), left = Math.max(0, 3 - (k.beat.d === today ? k.beat.n : 0)); $('btTip').textContent = left ? '按住不放 · 今天还能得 ' + left + ' 次爱心' : '今天的爱心已经拿满啦，还可以随时来感受一下';
            const core = $('btCore'), heartEl = $('btHeart'), prog = $('btProg'); let holding = false, t0 = 0, raf = 0, done = false;
            const GOAL = 6000;
            const step = (now) => {
                if (!holding) return; const el = now - t0, pM = 820, k2 = Math.min(1, el / GOAL), pT = 1150 - (1150 - 820) * Math.min(1, el / 4200), phT = (1 - Math.min(1, el / 4200)) * 330;
                const wave = (t, p, ph) => { const x = ((t + ph) % p) / p; return x < .16 ? Math.sin(x / .16 * Math.PI) : x < .3 ? .45 * Math.sin((x - .16) / .14 * Math.PI) : 0; };
                const sM = wave(el, pM, 0), sT = wave(el, pT, phT);
                heartEl.style.transform = 'scale(' + (1 + .22 * Math.max(sM, sT)) + ')'; core.style.setProperty('--glow', String(Math.max(sM, sT) * (0.4 + .6 * k2)));
                prog.style.strokeDashoffset = String(339.3 * (1 - k2)); $('btMe').textContent = Math.round(60000 / pM) + ' bpm'; $('btTa').textContent = Math.round(60000 / pT) + ' bpm';
                if (el >= GOAL && !done) { done = true; holding = false; success(); return; } raf = requestAnimationFrame(step);
            };
            const start = (e) => { if (done) return; e.preventDefault(); holding = true; t0 = performance.now(); $('btTip').textContent = '保持住…它在靠近你'; raf = requestAnimationFrame(step); };
            const stop = () => { if (!holding) return; holding = false; cancelAnimationFrame(raf); heartEl.style.transform = ''; prog.style.strokeDashoffset = '339.3'; core.style.setProperty('--glow', '0'); if (!done) $('btTip').textContent = '松手啦，再按住试一次'; };
            core.addEventListener('pointerdown', start); window.addEventListener('pointerup', stop); core.addEventListener('pointercancel', stop); core.addEventListener('contextmenu', (e) => e.preventDefault());
            const success = async () => {
                try { navigator.vibrate && navigator.vibrate([60, 80, 60, 80, 120]); } catch (e) {} core.classList.add('burst'); heartEl.style.transform = ''; $('btMe').textContent = '72 bpm'; $('btTa').textContent = '72 bpm'; $('btTip').textContent = '心跳同步啦';
                let gain = 0; upd((kk) => { const t = todayStr(); if (kk.beat.d !== t) kk.beat = { d: t, n: 0 }; if (kk.beat.n < 3) { kk.beat.n++; kk.hearts += 2; gain = 2; } }); refreshHN(); if (gain) { try { addIntimacy(cid(), 1); } catch (e) {} }
                const set = (t) => { if ($('btRe')) $('btRe').innerHTML = '<div class="td-react"><div class="bub-av">' + esc(who().slice(0, 1)) + '</div><div class="bub">' + esc(t) + '</div></div>' + (gain ? '<p class="bt-gain">' + heart(13) + ' +' + gain + ' 爱心</p>' : '') + '<div class="stg-btns"><button class="ghost" id="btAgain">再来一次</button></div>'; if ($('btAgain')) $('btAgain').onclick = openBeat; };
                const fb = pick(['听到了吗，我的心跳跟着你呢', '嗯，就这样，别松手', '你一靠近，我就乱了节拍']);
                if (!API_KEY) { set(fb); return; } $('btRe').innerHTML = '<div class="stg-load"><div class="spin"></div>' + esc(who()) + ' 在回应…</div>';
                try { const r = oneLine(await callPersona(cid(), '我们刚刚一起做了「心跳共振」，我按住屏幕，你的心跳慢慢跟上了我的，最后同步了。请你以角色本人的口吻说一句话，口语、有感情、有点害羞或温柔，符合你的性格，不超过40字，只输出这句话。', 1.0)); set(r || fb); } catch (e) { set(fb); }
            };
        }, refreshHN);
    }

    // =====================================================================
    //  每日小默契
    // =====================================================================
    const FOODS = ['火锅', '麻辣烫', '寿司', '烧烤', '披萨', '炸鸡', '牛肉面', '饺子', '汉堡', '粥和小菜', '咖喱饭', '烤肉', '拉面', '轻食沙拉', '小龙虾', '糖水'];
    const QS = ['最近有什么小事让你开心？', '如果明天不用上班，你最想做什么？', '你觉得我们俩最像的地方是什么？', '有没有什么一直想跟我说但没说的话？', '你最难忘的一次吃饭是什么时候？', '今天有没有一瞬间想起我？', '你小时候最想成为什么样的人？', '如果能一起去一个地方，你想去哪？'];
    function openDaily() {
        stageOpen('每日小默契', (b) => {
            const t = todayStr(), seed = hash(t + cid());
            const draw = () => {
                const k = C(), d = k.daily.d === t ? k.daily : { d: t }, c = getChar(cid());
                const done = (x) => !!d[x];
                b.innerHTML = '<div class="dy-top"><span>' + heart(14) + ' <b>' + k.hearts + '</b></span><span>连续 <b>' + (k.lastAll === t || k.lastAll === addDays(t, -1) ? k.streak : 0) + '</b> 天全部完成</span></div>'
                    + card('a', '猜猜 ' + esc(who()) + ' 现在的心情', done('a'), moodHtml(d, c)) + card('b', '一起选今晚吃什么', done('b'), foodHtml(d)) + card('c', '互相问一个问题', done('c'), qHtml(d))
                    + (done('a') && done('b') && done('c') ? '<p class="bt-gain">' + heart(13) + ' 今天三个任务都完成啦' + (d.bonus ? '，额外得了 5 个爱心' : '') + '</p>' : '');
                bind(d, c);
            };
            const card = (id, title, ok, body) => '<div class="dy-card' + (ok ? ' ok' : '') + '"><div class="dy-h"><b>' + title + '</b><i>' + (ok ? '已完成' : '待完成') + '</i></div>' + body + '</div>';
            const moodHtml = (d, c) => {
                if (d.a) return '<p class="dy-res">' + esc(d.a.msg) + '</p>';
                const m = getMood(c), real = moodLabel(m), all = ['开心', '平静', '有点低落', '有点想你', '困困的', '兴奋'], opts = [real].concat(all.filter(x => x !== real).sort((x, y) => hash(x + t) - hash(y + t)).slice(0, 3)).sort((x, y) => hash(x + t + 'o') - hash(y + t + 'o'));
                return '<div class="mm-days" id="dyMood">' + opts.map(o => '<button data-v="' + esc(o) + '">' + esc(o) + '</button>').join('') + '</div><p class="hint-line">选一个你觉得最接近的</p>';
            };
            const foodHtml = (d) => {
                if (d.b) return '<p class="dy-res">' + esc(d.b.msg) + '</p>';
                const fs = FOODS.slice().sort((x, y) => hash(x + t + cid()) - hash(y + t + cid())).slice(0, 3);
                return '<div class="mm-days" id="dyFood">' + fs.map(o => '<button data-v="' + o + '">' + o + '</button>').join('') + '</div><p class="hint-line">你先选，' + esc(who()) + ' 也悄悄选了一个，看看默不默契</p>';
            };
            const qHtml = (d) => {
                if (d.c) return '<p class="dy-res">' + esc(d.c.msg) + '</p>';
                if (!d.cq) return '<p class="hint-line">先问 ' + esc(who()) + ' 一个问题，再回答 TA 的问题。</p><input id="dyQ" class="input-text" maxlength="40" placeholder="比如：你最喜欢我哪一点？"><div class="stg-btns" style="margin:8px 0 0"><button id="dyAsk">问 TA</button></div><div id="dyRe"></div>';
                return '<div class="td-react"><div class="bub-av">' + esc(who().slice(0, 1)) + '</div><div class="bub">' + esc(d.cq.a) + '</div></div><p class="hint-line">轮到 TA 问你：</p><p class="dy-q">' + esc(d.cq.q) + '</p><input id="dyA" class="input-text" maxlength="80" placeholder="写下你的回答"><div class="stg-btns" style="margin:8px 0 0"><button id="dyAns">回答</button></div><div id="dyRe"></div>';
            };
            const finish = (key, hearts, msg) => { upd((kk) => { const dd = kk.daily.d === t ? kk.daily : (kk.daily = { d: t }); dd[key] = { msg }; kk.hearts += hearts; if (dd.a && dd.b && dd.c && !dd.bonus) { dd.bonus = 1; kk.hearts += 5; kk.streak = (kk.lastAll === addDays(t, -1) ? kk.streak : 0) + 1; kk.lastAll = t; try { addIntimacy(cid(), 3); } catch (e) {} } }); try { addIntimacy(cid(), 1); } catch (e) {} refreshHN(); draw(); };
            const bind = (d, c) => {
                b.querySelectorAll('#dyMood button').forEach(x => x.onclick = () => { const real = moodLabel(getMood(c)), ok = x.dataset.v === real; finish('a', ok ? 3 : 1, ok ? '猜中啦！' + who() + ' 现在就是「' + real + '」。+3 爱心' : '差一点，' + who() + ' 现在其实是「' + real + '」。+1 爱心'); });
                b.querySelectorAll('#dyFood button').forEach(x => x.onclick = async () => {
                    const mine = x.dataset.v, opts = [...b.querySelectorAll('#dyFood button')].map(y => y.dataset.v); let ta = opts[hash(t + cid() + 'ta') % opts.length];
                    if (API_KEY) { try { const o = parseJSONLoose(await callPersona(cid(), '我们在选今晚吃什么，候选：' + opts.join('、') + '。请按你的口味和性格选一个，只输出 JSON：{"pick":"其中一个候选"}', 0.9)); if (o && opts.indexOf(o.pick) >= 0) ta = o.pick; } catch (e) {} }
                    const same = ta === mine; finish('b', same ? 5 : 2, same ? '你们都选了「' + mine + '」！好默契。+5 爱心' : '你选了「' + mine + '」，' + who() + ' 悄悄选了「' + ta + '」。+2 爱心，下次试试 TA 的？');
                });
                if ($('dyAsk')) $('dyAsk').onclick = async () => {
                    const q = $('dyQ').value.trim(); if (!q) { uiAlert('先写一个问题'); return; }
                    const box = $('dyRe'); box.innerHTML = '<div class="stg-load"><div class="spin"></div>' + esc(who()) + ' 在想…</div>'; let a = '', tq = '';
                    if (API_KEY) { try { const o = parseJSONLoose(await callPersona(cid(), '我问你：「' + q + '」。请你以角色本人的口吻回答（口语、真诚、有感情，不超过60字，不要编造我们没发生过的事），然后你也问我一个小问题。只输出 JSON：{"answer":"你的回答","ask":"你想问我的一个问题（25字内）"}', 1.0)); if (o) { a = oneLine(o.answer || ''); tq = oneLine(o.ask || ''); } } catch (e) {} }
                    if (!a) a = API_KEY ? '这个问题让我想了好久……回头慢慢跟你说。' : '（还没连上 AI，所以我先害羞一下～）'; if (!tq) tq = QS[seed % QS.length];
                    upd((kk) => { const dd = kk.daily.d === t ? kk.daily : (kk.daily = { d: t }); dd.cq = { a, q: tq }; }); draw();
                };
                if ($('dyAns')) $('dyAns').onclick = async () => {
                    const ans = $('dyA').value.trim(); if (!ans) { uiAlert('写下你的回答吧'); return; } const q = (C().daily.cq || {}).q || '', box = $('dyRe'); let r = '';
                    if (API_KEY) { box.innerHTML = '<div class="stg-load"><div class="spin"></div>' + esc(who()) + ' 在看你的回答…</div>'; try { r = oneLine(await callPersona(cid(), '你问了我：「' + q + '」，我回答：「' + ans + '」。请你以角色本人的口吻回应我，口语、有感情，不超过40字，只依据我说的内容，只输出这句话。', 1.0)); } catch (e) {} }
                    finish('c', 3, (r ? who() + '：' + r + ' ' : '') + '+3 爱心');
                };
            };
            draw();
        }, refreshHN);
    }
    inject();
})();
