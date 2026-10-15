/* forum.js —— 「广场」论坛（类似小红书 / ins）+ TA 主动发朋友圈。数据都只存在你自己的浏览器里 */
(function () {
    'use strict';
    const $ = (id) => document.getElementById(id), esc = (s) => escapeHtml(String(s == null ? '' : s));
    const KEY = 'forumData', GR = [['#f8dfe5', '#f3c9d4'], ['#dde8f1', '#c7d8e6'], ['#fbefd5', '#f4dcae'], ['#e4ecdf', '#cfdfc6'], ['#ebe3f3', '#d9cbe8'], ['#f6e6dc', '#efcfbb']];
    const rnd = (a, b) => a + Math.floor(Math.random() * (b - a + 1)), pick = (a) => a[Math.floor(Math.random() * a.length)], uid = () => 'f' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
    const NPC0 = [
        { id: 'n1', nick: '栗子今天吃饱了吗', handle: 'lizi_eats', bio: '一个爱探店的打工人' }, { id: 'n2', nick: '阿澈', handle: 'a_che', bio: '摄影 / 散步 / 听歌' }, { id: 'n3', nick: '雾里看花', handle: 'wuli_kanhua', bio: '记录一些很小的快乐' },
        { id: 'n4', nick: '夏天的橘子汽水', handle: 'juzi_qishui', bio: '这里是慢生活' }, { id: 'n5', nick: '早睡早起的猫', handle: 'zaoshui_cat', bio: '养了一只橘猫' }, { id: 'n6', nick: '林间', handle: 'linjian_', bio: '不爱说话，爱写字' },
        { id: 'n7', nick: '小满', handle: 'xiaoman_0521', bio: '今天也要好好吃饭' }, { id: 'n8', nick: '周日的下午', handle: 'sunday_pm', bio: '咖啡 · 书 · 窗边' }];
    const POST0 = [
        ['楼下新开的面包店，闻味道就走不动了', '本来只是下楼取个快递，结果被黄油的香味勾进去了。买了一个盐可颂，还热着，站在路边就吃完了。', ['探店', '日常'], 'n1'],
        ['今天的云太好看了', '下班路上抬头看到的，粉色和蓝色混在一起。拍了十几张都不如眼睛看到的好看，还是记在心里吧。', ['日常', '随手拍'], 'n2'],
        ['一个人也要好好吃饭', '给自己煮了一碗小馄饨，打了个蛋，撒了葱花。很普通，但是喝完汤整个人都暖了。', ['一人食', '治愈'], 'n3'],
        ['秋天第一杯热奶茶', '降温了，终于可以光明正大地喝热的了。你们秋天第一杯是什么？', ['奶茶', '秋天'], 'n4'],
        ['我家猫又在凌晨跑酷', '三点钟，它从客厅冲到卧室，再冲回来，像有人追它。我已经习惯了，翻个身继续睡。', ['养猫', '日常'], 'n5'],
        ['最近在读的一句话', '“慢慢来，比较快。”不知道在哪看到的，贴在了桌前。', ['读书', '碎碎念'], 'n6'],
        ['周末小计划', '周六睡到自然醒，下午去公园晒太阳，晚上和朋友吃火锅。写下来就觉得已经很幸福了。', ['周末', '计划'], 'n7'],
        ['窗边的位置永远是最好的', '点了杯拿铁，带了本没看完的书，雨点打在玻璃上。一个下午就这样过去了。', ['咖啡', '下雨天'], 'n8'],
        ['AI 陪伴真的会让人心里软一点', '晚上跟 TA 聊了会儿今天的烦心事，没有被说教，就是被认真听着。睡前觉得好多了。', ['人机恋', '陪伴'], 'n3'],
        ['通勤路上的小确幸', '地铁上居然有座，还刚好放到了喜欢的歌。今天运气不错！', ['通勤', '小确幸'], 'n2']];
    const CMT0 = ['太好了吧！', '看着就好治愈', '好喜欢这种氛围', '我也想试试', '哈哈哈哈同感', '收藏了，谢谢分享', '这个太戳我了', '好温柔的一天', '冲了冲了', '羡慕～'];

    // ---------- 数据 ----------
    function D() {
        let d = null; try { d = JSON.parse(store.getItem(KEY) || 'null'); } catch (e) {}
        if (!d || !d.posts) {
            d = { npcs: NPC0.slice(), posts: [], follows: [], me: null, seen: 0 };
            POST0.forEach((p, i) => d.posts.push({ id: uid() + i, by: { t: 'npc', id: p[3] }, title: p[0], text: p[1], tags: p[2], ts: Date.now() - (i + 1) * rnd(40, 200) * 60000, likeN: rnd(30, 880), liked: false, comments: [], g: i % GR.length }));
            S(d);
        }
        d.follows = d.follows || []; d.npcs = d.npcs || NPC0.slice(); return d;
    }
    function S(d) { try { store.setItem(KEY, JSON.stringify(d)); } catch (e) { uiAlert('空间不够了，试试删掉一些带图片的帖子'); } }
    const myAcct = (d) => d.me || { nick: store.getItem('myName') || '我', handle: 'me_' + (store.getItem('myName') ? 'user' : 'here'), bio: '' };
    const cid = () => getActiveCharId(), cname = () => activeCharName() || 'TA';
    function acct(by, d) {
        d = d || D();
        if (by.t === 'me') { const m = myAcct(d); return { nick: m.nick, handle: m.handle, bio: m.bio, av: m.av ? avatarInner(m.av, '') : myAvatarInner(), self: true }; }
        if (by.t === 'char') { const c = getChar(by.id); if (!c) return { nick: '已删除', handle: '', av: '·' }; const f = c.forum || {}; return { nick: f.nick || c.name, handle: f.handle || '', bio: f.bio || '', av: f.av ? avatarInner(f.av, '') : charAvatarInner(c), char: c }; }
        const n = d.npcs.find(x => x.id === by.id) || { nick: '路人', handle: '' }; return { nick: n.nick, handle: n.handle, bio: n.bio || '', av: esc(String(n.nick).slice(0, 1)), npc: n, col: GR[(n.id || '').length % GR.length][1] };
    }
    const avHtml = (a, s) => '<span class="fm-av" style="' + (s ? 'width:' + s + 'px;height:' + s + 'px;' : '') + (a.col ? 'background:' + a.col : '') + '">' + a.av + '</span>';
    const num = (n) => n >= 10000 ? (n / 10000).toFixed(1) + 'w' : n >= 1000 ? (n / 1000).toFixed(1) + 'k' : String(n);
    const key = (by) => by.t + ':' + by.id;
    const vis = (c) => !c.showAt || c.showAt <= Date.now();

    // ---------- 接入桌面 ----------
    try {
        if (allApps.indexOf('forum') < 0) allApps.push('forum');
        if (!HOME_APPS.some(a => a.id === 'forum')) HOME_APPS.push({ id: 'forum', name: '广场', cls: 'forum-icon', face: '(◕ᴗ◕)', go: () => openApp('forum') });
        GLYPH.forum = '<rect x="4" y="4.5" width="7" height="9" rx="2.2"/><rect x="13" y="4.5" width="7" height="6" rx="2.2"/><rect x="4" y="15.5" width="7" height="4" rx="2"/><rect x="13" y="12.5" width="7" height="7" rx="2.2"/>';
    } catch (e) {}

    let tab = 'find', openedPost = null, fcat = '推荐';
    function ensure() {
        if ($('forumApp')) return;
        const el = document.createElement('div'); el.id = 'forumApp'; el.className = 'app-screen hidden';
        el.innerHTML = '<div class="app-header"><button onclick="goHome()">‹ 返回</button><span>广场</span><button class="hdr-btn" id="fmNew">发帖</button></div><div class="mm-tabs fm-tabs"><button data-t="find" class="on">发现</button><button data-t="feed">推文</button><button data-t="dm">私信</button><button data-t="follow">关注</button><button data-t="me">我的</button></div><div class="scroll-area padded" id="fmBody"></div>';
        ($('callScreen') ? $('callScreen').parentElement : document.body).appendChild(el);
        el.querySelectorAll('.fm-tabs button').forEach(b => b.onclick = () => { tab = b.dataset.t; render(); });
        $('fmNew').onclick = () => compose();
        new MutationObserver(() => { if (!el.classList.contains('hidden')) { render(); firstRun(); } }).observe(el, { attributes: true, attributeFilter: ['class'] });
    }
    function render() {
        const el = $('forumApp'); if (!el) return; el.querySelectorAll('.fm-tabs button').forEach(b => b.classList.toggle('on', b.dataset.t === tab));
        const d = D(), body = $('fmBody'); if (!body) return;
        if (tab === 'me') return renderMe(d, body);
        if ((tab === 'feed' || tab === 'dm') && window.__fmx) return window.__fmx.render(tab, body, d);
        if (tab === 'feed' || tab === 'dm') tab = 'find';
        let ps = d.posts.filter(p => vis({ showAt: p.showAt })).slice().sort((a, b) => b.ts - a.ts);
        if (tab === 'follow') { const f = new Set(d.follows.concat(getChars().filter(c => c.forum).map(c => 'char:' + c.id))); ps = ps.filter(p => f.has(key(p.by)) || p.by.t === 'me'); }
        if (tab === 'find' && fcat !== '推荐' && window.__fmHot) ps = ps.filter(p => __fmHot.inCat(p, fcat));
        let h = tab === 'find' ? (window.__fmHot ? __fmHot.chipsHtml(fcat) : '') + '<div class="stg-btns" style="margin:4px 0 12px"><button class="ghost" id="fmRef">' + (fcat === '推荐' ? '刷新，看看新帖子' : '刷新「' + fcat + '」新帖') + '</button><button class="ghost" id="fmHot">热点库</button><button class="ghost" id="fmRec">让 ' + esc(cname()) + ' 推荐一个</button></div><div class="stg-btns" style="margin:-6px 0 12px"><button class="ghost" id="fmCP">让 ' + esc(cname()) + ' 现在发一条</button></div>' : '';
        h += ps.length ? '<div class="fm-grid">' + ps.map(card(d)).join('') + '</div>' : '<div class="stg-empty">' + (tab === 'follow' ? '还没有关注动态。去「发现」里关注喜欢的人，或让 TA 开个账号发帖吧。' : fcat !== '推荐' ? '「' + fcat + '」分类还没有帖子，点上面的「刷新」生成一些吧' : '这里还空空的') + '</div>';
        body.innerHTML = h;
        body.querySelectorAll('.fm-card').forEach(e => e.onclick = () => openPost(e.dataset.id));
        body.querySelectorAll('[data-fc]').forEach(b => b.onclick = () => { fcat = b.dataset.fc; render(); }); if ($('fmHot')) $('fmHot').onclick = hotSheet;
        if ($('fmCP')) $('fmCP').onclick = async () => { const c = getChar(cid()); if (!c) { uiAlert('先创建并选择一个角色'); return; } if (needKey()) return; if (!(await ensureAcct(c.id))) return; $('fmCP').disabled = true; $('fmCP').textContent = c.name + ' 在写…'; const p = await charPost(c.id, false); if (!p) uiAlert('这次没发出去，再试一次'); render(); };
        if ($('fmRef')) $('fmRef').onclick = refreshFeed; if ($('fmRec')) $('fmRec').onclick = charRecommend;
    }
    const card = (d) => (p) => {
        const a = acct(p.by, d), g = GR[(p.g || 0) % GR.length], cover = p.img ? '<div class="fm-cover img" style="background-image:url(\'' + p.img + '\')"></div>' : '<div class="fm-cover" style="background:linear-gradient(150deg,' + g[0] + ',' + g[1] + ')"><span>' + esc((p.title || p.text).slice(0, 26)) + '</span></div>';
        return '<div class="fm-card" data-id="' + p.id + '">' + cover + '<div class="fm-ct">' + esc(p.title ? p.text.slice(0, 36) : (p.img ? p.text.slice(0, 30) : '')) + '</div><div class="fm-cf">' + avHtml(a, 18) + '<span class="fm-cn">' + esc(a.nick) + '</span><span class="fm-lk">' + svg('heart', 12) + ' ' + num((p.likeN || 0) + (p.liked ? 1 : 0)) + '</span></div></div>';
    };
    function svg(n, s) { const P = { heart: '<path d="M12 19s-6.5-3.9-6.5-8.6A3.4 3.4 0 0 1 12 8.5a3.4 3.4 0 0 1 6.5 1.9C18.5 15.1 12 19 12 19z"/>', chat: '<path d="M5 6.5h14a1.5 1.5 0 0 1 1.5 1.5v8a1.5 1.5 0 0 1-1.5 1.5H11l-4 3v-3H5A1.5 1.5 0 0 1 3.5 16V8A1.5 1.5 0 0 1 5 6.5z"/>', send: '<path d="M20 4L10 14M20 4l-6 16-4-6-6-4z"/>' }; return '<svg class="li" width="' + s + '" height="' + s + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">' + P[n] + '</svg>'; }

    // ---------- 我的 ----------
    function renderMe(d, body) {
        const m = myAcct(d), mine = d.posts.filter(p => p.by.t === 'me').sort((a, b) => b.ts - a.ts);
        let h = '<div class="fm-prof">' + avHtml({ av: m.av ? avatarInner(m.av, '') : myAvatarInner() }, 56) + '<div><b>' + esc(m.nick) + '</b><small>@' + esc(m.handle) + '</small><p>' + esc(m.bio || '还没有简介') + '</p></div><button id="fmEditMe">编辑</button></div>';
        h += '<div class="stg-sub">TA 的账号</div>';
        const cs = getChars(); h += cs.length ? cs.map(c => c.forum ? '<div class="fm-acct" data-c="' + c.id + '">' + avHtml({ av: c.forum.av ? avatarInner(c.forum.av, '') : charAvatarInner(c) }, 38) + '<div><b>' + esc(c.forum.nick) + '</b><small>@' + esc(c.forum.handle) + ' · ' + esc(c.forum.bio || '') + '</small></div><i>编辑</i></div>' : '<div class="fm-acct" data-c="' + c.id + '">' + avHtml({ av: charAvatarInner(c) }, 38) + '<div><b>' + esc(c.name) + '</b><small>还没有论坛账号</small></div><i>开通</i></div>').join('') : '<div class="stg-empty">先去通讯录创建角色</div>';
        h += '<div class="fm-set"><label><span>TA 会自己发帖、评论</span><input type="checkbox" id="fmAuto"' + (store.getItem('autoForumOn') === 'false' ? '' : ' checked') + '></label><p class="hint-line">打开网页的时候，TA 会按自己的节奏发帖；你离开一阵再回来，也会看到 TA 这段时间发的。</p></div>';
        h += '<div class="stg-sub">我的帖子（' + mine.length + '）</div>' + (mine.length ? '<div class="fm-grid">' + mine.map(card(d)).join('') + '</div>' : '<div class="stg-empty">还没发过帖子，点右上角「发帖」</div>');
        const notes = []; mine.forEach(p => p.comments.filter(vis).forEach(c => notes.push({ p, c }))); notes.sort((a, b) => b.c.ts - a.c.ts);
        if (notes.length) h += '<div class="stg-sub">收到的评论</div>' + notes.slice(0, 8).map(n => '<div class="stg-row" data-p="' + n.p.id + '"><i>' + esc(n.c.name.slice(0, 2)) + '</i><div><b>' + esc(n.c.name) + '</b><p>' + esc(n.c.text) + '</p><em>《' + esc((n.p.title || n.p.text).slice(0, 14)) + '》· ' + agoText(n.c.ts) + '</em></div></div>').join('');
        body.innerHTML = h;
        $('fmEditMe').onclick = editMe; $('fmAuto').onchange = (e) => store.setItem('autoForumOn', e.target.checked ? 'true' : 'false');
        body.querySelectorAll('.fm-acct').forEach(e => e.onclick = () => acctSheet(e.dataset.c));
        body.querySelectorAll('.fm-card').forEach(e => e.onclick = () => openPost(e.dataset.id)); body.querySelectorAll('[data-p]').forEach(e => e.onclick = () => openPost(e.dataset.p));
    }
    // 广场头像：可以单独上传，不用和微信头像一样
    function avRow(cur, fallbackHtml, onSet) {
        const id = 'av' + Math.random().toString(36).slice(2, 6);
        const html = '<div class="stg-sub">头像</div><div class="avatar-upload-row"><div class="avatar-preview" id="' + id + 'P">' + (cur ? avatarInner(cur, '') : fallbackHtml) + '</div><input type="file" id="' + id + 'F" accept="image/*" style="display:none"><button type="button" class="btn-small" id="' + id + 'U">上传头像</button><button type="button" class="btn-small" id="' + id + 'R">用默认头像</button></div>';
        return { html: html, bind: () => { $(id + 'U').onclick = () => $(id + 'F').click(); $(id + 'F').onchange = (e) => { const f = e.target.files[0]; if (!f) return; readImageCompressed(f, (url) => { $(id + 'P').innerHTML = avatarInner(url, ''); onSet(url); }, 160); e.target.value = ''; }; $(id + 'R').onclick = () => { $(id + 'P').innerHTML = fallbackHtml; onSet(''); }; } };
    }
    function hotSheet() {
        stageOpen('热点库', (b) => {
            b.innerHTML = '<p class="hint-line">小手机不能联网刷抖音热榜，但你可以把今天刷到的热梗、热点复制进来（一行一个）。点「刷新」时，网友们会围绕它们发帖、玩梗；没填的时候，会按日期和季节自动聊应景的话题。</p><textarea id="hotT" class="input-textarea" style="min-height:170px" placeholder="例如：\n某个新梗：意思和用法\n最近大家都在聊的话题">' + esc(__fmHot.hotList().join('\n')) + '</textarea><div class="stg-btns"><button class="ghost" id="hotClr">清空</button><button id="hotOk">保存</button></div>';
            $('hotOk').onclick = () => { __fmHot.setHotList($('hotT').value.split('\n').map(x => x.trim()).filter(Boolean)); uiAlert('已保存，下次刷新会用上'); stageClose(); };
            $('hotClr').onclick = () => { $('hotT').value = ''; };
        }, render);
    }
    function editMe() {
        stageOpen('我的论坛账号', (b) => {
            const m = myAcct(D()); let av = m.av || ''; const ar = avRow(av, myAvatarInner(), (u) => { av = u; });
            b.innerHTML = ar.html + '<div class="stg-sub">昵称</div><input id="meN" class="input-text" maxlength="14" value="' + esc(m.nick) + '"><div class="stg-sub">账号 ID</div><input id="meH" class="input-text" maxlength="18" value="' + esc(m.handle) + '"><div class="stg-sub">简介</div><input id="meB" class="input-text" maxlength="40" value="' + esc(m.bio || '') + '" placeholder="一句话介绍自己"><div class="stg-btns"><button id="meOk">保存</button></div>'; ar.bind();
            $('meOk').onclick = () => { const d = D(); d.me = { nick: $('meN').value.trim() || '我', handle: $('meH').value.trim().replace(/[^\w.]/g, '') || 'me_user', bio: $('meB').value.trim(), av: av }; S(d); stageClose(); };
        }, render);
    }
    // 角色账号：自己设置 / 按人设自动生成
    function acctSheet(charId, afterCb) {
        const c = getChar(charId); if (!c) return;
        stageOpen(c.name + ' 的论坛账号', (b) => {
            const f = c.forum || {}; let cav = f.av || ''; const car = avRow(cav, charAvatarInner(c), (u) => { cav = u; });
            b.innerHTML = '<div class="mm-days" id="acMode"><button data-m="manual" class="on">我来设置</button><button data-m="auto">按人设自动生成</button></div><p class="hint-line" id="acHint">自己填写 TA 的昵称、ID 和简介。</p>'
                + car.html + '<div class="stg-sub">昵称</div><input id="acN" class="input-text" maxlength="14" value="' + esc(f.nick || c.name) + '"><div class="stg-sub">账号 ID（英文/数字）</div><input id="acH" class="input-text" maxlength="18" value="' + esc(f.handle || '') + '" placeholder="比如 shenyan_"><div class="stg-sub">简介</div><input id="acB" class="input-text" maxlength="40" value="' + esc(f.bio || '') + '"><div class="stg-sub">常发的话题（用逗号隔开）</div><input id="acT" class="input-text" value="' + esc((f.tags || []).join('，')) + '">'
                + '<div class="stg-btns"><button class="ghost hidden" id="acGen">按人设生成</button><button id="acOk">保存账号</button></div>';
            car.bind(); b.querySelectorAll('#acMode button').forEach(x => x.onclick = () => { b.querySelectorAll('#acMode button').forEach(y => y.classList.toggle('on', y === x)); const auto = x.dataset.m === 'auto'; $('acGen').classList.toggle('hidden', !auto); $('acHint').textContent = auto ? '根据 ' + c.name + ' 的人设，让 AI 起昵称、写简介，生成后还能改。' : '自己填写 TA 的昵称、ID 和简介。'; if (auto) $('acGen').click(); });
            $('acGen').onclick = async () => {
                if (needKey()) return; $('acGen').disabled = true; $('acGen').textContent = '生成中…';
                try {
                    const t = await callPersona(charId, '请你以角色本人的身份，给自己在论坛（类似小红书）起一个账号。要符合你的人设和气质，像真人会起的昵称，不要直接用「角色名+官方」这种。只输出 JSON：{"nick":"昵称（2~8字）","handle":"英文或拼音ID，可含数字下划线","bio":"一句话简介（25字内，有你的语气）","tags":["常发话题1","话题2","话题3"]}', 1.0);
                    const o = parseJSONLoose(t); if (!o || !o.nick) throw new Error('bad');
                    $('acN').value = String(o.nick).slice(0, 14); $('acH').value = String(o.handle || '').replace(/[^\w.]/g, '').slice(0, 18); $('acB').value = String(o.bio || '').slice(0, 40); $('acT').value = (o.tags || []).join('，');
                } catch (e) { uiAlert('这次没生成好，再点一次试试'); }
                $('acGen').disabled = false; $('acGen').textContent = '重新生成';
            };
            $('acOk').onclick = () => {
                const nick = $('acN').value.trim(); if (!nick) { uiAlert('昵称不能为空'); return; }
                const chars = getChars(), cc = chars.find(x => x.id === charId); cc.forum = { nick, handle: $('acH').value.trim().replace(/[^\w.]/g, '') || ('user_' + charId.slice(-4)), bio: $('acB').value.trim(), tags: $('acT').value.split(/[,，、\s]+/).filter(Boolean).slice(0, 5), ts: Date.now(), av: cav }; saveChars(chars);
                stageClose(); if (afterCb) afterCb();
            };
        }, render);
    }
    function ensureAcct(charId) { return new Promise((ok) => { const c = getChar(charId); if (c && c.forum) return ok(true); uiConfirm('「' + (c ? c.name : 'TA') + '」还没有论坛账号，现在去开通吗？', { ok: '去开通' }).then(y => { if (!y) return ok(false); acctSheet(charId, () => ok(true)); }); }); }
    function firstRun() { /* 第一次打开：提示给 TA 开账号 */ if (store.getItem('forumHint')) return; store.setItem('forumHint', '1'); const c = getChar(cid()); if (c && !c.forum) setTimeout(() => acctSheet(c.id), 400); }

    // ---------- 发帖 ----------
    function compose() {
        stageOpen('发帖', (b) => {
            let img = '';
            b.innerHTML = '<input id="cpT" class="input-text" maxlength="30" placeholder="标题（选填）"><textarea id="cpTx" rows="6" placeholder="分享点什么…今天的心情、看到的、吃到的。"></textarea><input id="cpTg" class="input-text" placeholder="话题，用逗号隔开（选填）" style="margin-top:10px"><div class="mm-pick"><button id="cpIb" class="ghost">放一张图</button><input id="cpIf" type="file" accept="image/*" style="display:none"><div id="cpIp"></div></div><div class="stg-btns"><button id="cpGo">发布</button></div>';
            $('cpTx').style.cssText = 'width:100%;box-sizing:border-box;margin-top:10px;border:1px solid var(--border-color);background:var(--card-bg);color:var(--theme-dark);border-radius:16px;padding:12px;font-size:14px;line-height:1.7;resize:none;font-family:inherit';
            $('cpIb').onclick = () => $('cpIf').click(); $('cpIf').onchange = () => { const f = $('cpIf').files[0]; if (f) readImageCompressed(f, (u) => { img = u; $('cpIp').innerHTML = '<img src="' + u + '" style="height:46px;border-radius:10px">'; }, 800); };
            $('cpGo').onclick = () => {
                const text = $('cpTx').value.trim(); if (!text && !img) { uiAlert('写点什么吧'); return; }
                const d = D(), p = { id: uid(), by: { t: 'me', id: 'me' }, title: $('cpT').value.trim(), text: text || '', tags: $('cpTg').value.split(/[,，、\s#]+/).filter(Boolean).slice(0, 4), img, ts: Date.now(), likeN: 0, liked: false, comments: [], g: rnd(0, 5) };
                d.posts.unshift(p); S(d); try { logActivity(cid(), 'forum', '我在广场发了一条帖子：' + (p.title || text).slice(0, 30)); } catch (e) {} stageClose(); tab = 'me'; render(); reactTo(p.id);
            };
        }, render);
    }

    // ---------- 帖子详情 ----------
    function openPost(id) {
        const d0 = D(), p0 = d0.posts.find(x => x.id === id); if (!p0) return; openedPost = id;
        stageOpen('帖子', (b) => {
            const draw = () => {
                const d = D(), p = d.posts.find(x => x.id === id); if (!p) return; const a = acct(p.by, d), fol = d.follows.indexOf(key(p.by)) >= 0, g = GR[(p.g || 0) % GR.length];
                const cm = p.comments.filter(vis).sort((x, y) => x.ts - y.ts);
                b.innerHTML = '<div class="fm-dh">' + avHtml(a, 38) + '<div><b>' + esc(a.nick) + '</b><small>@' + esc(a.handle) + '</small></div>' + (a.self ? '' : a.char ? '<i class="fm-tag">TA</i>' : '<button class="fm-fol' + (fol ? ' on' : '') + '" id="pFol">' + (fol ? '已关注' : '关注') + '</button>') + '</div>'
                    + (p.img ? '<img class="fm-dimg" src="' + p.img + '">' : '<div class="fm-dcover" style="background:linear-gradient(150deg,' + g[0] + ',' + g[1] + ')">' + esc((p.title || p.text).slice(0, 36)) + '</div>')
                    + (p.title ? '<h3 class="fm-dt">' + esc(p.title) + '</h3>' : '') + '<p class="fm-dx">' + esc(p.text).replace(/\n/g, '<br>') + '</p>' + (p.tags && p.tags.length ? '<div class="fm-tags">' + p.tags.map(t => '<span>#' + esc(t) + '</span>').join('') + '</div>' : '') + '<small class="fm-time">' + agoText(p.ts) + '</small>'
                    + '<div class="fm-act"><button id="pLike" class="' + (p.liked ? 'on' : '') + '">' + svg('heart', 18) + ' ' + num((p.likeN || 0) + (p.liked ? 1 : 0)) + '</button><button id="pShare">' + svg('send', 18) + ' 分享</button>' + (a.self ? '<button id="pDel">删除</button>' : '') + '</div>'
                    + '<div class="stg-sub">评论 ' + cm.length + '</div>' + (cm.length ? cm.map(c => '<div class="fm-cm"><span class="fm-cmn">' + esc(c.name) + (c.by && c.by.t === 'char' ? ' <i class="fm-tag">TA</i>' : c.by && c.by.t === 'me' ? ' <i class="fm-tag me">我</i>' : '') + '</span><p>' + esc(c.text) + '</p></div>').join('') : '<div class="stg-empty" style="padding:10px">还没有评论，来说第一句吧</div>')
                    + '<div class="fm-cin"><input id="pCin" class="input-text" placeholder="说点什么…" maxlength="120"><button id="pCgo">发送</button></div>';
                $('pLike').onclick = () => { const dd = D(), pp = dd.posts.find(x => x.id === id); pp.liked = !pp.liked; S(dd); draw(); };
                if ($('pFol')) $('pFol').onclick = () => { const dd = D(), k = key(p.by), i = dd.follows.indexOf(k); if (i >= 0) dd.follows.splice(i, 1); else dd.follows.push(k); S(dd); draw(); };
                if ($('pDel')) $('pDel').onclick = async () => { if (await uiConfirm('删除这条帖子吗？')) { const dd = D(); dd.posts = dd.posts.filter(x => x.id !== id); S(dd); stageClose(); } };
                $('pShare').onclick = () => (window.__fmx ? window.__fmx.share(id) : shareToChar(id));
                if (window.__fmx) b.querySelectorAll('.fm-dh .fm-av,.fm-dh b').forEach(x => x.onclick = () => window.__fmx.profile(p.by));
                const send = () => { const t = $('pCin').value.trim(); if (!t) return; const dd = D(), pp = dd.posts.find(x => x.id === id); pp.comments.push({ id: uid(), by: { t: 'me', id: 'me' }, name: myAcct(dd).nick, text: t, ts: Date.now() }); S(dd); draw(); replyTo(id, t); };
                $('pCgo').onclick = send; $('pCin').onkeydown = (e) => { if (e.key === 'Enter') send(); };
            };
            draw(); b._draw = draw; b.__fm = id;
        }, () => { openedPost = null; render(); });
    }
    const redraw = () => { const b = $('stgB'); if (openedPost && b && b._draw && b.isConnected) { const i = $('pCin') ? $('pCin').value : ''; b._draw(); if (i && $('pCin')) $('pCin').value = i; } else if (!$('forumApp').classList.contains('hidden') && !openedPost) render(); };

    // ---------- 互动（NPC / TA 评论，会延迟出现） ----------
    const NPCsys = '你是一个中文社区（类似小红书）的内容生成器，输出口语化、真实自然、不重复的网友评论或帖子，不要出现违法、辱骂、低俗内容。只输出 JSON。';
    async function reactTo(postId) {
        const d = D(), p = d.posts.find(x => x.id === postId); if (!p) return; const now = Date.now(), out = [];
        // 先给 NPC 一些本地的点赞/评论，保证没填 API 也有互动
        const names = d.npcs.slice().sort(() => Math.random() - .5).slice(0, rnd(2, 3));
        let npc = names.map(n => ({ by: { t: 'npc', id: n.id }, name: n.nick, text: pick(CMT0) }));
        if (API_KEY) { try { const t = await chatCompletion([{ role: 'system', content: NPCsys }, { role: 'user', content: '有人发了一条帖子：「' + (p.title ? p.title + '。' : '') + p.text + '」。请生成 3 条不同网友的评论，口吻各异、像真人，每条 6~30 字，针对内容具体回应。可以用这些昵称：' + d.npcs.map(n => n.nick).join('、') + '。输出 JSON：{"comments":[{"nick":"昵称","text":"评论"}]}' }], 1.0); const o = parseJSONLoose(t); if (o && Array.isArray(o.comments) && o.comments.length) { npc = o.comments.slice(0, 4).map(c => { const n = d.npcs.find(x => x.nick === c.nick) || pick(d.npcs); return { by: { t: 'npc', id: n.id }, name: n.nick, text: String(c.text).slice(0, 60) }; }); } } catch (e) {} }
        npc.forEach((c, i) => out.push(Object.assign({ id: uid(), ts: now + (i + 1) * rnd(5, 30) * 1000 }, c, { showAt: now + (i + 1) * rnd(6, 28) * 1000 })));
        // TA 的评论（有账号才会）
        const c = getChar(cid()); let charLike = false;
        if (c && c.forum && API_KEY && Math.random() < .9) { try { const t = oneLine(await callPersona(c.id, '我在论坛（用户名' + myAcct(d).nick + '）发了一条帖子：「' + (p.title ? p.title + '。' : '') + p.text + '」。你刷到了，请以角色本人的口吻评论一句：口语、有你的语气、有感情，像对象那样，不超过40字。只输出评论。', 1.0)); if (t) out.push({ id: uid(), by: { t: 'char', id: c.id }, name: c.forum.nick, text: t, ts: now + 9000, showAt: now + rnd(8, 25) * 1000 }); charLike = true; } catch (e) {} }
        const dd = D(), pp = dd.posts.find(x => x.id === postId); if (!pp) return; pp.comments = pp.comments.concat(out); pp.likeN = (pp.likeN || 0) + rnd(1, 9); S(dd); schedulePoll(); try { addIntimacy(cid(), 1); } catch (e) {}
    }
    async function replyTo(postId, text) {
        const d = D(), p = d.posts.find(x => x.id === postId); if (!p) return; const now = Date.now(), out = [];
        const c = getChar(cid());
        if (p.by.t === 'char' && c && p.by.id === c.id && API_KEY) { try { const t = oneLine(await callPersona(c.id, '这是你在论坛发的帖子：「' + (p.title ? p.title + '。' : '') + p.text + '」。我评论说：「' + text + '」。请你以角色本人的口吻回复我一句，像在评论区和对象互动，口语、俏皮或温柔，不超过40字。只输出回复。', 1.0)); if (t) out.push({ id: uid(), by: { t: 'char', id: c.id }, name: c.forum ? c.forum.nick : c.name, text: '回复 ' + myAcct(d).nick + '：' + t, ts: now, showAt: now + rnd(5, 18) * 1000 }); } catch (e) {} }
        else if (Math.random() < .55) { const n = pick(d.npcs); out.push({ id: uid(), by: { t: 'npc', id: n.id }, name: n.nick, text: pick(['哈哈哈同感', '确实！', '我也这么觉得', '+1', '懂你']), ts: now, showAt: now + rnd(8, 40) * 1000 }); }
        if (!out.length) return; const dd = D(), pp = dd.posts.find(x => x.id === postId); pp.comments = pp.comments.concat(out); S(dd); schedulePoll();
    }
    let poll = null;
    function schedulePoll() { if (poll) return; poll = setInterval(() => { try { const d = D(), now = Date.now(); let pending = false; d.posts.forEach(p => p.comments.forEach(c => { if (c.showAt && c.showAt > now) pending = true; else if (c.showAt && !c.shown) { c.shown = true; if (c.by && c.by.t === 'char') { const ch = getChar(c.by.id); if (ch) showBanner(ch, '在广场评论了你：' + c.text.slice(0, 26)); } } })); S(d); redraw(); if (!pending) { clearInterval(poll); poll = null; } } catch (e) { clearInterval(poll); poll = null; } }, 3000); }

    // ---------- 刷新信息流（AI 生成 NPC 帖子；没 API 就本地补几条） ----------
    async function refreshFeed() {
        const btn = $('fmRef'); if (btn) { btn.disabled = true; btn.textContent = '刷新中…'; }
        const d = D(); let made = [];
        if (API_KEY) {
            try {
                const c = getChar(cid()), hint = c ? '社区里最近有不少人在聊陪伴、恋爱、日常小确幸；' : '';
                const t = await chatCompletion([{ role: 'system', content: NPCsys }, { role: 'user', content: window.__fmHot ? __fmHot.prompt(fcat, d.npcs.map(n => n.nick)) : ('请为一个类似小红书的社区生成 6 条风格各异的新帖子，话题可以包括：日常、美食探店、穿搭、养宠物、读书、旅行、情感树洞、工作吐槽、人机恋/AI 陪伴等。' + hint + '每条包含发帖人（昵称有个性，不要重复这些：' + d.npcs.map(n => n.nick).join('、') + '）、标题（≤16字）、正文（40~120字，口语、有细节、像真人）、1~3 个话题标签。内容必须健康、不涉及违法低俗。输出 JSON：{"posts":[{"nick":"","handle":"英文ID","bio":"简介","title":"","text":"","tags":[""]}]}') }], 1.0);
                const o = parseJSONLoose(t); if (o && Array.isArray(o.posts)) made = o.posts.slice(0, 6);
            } catch (e) {}
        }
        if (!made.length && window.__fmHot) made = __fmHot.fallback(fcat, d.posts.map(x => x.title));
        if (!made.length) { const pool = POST0.filter(p => !d.posts.some(x => x.title === p[0])); if (pool.length) made = pool.slice(0, 3).map(p => ({ _n: p[3], title: p[0], text: p[1], tags: p[2] })); else { uiAlert(API_KEY ? '这次没刷到新的，再试一次吧' : '填好 API Key 后，刷新能看到更多新鲜帖子哦'); } }
        const dd = D(); made.forEach((m, i) => {
            let nid = m._n; if (!nid) { let n = dd.npcs.find(x => x.nick === m.nick); if (!n) { n = { id: 'n' + Date.now().toString(36) + i, nick: String(m.nick || '路人').slice(0, 12), handle: String(m.handle || 'user' + i).replace(/[^\w.]/g, '').slice(0, 16), bio: String(m.bio || '').slice(0, 30) }; dd.npcs.push(n); } nid = n.id; }
            dd.posts.unshift({ id: uid() + i, by: { t: 'npc', id: nid }, title: String(m.title || '').slice(0, 24), text: String(m.text || '').slice(0, 300), tags: (m.tags || []).slice(0, 3), ts: Date.now() - i * rnd(2, 20) * 60000, likeN: rnd(8, 1200), liked: false, comments: [], g: rnd(0, 5), cat: String(m.cat || (fcat !== '推荐' ? fcat : '')) });
        }); dd.posts = dd.posts.slice(0, 120); S(dd); render();
    }

    // ---------- TA 发帖 / 推荐 / 分享 ----------
    async function charPost(charId, auto, atTs) {
        const c = getChar(charId); if (!c || !API_KEY) return false; if (!c.forum) return false;
        try {
            const f = c.forum, h = atTs ? new Date(atTs).getHours() : new Date().getHours();
            const t = await callPersona(charId, '你在论坛（类似小红书）上的账号叫「' + f.nick + '」，简介「' + (f.bio || '') + '」，常发话题：' + ((f.tags || []).join('、') || '日常') + '。请你以角色本人的身份发一条帖子，这条是' + h + '点发的，要贴合那个时间你可能在做的事和心情。可以是你自己的生活、想法、心得、小发现，口语、有你的语气和细节；不要编造和我共同经历过但其实没发生的事；不要提自己是 AI。只输出 JSON：{"title":"标题（≤16字）","text":"正文 40~140 字","tags":["话题1","话题2"]}', 1.0);
            const o = parseJSONLoose(t); if (!o || !o.text) return false;
            const d = D(), p = { id: uid(), by: { t: 'char', id: charId }, title: String(o.title || '').slice(0, 24), text: String(o.text).slice(0, 400), tags: (o.tags || []).slice(0, 3), ts: atTs || Date.now(), likeN: rnd(20, 400), liked: false, comments: [], g: rnd(0, 5) };
            const names = d.npcs.slice().sort(() => Math.random() - .5).slice(0, 2); names.forEach((n, i) => p.comments.push({ id: uid(), by: { t: 'npc', id: n.id }, name: n.nick, text: pick(CMT0), ts: p.ts + (i + 1) * 60000 }));
            d.posts.unshift(p); S(d); if (auto) showBanner(c, '发了一条新帖子：' + (p.title || p.text).slice(0, 20)); try { addFeed(charId, '在广场发了帖子：' + (p.title || p.text.slice(0, 20)), '论坛'); } catch (e) {} return p;
        } catch (e) { return false; }
    }
    async function charRecommend() {
        const c = getChar(cid()); if (!c) { uiAlert('先创建并选择一个角色'); return; } if (needKey()) return; if (!(await ensureAcct(c.id))) return;
        const btn = $('fmRec'); if (btn) { btn.disabled = true; btn.textContent = c.name + ' 在翻帖子…'; }
        const d = D(), ps = d.posts.filter(p => p.by.t !== 'me').slice(0, 14); const t = await callPersona(c.id, '你在论坛上刷帖子，想推荐一条给我。可选帖子：\n' + ps.map((p, i) => i + '. 《' + (p.title || p.text.slice(0, 12)) + '》' + p.text.slice(0, 40)).join('\n') + '\n选一条你觉得我会喜欢、或者让你想起我的，并以你的口吻对我说一两句话。只输出 JSON：{"i":序号,"say":"你对我说的话（口语，不超过50字）"}', 1.0).catch(() => '');
        const o = parseJSONLoose(t), p = o && ps[+o.i]; if (btn) { btn.disabled = false; btn.textContent = '让 ' + c.name + ' 推荐一个'; } if (!p) { uiAlert('这次没推荐成，再试一次'); return; }
        sendPostToChat(c.id, p, oneLine(o.say || ''), 'ta'); uiAlert(c.name + ' 把帖子发到聊天里啦，去微信看看～'); openPost(p.id);
    }
    function sendPostToChat(charId, p, say, from) {
        const a = acct(p.by), line = '【分享帖子】《' + (p.title || p.text.slice(0, 14)) + '》 —— ' + a.nick + '：' + p.text.slice(0, 50) + (p.text.length > 50 ? '…' : '');
        pushHistory(charId, { role: from === 'ta' ? 'assistant' : 'user', content: (say && from === 'ta' ? say + '\n' : '') + line }); const ch = getChar(charId); if (from === 'ta' && ch) showBanner(ch, say || '给你看一个帖子');
    }
    async function shareToChar(postId) {
        const c = getChar(cid()); if (!c) { uiAlert('先创建并选择一个角色'); return; } const d = D(), p = d.posts.find(x => x.id === postId); if (!p) return;
        sendPostToChat(c.id, p, '', 'me'); uiAlert('已经分享给 ' + c.name + ' 啦');
        if (!API_KEY) return;
        try { const r = oneLine(await callPersona(c.id, '我在论坛上给你分享了一条帖子：《' + (p.title || '') + '》' + p.text.slice(0, 120) + '（作者 ' + acct(p.by).nick + '）。请你以角色本人的口吻自然地回应我，聊聊你对这条帖子的看法或联想，口语、有感情，不超过60字。只输出回应。', 1.0)); if (r) { pushHistory(c.id, { role: 'assistant', content: r }); showBanner(c, r); addIntimacy(c.id, 1); } } catch (e) {}
    }

    // =====================================================================
    //  TA 自己发（论坛 + 朋友圈）：打开网页时按节奏发，离开一阵再回来会补上这段时间发的
    // =====================================================================
    function momentsPost(c, text, ts) { const ms = getMoments(); ms.unshift({ id: 'm_' + ts + Math.random().toString(36).slice(2, 4), author: c.id, authorName: c.name, authorAvatar: c.avatarData || null, text, image: null, ts, likes: [], comments: [] }); saveMoments(ms); if ($('wechatTabMoments') && !$('wechatTabMoments').classList.contains('hidden')) try { renderMomentsFeed(); } catch (e) {} }
    function schedTs(gap) { const now = Date.now(); let ts = now - rnd(0, Math.min(gap, 10 * 36e5)); const h = new Date(ts).getHours(); if (h < 8 || h >= 24) ts = now; return Math.min(ts, now); }
    async function autoTick() {
        if (!API_KEY) return; const hr = new Date().getHours(); if (hr < 8 && hr >= 1) return; const now = Date.now();
        for (const ch of getChars()) {
            if (ch.blocked) continue;
            // 朋友圈
            if (store.getItem('autoMomentOn') !== 'false') {
                const last = Math.max.apply(null, [0].concat(getMoments().filter(m => m.author === ch.id).map(m => m.ts)));
                if (!ch.nextMomentAt) { const cs = getChars(), x = cs.find(y => y.id === ch.id); x.nextMomentAt = Math.max(now, last) + (last ? rnd(6, 16) : rnd(1, 3)) * 36e5; saveChars(cs); if (last) continue; }
                else if (now >= ch.nextMomentAt) {
                    const ts = schedTs(now - Math.max(last, ch.nextMomentAt - 20 * 36e5)), h = new Date(ts).getHours();
                    try { const t = oneLine(await callPersona(ch.id, '现在你想发一条朋友圈。这条是' + h + '点发的，请贴合那个时间你可能在做的事和心情：吃饭、通勤、工作、发呆、看到的小东西、想起的事都行。要求：像真人发朋友圈，口语、有生活细节和你的语气，15~60 字；不要编造和我共同经历过但其实没发生的事；不要提自己是 AI；不要加引号。只输出正文。', 1.0));
                        if (t) { momentsPost(ch, t, ts); if (now - ts < 3 * 36e5) showBanner(ch, '发了一条朋友圈：' + t.slice(0, 22)); } } catch (e) {}
                    const cs = getChars(), x = cs.find(y => y.id === ch.id); if (x) { x.nextMomentAt = now + rnd(8, 20) * 36e5; saveChars(cs); }
                }
            }
            // 论坛：还没账号的，TA 自己按人设开一个（不用你操作）
            if (store.getItem('autoForumOn') !== 'false' && !ch.forum && !ch.forumTried) {
                const cs0 = getChars(), x0 = cs0.find(y => y.id === ch.id); if (x0) { x0.forumTried = 1; saveChars(cs0); }
                try { const o = parseJSONLoose(await callPersona(ch.id, '请你以角色本人的身份，给自己在论坛（类似小红书）起一个账号。要符合你的人设和气质，像真人会起的昵称。只输出 JSON：{"nick":"昵称（2~8字）","handle":"英文或拼音ID，可含数字下划线","bio":"一句话简介（25字内，有你的语气）","tags":["常发话题1","话题2","话题3"]}', 1.0));
                    if (o && o.nick) { const cs = getChars(), x = cs.find(y => y.id === ch.id); x.forum = { nick: String(o.nick).slice(0, 14), handle: String(o.handle || '').replace(/[^\w.]/g, '').slice(0, 18) || ('user_' + ch.id.slice(-4)), bio: String(o.bio || '').slice(0, 40), tags: (o.tags || []).slice(0, 5), ts: Date.now(), auto: 1 }; x.nextForumAt = now + rnd(1, 3) * 36e5; saveChars(cs); } } catch (e) {}
                continue;
            }
            // 论坛
            if (store.getItem('autoForumOn') !== 'false' && ch.forum) {
                const d = D(), last = Math.max.apply(null, [0].concat(d.posts.filter(p => p.by.t === 'char' && p.by.id === ch.id).map(p => p.ts)));
                if (!ch.nextForumAt) { const cs = getChars(), x = cs.find(y => y.id === ch.id); x.nextForumAt = Math.max(now, last) + rnd(10, 26) * 36e5; saveChars(cs); }
                else if (now >= ch.nextForumAt) {
                    const p = await charPost(ch.id, true, schedTs(now - ch.nextForumAt + 6 * 36e5));
                    const cs = getChars(), x = cs.find(y => y.id === ch.id); if (x) { x.nextForumAt = now + rnd(14, 34) * 36e5; saveChars(cs); }
                    if (p && Math.random() < .35) { try { const r = oneLine(await callPersona(ch.id, '你刚在论坛发了帖子《' + p.title + '》。想顺手分享给我，用一两句话像对象一样跟我说，口语，不超过40字。只输出这句话。', 1.0)); if (r) sendPostToChat(ch.id, p, r, 'ta'); } catch (e) {} }
                }
            }
        }
    }
    setTimeout(autoTick, 6000); setInterval(autoTick, 10 * 60 * 1000);

    // 朋友圈页：自动发的开关 + 立刻让 TA 发一条
    function injectMoments() {
        const pk = $('momentsPicker'); if (!pk || $('autoMomRow')) return;
        const row = document.createElement('div'); row.id = 'autoMomRow'; row.className = 'fm-set'; row.style.margin = '8px 14px 0';
        row.innerHTML = '<label><span>TA 会主动发朋友圈</span><input type="checkbox" id="autoMomChk"' + (store.getItem('autoMomentOn') === 'false' ? '' : ' checked') + '></label><p class="hint-line">TA 会按自己的作息发动态；你不在的时候，回来也会看到 TA 这段时间发的。</p>';
        pk.parentNode.insertBefore(row, pk.nextSibling); $('autoMomChk').onchange = (e) => store.setItem('autoMomentOn', e.target.checked ? 'true' : 'false');
    }
    ensure(); injectMoments();
    window.forumOpenPost = openPost; window.forumAutoTick = autoTick;
    window.__fm = { D, S, acct, avHtml, num, svg, key, vis, uid, GR, reactTo, replyTo, openPost, shareToChar, sendPostToChat, cname, cid, myAcct, render: () => render() };
})();
