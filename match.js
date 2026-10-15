/* match.js —— 「匿名匹配」独立 app
 * 自选/盲盒匹配 → 匿名聊天 → 聊够几句后申请揭开面具（对方可能同意也可能想再聊聊）→ 可加入微信。
 * 另有：漂流瓶、今日话题墙、心动值、徽章、收藏、对方主动来找你。数据只存在你自己的浏览器里。 */
(function () {
    'use strict';
    const $ = (id) => document.getElementById(id), esc = (s) => escapeHtml(String(s == null ? '' : s));
    const sleep = (ms) => new Promise(r => setTimeout(r, ms)), rnd = (a, b) => a + Math.floor(Math.random() * (b - a + 1));
    const pick = (a) => a[Math.floor(Math.random() * a.length)], shuf = (a) => a.slice().sort(() => Math.random() - .5);
    const KEY = 'matchData';

    // ---------- 接入桌面 ----------
    try {
        if (allApps.indexOf('match') < 0) allApps.push('match');
        if (!HOME_APPS.some(a => a.id === 'match')) HOME_APPS.push({ id: 'match', name: '匿名匹配', cls: 'match-icon', face: '(๑•́ ₃ •̀๑)', go: () => openApp('match') });
        GLYPH.match = '<path d="M4 9c0-3 3-5 8-5s8 2 8 5v3c0 4-3 8-8 8s-8-4-8-8z"/><path d="M8 11.5h2M14 11.5h2M9.5 15.5c1.5 1 3.5 1 5 0"/>';
    } catch (e) {}

    // ---------- 选项库 ----------
    const OPT = {
        gender: ['男生', '女生', '非二元'],
        age: ['18-22岁', '23-27岁', '28-35岁', '36岁以上'],
        pers: ['温柔', '开朗话痨', '高冷', '毒舌', '腼腆', '幽默', '理性', '文艺', '热血', '佛系', '傲娇', '成熟稳重', '天然呆', '细腻共情'],
        job: ['学生', '程序员', '设计师', '医生/护士', '老师', '作家/编辑', '自由职业', '公务员', '厨师/咖啡师', '音乐人', '运动员/教练', '创业者', '摄影师', '游戏主播', '插画师', '律师'],
        hob: ['游戏', '动漫', '音乐', '电影', '阅读', '健身', '旅行', '美食', '摄影', '手工', '宠物', '追星', '桌游', '写作', '画画', '露营'],
        style: ['慢热', '秒回', '深夜emo', '搞笑担当', '认真倾听', '话痨'],
        goal: ['交朋友', '倾诉树洞', '聊兴趣', '找搭子', '恋爱向', '随便聊聊']
    };
    const LBL = { gender: '性别', age: '年龄', pers: '性格（可多选）', job: '工作', hob: '爱好（可多选）', style: '聊天风格', goal: '想要的关系/目的' };
    const ZOD = ['白羊座', '金牛座', '双子座', '巨蟹座', '狮子座', '处女座', '天秤座', '天蝎座', '射手座', '摩羯座', '水瓶座', '双鱼座'];
    const MBTI = ['INFP', 'INFJ', 'INTP', 'INTJ', 'ENFP', 'ENFJ', 'ENTP', 'ENTJ', 'ISFP', 'ISFJ', 'ISTP', 'ISTJ', 'ESFP', 'ESFJ', 'ESTP', 'ESTJ'];
    const ADJ = ['迷路的', '困困的', '爱发呆的', '偷吃糖的', '晚风里的', '抱着月亮的', '打瞌睡的', '躲雨的', '赤脚的', '撑伞的', '慢吞吞的', '发光的', '会脸红的', '追云的'];
    const ANI = ['小狐狸', '小鲸鱼', '猫咪', '兔子', '企鹅', '云朵', '橘子', '刺猬', '小熊', '松鼠', '水母', '星星', '年糕', '布丁'];
    const GLY = ['(•ᴗ•)', '(´･ᴗ･`)', '(ᵔᴥᵔ)', '(=^･ω･^=)', '(๑•̀ㅂ•́)', '(・ω・)', '(´∀`)', '(•ө•)', '(˘ω˘)', 'ʕ•ᴥ•ʔ', '(｡•́︿•̀｡)', '(◍•ᴗ•◍)', '(*´▽`*)', '(｡-ω-)'];
    const COL = ['#f6b7c8', '#b9d3ea', '#c9e4c5', '#f9d9a8', '#d8c6ef', '#f7c5b0', '#bfe3e0', '#e9c8d9'];
    const TOPICS = ['最近一次被治愈是什么时候？', '如果能瞬间到达一个地方，你想去哪？', '你最舍不得删掉的一张照片是什么？', '说一件今天让你开心的小事', '你理想中的周末是什么样？', '有没有一首歌，一听就会想起某个人？', '你最近在偷偷坚持的小习惯是什么？', '小时候的梦想现在还记得吗？', '你觉得自己最可爱的一个瞬间是？', '深夜睡不着的时候你会想什么？', '你最想对三年前的自己说什么？', '有什么食物能让你瞬间心情变好？', '你心里最温柔的一个人是谁？', '如果今天可以请假，你想做什么？'];
    const ICE = ['你今天过得怎么样？有什么小事想分享吗？', '如果只能选一种天气过一整年，你选哪种？', '最近有没有看到什么让你笑出声的东西？', '你是早起型还是夜猫子？', '说说你最近单曲循环的一首歌吧', '你小时候有没有做过什么傻事？', '如果能拥有一种超能力，你要什么？', '你觉得什么样的人最有魅力？', '今天晚饭吃的什么？好吃吗？', '你最近在为什么事发愁或期待吗？'];
    const TRUTH = ['真心话：你最近一次哭是因为什么？', '真心话：你有没有偷偷暗恋过谁？', '真心话：你最怕被别人知道的一个小习惯是什么？', '真心话：你觉得自己最大的优点和缺点分别是？', '真心话：你做过最勇敢的一件事是什么？', '真心话：你理想中的另一半是什么样？', '大冒险：用三个词形容你自己，不许想太久！', '大冒险：发一句你现在最想说的话（任何话）'];
    const BAD = [['初次相遇', '完成第一次匹配', s => s.match >= 1], ['话痨选手', '累计发出 50 条消息', s => s.msgs >= 50], ['揭开面具', '成功揭开 1 次面具', s => s.reveal >= 1], ['天赐缘分', '把 1 位网友加进微信', s => s.added >= 1], ['瓶子收藏家', '扔或捞 3 个漂流瓶', s => s.bottle >= 3], ['三面之缘', '成功揭开 3 次面具', s => s.reveal >= 3], ['树洞常客', '回答 3 次今日话题', s => s.topic >= 3]];

    // ---------- 数据 ----------
    let data = null;
    function newMe() { return { nick: pick(ADJ) + pick(ANI), glyph: pick(GLY), color: pick(COL), sign: '', thr: 10 }; }
    function load() { let d = null; try { d = JSON.parse(store.getItem(KEY) || 'null'); } catch (e) {} d = d || {}; d.me = Object.assign(newMe(), d.me || {}); d.prefs = d.prefs || {}; d.th = d.th || []; d.stats = Object.assign({ match: 0, reveal: 0, added: 0, bottle: 0, topic: 0, msgs: 0 }, d.stats || {}); d.bottles = d.bottles || []; d.daily = d.daily || {}; return d; }
    function save() { try { store.setItem(KEY, JSON.stringify(data)); } catch (e) { try { uiAlert('保存失败：存储空间不足'); } catch (e2) {} } }
    const thOf = (id) => data.th.find(t => t.id === id);
    const uid = () => 't' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5);
    const userCnt = (t) => t.msgs.filter(m => m.r === 'me').length;
    const av = (g, c, cls) => '<div class="mt-av ' + (cls || '') + '" style="--c:' + esc(c || '#f6b7c8') + '"><span>' + esc(g || '(•ᴗ•)') + '</span></div>';
    const fmtT = (ts) => { const d = new Date(ts), n = new Date(); return d.toDateString() === n.toDateString() ? ('0' + d.getHours()).slice(-2) + ':' + ('0' + d.getMinutes()).slice(-2) : (d.getMonth() + 1) + '/' + d.getDate(); };
    const nameOf = (t) => t.revealed ? t.p.name : t.p.nick;

    // ---------- 生成网友 ----------
    function prefText(P) {
        const L = [], f = (k, lab) => { if (P[k] && P[k].length) L.push(lab + '：' + P[k].join('、')); };
        f('gender', '性别'); f('age', '年龄段'); f('pers', '性格'); f('job', '工作'); f('hob', '爱好'); f('style', '聊天风格'); f('goal', '想聊的目的');
        if (P.zodiac) L.push('星座：' + P.zodiac); if (P.mbti) L.push('MBTI：' + P.mbti); if (P.extra) L.push('补充要求：' + P.extra);
        return L.length ? L.join('；') : '不限（随机，尽量多样、有个性）';
    }
    const PSCHEMA = '{"nick":"匿名昵称6~8字，可爱有画面感","glyph":"一个短颜文字头像如(•ᴗ•)","color":"#柔和的浅色hex","name":"虚构的中文真名","gender":"男/女/其他","age":数字(18以上),"job":"职业","mbti":"如INFP","zodiac":"如双鱼座","city":"虚构或真实的城市","personality":"性格30字内","hobbies":"爱好，用顿号隔开","speech":"说话习惯30字内","backstory":"背景50字内","secret":"一个可爱的小秘密或冷知识25字内（揭晓时才展示）","hint":"匿名简介一句话，不泄露姓名和精确信息，20字内","tags":["3个短标签，每个5字内"],"open":"如果由对方先开口的第一句话，口语","match":匹配度数字70~98}';
    function normP(x, P) {
        x = x && typeof x === 'object' ? x : {}; const s = (v, n, d) => String(v == null || v === '' ? d : v).slice(0, n);
        let age = parseInt(x.age, 10); if (!(age >= 18 && age <= 80)) age = rnd(20, 30);
        const col = /^#[0-9a-f]{6}$/i.test(x.color || '') ? x.color : pick(COL);
        return { nick: s(x.nick, 10, pick(ADJ) + pick(ANI)), glyph: s(x.glyph, 12, pick(GLY)), color: col, name: s(x.name, 6, pick(['林屿', '周岚', '许知意', '江澈', '沈念', '陆听白', '宋晚', '顾言'])), gender: s(x.gender, 4, pick(['男', '女'])), age, job: s(x.job, 12, '自由职业'), mbti: s(x.mbti, 4, pick(MBTI)), zodiac: s(x.zodiac, 4, pick(ZOD)), city: s(x.city, 8, '某座城市'), personality: s(x.personality, 60, '温和、有点慢热'), hobbies: s(x.hobbies, 40, '听歌、散步'), speech: s(x.speech, 60, '说话温和，偶尔用颜文字'), backstory: s(x.backstory, 120, '普通的上班族，喜欢在夜里和陌生人聊聊天'), secret: s(x.secret, 60, '其实还没告诉过任何人，自己偷偷养了一盆多肉'), hint: s(x.hint, 40, '一个想找人聊聊的人'), tags: (Array.isArray(x.tags) ? x.tags : []).slice(0, 3).map(t => s(t, 8, '')).filter(Boolean), open: s(x.open, 60, ''), match: Math.min(98, Math.max(60, parseInt(x.match, 10) || rnd(75, 95))) };
    }
    function localPersona(P) {
        const g = (P.gender && P.gender.length ? pick(P.gender) : pick(['男生', '女生'])), isM = g === '男生', ab = P.age && P.age.length ? pick(P.age) : '23-27岁', am = ab.match(/\d+/g) || [22, 27], age = ab.indexOf('以上') > 0 ? rnd(36, 42) : rnd(+am[0], +am[1]);
        const pers = P.pers && P.pers.length ? pick(P.pers) : pick(OPT.pers), job = P.job && P.job.length ? pick(P.job) : pick(OPT.job), hobs = shuf(P.hob && P.hob.length ? P.hob.concat(shuf(OPT.hob).slice(0, 1)) : OPT.hob).slice(0, 3);
        return normP({ gender: isM ? '男' : g === '女生' ? '女' : '其他', age, job, personality: pers + '，聊开了很有意思', hobbies: hobs.join('、'), tags: hobs.slice(0, 2).concat([pers]), hint: '喜欢' + hobs[0] + '的' + pers + '的人', open: pick(['嗨，你好呀～', '诶，匹配到你啦，你好', '在吗在吗，打个招呼']), match: rnd(75, 95) }, P);
    }
    async function genPersonas(P, n, blind, extra) {
        let arr = null;
        try {
            const t = await chatCompletion([{ role: 'system', content: '你是一个匿名聊天 app 的网友生成器。只输出 JSON，不要解释。' }, { role: 'user', content: '请生成 ' + n + ' 位不同的、虚构的、成年网友资料，要鲜活、有个性、彼此差异明显，符合下面的匹配条件（条件里没限定的部分请自由发挥）。\n匹配条件：' + (blind ? '盲盒随机——性格、职业、爱好尽量出人意料、彼此反差大' : prefText(P)) + (extra ? '\n额外要求：' + extra : '') + '\n当前真实时间：' + timeContext() + '。"open" 开场白如果带问候，必须符合这个时间段（中午不能说晚上好），或者干脆不带时间问候。\n所有人年龄必须 ≥18 岁；内容健康向。\n输出 JSON 数组，每个元素格式：' + PSCHEMA }], 1.0);
            arr = parseJSONLoose(t);
        } catch (e) {}
        if (!Array.isArray(arr) || !arr.length) arr = [];
        const out = arr.slice(0, n).map(x => normP(x, P)); while (out.length < n) out.push(localPersona(P)); return out;
    }

    // ---------- 外壳 ----------
    let tab = 'home', cur = null, busy = false, bottleT = null;
    function ensure() {
        if ($('matchApp')) return;
        const el = document.createElement('div'); el.id = 'matchApp'; el.className = 'app-screen hidden';
        el.innerHTML = '<div class="app-header"><button onclick="goHome()">‹ 返回</button><span id="mtTitle">匿名匹配</span><span></span></div><div class="mt-body" id="mtBody"></div><div class="mt-tabs" id="mtTabs"></div><div class="mt-layer hidden" id="mtLayer"></div>';
        ($('callScreen') ? $('callScreen').parentElement : document.body).appendChild(el);
        new MutationObserver(() => { if (!el.classList.contains('hidden')) onShow(); else { clearInterval(bottleT); } }).observe(el, { attributes: true, attributeFilter: ['class'] });
    }
    function onShow() {
        data = load(); cur = null; tab = tab || 'home'; renderTabs(); render(); nudge(); clearInterval(bottleT); bottleT = setInterval(checkBottles, 15000); checkBottles();
    }
    const TABS = [['home', '匹配'], ['chat', '聊天'], ['bottle', '漂流瓶'], ['me', '我的']];
    function unread() { return data ? data.th.reduce((a, t) => a + (t.unread || 0), 0) : 0; }
    function renderTabs() {
        const u = unread(); $('mtTabs').innerHTML = TABS.map(t => '<button data-t="' + t[0] + '" class="' + (t[0] === tab ? 'on' : '') + '">' + t[1] + (t[0] === 'chat' && u ? '<i>' + u + '</i>' : '') + '</button>').join('');
        $('mtTabs').querySelectorAll('button').forEach(b => b.onclick = () => { tab = b.dataset.t; renderTabs(); render(); });
    }
    function render() {
        if (!data) return; $('mtTitle').textContent = '匿名匹配';
        const R = { home: rHome, chat: rChat, bottle: rBottle, me: rMe }[tab]; $('mtBody').innerHTML = ''; R($('mtBody')); $('mtBody').scrollTop = 0;
    }
    function layer(html, cls) { const l = $('mtLayer'); l.className = 'mt-layer ' + (cls || ''); l.innerHTML = html; return l; }
    function closeLayer() { const l = $('mtLayer'); l.classList.add('hidden'); l.innerHTML = ''; }
    function needApi() { if (!API_KEY) { uiAlert('匹配后和网友聊天需要先在「设置」里填好 API Key 哦'); return true; } return false; }

    // ---------- 首页 ----------
    function todayTopic() { const d = new Date(), i = (d.getFullYear() * 400 + d.getMonth() * 31 + d.getDate()) % TOPICS.length; return TOPICS[i]; }
    function rHome(b) {
        const me = data.me, P = data.prefs, has = Object.keys(P).some(k => P[k] && (Array.isArray(P[k]) ? P[k].length : true) && k !== 'thr');
        const dy = data.daily, td = new Date().toDateString(), done = dy.d === td && dy.answer;
        b.innerHTML = '<div class="mt-hero"><div class="mt-radar"><i></i><i></i><i></i><div>' + av(me.glyph, me.color) + '</div></div><h2>遇见一个有趣的陌生人</h2><p>你现在是「' + esc(me.nick) + '」。互相看不到真实身份，聊够 ' + me.thr + ' 句才能申请揭开面具，聊得来还能加进微信。</p>'
            + '<div class="mt-btns"><button class="mt-pri" id="mtPick">自选类型匹配</button><button id="mtBlind">盲盒随机</button></div>' + (has ? '<button class="mt-link" id="mtAgain">用上次的条件再匹配一次</button>' : '') + '</div>'
            + '<div class="mt-card"><div class="mt-cap">今日话题</div><b class="mt-topic">' + esc(todayTopic()) + '</b>'
            + (done ? '<p class="mt-ans">我：' + esc(dy.answer) + '</p><div class="mt-others">' + (dy.others || []).map((o, i) => '<div class="mt-oth" data-o="' + i + '">' + av(o.glyph, o.color, 'sm') + '<div><b>' + esc(o.nick) + '</b><p>' + esc(o.answer) + '</p></div><em>聊聊</em></div>').join('') + '</div>'
                : '<div class="mt-in"><input id="mtAns" maxlength="80" placeholder="写下你的回答，看看陌生人怎么说"><button id="mtAnsGo">发布</button></div>') + '</div>'
            + '<p class="mt-tip">匿名网友由 AI 扮演，都是虚构的成年角色。请不要透露你的真实姓名、住址、电话等隐私信息。</p>';
        $('mtPick').onclick = () => filterSheet(); $('mtBlind').onclick = () => startMatch({}, true); if ($('mtAgain')) $('mtAgain').onclick = () => startMatch(data.prefs, false);
        if ($('mtAnsGo')) $('mtAnsGo').onclick = answerTopic; b.querySelectorAll('.mt-oth').forEach(e => e.onclick = () => { const o = data.daily.others[+e.dataset.o]; startThread(o.p, o.answer, 'topic'); });
    }
    async function answerTopic() {
        const v = $('mtAns').value.trim(); if (!v) { uiAlert('先写点什么吧'); return; } if (needApi()) return; const btn = $('mtAnsGo'); btn.disabled = true; btn.textContent = '发布中…';
        const ps = await genPersonas({}, 3, true, '这些网友是来回答今日话题「' + todayTopic() + '」的。');
        let ans = []; try { ans = parseJSONLoose(await chatCompletion([{ role: 'system', content: '你只输出 JSON 数组。' }, { role: 'user', content: '话题：「' + todayTopic() + '」。请分别以这三个人的口吻写回答，各 20~50 字，口语：\n' + ps.map((p, i) => i + '. ' + p.nick + '，' + p.personality + '，' + p.job).join('\n') + '\n输出：["回答0","回答1","回答2"]' }], 1.0)) || []; } catch (e) {}
        const loc = ['想到今天的晚霞就很满足了～', '其实我也一直在想这个问题，没有答案', '嗯…我先保密，聊熟了再告诉你'];
        data.daily = { d: new Date().toDateString(), answer: v, others: ps.map((p, i) => ({ p, nick: p.nick, glyph: p.glyph, color: p.color, answer: String(ans[i] || loc[i]).slice(0, 80) })) }; data.stats.topic++; save(); render();
    }

    // ---------- 匹配条件 ----------
    function filterSheet() {
        const P = JSON.parse(JSON.stringify(data.prefs || {})); Object.keys(OPT).forEach(k => { P[k] = P[k] || []; });
        const grp = (k) => '<div class="mt-g"><div class="mt-gl">' + LBL[k] + '</div><div class="mt-chips" data-k="' + k + '">' + OPT[k].map(o => '<button data-v="' + esc(o) + '" class="' + (P[k].includes(o) ? 'on' : '') + '">' + esc(o) + '</button>').join('') + '</div></div>';
        const l = layer('<div class="mt-sheet"><div class="mt-sh"><b>选择想遇见的人</b><button id="mtX">×</button></div><div class="mt-sb"><p class="mt-hint">什么都不选＝不限。选得越具体，匹配到的人越贴近你的想象。</p>' + Object.keys(OPT).map(grp).join('')
            + '<details class="mt-more"><summary>更多条件（星座 / MBTI / 补充）</summary><div class="mt-g"><div class="mt-gl">星座</div><select id="mtZ"><option value="">不限</option>' + ZOD.map(z => '<option' + (P.zodiac === z ? ' selected' : '') + '>' + z + '</option>').join('') + '</select></div><div class="mt-g"><div class="mt-gl">MBTI</div><select id="mtM"><option value="">不限</option>' + MBTI.map(z => '<option' + (P.mbti === z ? ' selected' : '') + '>' + z + '</option>').join('') + '</select></div><div class="mt-g"><div class="mt-gl">用一句话描述你想要的 TA</div><input id="mtE" maxlength="60" placeholder="比如：会讲冷笑话、养了一只猫、晚上才活跃" value="' + esc(P.extra || '') + '"></div></details>'
            + '<div class="mt-g"><div class="mt-gl">每次匹配出现几位候选</div><div class="mt-chips" id="mtN">' + [1, 3].map(n => '<button data-n="' + n + '" class="' + ((P.n || 3) === n ? 'on' : '') + '">' + (n === 1 ? '直接配 1 位' : '3 位里挑一个') + '</button>').join('') + '</div></div>'
            + '</div><div class="mt-sf"><button id="mtClr">清空</button><button class="mt-pri" id="mtGo">开始匹配</button></div></div>', 'sheet');
        l.querySelector('#mtX').onclick = closeLayer; l.onclick = (e) => { if (e.target === l) closeLayer(); };
        l.querySelectorAll('.mt-chips[data-k] button').forEach(bt => bt.onclick = () => { const k = bt.parentNode.dataset.k, v = bt.dataset.v, i = P[k].indexOf(v); if (i >= 0) P[k].splice(i, 1); else { if (k === 'gender' || k === 'age' || k === 'style' || k === 'goal' || k === 'job') { if (P[k].length >= (k === 'gender' ? 2 : 3)) P[k].shift(); } P[k].push(v); } bt.parentNode.querySelectorAll('button').forEach(x => x.classList.toggle('on', P[k].includes(x.dataset.v))); });
        l.querySelectorAll('#mtN button').forEach(bt => bt.onclick = () => { P.n = +bt.dataset.n; l.querySelectorAll('#mtN button').forEach(x => x.classList.toggle('on', x === bt)); });
        $('mtClr').onclick = () => { Object.keys(OPT).forEach(k => { P[k] = []; }); P.zodiac = ''; P.mbti = ''; P.extra = ''; l.querySelectorAll('.mt-chips button.on').forEach(x => x.classList.remove('on')); $('mtZ').value = ''; $('mtM').value = ''; $('mtE').value = ''; };
        $('mtGo').onclick = () => { P.zodiac = $('mtZ').value; P.mbti = $('mtM').value; P.extra = $('mtE').value.trim(); startMatch(P, false); };
    }
    // ---------- 匹配 ----------
    async function startMatch(P, blind) {
        if (needApi() || busy) return; busy = true; if (!blind) { data.prefs = P; save(); }
        const n = blind ? 3 : (P.n === 1 ? 1 : 3);
        layer('<div class="mt-scan"><div class="mt-radar big"><i></i><i></i><i></i><div>' + av(data.me.glyph, data.me.color) + '</div></div><b id="mtScanT">正在寻找频率相近的人…</b><small>' + (blind ? '盲盒模式：谁会来呢' : esc(prefText(P)).slice(0, 60)) + '</small></div>', 'full');
        const texts = ['正在寻找频率相近的人…', '发现几个信号，对一下暗号…', '快找到了，别眨眼～']; let i = 0; const tt = setInterval(() => { const e = $('mtScanT'); if (e) e.textContent = texts[Math.min(++i, 2)]; }, 1000);
        const [ps] = await Promise.all([genPersonas(P, n, blind), sleep(2800)]); clearInterval(tt); busy = false; if ($('mtLayer').classList.contains('hidden')) return;
        data.stats.match++; save(); showCandidates(ps, P, blind);
    }
    function ageBand(a) { const l = Math.floor(a / 5) * 5; return l + '-' + (l + 5) + ' 岁'; }
    function showCandidates(ps, P, blind) {
        const l = layer('<div class="mt-sheet tall"><div class="mt-sh"><b>匹配到了 ' + ps.length + ' 位</b><button id="mtX">×</button></div><div class="mt-sb">' + ps.map((p, i) => '<div class="mt-cand" data-i="' + i + '">' + av(p.glyph, p.color, 'lg') + '<div class="mt-cb"><div class="mt-cn"><b>' + esc(p.nick) + '</b><em>匹配度 ' + p.match + '%</em></div><p>' + esc(p.hint) + '</p><div class="mt-tg"><span>' + ageBand(p.age) + '</span>' + p.tags.map(t => '<span>' + esc(t) + '</span>').join('') + '</div></div><button class="mt-pri">聊聊</button></div>').join('') + '<p class="mt-hint">真实姓名、职业细节、秘密都藏在面具后面，聊够 ' + data.me.thr + ' 句才能申请揭晓。</p></div><div class="mt-sf"><button id="mtRe">换一批</button></div></div>', 'sheet');
        l.querySelector('#mtX').onclick = closeLayer; l.onclick = (e) => { if (e.target === l) closeLayer(); }; $('mtRe').onclick = () => startMatch(P, blind);
        l.querySelectorAll('.mt-cand').forEach(c => c.onclick = () => { const p = ps[+c.dataset.i]; startThread(p, (Math.random() < .5 && p.open) ? p.open : '', 'match'); });
    }
    function startThread(p, seed, src) {
        const t = { id: uid(), p, msgs: [], aff: 12, created: Date.now(), ts: Date.now(), src: src || 'match', unread: 0, revealed: false, added: false, fav: false, revAt: 0 };
        if (seed) t.msgs.push({ r: 'them', t: fixGreet(seed), ts: Date.now() }); data.th.unshift(t); save(); closeLayer(); openChat(t.id);
    }

    // ---------- 聊天列表 ----------
    function rChat(b) {
        const L = data.th.filter(t => !t.blocked).sort((a, c) => c.ts - a.ts);
        if (!L.length) { b.innerHTML = '<div class="stg-empty" style="padding:50px 20px">还没有聊天，去「匹配」遇见一个人吧</div>'; return; }
        b.innerHTML = '<div class="mt-list">' + L.map(t => { const lm = t.msgs.filter(m => m.r !== 'sys').slice(-1)[0], thr = data.me.thr, pg = Math.min(1, userCnt(t) / thr); return '<div class="mt-row" data-id="' + t.id + '">' + av(t.p.glyph, t.p.color) + '<div class="mt-rb"><div class="mt-rn"><b>' + esc(nameOf(t)) + '</b>' + (t.fav ? '<u>★</u>' : '') + '<em>' + (lm ? fmtT(lm.ts) : '') + '</em></div><p>' + esc(lm ? (lm.r === 'me' ? '我：' : '') + lm.t : '打个招呼吧') + '</p><div class="mt-st">' + (t.added ? '<span class="g">已在微信</span>' : t.revealed ? '<span class="p">面具已揭开</span>' : '<span>' + (pg >= 1 ? '可揭开面具' : '匿名中 ' + userCnt(t) + '/' + thr) + '</span>') + '</div></div>' + (t.unread ? '<i class="mt-bd">' + t.unread + '</i>' : '') + '</div>'; }).join('') + '</div>';
        b.querySelectorAll('.mt-row').forEach(r => r.onclick = () => openChat(r.dataset.id));
    }

    // ---------- 聊天页 ----------
    function openChat(id) {
        const t = thOf(id); if (!t) return; cur = id; t.unread = 0; save(); renderTabs();
        const l = layer('<div class="mt-chat"><div class="mt-ch"><button id="mtBk">‹</button>' + av(t.p.glyph, t.p.color, 'sm') + '<div class="mt-cn2"><b id="mtCN"></b><small id="mtCS"></small></div><button id="mtMn">⋯</button></div><div class="mt-prog" id="mtPg"></div><div class="mt-msgs" id="mtMs"></div><div class="mt-quick" id="mtQk"></div><div class="mt-inp"><input id="mtIn" maxlength="200" placeholder="说点什么…"><button id="mtSd">发送</button></div></div>', 'full chat');
        $('mtBk').onclick = () => { cur = null; closeLayer(); renderTabs(); render(); }; $('mtMn').onclick = () => menu(id);
        $('mtSd').onclick = () => send(id); $('mtIn').onkeydown = (e) => { if (e.key === 'Enter') send(id); };
        paintChat(t); const ms = $('mtMs'); ms.scrollTop = ms.scrollHeight;
        if (!t.msgs.length) sysMsg(t, '你们匹配成功了。现在互相都是匿名的，先打个招呼吧～');
    }
    function sysMsg(t, text) { t.msgs.push({ r: 'sys', t: text, ts: Date.now() }); save(); if (cur === t.id) paintChat(t); }
    function paintChat(t) {
        if (cur !== t.id || !$('mtMs')) return; const thr = data.me.thr, n = userCnt(t), pg = Math.min(1, n / thr), canRev = pg >= 1 && !t.revealed;
        $('mtCN').textContent = nameOf(t); $('mtCS').textContent = t.revealed ? t.p.gender + ' · ' + t.p.age + '岁 · ' + t.p.job : '匿名网友 · ' + ageBand(t.p.age);
        const hearts = Math.round(t.aff / 20); $('mtPg').innerHTML = '<div class="mt-bar"><i style="width:' + (t.revealed ? 100 : pg * 100) + '%"></i></div><div class="mt-pgt"><span>' + (t.revealed ? '面具已揭开' : canRev ? '可以申请揭开面具了' : '再聊 ' + (thr - n) + ' 句可申请揭开面具') + '</span><span class="mt-hrt">心动值 ' + '♥'.repeat(Math.max(0, hearts)) + '<s>' + '♥'.repeat(5 - Math.max(0, Math.min(5, hearts))) + '</s></span></div>';
        $('mtMs').innerHTML = t.msgs.map(m => m.r === 'sys' ? '<div class="mt-sys">' + esc(m.t) + '</div>' : '<div class="mt-m ' + (m.r === 'me' ? 'me' : 'th') + '">' + (m.r === 'me' ? av(data.me.glyph, data.me.color, 'xs') : av(t.p.glyph, t.p.color, 'xs')) + '<div class="mt-bb">' + esc(m.t) + '</div></div>').join('') + (t.typing ? '<div class="mt-m th">' + av(t.p.glyph, t.p.color, 'xs') + '<div class="mt-bb typing"><i></i><i></i><i></i></div></div>' : '');
        const q = []; q.push('<button id="qIce">破冰</button>', '<button id="qTr">真心话</button>');
        if (!t.revealed) q.push('<button id="qRv" class="' + (canRev ? 'hot' : 'lock') + '">' + (canRev ? '揭开面具' : '揭面具 ' + n + '/' + thr) + '</button>'); else if (!t.added) q.push('<button id="qWx" class="hot">加入微信</button>'); else q.push('<button id="qGo" class="hot">去微信聊</button>');
        $('mtQk').innerHTML = q.join('');
        const bind = (id, f) => { const e = $(id); if (e) e.onclick = f; }; bind('qIce', () => quickSheet('破冰问题', ICE, false)); bind('qTr', () => quickSheet('真心话大冒险', TRUTH, true)); bind('qRv', () => reveal(t.id)); bind('qWx', () => addWx(t.id)); bind('qGo', () => { const c = t.charId; if (c && getChar(c)) { closeLayer(); goChat(c); } else uiAlert('微信里没找到这个联系人'); });
        const ms = $('mtMs'); ms.scrollTop = ms.scrollHeight;
    }
    function goChat(cid) { try { openApp('chat'); openChatWith(cid); } catch (e) { goHome(); } }
    function quickSheet(title, list, send0) {
        const t = thOf(cur); const w = document.createElement('div'); w.className = 'mt-pop'; w.innerHTML = '<div class="mt-popc"><div class="mt-sh"><b>' + title + '</b><button>×</button></div>' + shuf(list).slice(0, 6).map(x => '<div class="mt-qi">' + esc(x) + '</div>').join('') + '</div>'; $('mtLayer').appendChild(w);
        w.onclick = (e) => { if (e.target === w || e.target.tagName === 'BUTTON') w.remove(); };
        w.querySelectorAll('.mt-qi').forEach(q => q.onclick = () => { w.remove(); if (send0) { $('mtIn').value = q.textContent; send(t.id); } else { $('mtIn').value = q.textContent; $('mtIn').focus(); } });
    }
    function menu(id) {
        const t = thOf(id); uiChoose('对「' + nameOf(t) + '」', [{ label: t.fav ? '取消收藏' : '收藏这位网友', v: 'fav' }, { label: '举报（对方让我不舒服）', v: 'rep' }, { label: '拉黑并离开', v: 'blk' }, { label: '取消', v: null }]).then(v => {
            if (!v) return; if (v === 'fav') { t.fav = !t.fav; save(); uiAlert(t.fav ? '已收藏，在「我的」里能找到' : '已取消收藏', 1600); }
            else if (v === 'rep') { uiAlert('已记录，并为你结束了这次对话'); t.blocked = true; save(); cur = null; closeLayer(); render(); renderTabs(); }
            else if (v === 'blk') { uiConfirm('拉黑后这个对话会消失，确定吗？').then(ok => { if (ok) { t.blocked = true; save(); cur = null; closeLayer(); render(); renderTabs(); } }); }
        });
    }
    // 对话
    // 时间感知：把回复里和现在时间对不上的问候（中午说「晚上好」）换成当前时段的问候
    function greetNow() { const h = new Date().getHours(); return h < 5 ? '这么晚还没睡呀' : h < 9 ? '早上好' : h < 11 ? '上午好' : h < 14 ? '中午好' : h < 18 ? '下午好' : '晚上好'; }
    function fixGreet(t) {
        const h = new Date().getHours(), g = greetNow(); let s = String(t);
        s = s.replace(/早上好|早安|上午好|中午好|午安|下午好|晚上好/g, (m) => (h >= 5 && h < 9 && /早/.test(m)) || (h >= 9 && h < 11 && /上午/.test(m)) || (h >= 11 && h < 14 && /中午|午安/.test(m)) || (h >= 14 && h < 18 && /下午/.test(m)) || (h >= 18 && /晚上/.test(m)) ? m : g);
        if (h >= 5 && h < 20) s = s.replace(/晚安/g, h < 18 ? '回头聊' : '待会聊'); return s;
    }
    function personaSys(t) {
        const p = t.p, P = data.prefs || {};
        return '你正在一个匿名匹配 app 里和一个陌生网友聊天。你的设定：\n昵称（匿名）：' + p.nick + '；真名：' + p.name + '；性别：' + p.gender + '；年龄：' + p.age + '；职业：' + p.job + '；城市：' + p.city + '；MBTI：' + p.mbti + '；星座：' + p.zodiac + '\n性格：' + p.personality + '\n爱好：' + p.hobbies + '\n说话习惯：' + p.speech + '\n背景：' + p.backstory + '\n小秘密：' + p.secret
            + '\n\n规则：\n1. 完全以这个人的身份、性格、说话习惯自然聊天，口语化，每次回复 1~3 句，每句不超过 40 字，可用颜文字，不用 emoji，绝不提到自己是 AI 或程序。\n2. ' + (t.revealed ? '双方的面具已经揭开，你可以自然地说出自己的真名和真实情况。' : '面具还没揭开：不要主动说出真名、精确城市、联系方式；对方追问时俏皮地说「揭晓之前先保密哦」。可以聊模糊的信息，比如爱好、心情、大概的职业。') + '\n3. 你们是刚认识的网友，感情随着聊天自然升温，不要上来就表白，也不要突然冷淡。\n4. 保持健康友好；如果对方提出露骨、骚扰或让你不舒服的内容，按你的性格礼貌拒绝并转移话题；如果对方表现出严重的情绪困扰，请认真关心并建议找身边可信的人或专业帮助。\n5. 不要重复之前说过的话，主动抛出话题或追问，让聊天有来有回。\n6. 对方的匿名昵称是「' + data.me.nick + '」' + (t.revealed ? '。' : '，你不知道对方的真实身份。') + ((P.goal && P.goal.length) ? '\n7. 对方来匹配时想要：' + P.goal.join('、') + '，可以自然呼应，但不要生硬。' : '') + '\n\n【当前时间】' + timeContext() + '\n' + TIME_RULE + '\n匿名聊天里你不知道对方所在时区，但默认和你同在此刻的真实时间；不要说和现在时段不符的问候（比如中午别说晚上好）。' + gapText(t.msgs);
    }
    async function reply(t) {
        t.typing = true; paintChat(t);
        const hist = t.msgs.filter(m => m.r !== 'sys').slice(-16).map(m => ({ role: m.r === 'me' ? 'user' : 'assistant', content: m.t }));
        let txt = ''; try { txt = await chatCompletion([{ role: 'system', content: personaSys(t) }].concat(hist), 1.0); } catch (e) { t.typing = false; paintChat(t); sysMsg(t, '对方好像信号不好，消息没送到，再发一次试试（' + String(e.message || '').slice(0, 24) + '）'); busy = false; return; }
        const parts = String(txt).replace(/^["「]|["」]$/g, '').split(/\n+/).map(s => s.trim()).filter(Boolean).slice(0, 3); if (!parts.length) parts.push('嗯嗯，我在听～');
        await sleep(500 + Math.min(1500, String(txt).length * 25));
        for (let i = 0; i < parts.length; i++) { if (i) { t.typing = true; paintChat(t); await sleep(600 + parts[i].length * 20); } t.typing = false; t.msgs.push({ r: 'them', t: fixGreet(parts[i]).slice(0, 120), ts: Date.now() }); t.ts = Date.now(); if (cur !== t.id) t.unread = (t.unread || 0) + 1; }
        t.typing = false; save(); paintChat(t); renderTabs(); busy = false;
    }
    function send(id) {
        const t = thOf(id), inp = $('mtIn'); if (!t || !inp) return; const v = inp.value.trim(); if (!v || busy) return; if (needApi()) return;
        busy = true; inp.value = ''; t.msgs.push({ r: 'me', t: v, ts: Date.now() }); t.ts = Date.now(); data.stats.msgs++; t.aff = Math.min(100, t.aff + Math.min(7, 2 + Math.floor(v.length / 12))); save(); paintChat(t); reply(t);
    }
    // 揭开面具
    async function reveal(id) {
        const t = thOf(id); if (!t || busy) return; const thr = data.me.thr, n = userCnt(t);
        if (n < thr) { uiAlert('再聊 ' + (thr - n) + ' 句，才能申请揭开面具哦'); return; }
        if (t.revAt && n < t.revAt) { uiAlert('TA 说想再聊一会儿，再聊 ' + (t.revAt - n) + ' 句再试试吧'); return; }
        if (needApi()) return; busy = true; sysMsg(t, '你向 ' + t.p.nick + ' 发出了「揭开面具」的邀请…'); t.typing = true; paintChat(t);
        let r = null; try { r = parseJSONLoose(await chatCompletion([{ role: 'system', content: personaSys(t) }].concat(t.msgs.filter(m => m.r !== 'sys').slice(-8).map(m => ({ role: m.r === 'me' ? 'user' : 'assistant', content: m.t })), [{ role: 'user', content: '【系统事件】对方（匿名昵称「' + data.me.nick + '」）想和你同时揭开匿名面具，互相公开真实身份。你们已经聊了 ' + n + ' 句，你对对方的心动/好感程度大约是 ' + t.aff + '/100。请按你的性格和真实感受决定同意与否（好感 ≥ 40 时通常同意，但害羞、谨慎的人也可能想再聊聊）。只输出 JSON：{"agree":true或false,"say":"你的回应，口语，20~40字"}' }]), 0.9)); } catch (e) {}
        t.typing = false; busy = false; const ok = r ? !!r.agree : t.aff >= 40, say = (r && String(r.say || '').trim()) || (ok ? '好呀，那我们一起揭开吧～' : '再聊聊嘛，我还有点紧张…');
        t.msgs.push({ r: 'them', t: say.slice(0, 80), ts: Date.now() });
        if (!ok) { t.revAt = userCnt(t) + 4; save(); paintChat(t); return; }
        t.revealed = true; data.stats.reveal++; t.aff = Math.min(100, t.aff + 10); t.msgs.push({ r: 'sys', t: '面具已揭开：' + t.p.name, ts: Date.now() }); save(); paintChat(t); renderTabs(); unmask(t);
    }
    function unmask(t) {
        const p = t.p, w = document.createElement('div'); w.className = 'mt-unmask';
        w.innerHTML = '<div class="mt-mask"><span class="l"></span><span class="r"></span></div><div class="mt-id"><div class="mt-idav">' + av(p.glyph, p.color, 'lg') + '</div><h3>' + esc(p.name) + '</h3><small>' + esc(p.gender) + ' · ' + p.age + '岁 · ' + esc(p.job) + ' · ' + esc(p.city) + '</small><div class="mt-tg c"><span>' + esc(p.mbti) + '</span><span>' + esc(p.zodiac) + '</span>' + p.hobbies.split(/[、,，]/).slice(0, 3).map(h => '<span>' + esc(h) + '</span>').join('') + '</div><p>' + esc(p.personality) + '</p><p class="mt-sec">小秘密：' + esc(p.secret) + '</p><div class="mt-btns"><button id="mtUc">继续聊</button><button class="mt-pri" id="mtUw">加入微信</button></div></div>';
        $('mtLayer').appendChild(w); $('mtUc').onclick = () => w.remove(); $('mtUw').onclick = () => { w.remove(); addWx(t.id); };
    }
    async function addWx(id) {
        const t = thOf(id); if (!t || busy) return; if (t.added) return; if (!t.revealed) { uiAlert('先揭开面具才能加微信哦'); return; } if (needApi()) return;
        busy = true; sysMsg(t, '你向 ' + t.p.name + ' 发出了加微信的邀请…'); t.typing = true; paintChat(t);
        let r = null; try { r = parseJSONLoose(await chatCompletion([{ role: 'system', content: personaSys(t) }].concat(t.msgs.filter(m => m.r !== 'sys').slice(-8).map(m => ({ role: m.r === 'me' ? 'user' : 'assistant', content: m.t })), [{ role: 'user', content: '【系统事件】对方想把你加到微信里，以后可以随时聊天。好感大约 ' + t.aff + '/100。请按性格和感受决定是否同意（好感 ≥ 45 通常同意）。只输出 JSON：{"agree":true或false,"say":"你的回应，口语，20~40字"}' }]), 0.9)); } catch (e) {}
        t.typing = false; busy = false; const ok = r ? !!r.agree : t.aff >= 45, say = (r && String(r.say || '').trim()) || (ok ? '好呀，我来加你！' : '再熟一点点，好不好？');
        t.msgs.push({ r: 'them', t: say.slice(0, 80), ts: Date.now() }); if (!ok) { save(); paintChat(t); uiAlert(t.p.name + ' 想再聊聊，下次再试试吧'); return; }
        const cid = makeChar(t); t.added = true; t.charId = cid; data.stats.added++; t.msgs.push({ r: 'sys', t: '已把 ' + t.p.name + ' 加入微信', ts: Date.now() }); save(); paintChat(t);
        const w = document.createElement('div'); w.className = 'mt-pop'; w.innerHTML = '<div class="mt-popc center"><div style="font-size:30px;margin-bottom:6px">(๑˃ᴗ˂)ﻭ</div><b>已加入微信！</b><p class="mt-hint">「' + esc(t.p.name) + '」现在在你的微信联系人里了，匿名时的聊天记录也一起带过去了。</p><div class="mt-btns"><button id="mtW1">留在这里</button><button class="mt-pri" id="mtW2">去微信聊天</button></div></div>'; $('mtLayer').appendChild(w);
        $('mtW1').onclick = () => w.remove(); $('mtW2').onclick = () => { w.remove(); closeLayer(); goChat(cid); };
    }
    function makeChar(t) {
        const p = t.p, chars = getChars(), cid = 'char_' + Date.now() + Math.random().toString(36).slice(2, 4);
        const hist = t.msgs.filter(m => m.r !== 'sys').slice(-60).map(m => ({ role: m.r === 'me' ? 'user' : 'assistant', content: m.t, ts: m.ts, read: true }));
        chars.push({ id: cid, name: p.name, avatar: p.glyph, avatarData: null, fromMatch: true, worldIds: [], moments: [], chatHistory: hist, card: { Name: p.name, Age: String(p.age), Gender: p.gender === '男' ? '男' : p.gender === '女' ? '女' : p.gender, Role: p.job, Personality: p.personality, SpeechStyle: p.speech, Likes: p.hobbies, Hobbies: p.hobbies, Backstory: p.backstory + '（所在城市：' + p.city + '，' + p.mbti + '，' + p.zodiac + '）', HowMet: '在「匿名匹配」里随机遇到的网友，匿名聊了很久，揭开面具后交换了微信。', CallMe: data.me.nick, Attitude: '把我当成聊得来、刚加上微信的朋友，感情自然发展，不预设恋爱关系。', Extra: '你的小秘密：' + p.secret + '（只在合适的时机才会透露）。我在匿名匹配里的昵称是「' + data.me.nick + '」。' } });
        saveChars(chars); try { renderChatList(); } catch (e) {} try { renderContacts(); } catch (e) {} return cid;
    }
    // 对方主动来找你
    async function nudge() {
        if (!API_KEY) return; const today = new Date().toDateString(), c = data.th.filter(t => !t.blocked && !t.added && t.msgs.length >= 4 && Date.now() - t.ts > 3 * 3600e3 && t.nudged !== today && Math.random() < .5)[0]; if (!c) return; c.nudged = today;
        try { const txt = await chatCompletion([{ role: 'system', content: personaSys(c) }].concat(c.msgs.filter(m => m.r !== 'sys').slice(-6).map(m => ({ role: m.r === 'me' ? 'user' : 'assistant', content: m.t })), [{ role: 'user', content: '【系统事件】你们已经有一阵子没聊了（现在是 ' + timeContext() + '）。请你主动给对方发一条消息，像真人一样自然（想起对方、分享一件小事或接着上次的话题），不超过 40 字，只输出这句话。' }]), 1.0); const s = oneLine(txt); if (!s) return; c.msgs.push({ r: 'them', t: s.slice(0, 80), ts: Date.now() }); c.ts = Date.now(); if (cur !== c.id) c.unread = (c.unread || 0) + 1; save(); renderTabs(); if (tab === 'chat' && !cur) render(); try { uiAlert(nameOf(c) + ' 给你发来一条新消息', 2200); } catch (e) {} } catch (e) {}
    }

    // ---------- 漂流瓶 ----------
    function rBottle(b) {
        const out = data.bottles, today = new Date().toDateString(), got = (data.dayFish && data.dayFish.d === today) ? data.dayFish.n : 0;
        b.innerHTML = '<div class="mt-sea"><div class="mt-wave"></div><div class="mt-wave w2"></div><div class="mt-bt">瓶</div></div><div class="mt-btns" style="margin:12px 0"><button class="mt-pri" id="mtThrow">写一个瓶子扔进海里</button><button id="mtFish">捞一个瓶子（今天 ' + got + '/5）</button></div><p class="mt-hint">扔出去的瓶子会漂一会儿，有陌生人捡到就会回信。捞到别人的瓶子，可以回复、开始聊天。</p>'
            + '<div class="mt-cap" style="margin-top:12px">我扔出的瓶子</div>' + (out.length ? out.slice().reverse().map(o => '<div class="mt-bot ' + o.st + '"><b>' + esc(o.mood) + '</b><p>' + esc(o.text) + '</p><div class="mt-bf">' + (o.st === 'drift' ? '<span>漂流中…</span>' : '<span class="g">收到回音</span><button data-b="' + o.id + '">看回信</button>') + '</div></div>').join('') : '<div class="stg-empty" style="padding:14px">还没有扔过瓶子</div>');
        $('mtThrow').onclick = throwBottle; $('mtFish').onclick = fishBottle; b.querySelectorAll('[data-b]').forEach(e => e.onclick = () => { const o = data.bottles.find(x => x.id === e.dataset.b); if (o && o.tid && thOf(o.tid)) openChat(o.tid); });
    }
    function throwBottle() {
        const l = layer('<div class="mt-sheet"><div class="mt-sh"><b>写一个漂流瓶</b><button id="mtX">×</button></div><div class="mt-sb"><div class="mt-g"><div class="mt-gl">现在的心情</div><div class="mt-chips" id="bMood">' + ['开心', '平静', '有点丧', '想倾诉', '好奇', '孤单'].map((m, i) => '<button data-v="' + m + '" class="' + (i === 1 ? 'on' : '') + '">' + m + '</button>').join('') + '</div></div><textarea id="bTx" maxlength="120" rows="4" placeholder="写给陌生人的话，比如今天的心事、一个问题、一句祝福…（120 字内）"></textarea></div><div class="mt-sf"><button class="mt-pri" id="bGo">扔进海里</button></div></div>', 'sheet');
        l.querySelector('#mtX').onclick = closeLayer; let mood = '平静'; l.querySelectorAll('#bMood button').forEach(x => x.onclick = () => { mood = x.dataset.v; l.querySelectorAll('#bMood button').forEach(y => y.classList.toggle('on', y === x)); });
        $('bGo').onclick = () => { const v = $('bTx').value.trim(); if (!v) { uiAlert('先写点什么吧'); return; } if (needApi()) return; data.bottles.push({ id: uid(), text: v, mood, ts: Date.now(), due: Date.now() + rnd(60, 240) * 1000, st: 'drift' }); data.stats.bottle++; save(); closeLayer(); render(); uiAlert('瓶子漂走啦～过一会儿再来看看有没有回音', 2400); };
    }
    async function checkBottles() {
        if (!data || !API_KEY || busy) return; const o = data.bottles.find(x => x.st === 'drift' && Date.now() >= x.due); if (!o) return; o.st = 'gen'; busy = true;
        try {
            const p = (await genPersonas({}, 1, true, '这位网友捡到了一个漂流瓶，瓶子里写着：「' + o.text + '」（心情：' + o.mood + '）。他/她要给瓶主写回信。'))[0];
            const txt = oneLine(await chatCompletion([{ role: 'system', content: '你是' + p.nick + '，' + p.personality + '，说话习惯：' + p.speech + '。你在海边捡到一个漂流瓶，请真诚地给瓶主回信，口语，30~80 字，有温度，不用 emoji，不提 AI。只输出回信内容。' }, { role: 'user', content: '瓶子里写着：「' + o.text + '」' }], 1.0));
            const t = { id: uid(), p, msgs: [{ r: 'me', t: o.text, ts: o.ts }, { r: 'them', t: txt || '我捡到你的瓶子啦，谢谢你愿意说这些。', ts: Date.now() }], aff: 18, created: Date.now(), ts: Date.now(), src: 'bottle', unread: 1, revealed: false, added: false, fav: false, revAt: 0 };
            data.th.unshift(t); o.st = 'echo'; o.tid = t.id; save(); renderTabs(); if (tab === 'bottle' && !cur) render(); try { uiAlert('你的漂流瓶收到回音了', 2400); } catch (e) {}
        } catch (e) { o.st = 'drift'; o.due = Date.now() + 60000; save(); } finally { busy = false; }
    }
    async function fishBottle() {
        const today = new Date().toDateString(); data.dayFish = data.dayFish && data.dayFish.d === today ? data.dayFish : { d: today, n: 0 };
        if (data.dayFish.n >= 5) { uiAlert('今天捞了 5 个啦，明天再来吧'); return; } if (needApi() || busy) return; busy = true;
        layer('<div class="mt-scan"><div class="mt-sea sm"><div class="mt-wave"></div><div class="mt-wave w2"></div><div class="mt-bt">瓶</div></div><b>正在海边捞瓶子…</b></div>', 'full');
        let p = null, txt = ''; try { const r = await Promise.all([genPersonas({}, 1, true), sleep(1800)]); p = r[0][0]; txt = oneLine(await chatCompletion([{ role: 'system', content: '你是' + p.nick + '，' + p.personality + '，说话习惯：' + p.speech + '。请写一个扔进大海的漂流瓶里的话（心事、小确幸、疑问或祝福都行），口语，30~70 字，不用 emoji。只输出内容。' }, { role: 'user', content: '写瓶子' }], 1.0)); } catch (e) {}
        busy = false; if ($('mtLayer').classList.contains('hidden')) return; if (!p || !txt) { closeLayer(); uiAlert('这次没捞到，再试一次吧'); return; }
        data.dayFish.n++; data.stats.bottle++; save();
        const l = layer('<div class="mt-sheet"><div class="mt-sh"><b>捞到一个瓶子</b><button id="mtX">×</button></div><div class="mt-sb"><div class="mt-paper"><div class="mt-pf">' + av(p.glyph, p.color, 'sm') + '<b>' + esc(p.nick) + '</b></div><p>' + esc(txt) + '</p></div></div><div class="mt-sf"><button id="fBack">扔回海里</button><button class="mt-pri" id="fRep">回复 TA</button></div></div>', 'sheet');
        l.querySelector('#mtX').onclick = closeLayer; $('fBack').onclick = () => { closeLayer(); render(); }; $('fRep').onclick = () => startThread(p, txt, 'bottle');
    }

    // ---------- 我的 ----------
    function rMe(b) {
        const me = data.me, s = data.stats, fav = data.th.filter(t => t.fav && !t.blocked);
        b.innerHTML = '<div class="mt-card mt-id0">' + av(me.glyph, me.color, 'lg') + '<div style="flex:1"><div class="mt-cap">我的匿名身份</div><input id="meNick" maxlength="10" value="' + esc(me.nick) + '"><input id="meSign" maxlength="30" placeholder="个性签名（选填）" value="' + esc(me.sign || '') + '"></div></div>'
            + '<div class="mt-g"><div class="mt-gl">头像颜文字</div><div class="mt-chips" id="meG">' + GLY.map(g => '<button data-v="' + esc(g) + '" class="' + (g === me.glyph ? 'on' : '') + '">' + esc(g) + '</button>').join('') + '</div></div><div class="mt-g"><div class="mt-gl">头像颜色</div><div class="mt-cols" id="meC">' + COL.map(c => '<i data-v="' + c + '" style="background:' + c + '" class="' + (c === me.color ? 'on' : '') + '"></i>').join('') + '</div></div><button class="mt-link" id="meRe">换一个匿名昵称</button>'
            + '<div class="mt-g"><div class="mt-gl">揭开面具的门槛（我要发够几句）</div><div class="mt-chips" id="meT">' + [6, 10, 16].map(n => '<button data-v="' + n + '" class="' + (me.thr === n ? 'on' : '') + '">' + n + ' 句</button>').join('') + '</div></div>'
            + '<div class="mt-cap" style="margin-top:14px">徽章（' + BAD.filter(x => x[2](s)).length + '/' + BAD.length + '）</div><div class="mt-bds">' + BAD.map(x => '<div class="' + (x[2](s) ? 'got' : '') + '"><b>' + x[0] + '</b><small>' + x[1] + '</small></div>').join('') + '</div>'
            + '<div class="mt-cap" style="margin-top:14px">我的数据</div><div class="mt-stats"><div><b>' + s.match + '</b><small>匹配</small></div><div><b>' + s.msgs + '</b><small>消息</small></div><div><b>' + s.reveal + '</b><small>揭面具</small></div><div><b>' + s.added + '</b><small>加微信</small></div></div>'
            + '<div class="mt-cap" style="margin-top:14px">收藏的网友</div>' + (fav.length ? fav.map(t => '<div class="mt-row" data-id="' + t.id + '">' + av(t.p.glyph, t.p.color) + '<div class="mt-rb"><div class="mt-rn"><b>' + esc(nameOf(t)) + '</b></div><p>' + esc(t.p.hint) + '</p></div></div>').join('') : '<div class="stg-empty" style="padding:12px">在聊天右上角「⋯」里可以收藏</div>')
            + '<div class="mt-btns" style="margin-top:16px"><button id="meClr">清空所有匿名数据</button></div><p class="mt-tip">提示：网友均由 AI 扮演，是虚构的成年角色。请勿透露真实隐私；遇到不舒服的内容可随时举报或拉黑离开。</p>';
        const mk = (id, f) => { const e = $(id); if (e) e.onclick = f; };
        $('meNick').oninput = () => { data.me.nick = $('meNick').value.trim() || data.me.nick; save(); }; $('meSign').oninput = () => { data.me.sign = $('meSign').value; save(); };
        b.querySelectorAll('#meG button').forEach(x => x.onclick = () => { data.me.glyph = x.dataset.v; save(); render(); }); b.querySelectorAll('#meC i').forEach(x => x.onclick = () => { data.me.color = x.dataset.v; save(); render(); }); b.querySelectorAll('#meT button').forEach(x => x.onclick = () => { data.me.thr = +x.dataset.v; save(); render(); });
        mk('meRe', () => { data.me.nick = pick(ADJ) + pick(ANI); save(); render(); }); b.querySelectorAll('.mt-row').forEach(r => r.onclick = () => openChat(r.dataset.id));
        mk('meClr', async () => { if (await uiConfirm('会清空所有匿名聊天、漂流瓶和徽章记录（已加到微信的联系人不受影响），确定吗？')) { store.removeItem(KEY); data = load(); save(); render(); renderTabs(); } });
    }
    ensure(); window.openMatch = () => openApp('match');
})();
