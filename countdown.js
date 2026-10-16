/* countdown.js —— 倒数日（仿真实「倒数日」App）：每个事件可选「倒数」或「正数」，置顶大卡、分类、每年/每月/每周重复、详情里显示几年几月几天 */
(function () {
    'use strict';
    const $ = (id) => document.getElementById(id), esc = (s) => escapeHtml(String(s == null ? '' : s));
    const KEY = 'countdownData', CATS = ['生日', '纪念日', '节日', '考试', '旅行', '工作', '其他'], PAL = ['#ff6b8b', '#ff9f43', '#f6c344', '#5fc58a', '#4aa8e8', '#8a7be0', '#c58a6b', '#5a5f6b'];
    const REP = { none: '不重复', week: '每周', month: '每月', year: '每年' };
    const uid = () => 'c' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5), pad = (n) => String(n).padStart(2, '0');
    // 节日：阳历按「月-日」每年自动算；农历节日内置 2026–2030 年的阳历日期
    const SOLAR = [['元旦', '01-01'], ['情人节', '02-14'], ['妇女节', '03-08'], ['愚人节', '04-01'], ['劳动节', '05-01'], ['儿童节', '06-01'], ['建党节', '07-01'], ['建军节', '08-01'], ['教师节', '09-10'], ['国庆节', '10-01'], ['万圣节', '10-31'], ['平安夜', '12-24'], ['圣诞节', '12-25']];
    const LUNAR = {
        '春节': ['2026-02-17', '2027-02-06', '2028-01-26', '2029-02-13', '2030-02-03'], '元宵节': ['2026-03-03', '2027-02-20', '2028-02-09', '2029-02-27', '2030-02-17'],
        '端午节': ['2026-06-19', '2027-06-09', '2028-05-28', '2029-06-16', '2030-06-05'], '中秋节': ['2026-09-25', '2027-09-15', '2028-10-03', '2029-09-22', '2030-09-12'], '七夕': ['2026-08-19', '2027-08-08']
    };
    function D() { let d = null; try { d = JSON.parse(store.getItem(KEY) || 'null'); } catch (e) { } if (!d || !Array.isArray(d.items)) d = { items: [] }; return d; }
    function S(d) { try { store.setItem(KEY, JSON.stringify(d)); } catch (e) { uiAlert('保存失败，空间不够了'); } }
    const T = () => todayStr();
    function nextOcc(date, rep) { // 重复事件：找到今天或之后的下一次
        const t = T(); if (rep === 'none' || date >= t) return date;
        const p = date.split('-').map(Number); let y = p[0], m = p[1];
        if (rep === 'week') { const n = Math.ceil((dayNum(t) - dayNum(date)) / 7); return addDays(date, n * 7); }
        const mk = (yy, mm) => yy + '-' + pad(mm) + '-' + pad(Math.min(p[2], new Date(yy, mm, 0).getDate()));
        const ty = +t.slice(0, 4), tm = +t.slice(5, 7);
        if (rep === 'year') { let c = mk(ty, p[1]); if (c < t) c = mk(ty + 1, p[1]); return c; }
        let c = mk(ty, tm); if (c < t) { c = tm === 12 ? mk(ty + 1, 1) : mk(ty, tm + 1); } return c;
    }
    // 计算显示：返回 {n, label, sub, past}
    function calc(it) {
        const t = T();
        if (it.mode === 'up') { // 正数：从起始日算起，已经 N 天（起始日当天算第 1 天）
            const n = dayNum(t) - dayNum(it.date); return n >= 0 ? { n: n + 1, label: '第 N 天', unit: '天', cap: '已经', date: it.date, past: false } : { n: -n, cap: '距开始', unit: '天', date: it.date, past: false };
        }
        const tgt = nextOcc(it.date, it.repeat || 'none'), n = dayNum(tgt) - dayNum(t);
        if (n >= 0) return { n: n, cap: n === 0 ? '就是今天' : '还有', unit: n === 0 ? '' : '天', date: tgt, past: false, today: n === 0 };
        return { n: -n, cap: '已经过去', unit: '天', date: tgt, past: true };
    }
    function ymd(a, b) { // a<=b 日期字符串，返回 x年x个月x天
        let y = +b.slice(0, 4) - +a.slice(0, 4), m = +b.slice(5, 7) - +a.slice(5, 7), d = +b.slice(8, 10) - +a.slice(8, 10);
        if (d < 0) { m--; d += new Date(+b.slice(0, 4), +b.slice(5, 7) - 1, 0).getDate(); } if (m < 0) { y--; m += 12; }
        return (y ? y + '年' : '') + (m ? m + '个月' : '') + d + '天';
    }
    const wk = (s) => '周' + '日一二三四五六'[new Date(s + 'T00:00:00').getDay()];
    const sortFn = (a, b) => (b.pin ? 1 : 0) - (a.pin ? 1 : 0) || (() => { const x = calc(a), y = calc(b); if (x.past !== y.past) return x.past ? 1 : -1; if (a.mode !== b.mode) return a.mode === 'up' ? 1 : -1; return a.mode === 'up' ? y.n - x.n : x.n - y.n; })();

    try {
        if (allApps.indexOf('countdown') < 0) allApps.push('countdown');
        if (!HOME_APPS.some(a => a.id === 'countdown')) HOME_APPS.push({ id: 'countdown', name: '倒数日', cls: 'countdown-icon', face: '(✧ω✧)', go: () => openApp('countdown') });
        GLYPH.countdown = '<path d="M7 3.5h10M7 20.5h10"/><path d="M8 3.5c0 4 4 5 4 8.5s-4 4.5-4 8.5M16 3.5c0 4-4 5-4 8.5s4 4.5 4 8.5"/>';
    } catch (e) { }


    // ---------- 美化：每个事件都能自己配样式 ----------
    const THEMES = [['grad', '渐变'], ['solid', '纯色'], ['soft', '柔和'], ['line', '描边'], ['glass', '磨砂']];
    const FONTS = [['round', '圆润', '"Yuanti SC","YouYuan","HYChangYuanTi","Microsoft YaHei",system-ui,sans-serif'], ['serif', '衬线', 'Georgia,"Songti SC","Noto Serif SC",serif'], ['mono', '等宽', 'ui-monospace,Menlo,Consolas,monospace'], ['hand', '手写', '"Segoe Script","Bradley Hand","Kaiti SC","KaiTi",cursive'], ['bold', '粗黑', '"Arial Black","Heiti SC","PingFang SC",sans-serif']];
    const EMOJIS = ['♡', '★', '✦', '✧', '☾', '☼', '♪', '✿', '❀', '☁', '✉', '☺'];
    const hexOk = (v) => /^#[0-9a-f]{6}$/i.test(v || '');
    function mixHex(h, to, a) { // h 往 to(0=黑 255=白)混合 a
        if (!hexOk(h)) return h; const n = [1, 3, 5].map(i => parseInt(h.substr(i, 2), 16));
        return '#' + n.map(v => ('0' + Math.round(v + (to - v) * a).toString(16)).slice(-2)).join('');
    }
    function lum(h) { if (!hexOk(h)) return .5; const n = [1, 3, 5].map(i => parseInt(h.substr(i, 2), 16) / 255); return .299 * n[0] + .587 * n[1] + .114 * n[2]; }
    function skin(it) { // 把事件上的样式整理成完整配置（兼容旧数据：只有 color）
        const k = it.sk || {}, c1 = hexOk(k.c1) ? k.c1 : (hexOk(it.color) ? it.color : PAL[0]);
        return { theme: THEMES.some(t => t[0] === k.theme) ? k.theme : 'grad', c1: c1, c2: hexOk(k.c2) ? k.c2 : mixHex(c1, 255, .28), txt: ['auto', 'light', 'dark'].indexOf(k.txt) >= 0 ? k.txt : 'auto', font: FONTS.some(f => f[0] === k.font) ? k.font : 'round', emoji: String(k.emoji || '').slice(0, 4), img: typeof k.img === 'string' && k.img.indexOf('data:image') === 0 ? k.img : '', dim: k.dim !== false };
    }
    function skinCss(sk) { // 返回 {cls, style}
        const ff = (FONTS.find(f => f[0] === sk.font) || FONTS[0])[2];
        const light = sk.theme === 'soft' || sk.theme === 'line' || sk.theme === 'glass';
        let tx = sk.txt === 'light' ? '#ffffff' : sk.txt === 'dark' ? '#2b2230' : (sk.img ? '#ffffff' : light ? (lum(sk.c1) > .72 ? '#5a4650' : mixHex(sk.c1, 0, .25)) : (lum(sk.c1) > .8 ? '#2b2230' : '#ffffff'));
        let st = '--c1:' + sk.c1 + ';--c2:' + sk.c2 + ';--tx:' + tx + ';--ff:' + ff + ';';
        if (sk.img) st += 'background-image:' + (sk.dim ? 'linear-gradient(rgba(0,0,0,.30),rgba(0,0,0,.30)),' : '') + 'url(\'' + sk.img + '\');background-size:cover;background-position:center;';
        return { cls: 'sk-' + sk.theme + (sk.img ? ' sk-img' : ''), style: st };
    }

    let cat = '全部';
    function ensure() {
        if ($('countdownApp')) return;
        const el = document.createElement('div'); el.id = 'countdownApp'; el.className = 'app-screen hidden'; el.style.position = 'absolute';
        el.innerHTML = '<div class="app-header"><button onclick="goHome()">‹ 返回</button><span>倒数日</span><button class="hdr-btn" id="cdMore">更多</button></div><div class="scroll-area xa-body" id="cdBody"></div><button class="xa-fab" id="cdFab">＋</button>';
        ($('callScreen') ? $('callScreen').parentElement : document.body).appendChild(el);
        $('cdFab').onclick = () => edit(null); $('cdMore').onclick = more;
        new MutationObserver(() => { if (!el.classList.contains('hidden')) render(); }).observe(el, { attributes: true, attributeFilter: ['class'] });
    }
    function sheet(html) { const app = $('countdownApp'), m = document.createElement('div'); m.className = 'xa-mask'; m.innerHTML = '<div class="xa-sheet">' + html + '</div>'; m.addEventListener('mousedown', (e) => { if (e.target === m) m.remove(); }); app.appendChild(m); return m; }
    function bigHtml(c, it) { return c.today ? '<span style="font-size:40px">今天！</span>' : (c.n + '<small>' + c.unit + '</small>'); }
    function render() {
        const d = D(), body = $('cdBody'); if (!body) return;
        const all = d.items.slice().sort(sortFn); let h = '';
        if (!all.length) { body.innerHTML = '<div class="xa-empty">还没有倒数日<br>点右下角「＋」添加一个：生日、纪念日、考试、旅行…<br>也可以选「正数」，记录在一起已经多少天</div><div class="xa-btns"><button id="cdTpl">从节日里挑</button><button id="cdTa">导入和 TA 的纪念日</button></div>'; $('cdTpl').onclick = () => tplSheet(); $('cdTa').onclick = importTa; return; }
        const hero = all[0], hc = calc(hero);
        const hs = skin(hero), hk = skinCss(hs);
        h += '<div class="cd-hero ' + hk.cls + '" data-id="' + hero.id + '" style="' + hk.style + '">' + (hs.emoji ? '<span class="cd-emo">' + esc(hs.emoji) + '</span>' : '') + '<div class="tt">' + esc(hero.title) + (hero.mode === 'up' ? ' · 已经' : hc.past ? ' · 已过' : ' · 还有') + '</div><div class="num">' + bigHtml(hc, hero) + '</div><div class="dt">' + (hero.mode === 'up' ? '起始日 ' : '目标日 ') + hc.date + ' ' + wk(hc.date) + '</div></div>';
        const cats = ['全部', '倒数', '正数'].concat(CATS.filter(c => d.items.some(i => i.cat === c)));
        if (cats.indexOf(cat) < 0) cat = '全部';
        h += '<div class="cd-tabs">' + cats.map(c => '<button' + (c === cat ? ' class="on"' : '') + ' data-c="' + c + '">' + c + '</button>').join('') + '</div>';
        const rest = all.slice(1).filter(i => cat === '全部' || (cat === '倒数' ? i.mode !== 'up' : cat === '正数' ? i.mode === 'up' : i.cat === cat));
        const list = (cat === '全部' ? rest : all.filter(i => cat === '倒数' ? i.mode !== 'up' : cat === '正数' ? i.mode === 'up' : i.cat === cat));
        h += list.map(it => { const c = calc(it); const ks = skin(it), kk = skinCss(ks); return '<div class="cd-it ' + kk.cls + (c.past ? ' past' : '') + '" data-id="' + it.id + '" style="' + kk.style + '--cc:' + ks.c1 + '"><div class="l"><div class="tt">' + (ks.emoji ? '<span class="cd-eico">' + esc(ks.emoji) + '</span>' : '') + esc(it.title) + (it.pin ? '<span class="cd-pin">置顶</span>' : '') + '</div><div class="sb">' + (it.mode === 'up' ? '起始 ' : '') + c.date + ' ' + wk(c.date) + (it.repeat && it.repeat !== 'none' ? ' · ' + REP[it.repeat] : '') + '</div></div><div class="r"><b>' + (c.today ? '今天' : c.n) + '</b><span>' + (c.today ? '到啦' : c.cap + (it.mode === 'up' ? '（天）' : '（天）')) + '</span></div></div>'; }).join('');
        body.innerHTML = h;
        body.querySelectorAll('[data-id]').forEach(e => e.onclick = () => detail(e.dataset.id));
        body.querySelectorAll('[data-c]').forEach(e => e.onclick = () => { cat = e.dataset.c; render(); });
    }
    function detail(id) {
        const d = D(), it = d.items.find(x => x.id === id); if (!it) return; const c = calc(it), t = T();
        let ysub = '';
        if (it.mode === 'up') ysub = c.n && it.date <= t ? '从 ' + it.date + ' 到今天，一共 ' + ymd(it.date, t) : '';
        else ysub = c.past ? ymd(c.date, t) + '前' : (c.today ? '' : '还有 ' + ymd(t, c.date));
        const dk = skin(it), dc = skinCss(dk);
        const m = sheet('<div class="cd-det" style="--cc:' + dk.c1 + ';--ff:' + (FONTS.find(f => f[0] === dk.font) || FONTS[0])[2] + '">' + (dk.emoji ? '<div style="font-size:34px">' + esc(dk.emoji) + '</div>' : '') + '<div style="font-size:16px;color:var(--text-main);font-weight:600">' + esc(it.title) + '</div><div class="num">' + (c.today ? '今天' : c.n + '<small>天</small>') + '</div><div class="ymd">' + (it.mode === 'up' ? '已经 · ' : c.past ? '已经过去 · ' : '还有 · ') + (ysub ? esc(ysub) : '') + '</div><div class="ymd">' + (it.mode === 'up' ? '起始日 ' : '目标日 ') + c.date + ' ' + wk(c.date) + ' · ' + (it.mode === 'up' ? '正数日' : '倒数日') + (it.cat ? ' · ' + esc(it.cat) : '') + (it.repeat && it.repeat !== 'none' ? ' · ' + REP[it.repeat] : '') + '</div>' + (it.note ? '<div class="ymd" style="margin-top:10px;color:var(--text-main)">' + esc(it.note) + '</div>' : '') + '</div><div class="xa-btns"><button id="dtPin">' + (it.pin ? '取消置顶' : '置顶') + '</button><button id="dtEdit">编辑</button><button class="dan" id="dtDel">删除</button></div>');
        m.querySelector('#dtPin').onclick = () => { const dd = D(); dd.items.forEach(x => { if (x.id === id) x.pin = !x.pin; else if (!it.pin) x.pin = false; }); S(dd); m.remove(); render(); };
        m.querySelector('#dtEdit').onclick = () => { m.remove(); edit(id); };
        m.querySelector('#dtDel').onclick = async () => { if (!(await uiConfirm('删除「' + it.title + '」？'))) return; const dd = D(); dd.items = dd.items.filter(x => x.id !== id); S(dd); m.remove(); render(); };
    }
    function edit(id, pre) {
        const d = D(), it = id ? d.items.find(x => x.id === id) : null, x = it || Object.assign({ title: '', date: T(), mode: 'down', cat: '纪念日', repeat: 'none', note: '', color: PAL[Math.floor(Math.random() * PAL.length)], pin: false }, pre || {});
        let mode = x.mode || 'down'; const sk = skin(x);
        const chips = (arr, cur, key) => arr.map(a => '<button data-k="' + key + '" data-v="' + a[0] + '" class="' + (a[0] === cur ? 'on' : '') + '">' + a[1] + '</button>').join('');
        const m = sheet('<h3>' + (it ? '编辑' : '添加') + '</h3><div class="cd-seg" id="ceM"><button data-m="down">倒数日</button><button data-m="up">正数日</button></div>'
            + '<div class="xa-row"><input id="ceT" style="text-align:left;max-width:100%;width:100%;font-size:16px" placeholder="事件名称，例如：和 TA 的生日" value="' + esc(x.title) + '"></div>'
            + '<div class="xa-row"><span id="ceDl">目标日</span><input type="date" id="ceD" value="' + esc(x.date) + '"></div>'
            + '<div class="xa-row"><span>分类</span><select id="ceC">' + CATS.map(c => '<option' + (c === x.cat ? ' selected' : '') + '>' + c + '</option>').join('') + '</select></div>'
            + '<div class="xa-row"><span>重复</span><select id="ceR">' + Object.keys(REP).map(k => '<option value="' + k + '"' + (k === (x.repeat || 'none') ? ' selected' : '') + '>' + REP[k] + '</option>').join('') + '</select></div>'
            + '<div class="xa-row"><span>置顶</span><input type="checkbox" class="ios-switch" id="cePin"' + (x.pin ? ' checked' : '') + '></div>'
            + '<div class="xa-row"><input id="ceN" style="text-align:left;max-width:100%;width:100%" placeholder="备注（可不填）" value="' + esc(x.note || '') + '"></div>'
            + '<div class="xa-title" style="margin-top:14px">✧ 自己美化这张卡片（实时预览）</div><div class="cd-hero cd-prev" id="cePrev"></div>'
            + '<div class="cd-lab">样式</div><div class="cd-chip" id="ceTh">' + chips(THEMES, sk.theme, 'theme') + '</div>'
            + '<div class="cd-lab">颜色（点色块选，或用右边的取色器自定义）</div><div class="cd-colors" id="ceCol">' + PAL.map(c => '<i data-c="' + c + '" style="background:' + c + '"></i>').join('') + '<label class="cd-pick" title="自定义主色"><input type="color" id="ceC1"><b>主色</b></label><label class="cd-pick" title="渐变的另一端"><input type="color" id="ceC2"><b>渐变色</b></label></div>'
            + '<div class="cd-lab">文字颜色</div><div class="cd-chip" id="ceTx">' + chips([['auto', '自动'], ['light', '白字'], ['dark', '深色字']], sk.txt, 'txt') + '</div>'
            + '<div class="cd-lab">数字字体</div><div class="cd-chip" id="ceFt">' + FONTS.map(f => '<button data-k="font" data-v="' + f[0] + '" style="font-family:' + f[2] + '" class="' + (f[0] === sk.font ? 'on' : '') + '">' + f[1] + '</button>').join('') + '</div>'
            + '<div class="cd-lab">小贴纸（符号，可不选）</div><div class="cd-chip" id="ceEm"><button data-e="" class="">无</button>' + EMOJIS.map(e => '<button data-e="' + e + '">' + e + '</button>').join('') + '<input id="ceEmIn" maxlength="4" placeholder="自己输入" class="cd-emin"></div>'
            + '<div class="cd-lab">背景图片（自己上传喜欢的照片）</div><div class="cd-chip"><button id="ceImgUp">选择图片</button><button id="ceImgClr">清除图片</button><button id="ceDim" class="' + (sk.dim ? 'on' : '') + '">压暗保证文字清晰</button></div><input type="file" id="ceFile" accept="image/*" style="display:none">'
            + '<p style="font-size:12px;color:var(--text-sub);margin:8px 4px 6px;line-height:1.6" id="ceHint"></p><div class="xa-btns"><button id="ceCancel">取消</button><button class="pri" id="ceOk">保存</button></div>');
        const g = (i) => m.querySelector('#' + i);
        function paint() {
            const k = skinCss(sk), pv = g('cePrev'); pv.className = 'cd-hero cd-prev ' + k.cls; pv.style.cssText = k.style;
            pv.innerHTML = (sk.emoji ? '<span class="cd-emo">' + esc(sk.emoji) + '</span>' : '') + '<div class="tt">' + esc(g('ceT').value.trim() || '事件名称') + (mode === 'up' ? ' · 已经' : ' · 还有') + '</div><div class="num">' + (mode === 'up' ? '100' : '30') + '<small>天</small></div><div class="dt">' + (g('ceD').value || T()) + '</div>';
            m.querySelectorAll('#ceCol i').forEach(i => i.classList.toggle('on', i.dataset.c.toLowerCase() === sk.c1.toLowerCase()));
            g('ceC1').value = sk.c1; g('ceC2').value = sk.c2;
            [['ceTh', 'theme'], ['ceTx', 'txt'], ['ceFt', 'font']].forEach(p => g(p[0]).querySelectorAll('button').forEach(b => b.classList.toggle('on', b.dataset.v === sk[p[1]])));
            g('ceEm').querySelectorAll('button[data-e]').forEach(b => b.classList.toggle('on', b.dataset.e === sk.emoji));
            g('ceDim').classList.toggle('on', sk.dim); g('ceImgClr').style.display = sk.img ? '' : 'none'; g('ceDim').style.display = sk.img ? '' : 'none';
        }
        const setMode = () => { m.querySelectorAll('#ceM button').forEach(b => b.classList.toggle('on', b.dataset.m === mode)); g('ceDl').textContent = mode === 'up' ? '起始日' : '目标日'; g('ceHint').textContent = mode === 'up' ? '正数日：从起始日开始往后数，比如「在一起」「戒糖」，起始日当天算第 1 天。' : '倒数日：数到目标日还有多少天；重复事件（生日、纪念日）会自动算下一次。'; paint(); };
        m.querySelectorAll('#ceM button').forEach(b => b.onclick = () => { mode = b.dataset.m; setMode(); });
        m.querySelectorAll('#ceTh button,#ceTx button,#ceFt button').forEach(b => b.onclick = () => { sk[b.dataset.k] = b.dataset.v; paint(); });
        m.querySelectorAll('#ceCol i').forEach(i => i.onclick = () => { sk.c1 = i.dataset.c; sk.c2 = mixHex(sk.c1, 255, .28); paint(); });
        g('ceC1').oninput = (e) => { sk.c1 = e.target.value; paint(); }; g('ceC2').oninput = (e) => { sk.c2 = e.target.value; paint(); };
        m.querySelectorAll('#ceEm button[data-e]').forEach(b => b.onclick = () => { sk.emoji = b.dataset.e; g('ceEmIn').value = ''; paint(); });
        g('ceEmIn').oninput = (e) => { sk.emoji = e.target.value.trim().slice(0, 4); paint(); };
        g('ceImgUp').onclick = () => g('ceFile').click();
        g('ceFile').onchange = function () { const f = this.files && this.files[0]; if (!f) return; readImageCompressed(f, (u) => { sk.img = u; paint(); }, 700); this.value = ''; };
        g('ceImgClr').onclick = () => { sk.img = ''; paint(); }; g('ceDim').onclick = () => { sk.dim = !sk.dim; paint(); };
        g('ceT').oninput = paint; g('ceD').onchange = paint; setMode();
        g('ceCancel').onclick = () => m.remove();
        g('ceOk').onclick = () => {
            const t = g('ceT').value.trim(), dt = g('ceD').value; if (!t) { uiAlert('给它起个名字'); return; } if (!dt) { uiAlert('选一个日期'); return; }
            const dd = D(), o = { title: t, date: dt, mode: mode, cat: g('ceC').value, repeat: mode === 'up' ? 'none' : g('ceR').value, note: g('ceN').value.trim(), color: sk.c1, sk: { theme: sk.theme, c1: sk.c1, c2: sk.c2, txt: sk.txt, font: sk.font, emoji: sk.emoji, img: sk.img, dim: sk.dim }, pin: g('cePin').checked };
            if (o.pin) dd.items.forEach(z => z.pin = false);
            if (it) Object.assign(dd.items.find(z => z.id === id), o); else dd.items.push(Object.assign({ id: uid() }, o));
            S(dd); m.remove(); render();
        };
    }
    function tplSheet() {
        const t = T(), y = +t.slice(0, 4), list = [];
        SOLAR.forEach(s => { let dt = y + '-' + s[1]; if (dt < t) dt = (y + 1) + '-' + s[1]; list.push([s[0], dt, 'year']); });
        Object.keys(LUNAR).forEach(k => { const dt = LUNAR[k].find(z => z >= t); if (dt) list.push([k, dt, 'none']); });
        list.sort((a, b) => a[1].localeCompare(b[1]));
        const m = sheet('<h3>添加节日</h3><div class="xa-chips">' + list.map((s, i) => '<button data-i="' + i + '">' + s[0] + ' · ' + s[1].slice(5) + '</button>').join('') + '</div><p style="font-size:12px;color:var(--text-sub);line-height:1.6">阳历节日每年自动重复；农历节日（春节、元宵、端午、中秋、七夕）内置到 2030 年，过了之后到「更多」里重新添加即可。</p><div class="xa-btns"><button class="pri" id="tpOk">完成</button></div>');
        m.querySelector('#tpOk').onclick = () => m.remove();
        m.querySelectorAll('[data-i]').forEach(b => b.onclick = () => { const s = list[+b.dataset.i], dd = D(); if (dd.items.some(z => z.title === s[0] && z.date === s[1])) { uiAlert('已经添加过啦'); return; } dd.items.push({ id: uid(), title: s[0], date: s[1], mode: 'down', cat: '节日', repeat: s[2], note: '', color: PAL[Math.floor(Math.random() * PAL.length)], pin: false }); S(dd); b.classList.add('on'); render(); });
    }
    function importTa() {
        const c = getChar(getActiveCharId()); if (!c) { uiAlert('先创建并选择一个角色'); return; }
        const L = lifeOf(c), days = (L.days || []).filter(x => x && x.date && x.name); if (!days.length) { uiAlert('和 ' + c.name + ' 还没有设置纪念日（在「生活」里添加）'); return; }
        const dd = D(); let n = 0;
        days.forEach(x => { if (dd.items.some(z => z.title === x.name && z.date === x.date)) return; dd.items.push({ id: uid(), title: x.name, date: x.date, mode: /在一起|认识|相识|恋爱|开始/.test(x.name) ? 'up' : 'down', cat: '纪念日', repeat: /在一起|认识|相识|恋爱|开始/.test(x.name) ? 'none' : 'year', note: '来自和 ' + c.name + ' 的纪念日', color: PAL[n % PAL.length], pin: false }); n++; });
        S(dd); uiAlert(n ? '导入了 ' + n + ' 个纪念日' : '都已经导入过啦'); render();
    }
    function more() {
        const m = sheet('<h3>更多</h3><div class="xa-btns" style="flex-direction:column"><button id="mrTpl">添加节日（春节、中秋、圣诞…）</button><button id="mrTa">导入和 TA 的纪念日</button><button id="mrEx">导出为文本</button></div>');
        m.querySelector('#mrTpl').onclick = () => { m.remove(); tplSheet(); }; m.querySelector('#mrTa').onclick = () => { m.remove(); importTa(); };
        m.querySelector('#mrEx').onclick = () => { const txt = D().items.map(i => { const c = calc(i); return i.title + '｜' + (i.mode === 'up' ? '已经 ' + c.n + ' 天（起始 ' + i.date + '）' : c.past ? '已过 ' + c.n + ' 天（' + c.date + '）' : '还有 ' + c.n + ' 天（' + c.date + '）'); }).join('\n'); const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([txt], { type: 'text/plain' })); a.download = '倒数日.txt'; document.body.appendChild(a); a.click(); a.remove(); m.remove(); };
    }
    ensure();
    window.COUNTDOWN = { calc: calc, items: () => D().items };
})();
