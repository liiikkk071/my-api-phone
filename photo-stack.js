/* photo-stack.js —— 主页「照片堆叠」小组件：几张照片叠成一摞，点一下翻到下一张。
 * 自己上传照片、选相框（拍立得 / 黑色拍立得 / 邮票 / 胶片…）、背景（圆点纸 / 方格 / 牛皮纸 / 自己的图片…）、贴纸装饰（胶带 / 星星 / 音符 / 纽扣），
 * 也可以上传自己的「透明镂空」PNG 相框，照片会垫在相框后面。 */
(function () {
    'use strict';
    const $ = (id) => document.getElementById(id), esc = (s) => escapeHtml(String(s == null ? '' : s));
    const FRAMES = [['polaroid', '拍立得'], ['black', '黑色拍立得'], ['stamp', '邮票'], ['film', '胶片'], ['round', '白边圆角'], ['plain', '无边框']];
    const BGS = [['none', '透明'], ['glass', '磨砂玻璃'], ['dots', '圆点纸'], ['grid', '方格纸'], ['lines', '横线纸'], ['kraft', '牛皮纸'], ['color', '纯色'], ['image', '自己的图片']];
    const DECOS = [['tape', '胶带'], ['star', '星星'], ['note', '音符'], ['button', '纽扣'], ['heart', '爱心']];
    const ROTS = [['neat', '整齐'], ['nat', '自然'], ['wild', '夸张']];
    const SVG = {
        star: '<svg viewBox="0 0 40 40"><path d="M20 3l4.6 10.4 11.4 1.2-8.5 7.7 2.4 11.2L20 27.7 10.1 33.5l2.4-11.2L4 14.6l11.4-1.2z" fill="#fff" fill-opacity=".55" stroke="#2b2b2b" stroke-width="1.8" stroke-linejoin="round"/></svg>',
        note: '<svg viewBox="0 0 40 40"><path d="M15 29V9l15-4v19" fill="none" stroke="#222" stroke-width="2.4" stroke-linejoin="round"/><ellipse cx="11.5" cy="29.5" rx="4.5" ry="3.6" fill="#222"/><ellipse cx="26.5" cy="24.5" rx="4.5" ry="3.6" fill="#222"/></svg>',
        button: '<svg viewBox="0 0 40 40"><circle cx="20" cy="20" r="18" fill="#1d1d1d"/><circle cx="20" cy="20" r="14.5" fill="none" stroke="#fff" stroke-opacity=".5" stroke-width="1"/><g fill="#fff"><circle cx="20" cy="7.5" r="1.6"/><circle cx="31" cy="14" r="1.6"/><circle cx="31" cy="26" r="1.6"/><circle cx="20" cy="32.5" r="1.6"/><circle cx="9" cy="26" r="1.6"/><circle cx="9" cy="14" r="1.6"/><circle cx="15.5" cy="17.5" r="2.4"/><circle cx="24.5" cy="17.5" r="2.4"/><circle cx="15.5" cy="24.5" r="1.4"/><circle cx="24.5" cy="24.5" r="1.4"/></g></svg>',
        heart: '<svg viewBox="0 0 40 40"><path d="M20 33s-12-7.2-12-16a6.6 6.6 0 0 1 12-3.6A6.6 6.6 0 0 1 32 17c0 8.8-12 16-12 16z" fill="#ff8fb0" stroke="#fff" stroke-width="2" stroke-linejoin="round"/></svg>'
    };
    const POS = { neat: [[0, 0, 0], [3, 3, 0], [6, 6, 0], [9, 9, 0], [12, 12, 0]], nat: [[0, 0, -3], [-9, 4, -9], [10, -3, 8], [-4, -8, 4], [6, 9, -6]], wild: [[0, 0, -4], [-14, 6, -16], [14, -4, 14], [-8, -12, 8], [10, 12, -12]] };
    const hexOk = (v) => /^#[0-9a-f]{6}$/i.test(v || '');
    const isImg = (v) => typeof v === 'string' && v.indexOf('data:image') === 0;
    function norm(d) {
        d = d || {}; const dc = d.deco || { tape: 1, star: 1 };
        return { imgs: (Array.isArray(d.imgs) ? d.imgs : []).filter(isImg).slice(0, 6), frame: FRAMES.some(f => f[0] === d.frame) ? d.frame : 'polaroid', bg: BGS.some(b => b[0] === d.bg) ? d.bg : 'none', bgColor: hexOk(d.bgColor) ? d.bgColor : '#fde8ef', bgImg: isImg(d.bgImg) ? d.bgImg : '', frameImg: isImg(d.frameImg) ? d.frameImg : '', deco: { tape: !!dc.tape, star: !!dc.star, note: !!dc.note, button: !!dc.button, heart: !!dc.heart }, rot: ROTS.some(r => r[0] === d.rot) ? d.rot : 'nat', stk: (Array.isArray(d.stk) ? d.stk : []).filter(x => x && isImg(x.src)).slice(0, 12).map(x => ({ src: x.src, x: isFinite(+x.x) ? +x.x : 50, y: isFinite(+x.y) ? +x.y : 50, s: isFinite(+x.s) ? +x.s : 22, r: isFinite(+x.r) ? +x.r : 0 })), cap: String(d.cap || '').slice(0, 24) };
    }
    function bgLayer(d) {
        if (d.bg === 'color') return '<div class="sk-bg bgk-color" style="background:' + d.bgColor + '"></div>';
        if (d.bg === 'image' && d.bgImg) return '<div class="sk-bg bgk-image" style="background-image:url(\'' + d.bgImg + '\')"></div>';
        return d.bg === 'none' || d.bg === 'image' ? '' : '<div class="sk-bg bgk-' + d.bg + '"></div>';
    }
    function cardHtml(src, d, i, n, top) {
        const p = (POS[d.rot] || POS.nat)[Math.min(i, 4)], cls = 'sk-ph f-' + d.frame + (top ? ' top' : '');
        let inner = '<div class="sk-im"><img src="' + src + '" alt="" draggable="false"></div>';
        if (top) {
            if (d.deco.tape) inner += '<i class="sk-tape' + (d.frame === 'black' ? ' dot' : '') + '"></i>';
            if (d.cap && (d.frame === 'polaroid' || d.frame === 'black')) inner += '<div class="sk-cap in">' + esc(d.cap) + '</div>';
        }
        return '<div class="' + cls + '" style="--x:' + p[0] + '%;--y:' + p[1] + '%;--r:' + p[2] + 'deg;z-index:' + (10 - i) + '">' + inner + '</div>';
    }
    function html(w) {
        const d = norm(w.data), size = w.size || 'half';
        let body = bgLayer(d);
        if (!d.imgs.length) body += '<div class="sk-empty"><b>▣</b><span>点右上角 ✎<br>放几张喜欢的照片</span></div>';
        else if (d.frameImg) body += '<div class="sk-full"><img src="' + d.imgs[0] + '" alt="" draggable="false"></div>';
        else body += '<div class="sk-photos">' + d.imgs.slice(0, 5).map((s, i) => cardHtml(s, d, i, d.imgs.length, i === 0)).reverse().join('') + '</div>';
        if (d.frameImg) body += '<img class="sk-fr" src="' + d.frameImg + '" alt="" draggable="false">';
        const decos = DECOS.filter(x => x[0] !== 'tape' && d.deco[x[0]]).map(x => '<i class="sk-d ' + x[0] + '">' + SVG[x[0]] + '</i>').join('');
        if (decos) body += '<div class="sk-decos">' + decos + '</div>';
        if (d.stk.length) body += '<div class="sk-stk">' + d.stk.map((x, i) => '<img data-stk="' + i + '" src="' + x.src + '" alt="" draggable="false" style="left:' + x.x + '%;top:' + x.y + '%;width:' + x.s + '%;transform:translate(-50%,-50%) rotate(' + x.r + 'deg)">').join('') + '</div>';
        if (d.cap && !(!d.frameImg && (d.frame === 'polaroid' || d.frame === 'black') && d.imgs.length)) body += '<div class="sk-cap out">' + esc(d.cap) + '</div>';
        return '<div class="hw hw-stack ' + size + ' fr-' + d.frame + '" data-w="' + esc(w.id) + '">' + body + '<button class="sk-edit" data-sk="edit" title="编辑照片堆叠">✎</button></div>';
    }

    // ---------- 交互 ----------
    function findItem(h, id) { return h.items.find(x => x.id === id); }
    function click(it, e) {
        if (e && e.target.closest('.sk-edit')) { edit(it.id); return; }
        const h = getHome(), x = findItem(h, it.id); if (!x) return; const d = norm(x.data);
        if (!d.imgs.length) { edit(it.id); return; }
        if (d.imgs.length < 2 || d.frameImg) { return; }
        const el = e && e.target.closest('.hw-stack'), top = el && el.querySelector('.sk-ph.top');
        const go = () => { d.imgs.push(d.imgs.shift()); x.data = Object.assign({}, x.data, { imgs: d.imgs }); saveHome(h); renderHome(); };
        if (top) { top.classList.add('fly'); setTimeout(go, 240); } else go();
    }
    function readImg(file, max, png, cb) {
        const r = new FileReader(); r.onerror = () => cb(null);
        r.onload = () => { const im = new Image(); im.onerror = () => cb(null); im.onload = () => { try { const s = Math.min(1, max / Math.max(im.width, im.height)), c = document.createElement('canvas'); c.width = Math.max(1, Math.round(im.width * s)); c.height = Math.max(1, Math.round(im.height * s)); c.getContext('2d').drawImage(im, 0, 0, c.width, c.height); cb(png ? c.toDataURL('image/png') : c.toDataURL('image/jpeg', 0.84)); } catch (e) { cb(r.result); } }; im.src = r.result; };
        r.readAsDataURL(file);
    }
    function pickFiles(multiple, cb) { const inp = document.createElement('input'); inp.type = 'file'; inp.accept = 'image/*'; inp.multiple = !!multiple; inp.style.display = 'none'; document.body.appendChild(inp); inp.onchange = () => { const fs = Array.from(inp.files || []); inp.remove(); if (fs.length) cb(fs); }; inp.click(); }

    function edit(id) {
        const h0 = getHome(), it0 = findItem(h0, id); if (!it0) return; let d = norm(it0.data), sel = 0;
        const phone = document.querySelector('.phone'); if (!phone) return;
        const mask = document.createElement('div'); mask.className = 'xa-mask'; mask.style.zIndex = '880';
        mask.innerHTML = '<div class="xa-sheet tall ps-sheet"><h3>照片堆叠 · 自己设计</h3><div class="ps-prevwrap"><div id="psPrev" class="ps-prev"></div></div><div id="psBody"></div><div class="xa-btns"><button id="psReset">全部清空</button><button class="pri" id="psDone">完成</button></div></div>';
        phone.appendChild(mask);
        const persist = () => { const h = getHome(), x = findItem(h, id); if (!x) return; x.data = Object.assign({}, x.data, d); saveHome(h); try { renderHome(); } catch (e) { } };
        const chips = (arr, cur, key) => '<div class="xa-chips" data-k="' + key + '">' + arr.map(a => '<button data-v="' + a[0] + '" class="' + (a[0] === cur ? 'on' : '') + '">' + a[1] + '</button>').join('') + '</div>';
        function paint() {
            const w = findItem(getHome(), id) || it0;
            $('psPrev').innerHTML = html({ id: 'prev', size: w.size || 'half', kind: 'stack', data: d });
            $('psPrev').firstChild.classList.add('ps-nopt'); $('psPrev').className = 'ps-prev ' + ((w.size === 'wide') ? 'wide' : 'sq');
            const warn = d.imgs.length >= 6 ? '（最多 6 张）' : '';
            $('psBody').innerHTML = '<div class="cd-lab">照片（第一张在最上面，点缩略图可以把它放到最上面）' + warn + '</div><div class="ps-thumbs">' + d.imgs.map((s, i) => '<div class="ps-th' + (i === 0 ? ' top' : '') + '" data-i="' + i + '"><img src="' + s + '" alt=""><button data-x="' + i + '">×</button></div>').join('') + (d.imgs.length < 6 ? '<button class="ps-add" id="psAdd">＋</button>' : '') + '</div>'
                + '<div class="cd-lab">相框</div>' + chips(FRAMES, d.frame, 'frame')
                + '<div class="cd-lab">自己的相框图（PNG，镂空的地方会透出照片）</div><div class="cd-chip"><button id="psFr">' + (d.frameImg ? '更换相框图' : '上传相框图') + '</button>' + (d.frameImg ? '<button id="psFrX">去掉相框图</button>' : '') + '</div>' + (d.frameImg ? '<p class="st-note" style="margin:2px 4px">已使用自定义相框：只显示最上面一张照片，垫在相框后面。</p>' : '')
                + '<div class="cd-lab">摆放</div>' + chips(ROTS, d.rot, 'rot')
                + '<div class="cd-lab">背景</div>' + chips(BGS, d.bg, 'bg') + (d.bg === 'color' ? '<div class="cd-chip"><label class="cd-pick"><input type="color" id="psBgC" value="' + d.bgColor + '"><b>选颜色</b></label></div>' : '') + (d.bg === 'image' ? '<div class="cd-chip"><button id="psBgI">' + (d.bgImg ? '更换背景图' : '上传背景图') + '</button></div>' : '')
                + '<div class="cd-lab">小装饰</div><div class="xa-chips" data-k="deco">' + DECOS.map(x => '<button data-v="' + x[0] + '" class="' + (d.deco[x[0]] ? 'on' : '') + '">' + x[1] + '</button>').join('') + '</div>'
                + '<div class="cd-lab">我的装饰（手绘 / 导入 / 内置手绘风，拖动预览里的装饰就能摆位置）</div><div class="ps-thumbs">' + d.stk.map((x, i) => '<div class="ps-th' + (i === sel ? ' top' : '') + '" data-stk="' + i + '"><img src="' + x.src + '" alt=""><button data-sx="' + i + '">×</button></div>').join('') + (d.stk.length < 12 ? '<button class="ps-add" id="psStkAdd">＋</button>' : '') + '</div>'
                + (d.stk[sel] ? '<div class="xa-row"><span>大小</span><input type="range" id="psStkS" min="6" max="60" value="' + d.stk[sel].s + '" style="flex:1"></div><div class="xa-row"><span>旋转</span><input type="range" id="psStkR" min="-90" max="90" value="' + d.stk[sel].r + '" style="flex:1"></div>' : '')
                + '<div class="cd-lab">一句话（显示在照片下面，可不写）</div><div class="xa-row"><input id="psCap" maxlength="24" placeholder="例如：和 TA 的第一次旅行" style="text-align:left;max-width:100%;width:100%" value="' + esc(d.cap) + '"></div>';
            bindPrev(); bind();
        }
        function bindPrev() {
            const pv = $('psPrev'); pv.querySelectorAll('[data-stk]').forEach(im => {
                im.onpointerdown = (e) => { e.preventDefault(); e.stopPropagation(); const i = +im.dataset.stk; sel = i; const r = pv.getBoundingClientRect(); try { im.setPointerCapture(e.pointerId); } catch (x) { } let moved = false;
                    im.onpointermove = (ev) => { moved = true; d.stk[i].x = Math.max(0, Math.min(100, Math.round((ev.clientX - r.left) / r.width * 1000) / 10)); d.stk[i].y = Math.max(0, Math.min(100, Math.round((ev.clientY - r.top) / r.height * 1000) / 10)); im.style.left = d.stk[i].x + '%'; im.style.top = d.stk[i].y + '%'; };
                    im.onpointerup = im.onpointercancel = () => { im.onpointermove = im.onpointerup = im.onpointercancel = null; persist(); paint(); };
                };
            });
        }
        function bind() {
            const B = $('psBody');
            B.querySelectorAll('.xa-chips[data-k]').forEach(row => row.onclick = (e) => { const b = e.target.closest('button'); if (!b) return; const k = row.dataset.k; if (k === 'deco') d.deco[b.dataset.v] = !d.deco[b.dataset.v]; else d[k] = b.dataset.v; persist(); paint(); });
            B.querySelectorAll('.ps-th').forEach(t => t.onclick = (e) => { const x = e.target.closest('[data-x]'); const i = +t.dataset.i; if (x) { d.imgs.splice(+x.dataset.x, 1); } else if (i > 0) { d.imgs.unshift(d.imgs.splice(i, 1)[0]); } else return; persist(); paint(); });
            const add = $('psAdd'); if (add) add.onclick = () => pickFiles(true, (fs) => { let left = Math.min(fs.length, 6 - d.imgs.length), got = []; if (left <= 0) return; fs.slice(0, left).forEach(f => readImg(f, 560, false, (u) => { if (u) got.push(u); if (--left === 0) { d.imgs = d.imgs.concat(got).slice(0, 6); persist(); paint(); } })); });
            B.querySelectorAll('.ps-th[data-stk]').forEach(t => t.onclick = (e) => { const x = e.target.closest('[data-sx]'); if (x) { d.stk.splice(+x.dataset.sx, 1); sel = 0; } else sel = +t.dataset.stk; persist(); paint(); });
            const sa = $('psStkAdd'); if (sa) sa.onclick = async () => { if (!window.Doodle) { uiAlert('装饰模块还没加载好'); return; } const r = await Doodle.choose({}); if (!r) return; d.stk.push({ src: r.src, x: 50, y: 50, s: 22, r: 0 }); sel = d.stk.length - 1; persist(); paint(); };
            const ss = $('psStkS'); if (ss) ss.oninput = () => { d.stk[sel].s = +ss.value; persist(); const im = $('psPrev').querySelector('[data-stk="' + sel + '"]'); if (im) im.style.width = ss.value + '%'; };
            const sr = $('psStkR'); if (sr) sr.oninput = () => { d.stk[sel].r = +sr.value; persist(); const im = $('psPrev').querySelector('[data-stk="' + sel + '"]'); if (im) im.style.transform = 'translate(-50%,-50%) rotate(' + sr.value + 'deg)'; };
            const fr = $('psFr'); if (fr) fr.onclick = () => pickFiles(false, (fs) => readImg(fs[0], 700, true, (u) => { if (!u) { uiAlert('这张图片读取失败'); return; } d.frameImg = u; persist(); paint(); }));
            const frx = $('psFrX'); if (frx) frx.onclick = () => { d.frameImg = ''; persist(); paint(); };
            const bi = $('psBgI'); if (bi) bi.onclick = () => pickFiles(false, (fs) => readImg(fs[0], 700, false, (u) => { if (!u) { uiAlert('这张图片读取失败'); return; } d.bgImg = u; persist(); paint(); }));
            const bc = $('psBgC'); if (bc) bc.oninput = (e) => { d.bgColor = e.target.value; persist(); const p = $('psPrev').querySelector('.bgk-color'); if (p) p.style.background = d.bgColor; };
            const cp = $('psCap'); if (cp) cp.oninput = () => { d.cap = cp.value; persist(); const pv = $('psPrev'); const w = findItem(getHome(), id) || it0; pv.innerHTML = html({ id: 'prev', size: w.size || 'half', kind: 'stack', data: d }); pv.firstChild.classList.add('ps-nopt'); bindPrev(); };
        }
        mask.addEventListener('mousedown', (e) => { if (e.target === mask) mask.remove(); });
        $('psDone').onclick = () => mask.remove();
        $('psReset').onclick = async () => { if (!(await uiConfirm('清空这个小组件里所有照片和设置吗？'))) return; d = norm({}); persist(); paint(); };
        paint();
    }
    window.PSTACK = { html: html, click: click, edit: edit, norm: norm };
})();
