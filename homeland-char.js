/* homeland-char.js —— 小家园「捏小人」：装扮（发型/眼睛/表情/衣服/鞋袜/配饰…每一项都能自定义颜色）+ 手绘像素画 */
(function () {
    'use strict';
    const A = window.HLA; if (!A) return;
    const $ = (id) => document.getElementById(id), esc = (s) => escapeHtml(String(s == null ? '' : s));
    const SOCKC = ['#ffffff', '#2b2b33', '#f6c9d4', '#9bbbd9', '#c7b8e6', '#e87f8f'], FACEC = ['#4a4a55', '#2b2b33', '#e87f8f', '#5c7fb5', '#c7b8e6', '#ffe08a', '#ffffff'];
    const GROUPS = [
        { t: '发型', rows: [['o', 'hair', '发型', A.HAIRS], ['c', 'hc', '发色', A.HAIRC], ['b', 'ahoge', '呆毛'], ['o', 'clip', '发夹', A.CLIPS], ['c', 'clipc', '发夹/发绳颜色', A.CLOTHC]] },
        { t: '眼睛', rows: [['o', 'eyes', '眼型', A.EYES], ['c', 'ec', '瞳色', A.EYEC], ['o', 'brow', '眉毛', A.BROWS]] },
        { t: '表情', rows: [['x'], ['o', 'mouth', '嘴巴', A.MOUTHS], ['b', 'blush', '腮红'], ['b', 'freckle', '雀斑'], ['c', 'skin', '肤色', A.SKINS]] },
        { t: '上衣', rows: [['o', 'top', '上衣', A.TOPS], ['c', 'tc', '衣服颜色', A.CLOTHC], ['c', 'ac', '点缀色（领口/领结/条纹）', A.CLOTHC], ['o', 'print', '印花', A.PRINTS], ['c', 'prc', '印花颜色', A.CLOTHC]] },
        { t: '下装', rows: [['o', 'bot', '下装', A.BOTS], ['c', 'bc', '下装颜色', A.BOTC], ['o', 'sock', '袜子', A.SOCKS], ['c', 'sc', '袜子颜色', SOCKC], ['o', 'shoeT', '鞋子', A.SHOEST], ['c', 'shoe', '鞋子颜色', A.SHOEC]] },
        { t: '配饰', rows: [['o', 'hat', '帽子/头饰', A.HATS], ['c', 'hatc', '头饰颜色', A.CLOTHC], ['o', 'face', '脸饰', A.FACES], ['c', 'facec', '脸饰颜色', FACEC], ['o', 'neck', '颈饰', A.NECKS], ['c', 'neckc', '颈饰颜色', A.CLOTHC]] },
        { t: '随身', rows: [['o', 'back', '背饰', A.BACKS], ['c', 'backc', '背饰颜色', A.CLOTHC], ['o', 'hold', '手持', A.HOLDS], ['c', 'holdc', '手持颜色', A.CLOTHC]] }
    ];
    const CW = A.CW, CH = A.CH;
    let ctx = null, el = null, who = 'me', mode = 'dress', grp = 0, cur = null, grid = null, tool = 'pen', color = '#e87f8f', mirror = true, undo = [], painting = false;

    function sprites() { const row = $('hcPrev'); if (!row) return; row.innerHTML = ''; [['stand', 6], ['sit', 4], ['sleep', 3]].forEach(p => { const s = A.charSprite(cur, p[0], 0), c = document.createElement('canvas'); c.width = s.w; c.height = s.h; c.getContext('2d').drawImage(s.c, 0, 0); c.style.width = s.w * p[1] + 'px'; c.style.height = s.h * p[1] + 'px'; row.appendChild(c); }); }
    function commit() { cur = A.cleanAvatar(cur, who === 'ta' ? 'ta' : 'me'); ctx.setAv(who, cur); sprites(); }
    function loadWho() { cur = A.cleanAvatar(Object.assign({}, ctx.S().av[who] || A.defaultAvatar(who === 'ta' ? 'ta' : 'me')), who === 'ta' ? 'ta' : 'me'); grid = null; }

    function render() {
        const nm = who === 'me' ? '我' : ctx.who();
        el.innerHTML = '<div class="app-header"><button id="hcBack">‹ 完成</button><span>捏小人</span><span></span></div><div class="hc-body">'
            + '<div class="hl-tabs hc-who"><button data-w="me"' + (who === 'me' ? ' class="on"' : '') + '>我</button><button data-w="ta"' + (who === 'ta' ? ' class="on"' : '') + '>' + esc(ctx.who()) + '</button></div>'
            + '<div class="hc-prev" id="hcPrev"></div>'
            + '<div class="hl-tabs"><button data-m="dress"' + (mode === 'dress' ? ' class="on"' : '') + '>装扮</button><button data-m="draw"' + (mode === 'draw' ? ' class="on"' : '') + '>自己画</button></div><div id="hcMain"></div></div>';
        $('hcBack').onclick = close;
        el.querySelectorAll('.hc-who button').forEach(b => b.onclick = () => { who = b.dataset.w; loadWho(); render(); });
        el.querySelectorAll('[data-m]').forEach(b => b.onclick = () => { mode = b.dataset.m; render(); });
        sprites(); mode === 'dress' ? dressUI() : drawUI();
    }
    function dressUI() {
        const M = $('hcMain'); let h = '<div class="hc-tools"><button id="hcRnd">⁂ 随机一套</button>' + (cur.custom ? '<button id="hcUnc" class="warn">正在使用手绘，点此改回装扮</button>' : '') + '</div>';
        h += '<div class="hl-tabs hc-g">' + GROUPS.map((g, i) => '<button data-g="' + i + '"' + (i === grp ? ' class="on"' : '') + '>' + g.t + '</button>').join('') + '</div><div class="hc-rows">';
        GROUPS[grp].rows.forEach((r, ri) => {
            if (r[0] === 'x') { h += '<div class="hl-sub">表情预设（一键换眼睛+嘴巴）</div><div class="hl-chips">' + A.EXPRS.map((e, i) => '<button data-ex="' + i + '">' + esc(e[0]) + '</button>').join('') + '</div>'; }
            else if (r[0] === 'o') { h += '<div class="hl-sub">' + r[2] + '</div><div class="hl-chips" data-k="' + r[1] + '">' + r[3].map(o => '<button data-v="' + o[0] + '"' + (cur[r[1]] === o[0] ? ' class="on"' : '') + '>' + esc(o[1]) + '</button>').join('') + '</div>'; }
            else if (r[0] === 'b') { h += '<label class="hl-switch"><input type="checkbox" data-b="' + r[1] + '"' + (cur[r[1]] ? ' checked' : '') + '><span>' + r[2] + '</span></label>'; }
            else { h += '<div class="hl-sub">' + r[2] + '</div><div class="hl-sw" data-ck="' + r[1] + '">' + r[3].map(c => '<i data-c="' + c + '" style="background:' + c + '"' + (String(cur[r[1]]).toLowerCase() === c ? ' class="on"' : '') + '></i>').join('') + '<label class="hl-cu"><input type="color" value="' + cur[r[1]] + '"><span>自定</span></label></div>'; }
        }); h += '</div>';
        M.innerHTML = h;
        M.querySelectorAll('.hc-g button').forEach(b => b.onclick = () => { grp = +b.dataset.g; dressUI(); });
        M.querySelectorAll('.hl-chips[data-k] button').forEach(b => b.onclick = () => { cur[b.parentNode.dataset.k] = b.dataset.v; cur.custom = null; commit(); dressUI(); });
        M.querySelectorAll('[data-ex]').forEach(b => b.onclick = () => { const e = A.EXPRS[+b.dataset.ex][1]; Object.assign(cur, e); cur.custom = null; commit(); dressUI(); });
        M.querySelectorAll('[data-b]').forEach(b => b.onchange = () => { cur[b.dataset.b] = b.checked; cur.custom = null; commit(); });
        M.querySelectorAll('.hl-sw[data-ck]').forEach(row => { const k = row.dataset.ck, set = (c) => { cur[k] = c; cur.custom = null; commit(); row.querySelectorAll('i').forEach(i => i.classList.toggle('on', i.dataset.c === String(c).toLowerCase())); row.querySelector('input').value = c; }; row.querySelectorAll('i').forEach(i => i.onclick = () => set(i.dataset.c)); const inp = row.querySelector('input'); inp.oninput = () => { cur[k] = inp.value; cur.custom = null; commit(); }; });
        $('hcRnd').onclick = () => { const r = A.randomAvatar(); cur = A.cleanAvatar(Object.assign({}, r, { custom: null }), who === 'ta' ? 'ta' : 'me'); commit(); dressUI(); };
        if ($('hcUnc')) $('hcUnc').onclick = () => { cur.custom = null; commit(); dressUI(); };
    }

    // ---------- 手绘 ----------
    function gridFromCustom(cu) { const g = []; for (let j = 0; j < CH; j++) { const row = []; const r = (cu.rows && cu.rows[j]) || ''; for (let i = 0; i < CW; i++) { const ch = r[i]; row.push(!ch || ch === '.' ? null : (cu.pal[parseInt(ch, 36)] || null)); } g.push(row); } return g; }
    function gridToCustom() {
        const pal = [], rows = [], near = (c) => { const u = A.rgb(c); let b = 0, bd = 1e9; pal.forEach((p, i) => { const v = A.rgb(p), d = (u[0] - v[0]) ** 2 + (u[1] - v[1]) ** 2 + (u[2] - v[2]) ** 2; if (d < bd) { bd = d; b = i; } }); return b; };
        grid.forEach(row => { let s = ''; row.forEach(c => { if (!c) { s += '.'; return; } let i = pal.indexOf(c); if (i < 0) { if (pal.length < 36) { pal.push(c); i = pal.length - 1; } else i = near(c); } s += i.toString(36); }); rows.push(s); });
        return { pal: pal, rows: rows };
    }
    function snapUndo() { undo.push(JSON.stringify(grid)); if (undo.length > 30) undo.shift(); }
    const SC = 10;
    function drawGrid() {
        const c = $('hcCv'); if (!c) return; const x = c.getContext('2d'); x.clearRect(0, 0, c.width, c.height);
        for (let j = 0; j < CH; j++) for (let i = 0; i < CW; i++) { x.fillStyle = (i + j) % 2 ? '#f4eef0' : '#ffffff'; x.fillRect(i * SC, j * SC, SC, SC); const col = grid[j][i]; if (col) { x.fillStyle = col; x.fillRect(i * SC, j * SC, SC, SC); } }
        x.strokeStyle = 'rgba(120,100,110,.14)'; x.lineWidth = 1; for (let i = 0; i <= CW; i++) { x.beginPath(); x.moveTo(i * SC + .5, 0); x.lineTo(i * SC + .5, CH * SC); x.stroke(); } for (let j = 0; j <= CH; j++) { x.beginPath(); x.moveTo(0, j * SC + .5); x.lineTo(CW * SC, j * SC + .5); x.stroke(); }
        if (mirror) { x.strokeStyle = 'rgba(232,90,138,.45)'; x.beginPath(); x.moveTo(CW * SC / 2, 0); x.lineTo(CW * SC / 2, CH * SC); x.stroke(); }
        const m = $('hcMini'); if (m) { const mx = m.getContext('2d'); mx.clearRect(0, 0, m.width, m.height); for (let j = 0; j < CH; j++) for (let i = 0; i < CW; i++) if (grid[j][i]) { mx.fillStyle = grid[j][i]; mx.fillRect(i * 3, j * 3, 3, 3); } }
    }
    function paintAt(i, j) {
        if (i < 0 || j < 0 || i >= CW || j >= CH) return;
        const put = (a, b, col) => { if (a >= 0 && a < CW) grid[b][a] = col; };
        if (tool === 'pick') { if (grid[j][i]) { color = grid[j][i]; tool = 'pen'; drawUI(true); } return; }
        if (tool === 'fill') { const t0 = grid[j][i], st = [[i, j]]; if (t0 === color) return; let n = 0; while (st.length && n++ < 2000) { const p = st.pop(); if (p[0] < 0 || p[1] < 0 || p[0] >= CW || p[1] >= CH || grid[p[1]][p[0]] !== t0) continue; grid[p[1]][p[0]] = color; st.push([p[0] + 1, p[1]], [p[0] - 1, p[1]], [p[0], p[1] + 1], [p[0], p[1] - 1]); } return; }
        const col = tool === 'erase' ? null : color; put(i, j, col); if (mirror) put(CW - 1 - i, j, col);
    }
    function drawUI(keepGrid) {
        const M = $('hcMain'); if (!grid) { if (cur.custom) grid = gridFromCustom(cur.custom); else { grid = gridFromCustom(A.toCustom(cur)); } undo = []; }
        const tools = [['pen', '画笔'], ['erase', '橡皮'], ['fill', '填充'], ['pick', '吸色']];
        const used = []; grid.forEach(r => r.forEach(c => { if (c && used.indexOf(c) < 0) used.push(c); }));
        M.innerHTML = '<p class="hl-hint">默认是你现在装扮的样子，可以直接在上面改。画好后点「保存并使用」。</p>'
            + '<div class="hc-cvwrap"><canvas id="hcCv" width="' + CW * SC + '" height="' + CH * SC + '"></canvas><canvas id="hcMini" width="' + CW * 3 + '" height="' + CH * 3 + '"></canvas></div>'
            + '<div class="hl-chips hc-tl">' + tools.map(t => '<button data-t="' + t[0] + '"' + (tool === t[0] ? ' class="on"' : '') + '>' + t[1] + '</button>').join('') + '<button id="hcMir"' + (mirror ? ' class="on"' : '') + '>左右对称</button><button id="hcUndo">撤销</button></div>'
            + '<div class="hl-sub">当前颜色</div><div class="hl-sw" id="hcPal">' + A.CLOTHC.concat(A.HAIRC.slice(0, 8), A.SKINS.slice(0, 5), ['#2f2630', '#ffffff']).filter((c, i, a) => a.indexOf(c) === i).map(c => '<i data-c="' + c + '" style="background:' + c + '"' + (color.toLowerCase() === c ? ' class="on"' : '') + '></i>').join('') + '<label class="hl-cu"><input type="color" id="hcCol" value="' + color + '"><span>自定</span></label></div>'
            + (used.length ? '<div class="hl-sub">画里用过的颜色</div><div class="hl-sw" id="hcUsed">' + used.slice(0, 36).map(c => '<i data-c="' + c + '" style="background:' + c + '"></i>').join('') + '</div>' : '')
            + '<div class="hc-tools"><button id="hcSave" class="pri">保存并使用</button><button id="hcFromDress">用装扮重新打底</button><button id="hcImg">导入图片</button><button id="hcClr" class="warn">清空</button></div><input type="file" id="hcFile" accept="image/*" class="hidden">';
        drawGrid();
        const cvs = $('hcCv'), at = (e) => { const r = cvs.getBoundingClientRect(); return [Math.floor((e.clientX - r.left) / r.width * CW), Math.floor((e.clientY - r.top) / r.height * CH)]; };
        cvs.onpointerdown = (e) => { e.preventDefault(); snapUndo(); painting = true; try { cvs.setPointerCapture(e.pointerId); } catch (x) {} const p = at(e); paintAt(p[0], p[1]); drawGrid(); };
        cvs.onpointermove = (e) => { if (!painting || tool === 'fill' || tool === 'pick') return; const p = at(e); paintAt(p[0], p[1]); drawGrid(); };
        cvs.onpointerup = cvs.onpointercancel = () => { painting = false; if (tool === 'fill' || tool === 'pick') drawGrid(); };
        M.querySelectorAll('.hc-tl [data-t]').forEach(b => b.onclick = () => { tool = b.dataset.t; M.querySelectorAll('.hc-tl [data-t]').forEach(x => x.classList.toggle('on', x === b)); });
        $('hcMir').onclick = () => { mirror = !mirror; $('hcMir').classList.toggle('on', mirror); drawGrid(); }; $('hcUndo').onclick = () => { if (undo.length) { grid = JSON.parse(undo.pop()); drawGrid(); } };
        const setCol = (c) => { color = c; if (tool === 'erase' || tool === 'pick') { tool = 'pen'; M.querySelectorAll('.hc-tl [data-t]').forEach(x => x.classList.toggle('on', x.dataset.t === 'pen')); } M.querySelectorAll('#hcPal i').forEach(i => i.classList.toggle('on', i.dataset.c === c.toLowerCase())); };
        M.querySelectorAll('#hcPal i, #hcUsed i').forEach(i => i.onclick = () => { setCol(i.dataset.c); $('hcCol').value = i.dataset.c; }); $('hcCol').oninput = () => setCol($('hcCol').value);
        $('hcSave').onclick = () => { cur.custom = gridToCustom(); commit(); uiAlert('已保存，现在用的是手绘小人～', 1800); };
        $('hcFromDress').onclick = () => { snapUndo(); const d = Object.assign({}, cur, { custom: null }); grid = gridFromCustom(A.toCustom(d)); drawGrid(); };
        $('hcClr').onclick = async () => { if (!(await uiConfirm('清空整张画布吗？'))) return; snapUndo(); grid = grid.map(r => r.map(() => null)); drawGrid(); };
        $('hcImg').onclick = () => $('hcFile').click(); $('hcFile').onchange = (e) => importImg(e.target.files[0]);
    }
    // ---------- 导入图片：只取小人本体（去掉白底 / 背景色 / 格子线 / 色号文字），再缩成像素 ----------
    function segment(d, w, h) {
        const N = w * h, mask = new Uint8Array(N); let transp = 0;
        for (let i = 0; i < N; i++) if (d[i * 4 + 3] < 200) transp++;
        if (transp > N * 0.02) { for (let i = 0; i < N; i++) mask[i] = d[i * 4 + 3] >= 110 ? 1 : 0; return mask; }
        // 背景色：四角 + 四边中点里出现最多的颜色，再加上「浅色低饱和」（白、浅灰、格纸）
        const pts = [[0, 0], [w - 1, 0], [0, h - 1], [w - 1, h - 1], [w >> 1, 0], [w >> 1, h - 1], [0, h >> 1], [w - 1, h >> 1]], cs = [];
        pts.forEach(p => { const k = (p[1] * w + p[0]) * 4; cs.push([d[k], d[k + 1], d[k + 2]]); });
        let best = cs[0], bn = 0; cs.forEach(c => { let n = 0; cs.forEach(o => { if (Math.abs(c[0] - o[0]) + Math.abs(c[1] - o[1]) + Math.abs(c[2] - o[2]) < 40) n++; }); if (n > bn) { bn = n; best = c; } });
        const isBg = (i) => { const r = d[i * 4], g = d[i * 4 + 1], b = d[i * 4 + 2], mx = Math.max(r, g, b), mn = Math.min(r, g, b); if (mx > 185 && mx - mn < 30) return true; return Math.abs(r - best[0]) + Math.abs(g - best[1]) + Math.abs(b - best[2]) < 54; };
        const cand = new Uint8Array(N); for (let i = 0; i < N; i++) cand[i] = isBg(i) ? 1 : 0;
        // 闭运算：把背景里的细线（格子线、色号文字）也算进背景，这样背景才连得成一片
        const r = Math.max(2, Math.round(Math.min(w, h) / 120));
        const morph = (src, isMin) => {
            const tmp = new Uint8Array(N), out = new Uint8Array(N);
            for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { let v = isMin ? 1 : 0; for (let k = -r; k <= r; k++) { const xx = x + k; if (xx < 0 || xx >= w) continue; const t = src[y * w + xx]; if (isMin ? !t : t) { v = isMin ? 0 : 1; break; } } tmp[y * w + x] = v; }
            for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { let v = isMin ? 1 : 0; for (let k = -r; k <= r; k++) { const yy = y + k; if (yy < 0 || yy >= h) continue; const t = tmp[yy * w + x]; if (isMin ? !t : t) { v = isMin ? 0 : 1; break; } } out[y * w + x] = v; }
            return out;
        };
        const bgc = morph(morph(cand, false), true); for (let i = 0; i < N; i++) if (cand[i]) bgc[i] = 1;
        // 从图片边缘往里「灌水」，灌到的就是外面的背景；小人里面被围住的白色（眼白、白衣服）不会被灌到，会保留
        const ext = new Uint8Array(N), st = [];
        const push = (i) => { if (!ext[i] && bgc[i]) { ext[i] = 1; st.push(i); } };
        for (let x = 0; x < w; x++) { push(x); push((h - 1) * w + x); } for (let y = 0; y < h; y++) { push(y * w); push(y * w + w - 1); }
        while (st.length) { const i = st.pop(), x = i % w, y = (i / w) | 0; if (x > 0) push(i - 1); if (x < w - 1) push(i + 1); if (y > 0) push(i - w); if (y < h - 1) push(i + w); }
        const fg = new Uint8Array(N); for (let i = 0; i < N; i++) fg[i] = ext[i] ? 0 : 1;
        // 只留最大的一块（以及差不多大的零件），其余杂点丢掉
        const lab = new Int32Array(N), sizes = [0]; let n = 0;
        for (let i = 0; i < N; i++) { if (!fg[i] || lab[i]) continue; n++; let c = 0; const s2 = [i]; lab[i] = n; while (s2.length) { const j = s2.pop(); c++; const x = j % w, y = (j / w) | 0; for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { if (!dx && !dy) continue; const xx = x + dx, yy = y + dy; if (xx < 0 || yy < 0 || xx >= w || yy >= h) continue; const q = yy * w + xx; if (fg[q] && !lab[q]) { lab[q] = n; s2.push(q); } } } sizes.push(c); }
        const mxs = Math.max.apply(null, sizes.slice(1).concat([0]));
        for (let i = 0; i < N; i++) mask[i] = lab[i] && sizes[lab[i]] >= mxs * 0.04 ? 1 : 0;
        return mask;
    }
    function importImg(f) {
        if (!f) return; const url = URL.createObjectURL(f), im = new Image();
        im.onload = () => {
            try {
                const k0 = Math.min(1, 640 / Math.max(im.width, im.height)), w = Math.max(1, Math.round(im.width * k0)), h = Math.max(1, Math.round(im.height * k0));
                const c0 = document.createElement('canvas'); c0.width = w; c0.height = h; const x0 = c0.getContext('2d'); x0.drawImage(im, 0, 0, w, h);
                const d = x0.getImageData(0, 0, w, h).data, mask = segment(d, w, h);
                let x1 = w, y1 = h, x2 = -1, y2 = -1; for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (mask[y * w + x]) { if (x < x1) x1 = x; if (x > x2) x2 = x; if (y < y1) y1 = y; if (y > y2) y2 = y; }
                if (x2 < 0) { URL.revokeObjectURL(url); uiAlert('没找到小人，背景太复杂啦，换一张背景干净点的试试'); return; }
                const bw = x2 - x1 + 1, bh = y2 - y1 + 1, sc = Math.min((CW - 2) / bw, (CH - 2) / bh), tw = Math.max(1, Math.round(bw * sc)), th = Math.max(1, Math.round(bh * sc)), ox = Math.floor((CW - tw) / 2), oy = Math.floor((CH - th) / 2);
                const q = (v) => Math.round(v / 51) * 51, cnt = {}, g = []; snapUndo();
                for (let j = 0; j < CH; j++) { const row = []; for (let i = 0; i < CW; i++) {
                    const tx = i - ox, ty = j - oy; if (tx < 0 || ty < 0 || tx >= tw || ty >= th) { row.push(null); continue; }
                    // 这一格对应原图的一块：只看属于小人的像素，取出现最多的颜色（不会被格子线 / 文字带偏）
                    const sx1 = x1 + Math.floor(tx / sc), sx2 = Math.max(sx1 + 1, x1 + Math.ceil((tx + 1) / sc)), sy1 = y1 + Math.floor(ty / sc), sy2 = Math.max(sy1 + 1, y1 + Math.ceil((ty + 1) / sc));
                    let tot = 0, on = 0; const hist = {};
                    for (let y = sy1; y < sy2 && y < h; y++) for (let x = sx1; x < sx2 && x < w; x++) { tot++; const p = y * w + x; if (!mask[p]) continue; on++; const o = p * 4, key = (d[o] >> 4) + ',' + (d[o + 1] >> 4) + ',' + (d[o + 2] >> 4); const e = hist[key] || (hist[key] = { n: 0, r: 0, g: 0, b: 0 }); e.n++; e.r += d[o]; e.g += d[o + 1]; e.b += d[o + 2]; }
                    if (!tot || on < tot * 0.45) { row.push(null); continue; }
                    let top = null; for (const kk in hist) if (!top || hist[kk].n > top.n) top = hist[kk];
                    const hx = A.hex(q(top.r / top.n), q(top.g / top.n), q(top.b / top.n)); cnt[hx] = (cnt[hx] || 0) + 1; row.push(hx);
                } g.push(row); }
                const top = Object.keys(cnt).sort((a, b) => cnt[b] - cnt[a]).slice(0, 34); grid = g.map(r => r.map(c => { if (!c || top.indexOf(c) >= 0) return c; const u = A.rgb(c); let b = top[0], bd = 1e9; top.forEach(p => { const v = A.rgb(p), dd = (u[0] - v[0]) ** 2 + (u[1] - v[1]) ** 2 + (u[2] - v[2]) ** 2; if (dd < bd) { bd = dd; b = p; } }); return b; }));
                URL.revokeObjectURL(url); drawUI(); uiAlert('已提取小人（背景已去掉），可以继续修改', 1800);
            } catch (e) { URL.revokeObjectURL(url); uiAlert('提取失败：' + (e && e.message || e)); }
        }; im.onerror = () => uiAlert('这张图片打不开'); im.src = url;
    }
    function close() { if (el) { el.remove(); el = null; } }
    window.HLCHAR = {
        open: function (c) {
            ctx = c; who = 'me'; mode = 'dress'; grp = 0; grid = null; loadWho(); close(); el = document.createElement('div'); el.id = 'hlChar'; el.className = 'hl-char'; $('homelandApp').appendChild(el); render();
        }
    };
})();
