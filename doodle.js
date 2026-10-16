/* doodle.js —— 手绘小装饰：内置一套手绘风线条装饰 + 自己手绘 + 导入图片；微信气泡装饰、照片堆叠相框装饰共用 */
(function () {
    'use strict';
    const $ = (id) => document.getElementById(id), esc = (s) => escapeHtml(String(s == null ? '' : s));
    const jget = (k, d) => { try { const v = JSON.parse(store.getItem(k) || 'null'); return v == null ? d : v; } catch (e) { return d; } };
    const jset = (k, v) => { try { store.setItem(k, JSON.stringify(v)); return true; } catch (e) { uiAlert('保存失败：存储空间不够了'); return false; } };
    const C = (x, y, r) => '<circle cx="' + x + '" cy="' + y + '" r="' + r + '"/>';
    // 内置装饰（48×48 线稿，颜色可换）
    const BUILT = [
        ['sp4', '闪光', '<path d="M24 6C25 17 31 23 42 24 31 25 25 31 24 42 23 31 17 25 6 24 17 23 23 17 24 6Z"/>'],
        ['sp3', '三闪', '<path d="M18 14c1 6 4 9 10 10-6 1-9 4-10 10-1-6-4-9-10-10 6-1 9-4 10-10Z"/><path d="M36 8v8M32 12h8"/><path d="M37 30v6M34 33h6"/>'],
        ['star', '星星', '<path d="M24 7l4.6 10.6 11.4 1-8.6 7.6 2.6 11.2-10-6-10 6 2.6-11.2-8.6-7.6 11.4-1z"/>'],
        ['heart', '爱心', '<path d="M24 40C8 29 6 17 14 12c5-3 9 0 10 4 1-4 5-7 10-4 8 5 6 17-10 28z"/>'],
        ['bow', '蝴蝶结', '<path d="M24 24c-6-9-16-10-17-4-1 6 8 9 17 4 9 5 18 2 17-4-1-6-11-5-17 4z"/><path d="M24 24l-5 13M24 24l5 13"/>'],
        ['paw', '爪印', '<path d="M24 27c-6 0-10 5-8 9 2 3 6 2 8 2s6 1 8-2c2-4-2-9-8-9z"/>' + C(12, 22, 3.4) + C(19.5, 14, 3.4) + C(28.5, 14, 3.4) + C(36, 22, 3.4)],
        ['cloud', '云朵', '<path d="M14 35h22a7 7 0 0 0 0-14 10 10 0 0 0-19-3 8 8 0 0 0-3 17z"/>'],
        ['note', '音符', '<path d="M18 36V12l18-4v24"/><ellipse cx="13" cy="36" rx="5" ry="4"/><ellipse cx="31" cy="32" rx="5" ry="4"/>'],
        ['zzz', '睡着', '<path d="M10 12h10L10 24h10M24 27h8l-8 9h8M36 7h6l-6 7h6"/>'],
        ['mail', '信封', '<path d="M7 12h34v24H7z"/><path d="M7 13l17 14L41 13"/>'],
        ['chat', '爱心对话', '<path d="M8 9h32a2 2 0 0 1 2 2v20a2 2 0 0 1-2 2H22l-8 7v-7H8a2 2 0 0 1-2-2V11a2 2 0 0 1 2-2z"/><path d="M24 27c-6-4-8-8-5-10 2-1 4 0 5 2 1-2 3-3 5-2 3 2 1 6-5 10z"/>'],
        ['flower', '小花', C(24, 24, 5) + C(24, 12, 6) + C(24, 36, 6) + C(12, 24, 6) + C(36, 24, 6)],
        ['swirl', '漩涡', '<path d="M24 24c0-3 4-3 4 0s-6 5-8 0 3-10 10-8 8 12 0 16-16-4-14-12"/>'],
        ['wave', '波浪', '<path d="M5 26c4-8 8 8 12 0s8 8 12 0 8 8 14 0"/>'],
        ['scribble', '涂鸦线', '<path d="M6 30c6-12 8 6 13-4s6 8 11-2 6 4 12-6"/>'],
        ['plus', '十字', '<path d="M19 8h10v11h11v10H29v11H19V29H8V19h11z"/>'],
        ['hash', '井号', '<path d="M18 8l-3 32M32 8l-3 32M8 19h32M7 31h32"/>'],
        ['crown', '皇冠', '<path d="M8 37V17l9 9 7-14 7 14 9-9v20z"/><path d="M8 37h32"/>'],
        ['cherry', '樱桃', '<path d="M22 10c-3 9-8 15-10 21M22 10c4 9 10 14 14 21M22 10c4-5 12-6 15-3-4 3-9 4-15 3z"/>' + C(11, 36, 5) + C(35, 36, 5)],
        ['fish', '小鱼', '<path d="M7 24c6-10 17-10 25 0-8 10-19 10-25 0z"/><path d="M32 24l9-8v16z"/>' + C(16, 22, 1.2)],
        ['cat', '猫猫', '<path d="M9 38V13l8 7c4-1 10-1 14 0l8-7v25c0 0-6 4-15 4S9 38 9 38z"/>' + C(18, 28, 1.3) + C(30, 28, 1.3) + '<path d="M22 32l2 2 2-2"/>'],
        ['moon', '月亮', '<path d="M31 8a16 16 0 1 0 9 26A14 14 0 0 1 31 8z"/>'],
        ['sun', '太阳', C(24, 24, 7) + '<path d="M24 6v6M24 36v6M6 24h6M36 24h6M11 11l4 4M33 33l4 4M37 11l-4 4M15 33l-4 4"/>'],
        ['drop', '水滴', '<path d="M24 7c8 10 12 16 12 23a12 12 0 0 1-24 0c0-7 4-13 12-23z"/>'],
        ['snow', '雪花', '<path d="M24 6v36M8.4 15l31.2 18M8.4 33l31.2-18"/><path d="M20 9l4 4 4-4M20 39l4-4 4 4"/>'],
        ['tulip', '郁金香', '<path d="M24 41V25M24 25c-8 0-10-10-8-15l5 5 3-6 3 6 5-5c2 5 0 15-8 15zM24 35c-5 0-8-3-8-6M24 35c5 0 8-3 8-6"/>'],
        ['arrow', '箭头', '<path d="M6 24h30M26 12l13 12-13 12"/>'],
        ['xx', '叉叉', '<path d="M10 10l8 8M18 10l-8 8M28 28l8 8M36 28l-8 8M30 10l6 6M36 10l-6 6"/>'],
        ['angry', '生气', '<path d="M12 12l9 4M36 12l-9 4M12 36l9-4M36 36l-9-4"/>'],
        ['excl', '感叹', '<path d="M13 8v18M13 34v2"/><path d="M28 12c5-4 12 1 8 7-2 3-6 4-6 8M30 36v2"/>'],
        ['mush', '蘑菇', '<path d="M7 27c0-11 8-18 17-18s17 7 17 18z"/><path d="M18 27v9a6 6 0 0 0 12 0v-9"/>'],
        ['rice', '饭团', '<path d="M24 8c4 0 6 3 15 25 1 5-3 7-8 7H17c-5 0-9-2-8-7C18 11 20 8 24 8z"/><path d="M17 32h14v8H17z"/>'],
        ['face', '开心脸', '<path d="M9 22q4-7 9 0M30 22q4-7 9 0M17 31q7 8 14 0"/>'],
        ['cry', '哭脸', '<path d="M10 19l8 3-8 3M38 19l-8 3 8 3M18 35q6-6 12 0M12 28v6M36 28v6"/>'],
        ['bunting', '彩旗', '<path d="M5 11h38M8 11l6 14 6-14M20 11l6 14 6-14M32 11l5 12"/>'],
        ['tape', '胶带', '<path d="M5 14h38v20H5z"/><path d="M12 14v20M36 14v20M20 24h8" stroke-dasharray="2 3"/>'],
        ['dots', '小点点', C(10, 24, 2.2) + C(24, 24, 2.2) + C(38, 24, 2.2)],
        ['lines', '强调线', '<path d="M12 10l-4 12M24 8v14M36 10l4 12"/>'],
        ['ribbon', '丝带', '<path d="M12 6h24v30l-12-7-12 7z"/>']
    ];
    const SVGS = {}; BUILT.forEach(b => SVGS[b[0]] = b[2]);
    function svgUrl(id, color, sw) {
        const inner = SVGS[id]; if (!inner) return '';
        const svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" fill="none" stroke="' + (color || '#555') + '" stroke-width="' + (sw || 2.6) + '" stroke-linecap="round" stroke-linejoin="round">' + inner + '</svg>';
        return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
    }
    const mine = () => jget('doodleMine', []);
    function addMine(src) { const a = mine(); a.unshift({ id: 'm' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5), src: src }); jset('doodleMine', a.slice(0, 60)); }
    const delMine = (id) => jset('doodleMine', mine().filter(x => x.id !== id));

    function mask(html) {
        const m = document.createElement('div'); m.className = 'dd-mask'; m.innerHTML = '<div class="dd-sheet">' + html + '</div>';
        m.addEventListener('mousedown', (e) => { if (e.target === m) m.remove(); }); document.body.appendChild(m); return m;
    }
    function fileToPng(file, max) {
        return new Promise((res, rej) => {
            const r = new FileReader(); r.onerror = () => rej(new Error('读取失败'));
            r.onload = () => { const im = new Image(); im.onerror = () => rej(new Error('不是图片')); im.onload = () => { const k = Math.min(1, max / Math.max(im.width, im.height)), cv = document.createElement('canvas'); cv.width = Math.max(1, Math.round(im.width * k)); cv.height = Math.max(1, Math.round(im.height * k)); cv.getContext('2d').drawImage(im, 0, 0, cv.width, cv.height); res(cv.toDataURL('image/png')); }; im.src = r.result; };
            r.readAsDataURL(file);
        });
    }

    // ---------- 手绘板 ----------
    function pad() {
        return new Promise((resolve) => {
            const COLS = ['#2b2b2f', '#ffffff', '#ff6b8b', '#ff9f43', '#f6c344', '#5fc58a', '#4aa8e8', '#8a7be0', '#c58a6b'];
            const m = mask('<h3 class="dd-h">手绘小装饰</h3><div class="dd-cv"><canvas id="ddCv" width="640" height="640"></canvas></div>'
                + '<div class="dd-cols" id="ddCols">' + COLS.map((c, i) => '<i data-c="' + c + '" style="background:' + c + '"' + (i === 0 ? ' class="on"' : '') + '></i>').join('') + '<input type="color" id="ddCol" value="#2b2b2f"></div>'
                + '<div class="dd-row"><span>笔粗</span><input type="range" id="ddSz" min="2" max="28" value="6"><button id="ddEr" class="dd-chip">橡皮</button><button id="ddUn" class="dd-chip">撤销</button><button id="ddClr" class="dd-chip">清空</button></div>'
                + '<p class="dd-tip">画好后会自动裁掉空白，背景是透明的。</p><div class="dd-btns"><button id="ddCancel">取消</button><button class="pri" id="ddOk">保存并使用</button></div>');
            const cv = m.querySelector('#ddCv'), ctx = cv.getContext('2d'); let col = '#2b2b2f', sz = 6, er = false, down = false, last = null; const undo = [];
            ctx.lineCap = 'round'; ctx.lineJoin = 'round';
            const pt = (e) => { const r = cv.getBoundingClientRect(); return { x: (e.clientX - r.left) * cv.width / r.width, y: (e.clientY - r.top) * cv.height / r.height }; };
            const snap = () => { undo.push(ctx.getImageData(0, 0, cv.width, cv.height)); if (undo.length > 20) undo.shift(); };
            cv.style.touchAction = 'none';
            cv.onpointerdown = (e) => { e.preventDefault(); snap(); down = true; last = pt(e); try { cv.setPointerCapture(e.pointerId); } catch (x) { } draw(last, last); };
            cv.onpointermove = (e) => { if (!down) return; const p = pt(e); draw(last, p); last = p; };
            cv.onpointerup = cv.onpointercancel = () => { down = false; };
            function draw(a, b) { ctx.globalCompositeOperation = er ? 'destination-out' : 'source-over'; ctx.strokeStyle = col; ctx.fillStyle = col; ctx.lineWidth = sz * 2; ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x + .01, b.y + .01); ctx.stroke(); }
            m.querySelectorAll('#ddCols i').forEach(i => i.onclick = () => { col = i.dataset.c; er = false; m.querySelector('#ddEr').classList.remove('on'); m.querySelectorAll('#ddCols i').forEach(z => z.classList.toggle('on', z === i)); });
            m.querySelector('#ddCol').oninput = (e) => { col = e.target.value; er = false; m.querySelector('#ddEr').classList.remove('on'); m.querySelectorAll('#ddCols i').forEach(z => z.classList.remove('on')); };
            m.querySelector('#ddSz').oninput = (e) => { sz = +e.target.value; };
            m.querySelector('#ddEr').onclick = (e) => { er = !er; e.target.classList.toggle('on', er); };
            m.querySelector('#ddUn').onclick = () => { const s = undo.pop(); if (s) ctx.putImageData(s, 0, 0); };
            m.querySelector('#ddClr').onclick = () => { snap(); ctx.clearRect(0, 0, cv.width, cv.height); };
            m.querySelector('#ddCancel').onclick = () => { m.remove(); resolve(null); };
            m.querySelector('#ddOk').onclick = () => {
                const d = ctx.getImageData(0, 0, cv.width, cv.height).data; let x0 = 1e9, y0 = 1e9, x1 = -1, y1 = -1;
                for (let y = 0; y < cv.height; y++) for (let x = 0; x < cv.width; x++) if (d[(y * cv.width + x) * 4 + 3] > 8) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
                if (x1 < 0) { uiAlert('还没有画东西哦'); return; }
                const pad = 10; x0 = Math.max(0, x0 - pad); y0 = Math.max(0, y0 - pad); x1 = Math.min(cv.width - 1, x1 + pad); y1 = Math.min(cv.height - 1, y1 + pad);
                const w = x1 - x0 + 1, h = y1 - y0 + 1, k = Math.min(1, 200 / Math.max(w, h)), o = document.createElement('canvas'); o.width = Math.round(w * k); o.height = Math.round(h * k);
                o.getContext('2d').drawImage(cv, x0, y0, w, h, 0, 0, o.width, o.height);
                const url = o.toDataURL('image/png'); addMine(url); m.remove(); resolve(url);
            };
        });
    }

    // ---------- 选择器：内置 / 我的 / 手绘 / 导入 ----------
    function choose(opts) {
        opts = opts || {};
        return new Promise((resolve) => {
            let color = opts.color || '#555555', tab = 'built';
            const m = mask('<h3 class="dd-h">选一个小装饰</h3><div class="dd-tabs"><button data-t="built" class="on">内置手绘</button><button data-t="mine">我的</button></div><div id="ddGrid" class="dd-grid"></div><div class="dd-row" id="ddColRow"><span>内置装饰颜色</span><input type="color" id="ddPick" value="' + color + '"></div>'
                + '<div class="dd-btns"><button id="ddDraw">＋ 自己手绘</button><button id="ddImp">＋ 导入图片</button><button id="ddX">关闭</button></div><input type="file" id="ddFile" accept="image/*" hidden>');
            const grid = m.querySelector('#ddGrid');
            const paint = () => {
                m.querySelectorAll('.dd-tabs button').forEach(b => b.classList.toggle('on', b.dataset.t === tab)); m.querySelector('#ddColRow').style.display = tab === 'built' ? '' : 'none';
                if (tab === 'built') grid.innerHTML = BUILT.map(b => '<button class="dd-it" data-id="' + b[0] + '" title="' + b[1] + '"><img src="' + svgUrl(b[0], color) + '" alt=""></button>').join('');
                else { const a = mine(); grid.innerHTML = a.length ? a.map(x => '<div class="dd-it mine" data-m="' + x.id + '"><img src="' + x.src + '" alt=""><i data-del="' + x.id + '">×</i></div>').join('') : '<p class="dd-empty">还没有。点下面「自己手绘」或「导入图片」，做好的会收在这里，以后都能用。</p>'; }
            };
            paint();
            m.querySelectorAll('.dd-tabs button').forEach(b => b.onclick = () => { tab = b.dataset.t; paint(); });
            m.querySelector('#ddPick').oninput = (e) => { color = e.target.value; paint(); };
            grid.onclick = (e) => {
                const del = e.target.closest('[data-del]'); if (del) { e.stopPropagation(); delMine(del.dataset.del); paint(); return; }
                const b = e.target.closest('[data-id]'); if (b) { m.remove(); resolve({ src: svgUrl(b.dataset.id, color), built: b.dataset.id, color: color }); return; }
                const x = e.target.closest('[data-m]'); if (x) { const it = mine().find(z => z.id === x.dataset.m); if (it) { m.remove(); resolve({ src: it.src }); } }
            };
            m.querySelector('#ddX').onclick = () => { m.remove(); resolve(null); };
            m.querySelector('#ddDraw').onclick = async () => { const u = await pad(); if (u) { m.remove(); resolve({ src: u }); } };
            const f = m.querySelector('#ddFile');
            m.querySelector('#ddImp').onclick = () => f.click();
            f.onchange = async () => { const file = f.files && f.files[0]; if (!file) return; try { const u = await fileToPng(file, 220); addMine(u); m.remove(); resolve({ src: u }); } catch (e) { uiAlert('导入失败：' + e.message); } };
        });
    }

    // ---------- 气泡装饰（微信聊天） ----------
    const PATTERNS = { none: ['纯色', ''], dots: ['圆点', 'radial-gradient(rgba(255,255,255,.55) 1.4px,transparent 1.8px) 0 0/9px 9px'], stripe: ['斜条纹', 'repeating-linear-gradient(135deg,rgba(255,255,255,.32) 0 5px,transparent 5px 10px)'], gingham: ['小格子', 'linear-gradient(rgba(255,255,255,.34) 50%,transparent 50%) 0 0/10px 10px,linear-gradient(90deg,rgba(255,255,255,.34) 50%,transparent 50%) 0 0/10px 10px'], hearts: ['爱心', 'radial-gradient(circle at 30% 35%,rgba(255,255,255,.5) 2px,transparent 2.4px) 0 0/12px 12px,radial-gradient(circle at 70% 35%,rgba(255,255,255,.5) 2px,transparent 2.4px) 0 0/12px 12px'], grid: ['方格线', 'linear-gradient(rgba(255,255,255,.4) 1px,transparent 1px) 0 0/10px 10px,linear-gradient(90deg,rgba(255,255,255,.4) 1px,transparent 1px) 0 0/10px 10px'] };
    const BORDERS = { none: '无', solid: '实线', dashed: '虚线', dotted: '点线', double: '双线' };
    const POS = { tr: ['右上角', 'top:-14px;right:-10px'], tl: ['左上角', 'top:-14px;left:-10px'], br: ['右下角', 'bottom:-12px;right:-10px'], bl: ['左下角', 'bottom:-12px;left:-10px'], tc: ['上方中间', 'top:-16px;left:50%;margin-left:calc(var(--s)/-2)'], rc: ['右侧中间', 'top:50%;right:-16px;margin-top:calc(var(--s)/-2)'] };
    const defSide = () => ({ pat: 'none', bd: 'none', bdc: '#ffffff', shadow: false, items: [] });
    function bcfg() { const c = jget('bubbleDeco', null) || {}; return { me: Object.assign(defSide(), c.me), ai: Object.assign(defSide(), c.ai) }; }
    function bapply() {
        const c = bcfg(); let css = '';
        ['#chatRoomApp', '.dd-prev'].forEach((root) => [['me', '.user-message'], ['ai', '.ai-message']].forEach(([k, sel]) => {
            const s = c[k], B = root + ' ' + sel + ' .bubble:not(.sticker-img):not(.sticker-face):not(.gen-card)', W = root + ' ' + sel + ' .bubble-wrapper';
            const base = k === 'me' ? 'var(--my-bubble)' : 'var(--ai-bubble)';
            if (s.pat !== 'none' && PATTERNS[s.pat]) css += B + '{background:' + PATTERNS[s.pat][1] + ',' + base + '!important}';
            if (s.bd !== 'none') css += B + '{border:' + (s.bd === 'double' ? '4px' : '1.6px') + ' ' + s.bd + ' ' + s.bdc + '!important}';
            if (s.shadow) css += B + '{box-shadow:0 6px 14px color-mix(in srgb,' + base + ' 45%,transparent)!important}';
            const it = s.items || [];
            if (it.length) css += B + '{position:relative;overflow:visible}' + W + '{position:relative}';
            it.slice(0, 2).forEach((d, i) => {
                const target = i === 0 ? B + '::after' : W + '::before';
                const p = (POS[d.pos] || POS.tr)[1];
                css += target + '{content:"";position:absolute;--s:' + (d.size || 34) + 'px;width:var(--s);height:var(--s);' + p + ';background:url("' + d.src + '") center/contain no-repeat;transform:rotate(' + (d.rot || 0) + 'deg);pointer-events:none;z-index:2;display:block!important;border:none!important}';
            });
        }));
        let st = $('bubbleDecoStyle'); if (!st) { st = document.createElement('style'); st.id = 'bubbleDecoStyle'; document.head.appendChild(st); } st.textContent = css;
    }
    function bsave(c) { jset('bubbleDeco', c); bapply(); }
    function bubbleStudio() {
        let side = 'me'; const m = mask('<h3 class="dd-h">气泡装饰</h3><div class="dd-tabs" id="bsSide"><button data-s="me" class="on">我的气泡</button><button data-s="ai" class="on2">TA 的气泡</button></div>'
            + '<div class="dd-prev" id="bsPrev"></div><div id="bsBody"></div><div class="dd-btns"><button id="bsReset">全部重置</button><button class="pri" id="bsOk">完成</button></div>');
        const prev = m.querySelector('#bsPrev'), body = m.querySelector('#bsBody');
        const draw = () => {
            const c = bcfg()[side], all = bcfg();
            m.querySelectorAll('#bsSide button').forEach(b => b.classList.toggle('on', b.dataset.s === side));
            prev.innerHTML = '<div class="message ai-message"><div class="bubble-wrapper"><div class="bubble">这是 TA 的气泡 (´･ᴗ･)</div></div></div><div class="message user-message"><div class="bubble-wrapper"><div class="bubble">这是我的气泡~</div></div></div>';
            prev.querySelectorAll('.message').forEach(x => { x.style.display = 'flex'; });
            let h = '<div class="dd-lab">底纹</div><div class="dd-chips" data-k="pat">' + Object.keys(PATTERNS).map(k => '<button data-v="' + k + '" class="' + (c.pat === k ? 'on' : '') + '">' + PATTERNS[k][0] + '</button>').join('') + '</div>';
            h += '<div class="dd-lab">边框</div><div class="dd-chips" data-k="bd">' + Object.keys(BORDERS).map(k => '<button data-v="' + k + '" class="' + (c.bd === k ? 'on' : '') + '">' + BORDERS[k] + '</button>').join('') + '</div>';
            h += '<div class="dd-row"><span>边框颜色</span><input type="color" id="bsBdc" value="' + c.bdc + '"><span style="margin-left:auto">阴影光晕</span><input type="checkbox" class="ios-switch" id="bsSh"' + (c.shadow ? ' checked' : '') + '></div>';
            h += '<div class="dd-lab">小装饰（最多 2 个，贴在气泡边上）</div>';
            for (let i = 0; i < 2; i++) {
                const d = c.items[i];
                h += '<div class="dd-slot"><button class="dd-thumb" data-slot="' + i + '">' + (d ? '<img src="' + d.src + '" alt="">' : '＋') + '</button>';
                if (d) h += '<div class="dd-sl"><select data-pos="' + i + '">' + Object.keys(POS).map(k => '<option value="' + k + '"' + (d.pos === k ? ' selected' : '') + '>' + POS[k][0] + '</option>').join('') + '</select><label>大小<input type="range" min="16" max="70" value="' + (d.size || 34) + '" data-size="' + i + '"></label><label>旋转<input type="range" min="-60" max="60" value="' + (d.rot || 0) + '" data-rot="' + i + '"></label></div><button class="dd-x" data-rm="' + i + '">移除</button>';
                else h += '<span class="dd-empty" style="margin:0 0 0 8px">点左边选一个</span>';
                h += '</div>';
            }
            h += '<div class="dd-row"><span>把这一边的样式复制到另一边</span><button class="dd-chip" id="bsCopy">复制</button></div>';
            body.innerHTML = h;
        };
        const mut = (fn) => { const c = bcfg(); fn(c[side]); bsave(c); };
        m.querySelector('#bsSide').onclick = (e) => { const b = e.target.closest('[data-s]'); if (b) { side = b.dataset.s; draw(); } };
        body.onclick = async (e) => {
            const ch = e.target.closest('.dd-chips button'); if (ch) { const k = ch.parentNode.dataset.k; mut(s => { s[k] = ch.dataset.v; }); draw(); return; }
            const sl = e.target.closest('[data-slot]'); if (sl) { const r = await choose({}); if (r) { mut(s => { const i = +sl.dataset.slot; const old = s.items[i] || {}; s.items[i] = { src: r.src, pos: old.pos || (i ? 'bl' : 'tr'), size: old.size || 34, rot: old.rot || 0 }; s.items = s.items.filter(Boolean); }); } draw(); return; }
            const rm = e.target.closest('[data-rm]'); if (rm) { mut(s => { s.items.splice(+rm.dataset.rm, 1); }); draw(); return; }
            if (e.target.id === 'bsCopy') { const c = bcfg(), o = side === 'me' ? 'ai' : 'me'; c[o] = JSON.parse(JSON.stringify(c[side])); bsave(c); uiAlert('已复制到' + (o === 'me' ? '我的' : 'TA 的') + '气泡', 1400); }
        };
        body.oninput = (e) => { const t = e.target; if (t.id === 'bsBdc') mut(s => { s.bdc = t.value; }); else if (t.dataset.size != null) mut(s => { s.items[+t.dataset.size].size = +t.value; }); else if (t.dataset.rot != null) mut(s => { s.items[+t.dataset.rot].rot = +t.value; }); };
        body.onchange = (e) => { const t = e.target; if (t.id === 'bsSh') mut(s => { s.shadow = t.checked; }); else if (t.dataset.pos != null) mut(s => { s.items[+t.dataset.pos].pos = t.value; }); };
        m.querySelector('#bsReset').onclick = async () => { if (!(await uiConfirm('把两边的气泡装饰都重置吗？（我手绘/导入的素材会保留）'))) return; jset('bubbleDeco', null); bapply(); draw(); };
        m.querySelector('#bsOk').onclick = () => m.remove();
        draw();
    }
    function hookTheme() {
        const app = $('themeApp'); if (!app || $('bubbleStudioBtn')) return;
        const first = app.querySelector('.btn-secondary'); if (!first) return;
        const b = document.createElement('button'); b.id = 'bubbleStudioBtn'; b.className = 'btn-secondary'; b.style.marginBottom = '10px'; b.textContent = '气泡装饰 / 手绘小装饰（底纹·边框·贴纸）';
        b.onclick = bubbleStudio; first.parentNode.insertBefore(b, first.nextSibling);
    }
    window.Doodle = { choose: choose, pad: pad, svgUrl: svgUrl, BUILT: BUILT, bubbleStudio: bubbleStudio, applyBubbles: bapply, fileToPng: fileToPng };
    bapply(); hookTheme(); setTimeout(hookTheme, 1500);
})();
