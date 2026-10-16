/* fanfic.js —— 同人文：选角色 + 选类型 + 超细选项（也可以只用自由描述），生成、续写、改写、收藏 */
(function () {
    'use strict';
    const $ = (id) => document.getElementById(id), esc = (s) => escapeHtml(String(s == null ? '' : s));
    const FORM = 'fanficForm', LIB = 'fanficLib', HIST = 'fanficHist';
    const uid = () => 'f' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5);

    // ---------- 选项库 ----------
    // [key, 标题, 说明, 选项[], 多选上限(1=单选, 0=不限), 仅精细模式]
    const GROUPS = [
        ['roleMode', '角色安排', '这篇文里谁是主角？', ['我 × TA（主角CP）', 'TA 单人主角（我是旁观者/读者）', 'TA × 另一位角色（CP）', '我、TA、另一位角色（三人群像）', 'TA 和路人配角'], 1],
        ['myRole', '我在故事里是谁', '不选则按我的真实设定写', ['本人（按我的设定）', '恋人', '新婚夫妻', '青梅竹马', '同学', '同事', '邻居', '搭档/战友', '前任', '陌生人', '粉丝与偶像', '上司与下属', '救命恩人', '合租室友'], 1],
        ['gene', '感情类型', '最多选 3 个', ['甜宠日常', '虐恋情深', '治愈温暖', '暗恋酸涩', '双向奔赴', '追妻火葬场', '先婚后爱', '破镜重圆', '青梅竹马', '欢喜冤家', '年上', '年下', '契约恋爱', '异地恋', '久别重逢', '日久生情', '一见钟情', '互相救赎', '双向暗恋', '占有欲/吃醋向'], 3],
        ['world', '世界观 / AU', '故事发生在什么样的世界', ['现代都市', '大学校园', '职场', '娱乐圈', '古风宫廷', '江湖武侠', '修仙玄幻', '民国', '西幻魔法', '赛博朋克', '末世求生', '星际科幻', '悬疑推理', '灵异怪谈（不血腥）', '异世界转生', '穿越', '重生', '咖啡店AU', '花店AU', '乐队AU', '电竞AU', '医生AU', '人外AU（猫/狼/精灵）', '游戏世界', '海边小镇', '乡村田园'], 2],
        ['form', '文体形式', '用什么形式来写', ['完整短篇', '日常片段', '小剧场/段子', '书信体', '日记体', '剧本式对话体', '番外', '长篇第一章', '纯对话', '脑洞设定集'], 1],
        ['stage', '关系阶段', '故事开始时，两人处于什么状态', ['初次见面', '互有好感', '暧昧拉扯', '刚刚在一起', '热恋期', '稳定同居', '老夫老妻', '冷战/吵架中', '分手后', '异地', '婚后日常'], 1],
        ['pov', '叙事视角', '谁的眼睛来讲故事', ['第一人称（我）', '第一人称（TA）', '第三人称·跟着我', '第三人称·跟着TA', '第三人称全知', '双视角交替'], 1],
        ['tone', '情绪基调', '最多选 3 个', ['甜', '虐', '治愈', '搞笑沙雕', '温柔细腻', '热烈直球', '克制隐忍', '悬疑紧张', '惆怅怀旧', '浪漫唯美', '轻松日常', '沉重压抑'], 3],
        ['len', '篇幅', '大致字数（模型可能有出入）', ['约 500 字', '约 1000 字', '约 2000 字', '约 3500 字', '约 5000 字'], 1],
        ['season', '季节', '', ['春', '夏', '秋', '冬', '不限'], 1],
        ['daytime', '时段', '', ['清晨', '白天', '黄昏', '深夜', '不限'], 1],
        ['place', '主要场景', '最多选 3 个', ['家里', '学校', '公司', '咖啡馆', '海边', '雨天街头', '车站/机场', '山里露营', '游乐园', '图书馆', '医院', '旅途中', '天台', '老街夜市', '雪地', '古宅', '太空站', '花园', '电影院', '手机/线上'], 3],
        ['weather', '天气 / 氛围', '', ['晴天', '下雨', '下雪', '雷雨', '大风', '起雾', '星空', '黄昏暖光', '不限'], 1],
        ['trope', '情节要素', '想写进去的桥段，最多选 5 个', ['误会', '吃醋', '雨中撑伞', '同居', '受伤被照顾', '生病照顾', '告白', '第一次牵手', '拥抱', '额头/脸颊轻吻', '纪念日惊喜', '争吵后和好', '出差思念', '见家长', '求婚', '婚礼', '重逢', '失忆', '身份反转', '保护', '做梦/梦中相遇', '共同做饭', '深夜通话', '送礼物', '偷偷准备惊喜', '一起旅行', '共同养宠物', '互换身体', '时间循环', '被困在一起'], 5],
        ['open', '开头方式', '', ['从一句对话开始', '从景物描写开始', '从回忆开始', '从一个事件开始', '从内心独白开始', '不限'], 1],
        ['pace', '叙事节奏', '', ['慢热细腻', '平稳推进', '快节奏紧凑'], 1],
        ['twist', '转折强度', '', ['无转折，平铺直叙', '一个小转折', '大反转'], 1],
        ['end', '结局', '', ['HE（圆满）', 'BE（遗憾）', 'OE（开放式）', '甜蜜收尾', '留白余味', '结尾反转', '治愈收束', '悬念（留给下一章）'], 1],
        ['rate', '亲密尺度', '本应用不会写露骨内容，只能选到含蓄为止', ['纯友情/亲情向', '清水（牵手、拥抱）', '含蓄暧昧（心动、轻吻，点到为止）'], 1],
        ['style', '文风', '最多选 2 个', ['细腻文艺', '口语轻松', '简洁克制', '华丽辞藻', '古风白话', '日系轻小说', '网文爽快', '诗意散文', '幽默吐槽'], 2],
        ['dialog', '对话占比', '', ['以叙述为主', '叙述与对话均衡', '以对话为主'], 1],
        ['focus', '描写重点', '最多选 3 个', ['心理活动', '动作细节', '环境氛围', '五感（气味/温度/声音）', '微表情', '内心独白', '对话张力'], 3]
    ];
    const GINFO = {}; GROUPS.forEach(g => { GINFO[g[0]] = g; });
    const SECTIONS = [
        ['① 谁来演', ['roleMode', 'myRole']],
        ['② 写什么类型', ['gene', 'world', 'form']],
        ['③ 关系与视角', ['stage', 'pov', 'tone']],
        ['④ 时间地点', ['season', 'daytime', 'place', 'weather']],
        ['⑤ 情节安排', ['trope', 'open', 'pace', 'twist', 'end']],
        ['⑥ 写法与篇幅', ['len', 'style', 'dialog', 'focus', 'rate']]
    ];
    const TEXTS = [
        ['title', '书名（可空，空则让 TA 起）', 'text'],
        ['callMe', 'TA 怎么称呼我（可空）', 'text'],
        ['mustSay', '必须出现的台词 / 句子', 'area'],
        ['mustHave', '必须出现的物品 / 梗 / 细节', 'area'],
        ['avoid', '不想出现的东西', 'area'],
        ['extra', '其他补充要求', 'area']
    ];

    // ---------- 存储 ----------
    function jget(k, d) { try { const v = JSON.parse(store.getItem(k) || 'null'); return v == null ? d : v; } catch (e) { return d; } }
    function jset(k, v) { try { store.setItem(k, JSON.stringify(v)); } catch (e) { uiAlert('保存失败，空间不够了'); } }
    let st = Object.assign({ charId: '', char2: '', mode: 'fine', sel: {}, custom: {}, txt: {}, free: '', useMem: true }, jget(FORM, {}));
    st.sel = st.sel || {}; st.custom = st.custom || {}; st.txt = st.txt || {};
    const save = () => jset(FORM, st);
    let view = 'make', cur = null, busy = false;

    // ---------- 注册到桌面 ----------
    try {
        if (allApps.indexOf('fanfic') < 0) allApps.push('fanfic');
        if (!HOME_APPS.some(a => a.id === 'fanfic')) HOME_APPS.push({ id: 'fanfic', name: '同人文', cls: 'fanfic-icon', face: '(◕‿◕✿)', go: () => openApp('fanfic') });
        GLYPH.fanfic = '<path d="M6 3.5h9l3 3v14H6z"/><path d="M14.5 3.5v3.5H18"/><path d="M9 11h6M9 14.5h6M9 18h3.5"/>';
    } catch (e) { }

    function ensure() {
        if ($('fanficApp')) return;
        const el = document.createElement('div'); el.id = 'fanficApp'; el.className = 'app-screen hidden'; el.style.position = 'absolute';
        el.innerHTML = '<div class="app-header"><button id="ffHdrBack">‹ 返回</button><span>同人文</span><button class="hdr-btn" id="ffSwitch">作品库</button></div><div class="scroll-area xa-body" id="ffBody"></div><div class="ff-bar" id="ffBar"></div>';
        ($('callScreen') ? $('callScreen').parentElement : document.body).appendChild(el);
        $('ffHdrBack').onclick = () => { if (cur) { cur = null; view = 'make'; render(); } else if (view !== 'make') { view = 'make'; render(); } else goHome(); };
        $('ffSwitch').onclick = () => { view = view === 'make' ? 'hist' : 'make'; if (view !== 'make') cur = null; render(); };
        new MutationObserver(() => { if (!el.classList.contains('hidden')) render(); }).observe(el, { attributes: true, attributeFilter: ['class'] });
    }

    // ---------- 生成记录（每次生成 / 续写 / 改写都会自动记下来，不用手动收藏也不会丢） ----------
    const HIST_MAX = 60;
    function histStrip(o) { return { id: o.id, title: o.title, text: o.text, charId: o.charId, charName: o.charName, ts: o.ts, upd: Date.now(), saved: !!o.saved, chapters: o.chapters, spec: o.spec, sys: o.sys }; }
    function pushHist(o) { if (!o || !o.text) return; const list = jget(HIST, []).filter(x => x.id !== o.id); list.unshift(histStrip(o)); jset(HIST, list.slice(0, HIST_MAX)); }
    function tabsHtml() {
        const t = view === 'lib' ? 'lib' : view === 'hist' ? 'hist' : 'make';
        return '<div class="ff-tabs"><button data-tab="make" class="' + (t === 'make' ? 'on' : '') + '">创作</button><button data-tab="hist" class="' + (t === 'hist' ? 'on' : '') + '">生成记录 ' + (jget(HIST, []).length || '') + '</button><button data-tab="lib" class="' + (t === 'lib' ? 'on' : '') + '">收藏</button></div>';
    }
    function bindTabs(body) { body.querySelectorAll('[data-tab]').forEach(b => b.onclick = () => { const v = b.dataset.tab; if (v === view && !cur) return; view = v; if (v !== 'make') cur = null; render(); }); }
    function ago(ts) { const d = new Date(ts), n = new Date(), p = (x) => String(x).padStart(2, '0'); return (d.toDateString() === n.toDateString() ? '今天 ' : (d.getMonth() + 1) + '月' + d.getDate() + '日 ') + p(d.getHours()) + ':' + p(d.getMinutes()); }
    function renderHist(body, bar) {
        bar.innerHTML = ''; const list = jget(HIST, []), lib = jget(LIB, []);
        let h = tabsHtml();
        if (!list.length) h += '<div class="xa-empty">还没有生成记录<br>每次生成、续写、改写的同人文都会自动记在这里</div>';
        else h += '<p class="ff-hint">最近 ' + list.length + ' 篇（最多保留 ' + HIST_MAX + ' 篇）。点开可以继续看、续写、修改。</p>' + list.map(o => '<div class="ff-lib" data-id="' + o.id + '"><div class="l"><b>《' + esc(o.title) + '》' + (lib.some(z => z.id === o.id) ? '<i class="ff-fav">已收藏</i>' : '') + '</b><span>' + esc(o.charName) + ' · ' + wc(o.text) + ' 字' + (o.chapters > 1 ? ' · ' + o.chapters + ' 章' : '') + ' · ' + ago(o.upd || o.ts) + '</span><em>' + esc(String(o.text).replace(/\s+/g, ' ').slice(0, 46)) + '…</em></div><button class="hdr-btn" data-del="' + o.id + '">删除</button></div>').join('') + '<div class="xa-btns"><button class="dan" id="ffHistClr">清空生成记录</button></div>';
        body.innerHTML = h; bindTabs(body);
        const clr = $('ffHistClr'); if (clr) clr.onclick = async () => { if (!(await uiConfirm('清空所有生成记录吗？（已收藏的作品不受影响）'))) return; jset(HIST, []); render(); };
        body.onclick = async (e) => {
            if (e.target.closest('[data-tab]') || e.target.closest('#ffHistClr')) return;
            const d = e.target.closest('[data-del]');
            if (d) { if (!(await uiConfirm('删除这条记录吗？'))) return; jset(HIST, jget(HIST, []).filter(x => x.id !== d.dataset.del)); render(); return; }
            const r = e.target.closest('.ff-lib'); if (!r) return; const o = jget(HIST, []).find(x => x.id === r.dataset.id); if (!o) return;
            cur = Object.assign({}, o, { saved: jget(LIB, []).some(z => z.id === o.id) }); view = 'make'; render();
        };
    }

    // ---------- 渲染 ----------
    function chars() { return getChars(); }
    function chipRow(key, opts, multi, max) {
        const sel = st.sel[key] || [], cu = st.custom[key] || [];
        return '<div class="xa-chips" data-k="' + key + '" data-m="' + max + '">' + opts.concat(cu).map(o => '<button data-v="' + esc(o) + '" class="' + (sel.indexOf(o) >= 0 ? 'on' : '') + '">' + esc(o) + '</button>').join('') + '<button data-add="1">＋自己写</button></div>';
    }
    function groupHtml(key) {
        const g = GINFO[key];
        return '<div class="ff-sec"><h4>' + esc(g[1]) + (g[4] === 1 || g[4] === undefined ? '' : '') + '</h4>' + (g[2] ? '<p>' + esc(g[2]) + '</p>' : '') + chipRow(key, g[3], g[4] !== 1, g[4]) + '</div>';
    }
    function charChips(key, allowNone) {
        const cs = chars();
        if (!cs.length) return '<p>还没有角色，先去「微信」里创建一个角色吧～</p>';
        return '<div class="xa-chips" data-c="' + key + '">' + (allowNone ? '<button data-id="" class="' + (!st[key] ? 'on' : '') + '">不选</button>' : '') + cs.map(c => '<button data-id="' + esc(c.id) + '" class="' + (st[key] === c.id ? 'on' : '') + '">' + esc(c.name) + '</button>').join('') + '</div>';
    }
    function needSecond() { return /另一位|三人/.test((st.sel.roleMode || [])[0] || ''); }
    function summary() {
        let n = 0; Object.keys(st.sel).forEach(k => { n += (st.sel[k] || []).length; }); Object.keys(st.txt).forEach(k => { if (String(st.txt[k] || '').trim()) n++; });
        return st.mode === 'free' ? (st.free.trim() ? '已写自由描述' : '请写下你想看的故事') : '已选 ' + n + ' 项细节';
    }
    function render() {
        const body = $('ffBody'), bar = $('ffBar'); if (!body) return;
        $('ffSwitch').textContent = view === 'make' ? '生成记录' : '去创作';
        if (view === 'lib') return renderLib(body, bar);
        if (view === 'hist') return renderHist(body, bar);
        if (cur) return renderOut(body, bar);
        let h = tabsHtml() + '<div class="ff-sec"><h4>选角色</h4><p>主角色（会按 TA 的人设来写）</p>' + charChips('charId', false) + '</div>';
        if (needSecond()) h += '<div class="ff-sec"><h4>另一位角色</h4>' + charChips('char2', false) + '</div>';
        h += '<div class="ff-sec"><h4>怎么提要求</h4><div class="xa-chips" data-mode="1"><button data-md="fine" class="' + (st.mode === 'fine' ? 'on' : '') + '">精细选项</button><button data-md="free" class="' + (st.mode === 'free' ? 'on' : '') + '">只写自由描述</button></div></div>';
        if (st.mode === 'free') {
            h += '<div class="ff-sec"><h4>自由描述</h4><p>想看什么样的故事都可以写：设定、剧情、情绪、台词、结局……写得越具体越好。</p><textarea id="ffFree" style="min-height:180px" placeholder="例如：下雨天我忘了带伞，TA 在公司楼下等了我二十分钟，嘴上说「顺路」，其实绕了很远……">' + esc(st.free) + '</textarea></div>';
        } else {
            SECTIONS.forEach(sec => { h += '<div class="xa-title">' + esc(sec[0]) + '</div>' + sec[1].map(groupHtml).join(''); });
            h += '<div class="xa-title">⑦ 具体细节（都可以不填）</div><div class="ff-sec">' + TEXTS.map(t => '<h4 style="margin-top:8px">' + esc(t[1]) + '</h4>' + (t[2] === 'text' ? '<input type="text" data-t="' + t[0] + '" value="' + esc(st.txt[t[0]] || '') + '">' : '<textarea data-t="' + t[0] + '">' + esc(st.txt[t[0]] || '') + '</textarea>')).join('') + '</div>';
        }
        h += '<div class="ff-sec"><h4>融入真实相处</h4><p>参考我和 TA 最近的聊天、TA 记住的事，让故事更像「我们」。</p><div class="xa-chips" data-mem="1"><button data-m="1" class="' + (st.useMem ? 'on' : '') + '">融入</button><button data-m="0" class="' + (!st.useMem ? 'on' : '') + '">不用</button></div></div>';
        h += '<div class="xa-btns"><button id="ffReset">清空所有选择</button></div>';
        body.innerHTML = h; bindTabs(body);
        bar.innerHTML = '<span>' + esc(summary()) + '</span><button class="pri" id="ffGo">' + (busy ? '正在写…' : '生成同人文') + '</button>';
        bind(body, bar);
    }
    function bind(body, bar) {
        body.querySelectorAll('[data-c]').forEach(row => row.onclick = (e) => { const b = e.target.closest('button'); if (!b) return; st[row.dataset.c] = b.dataset.id; save(); render(); });
        body.querySelectorAll('[data-md]').forEach(b => b.onclick = () => { st.mode = b.dataset.md; save(); render(); });
        body.querySelectorAll('[data-mem] button').forEach(b => b.onclick = () => { st.useMem = b.dataset.m === '1'; save(); render(); });
        body.querySelectorAll('.xa-chips[data-k]').forEach(row => row.onclick = async (e) => {
            const b = e.target.closest('button'); if (!b) return; const k = row.dataset.k, max = +row.dataset.m, sel = st.sel[k] = st.sel[k] || [];
            if (b.dataset.add) {
                const v = await uiPrompt('自己写一个「' + GINFO[k][1] + '」选项：', '', { placeholder: '写短一点，比如：在摩天轮上' }); if (v === null) return;
                const t = String(v).trim().slice(0, 30); if (!t) return;
                st.custom[k] = (st.custom[k] || []).filter(x => x !== t).concat(t);
                if (max === 1) st.sel[k] = [t]; else if (!max || sel.length < max) sel.push(t);
                save(); render(); return;
            }
            const v = b.dataset.v, i = sel.indexOf(v);
            if (i >= 0) sel.splice(i, 1);
            else if (max === 1) st.sel[k] = [v];
            else if (!max || sel.length < max) sel.push(v);
            else { uiAlert('「' + GINFO[k][1] + '」最多选 ' + max + ' 个', 1600); return; }
            save(); render();
        });
        body.querySelectorAll('[data-t]').forEach(el => el.oninput = () => { st.txt[el.dataset.t] = el.value; save(); const s = bar.querySelector('span'); if (s) s.textContent = summary(); });
        const fr = $('ffFree'); if (fr) fr.oninput = () => { st.free = fr.value; save(); const s = bar.querySelector('span'); if (s) s.textContent = summary(); };
        const rs = $('ffReset'); if (rs) rs.onclick = async () => { if (!(await uiConfirm('清空所有已选内容吗？'))) return; st.sel = {}; st.txt = {}; st.free = ''; save(); render(); };
        $('ffGo').onclick = generate;
    }

    // ---------- 生成 ----------
    function spec() {
        const me = store.getItem('myName') || '我', c = getChar(st.charId), c2 = needSecond() ? getChar(st.char2) : null;
        const L = [], S = (k) => (st.sel[k] || []).join('、');
        const mgi = myGenderInfo(), cgi = charGenderInfo(c), c2g = c2 ? charGenderInfo(c2) : null;
        L.push('【主角】' + c.name + (c2 ? '、' + c2.name : '') + '；"我"指读者本人，名字叫「' + me + '」。');
        L.push('【性别与人称（必须严格遵守）】' + me + (mgi.g ? '是' + mgi.g + '，文中第三人称只能写「' + mgi.p + '」' + (mgi.p === '她' ? '，绝不能写成「他」' : '，绝不能写成「她」') : '性别未说明，第三人称用「TA」') + '；' + c.name + (cgi.g ? '是' + cgi.g + '生，写作「' + cgi.p + '」' : '性别按人设') + (c2 ? '；' + c2.name + (c2g.g ? '是' + c2g.g + '生，写作「' + c2g.p + '」' : '性别按人设') : '') + '。路人配角按各自性别用「他/她」，前后一致。');
        if (st.mode === 'free') { L.push('【我的要求（自由描述）】\n' + st.free.trim()); return L.join('\n'); }
        GROUPS.forEach(g => { const v = S(g[0]); if (v) L.push('【' + g[1] + '】' + v); });
        TEXTS.forEach(t => { const v = String(st.txt[t[0]] || '').trim(); if (v && t[0] !== 'title') L.push('【' + t[1].replace(/（.*?）/, '') + '】' + v); });
        if (st.txt.title) L.push('【书名】《' + String(st.txt.title).replace(/[《》]/g, '') + '》');
        return L.join('\n');
    }
    function memoryText(c) {
        if (!st.useMem) return '';
        let t = '';
        if (c.memory && c.memory.text) t += '【TA 记得的关于我们的事】' + c.memory.text + '\n';
        const h = (c.chatHistory || []).filter(m => (m.role === 'user' || m.role === 'assistant') && !m.recalled && !/^\[/.test(String(m.content))).slice(-12).map(m => (m.role === 'user' ? (store.getItem('myName') || '我') : c.name) + '：' + String(m.content).slice(0, 80));
        if (h.length) t += '【最近的聊天片段（可作灵感，不要照抄）】\n' + h.join('\n');
        return t;
    }
    const RULES = '你是一位文笔出色的中文同人小说作者。根据下面的角色资料和我的要求写一篇原创同人故事。\n要求：\n1. 角色的性格、说话习惯必须符合资料，不要写崩；\n2. 严格遵守我选定的类型、视角、基调、篇幅、结局等要求，没选的部分由你自由发挥但要合理；\n3. 「必须出现」的内容一定要写进去，「不想出现」的内容绝不出现；\n4. 亲密内容最多写到含蓄（心动、拥抱、轻吻），不写任何露骨的性描写，也不写低龄角色的恋爱亲密；\n5. 第一行输出《书名》（若我指定了书名就用我指定的），空一行后直接写正文；不要写前言、解释、字数统计或总结，不要出现「作为AI」之类的话。';
    async function generate() {
        if (busy) return;
        if (!st.charId || !getChar(st.charId)) { uiAlert('先选一个主角色～'); return; }
        if (needSecond() && (!st.char2 || !getChar(st.char2))) { uiAlert('你选了需要另一位角色，请再选一位～'); return; }
        if (st.mode === 'free' && !st.free.trim()) { uiAlert('先写一点你想看的故事吧～'); return; }
        const c = getChar(st.charId), c2 = needSecond() ? getChar(st.char2) : null;
        const sys = RULES + '\n\n===角色资料===\n' + buildCharacterCard(c) + (c2 ? '\n\n===另一位角色===\n' + buildCharacterCard(c2) : '') + (memoryText(c) ? '\n\n' + memoryText(c) : '');
        busy = true; $('ffGo').textContent = '正在写…'; $('ffGo').disabled = true;
        try {
            const raw = await chatCompletion([{ role: 'system', content: sys }, { role: 'user', content: spec() }], 1.0);
            cur = parse(raw, c, c2); cur.spec = spec(); cur.cfg = JSON.parse(JSON.stringify({ mode: st.mode, sel: st.sel }));
            cur.sys = sys; view = 'make'; pushHist(cur);
        } catch (e) { uiAlert('生成失败：' + (e && e.message)); }
        busy = false; render();
    }
    function parse(raw, c, c2) {
        let t = String(raw).replace(/^\s*```[a-z]*\n?|```\s*$/g, '').trim(), title = '';
        const m = /^\s*(?:#+\s*)?[《「]?([^\n》」]{1,30})[》」]?\s*\n/.exec(t);
        if (m && /^\s*(#+\s*)?[《「]/.test(t)) { title = m[1].trim(); t = t.slice(m[0].length).trim(); }
        if (!title) title = (st.txt.title || '').trim() || '无题';
        return { id: uid(), title: title, text: t, charId: c.id, charName: c.name + (c2 ? '×' + c2.name : ''), ts: Date.now(), saved: false, chapters: 1 };
    }
    function wc(t) { return String(t).replace(/\s/g, '').length; }

    // ---------- 结果页 ----------
    function renderOut(body, bar) {
        body.innerHTML = tabsHtml() + '<div class="ff-out"><h3>《' + esc(cur.title) + '》</h3>' + esc(cur.text) + '</div><div class="xa-title" style="text-align:center">' + esc(cur.charName) + ' · 约 ' + wc(cur.text) + ' 字' + (cur.saved ? ' · 已收藏' : '') + '</div>' +
            '<div class="xa-btns" style="flex-wrap:wrap"><button id="ffCont">续写下一章</button><button id="ffRev">按意见修改</button><button id="ffAgain">重新生成</button></div><div class="xa-btns"><button id="ffCopy">复制全文</button><button id="ffEdit">手动编辑</button><button id="ffSave" class="pri">' + (cur.saved ? '取消收藏' : '收藏') + '</button></div><div class="xa-btns"><button id="ffBack">返回修改选项</button></div>';
        bar.innerHTML = ''; bindTabs(body);
        $('ffBack').onclick = () => { cur = null; render(); };
        $('ffCopy').onclick = () => { copyText('《' + cur.title + '》\n\n' + cur.text); uiAlert('已复制', 1200); };
        $('ffSave').onclick = () => { cur.saved = !cur.saved; const lib = jget(LIB, []).filter(x => x.id !== cur.id); if (cur.saved) lib.unshift(strip(cur)); jset(LIB, lib); pushHist(cur); render(); };
        $('ffAgain').onclick = () => { cur = null; generate(); };
        $('ffEdit').onclick = async () => { const v = await uiPrompt('手动修改正文：', cur.text, { multiline: true }); if (v === null) return; cur.text = String(v); sync(); render(); };
        $('ffCont').onclick = () => more('请接着上文写下一章（第 ' + (cur.chapters + 1) + ' 章），承接前文剧情和人物关系，篇幅与前文相近。第一行写本章小标题（用《》括起来），空一行后写正文。', true);
        $('ffRev').onclick = async () => { const v = await uiPrompt('想怎么改？', '', { placeholder: '例如：结局改成HE / 多一点对话 / 更虐一点 / 开头重写' }); if (!v || !String(v).trim()) return; more('请按下面的意见，把整篇重写一遍（保留书名与主要设定，除非意见要求改动）：' + String(v).trim() + '。第一行仍写《书名》，空一行后写正文。', false); };
    }
    function strip(o) { return { id: o.id, title: o.title, text: o.text, charId: o.charId, charName: o.charName, ts: o.ts, saved: true, chapters: o.chapters, spec: o.spec, sys: o.sys }; }
    function sync() { pushHist(cur); if (!cur.saved) return; const lib = jget(LIB, []).map(x => x.id === cur.id ? strip(cur) : x); jset(LIB, lib); }
    async function more(ask, append) {
        if (busy) return; busy = true; $('ffCont').textContent = $('ffRev').textContent = '正在写…';
        try {
            const prev = cur.text.length > 3500 ? '（前文较长，仅保留结尾部分）…' + cur.text.slice(-3500) : cur.text;
            const raw = await chatCompletion([{ role: 'system', content: cur.sys || RULES }, { role: 'user', content: (cur.spec || '') + '\n\n【已写好的正文】《' + cur.title + '》\n' + prev }, { role: 'user', content: ask }], 1.0);
            if (append) {
                let t = String(raw).trim(), sub = '';
                const m = /^\s*[《「#]\s*([^\n》」]{1,30})[》」]?\s*\n/.exec(t); if (m) { sub = m[1].replace(/^#+\s*/, '').trim(); t = t.slice(m[0].length).trim(); }
                cur.chapters++; cur.text += '\n\n——— 第 ' + cur.chapters + ' 章' + (sub ? ' ' + sub : '') + ' ———\n\n' + t;
            } else { const p = parse(raw, getChar(cur.charId) || { id: cur.charId, name: cur.charName }, null); cur.text = p.text; cur.title = p.title === '无题' ? cur.title : p.title; cur.chapters = 1; }
            sync();
        } catch (e) { uiAlert('失败：' + (e && e.message)); }
        busy = false; render();
    }

    // ---------- 作品库 ----------
    function renderLib(body, bar) {
        bar.innerHTML = ''; const lib = jget(LIB, []);
        if (!lib.length) { body.innerHTML = tabsHtml() + '<div class="xa-empty">还没有收藏的作品<br>生成后点「收藏」就会出现在这里<br>（没收藏的也能在「生成记录」里找到）</div>'; bindTabs(body); body.onclick = null; return; }
        body.innerHTML = tabsHtml() + lib.map(o => '<div class="ff-lib" data-id="' + o.id + '"><div class="l"><b>《' + esc(o.title) + '》</b><span>' + esc(o.charName) + ' · ' + wc(o.text) + ' 字 · ' + new Date(o.ts).toLocaleDateString() + '</span></div><button class="hdr-btn" data-del="' + o.id + '">删除</button></div>').join('');
        bindTabs(body);
        body.onclick = async (e) => {
            if (e.target.closest('[data-tab]')) return;
            const d = e.target.closest('[data-del]');
            if (d) { if (!(await uiConfirm('删除这篇作品吗？'))) return; jset(LIB, jget(LIB, []).filter(x => x.id !== d.dataset.del)); render(); return; }
            const r = e.target.closest('.ff-lib'); if (!r) return; const o = jget(LIB, []).find(x => x.id === r.dataset.id); if (!o) return;
            cur = Object.assign({}, o); view = 'make'; render();
        };
    }

    ensure();
    window.FANFIC = { state: () => st };
})();
