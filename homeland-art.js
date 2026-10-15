/* homeland-art.js —— 小家园「像素美术引擎」：像素画布工具 / 头大身小的像素小人（装扮 + 手绘）/ 房间背景。
   全部由代码逐像素画出，没有任何外部图片。1 个逻辑像素 = 屏幕上约 2 个像素。 */
(function () {
    'use strict';
    const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
    // ---------- 颜色 ----------
    const shCache = {};
    function rgb(h) { h = String(h || '#cccccc').replace('#', ''); if (h.length === 3) h = h.split('').map(x => x + x).join(''); return [parseInt(h.slice(0, 2), 16) || 0, parseInt(h.slice(2, 4), 16) || 0, parseInt(h.slice(4, 6), 16) || 0]; }
    function hex(r, g, b) { return '#' + [r, g, b].map(v => clamp(Math.round(v), 0, 255).toString(16).padStart(2, '0')).join(''); }
    function shade(h, a) {
        const k = h + '|' + a; if (shCache[k]) return shCache[k];
        const c = rgb(h), t = a < 0 ? 0 : 255, p = Math.abs(a); return (shCache[k] = hex(c[0] + (t - c[0]) * p, c[1] + (t - c[1]) * p, c[2] + (t - c[2]) * p));
    }
    function mix(a, b, p) { const x = rgb(a), y = rgb(b); return hex(x[0] + (y[0] - x[0]) * p, x[1] + (y[1] - x[1]) * p, x[2] + (y[2] - x[2]) * p); }

    // ---------- 像素画布 ----------
    // mk(w,h,fn,opt)：新建 (w+2)x(h+2) 的画布，留 1 像素给自动描边；fn 里坐标从 (0,0) 到 (w-1,h-1)
    function outline(c) {
        const w = c.width, h = c.height, x = c.getContext('2d'), id = x.getImageData(0, 0, w, h), d = id.data, out = new Uint8ClampedArray(d);
        const A = (px, py) => (px < 0 || py < 0 || px >= w || py >= h) ? 0 : d[(py * w + px) * 4 + 3];
        for (let py = 0; py < h; py++) for (let px = 0; px < w; px++) {
            const i = (py * w + px) * 4; if (d[i + 3] > 40) continue;
            let n = null;
            [[1, 0], [-1, 0], [0, 1], [0, -1]].forEach(o => { const qx = px + o[0], qy = py + o[1]; if (A(qx, qy) > 200 && !n) n = (qy * w + qx) * 4; });
            if (n !== null) { out[i] = d[n] * 0.42; out[i + 1] = d[n + 1] * 0.36; out[i + 2] = d[n + 2] * 0.4; out[i + 3] = 255; }
        }
        id.data.set(out); x.putImageData(id, 0, 0);
    }
    function mk(w, h, fn, opt) {
        opt = opt || {}; const c = document.createElement('canvas'); c.width = w + 2; c.height = h + 2;
        const x = c.getContext('2d'); x.imageSmoothingEnabled = false; x.translate(1, 1);
        const P = {
            w: w, h: h, ctx: x,
            p(px, py, col) { x.fillStyle = col; x.fillRect(px, py, 1, 1); },
            r(rx, ry, rw, rh, col) { x.fillStyle = col; x.fillRect(rx, ry, rw, rh); },
            clr(rx, ry, rw, rh) { x.clearRect(rx, ry, rw, rh); },
            b(rx, ry, rw, rh, col) { // 带高光/暗部的方块
                P.r(rx, ry, rw, rh, col); if (rh > 2) { P.r(rx, ry, rw, 1, shade(col, .26)); P.r(rx, ry + rh - 1, rw, 1, shade(col, -.2)); } if (rw > 2) { P.r(rx, ry + 1, 1, Math.max(0, rh - 2), shade(col, .1)); P.r(rx + rw - 1, ry + 1, 1, Math.max(0, rh - 2), shade(col, -.1)); }
            },
            rr(rx, ry, rw, rh, col) { P.b(rx, ry, rw, rh, col); P.clr(rx, ry, 1, 1); P.clr(rx + rw - 1, ry, 1, 1); },
            e(cx, cy, rx, ry, col) { // 像素椭圆（左上亮、右下暗）
                for (let yy = Math.floor(cy - ry); yy <= Math.ceil(cy + ry); yy++) for (let xx = Math.floor(cx - rx); xx <= Math.ceil(cx + rx); xx++) {
                    const dx = (xx + .5 - cx) / rx, dy = (yy + .5 - cy) / ry; if (dx * dx + dy * dy > 1) continue;
                    x.fillStyle = (dy < -.5 || dx < -.55) ? shade(col, .2) : (dy > .55 || dx > .6) ? shade(col, -.17) : col; x.fillRect(xx, yy, 1, 1);
                }
            },
            l(x0, y0, x1, y1, col) { x.fillStyle = col; let dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0), sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1, er = dx + dy; for (;;) { x.fillRect(x0, y0, 1, 1); if (x0 === x1 && y0 === y1) break; const e2 = 2 * er; if (e2 >= dy) { er += dy; x0 += sx; } if (e2 <= dx) { er += dx; y0 += sy; } } },
            t(tx, ty, rows, map) { rows.forEach((row, j) => { for (let i = 0; i < row.length; i++) { const k = row[i]; if (k !== '.' && k !== ' ' && map[k]) P.p(tx + i, ty + j, map[k]); } }); }
        };
        fn(P); if (!opt.noOutline) outline(c);
        return { c: c, w: w + 2, h: h + 2, ow: w, oh: h };
    }

    // =====================================================================
    //  像素小人（头大身小）。画布 20x30，脚底中心为锚点。
    //  发型 / 眼睛 / 嘴巴 全部用「字符点阵」画出来，方便继续加新款。
    // =====================================================================
    const SKINS = ['#fde5d2', '#f7d2b8', '#eab998', '#d49a72', '#a8714d', '#7b4a32', '#f3e1ef', '#d8efe0', '#fff0e6', '#e8c4a8'];
    const HAIRC = ['#2f2630', '#5a3b2e', '#8a5a3c', '#c98e5a', '#f1d28a', '#f6e9c8', '#e87f8f', '#f4a6c0', '#9bbbd9', '#6b8fd1', '#a08fcf', '#8fc096', '#d94f4f', '#c9c9d1', '#ff9f43', '#3d5a80',
        '#c9b6f0', '#a8e6cf', '#ffc6d9', '#fff4d6', '#7a2e45', '#e6e6ee', '#4fb3b3', '#1a1a22'];
    const EYEC = ['#3a2f3a', '#5a3b2e', '#4a7fb0', '#4f9a74', '#a05fb0', '#d9738a', '#d9a13a', '#7a8aa8', '#2f5fa8', '#c0504d', '#5fb3c9', '#8a6fc4'];
    const CLOTHC = ['#ffffff', '#f6c9d4', '#e87f8f', '#d94f4f', '#ffd9a0', '#ffe08a', '#bfe0b4', '#8fc096', '#9bbbd9', '#5c7fb5', '#c7b8e6', '#8a6fc4', '#4a4a55', '#d9c7ad', '#f0a05a', '#3d5a80',
        '#ff5fa2', '#a5d8ff', '#c6f06b', '#d6b8ff', '#2b2b33', '#fff3e0', '#7a2e45', '#6b8f71'];
    const BOTC = ['#4a5a7a', '#2f3447', '#7a8aa8', '#b58863', '#d9c7ad', '#f6c9d4', '#8fc096', '#e87f8f', '#ffffff', '#6b4a3a', '#2b2b33', '#5c7fb5', '#a5d8ff', '#7a2e45', '#c7b8e6', '#3d5a80'];
    const SHOEC = ['#ffffff', '#f4f1f7', '#8a5a3c', '#4a4a55', '#e87f8f', '#2b2b33', '#f6c9d4', '#9bbbd9', '#d94f4f', '#ffe08a'];

    const HAIRS = [['short', '清爽短发'], ['crop', '碎盖'], ['curtain', '中分'], ['spiky', '刺猬头'], ['shaggy', '狼尾'], ['bob', '波波头'], ['bobflip', '外翻波波'], ['hime', '姬发式'], ['long', '长直发'], ['wave', '大波浪'], ['fluffy', '蓬蓬卷'],
        ['twin', '高双马尾'], ['lowtwin', '低双马尾'], ['buns', '双丸子'], ['bun', '丸子头'], ['pony', '高马尾'], ['sidetail', '侧马尾'], ['braid', '双麻花'], ['sidebang', '斜刘海']];
    const EYES = [['tall', '亮亮'], ['sparkle', '星光眼'], ['round', '水汪汪'], ['wide', '大眼'], ['bean', '豆豆'], ['dot', '圆点'], ['sleepy', '困困'], ['lid', '半睁'], ['happy', '弯弯'], ['smile', '笑眼'], ['wink', '眨眼'],
        ['heart', '爱心'], ['swirl', '漩涡'], ['plus', '十字'], ['ring', '圈圈'], ['box', '方块'], ['cross', '> <'], ['x', '× ×'], ['cry', 'T T'], ['pi', 'Π Π'], ['dash', '一 一'], ['tri', '凶凶']];
    const BROWS = [['none', '无'], ['normal', '平眉'], ['angry', '剑眉'], ['sad', '八字眉'], ['high', '挑眉']];
    const MOUTHS = [['smile', '微笑'], ['grin', '大笑'], ['cat', 'ω猫嘴'], ['fang', '虎牙'], ['tongue', '吐舌'], ['open', '张嘴'], ['o', '惊讶'], ['pout', '嘟嘴'], ['flat', '平静'], ['wave', '波浪嘴'], ['tri', '小三角'], ['smirk', '坏笑'], ['sad', '瘪嘴']];
    const TOPS = [['tee', 'T恤'], ['crop', '露脐短T'], ['camisole', '吊带'], ['hoodie', '卫衣'], ['sweater', '条纹毛衣'], ['cardigan', '开衫'], ['shirt', '衬衫领带'], ['blazer', 'JK西装'], ['sailor', '水手服'], ['varsity', '棒球外套'],
        ['puffer', '羽绒服'], ['pj', '睡衣'], ['overall', '背带裤'], ['dress', '连衣裙'], ['lolita', '洛丽塔'], ['pinafore', '吊带裙'], ['yukata', '浴衣']];
    const BOTS = [['pants', '长裤'], ['shorts', '短裤'], ['skirt', '短裙'], ['pleated', '百褶裙'], ['tutu', '蓬蓬裙'], ['cargo', '阔腿工装裤']];
    const SOCKS = [['none', '无'], ['ankle', '短袜'], ['knee', '及膝袜'], ['thigh', '过膝袜'], ['stripe', '条纹袜']];
    const SHOEST = [['sneaker', '小白鞋'], ['boot', '短靴'], ['mary', '玛丽珍'], ['platform', '厚底鞋'], ['loafer', '乐福鞋']];
    const PRINTS = [['none', '无'], ['heart', '爱心'], ['star', '星星'], ['ring', '泡泡'], ['stripe', '横条纹'], ['dots', '波点'], ['plaid', '格子']];
    const HATS = [['none', '无'], ['beanie', '毛线帽'], ['cap', '鸭舌帽'], ['beret', '贝雷帽'], ['bunny', '兔耳'], ['catears', '猫耳'], ['bearears', '熊耳'], ['crown', '小皇冠'], ['flower', '小花'], ['bow', '侧边蝴蝶结'],
        ['bigbow', '头顶大蝴蝶结'], ['headband', '发带'], ['strawhat', '草帽'], ['halo', '光环']];
    const CLIPS = [['none', '无'], ['bars', '一字夹'], ['heart', '爱心夹'], ['star', '星星夹'], ['x', '叉叉夹'], ['bow', '小蝴蝶结']];
    const FACES = [['none', '无'], ['glasses', '方框眼镜'], ['round', '圆框眼镜'], ['sun', '墨镜'], ['heartsun', '爱心墨镜'], ['mask', '口罩'], ['bandaid', '创可贴'], ['eyepatch', '眼罩'], ['sticker', '星星贴纸']];
    const NECKS = [['none', '无'], ['choker', '项圈'], ['ribbon', '领口蝴蝶结'], ['bell', '铃铛项圈'], ['pearls', '珍珠项链'], ['scarf', '围巾'], ['bowtie', '领结'], ['phones', '耳机']];
    const BACKS = [['none', '无'], ['wings', '天使翅膀'], ['bat', '小恶魔翅膀'], ['pack', '书包'], ['bear', '小熊背包'], ['tail', '尾巴']];
    const HOLDS = [['none', '无'], ['boba', '奶茶'], ['flower', '花束'], ['ice', '冰淇淋'], ['plush', '小熊玩偶'], ['wand', '魔法棒'], ['phone', '手机']];
    // 表情预设：一键换「眼睛 + 嘴巴 + 眉毛 + 腮红」
    const EXPRS = [
        ['开心', { eyes: 'happy', mouth: 'grin', brow: 'none', blush: true }], ['ω猫猫', { eyes: 'dot', mouth: 'cat', brow: 'none', blush: true }], ['> ω <', { eyes: 'cross', mouth: 'cat', brow: 'none', blush: true }],
        ['T ω T', { eyes: 'cry', mouth: 'cat', brow: 'none', blush: false }], ['+ ω +', { eyes: 'plus', mouth: 'cat', brow: 'none', blush: false }], ['○ ω ○', { eyes: 'ring', mouth: 'cat', brow: 'none', blush: true }],
        ['Π ω Π', { eyes: 'pi', mouth: 'cat', brow: 'none', blush: false }], ['□ v □', { eyes: 'box', mouth: 'smile', brow: 'none', blush: false }], ['无语', { eyes: 'dash', mouth: 'flat', brow: 'normal', blush: false }],
        ['星星眼', { eyes: 'sparkle', mouth: 'open', brow: 'none', blush: true }], ['爱心眼', { eyes: 'heart', mouth: 'grin', brow: 'none', blush: true }], ['晕晕', { eyes: 'swirl', mouth: 'wave', brow: 'none', blush: false }],
        ['困困', { eyes: 'sleepy', mouth: 'o', brow: 'none', blush: true }], ['哼', { eyes: 'lid', mouth: 'smirk', brow: 'angry', blush: false }], ['委屈', { eyes: 'round', mouth: 'sad', brow: 'sad', blush: true }],
        ['得意', { eyes: 'smile', mouth: 'fang', brow: 'high', blush: true }], ['凶凶', { eyes: 'tri', mouth: 'tri', brow: 'angry', blush: false }], ['吐舌', { eyes: 'wink', mouth: 'tongue', brow: 'none', blush: true }],
        ['乖巧', { eyes: 'round', mouth: 'smile', brow: 'none', blush: true }], ['呆呆', { eyes: 'bean', mouth: 'flat', brow: 'none', blush: false }]
    ];

    function defaultAvatar(kind) {
        const base = { brow: 'normal', freckle: false, ac: '#ffffff', shoe: '#f4f1f7', shoeT: 'sneaker', sock: 'none', sc: '#ffffff', print: 'none', prc: '#ffffff', hat: 'none', hatc: '#e87f8f', clip: 'none', clipc: '#f4a6c0', ahoge: false, face: 'none', facec: '#4a4a55', neck: 'none', neckc: '#e87f8f', back: 'none', backc: '#ffffff', hold: 'none', holdc: '#f6a9bd' };
        return kind === 'ta'
            ? Object.assign({}, base, { skin: SKINS[1], hair: 'curtain', hc: HAIRC[0], eyes: 'tall', ec: EYEC[2], brow: 'normal', mouth: 'smile', blush: false, top: 'hoodie', tc: '#9bbbd9', bot: 'pants', bc: BOTC[1] })
            : Object.assign({}, base, { skin: SKINS[0], hair: 'bob', hc: HAIRC[1], eyes: 'round', ec: EYEC[1], brow: 'none', mouth: 'smile', blush: true, top: 'sweater', tc: '#f6c9d4', bot: 'pleated', bc: BOTC[0], shoe: '#8a5a3c', sock: 'knee', clip: 'bars' });
    }
    const has = (arr, v) => arr.some(x => x[0] === v);
    const OPT_KEYS = [['hair', HAIRS], ['eyes', EYES], ['brow', BROWS], ['mouth', MOUTHS], ['top', TOPS], ['bot', BOTS], ['sock', SOCKS], ['shoeT', SHOEST], ['print', PRINTS], ['hat', HATS], ['clip', CLIPS], ['face', FACES], ['neck', NECKS], ['back', BACKS], ['hold', HOLDS]];
    const COL_KEYS = ['skin', 'hc', 'ec', 'tc', 'ac', 'bc', 'shoe', 'sc', 'prc', 'hatc', 'clipc', 'facec', 'neckc', 'backc', 'holdc'];
    function cleanAvatar(a, kind) {
        const d = defaultAvatar(kind), o = Object.assign({}, d, a || {});
        OPT_KEYS.forEach(p => { if (!has(p[1], o[p[0]])) o[p[0]] = d[p[0]]; });
        COL_KEYS.forEach(k => { if (!/^#[0-9a-f]{6}$/i.test(String(o[k]))) o[k] = d[k]; });
        o.blush = !!o.blush; o.freckle = !!o.freckle; o.ahoge = !!o.ahoge;
        if (o.custom && !(o.custom.rows && o.custom.pal)) delete o.custom;
        return o;
    }
    function randomAvatar() {
        const r = (a) => a[Math.floor(Math.random() * a.length)], n = (a) => r(a)[0], p = (q) => Math.random() < q;
        const ex = r(EXPRS)[1], top = n(TOPS), skirty = ['dress', 'lolita', 'pinafore', 'yukata'].indexOf(top) >= 0;
        return {
            skin: r(SKINS.slice(0, 6).concat(SKINS.slice(8))), hair: n(HAIRS), hc: r(HAIRC), eyes: ex.eyes, ec: r(EYEC), brow: ex.brow, mouth: ex.mouth, blush: ex.blush || p(.3), freckle: p(.15),
            top: top, tc: r(CLOTHC), ac: r(CLOTHC), bot: skirty ? 'pants' : n(BOTS), bc: r(BOTC), sock: p(.4) ? n(SOCKS) : 'none', sc: r(['#ffffff', '#2b2b33', '#f6c9d4']), shoe: r(SHOEC), shoeT: n(SHOEST),
            print: p(.35) ? n(PRINTS) : 'none', prc: r(CLOTHC), hat: p(.55) ? 'none' : n(HATS), hatc: r(CLOTHC), clip: p(.5) ? 'none' : n(CLIPS), clipc: r(CLOTHC), ahoge: p(.2),
            face: p(.75) ? 'none' : n(FACES), facec: r(['#4a4a55', '#2b2b33', '#e87f8f', '#5c7fb5']), neck: p(.55) ? 'none' : n(NECKS), neckc: r(CLOTHC), back: p(.8) ? 'none' : n(BACKS), backc: r(CLOTHC), hold: p(.75) ? 'none' : n(HOLDS), holdc: r(CLOTHC)
        };
    }

    // ---- 发型点阵 ----
    // 行是 10 个字符的「左半边」，自动镜像成 20 列；a=发色 h=高光 d=暗部 r=发饰色 .=透明
    const mirrorRow = (r) => r + r.split('').reverse().map(c => c === 'h' ? 'a' : c).join('');
    const m = (y, rows) => ({ y: y, r: rows.map(mirrorRow) });
    const fl = (y, rows) => ({ y: y, r: rows });
    const rep = (s, n) => Array(n).fill(s);
    const pad = (l, s) => '.'.repeat(l) + s + '.'.repeat(Math.max(0, 20 - l - s.length));
    const rev = (rows) => rows.map(r => r.split('').reverse().join(''));
    const T1 = ['.....aaaaa', '...aahhaaa', '..aaaaaaaa'];
    const PONY = [pad(16, 'rrr'), pad(15, 'aaaaa'), pad(16, 'aaaa'), pad(16, 'aaaa'), pad(17, 'aaa'), pad(17, 'aaa'), pad(17, 'aaa'), pad(17, 'aaa'), pad(17, 'aaa'), pad(18, 'aa'), pad(18, 'aa'), pad(18, 'aa'), pad(18, 'a')];
    const BANG1 = [...T1, '..aaaaaaaa', '..aa.aa.aa', '..a.......']; // 通用刘海
    const HS = {
        short: { f: [m(-1, [...T1, '..aaaaaaaa', '..aa.a.aa.', '..a.......'])], b: [m(2, rep('..aaaaaaaa', 3))] },
        crop: { f: [m(-1, [...T1, '..aaaaaaaa', '..aaaaaaaa', '...aa.a..a'])], b: [m(2, [...rep('..aaaaaaaa', 6), '...aaaaaaa'])] },
        curtain: { f: [m(-1, ['.....aaaaa', '...aahhaa.', '..aaaaaa..', '..aaaaaa..', '..aaaaa...', '..aaaa....', '..aaa.....', '..aa......', '..aa......'])], b: [m(1, [...rep('..aaaaaaaa', 8), '...aaaaaaa'])] },
        spiky: { f: [m(-3, ['..a...a..a', '..aa.aaaaa', '...aaaaaaa', '..aahhaaaa', '..aaaaaaaa', '..aaaaaaaa', '..a.aa.aa.', '..a..a....'])], b: [m(2, rep('..aaaaaaaa', 3))] },
        shaggy: { f: [m(-2, ['.....aaaaa', '...aaaaaaa', '..aahhaaaa', '..aaaaaaaa', '..aaaaaaaa', '..aaa.aa.a', '..a.a..a..', '..a.......'])], b: [m(1, [...rep('..aaaaaaaa', 10), '...aaaaaaa', '...aaaaaa.', '....aaaa..', '.....aa...'])] },
        bob: { f: [m(-1, [...T1, '..aaaaaaaa', '..aaa.aa.a', '..aa......', '..aa......', '..aa......', '..aa......'])], b: [m(1, [...rep('..aaaaaaaa', 9), '...aaaaaaa'])] },
        bobflip: { f: [m(-1, [...T1, '..aaaaaaaa', '..aaa.aa.a', '..aa......', '..aa......', '..aa......', '..aa......'])], b: [m(1, [...rep('..aaaaaaaa', 9), '.aaaaaaaaa', '.aa.......'])] },
        hime: { f: [m(-1, [...T1, '..aaaaaaaa', '..aaaaaaaa', '..aa......', '..aa......', '..aa......', '..aa......', '..aa......', '..aa......', '..aa......', '..aa......'])], b: [m(1, [...rep('..aaaaaaaa', 19), '...aaaaaaa'])] },
        long: { f: [m(-1, [...T1, '..aaaaaaa.', '..aaaaaa..', '..aaaa....', '..aa......', '..aa......', '..aa......', '..aa......', '..aa......'])], b: [m(1, [...rep('..aaaaaaaa', 19), '...aaaaaaa'])] },
        wave: { f: [m(-1, [...T1, '..aaaaaaa.', '..aaaaaa..', '..aaaaa...', '..aaa.....', '..aa......', '..aa......', '..aa......'])], b: [m(1, [...rep('..aaaaaaaa', 10), '.aaaaaaaaa', '.aaaaaaaaa', '.aaaaaaaaa', '..aaaaaaaa', '..aaaaaaaa', '.aaaaaaaaa', '.aaaaaaaaa', '.aaaaaaaaa', '.aaaaaaaaa', '.aaa.aaaaa', '..aa.aaa..'])] },
        fluffy: {
            f: [m(-2, ['.....aaaaa', '...aaaaaaa', '..aahhaaaa', '..aaaaaaaa', '..aaaaaaaa', '..aa.aaa.a', '..a..a....'])],
            b: [m(-2, ['......aaaa', '...aaaaaaa', '..aaaaaaaa', '.aaaaaaaaa', '.aaaaaaaaa', 'aaaaaaaaaa', 'aaaaaaaaaa', 'aaaaaaaaaa', 'aaaaaaaaaa', 'aaaaaaaaaa', '.aaaaaaaaa', '.aaaaaaaaa', '..aaaaaaaa', '...aaaaaaa', '.....aaaaa'])]
        },
        twin: { f: [m(-1, [...T1, '..aaaaaaaa', '..aaa.aa..', '..a.......'])], b: [m(1, ['.rr.......', 'aahaa.....', 'aaaa......', 'aaaa......', 'aaaa......', 'aaaa......', 'aaaa......', 'aaaa......', '.aaa......', '.aaa......', '.aaa......', '..aa......', '..aa......', '...a......']), m(1, rep('..aaaaaaaa', 4))] },
        lowtwin: { f: [m(-1, [...T1, '..aaaaaaaa', '..aa.aa.aa', '..aa......', '..aa......', '..aa......', '..aa......'])], b: [m(1, [...rep('..aaaaaaaa', 7), '.rraaaaaaa', '.aaa......', '.aaa......', '.aaa......', '.aaa......', '.aaa......', '.aaa......', '..aa......', '..aa......', '..aa......', '...a......'])] },
        buns: { f: [m(-1, [...T1, '..aaaaaaaa', '..aaa.aa.a', '..a.......'])], b: [m(-4, ['..aaa.....', '.aaaaa....', '.ahaaa....', '.aaraa....', '...aaaaaaa', ...rep('..aaaaaaaa', 4)])] },
        bun: { f: [m(-1, [...T1, '..aaaaaaaa', '..aa.aa.aa', '..a.......'])], b: [m(-6, ['........aa', '......aaaa', '......ahaa', '......aaaa', '........rr']), m(1, rep('..aaaaaaaa', 3))] },
        pony: { f: [m(-1, BANG1)], b: [m(1, rep('..aaaaaaaa', 4)), fl(1, PONY)] },
        sidetail: { f: [m(-1, BANG1)], b: [m(1, rep('..aaaaaaaa', 6)), fl(5, rev(PONY))] },
        braid: { f: [m(-1, [...T1, '..aaaaaaaa', '..aaa.aa.a', '..aa......', '..a.......'])], b: [m(1, rep('..aaaaaaaa', 4)), m(5, ['.rrr......', '.ada......', '.dad......', '.ada......', '.dad......', '.ada......', '.dad......', '.ada......', '.dad......', '.ada......', '.rrr......', '..a.......'])] },
        sidebang: {
            f: [m(-1, T1), fl(2, ['..aaaaaaaaaaaaaaaa..', '..aaaaaaaaaaa.......', '..aaaaaaa...........', '..aaaa..........aa..', '..aa............aa..', '..aa............aa..', '..aa................']), ],
            b: [m(1, rep('..aaaaaaaa', 9))]
        }
    };
    function drawMap(P, a, hy, seg, bottomShade) {
        const col = { a: a.hc, h: shade(a.hc, .3), d: shade(a.hc, -.2), r: a.clipc }, dk = shade(a.hc, -.16);
        seg.forEach(s => {
            s.r.forEach((row, j) => {
                const below = s.r[j + 1] || '';
                for (let i = 0; i < row.length; i++) {
                    const k = row[i]; if (k === '.' || !col[k]) continue;
                    let c = col[k];
                    if (bottomShade && k === 'a' && (below[i] === undefined || below[i] === '.')) c = dk;
                    P.p(i, hy + s.y + j, c);
                }
            });
        });
    }
    function hairBack(P, a, hy) { const h = HS[a.hair] || HS.short; drawMap(P, a, hy, h.b || [], false); }
    function hairFront(P, a, hy) {
        const h = HS[a.hair] || HS.short; drawMap(P, a, hy, h.f || [], true);
        if (a.ahoge && a.hat === 'none') { const c = a.hc; [[10, -2], [10, -3], [11, -4], [12, -4], [12, -3]].forEach(p => P.p(p[0], hy + p[1], c)); P.p(10, hy - 3, shade(c, .3)); }
        const k = a.clipc, kl = shade(k, .35), kd = shade(k, -.2);
        switch (a.clip) {
            case 'bars': P.r(4, hy + 2, 3, 1, k); P.r(4, hy + 3, 3, 1, kl); break;
            case 'heart': P.p(4, hy + 2, k); P.p(6, hy + 2, k); P.r(4, hy + 3, 3, 1, k); P.p(5, hy + 4, kd); break;
            case 'star': P.p(5, hy + 1, k); P.r(4, hy + 2, 3, 1, k); P.p(5, hy + 3, k); P.p(5, hy + 2, kl); break;
            case 'x': P.p(4, hy + 1, k); P.p(6, hy + 1, k); P.p(5, hy + 2, kl); P.p(4, hy + 3, k); P.p(6, hy + 3, k); break;
            case 'bow': P.r(4, hy + 2, 2, 2, k); P.r(7, hy + 2, 2, 2, k); P.p(6, hy + 2, kd); P.p(6, hy + 3, kd); break;
        }
    }
    function drawHead(P, a, hy) {
        const s = a.skin, sd = shade(s, -.1), sl = shade(s, .14);
        P.r(5, hy, 10, 1, s); P.r(4, hy + 1, 12, 1, s); P.r(3, hy + 2, 14, 8, s); P.r(4, hy + 10, 12, 1, s); P.r(5, hy + 11, 10, 1, sd);
        P.r(2, hy + 6, 1, 2, sd); P.r(17, hy + 6, 1, 2, sd); P.r(4, hy + 2, 2, 1, sl); P.r(3, hy + 3, 1, 1, sl);
    }
    // 眼睛点阵：K=深色 E=虹膜色 W=白 H=浅虹膜 P=粉 B=泪；flip=右眼镜像；y=起始行(相对头顶)
    const EYEDEF = {
        tall: { y: 5, rows: ['KK', 'WE', 'EE'] }, bean: { y: 5, rows: ['KK', 'WK', 'KK'] }, dot: { y: 6, rows: ['KK', 'KK'] },
        sleepy: { y: 6, rows: ['KKK', 'K..'], flip: 1 }, lid: { y: 6, rows: ['KKK', 'EEE'] },
        happy: { y: 6, rows: ['.K.', 'K.K'] }, smile: { y: 6, rows: ['K.K', '.K.'] },
        wide: { y: 5, rows: ['KKK', 'EWE', 'EEE'] }, sparkle: { y: 5, rows: ['KKK', 'WEE', 'EEE', '.HH'] }, round: { y: 5, rows: ['.KK.', 'KWEK', 'KEHK', '.KK.'] },
        heart: { y: 5, rows: ['P.P', 'PPP', '.P.'] }, swirl: { y: 5, rows: ['KKKK', 'K..K', 'K.KK', 'KKK.'] }, plus: { y: 5, rows: ['.K.', 'KKK', '.K.'] },
        ring: { y: 5, rows: ['.K.', 'KWK', '.K.'] }, box: { y: 5, rows: ['KKK', 'KWK', 'KKK'] }, cross: { y: 5, rows: ['K..', '.KK', 'K..'], flip: 1 },
        x: { y: 5, rows: ['K.K', '.K.', 'K.K'] }, cry: { y: 5, rows: ['KKK', '.K.', '.K.', '.B.'] }, pi: { y: 5, rows: ['KKK', 'K.K', 'K.K'] },
        dash: { y: 7, rows: ['KKK'] }, tri: { y: 5, rows: ['K..', 'KK.', 'KKK'], flip: 1 }
    };
    const EYE_CLOSED = { y: 6, rows: ['K.K', '.K.'] };
    const MOUTHDEF = {
        smile: [8, 8, ['M..M', '.MM.']], grin: [8, 8, ['WMMW', '.TT.']], cat: [7, 8, ['M.MM.M', '.M..M.']], fang: [7, 8, ['.M..M.', '..MM..', '..W...']], tongue: [7, 8, ['.M..M.', '..MM..', '...T..']],
        open: [8, 8, ['MMMM', 'MTTM', '.MM.']], o: [9, 8, ['MM', 'MM']], pout: [9, 9, ['pp', 'pp']], flat: [9, 9, ['MM']], wave: [7, 8, ['.M.M.M', 'M.M.M.']], tri: [8, 8, ['MMMM', '.MM.']],
        smirk: [8, 8, ['...M', 'MMM.']], sad: [8, 8, ['.MM.', 'M..M']]
    };
    function drawFace(P, a, hy, closed) {
        const K0 = shade(a.ec, -.55), K = K0 === '#000000' ? '#1a1620' : K0, col = { K: K, E: a.ec, W: '#ffffff', H: shade(a.ec, .5), P: '#ff7fa0', B: '#8fd0ff' };
        const eye = (def, x, flip) => def.rows.forEach((row, j) => { for (let i = 0; i < row.length; i++) { const k = row[flip ? row.length - 1 - i : i]; if (k !== '.' && col[k]) P.p(x + i, hy + def.y + j, col[k]); } });
        let bot = 8;
        if (closed) { eye(EYE_CLOSED, 5, 0); eye(EYE_CLOSED, 12, 0); }
        else if (a.eyes === 'wink') { const L = EYEDEF.happy, R = EYEDEF.dot; eye(L, 8 - 3, 0); eye(R, 12, 0); }
        else { const d = EYEDEF[a.eyes] || EYEDEF.tall, w = d.rows[0].length; eye(d, 8 - w, 0); eye(d, 12, d.flip); bot = Math.max(8, d.y + d.rows.length); }
        const bc = shade(a.hc, -.15);
        const brow = { normal: [[6, 4], [7, 4], [12, 4], [13, 4]], angry: [[6, 3], [7, 4], [12, 4], [13, 3]], sad: [[6, 4], [7, 3], [12, 3], [13, 4]], high: [[6, 4], [7, 4], [12, 3], [13, 3]] }[a.brow];
        if (brow) brow.forEach(p => P.p(p[0], hy + p[1], bc));
        if (a.blush) { const b = mix(a.skin, '#ff6f91', .55); P.r(4, hy + bot, 2, 1, b); P.r(14, hy + bot, 2, 1, b); }
        if (a.freckle) { const f = shade(a.skin, -.28); [[5, 7], [7, 8], [13, 8], [15, 7]].forEach(p => P.p(p[0], hy + p[1], f)); }
        const md = MOUTHDEF[a.mouth] || MOUTHDEF.smile, mc = { M: '#9c4552', T: '#f58a98', W: '#ffffff', p: '#d86a7a' };
        md[2].forEach((row, j) => { for (let i = 0; i < row.length; i++) { const k = row[i]; if (k !== '.') P.p(md[0] + i, hy + md[1] + j, mc[k]); } });
    }
    const SKIRTY = ['dress', 'lolita', 'pinafore', 'yukata'];
    function drawLegs(P, a, hy, n, frame) {
        const y0 = hy + 18, sk = a.skin, skirty = SKIRTY.indexOf(a.top) >= 0, wide = a.bot === 'cargo' && !skirty;
        const bare = skirty || ['shorts', 'skirt', 'pleated', 'tutu'].indexOf(a.bot) >= 0, pc = a.top === 'pj' ? shade(a.tc, -.08) : a.bc, sock = bare && a.sock !== 'none';
        [0, 1].forEach(i => {
            const lift = (frame === 1 && i === 0) || (frame === 2 && i === 1) ? 1 : 0, len = n - lift, w = wide ? 3 : 2, x = wide ? (i ? 11 : 6) : (i ? 11 : 7);
            for (let r = 0; r < len; r++) {
                let col = !bare ? pc : (a.bot === 'shorts' && !skirty && r < 2) ? pc : sk;
                if (a.top === 'overall' && r < 3) col = a.bc;
                if (sock) { const cv = { ankle: r >= len - 1, knee: r >= 1, thigh: true, stripe: r >= 1 }[a.sock]; if (cv) col = (a.sock === 'stripe' && r % 2 === 0) ? '#ffffff' : a.sc; }
                P.r(x, y0 + r, w, 1, col);
            }
            const sx = x - 1, sw = w + 1, sy = y0 + n - lift, sc = a.shoe;
            switch (a.shoeT) {
                case 'boot': P.r(x, sy - 2, w, 2, sc); P.p(x, sy - 2, shade(sc, .25)); P.r(sx, sy, sw, 1, shade(sc, -.2)); break;
                case 'mary': P.r(sx, sy, sw, 1, sc); P.r(x, sy - 1, w, 1, shade(sc, .12)); P.p(x, sy - 1, shade(sc, .4)); break;
                case 'platform': P.r(sx, sy, sw, 1, '#ffffff'); P.r(sx, sy - 1, sw, 1, sc); P.p(sx + 1, sy - 1, shade(sc, .3)); break;
                case 'loafer': P.r(sx, sy, sw, 1, sc); P.p(x, sy, shade(sc, .4)); P.p(x + w - 1, sy, shade(sc, -.15)); break;
                default: P.r(sx, sy, sw, 1, sc);
            }
        });
        if (!skirty && a.top !== 'overall') {
            if (a.bot === 'skirt') P.b(5, hy + 17, 10, 3, a.bc);
            else if (a.bot === 'pleated') { P.b(5, hy + 17, 10, 4, a.bc); [6, 8, 10, 12].forEach(x => P.r(x, hy + 18, 1, 3, shade(a.bc, -.13))); P.r(5, hy + 20, 10, 1, shade(a.bc, -.24)); }
            else if (a.bot === 'tutu') { P.b(4, hy + 17, 12, 3, a.bc); for (let i = 0; i < 12; i++) if (i % 2) P.p(4 + i, hy + 20, shade(a.bc, .12)); P.r(4, hy + 18, 12, 1, shade(a.bc, .15)); }
            else if (a.bot === 'cargo') { P.r(6, hy + 17, 8, 1, shade(a.bc, -.2)); P.p(6, hy + 19, shade(a.bc, -.18)); P.p(13, hy + 19, shade(a.bc, -.18)); }
        }
    }
    function drawOutfit(P, a, hy, sit) {
        const t = a.tc, y = hy + 12, sk = a.skin, A = a.ac, W = '#ffffff';
        const arms = (long, cuff, col) => { col = col || t; [5, 14].forEach(x => { if (long) { P.b(x, y + 1, 1, 4, col); P.p(x, y + 5, cuff || sk); } else { P.b(x, y + 1, 1, 2, col); P.r(x, y + 3, 1, 2, sk); P.p(x, y + 5, sk); } }); };
        const bareArms = () => [5, 14].forEach(x => { P.r(x, y + 1, 1, 4, sk); P.p(x, y + 5, sk); });
        switch (a.top) {
            case 'hoodie': P.b(6, y, 8, 6, t); P.r(6, y, 8, 1, shade(t, -.16)); P.r(9, y, 2, 1, sk); P.p(8, y + 1, W); P.p(11, y + 1, W); P.r(8, y + 4, 4, 1, shade(t, -.2)); arms(true); break;
            case 'dress': P.b(6, y, 8, 3, t); P.r(6, y + 2, 8, 1, A); P.b(5, y + 3, 10, 4, t); P.r(5, y + 6, 10, 1, shade(t, -.22)); P.r(9, y, 2, 1, sk); arms(false); break;
            case 'sweater': P.b(6, y, 8, 6, t); P.r(6, y + 2, 8, 1, A); P.r(6, y + 4, 8, 1, A); P.r(9, y, 2, 1, sk); arms(true, shade(A, -.1)); break;
            case 'shirt': { P.b(6, y, 8, 6, t); P.p(8, y, shade(t, -.14)); P.p(11, y, shade(t, -.14)); P.r(9, y, 2, 1, sk); P.r(9, y + 1, 2, 1, shade(t, -.1)); P.r(9, y + 2, 2, 3, A); P.p(9, y + 5, shade(A, -.2)); P.p(10, y + 5, shade(A, -.2)); arms(false); break; }
            case 'pj': P.b(6, y, 8, 6, t); [[8, 2], [11, 4], [7, 4]].forEach(p => P.p(p[0], y + p[1], A)); P.r(9, y, 2, 1, sk); arms(true); break;
            case 'sailor': P.b(6, y, 8, 6, W); P.r(6, y, 8, 2, t); P.r(9, y, 2, 2, W); P.p(9, y + 2, A); P.p(10, y + 2, A); P.r(6, y + 5, 8, 1, shade(W, -.12)); [5, 14].forEach(x => { P.b(x, y + 1, 1, 2, W); P.p(x, y + 2, t); P.r(x, y + 3, 1, 2, sk); P.p(x, y + 5, sk); }); break;
            case 'overall': P.b(6, y, 8, 6, t); P.r(9, y, 2, 1, sk); P.b(7, y + 2, 6, 4, a.bc); P.p(7, y + 1, a.bc); P.p(12, y + 1, a.bc); P.p(7, y, a.bc); P.p(12, y, a.bc); P.p(8, y + 2, '#ffe08a'); P.p(11, y + 2, '#ffe08a'); arms(true); break;
            case 'crop': P.b(6, y, 8, 3, t); P.r(9, y, 2, 1, sk); P.r(6, y + 2, 8, 1, shade(t, -.14)); P.r(6, y + 3, 8, 2, sk); P.p(9, y + 4, shade(sk, -.2)); P.r(6, y + 5, 8, 1, shade(a.bc, -.05)); arms(false); break;
            case 'camisole': P.r(6, y, 8, 1, sk); P.p(7, y, t); P.p(12, y, t); P.r(6, y + 1, 8, 5, t); for (let i = 0; i < 8; i++) P.p(6 + i, y + 1, i % 2 ? shade(t, .3) : A); P.r(6, y + 5, 8, 1, shade(t, -.15)); bareArms(); break;
            case 'cardigan': P.b(6, y, 8, 6, A); P.b(6, y, 3, 6, t); P.b(11, y, 3, 6, t); P.r(9, y, 2, 1, sk); P.p(8, y + 2, W); P.p(8, y + 4, W); arms(true, shade(t, -.15)); break;
            case 'blazer': P.b(6, y, 8, 6, t); P.r(8, y, 4, 4, W); P.r(9, y, 2, 1, sk); P.p(8, y, shade(t, -.2)); P.p(11, y, shade(t, -.2)); P.r(9, y + 1, 2, 1, A); P.p(9, y + 2, shade(A, -.18)); P.p(10, y + 2, shade(A, -.18)); P.p(8, y + 4, '#ffe08a'); P.p(11, y + 4, '#ffe08a'); P.r(6, y + 5, 8, 1, shade(t, -.2)); arms(true, W); break;
            case 'varsity': P.b(6, y, 8, 6, t); P.r(7, y, 6, 1, A); P.r(9, y + 1, 1, 5, '#e8e8ee'); P.r(11, y + 2, 2, 2, A); P.r(6, y + 5, 8, 1, A); arms(true, A, A); [5, 14].forEach(x => P.p(x, y + 4, t)); break;
            case 'puffer': P.b(5, y, 10, 6, t); P.r(5, y + 2, 10, 1, shade(t, -.2)); P.r(5, y + 4, 10, 1, shade(t, -.2)); P.r(7, y, 6, 1, shade(t, .12)); P.r(9, y, 2, 1, sk); P.r(9, y + 1, 1, 5, shade(t, -.3)); [4, 15].forEach(x => { P.b(x, y + 1, 1, 4, t); P.p(x, y + 5, sk); }); break;
            case 'lolita': {
                P.b(6, y, 8, 3, t); P.r(8, y, 4, 1, W); P.r(8, y + 1, 4, 1, A); P.p(9, y + 1, shade(A, -.2)); P.p(10, y + 1, shade(A, -.2));
                P.b(4, y + 1, 2, 2, t); P.r(4, y + 2, 2, 1, W); P.r(5, y + 3, 1, 2, sk); P.b(14, y + 1, 2, 2, t); P.r(14, y + 2, 2, 1, W); P.r(14, y + 3, 1, 2, sk);
                P.b(4, y + 3, 12, 3, t); P.r(6, y + 3, 8, 1, A); for (let i = 0; i < 12; i++) P.p(4 + i, y + 5, i % 2 ? W : shade(t, -.14)); for (let i = 0; i < 10; i++) P.p(5 + i, y + 6, i % 2 ? shade(W, -.1) : W); break;
            }
            case 'pinafore': P.b(6, y, 8, 6, A); P.r(9, y, 2, 1, sk); P.b(7, y + 1, 6, 5, t); P.p(7, y, t); P.p(12, y, t); P.p(8, y + 2, '#ffe08a'); P.p(11, y + 2, '#ffe08a'); P.b(5, y + 4, 10, 3, t); P.r(5, y + 6, 10, 1, shade(t, -.2)); arms(true, shade(A, -.1), A); break;
            case 'yukata': P.b(6, y, 8, 6, t); P.p(8, y, W); P.p(9, y + 1, W); P.p(10, y + 2, W); P.p(11, y, W); P.p(10, y + 1, W); P.r(9, y, 1, 1, sk); P.b(6, y + 3, 8, 2, A); P.r(9, y + 3, 2, 2, shade(A, -.2)); [[7, 1], [12, 2], [7, 5], [12, 5], [11, 1]].forEach(p => P.p(p[0], y + p[1], shade(t, .35))); P.b(6, y + 5, 8, 3, t); P.r(6, y + 7, 8, 1, shade(t, -.2)); [4, 14].forEach(x => { P.b(x, y + 1, 2, 4, t); P.p(x + (x < 9 ? 1 : 0), y + 5, sk); }); break;
            default: P.b(6, y, 8, 6, t); P.r(9, y, 2, 1, sk); P.r(8, y + 4, 4, 1, shade(t, -.1)); arms(false);
        }
        // 印花
        if (a.print !== 'none' && ['tee', 'hoodie', 'crop', 'camisole'].indexOf(a.top) >= 0) {
            const c = a.prc, sy = a.top === 'crop' ? y : a.top === 'camisole' ? y + 2 : y + 1;
            const shapes = { heart: ['P..P', 'PPPP', '.PP.'], star: ['.PP.', 'PPPP', 'P..P'], ring: ['.PP.', 'P..P', '.PP.'] };
            if (shapes[a.print]) shapes[a.print].forEach((row, j) => { for (let i = 0; i < 4; i++) if (row[i] === 'P' && !(a.top === 'crop' && sy + j > y + 2)) P.p(8 + i, sy + j, c); });
            else if (a.print === 'stripe') [1, 3].forEach(r => { if (!(a.top === 'crop' && r > 1)) P.r(6, y + r + (a.top === 'camisole' ? 1 : 0), 8, 1, c); });
            else if (a.print === 'dots') [[7, 1], [10, 1], [8, 3], [11, 3], [7, 5], [12, 5]].forEach(p => { if (!(a.top === 'crop' && p[1] > 1)) P.p(p[0], y + p[1], c); });
            else if (a.print === 'plaid') { [8, 11].forEach(x => P.r(x, y + 1, 1, a.top === 'crop' ? 2 : 5, c)); [2, 4].forEach(r => { if (!(a.top === 'crop' && r > 1)) P.r(6, y + r, 8, 1, shade(c, -.05)); }); }
        }
    }
    function drawHold(P, a, hy) {
        const y = hy + 12, c = a.holdc;
        switch (a.hold) {
            case 'boba': P.p(16, y, '#ff7fa0'); P.r(15, y + 1, 2, 1, W2); P.r(15, y + 2, 2, 3, c); P.p(15, y + 2, shade(c, .35)); P.r(15, y + 4, 2, 1, '#5a3b2e'); break;
            case 'flower': P.r(15, y + 3, 1, 3, '#6bb36b'); P.p(15, y + 2, c); P.p(16, y + 2, shade(c, .15)); P.p(15, y + 1, shade(c, -.1)); P.p(16, y + 1, c); P.p(17, y + 2, shade(c, .1)); P.p(16, y + 3, '#6bb36b'); break;
            case 'ice': P.e(16, y + 2, 1.9, 1.7, c); P.r(15, y + 3, 2, 1, '#e8b46a'); P.p(15, y + 4, '#d99a4a'); P.p(16, y + 4, '#e8b46a'); P.p(15, y + 5, '#d99a4a'); break;
            case 'plush': P.b(15, y + 2, 5, 3, c); P.p(15, y + 1, c); P.p(19, y + 1, c); P.p(16, y + 3, '#3a2f3a'); P.p(18, y + 3, '#3a2f3a'); P.p(17, y + 4, '#9c4552'); P.b(16, y + 5, 3, 1, shade(c, -.08)); break;
            case 'wand': P.r(16, y + 3, 1, 3, '#e8d0a0'); P.p(16, y, '#ffe27a'); P.r(15, y + 1, 3, 1, '#ffe27a'); P.p(16, y + 2, '#ffe27a'); P.p(16, y + 1, W2); P.p(17, y + 3, c); break;
            case 'phone': P.b(15, y + 2, 3, 4, c); P.r(16, y + 3, 1, 2, '#bfe3ff'); break;
        }
    }
    const W2 = '#ffffff';
    function drawHat(P, a, hy) {
        const c = a.hatc, d = shade(c, -.2), l = shade(c, .3);
        switch (a.hat) {
            case 'beanie': P.b(3, hy - 2, 14, 4, c); P.r(3, hy + 1, 14, 1, d); P.r(4, hy - 3, 12, 1, c); P.e(10, hy - 4, 1.8, 1.6, l); [5, 8, 11, 14].forEach(x => P.p(x, hy - 1, d)); break;
            case 'cap': P.b(4, hy - 2, 12, 4, c); P.r(3, hy + 1, 15, 1, d); P.b(10, hy + 1, 8, 2, d); P.p(10, hy - 1, '#ffffff'); break;
            case 'beret': P.e(10, hy - 1, 7.5, 2.7, c); P.p(10, hy - 4, d); P.r(4, hy + 1, 12, 1, d); break;
            case 'bunny': P.b(5, hy - 8, 3, 8, c); P.b(12, hy - 8, 3, 8, c); P.r(6, hy - 7, 1, 5, '#f6a9bd'); P.r(13, hy - 7, 1, 5, '#f6a9bd'); break;
            case 'catears': P.b(3, hy - 3, 4, 4, c); P.b(13, hy - 3, 4, 4, c); P.r(4, hy - 2, 2, 2, '#f6a9bd'); P.r(14, hy - 2, 2, 2, '#f6a9bd'); P.clr(3, hy - 3, 1, 1); P.clr(16, hy - 3, 1, 1); break;
            case 'bearears': P.e(4, hy - 1, 2.3, 2.3, c); P.e(15, hy - 1, 2.3, 2.3, c); P.p(4, hy - 1, '#f6a9bd'); P.p(15, hy - 1, '#f6a9bd'); break;
            case 'crown': P.r(6, hy - 3, 8, 3, '#ffd24a'); [6, 9, 12].forEach(x => P.p(x, hy - 4, '#ffd24a')); P.p(8, hy - 2, '#e85a6a'); P.p(11, hy - 2, '#5aa8e8'); P.r(6, hy - 1, 8, 1, '#d9a21a'); break;
            case 'flower': P.p(14, hy, '#ffe08a'); [[13, 0], [15, 0], [14, -1], [14, 1]].forEach(p => P.p(p[0], hy + p[1], c)); break;
            case 'bow': P.r(12, hy - 2, 2, 3, c); P.r(15, hy - 2, 2, 3, c); P.r(14, hy - 1, 1, 1, d); P.p(13, hy - 1, l); break;
            case 'bigbow': P.r(5, hy - 4, 4, 3, c); P.r(11, hy - 4, 4, 3, c); P.r(9, hy - 3, 2, 2, d); P.r(5, hy - 4, 4, 1, l); P.r(11, hy - 4, 4, 1, l); break;
            case 'headband': P.r(3, hy, 14, 1, c); P.p(3, hy + 1, c); P.p(16, hy + 1, c); P.r(4, hy, 3, 1, l); break;
            case 'strawhat': P.r(1, hy, 18, 1, '#e8cf8a'); P.r(1, hy + 1, 18, 1, '#c9ae6a'); P.b(5, hy - 3, 10, 3, '#f1dc9f'); P.r(5, hy - 1, 10, 1, c); P.r(12, hy - 1, 2, 2, d); break;
            case 'halo': P.r(7, hy - 4, 6, 1, '#ffe27a'); P.p(6, hy - 3, '#ffe27a'); P.p(13, hy - 3, '#ffe27a'); P.r(7, hy - 2, 6, 1, '#d9b53a'); break;
        }
    }
    function drawFaceAcc(P, a, hy) {
        const c = a.facec;
        const frame = (x, round) => { P.r(x, hy + 4, 4, 1, c); P.r(x, hy + 8, 4, 1, c); P.r(x, hy + 5, 1, 3, c); P.r(x + 3, hy + 5, 1, 3, c); if (round) { P.clr(x, hy + 4, 1, 1); P.clr(x + 3, hy + 4, 1, 1); P.clr(x, hy + 8, 1, 1); P.clr(x + 3, hy + 8, 1, 1); P.p(x + 1, hy + 4, c); P.p(x + 2, hy + 4, c); } };
        switch (a.face) {
            case 'glasses': frame(5, false); frame(11, false); P.r(9, hy + 6, 2, 1, c); break;
            case 'round': frame(5, true); frame(11, true); P.r(9, hy + 6, 2, 1, c); break;
            case 'sun': P.r(5, hy + 5, 4, 3, c); P.r(11, hy + 5, 4, 3, c); P.r(9, hy + 5, 2, 1, c); P.p(6, hy + 5, shade(c, .5)); P.p(12, hy + 5, shade(c, .5)); break;
            case 'heartsun': [5, 11].forEach(x => { ['P..P', 'PPPP', '.PP.'].forEach((r, j) => { for (let i = 0; i < 4; i++) if (r[i] === 'P') P.p(x + i, hy + 5 + j, c); }); P.p(x + 1, hy + 5, shade(c, .5)); }); P.r(9, hy + 5, 2, 1, c); break;
            case 'mask': P.r(4, hy + 8, 12, 3, '#f4f8fb'); P.r(4, hy + 8, 12, 1, '#dbe6ee'); P.r(3, hy + 8, 1, 1, '#dbe6ee'); P.r(16, hy + 8, 1, 1, '#dbe6ee'); break;
            case 'bandaid': P.r(13, hy + 8, 3, 2, '#f5d6b0'); P.p(14, hy + 8, '#e3a77a'); P.p(14, hy + 9, '#e3a77a'); break;
            case 'eyepatch': P.r(3, hy + 5, 9, 1, shade(c, .15)); P.r(11, hy + 4, 5, 4, c); P.p(12, hy + 5, shade(c, .5)); break;
            case 'sticker': [[14, 7], [13, 8], [14, 8], [15, 8], [14, 9]].forEach(p => P.p(p[0], hy + p[1], '#ffe27a')); P.p(14, hy + 8, '#fff6c2'); break;
        }
    }
    function drawNeck(P, a, hy) {
        const y = hy + 12, c = a.neckc, d = shade(c, -.25);
        switch (a.neck) {
            case 'scarf': P.b(5, y, 10, 2, c); P.b(11, y + 2, 3, 4, shade(c, -.08)); P.r(11, y + 5, 3, 1, d); break;
            case 'bowtie': P.r(7, y, 2, 2, c); P.r(11, y, 2, 2, c); P.r(9, y, 2, 2, d); break;
            case 'choker': P.r(8, y, 4, 1, c); P.r(9, y + 1, 2, 1, '#ffe27a'); break;
            case 'ribbon': P.r(7, y, 2, 2, c); P.r(11, y, 2, 2, c); P.r(9, y, 2, 2, d); P.p(9, y + 2, c); P.p(10, y + 2, c); P.p(8, y + 3, c); P.p(11, y + 3, c); break;
            case 'bell': P.r(8, y, 4, 1, c); P.r(9, y + 1, 2, 2, '#ffd24a'); P.p(9, y + 1, '#fff3b0'); P.p(10, y + 2, '#d9a21a'); break;
            case 'pearls': [[7, 0], [8, 1], [9, 1], [10, 1], [11, 1], [12, 0]].forEach((p, i) => P.p(p[0], y + p[1], i % 2 ? '#ffffff' : '#f3e4ee')); break;
            case 'phones': P.r(2, hy + 4, 2, 5, c); P.r(16, hy + 4, 2, 5, c); P.r(3, hy - 1, 14, 1, shade(c, -.3)); P.r(2, hy, 1, 4, shade(c, -.3)); P.r(17, hy, 1, 4, shade(c, -.3)); P.p(2, hy + 5, shade(c, .4)); P.p(17, hy + 5, shade(c, .4)); break;
        }
    }
    function drawBack(P, a, hy) {
        const c = a.backc;
        if (a.back === 'wings') { [[0, 1], [16, 1]].forEach(w => { P.b(w[0], hy + 10, 4, 3, c); P.b(w[0] + (w[0] ? 0 : 1), hy + 13, 3, 3, shade(c, -.06)); P.r(w[0] + 1, hy + 16, 2, 1, shade(c, -.14)); }); }
        else if (a.back === 'bat') { [[0, 1], [16, 1]].forEach(w => { P.b(w[0], hy + 10, 4, 2, c); P.r(w[0] + (w[0] ? 0 : 1), hy + 12, 3, 1, c); P.p(w[0] + (w[0] ? 1 : 2), hy + 13, c); P.p(w[0] + (w[0] ? 3 : 0), hy + 12, shade(c, -.2)); }); }
        else if (a.back === 'pack') { P.b(14, hy + 13, 4, 7, c); P.r(14, hy + 15, 4, 1, shade(c, -.25)); P.r(15, hy + 12, 1, 1, shade(c, -.2)); }
        else if (a.back === 'bear') { P.b(13, hy + 13, 6, 7, c); P.p(13, hy + 12, c); P.p(18, hy + 12, c); P.b(14, hy + 16, 4, 3, shade(c, .18)); P.p(15, hy + 17, '#3a2f3a'); P.p(16, hy + 17, '#3a2f3a'); }
        else if (a.back === 'tail') { [[14, 22], [15, 22], [16, 21], [17, 20], [17, 19]].forEach(p => P.b(p[0], hy + p[1] - 6, 2, 2, c)); }
    }
    function drawCharPix(P, a, pose, frame, closed) {
        const sit = pose === 'sit', hy = sit ? 9 : 7, n = sit ? 2 : 4;
        drawBack(P, a, hy); hairBack(P, a, hy); drawLegs(P, a, hy, n, frame || 0); drawOutfit(P, a, hy, sit); drawHold(P, a, hy);
        drawNeck(P, a, hy); drawHead(P, a, hy); drawFace(P, a, hy, closed); drawFaceAcc(P, a, hy); hairFront(P, a, hy); drawHat(P, a, hy);
    }
    // 手绘小人：custom = {pal:[hex...], rows:[32 条 22 字符，'.'透明，其余是 pal 下标 0-9a-z]}
    const CW = 22, CH = 32;
    function customSprite(a, pose, frame) {
        const cu = a.custom, rows = cu.rows, off = pose === 'sit' ? 2 : 0, bob = frame ? -1 : 0;
        const c = document.createElement('canvas'); c.width = CW; c.height = CH; const x = c.getContext('2d');
        for (let j = 0; j < CH; j++) { const r = rows[j] || ''; for (let i = 0; i < CW; i++) { const ch = r[i]; if (!ch || ch === '.') continue; const col = cu.pal[parseInt(ch, 36)]; if (!col) continue; const yy = j + off + bob; if (yy < 0 || yy >= CH) continue; x.fillStyle = col; x.fillRect(i, yy, 1, 1); } }
        return { c: c, w: CW, h: CH, ow: CW - 2, oh: CH - 2 };
    }
    const charCache = {};
    function charSprite(av, pose, frame) {
        const a = cleanAvatar(av), key = JSON.stringify([a, pose, frame]);
        if (charCache[key]) return charCache[key];
        if (Object.keys(charCache).length > 160) Object.keys(charCache).slice(0, 80).forEach(k => delete charCache[k]);
        let s;
        if (a.custom) s = customSprite(a, pose, frame);
        else {
            s = mk(20, 30, (P) => drawCharPix(P, a, pose === 'sleep' ? 'stand' : pose, frame, pose === 'sleep'));
        }
        if (pose === 'sleep') { // 整体转 90 度躺下（头朝左）
            const r = document.createElement('canvas'); r.width = s.h; r.height = s.w; const x = r.getContext('2d'); x.imageSmoothingEnabled = false; x.translate(0, s.w); x.rotate(-Math.PI / 2); x.drawImage(s.c, 0, 0);
            s = { c: r, w: s.h, h: s.w, ow: s.h - 2, oh: s.w - 2 };
        }
        return (charCache[key] = s);
    }
    // 把「装扮」转成可编辑的手绘底稿
    function toCustom(av) {
        const a = cleanAvatar(av); a.custom = null; const s = mk(20, 30, (P) => drawCharPix(P, a, 'stand', 0, false));
        const x = s.c.getContext('2d'), d = x.getImageData(0, 0, s.c.width, s.c.height).data, pal = [], rows = [];
        const cw = s.c.width, chh = s.c.height;
        for (let j = 0; j < CH; j++) { let row = ''; for (let i = 0; i < CW; i++) { const k = (j * cw + i) * 4; if (j >= chh || i >= cw || d[k + 3] < 128) { row += '.'; continue; } const h = hex(d[k], d[k + 1], d[k + 2]); let idx = pal.indexOf(h); if (idx < 0) { if (pal.length >= 36) { let best = 0, bd = 1e9; pal.forEach((p, q) => { const u = rgb(p), dd = (u[0] - d[k]) ** 2 + (u[1] - d[k + 1]) ** 2 + (u[2] - d[k + 2]) ** 2; if (dd < bd) { bd = dd; best = q; } }); idx = best; } else { pal.push(h); idx = pal.length - 1; } } row += idx.toString(36); } rows.push(row); }
        return { pal: pal, rows: rows };
    }

    // =====================================================================
    //  房间背景（像素）
    // =====================================================================
    const SW = 176, SH = 144, FT = 76, GT = 62;
    const WALL_PATS = [['solid', '纯色'], ['stripe', '条纹'], ['dots', '小圆点'], ['grid', '格子'], ['half', '护墙板']];
    const FLOOR_PATS = [['wood', '木地板'], ['tile', '瓷砖'], ['carpet', '地毯'], ['plain', '纯色']];
    const WALL_PRESETS = ['#fbf1e6', '#fbe3e8', '#e3eef7', '#e3f2e6', '#ece4f6', '#fff0cc', '#f3d9cf', '#d9dfe9', '#c9d8c5', '#3d4466'];
    const FLOOR_PRESETS = ['#e7cfae', '#d9b890', '#c9a27a', '#f0e6d6', '#cfd6dd', '#f3d3d9', '#b9cdb4', '#7a6a62'];
    const GROUND_PRESETS = ['#9fd28c', '#bfe0b4', '#d9e7a8', '#e8d9b0', '#f3f6fa', '#8fbf9a'];
    const SKY = { morning: ['#fde7d6', '#f9d2c0', '#cfe3f3'], day: ['#8fd0f2', '#b9e2f7', '#e0f3fb'], evening: ['#f59a7a', '#f7b996', '#9f8bc2'], night: ['#1c2347', '#2b3558', '#4b5788'] };
    function dayPartOf(d) { const h = (d || new Date()).getHours(); return h >= 6 && h < 10 ? 'morning' : h >= 10 && h < 17 ? 'day' : h >= 17 && h < 20 ? 'evening' : 'night'; }
    function drawSky(x, w, h, dp, withSun) {
        const sk = SKY[dp], bands = 6;
        for (let i = 0; i < bands; i++) { x.fillStyle = sk[Math.min(2, Math.floor(i * 3 / bands))]; x.fillRect(0, Math.floor(i * h / bands), w, Math.ceil(h / bands)); }
        if (dp === 'night') { x.fillStyle = '#fff6c9'; x.fillRect(Math.floor(w * .72), 6, 6, 6); x.fillStyle = sk[0]; x.fillRect(Math.floor(w * .72) + 2, 6, 5, 5); x.fillStyle = '#ffffff'; [[.1, 4], [.3, 12], [.5, 6], [.88, 16], [.2, 22], [.62, 18]].forEach(s => x.fillRect(Math.floor(w * s[0]), s[1], 1, 1)); }
        else if (withSun !== false) { x.fillStyle = dp === 'evening' ? '#ffd9a0' : '#ffe9a8'; const sx = Math.floor(w * (dp === 'evening' ? .3 : .72)), sy = dp === 'evening' ? Math.floor(h * .8) : 8; x.fillRect(sx, sy, 7, 7); x.fillRect(sx - 1, sy + 1, 9, 5); x.fillRect(sx + 1, sy - 1, 5, 9); }
        if (dp !== 'night') { x.fillStyle = 'rgba(255,255,255,.9)'; [[.1, .35], [.55, .2]].forEach(c => { const cx = Math.floor(w * c[0]), cy = Math.floor(h * c[1]); x.fillRect(cx, cy + 2, 14, 3); x.fillRect(cx + 2, cy, 8, 2); x.fillRect(cx + 5, cy - 1, 5, 2); }); }
    }
    function bgInside(room, dp, t) {
        const c = document.createElement('canvas'); c.width = SW; c.height = SH; const x = c.getContext('2d'); x.imageSmoothingEnabled = false;
        const R = (a, b, w, h, col) => { x.fillStyle = col; x.fillRect(a, b, w, h); };
        const wc = (room.wall && room.wall.c) || '#fbf1e6', wp = (room.wall && room.wall.pat) || 'solid', fc = (room.floor && room.floor.c) || '#e7cfae', fp = (room.floor && room.floor.pat) || 'wood';
        R(0, 0, SW, FT, wc);
        if (wp === 'stripe') for (let i = 0; i < SW; i += 12) R(i, 0, 6, FT, shade(wc, -.06));
        else if (wp === 'dots') for (let j = 4; j < FT - 4; j += 10) for (let i = (j / 10 % 2 ? 4 : 9); i < SW; i += 10) R(i, j, 2, 2, shade(wc, -.1));
        else if (wp === 'grid') { for (let i = 0; i < SW; i += 12) R(i, 0, 1, FT, shade(wc, -.07)); for (let j = 0; j < FT; j += 12) R(0, j, SW, 1, shade(wc, -.07)); }
        else if (wp === 'half') { R(0, FT - 26, SW, 26, shade(wc, -.07)); R(0, FT - 27, SW, 2, shade(wc, -.2)); R(0, FT - 25, SW, 1, shade(wc, .15)); for (let i = 6; i < SW; i += 22) { R(i, FT - 21, 16, 1, shade(wc, -.18)); R(i, FT - 8, 16, 1, shade(wc, -.18)); R(i, FT - 21, 1, 14, shade(wc, -.18)); R(i + 15, FT - 21, 1, 14, shade(wc, -.18)); } }
        R(0, 0, SW, 2, shade(wc, -.08));
        R(0, FT - 4, SW, 4, shade(wc, -.16)); R(0, FT - 4, SW, 1, shade(wc, .1)); R(0, FT - 1, SW, 1, shade(wc, -.32));
        R(0, FT, SW, SH - FT, fc);
        if (fp === 'wood') { const dk = shade(fc, -.14), pl = 7; for (let j = 0, r = 0; FT + j < SH; j += pl, r++) { R(0, FT + j, SW, 1, dk); for (let i = (r * 23) % 44; i < SW; i += 44) R(i, FT + j, 1, pl, dk); if (r % 2) for (let i = 4; i < SW; i += 19) R(i, FT + j + 3, 3, 1, shade(fc, .07)); } }
        else if (fp === 'tile') { const dk = shade(fc, -.08); for (let j = 0, r = 0; FT + j < SH; j += 9, r++) for (let i = 0, q = 0; i < SW; i += 16, q++) if ((r + q) % 2 === 0) R(i, FT + j, 16, 9, dk); for (let j = 0; FT + j < SH; j += 9) R(0, FT + j, SW, 1, shade(fc, -.16)); for (let i = 0; i < SW; i += 16) R(i, FT, 1, SH - FT, shade(fc, -.16)); }
        else if (fp === 'carpet') { const dk = shade(fc, -.09); for (let j = 0; FT + j < SH; j += 3) for (let i = (j / 3 % 2) * 2; i < SW; i += 4) R(i, FT + j, 1, 1, dk); }
        else { for (let j = 0; FT + j < SH; j += 2) if ((j / 2) % 7 === 3) R(0, FT + j, SW, 1, shade(fc, -.05)); }
        R(0, FT, SW, 1, shade(fc, -.24));
        return c;
    }
    function bgGarden(room, dp, t) {
        const c = document.createElement('canvas'); c.width = SW; c.height = SH; const x = c.getContext('2d'); x.imageSmoothingEnabled = false;
        const R = (a, b, w, h, col) => { x.fillStyle = col; x.fillRect(a, b, w, h); };
        drawSky(x, SW, GT + 6, dp);
        const gc = (room.ground && room.ground.c) || '#9fd28c', dark = dp === 'night' ? -.38 : 0;
        const hill = (col, amp, ph, base) => { x.fillStyle = col; for (let i = 0; i < SW; i++) { const hgt = Math.round(base + Math.sin((i + ph) / 17) * amp + Math.sin((i + ph) / 6) * (amp / 3)); x.fillRect(i, GT - hgt, 1, hgt + 8); } };
        hill(shade(gc, -.28 + dark), 5, 10, 8); hill(shade(gc, -.14 + dark), 4, 55, 4);
        R(0, GT, SW, SH - GT, shade(gc, dark));
        for (let j = GT + 4, r = 0; j < SH - 2; j += 6, r++) for (let i = (r * 13) % 17; i < SW - 2; i += 17) { R(i, j, 1, 2, shade(gc, -.2 + dark)); R(i + 2, j + 1, 1, 1, shade(gc, -.2 + dark)); R(i + 1, j - 1, 1, 1, shade(gc, .18 + dark)); }
        for (let i = 0; i < SW; i += 2) { R(i, GT, 1, 1, shade(gc, -.3 + dark)); }
        return c;
    }
    function frameBorder(x) {
        const R = (a, b, w, h, col) => { x.fillStyle = col; x.fillRect(a, b, w, h); };
        R(0, 0, SW, 3, '#a8754f'); R(0, SH - 3, SW, 3, '#a8754f'); R(0, 0, 3, SH, '#a8754f'); R(SW - 3, 0, 3, SH, '#a8754f');
        R(0, 0, SW, 1, '#d9a574'); R(0, 0, 1, SH, '#d9a574'); R(0, SH - 1, SW, 1, '#6b4a3a'); R(SW - 1, 0, 1, SH, '#6b4a3a');
        R(3, 3, SW - 6, 1, '#6b4a3a'); R(3, 3, 1, SH - 6, '#6b4a3a'); R(3, SH - 4, SW - 6, 1, '#d9a574'); R(SW - 4, 3, 1, SH - 6, '#d9a574');
    }
    function glowDraw(x, gx, gy, r, col, a) {
        x.save(); x.fillStyle = col;
        for (let k = 0; k < 5; k++) { const rr = r * (1 - k * .18); x.globalAlpha = a * .22; x.beginPath(); x.arc(Math.round(gx), Math.round(gy), Math.max(2, Math.round(rr)), 0, Math.PI * 2); x.fill(); }
        x.restore();
    }

    window.HLA = { shade, mix, rgb, hex, mk, outline, charSprite, toCustom, cleanAvatar, defaultAvatar, randomAvatar, drawSky, bgInside, bgGarden, frameBorder, glowDraw, dayPartOf, clamp,
        SW, SH, FT, GT, CW, CH, SKINS, HAIRC, EYEC, CLOTHC, BOTC, SHOEC, HAIRS, EYES, BROWS, MOUTHS, TOPS, BOTS, SOCKS, SHOEST, PRINTS, HATS, CLIPS, FACES, NECKS, BACKS, HOLDS, EXPRS, WALL_PATS, FLOOR_PATS, WALL_PRESETS, FLOOR_PRESETS, GROUND_PRESETS, SKY };
})();
