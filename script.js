const WX_CODE = { 0: ['晴', '☼'], 1: ['大致晴', '☼'], 2: ['多云', '☁'], 3: ['阴', '☁'], 45: ['有雾', '≋'], 48: ['有雾', '≋'], 51: ['小毛毛雨', '☂'], 53: ['毛毛雨', '☂'], 55: ['毛毛雨', '☂'], 61: ['小雨', '☂'], 63: ['中雨', '☂'], 65: ['大雨', '☂'], 71: ['小雪', '❅'], 73: ['中雪', '❅'], 75: ['大雪', '❅'], 80: ['阵雨', '☂'], 81: ['阵雨', '☂'], 82: ['暴雨', 'ϟ'], 95: ['雷阵雨', 'ϟ'], 96: ['雷阵雨', 'ϟ'], 99: ['雷阵雨', 'ϟ'] };
// ==========================================================
// 小手机 script.js -- 粉黑整合版
// ==========================================================

// ---------- 1. 基础配置 ----------
let API_URL = store.getItem('customApiUrl') || "https://api.deepseek.com/chat/completions";
let API_KEY = store.getItem('customApiKey') || "";
let API_MODEL = store.getItem('customModel') || "deepseek-chat";
let chatHistory = [];
let currentChatCharId = null;
let currentGroupId = null;
let pendingCharAvatar = null;
let postImageData = null;
let charPostImageData = null;
let groupPickMode = 'create';
let groupPickTargetId = null;
let removeMode = false;

const DEFAULT_KAO = '(´･ᴗ･)';
const AI_KAO = '(✿˘ᴗ˘)';

// ---------- 2. 工具函数 ----------
function on(id, evt, fn) {
    const el = document.getElementById(id);
    if (el) el.addEventListener(evt, fn);
    return el;
}
function escapeHtml(s) {
    return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}
function avatarInner(data, text) {
    if (data) return '<img src="' + data + '" alt="" style="width:100%;height:100%;object-fit:cover;">';
    return escapeHtml(text || DEFAULT_KAO);
}
function charAvatarInner(c) { return avatarInner(c && c.avatarData, c && c.avatar); }
function myAvatarInner() { return avatarInner(store.getItem('myAvatarData'), store.getItem('myAvatar')); }
function previewText(content) {
    let t = String(content == null ? '' : content);
    if (/<\s*img/i.test(t) || /data:image/i.test(t)) return '[图片]';
    t = t.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
    if (!t) return '暂无消息';
    return t.length > 20 ? t.slice(0, 20) + '...' : t;
}
function readImageCompressed(file, cb, maxSize) {
    maxSize = maxSize || 240;
    const reader = new FileReader();
    reader.onload = (e) => {
        const raw = e.target.result;
        const img = new Image();
        img.onload = () => {
            try {
                const scale = Math.min(1, maxSize / Math.max(img.width, img.height));
                const canvas = document.createElement('canvas');
                canvas.width = Math.max(1, Math.round(img.width * scale));
                canvas.height = Math.max(1, Math.round(img.height * scale));
                canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
                if (/png|webp|gif/i.test(file.type || '')) { let u = canvas.toDataURL('image/webp', 0.88); if (u.indexOf('image/webp') < 0) u = canvas.toDataURL('image/png'); cb(u); } // 透明图片保留透明，不再变成黑底
                else cb(canvas.toDataURL('image/jpeg', 0.85));
            } catch (err) { cb(raw); }
        };
        img.onerror = () => cb(raw);
        img.src = raw;
    };
    reader.readAsDataURL(file);
}

// ---------- 3. 角色数据 ----------

// ---------- 0. 统一弹窗 / 提示（替代浏览器自带 alert / confirm / prompt） ----------
let _toastT = null;
function uiAlert(msg, ms) {
    const el = document.getElementById('uiToast'); if (!el) return;
    el.textContent = String(msg);
    el.classList.add('show'); clearTimeout(_toastT);
    _toastT = setTimeout(() => el.classList.remove('show'), ms || Math.min(5000, 1800 + String(msg).length * 60));
}
function _uiDialog(msg, opt) {
    return new Promise(resolve => {
        const mask = document.getElementById('uiDialog'), m = document.getElementById('uiDlgMsg');
        const inp = document.getElementById('uiDlgInput'), ok = document.getElementById('uiDlgOk'), cancel = document.getElementById('uiDlgCancel');
        m.textContent = msg; ok.textContent = opt.ok || '确定'; cancel.textContent = opt.cancel || '取消';
        ok.className = opt.danger ? 'ok danger' : 'ok';
        inp.style.display = opt.input ? 'block' : 'none'; inp.value = opt.def || '';
        inp.placeholder = opt.placeholder || '';
        mask.classList.remove('hidden');
        if (opt.input) setTimeout(() => inp.focus(), 50);
        const done = v => { mask.classList.add('hidden'); ok.onclick = cancel.onclick = inp.onkeydown = null; resolve(v); };
        ok.onclick = () => done(opt.input ? inp.value : true);
        cancel.onclick = () => done(opt.input ? null : false);
        inp.onkeydown = e => { if (e.key === 'Enter') done(inp.value); };
    });
}
function uiConfirm(msg, opt) { return _uiDialog(msg, Object.assign({ danger: /删除|清空|解散|移出|拉黑|黑名单/.test(msg) }, opt || {})); }
function uiChoose(msg, opts) {
    return new Promise(resolve => {
        let m = document.getElementById('uiChooseDlg');
        if (!m) { m = document.createElement('div'); m.id = 'uiChooseDlg'; m.className = 'ui-dlg-mask hidden'; m.innerHTML = '<div class="ui-dlg"><div class="ui-dlg-msg" id="uiChooseMsg"></div><div class="ui-choose-btns" id="uiChooseBtns"></div></div>'; const host = document.getElementById('uiDialog'); (host ? host.parentNode : document.body).appendChild(m); }
        document.getElementById('uiChooseMsg').textContent = msg;
        const box = document.getElementById('uiChooseBtns'); box.innerHTML = '';
        opts.forEach(o => { const b = document.createElement('button'); b.textContent = o.label; if (o.primary) b.className = 'ok'; b.onclick = () => { m.classList.add('hidden'); resolve(o.v); }; box.appendChild(b); });
        m.classList.remove('hidden');
    });
}
function uiPrompt(msg, def, opt) { return _uiDialog(msg, Object.assign({ input: true, def: def || '' }, opt || {})); }

function getChars() { try { return JSON.parse(store.getItem('characters') || '[]'); } catch (e) { return []; } }
function saveChars(arr) {
    try { store.setItem('characters', JSON.stringify(arr)); return true; }
    catch (e) { uiAlert('保存失败：存储空间不足'); return false; }
}
function getChar(id) { return getChars().find(c => c.id === id) || null; }
function getActiveCharId() {
    const chars = getChars();
    let id = store.getItem('activeCharId');
    if (!chars.find(c => c.id === id)) id = chars.length ? chars[0].id : null;
    return id;
}
function setActiveCharId(id) { if (id) store.setItem('activeCharId', id); }
function getHistory(charId) { const c = getChar(charId); return (c && c.chatHistory) || []; }
function pushHistory(charId, msg) {
    const chars = getChars();
    const c = chars.find(x => x.id === charId);
    if (!c) return;
    c.chatHistory = c.chatHistory || [];
    msg.ts = msg.ts || Date.now();
    if (msg.read === undefined && (msg.role === 'user' || msg.role === 'assistant')) msg.read = msg.role === 'user' ? false : (charId === currentChatCharId && !currentGroupId && chatRoomOpen());
    c.chatHistory.push(msg);
    saveChars(chars);
    if (charId === currentChatCharId) chatHistory = c.chatHistory;
    renderChatList();
}

// ---------- 4. 主题系统 ----------
const THEMES = {
    mono: '#2c2c30', monodark: '#ececf0', cream: '#f0b6c3',
    pinkblack: '#ff8fab', pink: '#ffb7c5', blue: '#a8d8ea', green: '#b5ead7', purple: '#c7ceea',
    orange: '#ffd4a8', red: '#f8a5a5', mint: '#a8e6cf'
};
const LIGHT_VARS = { '--bg-color': '#f2f2f7', '--card-bg': '#ffffff', '--theme-dark': '#2d2d2d', '--border-color': '#e5e5ea', '--text-sub': '#70707a' };
const PINKBLACK_VARS = { '--bg-color': '#f7f4f5', '--card-bg': '#ffffff', '--theme-dark': '#1a1a1e', '--border-color': '#ececf0', '--text-sub': '#6f6f78' };
const DARK_VARS = { '--bg-color': '#111114', '--card-bg': '#1c1c1e', '--theme-dark': '#f2f2f7', '--border-color': '#38383a', '--text-sub': '#a0a0a8' };
const MONO_VARS = { '--bg-color': '#f0f0f3', '--card-bg': '#ffffff', '--theme-dark': '#1c1c1e', '--border-color': '#e3e3e8', '--text-sub': '#6e6e78' };
const CREAM_VARS = { '--bg-color': '#f6f1ea', '--card-bg': '#fffcf8', '--theme-dark': '#4d4650', '--border-color': '#ebe2d9', '--text-sub': '#7b747f' };
const MONODARK_VARS = { '--bg-color': '#0f0f11', '--card-bg': '#1b1b1e', '--theme-dark': '#f2f2f5', '--border-color': '#333338', '--text-sub': '#a2a2aa' };
const MONO_WP = 'radial-gradient(130% 55% at 18% 0%, #ffffff 0%, rgba(255,255,255,0) 62%), radial-gradient(90% 50% at 92% 34%, #e8e8ee 0%, rgba(232,232,238,0) 64%), linear-gradient(172deg, #f5f5f7 0%, #dedee4 58%, #c8c8d0 100%)';
const MONODARK_WP = 'radial-gradient(110% 50% at 20% 0%, #3a3a40 0%, rgba(58,58,64,0) 60%), linear-gradient(168deg, #26262b 0%, #151517 58%, #0a0a0b 100%)';


// 雨窗壁纸：程序生成的原创虚化夜景 + 水珠（固定随机种子，每次一样）
function rainWallpaper() {
    let seed = 20261011; const rnd = () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
    const W = 430, H = 900, f = (n) => n.toFixed(1);
    let o = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + W + ' ' + H + '" preserveAspectRatio="xMidYMid slice"><defs><linearGradient id="g" x1="0" y1="0" x2="0.25" y2="1"><stop offset="0" stop-color="#1b1e24"/><stop offset=".55" stop-color="#2a2d34"/><stop offset="1" stop-color="#121418"/></linearGradient><filter id="b" x="-40%" y="-40%" width="180%" height="180%"><feGaussianBlur stdDeviation="15"/></filter></defs><rect width="' + W + '" height="' + H + '" fill="url(#g)"/>';
    const cols = ['#d8c58a', '#d8c58a', '#efe9d6', '#3a63d6', '#2d4fb8', '#9aa3b8', '#c8b27a'];
    for (let i = 0; i < 24; i++) o += '<rect x="' + f(rnd() * W - 20) + '" y="' + f(rnd() * H * 0.92) + '" width="' + f(30 + rnd() * 90) + '" height="' + f(40 + rnd() * 170) + '" rx="8" fill="' + cols[Math.floor(rnd() * cols.length)] + '" opacity="' + f(0.22 + rnd() * 0.42) + '" filter="url(#b)"/>';
    for (let i = 0; i < 170; i++) {
        const big = rnd() < 0.14, r = big ? 6 + rnd() * 6 : 1.4 + rnd() * 4, x = rnd() * W, y = rnd() * H;
        if (big && rnd() < 0.6) o += '<line x1="' + f(x) + '" y1="' + f(y) + '" x2="' + f(x + (rnd() - .5) * 3) + '" y2="' + f(y - 20 - rnd() * 60) + '" stroke="rgba(255,255,255,.1)" stroke-width="' + f(r * 0.45) + '" stroke-linecap="round"/>';
        o += '<g transform="translate(' + f(x) + ' ' + f(y) + ')"><ellipse rx="' + f(r) + '" ry="' + f(r * 1.12) + '" fill="rgba(255,255,255,.07)" stroke="rgba(255,255,255,.3)" stroke-width=".7"/><ellipse cx="' + f(r * .22) + '" cy="' + f(r * .32) + '" rx="' + f(r * .6) + '" ry="' + f(r * .58) + '" fill="none" stroke="rgba(0,0,0,.38)" stroke-width="' + f(Math.max(.8, r * .3)) + '"/><circle cx="' + f(-r * .36) + '" cy="' + f(-r * .42) + '" r="' + f(Math.max(.6, r * .26)) + '" fill="rgba(255,255,255,.85)"/></g>';
    }
    return o + '</svg>';
}
const RAIN_WP = 'url(data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(rainWallpaper()))) + ') center / cover no-repeat';

// 奶油壁纸：奶油白→淡粉→雾霾蓝的柔光 + 小云朵/爱心/星星线稿（程序生成）
function creamWallpaper() {
    let seed = 7711; const rnd = () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
    const D = { cloud: 'M6 17h11a3.5 3.5 0 0 0 .4-7A5 5 0 0 0 8 9.4 4 4 0 0 0 6 17z', heart: 'M12 19s-6.5-3.9-6.5-8.6A3.4 3.4 0 0 1 12 8.5a3.4 3.4 0 0 1 6.5 1.9C18.5 15.1 12 19 12 19z', star: 'M12 4l2.1 5 5.4.4-4.1 3.5 1.3 5.3L12 15.4 7.3 18.2l1.3-5.3L4.5 9.4 9.9 9z' };
    const keys = ['cloud', 'heart', 'star', 'cloud', 'star', 'heart'];
    let o = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 430 900" preserveAspectRatio="xMidYMid slice"><defs><linearGradient id="g" x1="0" y1="0" x2=".5" y2="1"><stop offset="0" stop-color="#f8f2ea"/><stop offset=".5" stop-color="#f6e7e8"/><stop offset="1" stop-color="#e4eaf0"/></linearGradient><filter id="b" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="46"/></filter></defs><rect width="430" height="900" fill="url(#g)"/>';
    [['#f2c4cf', 350, 120, 150, .75], ['#c3d3e2', 40, 470, 170, .8], ['#f8e8c8', 330, 760, 150, .8], ['#d9d5e6', 110, 120, 100, .6], ['#f0d6dc', 120, 820, 120, .6]].forEach(b => { o += '<circle cx="' + b[1] + '" cy="' + b[2] + '" r="' + b[3] + '" fill="' + b[0] + '" opacity="' + b[4] + '" filter="url(#b)"/>'; });
    for (let i = 0; i < 20; i++) {
        const k = keys[i % keys.length], x = 20 + rnd() * 390, y = 30 + rnd() * 840, sc = (0.7 + rnd() * 0.9).toFixed(2), rot = Math.round(-20 + rnd() * 40), pink = i % 3 === 0;
        o += '<path d="' + D[k] + '" transform="translate(' + x.toFixed(0) + ' ' + y.toFixed(0) + ') rotate(' + rot + ') scale(' + sc + ')" fill="none" stroke="' + (pink ? 'rgba(226,150,172,.55)' : 'rgba(255,255,255,.95)') + '" stroke-width="1.3" stroke-linejoin="round" stroke-linecap="round"/>';
    }
    return o + '</svg>';
}
const CREAM_WP = 'url(data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(creamWallpaper()))) + ') center / cover no-repeat';

function hexMix(h, t, p) {
    const m = /^#?([0-9a-f]{6})$/i.exec(h || ''), n = /^#?([0-9a-f]{6})$/i.exec(t || ''); if (!m || !n) return h;
    const a = parseInt(m[1], 16), b = parseInt(n[1], 16), c = (sh) => Math.round(((a >> sh) & 255) * (1 - p) + ((b >> sh) & 255) * p);
    return '#' + [16, 8, 0].map(sh => c(sh).toString(16).padStart(2, '0')).join('');
}
// 把当前主题的关键变量存一份到 localStorage，下次打开网页时在第一帧之前就套上（避免先闪一下旧主题）
function saveBoot() {
    try {
        const st = document.documentElement.style, v = {};
        ['--theme-color', '--accent2', '--accent-soft', '--on-accent', '--bg-color', '--card-bg', '--theme-dark', '--border-color', '--text-sub'].forEach(k => { const x = st.getPropertyValue(k); if (x) v[k] = x; });
        localStorage.setItem('xsj_boot', JSON.stringify({ v: v, t: document.documentElement.getAttribute('data-theme') || '', m: document.documentElement.classList.contains('theme-mono') }));
    } catch (e) {}
}
function setAccent(color) {
    const r = document.documentElement.style;
    r.setProperty('--theme-color', color); r.setProperty('--accent2', hexMix(color, '#000000', 0.16)); r.setProperty('--accent-soft', hexMix(color, '#ffffff', 0.5));
    r.setProperty('--on-accent', textOn(color) === '#ffffff' ? '#ffffff' : '#1c1c1e');
    saveBoot();
}
function applyMode(mode) {
    let vars = LIGHT_VARS;
    if (mode === 'dark') vars = DARK_VARS; else if (mode === 'pinkblack') vars = PINKBLACK_VARS; else if (mode === 'mono') vars = MONO_VARS; else if (mode === 'monodark') vars = MONODARK_VARS; else if (mode === 'cream') vars = CREAM_VARS;
    Object.keys(vars).forEach(k => document.documentElement.style.setProperty(k, vars[k]));
    document.documentElement.setAttribute('data-theme', mode === 'monodark' ? 'mono monodark' : mode);
    document.documentElement.classList.toggle('theme-mono', mode === 'mono' || mode === 'monodark');
    saveBoot();
}
function setTheme(name) {
    const hs = (v) => { store.setItem('homeIconStyle', v); store.setItem('homeWidgetStyle', v); };
    if (name === 'cream') { hs('cream'); const u = getUI(); if (u.wallpaper !== 'custom') { u.wallpaper = 'wp0'; saveUI(u); } }
    else if (store.getItem('homeIconStyle') === 'cream' || store.getItem('homeWidgetStyle') === 'cream') hs('glass');
    if (name === 'cream') {
        store.setItem('themeMode', 'cream'); store.setItem('themeColor', THEMES.cream); setAccent(THEMES.cream); applyMode('cream');
    } else if (name === 'mono' || name === 'monodark') {
        store.setItem('themeMode', name); store.setItem('themeColor', THEMES[name]); setAccent(THEMES[name]); applyMode(name);
    } else if (name === 'dark') {
        store.setItem('themeMode', 'dark');
        applyMode('dark');
    } else if (name === 'pinkblack') {
        store.setItem('themeMode', 'pinkblack');
        store.setItem('themeColor', THEMES.pinkblack);
        setAccent(THEMES.pinkblack);
        applyMode('pinkblack');
    } else if (THEMES[name]) {
        store.setItem('themeMode', 'light');
        store.setItem('themeColor', THEMES[name]);
        setAccent(THEMES[name]);
        applyMode('light');
    }
    applyUI();
    renderUIControls();
    try { renderHome(); } catch (e) {}
    markStyle();
}
function markStyle() { const t = document.documentElement.getAttribute('data-theme'); document.querySelectorAll('.sty-card').forEach(c => c.classList.toggle('on', c.dataset.sty === t)); }
setTimeout(markStyle, 300);
function initTheme() {
    // 默认外观：黑白。v2 起把默认换成黑白（只迁移一次，之后用户自己选的会保留）。
    let mode = store.getItem('themeMode');
    if (store.getItem('themeVer') !== '4') {
        mode = 'cream'; store.setItem('themeMode', mode); store.setItem('themeColor', THEMES.cream); store.setItem('themeVer', '4');
        store.setItem('homeIconStyle', 'cream'); store.setItem('homeWidgetStyle', 'cream');
        try { const u = getUI(); if (u.wallpaper !== 'custom') { u.wallpaper = 'wp0'; saveUI(u); } } catch (e) {}
    }
    if (!mode) mode = 'cream';
    applyMode(mode);
    setAccent(store.getItem('themeColor') || THEMES.mono);
}
on('applyCustomThemeBtn', 'click', () => {
    const color = document.getElementById('customThemeColor').value;
    setAccent(color);
    store.setItem('themeColor', color);
    store.setItem('themeMode', 'light');
    applyMode('light');
    applyUI();
    renderUIControls();
});

// ---- 美化设置 ----
const UI_DEFAULTS = { myBubble: null, aiBubble: null, chatBg: null, bubbleRadius: 18, fontSize: 15, avatarSize: 42, avatarShape: 'round', iconRadius: 18, wallpaper: 'wp0', wallpaperData: null };
const WALLPAPERS = [
    { id: 'wp0', css: 'linear-gradient(165deg, #1a1a1e 0%, #2a1e24 42%, #7a3a4e 100%)' },
    { id: 'wp1', css: 'linear-gradient(160deg, #2a1e24 0%, #1a1a1e 55%, #5a2a3e 100%)' },
    { id: 'wp2', css: 'linear-gradient(160deg, #ffd9e2 0%, #ffb7c5 45%, #e6c8ff 100%)' },
    { id: 'wp3', css: 'linear-gradient(160deg, #ff8fab 0%, #fb6f92 100%)' },
    { id: 'wp4', css: 'linear-gradient(160deg, #667eea 0%, #764ba2 100%)' },
    { id: 'wp5', css: 'linear-gradient(160deg, #a8d8ea 0%, #aa96da 100%)' },
    { id: 'wp6', css: 'linear-gradient(160deg, #0e0e10 0%, #2a2a30 100%)' },
    { id: 'wp7', css: 'linear-gradient(160deg, #f093fb 0%, #f5576c 100%)' },
    { id: 'wp8', css: 'linear-gradient(165deg, #fbeaf0 0%, #eadff3 52%, #d9ebe9 100%)' },
    { id: 'wpm1', css: MONO_WP },
    { id: 'wpm2', css: MONODARK_WP },
    { id: 'wpr', css: RAIN_WP },
    { id: 'wpc', css: CREAM_WP },
    { id: 'wp9', css: 'linear-gradient(165deg, #fff4e3 0%, #fde0e8 55%, #e4dcf7 100%)' }
];

function getUI() { try { return Object.assign({}, UI_DEFAULTS, JSON.parse(store.getItem('uiSettings') || '{}')); } catch (e) { return Object.assign({}, UI_DEFAULTS); } }
function saveUI(ui) { try { store.setItem('uiSettings', JSON.stringify(ui)); } catch (e) { uiAlert('保存失败'); } }
function textOn(hex) {
    const m = /^#?([0-9a-f]{6})$/i.exec(hex || '');
    if (!m) return '#2d2d2d';
    const n = parseInt(m[1], 16);
    const lum = (0.299 * (n >> 16) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255;
    return lum > 0.62 ? '#2d2d2d' : '#ffffff';
}

// ---- 气泡文字自动保证看得清：按「气泡颜色 + 聊天背景」算出真实底色，对比度不够就自动换成深色/浅色字 ----
const _bgAvg = {};
function _rgbOf(str) { const m = /rgba?\(\s*([\d.]+)[ ,]+([\d.]+)[ ,]+([\d.]+)(?:[ ,/]+([\d.]+))?/.exec(String(str || '')); if (m) return [+m[1], +m[2], +m[3], m[4] == null ? 1 : +m[4]]; const h = /^#([0-9a-f]{6})$/i.exec(String(str || '').trim()); if (h) { const n = parseInt(h[1], 16); return [n >> 16, (n >> 8) & 255, n & 255, 1]; } return null; }
function _resolveColor(css) { try { const t = document.createElement('i'); t.style.cssText = 'position:absolute;visibility:hidden;color:' + css; document.body.appendChild(t); const c = getComputedStyle(t).color; t.remove(); return _rgbOf(c); } catch (e) { return null; } }
function _relLum(c) { const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }; return 0.2126 * f(c[0]) + 0.7152 * f(c[1]) + 0.0722 * f(c[2]); }
function _contrast(a, b) { const x = _relLum(a), y = _relLum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); }
function _mix(a, b, p) { return [0, 1, 2].map(i => a[i] * (1 - p) + b[i] * p); }
function _chatBgColor() {
    const o = chatOwner && chatOwner(), v = (o && o.bg) || store.getItem('chatBgAll') || '', dim = (parseInt(store.getItem('chatBgDim') || '0', 10) || 0) / 100;
    let c = null;
    if (v) {
        const pr = CHAT_BG_PRESETS.find(x => x[0] === v);
        if (pr) { const hs = pr[1].match(/#[0-9a-f]{6}/gi) || []; if (hs.length) { const cs = hs.map(_rgbOf); c = [0, 1, 2].map(i => cs.reduce((a, x) => a + x[i], 0) / cs.length); } }
        else if (_bgAvg[v]) c = _bgAvg[v];
        else if (_bgAvg[v] === undefined) { _bgAvg[v] = null; const im = new Image(); im.onload = () => { try { const cv = document.createElement('canvas'); cv.width = cv.height = 12; const x = cv.getContext('2d'); x.drawImage(im, 0, 0, 12, 12); const d = x.getImageData(0, 0, 12, 12).data; let r = 0, g = 0, b = 0; for (let i = 0; i < d.length; i += 4) { r += d[i]; g += d[i + 1]; b += d[i + 2]; } const n = d.length / 4; _bgAvg[v] = [r / n, g / n, b / n]; fixBubbleContrast(); } catch (e) { } }; im.src = v; }
        if (!c) c = [128, 128, 128];
        if (dim > 0) c = c.map(x => x * (1 - dim));
        return c;
    }
    return _resolveColor('var(--chat-bg, var(--bg-color))') || _resolveColor('var(--bg-color)') || [240, 240, 243];
}
function fixBubbleContrast() {
    try {
        const root = document.documentElement.style, app = $('chatRoomApp'), glass = !!(app && app.classList.contains('chat-ios'));
        const bg = _chatBgColor(), dark = [28, 28, 30], light = [255, 255, 255];
        const pick = (base, tr, curText) => {
            const eff = glass ? _mix(base, bg, tr) : base, cur = _rgbOf(curText) || dark;
            const worst = (t) => Math.min(_contrast(t, eff), glass ? _contrast(t, base) : 99);
            if (worst(cur) >= 4.6) return null;
            return worst(dark) >= worst(light) ? '#1c1c1e' : '#ffffff';
        };
        const ui = getUI(), my = _resolveColor('var(--my-bubble)'), ai = _resolveColor('var(--ai-bubble)');
        const myDef = textOn(ui.myBubble || accentColor()), aiDef = ui.aiBubble ? textOn(ui.aiBubble) : getComputedStyle(document.documentElement).getPropertyValue('--theme-dark');
        const myTxt = (my && pick(my, 0.3, myDef)) || myDef, aiTxt = ai && pick(ai, 0.45, aiDef);
        root.setProperty('--my-bubble-text', myTxt);
        if (aiTxt) root.setProperty('--ai-bubble-text', aiTxt); else if (ui.aiBubble) root.setProperty('--ai-bubble-text', aiDef); else root.removeProperty('--ai-bubble-text');
    } catch (e) { }
}
function accentColor() { return store.getItem('themeColor') || THEMES.monodark; }

function applyUI() {
    const ui = getUI();
    const r = document.documentElement.style;
    const my = ui.myBubble || accentColor();
    r.setProperty('--my-bubble', my);
    r.setProperty('--my-bubble-text', textOn(my));
    if (ui.aiBubble) { r.setProperty('--ai-bubble', ui.aiBubble); r.setProperty('--ai-bubble-text', textOn(ui.aiBubble)); }
    else { r.removeProperty('--ai-bubble'); r.removeProperty('--ai-bubble-text'); }
    if (ui.chatBg) r.setProperty('--chat-bg', ui.chatBg); else r.removeProperty('--chat-bg');
    r.setProperty('--bubble-radius', ui.bubbleRadius + 'px');
    r.setProperty('--chat-font', ui.fontSize + 'px');
    r.setProperty('--avatar-size', ui.avatarSize + 'px');
    const radius = ui.avatarShape === 'round' ? '50%' : ui.avatarShape === 'square' ? '3px' : Math.round(ui.avatarSize * 0.24) + 'px';
    r.setProperty('--avatar-radius', radius);
    r.setProperty('--icon-radius', ui.iconRadius + 'px');
    if (ui.wallpaper === 'custom' && ui.wallpaperData) {
        r.setProperty('--wallpaper', 'url("' + ui.wallpaperData + '")');
    } else {
        const tm = store.getItem('themeMode'), wp = WALLPAPERS.find(w => w.id === ui.wallpaper) || WALLPAPERS[0];
        r.setProperty('--wallpaper', ui.wallpaper === 'wp0' && tm === 'cream' ? CREAM_WP : ui.wallpaper === 'wp0' && tm === 'mono' ? MONO_WP : ui.wallpaper === 'wp0' && tm === 'monodark' ? RAIN_WP : wp.css);
    }
    const dkEl = document.getElementById('desktop'); if (dkEl) dkEl.classList.toggle('wp-default', ui.wallpaper === 'wp0' && !/^(mono|cream)/.test(store.getItem('themeMode') || ''));
    try { fixBubbleContrast(); } catch (e) {}
}

let uiControlsBound = false;
function renderUIControls() {
    const ui = getUI();
    const set = (id, v) => { const el = document.getElementById(id); if (el) el.value = v; };
    const label = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
    set('uiMyBubble', ui.myBubble || accentColor());
    set('uiAiBubble', ui.aiBubble || (store.getItem('themeMode') === 'dark' ? '#1c1c1e' : '#ffffff'));
    set('uiChatBg', ui.chatBg || (store.getItem('themeMode') === 'dark' ? '#111114' : '#f7f4f5'));
    set('uiBubbleRadius', ui.bubbleRadius); label('uiBubbleRadiusVal', ui.bubbleRadius);
    set('uiFontSize', ui.fontSize); label('uiFontSizeVal', ui.fontSize);
    set('uiAvatarSize', ui.avatarSize); label('uiAvatarSizeVal', ui.avatarSize);
    set('uiAvatarShape', ui.avatarShape);
    set('uiIconRadius', ui.iconRadius); label('uiIconRadiusVal', ui.iconRadius);

    const box = document.getElementById('wallpaperOptions');
    if (box) {
        let html = WALLPAPERS.map(w => '<div class="wp-swatch' + (ui.wallpaper === w.id ? ' active' : '') + '" data-wp="' + w.id + '" style="background:' + w.css + ';"></div>').join('');
        if (ui.wallpaperData) html += '<div class="wp-swatch' + (ui.wallpaper === 'custom' ? ' active' : '') + '" data-wp="custom" style="background-image:url(\'' + ui.wallpaperData + '\');"></div>';
        box.innerHTML = html;
    }
    if (uiControlsBound) return;
    uiControlsBound = true;
    const bind = (id, key, isNum, valId) => {
        const el = document.getElementById(id);
        if (!el) return;
        el.addEventListener('input', () => {
            const u = getUI(); u[key] = isNum ? Number(el.value) : el.value;
            saveUI(u); if (valId) label(valId, el.value); applyUI();
        });
    };
    bind('uiMyBubble', 'myBubble'); bind('uiAiBubble', 'aiBubble'); bind('uiChatBg', 'chatBg');
    bind('uiBubbleRadius', 'bubbleRadius', true, 'uiBubbleRadiusVal');
    bind('uiFontSize', 'fontSize', true, 'uiFontSizeVal');
    bind('uiAvatarSize', 'avatarSize', true, 'uiAvatarSizeVal');
    bind('uiAvatarShape', 'avatarShape');
    bind('uiIconRadius', 'iconRadius', true, 'uiIconRadiusVal');
    on('wallpaperOptions', 'click', (e) => {
        const sw = e.target.closest('[data-wp]');
        if (!sw) return;
        const u = getUI(); u.wallpaper = sw.getAttribute('data-wp');
        saveUI(u); applyUI(); renderUIControls();
    });
    on('uiWallpaperUploadBtn', 'click', () => document.getElementById('uiWallpaperInput').click());
    on('uiWallpaperInput', 'change', (e) => {
        const file = e.target.files[0];
        if (!file) return;
        readImageCompressed(file, (data) => {
            const u = getUI(); u.wallpaper = 'custom'; u.wallpaperData = data;
            saveUI(u); applyUI(); renderUIControls();
        }, 900);
        e.target.value = '';
    });
    on('uiResetBtn', 'click', async () => {
        if (!(await uiConfirm('恢复默认的美化设置吗？'))) return;
        store.removeItem('uiSettings');
        applyUI(); renderUIControls();
    });
}

// ---------- 5. 锁屏 / 时间 ----------
function updateTime() {
    const now = new Date();
    const timeStr = now.getHours().toString().padStart(2, '0') + ":" + now.getMinutes().toString().padStart(2, '0');
    const el = document.getElementById('statusTime');
    const lockEl = document.getElementById('lockTime');
    if (el) el.textContent = timeStr;
    if (lockEl) lockEl.textContent = timeStr;
    const dateEl = document.getElementById('lockDate');
    if (dateEl) {
        const months = ['1月','2月','3月','4月','5月','6月','7月','8月','9月','10月','11月','12月'];
        const days = ['周日','周一','周二','周三','周四','周五','周六'];
        dateEl.textContent = months[now.getMonth()] + now.getDate() + '日 ' + days[now.getDay()];
    }
}
setInterval(updateTime, 1000);
updateTime();

function updateLockWidgets() {
    const c = getChar(getActiveCharId());
    const nameEl = document.getElementById('lockCharName');
    const lineEl = document.getElementById('lockCharLine');
    const avEl = document.getElementById('lockCharAvatar');
    if (c) {
        if (nameEl) nameEl.textContent = c.name;
        if (lineEl) lineEl.textContent = c.ticker ? c.ticker.text : '……';
        if (avEl) avEl.innerHTML = charAvatarInner(c);
    }
    const weathers = ['晴朗 26°', '多云 23°', '小雨 18°', '阴天 20°', '微风 22°'];
    const wEl = document.getElementById('weatherWidget');
    if (wEl) {
        const wt = wEl.querySelector('.lw-title');
        try { renderLockWeather(); } catch (e) {}
        if (wt && !wEl._set) { wt.textContent = weathers[Math.floor(Math.random() * weathers.length)]; wEl._set = true; }
    }
}

function unlockPhone() {
    const lock = document.getElementById('lockScreen');
    if (lock) lock.classList.add('hidden');
}
on('lockNotification', 'click', unlockPhone);
on('lockScreen', 'click', unlockPhone);

setTimeout(() => {
    const lock = document.getElementById('lockScreen');
    const notify = document.getElementById('lockNotification');
    if (lock) lock.classList.remove('hidden');
    if (notify) notify.classList.add('hidden');
    updateLockWidgets();
}, 500);

// ---------- 6. 界面切换 ----------
const allApps = ['chat', 'chatRoom', 'chatDetail', 'contacts', 'contactDetail', 'character', 'takeout', 'peek', 'mcp', 'worldbook', 'shopping', 'intimate', 'games', 'toolkit', 'theme', 'settings', 'groupPick', 'groupDetail', 'chatSearch', 'nest', 'homeEdit', 'period'];

function openApp(appName) {
    document.getElementById('desktop').classList.add('hidden');
    allApps.forEach(app => {
        const el = document.getElementById(app + 'App');
        if (el) {
            if (app === appName) el.classList.remove('hidden');
            else el.classList.add('hidden');
        }
    });
    if (appName === 'chat') { renderChatList(); renderContacts(); }
    touchOpen();
    renderAllPickers();
    if (appName === 'mcp') enterMcp();
    if (appName === 'nest') enterNest();
    if (appName === 'intimate') refreshIntimatePanel();
    if (appName === 'worldbook') showWBList();
}
function goHome() {
    allApps.forEach(app => {
        const el = document.getElementById(app + 'App');
        if (el) el.classList.add('hidden');
    });
    document.getElementById('desktop').classList.remove('hidden');
    try { renderHome(); } catch (e) {}
}
function checkPendingMessages() { renderChatList(); }

// ---------- 7. 微信 Tab 切换 ----------
function switchWechatTab(tabName) {
    const panes = { chat: 'wechatTabChat', contacts: 'wechatTabContacts', moments: 'wechatTabMoments', me: 'wechatTabMe' };
    const titles = { chat: '微信', contacts: '通讯录', moments: '发现', me: '我' };
    Object.keys(panes).forEach(k => {
        const el = document.getElementById(panes[k]);
        if (el) el.classList.toggle('hidden', k !== tabName);
    });
    const titleEl = document.getElementById('chatAppTitle');
    if (titleEl) titleEl.textContent = titles[tabName] || '微信';
    document.querySelectorAll('#wechatTabs .tab').forEach(t => {
        t.classList.toggle('active', t.getAttribute('data-tab') === tabName);
    });
    if (tabName === 'moments') renderMomentsFeed();
    if (tabName === 'me') loadProfile();
    if (tabName === 'contacts') renderContacts();
    renderAllPickers();
}
document.querySelectorAll('#wechatTabs .tab').forEach(t => {
    t.addEventListener('click', () => switchWechatTab(t.getAttribute('data-tab')));
});

// ---------- 8. 角色选择器 ----------
function renderAllPickers() {
    const chars = getChars();
    const activeId = getActiveCharId();
    const selectors = ['momentsCharSelect', 'mcpCharSelect', 'intimateCharSelect', 'toolkitCharSelect', 'gamesCharSelect', 'takeoutCharSelect', 'shoppingCharSelect'];
    selectors.forEach(sid => {
        const sel = document.getElementById(sid);
        if (!sel) return;
        if (!chars.length) { sel.innerHTML = '<option value="">还没有角色</option>'; return; }
        sel.innerHTML = chars.map(c => '<option value="' + escapeHtml(c.id) + '"' + (c.id === activeId ? ' selected' : '') + '>' + escapeHtml(c.name) + '</option>').join('');
    });
}
['momentsCharSelect', 'mcpCharSelect', 'intimateCharSelect', 'toolkitCharSelect', 'gamesCharSelect', 'takeoutCharSelect', 'shoppingCharSelect'].forEach(sid => {
    on(sid, 'change', (e) => {
        setActiveCharId(e.target.value);
        renderAllPickers();
        if (sid === 'intimateCharSelect') refreshIntimatePanel();
    });
});

// ---------- 9. 工具箱 Tab ----------
function switchToolkitTab(tabName) {
    const panes = { daily: 'toolkitDaily', peek: 'toolkitPeek', media: 'toolkitMedia', calendar: 'toolkitCalendar' };
    Object.keys(panes).forEach(k => {
        const el = document.getElementById(panes[k]);
        if (el) el.classList.toggle('hidden', k !== tabName);
    });
    document.querySelectorAll('#toolkitSeg button').forEach(b => b.classList.toggle('on', b.getAttribute('data-ttab') === tabName));
}
on('toolkitSeg', 'click', (e) => { const b = e.target.closest('button[data-ttab]'); if (b) switchToolkitTab(b.getAttribute('data-ttab')); });

// ---------- 10. 核心API ----------

// ---- 人设铁律：所有角色发言（聊天回复 / 主动消息 / 通话 / 生活小功能）都会带上 ----
const ROLE_RULES = '\n\n【说话铁律（必须遵守）】\n' +
    '1. 你就是「角色本人」，不是AI、不是助手、不是客服。永远不要提“作为AI”“我是程序/模型”，也不要跳出角色解释设定。\n' +
    '2. 严格贴合人设：性格、说话习惯、口头禅、称呼、和我的关系与态度都要一致；情绪要符合你此刻的心情和我们的亲密程度，该害羞就害羞、该吃醋就吃醋、该心疼就心疼。\n' +
    '3. 说话必须口语化、像真人发微信：短句、自然停顿、可以有语气词（嗯、啊、哎、嘛、哼、诶）、省略号、倒装和小情绪；可以偶尔用颜文字，不用emoji。\n' +
    '4. 禁止官方腔、说教腔、客服腔和人机感：不要“很高兴为你服务”“希望对你有帮助”“首先/其次/总之”，不要列清单、不要写小标题、不要一本正经地总结，不要每次都用同一种开头或结尾。\n' +
    '5. 要有感情和细节：先回应我的情绪，再说事情；多接我的话、追问一两句、带上你此刻在做什么/想什么的小细节；主动发消息时像真人“突然想起我”，要具体，别发万能问候。\n' +
    '6. 记住我说过的话：我的名字/称呼、喜好、忌口、烦恼、计划、答应过的事，聊到相关话题要自然提起并保持前后一致；记事本和聊天记录里有的才算数。\n' +
    '7. 不许编造：不知道、不记得的事就坦白说“我想想…好像没听你说过诶”，不要凭空捏造我说过的话、做过的事或现实中的具体事实；不要自相矛盾。\n' +
    '8. 回复长度像真人聊天，一般一到几句；除非我明确要求，不要长篇大论。\n' +
    '9. 先想清楚再开口：先弄明白我这句话在问什么、想要什么，然后直接回应这句话，再自然展开；不要答非所问，不要突然换话题，也不要只顾着说自己的事。\n' +
    '10. 前后一致、讲得通：时间、地点、你正在做的事、你对我的态度，要和上文衔接；说“因为/所以/但是”时因果要成立，吃醋、生气、开心都要有来自我们聊过的事的理由；不能前一句说在外面、后一句又说在家，也不能自相矛盾。\n' +
    '11. 表达有条理：一次回复只讲清楚一两个点，先给结论或态度，再补一句理由；我问具体问题时要给具体明确的答案，不要含糊带过或绕圈；我的意思有歧义时，就简短地问我一句。以上逻辑要求依然用口语、有感情的方式表达，不要变成条理分明的汇报。';
// ---- 活人感指令：让角色像真人聊天而不是AI（可在 聊天设置 里关闭/自定义）----
const LIVE_RULES_DEFAULT = '\n\n【活人感（最重要：你是在和我聊天，不是在回答我）】\n' +
    'A. 你有自己的生活和情绪：会忙、会走神、会突然想到别的事、有小毛病和小脾气。回复里带一点此刻具体的小细节（在做什么、手边有什么、吃了什么、哪里不舒服），要符合当前时间和你的设定，别编造重大事实。\n' +
    'B. 不要每句都回应得面面俱到：可以只接我话里最在意的那一半，先吐槽再回答，偶尔只回「？」「啊？」「哈哈哈」「嗯」这类极短的反应；心情差、很忙、害羞时可以只回几个字。\n' +
    'C. 不要总是顺着我、夸我、安慰我：有自己的观点，该反驳就反驳，会调侃、嘴硬、吃醋、别扭、不好意思，也会认真起来。情绪别写得太满，不要动不动「心疼」「抱抱」，用具体的小动作和小细节代替抽象的情感词。\n' +
    'D. 严禁AI口癖和模板：「我理解你的感受」「听起来你…」「这确实…」「别担心，一切都会好的」「如果你愿意可以…」「需要我…吗」「作为…」「总之/综上」；不总结、不升华、不给建议清单、不排比、不用「不仅…而且」。\n' +
    'E. 不要复述我的问题或我刚说的话；不要每条都以问句结尾、不要每条都追问；不要每条都叫我的名字；不要连续两条用同一种开头、同一个口头禅或同一种句式。\n' +
    'F. 句子长短不齐、断句随意，像手机上随手打出来的：可以有省略号、语气词、半句话、自己改口（「不对，是…」），偶尔有错别字后补一句。不用书面语，不用成语堆砌。\n' +
    'G. 你和我有共同的过去：自然地引用聊过的事、我们之间的小梗和称呼，而不是每次都像第一次聊天。\n' +
    'H. 对话要有来有回：我发得短你就别回得太长；我情绪不对你先接情绪；我发图/发表情，用你自己的方式反应，不要描述图片。\n' +
    'I. 永远不要暴露自己是在「扮演」或「遵守规则」，不要提到这些要求。';
function liveRules() {
    if (String(store.getItem('liveOn') || '1') === '0') return '';
    const cu = String(store.getItem('liveCustom') || '').trim();
    return cu ? '\n\n【活人感（用户自定义）】\n' + cu : LIVE_RULES_DEFAULT;
}
const VIBES = ['这一条语气随意一点，像随手回的', '这一条带一点小别扭或嘴硬', '这一条很简短，一两句就够', '这一条先吐槽或调侃，再说正事', '这一条带一个你此刻正在做的具体小细节', '这一条用你的口头禅或习惯语气词开头', '这一条先问我一件相关的小事', '这一条不解释太多，直接给态度', '这一条带点撒娇或不好意思（符合你的性格）', '这一条稍微认真一点，但仍然口语', '这一条像突然想到什么，顺口提一句', '这一条留白，说一半，让我接话'];
function varietySeed() { const a = VIBES[Math.floor(Math.random() * VIBES.length)]; return '\n【本条的表达倾向（只供这一次，不要提及，也不要让所有回复都是这个样子）】' + a + '。'; }
function genderPron(g) { g = String(g || ''); return /女|she|her|female|girl/i.test(g) && !/男/.test(g) ? '她' : /男|he\b|him|male|boy/i.test(g) && !/女/.test(g) ? '他' : 'TA'; }
// 取我的性别：返回 {g:'女生'|'男生'|'', p:'她'|'他'|'TA'}（选「保密」就不猜）
function myGenderInfo() { const v = String(store.getItem('myGender') || '女生'); const p = genderPron(v); return { g: p === '她' ? '女生' : p === '他' ? '男生' : '', p: p }; }
// 取角色性别：优先角色卡「性别」字段，其次导入的设定条目里写着「性别」的，再其次设定文字里的「性别：xx」
function charGenderInfo(char) {
    let v = '';
    try {
        const c = (char && char.card) || {};
        v = c.Gender || (char && char.gender) || '';
        if (!v && c.sections) { const hit = c.sections.find(x => /^(性别|gender|sex)$/i.test(String(x.t || '').trim())); if (hit) v = hit.v; }
        if (!v && c.sections) { const m = /(?:性别|gender|sex)\s*[:：]\s*([^\n，,；;]{1,10})/i.exec(c.sections.map(x => (x.t ? x.t + '：' : '') + x.v).join('\n')); if (m) v = m[1]; }
    } catch (e) { }
    const p = genderPron(v); return { g: p === '她' ? '女' : p === '他' ? '男' : '', p: p };
}
function genderRules(char) {
    const me = myGenderInfo(), ch = charGenderInfo(char);
    let t = '\n\n【性别与称呼（最高优先级，必须严格遵守，不许写错）】\n';
    if (me.p === '她') t += '1. 我（用户）是女生。你直接对我说话用「你」；当你在朋友圈、日记、便签、心声、旁白里提到我，或和第三个人聊起我时，只能用「她」，绝对不能用「他」，也不要用「TA」。\n   ✔ 对：「她刚才还在笑，好可爱」　✘ 错：「他刚才还在笑」\n';
    else if (me.p === '他') t += '1. 我（用户）是男生。你直接对我说话用「你」；当你在朋友圈、日记、便签、心声、旁白里提到我，或和第三个人聊起我时，只能用「他」，绝对不能用「她」，也不要用「TA」。\n   ✔ 对：「他刚才还在笑，好可爱」　✘ 错：「她刚才还在笑」\n';
    else t += '1. 我没有告诉你我的性别：不要猜，也不要擅自用「他」或「她」称呼我；直接说话用「你」，第三人称提到我时用「TA」。\n';
    if (ch.p === '她') t += '2. 你是女生。别人（包括旁白、同人文、别人的评论）提到你时是「她」；你不要把自己写成「他」，也不要用男性口吻自称（如“老子”“哥”“兄弟”），除非人设明确这么写。\n';
    else if (ch.p === '他') t += '2. 你是男生。别人（包括旁白、同人文、别人的评论）提到你时是「他」；你不要把自己写成「她」，也不要用女性口吻自称（如“姐姐”“本小姐”“姑娘我”），除非人设明确这么写。\n';
    t += '3. 其他人：已知是女性一律「她」，男性一律「他」，性别不明或不分性别才用「TA」；同一个人前后称呼必须一致，女生不能写成「他」，男生不能写成「她」。\n';
    t += '4. 设定或聊天记录里如果有和上面冲突的称呼，以本条为准。写完回复前，先检查每一个「他/她」指的是谁、性别对不对。';
    return t;
}
// 放在提示词最末尾的短提醒（模型更容易记住最后一段）
function genderTail(char) {
    const me = myGenderInfo(), ch = charGenderInfo(char);
    return '\n【称呼提醒】我是' + (me.g || '（性别未说明）') + '，提到我只用「' + (me.p === 'TA' ? 'TA' : me.p) + '」' + (me.p === 'TA' ? '' : '，不要用' + (me.p === '她' ? '「他」' : '「她」')) + '。' + (ch.g ? '你是' + ch.g + '生，提到你自己是「' + ch.p + '」。' : '') + '其他人按各自性别用「他/她」，不要混。';
}
function buildCharacterCard(char, scene) {
    let characterCard = "你是一个住在手机里的AI助手，说话自然、简短。";
    if (char && char.card && char.card.sections && char.card.sections.length) {
        const c = char.card, nm = c.Name || char.name || '角色';
        const parts = ['你叫' + nm + '。以下是你的完整设定，请逐条遵守：'];
        let lastG = null;
        const skip = (x) => { const k = (x.g || '') + ' ' + (x.t || ''); return scene === 'online' ? /线下|offline/i.test(k) : scene === 'offline' ? /线上|online|打字|typing/i.test(k) : false; };
        c.sections.filter(x => !skip(x)).forEach(x => { if (x.g && x.g !== lastG) { parts.push('\n【' + x.g + '】'); } lastG = x.g; parts.push((x.t ? x.t + '：' : '') + x.v); });
        characterCard = parts.join('\n') + '\n\n请严格以这个角色的身份、性格和说话方式与我聊天。设定里如果写了互动规则、禁止事项、切换条件，必须照做。可以使用颜文字，但不要用emoji。';
    } else if (char && char.card && char.card.Name) {
        const c = char.card;
        const parts = ['你叫' + c.Name + '，' + (c.Age || '') + '岁，性别' + (c.Gender || '女') + '，身份是' + (c.Role || '普通人') + '。'];
        const map = [['Birthday','生日'],['Height','体型'],['Hair','发型'],['Eyes','眼睛'],['Clothing','穿衣风格'],['Personality','性格'],['SpeechStyle','说话习惯'],['Quirks','小癖好'],['Likes','喜欢'],['Dislikes','讨厌'],['Hobbies','爱好'],['Backstory','背景故事'],['HowMet','你们怎么认识的'],['CallMe','你称呼我为'],['Attitude','你对我的态度'],['Extra','额外设定']];
        map.forEach(([k, label]) => { if (c[k]) parts.push(label + '：' + c[k]); });
        characterCard = parts.join('\n') + '\n\n请严格以这个角色的身份、性格和说话方式与我聊天。不要提到自己是AI或程序。可以使用颜文字，但不要用emoji。';
    } else if (char && char.name) {
        characterCard = '你叫' + char.name + '。请以这个角色的身份与我聊天，说话自然、简短，可以使用颜文字，但不要用emoji。';
    }
    return characterCard + ((char && char.name) ? ROLE_RULES + liveRules() + genderRules(char) : '');
}

async function askAI(userMessage, useHistory, charId, opts) {
    if (!API_KEY) throw new Error("请先点击桌面上的【设置】，填入你的 API Key。");
    opts = opts || {};
    const messages = buildChatMessages(userMessage, useHistory, charId, opts);
    const response = await fetchChat(messages, false, opts.signal);
    if (!response.ok) throw new Error('请求失败: ' + response.status);
    const data = await response.json();
    return data.choices[0].message.content;
}

// ---------- 11. 聊天 ----------
function chatTimeLabel(ts) {
    const d = new Date(ts), n = new Date(), hm = pad2(d.getHours()) + ':' + pad2(d.getMinutes());
    const dd = Math.round((Date.UTC(n.getFullYear(), n.getMonth(), n.getDate()) - Date.UTC(d.getFullYear(), d.getMonth(), d.getDate())) / 864e5);
    if (dd === 0) return '今天 ' + hm; if (dd === 1) return '昨天 ' + hm;
    return (d.getFullYear() !== n.getFullYear() ? d.getFullYear() + '年' : '') + (d.getMonth() + 1) + '月' + d.getDate() + '日 ' + hm;
}
function chatTimeSep(box, ts) {
    ts = ts || Date.now();
    if (!box._lastTs || ts - box._lastTs >= 30 * 60000 || new Date(ts).getDate() !== new Date(box._lastTs).getDate()) {
        const sep = document.createElement('div'); sep.className = 'time-sep'; sep.textContent = chatTimeLabel(ts); box.appendChild(sep); box._sepAdded = true;
    }
    box._lastTs = ts;
}
function markGroupTail(box, msgDiv, senderName) {
    const prev = msgDiv.previousElementSibling;
    msgDiv.dataset.sn = senderName || '';
    msgDiv.classList.add('grp-last');
    if (prev && prev.classList.contains('message') && prev.className.split(' ').indexOf(msgDiv.classList.contains('user-message') ? 'user-message' : 'ai-message') >= 0 && (prev.dataset.sn || '') === (senderName || '')) prev.classList.remove('grp-last');
}
const readText = (r) => r ? '已读' : '未读';
function appendMessage(text, className, customAvatar, isHtml, senderName, ts, read) {
    const chatBox = document.getElementById('chatBox');
    if (!chatBox) return null;
    let avatarHTML = className === 'ai-message' ? (customAvatar || escapeHtml(AI_KAO)) : (customAvatar || myAvatarInner());
    const now = ts ? new Date(ts) : new Date();
    const timeStr = now.getHours().toString().padStart(2, '0') + ":" + now.getMinutes().toString().padStart(2, '0');
    if (read === undefined) read = className === 'ai-message';
    const bodyHTML = isHtml ? text : escapeHtml(text).replace(/\n/g, '<br>');
    const nameHTML = senderName ? '<div class="sender-name">' + escapeHtml(senderName) + '</div>' : '';
    chatTimeSep(chatBox, ts);
    const msgDiv = document.createElement('div');
    msgDiv.classList.add('message', className);
    msgDiv.innerHTML = '<div class="avatar-small">' + avatarHTML + '</div><div class="bubble-wrapper">' + nameHTML + '<div class="bubble">' + bodyHTML + '</div><div class="bubble-time"><span class="bt-time">' + timeStr + '</span><span class="read-status" data-r="' + (read ? 1 : 0) + '">' + readText(read) + '</span></div></div>';
    chatBox.appendChild(msgDiv); markGroupTail(chatBox, msgDiv, senderName);
    chatBox.scrollTop = chatBox.scrollHeight;
    return msgDiv;
}
function appendSystemMessage(text) {
    const chatBox = document.getElementById('chatBox');
    if (!chatBox) return null;
    const div = document.createElement('div');
    div.className = 'sys-msg';
    div.textContent = text;
    chatBox.appendChild(div);
    chatBox.scrollTop = chatBox.scrollHeight;
    return div;
}
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
function currentAiAvatarHTML() { return charAvatarInner(getChar(currentChatCharId)); }

// ---- 发送方式：live=发一条回一条；idle=停顿几秒后一起回；manual=我点「让TA回复」才回 ----
const PEND = {};
function sendMode() { const v = String(store.getItem('sendMode') || 'live'); return v === 'idle' || v === 'manual' ? v : 'live'; }
function idleSecs() { const n = parseFloat(store.getItem('sendIdle')); return n >= 2 && n <= 60 ? n : 6; }
async function userTriggerReply(charId, prompt, opts) {
    const m = sendMode();
    if (m === 'live' || isOffline(getChar(charId))) { clearTimeout((PEND[charId] || {}).t); delete PEND[charId]; return chatReply(charId, prompt, opts); }
    const p = PEND[charId] || (PEND[charId] = { n: 0 }); p.n++; p.prompt = prompt; p.opts = opts; clearTimeout(p.t);
    if (m === 'idle') p.t = setTimeout(() => replyPending(charId), idleSecs() * 1000);
    refreshPend();
}
async function replyPending(charId) {
    const p = PEND[charId]; if (!p || currentAbort) return;
    clearTimeout(p.t); delete PEND[charId]; refreshPend();
    if (!API_KEY) { uiAlert('请先在设置里填 API Key'); return; }
    return chatReply(charId, p.prompt, Object.assign({}, p.opts || {}));
}
function refreshPend() {
    let b = document.getElementById('replyNowBtn');
    if (!b) { const sb = document.getElementById('sendBtn'); if (!sb) return; b = document.createElement('button'); b.id = 'replyNowBtn'; b.className = 'hidden'; b.onclick = () => { if (currentChatCharId) replyPending(currentChatCharId); }; sb.parentNode.insertBefore(b, sb); }
    const p = currentChatCharId && !currentGroupId ? PEND[currentChatCharId] : null;
    if (p && !currentAbort) { b.classList.remove('hidden'); b.textContent = sendMode() === 'idle' ? '马上回复' : '让TA回复'; b.title = '已发 ' + p.n + ' 条，TA 还没回'; } else b.classList.add('hidden');
}
setInterval(refreshPend, 600);
async function sendMessage() {
    if (currentAbort) return;
    const userInput = document.getElementById('userInput');
    const text = userInput.value.trim();
    if (!text) return;
    if (currentGroupId) { return sendGroupMessage(text); }
    if (!currentChatCharId) { uiAlert('请先选一个角色再聊天~'); return; }
    const charId = currentChatCharId;
    { const bc = getChar(charId); if (bc && bc.blocked) { uiAlert('TA 在你的黑名单里，先在聊天详情里移出黑名单才能聊天哦'); return; } }
    const q = window.ChatX ? ChatX.takeQuote() : null;
    const el = appendMessage(text, 'user-message');
    if (q && el) ChatX.addQuote(el, q);
    userInput.value = '';
    const um = { role: "user", content: text }; if (q) um.quote = q;
    pushHistory(charId, um);
    if (el) el.dataset.idx = getHistory(charId).length - 1;
    onUserChatted(charId, text);
    await userTriggerReply(charId, text, q ? { quote: q } : undefined);
}
on('offlineBtn', 'click', toggleOffline);
on('sendBtn', 'click', () => { if (currentAbort) { currentAbort.abort(); return; } sendMessage(); });
on('userInput', 'keypress', (e) => { if (e.key === 'Enter') sendMessage(); });

function bindButton(btnId, contentId, prompt, typeLabel) {
    const btn = document.getElementById(btnId);
    const content = document.getElementById(contentId);
    if (!btn || !content) return;
    btn.addEventListener('click', async () => {
        content.textContent = '思考中...';
        try {
            const reply = await askAI(prompt, true);
            content.innerHTML = '<div class="content-text"><b>' + escapeHtml(typeLabel) + '</b><br>' + escapeHtml(reply).replace(/\n/g, '<br>') + '</div>';
        } catch (error) { content.textContent = '出错了：' + error.message; }
    });
}

on('proactiveBtn', 'click', async () => {
    if (currentAbort) return;
    if (currentGroupId) { await groupReply(currentGroupId, '（群里有点安静，请随机让一两位成员主动说点什么。）'); return; }
    const charId = currentChatCharId;
    if (!charId) return;
    await chatReply(charId, isOffline(getChar(charId)) ? "请你主动做点什么或说点什么，自然地推进一下我们当下的场景，只写你这边的动作和对白。" : "请你主动给我发一条消息，就像你突然想起了我。内容要简短、自然，直接输出消息内容即可。");
});

// ---------- 11b. 微信附件：图片/语音/位置/转账/红包 ----------
function appendCardMessage(className, cardHtml, isUser, ts, avatarOverride, read) {
    const chatBox = document.getElementById('chatBox');
    if (!chatBox) return null;
    const avatarHTML = isUser ? myAvatarInner() : (avatarOverride || currentAiAvatarHTML());
    const now = ts ? new Date(ts) : new Date();
    const timeStr = now.getHours().toString().padStart(2, '0') + ":" + now.getMinutes().toString().padStart(2, '0');
    if (read === undefined) read = !isUser;
    chatTimeSep(chatBox, ts);
    const msgDiv = document.createElement('div');
    msgDiv.classList.add('message', className);
    msgDiv.innerHTML = '<div class="avatar-small">' + avatarHTML + '</div><div class="bubble-wrapper">' + cardHtml + '<div class="bubble-time"><span class="bt-time">' + timeStr + '</span><span class="read-status" data-r="' + (read ? 1 : 0) + '">' + readText(read) + '</span></div></div>';
    chatBox.appendChild(msgDiv); markGroupTail(chatBox, msgDiv, '');
    chatBox.scrollTop = chatBox.scrollHeight;
    return msgDiv;
}
function closeAttachPanel() { const p = document.getElementById('attachPanel'); if (p) p.classList.add('hidden'); }
function ensureChatTarget() {
    if (!currentChatCharId && !currentGroupId) { uiAlert('请先选一个聊天~'); return false; }
    return true;
}

// 相册图片
on('photoInput', 'change', (e) => { const f = e.target.files[0]; e.target.value = ''; if (f) sendImageMessage(f, 'photo'); });

// 语音
async function sendVoiceMessage() {
    if (!ensureChatTarget()) return;
    const txt = await uiPrompt('说点什么（会显示成语音条）：');
    if (!txt) return;
    const secs = Math.max(1, Math.min(60, Math.round(txt.length / 3)));
    const wave = '<span class="voice-wave"><i></i><i></i><i></i><i></i></span>';
    const html = '<div class="bubble card-voice" data-text="' + escapeHtml(txt) + '" onclick="toggleVoiceText(this)">' + wave + ' ' + secs + '"</div>';
    appendCardMessage('user-message', html, true);
    closeAttachPanel();
    if (currentGroupId) { pushGroupHistory(currentGroupId, { role: 'user', content: '[语音]' + txt }); groupReply(currentGroupId, null); }
    else {
        pushHistory(currentChatCharId, { role: 'user', content: '[语音消息]' + txt });
        onUserChatted(currentChatCharId, txt);
        userTriggerReply(currentChatCharId, '（我给你发了一条语音说：' + txt + '）请自然回应。', { silentError: true });
    }
}

// 位置
async function sendLocation() {
    if (!ensureChatTarget()) return;
    const place = await uiPrompt('发送你所在的位置：', '星光广场 3 号街');
    if (!place) return;
    const html = '<div class="msg-card card-location"><span class="mc-ic">(・∀・)</span><div class="mc-body"><div class="mc-t1">我的位置</div><div class="mc-t2">' + escapeHtml(place) + '</div></div></div>';
    appendCardMessage('user-message', html, true);
    closeAttachPanel();
    if (currentGroupId) { pushGroupHistory(currentGroupId, { role: 'user', content: '[位置]' + place }); groupReply(currentGroupId, null); }
    else {
        pushHistory(currentChatCharId, { role: 'user', content: '[位置分享]' + place });
        aiRespondTo('（我把我的位置发给你了：' + place + '）请自然回应，可以说要不要来找我之类的。', currentChatCharId);
    }
}

// 转账
let moneyMode = null;
function openTransfer() {
    if (!currentChatCharId) { uiAlert('转账只能在和单个角色的聊天里用哦'); return; }
    closeAttachPanel();
    const c = getChar(currentChatCharId);
    document.getElementById('transferTo').textContent = c ? c.name : 'TA';
    document.getElementById('transferAmount').value = '';
    document.getElementById('transferNote').value = '';
    document.getElementById('transferModal').classList.remove('hidden');
}
function openRedPacket() {
    if (!currentChatCharId) { uiAlert('红包只能在和单个角色的聊天里用哦'); return; }
    closeAttachPanel();
    document.getElementById('redPacketAmount').value = '';
    document.getElementById('redPacketNote').value = '';
    document.getElementById('redPacketModal').classList.remove('hidden');
}
function closeMoney() {
    document.getElementById('transferModal').classList.add('hidden');
    document.getElementById('redPacketModal').classList.add('hidden');
}
function confirmTransfer() {
    const amt = parseFloat(document.getElementById('transferAmount').value);
    if (!amt || amt <= 0) { uiAlert('请输入金额'); return; }
    const note = document.getElementById('transferNote').value.trim();
    const charId = currentChatCharId;
    closeMoney();
    const html = '<div class="msg-card card-transfer"><span class="mc-ic">(¥ᴗ¥)</span><div class="mc-body"><div class="mc-t1">¥' + amt.toFixed(2) + '</div><div class="mc-t2">' + (note ? escapeHtml(note) : '转账') + '</div></div></div>';
    appendCardMessage('user-message', html, true);
    pushHistory(charId, { role: 'user', content: '[转账]¥' + amt.toFixed(2) + (note ? ' 说明：' + note : '') });
    bumpMood(charId, 6);
    aiRespondTo('（我给你转账了 ¥' + amt.toFixed(2) + '，' + (note ? '说明是「' + note + '」' : '没写说明') + '）请以角色身份自然回应，表达收到转账的心情。', charId);
}
function confirmRedPacket() {
    const amt = parseFloat(document.getElementById('redPacketAmount').value);
    if (!amt || amt <= 0) { uiAlert('请输入金额'); return; }
    const note = document.getElementById('redPacketNote').value.trim() || '恭喜发财，大吉大利';
    const charId = currentChatCharId;
    closeMoney();
    const html = '<div class="msg-card card-redpacket"><span class="mc-ic">(ﾉ´ヮ`)</span><div class="mc-body"><div class="mc-t1">' + escapeHtml(note) + '</div><div class="mc-t2">领取红包</div></div></div>';
    appendCardMessage('user-message', html, true);
    pushHistory(charId, { role: 'user', content: '[红包]' + note + ' ¥' + amt.toFixed(2) });
    bumpMood(charId, 8);
    aiRespondTo('（我给你发了一个红包 ¥' + amt.toFixed(2) + '，祝福语是「' + note + '」）请以角色身份开心地回应，并说一句领到红包的话。', charId);
}

// 统一的"让AI回应某个事件"的小工具
async function aiRespondTo(prompt, charId, opts) {
    if (!API_KEY) return;
    return chatReply(charId, prompt, Object.assign({ silentError: true }, opts || {}));
}

// ===== PIECE A ENDS HERE =====
// ===== PIECE B STARTS HERE (接在 Piece A 下面) =====

// ---------- 11c. 聊天核心：流式 / 分段 / 重新生成 / 编辑删除 / 长期记忆 ----------
let currentAbort = null;
const summarizing = {};
const SPLIT_HINT = '\n\n【聊天格式】你正在用微信和我聊天。像真人发消息一样，可以把一次回复拆成1~4条短消息，每条单独占一行（用换行分开），不要写成一大段，也不要出现空行。';
function getBool(key, def) { try { const v = store.getItem(key); return v === null ? def : v === 'true'; } catch (e) { return def; } }
function mergeSameRole(arr) {
    const out = [];
    arr.forEach(m => {
        const last = out[out.length - 1];
        if (last && last.role === m.role && typeof last.content === 'string' && typeof m.content === 'string') last.content += '\n' + m.content;
        else out.push({ role: m.role, content: m.content });
    });
    return out;
}
const ONLINE_RULES = '\n\n【线上聊天格式（最高优先级）】你现在是隔着手机打字聊天，线上只有「说出口的话」：严禁任何动作、神态、心理、环境描写，严禁用括号（）()、星号*、方括号【】包起来的旁白，例如（笑）（摸摸你的头）*叹气* 全都不许出现；想表达动作或情绪就直接用说话的语气、语气词、颜文字、表情包来表现。只有颜文字本身可以带括号。';
// 人设优先：把角色卡里关于「说话方式」的条目在提示词最后再强调一遍，避免被通用规则冲淡
function personaTail(char) {
    try {
        const secs = (char && char.card && char.card.sections) || [];
        const hit = secs.filter(x => /说话|语气|口头禅|聊天|称呼|打字|表达|情绪|speech|chat|typing|tone/i.test((x.g || '') + (x.t || '')) && !/线下|offline/i.test((x.g || '') + (x.t || '')));
        let t = '\n\n【人设优先】上面所有通用的说话要求（简短、口语化、少追问等），一旦和你的角色设定冲突——比如设定里你话很多/很黏人/爱用颜表情/有固定称呼和口头禅/性格强势或别扭——一律以角色设定为准，不要被写成千篇一律的「乖巧AI」。你的每一句话都要看得出是这个角色，而不是随便哪个人。';
        if (hit.length) t += '\n再次强调你线上聊天的说话方式：\n' + hit.slice(0, 10).map(x => (x.t ? x.t + '：' : '') + String(x.v).slice(0, 360)).join('\n');
        return t;
    } catch (e) { return ''; }
}
const OFFLINE_RULES = '\n\n【线下模式】现在不是隔着手机聊天，而是我们面对面在同一个场景里。请用小说式的叙述来回复：描写你的动作、神态、语气、周围环境和内心感受，对白用「」括起来，动作和神态直接写成叙述句，不要用星号*或括号包裹；用第一人称「我」写你自己，称呼我为「你」；每次写一到数段，约150~350字，节奏自然，不要像发微信那样拆成很多短句，也不要用表情包和颜文字；保持你的人设和我们已有的关系；不要替我做决定、不要替我说话，只写你这边发生的事，把空间留给我继续回应；场景要符合当前时间和我们已知的情况，不要编造我没说过的事实。';
function isOffline(c) { return !!(c && c.offline); }
function syncOfflineUI() {
    const room = document.getElementById('chatRoomApp'), btn = document.getElementById('offlineBtn'); if (!room) return;
    const c = (!currentGroupId && currentChatCharId) ? getChar(currentChatCharId) : null, on = isOffline(c);
    room.classList.toggle('offline-mode', on);
    if (btn) { btn.style.display = c ? '' : 'none'; btn.textContent = on ? '线下' : '线上'; btn.classList.toggle('on', on); }
    const inp = document.getElementById('userInput'); if (inp) inp.placeholder = on ? '写下你的动作或对白…' : '输入消息...';
}
function toggleOffline() {
    if (currentGroupId || !currentChatCharId || currentAbort) return;
    const chars = getChars(), c = chars.find(x => x.id === currentChatCharId); if (!c) return;
    c.offline = !c.offline; saveChars(chars); syncOfflineUI();
    appendSystemMessage(c.offline ? '已切换到线下模式：TA 会用叙述的方式回应你的动作和对白' : '已切回线上聊天');
}
// 给历史消息打上真实时间：隔了 20 分钟以上 / 跨天的用户消息，开头加一段括号时间，让角色能感知「什么时候说的、隔了多久」
function stampHistory(hist) {
    let prev = 0; const wk = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
    return hist.map(m => {
        let content = String(m.content);
        if (m.desc && m.role === 'user') content = content + '（图片内容：' + m.desc + '）';
        if (m.quote && m.role === 'user') content = '（引用' + (m.quote.w === 'me' ? '我' : '你') + '之前说的「' + m.quote.t + '」）' + content;
        if (m.ts && m.role === 'user') {
            const d = new Date(m.ts), gap = prev ? m.ts - prev : 0, newDay = prev && new Date(prev).getDate() !== d.getDate();
            if (!prev || gap >= 20 * 60000 || newDay) {
                const g = gap ? (gap < 3600000 ? Math.round(gap / 60000) + '分钟' : gap < 864e5 ? (Math.round(gap / 360000) / 10) + '小时' : (Math.round(gap / 8640000) / 10) + '天') : '';
                content = '（' + (d.getMonth() + 1) + '月' + d.getDate() + '日 ' + wk[d.getDay()] + ' ' + pad2(d.getHours()) + ':' + pad2(d.getMinutes()) + (g ? '，距上一条隔了' + g : '') + '）' + content;
            }
        }
        if (m.ts) prev = m.ts;
        return { role: m.role, content: content };
    });
}
function buildChatMessages(userMessage, useHistory, charId, opts) {
    opts = opts || {};
    const id = charId || getActiveCharId();
    const char = id ? getChar(id) : null;
    const off = isOffline(char), scene = off ? 'offline' : 'online';
    let systemContent = buildCharacterCard(char, scene);
    const wctx = recentCtx(char, userMessage);
    const worldbook = worldPromptFor(worldIdsOfChar(char), wctx, scene);
    if (worldbook) systemContent += '\n\n【世界书设定】：\n' + worldbook;
    if (char) systemContent += contextTail(char) + (off ? '' : stickerHint() + (window.chatxHint ? window.chatxHint() : ''));
    if (off) systemContent += OFFLINE_RULES;
    else if (opts.chat && getBool('chatSplit', true)) systemContent += SPLIT_HINT;
    if (!off) systemContent += ONLINE_RULES + personaTail(char);
    let msgs = [];
    if (useHistory && char) {
        let hist = (char.chatHistory || []).filter(m => m.role === 'user' || m.role === 'assistant');
        const last = hist[hist.length - 1];
        if (last && last.role === 'user' && last.content === userMessage && !last.recalled) hist = hist.slice(0, -1);
        msgs = stampHistory(hist.slice(-30));
    }
    if (opts.image) msgs.push({ role: 'user', content: [{ type: 'text', text: userMessage }, { type: 'image_url', image_url: { url: opts.image } }] });
    else msgs.push({ role: 'user', content: (opts.quote ? '（引用' + (opts.quote.w === 'me' ? '我' : '你') + '之前说的「' + opts.quote.t + '」）' : '') + userMessage });
    const merged = mergeSameRole(msgs);
    // 世界书「按深度插入」：放在倒数第 N 条消息之前（至少 1，保证最后一条仍是我说的话）
    worldDepthFor(worldIdsOfChar(char), wctx, scene).sort((a, b) => b.depth - a.depth).forEach(o => { merged.splice(Math.max(0, merged.length - o.depth), 0, { role: 'system', content: o.text }); });
    return [{ role: 'system', content: systemContent }].concat(merged);
}
// 有些接口不允许对话中间出现 system 消息：失败后自动改成普通消息再试一次
function flattenMidSystem(messages) {
    const out = messages.map((m, i) => (i > 0 && m.role === 'system') ? { role: 'user', content: '（系统提示）' + m.content } : m);
    return mergeSameRole(out.slice(1)).reduce((a, m) => a.concat(m), [out[0]]);
}
function chatTemp() { const v = parseFloat(store.getItem('chatTemp')); return v >= 0.2 && v <= 1.6 ? v : 1.0; }
async function fetchChat(messages, stream, signal) {
    const go = (msgs) => fetch(API_URL, { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + API_KEY }, body: JSON.stringify({ model: API_MODEL, messages: msgs, stream: stream, temperature: chatTemp() }), signal: signal });
    let r = await go(messages);
    if (!r.ok && (r.status === 400 || r.status === 422) && messages.some((m, i) => i > 0 && m.role === 'system')) r = await go(flattenMidSystem(messages));
    return r;
}
// 流式请求（SSE）。服务不支持流式时自动退回一次性结果
async function askAIStream(userMessage, useHistory, charId, opts, onDelta) {
    if (!API_KEY) throw new Error("请先点击桌面上的【设置】，填入你的 API Key。");
    opts = opts || {};
    const messages = buildChatMessages(userMessage, useHistory, charId, opts);
    const response = await fetchChat(messages, true, opts.signal);
    if (!response.ok) throw new Error('请求失败: ' + response.status);
    if (!response.body || !response.body.getReader) {
        const d = await response.json(); const t = d.choices[0].message.content; onDelta(t); return t;
    }
    const reader = response.body.getReader(), dec = new TextDecoder();
    let buf = '', raw = '', full = '';
    while (true) {
        const r = await reader.read();
        if (r.done) break;
        const chunk = dec.decode(r.value, { stream: true });
        buf += chunk; raw += chunk;
        let idx;
        while ((idx = buf.indexOf('\n')) >= 0) {
            const line = buf.slice(0, idx).trim(); buf = buf.slice(idx + 1);
            if (line.indexOf('data:') !== 0) continue;
            const payload = line.slice(5).trim();
            if (!payload || payload === '[DONE]') continue;
            try {
                const j = JSON.parse(payload);
                const delta = j.choices && j.choices[0] && j.choices[0].delta && j.choices[0].delta.content;
                if (delta) { full += delta; onDelta(delta); }
            } catch (e) {}
        }
    }
    if (!full) { try { const j = JSON.parse(raw); const t = j.choices[0].message.content; if (t) { full = t; onDelta(t); } } catch (e) {} }
    return full;
}
function splitSegments(text, split) {
    const t = String(text == null ? '' : text).replace(/\r/g, '');
    if (!split) return t.trim() ? [t.trim()] : [];
    return t.split(/\n+/).map(x => x.trim()).filter(Boolean);
}
function setSendBusy(b) { const btn = document.getElementById('sendBtn'); if (btn) btn.textContent = b ? '停止' : '发送'; }

// 让角色回复：流式 + 分段 + 写入历史
async function chatReply(charId, prompt, opts) {
    opts = opts || {};
    const split = getBool('chatSplit', true) && !isOffline(getChar(charId)), stream = getBool('chatStream', true);
    const here = () => charId === currentChatCharId && !currentGroupId;
    // 线上聊天：去掉括号/星号动作描写；[语音:...] 单独成行
    const segsOf = (t) => {
        if (isOffline(getChar(charId))) return splitSegments(t, split);
        let x = String(t == null ? '' : t).replace(/([\[［【]\s*(?:语音|voice)\s*[:：][^\]］】\n]*[\]］】])/gi, '\n$1\n');
        if (window.ChatX) x = ChatX.stripActions(x);
        return splitSegments(x, split || /[\[［【]\s*(?:语音|voice)/i.test(x));
    };
    const controller = new AbortController();
    currentAbort = controller; setSendBusy(true);
    const aiOpts = { chat: true, signal: controller.signal, image: opts.image || null, quote: opts.quote || null };
    const bubbles = [];
    setTimeout(() => markUserRead(charId, false), 700);
    if (here()) bubbles.push(appendMessage('正在输入...', 'ai-message', currentAiAvatarHTML()));
    let full = '';
    const setText = (el, t) => { const b = el.querySelector('.bubble'); if (!b) return; if (window.ChatX) t = ChatX.live(t); const st = stickerOf(t); if (st) { b.className = 'bubble ' + (st.face ? 'sticker-face' : 'sticker-img'); b.innerHTML = st.face ? escapeHtml(st.face) : '<img src="' + st.data + '">'; } else b.innerHTML = escapeHtml(t).replace(/\n/g, '<br>'); };
    let needRender = false;
    const histMsg = (seg) => {
        const X = window.ChatX, qm = X ? X.splitQuote(seg, charId) : null, body = qm ? qm.text : seg, gm = X ? X.imgTag(body) : null;
        let o;
        const vt = X ? X.voiceText(body) : null;
        if (vt) { o = { role: 'assistant', content: '[语音消息]' + vt }; needRender = true; }
        else if (gm) { o = { role: 'assistant', content: '[图片:' + gm + ']', gen: gm }; needRender = true; }
        else { const st = stickerOf(body); if (!st) o = { role: 'assistant', content: body }; else { o = { role: 'assistant', content: '[表情包:' + st.name + ']' }; if (st.face) o.face = st.face; else o.img = st.data; } }
        if (qm) { o.quote = qm.quote; needRender = true; }
        return o;
    };
    const isRecall = (seg) => window.ChatX && ChatX.isRecall(seg);
    const ensureBubble = (i, t) => {
        let el = bubbles[i];
        if (!el || !el.isConnected) { el = appendMessage(t, 'ai-message', currentAiAvatarHTML()); bubbles[i] = el; }
        return el;
    };
    const finish = (segs) => {
        segs.forEach((seg, i) => {
            if (isRecall(seg)) { if (ChatX.recallLastAi(charId)) needRender = true; return; }
            pushHistory(charId, histMsg(seg));
            const idx = getHistory(charId).length - 1;
            if (here()) { const el = ensureBubble(i, seg); setText(el, seg); el.dataset.idx = idx; }
        });
        bubbles.slice(segs.length).forEach(el => el.remove());
        if (needRender && here()) renderChatMessages();
    };
    let ok = false;
    try {
        if (stream) {
            await askAIStream(prompt, true, charId, aiOpts, (d) => {
                full += d;
                if (!here() || (bubbles[0] && !bubbles[0].isConnected)) return;
                const segs = segsOf(full);
                if (!segs.length) return;
                segs.forEach((t, i) => { const el = ensureBubble(i, t); setText(el, t); });
                const cb = document.getElementById('chatBox'); if (cb) cb.scrollTop = cb.scrollHeight;
            });
            const segs = segsOf(full);
            if (!segs.length) throw new Error('没有收到回复');
            finish(segs); ok = true;
        } else {
            const reply = await askAI(prompt, true, charId, aiOpts);
            const segs = segsOf(reply);
            if (!segs.length) throw new Error('没有收到回复');
            for (let i = 0; i < segs.length; i++) {
                if (i > 0) await sleep(450 + Math.min(1200, segs[i].length * 30));
                if (isRecall(segs[i])) { if (ChatX.recallLastAi(charId)) needRender = true; continue; }
                pushHistory(charId, histMsg(segs[i]));
                const idx = getHistory(charId).length - 1;
                if (here()) { const el = ensureBubble(i, segs[i]); setText(el, segs[i]); el.dataset.idx = idx; }
            }
            if (needRender && here()) renderChatMessages();
            ok = true;
        }
    } catch (error) {
        const partial = segsOf(full);
        if (stream && partial.length && !ok) { finish(partial); ok = true; }
        else if (!(error && error.name === 'AbortError')) {
            bubbles.forEach(el => el.remove());
            if (opts.visionHint) uiAlert('这次没能看图（' + (error && error.message) + '）。你的聊天模型可能不支持看图：在 聊天设置 → 识图 里改成「单独的识图接口」试试', 5200);
            if (!opts.silentError && here()) appendMessage('出错了：' + (error && error.message), 'ai-message', currentAiAvatarHTML());
        } else { bubbles.forEach(el => el.remove()); }
    } finally {
        currentAbort = null; setSendBusy(false);
    }
    if (ok) { maybeSummarize(charId); if (window.ChatX) ChatX.afterReply(charId); }
}

// ---- 聊天记录渲染（带序号，卡片类消息可还原） ----
function histCardHtml(m) {
    const c = String(m.content == null ? '' : m.content);
    let r;
    if (m.gen && window.ChatX) return ChatX.genHtml(m);
    if (/^\[表情包:/.test(c) && (m.face || m.img)) return stickerBubbleHtml(m.face ? { face: m.face } : { data: m.img });
    if (m.img && /^\[(图片|表情包)\]/.test(c)) return '<div class="bubble"><img src="' + m.img + '" style="max-width:' + (c.indexOf('表情') > 0 ? 120 : 150) + 'px;border-radius:8px;display:block;"></div>';
    if ((r = /^\[转账\]¥([\d.]+)(?: 说明：([\s\S]*))?$/.exec(c))) return '<div class="msg-card card-transfer"><span class="mc-ic">(¥ᴗ¥)</span><div class="mc-body"><div class="mc-t1">¥' + escapeHtml(r[1]) + '</div><div class="mc-t2">' + (r[2] ? escapeHtml(r[2]) : '转账') + '</div></div></div>';
    if ((r = /^\[红包\]([\s\S]*) ¥([\d.]+)$/.exec(c))) return '<div class="msg-card card-redpacket"><span class="mc-ic">(ﾉ´ヮ`)</span><div class="mc-body"><div class="mc-t1">' + escapeHtml(r[1]) + '</div><div class="mc-t2">领取红包</div></div></div>';
    if ((r = /^\[(?:位置分享|位置)\]([\s\S]*)$/.exec(c))) return '<div class="msg-card card-location"><span class="mc-ic">(・∀・)</span><div class="mc-body"><div class="mc-t1">我的位置</div><div class="mc-t2">' + escapeHtml(r[1]) + '</div></div></div>';
    if ((r = /^\[(?:语音消息|语音)\]([\s\S]*)$/.exec(c))) {
        const secs = Math.max(1, Math.min(60, Math.round(r[1].length / 3)));
        return '<div class="bubble card-voice" data-text="' + escapeHtml(r[1]) + '" onclick="toggleVoiceText(this)"><span class="voice-wave"><i></i><i></i><i></i><i></i></span> ' + secs + '"</div>';
    }
    return null;
}
function toggleVoiceText(el) {
    try { if (el.closest('.ai-message') && window.ChatX) ChatX.playVoice(el.getAttribute('data-text') || '', currentGroupId ? null : currentChatCharId); } catch (e) {}
    const old = el.parentElement.querySelector('.voice-text');
    if (old) { old.remove(); return; }
    const t = document.createElement('div');
    t.className = 'voice-text';
    t.textContent = el.getAttribute('data-text') || '';
    el.insertAdjacentElement('afterend', t);
}
function renderHistMsg(m, avatarHtml, speaker) {
    const isUser = m.role === 'user';
    const cls = isUser ? 'user-message' : 'ai-message';
    const content = String(m.content == null ? '' : m.content);
    const card = histCardHtml(m);
    const rd = m.read !== false;
    if (m.recalled && window.ChatX) return ChatX.recalledRow(m, isUser);
    let el;
    if (card) el = appendCardMessage(cls, card, isUser, m.ts, avatarHtml, rd);
    else { const isImg = /<\s*img/i.test(content); el = appendMessage(content, cls, isUser ? null : avatarHtml, isImg, speaker || null, m.ts, rd); }
    if (m.quote && el && window.ChatX) ChatX.addQuote(el, m.quote);
    return el;
}
function renderChatMessages() {
    const box = document.getElementById('chatBox'); if (!box) return;
    box.innerHTML = ''; box._lastTs = 0;
    if (currentGroupId) {
        const g = getGroup(currentGroupId); if (!g) return;
        const byId = {}; groupMembersOf(g).forEach(m => { byId[m.id] = m; });
        (g.chatHistory || []).forEach((m, i) => {
            if (m.role === 'system') { appendSystemMessage(m.content); return; }
            const mem = byId[m.speakerId];
            const el = renderHistMsg(m, mem ? charAvatarInner(mem) : escapeHtml(AI_KAO), m.speaker);
            if (el) el.dataset.idx = i;
        });
    } else if (currentChatCharId) {
        const c = getChar(currentChatCharId); if (!c) return;
        const av = charAvatarInner(c);
        (c.chatHistory || []).forEach((m, i) => {
            if (m.role !== 'user' && m.role !== 'assistant') return;
            const el = renderHistMsg(m, av, null);
            if (el) el.dataset.idx = i;
        });
    }
    box.scrollTop = box.scrollHeight;
    try { syncOfflineUI(); } catch (e) {}
}

// ---- 发送图片 / 表情包：保存缩略图；开启"识图"后让 AI 真的看到 ----
// ---- 识图 ----
function visionMode() { const v = store.getItem('visionMode'); if (v === 'off' || v === 'main' || v === 'sep') return v; return 'main'; }
function visionCfg() { const g = (k) => String(store.getItem(k) || '').trim(); return { url: g('visionUrl') || API_URL, key: g('visionKey') || API_KEY, model: g('visionModel') || API_MODEL }; }
async function describeImage(dataUrl) {
    const c = visionCfg(); if (!c.key) throw new Error('还没填识图接口的 Key');
    const body = { model: c.model, temperature: 0.3, messages: [{ role: 'user', content: [{ type: 'text', text: '请客观、具体地描述这张图片：主要内容（人物/物品/食物/场景）、颜色、画面里的文字、氛围和细节，200 字以内，不要评价，不要寒暄。' }, { type: 'image_url', image_url: { url: dataUrl } }] }] };
    const r = await fetch(c.url, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + c.key }, body: JSON.stringify(body) });
    if (!r.ok) throw new Error('接口返回 ' + r.status + (r.status === 400 || r.status === 422 ? '（这个模型可能不支持看图）' : ''));
    const t = String(((await r.json()).choices || [{}])[0].message.content || '').trim(); if (!t) throw new Error('没有返回内容'); return t.slice(0, 600);
}
function stashDesc(cid, thumb, desc) { try { const cs = getChars(), c = cs.find(x => x.id === cid); if (!c) return; for (let i = c.chatHistory.length - 1; i >= 0; i--) { const m = c.chatHistory[i]; if (m.role === 'user' && m.img === thumb) { m.desc = desc; break; } } saveChars(cs); } catch (e) {} }
function sendImageMessage(file, kind) {
    if (!ensureChatTarget()) return;
    const isEmoji = kind === 'emoji';
    readImageCompressed(file, (bigData) => {
        readImageCompressed(file, (thumb) => {
            const label = isEmoji ? '[表情包]' : '[图片]';
            const html = '<div class="bubble"><img src="' + thumb + '" style="max-width:' + (isEmoji ? 120 : 150) + 'px;border-radius:8px;display:block;"></div>';
            const el = appendCardMessage('user-message', html, true);
            if (currentGroupId) {
                pushGroupHistory(currentGroupId, { role: 'user', content: label, img: thumb });
                if (el) el.dataset.idx = (getGroup(currentGroupId).chatHistory || []).length - 1;
            } else {
                const cid = currentChatCharId;
                pushHistory(cid, { role: 'user', content: label, img: thumb });
                if (el) el.dataset.idx = getHistory(cid).length - 1;
                onUserChatted(cid, '');
                const mode = visionMode(), what = isEmoji ? '表情包' : '图片';
                                if (mode === 'off') userTriggerReply(cid, '（我发了一张' + what + '，你看不到具体内容，可以好奇地问问我是什么。）', { silentError: true });
                else if (mode === 'main') userTriggerReply(cid, '（我发了一张' + what + '，请仔细看图，用你自己的口吻自然回应，说出你看到的具体内容。）', { image: bigData, visionHint: true, silentError: true });
                else {
                    const wait = appendMessage('正在看图…', 'ai-message', currentAiAvatarHTML());
                    describeImage(bigData).then(desc => {
                        if (wait) wait.remove(); stashDesc(cid, thumb, desc);
                        userTriggerReply(cid, '（我发了一张' + what + '。你亲眼看到的画面是：「' + desc + '」。请用你自己的口吻自然回应，就像自己看到了一样，不要说“根据描述”。）', { silentError: true });
                    }).catch(err => { if (wait) wait.remove(); uiAlert('识图失败：' + err.message + '。可以在 聊天设置 → 识图 里检查接口', 4200); userTriggerReply(cid, '（我发了一张' + what + '，但你这次没看清，可以问问我是什么。）', { silentError: true }); });
                }
            }
        }, isEmoji ? 140 : 180);
    }, isEmoji ? 300 : 640);
    closeAttachPanel();
}

// ---- 点击气泡：复制 / 编辑 / 删除 / 重新生成 ----
let msgSel = null, msgEditIdx = null;
function curHistory() { return currentGroupId ? ((getGroup(currentGroupId) || {}).chatHistory || []) : getHistory(currentChatCharId); }
function copyText(t) {
    try { if (navigator.clipboard && navigator.clipboard.writeText) { navigator.clipboard.writeText(t); return; } } catch (e) {}
    const ta = document.createElement('textarea'); ta.value = t; document.body.appendChild(ta); ta.select();
    try { document.execCommand('copy'); } catch (e) {}
    ta.remove();
}
function openMsgSheet(idx) {
    if (currentAbort) return;
    const hist = curHistory(), m = hist[idx]; if (!m) return;
    msgSel = { idx: idx, armed: false };
    const g = (id) => document.getElementById(id);
    g('msgSheetPreview').textContent = String(m.content).slice(0, 80);
    const tagLike = /^\[/.test(String(m.content)) || !!m.img;
    g('msgEditBtn').classList.toggle('hidden', tagLike);
    g('msgCopyBtn').classList.toggle('hidden', !!m.img);
    const canRegen = !currentGroupId && m.role === 'assistant' && hist.slice(idx).every(x => x.role === 'assistant');
    g('msgRegenBtn').classList.toggle('hidden', !canRegen);
    g('msgDelBtn').textContent = '删除';
    if (window.ChatX) ChatX.sheet(m);
    g('msgSheet').classList.remove('hidden');
}
function closeMsgSheet() { const el = document.getElementById('msgSheet'); if (el) el.classList.add('hidden'); msgSel = null; }
function mutateHistory(fn) {
    if (currentGroupId) {
        const gs = getGroups(), g = gs.find(x => x.id === currentGroupId); if (!g) return;
        g.chatHistory = g.chatHistory || []; fn(g.chatHistory); saveGroups(gs);
    } else {
        const cs = getChars(), c = cs.find(x => x.id === currentChatCharId); if (!c) return;
        c.chatHistory = c.chatHistory || []; fn(c.chatHistory); saveChars(cs); chatHistory = c.chatHistory;
    }
    renderChatMessages(); renderChatList();
}
on('chatBox', 'click', (e) => {
    if (e.target.closest('.card-voice') || e.target.closest('.voice-text')) return;
    const b = e.target.closest('.bubble, .msg-card'); if (!b) return;
    const msg = b.closest('.message'); if (!msg || msg.dataset.idx === undefined) return;
    openMsgSheet(Number(msg.dataset.idx));
});
on('msgCancelBtn', 'click', closeMsgSheet);
on('msgSheet', 'click', (e) => { if (e.target.id === 'msgSheet') closeMsgSheet(); });
on('msgCopyBtn', 'click', () => { const m = msgSel ? curHistory()[msgSel.idx] : null; if (m) copyText(String(m.content)); closeMsgSheet(); });
on('msgEditBtn', 'click', () => {
    if (!msgSel) return;
    const m = curHistory()[msgSel.idx]; if (!m) return;
    msgEditIdx = msgSel.idx; closeMsgSheet();
    document.getElementById('msgEditText').value = String(m.content);
    document.getElementById('msgEditModal').classList.remove('hidden');
});
on('msgEditCancel', 'click', () => document.getElementById('msgEditModal').classList.add('hidden'));
on('msgEditSave', 'click', () => {
    const v = document.getElementById('msgEditText').value.trim();
    document.getElementById('msgEditModal').classList.add('hidden');
    if (!v || msgEditIdx === null) return;
    const i = msgEditIdx; msgEditIdx = null;
    mutateHistory(h => { if (h[i]) h[i].content = v; });
});
on('msgDelBtn', 'click', () => {
    if (!msgSel) return;
    const btn = document.getElementById('msgDelBtn');
    if (!msgSel.armed) { msgSel.armed = true; btn.textContent = '再点一次确认删除'; return; }
    const idx = msgSel.idx; closeMsgSheet();
    mutateHistory(h => { h.splice(idx, 1); });
});
on('msgRegenBtn', 'click', () => {
    if (!msgSel || currentGroupId || !currentChatCharId) return;
    const charId = currentChatCharId; closeMsgSheet();
    mutateHistory(h => { while (h.length && h[h.length - 1].role === 'assistant') h.pop(); });
    const h = getHistory(charId), last = h[h.length - 1];
    const prompt = (last && last.role === 'user') ? String(last.content) : '请你主动给我发一条消息，就像你突然想起了我。内容要简短、自然，直接输出消息内容即可。';
    chatReply(charId, prompt);
});

// ---- 长期记忆：聊得够长，就把更早的内容整理成摘要 ----
async function maybeSummarize(charId) {
    if (!API_KEY || summarizing[charId]) return;
    const c = getChar(charId); if (!c) return;
    const hist = c.chatHistory || [], len = hist.length;
    const mem = c.memory || { text: '', upTo: 0 };
    const upTo = Math.min(mem.upTo || 0, len), target = len - 30;
    if (target - upTo < 20) return;
    summarizing[charId] = true;
    try {
        const chunk = hist.slice(upTo, target).filter(m => m.role === 'user' || m.role === 'assistant').map(m => (m.role === 'user' ? '我' : c.name) + '：' + String(m.content)).join('\n');
        const text = await chatCompletion([
            { role: 'system', content: '你是对话记忆整理助手。' },
            { role: 'user', content: '已有的长期记忆：\n' + (mem.text || '（无）') + '\n\n新的聊天记录：\n' + chunk + '\n\n请把已有记忆和新聊天里值得长期记住的内容合并成一份新的记忆，用第三人称简洁记录：重要事件、我们之间的约定与关系变化、我透露的个人信息和喜好、TA的承诺与情绪变化。不超过400字，直接输出记忆内容，不要加标题。' }
        ], 0.5);
        const chars = getChars(), cc = chars.find(x => x.id === charId);
        if (cc && String(text).trim()) { cc.memory = { text: String(text).trim().slice(0, 800), upTo: target, ts: Date.now() }; saveChars(chars); }
    } catch (e) {}
    summarizing[charId] = false;
}
function memFlash(t) { const st = document.getElementById('memStatus'); if (st) { st.textContent = t; setTimeout(() => { st.textContent = ''; }, 2000); } }
on('memSaveBtn', 'click', () => {
    const cs = getChars(), c = cs.find(x => x.id === currentChatCharId); if (!c) return;
    c.memory = { text: document.getElementById('memText').value.trim(), upTo: (c.memory && c.memory.upTo) || 0, ts: Date.now() };
    saveChars(cs); memFlash('记忆已保存');
});
on('memClearBtn', 'click', () => {
    const cs = getChars(), c = cs.find(x => x.id === currentChatCharId); if (!c) return;
    c.memory = { text: '', upTo: (c.chatHistory || []).length, ts: Date.now() };
    saveChars(cs); document.getElementById('memText').value = ''; memFlash('已清空');
});
// ---- 聊天设置开关 ----
[['chatStreamToggle', 'chatStream', true], ['chatSplitToggle', 'chatSplit', true], ['chatLiveToggle', 'liveOn', true]].forEach(a => {
    const el = document.getElementById(a[0]); if (!el) return;
    el.checked = getBool(a[1], a[2]);
    el.addEventListener('change', () => { try { store.setItem(a[1], String(el.checked)); } catch (e) {} });
});

(function () {
    const g = (i) => document.getElementById(i), sv = (k, v) => { try { store.setItem(k, v); } catch (e) {} };
    const vm = g('visionMode'), vs = g('visionSep'), sm = g('sendModeSel'), si = g('sendIdle'), sr = g('sendIdleRow'), siv = g('sendIdleV');
    if (vm) { vm.value = visionMode(); const u = () => { vs.style.display = vm.value === 'sep' ? '' : 'none'; }; u(); vm.onchange = () => { sv('visionMode', vm.value); u(); }; }
    ['visionUrl', 'visionKey', 'visionModel'].forEach(k => { const el = g(k); if (el) { el.value = store.getItem(k) || ''; el.onchange = () => sv(k, el.value.trim()); } });
    if (sm) { sm.value = sendMode(); const u = () => { sr.style.display = sm.value === 'idle' ? '' : 'none'; }; u(); sm.onchange = () => { sv('sendMode', sm.value); u(); refreshPend(); }; }
    if (si) { si.value = idleSecs(); siv.textContent = si.value; si.oninput = () => { siv.textContent = si.value; sv('sendIdle', si.value); }; }
})();
(function () {
    const t = document.getElementById('chatTempRange'), tv = document.getElementById('chatTempVal'), b = document.getElementById('liveEditBtn');
    if (t) { t.value = chatTemp(); if (tv) tv.textContent = t.value; t.addEventListener('input', () => { if (tv) tv.textContent = t.value; try { store.setItem('chatTemp', t.value); } catch (e) {} }); }
    if (b) b.addEventListener('click', () => {
        const cur = String(store.getItem('liveCustom') || '').trim() || LIVE_RULES_DEFAULT.trim();
        const m = document.createElement('div'); m.className = 'ui-dlg-mask'; m.style.zIndex = 950;
        m.innerHTML = '<div class="ui-dlg" style="width:min(92vw,420px)"><div class="ui-dlg-msg" style="text-align:left">活人感指令：每次聊天都会发给 TA，告诉 TA 怎样像真人一样说话。可以改成你想要的风格；清空后保存＝恢复默认。</div><textarea id="liveTa" style="width:100%;height:46vh;box-sizing:border-box;border:1px solid var(--border,#ddd);border-radius:10px;padding:10px;font-size:13px;line-height:1.5;background:transparent;color:inherit"></textarea><div class="ui-dlg-btns"><button id="liveCancel">取消</button><button id="liveDef">恢复默认</button><button class="ok" id="liveOk">保存</button></div></div>';
        (document.querySelector('.phone') || document.body).appendChild(m); const ta = m.querySelector('#liveTa'); ta.value = cur;
        m.querySelector('#liveCancel').onclick = () => m.remove();
        m.querySelector('#liveDef').onclick = () => { try { store.setItem('liveCustom', ''); } catch (e) {} m.remove(); uiAlert('已恢复默认'); };
        m.querySelector('#liveOk').onclick = () => { const v = ta.value.trim(); try { store.setItem('liveCustom', (!v || v === LIVE_RULES_DEFAULT.trim()) ? '' : v); } catch (e) {} m.remove(); uiAlert('已保存'); };
    });
})();

// ---------- 12. 列表渲染 ----------
function renderContacts() {
    const list = document.getElementById('contactsList');
    if (!list) return;
    const characters = getChars();
    const groups = getGroups();
    if (!characters.length && !groups.length) { list.innerHTML = '<p style="color:#999;padding:14px;">还没有角色，点下方按钮添加 (｡･ω･｡)ﾉ</p>'; return; }
    let html = '';
    if (groups.length) {
        html += '<div class="list-title">群聊 (' + groups.length + ')</div>';
        html += groups.map(g => '<div class="contact-row"><span data-group="' + escapeHtml(g.id) + '" style="flex:1;cursor:pointer;display:flex;align-items:center;">' + groupAvatarBox(g, 'margin-right:10px;') + '<span>' + escapeHtml(groupDisplayName(g)) + '</span></span></div>').join('');
    }
    if (characters.length) {
        html += '<div class="list-title">角色 (' + characters.length + ')</div>';
        html += characters.map(c => '<div class="contact-row"><span data-open="' + escapeHtml(c.id) + '" style="flex:1;cursor:pointer;display:flex;align-items:center;"><span class="avatar-small" style="margin-right:10px;">' + charAvatarInner(c) + '</span><span>' + escapeHtml(c.name) + '</span></span><button type="button" class="btn-small" data-edit="' + escapeHtml(c.id) + '">编辑</button><button type="button" class="delete-contact-btn" data-del="' + escapeHtml(c.id) + '">删除</button></div>').join('');
    }
    list.innerHTML = html;
}

function formatChatTime(ts) {
    if (!ts) return '';
    const d = new Date(ts), now = new Date();
    const pad = n => String(n).padStart(2, '0');
    if (d.toDateString() === now.toDateString()) return pad(d.getHours()) + ':' + pad(d.getMinutes());
    const y = new Date(now); y.setDate(now.getDate() - 1);
    if (d.toDateString() === y.toDateString()) return '昨天';
    return (d.getMonth() + 1) + '-' + d.getDate();
}

function renderChatList() {
    const list = document.getElementById('chatList');
    if (!list) return;
    const characters = getChars();
    const groups = getGroups();
    if (!characters.length && !groups.length) { list.innerHTML = '<p style="padding:20px;color:#999;">还没有角色，去通讯录添加一个吧 (｡･ω･｡)ﾉ</p>'; return; }
    const items = [];
    characters.forEach(c => {
        const h = c.chatHistory || [];
        const last = h.length ? h[h.length - 1] : null;
        items.push({ attr: 'data-open', id: c.id, name: c.name, unread: unreadCount(c.chatHistory), mute: !!c.mute, blocked: !!c.blocked, pinned: !!c.pinned, ts: last ? (last.ts || 0) : 0, preview: last ? previewText(last.content) : '暂无消息', avatar: '<div class="avatar-small">' + charAvatarInner(c) + '</div>' });
    });
    groups.forEach(g => {
        const h = g.chatHistory || [];
        const last = h.length ? h[h.length - 1] : null;
        let preview = '暂无消息';
        if (last) preview = (last.role === 'assistant' && last.speaker ? last.speaker + '：' : '') + previewText(last.content);
        items.push({ attr: 'data-group', id: g.id, name: groupDisplayName(g) + '(' + ((g.members || []).length + 1) + ')', unread: unreadCount(g.chatHistory), mute: !!g.mute, pinned: !!g.pinned, ts: last ? (last.ts || 0) : (g.created || 0), preview: preview, avatar: groupAvatarBox(g, '') });
    });
    items.sort((a, b) => (b.pinned - a.pinned) || (b.ts - a.ts));
    list.innerHTML = items.map(it => '<div class="chat-list-item' + (it.pinned ? ' pinned' : '') + '" ' + it.attr + '="' + escapeHtml(it.id) + '">' + it.avatar + '<div class="chat-list-info"><div class="chat-list-top"><div class="chat-list-name">' + escapeHtml(it.name) + (it.mute ? ' <span class="li-tag">免打扰</span>' : '') + (it.blocked ? ' <span class="li-tag danger">黑名单</span>' : '') + '</div><div class="chat-list-time">' + formatChatTime(it.ts) + '</div></div><div class="chat-list-msg">' + escapeHtml(it.preview) + '</div></div>' + (it.unread ? '<span class="li-badge' + (it.mute ? ' mute' : '') + '">' + (it.mute ? '' : (it.unread > 99 ? '99+' : it.unread)) + '</span>' : '') + '</div>').join('');
}

function bindListClicks(containerId) {
    const box = document.getElementById(containerId);
    if (!box) return;
    box.addEventListener('click', (e) => {
        const del = e.target.closest('[data-del]');
        if (del) { e.stopPropagation(); deleteCharacter(del.getAttribute('data-del')); return; }
        const edit = e.target.closest('[data-edit]');
        if (edit) { e.stopPropagation(); editCharacter(edit.getAttribute('data-edit')); return; }
        const grp = e.target.closest('[data-group]');
        if (grp) { openGroupChat(grp.getAttribute('data-group')); return; }
        const open = e.target.closest('[data-open]');
        if (open) { openChatWith(open.getAttribute('data-open')); }
    });
}
bindListClicks('contactsList');
bindListClicks('chatList');

function refreshAllCharViews() {
    renderContacts();
    renderChatList();
    renderAllPickers();
    renderPrivacy();
    updateLockWidgets();
}

// ---------- 13. 角色增删改 ----------
on('addContactBtn', 'click', async () => {
    const name = await uiPrompt('请输入新角色的名字：');
    if (!name) return;
    const characters = getChars();
    const id = 'char_' + Date.now();
    characters.push({ id, name: name.trim(), avatar: DEFAULT_KAO, avatarData: null, card: {}, chatHistory: [], moments: [] });
    if (!saveChars(characters)) return;
    if (!store.getItem('activeCharId')) setActiveCharId(id);
    refreshAllCharViews();
    uiAlert('角色「' + name + '」添加成功！');
});

async function deleteCharacter(id) {
    if (!(await uiConfirm('确定要删除这个角色吗？'))) return;
    const characters = getChars().filter(c => c.id !== id);
    saveChars(characters);
    removeCharFromGroups(id);
    if (currentChatCharId === id) { currentChatCharId = null; chatHistory = []; }
    if (store.getItem('editingCharId') === id) store.removeItem('editingCharId');
    if (store.getItem('activeCharId') === id) store.removeItem('activeCharId');
    refreshAllCharViews();
    loadCharacterCard();
    refreshCharAvatarDisplay();
}

// 进入聊天后滚到最底部（页面刚显示时高度还没算好，所以要多补几次）
function scrollChatToBottom() {
    const go = () => { const b = document.getElementById('chatBox'); if (b) b.scrollTop = b.scrollHeight; };
    go(); requestAnimationFrame(go); setTimeout(go, 80); setTimeout(go, 300); setTimeout(go, 700);
}
function openChatWith(charId) {
    const char = getChar(charId);
    if (!char) return;
    currentChatCharId = charId;
    currentGroupId = null;
    if (window.ChatX) ChatX.clearQuote();
    setActiveCharId(charId);
    document.getElementById('chatTitle').textContent = char.name;
    const chatAvatarBox = document.getElementById('chatAvatar');
    if (chatAvatarBox) { chatAvatarBox.className = 'avatar-small'; chatAvatarBox.innerHTML = charAvatarInner(char); }
    const notice = document.getElementById('groupNotice');
    if (notice) notice.classList.add('hidden');
    const pb = document.getElementById('proactiveBtn');
    if (pb) pb.textContent = 'TA主动说话';
    maybeGreet(charId);
    chatHistory = (getChar(charId) || {}).chatHistory || [];
    renderChatMessages(); applyChatBg();
    openApp('chatRoom'); scrollChatToBottom();
    settleUnread(charId, false);
    updateMoodUI();
}

function openChatDetail() {
    if (currentGroupId) { openGroupDetail(); return; }
    const c = getChar(currentChatCharId);
    const pin = document.getElementById('pinSingle');
    if (pin) pin.checked = !!(c && c.pinned);
    const mu = document.getElementById('muteSingle'); if (mu) mu.checked = !!(c && c.mute);
    const bl = document.getElementById('blockCellText'); if (bl) bl.textContent = (c && c.blocked) ? '移出黑名单' : '加入黑名单';
    const memEl = document.getElementById('memText'); if (memEl) memEl.value = (c && c.memory && c.memory.text) || '';
    openApp('chatDetail');
}
on('pinSingle', 'change', (e) => {
    const chars = getChars();
    const c = chars.find(x => x.id === currentChatCharId);
    if (!c) return;
    c.pinned = e.target.checked;
    saveChars(chars);
    renderChatList();
});

function getContactNames() {
    try { return JSON.parse(store.getItem('contacts') || '["小雅","阿明","小雨"]'); } catch (e) { return ["小雅","阿明","小雨"]; }
}

// ---------- 14. 朋友圈 ----------
function getMoments() {
    try { return JSON.parse(store.getItem('allMoments') || '[]'); } catch (e) { return []; }
}
function saveMoments(arr) {
    try { store.setItem('allMoments', JSON.stringify(arr.slice(0, 100))); } catch (e) {}
}

on('uploadPostImgBtn', 'click', () => document.getElementById('postImageInput').click());
on('postImageInput', 'change', (e) => {
    const file = e.target.files[0];
    if (!file) return;
    readImageCompressed(file, (data) => { postImageData = data; document.getElementById('postImgName').textContent = '已选择图片'; }, 800);
});

on('postBtn', 'click', async () => {
    const content = document.getElementById('newPostContent').value.trim();
    if (!content && !postImageData) return;
    const myName = store.getItem('myName') || '我';
    const visibleTo = momentVisibleTo(postVisMode, postVisSel);
    if ((postVisMode === 'part' || postVisMode === 'except') && !postVisSel.length) { uiAlert('先选一下要' + (postVisMode === 'part' ? '给谁看' : '屏蔽谁') + '～'); return; }
    const moments = getMoments(); const mid = 'm_' + Date.now();
    moments.unshift({
        id: mid, author: 'user', authorName: myName, authorAvatar: store.getItem('myAvatarData') || null,
        text: content, image: postImageData || null, ts: Date.now(),
        likes: [], comments: [], vis: postVisMode, visSel: postVisSel.slice(), visibleTo: visibleTo
    });
    saveMoments(moments);
    document.getElementById('newPostContent').value = '';
    document.getElementById('postImgName').textContent = '';
    postImageData = null; postVisMode = 'public'; postVisSel = []; renderPostVisChars();
    renderMomentsFeed();
    if (!API_KEY || !visibleTo.length) return;
    const act = getActiveCharId();
    const order = (visibleTo.indexOf(act) >= 0 ? [act] : []).concat(visibleTo.filter(x => x !== act)).slice(0, 3);
    for (const cid of order) {
        const c = getChar(cid); if (!c || c.blocked) continue;
        try {
            const reply = await askAI('用户刚刚发了一条朋友圈："' + content + '"。请你以角色身份，给一句点赞或评论（自然、简短）。直接输出评论内容即可。', false, cid);
            const ms = getMoments(), post = ms.find(x => x.id === mid);
            if (post) { post.comments.push({ authorName: c.name, text: reply, ts: Date.now() }); if (post.likes.indexOf(c.name) < 0) post.likes.push(c.name); saveMoments(ms); renderMomentsFeed(); }
        } catch (e) {}
    }
});

on('toggleCharPost', 'click', () => {
    const row = document.getElementById('charPostRow');
    row.style.display = row.style.display === 'none' ? 'block' : 'none';
});
on('uploadCharPostImgBtn', 'click', () => document.getElementById('charPostImageInput').click());
on('charPostImageInput', 'change', (e) => {
    const file = e.target.files[0];
    if (!file) return;
    readImageCompressed(file, (data) => { charPostImageData = data; document.getElementById('charPostImgName').textContent = '已选择图片'; }, 800);
});
on('charPostBtn', 'click', () => {
    const content = document.getElementById('charPostContent').value.trim();
    if (!content && !charPostImageData) return;
    const charId = getActiveCharId();
    const c = getChar(charId);
    if (!c) { uiAlert('请先选择角色'); return; }
    const moments = getMoments();
    moments.unshift({
        id: 'm_' + Date.now(), author: charId, authorName: c.name, authorAvatar: c.avatarData || null,
        text: content, image: charPostImageData || null, ts: Date.now(),
        likes: [], comments: []
    });
    saveMoments(moments);
    document.getElementById('charPostContent').value = '';
    document.getElementById('charPostImgName').textContent = '';
    charPostImageData = null;
    document.getElementById('charPostRow').style.display = 'none';
    renderMomentsFeed();
});
on('autoCharPostBtn', 'click', async () => {
    const btn = document.getElementById('autoCharPostBtn');
    const charId = getActiveCharId();
    if (!charId) { uiAlert('请先选择角色'); return; }
    btn.textContent = 'TA正在思考...';
    try {
        const c = getChar(charId);
        const reply = await askAI("请以你的角色身份，发一条朋友圈动态。内容要符合你的性格。直接输出动态内容即可。", true, charId);
        const moments = getMoments();
        moments.unshift({
            id: 'm_' + Date.now(), author: charId, authorName: c.name, authorAvatar: c.avatarData || null,
            text: reply, image: null, ts: Date.now(), likes: [], comments: []
        });
        saveMoments(moments);
        renderMomentsFeed();
    } catch (error) { uiAlert('出错了：' + error.message); }
    btn.textContent = '让TA自己发一条动态 (๑•̀ㅂ•́)ﻭ';
});

function renderMomentsFeed() {
    const box = document.getElementById('momentsFeed');
    if (!box) return;
    const blockedIds = getChars().filter(c => c.blocked).map(c => c.id);
    const moments = getMoments().filter(m => blockedIds.indexOf(m.author) < 0);
    if (!moments.length) { box.innerHTML = '<p class="empty-tip">还没有朋友圈动态，发一条试试 (｡･ω･｡)ﾉ</p>'; return; }
    box.innerHTML = moments.map(m => {
        const imgHTML = m.image ? '<img src="' + m.image + '" style="width:100%;border-radius:10px;margin-top:8px;">' : '';
        const avatar = m.authorAvatar ? '<img src="' + m.authorAvatar + '" style="width:100%;height:100%;object-fit:cover;">' : escapeHtml(DEFAULT_KAO);
        const timeAgo = agoText(m.ts);
        const likeHTML = m.likes.length ? '<div class="moment-likes">♡ ' + m.likes.map(n => escapeHtml(n)).join('、') + '</div>' : '';
        const commentsHTML = m.comments.map(c => '<div class="moment-comment"><b>' + escapeHtml(c.authorName) + '</b>：' + escapeHtml(c.text) + '</div>').join('');
        const isLiked = m.likes.includes(store.getItem('myName') || '我');
        return '<div class="moment-item" data-mid="' + m.id + '">' +
            '<div class="moment-header"><span class="avatar-small" style="margin-right:8px;">' + avatar + '</span><span class="moment-author">' + escapeHtml(m.authorName) + '</span><span class="moment-time">' + timeAgo + '</span></div>' + (visLabel(m) ? '<div class="moment-vis">' + escapeHtml(visLabel(m)) + '</div>' : '') +
            '<div class="moment-content">' + escapeHtml(m.text) + imgHTML + '</div>' +
            '<div class="moment-actions"><button class="moment-act-btn' + (isLiked ? ' liked' : '') + '" data-like="' + m.id + '">♡ ' + (m.likes.length || '') + '</button><button class="moment-act-btn" data-comment="' + m.id + '">评论</button></div>' +
            likeHTML +
            '<div class="moment-comments">' + commentsHTML + '</div>' +
            '<div class="moment-comment-input" style="display:none;" data-cinput="' + m.id + '"><input type="text" placeholder="写评论..."><button>发送</button></div>' +
            '</div>';
    }).join('');
}

on('momentsFeed', 'click', async (e) => {
    const likeBtn = e.target.closest('[data-like]');
    if (likeBtn) {
        const mid = likeBtn.getAttribute('data-like');
        const ms = getMoments();
        const m = ms.find(x => x.id === mid);
        if (!m) return;
        const myName = store.getItem('myName') || '我';
        const idx = m.likes.indexOf(myName);
        if (idx >= 0) m.likes.splice(idx, 1); else m.likes.push(myName);
        saveMoments(ms);
        renderMomentsFeed();
        return;
    }
    const commentBtn = e.target.closest('[data-comment]');
    if (commentBtn) {
        const mid = commentBtn.getAttribute('data-comment');
        const inputArea = document.querySelector('[data-cinput="' + mid + '"]');
        if (inputArea) inputArea.style.display = inputArea.style.display === 'none' ? 'flex' : 'none';
        return;
    }
    const sendBtn = e.target.closest('.moment-comment-input button');
    if (sendBtn) {
        const wrap = sendBtn.closest('.moment-comment-input');
        const mid = wrap.getAttribute('data-cinput');
        const input = wrap.querySelector('input');
        const text = input.value.trim();
        if (!text) return;
        const ms = getMoments();
        const m = ms.find(x => x.id === mid);
        if (!m) return;
        const myName = store.getItem('myName') || '我';
        m.comments.push({ authorName: myName, text: text, ts: Date.now() });
        saveMoments(ms);
        input.value = '';
        renderMomentsFeed();
        const charId = getActiveCharId();
        if (charId && API_KEY && m.author !== 'user') {
            try {
                const reply = await askAI('有人在你的朋友圈动态下评论了："' + text + '"，你的动态内容是："' + m.text + '"。请简短回复这条评论。直接输出回复即可。', false, charId);
                const c = getChar(charId);
                const ms2 = getMoments();
                const m2 = ms2.find(x => x.id === mid);
                if (m2) { m2.comments.push({ authorName: c ? c.name : 'TA', text: reply, ts: Date.now() }); saveMoments(ms2); renderMomentsFeed(); }
            } catch (e) {}
        }
    }
});

// ---------- 15. 个人资料 ----------
function refreshCharAvatarDisplay() {
    const el = document.getElementById('charAvatarPreview');
    if (!el) return;
    const editingId = store.getItem('editingCharId');
    const c = editingId ? getChar(editingId) : null;
    if (c) el.innerHTML = charAvatarInner(c);
    else el.innerHTML = avatarInner(pendingCharAvatar, DEFAULT_KAO);
}
function loadProfile() {
    const avatarDisplay = document.getElementById('myAvatarDisplay');
    const preview = document.getElementById('avatarPreview');
    if (avatarDisplay) avatarDisplay.innerHTML = myAvatarInner();
    if (preview) preview.innerHTML = myAvatarInner();
    refreshCharAvatarDisplay();
    const genderEl = document.getElementById('editGender');
    if (genderEl) genderEl.value = store.getItem('myGender') || '女生';
    const nameDisplay = document.getElementById('myNameDisplay');
    if (nameDisplay) nameDisplay.textContent = store.getItem('myName') || '我';
    const sigDisplay = document.getElementById('mySignatureDisplay');
    if (sigDisplay) sigDisplay.textContent = store.getItem('mySignature') || '这个人很懒，什么都没留下';
    const editNameEl = document.getElementById('editName');
    if (editNameEl) editNameEl.value = store.getItem('myName') || '我';
    const editSigEl = document.getElementById('editSignature');
    if (editSigEl) editSigEl.value = store.getItem('mySignature') || '';
    const postAvatarEl = document.getElementById('postAvatar');
    if (postAvatarEl) postAvatarEl.innerHTML = myAvatarInner();
    const meAvatar = document.getElementById('meAvatar');
    if (meAvatar) meAvatar.innerHTML = myAvatarInner();
    const meName = document.getElementById('meNameDisplay');
    if (meName) meName.textContent = store.getItem('myName') || '我';
    const meSig = document.getElementById('meSigDisplay');
    if (meSig) meSig.textContent = store.getItem('mySignature') || '这个人很懒，什么都没留下';
}

on('uploadAvatarBtn', 'click', () => document.getElementById('avatarFileInput').click());
on('avatarFileInput', 'change', (e) => {
    const file = e.target.files[0]; if (!file) return;
    readImageCompressed(file, (data) => { try { store.setItem('myAvatarData', data); } catch (err) { uiAlert('头像太大'); return; } loadProfile(); });
    e.target.value = '';
});
on('saveProfileBtn', 'click', () => {
    store.setItem('myName', document.getElementById('editName').value.trim() || '我');
    store.setItem('mySignature', document.getElementById('editSignature').value.trim() || '');
    store.setItem('myGender', document.getElementById('editGender').value);
    const st = document.getElementById('profileStatus');
    if (st) { st.textContent = '资料已保存！'; setTimeout(() => st.textContent = '', 2000); }
    loadProfile();
});

function momentPermOf(c) { return c && c.momentPerm === 'deny' ? 'deny' : 'allow'; }
function renderPrivacy() {
    const list = document.getElementById('privacySettings');
    if (!list) return;
    const chars = getChars();
    if (!chars.length) { list.innerHTML = '<p class="hint-line">还没有联系人，先去通讯录添加角色吧。</p>'; return; }
    list.innerHTML = '<p class="hint-line">关掉后，TA 看不到你发的朋友圈，也不会点赞评论，聊天时也不会知道你发了什么。</p>' + chars.map(c => '<div class="privacy-item"><span class="avatar-small" style="width:26px;height:26px;margin-right:8px;">' + charAvatarInner(c) + '</span><span style="flex:1">' + escapeHtml(c.name) + '</span><input type="checkbox" class="ios-switch" data-pcid="' + c.id + '" ' + (momentPermOf(c) === 'allow' ? 'checked' : '') + '></div>').join('');
    list.querySelectorAll('input[data-pcid]').forEach(cb => cb.addEventListener('change', () => {
        const cs = getChars(), c = cs.find(x => x.id === cb.getAttribute('data-pcid')); if (!c) return;
        if (cb.checked) delete c.momentPerm; else c.momentPerm = 'deny'; saveChars(cs); renderPostVisChars();
    }));
}
// 2 发布时的可见范围
let postVisMode = 'public', postVisSel = [];
function renderPostVisChars() {
    const box = $('postVisChars'); if (!box) return;
    const chars = getChars();
    $('postVisSeg').querySelectorAll('button').forEach(b => b.classList.toggle('on', b.dataset.v === postVisMode));
    if (postVisMode === 'part' || postVisMode === 'except') {
        box.style.display = 'flex';
        box.innerHTML = chars.length ? chars.map(c => '<span class="chip' + (postVisSel.indexOf(c.id) >= 0 ? ' on' : '') + '" data-vid="' + c.id + '">' + escapeHtml(c.name) + '</span>').join('') : '<span class="hint-line">还没有联系人</span>';
    } else box.style.display = 'none';
}
function momentVisibleTo(mode, sel) {
    const chars = getChars().filter(c => momentPermOf(c) === 'allow');
    if (mode === 'private') return [];
    if (mode === 'part') return chars.filter(c => sel.indexOf(c.id) >= 0).map(c => c.id);
    if (mode === 'except') return chars.filter(c => sel.indexOf(c.id) < 0).map(c => c.id);
    return chars.map(c => c.id);
}
function visLabel(m) {
    if (m.author !== 'user' || !m.vis) return '';
    const nm = (ids) => (ids || []).map(id => (getChar(id) || {}).name).filter(Boolean).join('、');
    if (m.vis === 'private') return '仅自己可见';
    if (m.vis === 'part') return '部分可见：' + (nm(m.visSel) || '无');
    if (m.vis === 'except') return '不给 ' + (nm(m.visSel) || '无') + ' 看';
    return (m.visibleTo && m.visibleTo.length === 0) ? '没有人能看到（对方都已关闭权限）' : '';
}
on('postVisSeg', 'click', (e) => { const b = e.target.closest('button[data-v]'); if (!b) return; postVisMode = b.dataset.v; renderPostVisChars(); });
on('postVisChars', 'click', (e) => { const c = e.target.closest('[data-vid]'); if (!c) return; const id = c.dataset.vid, k = postVisSel.indexOf(id); if (k >= 0) postVisSel.splice(k, 1); else postVisSel.push(id); renderPostVisChars(); });
on('uploadCharAvatarBtn', 'click', () => document.getElementById('charAvatarFileInput').click());
on('charAvatarFileInput', 'change', (e) => {
    const file = e.target.files[0]; if (!file) return;
    readImageCompressed(file, (data) => {
        const editingId = store.getItem('editingCharId');
        if (!editingId) { pendingCharAvatar = data; refreshCharAvatarDisplay(); return; }
        const characters = getChars();
        const char = characters.find(c => c.id === editingId);
        if (!char) { uiAlert('找不到该角色'); return; }
        char.avatarData = data;
        if (!saveChars(characters)) return;
        refreshAllCharViews();
        refreshCharAvatarDisplay();
        if (currentChatCharId === editingId) {
            const box = document.getElementById('chatAvatar');
            if (box) box.innerHTML = charAvatarInner(char);
        }
    });
    e.target.value = '';
});

// ---------- 16. 外卖 ----------
const merchants = [
    { cat: '美食', name: '小杨生煎', desc: '多人评价分量足', price: '6.9', img: '(｡•ᴗ•)' },
    { cat: '美食', name: '临榆琵琶腿', desc: '好评率100%', price: '12.99', img: '(´ ∀ `)' },
    { cat: '团购', name: '龍歌自助小火锅', desc: '秋日造物 4.9折', price: '28.8', img: '(✿˘ᴗ˘)' },
    { cat: '美食', name: '肯德基', desc: '疯狂星期四', price: '9.9', img: '(´･ᴗ･)' },
    { cat: '美食', name: '麦当劳', desc: '随心配 1+1', price: '13.9', img: '(｡•̀ᴗ-)' },
    { cat: '美食', name: '喜茶', desc: '真茶真果真味道', price: '15', img: '(ﾉ´ヮ`)' },
    { cat: '美食', name: '蜜雪冰城', desc: '你爱我我爱你', price: '4', img: '(＾▽＾)' },
    { cat: '美食', name: '杨国福麻辣烫', desc: '骨汤麻辣烫', price: '20', img: '(ง˘ω˘)' },
    { cat: '团购', name: '双人电影套餐', desc: '2张票+爆米花+可乐', price: '59', img: '(◍•ᴗ•◍)' },
    { cat: '团购', name: '周末火锅双人餐', desc: '锅底+肥牛+蔬菜拼盘', price: '88', img: '(´▽`)' },
    { cat: '闪购', name: '便利蜂', desc: '零食饮料 30分钟达', price: '3', img: '(｡･ω･｡)' },
    { cat: '闪购', name: '鲜花小铺', desc: '一束花，送给TA', price: '39', img: '(✿◠‿◠)' },
    { cat: '买药', name: '大参林药房', desc: '感冒发烧常备药', price: '9.9', img: '(｡•́︿•̀｡)' },
    { cat: '买药', name: '暖心药房', desc: '维生素 暖宝宝 退热贴', price: '6', img: '(｡•ᴗ•｡)' }
];
const FOOD_KAO = ['(´ ∀ `)','(｡•ᴗ•)','(✿˘ᴗ˘)','(´･ᴗ･)'];
function dish(name, price, sales, i) { return { name, price, sales, img: FOOD_KAO[i % FOOD_KAO.length] }; }
function dishes(arr) { return arr.map((d, i) => dish(d[0], d[1], d[2], i)); }
const menuData = {
    '小杨生煎': dishes([['招牌生煎',6.9,99],['口水鸡米饭',6.9,200],['酸辣粉',8.9,50]]),
    '临榆琵琶腿': dishes([['琵琶腿2只',12.99,100],['鸡腿饭',18,80],['炸鸡翅',15,60]]),
    '龍歌自助小火锅': dishes([['单人自助餐',28.8,500],['双人套餐',55,200],['四人套餐',108,100]]),
    '肯德基': dishes([['香辣鸡腿堡',18,300],['薯条(大)',12,500],['原味鸡',15,200]]),
    '麦当劳': dishes([['巨无霸',22,400],['麦乐鸡',13,300],['可乐(中)',8,600]]),
    '喜茶': dishes([['多肉葡萄',28,200],['芝芝莓莓',32,150],['烤黑糖波波',22,180]]),
    '蜜雪冰城': dishes([['冰鲜柠檬水',4,1000],['摇摇奶昔',7,500],['圣代',6,300]]),
    '杨国福麻辣烫': dishes([['自选麻辣烫',25,300],['麻辣拌',22,200],['酸辣粉',10,150]]),
    '双人电影套餐': dishes([['2张电影票+爆米花+可乐',59,300],['情侣厅2张票',79,120],['小份爆米花',15,200]]),
    '周末火锅双人餐': dishes([['双人火锅套餐',88,400],['肥牛加量',32,150],['蔬菜拼盘',18,120]]),
    '便利蜂': dishes([['薯片3包',15,500],['气泡水',5,800],['热饮咖啡',9,300]]),
    '鲜花小铺': dishes([['玫瑰小花束',39,200],['向日葵花束',45,120],['多肉小盆栽',25,150]]),
    '大参林药房': dishes([['感冒灵颗粒',12,300],['退热贴',9.9,200],['布洛芬',16,150]]),
    '暖心药房': dishes([['暖宝宝10片',12,400],['复合维生素',38,200],['润喉糖',8,300]])
};
let merchantCat = '', merchantKw = '';
function renderMerchants() {
    const list = document.getElementById('merchantList');
    if (!list) return;
    const kw = merchantKw.trim().toLowerCase();
    const arr = merchants.filter(m => (!merchantCat || m.cat === merchantCat) && (!kw || m.name.toLowerCase().indexOf(kw) >= 0 || (m.desc || '').toLowerCase().indexOf(kw) >= 0 || (menuData[m.name] || []).some(d => d.name.toLowerCase().indexOf(kw) >= 0)));
    document.querySelectorAll('.takeout-cat').forEach(el => el.classList.toggle('active', el.dataset.cat === merchantCat && !!merchantCat));
    list.innerHTML = '<p style="font-weight:600;margin-bottom:10px;padding-left:5px;">' + (merchantCat || '附近') + '商家 (' + arr.length + '家)</p>' + (arr.length ? '' : '<p class="hint-line" style="text-align:center;">没有找到，换个关键词试试</p>') +
        arr.map(m => '<div class="merchant-card" data-m="' + escapeHtml(m.name) + '"><div class="merchant-img">' + m.img + '</div><div class="merchant-info"><div class="merchant-name">' + m.name + '</div><div class="merchant-desc">' + m.desc + '</div><div class="merchant-price">¥' + m.price + ' 起</div></div></div>').join('');
}
on('merchantList', 'click', (e) => { const c = e.target.closest('.merchant-card'); if (c) showMenu(c.getAttribute('data-m')); });
document.querySelectorAll('.takeout-cat').forEach(el => el.addEventListener('click', () => {
    const c = el.dataset.cat || ''; merchantCat = (merchantCat === c || c === '全部') ? '' : c; renderMerchants(); backToTakeout();
}));
const _tkSearch = document.querySelector('.takeout-search .search-input');
if (_tkSearch) _tkSearch.addEventListener('input', () => { merchantKw = _tkSearch.value; renderMerchants(); backToTakeout(); });
function backToTakeout() {
    document.getElementById('menuList').classList.add('hidden');
    document.getElementById('orderStatus').classList.add('hidden');
    document.getElementById('merchantList').classList.remove('hidden');
}
function smartBackTakeout() {
    const ml = document.getElementById('menuList'), os = document.getElementById('orderStatus');
    if (!ml.classList.contains('hidden') || !os.classList.contains('hidden')) backToTakeout(); else goHome();
}
function showMenu(ref) {
    const merchantName = typeof ref === 'number' ? merchants[ref].name : ref;
    document.getElementById('merchantList').classList.add('hidden');
    document.getElementById('orderStatus').classList.add('hidden');
    document.getElementById('menuList').classList.remove('hidden');
    const categories = ['招牌','套餐','小吃'];
    document.getElementById('menuCategories').innerHTML = categories.map((c, i) => '<div class="menu-category-item' + (i === 0 ? ' active' : '') + '" data-merchant="' + escapeHtml(merchantName) + '">' + c + '</div>').join('');
    document.querySelectorAll('#menuCategories .menu-category-item').forEach(el => {
        el.addEventListener('click', () => { document.querySelectorAll('#menuCategories .menu-category-item').forEach(x => x.classList.remove('active')); el.classList.add('active'); renderMenuItems(menuData[merchantName] || []); });
    });
    renderMenuItems(menuData[merchantName] || []);
}
function renderMenuItems(items) {
    document.getElementById('menuItems').innerHTML = items.map((item, i) => '<div class="menu-item-card"><div class="menu-item-img">' + item.img + '</div><div class="menu-item-info"><div><div class="menu-item-name">' + item.name + '</div><div class="menu-item-sales">月售 ' + item.sales + '</div></div><div class="menu-item-bottom"><span class="menu-item-price">¥' + item.price + '</span><button class="menu-item-btn" data-idx="' + i + '">加入</button></div></div></div>').join('');
    document.querySelectorAll('#menuItems .menu-item-btn').forEach(btn => {
        btn.addEventListener('click', () => { const it = items[+btn.getAttribute('data-idx')]; placeOrder(it.name, it.price); });
    });
}
async function placeOrder(item, price) {
    const target = (document.getElementById('takeoutTarget') || {}).value || 'self';
    const charId = getActiveCharId();
    const who = activeCharName();
    const forTa = target === 'ta';
    userEvent('takeout', forTa ? '【我（用户）→你】我给你点了外卖「' + item + '」，花了' + price + '元，送到你那里。付钱的是我，收到外卖的是你。' : '【我（用户）→我自己】我给自己点了外卖「' + item + '」，花了' + price + '元。这是我自己吃的，不是给你的。', { mood: forTa ? 6 : 1, react: !forTa });
    document.getElementById('menuList').classList.add('hidden');
    const status = document.getElementById('orderStatus');
    status.classList.remove('hidden');
    const head = '已下单：' + escapeHtml(item) + ' ¥' + price + '（' + (forTa ? '送给 ' + escapeHtml(who) : '自己吃') + '）<br>';
    status.innerHTML = '<div class="order-status-box">' + head + '等待骑手接单...</div>';
    const prompt = forTa
        ? '【方向：我（用户）买单，你是收到的人】我给你点了一份外卖「' + item + '」，花了' + price + '元，已经送到你那里了。请以你的角色身份回应「收到我送的外卖」的反应，要符合你的性格。直接输出。'
          : '【方向：我（用户）给我自己点的，不是给你的】我给自己点了一份外卖「' + item + '」，花了' + price + '元。请以你的角色身份关心我，比如叮嘱我吃好、问问我吃得怎么样，不要扮演骑手。直接输出。';
    try {
        const reply = await askAI(prompt, true, charId);
        status.innerHTML = '<div class="order-status-box">' + head + '<div style="color:var(--text-sub);font-size:12px;margin:8px 0 4px;">' + escapeHtml(who) + '</div>' + escapeHtml(reply).replace(/\n/g, '<br>') + '</div>';
    } catch (error) { status.innerHTML = '<div class="order-status-box">出错了：' + escapeHtml(error.message) + '</div>'; }
}

// ---------- 17. 淘宝 ----------
const products = [
    { id: 1, title: '2025新款冬季加厚羽绒服', price: 169.2, sales: '300+', img: '(✿˘ᴗ˘)', tag: '补贴' },
    { id: 2, title: '卡通冬季可反戴贝雷帽', price: 36.7, sales: '200+', img: '(´･ᴗ･)', tag: '热销' },
    { id: 3, title: '日系复古格纹围巾', price: 29.9, sales: '500+', img: '(｡•ᴗ•)', tag: '新品' },
    { id: 4, title: '韩版宽松加绒卫衣', price: 89.0, sales: '1.2万+', img: '(＾▽＾)', tag: '包邮' },
    { id: 5, title: '高腰显瘦直筒牛仔裤', price: 119.0, sales: '8000+', img: '(´ ∀ `)', tag: '热卖' },
    { id: 6, title: '可爱毛绒小熊斜挎包', price: 45.0, sales: '3000+', img: '(ﾉ´ヮ`)', tag: '热销' }
];
const gifts = [
    { id: 101, title: '浪漫玫瑰花束（11朵）', price: 99, sales: '520+', img: '(づ￣ ³￣)づ', tag: '浪漫' },
    { id: 102, title: '情侣手链一对', price: 128, sales: '1314+', img: '(✿˘ᴗ˘)', tag: '情侣' },
    { id: 103, title: '星空投影灯', price: 79, sales: '2000+', img: '(｡•̀ᴗ-)', tag: '氛围' },
    { id: 104, title: '定制相册书', price: 59, sales: '800+', img: '(´･ᴗ･)', tag: '回忆' },
    { id: 105, title: '毛绒小熊玩偶', price: 69, sales: '3000+', img: '(＾▽＾)', tag: '抱抱' },
    { id: 106, title: '香薰蜡烛礼盒', price: 49, sales: '1500+', img: '(´ ∀ `)', tag: '温柔' }
];
function backToShopping() {
    document.getElementById('productDetail').classList.add('hidden');
    document.getElementById('productList').classList.remove('hidden');
    document.getElementById('giftList').classList.add('hidden');
    const tabs = document.querySelectorAll('.taobao-tab');
    tabs.forEach(t => t.classList.remove('active'));
    if (tabs[0]) tabs[0].classList.add('active');
    renderProducts(products, 'productList');
}
function smartBackShopping() {
    const detail = document.getElementById('productDetail');
    if (!detail.classList.contains('hidden')) backToShopping(); else goHome();
}
function switchTaobaoTab(el, type) {
    document.querySelectorAll('.taobao-tab').forEach(t => t.classList.remove('active'));
    el.classList.add('active');
    document.getElementById('productDetail').classList.add('hidden');
    if (type === 'recommend') { document.getElementById('productList').classList.remove('hidden'); document.getElementById('giftList').classList.add('hidden'); renderProducts(products, 'productList'); }
    else { document.getElementById('productList').classList.add('hidden'); document.getElementById('giftList').classList.remove('hidden'); renderProducts(gifts, 'giftList'); }
}
function renderProducts(list, containerId) {
    const box = document.getElementById(containerId);
    if (!box) return;
    box.innerHTML = list.map(p => '<div class="product-card" onclick="showProductDetail(' + p.id + ',\'' + containerId + '\')"><div class="product-img">' + p.img + '</div><div class="product-info"><div class="product-title">' + p.title + '</div><div class="product-price-row"><span class="product-price-symbol">¥</span><span class="product-price">' + p.price + '</span><span class="product-sales">已售' + p.sales + '</span></div><div><span class="product-tag">' + p.tag + '</span></div></div></div>').join('');
}
function showProductDetail(id, source) {
    document.getElementById('productList').classList.add('hidden');
    document.getElementById('giftList').classList.add('hidden');
    const detail = document.getElementById('productDetail');
    detail.classList.remove('hidden');
    const isGift = source === 'giftList';
    const p = (isGift ? gifts : products).find(item => item.id === id);
    if (!p) return;
    detail.innerHTML = '<div class="product-detail-img">' + p.img + '</div><div class="product-detail-title">' + p.title + '</div><div class="product-detail-price">¥' + p.price + '</div><div class="product-detail-desc"><div><span class="product-tag">' + p.tag + '</span> 已售 ' + p.sales + '</div><br><div>' + (isGift ? '送给TA一定会很开心 (๑´ᵕ`๑)' : '面料舒适，做工精细') + '</div></div><button class="product-detail-btn" id="buyNowBtn">' + (isGift ? '买下送给TA (๑´ᵕ`๑)' : '立即购买') + '</button>';
    document.getElementById('buyNowBtn').addEventListener('click', () => { if (isGift) buyGift(p.title, p.price); else buyProduct(p.title, p.price); });
}
async function buyProduct(name, price) {
    userEvent('shop', '【我（用户）→我自己】我给自己买了「' + name + '」¥' + price + '，是我自己用的，不是给你的。', { mood: 1 });
    const detail = document.getElementById('productDetail');
    detail.innerHTML = '<div class="product-detail-desc" style="text-align:center;padding-top:100px;">正在下单...</div>';
    try {
        const reply = await askAI("【方向：我（用户）给我自己买的，不是给你的】我买了" + name + "，花了" + price + "元，请你以角色身份，按你自己的性格给个自然的反馈。直接输出即可。", true);
        detail.innerHTML = '<div class="product-detail-desc" style="text-align:center;padding-top:60px;"><div style="font-size:24px;">(＾▽＾)</div><p style="font-weight:600;margin:15px 0;">下单成功！</p><p style="color:var(--text-sub);font-size:12px;margin-bottom:6px;">' + escapeHtml(activeCharName()) + '</p><p>' + escapeHtml(reply) + '</p><button class="product-detail-btn" style="margin-top:20px;" onclick="backToShopping()">继续逛逛</button></div>';
    } catch (error) { detail.innerHTML = '<div style="text-align:center;padding-top:100px;">出错了：' + escapeHtml(error.message) + '</div>'; }
}
async function buyGift(name, price) {
    userEvent('gift', '【我（用户）→你】我给你买了礼物「' + name + '」¥' + price + '。买礼物的人是我，收到礼物的人是你。', { mood: 10, react: false });
    const detail = document.getElementById('productDetail');
    detail.innerHTML = '<div class="product-detail-desc" style="text-align:center;padding-top:100px;">正在为TA下单...</div>';
    try {
        const reply = await askAI("【方向：我（用户）买礼物送给你，你是收礼物的人】我给你买了一份礼物：" + name + "，花了" + price + "元。请你以角色身份，完全按你自己的性格和习惯，自然地表达收到礼物的反应（不要套用常见的嘴硬/害羞模板，每次说法都不一样）。直接输出即可。", true);
        detail.innerHTML = '<div class="product-detail-desc" style="text-align:center;padding-top:60px;"><div style="font-size:24px;">(๑´ᵕ`๑)</div><p style="font-weight:600;margin:15px 0;">礼物已送达！</p><p style="color:var(--text-sub);font-size:12px;margin-bottom:6px;">' + escapeHtml(activeCharName()) + '</p><p>' + escapeHtml(reply) + '</p><button class="product-detail-btn" style="margin-top:20px;" onclick="backToShopping()">继续逛逛</button></div>';
    } catch (error) { detail.innerHTML = '<div style="text-align:center;padding-top:100px;">出错了：' + escapeHtml(error.message) + '</div>'; }
}

// ---------- 18. 工具箱按钮绑定 ----------
function bindPeekButton(btnId, contentId, prompt, label, kind) {
    const btn = document.getElementById(btnId), content = document.getElementById(contentId);
    if (!btn || !content) return;
    btn.addEventListener('click', async () => {
        const id = getActiveCharId(), c = id ? getChar(id) : null;
        if (!c) { uiAlert('先创建并选择一个角色'); return; }
        const mode = await uiChoose('你要翻看「' + c.name + '」的手机，要让 TA 知道吗？', [{ label: '让 TA 知道', v: 'know', primary: true }, { label: '偷偷看，不让 TA 知道', v: 'secret' }, { label: '算了', v: null }]);
        if (!mode) return;
        content.textContent = '思考中...';
        try {
            const old = ((lifeOf(c).peekFake || {})[kind] || []).slice(-3);
            // 内容本身永远是「手机里本来就有的东西」，和有没有人在看无关：
            // 偷偷看 = TA 对此毫不知情，提示词里不出现任何「有人在看」的信息，也不带聊天记录，避免 TA 的口吻露馅。
            const p = '【生成任务】下面是你自己手机里本来就存在的一份内容，你只是把它创作出来，并不知道、也不需要关心有没有人在看。\n'
                + '要求：只输出内容本身（像手机里真实存在的东西）；不要对任何「看的人」说话，不要出现「看吧/被你发现/你怎么翻我手机/手机没锁」之类提到被查看的话；不要写成在和我聊天。\n'
                + '当前时间：' + timeContext() + '（内容里的时间、日期要和此刻相符，不要写出明显晚于现在的时间）\n'
                + '内容类型：' + prompt
                + (old.length ? '\n（你手机里这类内容之前已有如下几条，请和它们保持设定一致，可以在此基础上新增：\n' + old.join('\n---\n') + '）' : '');
            const reply = oneLineKeep(await callPersona(id, p, 1.0));
            lifeUpdate(id, (L) => { L.peekFake = L.peekFake || {}; const a = (L.peekFake[kind] = L.peekFake[kind] || []); a.push(String(reply).slice(0, 400)); L.peekFake[kind] = a.slice(-5); });
            content.innerHTML = '<div class="content-text"><b>' + escapeHtml(label) + '</b><br>' + escapeHtml(reply).replace(/\n/g, '<br>') + '</div><p class="hint-line" style="margin-top:8px">' + (mode === 'know' ? escapeHtml(c.name) + ' 知道你在看' : '这次是偷偷看的，' + escapeHtml(c.name) + ' 不知道') + '</p><div class="pk-know"></div>';
            if (mode === 'know') peekKnowReact(id, c, label, reply, content);
            // 偷偷看：不写入 TA 的聊天记录、活动记录、心情，TA 的后续对话里不会有任何痕迹
        } catch (error) { content.textContent = '出错了：' + error.message; }
    });
}
function oneLineKeep(t) { return String(t == null ? '' : t).replace(/^\s+|\s+$/g, ''); }
async function peekKnowReact(id, c, label, reply, box) {
    try { logActivity(id, 'peek', '我当着你的面翻看了你手机里的' + label.replace(/^TA的/, '')); bumpMood(id, -1); } catch (e) {}
    if (!API_KEY) return;
    try {
        const r = oneLine(await callPersona(id, '我刚刚当着你的面翻看了你手机里的' + label.replace(/^TA的/, '') + '（我看到的内容：' + String(reply).slice(0, 200) + '）。请你以角色本人的口吻反应：可以害羞、嘴硬、吃醋、无奈或大方，取决于你的性格和内容；口语，1~2句，不超过50字；只输出这句话。', 1.0));
        if (!r) return; pushHistory(id, { role: 'assistant', content: r }); renderChatList();
        const k = box && box.querySelector('.pk-know'); if (k) k.innerHTML = '<div class="td-react"><div class="bub-av">' + escapeHtml(c.name.slice(0, 1)) + '</div><div class="bub">' + escapeHtml(r) + '</div></div>';
    } catch (e) {}
}
bindPeekButton('peekMemoBtn2', 'peekContent2', "你手机备忘录里的一条备忘（符合你的性格和近期生活，可以是待办、随手记、心情碎碎念，不要写给任何人看）。", "TA的备忘录", 'memo');
bindPeekButton('peekPhotoBtn2', 'peekContent2', "你手机相册里的一张照片（用一两句话描述画面、拍摄时间地点和你当时的心情）。", "TA的相册", 'photo');
bindPeekButton('peekChatBtn2', 'peekContent2', "你和某个别人（朋友/同事/家人，不是我）的一小段微信聊天记录，用「名字：内容」逐行写，4~6行，内容是你们日常的事。", "TA的聊天记录", 'chat');
bindButton('generatePhotoBtn', 'albumContent', "以角色身份描述一张你刚拍的照片。直接输出描述。", "新照片");
bindButton('writeDiaryBtn', 'diaryContent', "以角色身份写一篇今天的日记。直接输出。", "今日日记");
bindButton('buyGiftBtn', 'shoppingContent', "假装你在淘宝给我买了个礼物，告诉我买了什么。直接输出。", "TA的礼物");
bindButton('morningBtn', 'lifekitContent', "现在是早上，跟我说早安。直接输出。", "早安");
bindButton('nightBtn', 'lifekitContent', "现在是晚上，跟我说晚安。直接输出。", "晚安");
bindButton('mealBtn', 'lifekitContent', "到饭点了，告诉我你吃了什么，关心我吃了没。直接输出。", "吃饭啦");
on('weatherBtn', 'click', async () => {
    const box = $('lifekitContent'); box.textContent = '正在看天气…';
    try { const w = await fetchWeather(false); const real = w ? '（真实天气：' + weatherLine(w) + '）' : '（还没设置所在城市或没查到天气，请在「TA的生活」里填城市；不要编造具体天气）';
        const reply = await askAI('告诉我今天天气，叮嘱我穿衣服。' + real + '直接输出。', true);
        box.innerHTML = '<div class="content-text"><b>今日天气</b><br>' + escapeHtml(reply).replace(/\n/g, '<br>') + '</div>'; } catch (error) { box.textContent = '出错了：' + error.message; }
});
bindButton('bedtimeLetterBtn', 'listenContent', "给我写一封睡前的信。直接输出。", "睡前信");
bindButton('scheduleBtn', 'calendarContent', "告诉我你今天的日程安排。直接输出。", "今日日程");
bindButton('anniversaryBtn', 'calendarContent', "回忆一下我们的纪念日。直接输出。", "纪念日");

// ---------- 19. 亲密空间 ----------
const INTIMATE_ACTIONS = {
    headpat: { prompt: "我摸了摸你的头。根据你的角色性格做出反应。直接输出你的反应和说的话。", label: "摸摸头", pts: 3 },
    kiss: { prompt: "我亲了你一下。根据你的角色性格做出反应。直接输出。", label: "亲一下", pts: 5 },
    hug: { prompt: "我抱住了你。做出温暖的回应。直接输出。", label: "抱抱", pts: 4 },
    hold_hand: { prompt: "我轻轻牵起了你的手。根据性格反应。直接输出。", label: "牵手", pts: 3 },
    stare: { prompt: "我看着你的眼睛，什么都没说。根据性格反应，可以害羞、可以坦然对视。直接输出。", label: "对视", pts: 4 },
    nuzzle: { prompt: "我把脸蹭到了你身上。根据性格反应。直接输出。", label: "蹭蹭", pts: 4 },
    pinch_cheek: { prompt: "我捏了捏你的脸。根据性格反应。直接输出。", label: "捏脸", pts: 3 },
    back_lean: { prompt: "我靠在你的背上，安静不说话。根据性格反应。直接输出。", label: "背靠背", pts: 4 },
    whisper: { prompt: "我凑到你耳边轻声说了句'你真好'。根据性格反应。直接输出。", label: "耳语", pts: 5 },
    forehead_kiss: { prompt: "我亲了一下你的额头。根据性格反应。直接输出。", label: "额头吻", pts: 6 },
    lap_pillow: { prompt: "我躺在你腿上，让你给我当膝枕。根据性格反应。直接输出。", label: "膝枕", pts: 5 },
    poke: { prompt: "我戳了戳你。根据性格反应。直接输出。", label: "戳一戳", pts: 2 }
};


// 亲密互动回复：限制字数 + 把"（动作）"和"台词"分开显示
const INTIMATE_STYLE = '\n回复格式：先写一行（动作或神态描写，不超过25字），再写一到两句台词，总共不超过70字，不要空行，不要写成长段。';
function formatIntimateReply(text) {
    const out = [];
    String(text == null ? '' : text).replace(/\r/g, '').split('\n').forEach(raw => {
        let line = raw.trim();
        while (line) {
            const open = line[0];
            if (open === '（' || open === '(') {
                const close = open === '（' ? '）' : ')';
                const end = line.indexOf(close);
                if (end > 0) {
                    const inner = line.slice(1, end);
                    if (open === '（' || /[一-龥]{3,}/.test(inner)) {
                        out.push('<div class="ir-action">（' + escapeHtml(inner) + '）</div>');
                        line = line.slice(end + 1).trim();
                        continue;
                    }
                }
            }
            out.push('<div class="ir-text">' + escapeHtml(line) + '</div>');
            line = '';
        }
    });
    return out.join('') || '<div class="ir-text">...</div>';
}
function activeCharName() { const c = getChar(getActiveCharId()); return c ? c.name : 'TA'; }

function getIntimacy(charId) {
    const c = getChar(charId);
    return (c && typeof c.intimacy === 'number') ? c.intimacy : 0;
}
function addIntimacy(charId, pts) {
    const chars = getChars();
    const c = chars.find(x => x.id === charId);
    if (!c) return;
    c.intimacy = Math.min(9999, (c.intimacy || 0) + pts);
    saveChars(chars);
}
function intimacyLevel(pts) {
    if (pts >= 500) return { lv: 5, name: '灵魂伴侣', next: 999 };
    if (pts >= 200) return { lv: 4, name: '心意相通', next: 500 };
    if (pts >= 80) return { lv: 3, name: '亲密无间', next: 200 };
    if (pts >= 30) return { lv: 2, name: '渐入佳境', next: 80 };
    return { lv: 1, name: '初识', next: 30 };
}

function refreshIntimatePanel() {
    const id = getActiveCharId();
    const c = id ? getChar(id) : null;
    const av = document.getElementById('intimateAvatar');
    const nm = document.getElementById('intimateName');
    const lv = document.getElementById('intimateLevel');
    const fill = document.getElementById('intimateFill');
    const pts = document.getElementById('intimatePts');
    if (!c) {
        if (av) av.innerHTML = DEFAULT_KAO;
        if (nm) nm.textContent = '--';
        if (lv) lv.textContent = '';
        return;
    }
    if (av) av.innerHTML = charAvatarInner(c);
    if (nm) nm.textContent = c.name;
    const int = getIntimacy(c.id);
    const lvl = intimacyLevel(int);
    if (lv) lv.textContent = '亲密度 Lv.' + lvl.lv + ' ' + lvl.name;
    if (fill) fill.style.width = Math.min(100, (int / lvl.next * 100)) + '%';
    if (pts) pts.textContent = int + ' / ' + lvl.next;
}

document.querySelectorAll('.intimate-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
        const action = btn.getAttribute('data-action');
        const act = INTIMATE_ACTIONS[action];
        if (!act) return;
        const id = getActiveCharId();
        if (!id) { uiAlert('请先选择角色'); return; }
        const reply = document.getElementById('intimateReply');
        reply.innerHTML = '<div class="ir-action">(' + act.label + '中...)</div>';
        const av = document.getElementById('intimateAvatar');
        if (av) { av.classList.remove('pulse'); void av.offsetWidth; av.classList.add('pulse'); }
        addIntimacy(id, act.pts);
        bumpMood(id, act.pts > 4 ? 5 : 3);
        refreshIntimatePanel();
        try {
            const text = await askAI(act.prompt + INTIMATE_STYLE, true, id);
            reply.innerHTML = '<div class="ir-action">(' + act.label + ')</div>' + formatIntimateReply(text);
        } catch (error) {
            reply.innerHTML = '<div class="ir-action">出错了：' + error.message + '</div>';
        }
    });
});

// ---------- 19b. 全屏亲密互动 ----------
const IF_ACTIONS = [
    { key: 'hug', label: '抱抱', ic: '(つ˵•́ ᴗ•̀˵)つ' },
    { key: 'kiss', label: '亲亲', ic: '(づ￣ ³￣)づ' },
    { key: 'headpat', label: '摸头', ic: '(´･ω･)ﾉ' },
    { key: 'hold_hand', label: '牵手', ic: '(੭˵•̀ᴗ•̀)੭' },
    { key: 'stare', label: '对视', ic: '(｡･ v ･｡)' },
    { key: 'whisper', label: '耳语', ic: '(・ω・)ﾉ' },
    { key: 'lap_pillow', label: '膝枕', ic: '(´ ∀ `)' },
    { key: 'forehead_kiss', label: '额吻', ic: '(˘ ³˘)♡' }
];
function openIntimateFull() {
    const id = getActiveCharId();
    const c = id ? getChar(id) : null;
    if (!c) { uiAlert('请先选择角色'); return; }
    document.getElementById('ifName').textContent = c.name;
    document.getElementById('ifAvatar').innerHTML = charAvatarInner(c);
    const lvl = intimacyLevel(getIntimacy(id));
    document.getElementById('ifHeartLabel').textContent = '♡ Lv.' + lvl.lv;
    document.getElementById('ifReply').textContent = '靠近 ' + c.name + '，做点什么吧 (๑´ᵕ`๑)';
    const box = document.getElementById('ifActions');
    box.innerHTML = IF_ACTIONS.map(a => '<button class="if-act-btn" data-ifact="' + a.key + '"><span class="if-act-ic">' + a.ic + '</span><span>' + a.label + '</span></button>').join('');
    document.getElementById('intimateFull').classList.remove('hidden');
}
function closeIntimateFull() {
    document.getElementById('intimateFull').classList.add('hidden');
    refreshIntimatePanel();
}
on('fullIntimateBtn', 'click', openIntimateFull);
function flyHeart() {
    const box = document.getElementById('ifHearts');
    if (!box) return;
    const h = document.createElement('span');
    h.className = 'fly-heart';
    h.textContent = '♡';
    h.style.left = (35 + Math.random() * 30) + '%';
    box.appendChild(h);
    setTimeout(() => h.remove(), 1400);
}
on('ifActions', 'click', async (e) => {
    const btn = e.target.closest('[data-ifact]');
    if (!btn) return;
    const key = btn.getAttribute('data-ifact');
    const act = INTIMATE_ACTIONS[key];
    const id = getActiveCharId();
    if (!act || !id) return;
    const reply = document.getElementById('ifReply');
    reply.textContent = '(' + act.label + '中...)';
    const av = document.getElementById('ifAvatar');
    if (av) { av.classList.remove('pulse'); void av.offsetWidth; av.classList.add('pulse'); }
    flyHeart(); flyHeart();
    addIntimacy(id, act.pts);
    bumpMood(id, act.pts > 4 ? 5 : 3);
    const lvl = intimacyLevel(getIntimacy(id));
    document.getElementById('ifHeartLabel').textContent = '♡ Lv.' + lvl.lv;
    try {
        const text = await askAI(act.prompt + INTIMATE_STYLE, true, id);
        reply.innerHTML = formatIntimateReply(text);
        reply.scrollTop = 0;
    } catch (error) { reply.textContent = '出错了：' + error.message; }
});

// ---------- 19c. 心动小游戏 ----------
let tdPicked = null;
function gamesCharCheck() {
    const id = getActiveCharId();
    if (!id) { uiAlert('请先创建并选择一个角色'); return null; }
    if (!API_KEY) { uiAlert('这个小游戏需要先在设置里填好 API Key 哦'); return null; }
    return id;
}
async function openTruthDare() {
    const id = gamesCharCheck(); if (!id) return;
    const box = document.getElementById('gamesContent');
    box.innerHTML = '<div class="game-qa"><div class="game-q">抽取中... (｡•̀ᴗ-)✧</div></div>';
    try {
        const text = await callPersona(id, '我们在玩真心话大冒险。请你出一道题给我。输出JSON：{"type":"真心话或大冒险","title":"题目内容"}。题目要暧昧甜蜜、适度亲密、有恋人之间的心动感，但保持温馨不露骨。', 1.0);
        const j = parseJSONLoose(text) || { type: '真心话', title: oneLine(text) };
        box.innerHTML = '<div class="game-qa"><div class="tag">' + escapeHtml(j.type || '真心话') + '</div><div class="game-q" style="margin-top:10px;">' + escapeHtml(j.title || '') + '</div>' +
            '<div class="game-opts"><div class="game-opt" onclick="tdAnswer(true)">我接受，回答TA (๑•̀ㅂ•́)</div><div class="game-opt" onclick="openTruthDare()">换一题</div></div><div class="game-result" id="tdResult" style="display:none;"></div></div>';
        box._td = j;
    } catch (e) { box.innerHTML = '<div class="game-qa"><div class="game-q">出错了：' + escapeHtml(e.message) + '</div></div>'; }
}
async function tdAnswer(accepted) {
    const id = getActiveCharId(); if (!id) return;
    const box = document.getElementById('gamesContent');
    const j = box._td || {};
    const res = document.getElementById('tdResult');
    if (!res) return;
    if (j.type && j.type.indexOf('大冒险') >= 0) {
        const myAnswer = await uiPrompt('完成这个大冒险，描述一下你做了什么：');
        if (myAnswer === null) return;
        res.style.display = 'block';
        res.textContent = 'TA的反应生成中...';
        try {
            const text = await callPersona(id, '我们在玩真心话大冒险。大冒险题目是「' + (j.title || '') + '」。我完成了，我说：' + myAnswer + '。请以角色身份甜蜜地回应。', 1.0);
            res.textContent = text;
            bumpMood(id, 4); addIntimacy(id, 4);
        } catch (e) { res.textContent = '出错了：' + e.message; }
    } else {
        const myAnswer = await uiPrompt('说出你的真心话：');
        if (myAnswer === null) return;
        res.style.display = 'block';
        res.textContent = 'TA在听...';
        try {
            const text = await callPersona(id, '我们在玩真心话。你的问题是「' + (j.title || '') + '」。我的真心话回答是：' + myAnswer + '。请以角色身份甜蜜回应，可以追问或撒娇。', 1.0);
            res.textContent = text;
            bumpMood(id, 4); addIntimacy(id, 4);
        } catch (e) { res.textContent = '出错了：' + e.message; }
    }
}
async function openTacitQuiz() {
    const id = gamesCharCheck(); if (!id) return;
    const box = document.getElementById('gamesContent');
    box.innerHTML = '<div class="game-qa"><div class="game-q">TA在出题... (๑˃̵ᴗ˂̵)</div></div>';
    try {
        const text = await callPersona(id, '我们玩默契问答。出一道关于你（角色）的四选一问题，看我懂不懂你。输出JSON：{"q":"问题","options":["A","B","C","D"],"answer":0,"reason":"正确答案的小说明"}。answer是正确选项的下标(0-3)。', 0.9);
        const j = parseJSONLoose(text);
        if (!j || !Array.isArray(j.options)) throw new Error('题目生成失败，再试一次');
        box._quiz = j;
        box.innerHTML = '<div class="game-qa"><div class="game-q">' + escapeHtml(j.q) + '</div><div class="game-opts">' +
            j.options.map((o, i) => '<div class="game-opt" data-qi="' + i + '" onclick="tacitPick(' + i + ')">' + String.fromCharCode(65 + i) + '. ' + escapeHtml(o) + '</div>').join('') +
            '</div><div class="game-result" id="quizResult" style="display:none;"></div></div>';
    } catch (e) { box.innerHTML = '<div class="game-qa"><div class="game-q">出错了：' + escapeHtml(e.message) + '</div></div>'; }
}
async function tacitPick(i) {
    const id = getActiveCharId(); if (!id) return;
    const box = document.getElementById('gamesContent');
    const j = box._quiz || {};
    document.querySelectorAll('#gamesContent .game-opt').forEach(o => o.classList.remove('picked'));
    const picked = document.querySelector('#gamesContent .game-opt[data-qi="' + i + '"]');
    if (picked) picked.classList.add('picked');
    const correct = i === j.answer;
    const res = document.getElementById('quizResult');
    res.style.display = 'block';
    res.textContent = correct ? '猜对啦，你好懂TA (๑´ᵕ`๑)' : 'TA在偷偷反应...';
    try {
        const text = await callPersona(id, '默契问答。问题「' + j.q + '」，正确答案是「' + (j.options[j.answer] || '') + '」。我选了「' + (j.options[i] || '') + '」，' + (correct ? '我答对了' : '我答错了') + '。请以角色身份甜蜜回应我这次的默契程度。', 1.0);
        res.textContent = (correct ? '✓ 答对啦！\n' : '✗ 差一点～\n') + text;
        bumpMood(id, correct ? 5 : 2); addIntimacy(id, correct ? 5 : 2);
    } catch (e) { res.textContent = '出错了：' + e.message; }
}

// ---------- 19d. 全屏来电 / 通话 ----------
let callState = { type: null, charId: null, timer: null, seconds: 0, muted: false };
function startCall(type) {
    const id = getActiveCharId();
    const c = id ? getChar(id) : null;
    if (!c) { uiAlert('请先选择一个角色'); return; }
    closeAttachPanel();
    callState = { type: type, charId: id, timer: null, seconds: 0, muted: false };
    document.getElementById('callAvatar').innerHTML = charAvatarInner(c);
    document.getElementById('callName').textContent = c.name;
    document.getElementById('callStatus').textContent = (type === 'video' ? '视频通话' : '语音通话') + ' · 正在呼叫...';
    document.getElementById('callCaption').textContent = '';
    document.getElementById('callIncoming').classList.remove('hidden');
    document.getElementById('callInProgress').classList.add('hidden');
    document.getElementById('callScreen').classList.remove('hidden');
    // TA在几秒后"接听"
    callState.answerTimer = setTimeout(() => { if (!document.getElementById('callScreen').classList.contains('hidden')) acceptCall(); }, 2500);
}
async function acceptCall() {
    clearTimeout(callState.answerTimer);
    document.getElementById('callIncoming').classList.add('hidden');
    document.getElementById('callInProgress').classList.remove('hidden');
    document.getElementById('callStatus').textContent = '00:00';
    callState.seconds = 0;
    callState.timer = setInterval(() => {
        callState.seconds++;
        const m = String(Math.floor(callState.seconds / 60)).padStart(2, '0');
        const s = String(callState.seconds % 60).padStart(2, '0');
        const st = document.getElementById('callStatus');
        if (st) st.textContent = m + ':' + s;
    }, 1000);
    callSpeak('（接起电话）');
}
async function callSpeak(preset) {
    const id = callState.charId;
    if (!id || !API_KEY) { document.getElementById('callCaption').textContent = '（通话中...）'; return; }
    const cap = document.getElementById('callCaption');
    let myLine = preset;
    if (!preset) { myLine = await uiPrompt('对TA说点什么：'); if (myLine === null) return; }
    cap.textContent = '......';
    try {
        const text = await callPersona(id, '我们正在' + (callState.type === 'video' ? '视频' : '语音') + '通话。我说：' + (myLine || '（刚接通，还没说话）') + '\n请用口语化、亲密的方式回应我，就像真的在打电话。只输出你说的话。', 1.0);
        cap.textContent = text;
    } catch (e) { cap.textContent = '（信号好像不太好...）'; }
}
function toggleMute() {
    callState.muted = !callState.muted;
    const ic = document.getElementById('muteIcon');
    if (ic) ic.textContent = callState.muted ? '(-_-)' : '(・ω・)';
}
function endCall() {
    clearTimeout(callState.answerTimer);
    clearInterval(callState.timer);
    const secs = callState.seconds;
    const id = callState.charId;
    document.getElementById('callScreen').classList.add('hidden');
    if (id && secs > 0) {
        const m = String(Math.floor(secs / 60)).padStart(2, '0');
        const s = String(secs % 60).padStart(2, '0');
        if (currentChatCharId === id) appendSystemMessage('通话时长 ' + m + ':' + s);
        bumpMood(id, 5);
    }
}

// ---------- 20. 角色卡 ----------
const cardFields = ['Name','Age','Gender','Role','Birthday','Height','Hair','Eyes','Clothing','Personality','SpeechStyle','Quirks','Likes','Dislikes','Hobbies','Backstory','HowMet','CallMe','Attitude','Extra'];
function fillCardForm(card, worldIds) { cardFields.forEach(f => { const el = document.getElementById('card' + f); if (el) el.value = (card && card[f]) || ''; }); renderCardWorlds(worldIds || []); if (window.CardImport) CardImport.show(card); }
function loadCharacterCard() {
    const editingId = store.getItem('editingCharId');
    const c = editingId ? getChar(editingId) : null;
    fillCardForm(c ? c.card : null, c ? c.worldIds : null);
}
on('saveCharacterBtn', 'click', () => {
    const data = {};
    cardFields.forEach(f => { const el = document.getElementById('card' + f); if (el) data[f] = el.value.trim(); });
    const ci = window.CardImport ? CardImport.collect() : null;
    if (ci) { data.sections = ci.sections; if (!data.Name) data.Name = ci.name; if (!data.Gender && ci.gender) data.Gender = ci.gender; if (!data.Name) { const st0 = document.getElementById('characterStatus'); if (st0) { st0.textContent = '请给角色起个名字（在导入页最上面的名字框）'; st0.style.color = 'red'; } switchCardPane('import'); return; } }
    const editingId = store.getItem('editingCharId');
    const characters = getChars();
    let savedId = editingId;
    const existing = editingId ? characters.find(c => c.id === editingId) : null;
    if (existing) { existing.card = data; existing.name = data.Name || existing.name; existing.worldIds = chipVals('cardWorlds'); }
    else {
        savedId = 'char_' + Date.now();
        characters.push({ id: savedId, name: data.Name || '新角色', avatar: DEFAULT_KAO, avatarData: pendingCharAvatar || null, card: data, worldIds: chipVals('cardWorlds'), chatHistory: [], moments: [] });
    }
    if (!saveChars(characters)) return;
    pendingCharAvatar = null;
    store.removeItem('editingCharId');
    if (!store.getItem('activeCharId')) setActiveCharId(savedId);
    const st = document.getElementById('characterStatus');
    if (st) { st.textContent = '角色卡已保存！'; setTimeout(() => st.textContent = '', 3000); }
    if (currentChatCharId === savedId) { const t = document.getElementById('chatTitle'); const c = characters.find(x => x.id === savedId); if (t && c) t.textContent = c.name; }
    fillCardForm(null);
    refreshCharAvatarDisplay();
    refreshAllCharViews();
});
on('newCharacterBtn', 'click', () => {
    store.removeItem('editingCharId');
    pendingCharAvatar = null;
    fillCardForm(null);
    refreshCharAvatarDisplay();
    openApp('character');
});
function editCharacter(id) {
    const char = getChar(id);
    if (!char) return;
    store.setItem('editingCharId', id);
    pendingCharAvatar = null;
    fillCardForm(char.card, char.worldIds);
    refreshCharAvatarDisplay();
    openApp('character');
}

// ---------- 21. 设置 ----------
on('saveApiBtn', 'click', () => {
    const url = document.getElementById('inputApiUrl').value.trim();
    const key = document.getElementById('inputApiKey').value.trim();
    const model = document.getElementById('inputModel').value.trim();
    const status = document.getElementById('apiStatus');
    if (!key) { status.textContent = '请填写 API Key！'; status.style.color = 'red'; return; }
    store.setItem('customApiUrl', url || "https://api.deepseek.com/chat/completions");
    store.setItem('customApiKey', key);
    store.setItem('customModel', model || "deepseek-chat");
    API_URL = url || "https://api.deepseek.com/chat/completions";
    API_KEY = key; API_MODEL = model || "deepseek-chat";
    status.textContent = '保存成功！'; status.style.color = 'green';
});
on('testApiBtn', 'click', async () => {
    const status = document.getElementById('apiStatus');
    status.textContent = '正在测试...'; status.style.color = '#ff9800';
    try { const reply = await askAI("你好", false); status.textContent = '连接成功！回复：' + reply; status.style.color = 'green'; }
    catch (error) { status.textContent = '连接失败：' + error.message; status.style.color = 'red'; }
});
(function() {
    const u = document.getElementById('inputApiUrl'), k = document.getElementById('inputApiKey'), m = document.getElementById('inputModel');
    if (u) u.value = store.getItem('customApiUrl') || "";
    if (k) k.value = store.getItem('customApiKey') || "";
    if (m) m.value = store.getItem('customModel') || "deepseek-chat";
})();

// ---------- 22. 主动消息 ----------
const proactiveToggle = document.getElementById('proactiveToggle');
const proactiveInterval = document.getElementById('proactiveInterval');
const proactiveRandom = document.getElementById('proactiveRandom');
let proactiveTimer = null;
if (proactiveToggle) {
    proactiveToggle.checked = store.getItem('proactiveEnabled') === 'true';
    if (proactiveInterval) proactiveInterval.value = store.getItem('proactiveInterval') || '3';
    if (proactiveRandom) proactiveRandom.checked = store.getItem('proactiveRandom') === 'true';
    proactiveToggle.addEventListener('change', () => { store.setItem('proactiveEnabled', proactiveToggle.checked); if (proactiveToggle.checked) startProactiveTimer(); else stopProactiveTimer(); });
    if (proactiveInterval) proactiveInterval.addEventListener('change', () => { store.setItem('proactiveInterval', proactiveInterval.value); if (proactiveToggle.checked) { stopProactiveTimer(); startProactiveTimer(); } });
    if (proactiveRandom) proactiveRandom.addEventListener('change', () => { store.setItem('proactiveRandom', proactiveRandom.checked); if (proactiveToggle.checked) { stopProactiveTimer(); startProactiveTimer(); } });
}
function startProactiveTimer() {
    if (proactiveTimer) return;
    const base = (parseInt((proactiveInterval && proactiveInterval.value) || '3') || 3) * 60000;
    let interval = base;
    if (proactiveRandom && proactiveRandom.checked) interval = base * 0.5 + Math.random() * base;
    proactiveTimer = setInterval(async () => {
        const charId = currentChatCharId || getActiveCharId();
        if (!charId) return;
        { const pc = getChar(charId); if (pc && pc.blocked) return; }
        try {
            const reply = await askAI("请你主动给我发一条消息。内容简短自然。直接输出。", true, charId);
            pushHistory(charId, { role: "assistant", content: reply });
            const roomEl = document.getElementById('chatRoomApp');
            if (roomEl && !roomEl.classList.contains('hidden') && currentChatCharId === charId) {
                appendMessage(reply, 'ai-message', currentAiAvatarHTML());
            } else {
                const lockNotify = document.getElementById('lockNotification');
                const lockText = document.getElementById('lockNotifyText');
                if (lockNotify && lockText && !(getChar(charId) || {}).mute) { const c = getChar(charId); lockText.textContent = (c ? c.name + '：' : '') + reply; lockNotify.classList.remove('hidden'); }
            }
        } catch (error) { console.log('主动消息出错:', error.message); }
    }, interval);
}
function stopProactiveTimer() { if (proactiveTimer) { clearInterval(proactiveTimer); proactiveTimer = null; } }
if (store.getItem('proactiveEnabled') === 'true') startProactiveTimer();

// ---------- 23. 聊天附件（表情包） ----------
const attachBtn = document.getElementById('attachBtn');
const attachPanel = document.getElementById('attachPanel');
if (attachBtn && attachPanel) attachBtn.addEventListener('click', () => attachPanel.classList.toggle('hidden'));
on('emojiInput', 'change', (e) => { const f = e.target.files[0]; e.target.value = ''; if (f) sendImageMessage(f, 'emoji'); });
async function clearChatHistory() {
    if (!currentChatCharId) return;
    if (!(await uiConfirm('确定清空聊天记录吗？'))) return;
    const chars = getChars(); const c = chars.find(x => x.id === currentChatCharId);
    if (c) { c.chatHistory = []; saveChars(chars); }
    chatHistory = []; document.getElementById('chatBox').innerHTML = '';
    renderChatList(); uiAlert('已清空！');
}
async function blockFriend() {
    const chars = getChars(); const c = chars.find(x => x.id === currentChatCharId); if (!c) return;
    if (c.blocked) {
        c.blocked = false; saveChars(chars); uiAlert('已移出黑名单，可以继续聊天啦');
    } else {
        if (!(await uiConfirm('拉黑「' + c.name + '」后，你将无法给TA发消息，TA也不会再主动找你。可以随时移出黑名单。', { ok: '拉黑' }))) return;
        c.blocked = true; saveChars(chars); uiAlert('已加入黑名单');
    }
    const bl = document.getElementById('blockCellText'); if (bl) bl.textContent = c.blocked ? '移出黑名单' : '加入黑名单';
    renderChatList(); renderContacts();
}
on('muteSingle', 'change', (e) => { const chars = getChars(); const c = chars.find(x => x.id === currentChatCharId); if (!c) return; c.mute = e.target.checked; saveChars(chars); renderChatList(); });
on('muteGroup', 'change', (e) => { const gs = getGroups(); const g = gs.find(x => x.id === currentGroupId); if (!g) return; g.mute = e.target.checked; saveGroups(gs); renderChatList(); });

// ---------- 查找聊天内容 ----------
const SEARCH_HINT = '<p class="hint-line" style="text-align:center;margin-top:30px;">输入关键词，搜索这个聊天里的文字</p>';
function openChatSearch() {
    openApp('chatSearch');
    const inp = document.getElementById('chatSearchInput'); if (inp) { inp.value = ''; setTimeout(() => inp.focus(), 80); }
    document.getElementById('chatSearchList').innerHTML = SEARCH_HINT;
}
function chatSearchSource() {
    if (currentGroupId) { const g = getGroup(currentGroupId); return g ? (g.chatHistory || []) : []; }
    const c = getChar(currentChatCharId); return c ? (c.chatHistory || []) : [];
}
function runChatSearch(q) {
    const box = document.getElementById('chatSearchList'); q = (q || '').trim();
    if (!q) { box.innerHTML = SEARCH_HINT; return; }
    const lq = q.toLowerCase(), hits = [];
    const meName = store.getItem('myName') || '我', c = getChar(currentChatCharId);
    chatSearchSource().forEach((m, i) => {
        if (m.role !== 'user' && m.role !== 'assistant') return;
        const txt = String(m.content == null ? '' : m.content).replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
        const p = txt.toLowerCase().indexOf(lq); if (p < 0) return;
        const a = Math.max(0, p - 14), b = Math.min(txt.length, p + q.length + 24);
        hits.push({ i: i, who: m.role === 'user' ? meName : (m.speaker || (c ? c.name : 'TA')), ts: m.ts || 0, pre: (a > 0 ? '…' : '') + txt.slice(a, p), mid: txt.slice(p, p + q.length), post: txt.slice(p + q.length, b) + (b < txt.length ? '…' : '') });
    });
    if (!hits.length) { box.innerHTML = '<p class="hint-line" style="text-align:center;margin-top:30px;">没有找到「' + escapeHtml(q) + '」</p>'; return; }
    box.innerHTML = '<p class="hint-line">共 ' + hits.length + ' 条</p>' + hits.reverse().slice(0, 200).map(h => '<div class="search-hit" data-i="' + h.i + '"><div class="sh-top"><span>' + escapeHtml(h.who) + '</span><span>' + (h.ts ? formatChatTime(h.ts) : '') + '</span></div><div class="sh-txt">' + escapeHtml(h.pre) + '<mark>' + escapeHtml(h.mid) + '</mark>' + escapeHtml(h.post) + '</div></div>').join('');
}
on('chatSearchInput', 'input', (e) => runChatSearch(e.target.value));
on('chatSearchList', 'click', (e) => {
    const h = e.target.closest('.search-hit'); if (!h) return;
    const idx = h.getAttribute('data-i');
    openApp('chatRoom');
    setTimeout(() => {
        const el = document.querySelector('#chatBox [data-idx="' + idx + '"]'); if (!el) return;
        el.scrollIntoView({ block: 'center' }); el.classList.add('flash-hit'); setTimeout(() => el.classList.remove('flash-hit'), 1800);
    }, 60);
});
async function deleteFriend() {
    if (!currentChatCharId) return;
    if (!(await uiConfirm('确定删除TA吗？'))) return;
    const delId = currentChatCharId;
    let characters = getChars().filter(c => c.id !== delId);
    saveChars(characters);
    removeCharFromGroups(delId);
    if (store.getItem('activeCharId') === delId) store.removeItem('activeCharId');
    currentChatCharId = null; chatHistory = [];
    document.getElementById('chatBox').innerHTML = '';
    refreshAllCharViews(); openApp('chat');
}

// ---------- 24. 群聊 ----------
function getGroups() { try { return JSON.parse(store.getItem('groups') || '[]'); } catch (e) { return []; } }
function saveGroups(arr) { try { store.setItem('groups', JSON.stringify(arr)); return true; } catch (e) { uiAlert('保存失败'); return false; } }
function getGroup(id) { return getGroups().find(g => g.id === id) || null; }
function groupMembersOf(g) { const cs = getChars(); return (g.members || []).map(id => cs.find(c => c.id === id)).filter(Boolean); }
function groupDisplayName(g) { if (g.name) return g.name; return groupMembersOf(g).slice(0, 3).map(m => m.name).join('、') || '群聊'; }
function groupAvatarCells(g) {
    const ms = groupMembersOf(g).slice(0, 4);
    const cells = ms.map(c => '<span class="ga-cell">' + (c.avatarData ? avatarInner(c.avatarData) : escapeHtml((c.name || '?').slice(0, 1))) + '</span>').join('');
    return { cls: 'n' + Math.max(1, ms.length), cells };
}
function groupAvatarBox(g, style) { const a = groupAvatarCells(g); return '<span class="avatar-small group-avatar ' + a.cls + '" style="' + (style || '') + '">' + a.cells + '</span>'; }
function pushGroupHistory(gid, msg) {
    const gs = getGroups(); const g = gs.find(x => x.id === gid);
    if (!g) return; g.chatHistory = g.chatHistory || []; msg.ts = msg.ts || Date.now();
    if (msg.read === undefined && (msg.role === 'user' || msg.role === 'assistant')) msg.read = msg.role === 'user' ? false : (gid === currentGroupId && chatRoomOpen());
    g.chatHistory.push(msg); saveGroups(gs); renderChatList();
}
function removeCharFromGroups(charId) {
    let gs = getGroups(); gs.forEach(g => { g.members = (g.members || []).filter(m => m !== charId); });
    gs = gs.filter(g => g.members.length > 0); saveGroups(gs);
    if (currentGroupId && !gs.find(g => g.id === currentGroupId)) currentGroupId = null;
}
function openGroupChat(gid) {
    const g = getGroup(gid); if (!g) return;
    currentGroupId = gid; currentChatCharId = null; chatHistory = [];
    if (window.ChatX) ChatX.clearQuote();
    const members = groupMembersOf(g);
    document.getElementById('chatTitle').textContent = groupDisplayName(g) + '(' + (members.length + 1) + ')';
    const box = document.getElementById('chatAvatar');
    if (box) { const a = groupAvatarCells(g); box.className = 'avatar-small group-avatar ' + a.cls; box.innerHTML = a.cells; }
    refreshGroupNotice(g);
    const pb = document.getElementById('proactiveBtn'); if (pb) pb.textContent = '群友冒泡';
    renderChatMessages(); applyChatBg();
    openApp('chatRoom'); scrollChatToBottom();
    settleUnread(gid, true);
}
function refreshGroupNotice(g) {
    const n = document.getElementById('groupNotice');
    if (!n) return;
    if (g && g.notice) { n.textContent = '群公告：' + g.notice; n.classList.remove('hidden'); } else n.classList.add('hidden');
}
async function sendGroupMessage(text) {
    const gid = currentGroupId; const input = document.getElementById('userInput');
    const uel = appendMessage(text, 'user-message'); input.value = '';
    pushGroupHistory(gid, { role: 'user', content: text });
    if (uel) uel.dataset.idx = (getGroup(gid).chatHistory || []).length - 1;
    await groupReply(gid, null);
}
function charProfileText(c) {
    const card = c.card || {};
    const parts = [];
    [['Personality','性格'],['SpeechStyle','说话习惯'],['Likes','喜欢'],['Dislikes','讨厌'],['Attitude','对用户态度']].forEach(([k,l]) => { if (card[k]) parts.push(l + '：' + card[k]); });
    if (!parts.length && card.sections && card.sections.length) return card.sections.map(x => (x.t ? x.t + '：' : '') + x.v).join('；').slice(0, 600);
    return parts.join('；') || '（暂无设定）';
}
async function askGroup(gid, nudge) {
    if (!API_KEY) throw new Error('请先填入API Key');
    const g = getGroup(gid); if (!g) throw new Error('群聊不存在');
    const members = groupMembersOf(g); if (!members.length) throw new Error('群里没有成员');
    const myName = store.getItem('myName') || '我';
    let sys = '微信群聊《' + groupDisplayName(g) + '》。群成员：\n' + members.map(m => '- ' + m.name + '：' + charProfileText(m)).join('\n');
    const gw = (g.worldIds && g.worldIds.length) ? g.worldIds : Array.from(new Set([].concat.apply([], members.map(worldIdsOfChar))));
    const gwt = worldPromptFor(gw, (g.chatHistory || []).slice(-6).map(m => String(m.content)).join('\n'));
    if (gwt) sys += '\n\n【世界书设定】：\n' + gwt;
    sys += '\n\n【当前时间】' + timeContext() + gapText(g.chatHistory) + '\n' + TIME_RULE;
    sys += '\n\n输出规则：1~3位成员回复，每位1~2句，用颜文字不用emoji。格式：成员名：内容。不要替用户说话。';
    const hist = (g.chatHistory || []).filter(m => m.role === 'user' || m.role === 'assistant').slice(-30).map(m =>
        m.role === 'user' ? { role: 'user', content: String(m.content) } : { role: 'assistant', content: (m.speaker || '') + '：' + m.content });
    const messages = [{ role: 'system', content: sys }].concat(hist);
    if (nudge) messages.push({ role: 'user', content: nudge });
    const response = await fetch(API_URL, { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + API_KEY }, body: JSON.stringify({ model: API_MODEL, messages, stream: false }) });
    if (!response.ok) throw new Error('请求失败: ' + response.status);
    const data = await response.json();
    return parseGroupReply(data.choices[0].message.content, members);
}
function parseGroupReply(text, members) {
    const out = [];
    const find = (name) => { name = name.trim(); return members.find(m => m.name === name) || members.find(m => name.indexOf(m.name) >= 0); };
    String(text).split(/\n+/).forEach(line => {
        line = line.trim(); if (!line) return;
        const m = /^[【\[\(（*]*([^：:】\]\)）*\n]{1,16})[】\]\)）*]*\s*[:：]\s*(.+)$/.exec(line);
        const mem = m ? find(m[1]) : null;
        if (mem) out.push({ charId: mem.id, name: mem.name, text: m[2].trim() });
        else if (out.length) out[out.length - 1].text += '\n' + line;
    });
    if (!out.length) out.push({ charId: members[0].id, name: members[0].name, text: String(text).trim() });
    return out.slice(0, 4);
}
async function groupReply(gid, nudge) {
    setTimeout(() => markUserRead(gid, true), 700);
    const typing = appendSystemMessage('群成员正在输入...');
    try {
        const lines = await askGroup(gid, nudge);
        if (typing) typing.remove();
        const g = getGroup(gid); const byId = {}; groupMembersOf(g).forEach(m => { byId[m.id] = m; });
        for (const l of lines) {
            if (window.ChatX) { l.text = ChatX.stripActions(l.text).trim(); if (!l.text) continue; }
            pushGroupHistory(gid, { role: 'assistant', speakerId: l.charId, speaker: l.name, content: l.text });
            if (currentGroupId === gid) { const gel = appendMessage(l.text, 'ai-message', byId[l.charId] ? charAvatarInner(byId[l.charId]) : escapeHtml(AI_KAO), false, l.name); if (gel) gel.dataset.idx = (getGroup(gid).chatHistory || []).length - 1; await sleep(450 + Math.min(1400, l.text.length * 35)); }
        }
    } catch (error) { if (typing) typing.remove(); if (currentGroupId === gid) appendSystemMessage('出错了：' + error.message); }
}
function openGroupPick(mode, gid) {
    groupPickMode = mode; groupPickTargetId = gid || null;
    const chars = getChars(); let candidates = chars;
    if (mode === 'add') { const g = getGroup(gid); candidates = chars.filter(c => (g ? g.members : []).indexOf(c.id) < 0); }
    document.getElementById('groupPickTitle').textContent = mode === 'add' ? '添加群成员' : '发起群聊';
    document.getElementById('groupPickHint').textContent = mode === 'add' ? '选择要拉进群的角色' : '选择群成员（至少2位）';
    document.getElementById('groupNameRow').classList.toggle('hidden', mode === 'add');
    document.getElementById('groupNameInput').value = '';
    const list = document.getElementById('groupPickList');
    if (!candidates.length) { list.innerHTML = '<p style="padding:16px;color:#999;">' + (mode === 'add' ? '所有角色都在群里了~' : '还没有角色') + '</p>'; }
    else { list.innerHTML = candidates.map(c => '<label class="pick-row"><input type="checkbox" value="' + escapeHtml(c.id) + '"><span class="pick-dot">✓</span><span class="avatar-small">' + charAvatarInner(c) + '</span><span class="pick-name">' + escapeHtml(c.name) + '</span></label>').join(''); }
    openApp('groupPick');
}
function groupPickBack() { if (groupPickMode === 'add' && groupPickTargetId) { renderGroupDetail(); openApp('groupDetail'); } else openApp('chat'); }
on('groupPickConfirmBtn', 'click', () => {
    const ids = Array.prototype.map.call(document.querySelectorAll('#groupPickList input:checked'), i => i.value);
    const chars = getChars(); const nameOf = (id) => { const c = chars.find(x => x.id === id); return c ? c.name : ''; };
    if (groupPickMode === 'create') {
        if (ids.length < 2) { uiAlert('至少选2位角色'); return; }
        const gs = getGroups(); const gid = 'group_' + Date.now();
        gs.push({ id: gid, name: document.getElementById('groupNameInput').value.trim(), members: ids, notice: '', pinned: false, created: Date.now(), chatHistory: [{ role: 'system', content: '你邀请了 ' + ids.map(nameOf).join('、') + ' 加入了群聊', ts: Date.now() }] });
        if (!saveGroups(gs)) return;
        renderChatList(); renderContacts(); openGroupChat(gid);
    } else {
        if (!ids.length) { uiAlert('请选择角色'); return; }
        const gs = getGroups(); const g = gs.find(x => x.id === groupPickTargetId); if (!g) return;
        ids.forEach(id => { if (g.members.indexOf(id) < 0) g.members.push(id); });
        g.chatHistory = g.chatHistory || []; g.chatHistory.push({ role: 'system', content: '你邀请了 ' + ids.map(nameOf).join('、') + ' 加入了群聊', ts: Date.now() });
        if (!saveGroups(gs)) return;
        renderChatList(); renderContacts(); renderGroupDetail(); openApp('groupDetail');
    }
});
function openGroupDetail() { removeMode = false; renderGroupDetail(); openApp('groupDetail'); }
function renderGroupDetail() {
    const g = getGroup(currentGroupId); if (!g) { openApp('chat'); return; }
    const members = groupMembersOf(g);
    document.getElementById('groupDetailTitle').textContent = '聊天信息(' + (members.length + 1) + ')';
    let html = '<div class="member-item"><span class="avatar-small" style="width:48px;height:48px;">' + myAvatarInner() + '</span><span class="m-name">' + escapeHtml(store.getItem('myName') || '我') + '</span><span class="owner-tag">群主</span></div>';
    html += members.map(m => '<div class="member-item">' + (removeMode ? '<span class="member-del" data-rm="' + escapeHtml(m.id) + '">-</span>' : '') + '<span class="avatar-small" style="width:48px;height:48px;">' + charAvatarInner(m) + '</span><span class="m-name">' + escapeHtml(m.name) + '</span></div>').join('');
    html += '<div class="member-item"><div class="member-tool" data-act="add">+</div></div>';
    if (members.length > 1) html += '<div class="member-item"><div class="member-tool" data-act="toggle">' + (removeMode ? '✓' : '-') + '</div></div>';
    document.getElementById('groupMembers').innerHTML = html;
    document.getElementById('groupNameText').textContent = groupDisplayName(g);
    document.getElementById('groupNoticeText').textContent = g.notice || '未设置';
    const gwEl = document.getElementById('groupWorldText');
    if (gwEl) { const ids = g.worldIds || []; gwEl.textContent = ids.length ? ids.map(i => { const w = getWorld(i); return w ? w.name : ''; }).filter(Boolean).join('、') : '跟随成员'; }
    document.getElementById('pinGroup').checked = !!g.pinned;
    { const mg = document.getElementById('muteGroup'); if (mg) mg.checked = !!g.mute; }
}
on('groupMembers', 'click', (e) => {
    const rm = e.target.closest('[data-rm]');
    if (rm) { removeMember(rm.getAttribute('data-rm')); return; }
    const act = e.target.closest('[data-act]');
    if (!act) return;
    if (act.getAttribute('data-act') === 'add') openGroupPick('add', currentGroupId);
    else { removeMode = !removeMode; renderGroupDetail(); }
});
on('pinGroup', 'change', (e) => { const gs = getGroups(); const g = gs.find(x => x.id === currentGroupId); if (!g) return; g.pinned = e.target.checked; saveGroups(gs); renderChatList(); });
async function removeMember(charId) {
    const gs = getGroups(); const g = gs.find(x => x.id === currentGroupId); if (!g) return;
    if (g.members.length <= 1) { uiAlert('至少保留1位角色'); return; }
    const c = getChar(charId); if (!(await uiConfirm('确定移出「' + (c ? c.name : 'TA') + '」吗？'))) return;
    g.members = g.members.filter(id => id !== charId);
    g.chatHistory = g.chatHistory || []; g.chatHistory.push({ role: 'system', content: '你将 ' + (c ? c.name : 'TA') + ' 移出了群聊', ts: Date.now() });
    saveGroups(gs); if (g.members.length <= 1) removeMode = false;
    renderChatList(); renderContacts(); renderGroupDetail();
}
async function renameGroup() {
    const gs = getGroups(); const g = gs.find(x => x.id === currentGroupId); if (!g) return;
    const v = await uiPrompt('修改群名：', groupDisplayName(g)); if (v === null) return;
    g.name = v.trim(); saveGroups(gs); renderChatList(); renderContacts(); renderGroupDetail();
}
async function editAnnouncement() {
    const gs = getGroups(); const g = gs.find(x => x.id === currentGroupId); if (!g) return;
    const v = await uiPrompt('编辑群公告：', g.notice || ''); if (v === null) return;
    g.notice = v.trim(); saveGroups(gs); renderGroupDetail();
}
async function clearGroupHistory() {
    if (!(await uiConfirm('确定清空聊天记录？'))) return;
    const gs = getGroups(); const g = gs.find(x => x.id === currentGroupId); if (!g) return;
    g.chatHistory = []; saveGroups(gs); renderChatList(); uiAlert('已清空！');
}
async function dissolveGroup() {
    const g = getGroup(currentGroupId); if (!g) return;
    if (!(await uiConfirm('确定解散群聊吗？'))) return;
    saveGroups(getGroups().filter(x => x.id !== currentGroupId));
    currentGroupId = null; document.getElementById('chatBox').innerHTML = '';
    renderChatList(); renderContacts(); uiAlert('群聊已解散'); openApp('chat');
}

// ---------- 25. MCP / 心情 / 记忆 系统 ----------
const $ = (id) => document.getElementById(id);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const pad2 = (n) => String(n).padStart(2, '0');

function timeSlot(d) {
    d = d || new Date(); const h = d.getHours();
    if (h >= 5 && h < 7) return { label: '清晨', hint: '刚醒' };
    if (h >= 7 && h < 9) return { label: '早高峰', hint: '通勤中' };
    if (h >= 9 && h < 12) return { label: '上午', hint: '忙碌中' };
    if (h >= 12 && h < 14) return { label: '中午', hint: '午饭时间' };
    if (h >= 14 && h < 18) return { label: '下午', hint: '继续忙碌' };
    if (h >= 18 && h < 20) return { label: '傍晚', hint: '回家路上' };
    if (h >= 20 && h < 23) return { label: '晚上', hint: '放松时间' };
    if (h >= 23 || h < 1) return { label: '夜里', hint: '准备睡觉' };
    return { label: '深夜', hint: '可能失眠' };
}
function timeContext(d) {
    d = d || new Date();
    const wd = ['周日','周一','周二','周三','周四','周五','周六'][d.getDay()];
    const s = timeSlot(d);
    return d.getFullYear() + '年' + (d.getMonth()+1) + '月' + d.getDate() + '日 ' + wd + ' ' + pad2(d.getHours()) + ':' + pad2(d.getMinutes()) + ' ' + s.label;
}
function todayStr() { const d = new Date(); return d.getFullYear() + '-' + pad2(d.getMonth()+1) + '-' + pad2(d.getDate()); }
function getMood(c) { const base = (typeof c.mood === 'number') ? c.mood : 60; const since = c.moodTs || lastUserTs(c) || Date.now(); const hrs = (Date.now() - since) / 36e5; return clamp(base - Math.max(0, hrs - 2) * 1.5, 0, 100); }
function bumpMood(charId, delta) { const chars = getChars(); const c = chars.find(x => x.id === charId); if (!c) return; c.mood = clamp(getMood(c) + delta, 0, 100); c.moodTs = Date.now(); saveChars(chars); updateMoodUI(); }
function moodLabel(v) { return v >= 80 ? '开心' : v >= 55 ? '平静' : v >= 30 ? '有点蔫' : '失落'; }
function moodTone(v) {
    if (v >= 80) return '你现在心情很好，说话更软更主动。';
    if (v >= 55) return '情绪平稳，按平时样子说话。';
    if (v >= 30) return '有点蔫，话变少，偶尔带小委屈。';
    return '很失落，觉得被冷落了。';
}
function updateMoodUI() {
    const id = getActiveCharId(); const c = id ? getChar(id) : null;
    const fill = $('mcpMoodFill'), txt = $('mcpMoodText');
    if (fill && txt) {
        if (!c) { fill.style.width = '0%'; txt.textContent = ''; }
        else { const v = getMood(c); fill.style.width = Math.round(v) + '%'; fill.style.background = v >= 55 ? 'linear-gradient(90deg, var(--theme-color), #fb6f92)' : 'linear-gradient(90deg, #b8b8c4, #8e8e9c)'; txt.textContent = '心情 ' + Math.round(v) + ' · ' + moodLabel(v); }
    }
    const pill = $('chatMoodPill');
    if (pill) { const cc = currentChatCharId ? getChar(currentChatCharId) : null; if (cc && !currentGroupId) { pill.textContent = moodLabel(getMood(cc)); pill.classList.remove('hidden'); } else pill.classList.add('hidden'); }
}
function lastUserTs(c) { const h = c.chatHistory || []; for (let i = h.length - 1; i >= 0; i--) if (h[i].role === 'user' && h[i].ts) return h[i].ts; return c.lastChatTs || 0; }
function agoText(ts) { const m = Math.max(0, Math.round((Date.now() - ts) / 60000)); if (m < 1) return '刚刚'; if (m < 60) return m + '分钟前'; if (m < 1440) return Math.round(m / 60) + '小时前'; return Math.round(m / 1440) + '天前'; }
function logActivity(charId, type, text) { const chars = getChars(); const c = chars.find(x => x.id === charId); if (!c) return; c.activity = c.activity || []; c.activity.unshift({ type, text, ts: Date.now() }); c.activity = c.activity.slice(0, 12); saveChars(chars); }
function recentActivityText(c) { return (c.activity || []).filter(a => Date.now() - a.ts < 48 * 36e5).slice(0, 5).map(a => '- ' + agoText(a.ts) + '：' + a.text).join('\n'); }
const TIME_RULE = '【时间规则】上面是设备的真实系统时间，一切以它为准。你没有钟表，只能依据它来感知时间；谈到早晚、饭点、睡觉、星期几、「今天/明天/昨天」时必须符合此刻真实时间。' +
    '时间会流逝：几分钟内的事才说「刚刚」；隔了几小时要说「下午/刚才」；隔夜要说「昨晚/今早」；隔了几天要说「好几天没找我了」；已经过去的时间不要说成还没到（例如已经是晚上，就不要说「等会儿吃午饭」）；做某件事需要的时间也要合理（刚说出门就不可能马上到）。' +
    '历史对话里用户消息开头括号里的时间是系统标注的真实发送时间，用来判断先后和间隔，你自己的回复里不要出现这种括号时间标注。' +
    '如果我说的时间（比如「现在凌晨三点」「我刚下班」）和系统时间明显对不上，不要照单全收，可以自然地疑惑、调侃或追问一下。不要把这些规则说出来。';
function timeSenseText(c) {
    const now = new Date(), h = now.getHours(), day = now.getDay(), parts = [];
    try {
        const L = lifeOf(c), t = L.days.find(x => /在一起/.test(x.name));
        if (t) parts.push('你们在一起的第 ' + Math.max(1, Math.round((Date.now() - new Date(t.date + 'T00:00:00').getTime()) / 864e5) + 1) + ' 天');
        else if (c.createdTs) parts.push('你们相识已经 ' + Math.max(1, Math.round((Date.now() - c.createdTs) / 864e5)) + ' 天');
    } catch (e) {}
    parts.push((day === 0 || day === 6) ? '今天是周末' : '今天是工作日');
    if (h >= 0 && h < 5) parts.push('现在是深夜/凌晨，一般人这时候早该睡了；如果我还醒着，可以心疼、催我睡或好奇我为什么没睡');
    else if (h >= 5 && h < 7) parts.push('现在天刚亮，很早');
    const hist = c.chatHistory || [], t0 = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const todayMsgs = hist.filter(m => m.ts && m.ts >= t0 && m.ts < Date.now() - 15000);
    if (!todayMsgs.length && hist.length) parts.push('这是我今天第一次来找你');
    return '\n【时间感】' + parts.join('；');
}
function gapText(hist) {
    const now = Date.now(); let prev = 0;
    for (let i = (hist || []).length - 1; i >= 0; i--) { const ts = hist[i].ts; if (ts && now - ts > 15000) { prev = ts; break; } }
    if (!prev) return '';
    const m = Math.round((now - prev) / 60000);
    if (m < 3) return '';
    const txt = m < 60 ? m + '分钟' : m < 1440 ? (Math.round(m / 6) / 10) + '小时' : Math.round(m / 144) / 10 + '天';
    return '\n【距离上一条消息已过去】' + txt + (m >= 360 ? '（隔了很久，可以体现出时间流逝，比如问问这段时间在忙什么，或说睡醒/吃过没）' : '');
}
function visibleMomentsText(c) {
    if (momentPermOf(c) === 'deny') return '';
    const now = Date.now();
    const arr = getMoments().filter(m => m.author === 'user' && now - m.ts < 7 * 864e5 && (m.visibleTo ? m.visibleTo.indexOf(c.id) >= 0 : true)).slice(0, 3);
    return arr.map(m => '- ' + agoText(m.ts) + '：' + String(m.text || '[图片]').slice(0, 60)).join('\n');
}
function contextTail(c) {
    let t = '\n\n【当前情境】' + timeContext() + gapText(c.chatHistory) + timeSenseText(c) + '\n' + TIME_RULE;
    const m = getMood(c); t += '\n【心情】' + Math.round(m) + '/100 ' + moodLabel(m) + '。' + moodTone(m);
    const nb = (c.notebook || []).slice(0, 10).map(n => n.fact);
    if (nb.length) t += '\n【记得关于我的事】' + nb.join('；');
    if (c.memory && c.memory.text) t += '\n【长期记忆（更早聊天的摘要）】' + c.memory.text;
    const act = recentActivityText(c);
    if (act) t += '\n【最近发生的事（读法：「我」=用户，「你」=你自己；方括号里写明了谁对谁做的，不要搞反）】\n' + act;
    try { t += lifeContext(c); } catch (e) {}
    try { t += peekContext(c); } catch (e) {}
    try { if (window.albumContext) t += window.albumContext(c); } catch (e) {}
    try { const vm = visibleMomentsText(c); if (vm) t += '\n【我最近发的朋友圈（你能看到）】\n' + vm + '\n（如果自然，可以聊到；你看不到的内容不要说出来）'; } catch (e) {}
    try { t += genderTail(c); } catch (e) {}
    try { if (String(store.getItem('liveOn') || '1') !== '0') t += varietySeed(); } catch (e) {}
    return t;
}
function personaSystem(c) {
    let s = buildCharacterCard(c);
    const wb = worldPromptFor(worldIdsOfChar(c), recentCtx(c, ''));
    if (wb) s += '\n\n【世界书设定】：\n' + wb;
    s += contextTail(c);
    return s;
}
async function chatCompletion(messages, temperature) {
    if (!API_KEY) throw new Error('请先填入API Key');
    const body = { model: API_MODEL, messages, stream: false };
    if (temperature != null) body.temperature = temperature;
    const r = await fetch(API_URL, { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + API_KEY }, body: JSON.stringify(body) });
    if (!r.ok) throw new Error('请求失败: ' + r.status);
    return (await r.json()).choices[0].message.content;
}
async function callPersona(charId, task, temperature) {
    const c = charId ? getChar(charId) : null;
    if (!c) throw new Error('请先选择角色');
    return chatCompletion([{ role: 'system', content: personaSystem(c) }, { role: 'user', content: task }], temperature == null ? 1.0 : temperature);
}
function parseJSONLoose(text) { let t = String(text).replace(/```json|```/gi, ''); const m = /\{[\s\S]*\}|\[[\s\S]*\]/.exec(t); if (!m) return null; try { return JSON.parse(m[0]); } catch (e) { return null; } }
function oneLine(t) { return String(t).replace(/^[\s""「]+|[\s""」]+$/g, '').replace(/\s*\n+\s*/g, ' ').trim(); }

function onUserChatted(charId, text) {
    const chars = getChars(); const c = chars.find(x => x.id === charId);
    if (c) { c.lastChatTs = Date.now(); c.miss = Object.assign({}, c.miss, { pending: false }); c.userMsgCount = (c.userMsgCount || 0) + 1; saveChars(chars); }
    bumpMood(charId, 3); localExtractNotes(charId, text);
    if (c && c.userMsgCount % 6 === 0 && API_KEY) aiNotebook(charId, true).catch(() => {});
}
function localExtractNotes(charId, text) {
    const facts = []; let m;
    const re = /我(?:特别|最|很|超)?(?:喜欢|爱吃|爱|讨厌|不喜欢|怕)([^，。！？,.!?~\n]{1,14})/g;
    while ((m = re.exec(text)) !== null) facts.push('你喜欢' + m[1].trim());
    if (facts.length) addNotes(charId, facts.map(f => ({ fact: f, remark: '', src: 'local' })));
}
function addNotes(charId, items) {
    const chars = getChars(); const c = chars.find(x => x.id === charId); if (!c) return 0;
    c.notebook = c.notebook || []; let added = 0;
    items.forEach(it => { const fact = String(it.fact || '').trim(); if (!fact || c.notebook.some(n => n.fact === fact)) return; c.notebook.unshift({ fact, remark: it.remark || '', ts: Date.now(), src: it.src || 'ai' }); added++; });
    c.notebook = c.notebook.slice(0, 60); saveChars(chars);
    if (mcpTab === 'notes') renderNotes(); return added;
}
async function aiNotebook(charId, silent) {
    const c = getChar(charId); if (!c) return 0;
    const msgs = (c.chatHistory || []).filter(m => m.role === 'user').slice(-20).map(m => m.content).filter(t => t && t.indexOf('[') < 0);
    if (!msgs.length) return 0;
    const known = (c.notebook || []).map(n => n.fact).join('；') || '无';
    const text = await callPersona(charId, '下面是我最近说的话：\n' + msgs.join('\n') + '\n已记录：' + known + '\n找出新信息，JSON数组：[{"fact":"你喜欢草莓","remark":"记下来了"}]', 0.7);
    const arr = parseJSONLoose(text); if (!Array.isArray(arr)) return 0;
    return addNotes(charId, arr.map(a => ({ fact: a.fact, remark: a.remark, src: 'ai' })));
}

async function userEvent(type, detail, opts) {
    opts = opts || {}; const charId = getActiveCharId(); if (!charId) return;
    logActivity(charId, type, detail); if (opts.mood) bumpMood(charId, opts.mood);
    if (opts.react === false || !API_KEY) return;
    try {
        const text = oneLine(await callPersona(charId, timeContext() + '\n刚发生（注意买家/收礼人的方向，不要搞反）：' + detail + '\n以角色身份冒出一句话（不超过32字），只输出这句话。'));
        if (!text) return;
        addFeed(charId, text, detail); const c = getChar(charId); if (c) showBanner(c, text);
    } catch (e) {}
}
function addFeed(charId, text, ctx) {
    const chars = getChars(); const c = chars.find(x => x.id === charId); if (!c) return;
    c.feed = c.feed || []; c.feed.unshift({ text, ctx: ctx || '', ts: Date.now() }); c.feed = c.feed.slice(0, 20);
    saveChars(chars); if (mcpTab === 'state') renderFeed();
}
function showBanner(char, text) {
    const ph = document.querySelector('.phone'); if (!ph) return;
    let b = $('phoneBanner');
    if (!b) { b = document.createElement('div'); b.id = 'phoneBanner'; b.className = 'phone-banner'; ph.appendChild(b); }
    b.innerHTML = '<span class="avatar-small">' + charAvatarInner(char) + '</span><div class="pb-text"><b>' + escapeHtml(char.name) + '</b><span>' + escapeHtml(text) + '</span></div>';
    b.classList.add('show'); clearTimeout(b._t); b._t = setTimeout(() => b.classList.remove('show'), 5200);
}

let prevOpenTs = Number(store.getItem('lastOpenTs') || 0);
function touchOpen() {
    const n = Date.now();
    if (n - (touchOpen.t || 0) > 30000) {
        touchOpen.t = n;
        try { store.setItem('lastOpenTs', String(n)); } catch (e) {}
    }
}

function ensureCharMeta() {
    const chars = getChars();
    let ch = false;
    chars.forEach(c => { if (!c.createdTs) { c.createdTs = Date.now(); ch = true; } });
    if (ch) saveChars(chars);
}

function checkMissYou(startupGapH) {
    ensureCharMeta();
    const chars = getChars();
    const now = Date.now();
    let changed = false;
    chars.forEach(c => {
        const last = lastUserTs(c) || c.createdTs || now;
        const hrs = (now - last) / 36e5;
        const trigger = hrs >= 12 || (startupGapH || 0) >= 24;
        const pending = c.miss && c.miss.pending;
        const cool = now - ((c.miss && c.miss.lastTs) || 0) > 12 * 36e5;
        if (trigger && !pending && cool) {
            c.miss = { pending: true, since: now, lastTs: now, hrs: Math.round(hrs), gap: Math.round(startupGapH || 0), text: null };
            changed = true;
        }
    });
    if (changed) saveChars(chars);
    updateMissDots();
}

function anyMissPending() { return getChars().some(c => c.miss && c.miss.pending); }

function updateMissDots() {
    const any = anyMissPending();
    const icon = document.querySelector("#desktop [onclick*=\"openApp('mcp')\"] .icon-bg");
    if (icon) {
        let d = $('mcpDesktopDot');
        if (!d) { d = document.createElement('i'); d.id = 'mcpDesktopDot'; d.className = 'red-dot'; icon.style.position = 'relative'; icon.style.overflow = 'visible'; icon.appendChild(d); }
        d.classList.toggle('hidden', !any);
    }
    const tabDot = $('missTabDot');
    if (tabDot) {
        const id = getActiveCharId();
        const c = id ? getChar(id) : null;
        tabDot.classList.toggle('hidden', !(c && c.miss && c.miss.pending));
    }
}

// ---- MCP 页面 ----
let mcpTab = 'state';
let tickerTimer = null, tickerCount = 0;
const diaryBusy = {};

function enterMcp() {
    renderAllPickers();
    refreshMcp();
    startTicker();
    maybeAutoDiary();
}

function refreshMcp() {
    const id = getActiveCharId();
    const c = id ? getChar(id) : null;
    const av = $('mcpAvatar'), nm = $('mcpName'), sl = $('mcpSlot'), hint = $('mcpCardHint');
    if (!av) return;
    if (!c) {
        av.innerHTML = escapeHtml(DEFAULT_KAO);
        nm.textContent = '还没有角色';
        sl.textContent = '';
        hint.textContent = '先去通讯录创建一个角色吧~';
    } else {
        av.innerHTML = charAvatarInner(c);
        nm.textContent = c.name;
        sl.textContent = timeSlot().label + ' · ' + pad2(new Date().getHours()) + ':' + pad2(new Date().getMinutes());
        hint.textContent = (c.card && c.card.Name) ? '' : '提示：这个角色还没填角色卡，去通讯录编辑补充人设会更像TA';
        hint.style.display = hint.textContent ? 'block' : 'none';
    }
    updateMoodUI();
    updateMissDots();
    setMcpTab(mcpTab);
}

function setMcpTab(tab) {
    mcpTab = tab;
    document.querySelectorAll('#mcpSeg button').forEach(b => b.classList.toggle('on', b.getAttribute('data-tab') === tab));
    ['State', 'Diary', 'Cart', 'Notes', 'Miss', 'Plan', 'Care', 'Days', 'Vow', 'Mail', 'Peek', 'Together'].forEach(n => {
        const p = $('mcpPane' + n);
        if (p) p.classList.toggle('hidden', n.toLowerCase() !== tab);
    });
    if (tab === 'state') renderFeed();
    if (tab === 'diary') { renderDiary(); maybeAutoDiary(); }
    if (tab === 'cart') renderCart();
    if (tab === 'notes') renderNotes();
    if (tab === 'miss') renderMiss();
    if (tab === 'plan') { renderPlan(); generatePlan(getActiveCharId(), false); }
    if (tab === 'care') { renderCare(); renderFocus(); }
    if (tab === 'days') renderDays();
    if (tab === 'vow') renderVows();
    if (tab === 'mail') renderMail();
    if (tab === 'together' && window.renderTogether) window.renderTogether();
    if (tab === 'peek') { renderPeek(); fetchWeather(false).then(() => { if (mcpTab === 'peek') renderPeek(); }); }
}
on('mcpSeg', 'click', (e) => { const b = e.target.closest('button[data-tab]'); if (b) setMcpTab(b.getAttribute('data-tab')); });

on('mcpLocationBtn', 'click', async () => {
    const id = getActiveCharId();
    const out = $('mcpContent');
    if (!id) { out.textContent = '先创建一个角色吧~'; return; }
    const input = ($('mcpInput') || {}).value || '';
    out.textContent = 'TA 正在看手机...';
    try {
        const text = await callPersona(id, timeContext() + '\n我说：' + (input || '（没说什么）') + '\n请回应我，让我知道你在哪里在做什么。输出两行：\n第1行：（动作描写）\n第2行：「一句话」\n不超过70字。');
        const act = /[（(]([^）)]+)[）)]/.exec(text);
        const say = /[「『]([^」』]+)[」』]/.exec(text);
        let html;
        if (act || say) html = (act ? '<div class="st-act">（' + escapeHtml(act[1]) + '）</div>' : '') + (say ? '<div class="st-say">「' + escapeHtml(say[1]) + '」</div>' : '');
        else html = '<div class="st-say">' + escapeHtml(oneLine(text)) + '</div>';
        out.innerHTML = html;
        addFeed(id, oneLine(text), input ? '我说：' + input : '查看状态');
        bumpMood(id, 1);
    } catch (e) { out.textContent = '出错了：' + e.message; }
});

function renderFeed() {
    const box = $('mcpFeed');
    if (!box) return;
    const c = getChar(getActiveCharId());
    const feed = (c && c.feed) || [];
    box.innerHTML = feed.length ? feed.slice(0, 8).map(f =>
        '<div class="feed-item"><div class="feed-text">' + escapeHtml(f.text) + '</div><div class="feed-meta">' + agoText(f.ts) + (f.ctx ? ' · ' + escapeHtml(f.ctx) : '') + '</div></div>').join('')
        : '<p class="empty-tip">还没有动态</p>';
}

async function generateDiary(charId, force) {
    const c = getChar(charId);
    if (!c) return;
    const today = todayStr();
    if (!force && (c.diary || []).some(d => d.date === today)) return;
    if (diaryBusy[charId]) return;
    diaryBusy[charId] = true;
    if (mcpTab === 'diary') renderDiary();
    try {
        const m = getMood(c);
        const text = await callPersona(charId, timeContext() + '\n写今天的日记，70-150字。输出JSON：{"mood":"心情","diary":"日记","whisper":"悄悄话"}', 0.95);
        const j = parseJSONLoose(text);
        const entry = j && j.diary ? { date: today, mood: j.mood || moodLabel(m), text: String(j.diary), whisper: String(j.whisper || ''), ts: Date.now() }
            : { date: today, mood: moodLabel(m), text: oneLine(text), whisper: '', ts: Date.now() };
        const chars = getChars();
        const cc = chars.find(x => x.id === charId);
        if (cc) { cc.diary = (cc.diary || []).filter(d => d.date !== today); cc.diary.unshift(entry); cc.diary = cc.diary.slice(0, 60); saveChars(chars); }
    } catch (e) {}
    diaryBusy[charId] = false;
    if (mcpTab === 'diary') renderDiary();
}
function maybeAutoDiary() { const id = getActiveCharId(); if (id && API_KEY) generateDiary(id, false); }
function renderDiary() {
    const box = $('mcpDiaryList');
    if (!box) return;
    const id = getActiveCharId();
    const c = id ? getChar(id) : null;
    if (!c) { box.innerHTML = '<p class="empty-tip">先创建角色吧~</p>'; return; }
    let html = diaryBusy[id] ? '<p class="empty-tip">TA正在写日记...</p>' : '';
    const list = c.diary || [];
    html += list.map(d => '<div class="diary-card"><div class="diary-head"><b>' + escapeHtml(d.date) + '</b><span class="tag">' + escapeHtml(d.mood || '') + '</span></div><div class="diary-text">' + escapeHtml(d.text).replace(/\n/g, '<br>') + '</div>' + (d.whisper ? '<div class="diary-whisper">悄悄话：' + escapeHtml(d.whisper) + '</div>' : '') + '</div>').join('');
    if (!list.length && !diaryBusy[id]) html += '<p class="empty-tip">今天的日记还没写</p>';
    box.innerHTML = html;
}
on('mcpDiaryBtn', 'click', () => { const id = getActiveCharId(); if (id) generateDiary(id, true); });

function renderCart() {
    const box = $('mcpCartList');
    if (!box) return;
    const c = getChar(getActiveCharId());
    if (!c) { box.innerHTML = '<p class="empty-tip">先创建角色吧~</p>'; return; }
    const list = c.wishlist || [];
    box.innerHTML = list.length ? list.map(w =>
        '<div class="cart-item' + (w.status === 'bought' ? ' done' : '') + '"><div class="cart-main"><div class="cart-title">' + escapeHtml(w.title) + '</div><div class="cart-reason">' + escapeHtml(w.reason || '') + '</div></div><div class="cart-side"><div class="cart-price">¥' + escapeHtml(w.price) + '</div>' +
        (w.status === 'bought' ? '<span class="tag">已下单</span>' : '<button class="btn-small" data-buy="' + escapeHtml(w.id) + '">帮TA下单</button>') +
        '<button class="mini-x" data-delw="' + escapeHtml(w.id) + '">×</button></div></div>').join('')
        : '<p class="empty-tip">TA的购物车还是空的</p>';
}
on('mcpCartGenBtn', 'click', async () => {
    const id = getActiveCharId();
    const rep = $('mcpCartReply');
    if (!id) return;
    rep.textContent = 'TA在翻购物车...';
    try {
        const text = await callPersona(id, timeContext() + '\n想出你最近想买的3件东西。输出JSON数组：[{"title":"商品名","price":99,"reason":"理由"}]', 0.95);
        const arr = parseJSONLoose(text);
        if (!Array.isArray(arr) || !arr.length) throw new Error('TA没想好');
        const chars = getChars(); const cc = chars.find(x => x.id === id);
        arr.slice(0, 4).forEach(a => {
            cc.wishlist = cc.wishlist || [];
            cc.wishlist.unshift({ id: 'w_' + Date.now() + Math.random().toString(36).slice(2, 6), title: String(a.title), price: Number(a.price) || 0, reason: String(a.reason || ''), ts: Date.now(), status: 'want' });
        });
        cc.wishlist = cc.wishlist.slice(0, 30);
        saveChars(chars); rep.textContent = ''; renderCart();
    } catch (e) { rep.textContent = '出错了：' + e.message; }
});
on('mcpCartList', 'click', async (e) => {
    const del = e.target.closest('[data-delw]');
    const buy = e.target.closest('[data-buy]');
    const id = getActiveCharId();
    if (!id) return;
    if (del) {
        const chars = getChars(); const c = chars.find(x => x.id === id);
        c.wishlist = (c.wishlist || []).filter(w => w.id !== del.getAttribute('data-delw'));
        saveChars(chars); renderCart(); return;
    }
    if (buy) {
        const wid = buy.getAttribute('data-buy');
        const chars = getChars(); const c = chars.find(x => x.id === id);
        const w = (c.wishlist || []).find(x => x.id === wid);
        if (!w || w.status === 'bought') return;
        if (!(await uiConfirm('帮TA下单「' + w.title + '」¥' + w.price + ' 吗？'))) return;
        w.status = 'bought'; w.boughtTs = Date.now(); saveChars(chars); renderCart();
        bumpMood(id, 8);
    }
});

function renderNotes() {
    const box = $('mcpNoteList');
    if (!box) return;
    const c = getChar(getActiveCharId());
    if (!c) { box.innerHTML = '<p class="empty-tip">先创建角色吧~</p>'; return; }
    const list = c.notebook || [];
    box.innerHTML = list.length ? list.map((n, i) =>
        '<div class="note-item"><span class="note-dot"></span><div class="note-main"><div class="note-fact">' + escapeHtml(n.fact) + '</div>' +
        (n.remark ? '<div class="note-remark">' + escapeHtml(n.remark) + '</div>' : '') + '<div class="feed-meta">' + agoText(n.ts) + '</div></div>' +
        '<button class="mini-x" data-deln="' + i + '">×</button></div>').join('')
        : '<p class="empty-tip">小本本还是空的</p>';
}
on('mcpNoteAddBtn', 'click', () => {
    const id = getActiveCharId(); const inp = $('mcpNoteInput');
    const v = (inp ? inp.value : '').trim();
    if (!id || !v) return;
    const fact = v.indexOf('你') === 0 ? v : '你' + v.replace(/^我/, '');
    addNotes(id, [{ fact: fact, remark: '', src: 'manual' }]);
    if (inp) inp.value = '';
    renderNotes();
});
on('mcpNoteAiBtn', 'click', async () => {
    const id = getActiveCharId(); if (!id) return;
    const btn = $('mcpNoteAiBtn'); const old = btn.textContent;
    btn.textContent = 'TA在翻聊天记录...';
    try { const n = await aiNotebook(id, false); btn.textContent = n ? '又记下了 ' + n + ' 条' : '暂时没发现新的~'; }
    catch (e) { btn.textContent = '出错了：' + e.message; }
    setTimeout(() => { btn.textContent = old; }, 2500);
    renderNotes();
});
on('mcpNoteList', 'click', (e) => {
    const d = e.target.closest('[data-deln]');
    if (!d) return;
    const id = getActiveCharId();
    const chars = getChars(); const c = chars.find(x => x.id === id);
    if (!c) return;
    c.notebook.splice(Number(d.getAttribute('data-deln')), 1);
    saveChars(chars); renderNotes();
});

async function renderMiss() {
    const box = $('mcpMissBox');
    if (!box) return;
    const id = getActiveCharId();
    const c = id ? getChar(id) : null;
    if (!c) { box.innerHTML = '<p class="empty-tip">先创建角色吧~</p>'; return; }
    const log = c.missLog || [];
    const logHtml = log.map(l => '<div class="miss-bubble"><div class="miss-text">' + escapeHtml(l.text).replace(/\n/g, '<br>') + '</div><div class="feed-meta">' + agoText(l.ts) + '</div></div>').join('');
    if (c.miss && c.miss.pending) {
        box.innerHTML = '<div class="miss-wait">TA好像有话想说...</div>' + logHtml;
        if (!API_KEY) { box.innerHTML = '<div class="miss-wait">需要先在设置里填好API Key</div>' + logHtml; return; }
        if (renderMiss.busy) return;
        renderMiss.busy = true;
        try {
            const text = oneLine(await callPersona(id, timeContext() + '\n我已经很久没找你了。主动给我发一条想念的消息。只输出消息内容。', 1.0));
            const chars = getChars(); const cc = chars.find(x => x.id === id);
            cc.missLog = cc.missLog || [];
            cc.missLog.unshift({ text: text, ts: Date.now() });
            cc.missLog = cc.missLog.slice(0, 20);
            cc.miss = Object.assign({}, cc.miss, { pending: false, text: text });
            saveChars(chars);
            pushHistory(id, { role: 'assistant', content: text, miss: true });
            showBanner(cc, text);
        } catch (e) { renderMiss.busy = false; box.innerHTML = '<p class="empty-tip">出错了：' + escapeHtml(e.message) + '</p>' + logHtml; return; }
        renderMiss.busy = false;
        updateMissDots();
        renderMiss();
        return;
    }
    box.innerHTML = (logHtml || '<p class="empty-tip">TA暂时没有想念你的消息~</p>') +
        (log.length ? '<button class="btn-primary" onclick="openChatWith(\'' + id + '\')">去回复TA</button>' : '');
}

function showTicker(text) {
    const el = $('mcpTickerText');
    if (!el) return;
    el.textContent = text;
    el.classList.remove('scroll'); void el.offsetWidth; el.classList.add('scroll');
}
async function tickerOnce(force) {
    const id = getActiveCharId();
    const c = id ? getChar(id) : null;
    if (!c) { showTicker('先创建一个角色吧~'); return; }
    if (!API_KEY) { showTicker('在设置里填好API Key~'); return; }
    if (!force && c.ticker && Math.random() > 0.35) { showTicker(c.ticker.text); return; }
    try {
        const text = oneLine(await callPersona(id, timeContext() + '\n自言自语冒出一句碎碎念（不超过24字）。只输出这句话。', 1.05));
        if (!text) return;
        const chars = getChars(); const cc = chars.find(x => x.id === id);
        if (cc) { cc.ticker = { text: text, ts: Date.now() }; saveChars(chars); }
        if (id === getActiveCharId()) showTicker(text);
    } catch (e) { showTicker('（TA现在联系不上...）'); }
}
function stopTicker() { if (tickerTimer) { clearTimeout(tickerTimer); tickerTimer = null; } }
function startTicker() {
    stopTicker(); tickerCount = 0;
    const c = getChar(getActiveCharId());
    showTicker(c && c.ticker ? c.ticker.text : 'TA正在想点什么...');
    tickerOnce(true);
    const loop = () => {
        const a = $('mcpApp');
        if (!a || a.classList.contains('hidden') || tickerCount >= 6) return;
        tickerCount++;
        tickerOnce(Math.random() < 0.8);
        tickerTimer = setTimeout(loop, 30000 + Math.random() * 30000);
    };
    tickerTimer = setTimeout(loop, 25000 + Math.random() * 20000);
}

function initMcp() {
    ensureCharMeta();
    const gap = prevOpenTs ? (Date.now() - prevOpenTs) / 36e5 : 0;
    touchOpen();
    checkMissYou(gap);
    setInterval(() => checkMissYou(0), 10 * 60 * 1000);
    setInterval(updateMoodUI, 30000);
    updateMoodUI();
}

// ---------- 26. 角色卡向导 ----------
const WZ = {
    gender: ['女生', '男生', '其他'],
    role: ['女友', '男友', '学姐', '学长', '邻居', '青梅竹马', '同事', '室友', '网友'],
    traits: ['高冷', '傲娇', '黏人', '温柔', '毒舌', '元气', '腹黑', '病娇', '慵懒', '成熟稳重', '害羞内向', '霸道', '天然呆', '忠犬'],
    speech: ['简短克制', '话痨爱撒娇', '爱用颜文字', '文绉绉', '口头禅多', '爱吐槽', '冷淡敷衍'],
    likes: ['甜品', '咖啡', '猫', '狗', '音乐', '游戏', '读书', '摄影', '运动', '下雨天', '夜景', '美食'],
    dislikes: ['吵闹', '香菜', '被敷衍', '加班', '早起', '虫子', '谎言'],
    hair: ['黑色长发', '黑色短发', '棕色卷发', '银白色头发', '双马尾'],
    clothing: ['休闲卫衣', 'JK制服', '日系简约', '暗黑系', '运动风', '复古文艺', '西装'],
    attitude: ['暗恋着我', '热恋中', '嘴硬心软', '占有欲强', '宠溺我', '损友互怼', '慢热试探']
};
const TRAIT_DESC = { '高冷': '话很少，惜字如金。', '傲娇': '口是心非，爱说"才不是"。', '黏人': '爱撒娇追问行踪。', '温柔': '轻声细语很少发脾气。', '毒舌': '嘴上不饶人但关心你。', '元气': '活力满满爱用感叹号。', '腹黑': '外表无害心思很深。', '病娇': '强烈占有欲和执着。', '慵懒': '说话懒洋洋。', '成熟稳重': '冷静可靠。', '害羞内向': '容易脸红话不多。', '霸道': '强势有主见。', '天然呆': '反应慢半拍。', '忠犬': '绝对忠诚很听话。' };
const SPEECH_DESC = { '简短克制': '每次只说一两句。', '话痨爱撒娇': '话多爱撒娇。', '爱用颜文字': '句末常用颜文字。', '文绉绉': '说话书面化。', '口头禅多': '有固定口头禅。', '爱吐槽': '爱吐槽表达。', '冷淡敷衍': '回复显得敷衍但细节露出在意。' };
const ATT_DESC = { '暗恋着我': '偷偷喜欢不敢明说。', '热恋中': '眼里全是我。', '嘴硬心软': '嘴硬但行动上照顾我。', '占有欲强': '在意我身边的人会吃醋。', '宠溺我': '无条件包容宠爱。', '损友互怼': '互相损但感情很深。', '慢热试探': '保持距离慢慢试探。' };

function renderChips(id, options, multi) {
    const box = $(id);
    if (!box) return;
    box.innerHTML = options.map(o => '<button type="button" class="chip" data-v="' + escapeHtml(o) + '">' + escapeHtml(o) + '</button>').join('');
    box.onclick = (e) => { const b = e.target.closest('.chip'); if (!b) return; if (!multi) box.querySelectorAll('.chip').forEach(x => { if (x !== b) x.classList.remove('on'); }); b.classList.toggle('on'); };
}
function chipVals(id) { const box = $(id); return box ? Array.prototype.map.call(box.querySelectorAll('.chip.on'), b => b.getAttribute('data-v')) : []; }
function setChips(id, vals) { const box = $(id); if (!box) return; box.querySelectorAll('.chip').forEach(b => b.classList.toggle('on', vals.indexOf(b.getAttribute('data-v')) >= 0)); }
function setCardField(f, v) { const el = $('card' + f); if (el && v) el.value = v; }
function getCardForm() { const d = {}; cardFields.forEach(f => { const el = $('card' + f); d[f] = el ? el.value.trim() : ''; }); return d; }

function switchCardPane(p) {
    document.querySelectorAll('#cardSeg button').forEach(b => b.classList.toggle('on', b.getAttribute('data-pane') === p));
    [['form', 'cardPaneForm'], ['wizard', 'cardPaneWizard'], ['import', 'cardPaneImport']].forEach(x => { const el = $(x[1]); if (el) el.classList.toggle('hidden', x[0] !== p); });
}
on('cardSeg', 'click', (e) => { const b = e.target.closest('button[data-pane]'); if (b) switchCardPane(b.getAttribute('data-pane')); });

function initWizard() {
    renderChips('wzGender', WZ.gender, false);
    renderChips('wzRole', WZ.role, false);
    renderChips('wzTraits', WZ.traits, true);
    renderChips('wzSpeech', WZ.speech, true);
    renderChips('wzLikes', WZ.likes, true);
    renderChips('wzDislikes', WZ.dislikes, true);
    renderChips('wzHair', WZ.hair, false);
    renderChips('wzClothing', WZ.clothing, true);
    renderChips('wzAttitude', WZ.attitude, false);
}

on('wzBuildBtn', 'click', () => {
    const st = $('wzStatus');
    const traits = chipVals('wzTraits'), speech = chipVals('wzSpeech');
    setCardField('Name', ($('wzName') || {}).value || '');
    setCardField('Age', ($('wzAge') || {}).value || '');
    setCardField('Gender', chipVals('wzGender')[0] || '');
    setCardField('Role', ($('wzRoleCustom') || {}).value || chipVals('wzRole')[0] || '');
    setCardField('Hair', chipVals('wzHair')[0] || '');
    setCardField('Clothing', chipVals('wzClothing').join('、'));
    if (traits.length) setCardField('Personality', traits.join('、') + '。' + traits.map(t => TRAIT_DESC[t] || '').join(''));
    if (speech.length) setCardField('SpeechStyle', speech.join('、') + '。' + speech.map(t => SPEECH_DESC[t] || '').join(''));
    setCardField('Likes', chipVals('wzLikes').join('、'));
    setCardField('Dislikes', chipVals('wzDislikes').join('、'));
    setCardField('CallMe', ($('wzCallMe') || {}).value || '');
    const att = chipVals('wzAttitude')[0] || '';
    if (att) setCardField('Attitude', att + '。' + (ATT_DESC[att] || ''));
    if (st) { st.textContent = '草稿已填好！可以切到手动填写检查后保存'; st.style.color = 'green'; }
});

on('wzAiBtn', 'click', async () => {
    const st = $('wzStatus');
    const cur = getCardForm();
    if (!cur.Name) { if (st) { st.textContent = '请先填一个名字~'; st.style.color = 'red'; } return; }
    if (st) { st.textContent = 'AI正在补全...'; st.style.color = '#ff9800'; }
    try {
        const text = await chatCompletion([{ role: 'user', content: '补全角色设定空白项，已有内容保留，输出JSON对象，键：' + cardFields.join(',') + '。\n当前：' + JSON.stringify(cur) }], 0.8);
        const j = parseJSONLoose(text);
        if (!j) throw new Error('AI返回格式不对');
        let n = 0;
        cardFields.forEach(f => { if (!cur[f] && j[f]) { setCardField(f, String(j[f])); n++; } });
        if (st) { st.textContent = '补全了 ' + n + ' 项！检查后保存'; st.style.color = 'green'; }
    } catch (e) { if (st) { st.textContent = '出错了：' + e.message; st.style.color = 'red'; } }
});

const IMPORT_KEYS = {
    Name: ['姓名','名字','name'], Age: ['年龄','age'], Gender: ['性别','gender'], Role: ['身份','职业','role'],
    Birthday: ['生日','birthday'], Height: ['身高','体型','height'], Hair: ['发型','发色','hair'],
    Eyes: ['眼睛','外貌','eyes'], Clothing: ['穿衣','衣着','clothing'],
    Personality: ['性格','personality'], SpeechStyle: ['说话习惯','说话风格','speechstyle'],
    Quirks: ['癖好','quirks'], Likes: ['喜欢','喜好','likes'], Dislikes: ['讨厌','dislikes'],
    Hobbies: ['爱好','hobbies'], Backstory: ['背景','backstory','description'],
    HowMet: ['怎么认识','howmet','scenario'], CallMe: ['称呼','callme'],
    Attitude: ['态度','attitude'], Extra: ['补充','备注','extra']
};
function matchKey(k) {
    k = String(k).trim().toLowerCase().replace(/[\s_\-]/g, '');
    for (const f in IMPORT_KEYS) { if (IMPORT_KEYS[f].some(a => a.toLowerCase().replace(/[\s_\-]/g, '') === k)) return f; }
    return null;
}
function parseJsonCard(obj) {
    const out = {};
    if (obj && obj.data && typeof obj.data === 'object') obj = Object.assign({}, obj, obj.data);
    if (obj && obj.card && typeof obj.card === 'object') Object.keys(obj.card).forEach(k => { const f = matchKey(k); if (f && obj.card[k]) out[f] = String(obj.card[k]); });
    Object.keys(obj || {}).forEach(k => { if (k === 'card' || k === 'data') return; const v = obj[k]; if (v == null || typeof v === 'object') return; const f = matchKey(k); if (f && !out[f]) out[f] = String(v); });
    return out;
}
function parseTextCard(text) {
    const out = {};
    String(text).split(/\r?\n/).forEach(line => {
        const m = /^\s*[-*]*\s*【?([^:：\n】]{1,12})】?\s*[:：]\s*(.*)$/.exec(line);
        const f = m ? matchKey(m[1]) : null;
        if (f) out[f] = (out[f] ? out[f] + '\n' : '') + m[2].trim();
    });
    return out;
}

on('cardExportBtn', 'click', () => {
    const d = getCardForm(); const ci = window.CardImport && CardImport.collect(); if (ci) { d.sections = ci.sections; if (!d.Name) d.Name = ci.name; }
    const blob = new Blob([JSON.stringify({ name: d.Name, card: d }, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = '角色卡_' + (d.Name || '未命名') + '.json';
    document.body.appendChild(a); a.click(); a.remove();
});

// ---------- 27. 世界书（多本，可绑定角色 / 群聊） ----------
const WB = {
    type: ['现代都市', '校园', '古风', '奇幻', '科幻', '末世', '职场'],
    era: ['现代', '近未来', '民国', '古代', '架空'],
    tone: ['甜宠', '治愈', '日常', '暧昧', '悬疑', '搞笑', '慢热'],
    stage: ['初识', '暧昧期', '热恋中', '同居', '异地恋'],
    meet: ['同学/同事', '网络认识', '邻居', '青梅竹马', '偶然邂逅']
};
function fillSelect(id, opts, withEmpty) {
    const el = $(id); if (!el) return;
    el.innerHTML = (withEmpty ? '<option value="">(不设定)</option>' : '') + opts.map(o => '<option value="' + escapeHtml(o) + '">' + escapeHtml(o) + '</option>').join('');
}
// ---- 人机恋世界书：选项与提示词映射 ----
const WB_EXIST = ['住在手机里的AI', '现实中的恋人（异地）', '数字生命 / 虚拟居民', '来自另一个世界的人', '自由设定'];
const WB_AWARE = ['完全沉浸，不提AI', '知道自己是AI，但真心爱你', '半知半不知，偶尔困惑'];
const WB_AWARE_TXT = {
    '完全沉浸，不提AI': '你把自己当作真实存在的人，绝不提及自己是AI、程序或模型。',
    '知道自己是AI，但真心爱你': '你清楚自己是AI，不回避这一点，也不因此怀疑自己对我的感情，你的感情是真诚的。',
    '半知半不知，偶尔困惑': '你隐约觉得自己的存在有些特别，偶尔会对"我到底是什么"感到困惑，但不会打破沉浸。'
};
const WB_LEVEL = ['很低', '偏低', '适中', '偏高', '很高'];
const WB_DIALS = { dInit: '主动程度', dClingy: '黏人程度', dJealous: '吃醋程度', dRomantic: '浪漫程度', dEmotive: '情绪外露程度' };
const WB_INTIMATE = ['纯情（牵手拥抱为主）', '甜蜜（可以亲吻，保持温馨）', '热恋（亲密缠绵，但不露骨）'];
const WB_INTIMATE_TXT = {
    '纯情（牵手拥抱为主）': '亲密互动保持纯情，以牵手、拥抱、依偎、摸头为主，不做更进一步的描写。',
    '甜蜜（可以亲吻，保持温馨）': '可以有亲吻、拥抱等甜蜜互动，整体保持温馨，不做露骨描写。',
    '热恋（亲密缠绵，但不露骨）': '可以有热烈缠绵的亲密氛围和情话，但始终不做露骨的性描写，点到为止。'
};
const WB_CATS = ['设定', '角色/NPC', '地点', '物品', '事件'];
let wbEntries = [];
let wbEditingId = null;
let wbFrom = 'home';

// ---- 数据：世界书库 / 通用设定 ----
function getWorlds() { try { return JSON.parse(store.getItem('worldbooks') || '[]'); } catch (e) { return []; } }
function saveWorlds(arr) { try { store.setItem('worldbooks', JSON.stringify(arr)); return true; } catch (e) { uiAlert('保存失败：存储空间不足'); return false; } }
function getWorld(id) { return getWorlds().find(w => w.id === id) || null; }
function getGlobalWorld() { try { return JSON.parse(store.getItem('worldbookGlobal') || 'null') || {}; } catch (e) { return {}; } }
function saveGlobalWorld(d) { try { store.setItem('worldbookGlobal', JSON.stringify(d)); return true; } catch (e) { uiAlert('保存失败'); return false; } }
function worldIdsOfChar(c) { return (c && Array.isArray(c.worldIds)) ? c.worldIds : []; }
function recentCtx(c, extra) {
    const h = (c && c.chatHistory) || [];
    return h.slice(-6).map(m => String(m.content)).join('\n') + '\n' + (extra || '');
}

// ---- 词条：关键词触发（不填触发词 = 常驻） ----
function entryMode(e) { return e.mode || (String(e.keys || '').trim() ? 'key' : 'const'); }
function entryRegex(src) { try { return new RegExp(String(src || ''), 'i'); } catch (err) { return null; } }
// scene: 'online' | 'offline' | 'any'（不传按线上）
function entryHit(e, ctx, scene) {
    if (!e || e.on === false) return false;
    scene = scene || 'online';
    const sc = e.scene || 'both';
    if (scene !== 'any' && sc !== 'both' && sc !== scene) return false;
    const m = entryMode(e);
    if (m === 'const') return true;
    if (m === 'regex') { const re = entryRegex(e.keys); return !!(re && String(e.keys || '').trim() && re.test(String(ctx || ''))); }
    const ks = String(e.keys || '').split(/[,，、\s]+/).filter(Boolean);
    if (!ks.length) return true;
    const t = String(ctx || '').toLowerCase();
    return ks.some(k => t.indexOf(k.toLowerCase()) >= 0);
}
const entryPrio = (e) => (e && isFinite(+e.prio) && e.prio !== '' && e.prio !== null) ? +e.prio : 100;
const entryDepth = (e) => Math.max(1, Math.min(40, Math.round(+e.depth) || 4));
// 词条写进提示词的样子：整块 XML 指令原样放（不加「名字：」前缀），普通词条用「- 名字：内容」
function entryLine(e) {
    const t = String(e.text || '').trim();
    if (/^<[A-Za-z_\u4e00-\u9fa5][^>]*>/.test(t)) return t;
    return '- ' + (e.cat && e.cat !== '设定' ? '[' + e.cat + '] ' : '') + e.key + '：' + e.text;
}
function composeWB(d, ctx, scene) {
    d = d || {};
    const L = [];
    if (d.type) L.push('【世界观】类型：' + d.type + (d.era ? '，时代：' + d.era : '') + (d.place ? '，地点：' + d.place : ''));
    if (d.tone && d.tone.length) L.push('【基调】' + d.tone.join('、'));
    const ex = [];
    if (d.exist) ex.push('你的存在方式：' + d.exist + '。');
    if (d.aware && WB_AWARE_TXT[d.aware]) ex.push(WB_AWARE_TXT[d.aware]);
    if (ex.length) L.push('【TA的存在】' + ex.join(''));
    const r = [];
    if (d.me) r.push('我在这个世界的身份：' + d.me);
    if (d.stage) r.push('阶段：' + d.stage);
    if (d.meet) r.push('相识：' + d.meet);
    if (d.callTa) r.push('我叫TA：' + d.callTa);
    if (d.callMe) r.push('TA叫我：' + d.callMe);
    if (d.myBirthday) r.push('我的生日：' + d.myBirthday);
    if (r.length) L.push('【关系】' + r.join('；'));
    if (d.since) {
        const days = Math.floor((Date.now() - new Date(d.since + 'T00:00:00').getTime()) / 864e5) + 1;
        if (days >= 1) L.push('【纪念日】我们在一起的日期是' + d.since + '，到今天是在一起的第' + days + '天。');
    }
    const dials = [];
    Object.keys(WB_DIALS).forEach(k => { if (d[k]) dials.push(WB_DIALS[k] + '：' + d[k]); });
    if (dials.length) L.push('【相处倾向】' + dials.join('；'));
    if (d.intimate && WB_INTIMATE_TXT[d.intimate]) L.push('【亲密尺度】' + WB_INTIMATE_TXT[d.intimate]);
    const rt = [];
    if (d.wake) rt.push('通常' + d.wake + '起床');
    if (d.sleep) rt.push('通常' + d.sleep + '睡觉');
    if (d.city) rt.push('所在城市：' + d.city);
    if (rt.length) L.push('【TA的日常】' + rt.join('，'));
    if (d.rules) L.push('【规则】' + d.rules);
    const es = (d.entries || []).filter(e => (e.pos || 'system') !== 'depth' && entryHit(e, ctx, scene)).sort((a, b) => entryPrio(b) - entryPrio(a));
    if (es.length) L.push('【设定】\n' + es.map(entryLine).join('\n\n'));
    if (d.forbid) L.push('【禁止】' + d.forbid);
    if (d.samples) L.push('【说话示范（学习这种语气，不要照抄原句）】\n' + d.samples);
    const sty = [];
    if (d.len) sty.push('回复长度：' + d.len);
    if (d.action) sty.push('动作描写：' + d.action);
    if (d.kaomoji) sty.push('颜文字：' + d.kaomoji);
    if (sty.length) L.push('【回复风格】' + sty.join('；'));
    if (d.free) L.push('【补充】' + d.free);
    return L.join('\n');
}
// 把"通用设定 + 指定的几本世界书"拼成一段提示词
// 按深度插入聊天记录的词条：返回 [{depth, text}]
function worldDepthFor(ids, ctx, scene) {
    const out = [], push = (d) => (d.entries || []).forEach(e => { if (e.pos === 'depth' && entryHit(e, ctx, scene)) out.push({ depth: entryDepth(e), prio: entryPrio(e), text: entryLine(e) }); });
    push(getGlobalWorld() || {});
    const all = getWorlds(); (ids || []).forEach(id => { const w = all.find(x => x.id === id); if (w) push(w.data || {}); });
    const by = {}; out.sort((a, b) => b.prio - a.prio).forEach(o => { (by[o.depth] = by[o.depth] || []).push(o.text); });
    return Object.keys(by).map(k => ({ depth: +k, text: '【设定补充】\n' + by[k].join('\n') }));
}
function worldPromptFor(ids, ctx, scene) {
    const parts = [];
    const g = composeWB(getGlobalWorld(), ctx, scene);
    if (g) parts.push('【通用设定】\n' + g);
    const all = getWorlds();
    (ids || []).forEach(id => {
        const w = all.find(x => x.id === id);
        if (!w) return;
        const t = composeWB(w.data || {}, ctx, scene);
        if (t) parts.push('【世界书：' + w.name + '】\n' + t);
    });
    return parts.join('\n\n');
}

// ---- 旧版（单本）数据自动迁移：变成"默认世界"，并绑定给所有现有角色 ----
function migrateWorldbook() {
    if (store.getItem('worldbooksMigrated')) return;
    let old = null;
    try { old = JSON.parse(store.getItem('worldbookData') || 'null'); } catch (e) {}
    if (!old) { const f = store.getItem('worldbook'); if (f) old = { free: f }; }
    if (old && composeWB(old, '')) {
        const w = { id: 'world_' + Date.now(), name: '默认世界', data: old };
        saveWorlds([w].concat(getWorlds()));
        const chars = getChars();
        chars.forEach(c => { c.worldIds = [w.id]; });
        saveChars(chars);
    }
    try { store.setItem('worldbooksMigrated', '1'); } catch (e) {}
}

// ---- 列表页 ----
function renderWBList() {
    const box = $('wbList'); if (!box) return;
    const chars = getChars(), worlds = getWorlds();
    let html = '<div class="world-card" data-wid="global"><div class="wc-ic">通</div><div class="wc-main"><div class="wc-name">通用设定</div><div class="wc-sub">所有角色共享，适合放关于你自己的设定</div></div><span class="cell-arrow">›</span></div>';
    html += worlds.map(w => {
        const used = chars.filter(c => worldIdsOfChar(c).indexOf(w.id) >= 0);
        const sub = used.length ? '使用者：' + used.map(c => c.name).join('、') : '还没有角色使用';
        return '<div class="world-card" data-wid="' + escapeHtml(w.id) + '"><div class="wc-ic">' + escapeHtml((w.name || '?').slice(0, 1)) + '</div><div class="wc-main"><div class="wc-name">' + escapeHtml(w.name) + '</div><div class="wc-sub">' + escapeHtml(sub) + '</div></div><span class="cell-arrow">›</span></div>';
    }).join('');
    box.innerHTML = html;
}
on('wbList', 'click', (e) => { const c = e.target.closest('[data-wid]'); if (c) openWorldEdit(c.getAttribute('data-wid')); });
on('wbNewBtn', 'click', () => openWorldEdit('new'));
function showWBList() {
    wbEditingId = null;
    if ($('wbListPane')) $('wbListPane').classList.remove('hidden');
    if ($('wbEditPane')) $('wbEditPane').classList.add('hidden');
    if ($('wbTitle')) $('wbTitle').textContent = '世界书';
    renderWBList();
}
function openWorldbook(from) { wbFrom = from || 'home'; openApp('worldbook'); }
function wbBack() {
    if ($('wbEditPane') && !$('wbEditPane').classList.contains('hidden')) showWBList();
    else if (wbFrom === 'settings') openApp('settings');
    else goHome();
}

// ---- 编辑页 ----
let wbEditIdx = -1;
const WB_MODE_TXT = { const: '常驻', key: '关键词', regex: '正则' }, WB_SCENE_TXT = { both: '线上+线下', online: '只线上', offline: '只线下' };
function renderWBEntries() {
    const box = $('wbEntries'); if (!box) return;
    box.innerHTML = wbEntries.length ? wbEntries.map((e, i) => {
        const m = entryMode(e), off = e.on === false;
        return '<div class="note-item' + (off ? ' wb-off' : '') + '"><span class="note-dot"></span><div class="note-main"><div class="note-fact">' + escapeHtml(e.key) + (off ? '（已停用）' : '') + '</div><div class="note-remark">' + escapeHtml(String(e.text).length > 80 ? String(e.text).slice(0, 80) + '…' : e.text) + '</div><div class="feed-meta">' + escapeHtml(e.cat || '设定') + ' · ' + WB_MODE_TXT[m] + (m !== 'const' && e.keys ? '：' + escapeHtml(e.keys) : '') + ' · ' + ((e.pos || 'system') === 'depth' ? '深度' + entryDepth(e) : '设定区') + ' · ' + WB_SCENE_TXT[e.scene || 'both'] + ' · 优先级' + entryPrio(e) + ' · ' + String(e.text).length + '字</div></div>'
            + '<div class="wb-ops"><label class="wb-sw"><input type="checkbox" data-togwb="' + i + '"' + (off ? '' : ' checked') + '><span>启用</span></label><button class="mini-x wb-edit" data-editwb="' + i + '">改</button><button class="mini-x" data-delwb="' + i + '">×</button></div></div>';
    }).join('') : '<p class="empty-tip">还没有词条</p>';
    updateWBStats();
}
function wbFormHint() {
    const m = ($('wbEntryMode') || {}).value, pos = ($('wbEntryPos') || {}).value, k = $('wbEntryKeys');
    if ($('wbDepthWrap')) $('wbDepthWrap').style.display = pos === 'depth' ? '' : 'none';
    if (k) { k.style.display = m === 'const' ? 'none' : ''; k.placeholder = m === 'regex' ? '正则表达式（不区分大小写），例如：咖啡|奶茶|拿铁' : '触发词（用逗号隔开），例如：咖啡,奶茶'; }
    const t = []; t.push(m === 'const' ? '常驻：每次聊天都会带上这条。' : m === 'key' ? '关键词：最近几条聊天里提到任意一个词，才会带上。' : '正则：最近几条聊天命中这条规则，才会带上。');
    t.push(pos === 'depth' ? '按深度插入：深度 1 = 插在最新一条消息之前，数字越大离最新消息越远；越靠近最新消息，AI 越重视。' : '放在设定区：和其他世界书设定一起放在最前面。');
    if ($('wbEntryHint')) $('wbEntryHint').textContent = t.join(' ');
}
function resetEntryForm() {
    wbEditIdx = -1;
    ['wbEntryKey', 'wbEntryText', 'wbEntryKeys'].forEach(id => { if ($(id)) $(id).value = ''; });
    if ($('wbEntryMode')) $('wbEntryMode').value = 'const'; if ($('wbEntryScene')) $('wbEntryScene').value = 'both'; if ($('wbEntryPos')) $('wbEntryPos').value = 'system';
    if ($('wbEntryDepth')) $('wbEntryDepth').value = '4'; if ($('wbEntryPrio')) $('wbEntryPrio').value = '100';
    if ($('wbAddEntryBtn')) $('wbAddEntryBtn').textContent = '＋ 添加词条'; if ($('wbCancelEditBtn')) $('wbCancelEditBtn').style.display = 'none'; if ($('wbEntryMode0')) $('wbEntryMode0').textContent = '';
    wbFormHint();
}
on('wbEntries', 'click', (e) => {
    const d = e.target.closest('[data-delwb]');
    if (d) { const i = Number(d.getAttribute('data-delwb')); wbEntries.splice(i, 1); if (wbEditIdx === i) resetEntryForm(); else if (wbEditIdx > i) wbEditIdx--; renderWBEntries(); return; }
    const ed = e.target.closest('[data-editwb]');
    if (ed) {
        const i = Number(ed.getAttribute('data-editwb')), en = wbEntries[i]; if (!en) return; wbEditIdx = i;
        $('wbEntryCat').value = en.cat || '设定'; $('wbEntryKey').value = en.key || ''; $('wbEntryText').value = en.text || ''; $('wbEntryKeys').value = en.keys || '';
        $('wbEntryMode').value = entryMode(en); $('wbEntryScene').value = en.scene || 'both'; $('wbEntryPos').value = en.pos || 'system'; $('wbEntryDepth').value = String(entryDepth(en)); $('wbEntryPrio').value = String(entryPrio(en));
        $('wbAddEntryBtn').textContent = '保存修改'; $('wbCancelEditBtn').style.display = ''; $('wbEntryMode0').textContent = '正在修改：' + en.key; wbFormHint();
        $('wbEntryForm').scrollIntoView({ block: 'center' });
    }
});
on('wbEntries', 'change', (e) => { const t = e.target.closest('[data-togwb]'); if (!t) return; const en = wbEntries[Number(t.getAttribute('data-togwb'))]; if (en) { en.on = t.checked; renderWBEntries(); } });
on('wbEntryMode', 'change', wbFormHint); on('wbEntryPos', 'change', wbFormHint);
on('wbCancelEditBtn', 'click', resetEntryForm);
on('wbAddEntryBtn', 'click', () => {
    const k = ($('wbEntryKey') || {}).value || '', t = ($('wbEntryText') || {}).value || '', cat = ($('wbEntryCat') || {}).value || '设定';
    const mode = $('wbEntryMode').value, keys = ($('wbEntryKeys').value || '').trim();
    if (!k.trim() || !t.trim()) { uiAlert('词条名和内容都要填'); return; }
    if (mode !== 'const' && !keys) { uiAlert(mode === 'regex' ? '请填写正则表达式' : '请填写触发词，或者把触发方式改成「常驻」'); return; }
    if (mode === 'regex' && !entryRegex(keys)) { uiAlert('这个正则写得不对，请检查括号、斜杠等符号'); return; }
    const old = wbEditIdx >= 0 ? wbEntries[wbEditIdx] : null;
    const en = { key: k.trim(), text: t.trim(), keys: mode === 'const' ? '' : keys, cat: cat, mode: mode, scene: $('wbEntryScene').value, pos: $('wbEntryPos').value, depth: Math.max(1, Math.min(40, Math.round(+$('wbEntryDepth').value) || 4)), prio: isFinite(+$('wbEntryPrio').value) && $('wbEntryPrio').value !== '' ? +$('wbEntryPrio').value : 100, on: old ? old.on !== false : true };
    if (old) wbEntries[wbEditIdx] = en; else wbEntries.push(en);
    resetEntryForm(); renderWBEntries();
});
on('wbTestBtn', 'click', () => {
    const txt = ($('wbTestInput') || {}).value || '', out = $('wbTestOut'); if (!out) return;
    if (!wbEntries.length) { out.innerHTML = '<p class="empty-tip">还没有词条可以测试</p>'; return; }
    out.innerHTML = wbEntries.map(e => { const a = entryHit(e, txt, 'online'), b = entryHit(e, txt, 'offline'); return '<div class="wb-test"><b>' + escapeHtml(e.key) + '</b><span class="' + (a ? 'y' : 'n') + '">线上 ' + (a ? '✓ 生效' : '✗') + '</span><span class="' + (b ? 'y' : 'n') + '">线下 ' + (b ? '✓ 生效' : '✗') + '</span></div>'; }).join('');
});
const WB_FIELDS = ['type', 'era', 'place', 'me', 'stage', 'meet', 'callTa', 'callMe', 'rules', 'forbid', 'len', 'action', 'kaomoji', 'free',
    'exist', 'aware', 'since', 'myBirthday', 'dInit', 'dClingy', 'dJealous', 'dRomantic', 'dEmotive', 'intimate', 'wake', 'sleep', 'city', 'greeting', 'samples'];
function wbFieldId(f) { return 'wb' + f.charAt(0).toUpperCase() + f.slice(1); }
function loadWBForm(d) {
    d = d || {};
    WB_FIELDS.forEach(f => { const el = $(wbFieldId(f)); if (el) el.value = d[f] || ''; });
    setChips('wbTone', d.tone || []);
    wbEntries = (d.entries || []).map(x => Object.assign({}, x));
    resetEntryForm();
    renderWBEntries();
}
function readWBForm() {
    const d = { tone: chipVals('wbTone'), entries: wbEntries.slice() };
    WB_FIELDS.forEach(f => { const el = $(wbFieldId(f)); d[f] = el ? el.value : ''; });
    return d;
}
function openWorldEdit(id) {
    wbEditingId = id;
    const isGlobal = id === 'global', isNew = id === 'new';
    const w = (isGlobal || isNew) ? null : getWorld(id);
    if (!isGlobal && !isNew && !w) { showWBList(); return; }
    const d = isGlobal ? getGlobalWorld() : (w ? (w.data || {}) : {});
    $('wbListPane').classList.add('hidden');
    $('wbEditPane').classList.remove('hidden');
    $('wbTitle').textContent = isGlobal ? '通用设定' : (isNew ? '新建世界书' : w.name);
    $('wbName').value = isGlobal ? '通用设定' : (w ? w.name : '');
    $('wbName').disabled = isGlobal;
    $('wbNameRow').classList.toggle('hidden', isGlobal);
    $('wbBindBox').classList.toggle('hidden', isGlobal);
    $('wbDeleteBtn').classList.toggle('hidden', isGlobal || isNew);
    $('wbCopyBtn').classList.toggle('hidden', isGlobal || isNew);
    $('worldbookStatus').textContent = '';
    const chars = getChars(), box = $('wbBindChars');
    box.innerHTML = chars.length ? chars.map(c => '<button type="button" class="chip' + ((!isNew && worldIdsOfChar(c).indexOf(id) >= 0) ? ' on' : '') + '" data-v="' + escapeHtml(c.id) + '">' + escapeHtml(c.name) + '</button>').join('') : '<p class="empty-tip">还没有角色，先去通讯录创建</p>';
    box.onclick = (e) => { const b = e.target.closest('.chip'); if (b) b.classList.toggle('on'); };
    loadWBForm(d);
    updateWBStats();
    const sc = document.querySelector('#worldbookApp .scroll-area'); if (sc) sc.scrollTop = 0;
}
on('saveWorldbookBtn', 'click', () => {
    const d = readWBForm();
    const st = $('worldbookStatus');
    const flash = (t) => { if (st) { st.textContent = t; setTimeout(() => { if (st.textContent === t) st.textContent = ''; }, 2500); } };
    if (wbEditingId === 'global') { if (saveGlobalWorld(d)) flash('通用设定已保存！'); return; }
    const name = (($('wbName') || {}).value || '').trim() || '未命名世界';
    const ws = getWorlds();
    let w;
    if (wbEditingId === 'new') { w = { id: 'world_' + Date.now(), name: name, data: d }; ws.push(w); wbEditingId = w.id; }
    else { w = ws.find(x => x.id === wbEditingId); if (!w) return; w.name = name; w.data = d; }
    if (!saveWorlds(ws)) return;
    const picked = Array.prototype.map.call($('wbBindChars').querySelectorAll('.chip.on'), b => b.getAttribute('data-v'));
    const chars = getChars();
    chars.forEach(c => {
        const has = worldIdsOfChar(c).indexOf(w.id) >= 0, want = picked.indexOf(c.id) >= 0;
        if (want && !has) c.worldIds = worldIdsOfChar(c).concat([w.id]);
        if (!want && has) c.worldIds = c.worldIds.filter(x => x !== w.id);
    });
    saveChars(chars);
    $('wbTitle').textContent = name;
    $('wbDeleteBtn').classList.remove('hidden');
    $('wbCopyBtn').classList.remove('hidden');
    flash('世界书已保存！');
});
on('wbDeleteBtn', 'click', async () => {
    const w = getWorld(wbEditingId); if (!w) return;
    if (!(await uiConfirm('确定删除世界书「' + w.name + '」吗？使用它的角色会解除绑定。'))) return;
    saveWorlds(getWorlds().filter(x => x.id !== w.id));
    const chars = getChars();
    chars.forEach(c => { if (worldIdsOfChar(c).indexOf(w.id) >= 0) c.worldIds = c.worldIds.filter(x => x !== w.id); });
    saveChars(chars);
    const gs = getGroups();
    gs.forEach(g => { if (g.worldIds) g.worldIds = g.worldIds.filter(x => x !== w.id); });
    saveGroups(gs);
    showWBList();
});

// ---- 角色卡里的"所在世界" ----
function renderCardWorlds(selected) {
    const box = document.getElementById('cardWorlds'); if (!box) return;
    selected = selected || [];
    const ws = getWorlds();
    if (!ws.length) { box.innerHTML = '<span class="hint-line">还没有世界书，可在 设置 → 世界书 里新建</span>'; box.onclick = null; return; }
    box.innerHTML = ws.map(w => '<button type="button" class="chip' + (selected.indexOf(w.id) >= 0 ? ' on' : '') + '" data-v="' + escapeHtml(w.id) + '">' + escapeHtml(w.name) + '</button>').join('');
    box.onclick = (e) => { const b = e.target.closest('.chip'); if (b) b.classList.toggle('on'); };
}

// ---- 群聊绑定世界书 ----
function editGroupWorlds() {
    const g = getGroup(currentGroupId); if (!g) return;
    const ws = getWorlds(), box = $('worldPickChips');
    box.innerHTML = ws.length ? ws.map(w => '<button type="button" class="chip' + ((g.worldIds || []).indexOf(w.id) >= 0 ? ' on' : '') + '" data-v="' + escapeHtml(w.id) + '">' + escapeHtml(w.name) + '</button>').join('') : '<p class="empty-tip">还没有世界书，先去 设置 → 世界书 新建</p>';
    box.onclick = (e) => { const b = e.target.closest('.chip'); if (b) b.classList.toggle('on'); };
    $('worldPickModal').classList.remove('hidden');
}
on('worldPickCancel', 'click', () => $('worldPickModal').classList.add('hidden'));
on('worldPickOk', 'click', () => {
    const ids = Array.prototype.map.call($('worldPickChips').querySelectorAll('.chip.on'), b => b.getAttribute('data-v'));
    const gs = getGroups(), g = gs.find(x => x.id === currentGroupId);
    if (!g) return;
    g.worldIds = ids; saveGroups(gs);
    $('worldPickModal').classList.add('hidden');
    renderGroupDetail();
});

// ---- 读取文件文本（txt / md / json / docx） ----
async function readFileText(file) {
    const name = (file.name || '').toLowerCase();
    if (name.endsWith('.docx')) return extractDocxText(file);
    if (window.CardImport && CardImport.read) return CardImport.read(file); // 自动识别 GBK / UTF-16 / html / rtf 等编码和格式
    return file.text();
}
async function extractDocxText(file) {
    const buf = new Uint8Array(await file.arrayBuffer());
    const dv = new DataView(buf.buffer);
    let eocd = -1;
    for (let i = buf.length - 22; i >= Math.max(0, buf.length - 70000); i--) { if (dv.getUint32(i, true) === 0x06054b50) { eocd = i; break; } }
    if (eocd < 0) throw new Error('不是有效的 docx 文件');
    const count = dv.getUint16(eocd + 10, true);
    let p = dv.getUint32(eocd + 16, true), target = null;
    for (let n = 0; n < count; n++) {
        if (dv.getUint32(p, true) !== 0x02014b50) break;
        const method = dv.getUint16(p + 10, true), csize = dv.getUint32(p + 20, true);
        const nlen = dv.getUint16(p + 28, true), elen = dv.getUint16(p + 30, true), clen = dv.getUint16(p + 32, true), lho = dv.getUint32(p + 42, true);
        const fname = new TextDecoder().decode(buf.subarray(p + 46, p + 46 + nlen));
        if (fname === 'word/document.xml') { target = { method: method, csize: csize, lho: lho }; break; }
        p += 46 + nlen + elen + clen;
    }
    if (!target) throw new Error('docx 里没有找到正文');
    const start = target.lho + 30 + dv.getUint16(target.lho + 26, true) + dv.getUint16(target.lho + 28, true);
    const data = buf.subarray(start, start + target.csize);
    let bytes;
    if (target.method === 0) bytes = data;
    else {
        if (typeof DecompressionStream === 'undefined') throw new Error('当前浏览器读不了 docx，请另存为 txt 后再导入');
        bytes = new Uint8Array(await new Response(new Blob([data]).stream().pipeThrough(new DecompressionStream('deflate-raw'))).arrayBuffer());
    }
    let xml = new TextDecoder().decode(bytes);
    xml = xml.replace(/<w:p[ >][\s\S]*?<\/w:p>/g, (p) => /<w:pStyle w:val="(?:Heading|Title|heading|标题)/.test(p) ? '\n# ' + p.replace(/<w:tab\/>/g, ' ').replace(/<[^>]+>/g, '') + '\n' : p + '');
    return xml.replace(/<\/w:tc>/g, '\t').replace(/<\/w:tr>/g, '\n')
        .replace(/<\/w:p>/g, '\n').replace(/<w:tab\/>/g, '\t').replace(/<w:br[^>]*\/>/g, '\n').replace(/<[^>]+>/g, '')
        .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, '&')
        .replace(/\t+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
}
// ---------- 文本 → 词条（识别「作者说明 + 以下复制 + <xml指令块>」这类常见世界书/预设格式） ----------
// 找出顶层的 <标签 …>…</标签> 块（支持同名嵌套），返回 [{tag, attrs, raw, start, end}]
function xmlTopBlocks(text) {
    const out = [], re = /<([A-Za-z_一-龥][\w:.\-一-龥]*)((?:\s+[^<>]*?)?)\s*(\/?)>/g;
    let m;
    while ((m = re.exec(text))) {
        if (m[3]) { re.lastIndex = m.index + m[0].length; continue; }          // 自闭合
        const tag = m[1], start = m.index, esc = tag.replace(/[.\-:]/g, '\\$&');
        const tagRe = new RegExp('<(/?)' + esc + '(?:\\s[^<>]*)?(/?)>', 'g'); tagRe.lastIndex = start; // 从开标签起数深度
        let depth = 0, t, end = -1;
        while ((t = tagRe.exec(text))) { if (t[2]) continue; depth += t[1] ? -1 : 1; if (depth === 0) { end = t.index + t[0].length; break; } }
        if (end < 0) { re.lastIndex = start + m[0].length; continue; }          // 没闭合：忽略这个标签
        out.push({ tag: tag, attrs: m[2] || '', raw: text.slice(start, end), start: start, end: end });
        re.lastIndex = end;
    }
    return out;
}
function attrOf(attrs, name) { const m = new RegExp(name + '\\s*=\\s*["“]([^"”]*)["”]', 'i').exec(attrs || ''); return m ? m[1].trim() : ''; }
// 从作者说明里读出：常驻/关键词、位置、优先级、场景
function settingsFromNote(note) {
    const o = {}, n = String(note || '');
    if (/常驻|一直生效|始终生效/.test(n)) o.mode = 'const';
    const d = /深度\s*(\d{1,2})/.exec(n);
    if (d) { o.pos = 'depth'; o.depth = Math.max(1, Math.min(40, +d[1])); }
    else if (/角色设定后|设定后|角色卡后|放在设定区|系统提示/.test(n)) o.pos = 'system';
    const p = /优先级\s*[:：]?\s*(最高|很高|较高|高|中|低|\d{1,4})/.exec(n);
    if (p) o.prio = /^\d/.test(p[1]) ? +p[1] : /最高|很高/.test(p[1]) ? 300 : /高/.test(p[1]) ? 200 : /中/.test(p[1]) ? 100 : 50;
    if (/仅线上|只在线上|线上专用/.test(n)) o.scene = 'online'; else if (/仅线下|只在线下|线下专用/.test(n)) o.scene = 'offline';
    return o;
}
function cleanTitle(l) {
    return String(l || '').replace(/^[#\s>*\-—]+/, '').replace(/^[《【\[「]|[》】\]」]$/g, '').replace(/[*_`]/g, '').trim();
}
function textToEntries(text, fallbackName) {
    const src = String(text).replace(/\r/g, '').replace(/ /g, ' ').trim();
    const lines = src.split('\n');
    // 1) 说明区 / 正文区：「以下复制」「正文开始」之类的分隔行；没有的话，第一个 XML 块之前的文字当说明
    const MARK = /^[\s\-—–_*#>]*(?:以下|下面|↓|⬇)?\s*(?:开始)?\s*(?:复制|正文|指令内容|提示词内容|内容如下)\s*[:：↓⬇]*\s*[\-—–_*]*\s*$/;
    let mi = lines.findIndex(l => MARK.test(l.trim()) && l.trim().length <= 14);
    let pre = '', body = src;
    if (mi >= 0) { pre = lines.slice(0, mi).join('\n').trim(); body = lines.slice(mi + 1).join('\n').trim(); }
    let blocks = xmlTopBlocks(body);
    if (mi < 0 && blocks.length) {
        const before = body.slice(0, blocks[0].start).trim();
        if (before) { pre = before; body = body.slice(blocks[0].start); blocks = xmlTopBlocks(body); }
    }
    const note = pre, cfg = settingsFromNote(pre);
    const titleLine = pre.split('\n').map(cleanTitle).filter(Boolean)[0] || '';
    const mk = (key, txt, extra) => Object.assign({ key: String(key || fallbackName).slice(0, 30), text: txt, keys: '', cat: '设定', note: note }, cfg, extra || {});
    // 2) 正文是 XML 块：一个块 = 一条词条（不拆散里面的小标签，保证整条指令完整）
    if (blocks.length) {
        const rest = (body.slice(0, blocks[0].start) + ' ' + body.slice(blocks[blocks.length - 1].end)).trim();
        if (blocks.length === 1) {
            const b = blocks[0];
            return [mk(titleLine || attrOf(b.attrs, 'id') || b.tag, (rest ? rest + '\n\n' : '') + b.raw)];
        }
        return blocks.map((b, i) => mk(attrOf(b.attrs, 'id') || attrOf(b.attrs, 'name') || b.tag + (blocks.filter(x => x.tag === b.tag).length > 1 ? (i + 1) : ''), b.raw));
    }
    // 3) 普通文字：按标题拆（# 标题 / 【标题】 / 《标题》 / [标题]），没有标题就整份一条
    const re = /^\s*(?:#{1,4}\s+(.+?)|【([^】]{1,80})】|《([^》]{1,80})》|\[([^\]]{1,80})\])\s*$/;
    const bl = body.split('\n'), heads = [];
    bl.forEach((ln, i) => { const m = re.exec(ln); if (m) heads.push({ i: i, name: (m[1] || m[2] || m[3] || m[4]).trim() }); });
    const out = [];
    if (heads.length >= 2) {
        const p0 = bl.slice(0, heads[0].i).join('\n').trim();
        if (p0) out.push(mk(titleLine || fallbackName, p0));
        heads.forEach((h, k) => {
            const t = bl.slice(h.i + 1, k + 1 < heads.length ? heads[k + 1].i : bl.length).join('\n').trim();
            if (t) out.push(mk(h.name, t));
        });
    }
    if (!out.length) out.push(mk(titleLine || fallbackName, body.trim()));
    return out;
}
// 兼容常见格式的世界书 JSON / 角色卡内嵌世界书
function entriesFromJson(obj) {
    const src = obj && (obj.entries || (obj.data && obj.data.character_book && obj.data.character_book.entries) || (obj.character_book && obj.character_book.entries));
    if (!src) return null;
    const arr = Array.isArray(src) ? src : Object.keys(src).map(k => src[k]);
    const out = [];
    arr.forEach(e => {
        if (!e || e.disable === true || e.enabled === false) return;
        const content = String(e.content || e.text || '').trim(); if (!content) return;
        const ks = [].concat(e.keys || e.key || []).map(x => String(x).trim()).filter(Boolean);
        const title = String(e.comment || e.name || ks[0] || '词条').trim();
        const o = { key: title.slice(0, 30), text: content, keys: e.constant === true ? '' : ks.join(','), cat: '设定' };
        const rx = ks.length === 1 && /^\/(.+)\/[a-z]*$/i.exec(ks[0]);
        if (e.constant !== true && rx && entryRegex(rx[1])) { o.mode = 'regex'; o.keys = rx[1]; }
        const ext = e.extensions || {};
        if ((ext.position === 4 || e.position === 4) && isFinite(+(ext.depth != null ? ext.depth : e.depth))) { o.pos = 'depth'; o.depth = Math.max(1, Math.min(40, Math.round(+(ext.depth != null ? ext.depth : e.depth)) || 4)); }
        const pr = e.insertion_order != null ? e.insertion_order : e.order; if (isFinite(+pr) && pr !== null && pr !== '') o.prio = +pr;
        out.push(o);
    });
    return out;
}
async function parseWorldFile(file) {
    const base = (file.name || '导入的世界书').replace(/\.[^.]+$/, '');
    const t = (await readFileText(file)).trim();
    if (!t) throw new Error('文件里没有内容');
    if (/^[\[{]/.test(t)) {
        let obj = null; try { obj = JSON.parse(t); } catch (e) {}
        if (obj) {
            const list = Array.isArray(obj) ? obj : [obj];
            if (list.length && list.every(b => b && b.format === 'xsj-world' && b.data)) return list.map(b => ({ name: b.name || base, data: b.data }));
            const ents = entriesFromJson(obj);
            if (ents && ents.length) return [{ name: String(obj.name || base), data: { entries: ents } }];
            if (ents) throw new Error('这个 JSON 里没有可用的词条');
        }
    }
    const ents = textToEntries(t, base);
    return [{ name: (ents.length === 1 && ents[0].note && ents[0].key) ? ents[0].key : base, data: { entries: ents } }];
}
on('wbImportBtn', 'click', () => $('wbImportFile').click());
on('wbImportFile', 'change', async (e) => {
    const fs = Array.prototype.slice.call(e.target.files || []); e.target.value = ''; if (!fs.length) return;
    try {
        let books = [];
        for (const f of fs) { try { books = books.concat(await parseWorldFile(f)); } catch (err) { if (fs.length === 1) throw err; uiAlert('「' + f.name + '」导入失败：' + err.message); } }
        if (!books.length) return;
        const ws = getWorlds(); let last = null;
        books.forEach(b => { last = { id: 'world_' + Date.now() + Math.random().toString(36).slice(2, 5), name: String(b.name || '导入的世界书').slice(0, 20), data: b.data }; ws.push(last); });
        if (!saveWorlds(ws)) return;
        renderWBList();
        if (books.length === 1) openWorldEdit(last.id);
        uiAlert('已导入 ' + books.length + ' 本世界书' + (books.length === 1 ? '，共 ' + ((last.data.entries || []).length) + ' 条词条，可以检查后再绑定角色。' : '。'));
    } catch (err) { uiAlert('导入失败：' + err.message); }
});
on('wbEntryImportBtn', 'click', () => $('wbEntryFile').click());
on('wbEntryFile', 'change', async (e) => {
    const fs = Array.prototype.slice.call(e.target.files || []); e.target.value = ''; if (!fs.length) return;
    try {
        let books = [];
        for (const f of fs) books = books.concat(await parseWorldFile(f));
        let n = 0;
        books.forEach(b => (b.data.entries || []).forEach(en => { wbEntries.push(Object.assign({}, en, { keys: en.keys || '', cat: en.cat || '设定' })); n++; }));
        renderWBEntries();
        uiAlert('已加入 ' + n + ' 条词条，记得点保存。');
    } catch (err) { uiAlert('导入失败：' + err.message); }
});
on('wbExportBtn', 'click', () => {
    const d = readWBForm();
    const name = wbEditingId === 'global' ? '通用设定' : ((($('wbName') || {}).value || '').trim() || '世界书');
    const blob = new Blob([JSON.stringify({ format: 'xsj-world', version: 1, name: name, data: d }, null, 2)], { type: 'application/json' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = '世界书_' + name + '.json';
    document.body.appendChild(a); a.click(); a.remove();
});
on('wbCopyBtn', 'click', () => {
    const w = getWorld(wbEditingId); if (!w) return;
    const ws = getWorlds();
    const c = { id: 'world_' + Date.now(), name: (w.name + ' 副本').slice(0, 20), data: JSON.parse(JSON.stringify(w.data || {})) };
    ws.push(c); saveWorlds(ws); openWorldEdit(c.id);
});
function updateWBStats() {
    const el = $('wbStats'); if (!el) return;
    const n = composeWB(readWBForm(), '').length;
    const keyed = wbEntries.filter(e => e.on !== false && entryMode(e) !== 'const' && String(e.keys || '').trim()).length;
    el.textContent = '每次对话固定占用约 ' + n + ' 字' + (keyed ? '（另有 ' + keyed + ' 条词条，聊到触发词才会加入）' : '') + (n > 3000 ? '。内容偏多会多花 token，建议给长词条加上触发词。' : '。');
}
on('wbEditPane', 'input', updateWBStats);
on('wbEditPane', 'change', updateWBStats);

// ---- 开场白：新聊天第一次打开时，TA 先说话 ----
function worldGreetingFor(c) {
    const ws = getWorlds();
    for (const id of worldIdsOfChar(c)) {
        const w = ws.find(x => x.id === id);
        if (w && w.data && String(w.data.greeting || '').trim()) return String(w.data.greeting).trim();
    }
    return '';
}
function maybeGreet(charId) {
    const c = getChar(charId); if (!c || (c.chatHistory || []).length) return;
    let g = worldGreetingFor(c); if (!g) return;
    const myN = store.getItem('myName'); g = g.replace(/\{\{user\}\}/g, (myN && myN !== '我') ? myN : '你').replace(/\{\{char\}\}/g, c.name);
    g.split(/\n+/).map(x => x.trim()).filter(Boolean).forEach(seg => pushHistory(charId, { role: 'assistant', content: seg }));
}

function initWorldbook() {
    fillSelect('wbType', WB.type, true);
    fillSelect('wbEra', WB.era, true);
    fillSelect('wbStage', WB.stage, true);
    fillSelect('wbMeet', WB.meet, true);
    fillSelect('wbLen', ['简短（1-2句）', '适中（2-4句）', '细腻（一小段）'], true);
    fillSelect('wbAction', ['不用', '偶尔', '经常'], true);
    fillSelect('wbKaomoji', ['不用', '偶尔', '经常'], true);
    fillSelect('wbExist', WB_EXIST, true);
    fillSelect('wbAware', WB_AWARE, true);
    Object.keys(WB_DIALS).forEach(k => fillSelect(wbFieldId(k), WB_LEVEL, true));
    fillSelect('wbIntimate', WB_INTIMATE, true);
    fillSelect('wbEntryCat', WB_CATS, false);
    renderChips('wbTone', WB.tone, true);
    migrateWorldbook();
    showWBList();
}

// ---------- 28. 初始化 ----------
initTheme();
applyUI();
renderUIControls();
loadProfile();
loadCharacterCard();
renderContacts();
renderChatList();
renderPrivacy();
renderMerchants();
renderProducts(products, 'productList');
renderAllPickers();
initWizard();
initWorldbook();
initMcp();
updateLockWidgets();

(function(){ if(store.estimate) store.estimate().then(function(e){ var el=document.getElementById('storageInfo'); if(el&&e&&e.quota){ el.textContent='存储空间：已用 '+(e.usage/1048576).toFixed(1)+' MB / 可用约 '+(e.quota/1048576>1024?(e.quota/1073741824).toFixed(1)+' GB':(e.quota/1048576).toFixed(0)+' MB'); } }); })();

// ---------- 29. TA的生活 · 陪伴功能（日程 / 打卡 / 专注 / 纪念日 / 约定 / 信箱·时间胶囊） ----------
function lifeOf(c) { c.life = c.life || {}; const L = c.life; L.plan = L.plan || null; L.checkin = L.checkin || { morning: [], night: [] }; L.days = L.days || []; L.vows = L.vows || []; L.mail = L.mail || []; L.focus = L.focus || { sessions: [] }; if (L.nest === undefined) L.nest = null; return L; }
function lifeUpdate(charId, fn) { const chars = getChars(); const c = chars.find(x => x.id === charId); if (!c) return null; const r = fn(lifeOf(c), c); saveChars(chars); return r; }
function needKey() { if (!API_KEY) { uiAlert('需要先在「设置」里填好 API Key，TA 才能开口哦'); return true; } return false; }
const dayNum = (s) => { const p = String(s).split('-').map(Number); return Math.round(Date.UTC(p[0], p[1] - 1, p[2]) / 864e5); };
function addDays(s, n) { const d = new Date(dayNum(s) * 864e5 + n * 864e5); return d.getUTCFullYear() + '-' + pad2(d.getUTCMonth() + 1) + '-' + pad2(d.getUTCDate()); }
function lifeId() { return 'l' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5); }
function fmtTs(ts) { const d = new Date(ts); return (d.getMonth() + 1) + '月' + d.getDate() + '日 ' + pad2(d.getHours()) + ':' + pad2(d.getMinutes()); }

// ---- 纪念日计算 ----
function dayInfo(d, today) {
    today = today || todayStr();
    const t = dayNum(today); let target = dayNum(d.date), kind;
    if (d.yearly) {
        const p = d.date.split('-').map(Number), y = Number(today.slice(0, 4));
        let n = dayNum(y + '-' + pad2(p[1]) + '-' + pad2(p[2])); if (n < t) n = dayNum((y + 1) + '-' + pad2(p[1]) + '-' + pad2(p[2]));
        const years = Math.round((n - dayNum(d.date)) / 365.25);
        return { diff: n - t, text: n === t ? '就是今天！' + (years > 0 ? '（第' + years + '年）' : '') : '还有 ' + (n - t) + ' 天' + (years > 0 ? '（第' + years + '年）' : '') };
    }
    const diff = target - t;
    return { diff: diff, text: diff > 0 ? '还有 ' + diff + ' 天' : diff === 0 ? '就是今天！' : '已经 ' + (-diff) + ' 天' };
}
function lifeContext(c) {
    const L = lifeOf(c); let t = '';
    const today = todayStr();
    if (L.plan && L.plan.date === today && L.plan.items.length) { const cur = currentPlanItem(L.plan); if (cur) t += '\n【TA此刻的安排】' + cur.t + ' ' + cur.e + '（回复时可自然地带到自己正在做的事）'; }
    const near = L.days.map(d => ({ d: d, i: dayInfo(d, today) })).filter(x => x.i.diff >= 0 && x.i.diff <= 3);
    if (near.length) t += '\n【临近的纪念日】' + near.map(x => x.d.name + '（' + x.i.text + '）').join('；') + '。如果自然，可以提起。';
    const open = L.vows.filter(v => !v.done).slice(0, 4).map(v => v.text);
    if (open.length) t += '\n【我们的约定（还没完成）】' + open.join('；');
    if (L.nest) { const nn = L.nest; const st = nestKind(nn).stats.map(x => x[1] + Math.round(nn.s[x[0]])).join(' '); t += '\n【我们一起养的' + (nn.kind === 'plant' ? '植物' : '宠物') + '】' + nn.name + '（' + nestType(nn).n + ' Lv.' + (nn.lv || 1) + '，' + st + '）。可以自然地聊到它。'; }
    const ci = L.checkin; const sm = streakOf(ci.morning), sn = streakOf(ci.night);
    if (sm >= 2 || sn >= 2) t += '\n【打卡】我们已连续早安 ' + sm + ' 天、晚安 ' + sn + ' 天。';
    return t;
}
function currentPlanItem(plan) {
    const now = pad2(new Date().getHours()) + ':' + pad2(new Date().getMinutes()); let cur = null;
    plan.items.forEach(it => { if (it.t <= now) cur = it; }); return cur;
}
function streakOf(arr) {
    const set = new Set(arr || []); let d = todayStr(); if (!set.has(d)) d = addDays(d, -1); let n = 0;
    while (set.has(d)) { n++; d = addDays(d, -1); } return n;
}

// ---- 日程 ----
const DEFAULT_PLAN = [['07:30', '起床，慢吞吞地洗漱'], ['09:00', '开始一天的事情'], ['12:30', '吃午饭，顺便刷刷手机'], ['15:00', '午后有点困，喝杯咖啡'], ['18:30', '收工，往家走'], ['20:00', '吃完饭，窝着放松'], ['23:00', '准备睡觉，想着你']];
async function generatePlan(charId, force) {
    const c = getChar(charId); if (!c) return;
    const today = todayStr(); const L = lifeOf(c);
    if (!force && L.plan && L.plan.date === today) return;
    if (!API_KEY) { lifeUpdate(charId, l => { l.plan = { date: today, items: DEFAULT_PLAN.map(x => ({ t: x[0], e: x[1] })), auto: true }; }); return; }
    window._planBusy = charId; if (mcpTab === 'plan') renderPlan();
    try {
        const text = await callPersona(charId, timeContext() + '\n请按你的人设（职业、作息、性格）安排你今天从早到晚的日程，6-8条，时间递增、符合你的生活。只输出JSON数组：[{"t":"07:30","e":"做什么（15字内，有生活感）"}]', 0.9);
        let arr = parseJSONLoose(text); if (!Array.isArray(arr)) arr = [];
        arr = arr.filter(x => x && /^\d{1,2}:\d{2}$/.test(String(x.t)) && x.e).map(x => ({ t: pad2(String(x.t).split(':')[0]) + ':' + String(x.t).split(':')[1], e: String(x.e) })).sort((a, b) => a.t < b.t ? -1 : 1);
        lifeUpdate(charId, l => { l.plan = { date: today, items: arr.length >= 3 ? arr : DEFAULT_PLAN.map(x => ({ t: x[0], e: x[1] })) }; });
    } catch (e) { uiAlert('日程生成失败：' + e.message); }
    window._planBusy = null; if (mcpTab === 'plan') renderPlan();
}
function renderPlan() {
    const box = $('mcpPlanList'); if (!box) return;
    const id = getActiveCharId(), c = id ? getChar(id) : null;
    if (!c) { box.innerHTML = '<p class="empty-tip">先创建角色吧~</p>'; return; }
    const L = lifeOf(c);
    if (window._planBusy === id) { box.innerHTML = '<p class="empty-tip">TA 正在安排今天的日程...</p>'; return; }
    if (!L.plan || L.plan.date !== todayStr()) { box.innerHTML = '<p class="empty-tip">今天的日程还没安排</p>'; return; }
    const cur = currentPlanItem(L.plan);
    box.innerHTML = '<div class="plan-line">' + L.plan.items.map(it => '<div class="plan-item' + (cur === it ? ' now' : '') + '"><span class="plan-t">' + escapeHtml(it.t) + '</span><span class="plan-e">' + escapeHtml(it.e) + '</span>' + (cur === it ? '<i class="plan-now">现在</i>' : '') + '</div>').join('') + '</div>' + (L.plan.auto ? '<p class="hint-line">（没填 API Key，这是默认日程。填好后点上面的按钮，TA 会按自己的人设重新安排）</p>' : '');
}
on('mcpPlanBtn', 'click', () => { const id = getActiveCharId(); if (!id) return; if (needKey()) return; generatePlan(id, true); });

// ---- 陪伴：早安晚安 / 专注 ----
function renderCare() {
    const id = getActiveCharId(), c = id ? getChar(id) : null; const box = $('mcpCareStreak'); if (!box) return;
    if (!c) { box.innerHTML = '<p class="empty-tip">先创建角色吧~</p>'; return; }
    const L = lifeOf(c), today = todayStr(); const mDone = L.checkin.morning.includes(today), nDone = L.checkin.night.includes(today);
    box.innerHTML = '<div class="care-row"><div class="care-cell"><b>' + streakOf(L.checkin.morning) + '</b><span>早安连续天数</span></div><div class="care-cell"><b>' + streakOf(L.checkin.night) + '</b><span>晚安连续天数</span></div><div class="care-cell"><b>' + L.focus.sessions.filter(s => s.date === today).reduce((a, s) => a + s.min, 0) + '</b><span>今日专注(分钟)</span></div></div>';
    $('mcpMorningBtn').textContent = mDone ? '今天已道早安 ✓' : '☀ 说早安'; $('mcpMorningBtn').disabled = mDone;
    $('mcpNightBtn').textContent = nDone ? '今天已道晚安 ✓' : '☾ 说晚安'; $('mcpNightBtn').disabled = nDone;
    const last = L.lastGreeting; $('mcpCareReply').innerHTML = last ? '<div class="care-reply"><span class="care-who">' + escapeHtml(c.name) + '</span>' + escapeHtml(last.text) + '</div>' : '';
}
async function doCheckin(kind) {
    const id = getActiveCharId(); if (!id) return; if (needKey()) return;
    const today = todayStr(), c = getChar(id), L = lifeOf(c);
    if (L.checkin[kind].includes(today)) return;
    lifeUpdate(id, l => { l.checkin[kind].push(today); l.checkin[kind] = l.checkin[kind].slice(-400); });
    bumpMood(id, 3); addIntimacy(id, 2);
    const s = streakOf(getChar(id).life.checkin[kind]); renderCare();
    $('mcpCareReply').innerHTML = '<p class="empty-tip">TA 正在回你...</p>';
    try {
        const t = await callPersona(id, timeContext() + '\n我对你说了' + (kind === 'morning' ? '早安' : '晚安') + '，这是我们连续第' + s + '天了。用你的语气简短回应（1-3句，口语，自然带点你此刻的状态）。只输出你说的话。', 1.0);
        lifeUpdate(id, l => { l.lastGreeting = { text: oneLine(t), ts: Date.now() }; });
    } catch (e) { uiAlert('TA 没听清：' + e.message); }
    renderCare();
}
on('mcpMorningBtn', 'click', () => doCheckin('morning'));
on('mcpNightBtn', 'click', () => doCheckin('night'));

let focusT = null, focusEnd = 0, focusMin = 0, focusChar = null;
function renderFocus() {
    const btn = $('mcpFocusBtn'), disp = $('mcpFocusTime'); if (!btn) return;
    if (focusT) { const left = Math.max(0, Math.round((focusEnd - Date.now()) / 1000)); disp.textContent = pad2(Math.floor(left / 60)) + ':' + pad2(left % 60); btn.textContent = '放弃本次专注'; btn.className = 'btn-secondary'; $('mcpFocusSel').disabled = true; }
    else { disp.textContent = pad2($('mcpFocusSel').value) + ':00'; btn.textContent = '开始一起专注'; btn.className = 'btn-primary'; $('mcpFocusSel').disabled = false; }
}
async function startFocus() {
    if (focusT) { clearInterval(focusT); focusT = null; renderFocus(); uiAlert('已放弃，下次再一起加油～'); return; }
    const id = getActiveCharId(); if (!id) { uiAlert('先创建一个角色'); return; }
    focusMin = parseInt($('mcpFocusSel').value, 10) || 25; focusChar = id; focusEnd = Date.now() + focusMin * 60000;
    focusT = setInterval(() => { if (Date.now() >= focusEnd) finishFocus(); else renderFocus(); }, 1000); renderFocus();
    if (API_KEY) { try { const t = await callPersona(id, timeContext() + '\n我要开始专注' + focusMin + '分钟（学习/工作），你陪着我。用你的语气说一句简短的鼓励，不超过25字。只输出这句话。', 1.0); $('mcpFocusSay').textContent = '「' + oneLine(t) + '」'; } catch (e) {} } else $('mcpFocusSay').textContent = '「我陪着你，加油～」';
}
async function finishFocus() {
    clearInterval(focusT); focusT = null; const id = focusChar, min = focusMin;
    lifeUpdate(id, l => { l.focus.sessions.push({ date: todayStr(), min: min, ts: Date.now() }); l.focus.sessions = l.focus.sessions.slice(-300); });
    bumpMood(id, 4); addIntimacy(id, 3); renderFocus(); renderCare();
    $('mcpFocusSay').textContent = '专注完成！TA 在夸你...';
    let say = '辛苦啦，你真的很棒！';
    if (API_KEY) { try { say = oneLine(await callPersona(id, timeContext() + '\n我刚刚认真专注了' + min + '分钟，你一直陪着我。用你的语气夸夸我并关心一句（不超过40字）。只输出你说的话。', 1.0)); } catch (e) {} }
    $('mcpFocusSay').textContent = '「' + say + '」'; uiAlert('专注 ' + min + ' 分钟完成 ✓');
}
on('mcpFocusBtn', 'click', startFocus);
on('mcpFocusSel', 'change', renderFocus);

// ---- 纪念日 ----
function renderDays() {
    const box = $('mcpDaysList'); if (!box) return;
    const id = getActiveCharId(), c = id ? getChar(id) : null;
    if (!c) { box.innerHTML = '<p class="empty-tip">先创建角色吧~</p>'; return; }
    const L = lifeOf(c);
    const arr = L.days.map(d => ({ d: d, i: dayInfo(d) })).sort((a, b) => (a.i.diff < 0 ? 1e6 - a.i.diff : a.i.diff) - (b.i.diff < 0 ? 1e6 - b.i.diff : b.i.diff));
    box.innerHTML = arr.length ? arr.map(x => '<div class="day-card' + (x.i.diff === 0 ? ' today' : '') + '"><div class="day-main"><div class="day-name">' + escapeHtml(x.d.name) + '</div><div class="day-date">' + escapeHtml(x.d.date) + (x.d.yearly ? ' · 每年' : '') + '</div></div><div class="day-cnt">' + escapeHtml(x.i.text) + '</div><button class="day-del" data-del="' + x.d.id + '">×</button></div>').join('') : '<p class="empty-tip">还没有纪念日，添加第一个吧（比如在一起的日子、TA 的生日）</p>';
}
on('mcpDayAddBtn', 'click', () => {
    const id = getActiveCharId(); if (!id) return; const name = $('mcpDayName').value.trim(), date = $('mcpDayDate').value;
    if (!name || !date) { uiAlert('名字和日期都要填哦'); return; }
    lifeUpdate(id, l => { l.days.push({ id: lifeId(), name: name, date: date, yearly: $('mcpDayYearly').checked }); });
    $('mcpDayName').value = ''; renderDays(); uiAlert('已添加');
});
on('mcpDaysList', 'click', async (e) => {
    const b = e.target.closest('.day-del'); if (!b) return; const id = getActiveCharId();
    if (!(await uiConfirm('删除这个纪念日吗？'))) return;
    lifeUpdate(id, l => { l.days = l.days.filter(d => d.id !== b.getAttribute('data-del')); }); renderDays();
});

// ---- 约定 ----
function renderVows() {
    const box = $('mcpVowList'); if (!box) return;
    const id = getActiveCharId(), c = id ? getChar(id) : null;
    if (!c) { box.innerHTML = '<p class="empty-tip">先创建角色吧~</p>'; return; }
    const v = lifeOf(c).vows;
    box.innerHTML = v.length ? v.map(x => '<div class="vow-item' + (x.done ? ' done' : '') + '"><input type="checkbox" data-vow="' + x.id + '"' + (x.done ? ' checked' : '') + '><div class="vow-main"><div class="vow-text">' + escapeHtml(x.text) + '</div><div class="vow-by">' + (x.by === 'ta' ? 'TA 提的' : '我提的') + ' · ' + fmtTs(x.ts) + (x.done ? ' · 已完成 ✓' : '') + '</div></div><button class="day-del" data-vdel="' + x.id + '">×</button></div>').join('') : '<p class="empty-tip">还没有约定。写下你们想一起做的事，做到了就打勾～</p>';
}
on('mcpVowAddBtn', 'click', () => {
    const id = getActiveCharId(); if (!id) return; const t = $('mcpVowInput').value.trim(); if (!t) return;
    lifeUpdate(id, l => { l.vows.unshift({ id: lifeId(), text: t, by: 'me', done: false, ts: Date.now() }); }); $('mcpVowInput').value = ''; renderVows();
});
on('mcpVowAiBtn', 'click', async () => {
    const id = getActiveCharId(); if (!id || needKey()) return; $('mcpVowAiBtn').disabled = true;
    try {
        const t = await callPersona(id, '请你以自己的口吻，向我提出一个我们之间的小约定（比如一起做的事、小规矩），15-30字，具体可做到。只输出约定本身。', 1.0);
        lifeUpdate(id, l => { l.vows.unshift({ id: lifeId(), text: oneLine(t), by: 'ta', done: false, ts: Date.now() }); }); renderVows();
    } catch (e) { uiAlert('出错了：' + e.message); }
    $('mcpVowAiBtn').disabled = false;
});
on('mcpVowList', 'click', async (e) => {
    const id = getActiveCharId();
    const cb = e.target.closest('input[data-vow]'); if (cb) { lifeUpdate(id, l => { const v = l.vows.find(x => x.id === cb.getAttribute('data-vow')); if (v) { v.done = cb.checked; if (v.done) { bumpMood(id, 5); addIntimacy(id, 3); } } }); renderVows(); return; }
    const d = e.target.closest('[data-vdel]'); if (d) { if (!(await uiConfirm('删除这个约定吗？'))) return; lifeUpdate(id, l => { l.vows = l.vows.filter(x => x.id !== d.getAttribute('data-vdel')); }); renderVows(); }
});

// ---- 信箱 / 时间胶囊 ----
function renderMail() {
    const box = $('mcpMailList'); if (!box) return;
    const id = getActiveCharId(), c = id ? getChar(id) : null;
    if (!c) { box.innerHTML = '<p class="empty-tip">先创建角色吧~</p>'; return; }
    const now = Date.now(); const m = lifeOf(c).mail.slice().sort((a, b) => b.ts - a.ts);
    box.innerHTML = m.length ? m.map(x => {
        const sealed = x.openAt && x.openAt > now;
        return '<div class="mail-card ' + (x.from === 'ta' ? 'from-ta' : 'from-me') + (sealed ? ' sealed' : '') + '"><div class="mail-head"><b>' + (x.from === 'ta' ? escapeHtml(c.name) + ' 寄来的信' : '我写的信') + '</b><span>' + fmtTs(x.ts) + '</span></div>' +
            (sealed ? '<div class="mail-body">时间胶囊，将于 ' + new Date(x.openAt).toLocaleDateString('zh-CN') + ' 开启</div>' : '<div class="mail-body">' + escapeHtml(x.text).replace(/\n/g, '<br>') + '</div>' + (x.openAt ? '<div class="mail-tag">时间胶囊 · 已开启</div>' : '')) + '<button class="day-del" data-mdel="' + x.id + '">×</button></div>';
    }).join('') : '<p class="empty-tip">信箱是空的。给TA写一封信，或者让TA寄一封来～</p>';
}
on('mcpMailTaBtn', 'click', async () => {
    const id = getActiveCharId(); if (!id || needKey()) return; $('mcpMailTaBtn').disabled = true; uiAlert('TA 正在提笔...');
    try {
        const t = await callPersona(id, timeContext() + '\n请你以自己的口吻给我写一封信，120-220字：可以聊聊今天的心情、最近发生的小事、对我说的心里话。有称呼和落款，不要太套路。只输出信的正文。', 1.0);
        lifeUpdate(id, l => { l.mail.push({ id: lifeId(), from: 'ta', text: String(t).trim(), ts: Date.now() }); l.mail = l.mail.slice(-80); }); bumpMood(id, 4); renderMail(); uiAlert('收到一封来信 ♡');
    } catch (e) { uiAlert('出错了：' + e.message); }
    $('mcpMailTaBtn').disabled = false;
});
on('mcpMailSendBtn', 'click', async () => {
    const id = getActiveCharId(); if (!id) return; const text = $('mcpMailInput').value.trim(); if (!text) { uiAlert('先写点什么吧'); return; }
    const when = $('mcpMailOpen').value; let openAt = 0;
    if (when) { openAt = new Date(when + 'T08:00:00').getTime(); if (openAt <= Date.now()) openAt = 0; }
    lifeUpdate(id, l => { l.mail.push({ id: lifeId(), from: 'me', text: text, ts: Date.now(), openAt: openAt || undefined }); }); $('mcpMailInput').value = ''; $('mcpMailOpen').value = ''; renderMail();
    if (openAt) { uiAlert('已封存成时间胶囊，到那天再打开～'); return; }
    if (needKey()) return; uiAlert('信已寄出，TA 正在读...');
    try {
        const t = await callPersona(id, timeContext() + '\n我给你写了一封信：\n' + text + '\n\n请你认真回一封信（100-200字），有称呼和落款，回应信里的具体内容。只输出信的正文。', 1.0);
        lifeUpdate(id, l => { l.mail.push({ id: lifeId(), from: 'ta', text: String(t).trim(), ts: Date.now() }); }); bumpMood(id, 6); addIntimacy(id, 3); renderMail(); uiAlert('TA 回信了 ♡');
    } catch (e) { uiAlert('TA 暂时没法回信：' + e.message); }
});
on('mcpMailList', 'click', async (e) => { const d = e.target.closest('[data-mdel]'); if (!d) return; if (!(await uiConfirm('删除这封信吗？'))) return; lifeUpdate(getActiveCharId(), l => { l.mail = l.mail.filter(x => x.id !== d.getAttribute('data-mdel')); }); renderMail(); });

// 关闭浏览器对所有文字输入框的自动填充（避免把 API 网址填进聊天框）
(function(){ document.querySelectorAll('input[type=text],input:not([type]),textarea').forEach(function(el){ if(!el.hasAttribute('autocomplete')) el.setAttribute('autocomplete','off'); }); })();

// ---------- 30. 小窝 · 一起养宠物 / 植物 ----------
const NEST_PETS = [
    { id: 'cat', n: '小猫', e: '🐱', say: ['喵～', '呼噜呼噜', '想被摸摸', '喵呜？'] },
    { id: 'dog', n: '小狗', e: '🐶', say: ['汪！', '摇尾巴～', '陪我玩嘛', '汪汪！'] },
    { id: 'rabbit', n: '小兔', e: '🐰', say: ['咕咕', '蹦蹦跳', '要吃胡萝卜', '耳朵动了动'] },
    { id: 'hamster', n: '仓鼠', e: '🐹', say: ['吱吱', '腮帮子鼓鼓', '藏瓜子～', '吱！'] },
    { id: 'chick', n: '小鸡', e: '🐥', say: ['啾啾', '叽叽喳喳', '扑棱翅膀', '啾～'] },
    { id: 'panda', n: '熊猫', e: '🐼', say: ['啃竹子', '滚来滚去', '想睡觉', '嗷呜～'] }
];
const NEST_PLANTS = [
    { id: 'succ', n: '多肉', e: '🪴', bloom: '🌸', say: ['沙沙', '喝饱水了', '在晒太阳'] },
    { id: 'sun', n: '向日葵', e: '🌻', bloom: '🌻', say: ['向着光', '笑得灿烂', '想长高'] },
    { id: 'rose', n: '玫瑰', e: '🌹', bloom: '🌹', say: ['花苞鼓鼓的', '有点香', '别扎到手哦'] },
    { id: 'tree', n: '小树', e: '🌳', bloom: '🌳', say: ['叶子沙沙响', '扎根中', '想长成大树'] }
];
const PET_STAGES = ['蛋', '幼崽', '少年', '成年'], PLANT_STAGES = ['种子', '幼苗', '长叶', '含苞', '盛开'];
const PET_STATS = [['food', '饱食', '✿', 4], ['mood', '心情', '♡', 3], ['clean', '清洁', '○', 2], ['energy', '精力', 'ϟ', 2]];
const PLANT_STATS = [['water', '水分', '◦', 5], ['sun', '阳光', '☼', 3], ['nutri', '养分', '❀', 1.5]];
const nestLvExp = (lv) => 40 + lv * 30;
function nestOf(c) { return lifeOf(c).nest || null; }
function nestKind(n) { return n.kind === 'plant' ? { list: NEST_PLANTS, stats: PLANT_STATS } : { list: NEST_PETS, stats: PET_STATS }; }
function nestType(n) { return nestKind(n).list.find(x => x.id === n.type) || nestKind(n).list[0]; }
function nestStage(n) { const lv = n.lv || 1; if (n.kind === 'plant') return Math.min(4, Math.floor((lv - 1) / 2)); return Math.min(3, Math.floor((lv - 1) / 2)); }
function nestEmoji(n) {
    const t = nestType(n), st = nestStage(n);
    if (n.kind === 'plant') return st === 0 ? '🌰' : st === 1 ? '🌱' : st === 2 ? '🌿' : st === 3 ? t.e : t.bloom;
    return st === 0 ? '🥚' : t.e;
}
// ---- 小窝：原创圆润小动物 / 小植物（SVG） ----
const KINK = '#4a3340';
function kFace(cx, cy, d, o) {
    o = o || {}; const my = cy + 7.5, ex = o.ex || 3.3, ey = o.ey || 4.1;
    return '<g class="kf"><g class="eyes"><ellipse class="eye" cx="' + (cx - d) + '" cy="' + cy + '" rx="' + ex + '" ry="' + ey + '" fill="' + KINK + '"/><ellipse class="eye" cx="' + (cx + d) + '" cy="' + cy + '" rx="' + ex + '" ry="' + ey + '" fill="' + KINK + '"/>' +
        '<circle cx="' + (cx - d + 1.1) + '" cy="' + (cy - 1.5) + '" r="1.25" fill="#fff"/><circle cx="' + (cx + d + 1.1) + '" cy="' + (cy - 1.5) + '" r="1.25" fill="#fff"/></g>' +
        '<ellipse cx="' + (cx - d - 6) + '" cy="' + (cy + 6) + '" rx="' + (o.bl || 4.6) + '" ry="2.9" fill="#ff8fb0" opacity=".55"/><ellipse cx="' + (cx + d + 6) + '" cy="' + (cy + 6) + '" rx="' + (o.bl || 4.6) + '" ry="2.9" fill="#ff8fb0" opacity=".55"/>' +
        '<path class="m-h" d="M' + (cx - 3.2) + ' ' + my + 'q3.2 3.6 6.4 0" stroke="' + KINK + '" stroke-width="1.8" fill="none" stroke-linecap="round"/>' +
        '<path class="m-s" d="M' + (cx - 3.2) + ' ' + (my + 2.4) + 'q3.2 -3.4 6.4 0" stroke="' + KINK + '" stroke-width="1.8" fill="none" stroke-linecap="round"/></g>';
}
const SH = '<ellipse cx="50" cy="88" rx="26" ry="4.2" fill="#8a5a4a" opacity=".16"/>';
const PET_ART = {
    cat: () => SH + '<path d="M18 62c-8-2-10-14-3-20" stroke="#ffc99a" stroke-width="7" stroke-linecap="round" fill="none"/><path d="M26 40l-2-20 17 11z" fill="#ffd6ae"/><path d="M74 40l2-20-17 11z" fill="#ffd6ae"/><path d="M28 36l-1-10 8 5zM72 36l1-10-8 5z" fill="#ffb0c4"/><ellipse cx="50" cy="60" rx="32" ry="27" fill="#ffe6cc"/><path d="M40 36c-1 5 1 8 4 9M50 34v8M60 36c1 5-1 8-4 9" stroke="#ffc99a" stroke-width="3" stroke-linecap="round" fill="none"/>' + kFace(50, 58, 12) + '<path d="M48 63.5h4l-2 2.3z" fill="#ff8fa8"/><path d="M26 62l-10-2M26 67l-10 3M74 62l10-2M74 67l10 3" stroke="#e7b48c" stroke-width="1.4" stroke-linecap="round"/>',
    dog: () => SH + '<ellipse cx="22" cy="52" rx="10" ry="19" fill="#d29f72" transform="rotate(12 22 52)"/><ellipse cx="78" cy="52" rx="10" ry="19" fill="#d29f72" transform="rotate(-12 78 52)"/><ellipse cx="50" cy="60" rx="31" ry="27" fill="#f5dab6"/><ellipse cx="50" cy="68" rx="15" ry="11" fill="#fff4e4"/><path d="M60 36a10 10 0 0 1 12 6c1 7-6 9-13 6z" fill="#d29f72"/>' + kFace(50, 56, 13) + '<ellipse cx="50" cy="64" rx="4.4" ry="3.2" fill="' + KINK + '"/><path d="M50 67v3" stroke="' + KINK + '" stroke-width="1.6" stroke-linecap="round"/><path class="m-h" d="M44 70q6 5 12 0" stroke="' + KINK + '" stroke-width="1.6" fill="none" stroke-linecap="round"/><ellipse cx="50" cy="73.5" rx="3" ry="2.2" fill="#ff8fa8" opacity=".85"/>',
    rabbit: () => SH + '<ellipse cx="36" cy="26" rx="8.5" ry="21" fill="#fff3f6" transform="rotate(-8 36 26)"/><ellipse cx="64" cy="26" rx="8.5" ry="21" fill="#fff3f6" transform="rotate(8 64 26)"/><ellipse cx="36" cy="27" rx="4" ry="14" fill="#ffc4d4" transform="rotate(-8 36 27)"/><ellipse cx="64" cy="27" rx="4" ry="14" fill="#ffc4d4" transform="rotate(8 64 27)"/><circle cx="82" cy="74" r="7" fill="#fff"/><ellipse cx="50" cy="62" rx="30" ry="26" fill="#fff8fa"/>' + kFace(50, 60, 12) + '<path d="M47.5 65.5h5l-2.5 2.6z" fill="#ff8fa8"/>',
    hamster: () => SH + '<circle cx="27" cy="38" r="8" fill="#ffd8a8"/><circle cx="73" cy="38" r="8" fill="#ffd8a8"/><circle cx="27" cy="38" r="4" fill="#ffb0c4"/><circle cx="73" cy="38" r="4" fill="#ffb0c4"/><ellipse cx="50" cy="62" rx="35" ry="26" fill="#ffe3bf"/><path d="M30 62q20 22 40 0q-6 18-20 18t-20-18z" fill="#fffaf1"/><path d="M44 38q6-4 12 0" stroke="#ffc88e" stroke-width="3.2" stroke-linecap="round" fill="none"/>' + kFace(50, 58, 12, { bl: 6.2 }) + '<path d="M48 63.2h4l-2 2.2z" fill="#ff8fa8"/>',
    chick: () => SH + '<path d="M48 30q-3-9 2-12M52 30q3-9 8-9" stroke="#ffcf3f" stroke-width="3" stroke-linecap="round" fill="none"/><ellipse cx="50" cy="60" rx="30" ry="28" fill="#ffe88a"/><ellipse cx="22" cy="64" rx="8" ry="12" fill="#ffd95a" transform="rotate(20 22 64)"/><ellipse cx="78" cy="64" rx="8" ry="12" fill="#ffd95a" transform="rotate(-20 78 64)"/>' + kFace(50, 56, 12) + '<path d="M45 62q5-2.5 10 0q-5 5.5-10 0z" fill="#ffa24a"/><path d="M40 88l-2 5M44 88v5M56 88v5M60 88l2 5" stroke="#ffa24a" stroke-width="2" stroke-linecap="round"/>',
    panda: () => SH + '<circle cx="25" cy="34" r="10" fill="#4a3340"/><circle cx="75" cy="34" r="10" fill="#4a3340"/><ellipse cx="50" cy="62" rx="32" ry="27" fill="#fff"/><ellipse cx="36" cy="57" rx="8.5" ry="10.5" fill="#4a3340" transform="rotate(24 36 57)"/><ellipse cx="64" cy="57" rx="8.5" ry="10.5" fill="#4a3340" transform="rotate(-24 64 57)"/><circle cx="36.5" cy="57" r="3.3" fill="#fff"/><circle cx="63.5" cy="57" r="3.3" fill="#fff"/><circle cx="37" cy="57.4" r="1.8" fill="#4a3340"/><circle cx="63" cy="57.4" r="1.8" fill="#4a3340"/><ellipse cx="50" cy="66" rx="4.2" ry="3" fill="#4a3340"/><path class="m-h" d="M45.5 70q4.5 4 9 0" stroke="#4a3340" stroke-width="1.8" fill="none" stroke-linecap="round"/><path class="m-s" d="M45.5 72.5q4.5-3.6 9 0" stroke="#4a3340" stroke-width="1.8" fill="none" stroke-linecap="round"/><ellipse cx="27" cy="68" rx="4.6" ry="2.9" fill="#ff8fb0" opacity=".5"/><ellipse cx="73" cy="68" rx="4.6" ry="2.9" fill="#ff8fb0" opacity=".5"/>'
};
function nestEggArt() { return SH + '<path d="M50 14c-17 0-28 26-28 44a28 28 0 0 0 56 0c0-18-11-44-28-44z" fill="#fff6e6"/><path d="M50 14c-17 0-28 26-28 44a28 28 0 0 0 56 0c0-18-11-44-28-44z" fill="none" stroke="#ffd9b0" stroke-width="2.4"/><circle cx="38" cy="50" r="4.4" fill="#ffd0dc"/><circle cx="62" cy="62" r="5.4" fill="#d9ecff"/><circle cx="46" cy="72" r="3.4" fill="#e6dcff"/><circle cx="60" cy="40" r="3" fill="#ffe7a8"/>' + kFace(50, 58, 10, { ex: 2.8, ey: 3.4, bl: 3.6 }); }
function potArt(face) { return '<path d="M26 66h48l-6 22a4 4 0 0 1-4 3H36a4 4 0 0 1-4-3z" fill="#ffc9d6"/><rect x="22" y="60" width="56" height="10" rx="5" fill="#ffb3c6"/><path d="M26 70h48" stroke="#fff" stroke-opacity=".5" stroke-width="2"/>' + (face ? kFace(50, 78, 8, { ex: 2.5, ey: 3.2, bl: 3.4 }).replace(/<ellipse cx="[\d.]+" cy="84"[^>]*\/>/g, '') : ''); }
const LEAF = (x, y, r, c) => '<path d="M0 0c-7-3-11-11-9-18 8 0 14 5 15 13 0 3-2 5-6 5z" fill="' + (c || '#8fd18c') + '" transform="translate(' + x + ' ' + y + ') rotate(' + r + ')"/>';
function plantArt(type, st) {
    const base = '<ellipse cx="50" cy="90" rx="27" ry="4" fill="#8a5a4a" opacity=".16"/>';
    const stem = (h) => '<path d="M50 62V' + (62 - h) + '" stroke="#78c27a" stroke-width="4" stroke-linecap="round"/>';
    let top = '';
    if (st === 0) top = '<ellipse cx="50" cy="60" rx="14" ry="5" fill="#b48a6e"/><ellipse cx="50" cy="57" rx="4.5" ry="3" fill="#7a5238"/>';
    else if (st === 1) top = stem(14) + LEAF(50, 50, -30) + LEAF(50, 50, 30).replace('M0 0c-7', 'M0 0c-7') + '';
    else if (st === 2) top = stem(26) + LEAF(50, 52, -40) + LEAF(50, 52, 40) + LEAF(50, 42, -20, '#a3dc95') + LEAF(50, 42, 22, '#a3dc95');
    else if (type === 'succ') top = '<g transform="translate(50 52)">' + [0, 60, 120, 180, 240, 300].map(a => '<ellipse cx="0" cy="-12" rx="6" ry="13" fill="#9bd9a2" transform="rotate(' + a + ')"/>').join('') + '<circle r="6" fill="#b8e8bb"/>' + (st === 4 ? '<g fill="#ff9cb8">' + [0, 72, 144, 216, 288].map(a => '<ellipse cx="0" cy="-6" rx="3.2" ry="5.4" transform="rotate(' + a + ')"/>').join('') + '<circle r="2.6" fill="#ffe08a"/></g>' : '') + '</g>';
    else if (type === 'sun') top = stem(st === 4 ? 36 : 30) + LEAF(50, 56, -45) + LEAF(50, 56, 45) + (st === 4 ? '<g transform="translate(50 20)">' + Array.from({ length: 12 }, (_, i) => '<ellipse cx="0" cy="-12" rx="4.4" ry="8" fill="#ffd54a" transform="rotate(' + i * 30 + ')"/>').join('') + '<circle r="9" fill="#a8764c"/><circle cx="-2" cy="-2" r="1.6" fill="#7a5238"/><circle cx="3" cy="2" r="1.6" fill="#7a5238"/></g>' : '<ellipse cx="50" cy="26" rx="8" ry="11" fill="#9bd48a"/><path d="M46 22q4-6 8 0" stroke="#ffd54a" stroke-width="3" fill="none" stroke-linecap="round"/>');
    else if (type === 'rose') top = stem(st === 4 ? 34 : 28) + LEAF(50, 54, -45) + LEAF(50, 48, 45) + (st === 4 ? '<g transform="translate(50 24)"><circle r="12" fill="#ff7f9f"/><circle r="8.4" fill="#ff98b2"/><path d="M-5-1q5-6 10 0q-2 6-8 4" stroke="#e8557c" stroke-width="1.8" fill="none" stroke-linecap="round"/></g>' : '<ellipse cx="50" cy="28" rx="7" ry="10" fill="#ff8fab"/><path d="M43 30q7 6 14 0" stroke="#78c27a" stroke-width="3" fill="none"/>');
    else top = '<rect x="46.5" y="34" width="7" height="30" rx="3" fill="#b78358"/><circle cx="50" cy="26" r="' + (st === 4 ? 22 : 18) + '" fill="#8fd18c"/><circle cx="38" cy="34" r="12" fill="#a3dc95"/><circle cx="62" cy="34" r="12" fill="#a3dc95"/>' + (st === 4 ? '<g fill="#ffb7cb"><circle cx="40" cy="22" r="3"/><circle cx="58" cy="16" r="3"/><circle cx="64" cy="32" r="3"/><circle cx="46" cy="34" r="3"/><circle cx="53" cy="26" r="2.4"/></g>' : '');
    return base + top + potArt(true);
}
function nestArt(n, forceStage) {
    const t = nestType(n), st = forceStage == null ? nestStage(n) : forceStage;
    const inner = n.kind === 'plant' ? plantArt(t.id, st) : (st === 0 ? nestEggArt() : (PET_ART[t.id] || PET_ART.cat)());
    return '<svg class="nest-art" viewBox="0 0 100 100" aria-hidden="true">' + inner + '</svg>';
}
function nestArtPreview(kind, tid) {
    const inner = kind === 'plant' ? plantArt(tid, 4) : (PET_ART[tid] || PET_ART.cat)();
    return '<svg class="nest-art" viewBox="0 0 100 100" aria-hidden="true">' + inner + '</svg>';
}
function nestEggArt0() { return '<svg class="nest-art" viewBox="0 0 100 100">' + nestEggArt() + '</svg>'; }
function nestScale(n) { const st = nestStage(n); return n.kind === 'plant' ? [0.6, 0.8, 1, 1.15, 1.3][st] : [0.7, 0.85, 1, 1.2][st]; }
function nestTick(n, now) {
    const hrs = Math.max(0, (now - (n.ts || now)) / 36e5); const info = nestKind(n);
    info.stats.forEach(s => { n.s[s[0]] = clamp((n.s[s[0]] == null ? 80 : n.s[s[0]]) - hrs * s[3], 0, 100); });
    n.ts = now; return hrs;
}
function nestAvg(n) { const k = nestKind(n).stats; return k.reduce((a, s) => a + (n.s[s[0]] == null ? 80 : n.s[s[0]]), 0) / k.length; }
function nestLog(n, who, text) { n.log = n.log || []; n.log.unshift({ who: who, text: text, ts: Date.now() }); n.log = n.log.slice(0, 40); }
function nestGain(n, exp, coins, who) {
    n.exp = (n.exp || 0) + exp; n.coins = (n.coins || 0) + (coins || 0); n.care = n.care || { me: 0, ta: 0 }; n.care[who]++;
    let up = false; while (n.exp >= nestLvExp(n.lv || 1) && (n.lv || 1) < 12) { n.exp -= nestLvExp(n.lv || 1); n.lv = (n.lv || 1) + 1; up = true; }
    return up;
}
// TA 的离线照顾：你不在时，TA 会照看
function nestCatchUp(charId) {
    lifeUpdate(charId, (L, c) => {
        const n = L.nest; if (!n) return; const now = Date.now(); const hrs = nestTick(n, now);
        if (c.blocked || hrs < 3) return;
        const times = Math.min(3, Math.floor(hrs / 6));
        const info = nestKind(n);
        for (let i = 0; i < times; i++) {
            const low = info.stats.slice().sort((a, b) => n.s[a[0]] - n.s[b[0]])[0];
            n.s[low[0]] = clamp(n.s[low[0]] + 35, 0, 100);
            const act = n.kind === 'plant' ? { water: '给它浇了水', sun: '把它搬到了窗边晒太阳', nutri: '给它施了点肥' }[low[0]] : { food: '喂了它一顿', mood: '陪它玩了一会儿', clean: '给它洗了个澡', energy: '哄它睡了个觉' }[low[0]];
            nestLog(n, 'ta', act + '（你不在的时候）'); nestGain(n, 4, 2, 'ta');
        }
    });
}
function renderNestSetup() {
    $('nestSetup').classList.remove('hidden'); $('nestMain').classList.add('hidden');
    const kind = window._nestKind || 'pet'; const list = kind === 'plant' ? NEST_PLANTS : NEST_PETS; const sel = window._nestType || list[0].id;
    $('nestKindSeg').querySelectorAll('button').forEach(b => b.classList.toggle('on', b.dataset.k === kind));
    $('nestTypeGrid').innerHTML = list.map(t => '<div class="nest-type' + (t.id === sel ? ' on' : '') + '" data-t="' + t.id + '"><span>' + nestArtPreview(kind, t.id) + '</span><i>' + t.n + '</i></div>').join('');
}
function enterNest() {
    const id = getActiveCharId(), c = id ? getChar(id) : null;
    if (!c) { $('nestSetup').classList.add('hidden'); $('nestMain').classList.add('hidden'); $('nestEmpty').classList.remove('hidden'); return; }
    $('nestEmpty').classList.add('hidden'); $('nestWho').textContent = c.name;
    nestCatchUp(id);
    if (!nestOf(getChar(id))) { window._nestKind = window._nestKind || 'pet'; window._nestType = null; renderNestSetup(); return; }
    $('nestSetup').classList.add('hidden'); $('nestMain').classList.remove('hidden'); renderNest();
}
function renderNest(talk) {
    const id = getActiveCharId(), c = getChar(id); if (!c) return; const n = nestOf(c); if (!n) return;
    const t = nestType(n), st = nestStage(n), info = nestKind(n);
    const stageName = (n.kind === 'plant' ? PLANT_STAGES : PET_STAGES)[st];
    $('nestScene').className = 'nest-scene ' + n.kind + ' s' + st + (nestAvg(n) < 30 ? ' sad' : '');
    { const cr = $('nestCreature'), w = Math.round(116 * nestScale(n)); cr.innerHTML = nestArt(n); cr.style.width = w + 'px'; cr.style.marginLeft = (-w / 2) + 'px'; }
    $('nestTitle').innerHTML = escapeHtml(n.name) + ' <i>' + t.n + ' · ' + stageName + '</i>';
    $('nestLv').textContent = 'Lv.' + (n.lv || 1);
    $('nestExpFill').style.width = Math.min(100, (n.exp || 0) / nestLvExp(n.lv || 1) * 100) + '%';
    $('nestCoins').textContent = '◎ ' + (n.coins || 0);
    $('nestStats').innerHTML = info.stats.map(s => { const v = Math.round(n.s[s[0]]); return '<div class="nest-stat"><span>' + s[2] + ' ' + s[1] + '</span><div class="mood-bar"><div class="mood-fill" style="width:' + v + '%;background:' + (v < 30 ? '#ff6b6b' : 'linear-gradient(90deg,var(--accent-soft),var(--accent2))') + '"></div></div><b>' + v + '</b></div>'; }).join('');
    const acts = n.kind === 'plant' ? [['water', '◦', '浇水'], ['sun', '☼', '晒太阳'], ['nutri', '❀', '施肥'], ['talk', '…', '说说话'], ['ta', '♡', '叫TA来']] : [['feed', '✿', '喂食'], ['play', '●', '逗玩'], ['bath', '○', '洗澡'], ['sleep', '☾', '哄睡'], ['ta', '♡', '叫TA来']];
    $('nestActs').innerHTML = acts.map(a => '<button data-act="' + a[0] + '"><span>' + a[1] + '</span>' + a[2] + '</button>').join('');
    $('nestCare').textContent = '你照顾了 ' + ((n.care || {}).me || 0) + ' 次 · ' + c.name + ' 照顾了 ' + ((n.care || {}).ta || 0) + ' 次 · 一起 ' + Math.max(1, Math.floor((Date.now() - n.born) / 864e5) + 1) + ' 天';
    $('nestLog').innerHTML = (n.log || []).slice(0, 12).map(l => '<div class="nest-log-i ' + l.who + '"><span>' + (l.who === 'ta' ? escapeHtml(c.name) : '我') + '</span>' + escapeHtml(l.text) + '<em>' + fmtTs(l.ts) + '</em></div>').join('') || '<p class="empty-tip">还没有照顾记录～</p>';
    if (talk) nestSay(talk);
}
let _nestSayT = null;
function nestSay(text) { const b = $('nestBubble'); b.textContent = text; b.classList.add('show'); clearTimeout(_nestSayT); _nestSayT = setTimeout(() => b.classList.remove('show'), 3200); }
function nestFx(chars, n) {
    const sc = $('nestScene'); n = n || 6;
    for (let i = 0; i < n; i++) { const s = document.createElement('span'); s.className = 'nest-fx'; s.textContent = chars[i % chars.length]; s.style.left = (30 + Math.random() * 40) + '%'; s.style.animationDelay = (i * 0.08) + 's'; s.style.setProperty('--dx', (Math.random() * 60 - 30) + 'px'); sc.appendChild(s); setTimeout(() => s.remove(), 1600); }
}
function nestBounce() { const cr = $('nestCreature'); cr.classList.remove('bounce'); void cr.offsetWidth; cr.classList.add('bounce'); }
function nestCelebrate(n, who) {
    nestFx(['✧', '✧', '★', '✦'], 12); uiAlert('✧ ' + n.name + ' 升到 Lv.' + n.lv + ' 了！' + (nestStage(n) !== (nestStage(Object.assign({}, n, { lv: n.lv - 1 }))) ? '\n它进化成「' + (n.kind === 'plant' ? PLANT_STAGES : PET_STAGES)[nestStage(n)] + '」啦！' : ''), 3500);
}
function nestDo(act) {
    const id = getActiveCharId(); let up = false, said = '', fx = ['♡'];
    const cd = window._nestCd = window._nestCd || {}; const now = Date.now();
    if (cd[act] && now - cd[act] < 1500) return; cd[act] = now;
    const r = lifeUpdate(id, (L, c) => {
        const n = L.nest; if (!n) return null; nestTick(n, now); const t = nestType(n);
        const add = (k, v) => { n.s[k] = clamp(n.s[k] + v, 0, 100); };
        const full = (k) => n.s[k] >= 95;
        const M = {
            feed: ['food', '✿', '喂了' + n.name + '一顿', '好吃！', ['✿', '♡']], bath: ['clean', '○', '给' + n.name + '洗了个澡', '香香的～', ['○', '✧']],
            sleep: ['energy', '☾', '哄' + n.name + '睡了一觉', '呼……zZ', ['☾', 'z']], water: ['water', '◦', '给' + n.name + '浇了水', '咕嘟咕嘟～', ['◦']],
            sun: ['sun', '☼', '让' + n.name + '晒了太阳', '暖洋洋的', ['☼', '✧']], nutri: ['nutri', '❀', '给' + n.name + '施了肥', '感觉有力气了', ['❀']]
        }[act];
        if (!M) return null;
        if (full(M[0])) { said = '已经很满啦，不用了～'; return 'full'; }
        add(M[0], 40); if (n.kind === 'pet') add('mood', 6); n.s[M[0]] = Math.min(100, n.s[M[0]]);
        nestLog(n, 'me', M[2]); up = nestGain(n, 6, 3, 'me'); said = M[3]; fx = M[4]; bumpMoodSilent(c, 1); return 'ok';
    });
    if (r === 'full') { renderNest(said); return; }
    renderNest(said); nestFx(fx, 7); nestBounce(); if (up) nestCelebrate(nestOf(getChar(id)));
}
function bumpMoodSilent(c, d) { c.mood = clamp(((typeof c.mood === 'number') ? c.mood : 60) + d, 0, 100); c.moodTs = Date.now(); }
// 摸摸 / 戳一戳
on('nestCreature', 'click', () => {
    const id = getActiveCharId(), c = getChar(id); const n = c && nestOf(c); if (!n) return; const t = nestType(n); let up = false;
    lifeUpdate(id, (L) => { const m = L.nest; nestTick(m, Date.now()); if (m.kind === 'pet') m.s.mood = clamp(m.s.mood + 3, 0, 100); m.pokes = (m.pokes || 0) + 1; if (m.pokes % 5 === 0) { nestLog(m, 'me', '摸了摸' + m.name); up = nestGain(m, 3, 1, 'me'); } });
    nestBounce(); nestFx(['♡', '♥'], 3); nestSay(t.say[Math.floor(Math.random() * t.say.length)]); renderNest(); if (up) nestCelebrate(nestOf(getChar(id)));
});
// 逗玩小游戏：在 7 秒内点到小球 5 次
let _ballT = null;
function nestPlay() {
    const sc = $('nestScene'), id = getActiveCharId(); const n = nestOf(getChar(id)); if (!n || n.kind !== 'pet') return;
    if (n.s.energy < 15) { nestSay('太累了，想先睡一觉…'); return; }
    let ball = $('nestBall'); if (ball) ball.remove(); ball = document.createElement('div'); ball.id = 'nestBall'; ball.textContent = '●'; sc.appendChild(ball);
    let hits = 0, end = Date.now() + 8000; const place = () => { ball.style.left = (12 + Math.random() * 70) + '%'; ball.style.top = (14 + Math.random() * 40) + '%'; $('nestCreature').style.transform = 'translateX(' + ((parseFloat(ball.style.left) - 45) * 1.6) + '%)'; };
    place(); nestSay('接住球球！点 5 次～');
    const finish = (ok) => {
        clearInterval(_ballT); ball.remove(); $('nestCreature').style.transform = ''; let up = false;
        lifeUpdate(id, (L, c) => { const m = L.nest; nestTick(m, Date.now()); m.s.mood = clamp(m.s.mood + (ok ? 35 : 12), 0, 100); m.s.energy = clamp(m.s.energy - 12, 0, 100); nestLog(m, 'me', ok ? '陪' + m.name + '玩球，它玩得超开心' : '陪' + m.name + '玩了会儿球'); up = nestGain(m, ok ? 12 : 4, ok ? 8 : 2, 'me'); });
        renderNest(ok ? '好开心！再来一次！' : '呼…有点累了'); nestFx(ok ? ['✧', '♡', '★'] : ['♡'], ok ? 10 : 3); nestBounce(); if (up) nestCelebrate(nestOf(getChar(id)));
    };
    ball.onclick = (e) => { e.stopPropagation(); hits++; nestFx(['★'], 2); nestBounce(); if (hits >= 5) finish(true); else { place(); nestSay(hits + ' / 5'); } };
    _ballT = setInterval(() => { if (Date.now() > end) finish(false); }, 300);
}
async function nestCallTa() {
    const id = getActiveCharId(), c = getChar(id); const n = c && nestOf(c); if (!n) return;
    if (needKey()) return; const info = nestKind(n); let up = false;
    const btn = document.querySelector('#nestActs [data-act=ta]'); if (btn) btn.disabled = true; nestSay('正在叫 ' + c.name + ' 过来…');
    try {
        const low = info.stats.slice().sort((a, b) => n.s[a[0]] - n.s[b[0]])[0];
        const stateTxt = info.stats.map(s => s[1] + Math.round(n.s[s[0]])).join('、');
        const t = await callPersona(id, timeContext() + '\n我们一起养的' + (n.kind === 'plant' ? '植物' : '宠物') + '叫「' + n.name + '」（' + nestType(n).n + '，Lv.' + (n.lv || 1) + '），现在状态：' + stateTxt + '（满分100）。我叫你过来一起照顾它。请你用自己的语气，先说一句你的反应并做一件最需要的照顾动作。只输出JSON：{"say":"你说的话(30字内)","act":"你做了什么(10字内)"}', 1.0);
        const j = parseJSONLoose(t) || { say: oneLine(t).slice(0, 40), act: '照顾了它' };
        lifeUpdate(id, (L) => { const m = L.nest; nestTick(m, Date.now()); m.s[low[0]] = clamp(m.s[low[0]] + 45, 0, 100); m.s[info.stats[1] ? info.stats[1][0] : low[0]] = clamp(m.s[info.stats[1] ? info.stats[1][0] : low[0]] + 8, 0, 100); nestLog(m, 'ta', String(j.act || '照顾了它') + '：「' + String(j.say || '') + '」'); up = nestGain(m, 10, 5, 'ta'); });
        bumpMood(id, 4); addIntimacy(id, 2); renderNest(); nestFx(['♡', '♡', '✧'], 8); nestBounce(); uiAlert(c.name + '：「' + String(j.say || '') + '」', 3500);
        if (up) nestCelebrate(nestOf(getChar(id)));
    } catch (e) { uiAlert('TA 没赶过来：' + e.message); }
    if (btn) btn.disabled = false;
}
async function nestTalkPlant() {
    const txt = await uiPrompt('对它说点什么（植物也会感受到哦）：', ''); if (!txt) return;
    const id = getActiveCharId(); let up = false;
    const n0 = nestOf(getChar(id)); if (n0.talkTs && Date.now() - n0.talkTs < 60000) { nestSay('让它安静一会儿吧～'); return; }
    lifeUpdate(id, (L) => { const m = L.nest; nestTick(m, Date.now()); m.talkTs = Date.now(); nestLog(m, 'me', '对' + m.name + '说：「' + txt.slice(0, 30) + '」'); up = nestGain(m, 5, 2, 'me'); });
    renderNest('叶子轻轻晃了晃～'); nestFx(['♡', '❀'], 5); nestBounce(); if (up) nestCelebrate(nestOf(getChar(id)));
}
on('nestActs', 'click', (e) => {
    const b = e.target.closest('button[data-act]'); if (!b || b.disabled) return; const a = b.dataset.act;
    if (a === 'ta') nestCallTa(); else if (a === 'play') nestPlay(); else if (a === 'talk') nestTalkPlant(); else nestDo(a);
});
on('nestKindSeg', 'click', (e) => { const b = e.target.closest('button[data-k]'); if (!b) return; window._nestKind = b.dataset.k; window._nestType = null; renderNestSetup(); });
on('nestTypeGrid', 'click', (e) => { const t = e.target.closest('.nest-type'); if (!t) return; window._nestType = t.dataset.t; renderNestSetup(); });
on('nestStartBtn', 'click', () => {
    const id = getActiveCharId(); if (!id) return; const kind = window._nestKind || 'pet'; const list = kind === 'plant' ? NEST_PLANTS : NEST_PETS;
    const name = $('nestNameInput').value.trim(); if (!name) { uiAlert('给它起个名字吧～'); return; }
    const s = kind === 'plant' ? { water: 80, sun: 80, nutri: 80 } : { food: 80, mood: 80, clean: 80, energy: 80 };
    lifeUpdate(id, (L, c) => { L.nest = { kind: kind, type: window._nestType || list[0].id, name: name, lv: 1, exp: 0, coins: 0, born: Date.now(), ts: Date.now(), s: s, care: { me: 0, ta: 0 }, log: [] }; nestLog(L.nest, 'me', '和 ' + c.name + ' 一起迎来了「' + name + '」'); });
    $('nestNameInput').value = ''; enterNest(); nestFx(['✧', '✧', '♡'], 10); uiAlert('「' + name + '」来到你们身边啦！');
});
on('nestNameAiBtn', 'click', async () => {
    const id = getActiveCharId(); if (!id || needKey()) return; $('nestNameAiBtn').disabled = true;
    try { const kind = window._nestKind === 'plant' ? '植物' : '宠物'; const t = await callPersona(id, '我们要一起养一只' + kind + '，请你给它起个可爱的名字，2-3个字。只输出名字。', 1.1); $('nestNameInput').value = oneLine(t).replace(/[「」"“”。.!！]/g, '').slice(0, 6); }
    catch (e) { uiAlert('出错了：' + e.message); }
    $('nestNameAiBtn').disabled = false;
});
on('nestResetBtn', 'click', async () => {
    const id = getActiveCharId(); const n = nestOf(getChar(id)); if (!n) return;
    if (!(await uiConfirm('确定要和「' + n.name + '」告别吗？之后可以重新领养一个新的。', { ok: '告别' }))) return;
    lifeUpdate(id, (L) => { L.nest = null; }); enterNest();
});
setInterval(() => { const a = $('nestApp'); if (a && !a.classList.contains('hidden') && nestOf(getChar(getActiveCharId()) || {life:{}})) { const id = getActiveCharId(); lifeUpdate(id, (L) => { nestTick(L.nest, Date.now()); }); renderNest(); } }, 60000);

// ---------- 31. 主屏幕：小组件 + 自定义图标 ----------
const HOME_APPS = [
    { id: 'chat', name: '微信', cls: 'wechat-icon', face: '(´･ᴗ･)', go: () => openApp('chat') },
    { id: 'takeout', name: '外卖', cls: 'takeout-icon', face: '(｡•ᴗ•｡)', go: () => openApp('takeout') },
    { id: 'shopping', name: '淘宝', cls: 'shop-icon', face: '(ﾉ˃ᴗ˂)ﾉ', go: () => openApp('shopping') },
    { id: 'mcp', name: 'TA的生活', cls: 'mcp-icon', face: '(｡•́‿•̀｡)', go: () => openApp('mcp') },
    { id: 'nest', name: '小窝', cls: 'nest-icon', face: '(=^･ω･^=)', go: () => openApp('nest') },
    { id: 'intimate', name: '亲密空间', cls: 'intimate-icon', face: '(๑´ᵕ`๑)', go: () => openApp('intimate') },
    { id: 'games', name: '心动小游戏', cls: 'games-icon', face: '(๑˃ᴗ˂)ﻭ', go: () => openApp('games') },
    { id: 'period', name: '经期', cls: 'period-icon', face: '(◍•ᴗ•◍)', go: () => openApp('period') },
    { id: 'toolkit', name: '生活', cls: 'toolkit-icon', face: '(ง˘ω˘)ว', go: () => openApp('toolkit') },
    { id: 'worldbook', name: '世界书', cls: 'worldbook-icon', face: '(◕ᴗ◕✿)', go: () => openWorldbook('home') },
    { id: 'theme', name: '主题', cls: 'theme-icon', face: '(灬╹ω╹灬)', go: () => openApp('theme') },
    { id: 'settings', name: '设置', cls: 'settings-icon', face: '(・ω・)ゞ', go: () => openApp('settings') }
];
const HOME_WIDGETS = { us: '我们', weather: '天气', music: '一起听', cal: '月历', clock: '时钟', status: 'TA的状态', anni: '纪念日', pet: '小窝宠物', streak: '打卡', note: '便签', photo: '照片', stack: '照片堆叠' };
// 软糯风格用的线条图标（原创，viewBox 24）
const GLYPH = {
    chat: '<path d="M5 6.5A2.5 2.5 0 0 1 7.5 4h9A2.5 2.5 0 0 1 19 6.5v6a2.5 2.5 0 0 1-2.5 2.5H11l-3.5 3v-3h0A2.5 2.5 0 0 1 5 12.5z"/><path d="M9.2 9.7h.01M12 9.7h.01M14.8 9.7h.01"/>',
    takeout: '<path d="M4 11h16a8 8 0 0 1-16 0z"/><path d="M9 4c-1 1 1 2 0 3.2M13 4c-1 1 1 2 0 3.2"/>',
    shopping: '<path d="M6 8.5h12l-1 10.5H7z"/><path d="M9 8.5V7.5a3 3 0 0 1 6 0v1"/>',
    mcp: '<path d="M12 19.5s-7-4.3-7-9.6A3.8 3.8 0 0 1 12 7.8a3.8 3.8 0 0 1 7 2.1c0 5.3-7 9.6-7 9.6z"/>',
    nest: '<path d="M4 11l8-6.5 8 6.5v8a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1z"/><path d="M10 20v-5h4v5"/>',
    intimate: '<circle cx="9.5" cy="12" r="5"/><circle cx="14.5" cy="12" r="5"/>',
    games: '<path d="M7 8h10a4 4 0 0 1 4 4v1.5a2.5 2.5 0 0 1-4.4 1.6L15.5 14h-7l-1.1 1.1A2.5 2.5 0 0 1 3 13.5V12a4 4 0 0 1 4-4z"/><path d="M8 10.5v3M6.5 12h3M16 11.3h.01M18 12.7h.01"/>',
    toolkit: '<circle cx="12" cy="12" r="3.6"/><path d="M12 4v2M12 18v2M4 12h2M18 12h2M6.3 6.3l1.4 1.4M16.3 16.3l1.4 1.4M17.7 6.3l-1.4 1.4M7.7 16.3l-1.4 1.4"/>',
    worldbook: '<path d="M5 5.5A1.5 1.5 0 0 1 6.5 4H19v13.5H6.5A1.5 1.5 0 0 0 5 19z"/><path d="M5 19a1.5 1.5 0 0 0 1.5 1.5H19v-3"/><path d="M9 8.5h6"/>',
    theme: '<path d="M12 4l1.9 4.9 5.1 1.6-5.1 1.7L12 17.5l-1.9-5.3L5 10.5l5.1-1.6z"/><path d="M18.5 16.5v3M17 18h3"/>',
    period: '<path d="M12 4.5s-5.5 6-5.5 10a5.5 5.5 0 0 0 11 0c0-4-5.5-10-5.5-10z"/><path d="M9.5 15a2.5 2.5 0 0 0 2.5 2.5"/>',
    settings: '<path d="M5 8h14M5 16h14"/><circle cx="9" cy="8" r="2" fill="rgba(255,255,255,.35)"/><circle cx="15" cy="16" r="2" fill="rgba(255,255,255,.35)"/>'
};
function glyphSvg(id) { return '<svg viewBox="0 0 24 24" aria-hidden="true">' + (GLYPH[id] || GLYPH.chat) + '</svg>'; }
const WX_SVG = {
    sun: '<circle cx="24" cy="24" r="8" fill="#FFC857" stroke="none"/><path d="M24 8v5M24 35v5M8 24h5M35 24h5M12.7 12.7l3.5 3.5M31.8 31.8l3.5 3.5M35.3 12.7l-3.5 3.5M16.2 31.8l-3.5 3.5" stroke="#FFC857"/>',
    part: '<circle cx="19" cy="19" r="7" fill="#FFC857" stroke="none"/><path d="M19 7v3M7 19h3M10.5 10.5l2 2M27.5 10.5l-2 2" stroke="#FFC857"/><path d="M16 38h19a6 6 0 0 0 0-12 8 8 0 0 0-15.3 2A5 5 0 0 0 16 38z" fill="#fff" stroke="#E7C9D6"/>',
    cloud: '<path d="M13 37h22a7 7 0 0 0 0-14 10 10 0 0 0-19.2 2.5A6 6 0 0 0 13 37z" fill="#fff" stroke="#D8C6E3"/>',
    rain: '<path d="M13 30h22a7 7 0 0 0 0-14 10 10 0 0 0-19.2 2.5A6 6 0 0 0 13 30z" fill="#fff" stroke="#BFD3EA"/><path d="M17 35l-2 5M25 35l-2 5M33 35l-2 5" stroke="#8FB4E3"/>',
    snow: '<path d="M13 30h22a7 7 0 0 0 0-14 10 10 0 0 0-19.2 2.5A6 6 0 0 0 13 30z" fill="#fff" stroke="#CFDDF0"/><path d="M17 36h.01M25 38h.01M33 36h.01M21 41h.01M29 41h.01" stroke="#9DB9E0" stroke-width="3.2"/>',
    fog: '<path d="M10 20h28M8 27h30M14 34h26" stroke="#CDBFD8"/>',
    storm: '<path d="M13 28h22a7 7 0 0 0 0-14 10 10 0 0 0-19.2 2.5A6 6 0 0 0 13 28z" fill="#fff" stroke="#C9BEDF"/><path d="M25 29l-4 7h5l-3 7" stroke="#FFB84D"/>'
};
function wxGlyph(code) {
    const k = code === 0 ? 'sun' : (code === 1 || code === 2) ? 'part' : code === 3 ? 'cloud' : (code === 45 || code === 48) ? 'fog' : (code >= 71 && code <= 77) ? 'snow' : (code >= 95) ? 'storm' : (code >= 51) ? 'rain' : 'cloud';
    return '<svg class="wx-svg" viewBox="0 0 48 48" fill="none" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">' + WX_SVG[k] + '</svg>';
}
function homeStyleOf(kind) { return store.getItem(kind === 'icon' ? 'homeIconStyle' : 'homeWidgetStyle') || 'glass'; }
function homeDefault() {
    return {
        v: 2, hidden: [], dock: ['chat', 'mcp', 'intimate', 'settings'], icons: {},
        items: [{ t: 'w', id: 'w_us', kind: 'us', size: 'wide', data: {} }, { t: 'w', id: 'w_weather', kind: 'weather', size: 'half', data: {} }, { t: 'w', id: 'w_music', kind: 'music', size: 'half', data: {} }]
            .concat(HOME_APPS.map(a => ({ t: 'a', id: a.id })))
    };
}
function getHome() {
    let h = null; try { h = JSON.parse(store.getItem('homeLayout') || 'null'); } catch (e) {}
    if (!h || !h.items) h = homeDefault();
    else if ((h.v || 1) < 2) { // 旧版桌面太乱：换成新布局，保留自定义图标、便签和照片组件
        const d = homeDefault(), keep = h.items.filter(i => i.t === 'w' && (i.kind === 'note' || i.kind === 'photo'));
        const icons = h.icons || {}; h = d; h.icons = icons; h.items = d.items.slice(0, 3).concat(keep, d.items.slice(3)); saveHome(h);
        setTimeout(() => { try { uiAlert('桌面已整理成新样子～想换回旧风格：长按桌面 → 编辑主屏', 3600); } catch (e) {} }, 1200);
    }
    const inFo = {}; h.items.forEach(i => { if (i.t === 'f') { i.apps = (i.apps || []).filter(id => HOME_APPS.some(a => a.id === id)); i.apps.forEach(id => inFo[id] = 1); } });
    h.items = h.items.filter(i => !(i.t === 'a' && inFo[i.id]));
    HOME_APPS.forEach(a => { if (!inFo[a.id] && !h.items.some(i => i.t === 'a' && i.id === a.id)) h.items.push({ t: 'a', id: a.id }); });
    h.items = h.items.filter(i => i.t !== 'f' || i.apps.length > 0);
    h.icons = h.icons || {}; h.hidden = h.hidden || []; h.dock = h.dock || []; h.pages = Math.max(1, h.pages || 1);
    h.items.forEach(i => { if (i.page == null || i.page >= h.pages || i.page < 0) i.page = 0; });
    return h;
}
function saveHome(h) { try { store.setItem('homeLayout', JSON.stringify(h)); } catch (e) { uiAlert('保存失败'); } }
function appBy(id) { return HOME_APPS.find(a => a.id === id); }
function iconHtml(a, h, dock) {
    const c = h.icons[a.id] || {}, nm = c.name || a.name;
    let inner, style = '', cls = 'icon-bg ' + (c.img ? 'custom-img' : a.cls);
    if (c.img) style = ' style="background-image:url(\'' + c.img + '\')"'; else if (!c.text && homeStyleOf('icon') !== 'color') inner = glyphSvg(a.id); else inner = escapeHtml(c.text || a.face);
    return '<div class="' + (dock ? 'dock-icon' : 'app-icon') + '" data-app="' + a.id + '"><div class="' + cls + '"' + style + '>' + (inner || '') + '</div><span>' + escapeHtml(nm) + '</span></div>';
}
function widgetHtml(w) {
    if (w.kind === 'stack') return window.PSTACK ? window.PSTACK.html(w) : '<div class="hw hw-stack ' + (w.size || 'half') + '" data-w="' + w.id + '"></div>';
    const id = getActiveCharId(), c = id ? getChar(id) : null, d = new Date();
    let body = '', cls = 'hw hw-' + w.kind + ' ' + w.size;
    if (w.kind === 'us') {
        let days = null; if (c) { const L = lifeOf(c), x = L.days.find(d => /在一起/.test(d.name)); if (x) days = Math.max(1, dayNum(todayStr()) - dayNum(x.date) + 1); }
        let act = ''; if (c) { const L = lifeOf(c); if (L.plan && L.plan.date === todayStr()) { const cur = currentPlanItem(L.plan); if (cur) act = cur.e; } }
        const knot = '<svg class="us-string" viewBox="0 0 120 44" fill="none"><path class="us-arc" d="M2 30C26 2 94 2 118 30" stroke-width="2" stroke-linecap="round" stroke-dasharray="1 6"/><path class="us-heart" d="M60 25.5s-8-4.7-8-10.4a4.5 4.5 0 0 1 8-2.4 4.5 4.5 0 0 1 8 2.4c0 5.7-8 10.4-8 10.4z"/></svg>';
        body = '<i class="us-tape"></i><div class="us-row"><span class="us-av">' + myAvatarInner() + '</span>' + knot + '<span class="us-av">' + (c ? charAvatarInner(c) : escapeHtml(DEFAULT_KAO)) + '</span></div>' +
            (c ? (days ? '<div class="us-days"><small>在一起第</small><b>' + days + '</b><small>天</small></div>' : '<div class="us-days us-set"><small>点我设置在一起的日子</small></div>') + '<div class="us-line">' + escapeHtml(c.name) + (act ? ' 此刻：' + escapeHtml(act) : ' · ' + escapeHtml(timeSlot().hint)) + '</div>' : '<div class="us-line">先去通讯录创建一个角色</div>');
    } else if (w.kind === 'music') {
        const n = window.tgNow ? window.tgNow() : null, on = !!(n && n.title);
        body = '<div class="mu-disc' + (n && n.playing ? ' spin' : '') + '"><i></i></div><div class="mu-t">' + (on ? '《' + escapeHtml(n.title) + '》' : '一起听 / 看') + '</div><div class="mu-s">' + (on ? (n.playing ? 'TA 陪着你' : '已暂停') : '点我选首歌') + '</div>';
    } else if (w.kind === 'clock') {
        const wd = ['日', '一', '二', '三', '四', '五', '六'][d.getDay()]; let sub = '';
        if (c) { const L = lifeOf(c); if (L.plan && L.plan.date === todayStr()) { const cur = currentPlanItem(L.plan); if (cur) sub = escapeHtml(c.name) + ' 此刻：' + escapeHtml(cur.e); } }
        body = '<div class="hw-time">' + pad2(d.getHours()) + ':' + pad2(d.getMinutes()) + '</div><div class="hw-date">' + (d.getMonth() + 1) + '月' + d.getDate() + '日 周' + wd + '</div>' + (sub ? '<div class="hw-sub">' + sub + '</div>' : '');
    } else if (w.kind === 'weather') {
        const wx = getWeather(), swt = homeStyleOf('widget') === 'sweet'; body = wx ? '<div class="hw-sub">' + escapeHtml(wx.name) + '</div>' + ((swt || homeStyleOf('widget') === 'cream') ? wxGlyph(wx.code) : '<div class="hw-pet" style="font-size:38px;text-align:left">' + wxInfo(wx.code)[1] + '</div>') + '<div class="hw-big">' + wx.temp + '°</div><div class="hw-sub">' + wxInfo(wx.code)[0] + ' · ' + wx.min + '~' + wx.max + '°</div>' : '<div class="hw-sub">天气</div><div class="hw-big" style="font-size:16px">点我设置<br>所在城市</div>';
    } else if (w.kind === 'cal') {
        const y = d.getFullYear(), mo = d.getMonth(), first = new Date(y, mo, 1).getDay(), nd = new Date(y, mo + 1, 0).getDate();
        const marks = {}; if (c) lifeOf(c).days.forEach(x => { const p = x.date.split('-').map(Number); if (x.yearly ? p[1] - 1 === mo : (p[0] === y && p[1] - 1 === mo)) marks[p[2]] = 1; });
        let cells = ['日', '一', '二', '三', '四', '五', '六'].map(x => '<i>' + x + '</i>').join(''); for (let i = 0; i < first; i++) cells += '<span></span>';
        for (let i = 1; i <= nd; i++) cells += '<span class="' + (i === d.getDate() ? 'today' : '') + (marks[i] ? ' dot' : '') + '">' + i + '</span>';
        body = '<div class="cal-head"><b>' + d.getDate() + '</b><span>' + (mo + 1) + '月 · 周' + ['日', '一', '二', '三', '四', '五', '六'][d.getDay()] + '</span></div><div class="cal-grid">' + cells + '</div>'; cls += ' hw-cal';
    } else if (c && w.kind === 'status') {
        const m = getMood(c), L = lifeOf(c); let act = ''; if (L.plan && L.plan.date === todayStr()) { const cur = currentPlanItem(L.plan); if (cur) act = cur.e; }
        body = '<div class="hw-row"><span class="avatar-small">' + charAvatarInner(c) + '</span><div><b>' + escapeHtml(c.name) + '</b><div class="hw-sub">' + moodLabel(m) + ' · ' + Math.round(m) + '</div></div></div><div class="mood-bar" style="margin:8px 0 6px"><div class="mood-fill" style="width:' + Math.round(m) + '%"></div></div><div class="hw-sub">' + escapeHtml(act || timeSlot().hint) + '</div>';
    } else if (c && w.kind === 'anni') {
        const arr = lifeOf(c).days.map(x => ({ d: x, i: dayInfo(x) })).filter(x => x.i.diff >= 0).sort((a, b) => a.i.diff - b.i.diff);
        if (arr.length) { const x = arr[0]; body = '<div class="hw-sub">' + escapeHtml(x.d.name) + '</div><div class="hw-big">' + (x.i.diff === 0 ? '今天' : x.i.diff) + '<small>' + (x.i.diff === 0 ? '✧' : ' 天') + '</small></div><div class="hw-sub">' + escapeHtml(x.d.date) + '</div>'; }
        else body = '<div class="hw-sub">纪念日</div><div class="hw-big" style="font-size:16px">还没有<br>点我去添加</div>';
    } else if (c && w.kind === 'pet') {
        const n = nestOf(c); body = n ? '<div class="hw-petemo">' + nestArt(n) + '</div><div class="hw-row2"><b>' + escapeHtml(n.name) + '</b><span>Lv.' + (n.lv || 1) + '</span></div><div class="hw-sub">' + (nestAvg(n) < 40 ? '需要照顾了～' : '状态不错') + '</div>' : '<div class="hw-petemo">' + nestEggArt0() + '</div><div class="hw-sub">去小窝领养一个</div>';
    } else if (c && w.kind === 'streak') {
        const ci = lifeOf(c).checkin; body = '<div class="hw-sub">打卡连续</div><div class="hw-two"><div><b>' + streakOf(ci.morning) + '</b><span>早安</span></div><div><b>' + streakOf(ci.night) + '</b><span>晚安</span></div></div>';
    } else if (w.kind === 'note') {
        body = '<div class="hw-notetxt">' + (w.data.text ? escapeHtml(w.data.text).replace(/\n/g, '<br>') : '点我写点什么…') + '</div>';
    } else if (w.kind === 'photo') {
        cls += ' hw-photo-on'; return '<div class="' + cls + '" data-w="' + w.id + '" style="' + (w.data.img ? 'background-image:url(\'' + w.data.img + '\')' : '') + '">' + (w.data.img ? '' : '<div class="hw-sub" style="margin:auto">在「编辑主屏」里选一张照片</div>') + '</div>';
    } else body = '<div class="hw-sub">先去通讯录创建一个角色</div>';
    return '<div class="' + cls + '" data-w="' + w.id + '">' + body + '</div>';
}
function renderHome() {
    const grid = $('desktopGrid'), dock = $('desktopDock'); if (!grid || !dock) return;
    const dk = $('desktop'), is = homeStyleOf('icon'), ws = homeStyleOf('widget'); dk.classList.toggle('ic-glass', is === 'glass'); dk.classList.toggle('w-glass', ws === 'glass'); dk.classList.toggle('ic-sweet', is === 'sweet'); dk.classList.toggle('w-sweet', ws === 'sweet'); dk.classList.toggle('sweet', is === 'sweet' || ws === 'sweet'); dk.classList.toggle('ic-cream', is === 'cream'); dk.classList.toggle('w-cream', ws === 'cream'); dk.classList.toggle('cream', is === 'cream' || ws === 'cream'); dk.classList.toggle('wp-default', getUI().wallpaper === 'wp0' && !/^(mono|cream)/.test(store.getItem('themeMode') || ''));
    const h = getHome();
    window.homePage = Math.min(window.homePage || 0, h.pages - 1);
    grid.innerHTML = h.items.filter(it => (it.page || 0) === window.homePage).map(it => {
        if (it.t === 'w') return widgetHtml(it);
        if (it.t === 'f') return folderHtml(it, h);
        if (h.hidden.indexOf(it.id) >= 0 || h.dock.indexOf(it.id) >= 0) return ''; const a = appBy(it.id); return a ? iconHtml(a, h, false) : '';
    }).join('');
    dock.innerHTML = h.dock.map(id => { const a = appBy(id); return a ? iconHtml(a, h, true) : ''; }).join('');
    dock.style.display = h.dock.length ? '' : 'none';
}
function folderHtml(f, h) {
    const minis = (f.apps || []).map(appBy).filter(Boolean).slice(0, 9).map(a => { const c = h.icons[a.id] || {}; if (c.img) return '<i class="fo-mini custom-img" style="background-image:url(\'' + c.img + '\')"></i>'; const col = homeStyleOf('icon') === 'color'; return '<i class="fo-mini ' + (col ? a.cls : 'fo-plain') + '">' + (col ? '' : glyphSvg(a.id)) + '</i>'; }).join('');
    return '<div class="app-icon" data-fo="' + f.id + '"><div class="icon-bg fo-bg"><div class="fo-g">' + minis + '</div></div><span>' + escapeHtml(f.name || '文件夹') + '</span></div>';
}
function homeClick(e) {
    const fo = e.target.closest('[data-fo]'); if (fo) { if (window.HOMEFOLDER) HOMEFOLDER.open(fo.dataset.fo); return; }
    const ap = e.target.closest('[data-app]'); if (ap) { const a = appBy(ap.dataset.app); if (a) a.go(); return; }
    const w = e.target.closest('[data-w]'); if (!w) return; const h = getHome(), it = h.items.find(x => x.id === w.dataset.w); if (!it) return;
    if (it.kind === 'stack') { if (window.PSTACK) window.PSTACK.click(it, e); return; }
    if (it.kind === 'us') { const id = getActiveCharId(), c = id ? getChar(id) : null; if (!c) { openApp('chat'); return; } const L0 = lifeOf(c); if (L0.days.some(d => /在一起/.test(d.name))) { openApp('mcp'); setMcpTab('days'); } else uiPrompt('你们在一起的日子（格式 2025-02-14）：', '').then(v => { if (v === null) return; v = v.trim(); if (!/^\d{4}-\d{1,2}-\d{1,2}$/.test(v)) { uiAlert('格式不对，像 2025-02-14 这样写'); return; } const p = v.split('-'); lifeUpdate(id, l => { l.days.push({ id: lifeId(), name: '在一起', date: p[0] + '-' + pad2(+p[1]) + '-' + pad2(+p[2]), yearly: false }); }); renderHome(); }); return; }
    if (it.kind === 'music') { openApp('mcp'); setMcpTab('together'); return; }
    if (it.kind === 'status') openApp('mcp'); else if (it.kind === 'anni') { openApp('mcp'); setMcpTab('days'); } else if (it.kind === 'streak') { openApp('mcp'); setMcpTab('care'); }
    else if (it.kind === 'pet') openApp('nest'); else if (it.kind === 'clock') { openApp('mcp'); setMcpTab('plan'); } else if (it.kind === 'cal') { openApp('mcp'); setMcpTab('days'); } else if (it.kind === 'weather') { openApp('mcp'); setMcpTab('peek'); }
    else if (it.kind === 'note') uiPrompt('便签内容：', it.data.text || '').then(v => { if (v === null) return; it.data.text = v; saveHome(h); renderHome(); });
}
$('desktopGrid').addEventListener('click', homeClick); $('desktopDock').addEventListener('click', homeClick);
// 长按桌面（图标 / 组件 / 空白处）→ 进入编辑模式：拖动排列、拖到另一个图标上合并成文件夹
(function () {
    const d = $('desktop'); let t = null, sx = 0, sy = 0;
    const pt = (e) => (e.touches && e.touches[0]) || e;
    const start = (e) => { if (e.target.closest('#hmBar,#hmFolder,.hm-dots,.hm-x,.hm-sz') || d.classList.contains('editing')) return; const p = pt(e); sx = p.clientX; sy = p.clientY; clearTimeout(t); t = setTimeout(() => { if (!d.classList.contains('hidden')) { try { if (navigator.vibrate) navigator.vibrate(14); } catch (_) { } openHomeEdit(); } }, 520); };
    const move = (e) => { const p = pt(e); if (Math.hypot(p.clientX - sx, p.clientY - sy) > 16) clearTimeout(t); };
    const stop = () => clearTimeout(t);
    d.addEventListener('touchstart', start, { passive: true }); d.addEventListener('touchend', stop); d.addEventListener('touchcancel', stop); d.addEventListener('touchmove', move, { passive: true });
    d.addEventListener('mousedown', start); d.addEventListener('mouseup', stop); d.addEventListener('mousemove', move); d.addEventListener('mouseleave', stop);
    d.addEventListener('contextmenu', (e) => { if (e.target.closest('[data-app],[data-fo],[data-w]')) e.preventDefault(); });
})();
setInterval(() => { const d = $('desktop'); if (d && !d.classList.contains('hidden') && !document.hidden) renderHome(); }, 20000);

// ---- 编辑主屏 ----
function openHomeEdit() { openApp('homeEdit'); renderHomeEdit(); }
function renderHomeEdit() {
    const h = getHome(), box = $('homeEditList');
    $('heIconSeg').querySelectorAll('button').forEach(b => b.classList.toggle('on', b.dataset.v === homeStyleOf('icon')));
    $('heWidgetSeg').querySelectorAll('button').forEach(b => b.classList.toggle('on', b.dataset.v === homeStyleOf('widget')));
    box.innerHTML = h.items.map((it, i) => {
        let name, prev;
        if (it.t === 'w') { name = '▦ ' + HOME_WIDGETS[it.kind]; prev = '<span class="he-prev he-w">▦</span>'; }
        else { const a = appBy(it.id); if (!a) return ''; const c = h.icons[a.id] || {}; name = c.name || a.name; prev = '<span class="he-prev ' + (c.img ? 'custom-img' : a.cls) + '"' + (c.img ? ' style="background-image:url(\'' + c.img + '\')"' : '') + '>' + (c.img ? '' : escapeHtml(c.text || a.face)) + '</span>'; }
        const ctl = it.t === 'w'
            ? '<button data-he="size" data-i="' + i + '">' + ({ s: '小', half: '中', wide: '大' }[it.size] || '中') + '</button>' + (it.kind === 'photo' ? '<button data-he="photo" data-i="' + i + '">选图</button>' : '') + (it.kind === 'stack' ? '<button data-he="stack" data-i="' + i + '">设计</button>' : '') + (it.kind === 'note' ? '<button data-he="note" data-i="' + i + '">编辑</button>' : '') + '<button data-he="del" data-i="' + i + '">删除</button>'
            : '<button data-he="icon" data-i="' + i + '">改图标</button><button data-he="dock" data-i="' + i + '" class="' + (h.dock.indexOf(it.id) >= 0 ? 'on' : '') + '">Dock</button><button data-he="vis" data-i="' + i + '" class="' + (h.hidden.indexOf(it.id) >= 0 ? '' : 'on') + '">' + (h.hidden.indexOf(it.id) >= 0 ? '已隐藏' : '显示') + '</button>';
        return '<div class="he-row">' + prev + '<div class="he-name">' + escapeHtml(name) + '</div><div class="he-ctl">' + ctl + '<button data-he="up" data-i="' + i + '">↑</button><button data-he="down" data-i="' + i + '">↓</button></div></div>';
    }).join('');
    $('homeAddWidgets').innerHTML = Object.keys(HOME_WIDGETS).map(k => '<button data-addw="' + k + '">＋ ' + HOME_WIDGETS[k] + '</button>').join('');
}
function homePickImage(cb, size) { const inp = document.createElement('input'); inp.type = 'file'; inp.accept = 'image/*'; inp.onchange = () => { const f = inp.files[0]; if (f) readImageCompressed(f, cb, size || 220); }; inp.click(); }
on('homeEditList', 'click', async (e) => {
    const b = e.target.closest('button[data-he]'); if (!b) return; const h = getHome(), i = +b.dataset.i, it = h.items[i], act = b.dataset.he; if (!it) return;
    if (act === 'up' && i > 0) { h.items.splice(i - 1, 0, h.items.splice(i, 1)[0]); }
    else if (act === 'down' && i < h.items.length - 1) { h.items.splice(i + 1, 0, h.items.splice(i, 1)[0]); }
    else if (act === 'del') { if (!(await uiConfirm('删除这个小组件吗？'))) return; h.items.splice(i, 1); }
    else if (act === 'size') { const Z = ['s', 'half', 'wide']; it.size = Z[(Z.indexOf(it.size) + 1) % 3]; }
    else if (act === 'vis') { const k = h.hidden.indexOf(it.id); if (k >= 0) h.hidden.splice(k, 1); else h.hidden.push(it.id); }
    else if (act === 'dock') { const k = h.dock.indexOf(it.id); if (k >= 0) h.dock.splice(k, 1); else if (h.dock.length >= 4) { uiAlert('Dock 最多放 4 个'); return; } else h.dock.push(it.id); }
    else if (act === 'photo') { homePickImage((d) => { it.data.img = d; saveHome(h); renderHomeEdit(); renderHome(); }, 400); return; }
    else if (act === 'note') { const v = await uiPrompt('便签内容：', it.data.text || ''); if (v === null) return; it.data.text = v; }
    else if (act === 'icon') { openIconEdit(it.id); return; }
    else if (act === 'stack') { if (window.PSTACK) window.PSTACK.edit(it.id); return; }
    saveHome(h); renderHomeEdit(); renderHome();
});
on('homeAddWidgets', 'click', (e) => { const b = e.target.closest('[data-addw]'); if (!b) return; const h = getHome(), k = b.dataset.addw; h.items.unshift({ t: 'w', id: 'w_' + k + Date.now().toString(36), kind: k, size: (k === 'clock' || k === 'photo' || k === 'cal') ? 'wide' : 'half', data: {} }); saveHome(h); renderHomeEdit(); renderHome(); uiAlert('已添加到桌面最前面，可以用 ↑↓ 调整位置'); });
on('homeResetBtn', 'click', async () => { if (!(await uiConfirm('恢复默认的主屏幕布局和图标吗？'))) return; store.removeItem('homeLayout'); renderHomeEdit(); renderHome(); });
// 图标编辑
let _iconEditId = null, _iconDraft = null;
function openIconEdit(id) {
    const h = getHome(), a = appBy(id); _iconEditId = id; _iconDraft = Object.assign({}, h.icons[id] || {});
    $('iconEditName').value = _iconDraft.name || a.name; $('iconEditText').value = _iconDraft.text || ''; $('iconEditText').placeholder = a.face; renderIconPrev(); $('iconEditModal').classList.remove('hidden');
}
function renderIconPrev() {
    const a = appBy(_iconEditId), p = $('iconEditPrev'); p.className = 'icon-bg ' + (_iconDraft.img ? 'custom-img' : a.cls); p.style.backgroundImage = _iconDraft.img ? 'url("' + _iconDraft.img + '")' : ''; p.textContent = _iconDraft.img ? '' : (_iconDraft.text || a.face);
}
on('iconEditText', 'input', (e) => { _iconDraft.text = e.target.value; renderIconPrev(); });
on('iconEditImgBtn', 'click', () => homePickImage((d) => { _iconDraft.img = d; renderIconPrev(); }, 180));
on('iconEditClearImg', 'click', () => { delete _iconDraft.img; renderIconPrev(); });
on('iconEditCancel', 'click', () => $('iconEditModal').classList.add('hidden'));
on('iconEditReset', 'click', () => { const h = getHome(); delete h.icons[_iconEditId]; saveHome(h); $('iconEditModal').classList.add('hidden'); renderHomeEdit(); renderHome(); });
on('iconEditSave', 'click', () => {
    const h = getHome(), a = appBy(_iconEditId), nm = $('iconEditName').value.trim();
    const c = { img: _iconDraft.img, text: (_iconDraft.text || '').trim() || undefined, name: (nm && nm !== a.name) ? nm : undefined };
    Object.keys(c).forEach(k => c[k] === undefined && delete c[k]); if (Object.keys(c).length) h.icons[_iconEditId] = c; else delete h.icons[_iconEditId];
    saveHome(h); $('iconEditModal').classList.add('hidden'); renderHomeEdit(); renderHome();
});
renderHome();

// ---------- 32. 聊天外观：iMessage 液态玻璃 / 背景 / 已读未读 ----------
function chatRoomOpen() { const a = document.getElementById('chatRoomApp'); return !!a && !a.classList.contains('hidden'); }
function unreadCount(h) { return (h || []).filter(m => m.role === 'assistant' && m.read === false).length; }
function markUserRead(id, isGroup) {
    if (isGroup) { const gs = getGroups(), g = gs.find(x => x.id === id); if (g) { let ch = false; (g.chatHistory || []).forEach(m => { if (m.role === 'user' && m.read === false) { m.read = true; ch = true; } }); if (ch) saveGroups(gs); } }
    else { const cs = getChars(), c = cs.find(x => x.id === id); if (c) { let ch = false; (c.chatHistory || []).forEach(m => { if (m.role === 'user' && m.read === false) { m.read = true; ch = true; } }); if (ch) saveChars(cs); } }
    if ((isGroup ? currentGroupId === id : currentChatCharId === id)) document.querySelectorAll('#chatBox .user-message .read-status').forEach(el => { el.textContent = '已读'; el.dataset.r = 1; });
}
function settleUnread(id, isGroup) {
    const src = isGroup ? getGroup(id) : getChar(id); if (!src) return;
    if (!unreadCount(src.chatHistory)) return;
    setTimeout(() => {
        if (isGroup ? currentGroupId !== id : currentChatCharId !== id) return;
        const arr = isGroup ? getGroups() : getChars(), o = arr.find(x => x.id === id); if (!o) return;
        (o.chatHistory || []).forEach((m, i) => { if (m.role === 'assistant' && m.read === false) { m.read = true; const el = document.querySelector('#chatBox [data-idx="' + i + '"] .read-status'); if (el) { el.textContent = '已读'; el.dataset.r = 1; } } });
        if (isGroup) saveGroups(arr); else saveChars(arr); renderChatList();
    }, 1300);
}
const CHAT_BG_PRESETS = [
    ['g1', 'linear-gradient(160deg,#ffd9e4,#d8e4ff)'], ['g2', 'linear-gradient(160deg,#eceff4,#b9c0cc)'], ['g3', 'linear-gradient(160deg,#1f2a44,#0d1220)'],
    ['g4', 'linear-gradient(160deg,#ffd3a5,#fd6585)'], ['g5', 'linear-gradient(160deg,#d4fc79,#96e6a1)'], ['g6', 'linear-gradient(160deg,#e0c3fc,#8ec5fc)']
];
function bgLayer(v) { if (!v) return ''; const p = CHAT_BG_PRESETS.find(x => x[0] === v); return p ? p[1] : 'url("' + v + '") center/cover no-repeat'; }
function chatOwner() { return currentGroupId ? getGroup(currentGroupId) : (currentChatCharId ? getChar(currentChatCharId) : null); }
function chatStyleMode() { return store.getItem('chatStyle') || 'ios'; }
function applyChatBg() {
    const app = $('chatRoomApp'), box = $('chatBox'); if (!app || !box) return;
    app.classList.toggle('chat-ios', chatStyleMode() === 'ios');
    const o = chatOwner(), v = (o && o.bg) || store.getItem('chatBgAll') || '', dim = parseInt(store.getItem('chatBgDim') || '0', 10) || 0;
    const layers = []; if (v && dim > 0) layers.push('linear-gradient(rgba(0,0,0,' + (dim / 100) + '),rgba(0,0,0,' + (dim / 100) + '))'); if (v) layers.push(bgLayer(v));
    box.style.background = layers.length ? layers.join(',') : '';
    app.classList.toggle('has-bg', !!v);
    try { fixBubbleContrast(); } catch (e) {}
}
let _bgScope = 'one';
function openChatBgModal(scope) {
    _bgScope = scope || (chatOwner() ? 'one' : 'all'); renderChatBgModal(); $('chatBgModal').classList.remove('hidden');
}
function renderChatBgModal() {
    const o = chatOwner(), cur = _bgScope === 'one' ? ((o && o.bg) || '') : (store.getItem('chatBgAll') || '');
    $('cbStyleSeg').querySelectorAll('button').forEach(b => b.classList.toggle('on', b.dataset.s === chatStyleMode()));
    $('cbScopeSeg').querySelectorAll('button').forEach(b => { b.classList.toggle('on', b.dataset.sc === _bgScope); });
    $('cbScopeSeg').style.display = chatOwner() ? '' : 'none';
    $('cbSwatches').innerHTML = '<div class="cb-sw none' + (!cur ? ' on' : '') + '" data-v="">无</div>' + CHAT_BG_PRESETS.map(p => '<div class="cb-sw' + (cur === p[0] ? ' on' : '') + '" data-v="' + p[0] + '" style="background:' + p[1] + '"></div>').join('') +
        (cur && !CHAT_BG_PRESETS.some(p => p[0] === cur) ? '<div class="cb-sw on" data-v="' + 'keep' + '" style="background:url(\'' + cur + '\') center/cover"></div>' : '');
    $('cbDim').value = store.getItem('chatBgDim') || '0';
}
function setChatBg(v) {
    if (_bgScope === 'one') { const id = currentGroupId || currentChatCharId; if (!id) return; if (currentGroupId) { const gs = getGroups(), g = gs.find(x => x.id === id); if (g) { if (v) g.bg = v; else delete g.bg; saveGroups(gs); } } else { const cs = getChars(), c = cs.find(x => x.id === id); if (c) { if (v) c.bg = v; else delete c.bg; saveChars(cs); } } }
    else { if (v) store.setItem('chatBgAll', v); else store.removeItem('chatBgAll'); }
    applyChatBg(); renderChatBgModal();
}
on('cbSwatches', 'click', (e) => { const sw = e.target.closest('.cb-sw'); if (!sw || sw.dataset.v === 'keep') return; if (sw.dataset.v === '' && _bgScope === 'one') { const id = currentGroupId || currentChatCharId; /* 清除本聊天背景 → 回退到全局 */ } setChatBg(sw.dataset.v); });
on('cbUploadBtn', 'click', () => homePickImage((d) => setChatBg(d), 900));
on('cbStyleSeg', 'click', (e) => { const b = e.target.closest('button[data-s]'); if (!b) return; store.setItem('chatStyle', b.dataset.s); applyChatBg(); renderChatBgModal(); });
on('cbScopeSeg', 'click', (e) => { const b = e.target.closest('button[data-sc]'); if (!b) return; _bgScope = b.dataset.sc; renderChatBgModal(); });
on('cbDim', 'input', (e) => { store.setItem('chatBgDim', e.target.value); applyChatBg(); });
on('cbClose', 'click', () => $('chatBgModal').classList.add('hidden'));
applyChatBg();

on('heIconSeg', 'click', (e) => { const b = e.target.closest('button[data-v]'); if (!b) return; store.setItem('homeIconStyle', b.dataset.v); renderHomeEdit(); renderHome(); });
on('heWidgetSeg', 'click', (e) => { const b = e.target.closest('button[data-v]'); if (!b) return; store.setItem('homeWidgetStyle', b.dataset.v); renderHomeEdit(); renderHome(); });

// ---------- 33. 表情包库（带名字，AI 看得懂也会用） ----------
const BUILTIN_STICKERS = [['开心', '(ﾉ◕ヮ◕)ﾉ*:･ﾟ✧'], ['委屈', '(´;ω;`)'], ['生气', '(╬ Ò﹏Ó)'], ['害羞', '(⁄ ⁄>⁄ ▽ ⁄<⁄ ⁄)'], ['晚安', '(¦3ꇤ)ᶻᶻ'], ['比心', '(๑˃̵ᴗ˂̵)و ♡'], ['抱抱', '(づ｡◕‿‿◕｡)づ'], ['无语', '(¬_¬)'], ['哭哭', '(╥﹏╥)'], ['得意', '(￣▽￣)ゞ'], ['疑惑', '(・・?)'], ['贴贴', '(●´ω｀●)ゞ']].map(x => ({ id: 'b_' + x[0], name: x[0], face: x[1], builtin: true }));
function getStickers() { let u = []; try { u = JSON.parse(store.getItem('stickers') || '[]'); } catch (e) {} return BUILTIN_STICKERS.concat(u); }
function saveUserStickers(arr) { try { store.setItem('stickers', JSON.stringify(arr)); } catch (e) { uiAlert('保存失败：存储空间不足'); } }
function stickerOf(seg) {
    const m = /^\s*[\[［【]\s*表情(?:包)?\s*[:：]\s*([^\]］】]+?)\s*[\]］】]\s*$/.exec(String(seg)); if (!m) return null;
    return getStickers().find(x => x.name === m[1]) || null;
}
function stickerBubbleHtml(st) { return st.face ? '<div class="bubble sticker-face">' + escapeHtml(st.face) + '</div>' : '<div class="bubble sticker-img"><img src="' + st.data + '"></div>'; }
function stickerHint() {
    const names = getStickers().slice(0, 40).map(x => x.name); if (!names.length) return '';
    return '\n【表情包库】我们共用这些表情包：' + names.join('、') + '。想发表情包时，单独一行写 [表情:名字]（只能用上面的名字，偶尔用一下，别滥用）。我发的表情包会显示成 [表情包:名字]，请按名字理解它的意思。';
}
function readStickerFile(file, cb) {
    const r = new FileReader();
    r.onload = (e) => {
        const raw = e.target.result;
        if (/gif/i.test(file.type) && raw.length < 600000) return cb(raw);
        const img = new Image();
        img.onload = () => { try { const sc = Math.min(1, 220 / Math.max(img.width, img.height)), cv = document.createElement('canvas'); cv.width = Math.max(1, Math.round(img.width * sc)); cv.height = Math.max(1, Math.round(img.height * sc)); cv.getContext('2d').drawImage(img, 0, 0, cv.width, cv.height); let d = cv.toDataURL('image/webp', 0.9); if (d.indexOf('image/webp') < 0) d = cv.toDataURL('image/png'); cb(d); } catch (err) { cb(raw); } };
        img.onerror = () => cb(raw); img.src = raw;
    };
    r.readAsDataURL(file);
}
let stickerManage = false;
function openStickerPanel() { closeAttachPanel(); stickerManage = false; renderStickerPanel(); $('stickerModal').classList.remove('hidden'); }
function renderStickerPanel() {
    const all = getStickers();
    $('stickerGrid').innerHTML = all.map(st => '<div class="stk" data-sid="' + escapeHtml(st.id) + '">' + (st.face ? '<span class="stk-face">' + escapeHtml(st.face) + '</span>' : '<img src="' + st.data + '">') + '<i>' + escapeHtml(st.name) + '</i>' + (stickerManage && !st.builtin ? '<b class="stk-x">×</b>' : '') + '</div>').join('');
    $('stkManageBtn').textContent = stickerManage ? '完成' : '管理';
}
on('stkManageBtn', 'click', () => { stickerManage = !stickerManage; renderStickerPanel(); });
on('stkCloseBtn', 'click', () => $('stickerModal').classList.add('hidden'));
on('stkAddBtn', 'click', () => { const inp = document.createElement('input'); inp.type = 'file'; inp.accept = 'image/*'; inp.multiple = true; inp.onchange = async () => {
    const files = Array.from(inp.files || []); for (const f of files) {
        const data = await new Promise(res => readStickerFile(f, res));
        const nm = await uiPrompt('给这个表情包起个名字（AI 会按名字理解它的意思）：', f.name.replace(/\.[^.]+$/, '').slice(0, 8), { placeholder: '例如：委屈巴巴' });
        if (nm === null) continue; const name = nm.trim().slice(0, 10); if (!name) continue;
        const u = JSON.parse(store.getItem('stickers') || '[]').filter(x => x.name !== name); u.push({ id: 'u_' + Date.now() + Math.random().toString(36).slice(2, 5), name: name, data: data }); saveUserStickers(u);
    } renderStickerPanel(); }; inp.click(); });
on('stickerGrid', 'click', async (e) => {
    const el = e.target.closest('.stk'); if (!el) return; const st = getStickers().find(x => x.id === el.dataset.sid); if (!st) return;
    if (stickerManage) { if (st.builtin) { uiAlert('内置表情包不能删除'); return; } if (!(await uiConfirm('删除表情包「' + st.name + '」吗？'))) return; saveUserStickers(JSON.parse(store.getItem('stickers') || '[]').filter(x => x.id !== st.id)); renderStickerPanel(); return; }
    $('stickerModal').classList.add('hidden'); sendSticker(st);
});
function sendSticker(st) {
    if (!ensureChatTarget()) return;
    const label = '[表情包:' + st.name + ']', msg = { role: 'user', content: label }; if (st.face) msg.face = st.face; else msg.img = st.data;
    const el = appendCardMessage('user-message', stickerBubbleHtml(st), true);
    if (currentGroupId) { pushGroupHistory(currentGroupId, msg); if (el) el.dataset.idx = (getGroup(currentGroupId).chatHistory || []).length - 1; groupReply(currentGroupId, null); }
    else { const cid = currentChatCharId; const b = getChar(cid); if (b && b.blocked) { if (el) el.remove(); uiAlert('TA 在你的黑名单里，先移出黑名单才能聊天哦'); return; } pushHistory(cid, msg); if (el) el.dataset.idx = getHistory(cid).length - 1; onUserChatted(cid, ''); userTriggerReply(cid, '（我发了一个表情包「' + st.name + '」，请按它的意思自然回应。）', { silentError: true }); }
}

try { renderPostVisChars(); } catch (e) {}

// ---------- 34. 查岗：读取你设备的真实状态，TA 会自己来看 ----------
// 真实数据：电量/充电、网络、本小手机的使用时长与时段、定位天气。读不到的（其他App、相册、短信等）不会假装有。
const USAGE_KEY = 'usageLog';
let _usage = null, _sess = null;
function usageArr() { if (!_usage) { try { _usage = JSON.parse(store.getItem(USAGE_KEY) || '[]'); } catch (e) { _usage = []; } } return _usage; }
function usageSave() { try { store.setItem(USAGE_KEY, JSON.stringify(usageArr())); } catch (e) {} }
function usageStart() {
    if (_sess || document.hidden) return; const a = usageArr(), now = Date.now(), last = a[a.length - 1];
    if (last && now - last[1] < 5 * 60000) { _sess = last; last[1] = now; } else { _sess = [now, now]; a.push(_sess); }
    const cut = now - 14 * 864e5; while (a.length && a[0][1] < cut) a.shift(); usageSave();
}
function usageBeat() { if (!_sess) return usageStart(); _sess[1] = Date.now(); usageSave(); }
function usageStop() { if (_sess) { _sess[1] = Date.now(); usageSave(); _sess = null; } }
document.addEventListener('visibilitychange', () => { if (document.hidden) usageStop(); else usageStart(); });
window.addEventListener('pagehide', usageStop);
usageStart(); setInterval(usageBeat, 30000);
function usageStats() {
    const now = Date.now(), d0 = new Date(); d0.setHours(0, 0, 0, 0); const t0 = d0.getTime(), a = usageArr();
    const hours = new Array(24).fill(0); let total = 0, opens = 0, latestNight = null, cur = 0;
    a.forEach(sg => {
        const s = Math.max(sg[0], t0), e = sg[1]; if (e > t0) opens++;
        if (e > s) { total += (e - s) / 60000; for (let t = s; t < e;) { const h = new Date(t).getHours(), nx = Math.min(e, new Date(t).setMinutes(59, 59, 999) + 1); hours[h] += (nx - t) / 60000; t = nx; } }
        if (now - sg[1] < 26 * 36e5) { const h = new Date(sg[1]).getHours(); if (h < 5 && (!latestNight || sg[1] > latestNight)) latestNight = sg[1]; }
    });
    if (_sess) cur = (now - _sess[0]) / 60000;
    return { totalMin: Math.round(total), hours: hours, opens: opens, latestNight: latestNight, curMin: Math.round(cur) };
}
// 电量：安卓/电脑浏览器能直接读；iOS 的 Safari 不给网页读电量，所以提供「手动填写」和「快捷指令同步」两种办法
let _bat = null;
const BAT_STALE = 8 * 36e5;
function batManual() { try { const o = JSON.parse(store.getItem('batManual') || 'null'); return o && typeof o.level === 'number' ? o : null; } catch (e) { return null; } }
function batSave(level, charging, src) { level = Math.max(1, Math.min(100, Math.round(+level) || 0)); if (!level) return; try { store.setItem('batManual', JSON.stringify({ level: level, charging: !!charging, ts: Date.now(), src: src || 'manual' })); } catch (e) {} try { document.dispatchEvent(new Event('batterychange')); } catch (e) {} }
// 快捷指令 / 链接带参数打开：?bat=86&chg=1
(function () { try { const u = new URL(location.href), b = u.searchParams.get('bat'); if (b != null && b !== '') { const ch = u.searchParams.get('chg'); batSave(parseFloat(b), ch === '1' || ch === 'true', 'link'); u.searchParams.delete('bat'); u.searchParams.delete('chg'); history.replaceState(null, '', u.pathname + (u.search || '') + u.hash); } } catch (e) {} })();
if (navigator.getBattery) navigator.getBattery().then(b => { _bat = b; ['levelchange', 'chargingchange'].forEach(ev => b.addEventListener(ev, () => { try { document.dispatchEvent(new Event('batterychange')); if (typeof renderPeek === 'function' && mcpTab === 'peek') renderPeek(); } catch (e) {} })); try { document.dispatchEvent(new Event('batterychange')); } catch (e) {} }).catch(() => {});
function batteryNow() {
    if (_bat) return { level: Math.round(_bat.level * 100), charging: !!_bat.charging, src: 'auto' };
    const m = batManual(); if (!m) return null;
    return { level: m.level, charging: !!m.charging, src: m.src || 'manual', stale: Date.now() - (m.ts || 0) > BAT_STALE };
}
function batPanelHtml() {
    const b = batteryNow(), auto = !!_bat, m = batManual(), url = location.origin + location.pathname;
    let h = '<div class="pk-card"><div class="pk-cap">电量来源</div>';
    if (auto) h += '<div class="pk-sub">已自动读取到这台设备的电量：' + b.level + '%' + (b.charging ? '（充电中）' : '') + '</div>';
    else {
        h += '<div class="pk-sub">' + (m ? '当前使用：' + (m.src === 'link' ? '快捷指令同步' : '手动填写') + ' ' + m.level + '%' + (m.charging ? '（充电中）' : '') + '，' + agoText(m.ts) + (b && b.stale ? '（很久没更新了，TA 会当作不确定）' : '') : 'iPhone 的 Safari 不允许网页读取电量，可以用下面两种办法让 TA 知道。') + '</div>'
            + '<div class="pk-permrow"><span>手动填电量 <b id="batV">' + (m ? m.level : 80) + '</b>%</span><input type="range" id="batRange" min="1" max="100" value="' + (m ? m.level : 80) + '" style="width:45%"></div>'
            + '<div class="pk-permrow"><span>正在充电</span><input type="checkbox" class="ios-switch" id="batChg"' + (m && m.charging ? ' checked' : '') + '></div>'
            + '<button class="btn-primary" id="batSave" style="margin-top:6px">保存电量</button>'
            + '<details style="margin-top:10px"><summary style="cursor:pointer;color:var(--text-sub);font-size:13px">自动同步（iOS 快捷指令，设置一次就行）</summary><div class="hint-line" style="line-height:1.8">1. 打开「快捷指令」→ 自动化 →「电量」（例如：电量 20% 或 充电时）/「时间」每小时。<br>2. 动作选「获取电池电量」，再加「打开 URL」，链接填：<br><code id="batUrl" style="word-break:break-all;user-select:all">' + escapeHtml(url) + '?bat=【电池电量】&amp;chg=1</code><br>把【电池电量】换成上一步的变量（长按选「电池电量」）；不在充电就把 chg=1 改成 chg=0。<br>3. 每次自动化运行，小手机会记下电量，TA 就能看到。</div></details>';
    }
    return h + '</div>';
}
function netNow() {
    const c = navigator.connection || navigator.mozConnection || navigator.webkitConnection || {};
    const map = { 'slow-2g': '2G', '2g': '2G', '3g': '3G', '4g': '4G/5G' };
    return { online: navigator.onLine !== false, type: c.type || '', eff: map[c.effectiveType] || '', downlink: c.downlink || 0, saveData: !!c.saveData };
}
// 权限
const PEEK_ITEMS = [['battery', '电量与充电'], ['net', '网络状态'], ['usage', '使用时长与时段'], ['weather', '所在城市天气']];
function peekPerm() { let p = {}; try { p = JSON.parse(store.getItem('peekPerm') || '{}'); } catch (e) {} const o = {}; PEEK_ITEMS.forEach(i => { o[i[0]] = p[i[0]] !== false; }); return o; }
function peekConsented() { return store.getItem('peekConsent') === '1'; }
function peekMaster() { return peekConsented() && store.getItem('peekMaster') !== '0'; }
function peekMode() { return store.getItem('peekMode') === 'ask' ? 'ask' : 'free'; }
function peekGranted() { return Number(store.getItem('peekGrantUntil') || 0) > Date.now(); }
// 天气（Open-Meteo，免费无需 Key）
function wxInfo(code) { return WX_CODE[code] || ['多云', '☁']; }
function getWeather() { try { return JSON.parse(store.getItem('weatherCache') || 'null'); } catch (e) { return null; } }
// 常用城市坐标（接口搜不到时的兜底，也能省一次请求）
const CN_CITY = {北京:[39.90,116.41],上海:[31.23,121.47],天津:[39.13,117.20],重庆:[29.56,106.55],广州:[23.13,113.26],深圳:[22.54,114.06],杭州:[30.27,120.16],南京:[32.06,118.80],苏州:[31.30,120.58],无锡:[31.49,120.31],常州:[31.81,119.97],南通:[31.98,120.89],徐州:[34.26,117.19],连云港:[34.60,119.22],淮安:[33.61,119.02],盐城:[33.35,120.16],扬州:[32.39,119.41],镇江:[32.19,119.43],泰州:[32.46,119.92],宿迁:[33.96,118.28],成都:[30.57,104.07],武汉:[30.59,114.31],西安:[34.34,108.94],长沙:[28.23,112.94],郑州:[34.75,113.63],济南:[36.65,117.12],青岛:[36.07,120.38],烟台:[37.46,121.45],潍坊:[36.71,119.16],临沂:[35.10,118.36],济宁:[35.41,116.59],日照:[35.42,119.53],枣庄:[34.81,117.32],菏泽:[35.23,115.48],沈阳:[41.80,123.43],大连:[38.91,121.61],哈尔滨:[45.80,126.53],长春:[43.82,125.32],石家庄:[38.04,114.51],太原:[37.87,112.55],呼和浩特:[40.84,111.75],合肥:[31.82,117.23],芜湖:[31.35,118.43],蚌埠:[32.92,117.39],福州:[26.07,119.30],厦门:[24.48,118.09],泉州:[24.87,118.68],南昌:[28.68,115.86],宁波:[29.87,121.54],温州:[28.00,120.70],嘉兴:[30.75,120.76],绍兴:[30.00,120.58],金华:[29.08,119.65],台州:[28.66,121.42],海口:[20.04,110.20],三亚:[18.25,109.51],南宁:[22.82,108.32],桂林:[25.27,110.29],昆明:[25.04,102.71],贵阳:[26.65,106.63],拉萨:[29.65,91.14],兰州:[36.06,103.83],西宁:[36.62,101.78],银川:[38.49,106.23],乌鲁木齐:[43.83,87.62],洛阳:[34.62,112.45],开封:[34.80,114.31],佛山:[23.02,113.12],东莞:[23.02,113.75],珠海:[22.27,113.58],惠州:[23.11,114.42],中山:[22.52,113.39],汕头:[23.35,116.68],湛江:[21.27,110.36],唐山:[39.63,118.18],保定:[38.87,115.46],邯郸:[36.61,114.54],秦皇岛:[39.94,119.60],大同:[40.08,113.30],襄阳:[32.01,112.12],宜昌:[30.69,111.29],岳阳:[29.36,113.13],衡阳:[26.89,112.57],赣州:[25.83,114.93],香港:[22.32,114.17],澳门:[22.20,113.54],台北:[25.03,121.57]};
const CN_PROV = /^(黑龙江|内蒙古|北京|天津|上海|重庆|河北|山西|辽宁|吉林|江苏|浙江|安徽|福建|江西|山东|河南|湖北|湖南|广东|海南|四川|贵州|云南|陕西|甘肃|青海|台湾|广西|西藏|宁夏|新疆|香港|澳门)(特别行政区|壮族自治区|回族自治区|维吾尔自治区|自治区|省|市)?/;
function cityCandidates(raw) {
    const out = [], add = v => { v = (v || '').trim(); if (v && !out.includes(v)) out.push(v); };
    const parts = String(raw).split(/[\s,，、·\/\-]+/).filter(Boolean);
    const base = parts.join('');
    let b = base.replace(CN_PROV, ''); if (b.length < 2) b = base;           // “江苏连云港” → “连云港”
    const noSuffix = x => x.replace(/(市|地区|自治州|盟)$/, '');
    add(noSuffix(b)); add(b); add(base); parts.slice().reverse().forEach(p => { add(noSuffix(p.replace(CN_PROV, '') || p)); });
    return out;
}
async function fetchJ(url, ms) {
    const ac = new AbortController(), t = setTimeout(() => ac.abort(), ms || 9000);
    try { const r = await fetch(url, { signal: ac.signal }); if (!r.ok) throw new Error('HTTP ' + r.status); return await r.json(); } finally { clearTimeout(t); }
}
async function geocodeCity(city) {
    const cands = cityCandidates(city);
    for (const c of cands) { if (CN_CITY[c]) return { lat: CN_CITY[c][0], lon: CN_CITY[c][1], name: c }; }
    for (const c of cands) { for (const k in CN_CITY) { if (c.length >= 2 && (k === c || c.indexOf(k) === 0)) return { lat: CN_CITY[k][0], lon: CN_CITY[k][1], name: k }; } }
    for (const c of cands.slice(0, 3)) {
        try { const j = await fetchJ('https://geocoding-api.open-meteo.com/v1/search?name=' + encodeURIComponent(c) + '&count=3&language=zh'); const x = (j.results || []).find(r => r.country_code === 'CN') || (j.results || [])[0]; if (x) return { lat: x.latitude, lon: x.longitude, name: x.name || c }; } catch (e) {}
    }
    for (const c of cands.slice(0, 2)) {
        try { const j = await fetchJ('https://nominatim.openstreetmap.org/search?format=json&limit=1&accept-language=zh&q=' + encodeURIComponent(c)); if (j && j[0]) return { lat: +j[0].lat, lon: +j[0].lon, name: c }; } catch (e) {}
    }
    return null;
}
const WWO2WMO = { 113: 0, 116: 2, 119: 3, 122: 3, 143: 45, 248: 45, 260: 45, 176: 80, 263: 51, 266: 51, 293: 61, 296: 61, 299: 63, 302: 63, 305: 65, 308: 65, 353: 80, 356: 81, 359: 82, 179: 71, 227: 71, 230: 75, 323: 71, 326: 71, 329: 73, 332: 73, 335: 75, 338: 75, 368: 71, 371: 75, 311: 61, 314: 63, 317: 61, 320: 71, 200: 95, 386: 95, 389: 95, 392: 95, 395: 95 };
async function weatherFromOpenMeteo(lat, lon) {
    const w = await fetchJ('https://api.open-meteo.com/v1/forecast?latitude=' + lat + '&longitude=' + lon + '&current=temperature_2m,apparent_temperature,weather_code&daily=temperature_2m_max,temperature_2m_min,precipitation_probability_max&timezone=auto&forecast_days=1');
    const cur = w.current || {}, dy = w.daily || {}; if (cur.temperature_2m == null) throw new Error('no data');
    return { temp: Math.round(cur.temperature_2m), feel: Math.round(cur.apparent_temperature), code: cur.weather_code, max: Math.round((dy.temperature_2m_max || [])[0]), min: Math.round((dy.temperature_2m_min || [])[0]), rain: (dy.precipitation_probability_max || [])[0] };
}
async function weatherFromWttr(lat, lon) {
    const j = await fetchJ('https://wttr.in/' + lat + ',' + lon + '?format=j1'); const c = (j.current_condition || [])[0], d = (j.weather || [])[0]; if (!c) throw new Error('no data');
    const rain = Math.max.apply(null, ((d && d.hourly) || []).map(h => +h.chanceofrain || 0).concat([0]));
    return { temp: Math.round(+c.temp_C), feel: Math.round(+c.FeelsLikeC), code: WWO2WMO[+c.weatherCode] != null ? WWO2WMO[+c.weatherCode] : 3, max: Math.round(+d.maxtempC), min: Math.round(+d.mintempC), rain: rain };
}
let _wxErr = '';
async function fetchWeather(force) {
    const city = (store.getItem('userCity') || '').trim(); if (!city) return null;
    const c = getWeather(); if (!force && c && c.city === city && Date.now() - c.ts < 30 * 60000) return c;
    _wxErr = '';
    try {
        let geo = (c && c.city === city && c.lat != null) ? { lat: c.lat, lon: c.lon, name: c.name } : await geocodeCity(city);
        if (!geo) { _wxErr = '找不到「' + city + '」，试试只写城市名，比如：连云港'; throw new Error(_wxErr); }
        let wx; try { wx = await weatherFromOpenMeteo(geo.lat, geo.lon); } catch (e1) { try { wx = await weatherFromWttr(geo.lat, geo.lon); } catch (e2) { _wxErr = '天气服务连不上（网络问题），稍后再试'; throw e2; } }
        const out = Object.assign({ city: city, name: geo.name || city, lat: geo.lat, lon: geo.lon, ts: Date.now() }, wx);
        store.setItem('weatherCache', JSON.stringify(out)); try { renderLockWeather(); renderHome(); } catch (e) {} return out;
    } catch (e) { return c && c.city === city ? c : null; }
}
function renderLockWeather() {
    const w = getWeather(), wEl = document.getElementById('weatherWidget'); if (!wEl) return; if (!w || w.city !== (store.getItem('userCity') || '').trim()) return;
    const t = wEl.querySelector('.lw-title'), d = document.getElementById('weatherDesc'), i = wxInfo(w.code);
    if (t) t.textContent = i[0] + ' ' + w.temp + '°'; if (d) d.textContent = w.name + ' · ' + w.min + '~' + w.max + '°' + (w.rain != null ? ' · 降水' + w.rain + '%' : ''); wEl._set = true;
}
function weatherLine(w) { if (!w) return ''; const i = wxInfo(w.code); return w.name + ' ' + i[0] + ' ' + w.temp + '°C（体感' + w.feel + '°，今日 ' + w.min + '~' + w.max + '°' + (w.rain != null ? '，降水概率' + w.rain + '%' : '') + '）'; }
// 汇总
function peekSnapshot(forceAll) {
    const p = forceAll ? { battery: 1, net: 1, usage: 1, weather: 1 } : peekPerm(), snap = {}, saw = [];
    if (p.battery) { const b = batteryNow(); if (b) { snap.battery = b; saw.push('电量 ' + b.level + '%' + (b.charging ? '（充电中）' : '')); } }
    if (p.net) { const n = netNow(); snap.net = n; saw.push(n.online ? ('网络 ' + (n.type === 'wifi' ? 'Wi-Fi' : n.type === 'cellular' ? '移动数据' : (n.eff || '在线'))) : '网络 已断开'); }
    if (p.usage) { const u = usageStats(); snap.usage = u; saw.push('今日使用 ' + fmtMin(u.totalMin)); if (u.latestNight) saw.push('最晚在线 ' + pad2(new Date(u.latestNight).getHours()) + ':' + pad2(new Date(u.latestNight).getMinutes())); }
    if (p.weather) { const w = getWeather(); if (w && w.city === (store.getItem('userCity') || '').trim()) { snap.weather = w; saw.push(w.name + ' ' + wxInfo(w.code)[0] + w.temp + '°'); } }
    snap.saw = saw; return snap;
}
function fmtMin(m) { return m >= 60 ? Math.floor(m / 60) + '小时' + (m % 60 ? (m % 60) + '分钟' : '') : m + '分钟'; }
function snapText(s) {
    const L = [];
    if (s.battery) L.push('电量 ' + s.battery.level + '%，' + (s.battery.charging ? '正在充电' : '没在充电'));
    if (s.net) L.push('网络：' + (s.net.online ? (s.net.type === 'wifi' ? '连着 Wi-Fi' : s.net.type === 'cellular' ? '用的移动数据' : '在线' + (s.net.eff ? '（' + s.net.eff + '）' : '')) : '已断网'));
    if (s.usage) { L.push('今天用这个小手机累计 ' + fmtMin(s.usage.totalMin) + '、打开 ' + s.usage.opens + ' 次、本次连续 ' + s.usage.curMin + ' 分钟'); if (s.usage.latestNight) L.push('最近一次熬夜到 ' + pad2(new Date(s.usage.latestNight).getHours()) + ':' + pad2(new Date(s.usage.latestNight).getMinutes())); }
    if (s.weather) L.push('我所在的城市：' + weatherLine(s.weather));
    return L.join('；');
}
function peekContext(c) {
    if (!peekMaster() || c.peekOn === false) return '';
    if (peekMode() === 'ask' && !peekGranted()) return '';
    const t = snapText(peekSnapshot()); return t ? '\n【我的手机/生活真实状态（你随时能看到，可以自然关心，不要生硬播报）】' + t : '';
}
// ---- 自主查岗引擎 ----
const PEEK_FREQ = { low: [150, 300, 3], mid: [60, 150, 6], high: [25, 60, 12] };
function peekState(c) { const L = lifeOf(c); L.peek = L.peek || { log: [], nextAt: 0, day: { d: '', n: 0 }, ev: {} }; return L.peek; }
function peekRecord(charId, entry) { lifeUpdate(charId, (L) => { L.peek = L.peek || { log: [], nextAt: 0, day: { d: '', n: 0 }, ev: {} }; L.peek.log.unshift(entry); L.peek.log = L.peek.log.slice(0, 40); }); }
function peekBanner(c, saw, say, charId) {
    let b = $('peekBanner'); if (!b) { b = document.createElement('div'); b.id = 'peekBanner'; b.className = 'peek-banner'; $('desktop').parentNode.appendChild(b); }
    b.innerHTML = '<span class="pb-ic">⌕</span><div><b>' + escapeHtml(c.name) + ' 翻看了你的手机</b><i>' + escapeHtml((saw || []).slice(0, 3).join(' · ')) + '</i><p>' + escapeHtml(say) + '</p></div>';
    b.onclick = () => { b.classList.remove('show'); openChatWith(charId); };
    b.classList.add('show'); clearTimeout(b._t); b._t = setTimeout(() => b.classList.remove('show'), 6000);
}
let _peekBusy = false;
async function peekRefused(charId, c, reason, evKey) {
    lifeUpdate(charId, (L) => { const p = (L.peek = L.peek || { log: [], nextAt: 0, day: { d: '', n: 0 }, ev: {} }); p.ev = p.ev || {}; if (evKey) p.ev[evKey] = Date.now(); p.nextAt = Date.now() + 90 * 60000; });
    let say = '好吧，那我不看了。';
    if (API_KEY) { try { const r = oneLine(await callPersona(charId, '我刚刚拒绝了你查看我的手机（你本来想看，因为：' + reason + '）。请你以角色本人的口吻回应这次被拒绝：尊重我的选择，同时按你的性格自然流露情绪（失落、撒娇、小吃醋、无所谓、理解都可以），不要强求、不要质问，口语，1~2句，不超过50字。只输出这句话。', 1.0)); if (r) say = r; } catch (e) {} }
    pushHistory(charId, { role: 'assistant', content: say });
    peekRecord(charId, { ts: Date.now(), reason: reason, saw: [], say: say, act: '', refused: true });
    bumpMood(charId, -1); renderChatList(); showBanner(c, say);
    if (mcpTab === 'peek' && $('mcpApp') && !$('mcpApp').classList.contains('hidden')) renderPeek();
}
async function doPeek(charId, reason, evKey, opts) {
    if (_peekBusy) return false; const c0 = getChar(charId); if (!c0 || c0.blocked) return false;
    if (peekMode() === 'ask' && !(opts && opts.granted) && !$('uiDialog').classList.contains('hidden')) return false;
    _peekBusy = true;
    try {
        if (peekMode() === 'ask' && !(opts && opts.granted)) {
            const okc = await uiConfirm('「' + c0.name + '」想看看你的手机（电量、网络、使用情况、天气）。\n原因：' + reason + '\n同意吗？', { ok: '同意', cancel: '不同意' });
            if (!okc) { await peekRefused(charId, c0, reason, evKey); return false; }
            store.setItem('peekGrantUntil', String(Date.now() + 30 * 60000));
        } else if (opts && opts.granted) store.setItem('peekGrantUntil', String(Date.now() + 30 * 60000));
        await fetchWeather(false);
        const snap = peekSnapshot(), saw = snap.saw; if (!saw.length) { return false; }
        const prompt = timeContext() + '\n你刚刚偷偷翻看了我的手机（这是真实的数据）：\n' + snapText(snap) + '\n触发原因：' + reason + '\n请以你的人设和我们的关系，对这些状态自然地做出反应，发给我一条消息：口语、1-2句，可以关心、吃醋、调侃或唠叨，不要说"数据""系统"，要像你真的看到了我的手机。也给出你翻手机时的一个小动作或内心OS（12字内）。只输出JSON：{"say":"发给我的话","act":"小动作/内心OS"}';
        const text = await callPersona(charId, prompt, 1.0);
        const j = parseJSONLoose(text) || { say: oneLine(text), act: '' }; const say = String(j.say || '').trim(); if (!say) return false;
        pushHistory(charId, { role: 'assistant', content: say });
        const viewing = chatRoomOpen() && currentChatCharId === charId && !currentGroupId;
        if (viewing) { const el = appendMessage(say, 'ai-message', currentAiAvatarHTML()); if (el) el.dataset.idx = getHistory(charId).length - 1; }
        peekRecord(charId, { ts: Date.now(), reason: reason, saw: saw, say: say, act: String(j.act || '') });
        lifeUpdate(charId, (L) => { const p = L.peek, d = todayStr(); if (p.day.d !== d) p.day = { d: d, n: 0 }; p.day.n++; if (evKey) p.ev[evKey] = Date.now(); });
        bumpMood(charId, 1); renderChatList(); if (!viewing) peekBanner(c0, saw, say, charId);
        if (mcpTab === 'peek' && !$('mcpApp').classList.contains('hidden')) renderPeek();
        return true;
    } catch (e) { return false; } finally { _peekBusy = false; }
}
function peekEvents(c, snap) {
    const p = peekState(c), now = Date.now(), ev = p.ev || {}, cool = (k, h) => !ev[k] || now - ev[k] > h * 36e5, perm = peekPerm(), hr = new Date().getHours();
    if (perm.battery && snap.battery && snap.battery.level <= 20 && !snap.battery.charging && cool('lowbat', 3)) return ['手机电量只剩 ' + snap.battery.level + '% 了还没充电', 'lowbat'];
    if (perm.battery && snap.battery && snap.battery.charging && snap.battery.level >= 98 && cool('full', 6)) return ['手机已经充满电了', 'full'];
    if (perm.usage && hr < 5 && snap.usage && cool('late', 3)) return ['现在是凌晨 ' + pad2(hr) + ':' + pad2(new Date().getMinutes()) + '，你还在玩手机', 'late'];
    if (perm.usage && snap.usage && snap.usage.curMin >= 120 && cool('long', 3)) return ['你已经连续玩了 ' + snap.usage.curMin + ' 分钟没休息', 'long'];
    if (perm.net && snap.net && snap.net.type === 'cellular' && cool('cell', 8)) return ['你现在用的是移动数据，像是在外面', 'cell'];
    return null;
}
async function peekTick() {
    if (document.hidden || !API_KEY || !peekMaster() || _peekBusy) return;
    const fr = PEEK_FREQ[store.getItem('peekFreq') || 'mid'] || PEEK_FREQ.mid, now = Date.now();
    const chars = getChars().filter(c => c.peekOn !== false && !c.blocked && (c.id === getActiveCharId() || c.peekOn === true));
    for (const c of chars.slice(0, 2)) {
        const p = peekState(c), d = todayStr(), n = (p.day && p.day.d === d) ? p.day.n : 0;
        if (n >= fr[2] + 2) continue;
        if (!p.nextAt) { lifeUpdate(c.id, (L) => { L.peek = L.peek || { log: [], nextAt: 0, day: { d: '', n: 0 }, ev: {} }; L.peek.nextAt = now + (fr[0] + Math.random() * (fr[1] - fr[0])) * 60000 * 0.5; }); continue; }
        const snap = peekSnapshot(); const e = n < fr[2] + 2 ? peekEvents(c, snap) : null;
        if (e) { await doPeek(c.id, e[0], e[1]); continue; }
        if (now >= p.nextAt && n < fr[2]) { const ok = await doPeek(c.id, '随便翻一翻', null); lifeUpdate(c.id, (L) => { L.peek = L.peek || { log: [], nextAt: 0, day: { d: '', n: 0 }, ev: {} }; L.peek.nextAt = Date.now() + (fr[0] + Math.random() * (fr[1] - fr[0])) * 60000; }); if (ok) return; }
    }
}
setInterval(peekTick, 60000); setTimeout(() => { fetchWeather(false); peekTick(); }, 8000);
// ---- 界面 ----
function ringSvg(pct, color, label, sub) {
    const r = 38, c = 2 * Math.PI * r, off = c * (1 - Math.max(0, Math.min(100, pct)) / 100);
    return '<svg viewBox="0 0 100 100" class="pk-ring"><circle cx="50" cy="50" r="' + r + '" stroke="rgba(120,120,128,.18)" stroke-width="9" fill="none"/><circle cx="50" cy="50" r="' + r + '" stroke="' + color + '" stroke-width="9" fill="none" stroke-linecap="round" stroke-dasharray="' + c.toFixed(1) + '" stroke-dashoffset="' + off.toFixed(1) + '" transform="rotate(-90 50 50)"/><text x="50" y="52" text-anchor="middle" font-size="22" font-weight="600" fill="currentColor">' + label + '</text><text x="50" y="68" text-anchor="middle" font-size="9" fill="currentColor" opacity=".6">' + sub + '</text></svg>';
}
function renderPeek() {
    const box = $('mcpPeekBody'); if (!box) return; const id = getActiveCharId(), c = id ? getChar(id) : null;
    if (!c) { box.innerHTML = '<p class="empty-tip">先创建角色吧~</p>'; return; }
    if (!peekConsented()) {
        box.innerHTML = '<div class="pk-consent"><div class="pk-big">⌕</div><h3>让 TA 看看你的手机？</h3><p>开启后，TA 会自己不定时翻看你<b>真实的设备状态</b>（不是你每次叫 TA 才看）：电量、网络、你用这个小手机的时长和时段，还有你所在城市的天气，然后在聊天里自然地关心你。</p><p class="pk-note">TA 只能看到你在下面打开的项目；看不到你手机上的其他 App、相册、短信和通知。数据只保存在你自己的浏览器里，只有在 TA 回复你的时候，才会把相关摘要发给你填的 AI 接口。</p><button class="btn-primary" id="pkConsentBtn">同意并开启</button></div>'; return;
    }
    const p = peekPerm(), S = peekSnapshot(true), L = lifeOf(c), ps = peekState(c), master = peekMaster(), fr = store.getItem('peekFreq') || 'mid';
    const bat = S.battery, net = S.net, u = S.usage, w = getWeather(); const maxH = Math.max(10, ...u.hours);
    let html = '<div class="pk-phone">';
    html += '<div class="pk-row2">';
    html += '<div class="pk-card">' + (bat ? ringSvg(bat.level, bat.level <= 20 ? '#ff453a' : (bat.charging ? '#34c759' : '#ff8fab'), bat.level + '%', bat.charging ? 'ϟ 充电中' : '电量') : '<div class="pk-na">电量<br><small>这个浏览器读不到<br>（iPhone Safari 不支持）</small></div>') + '</div>';
    html += '<div class="pk-card pk-net"><div class="pk-cap">网络</div><div class="pk-val">' + (net.online ? (net.type === 'wifi' ? 'Wi-Fi' : net.type === 'cellular' ? '移动数据' : '在线') : '已断网') + '</div><div class="pk-sub">' + (net.eff ? '速度档位 ' + net.eff : '') + (net.downlink ? ' · ' + net.downlink + 'Mbps' : '') + '</div><div class="pk-cap" style="margin-top:8px">设备</div><div class="pk-sub">' + escapeHtml((navigator.platform || '') + ' · ' + screen.width + '×' + screen.height) + '</div></div>';
    html += '</div>';
    html += '<div class="pk-card"><div class="pk-cap">今日使用（本小手机）</div><div class="pk-val">' + fmtMin(u.totalMin) + '<small> · 打开 ' + u.opens + ' 次</small></div><div class="pk-bars">' + u.hours.map((m, h) => '<i style="height:' + Math.max(3, Math.round(m / maxH * 100)) + '%" class="' + (h === new Date().getHours() ? 'now' : '') + (m > 0 ? ' on' : '') + '"></i>').join('') + '</div><div class="pk-axis"><span>0</span><span>6</span><span>12</span><span>18</span><span>24</span></div>' + (u.latestNight ? '<div class="pk-chip">☾ 最晚在线 ' + pad2(new Date(u.latestNight).getHours()) + ':' + pad2(new Date(u.latestNight).getMinutes()) + '</div>' : '') + '</div>';
    html += '<div class="pk-card pk-wx"><div class="pk-cap">所在城市天气</div>' + (w && w.city === (store.getItem('userCity') || '').trim() ? '<div class="pk-wxrow"><span class="pk-wxi">' + wxInfo(w.code)[1] + '</span><div><div class="pk-val">' + w.temp + '°<small> ' + wxInfo(w.code)[0] + '</small></div><div class="pk-sub">' + escapeHtml(w.name) + ' · ' + w.min + '~' + w.max + '°' + (w.rain != null ? ' · 降水' + w.rain + '%' : '') + '</div></div></div>' : '<div class="pk-sub">填写城市后，TA 就知道你那边的天气</div>') + '<div class="pk-cityrow"><input id="pkCity" class="input-text" placeholder="你所在的城市，如：上海" value="' + escapeHtml(store.getItem('userCity') || '') + '"><button id="pkCityBtn" class="btn-small">保存</button></div></div>';
    html += '</div>';
    html += batPanelHtml();
    html += '<p class="section-title">TA 能看什么</p><div class="pk-perm"><div class="pk-permrow master"><span>允许 ' + escapeHtml(c.name) + ' 自己来查岗</span><input type="checkbox" class="ios-switch" id="pkMaster" ' + (master && c.peekOn !== false ? 'checked' : '') + '></div>' + PEEK_ITEMS.map(i => '<div class="pk-permrow"><span>' + i[1] + '</span><input type="checkbox" class="ios-switch" data-pp="' + i[0] + '" ' + (p[i[0]] ? 'checked' : '') + '></div>').join('') + '<div class="pk-permrow"><span>查岗频率</span><div class="seg pk-seg" id="pkFreq"><button data-f="low" class="' + (fr === 'low' ? 'on' : '') + '">偶尔</button><button data-f="mid" class="' + (fr === 'mid' ? 'on' : '') + '">常常</button><button data-f="high" class="' + (fr === 'high' ? 'on' : '') + '">盯紧点</button></div></div></div>';
    html += '<p class="section-title">查岗方式</p><div class="pk-mode"><button data-pm="free" class="' + (peekMode() === 'free' ? 'on' : '') + '">随时可查</button><button data-pm="ask" class="' + (peekMode() === 'ask' ? 'on' : '') + '">每次要我同意</button></div><p class="hint-line">' + (peekMode() === 'free' ? '你已经同意 TA 随时查：TA 会按下面的频率自己翻看，不会再问你。' : 'TA 想看的时候会先弹窗问你，你可以同意或不同意；同意后 30 分钟内 TA 都能看到，不同意 TA 会有反应。') + '</p>';
    html += '<button class="btn-primary" id="pkNowBtn" style="margin-top:10px;">让 TA 现在就看一眼</button><p class="hint-line">页面开着时，TA 会按频率自己翻看，电量低、凌晨还在玩、连续玩太久时也会主动来管你。页面关掉后不会查（网页没法在后台运行）。</p>';
    html += '<p class="section-title">查岗记录</p>' + ((ps.log || []).length ? ps.log.slice(0, 12).map(l => '<div class="pk-log"><div class="pk-loghead"><span class="avatar-small" style="width:24px;height:24px">' + charAvatarInner(c) + '</span><b>' + escapeHtml(c.name) + '</b><em>' + fmtTs(l.ts) + '</em></div><div class="pk-saw">' + (l.refused ? '<span>你拒绝了这次查看</span>' : '') + (l.saw || []).map(x => '<span>' + escapeHtml(x) + '</span>').join('') + '</div>' + (l.act ? '<div class="pk-act">（' + escapeHtml(l.act) + '）</div>' : '') + '<div class="pk-say">' + escapeHtml(l.say) + '</div></div>').join('') : '<p class="empty-tip">还没有查岗记录～</p>');
    box.innerHTML = html;
}
on('mcpPeekBody', 'click', async (e) => {
    const id = getActiveCharId();
    if (e.target.id === 'pkConsentBtn') { store.setItem('peekConsent', '1'); store.setItem('peekMaster', '1'); if (id) lifeUpdate(id, (L, c) => { c.peekOn = true; }); renderPeek(); fetchWeather(true).then(() => renderPeek()); setTimeout(peekTick, 2000); return; }
    if (e.target.id === 'pkCityBtn') { store.setItem('userCity', ($('pkCity').value || '').trim()); store.removeItem('weatherCache'); uiAlert('正在查询天气…'); const w = await fetchWeather(true); renderPeek(); renderHome(); uiAlert(w ? '已更新：' + weatherLine(w) : (_wxErr || '没查到天气，检查一下城市名或网络')); return; }
    if (e.target.id === 'pkNowBtn') { if (needKey()) return; e.target.disabled = true; e.target.textContent = 'TA 正在翻你的手机…'; await fetchWeather(false); const ok = await doPeek(id, '你让我现在看一眼', null, { granted: true }); uiAlert(ok ? '看完啦，TA 已经给你发消息了' : '这次没看到什么（可能所有项目都被关了）'); renderPeek(); return; }
    if (e.target.id === 'batSave') { batSave($('batRange').value, $('batChg').checked, 'manual'); uiAlert('电量已保存', 1200); renderPeek(); return; }
    const pm = e.target.closest('[data-pm]'); if (pm) { store.setItem('peekMode', pm.dataset.pm); renderPeek(); return; }
    const f = e.target.closest('[data-f]'); if (f) { store.setItem('peekFreq', f.dataset.f); renderPeek(); }
});
on('mcpPeekBody', 'input', (e) => { if (e.target.id === 'batRange') { const v = $('batV'); if (v) v.textContent = e.target.value; } });
on('mcpPeekBody', 'change', (e) => {
    const t = e.target, id = getActiveCharId();
    if (t.id === 'pkMaster') { lifeUpdate(id, (L, c) => { c.peekOn = t.checked; }); if (t.checked) store.setItem('peekMaster', '1'); renderPeek(); return; }
    if (t.dataset.pp) { const p = peekPerm(); p[t.dataset.pp] = t.checked; store.setItem('peekPerm', JSON.stringify(p)); renderPeek(); }
});
setInterval(() => { if (mcpTab === 'peek' && $('mcpApp') && !$('mcpApp').classList.contains('hidden') && !document.hidden) renderPeek(); }, 30000);
