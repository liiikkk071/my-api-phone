/* games.js —— 心动小游戏（互动版）：真心话大冒险 / 默契问答 / 通话记录 + 通用「舞台」浮层。记录按天保存在角色的 life.games 里 */
(function () {
    'use strict';
    const $ = (id) => document.getElementById(id);
    const esc = (s) => escapeHtml(String(s == null ? '' : s));
    const rnd = (a) => a[Math.floor(Math.random() * a.length)];

    // ---------- 通用舞台浮层（life.js 也用） ----------
    function stageEl() {
        let el = $('stg');
        if (!el) {
            el = document.createElement('div'); el.id = 'stg'; el.className = 'stg hidden';
            el.innerHTML = '<div class="stg-bar"><button class="stg-x">‹ 返回</button><b id="stgT"></b><span></span></div><div class="stg-body" id="stgB"></div>';
            ($('callScreen') ? $('callScreen').parentElement : document.body).appendChild(el);
            el.querySelector('.stg-x').onclick = () => window.stageClose();
        }
        return el;
    }
    let onClose = null;
    window.stageOpen = function (title, render, closeCb) { const el = stageEl(); $('stgT').textContent = title; onClose = closeCb || null; const b = $('stgB'); b.innerHTML = ''; el.classList.remove('hidden'); render(b); b.scrollTop = 0; };
    window.stageClose = function () { const el = stageEl(); el.classList.add('hidden'); $('stgB').innerHTML = ''; const f = onClose; onClose = null; if (f) try { f(); } catch (e) {} };


    // ---------- 线条图标库（取代 emoji；life.js 也用） ----------
    const FACE = '<circle cx="12" cy="12" r="9"/>';
    const P = {
        sun: '<circle cx="12" cy="12" r="4"/><path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6l1.4 1.4M17 17l1.4 1.4M18.4 5.6L17 7M7 17l-1.4 1.4"/>',
        moon: '<path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z"/>',
        cloud: '<path d="M7 18h10.5a3.5 3.5 0 0 0 .4-7A5.5 5.5 0 0 0 7.4 9.6 4.2 4.2 0 0 0 7 18z"/>',
        partly: '<circle cx="8.5" cy="8.5" r="3"/><path d="M8.5 2.5v1.2M2.5 8.5h1.2M4.3 4.3l.9.9M12.7 4.3l-.9.9"/><path d="M9 20h8.5a3 3 0 0 0 .3-6 4.6 4.6 0 0 0-8.7 1.2A2.5 2.5 0 0 0 9 20z"/>',
        rain: '<path d="M7 15h10.5a3.2 3.2 0 0 0 .4-6.4 5 5 0 0 0-9.6 1A3.2 3.2 0 0 0 7 15z"/><path d="M9 18l-1 2.5M13 18l-1 2.5M17 18l-1 2.5"/>',
        snow: '<path d="M7 15h10.5a3.2 3.2 0 0 0 .4-6.4 5 5 0 0 0-9.6 1A3.2 3.2 0 0 0 7 15z"/><path d="M9 18.5h.01M13 20h.01M17 18.5h.01M11 22h.01"/>',
        fog: '<path d="M4 9h16M3 13h18M6 17h14"/>',
        storm: '<path d="M7 14h10.5a3.2 3.2 0 0 0 .4-6.4 5 5 0 0 0-9.6 1A3.2 3.2 0 0 0 7 14z"/><path d="M12.5 15l-2 3.5h3l-1.5 3"/>',
        heart: '<path d="M12 20s-7.5-4.5-7.5-10A4.2 4.2 0 0 1 12 7.6 4.2 4.2 0 0 1 19.5 10C19.5 15.5 12 20 12 20z"/>',
        star: '<path d="M12 4l2.2 5.1 5.5.5-4.2 3.6 1.3 5.4L12 15.8 7.2 18.6l1.3-5.4L4.3 9.6l5.5-.5z"/>',
        camera: '<path d="M4 8.5h3l1.5-2h7l1.5 2h3V19H4z"/><circle cx="12" cy="13.5" r="3.4"/>',
        pencil: '<path d="M4 20l1-4.2L16.5 4.3l3.2 3.2L8.2 19z"/><path d="M14 6.8l3.2 3.2"/>',
        shirt: '<path d="M8.5 4L3 7.5l2.5 3.2L8 9.5V20h8V9.5l2.5 1.2L21 7.5 15.5 4a3.5 3.5 0 0 1-7 0z"/>',
        umbrella: '<path d="M3 12a9 9 0 0 1 18 0z"/><path d="M12 12v6a2 2 0 0 1-4 0"/>',
        music: '<path d="M9 17V6l10-2v11"/><circle cx="6.5" cy="17.5" r="2.5"/><circle cx="16.5" cy="15.5" r="2.5"/>',
        book: '<path d="M5 5.5A1.5 1.5 0 0 1 6.5 4H19v13.5H6.5A1.5 1.5 0 0 0 5 19z"/><path d="M5 19a1.5 1.5 0 0 0 1.5 1.5H19v-3M9 8.5h6"/>',
        tea: '<path d="M5 10h11v4a5 5 0 0 1-5 5h-1a5 5 0 0 1-5-5z"/><path d="M16 11h1.5a2.3 2.3 0 0 1 0 4.6H16M8 4.5c0 1 1 1 1 2.2M12 4.5c0 1 1 1 1 2.2"/>',
        flower: '<circle cx="12" cy="12" r="2"/><path d="M12 10a3 3 0 1 1 0-6 3 3 0 0 1 0 6zM14 12a3 3 0 1 1 6 0 3 3 0 0 1-6 0zM12 14a3 3 0 1 1 0 6 3 3 0 0 1 0-6zM10 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0z"/>',
        cat: '<path d="M5 11V4.5L9.2 7h5.6L19 4.5V11a7 7 0 0 1-14 0z"/><path d="M9.5 12h.01M14.5 12h.01M11 15c.5.6 1.5.6 2 0"/>',
        chat: '<path d="M5 6.5A2.5 2.5 0 0 1 7.5 4h9A2.5 2.5 0 0 1 19 6.5v6a2.5 2.5 0 0 1-2.5 2.5H11l-3.5 3v-3A2.5 2.5 0 0 1 5 12.5z"/><path d="M9.2 9.7h.01M12 9.7h.01M14.8 9.7h.01"/>',
        quiz: '<circle cx="12" cy="12" r="9"/><path d="M9.6 9.6a2.5 2.5 0 1 1 3.6 2.2c-.8.4-1.2.9-1.2 1.8M12 17h.01"/>',
        phone: '<path d="M6 4h3.6l1.5 4-2 1.4a10 10 0 0 0 5.5 5.5L16 12.9l4 1.5V18a2 2 0 0 1-2 2A14 14 0 0 1 4 6a2 2 0 0 1 2-2z"/>',
        check: '<path d="M5 12.5l4.5 4.5L19 7"/>',
        pot: '<path d="M4 10h16v3a6 6 0 0 1-6 6h-4a6 6 0 0 1-6-6z"/><path d="M3 10h18M8 6.5c0-1.2 1.2-1.2 1.2-2.5M12 6.5c0-1.2 1.2-1.2 1.2-2.5M16 6.5c0-1.2 1.2-1.2 1.2-2.5"/>',
        ramen: '<path d="M4 12h16a8 8 0 0 1-16 0z"/><path d="M9 3l4 8M13 3l4 8"/>',
        sushi: '<rect x="4" y="9" width="16" height="8" rx="4"/><path d="M10 9v8M14 9v8"/>',
        burger: '<path d="M5 10a7 5.5 0 0 1 14 0z"/><path d="M4 13h16M6 16c0 2.2 1.2 3 3 3h6c1.8 0 3-.8 3-3z"/>',
        chicken: '<path d="M15.5 4.5a5 5 0 0 1 4 4c0 3-2 5-5 5l-4-4c0-3 2-5 5-5z"/><path d="M10.5 13.5L6.5 17.5M5 16.3a1.5 1.5 0 1 0 2.2 2.2M6.5 19a1.5 1.5 0 1 0 2.2-.4"/>',
        salad: '<path d="M4 12h16a8 8 0 0 1-16 0z"/><path d="M8 12c0-3 2-5.5 5-5.5M13 12c0-2.5 2-4.5 5-4.5"/>',
        bbq: '<path d="M4 20L20 4"/><circle cx="9" cy="15" r="2"/><circle cx="12.5" cy="11.5" r="2"/><circle cx="16" cy="8" r="2"/>',
        curry: '<path d="M4 14h16a8 5 0 0 1-16 0z"/><path d="M9 11c0-1.8 1.6-1.8 1.6-3.5M14 11c0-1.8 1.6-1.8 1.6-3.5"/>',
        f_sleepy: FACE + '<path d="M8 10.5h2.4M13.6 10.5H16M10 15.5h4"/>',
        f_smile: FACE + '<path d="M9 10h.01M15 10h.01M8.5 14c1.2 2 5.8 2 7 0"/>',
        f_grin: FACE + '<path d="M9 10h.01M15 10h.01M8 13.5h8a4 4 0 0 1-8 0z"/>',
        f_sad: FACE + '<path d="M9 10.5h.01M15 10.5h.01M9 16c1.2-1.6 4.8-1.6 6 0"/>',
        f_angry: FACE + '<path d="M7.5 8.5l3 1.2M16.5 8.5l-3 1.2M9 12h.01M15 12h.01M9 16c1.2-1.4 4.8-1.4 6 0"/>',
        f_calm: FACE + '<path d="M9 10h.01M15 10h.01M9.5 15h5"/>',
        f_happy: FACE + '<path d="M8 11q1.5-2 3 0M13 11q1.5-2 3 0M9 14.5c1.2 1.6 4.8 1.6 6 0"/>',
        f_love: FACE + '<path d="M12 17s-3.3-2-3.3-4.5a1.9 1.9 0 0 1 3.3-1.2 1.9 1.9 0 0 1 3.3 1.2C15.3 15 12 17 12 17z" transform="translate(0 -2)"/><path d="M9 14.5c1.2 1.6 4.8 1.6 6 0" transform="translate(0 1.5)"/>'
    };
    window.LI = function (name, size) { size = size || 20; return '<svg class="li" width="' + size + '" height="' + size + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + (P[name] || P.star) + '</svg>'; };
    window.LI_NAMES = Object.keys(P);
    window.wxIconName = function (code) { return code === 0 ? 'sun' : (code === 1 || code === 2) ? 'partly' : code === 3 ? 'cloud' : (code === 45 || code === 48) ? 'fog' : (code >= 71 && code <= 77) ? 'snow' : (code >= 95) ? 'storm' : (code >= 51) ? 'rain' : 'cloud'; };

    // ---------- 数据 ----------
    function G(L) { L.games = L.games || {}; const g = L.games; g.td = g.td || []; g.tacit = g.tacit || []; g.calls = g.calls || []; g.days = g.days || []; return g; }
    function cid() { return getActiveCharId(); }
    function charName() { return activeCharName(); }
    function save(fn) { const id = cid(); if (!id) return; lifeUpdate(id, (L) => { const g = G(L); fn(g, L); }); }
    function readG() { const c = getChar(cid()); return c ? G(lifeOf(c)) : { td: [], tacit: [], calls: [], days: [] }; }
    function markToday(g) { const t = todayStr(); if (!g.days.includes(t)) g.days.push(t); }
    function need() { const id = cid(); if (!id) { uiAlert('请先创建并选择一个角色'); return null; } return id; }
    async function ai(task, temp) { if (!API_KEY) return null; try { return await callPersona(cid(), task, temp); } catch (e) { return null; } }
    function heart(n) { addIntimacy(cid(), n); bumpMood(cid(), 2); }

    // ---------- 大厅：心动值 / 连续天数 / 记录入口 ----------
    function renderHub() {
        const app = $('gamesApp'); if (!app) return;
        const pad = app.querySelector('.scroll-area'); if (!pad) return;
        let box = $('gmHub');
        if (!box) { box = document.createElement('div'); box.id = 'gmHub'; box.className = 'gm-hub'; const grid = pad.querySelector('.game-grid'); pad.insertBefore(box, grid); }
        const id = cid(); if (!id) { box.innerHTML = ''; return; }
        const g = readG(), lv = intimacyLevel(getIntimacy(id)), today = todayStr();
        const played = g.td.filter(x => x.date === today).length + g.tacit.filter(x => x.date === today).length;
        const avg = g.tacit.length ? Math.round(g.tacit.reduce((a, b) => a + b.score, 0) / (g.tacit.length * 5) * 100) : null;
        box.innerHTML = '<div class="gm-stat"><b>Lv.' + lv.lv + '</b><span>' + esc(lv.name) + '</span></div><div class="gm-stat"><b>' + streakOf(g.days) + '</b><span>连续天数</span></div><div class="gm-stat"><b>' + (avg == null ? '--' : avg + '%') + '</b><span>平均默契</span></div><div class="gm-stat"><b>' + played + '</b><span>今日已玩</span></div>';
        if (!$('gmHistBtn')) { const b = document.createElement('button'); b.id = 'gmHistBtn'; b.className = 'game-card'; b.innerHTML = '<span class="game-ic">' + LI('book', 26) + '</span><span class="game-name">我们的记录</span><span class="game-desc">每一次玩过的都留着</span>'; b.onclick = openHistory; pad.querySelector('.game-grid').appendChild(b); }
    }

    // ---------- 真心话大冒险 ----------
    const TRUTH = ['你第一次对我心动是什么时候？', '今天有没有偷偷想我？想了几次？', '我身上你最喜欢的一个小习惯是什么？', '如果只能陪我做一件事，你选什么？', '你有什么一直没告诉我的小秘密？', '我哪句话让你记到现在？', '你觉得我们之间最甜的一刻是哪次？', '如果我今晚失眠，你会对我说什么？', '你最想和我去哪里旅行？', '用三个词形容我。', '你有没有为我偷偷准备过什么？', '我做什么会让你瞬间心软？', '你觉得我最可爱的一面是什么？', '你最怕失去我什么时候？', '给未来的我们留一句话。', '你梦到过我吗？梦里发生了什么？'];
    const DARE = ['用最温柔的语气说一句「我喜欢你」', '现在给我一个想象中的抱抱，并描述它', '学一声小猫/小狗叫给我听', '夸我十秒钟，不许停', '用一句话给我写首小情诗', '说出三件今天让你开心的事', '模仿我平时说话的样子', '给我取一个只有你会叫的昵称', '用一个表情包形容此刻的心情', '对着屏幕比一个心，并告诉我你在笑吗', '小声说一句晚安哄我睡觉', '承诺一个下次见面要做的小事'];
    window.openTruthDare = function () {
        if (!need()) return;
        stageOpen('真心话大冒险', (b) => { tdHome(b); }, renderHub);
    };
    function tdHome(b) {
        const g = readG(), hist = g.td.slice(-3).reverse();
        b.innerHTML = '<div class="td-deck"><div class="td-card back" id="tdCard"><div class="td-face">抽一张<br><small>心跳一下 ♡</small></div></div></div>'
            + '<div class="td-pick"><button data-k="truth">真心话</button><button data-k="dare">大冒险</button><button data-k="ai">让' + esc(charName()) + '出题</button></div>'
            + '<div class="stg-sub">最近</div>' + (hist.length ? hist.map(tdRow).join('') : '<div class="stg-empty">还没有记录，抽第一张吧</div>');
        b.querySelectorAll('.td-pick button').forEach(btn => btn.onclick = () => tdDraw(b, btn.dataset.k));
    }
    function tdRow(x) { return '<div class="stg-row"><i>' + (x.type === 'dare' ? '冒险' : '真心') + '</i><div><b>' + esc(x.q) + '</b><p>' + esc(x.a || '（没回答）') + '</p>' + (x.r ? '<em>' + esc(x.r) + '</em>' : '') + '</div></div>'; }
    async function tdDraw(b, kind) {
        const card = $('tdCard'); card.classList.add('flip'); await new Promise(r => setTimeout(r, 380));
        let type = kind, q;
        if (kind === 'ai') {
            type = Math.random() < 0.5 ? 'truth' : 'dare';
            card.querySelector('.td-face').innerHTML = charName() + ' 在想题…'; card.classList.remove('back');
            q = await ai('我们在玩情侣间的真心话大冒险，请你以角色身份出一道' + (type === 'dare' ? '大冒险' : '真心话') + '题目给我，要贴合你的性格、有点心动感、能在手机上完成。只输出题目一句话。', 1.0);
            q = q ? oneLine(q) : null;
            if (!q) { q = rnd(type === 'dare' ? DARE : TRUTH); uiAlert('没连上 AI，换了一道内置题~'); }
        } else q = rnd(kind === 'dare' ? DARE : TRUTH);
        card.classList.remove('back', 'flip'); card.querySelector('.td-face').innerHTML = '<small>' + (type === 'dare' ? '大冒险' : '真心话') + '</small><br>' + esc(q);
        $('tdCard').classList.add('pop');
        b.querySelector('.td-pick').outerHTML = '<div class="td-ans"><textarea id="tdA" rows="3" placeholder="' + (type === 'dare' ? '写下你是怎么完成的…' : '老实回答哦…') + '"></textarea><div class="stg-btns"><button class="ghost" id="tdSkip">换一张</button><button id="tdGo">交给TA</button></div></div>';
        $('tdSkip').onclick = () => tdHome(b);
        $('tdGo').onclick = async () => {
            const a = $('tdA').value.trim(); if (!a) { uiAlert('先写点什么吧'); return; }
            $('tdGo').disabled = true; $('tdGo').textContent = charName() + ' 在看…';
            let r = await ai('我们在玩真心话大冒险。题目是「' + q + '」，我的回答/做法是：「' + a + '」。请你以角色身份回应我，1-2句，有情绪、有互动感，直接输出。', 1.0);
            r = r ? oneLine(r) : '（' + charName() + ' 看着你笑了一下，没说话）';
            const entry = { ts: Date.now(), date: todayStr(), type, q, a, r };
            save((g) => { g.td.push(entry); markToday(g); }); heart(3);
            b.insertAdjacentHTML('beforeend', '');
            const box = b.querySelector('.td-ans'); box.innerHTML = '<div class="td-react"><div class="bub-av">' + esc(charName().slice(0, 1)) + '</div><div class="bub">' + esc(r) + '</div></div><div class="stg-btns"><button id="tdAgain">再来一张</button></div><div class="stg-tip">心动值 +3</div>';
            $('tdAgain').onclick = () => tdHome(b);
        };
    }

    // ---------- 默契问答 ----------
    window.openTacitQuiz = function () {
        const id = need(); if (!id) return; if (needKey()) return;
        stageOpen('默契问答', (b) => {
            b.innerHTML = '<div class="stg-load"><div class="spin"></div>' + esc(charName()) + ' 正在出题…</div>';
            (async () => {
                const t = await ai('我们来玩默契问答，猜猜「你」会怎么选。请以你的角色性格出5道关于你自己的生活偏好/性格的选择题（每题4个简短选项），并给出你自己的真实选择 ans（0-3）和一句理由 why（带点语气，20字内）。只输出JSON数组：[{"q":"题目","o":["选项A","选项B","选项C","选项D"],"ans":0,"why":"理由"}]', 0.9);
                const arr = t && parseJSONLoose(t);
                const qs = Array.isArray(arr) ? arr.filter(x => x && x.q && Array.isArray(x.o) && x.o.length >= 2 && Number.isInteger(x.ans) && x.ans >= 0 && x.ans < x.o.length).slice(0, 5) : [];
                if (qs.length < 3) { b.innerHTML = '<div class="stg-empty">出题失败了，检查一下网络或 API 再试试</div><div class="stg-btns"><button onclick="openTacitQuiz()">重试</button></div>'; return; }
                let i = 0, score = 0; const rec = [];
                const show = () => {
                    const q = qs[i];
                    b.innerHTML = '<div class="tq-prog">' + qs.map((_, k) => '<i class="' + (k < i ? 'done' : k === i ? 'cur' : '') + '"></i>').join('') + '</div><div class="tq-q">' + (i + 1) + '/' + qs.length + '<br>' + esc(q.q) + '</div><div class="tq-o">' + q.o.map((o, k) => '<button data-k="' + k + '">' + esc(o) + '</button>').join('') + '</div><div class="tq-r"></div>';
                    b.querySelectorAll('.tq-o button').forEach(btn => btn.onclick = () => {
                        const k = +btn.dataset.k, ok = k === q.ans; if (ok) score++; rec.push({ q: q.q, you: q.o[k], ta: q.o[q.ans], ok });
                        b.querySelectorAll('.tq-o button').forEach((x, n) => { x.disabled = true; if (n === q.ans) x.classList.add('ta'); if (n === k && !ok) x.classList.add('miss'); });
                        b.querySelector('.tq-r').innerHTML = '<div class="tq-badge ' + (ok ? 'y' : 'n') + '">' + (ok ? '猜中了！' : '差一点～') + '</div><div class="td-react"><div class="bub-av">' + esc(charName().slice(0, 1)) + '</div><div class="bub">我选「' + esc(q.o[q.ans]) + '」。' + esc(q.why || '') + '</div></div><div class="stg-btns"><button id="tqN">' + (i + 1 < qs.length ? '下一题' : '看结果') + '</button></div>';
                        $('tqN').onclick = () => { i++; i < qs.length ? show() : end(); };
                    });
                };
                const end = () => {
                    const pct = Math.round(score / qs.length * 100);
                    save((g) => { g.tacit.push({ ts: Date.now(), date: todayStr(), score: Math.round(score / qs.length * 5), real: score, total: qs.length, items: rec }); markToday(g); }); heart(2 + score);
                    const tip = pct >= 80 ? '默契满分，你们简直是一个人' : pct >= 60 ? '很懂我嘛，再接再厉' : pct >= 30 ? '还要多了解一点点哦' : '重新认识一下吧';
                    b.innerHTML = '<div class="tq-end"><div class="tq-ring" style="--p:' + pct + '"><b>' + pct + '%</b></div><h3>' + score + ' / ' + qs.length + '</h3><p>' + tip + '</p><div class="stg-tip">心动值 +' + (2 + score) + '</div></div>' + rec.map((r) => '<div class="stg-row"><i class="' + (r.ok ? 'y' : 'n') + '">' + (r.ok ? '✓' : '✗') + '</i><div><b>' + esc(r.q) + '</b><p>你：' + esc(r.you) + ' · TA：' + esc(r.ta) + '</p></div></div>').join('') + '<div class="stg-btns"><button onclick="openTacitQuiz()">再玩一局</button></div>';
                };
                show();
            })();
        }, renderHub);
    };

    // ---------- 记录 ----------
    function openHistory() {
        if (!need()) return;
        stageOpen('我们的记录', (b) => {
            const g = readG(), all = g.td.map(x => ({ ts: x.ts, k: 'td', x })).concat(g.tacit.map(x => ({ ts: x.ts, k: 'tq', x })), g.calls.map(x => ({ ts: x.ts, k: 'call', x }))).sort((a, c) => c.ts - a.ts).slice(0, 40);
            b.innerHTML = all.length ? all.map(e => '<div class="stg-date">' + fmtTs(e.ts) + '</div>' + (e.k === 'td' ? tdRow(e.x) : e.k === 'tq' ? '<div class="stg-row"><i>默契</i><div><b>默契问答 ' + e.x.real + '/' + e.x.total + '</b><p>默契度 ' + Math.round(e.x.real / e.x.total * 100) + '%</p></div></div>' : '<div class="stg-row"><i>通话</i><div><b>语音通话</b><p>' + Math.floor(e.x.sec / 60) + ' 分 ' + (e.x.sec % 60) + ' 秒</p></div></div>')).join('') : '<div class="stg-empty">还没有记录，去玩一局吧</div>';
        }, renderHub);
    }

    // ---------- 通话时长记录 ----------
    let t0 = 0;
    if (typeof window.startCall === 'function') { const o = window.startCall; window.startCall = function () { t0 = 0; return o.apply(this, arguments); }; }
    if (typeof window.acceptCall === 'function') { const o = window.acceptCall; window.acceptCall = function () { t0 = Date.now(); return o.apply(this, arguments); }; }
    if (typeof window.endCall === 'function') { const o = window.endCall; window.endCall = function () { if (t0) { const sec = Math.round((Date.now() - t0) / 1000); t0 = 0; if (sec >= 3) { save((g) => { g.calls.push({ ts: Date.now(), date: todayStr(), sec }); markToday(g); }); heart(3); } } const r = o.apply(this, arguments); try { renderHub(); } catch (e) {} return r; }; }

    const sel = $('gamesCharSelect'); if (sel) sel.addEventListener('change', () => setTimeout(renderHub, 50));
    const gapp = $('gamesApp'); if (gapp) new MutationObserver(() => { if (!gapp.classList.contains('hidden')) renderHub(); }).observe(gapp, { attributes: true, attributeFilter: ['class'] });
    document.querySelectorAll('[data-li]').forEach(el => { el.innerHTML = LI(el.dataset.li, 26); });
    renderHub();
})();
