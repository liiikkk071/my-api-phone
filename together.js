/* 一起听 / 一起看（放在「MCP → 一起」里）
 * - 真的播放你选的音乐/电影（本地文件或直链），TA 实时知道播到哪、当前台词/歌词
 * - 陪伴者就是手机里的 TA（用你在设置里填的 AI 接口）
 * - 没有字幕/歌词时，TA 只知道标题和进度，不会假装看到了画面
 */
(function () {
    'use strict';
    const $ = (id) => document.getElementById(id);
    const esc = (s) => escapeHtml(String(s == null ? '' : s));
    const pad = (n) => String(n).padStart(2, '0');
    const fmt = (t) => { t = Math.max(0, Math.floor(t || 0)); const h = Math.floor(t / 3600), m = Math.floor(t % 3600 / 60), s = t % 60; return (h ? h + ':' + pad(m) : m) + ':' + pad(s); };
    const get = (k, d) => { const v = store.getItem(k); return v == null ? d : v; };

    const TG = { title: '', kind: '', cues: [], cueKind: '', built: false, busy: false, nextAt: 0, lastStatePost: 0, error: '', loadedAt: 0, objUrl: null };
    let video = null;

    // ───────── 字幕 / 歌词解析 ─────────
    function parseTime(s) {
        const m = /(?:(\d+):)?(\d+):(\d+)(?:[.,](\d+))?/.exec(s.trim()); if (!m) return null;
        return (+m[1] || 0) * 3600 + (+m[2]) * 60 + (+m[3]) + (m[4] ? +('0.' + m[4]) : 0);
    }
    function parseSubs(raw) {
        const txt = String(raw).replace(/^﻿/, '').replace(/\r/g, ''), cues = []; let kind = 'sub';
        if (!/-->/.test(txt) && /\[\d+:\d+(?:[.:]\d+)?\]/.test(txt)) {
            kind = 'lrc';
            txt.split('\n').forEach(line => {
                const tags = line.match(/\[\d+:\d+(?:[.:]\d+)?\]/g); if (!tags) return;
                const t = line.replace(/\[[^\]]*\]/g, '').trim(); if (!t) return;
                tags.forEach(tg => { const s = parseTime(tg.slice(1, -1)); if (s != null) cues.push({ s: s, e: null, t: t }); });
            });
            cues.sort((a, b) => a.s - b.s); cues.forEach((c, i) => { c.e = cues[i + 1] ? cues[i + 1].s : c.s + 6; });
        } else {
            txt.split(/\n\s*\n/).forEach(block => {
                const ls = block.split('\n'), i = ls.findIndex(l => l.indexOf('-->') >= 0); if (i < 0) return;
                const [a, b] = ls[i].split('-->'); const s = parseTime(a), e = parseTime(b.trim().split(/\s+/)[0]); if (s == null || e == null) return;
                const t = ls.slice(i + 1).join(' ').replace(/<[^>]+>|\{[^}]*\}/g, '').replace(/\s+/g, ' ').trim(); if (t) cues.push({ s: s, e: e, t: t });
            });
            cues.sort((a, b) => a.s - b.s);
        }
        return { cues: cues, kind: kind };
    }
    async function decodeText(buf) { try { return new TextDecoder('utf-8', { fatal: true }).decode(buf); } catch (e) { try { return new TextDecoder('gbk').decode(buf); } catch (e2) { return new TextDecoder().decode(buf); } } }
    function lineAt(pos) { let cur = null; for (const c of TG.cues) { if (c.s <= pos) { if (pos < c.e) cur = c; } else break; } return cur; }
    function recentLines(pos, back, max) { return TG.cues.filter(c => c.s <= pos && c.s >= pos - back).slice(-max).map(c => '[' + fmt(c.s) + '] ' + c.t); }

    // ───────── 房间聊天（按角色保存） ─────────
    const charId = () => getActiveCharId();
    function chatKey() { return 'tg_chat_' + (charId() || '_'); }
    function getChat() { try { return JSON.parse(store.getItem(chatKey()) || '[]'); } catch (e) { return []; } }
    function saveLast() {
        const id = charId(); if (!id || !TG.title) return;
        store.setItem('tg_last_' + id, JSON.stringify({ title: TG.title, kind: TG.kind, ts: Date.now(), lines: getChat().slice(-6).map(m => (m.r === 'me' ? '我：' : 'TA：') + m.t) }));
    }
    function addMsg(role, text, opts) {
        text = String(text || '').trim(); if (!text) return;
        const arr = getChat(); arr.push({ r: role, t: text, ts: Date.now(), at: video ? Math.floor(video.currentTime || 0) : 0 }); store.setItem(chatKey(), JSON.stringify(arr.slice(-80)));
        saveLast(); renderChat();
        if (role === 'ta') { const pane = $('mcpPaneTogether'); const visible = pane && !pane.classList.contains('hidden') && $('mcpApp') && !$('mcpApp').classList.contains('hidden'); if (!visible) { try { const c = getChar(charId()); uiAlert((c ? c.name : 'TA') + '：' + text, 4000); } catch (e) {} } }
    }
    function renderChat() {
        const box = $('tgChat'); if (!box) return; const c = getChar(charId()); const arr = getChat();
        box.innerHTML = arr.length ? arr.map(m => '<div class="tg-msg ' + m.r + '"><span class="tg-who">' + (m.r === 'me' ? '我' : esc(c ? c.name : 'TA')) + (m.at ? ' · ' + fmt(m.at) : '') + '</span><p>' + esc(m.t) + '</p></div>').join('') : '<div class="tg-empty">选好片子开始吧，边看边聊~</div>';
        box.scrollTop = box.scrollHeight;
    }

    // ───────── 提示词 ─────────
    const verb = () => TG.kind === 'video' ? '看' : '听';
    function mediaCtx() {
        const v = video, pos = v ? v.currentTime : 0;
        let t = '我们正在一起' + verb() + '《' + TG.title + '》，' + (v && !v.paused ? '正在播放' : '已暂停') + '，进度 ' + fmt(pos) + (v && isFinite(v.duration) ? ' / ' + fmt(v.duration) : '') + '。';
        const ls = recentLines(pos, 75, 7);
        if (ls.length) t += '\n刚刚的' + (TG.cueKind === 'lrc' ? '歌词' : '台词/字幕') + '：\n' + ls.join('\n');
        else t += '\n（没有字幕/歌词：你看不到画面也听不到声音，只知道标题和进度。不要编造具体情节或歌词；可以聊你对这部作品本身的了解、感受，或问我现在看到/听到了什么。）';
        return t;
    }
    function roomCtx() { const a = getChat().slice(-8); return a.length ? '\n房间里刚聊的：' + a.map(m => (m.r === 'me' ? '我：' : '你：') + m.t).join(' / ') : ''; }
    async function askTA(task) {
        const id = charId(); if (!id) throw new Error('先去通讯录创建一个角色');
        const text = await callPersona(id, timeContext() + '\n' + mediaCtx() + roomCtx() + '\n' + task, 1.0);
        const j = parseJSONLoose(text) || { say: oneLine(text), ctl: 'none' };
        return { say: String(j.say || '').trim(), ctl: j.ctl };
    }
    const FMT = '只输出JSON：{"say":"你说的话","ctl":"none"}（想暂停下来聊就把 ctl 写成 "pause"）';
    async function react(reason) {
        if (TG.busy || !API_KEY || !charId() || !TG.title) return; TG.busy = true;
        try {
            const task = reason === 'ended' ? '刚刚放完了，说说你的感受（口语，两句内）。' + FMT
                : '请像真的坐在我身边一起' + verb() + '一样，自然地说一句（口语，30字内，可以感叹、吐槽、问我、靠过来的小动作；别总结剧情，别播报进度或“系统”）。' + FMT;
            const r = await askTA(task); if (r.say) addMsg('ta', r.say); if (r.ctl === 'pause' && video && !video.paused) video.pause();
        } catch (e) {} finally { TG.busy = false; schedule(); }
    }
    async function userSay(text) {
        text = String(text || '').trim(); if (!text) return; addMsg('me', text);
        if (needKey()) return; if (!TG.title) { addMsg('ta', '（先选一首歌或一部电影吧）'); return; }
        TG.busy = true; try { const r = await askTA('我对你说：“' + text + '”。像一起' + verb() + '时的聊天那样回我（口语，1-2句）。' + FMT); if (r.say) addMsg('ta', r.say); if (r.ctl === 'pause' && video && !video.paused) video.pause(); } catch (e) { uiAlert('TA 没回上：' + e.message); } finally { TG.busy = false; }
    }
    const EVERY = { quiet: 300, mid: 150, chatty: 70 };
    function schedule(first) { const base = EVERY[get('tg_freq', 'mid')] || 150; TG.nextAt = Date.now() + (first ? base * 0.4 : base * (0.7 + Math.random() * 0.6)) * 1000; }
    setInterval(() => {
        if (!video || video.paused || document.hidden || TG.busy || !TG.title) return;
        if (Date.now() >= TG.nextAt) react('auto');
    }, 4000);

    // ───────── 播放器 ─────────
    function setMedia(title, kind) { TG.title = title; TG.kind = kind || 'audio'; TG.error = ''; TG.loadedAt = Date.now(); applyKind(); updateAll(); }
    function applyKind() { const st = $('tgStage'); if (!st) return; st.classList.toggle('is-video', TG.kind === 'video'); $('tgArtTitle').textContent = TG.title || '选一首歌或一部电影'; }
    function loadFile(file) {
        if (!file) return; if (TG.objUrl) { try { URL.revokeObjectURL(TG.objUrl); } catch (e) {} }
        TG.objUrl = URL.createObjectURL(file); TG.cues = []; TG.cueKind = ''; video.src = TG.objUrl;
        setMedia(file.name.replace(/\.[^.]+$/, ''), (file.type || '').startsWith('video') || /\.(mp4|webm|mkv|mov|m4v|ogv)$/i.test(file.name) ? 'video' : 'audio');
        pushCues(); schedule(true); addSys('已加载《' + TG.title + '》。点播放就开始啦' + (TG.kind === 'audio' ? '；想看歌词的话再选一个 .lrc 文件。' : '；有字幕文件的话再选一下，TA 就能跟上剧情。'));
        pushState('load');
    }
    function loadUrl(url, title, kind, autoplay) {
        TG.cues = []; TG.cueKind = ''; video.crossOrigin = 'anonymous'; video.src = url;
        const guess = kind || (/\.(mp4|webm|mkv|mov|m4v|ogv)(\?|$)/i.test(url) ? 'video' : 'audio');
        setMedia(title || decodeURIComponent((url.split('?')[0].split('/').pop() || '在线媒体')).replace(/\.[^.]+$/, ''), guess); pushCues(); schedule(true); pushState('load');
        if (autoplay) video.play().catch(onPlayBlocked);
    }
    async function loadSubFile(file) { if (!file) return; const t = await decodeText(await file.arrayBuffer()); applySubs(t, file.name); }
    function applySubs(text, name) {
        const r = parseSubs(text); if (!r.cues.length) { uiAlert('没读出字幕/歌词，确认是 .srt / .vtt / .lrc'); return; }
        TG.cues = r.cues; TG.cueKind = r.kind; pushCues(); addSys('已载入' + (r.kind === 'lrc' ? '歌词' : '字幕') + '（' + r.cues.length + ' 句）：' + (name || '')); updateLive();
    }
    function addSys(t) { const box = $('tgChat'); if (!box) return; const d = document.createElement('div'); d.className = 'tg-sys'; d.textContent = t; box.appendChild(d); box.scrollTop = box.scrollHeight; }
    function onPlayBlocked() { TG.error = '浏览器拦截了自动播放，请在手机上点一下播放'; uiAlert(TG.error); pushState('error'); }
    function updateLive() { const el = $('tgLive'); if (!el || !video) return; const c = lineAt(video.currentTime); el.textContent = c ? c.t : (TG.cues.length ? '' : (TG.title ? '' : '')); el.classList.toggle('on', !!c); }
    window.tgNow = () => ({ title: TG.title, playing: !!(video && !video.paused && !video.ended), kind: TG.kind });
    function updateAll() {
        updateWho(); updateLock(); try { renderHome(); } catch (e) {} const st = $('tgStage'); if (st) st.classList.toggle('playing', !!(video && !video.paused && !video.ended));
    }
    function updateLock() {
        const t = $('musicTitle'), w = $('musicWidget'); if (!t || !w) return; const sub = w.querySelector('.lw-sub');
        t.textContent = TG.title ? '《' + TG.title + '》' : '一起听 / 看'; if (sub) sub.textContent = TG.title ? (video && !video.paused ? '正在和 TA 一起' + verb() : '已暂停 · 点我回去') : '点我选一首歌 / 一部电影';
    }
    function updateWho() {
        const el = $('tgWho'); if (!el) return; const c = getChar(charId());
        el.textContent = (c ? c.name + ' 在陪你' : '先去通讯录创建一个角色') + (API_KEY ? '' : '（还没填 API Key，TA 开不了口）');
    }

    const pushState = () => {}, pushCues = () => {};

    // ───────── 界面 ─────────
    function build() {
        const body = $('tgBody'); if (!body || TG.built) return; TG.built = true;
        body.innerHTML =
            '<div class="tg-card tg-player"><div class="tg-stage" id="tgStage"><video id="tgVideo" playsinline controls preload="metadata"></video>' +
            '<div class="tg-art"><div class="tg-eq"><i></i><i></i><i></i><i></i><i></i></div><div class="tg-art-title" id="tgArtTitle">选一首歌或一部电影</div></div></div>' +
            '<div class="tg-live" id="tgLive"></div></div>' +
            '<div class="tg-row"><label class="btn-small tg-file">🎵 选音乐 / 电影<input type="file" id="tgFile" accept="audio/*,video/*,.mp3,.m4a,.flac,.wav,.ogg,.mp4,.webm,.mkv,.mov"></label>' +
            '<label class="btn-small tg-file">📝 字幕 / 歌词<input type="file" id="tgSub" accept=".srt,.vtt,.lrc,.txt"></label></div>' +
            '<div class="tg-row"><input id="tgUrl" class="input-text" placeholder="或粘贴 mp3 / mp4 / webm 直链"><button class="btn-small" id="tgUrlBtn">加载</button></div>' +
            '<div class="tg-card"><div class="pk-cap">谁陪你</div>' +
            '<div class="tg-who" id="tgWho"></div>' +
            '<div class="tg-row tg-freqrow"><span>TA 插话频率</span><select id="tgFreq" class="input-text"><option value="quiet">安静（约 5 分钟）</option><option value="mid">适中（约 2.5 分钟）</option><option value="chatty">话多（约 1 分钟）</option></select></div></div>' +
            '<div class="tg-card tg-room"><div class="tg-chat" id="tgChat"></div><div class="tg-row"><input id="tgInput" class="input-text" placeholder="边看边说点什么…"><button class="btn-small" id="tgSend">发送</button></div>' +
            '<button class="btn-secondary tg-ask" id="tgAsk">问问 TA 现在的感受</button></div>';

        video = $('tgVideo');
        $('tgFile').addEventListener('change', e => { loadFile(e.target.files[0]); e.target.value = ''; });
        $('tgSub').addEventListener('change', e => { loadSubFile(e.target.files[0]); e.target.value = ''; });
        $('tgUrlBtn').addEventListener('click', () => { const u = $('tgUrl').value.trim(); if (!/^https?:\/\//i.test(u)) { uiAlert('请粘贴 http(s) 开头的直链'); return; } loadUrl(u, '', '', false); });
        $('tgFreq').value = get('tg_freq', 'mid'); $('tgFreq').addEventListener('change', e => { store.setItem('tg_freq', e.target.value); schedule(); });
        const send = () => { const i = $('tgInput'), t = i.value; i.value = ''; userSay(t); };
        $('tgSend').addEventListener('click', send); $('tgInput').addEventListener('keydown', e => { if (e.key === 'Enter' && !e.isComposing) send(); });
        $('tgAsk').addEventListener('click', () => userSay('你现在有什么感觉？'));
        ['play', 'pause', 'ended', 'seeked', 'volumechange', 'timeupdate', 'loadedmetadata', 'error'].forEach(ev => video.addEventListener(ev, () => {
            if (ev === 'timeupdate') { updateLive(); return; }
            if (ev === 'error') { if (TG.title) { TG.error = '这个文件/链接播放不了（格式不支持或不允许跨域）'; uiAlert(TG.error); pushState('error'); } return; }
            if (ev === 'seeked' && Date.now() - TG.loadedAt < 800) return;
            if (ev === 'volumechange') return;
            if (ev === 'loadedmetadata') { if (!video.videoWidth && TG.kind === 'video') { TG.kind = 'audio'; applyKind(); } else if (video.videoWidth && TG.kind !== 'video') { TG.kind = 'video'; applyKind(); } pushState('load'); return; }
            if (ev === 'play') { schedule(true); TG.error = ''; }
            updateAll(); saveLast(); pushState(ev === 'seeked' ? 'seek' : ev);
            if (ev === 'ended') react('ended');
        }));
    }
    window.renderTogether = function () { build(); updateWho(); updateLock(); applyKind(); renderChat(); const f = $('tgFreq'); if (f) f.value = get('tg_freq', 'mid'); };

    // 让平时聊天的 TA 也知道你们一起听/看的事
    const _peekContext = window.peekContext;
    window.peekContext = function (c) {
        let t = ''; try { t = _peekContext ? _peekContext(c) : ''; } catch (e) {}
        try {
            if (video && TG.title && !video.paused && !video.ended) { t += '\n【此刻我们正在一起' + verb() + '《' + TG.title + '》，进度 ' + fmt(video.currentTime) + (lineAt(video.currentTime) ? '，当前这句：' + lineAt(video.currentTime).t : '') + '】'; }
            else { const l = JSON.parse(store.getItem('tg_last_' + c.id) || 'null'); if (l && Date.now() - l.ts < 3 * 864e5) t += '\n【我们最近一起' + (l.kind === 'video' ? '看' : '听') + '过《' + l.title + '》' + (l.lines && l.lines.length ? '，当时聊到：' + l.lines.join(' / ') : '') + '（可以自然提起，别硬聊）】'; }
        } catch (e) {}
        return t;
    };

    // 锁屏小组件 → 直达「一起」
    const mw = $('musicWidget'); if (mw) { mw.style.cursor = 'pointer'; mw.addEventListener('click', (e) => { e.stopPropagation(); try { unlockPhone(); openApp('mcp'); setMcpTab('together'); } catch (er) {} }); }
    window.addEventListener('pagehide', saveLast);
})();
