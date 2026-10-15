/* life.js —— 「TA的生活」日常互动版：早安/晚安打卡、一起吃饭转盘、天气穿搭、拍立得相册、日记；其余按钮的结果也会按天保存 */
(function () {
    'use strict';
    const $ = (id) => document.getElementById(id);
    const esc = (s) => escapeHtml(String(s == null ? '' : s));
    const rnd = (a) => a[Math.floor(Math.random() * a.length)];
    const cid = () => getActiveCharId();
    const name = () => activeCharName();
    const need = () => { if (!cid()) { uiAlert('请先创建并选择一个角色'); return false; } return true; };
    async function ai(task, temp) { if (!API_KEY) { uiAlert('需要先在「设置」里填好 API Key，TA 才能开口哦'); return null; } try { return await callPersona(cid(), task, temp); } catch (e) { uiAlert('出错了：' + e.message); return null; } }
    function Lget() { const c = getChar(cid()); return c ? lifeOf(c) : null; }
    function addLog(type, title, text, extra) { lifeUpdate(cid(), (L) => { L.log = L.log || []; L.log.push(Object.assign({ id: lifeId(), ts: Date.now(), date: todayStr(), type, title, text }, extra || {})); if (L.log.length > 300) L.log.splice(0, L.log.length - 300); }); }
    function logs(type, n) { const L = Lget(); return L && L.log ? L.log.filter(x => x.type === type).slice(-n).reverse() : []; }
    function histHtml(type, n) { const a = logs(type, n || 5); return '<div class="stg-sub">最近记录</div>' + (a.length ? a.map(x => '<div class="stg-date">' + fmtTs(x.ts) + '</div><div class="stg-row"><i>' + esc(x.title) + '</i><div><p>' + esc(x.text) + '</p></div></div>').join('') : '<div class="stg-empty">还没有记录</div>'); }
    function bub(t) { return '<div class="td-react"><div class="bub-av">' + esc(name().slice(0, 1)) + '</div><div class="bub">' + esc(t).replace(/\n/g, '<br>') + '</div></div>'; }
    function strip(kind) { const L = Lget(), set = new Set((L && L.checkin && L.checkin[kind]) || []); let h = ''; for (let i = 6; i >= 0; i--) { const d = addDays(todayStr(), -i); h += '<i class="' + (set.has(d) ? 'on' : '') + (i === 0 ? ' now' : '') + '">' + d.slice(8) + '</i>'; } return '<div class="ck-strip">' + h + '</div><div class="stg-tip">已连续 ' + streakOf([...set]) + ' 天</div>'; }

    // ---------- 早安 / 晚安 ----------
    function checkin(kind) {
        if (!need()) return; const morning = kind === 'morning';
        const moods = morning ? [['f_sleepy', '没睡醒'], ['f_smile', '还不错'], ['f_grin', '元气满满'], ['f_sad', '有点丧'], ['f_angry', '不想上班']] : [['f_sleepy', '好困'], ['f_calm', '平静'], ['f_happy', '满足'], ['f_sad', '有点累'], ['f_love', '想你了']];
        stageOpen(morning ? '早安' : '晚安', (b) => {
            const done = ((Lget().checkin[kind]) || []).includes(todayStr());
            b.innerHTML = '<div class="ck-hero">' + LI(morning ? 'sun' : 'moon', 54) + '</div><h3 class="stg-h">' + (morning ? '今天心情怎么样？' : '今天过得怎么样？') + '</h3><div class="chips" id="ckM">' + moods.map((m, i) => '<button data-i="' + i + '"' + (i === 1 ? ' class="on"' : '') + '>' + LI(m[0], 16) + ' ' + m[1] + '</button>').join('') + '</div><textarea id="ckN" rows="2" placeholder="想对' + esc(name()) + '说点什么？（可不写）"></textarea><div class="stg-btns"><button id="ckGo">' + (done ? '再说一次' : (morning ? '说早安' : '说晚安')) + '</button></div><div id="ckR"></div><div id="ckL">' + strip(kind) + histHtml(kind, 4) + '</div>';
            let mi = 1; b.querySelectorAll('#ckM button').forEach(x => x.onclick = () => { b.querySelectorAll('#ckM button').forEach(y => y.classList.remove('on')); x.classList.add('on'); mi = +x.dataset.i; });
            $('ckGo').onclick = async () => {
                const btn = $('ckGo'); btn.disabled = true; btn.textContent = name() + ' 在回…'; const note = $('ckN').value.trim();
                const r = await ai('现在是' + (morning ? '早上' : '晚上') + '，我跟你说' + (morning ? '早安' : '晚安') + '。我的状态是「' + moods[mi][1] + '」' + (note ? '，我还说：「' + note + '」' : '') + '。请以角色身份回应我，2-3句，贴合我的状态，温柔自然。直接输出。', 1.0);
                btn.disabled = false; btn.textContent = '再说一次'; if (!r) return;
                lifeUpdate(cid(), (L) => { L.checkin[kind] = L.checkin[kind] || []; if (!L.checkin[kind].includes(todayStr())) L.checkin[kind].push(todayStr()); });
                addLog(kind, (morning ? '早安' : '晚安') + ' · ' + moods[mi][1], r); addIntimacy(cid(), 2); bumpMood(cid(), 3);
                $('ckR').innerHTML = bub(r); $('ckL').innerHTML = strip(kind) + histHtml(kind, 4);
            };
        });
    }

    // ---------- 一起吃饭：转盘 ----------
    const FOODS = [['pot', '火锅'], ['ramen', '拉面'], ['sushi', '寿司'], ['burger', '汉堡'], ['chicken', '炸鸡'], ['salad', '轻食沙拉'], ['bbq', '烧烤'], ['curry', '咖喱饭']];
    const WCOL = ['#ff9aa2', '#ffd6a5', '#fdffb6', '#caffbf', '#9bf6ff', '#a0c4ff', '#bdb2ff', '#ffc6ff'];
    function meal() {
        if (!need()) return; let rot = 0, busy = false;
        stageOpen('一起吃饭', (b) => {
            const n = FOODS.length, seg = 360 / n;
            b.innerHTML = '<h3 class="stg-h">今天吃什么？转一转</h3><div class="wheel-wrap"><div class="wheel-ptr"></div><div class="wheel" id="wh" style="background:conic-gradient(' + WCOL.map((c, i) => c + ' ' + i * seg + 'deg ' + (i + 1) * seg + 'deg').join(',') + ')">' + FOODS.map((f, i) => '<span style="transform:rotate(' + (i * seg + seg / 2) + 'deg) translateY(-84px)"><em style="transform:rotate(' + -(i * seg + seg / 2) + 'deg)">' + LI(f[0], 28) + '</em></span>').join('') + '</div></div><div class="stg-btns"><button id="whGo">开始转</button></div><div id="whR"></div>' + histHtml('meal', 4);
            $('whGo').onclick = async () => {
                if (busy) return; busy = true; $('whGo').disabled = true; const i = Math.floor(Math.random() * n);
                rot += 360 * 5 + (360 - ((rot % 360))) - (i + 0.5) * seg; $('wh').style.transform = 'rotate(' + rot + 'deg)';
                await new Promise(r => setTimeout(r, 3300)); const f = FOODS[i];
                $('whR').innerHTML = '<div class="wh-res">' + LI(f[0], 26) + ' ' + f[1] + '</div><div class="stg-load" id="whL"><div class="spin"></div>' + esc(name()) + ' 在点评…</div>';
                const r = await ai('我们转盘决定今天一起吃「' + f[1] + '」。请以角色身份点评一下（可以说你的口味/想怎么吃/关心我有没有吃饭），2句，直接输出。', 1.0);
                if (r) { addLog('meal', f[1], r); addIntimacy(cid(), 2); $('whR').innerHTML = '<div class="wh-res">' + LI(f[0], 26) + ' ' + f[1] + '</div>' + bub(r); } else $('whR').innerHTML = '<div class="wh-res">' + LI(f[0], 26) + ' ' + f[1] + '</div>';
                busy = false; $('whGo').disabled = false; $('whGo').textContent = '再转一次';
            };
        });
    }

    // ---------- 天气穿搭 ----------
    function weather() {
        if (!need()) return;
        stageOpen('看天气', async (b) => {
            b.innerHTML = '<div class="stg-load"><div class="spin"></div>正在查天气…</div>';
            const w = await fetchWeather(false);
            if (!w) { b.innerHTML = '<div class="stg-empty">还没设置所在城市，或没有查到天气。<br>请先在「TA的生活」里填好你的城市。</div>'; return; }
            const i = wxInfo(w.code), wi = wxIconName(w.code), tip = w.temp <= 8 ? '穿厚外套/羽绒' : w.temp <= 16 ? '外套 + 长袖' : w.temp <= 24 ? '薄外套或长袖' : '短袖，注意防晒';
            b.innerHTML = '<div class="wx-card"><div class="wx-big">' + LI(wi, 54) + '</div><div><b>' + w.temp + '°</b><span>' + esc(w.name) + ' · ' + esc(i[0]) + '</span><small>体感 ' + w.feel + '° · ' + w.min + '~' + w.max + '°' + (w.rain != null ? ' · 降水 ' + w.rain + '%' : '') + '</small></div></div><div class="wx-tags"><span>' + LI('shirt', 15) + ' ' + tip + '</span>' + (w.rain >= 40 ? '<span>' + LI('umbrella', 15) + ' 记得带伞</span>' : '') + '</div><div id="wxR" class="stg-load"><div class="spin"></div>' + esc(name()) + ' 在叮嘱…</div>' + histHtml('weather', 3);
            const r = await ai('今天' + weatherLine(w) + '。请以角色身份叮嘱我穿衣和出门注意事项，2-3句，自然体贴，不要编造天气数据。直接输出。', 1.0);
            if (r) { addLog('weather', i[0] + ' ' + w.temp + '°', r); $('wxR').outerHTML = '<div id="wxR">' + bub(r) + '</div>'; } else $('wxR').outerHTML = '<div id="wxR"></div>';
        });
    }

    // ---------- 拍照片：拍立得相册 ----------
    const PG = [['#ffd1dc', '#ffa8c0'], ['#d4e6ff', '#a9c8ff'], ['#e2f5d1', '#b9e594'], ['#ffe9c7', '#ffc98a'], ['#e5d9ff', '#c4acff']];
    function polaroid(p) { const g = PG[(p.g || 0) % PG.length]; return '<div class="pol"><div class="pol-img" style="background:linear-gradient(145deg,' + g[0] + ',' + g[1] + ')"><span>' + LI(p.icon || 'camera', 46) + '</span><small>' + esc(p.scene || '') + '</small></div><div class="pol-cap">' + esc(p.caption || '') + '</div><div class="pol-d">' + fmtTs(p.ts) + '</div></div>'; }
    function photo() {
        if (!need()) return;
        stageOpen('拍照片', (b) => {
            const draw = () => { const L = Lget(), ps = (L.photos || []).slice().reverse(); b.innerHTML = '<h3 class="stg-h">让' + esc(name()) + '拍一张给你</h3><div class="stg-btns"><button id="phGo">' + LI('camera', 16) + ' 拍一张</button></div><div id="phR"></div><div class="stg-sub">相册（' + ps.length + '）</div><div class="pol-grid">' + (ps.length ? ps.slice(0, 12).map(polaroid).join('') : '<div class="stg-empty">相册还是空的</div>') + '</div>'; $('phGo').onclick = go; };
            const go = async () => {
                $('phGo').disabled = true; $('phGo').textContent = name() + ' 在拍…';
                const t = await ai('请以角色身份，拍一张你此刻生活里的照片发给我。只输出JSON：{"icon":"从这些里选一个最贴切的：tea,flower,book,music,cat,sun,moon,cloud,heart,star","scene":"画面里是什么（12字内）","caption":"你配的一句话（25字内，有你的语气）"}', 1.0);
                const o = t && parseJSONLoose(t); if (!o || !o.caption) { $('phGo').disabled = false; $('phGo').innerHTML = LI('camera', 16) + ' 拍一张'; if (t) uiAlert('这张没拍好，再来一次'); return; }
                const p = { id: lifeId(), ts: Date.now(), icon: (window.LI_NAMES || []).includes(o.icon) ? o.icon : 'star', scene: o.scene, caption: o.caption, g: Math.floor(Math.random() * 5) };
                lifeUpdate(cid(), (L) => { L.photos = L.photos || []; L.photos.push(p); }); addLog('photo', p.scene || '照片', p.caption); addIntimacy(cid(), 1);
                draw(); $('phR').innerHTML = '<div class="pol-new">' + polaroid(p) + '</div>';
            };
            draw();
        });
    }

    // ---------- 写日记：一天一篇 ----------
    function diary() {
        if (!need()) return;
        stageOpen('日记', (b) => {
            const draw = () => {
                const L = Lget(), ds = (L.diary || []).slice().reverse(), today = ds.find(x => x.date === todayStr());
                b.innerHTML = '<h3 class="stg-h">' + (today ? '今天的日记' : '让' + esc(name()) + '写今天的日记') + '</h3>' + (today ? paper(today) : '<div class="stg-btns"><button id="dyGo">' + LI('pencil', 16) + ' 开始写</button></div>') + '<div class="stg-sub">往日</div>' + (ds.filter(x => x.date !== todayStr()).slice(0, 6).map(paper).join('') || '<div class="stg-empty">还没有往日的日记</div>');
                if ($('dyGo')) $('dyGo').onclick = async () => {
                    $('dyGo').disabled = true; $('dyGo').textContent = name() + ' 在写…';
                    const r = await ai('请以角色身份写一篇今天的日记，第一人称，120字以内，要有今天具体发生的小事和对我的想念，语气符合你的性格。直接输出正文，不要标题。', 1.0);
                    if (!r) { $('dyGo').disabled = false; $('dyGo').innerHTML = LI('pencil', 16) + ' 开始写'; return; }
                    lifeUpdate(cid(), (L) => { L.diary = L.diary || []; L.diary.push({ id: lifeId(), ts: Date.now(), date: todayStr(), text: r.trim() }); }); addLog('diary', '日记', r.trim().slice(0, 40) + '…'); addIntimacy(cid(), 2); draw();
                };
            };
            const paper = (x) => '<div class="paper"><div class="paper-d">' + esc(x.date) + '</div>' + esc(x.text).replace(/\n/g, '<br>') + '</div>';
            draw();
        });
    }

    // ---------- 接管按钮 ----------
    const MAP = { morningBtn: () => checkin('morning'), nightBtn: () => checkin('night'), mealBtn: meal, weatherBtn: weather, generatePhotoBtn: photo, writeDiaryBtn: diary };
    Object.keys(MAP).forEach(id => { const el = $(id); if (el) el.addEventListener('click', (e) => { e.stopImmediatePropagation(); e.preventDefault(); MAP[id](); }, true); });
    // 日常页隐藏旧的结果框，放一条今日小结
    ['lifekitContent', 'albumContent', 'diaryContent', 'callContent'].forEach(id => { const el = $(id); if (el) el.style.display = 'none'; });

    // ---------- 其余三个按钮：结果自动存档并显示历史 ----------
    const WATCH = { bedtimeLetterBtn: ['listenContent', 'letter', '睡前信'], scheduleBtn: ['calendarContent', 'sched', '日程'], anniversaryBtn: ['calendarContent', 'anniv', '纪念日'] };
    Object.keys(WATCH).forEach(btnId => {
        const [cId, type, label] = WATCH[btnId], btn = $(btnId), box = $(cId); if (!btn || !box) return;
        let waiting = false;
        let hist = $(cId + '_h_' + type); if (!hist) { hist = document.createElement('div'); hist.id = cId + '_h_' + type; hist.className = 'life-hist'; box.insertAdjacentElement('afterend', hist); }
        const showHist = () => { hist.innerHTML = cid() ? histHtml(type, 5) : ''; };
        btn.addEventListener('click', () => { waiting = true; });
        new MutationObserver(() => { if (!waiting) return; const t = box.textContent || ''; if (!t || /思考中|出错了/.test(t) && t.length < 60) { if (/出错了/.test(t)) waiting = false; return; } waiting = false; const txt = (box.querySelector('.content-text') || box).innerText.replace(/^[^\n]*\n/, '').trim(); if (txt) { addLog(type, label, txt); showHist(); } }).observe(box, { childList: true, characterData: true, subtree: true });
        showHist();
        const tabs = $('toolkitSeg'); if (tabs) tabs.addEventListener('click', () => setTimeout(showHist, 60));
    });
})();
