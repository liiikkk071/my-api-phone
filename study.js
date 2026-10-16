/* study.js —— 一起学习 / 一起阅读
 * 学习：日语 / 韩语 / 英语（也能选法语、西语、德语）。发音表（点一下就读）、常用短语和情话、AI 出的单词 / 语法小课堂、测验、和 TA 的情景对话陪练、一起专注计时。
 * 阅读：粘贴 / 导入文本，或让 TA 写一篇；TA 陪你读，翻页时会说说感想，点段落可以问 TA、划线、写想法、朗读、讲解。
 * 内置内容（发音表、短语）不用 API；出题、讲解、对话需要在「设置」里填好 API Key。 */
(function () {
    'use strict';
    const $ = (id) => document.getElementById(id), esc = (s) => escapeHtml(String(s == null ? '' : s));
    const SD = window.STUDY_DATA; if (!SD) return;
    const LANGS = SD.LANGS, KEY = 'studyData', BKEY = 'studyBooks';
    const uid = () => 's' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5);
    const shuffle = (a) => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); const t = a[i]; a[i] = a[j]; a[j] = t; } return a; };
    const pick = (a) => a[Math.floor(Math.random() * a.length)];

    // ---------- 存储 ----------
    function jget(k, d) { try { const v = JSON.parse(store.getItem(k) || 'null'); return v == null ? d : v; } catch (e) { return d; } }
    function jset(k, v) { try { store.setItem(k, JSON.stringify(v)); return true; } catch (e) { uiAlert('保存失败，空间不够了'); return false; } }
    const DEF = { lang: 'ja', lv: {}, vocab: [], log: {}, talk: {}, cfg: { rate: 0.9, showR: true, showM: true, coRead: true, goal: 20, voice: 'auto', voiceId: '' }, taLine: '' };
    function load() { const d = jget(KEY, {}) || {}; return Object.assign({}, DEF, d, { cfg: Object.assign({}, DEF.cfg, d.cfg || {}), vocab: d.vocab || [], log: d.log || {}, talk: d.talk || {}, lv: d.lv || {} }); }
    let D = load(), BK = jget(BKEY, []);
    const save = () => jset(KEY, D), saveBooks = () => jset(BKEY, BK);
    const L = () => LANGS[D.lang] || LANGS.ja, lvOf = () => D.lv[D.lang] || L().levels[0];
    const today = () => todayStr();

    // ---------- 注册到桌面 ----------
    try {
        if (allApps.indexOf('study') < 0) allApps.push('study');
        if (!HOME_APPS.some(a => a.id === 'study')) HOME_APPS.push({ id: 'study', name: '一起学习', cls: 'study-icon', face: '(๑•̀ㅂ•́)و', go: () => openApp('study') });
        GLYPH.study = '<path d="M4 5.5c2.6-1 5.4-1 8 .8 2.6-1.8 5.4-1.8 8-.8v12.2c-2.6-1-5.4-1-8 .8-2.6-1.8-5.4-1.8-8-.8z"/><path d="M12 6.3v12.2"/>';
    } catch (e) { }

    // ---------- 状态 ----------
    let tab = 'learn', sub = null, subTab = '', qz = null, book = null, busy = false, lastAct = Date.now(), words = [], gram = null, phTopic = '', pron = { k: '' };
    const FT = { on: false, left: 0, total: 0, iv: null, ping: 0, paused: false, t0: 0 };

    // ---------- 工具 ----------
    function logAdd(field, n) { const t = today(); const o = D.log[t] = D.log[t] || { min: 0, words: 0, quiz: 0, ok: 0, read: 0 }; o[field] = (o[field] || 0) + n; save(); }
    function streak() { let n = 0, d = today(); const has = (x) => { const o = D.log[x]; return o && (o.min >= 1 || o.words || o.quiz || o.read); }; if (!has(d)) d = addDays(d, -1); while (has(d)) { n++; d = addDays(d, -1); } return n; }
    const todayMin = () => Math.round(((D.log[today()] || {}).min) || 0);
    function ta() { const id = getActiveCharId(); return id ? getChar(id) : null; }
    const taName = () => { const c = ta(); return c ? c.name : 'TA'; };
    function spkLang(t) { t = String(t); return /[぀-ヿ]/.test(t) ? 'ja-JP' : /[가-힯]/.test(t) ? 'ko-KR' : /[一-鿿]/.test(t) ? 'zh-CN' : L().tts; }
    function speakBrowser(text, lang, rate) {
        try {
            if (!('speechSynthesis' in window)) { uiAlert('这个浏览器不支持朗读，换 Safari / Chrome 试试'); return; }
            if (window.ttsStop) try { window.ttsStop(); } catch (e) { }
            speechSynthesis.cancel(); const u = new SpeechSynthesisUtterance(String(text)); u.lang = lang || L().tts; u.rate = rate || D.cfg.rate || 0.9;
            const vs = speechSynthesis.getVoices() || [], v = vs.find(x => x.lang === u.lang) || vs.find(x => x.lang && x.lang.slice(0, 2) === u.lang.slice(0, 2));
            if (v) u.voice = v; else if (vs.length && !speakBrowser._warned) { speakBrowser._warned = 1; uiAlert('你的设备好像没有「' + u.lang + '」的语音包，可以在系统设置里下载，或者先看读音学习', 3200); }
            speechSynthesis.speak(u);
        } catch (e) { }
    }
    // 声音来源：auto=有接入的声音就用，否则浏览器；browser / mine(默认声音) / ta(TA的声音) / custom(学习专用声音ID)
    function voicePlan() {
        const mode = D.cfg.voice || 'auto', tid = ta() ? ta().id : null;
        if (mode === 'browser' || !window.ttsReady) return null;
        if (mode === 'custom') { const v = String(D.cfg.voiceId || '').trim(); const p = window.ttsReady(null, v); return v && p ? { provider: p, voice: v, charId: null } : null; }
        if (mode === 'ta') { const p = window.ttsReady(tid); return p ? { provider: p, charId: tid } : null; }
        const p = window.ttsReady(null); return p ? { provider: p, charId: null } : null;
    }
    function speak(text, lang, rate) {
        const plan = voicePlan(); text = String(text);
        if (!plan) return speakBrowser(text, lang, rate);
        const sp = rate ? Math.max(0.7, Math.min(1.2, rate / 0.9)) : Math.max(0.7, Math.min(1.2, (D.cfg.rate || 0.9) / 0.9));
        window.ttsSpeak(text, plan.charId, { provider: plan.provider, voice: plan.voice, speed: Math.round(sp * 20) / 20, cache: true, silent: true, throw: true, force: true }).catch((e) => {
            if (!speak._w) { speak._w = 1; uiAlert('接入的声音这次没成功（' + (e && e.message || '未知') + '），先用浏览器朗读代替', 3600); }
            speakBrowser(text, lang, rate);
        });
    }
    // 跟读：用浏览器的语音识别，把你读的和原文比一比（不支持的浏览器会提示）
    function lev(a, b) { const m = a.length, n = b.length; if (!m) return n; if (!n) return m; let p = []; for (let j = 0; j <= n; j++) p[j] = j; for (let i = 1; i <= m; i++) { let c = [i]; for (let j = 1; j <= n; j++) c[j] = Math.min(p[j] + 1, c[j - 1] + 1, p[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)); p = c; } return p[n]; }
    const norm = (s) => String(s).toLowerCase().replace(/[\s。、，,.!！?？~〜・'’"“”「」（）()\-]/g, '');
    function shadow(target, lang, cb) {
        const SR = window.SpeechRecognition || window.webkitSpeechRecognition; if (!SR) { uiAlert('这个浏览器不支持语音识别（安卓 Chrome / iPhone Safari 比较可以）。可以先点 ♪ 听，自己读出来～', 3400); return; }
        try {
            const r = new SR(); r.lang = lang || L().tts; r.interimResults = false; r.maxAlternatives = 3; uiAlert('请开始读…', 1500);
            r.onresult = (e) => { const heard = e.results[0][0].transcript, a = norm(target), b = norm(heard), sc = Math.max(0, Math.round((1 - lev(a, b) / Math.max(a.length, b.length, 1)) * 100)); cb({ heard: heard, score: sc }); };
            r.onerror = () => uiAlert('没听清，再试一次吧（需要允许麦克风）'); r.start();
        } catch (e) { uiAlert('麦克风打不开'); }
    }
    async function ask(sys, user, temp) { return chatCompletion([{ role: 'system', content: sys }, { role: 'user', content: user }], temp == null ? 0.7 : temp); }
    function needApi() { if (!API_KEY) { uiAlert('这个功能要先在「设置」里填好 API Key 哦（发音表、短语、单词本、测验不需要）', 3200); return true; } return false; }
    const FALL = { praise: ['答得很好呀，我都替你开心。', '又进步了一点点，继续保持哦。', '认真的样子很帅 / 很可爱，我都看呆了。'], cheer: ['没关系，错的地方记住了就是赚到。', '慢慢来，我陪着你一起学。', '再来一次，这次一定可以。'], miss: ['今天还没学习呢，来陪我一会儿吧？'] };
    // TA 说话：有 API 就用 TA 自己的口吻，没有就用内置小句子
    async function taSay(task, fb) {
        const id = getActiveCharId(), c = id ? getChar(id) : null;
        if (!c || !API_KEY) return { c: c, text: fb };
        try { const t = await callPersona(id, task + '\n（只输出你想对我说的话，口语，60字以内，符合你的人设，不要用emoji，不要加引号。）', 1.0); return { c: c, text: oneLine(t) || fb }; } catch (e) { return { c: c, text: fb }; }
    }
    function bubble(txt) { const c = ta(); return '<div class="st-ta"><span class="avatar-small">' + (c ? charAvatarInner(c) : '(๑•̀ㅂ•́)') + '</span><div><b>' + esc(taName()) + '</b><p>' + esc(txt) + '</p></div></div>'; }
    function setTaLine(t) { D.taLine = t; save(); renderComp(); }
    const needReadFmt = () => L().rd;

    // ---------- 外壳 ----------
    function ensure() {
        if ($('studyApp')) return;
        const el = document.createElement('div'); el.id = 'studyApp'; el.className = 'app-screen hidden'; el.style.position = 'absolute';
        el.innerHTML = '<div class="app-header"><button onclick="goHome()">‹ 返回</button><span>一起学习</span><button class="hdr-btn" id="stSet">设置</button></div><div class="scroll-area xa-body" id="stBody"></div>';
        ($('callScreen') ? $('callScreen').parentElement : document.body).appendChild(el);
        $('stSet').onclick = settings;
        ['pointerdown', 'keydown', 'touchstart'].forEach(ev => el.addEventListener(ev, () => { lastAct = Date.now(); }, { passive: true }));
        new MutationObserver(() => { if (!el.classList.contains('hidden')) { D = load(); BK = jget(BKEY, []); shell(); } }).observe(el, { attributes: true, attributeFilter: ['class'] });
    }
    function sheet(html, cls) { const app = $('studyApp'), m = document.createElement('div'); m.className = 'xa-mask'; m.innerHTML = '<div class="xa-sheet ' + (cls || '') + '">' + html + '</div>'; m.addEventListener('mousedown', (e) => { if (e.target === m) m.remove(); }); app.appendChild(m); return m; }
    const TABS = [['learn', '学习'], ['read', '阅读'], ['vocab', '单词本'], ['log', '打卡']];
    function shell() {
        const b = $('stBody'); if (!b) return;
        b.innerHTML = '<div id="stComp"></div><div class="st-tabs" id="stTabs">' + TABS.map(t => '<button data-t="' + t[0] + '" class="' + (t[0] === tab ? 'on' : '') + '">' + t[1] + '</button>').join('') + '</div><div id="stMain"></div>';
        $('stTabs').onclick = (e) => { const x = e.target.closest('button'); if (!x) return; tab = x.dataset.t; sub = null; book = null; qz = null; $('stTabs').querySelectorAll('button').forEach(z => z.classList.toggle('on', z === x)); renderMain(); };
        renderComp(); renderMain();
    }
    function renderComp() {
        const box = $('stComp'); if (!box) return; const c = ta(), s = streak();
        const line = FT.on ? '专注中 ' + fmtT(FT.left) + ' · ' + taName() + ' 在陪你' : (D.taLine || (c ? '今天也一起加油吧，我在这儿陪你。' : '先去通讯录创建一个角色，TA 就能陪你学习啦'));
        box.innerHTML = '<div class="st-comp" id="stCompCard"><span class="avatar-small">' + (c ? charAvatarInner(c) : '(๑•̀ㅂ•́)') + '</span><div class="st-cl"><b>' + esc(taName()) + ' 陪你学习</b><p>' + esc(line) + '</p></div><div class="st-cs"><b>' + s + '</b><small>连续天数</small></div><div class="st-cs"><b>' + todayMin() + '</b><small>今日分钟</small></div></div>';
        $('stCompCard').onclick = async () => { if (busy) return; busy = true; const r = await taSay('我正在学习，随便说一句鼓励/陪伴我的话（可以撒点娇或调侃，贴合我们现在的关系）。', pick(FALL.cheer)); busy = false; setTaLine(r.text); };
    }
    const fmtT = (s) => { s = Math.max(0, Math.round(s)); return String(Math.floor(s / 60)).padStart(2, '0') + ':' + String(s % 60).padStart(2, '0'); };
    function renderMain() {
        const m = $('stMain'); if (!m) return;
        if (tab === 'learn') return viewLearn(m);
        if (tab === 'read') return viewRead(m);
        if (tab === 'vocab') return viewVocab(m);
        return viewLog(m);
    }
    function backBar(title, extra) { return '<div class="st-back"><button id="stBack">‹ 返回</button><b>' + esc(title) + '</b><span>' + (extra || '') + '</span></div>'; }
    function onBack(fn) { const b = $('stBack'); if (b) b.onclick = fn; }

    // ---------- 学习首页 ----------
    const ACTS = [
        ['pron', 'Aa', '发音基础', '字母表 / 音标，点一下就读'],
        ['phr', '…', '日常短语 & 情话', '带读音和用法，能让 TA 对你说'],
        ['words', '❀', 'AI 单词卡', '按主题出词：读音·用法·例句'],
        ['gram', '❖', '语法小课堂', '讲清楚用法，附练习题'],
        ['quiz', '✎️', '小测验', '看词选义 / 听音选词，TA 会点评'],
        ['talk', '♪', '对话陪练', '和 TA 用外语聊天，帮你纠错'],
        ['focus', '◔', '一起专注', '倒计时，TA 全程陪着你']
    ];
    function viewLearn(m) {
        if (sub) return viewSub(m);
        const keys = Object.keys(LANGS), lg = L();
        m.innerHTML = '<div class="st-sec"><h4>我想学</h4><div class="xa-chips" id="stLang">' + keys.map(k => '<button data-k="' + k + '" class="' + (k === D.lang ? 'on' : '') + '">' + LANGS[k].flag + ' ' + LANGS[k].name + '</button>').join('') + '</div><h4>我现在的水平</h4><div class="xa-chips" id="stLv">' + lg.levels.map(l => '<button data-l="' + esc(l) + '" class="' + (l === lvOf() ? 'on' : '') + '">' + esc(l) + '</button>').join('') + '</div>' + (D.lang !== 'ja' && D.lang !== 'ko' && D.lang !== 'en' ? '<p class="st-note">' + lg.name + '的发音表和内置短语还在整理中，单词卡、语法、测验、对话都可以正常用（需要 API）。</p>' : '') + '</div>'
            + '<div class="st-grid">' + ACTS.map(a => '<button class="st-act" data-a="' + a[0] + '"><i>' + a[1] + '</i><b>' + a[2] + '</b><span>' + a[3] + '</span></button>').join('') + '</div>';
        $('stLang').onclick = (e) => { const b = e.target.closest('button'); if (!b) return; D.lang = b.dataset.k; save(); renderMain(); };
        $('stLv').onclick = (e) => { const b = e.target.closest('button'); if (!b) return; D.lv[D.lang] = b.dataset.l; save(); renderMain(); };
        m.querySelectorAll('[data-a]').forEach(b => b.onclick = () => { sub = b.dataset.a; subTab = ''; words = []; gram = null; renderMain(); });
    }
    function viewSub(m) {
        const f = { pron: subPron, phr: subPhr, words: subWords, gram: subGram, quiz: subQuiz, talk: subTalk, focus: subFocus }[sub];
        if (f) f(m); else { sub = null; renderMain(); }
    }
    const goLearn = () => { sub = null; qz = null; renderMain(); };

    // ---------- 发音基础 ----------
    function cell(big, small, tip, speakTxt, lang) { return '<button class="st-cell" data-s="' + esc(speakTxt) + '" data-l="' + (lang || '') + '" title="' + esc(tip || '') + '"><b>' + esc(big) + '</b><small>' + esc(small) + '</small></button>'; }
    function subPron(m) {
        const k = D.lang, T = SD.TIPS[k] || [];
        const tabs = k === 'ja' ? [['h', '平假名'], ['k', '片假名'], ['d', '浊音半浊音']] : k === 'ko' ? [['v', '元音'], ['c', '辅音']] : k === 'en' ? [['v', '元音'], ['c', '辅音']] : [];
        if (tabs.length && !tabs.some(t => t[0] === subTab)) subTab = tabs[0][0];
        let h = backBar('发音基础 · ' + L().name) + '<p class="st-note">点一下格子就会读出来；点 慢 可以放慢。</p>';
        if (tabs.length) h += '<div class="xa-chips" id="stPT">' + tabs.map(t => '<button data-t="' + t[0] + '" class="' + (t[0] === subTab ? 'on' : '') + '">' + t[1] + '</button>').join('') + '</div>';
        if (k === 'ja') {
            const rows = subTab === 'h' ? SD.H_ROWS : subTab === 'k' ? SD.K_ROWS : SD.H_DAKU.concat(SD.K_DAKU);
            h += '<div class="st-kana">' + rows.map(r => r.map(c => { if (!c) return '<span></span>'; const p = c.split(' '); return cell(p[0], p[1], '', p[0], 'ja-JP'); }).join('')).join('') + '</div>';
        } else if (k === 'ko') {
            const arr = subTab === 'v' ? SD.KO_VOW : SD.KO_CON;
            h += '<div class="st-kana ko">' + arr.map(c => cell(c[0], c[1], '', c[2], 'ko-KR')).join('') + '</div><p class="st-note">格子里是字母本身，读音是「' + (subTab === 'v' ? '辅音 ㅇ + 元音' : '辅音 + ㅏ') + '」的音节（例如 ㄱ → 가）。</p>';
        } else if (k === 'en') {
            const arr = subTab === 'v' ? SD.IPA_V : SD.IPA_C;
            h += '<div class="st-ipa">' + arr.map(c => '<div class="st-ipai" data-s="' + esc(c[1]) + '" data-l="en-US"><b>/' + esc(c[0]) + '/</b><span>' + esc(c[1]) + '</span><small>' + esc(c[2]) + '</small></div>').join('') + '</div><p class="st-note">点一行会读出例词，听听这个音出现在哪里。</p>';
        } else h += '<div class="xa-empty">' + L().name + '的发音表暂时没有内置～<br>到「日常短语」里点 ♪ 听发音，或用「语法小课堂」问问读音规则。</div>';
        if (T.length) h += '<div class="xa-title">发音要点</div>' + T.map(t => '<div class="st-tip"><b>' + esc(t[0]) + '</b><p>' + esc(t[1]) + '</p></div>').join('');
        h += '<div class="xa-btns"><button id="stPAsk">让 TA 当小老师，教我一个发音窍门</button></div><div id="stPOut"></div>';
        m.innerHTML = h; onBack(goLearn);
        if ($('stPT')) $('stPT').onclick = (e) => { const b = e.target.closest('button'); if (!b) return; subTab = b.dataset.t; renderMain(); };
        m.querySelectorAll('[data-s]').forEach(b => b.onclick = () => speak(b.dataset.s, b.dataset.l, k === 'ja' || k === 'ko' ? 0.8 : 0.85));
        $('stPAsk').onclick = async () => { if (needApi() || busy) return; busy = true; $('stPOut').innerHTML = '<p class="st-note">TA 在想怎么教你…</p>'; const r = await taSay('请用你自己的语气，教我一个' + L().name + '发音的小窍门（我是中文母语者，水平：' + lvOf() + '），带一个具体例子和读音，像在手把手教我。', '先从最基础的发音开始，一个一个读出来吧。'); busy = false; $('stPOut').innerHTML = bubble(r.text); };
    }

    // ---------- 日常短语 ----------
    function phraseRow(p, i) {
        const r = D.cfg.showR ? '<span class="st-r">' + esc(p.r || '') + '</span>' : '';
        return '<div class="st-ph" data-i="' + i + '"><div class="top"><div><b class="st-w">' + esc(p.w) + '</b>' + r + '</div><div class="st-btns"><button data-a="say" title="朗读">♪</button><button data-a="slow" title="慢速">慢</button><button data-a="mic" title="跟读">◉</button><button data-a="add" title="加入单词本">' + (hasVocab(p.w) ? '✓' : '＋') + '</button></div></div><div class="st-m">' + esc(p.m) + '</div>' + (p.n ? '<div class="st-n">' + esc(p.n) + '</div>' : '') + '<div class="st-out"></div><div class="st-btns2"><button data-a="ta">让 TA 对我说</button></div></div>';
    }
    function seedList() { return (SD.PH[D.lang] || []).map(a => ({ w: a[0], r: a[1], m: a[2], n: a[3], lang: D.lang })); }
    function subPhr(m) {
        const seeds = seedList(), extra = (D.extraPh && D.extraPh[D.lang]) || [], list = seeds.concat(extra);
        let h = backBar('日常短语 & 情话 · ' + L().name) + '<div class="xa-chips" id="stPhTopic">' + ['日常', '恋爱情话', '撒娇', '吃饭', '出门/旅行', '想念', '自己写'].map(t => '<button data-t="' + t + '">' + t + '</button>').join('') + '</div><p class="st-note">下面是内置的常用句。点「再来几句」可以让 AI 按主题补充（需要 API）。</p>';
        h += list.length ? list.map(phraseRow).join('') : '<div class="xa-empty">' + L().name + '还没有内置短语，点上面的主题让 AI 来出吧～</div>';
        m.innerHTML = h; onBack(goLearn); const all = list;
        $('stPhTopic').onclick = async (e) => {
            const b = e.target.closest('button'); if (!b || needApi() || busy) return; let t = b.dataset.t;
            if (t === '自己写') { const v = await uiPrompt('想学什么场景的句子？', '', { placeholder: '例如：安慰难过的人 / 说晚安时的小情话' }); if (!v || !v.trim()) return; t = v.trim().slice(0, 30); }
            busy = true; b.textContent = '生成中…';
            try { const arr = await genItems('短语/句子', t, 6); D.extraPh = D.extraPh || {}; D.extraPh[D.lang] = (D.extraPh[D.lang] || []).concat(arr.map(x => ({ w: x.w, r: x.r, m: x.m, n: x.use || x.n || '', lang: D.lang }))).slice(-40); save(); } catch (er) { uiAlert('生成失败：' + er.message); }
            busy = false; renderMain();
        };
        m.querySelectorAll('.st-ph').forEach(row => row.onclick = async (e) => {
            const b = e.target.closest('button'); if (!b) return; const p = all[+row.dataset.i], a = b.dataset.a, out = row.querySelector('.st-out');
            if (a === 'say') speak(p.w, L().tts); else if (a === 'slow') speak(p.w, L().tts, 0.55);
            else if (a === 'mic') shadow(p.w, L().tts, (r) => { out.innerHTML = '<div class="st-score s' + (r.score >= 80 ? 3 : r.score >= 50 ? 2 : 1) + '">你读的：' + esc(r.heard) + ' · 相似度 ' + r.score + '%</div>'; logAdd('words', 0); });
            else if (a === 'add') { if (addVocab(p)) { b.textContent = '✓'; logAdd('words', 1); renderComp(); } else uiAlert('已经在单词本里啦', 1200); }
            else if (a === 'ta') {
                if (needApi() || busy) return; busy = true; out.innerHTML = '<p class="st-note">TA 在组织语言…</p>';
                try { const t = await callPersona(getActiveCharId(), '请用' + L().name + '对我说一句包含或模仿「' + p.w + '」的话，贴合你的人设和我们现在的关系，要自然、有感情。只输出JSON：{"t":"' + L().name + '原文","r":"读音","m":"中文意思","say":"你想补充的一句中文话（可空）"}', 1.0); const j = parseJSONLoose(t); if (!j || !j.t) throw new Error('没有识别到内容'); out.innerHTML = '<div class="st-tab"><b>' + esc(j.t) + '</b> <button data-a="again">♪</button><div class="st-r">' + esc(j.r || '') + '</div><div>' + esc(j.m || '') + '</div>' + (j.say ? '<div class="st-n">' + esc(taName()) + '：' + esc(j.say) + '</div>' : '') + '</div>'; out.querySelector('[data-a="again"]').onclick = (ev) => { ev.stopPropagation(); speak(j.t, L().tts); }; speak(j.t, L().tts); }
                catch (er) { out.innerHTML = '<p class="st-note">没成功：' + esc(er.message) + '</p>'; }
                busy = false;
            }
        });
    }

    // ---------- AI 生成单词 / 短语 ----------
    async function genItems(kind, topic, n) {
        const sys = '你是资深的' + L().name + '老师，学生是中文母语者，水平：' + lvOf() + '。只输出JSON，不要任何多余文字。';
        const u = '请按主题「' + topic + '」挑选' + n + '个实用的' + kind + '（贴近真实使用，不要生僻）。输出：{"items":[{"w":"' + L().name + '原文","r":"读音（' + needReadFmt() + '）","m":"中文意思","pos":"词性","use":"用法说明（25-60字：搭配、语气、使用场合、容易错的点）","ex":"' + L().name + '例句","exr":"例句读音","exm":"例句中文意思"}]}';
        const j = parseJSONLoose(await ask(sys, u, 0.8)); if (!j || !Array.isArray(j.items) || !j.items.length) throw new Error('AI 返回的格式不对，再试一次');
        return j.items.filter(x => x && x.w && x.m).map(x => ({ w: String(x.w), r: String(x.r || ''), m: String(x.m), pos: String(x.pos || ''), use: String(x.use || ''), ex: String(x.ex || ''), exr: String(x.exr || ''), exm: String(x.exm || ''), lang: D.lang }));
    }
    const hasVocab = (w) => D.vocab.some(v => v.lang === D.lang && v.w === w);
    function addVocab(it) {
        if (D.vocab.some(v => v.lang === (it.lang || D.lang) && v.w === it.w)) return false;
        D.vocab.unshift({ id: uid(), lang: it.lang || D.lang, w: it.w, r: it.r || '', m: it.m || '', pos: it.pos || '', use: it.use || it.n || '', ex: it.ex || '', exr: it.exr || '', exm: it.exm || '', star: false, ok: 0, bad: 0, ts: Date.now() });
        D.vocab = D.vocab.slice(0, 1500); save(); return true;
    }

    // ---------- AI 单词卡 ----------
    const TOPICS = ['日常生活', '恋爱 / 情感', '美食', '出行旅游', '心情情绪', '天气季节', '工作学习', '购物', '自己写'];
    function wordCard(it, i) {
        return '<div class="st-wc" data-i="' + i + '"><div class="top"><div><b class="st-w">' + esc(it.w) + '</b><span class="st-r">' + esc(it.r) + '</span></div><div class="st-btns"><button data-a="say">♪</button><button data-a="slow">慢</button><button data-a="mic">◉</button><button data-a="add">' + (hasVocab(it.w) ? '✓' : '＋') + '</button></div></div><div class="st-m">' + esc(it.m) + (it.pos ? ' <em>' + esc(it.pos) + '</em>' : '') + '</div>' + (it.use ? '<div class="st-n">' + esc(it.use) + '</div>' : '') + (it.ex ? '<div class="st-ex"><div>' + esc(it.ex) + ' <button data-a="exsay">♪</button></div>' + (it.exr ? '<div class="st-r">' + esc(it.exr) + '</div>' : '') + (it.exm ? '<div>' + esc(it.exm) + '</div>' : '') + '</div>' : '') + '<div class="st-out"></div><div class="st-btns2"><button data-a="ta">让 TA 用这个词对我说话</button></div></div>';
    }
    function subWords(m) {
        let h = backBar('AI 单词卡 · ' + L().name + ' · ' + lvOf()) + '<div class="xa-chips" id="stWT">' + TOPICS.map(t => '<button data-t="' + t + '">' + t + '</button>').join('') + '</div><div class="xa-chips" id="stWN"><span class="st-note" style="margin:0">一次</span>' + [5, 8, 10].map(n => '<button data-n="' + n + '" class="' + (n === (D.wn || 5) ? 'on' : '') + '">' + n + ' 个</button>').join('') + '</div>';
        if (!words.length) h += '<div class="xa-empty">选一个主题，TA 会为你挑一组适合现在水平的词。<br>每个词有读音、用法、例句，还能加入单词本。</div>';
        else h += words.map(wordCard).join('') + '<div class="xa-btns"><button id="stWAll">全部加入单词本</button><button class="pri" id="stWQz">考考我这几个</button></div>';
        m.innerHTML = h; onBack(goLearn);
        $('stWN').onclick = (e) => { const b = e.target.closest('[data-n]'); if (!b) return; D.wn = +b.dataset.n; save(); $('stWN').querySelectorAll('[data-n]').forEach(z => z.classList.toggle('on', z === b)); };
        $('stWT').onclick = async (e) => {
            const b = e.target.closest('button'); if (!b || needApi() || busy) return; let t = b.dataset.t;
            if (t === '自己写') { const v = await uiPrompt('想学哪方面的词？', '', { placeholder: '例如：和猫咪有关 / 办公室 / 约会时会说的话' }); if (!v || !v.trim()) return; t = v.trim().slice(0, 30); }
            busy = true; m.querySelector('.xa-empty,.st-wc') && (m.insertAdjacentHTML('beforeend', '<p class="st-note">正在为你挑词…</p>'));
            try { words = await genItems('单词/短语', t, D.wn || 5); } catch (er) { uiAlert('生成失败：' + er.message); }
            busy = false; renderMain();
        };
        m.querySelectorAll('.st-wc').forEach(row => row.onclick = async (e) => {
            const b = e.target.closest('button'); if (!b) return; const it = words[+row.dataset.i], a = b.dataset.a, out = row.querySelector('.st-out');
            if (a === 'say') speak(it.w, L().tts); else if (a === 'slow') speak(it.w, L().tts, 0.55); else if (a === 'exsay') speak(it.ex, L().tts);
            else if (a === 'mic') shadow(it.w, L().tts, (r) => { out.innerHTML = '<div class="st-score s' + (r.score >= 80 ? 3 : r.score >= 50 ? 2 : 1) + '">你读的：' + esc(r.heard) + ' · 相似度 ' + r.score + '%</div>'; });
            else if (a === 'add') { if (addVocab(it)) { b.textContent = '✓'; logAdd('words', 1); renderComp(); } else uiAlert('已经在单词本里啦', 1200); }
            else if (a === 'ta') {
                if (needApi() || busy) return; busy = true; out.innerHTML = '<p class="st-note">TA 在想怎么说…</p>';
                try { const t = await callPersona(getActiveCharId(), '请用' + L().name + '说一句话对我说，必须用到「' + it.w + '」，要贴合你的人设和我们的关系，像真人聊天。只输出JSON：{"t":"原文","r":"读音","m":"中文意思","say":"你再用中文补一句（可空）"}', 1.0); const j = parseJSONLoose(t); if (!j || !j.t) throw new Error('没有识别到内容'); out.innerHTML = '<div class="st-tab"><b>' + esc(j.t) + '</b> <button data-a="again">♪</button><div class="st-r">' + esc(j.r || '') + '</div><div>' + esc(j.m || '') + '</div>' + (j.say ? '<div class="st-n">' + esc(taName()) + '：' + esc(j.say) + '</div>' : '') + '</div>'; out.querySelector('[data-a="again"]').onclick = (ev) => { ev.stopPropagation(); speak(j.t, L().tts); }; speak(j.t, L().tts); }
                catch (er) { out.innerHTML = '<p class="st-note">没成功：' + esc(er.message) + '</p>'; }
                busy = false;
            }
        });
        if ($('stWAll')) $('stWAll').onclick = () => { let n = 0; words.forEach(w => { if (addVocab(w)) n++; }); logAdd('words', n); uiAlert('新加入 ' + n + ' 个词', 1400); renderMain(); renderComp(); };
        if ($('stWQz')) $('stWQz').onclick = () => { startQuiz(words.map(w => ({ w: w.w, r: w.r, m: w.m, lang: D.lang })), { n: Math.min(words.length, 8), type: 'mix', title: '这组词的小测验' }); };
    }

    // ---------- 语法小课堂 ----------
    function subGram(m) {
        let h = backBar('语法小课堂 · ' + L().name + ' · ' + lvOf()) + '<div class="xa-chips" id="stGT">' + (L().grammar || []).map(t => '<button data-t="' + esc(t) + '">' + esc(t) + '</button>').join('') + '<button data-t="__own">＋自己问</button></div>';
        if (!gram) h += '<div class="xa-empty">选一个语法点，或者自己问一个。<br>会有讲解、例句、容易错的地方，还有几道小练习。</div>';
        else {
            h += '<div class="st-lesson"><h3>' + esc(gram.title) + '</h3>' + (gram.summary ? '<p>' + esc(gram.summary) + '</p>' : '') + (gram.form ? '<div class="st-n"><b>构成：</b>' + esc(gram.form) + '</div>' : '') + (gram.points || []).map(p => '<div class="st-n">• ' + esc(p) + '</div>').join('') + ((gram.examples || []).length ? '<div class="xa-title">例句</div>' + gram.examples.map((x, i) => '<div class="st-ex" data-i="' + i + '"><div>' + esc(x.t) + ' <button data-a="exsay">♪</button></div>' + (x.r ? '<div class="st-r">' + esc(x.r) + '</div>' : '') + '<div>' + esc(x.m) + '</div></div>').join('') : '') + (gram.tips ? '<div class="st-tip"><b>容易错的地方</b><p>' + esc(gram.tips) + '</p></div>' : '') + '</div><div id="stGOut"></div><div class="xa-btns"><button id="stGTa">让 TA 用它对我说一句</button>' + ((gram.quiz || []).length ? '<button class="pri" id="stGQz">做 ' + gram.quiz.length + ' 道练习</button>' : '') + '</div>';
        }
        m.innerHTML = h; onBack(goLearn);
        $('stGT').onclick = async (e) => {
            const b = e.target.closest('button'); if (!b || needApi() || busy) return; let t = b.dataset.t;
            if (t === '__own') { const v = await uiPrompt('想弄懂哪个语法 / 用法？', '', { placeholder: '例如：「は」和「が」到底怎么选' }); if (!v || !v.trim()) return; t = v.trim().slice(0, 60); }
            busy = true; m.insertAdjacentHTML('beforeend', '<p class="st-note">TA 老师在备课…</p>');
            try {
                const sys = '你是耐心、讲得很清楚的' + L().name + '老师，学生是中文母语者，水平：' + lvOf() + '。只输出JSON，不要多余文字。';
                const u = '请讲解「' + t + '」。输出：{"title":"标题","summary":"一两句话说清楚它是什么","form":"构成/接续方式","points":["要点1（含使用场合和语气）","要点2","要点3"],"examples":[{"t":"' + L().name + '例句","r":"读音（' + needReadFmt() + '）","m":"中文"}],"tips":"最容易错的地方","quiz":[{"q":"练习题（选择题，可以是填空或翻译）","opts":["A","B","C","D"],"a":0,"why":"为什么"}]}。examples 给 3 个，quiz 给 4 题，a 是正确选项的下标（从0开始），选项里只有一个正确。';
                const j = parseJSONLoose(await ask(sys, u, 0.6)); if (!j || !j.title) throw new Error('AI 返回的格式不对，再试一次'); gram = j; logAdd('read', 0);
            } catch (er) { uiAlert('生成失败：' + er.message); }
            busy = false; renderMain();
        };
        m.querySelectorAll('.st-ex [data-a="exsay"]').forEach(b => b.onclick = () => speak(gram.examples[+b.closest('.st-ex').dataset.i].t, L().tts));
        if ($('stGTa')) $('stGTa').onclick = async () => {
            if (needApi() || busy) return; busy = true; $('stGOut').innerHTML = '<p class="st-note">TA 在想…</p>';
            try { const t = await callPersona(getActiveCharId(), '我正在学「' + gram.title + '」。请你用这个语法，用' + L().name + '对我说一句话，贴合你的人设和我们的关系，然后用中文告诉我这句里用到了它的哪里。只输出JSON：{"t":"原文","r":"读音","m":"中文意思","note":"你的讲解（口语，40字内）"}', 1.0); const j = parseJSONLoose(t); if (!j || !j.t) throw new Error('没有识别到内容'); $('stGOut').innerHTML = '<div class="st-tab"><b>' + esc(j.t) + '</b> <button id="stGAg">♪</button><div class="st-r">' + esc(j.r || '') + '</div><div>' + esc(j.m || '') + '</div><div class="st-n">' + esc(taName()) + '：' + esc(j.note || '') + '</div></div>'; $('stGAg').onclick = () => speak(j.t, L().tts); speak(j.t, L().tts); }
            catch (er) { $('stGOut').innerHTML = '<p class="st-note">没成功：' + esc(er.message) + '</p>'; }
            busy = false;
        };
        if ($('stGQz')) $('stGQz').onclick = () => runQuiz(gram.quiz.map(q => ({ q: q.q, opts: (q.opts || []).map(String), a: +q.a || 0, why: q.why || '' })).filter(q => q.opts.length >= 2), '「' + gram.title + '」练习');
    }

    // ---------- 测验 ----------
    function subQuiz(m) {
        if (qz) return renderQuiz(m);
        const pool = quizPool(), mine = D.vocab.filter(v => v.lang === D.lang).length;
        m.innerHTML = backBar('小测验 · ' + L().name) + '<div class="st-sec"><h4>题型</h4><div class="xa-chips" id="stQT"><button data-t="w2m" class="on">看词选义</button><button data-t="m2w">看义选词</button><button data-t="listen">听音选词</button><button data-t="mix">混合</button></div><h4>范围</h4><div class="xa-chips" id="stQS"><button data-s="all" class="on">全部（单词本 + 内置短语）</button><button data-s="mine">只考我的单词本（' + mine + '）</button><button data-s="bad">只考错题</button></div><h4>题数</h4><div class="xa-chips" id="stQN"><button data-n="5">5 题</button><button data-n="10" class="on">10 题</button><button data-n="15">15 题</button></div></div><div class="xa-btns"><button class="pri" id="stQGo">开始（共 ' + pool.length + ' 个可出题的词）</button></div><div class="xa-btns"><button id="stQAi">让 TA 针对我的水平出一套题（AI）</button></div>';
        onBack(goLearn); const o = { t: 'w2m', s: 'all', n: 10 };
        [['stQT', 't', 't'], ['stQS', 's', 's'], ['stQN', 'n', 'n']].forEach(p => $(p[0]).onclick = (e) => { const b = e.target.closest('button'); if (!b) return; o[p[1]] = p[1] === 'n' ? +b.dataset[p[2]] : b.dataset[p[2]]; $(p[0]).querySelectorAll('button').forEach(z => z.classList.toggle('on', z === b)); });
        $('stQGo').onclick = () => { const pl = quizPool(o.s); if (pl.length < 4) { uiAlert(o.s === 'bad' ? '还没有错题～先去答几题吧' : '可出题的词不够 4 个，先去「单词卡」加几个词吧'); return; } startQuiz(pl, { n: o.n, type: o.t, title: '小测验' }); };
        $('stQAi').onclick = async () => {
            if (needApi() || busy) return; busy = true; $('stQAi').textContent = 'TA 在出题…';
            try { const j = parseJSONLoose(await ask('你是' + L().name + '老师，学生是中文母语者，水平：' + lvOf() + '。只输出JSON。', '请出 8 道' + L().name + '选择题（词汇、短语用法、简单语法混合，贴近日常），输出：{"qs":[{"q":"题目","sub":"补充说明或读音（可空）","opts":["A","B","C","D"],"a":0,"why":"解析"}]}，a 为正确选项下标，只有一个正确。', 0.8)); if (!j || !Array.isArray(j.qs)) throw new Error('格式不对，再试一次'); runQuiz(j.qs.map(q => ({ q: q.q, sub: q.sub || '', opts: (q.opts || []).map(String), a: +q.a || 0, why: q.why || '' })).filter(q => q.opts.length >= 2), 'TA 出的题'); }
            catch (er) { uiAlert('出题失败：' + er.message); busy = false; renderMain(); return; }
            busy = false;
        };
    }
    function quizPool(scope) {
        const mine = D.vocab.filter(v => v.lang === D.lang).map(v => ({ w: v.w, r: v.r, m: v.m, id: v.id, bad: v.bad, lang: D.lang }));
        const seeds = seedList().map(p => ({ w: p.w, r: p.r, m: p.m, lang: D.lang }));
        if (scope === 'mine') return mine; if (scope === 'bad') return mine.filter(v => v.bad > 0);
        const seen = {}; return mine.concat(seeds).filter(x => { if (seen[x.w]) return false; seen[x.w] = 1; return true; });
    }
    function startQuiz(pool, o) {
        const all = quizPool('all'), qs = []; const items = shuffle(pool.slice()).slice(0, o.n || 10);
        items.forEach(it => {
            const t = o.type === 'mix' ? pick(['w2m', 'm2w', 'listen']) : o.type;
            let others = shuffle(all.concat(pool).filter(x => x.w !== it.w && x.m !== it.m)).slice(0, 3); if (others.length < 3) return;
            const opts = shuffle([it].concat(others));
            if (t === 'w2m') qs.push({ q: it.w, sub: it.r, speak: it.w, opts: opts.map(x => x.m), a: opts.indexOf(it), why: it.w + '（' + (it.r || '') + '）＝ ' + it.m, it: it });
            else if (t === 'm2w') qs.push({ q: it.m, sub: '选出对应的' + L().name, opts: opts.map(x => x.w), a: opts.indexOf(it), why: it.w + '（' + (it.r || '') + '）＝ ' + it.m, it: it, speakAns: it.w });
            else qs.push({ q: '♪ 听一听，选出你听到的', sub: '点喇叭重听', speak: it.w, hide: true, opts: opts.map(x => x.w), a: opts.indexOf(it), why: it.w + '（' + (it.r || '') + '）＝ ' + it.m, it: it });
        });
        if (qs.length < 2) { uiAlert('可出题的词不够，先去「单词卡」加一些词吧'); return; }
        runQuiz(qs, o.title || '小测验');
    }
    function runQuiz(qs, title) { if (!qs.length) { uiAlert('没有可用的题目'); return; } qz = { qs: qs, i: 0, ok: 0, wrong: [], title: title, ans: -1 }; tab = 'learn'; sub = 'quiz'; renderMain(); }
    function renderQuiz(m) {
        const q = qz.qs[qz.i];
        if (!q) {
            const n = qz.qs.length, pct = Math.round(qz.ok / n * 100); if (!qz.logged) { qz.logged = 1; logAdd('quiz', n); logAdd('ok', qz.ok); }
            m.innerHTML = backBar(qz.title + ' · 结果') + '<div class="st-result"><div class="big">' + qz.ok + ' / ' + n + '</div><div>正确率 ' + pct + '%</div></div><div id="stQTa" class="st-note">TA 在看你的成绩…</div>' + (qz.wrong.length ? '<div class="xa-title">做错的题</div>' + qz.wrong.map(w => '<div class="st-n">• ' + esc(w) + '</div>').join('') : '<div class="st-note">全对！太棒了</div>') + '<div class="xa-btns"><button id="stQAg">再来一组</button><button class="pri" id="stQDone">完成</button></div>';
            onBack(() => { qz = null; goLearn(); }); $('stQDone').onclick = () => { qz = null; goLearn(); }; $('stQAg').onclick = () => { qz = null; renderMain(); };
            const fb = pct >= 80 ? pick(FALL.praise) : pick(FALL.cheer);
            taSay('我刚做完「' + qz.title + '」的' + L().name + '小测验，' + n + ' 题对了 ' + qz.ok + ' 题（正确率 ' + pct + '%）。请你点评一下：' + (pct >= 80 ? '夸夸我，可以撒娇或得意' : pct >= 50 ? '鼓励我，指出还可以加强的' : '温柔地安慰并鼓励我继续') + '。', fb).then(r => { const el = $('stQTa'); if (el) { el.className = ''; el.innerHTML = bubble(r.text); } setTaLine(r.text); }); renderComp(); return;
        }
        m.innerHTML = backBar(qz.title, (qz.i + 1) + ' / ' + qz.qs.length) + '<div class="st-q"><div class="st-qq">' + (q.hide ? '' : esc(q.q)) + (q.speak ? ' <button id="stQSay">♪</button>' : '') + '</div>' + (q.sub && !q.hide ? '<div class="st-r">' + esc(q.sub) + '</div>' : (q.hide ? '<div class="st-note">' + esc(q.q) + '</div>' : '')) + '<div class="st-opts" id="stOpts">' + q.opts.map((o, i) => '<button data-i="' + i + '">' + esc(o) + '</button>').join('') + '</div><div id="stQFb"></div></div>';
        onBack(() => { qz = null; goLearn(); });
        if (q.speak) { $('stQSay').onclick = () => speak(q.speak, L().tts); if (q.hide) setTimeout(() => speak(q.speak, L().tts), 250); }
        $('stOpts').onclick = (e) => {
            const b = e.target.closest('button'); if (!b || qz.ans >= 0) return; const i = +b.dataset.i; qz.ans = i; const right = i === q.a;
            $('stOpts').querySelectorAll('button').forEach((z, k) => { z.classList.add(k === q.a ? 'ok' : (k === i ? 'no' : 'dim')); });
            if (right) qz.ok++; else qz.wrong.push((q.hide ? '听写' : q.q) + ' → ' + q.opts[q.a]);
            if (q.it && q.it.id) { const v = D.vocab.find(x => x.id === q.it.id); if (v) { if (right) v.ok = (v.ok || 0) + 1; else v.bad = (v.bad || 0) + 1; save(); } }
            if (q.speakAns) speak(q.speakAns, L().tts);
            $('stQFb').innerHTML = '<div class="st-fb ' + (right ? 'ok' : 'no') + '">' + (right ? pick(['答对啦！', '漂亮！', '就是它～']) : '差一点点') + (q.why ? '<br><small>' + esc(q.why) + '</small>' : '') + '</div><div class="xa-btns"><button class="pri" id="stQNext">' + (qz.i + 1 >= qz.qs.length ? '看结果' : '下一题') + '</button></div>';
            $('stQNext').onclick = () => { qz.i++; qz.ans = -1; renderMain(); };
        };
    }

    // ---------- 对话陪练 ----------
    const SCENES = ['自由聊天', '自我介绍', '点餐 / 咖啡店', '约会', '旅行问路', '购物', '安慰与鼓励', '睡前聊天'];
    function talkKey() { return D.lang + '_' + (getActiveCharId() || '_'); }
    function subTalk(m) {
        if (!ta()) { m.innerHTML = backBar('对话陪练') + '<div class="xa-empty">先去通讯录创建一个角色，TA 才能陪你练习～</div>'; onBack(goLearn); return; }
        const arr = D.talk[talkKey()] || [];
        m.innerHTML = backBar('和 ' + taName() + ' 练' + L().name, '<button id="stTClr" class="st-mini">清空</button>') + '<div class="xa-chips" id="stTS">' + SCENES.map(s => '<button data-s="' + s + '" class="' + (s === (D.scene || '自由聊天') ? 'on' : '') + '">' + s + '</button>').join('') + '</div><div class="st-chat" id="stChat"></div><div class="st-quick" id="stTQ"><button data-q="slow">说慢一点 / 简单点</button><button data-q="hint">给我提示怎么回</button><button data-q="start">你先开个头</button></div><div class="st-inp"><button id="stMic" title="语音输入">◉</button><input id="stTIn" placeholder="用' + L().name + '回 TA（不会就用中文问）" ><button class="pri" id="stTSend">发送</button></div>';
        onBack(goLearn); drawChat(arr);
        $('stTClr').onclick = async () => { if (!(await uiConfirm('清空和 ' + taName() + ' 的' + L().name + '练习记录吗？'))) return; D.talk[talkKey()] = []; save(); renderMain(); };
        $('stTS').onclick = (e) => { const b = e.target.closest('button'); if (!b) return; D.scene = b.dataset.s; save(); $('stTS').querySelectorAll('button').forEach(z => z.classList.toggle('on', z === b)); };
        const send = () => { const v = $('stTIn').value.trim(); if (!v) return; $('stTIn').value = ''; talkTurn(v); };
        $('stTSend').onclick = send; $('stTIn').onkeydown = (e) => { if (e.key === 'Enter') send(); };
        $('stMic').onclick = () => shadow('', L().tts, (r) => { $('stTIn').value = r.heard; }) ;
        $('stTQ').onclick = (e) => { const b = e.target.closest('button'); if (!b) return; const q = b.dataset.q; talkTurn(q === 'slow' ? '（请说慢一点、简单一点，再说一遍）' : q === 'hint' ? '（我不知道怎么回答，请给我 2-3 个可以直接用的回答示范，并解释一下）' : '（请你先用' + L().name + '开个话题吧）', true); };
    }
    function drawChat(arr) {
        const box = $('stChat'); if (!box) return;
        box.innerHTML = arr.length ? arr.map((x, i) => x.r === 'me' ? '<div class="st-msg me"><p>' + esc(x.t) + '</p></div>' : '<div class="st-msg ta"><span class="avatar-small">' + (ta() ? charAvatarInner(ta()) : '') + '</span><div class="bb"><div class="tx">' + esc(x.t) + ' <button data-i="' + i + '" data-a="say">♪</button></div>' + (D.cfg.showR && x.rd ? '<div class="st-r">' + esc(x.rd) + '</div>' : '') + (D.cfg.showM && x.m ? '<div class="st-m2">' + esc(x.m) + '</div>' : '') + (x.fix ? '<div class="st-fix">' + esc(x.fix) + '</div>' : '') + (x.tip ? '<div class="st-tipl">小知识：' + esc(x.tip) + '</div>' : '') + '</div></div>').join('') : '<div class="xa-empty">选一个场景，说点什么，或者点「你先开个头」。<br>TA 会用' + L().name + '回你，附上读音和中文，并温柔地帮你纠错。</div>';
        box.onclick = (e) => { const b = e.target.closest('[data-a="say"]'); if (b) speak(arr[+b.dataset.i].t, L().tts); };
        box.scrollTop = box.scrollHeight;
    }
    async function talkTurn(text, ghost) {
        if (needApi() || busy) return; const key = talkKey(), arr = D.talk[key] = D.talk[key] || []; busy = true;
        if (!ghost) arr.push({ r: 'me', t: text, ts: Date.now() }); drawChat(arr); $('stChat').insertAdjacentHTML('beforeend', '<div class="st-note" id="stTyping">' + esc(taName()) + ' 正在输入…</div>'); $('stChat').scrollTop = 1e9;
        try {
            const c = ta(), me = myGenderInfo();
            const sys = personaSystem(c) + '\n\n【现在的任务：陪我练习' + L().name + '】\n我是中文母语者，' + L().name + '水平：' + lvOf() + '。场景：' + (D.scene || '自由聊天') + '。你要保持你自己的人设和说话风格，但是用' + L().name + '和我对话（句子简短，词汇和语法控制在我的水平内，一次说一两句，多抛问题让我回答）。如果我这句' + L().name + '有错误，在 fix 里用你的口吻（中文）温柔指出并给出正确说法；没有错误就留空；我夸张地用中文问问题时，你用中文简单回答并把' + L().name + '版本放进 t。\n只输出JSON：{"t":"你说的' + L().name + '（原文）","rd":"读音（' + needReadFmt() + '）","m":"中文意思","fix":"纠错（可空）","tip":"一个相关的小知识（可空，不要每次都有）"}。不要输出其他文字，不要emoji。' + (me.p === '她' ? '（别忘了：我是女生，提到我用“她”。）' : me.p === '他' ? '（别忘了：我是男生，提到我用“他”。）' : '');
            const hist = arr.slice(-12).map(x => x.r === 'me' ? { role: 'user', content: x.t } : { role: 'assistant', content: JSON.stringify({ t: x.t, rd: x.rd || '', m: x.m || '' }) });
            if (ghost) hist.push({ role: 'user', content: text }); if (!hist.length || hist[hist.length - 1].role !== 'user') hist.push({ role: 'user', content: '（请开始）' });
            const raw = await chatCompletion([{ role: 'system', content: sys }].concat(hist), 0.9); const j = parseJSONLoose(raw);
            const rep = j && j.t ? { r: 'ta', t: String(j.t), rd: String(j.rd || ''), m: String(j.m || ''), fix: String(j.fix || ''), tip: String(j.tip || ''), ts: Date.now() } : { r: 'ta', t: oneLine(raw), ts: Date.now() };
            arr.push(rep); D.talk[key] = arr.slice(-60); save(); logAdd('words', 0); speak(rep.t, L().tts);
        } catch (er) { uiAlert('TA 没回上：' + er.message); }
        busy = false; if ($('stChat')) drawChat(D.talk[key] || []);
    }

    // ---------- 一起专注 ----------
    function subFocus(m) {
        m.innerHTML = backBar('一起专注') + '<div class="st-focus"><div class="st-clock" id="stClk">' + fmtT(FT.on ? FT.left : (D.focusMin || 25) * 60) + '</div><div class="st-note" id="stFSub">' + (FT.on ? (FT.paused ? '已暂停' : taName() + ' 在旁边陪着你') : '选个时长，开始后 TA 会时不时给你打气') + '</div>' + (FT.on ? '' : '<div class="xa-chips" id="stFD">' + [15, 25, 45, 60].map(n => '<button data-n="' + n + '" class="' + (n === (D.focusMin || 25) ? 'on' : '') + '">' + n + ' 分钟</button>').join('') + '</div>') + '<div class="xa-btns">' + (FT.on ? '<button id="stFP">' + (FT.paused ? '继续' : '暂停') + '</button><button class="dan" id="stFS">结束</button>' : '<button class="pri" id="stFGo">开始专注</button>') + '</div><div id="stFTa"></div><p class="st-note">提示：计时只在页面开着时有效。</p></div>';
        onBack(goLearn);
        if ($('stFD')) $('stFD').onclick = (e) => { const b = e.target.closest('button'); if (!b) return; D.focusMin = +b.dataset.n; save(); renderMain(); };
        if ($('stFGo')) $('stFGo').onclick = startFocus; if ($('stFP')) $('stFP').onclick = () => { FT.paused = !FT.paused; renderMain(); };
        if ($('stFS')) $('stFS').onclick = async () => { if (await uiConfirm('现在结束吗？已经专注的时间会记下来。')) endFocus(false); };
    }
    async function startFocus() {
        FT.on = true; FT.paused = false; FT.total = (D.focusMin || 25) * 60; FT.left = FT.total; FT.ping = Date.now() + (6 + Math.random() * 4) * 60e3; FT.done = 0; renderMain(); renderComp();
        clearInterval(FT.iv); FT.iv = setInterval(() => { if (FT.paused) return; FT.left--; FT.done++; const c = $('stClk'); if (c) c.textContent = fmtT(FT.left); if (FT.left <= 0) { endFocus(true); return; } if ($('stCompCard') && FT.left % 5 === 0) renderComp(); if (Date.now() >= FT.ping && FT.left > 60) { FT.ping = Date.now() + (7 + Math.random() * 5) * 60e3; pingFocus(); } }, 1000);
        const r = await taSay('我要开始专注学习 ' + (FT.total / 60) + ' 分钟了，请你说一句开场的话，陪伴并鼓励我（可以俏皮点）。', pick(FALL.cheer)); const el = $('stFTa'); if (el) el.innerHTML = bubble(r.text); setTaLine(r.text);
    }
    async function pingFocus() { const r = await taSay('我正在专注学习，已经过去一会儿了，剩下 ' + Math.round(FT.left / 60) + ' 分钟。请你悄悄说一句简短的打气或关心（比如提醒我喝水、坐直、别分心）。', pick(FALL.cheer)); uiAlert(taName() + '：' + r.text, 4200); setTaLine(r.text); const el = $('stFTa'); if (el) el.innerHTML = bubble(r.text); }
    async function endFocus(finished) {
        clearInterval(FT.iv); const mins = Math.round((FT.done || 0) / 60 * 10) / 10; FT.on = false; if (mins > 0) { const o = D.log[today()] = D.log[today()] || { min: 0, words: 0, quiz: 0, ok: 0, read: 0 }; o.min += mins; save(); }
        renderMain(); renderComp();
        const r = await taSay(finished ? '我完整地专注学习了 ' + Math.round(mins) + ' 分钟！请你夸夸我，说点暖心的话（可以说要给我什么小奖励）。' : '我专注学了 ' + Math.round(mins) + ' 分钟就先停下来了，请你简短地回应我（不要责备）。', finished ? pick(FALL.praise) : '辛苦啦，休息一下也很好。'); setTaLine(r.text); uiAlert(taName() + '：' + r.text, 4200); const el = $('stFTa'); if (el) el.innerHTML = bubble(r.text);
    }

    // ---------- 阅读 ----------
    const PER = 5;
    function paras(text) {
        const out = []; String(text).replace(/\r/g, '').split(/\n+/).map(s => s.trim()).filter(Boolean).forEach(p => {
            if (p.length <= 420) { out.push(p); return; } let cur = ''; (p.match(/[^。！？!?\.]+[。！？!?\.”」』）)]*/g) || [p]).forEach(s => { if ((cur + s).length > 360 && cur) { out.push(cur); cur = s; } else cur += s; }); if (cur) out.push(cur);
        }); return out;
    }
    function viewRead(m) {
        if (book) return viewBook(m);
        m.innerHTML = '<div class="xa-btns" style="margin-top:0"><button class="pri" id="rdAdd">＋ 加一本 / 一篇</button></div>' + (BK.length ? BK.slice().sort((a, b) => (b.upd || 0) - (a.upd || 0)).map(b => { const n = paras(b.text).length, pg = Math.max(1, Math.ceil(n / PER)); return '<div class="ff-lib" data-id="' + b.id + '"><div class="l"><b>《' + esc(b.title) + '》' + (b.done ? '<i class="ff-fav">读完</i>' : '') + '</b><span>' + n + ' 段 · 读到第 ' + ((b.page || 0) + 1) + ' / ' + pg + ' 页 · ' + (b.cm || []).length + ' 条 TA 的感想</span></div><button class="hdr-btn" data-del="' + b.id + '">删除</button></div>'; }).join('') : '<div class="xa-empty">书架空空的<br>可以粘贴一段文字、导入 txt，或者让 TA 给你写一篇～<br>阅读外语文章时，点段落还能让 AI 帮你翻译讲解。</div>');
        $('rdAdd').onclick = addBook;
        m.onclick = async (e) => {
            const d = e.target.closest('[data-del]'); if (d) { if (!(await uiConfirm('删除这本书和里面的笔记吗？'))) return; BK = BK.filter(x => x.id !== d.dataset.del); saveBooks(); renderMain(); return; }
            const r = e.target.closest('.ff-lib'); if (!r) return; book = BK.find(x => x.id === r.dataset.id); renderMain();
        };
    }
    function addBook() {
        const m = sheet('<h3>添加阅读内容</h3><div class="cd-seg" id="abT"><button data-t="paste" class="on">粘贴文字</button><button data-t="file">导入文件</button><button data-t="ta">让 TA 写</button></div><div id="abBody"></div>');
        const body = m.querySelector('#abBody'); let t = 'paste';
        const draw = () => {
            m.querySelectorAll('#abT button').forEach(b => b.classList.toggle('on', b.dataset.t === t));
            if (t === 'paste') body.innerHTML = '<div class="xa-row"><input id="abTitle" style="text-align:left;max-width:100%;width:100%" placeholder="标题（可空）"></div><textarea id="abText" class="st-ta-in" placeholder="把想一起读的文字粘贴在这里（小说片段、外语文章、歌词、文章…）"></textarea><div class="xa-btns"><button id="abCancel">取消</button><button class="pri" id="abOk">开始读</button></div>';
            else if (t === 'file') body.innerHTML = '<p class="st-note">支持 txt / md 文本文件（epub、pdf 暂不支持，可以复制文字粘贴）。</p><div class="xa-btns"><button class="pri" id="abPick">选择文件</button></div><input type="file" id="abFile" accept=".txt,.md,.text,text/plain" style="display:none">';
            else body.innerHTML = '<div class="xa-chips" id="abLang"><button data-l="中文" class="on">中文</button><button data-l="日语">日语</button><button data-l="韩语">韩语</button><button data-l="英语">英语</button></div><div class="xa-chips" id="abKind">' + ['短篇小故事', '温柔的散文', '给我写的小情书', '童话', '日常对话', '冷知识小短文'].map((k, i) => '<button data-k="' + k + '" class="' + (i === 0 ? 'on' : '') + '">' + k + '</button>').join('') + '</div><div class="xa-row"><input id="abTopic" style="text-align:left;max-width:100%;width:100%" placeholder="想读什么内容？（可空，例如：下雨天的咖啡店）"></div><div class="xa-chips" id="abLen"><button data-n="300">短 300 字</button><button data-n="600" class="on">中 600 字</button><button data-n="1000">长 1000 字</button></div><p class="st-note">外语文章会按你在「学习」里选的水平来写（' + L().name + ' · ' + lvOf() + '）。</p><div class="xa-btns"><button id="abCancel">取消</button><button class="pri" id="abOk">请 TA 写</button></div>';
            const c = body.querySelector('#abCancel'); if (c) c.onclick = () => m.remove();
            if (t === 'paste') body.querySelector('#abOk').onclick = () => { const x = body.querySelector('#abText').value.trim(); if (x.length < 10) { uiAlert('多贴一点文字吧'); return; } createBook(body.querySelector('#abTitle').value.trim() || x.slice(0, 14).replace(/\n/g, ' '), x); m.remove(); };
            if (t === 'file') { body.querySelector('#abPick').onclick = () => body.querySelector('#abFile').click(); body.querySelector('#abFile').onchange = async function () { const f = this.files && this.files[0]; if (!f) return; const buf = await f.arrayBuffer(); let s; try { s = new TextDecoder('utf-8', { fatal: true }).decode(buf); } catch (e) { try { s = new TextDecoder('gbk').decode(buf); } catch (e2) { s = new TextDecoder().decode(buf); } } s = s.replace(/^﻿/, '').trim(); if (s.length < 10) { uiAlert('文件里没有读到文字'); return; } createBook(f.name.replace(/\.[^.]+$/, ''), s.slice(0, 200000)); m.remove(); }; }
            if (t === 'ta') {
                const o = { l: '中文', k: '短篇小故事', n: 600 };
                [['abLang', 'l', 'l'], ['abKind', 'k', 'k'], ['abLen', 'n', 'n']].forEach(p => body.querySelector('#' + p[0]).onclick = (e) => { const b = e.target.closest('button'); if (!b) return; o[p[1]] = p[1] === 'n' ? +b.dataset.n : b.dataset[p[2]]; body.querySelectorAll('#' + p[0] + ' button').forEach(z => z.classList.toggle('on', z === b)); });
                body.querySelector('#abOk').onclick = async () => {
                    if (needApi() || busy) return; busy = true; const ok = body.querySelector('#abOk'); ok.textContent = 'TA 在写…';
                    try {
                        const c = ta(), me = myGenderInfo(), mn = store.getItem('myName') || '我', cg = c ? charGenderInfo(c) : { p: 'TA' };
                        const sys = '你是一位文笔细腻的作者。' + (c ? '请带着「' + c.name + '」的气质与口吻来写（' + (cg.p !== 'TA' ? c.name + '是' + (cg.p === '她' ? '女生' : '男生') + '，' : '') + '这篇文章是' + c.name + '想送给读者「' + mn + '」的' + (me.p !== 'TA' ? '，' + mn + '是' + (me.p === '她' ? '女生，第三人称只能用“她”' : '男生，第三人称只能用“他”') : '') + '）。' : '') + '只输出：第一行《标题》，空一行后是正文。不要解释。';
                        const u = '语言：' + o.l + (o.l !== '中文' ? '（词汇和语法控制在' + lvOf() + '水平，句子不要太长）' : '') + '；体裁：' + o.k + '；约 ' + o.n + ' 字；' + ($('abTopic') || body.querySelector('#abTopic')).value.trim().replace(/^/, '内容主题：').replace(/^内容主题：$/, '内容主题：自由发挥');
                        const raw = String(await ask(sys, u, 1.0)).trim(), mm = /^\s*[《「#]*\s*([^\n》」]{1,30})[》」]?\s*\n+([\s\S]+)$/.exec(raw);
                        createBook(mm ? mm[1].replace(/^#+\s*/, '').trim() : '无题', mm ? mm[2].trim() : raw, (c ? c.name + ' 写的' : '')); m.remove();
                    } catch (er) { uiAlert('没写成：' + er.message); ok.textContent = '请 TA 写'; }
                    busy = false;
                };
            }
        };
        m.querySelector('#abT').onclick = (e) => { const b = e.target.closest('button'); if (!b) return; t = b.dataset.t; draw(); }; draw();
    }
    function createBook(title, text, by) {
        const b = { id: uid(), title: String(title).slice(0, 40) || '无题', text: text, page: 0, hl: {}, notes: [], cm: [], seen: {}, ts: Date.now(), upd: Date.now(), done: false, fs: 16, by: by || '' };
        BK.unshift(b); saveBooks(); book = b; renderMain();
    }
    function viewBook(m) {
        const ps = paras(book.text), pages = Math.max(1, Math.ceil(ps.length / PER)); book.page = Math.max(0, Math.min(pages - 1, book.page || 0));
        const from = book.page * PER, slice = ps.slice(from, from + PER), lg = spkLang(book.text);
        let h = '<div class="st-back"><button id="rdBack">‹ 书架</button><b>' + esc(book.title) + '</b><span>' + (book.page + 1) + ' / ' + pages + '</span></div>'
            + '<div class="rd-tools"><button id="rdA1">A−</button><button id="rdA2">A+</button><button id="rdCo" class="' + (D.cfg.coRead ? 'on' : '') + '">TA 共读 ' + (D.cfg.coRead ? '开' : '关') + '</button><button id="rdSay">朗读本页</button><button id="rdLook">查选中的词</button><button id="rdNotes">笔记</button></div>'
            + (book.by ? '<div class="st-note" style="margin:0 0 6px">' + esc(book.by) + '</div>' : '') + '<div class="rd-page" style="font-size:' + (book.fs || 16) + 'px">'
            + slice.map((p, k) => { const i = from + k, cms = (book.cm || []).filter(c => c.p === i), nts = (book.notes || []).filter(n => n.p === i); return '<p class="rd-p' + (book.hl[i] ? ' hl' : '') + '" data-p="' + i + '">' + esc(p) + '</p>' + nts.map(n => '<div class="rd-note">✎ ' + esc(n.t) + '</div>').join('') + cms.map(c => '<div class="rd-cm">' + bubble(c.t).replace('class="st-ta"', 'class="st-ta sm"') + (c.q ? '' : '') + '</div>').join(''); }).join('')
            + '<div id="rdTyping"></div></div><div class="rd-nav"><button id="rdPrev"' + (book.page <= 0 ? ' disabled' : '') + '>上一页</button><div class="rd-bar"><i style="width:' + Math.round((book.page + 1) / pages * 100) + '%"></i></div><button class="pri" id="rdNext">' + (book.page >= pages - 1 ? '读完啦' : '下一页') + '</button></div>';
        m.innerHTML = h;
        $('rdBack').onclick = () => { book = null; renderMain(); };
        $('rdA1').onclick = () => { book.fs = Math.max(12, (book.fs || 16) - 1); saveBooks(); viewBook(m); }; $('rdA2').onclick = () => { book.fs = Math.min(26, (book.fs || 16) + 1); saveBooks(); viewBook(m); };
        $('rdCo').onclick = () => { D.cfg.coRead = !D.cfg.coRead; save(); viewBook(m); };
        $('rdSay').onclick = () => speak(slice.join(' '), lg, 0.95);
        $('rdLook').onclick = () => { const s = (window.getSelection && String(window.getSelection())).trim(); if (s) lookup(s, slice.join(' ')); else uiPrompt('想查哪个词 / 句子？', '').then(v => { if (v && v.trim()) lookup(v.trim(), slice.join(' ')); }); };
        $('rdNotes').onclick = showNotes;
        $('rdPrev').onclick = () => { book.page--; book.upd = Date.now(); saveBooks(); viewBook(m); $('stBody').scrollTop = 0; };
        $('rdNext').onclick = () => { if (book.page >= pages - 1) { finishBook(); return; } book.page++; book.upd = Date.now(); saveBooks(); logAdd('read', 1); viewBook(m); $('stBody').scrollTop = 0; coRead(m); };
        m.querySelectorAll('.rd-p').forEach(p => p.onclick = (e) => { if (window.getSelection && String(window.getSelection()).trim()) return; paraMenu(+p.dataset.p, ps); });
        if (!book.seen[book.page] && D.cfg.coRead && API_KEY && ta()) coRead(m);
        book.seen[book.page] = 1;
    }
    async function coRead(m) {
        if (!D.cfg.coRead || !API_KEY || !ta() || busy) return; const b = book, pg = b.page; if (b.seen[pg] === 2) return; if (Math.random() < 0.25) return; busy = true; b.seen[pg] = 2;
        const ps = paras(b.text), from = pg * PER, txt = ps.slice(from, from + PER).join('\n').slice(0, 900), prev = (b.cm || []).slice(-3).map(c => c.t).join(' / ');
        const ty = $('rdTyping'); if (ty) ty.innerHTML = '<div class="st-note">' + esc(taName()) + ' 在看这一页…</div>';
        try {
            const r = await taSay('我们正在一起读《' + b.title + '》。这一页的内容：\n"""\n' + txt + '\n"""\n请你像坐在我身边一起读书的人，针对这一页说一句自然的感想，或者问我一个问题（40字内，口语）。不要总结全文，不要重复你之前说过的：' + (prev || '无'), '');
            if (r.text) { b.cm = (b.cm || []).concat({ p: from, t: r.text, ts: Date.now() }).slice(-80); saveBooks(); }
        } catch (e) { }
        busy = false; if (book === b && b.page === pg && tab === 'read') viewBook($('stMain'));
    }
    function paraMenu(i, ps) {
        const m = sheet('<h3>这一段</h3><p class="st-quote">' + esc(ps[i].slice(0, 160)) + (ps[i].length > 160 ? '…' : '') + '</p><div class="xa-btns" style="flex-direction:column"><button data-a="say">♪ 朗读这一段</button><button data-a="hl">' + (book.hl[i] ? '取消划线' : '✎ 划线') + '</button><button data-a="note">✎ 写下我的想法</button><button data-a="ta">… 问问 TA 怎么看</button><button data-a="exp">⌕ 翻译 / 讲解（AI）</button><button data-a="copy">复制</button></div>');
        m.querySelector('.xa-btns').onclick = async (e) => {
            const b = e.target.closest('button'); if (!b) return; const a = b.dataset.a;
            if (a === 'say') { speak(ps[i], spkLang(ps[i]), 0.95); return; }
            if (a === 'copy') { copyText(ps[i]); uiAlert('已复制', 1000); return; }
            m.remove();
            if (a === 'hl') { if (book.hl[i]) delete book.hl[i]; else book.hl[i] = 1; saveBooks(); viewBook($('stMain')); }
            else if (a === 'note') { const v = await uiPrompt('写下你的想法：', '', { multiline: true }); if (!v || !v.trim()) return; book.notes.push({ p: i, t: v.trim().slice(0, 400), ts: Date.now() }); saveBooks(); viewBook($('stMain')); const r = await taSay('我们在一起读《' + book.title + '》，我在这一段旁边写了想法：「' + v.trim().slice(0, 200) + '」。这一段是：「' + ps[i].slice(0, 200) + '」。请回应我的想法（口语，40字内）。', ''); if (r.text) { book.cm.push({ p: i, t: r.text, ts: Date.now() }); saveBooks(); if (book) viewBook($('stMain')); } }
            else if (a === 'ta') {
                if (needApi() || busy) return; const q = await uiPrompt('想问 TA 什么？', '你怎么看这一段？'); if (q === null) return; busy = true; const ty = $('rdTyping'); if (ty) ty.innerHTML = '<div class="st-note">' + esc(taName()) + ' 在想…</div>';
                const r = await taSay('我们在一起读《' + book.title + '》。这一段是：「' + ps[i].slice(0, 400) + '」。我问你：' + (q || '你怎么看这一段？') + '（用你自己的语气认真回答，80字内）', '这一段我想再看一遍，等我一下。'); busy = false; book.cm.push({ p: i, t: r.text, ts: Date.now() }); saveBooks(); viewBook($('stMain'));
            } else if (a === 'exp') explain(ps[i]);
        };
    }
    async function explain(txt) {
        if (needApi() || busy) return; busy = true; const m = sheet('<h3>翻译 / 讲解</h3><div class="st-note" id="exOut">AI 老师在看…</div>', 'tall');
        try {
            const lg = spkLang(txt), foreign = lg !== 'zh-CN';
            const sys = '你是耐心的语言老师，学生是中文母语者。只输出JSON。';
            const u = foreign ? '请讲解这段文字：\n"""' + txt.slice(0, 700) + '"""\n输出：{"tr":"通顺的中文翻译","words":[{"w":"原文词","r":"读音","m":"中文"}],"grammar":["语法/句型点（含中文解释）"],"note":"一句话的阅读提示"}，words 给 4-6 个重点词，grammar 给 1-3 条。' : '请用简短的话讲解这段文字（不超过120字），输出：{"tr":"","words":[],"grammar":[],"note":"讲解内容"}。文字：\n"""' + txt.slice(0, 700) + '"""';
            const j = parseJSONLoose(await ask(sys, u, 0.5)); if (!j) throw new Error('格式不对，再试一次');
            $('exOut').className = ''; $('exOut').innerHTML = (j.tr ? '<div class="st-tab"><b>翻译</b><div>' + esc(j.tr) + '</div></div>' : '') + ((j.words || []).length ? '<div class="xa-title">重点词（点＋加入单词本）</div>' + j.words.map((w, i) => '<div class="st-ph"><div class="top"><div><b class="st-w">' + esc(w.w) + '</b><span class="st-r">' + esc(w.r || '') + '</span></div><div class="st-btns"><button data-s="' + esc(w.w) + '">♪</button><button data-i="' + i + '">＋</button></div></div><div class="st-m">' + esc(w.m) + '</div></div>').join('') : '') + ((j.grammar || []).length ? '<div class="xa-title">语法</div>' + j.grammar.map(g => '<div class="st-n">• ' + esc(g) + '</div>').join('') : '') + (j.note ? '<div class="st-tip"><p>' + esc(j.note) + '</p></div>' : '');
            m.querySelectorAll('[data-s]').forEach(b => b.onclick = () => speak(b.dataset.s, lg));
            m.querySelectorAll('[data-i]').forEach(b => b.onclick = () => { const w = j.words[+b.dataset.i]; if (addVocab({ w: w.w, r: w.r, m: w.m, lang: Object.keys(LANGS).find(k => LANGS[k].tts === lg) || D.lang })) { b.textContent = '✓'; logAdd('words', 1); } else uiAlert('已经在单词本里啦', 1200); });
        } catch (er) { const o = $('exOut'); if (o) o.textContent = '没成功：' + er.message; }
        busy = false;
    }
    async function lookup(w, ctx) {
        if (needApi() || busy) return; busy = true; const m = sheet('<h3>查词：' + esc(w.slice(0, 30)) + '</h3><div class="st-note" id="lkOut">查询中…</div>', 'tall');
        try {
            const lg = spkLang(w + ctx); const j = parseJSONLoose(await ask('你是词典式的语言老师，学生是中文母语者。只输出JSON。', '请解释「' + w.slice(0, 60) + '」（出自这段话：' + ctx.slice(0, 200) + '）。输出：{"w":"原文","r":"读音/音标","m":"在这里的意思","pos":"词性","use":"用法与例句（含中文）"}', 0.4)); if (!j) throw new Error('格式不对');
            $('lkOut').className = ''; $('lkOut').innerHTML = '<div class="st-ph"><div class="top"><div><b class="st-w">' + esc(j.w || w) + '</b><span class="st-r">' + esc(j.r || '') + '</span></div><div class="st-btns"><button id="lkSay">♪</button><button id="lkAdd">＋</button></div></div><div class="st-m">' + esc(j.m || '') + (j.pos ? ' <em>' + esc(j.pos) + '</em>' : '') + '</div><div class="st-n">' + esc(j.use || '') + '</div></div>';
            $('lkSay').onclick = () => speak(j.w || w, lg); $('lkAdd').onclick = () => { const lang = Object.keys(LANGS).find(k => LANGS[k].tts === lg) || D.lang; if (addVocab({ w: j.w || w, r: j.r, m: j.m, pos: j.pos, use: j.use, lang: lang })) { $('lkAdd').textContent = '✓'; logAdd('words', 1); } else uiAlert('已经在单词本里啦', 1200); };
        } catch (er) { const o = $('lkOut'); if (o) o.textContent = '没成功：' + er.message; }
        busy = false;
    }
    function showNotes() {
        const ps = paras(book.text), all = (book.notes || []).map(n => ({ k: 'n', p: n.p, t: n.t, ts: n.ts })).concat(Object.keys(book.hl).map(p => ({ k: 'h', p: +p, t: ps[+p] || '', ts: 0 }))).sort((a, b) => a.p - b.p);
        const m = sheet('<h3>读书笔记</h3>' + (all.length ? all.map(x => '<div class="st-n" data-p="' + x.p + '">' + (x.k === 'h' ? '✎ ' : '✎ ') + esc(String(x.t).slice(0, 120)) + '<small class="st-r"> · 第 ' + (Math.floor(x.p / PER) + 1) + ' 页</small></div>').join('') : '<div class="xa-empty">还没有笔记<br>点段落可以划线或写想法</div>') + '<div class="xa-btns"><button class="pri" id="ntOk">关闭</button></div>', 'tall');
        m.querySelector('#ntOk').onclick = () => m.remove(); m.querySelectorAll('[data-p]').forEach(el => el.onclick = () => { book.page = Math.floor(+el.dataset.p / PER); saveBooks(); m.remove(); viewBook($('stMain')); });
    }
    async function finishBook() {
        book.done = true; book.upd = Date.now(); saveBooks(); logAdd('read', 2);
        const m = sheet('<h3>读完啦 ✧</h3><p class="st-note">写下你的读后感吧，TA 想听～（可以不写）</p><textarea id="fbT" class="st-ta-in" placeholder="这本书给你的感觉…"></textarea><div id="fbOut"></div><div class="xa-btns"><button id="fbSkip">先不写</button><button class="pri" id="fbOk">说给 TA 听</button></div>');
        m.querySelector('#fbSkip').onclick = () => { m.remove(); book = null; renderMain(); };
        m.querySelector('#fbOk').onclick = async () => {
            if (busy) return; const v = m.querySelector('#fbT').value.trim(); busy = true; m.querySelector('#fbOut').innerHTML = '<p class="st-note">TA 在回应…</p>';
            const r = await taSay('我们一起读完了《' + book.title + '》。' + (v ? '我的读后感是：「' + v.slice(0, 300) + '」。请回应我的想法，并问我一个有趣的问题。' : '请你说说你的读后感，并问问我的感受。'), '和你一起读完真好，下次再挑一本吧。'); busy = false;
            book.review = { me: v, ta: r.text, ts: Date.now() }; saveBooks(); m.querySelector('#fbOut').innerHTML = bubble(r.text); m.querySelector('#fbOk').textContent = '好的'; m.querySelector('#fbOk').onclick = () => { m.remove(); book = null; renderMain(); }; setTaLine(r.text);
        };
    }

    // ---------- 单词本 ----------
    let vf = 'all', vq = '';
    function viewVocab(m) {
        const all = D.vocab.filter(v => v.lang === D.lang);
        let list = all.filter(v => (vf === 'star' ? v.star : vf === 'bad' ? v.bad > 0 : vf === 'new' ? !v.ok : true) && (!vq || (v.w + v.r + v.m).toLowerCase().indexOf(vq.toLowerCase()) >= 0));
        const mastered = all.filter(v => (v.ok || 0) >= 3).length;
        m.innerHTML = '<div class="xa-chips" id="vLang">' + Object.keys(LANGS).map(k => '<button data-k="' + k + '" class="' + (k === D.lang ? 'on' : '') + '">' + LANGS[k].flag + ' ' + LANGS[k].name + '</button>').join('') + '</div><div class="st-stat"><span>共 <b>' + all.length + '</b> 个</span><span>已掌握 <b>' + mastered + '</b></span><span>错题 <b>' + all.filter(v => v.bad > 0).length + '</b></span></div><div class="st-inp" style="margin-bottom:8px"><input id="vQ" placeholder="搜索单词 / 读音 / 意思" value="' + esc(vq) + '"><button id="vAdd" class="pri">＋ 添加</button></div><div class="xa-chips" id="vF">' + [['all', '全部'], ['star', '★ 收藏'], ['bad', '错题'], ['new', '没答对过']].map(f => '<button data-f="' + f[0] + '" class="' + (f[0] === vf ? 'on' : '') + '">' + f[1] + '</button>').join('') + '</div>'
            + (list.length ? list.map(v => '<div class="st-ph" data-id="' + v.id + '"><div class="top"><div><b class="st-w">' + esc(v.w) + '</b><span class="st-r">' + esc(v.r) + '</span></div><div class="st-btns"><button data-a="say">♪</button><button data-a="star">' + (v.star ? '★' : '☆') + '</button><button data-a="del">×</button></div></div><div class="st-m">' + esc(v.m) + (v.pos ? ' <em>' + esc(v.pos) + '</em>' : '') + '</div>' + (v.use ? '<div class="st-n">' + esc(v.use) + '</div>' : '') + (v.ex ? '<div class="st-ex"><div>' + esc(v.ex) + '</div>' + (v.exm ? '<div>' + esc(v.exm) + '</div>' : '') + '</div>' : '') + '<div class="st-r">答对 ' + (v.ok || 0) + ' 次 · 答错 ' + (v.bad || 0) + ' 次</div></div>').join('') : '<div class="xa-empty">' + (all.length ? '没有符合条件的词' : '单词本还是空的<br>在「单词卡」「日常短语」里点 ＋ 就会收进来<br>阅读时选中的生词也可以加进来') + '</div>')
            + (all.length >= 4 ? '<div class="xa-btns"><button class="pri" id="vQz">用单词本来一次测验</button></div>' : '');
        $('vLang').onclick = (e) => { const b = e.target.closest('button'); if (!b) return; D.lang = b.dataset.k; save(); renderMain(); };
        $('vF').onclick = (e) => { const b = e.target.closest('button'); if (!b) return; vf = b.dataset.f; renderMain(); };
        $('vQ').oninput = (e) => { vq = e.target.value; const pos = e.target.selectionStart; renderMain(); const q = $('vQ'); if (q) { q.focus(); try { q.setSelectionRange(pos, pos); } catch (er) { } } };
        $('vAdd').onclick = addWord; if ($('vQz')) $('vQz').onclick = () => { startQuiz(quizPool('mine'), { n: 10, type: 'mix', title: '单词本测验' }); };
        m.querySelectorAll('.st-ph').forEach(row => row.onclick = async (e) => {
            const b = e.target.closest('button'); if (!b) return; const v = D.vocab.find(x => x.id === row.dataset.id); if (!v) return;
            if (b.dataset.a === 'say') speak(v.w, LANGS[v.lang].tts); else if (b.dataset.a === 'star') { v.star = !v.star; save(); renderMain(); } else if (b.dataset.a === 'del') { if (!(await uiConfirm('从单词本删除「' + v.w + '」？'))) return; D.vocab = D.vocab.filter(x => x !== v); save(); renderMain(); }
        });
    }
    function addWord() {
        const m = sheet('<h3>添加单词</h3><div class="xa-row"><input id="awW" style="text-align:left;max-width:100%;width:100%;font-size:16px" placeholder="单词 / 短语（' + L().name + '）"></div><div class="xa-row"><input id="awR" style="text-align:left;max-width:100%;width:100%" placeholder="读音（可空）"></div><div class="xa-row"><input id="awM" style="text-align:left;max-width:100%;width:100%" placeholder="中文意思"></div><div class="xa-btns"><button id="awAi">让 AI 补全读音 / 意思</button></div><div class="xa-btns"><button id="awC">取消</button><button class="pri" id="awOk">保存</button></div>');
        m.querySelector('#awC').onclick = () => m.remove();
        m.querySelector('#awAi').onclick = async () => { const w = m.querySelector('#awW').value.trim(); if (!w) { uiAlert('先写单词'); return; } if (needApi() || busy) return; busy = true; try { const j = parseJSONLoose(await ask('你是' + L().name + '老师。只输出JSON。', '请补全「' + w + '」：{"r":"读音（' + needReadFmt() + '）","m":"中文意思","pos":"词性","use":"简短用法","ex":"例句","exm":"例句中文"}', 0.3)); if (j) { m.querySelector('#awR').value = j.r || ''; m.querySelector('#awM').value = j.m || ''; m._x = j; } } catch (er) { uiAlert('没成功：' + er.message); } busy = false; };
        m.querySelector('#awOk').onclick = () => { const w = m.querySelector('#awW').value.trim(), mm = m.querySelector('#awM').value.trim(); if (!w || !mm) { uiAlert('单词和意思都要写哦'); return; } const x = m._x || {}; if (!addVocab({ w: w, r: m.querySelector('#awR').value.trim(), m: mm, pos: x.pos, use: x.use, ex: x.ex, exm: x.exm, lang: D.lang })) { uiAlert('已经有这个词啦'); return; } logAdd('words', 1); m.remove(); renderMain(); renderComp(); };
    }

    // ---------- 打卡 ----------
    function viewLog(m) {
        let tot = 0, tw = 0, tq = 0, tok = 0, days = 0; Object.keys(D.log).forEach(k => { const o = D.log[k]; tot += o.min || 0; tw += o.words || 0; tq += o.quiz || 0; tok += o.ok || 0; if ((o.min || 0) >= 1 || o.words || o.quiz || o.read) days++; });
        const cells = []; for (let i = 34; i >= 0; i--) { const d = addDays(today(), -i), o = D.log[d] || {}, v = (o.min || 0) + (o.words || 0) * 2 + (o.quiz || 0) + (o.read || 0) * 3, lv = v <= 0 ? 0 : v < 6 ? 1 : v < 15 ? 2 : v < 30 ? 3 : 4; cells.push('<i class="lv' + lv + (d === today() ? ' td' : '') + '" title="' + d + '：' + Math.round(o.min || 0) + ' 分钟"></i>'); }
        const goal = D.cfg.goal || 20, pct = Math.min(100, Math.round(todayMin() / goal * 100));
        m.innerHTML = '<div class="st-stat big"><span><b>' + streak() + '</b><small>连续天数</small></span><span><b>' + days + '</b><small>累计打卡天</small></span><span><b>' + Math.round(tot) + '</b><small>总分钟</small></span><span><b>' + D.vocab.length + '</b><small>单词本</small></span></div>'
            + '<div class="st-goal"><div class="st-goalh"><b>今日目标 ' + goal + ' 分钟</b><span>' + todayMin() + ' / ' + goal + '</span></div><div class="rd-bar"><i style="width:' + pct + '%"></i></div></div>'
            + '<div class="xa-title">最近 5 周</div><div class="st-heat">' + cells.join('') + '</div>'
            + '<div class="st-n">测验答题 ' + tq + ' 题，正确率 ' + (tq ? Math.round(tok / tq * 100) : 0) + '% · 学到的词 ' + tw + ' 个</div>'
            + '<div class="xa-btns"><button id="lgPraise">让 TA 看看我的成绩</button></div><div id="lgOut"></div><p class="st-note">学习时长会在「学习」页面打开且你在操作时自动累计；专注计时会按实际分钟记录。</p>';
        $('lgPraise').onclick = async () => { if (busy) return; busy = true; $('lgOut').innerHTML = '<p class="st-note">TA 在翻你的记录…</p>'; const r = await taSay('我的学习记录：连续学习 ' + streak() + ' 天，今天学了 ' + todayMin() + ' 分钟（目标 ' + goal + ' 分钟），单词本有 ' + D.vocab.length + ' 个词，测验正确率 ' + (tq ? Math.round(tok / tq * 100) : 0) + '%。请你根据这些点评我：做得好的地方夸夸，不足的地方温柔地督促一下。', pick(FALL.praise)); busy = false; $('lgOut').innerHTML = bubble(r.text); setTaLine(r.text); };
    }

    // ---------- 设置 ----------
    function settings() {
        const m = sheet('<h3>学习设置</h3><div class="xa-row"><span>显示读音</span><input type="checkbox" class="ios-switch" id="sR"' + (D.cfg.showR ? ' checked' : '') + '></div><div class="xa-row"><span>对话里显示中文翻译</span><input type="checkbox" class="ios-switch" id="sM"' + (D.cfg.showM ? ' checked' : '') + '></div><div class="xa-row"><span>TA 陪读时说感想</span><input type="checkbox" class="ios-switch" id="sC"' + (D.cfg.coRead ? ' checked' : '') + '></div><div class="xa-row"><span>每日目标（分钟）</span><input type="number" id="sG" min="5" max="300" value="' + (D.cfg.goal || 20) + '"></div><div class="xa-row"><span>朗读速度</span><select id="sS"><option value="0.6">很慢</option><option value="0.8">慢</option><option value="0.9">标准</option><option value="1">自然</option></select></div><div class="xa-row"><span>朗读的声音</span><select id="sV"><option value="auto">自动（有接入的声音就用）</option><option value="mine">我接入的声音（默认）</option><option value="ta">TA 的声音</option><option value="custom">学习专用声音 ID</option><option value="browser">浏览器自带</option></select></div><div class="xa-row" id="sVidRow"><span>声音 ID</span><input type="text" id="sVid" placeholder="ElevenLabs Voice ID / Fish 声音ID" style="flex:1;min-width:0"></div><div class="xa-btns"><button id="sVt">试听当前声音</button></div><p class="st-note" id="sVnote"></p><div class="xa-btns"><button class="dan" id="sClr">清空学习数据</button></div><div class="xa-btns"><button class="pri" id="sOk">完成</button></div>');
        m.querySelector('#sS').value = String(D.cfg.rate || 0.9); if (!m.querySelector('#sS').value) m.querySelector('#sS').value = '0.9';
        const sv = m.querySelector('#sV'), sid = m.querySelector('#sVid'), note = m.querySelector('#sVnote'); sv.value = D.cfg.voice || 'auto'; sid.value = D.cfg.voiceId || '';
        const refV = () => { m.querySelector('#sVidRow').style.display = sv.value === 'custom' ? '' : 'none'; const pv = window.ttsProvider ? window.ttsProvider() : 'off'; note.textContent = (pv === 'elevenlabs' || pv === 'fish') ? '当前接入：' + (pv === 'fish' ? 'Fish Audio' : 'ElevenLabs') + '。声音 Key / 默认声音 / 角色专属声音在「设置 → 语音」里填；失败会自动退回浏览器朗读。' : '还没接入自己的声音：去「设置 → 语音」选 ElevenLabs 或 Fish Audio 并填 Key 和声音 ID，这里就能用了。现在用的是手机 / 浏览器自带语音（听不到日语/韩语需要在系统里下载语音包）。'; };
        sv.onchange = refV; refV();
        m.querySelector('#sVt').onclick = () => { D.cfg.voice = sv.value; D.cfg.voiceId = sid.value.trim(); const lg = L().tts; speak(lg === 'ja-JP' ? 'こんにちは、一緒に勉強しましょう。' : lg === 'ko-KR' ? '안녕하세요, 같이 공부해요.' : 'Hello, let us study together.', lg); };
        m.querySelector('#sOk').onclick = () => { D.cfg.showR = m.querySelector('#sR').checked; D.cfg.showM = m.querySelector('#sM').checked; D.cfg.coRead = m.querySelector('#sC').checked; D.cfg.goal = Math.max(5, +m.querySelector('#sG').value || 20); D.cfg.rate = +m.querySelector('#sS').value || 0.9; D.cfg.voice = sv.value; D.cfg.voiceId = sid.value.trim(); save(); m.remove(); renderMain(); };
        m.querySelector('#sClr').onclick = async () => { if (!(await uiConfirm('清空所有学习数据（单词本、打卡、书架、对话）？不可恢复。'))) return; D = Object.assign({}, DEF, { cfg: Object.assign({}, DEF.cfg), vocab: [], log: {}, talk: {}, lv: {} }); BK = []; save(); saveBooks(); m.remove(); shell(); };
    }

    // ---------- 自动累计学习时间 ----------
    setInterval(() => { const el = $('studyApp'); if (!el || el.classList.contains('hidden') || document.hidden || FT.on) return; if (Date.now() - lastAct > 120000) return; const o = D.log[today()] = D.log[today()] || { min: 0, words: 0, quiz: 0, ok: 0, read: 0 }; o.min = (o.min || 0) + 0.5; if (Math.round(o.min * 2) % 4 === 0) save(); const c = $('stCompCard'); if (c && Math.round(o.min * 2) % 2 === 0) renderComp(); }, 30000);
    window.addEventListener('pagehide', () => { try { save(); } catch (e) { } });

    ensure();
    window.STUDY = { open: () => openApp('study') };
})();
