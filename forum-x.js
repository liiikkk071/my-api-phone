/* forum-x.js —— 广场的「推文」(类似 X 的时间线) + 「私信」。
   只是给 forum.js 加两个标签页和几个小钩子，帖子/账号数据和原来的广场共用；没有这个文件，广场照常使用。
   私信数据单独存在 forumDM（只在你自己的浏览器里）。 */
(function () {
    'use strict';
    const F = window.__fm; if (!F) return;
    const $ = (id) => document.getElementById(id), esc = (s) => escapeHtml(String(s == null ? '' : s));
    const rnd = (a, b) => a + Math.floor(Math.random() * (b - a + 1)), pick = (a) => a[Math.floor(Math.random() * a.length)];
    const DK = 'forumDM';
    // ---------- 私信数据 ----------
    function DM() { let d = null; try { d = JSON.parse(store.getItem(DK) || 'null'); } catch (e) {} if (!d || !d.th) d = { th: {}, lastNpc: 0 }; return d; }
    function saveDM(d) { try { store.setItem(DK, JSON.stringify(d)); } catch (e) { uiAlert('空间不够了，先清一些私信或带图的帖子吧'); } }
    const byOf = (k) => { const i = k.indexOf(':'); return { t: k.slice(0, i), id: k.slice(i + 1) }; };
    const thread = (d, k) => (d.th[k] = d.th[k] || { k: k, msgs: [], unread: 0, ts: 0 });
    function unreadN() { const d = DM(); return Object.keys(d.th).reduce((a, k) => a + (d.th[k].unread || 0), 0); }
    function badge() { const b = document.querySelector('#forumApp .fm-tabs button[data-t="dm"]'); if (!b) return; const n = unreadN(); b.innerHTML = '私信' + (n ? '<i class="fx-dot">' + (n > 9 ? '9+' : n) + '</i>' : ''); }
    const peek = (m) => m.post ? '[帖子] ' + ((F.D().posts.find(p => p.id === m.post) || {}).title || '分享了一条帖子') : m.text;
    function addMsg(k, from, text, post) { const d = DM(), t = thread(d, k); t.msgs.push({ id: F.uid(), from: from, text: text || '', post: post || null, ts: Date.now() }); if (t.msgs.length > 200) t.msgs.splice(0, t.msgs.length - 200); t.ts = Date.now(); if (from === 'them') t.unread = (t.unread || 0) + 1; saveDM(d); badge(); }

    // ---------- 回复（TA / 路人网友） ----------
    const NPC_RE = ['哈哈是吧', '我也这么觉得～', '谢谢你呀', '嗯嗯，下次聊', '你这么说我好开心', '收到！', '诶嘿，被你发现了', '欸你人好好哦'];
    async function reply(k, userText, postId) {
        const by = byOf(k), a = F.acct(by), d = DM(), t = thread(d, k), hist = t.msgs.slice(-9, -1).map(m => (m.from === 'me' ? '我' : '你') + '：' + peek(m)).join('\n');
        const p = postId ? F.D().posts.find(x => x.id === postId) : null, pt = p ? '（我分享了一条帖子给你：《' + (p.title || '') + '》' + p.text.slice(0, 100) + '，作者 ' + F.acct(p.by).nick + '）' : '';
        let out = '';
        if (API_KEY) {
            try {
                if (by.t === 'char') out = oneLine(await callPersona(by.id, '【广场私信】我在论坛里给你发私信，你的论坛账号名是「' + a.nick + '」。' + (hist ? '最近的私信记录：\n' + hist + '\n' : '') + '我刚发来：「' + (userText || '') + '」' + pt + '。请你以角色本人的口吻回复这条私信，口语、有感情、像对象聊天，不超过60字。只输出回复。', 1.0));
                else { const msgs = [{ role: 'system', content: '你在一个类似小红书/推特的中文社区里扮演网友「' + a.nick + '」（简介：' + (a.bio || '普通网友') + '）。用户给你发了私信，请用符合这个网友性格的口吻回一条私信：自然口语、像真人、可以带点小情绪或小表情，不超过50字，不要暴露自己是 AI，内容必须健康。只输出回复内容。' }]; t.msgs.slice(-9).forEach(m => msgs.push({ role: m.from === 'me' ? 'user' : 'assistant', content: peek(m) })); if (pt) msgs.push({ role: 'user', content: pt }); out = oneLine(await chatCompletion(msgs, 1.0)); }
            } catch (e) { out = ''; }
        }
        if (!out) { if (by.t === 'char') return; out = pick(NPC_RE); }
        setTimeout(() => { addMsg(k, 'them', out); if (by.t === 'char') { try { addIntimacy(by.id, 1); logActivity(by.id, 'forum', '我们在广场私信里聊了几句'); } catch (e) {} } refreshDM(k); }, rnd(900, 2200));
    }

    // ---------- 推文时间线 ----------
    function fxItem(p, d) {
        const a = F.acct(p.by, d), cm = p.comments.filter(F.vis).length, lk = (p.likeN || 0) + (p.liked ? 1 : 0), q = p.quote ? d.posts.find(x => x.id === p.quote) : null;
        const body = (p.title ? '<b class="fx-ti">' + esc(p.title) + '</b>' : '') + esc(p.text).replace(/\n/g, '<br>');
        return '<div class="fx-item" data-id="' + p.id + '"><span class="fx-av" data-by="' + F.key(p.by) + '">' + F.avHtml(a, 40) + '</span><div class="fx-main"><div class="fx-hd"><b data-by="' + F.key(p.by) + '">' + esc(a.nick) + '</b>' + (a.char ? '<i class="fm-tag">TA</i>' : '') + '<span>@' + esc(a.handle || 'user') + ' · ' + agoText(p.ts) + '</span></div><div class="fx-tx">' + body + '</div>'
            + (p.img ? '<img class="fx-img" src="' + p.img + '">' : '') + (q ? '<div class="fx-q" data-id="' + q.id + '"><b>' + esc(F.acct(q.by, d).nick) + '</b> ' + esc((q.title || q.text).slice(0, 60)) + '</div>' : '')
            + (p.tags && p.tags.length ? '<div class="fm-tags">' + p.tags.map(t => '<span>#' + esc(t) + '</span>').join('') + '</div>' : '')
            + '<div class="fx-ac"><button data-a="re">' + F.svg('chat', 17) + ' ' + cm + '</button><button data-a="rp">' + rpSvg() + '</button><button data-a="lk" class="' + (p.liked ? 'on' : '') + '">' + F.svg('heart', 17) + ' ' + F.num(lk) + '</button><button data-a="sh">' + F.svg('send', 17) + '</button></div></div></div>';
    }
    const rpSvg = () => '<svg class="li" width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M17 3l3 3-3 3"/><path d="M4 11V9a3 3 0 0 1 3-3h13"/><path d="M7 21l-3-3 3-3"/><path d="M20 13v2a3 3 0 0 1-3 3H4"/></svg>';
    let draft = '';
    function renderFeed(body, d) {
        const ps = d.posts.filter(p => F.vis(p)).slice().sort((a, b) => b.ts - a.ts).slice(0, 80), me = F.acct({ t: 'me', id: 'me' }, d);
        body.innerHTML = '<div class="fx-compose"><span class="fx-av">' + F.avHtml(me, 40) + '</span><div><textarea id="fxTx" rows="2" maxlength="280" placeholder="有什么新鲜事？">' + esc(draft) + '</textarea><div class="fx-cbar"><small id="fxN">' + draft.length + '/280</small><button id="fxGo">发布</button></div></div></div>'
            + '<div class="fx-list">' + (ps.length ? ps.map(p => fxItem(p, d)).join('') : '<div class="stg-empty">还没有推文</div>') + '</div>';
        const tx = $('fxTx'); tx.oninput = () => { draft = tx.value; $('fxN').textContent = draft.length + '/280'; };
        $('fxGo').onclick = () => {
            const text = tx.value.trim(); if (!text) { uiAlert('写点什么吧'); return; }
            const dd = F.D(), tags = (text.match(/#([^\s#，,。.!！?？]+)/g) || []).map(x => x.slice(1)).slice(0, 4), p = { id: F.uid(), by: { t: 'me', id: 'me' }, title: '', text: text, tags: tags, ts: Date.now(), likeN: 0, liked: false, comments: [], g: rnd(0, 5) };
            dd.posts.unshift(p); F.S(dd); draft = ''; try { logActivity(F.cid(), 'forum', '我在广场发了一条推文：' + text.slice(0, 30)); } catch (e) {} F.reactTo(p.id); npcMaybeDM(); renderTab();
        };
        body.querySelectorAll('.fx-item').forEach(el => {
            const id = el.dataset.id;
            el.onclick = (e) => { if (e.target.closest('[data-a],[data-by],.fx-q')) return; F.openPost(id); };
            el.querySelectorAll('[data-by]').forEach(x => x.onclick = (e) => { e.stopPropagation(); profile(byOf(x.dataset.by)); });
            const q = el.querySelector('.fx-q'); if (q) q.onclick = (e) => { e.stopPropagation(); F.openPost(q.dataset.id); };
            el.querySelectorAll('[data-a]').forEach(b => b.onclick = (e) => {
                e.stopPropagation(); const a = b.dataset.a;
                if (a === 're') F.openPost(id); else if (a === 'sh') share(id);
                else if (a === 'lk') { const dd = F.D(), pp = dd.posts.find(x => x.id === id); pp.liked = !pp.liked; F.S(dd); renderTab(true); }
                else if (a === 'rp') repost(id);
            });
        });
    }
    async function repost(id) {
        const dd = F.D(), o = dd.posts.find(x => x.id === id); if (!o) return; const src = o.quote ? dd.posts.find(x => x.id === o.quote) || o : o;
        const t = await uiPrompt('转发时说点什么（可以留空）', '', { ok: '转发' }); if (t === null || t === false) return;
        const p = { id: F.uid(), by: { t: 'me', id: 'me' }, title: '', text: String(t || '').trim() || '转发', tags: [], ts: Date.now(), likeN: 0, liked: false, comments: [], g: rnd(0, 5), quote: src.id }; dd.posts.unshift(p); F.S(dd); renderTab(); uiAlert('已转发', 1200);
    }

    // ---------- 个人主页 ----------
    function profile(by) {
        const d = F.D(), a = F.acct(by, d); if (!a) return; const posts = d.posts.filter(p => F.key(p.by) === F.key(by) && F.vis(p)).sort((x, y) => y.ts - x.ts), self = by.t === 'me', fol = d.follows.indexOf(F.key(by)) >= 0;
        stageOpen(self ? '我的主页' : a.nick, (b) => {
            b.innerHTML = '<div class="fx-pf"><span class="fx-av">' + F.avHtml(a, 64) + '</span><div><b>' + esc(a.nick) + (a.char ? ' <i class="fm-tag">TA</i>' : '') + '</b><small>@' + esc(a.handle || 'user') + '</small><p>' + esc(a.bio || '这个人很懒，什么都没写') + '</p></div></div><div class="fx-pfs"><span><b>' + posts.length + '</b>帖子</span><span><b>' + F.num(posts.reduce((s, p) => s + (p.likeN || 0), 0)) + '</b>获赞</span></div>'
                + (self ? '' : '<div class="fx-pfb"><button id="pfFol" class="' + (fol ? 'on' : '') + '">' + (fol ? '已关注' : '关注') + '</button><button id="pfDm">私信</button></div>') + '<div class="stg-sub">TA 的帖子</div><div class="fx-list">' + (posts.length ? posts.map(p => fxItem(p, d)).join('') : '<div class="stg-empty">还没有发过帖子</div>') + '</div>';
            if ($('pfFol')) $('pfFol').onclick = () => { const dd = F.D(), k = F.key(by), i = dd.follows.indexOf(k); if (i >= 0) dd.follows.splice(i, 1); else dd.follows.push(k); F.S(dd); profile(by); };
            if ($('pfDm')) $('pfDm').onclick = () => { stageClose(); openDM(F.key(by)); };
            b.querySelectorAll('.fx-item').forEach(el => { el.onclick = (e) => { if (e.target.closest('[data-a],[data-by],.fx-q')) return; F.openPost(el.dataset.id); }; el.querySelectorAll('[data-a]').forEach(x => x.onclick = (e) => { e.stopPropagation(); if (x.dataset.a === 'sh') share(el.dataset.id); else F.openPost(el.dataset.id); }); });
        }, () => F.render());
    }

    // ---------- 私信列表 / 聊天 ----------
    function renderDMList(body, d) {
        const dm = DM(), ths = Object.keys(dm.th).map(k => dm.th[k]).filter(t => t.msgs.length).sort((a, b) => b.ts - a.ts);
        body.innerHTML = '<div class="stg-btns" style="margin:4px 0 12px"><button class="ghost" id="dmNew">写新私信</button></div>' + (ths.length ? '<div class="fx-dml">' + ths.map(t => { const a = F.acct(byOf(t.k), d), m = t.msgs[t.msgs.length - 1]; return '<div class="fx-dmr" data-k="' + t.k + '"><span class="fx-av">' + F.avHtml(a, 44) + '</span><div><b>' + esc(a.nick) + (a.char ? ' <i class="fm-tag">TA</i>' : '') + '</b><p>' + (m.from === 'me' ? '你：' : '') + esc(peek(m).slice(0, 26)) + '</p></div><small>' + agoText(t.ts) + (t.unread ? '<i class="fx-dot">' + t.unread + '</i>' : '') + '</small></div>'; }).join('') + '</div>' : '<div class="stg-empty">还没有私信。去推文里点头像，或点「写新私信」，也可以在帖子里点分享直接发给 TA。</div>');
        $('dmNew').onclick = pickPerson; body.querySelectorAll('.fx-dmr').forEach(e => e.onclick = () => openDM(e.dataset.k));
    }
    function pickPerson(after) {
        const d = F.D(), list = []; getChars().forEach(c => list.push({ k: 'char:' + c.id, t: 'TA' })); d.follows.forEach(k => { if (list.every(x => x.k !== k)) list.push({ k: k, t: '关注' }); }); d.npcs.forEach(n => { const k = 'npc:' + n.id; if (list.every(x => x.k !== k)) list.push({ k: k, t: '' }); });
        stageOpen('选择私信对象', (b) => {
            b.innerHTML = '<div class="fx-dml">' + list.map(x => { const a = F.acct(byOf(x.k), d); return '<div class="fx-dmr" data-k="' + x.k + '"><span class="fx-av">' + F.avHtml(a, 40) + '</span><div><b>' + esc(a.nick) + (x.t ? ' <i class="fm-tag">' + x.t + '</i>' : '') + '</b><p>@' + esc(a.handle || 'user') + '</p></div></div>'; }).join('') + '</div>';
            b.querySelectorAll('.fx-dmr').forEach(e => e.onclick = () => { stageClose(); if (typeof after === 'function') after(e.dataset.k); else openDM(e.dataset.k); });
        }, () => F.render());
    }
    let dmEl = null, dmKey = null;
    function openDM(k) {
        dmKey = k; const app = $('forumApp'); if (!app) return; if (dmEl) dmEl.remove(); dmEl = document.createElement('div'); dmEl.className = 'fx-dm'; app.appendChild(dmEl);
        const d = F.D(), a = F.acct(byOf(k), d); const dm = DM(); if (dm.th[k]) { dm.th[k].unread = 0; saveDM(dm); badge(); }
        dmEl.innerHTML = '<div class="app-header"><button id="dmBack">‹ 返回</button><span>' + esc(a.nick) + '</span><button id="dmPf">主页</button></div><div class="fx-msgs" id="dmMsgs"></div><div class="fx-cin"><input id="dmIn" class="input-text" placeholder="发私信…" maxlength="300"><button id="dmGo">发送</button></div>';
        $('dmBack').onclick = closeDM; $('dmPf').onclick = () => profile(byOf(k));
        const send = () => { const t = $('dmIn').value.trim(); if (!t) return; $('dmIn').value = ''; addMsg(k, 'me', t); refreshDM(k); reply(k, t); };
        $('dmGo').onclick = send; $('dmIn').onkeydown = (e) => { if (e.key === 'Enter') send(); };
        refreshDM(k);
    }
    function closeDM() { if (dmEl) { dmEl.remove(); dmEl = null; } dmKey = null; badge(); F.render(); }
    function refreshDM(k) {
        if (!dmEl || dmKey !== k) { badge(); if (!$('forumApp').classList.contains('hidden') && !dmEl) F.render(); return; }
        const box = $('dmMsgs'); if (!box) return; const d = F.D(), t = DM().th[k] || { msgs: [] }, a = F.acct(byOf(k), d), me = F.acct({ t: 'me', id: 'me' }, d);
        box.innerHTML = t.msgs.length ? t.msgs.map(m => {
            const mine = m.from === 'me', card = m.post ? (() => { const p = d.posts.find(x => x.id === m.post); return p ? '<div class="fx-card" data-id="' + p.id + '"><small>' + esc(F.acct(p.by, d).nick) + '</small><b>' + esc(p.title || p.text.slice(0, 20)) + '</b><p>' + esc(p.text.slice(0, 50)) + '</p></div>' : '<div class="fx-card"><small>帖子已删除</small></div>'; })() : '';
            return '<div class="fx-m ' + (mine ? 'me' : '') + '"><span class="fx-av">' + F.avHtml(mine ? me : a, 30) + '</span><div class="fx-b">' + (m.text ? '<div>' + esc(m.text).replace(/\n/g, '<br>') + '</div>' : '') + card + '</div></div>';
        }).join('') : '<div class="stg-empty">打个招呼吧～</div>';
        box.querySelectorAll('.fx-card[data-id]').forEach(c => c.onclick = () => F.openPost(c.dataset.id)); box.scrollTop = box.scrollHeight;
    }

    // ---------- 分享帖子 ----------
    function share(postId) {
        const d = F.D(), p = d.posts.find(x => x.id === postId); if (!p) return; const recent = Object.keys(DM().th).map(k => DM().th[k]).sort((a, b) => b.ts - a.ts).slice(0, 4).map(t => t.k), c = getChar(F.cid());
        const rows = []; if (c) rows.push({ k: 'char:' + c.id, t: '私信 TA' }); recent.forEach(k => { if (rows.every(x => x.k !== k)) rows.push({ k: k, t: '最近私信' }); });
        stageOpen('分享这条帖子', (b) => {
            b.innerHTML = '<div class="fx-card" style="margin:0 0 10px"><small>' + esc(F.acct(p.by, d).nick) + '</small><b>' + esc(p.title || p.text.slice(0, 20)) + '</b><p>' + esc(p.text.slice(0, 60)) + '</p></div><div class="fx-dml">'
                + rows.map(x => { const a = F.acct(byOf(x.k), d); return '<div class="fx-dmr" data-k="' + x.k + '"><span class="fx-av">' + F.avHtml(a, 38) + '</span><div><b>' + esc(a.nick) + '</b><p>' + x.t + '</p></div></div>'; }).join('') + '<div class="fx-dmr" data-o="more"><span class="fx-av" style="background:var(--bg-color)">＋</span><div><b>选其他人私信</b><p>关注的人 / 路人网友</p></div></div><div class="fx-dmr" data-o="wx"><span class="fx-av" style="background:var(--bg-color)">微</span><div><b>发到微信聊天</b><p>和以前一样，发给 ' + esc(F.cname()) + '</p></div></div></div>';
            const go = (k) => { stageClose(); addMsg(k, 'me', '', postId); reply(k, '', postId); uiAlert('已私信分享', 1400); openDM(k); };
            b.querySelectorAll('.fx-dmr[data-k]').forEach(e => e.onclick = () => go(e.dataset.k));
            b.querySelector('[data-o="more"]').onclick = () => { stageClose(); pickPerson(go); };
            b.querySelector('[data-o="wx"]').onclick = () => { stageClose(); F.shareToChar(postId); };
        }, () => F.render());
    }

    // ---------- 路人偶尔来私信 ----------
    const NPC_HI = ['看到你发的内容啦，好喜欢这种感觉～', '嗨，路过来打个招呼', '你的帖子有被治愈到，谢谢你', '我也是这个爱好，交个朋友吧？', '刚刷到你的动态，关注了～'];
    function npcMaybeDM(force) {
        const dm = DM(); if (!force && (Date.now() - (dm.lastNpc || 0) < 4 * 3600 * 1000 || Math.random() > .3)) return;
        const d = F.D(), n = pick(d.npcs); dm.lastNpc = Date.now(); saveDM(dm);
        setTimeout(() => { addMsg('npc:' + n.id, 'them', pick(NPC_HI)); if (!dmEl) { try { uiAlert(n.nick + ' 给你发了私信', 2200); } catch (e) {} } }, rnd(4000, 12000));
    }

    function renderTab(keepScroll) { const b = $('fmBody'); if (!b) return; const sc = b.scrollTop; F.render(); if (keepScroll) b.scrollTop = sc; }
    window.__fmx = {
        render: function (tab, body, d) { if (tab === 'feed') renderFeed(body, d); else renderDMList(body, d); badge(); },
        profile: profile, share: share, openDM: openDM
    };
    new MutationObserver(() => { const a = $('forumApp'); if (a && !a.classList.contains('hidden')) { badge(); if (!sessionStorage.getItem('fmxOpened')) { sessionStorage.setItem('fmxOpened', '1'); npcMaybeDM(); } } else if (dmEl) { closeDM(); } }).observe($('forumApp'), { attributes: true, attributeFilter: ['class'] });
    badge();
})();
