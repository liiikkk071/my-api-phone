/* 聊天增强：引用 / 撤回 / TA 发照片（生图） */
(function () {
    'use strict';
    var QRE = /^\s*[\[［【]\s*引用\s*[:：]\s*([^\]］】]{1,80}?)\s*[\]］】]\s*([\s\S]+)$/;
    var IRE = /^\s*[\[［【]\s*图片\s*[:：]\s*([^\]］】]{2,200}?)\s*[\]］】]\s*$/;
    var RRE = /^\s*[\[［【]\s*撤回\s*[\]］】]\s*$/;
    var VRE = /^\s*[\[［【]\s*(?:语音|语音消息|voice)\s*[:：]\s*([\s\S]{1,400}?)\s*[\]］】]\s*$/i;
    var pendingQuote = null;
    var busy = {};

    function esc(s) { return escapeHtml(String(s == null ? '' : s)); }
    function sget(k, d) { try { var v = store.getItem(k); return v === null || v === undefined ? d : v; } catch (e) { return d; } }
    function sset(k, v) { try { store.setItem(k, v); } catch (e) {} }

    // 把一条消息变成适合引用的短文字
    function briefOf(m) {
        var c = String(m.content == null ? '' : m.content);
        if (/^\[表情包/.test(c)) return '[表情包]';
        if (/^\[图片:/.test(c)) return '[照片] ' + (m.gen || '');
        if (/^\[(图片|相册)/.test(c) || m.img) return '[图片]';
        if (/^\[(语音消息|语音)\]/.test(c)) return '[语音] ' + c.replace(/^\[[^\]]*\]/, '');
        if (/^\[转账\]/.test(c)) return '[转账]';
        if (/^\[红包\]/.test(c)) return '[红包]';
        if (/^\[位置/.test(c)) return '[位置]';
        return c.replace(/\s+/g, ' ');
    }
    function clip(t, n) { t = String(t); return t.length > n ? t.slice(0, n) + '…' : t; }

    // ---------- 引用 ----------
    function bar() {
        var b = document.getElementById('quoteBar');
        if (b) return b;
        var area = document.querySelector('#chatRoomApp .input-area'); if (!area) return null;
        b = document.createElement('div'); b.id = 'quoteBar'; b.className = 'quote-bar hidden';
        b.innerHTML = '<div class="qb-body"><b></b><span></span></div><button type="button" class="qb-x" aria-label="取消引用">×</button>';
        area.parentNode.insertBefore(b, area);
        b.querySelector('.qb-x').addEventListener('click', clearQuote);
        return b;
    }
    function setQuote(q) {
        pendingQuote = q;
        var b = bar(); if (!b) return;
        if (!q) { b.classList.add('hidden'); return; }
        b.querySelector('b').textContent = q.w === 'me' ? '引用我：' : '引用TA：';
        b.querySelector('span').textContent = clip(q.t, 40);
        b.classList.remove('hidden');
        var inp = document.getElementById('userInput'); if (inp) inp.focus();
    }
    function clearQuote() { setQuote(null); }
    function takeQuote() { var q = pendingQuote; setQuote(null); return q; }
    function addQuote(el, q) {
        if (!el || !q) return;
        var w = el.querySelector('.bubble-wrapper'), b = el.querySelector('.bubble'); if (!w || !b) return;
        var d = document.createElement('div'); d.className = 'quote-box';
        d.innerHTML = '<b>' + (q.w === 'me' ? '我' : 'TA') + '：</b>' + esc(clip(q.t, 60));
        // 引用框放在气泡下方（和微信一致）
        b.insertAdjacentElement('afterend', d);
    }


    // ---------- 线上聊天：去掉括号 / 星号里的动作描写（线上只有对话） ----------
    var HAN = /[一-龥]/g;
    function hasText(x) { var m = String(x).match(HAN); return !!m && m.length >= 1; }
    // 括号里有汉字 = 动作/神态/心理描写，删掉；纯颜文字 (๑>ᴗ<๑) 这类没有汉字，保留
    function stripActions(t, keepOpen) {
        t = String(t == null ? '' : t);
        if (!t) return t;
        var o = t
            .replace(/（[^（）\n]*）/g, function (m) { return hasText(m) ? '' : m; })
            .replace(/\([^()\n]*\)/g, function (m) { return hasText(m) ? '' : m; })
            .replace(/［[^［］\n]*］/g, function (m) { return /^［\s*(引用|图片|语音|撤回|表情包)/.test(m) ? m : (hasText(m) ? '' : m); })
            .replace(/\*[^*\n]{1,80}\*/g, function (m) { return hasText(m) ? '' : m; })
            .replace(/＊[^＊\n]{1,80}＊/g, function (m) { return hasText(m) ? '' : m; });
        // 流式输出时括号还没写完：先藏起来，免得动作闪一下
        o = o.replace(/[（(][^）)\n]*$/, function (m) { return hasText(m) || m.length <= 1 ? '' : m; });
        o = o.replace(/\*[^*\n]*$/, function (m) { return hasText(m) ? '' : m; });
        // 清理删除后留下的多余空格/标点
        o = o.replace(/[ \t]{2,}/g, ' ').replace(/^[ \t，,、]+/gm, '').replace(/[ \t]+$/gm, '');
        return o;
    }
    function voiceText(seg) { var m = VRE.exec(String(seg)); return m ? m[1].trim() : null; }
    function isLatin(t) { var a = (String(t).match(/[A-Za-z]/g) || []).length, h = (String(t).match(HAN) || []).length; return a > 3 && a > h * 2; }
    function playVoice(text, charId) {
        if (typeof window.ttsSpeak !== 'function') { uiAlert('语音模块没有加载'); return; }
        var lang = isLatin(text) ? 'en-US' : /[぀-ヿ]/.test(text) ? 'ja-JP' : 'zh-CN';
        var off = (window.ttsProvider && window.ttsProvider()) === 'off';
        window.ttsSpeak(text, charId || null, { force: true, provider: off ? 'browser' : undefined, lang: lang, silent: false });
    }

    // ---------- 角色输出的特殊标记 ----------
    function splitQuote(seg, charId) {
        var m = QRE.exec(String(seg)); if (!m) return null;
        var t = m[1].trim(), w = 'me';
        try {
            var c = getChar(charId), h = (c && c.chatHistory) || [];
            for (var i = h.length - 1; i >= 0 && i > h.length - 40; i--) {
                if (String(h[i].content).indexOf(t) >= 0) { w = h[i].role === 'user' ? 'me' : 'ta'; break; }
            }
        } catch (e) {}
        return { quote: { w: w, t: t }, text: m[2].trim() };
    }
    function imgTag(seg) { var m = IRE.exec(String(seg)); return m ? m[1].trim() : null; }
    function isRecall(seg) { return RRE.test(String(seg)); }
    // 流式显示时，别把标记原样露出来
    function live(t) {
        t = String(t);
        var m = QRE.exec(t); if (m) return m[2];
        if (/^\s*[\[［【]\s*引用[^\]］】]*$/.test(t)) return '…';
        var g = imgTag(t); if (g) return '(◕ᴗ◕) 正在拍照…';
        if (voiceText(t) !== null || /^\s*[\[［【]\s*(语音|voice)/i.test(t)) return '(◕ᴗ◕) 正在录语音…';
        if (/^\s*[\[［【]\s*(图片|撤回)[^\]］】]*$/.test(t)) return '…';
        return t;
    }

    // 撤回
    function recallLastAi(charId) {
        var cs = getChars(), c = cs.find(function (x) { return x.id === charId; }); if (!c) return false;
        var h = c.chatHistory || [];
        for (var i = h.length - 1; i >= 0; i--) {
            if (h[i].role === 'user') break;
            if (h[i].role === 'assistant' && !h[i].recalled) {
                h[i].orig = String(h[i].content); h[i].recalled = true; h[i].content = '（你撤回了一条消息）';
                saveChars(cs); return true;
            }
        }
        return false;
    }

    // ---------- 渲染 ----------
    function hue(s) { var h = 0; s = String(s); for (var i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) % 360; return h; }
    function cardHtml(desc, busyNow) {
        var h = hue(desc);
        return '<div class="bubble gen-card" style="background:linear-gradient(135deg,hsl(' + h + ',75%,90%),hsl(' + ((h + 50) % 360) + ',70%,82%))"><div class="gc-ic">(◕ᴗ◕)✿</div><div class="gc-t">' + esc(desc) + '</div><div class="gc-s">' + (busyNow ? '显影中…' : 'TA 拍的照片') + '</div></div>';
    }
    function genHtml(m) {
        var src = m.img || m.imgUrl;
        if (src && !m.genFail) return '<div class="bubble gen-img"><img src="' + esc(src) + '" data-d="' + esc(m.gen) + '" onerror="ChatX.imgFail(this)"><div class="gen-cap">' + esc(clip(m.gen, 60)) + '</div></div>';
        return cardHtml(m.gen, false);
    }
    function imgFail(img) {
        var p = img.closest('.bubble'); if (!p) return;
        var t = document.createElement('div'); t.innerHTML = cardHtml(img.getAttribute('data-d') || '照片', false);
        p.replaceWith(t.firstChild);
    }
    function recalledRow(m, isUser) {
        var box = document.getElementById('chatBox'); if (!box) return null;
        var d = document.createElement('div'); d.className = 'sys-msg recalled';
        d.innerHTML = (isUser ? '你撤回了一条消息 <a data-act="re">重新编辑</a>' : 'TA 撤回了一条消息 <a data-act="peek">看看撤回了什么</a>');
        d.dataset.orig = m.orig == null ? '' : String(m.orig);
        box.appendChild(d); return d;
    }
    document.addEventListener('click', function (e) {
        var a = e.target.closest && e.target.closest('.sys-msg.recalled a'); if (!a) return;
        var row = a.closest('.sys-msg'), o = row.dataset.orig || '';
        if (a.dataset.act === 're') {
            var inp = document.getElementById('userInput'); if (inp) { inp.value = o.replace(/^\[[^\]]*\]/, ''); inp.focus(); }
        } else { uiAlert('TA 撤回的是：\n' + o.replace(/^\[[^\]]*\]/, function (x) { return x; })); }
    });

    // ---------- 消息菜单扩展 ----------
    function ensureSheetButtons() {
        var box = document.querySelector('#msgSheet .msg-actions'); if (!box || document.getElementById('msgQuoteBtn')) return;
        var q = document.createElement('button'); q.className = 'btn-secondary'; q.id = 'msgQuoteBtn'; q.textContent = '引用';
        var r = document.createElement('button'); r.className = 'btn-secondary'; r.id = 'msgRecallBtn'; r.textContent = '撤回';
        box.insertBefore(q, box.firstChild); box.insertBefore(r, box.children[1]);
        q.addEventListener('click', function () {
            if (!msgSel) return; var m = curHistory()[msgSel.idx]; if (!m) return;
            var who = m.role === 'user' ? 'me' : 'ta'; closeMsgSheet();
            setQuote({ w: who, t: briefOf(m) });
        });
        r.addEventListener('click', function () {
            if (!msgSel) return; var idx = msgSel.idx, m = curHistory()[idx]; if (!m || m.role !== 'user') return;
            if (Date.now() - (m.ts || 0) > 120000) { closeMsgSheet(); uiAlert('超过 2 分钟的消息不能撤回啦'); return; }
            closeMsgSheet();
            mutateHistory(function (h) {
                var x = h[idx]; if (!x) return;
                x.orig = String(x.content); x.recalled = true;
                x.content = '（我撤回了一条消息，撤回前写的是：' + String(x.orig).replace(/^\[[^\]]*\]/, '') + '）';
                delete x.quote;
            });
        });
    }
    function sheet(m) {
        ensureSheetButtons();
        var q = document.getElementById('msgQuoteBtn'), r = document.getElementById('msgRecallBtn');
        if (q) q.classList.toggle('hidden', !!currentGroupId);
        if (r) r.classList.toggle('hidden', !(m.role === 'user' && Date.now() - (m.ts || 0) <= 120000));
    }

    // ---------- 提示词 ----------
    function hint() {
        var auto = sget('imgGenAuto', '1') !== '0';
        return '\n【聊天小功能】\n1. 引用：想回应我之前说的某句话时，这条消息写成 [引用:我说过的原话片段]你的回复，片段要简短，偶尔用。\n2. 撤回：如果你说错话、说了害羞的话想收回，可以单独一行写 [撤回]，你上一条消息就会被撤回（别滥用）。我撤回消息时你会看到「（我撤回了一条消息…）」，可以好奇、调侃，也可以装作没看见。\n3. 发照片：' + (auto ? '我想看你的照片/自拍/风景，或情境很合适时，' : '只有我明确要看照片时，') + '单独一行写 [图片:照片内容的详细画面描述]（描述要具体：人物、动作、场景、光线），再另起一行说句话。我发的照片你直接按描述理解。\n4. 发语音：你完全可以发语音。当我说「发语音/说句话给我听/给我发一句语音/念给我听」，或你自己想用声音表达时，单独一行写 [语音:你要说的那句话]，方括号里就是你说的原话（我要求用英语/日语等外语就直接写外语原文，不要加翻译和括号说明）。系统会把它显示成语音条，我点一下就能听。只要我提出要语音，就要发，不能说「语音坏了/发不了」；如果你的性格别扭，也要用符合性格的方式照做（可以嘴硬一句，再把语音发出来）。语音里只放要说的话，不要放动作描写。';
    }

    // ---------- TA 拍照 ----------
    function askPhoto() {
        if (typeof closeAttachPanel === 'function') closeAttachPanel();
        if (currentGroupId) { uiAlert('群聊里暂时不能让 TA 拍照，请在单聊里使用~'); return; }
        if (!currentChatCharId) { uiAlert('请先选一个聊天~'); return; }
        var cid = currentChatCharId;
        uiPrompt('想看 TA 拍什么？（留空就让 TA 自己决定）', '', { placeholder: '例如：现在窗外的风景 / 一张自拍' }).then(function (v) {
            if (v === null) return;
            v = String(v || '').trim();
            chatReply(cid, '（我想看你拍的照片' + (v ? '：' + v : '，你自己决定拍什么') + '。请单独一行用 [图片:画面描述] 发一张照片，再简单说一句话。）');
        });
    }

    function updateMsg(charId, ts, fn) {
        var cs = getChars(), c = cs.find(function (x) { return x.id === charId; }); if (!c) return;
        var m = (c.chatHistory || []).find(function (x) { return x.ts === ts && x.gen; }); if (!m) return;
        fn(m); saveChars(cs);
        if (charId === currentChatCharId && !currentGroupId) renderChatMessages();
    }
    function compress(b64, cb) {
        var img = new Image();
        img.onload = function () {
            try { var sc = Math.min(1, 420 / Math.max(img.width, img.height)), cv = document.createElement('canvas'); cv.width = Math.round(img.width * sc); cv.height = Math.round(img.height * sc); cv.getContext('2d').drawImage(img, 0, 0, cv.width, cv.height); var d = cv.toDataURL('image/webp', 0.82); if (d.indexOf('webp') < 0) d = cv.toDataURL('image/jpeg', 0.8); cb(d); } catch (e) { cb(b64); }
        };
        img.onerror = function () { cb(b64); }; img.src = b64;
    }
    function job(charId, m) {
        var key = charId + ':' + m.ts; if (busy[key]) return; busy[key] = 1;
        var mode = sget('imgGenMode', 'card'), prompt = m.gen + '，高清，柔和自然光，细节丰富';
        if (mode === 'free') {
            var url = 'https://image.pollinations.ai/prompt/' + encodeURIComponent(prompt) + '?width=512&height=512&nologo=true&seed=' + (m.ts % 99999);
            updateMsg(charId, m.ts, function (x) { x.imgUrl = url; });
            return;
        }
        var base = String(sget('imgGenUrl', '') || '').trim().replace(/\/+$/, ''), key2 = sget('imgGenKey', '') || (typeof API_KEY !== 'undefined' ? API_KEY : '');
        if (!base) { updateMsg(charId, m.ts, function (x) { x.genFail = true; }); return; }
        if (!/\/images\/generations$/.test(base)) base += '/images/generations';
        fetch(base, { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + key2 }, body: JSON.stringify({ model: sget('imgGenModel', '') || 'dall-e-3', prompt: prompt, n: 1, size: '1024x1024', response_format: 'b64_json' }) })
            .then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); })
            .then(function (j) {
                var d = j.data && j.data[0]; if (!d) throw new Error('empty');
                if (d.b64_json) compress('data:image/png;base64,' + d.b64_json, function (u) { updateMsg(charId, m.ts, function (x) { x.img = u; }); });
                else if (d.url) updateMsg(charId, m.ts, function (x) { x.imgUrl = d.url; });
                else throw new Error('empty');
            })
            .catch(function () { updateMsg(charId, m.ts, function (x) { x.genFail = true; }); });
    }
    function afterReply(charId) {
        if (sget('imgGenMode', 'card') === 'card') return;
        var c = getChar(charId); if (!c) return;
        (c.chatHistory || []).slice(-12).forEach(function (m) { if (m.gen && !m.img && !m.imgUrl && !m.genFail) job(charId, m); });
    }

    // ---------- 设置 ----------
    function bindSettings() {
        var mode = document.getElementById('imgGenMode'); if (!mode) return;
        var api = document.getElementById('imgGenApiBox'), auto = document.getElementById('imgGenAuto');
        mode.value = sget('imgGenMode', 'card'); auto.checked = sget('imgGenAuto', '1') !== '0';
        var show = function () { api.classList.toggle('hidden', mode.value !== 'api'); };
        show();
        mode.addEventListener('change', function () { sset('imgGenMode', mode.value); show(); });
        auto.addEventListener('change', function () { sset('imgGenAuto', auto.checked ? '1' : '0'); });
        [['imgGenUrl', 'imgGenUrl'], ['imgGenKey', 'imgGenKey'], ['imgGenModel', 'imgGenModel']].forEach(function (p) {
            var el = document.getElementById(p[0]); if (!el) return;
            el.value = sget(p[1], ''); el.addEventListener('change', function () { sset(p[1], el.value.trim()); });
        });
    }

    window.ChatX = { stripActions: stripActions, voiceText: voiceText, playVoice: playVoice, splitQuote: splitQuote, imgTag: imgTag, isRecall: isRecall, live: live, recallLastAi: recallLastAi, addQuote: addQuote, takeQuote: takeQuote, clearQuote: clearQuote, genHtml: genHtml, imgFail: imgFail, recalledRow: recalledRow, sheet: sheet, hint: hint, askPhoto: askPhoto, afterReply: afterReply, briefOf: briefOf };
    window.chatxHint = hint;
    bar(); bindSettings();
})();
