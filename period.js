/* period.js —— 经期记录：月历、记录开始/结束、症状心情、周期预测、TA 的关心。数据只存在你自己的浏览器里 */
(function () {
    'use strict';
    const $ = (id) => document.getElementById(id), esc = (s) => escapeHtml(String(s == null ? '' : s));
    const KEY = 'periodData', SYM = ['痛经', '腰酸', '头痛', '胸胀', '疲惫', '情绪低落', '长痘', '食欲大', '失眠', '腹泻'], FLOW = ['无', '少量', '中等', '较多'];
    const MOODS = [['f_happy', '开心'], ['f_calm', '平静'], ['f_sleepy', '没精神'], ['f_sad', '难过'], ['f_angry', '烦躁'], ['f_love', '想被抱抱']];
    function D() { let d = {}; try { d = JSON.parse(store.getItem(KEY) || '{}'); } catch (e) {} d.logs = d.logs || []; d.days = d.days || {}; d.cycle = d.cycle || 28; d.plen = d.plen || 5; d.share = !!d.share; d.logs.sort((a, b) => a.start < b.start ? -1 : 1); return d; }
    function S(d) { store.setItem(KEY, JSON.stringify(d)); }
    const T = () => todayStr(), diff = (a, b) => dayNum(a) - dayNum(b);
    function rangeOf(l, d) { const t = T(); if (l.end) return [l.start, l.end]; const e = diff(t, l.start) < 12 && diff(t, l.start) >= 0 ? t : addDays(l.start, d.plen - 1); return [l.start, e < addDays(l.start, d.plen - 1) && diff(t, l.start) < 0 ? addDays(l.start, d.plen - 1) : e]; }
    function inPeriod(date, d) { return d.logs.some(l => { const r = rangeOf(l, d); return date >= r[0] && date <= r[1]; }); }
    function stats(d) {
        const st = d.logs.map(l => l.start), gaps = []; for (let i = 1; i < st.length; i++) { const g = diff(st[i], st[i - 1]); if (g >= 15 && g <= 60) gaps.push(g); }
        const g6 = gaps.slice(-6), cyc = g6.length ? Math.round(g6.reduce((a, b) => a + b, 0) / g6.length) : d.cycle;
        const lens = d.logs.filter(l => l.end).map(l => diff(l.end, l.start) + 1).filter(x => x >= 1 && x <= 14).slice(-6), plen = lens.length ? Math.round(lens.reduce((a, b) => a + b, 0) / lens.length) : d.plen;
        return { cyc, plen, gaps: g6, n: d.logs.length };
    }
    function predict(d) {
        const s = stats(d), last = d.logs.length ? d.logs[d.logs.length - 1].start : null; if (!last) return null;
        const next = addDays(last, s.cyc), t = T(), late = diff(t, next) > 0 ? diff(t, next) : 0, ov = addDays(next, -14);
        return { last, next, late, ov, fs: addDays(ov, -5), fe: addDays(ov, 1), s };
    }
    function futureStarts(d) { const p = predict(d); if (!p) return []; const a = []; for (let k = 0; k < 4; k++) a.push(addDays(p.last, p.s.cyc * (k + 1))); return a; }
    function phase(d) {
        const p = predict(d), t = T(); if (!p) return { name: '还没有记录', tip: '点下面的按钮记录第一次经期，就能开始预测啦', day: 0 };
        if (inPeriod(t, d)) { const open = d.logs.find(l => !l.end && l.start <= t); return { name: '月经期', tip: '多喝热水，别碰凉的，早点休息，对自己温柔一点', day: diff(t, p.last) + 1 }; }
        const day = diff(t, p.last) + 1;
        if (t >= p.fs && t <= p.fe) return { name: '排卵期', tip: '这几天是易孕期，注意保护好自己', day };
        if (t < p.fs) return { name: '卵泡期', tip: '状态在慢慢变好，适合运动和安排事情', day };
        return { name: '黄体期', tip: '容易情绪起伏、犯困、胃口大，这都很正常，别苛责自己', day };
    }
    const ic = (n, s) => (window.LI ? LI(n, s) : '');
    const DROP = '<svg class="li" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M12 4.5s-5.5 6-5.5 10a5.5 5.5 0 0 0 11 0c0-4-5.5-10-5.5-10z"/></svg>';

    // ---------- 页面 ----------
    let vy, vm;
    function ensure() {
        if ($('periodApp')) return;
        const el = document.createElement('div'); el.id = 'periodApp'; el.className = 'app-screen hidden';
        el.innerHTML = '<div class="app-header"><button onclick="goHome()">‹ 返回</button><span>经期记录</span><button class="hdr-btn" id="pdSet">设置</button></div><div class="scroll-area padded" id="pdBody"></div>';
        ($('callScreen') ? $('callScreen').parentElement : document.body).appendChild(el);
        $('pdSet').onclick = openSettings;
        new MutationObserver(() => { if (!el.classList.contains('hidden')) { const n = new Date(); if (vy == null) { vy = n.getFullYear(); vm = n.getMonth(); } render(); } }).observe(el, { attributes: true, attributeFilter: ['class'] });
    }
    function render() {
        const d = D(), p = predict(d), ph = phase(d), body = $('pdBody'); if (!body) return;
        const open = d.logs.find(l => !l.end && diff(T(), l.start) >= 0 && diff(T(), l.start) < 12);
        const cyc = p ? p.s.cyc : d.cycle, prog = p ? Math.min(100, Math.round(((diff(T(), p.last)) / cyc) * 100)) : 0;
        const dleft = p ? diff(p.next, T()) : null;
        let h = '<div class="pd-hero"><div class="pd-ring" style="--p:' + prog + '"><div><small>' + esc(ph.name) + '</small><b>' + (ph.day ? '第' + ph.day + '天' : '--') + '</b></div></div><div class="pd-info">'
            + (p ? '<div class="pd-next">' + (p.late ? '已推迟 <b>' + p.late + '</b> 天' : (dleft === 0 ? '预计<b>今天</b>来' : '距离下次 <b>' + dleft + '</b> 天')) + '</div><small>预计 ' + p.next.slice(5).replace('-', '月') + '日 · 周期约 ' + p.s.cyc + ' 天 · 经期约 ' + p.s.plen + ' 天</small>' : '<div class="pd-next">还没有记录</div><small>记下第一次，就能预测下次啦</small>')
            + '<p class="pd-tip">' + esc(ph.tip) + '</p></div></div>';
        h += '<div class="stg-btns"><button id="pdMain">' + DROP + ' ' + (open ? '经期结束了' : '经期来了') + '</button><button class="ghost" id="pdToday">记录今天</button></div>';
        h += '<div class="pd-cal"><div class="pd-calhead"><button id="pdPrev">‹</button><b>' + vy + '年' + (vm + 1) + '月</b><button id="pdNext">›</button></div><div class="pd-grid">' + ['日', '一', '二', '三', '四', '五', '六'].map(x => '<i>' + x + '</i>').join('') + cells(d, p) + '</div><div class="pd-legend"><span class="a">经期</span><span class="b">预测</span><span class="c">易孕期</span><span class="e">排卵日</span></div></div>';
        h += '<div class="pd-care"><button id="pdCare" class="btn-small">让 ' + esc(activeCharName()) + ' 关心我一下</button><div id="pdCareR"></div></div>';
        const hist = d.logs.slice(-6).reverse(); h += '<div class="stg-sub">最近记录</div>' + (hist.length ? hist.map(l => '<div class="stg-row"><i>' + esc(l.start.slice(5).replace('-', '/')) + '</i><div><b>' + l.start + (l.end ? ' ~ ' + l.end.slice(5) : ' ~ 进行中') + '</b><p>' + (l.end ? '持续 ' + (diff(l.end, l.start) + 1) + ' 天' : '') + '</p></div></div>').join('') : '<div class="stg-empty">还没有记录</div>');
        body.innerHTML = h;
        $('pdMain').onclick = () => { const dd = D(); const o = dd.logs.find(l => !l.end && diff(T(), l.start) >= 0 && diff(T(), l.start) < 12); if (o) o.end = T(); else if (!inPeriod(T(), dd)) dd.logs.push({ start: T(), end: null }); S(dd); render(); };
        $('pdToday').onclick = () => daySheet(T());
        $('pdPrev').onclick = () => { vm--; if (vm < 0) { vm = 11; vy--; } render(); }; $('pdNext').onclick = () => { vm++; if (vm > 11) { vm = 0; vy++; } render(); };
        body.querySelectorAll('.pd-grid [data-d]').forEach(c => c.onclick = () => daySheet(c.dataset.d));
        $('pdCare').onclick = care;
    }
    function cells(d, p) {
        const first = new Date(vy, vm, 1).getDay(), nd = new Date(vy, vm + 1, 0).getDate(), t = T(), fut = futureStarts(d), plen = p ? p.s.plen : d.plen; let o = '';
        for (let i = 0; i < first; i++) o += '<span></span>';
        for (let i = 1; i <= nd; i++) {
            const ds = vy + '-' + pad2(vm + 1) + '-' + pad2(i); const cls = [];
            if (inPeriod(ds, d)) cls.push('pd'); else if (fut.some(f => ds >= f && ds <= addDays(f, plen - 1)) && ds >= t) cls.push('pp');
            if (p) { const ovs = [p.ov].concat(fut.map(f => addDays(f, -14))); if (ovs.some(o2 => ds === o2)) cls.push('ov'); else if (ovs.some(o2 => ds >= addDays(o2, -5) && ds <= addDays(o2, 1)) && !cls.length) cls.push('fw'); }
            if (ds === t) cls.push('today'); if (d.days[ds] && (d.days[ds].sym && d.days[ds].sym.length || d.days[ds].note || d.days[ds].mood != null || d.days[ds].flow)) cls.push('has');
            o += '<span data-d="' + ds + '" class="' + cls.join(' ') + '">' + i + '</span>';
        }
        return o;
    }
    function daySheet(date) {
        stageOpen(date.slice(5).replace('-', '月') + '日', (b) => {
            const d = D(), r = d.days[date] || {}; let flow = r.flow || 0, sym = new Set(r.sym || []), mood = r.mood, active = inPeriod(date, d);
            const draw = () => {
                b.innerHTML = '<div class="stg-sub">经期</div><div class="stg-btns" style="margin:6px 0"><button class="' + (active ? '' : 'ghost') + '" id="dsStart">这天经期开始</button><button class="ghost" id="dsEnd">这天经期结束</button>' + (active ? '<button class="ghost" id="dsDel">取消这段</button>' : '') + '</div>'
                    + '<div class="stg-sub">流量</div><div class="chips" id="dsFlow">' + FLOW.map((f, i) => '<button data-i="' + i + '"' + (i === flow ? ' class="on"' : '') + '>' + f + '</button>').join('') + '</div>'
                    + '<div class="stg-sub">症状</div><div class="chips" id="dsSym">' + SYM.map(x => '<button data-s="' + x + '"' + (sym.has(x) ? ' class="on"' : '') + '>' + x + '</button>').join('') + '</div>'
                    + '<div class="stg-sub">心情</div><div class="chips" id="dsMood">' + MOODS.map((m, i) => '<button data-i="' + i + '"' + (mood === i ? ' class="on"' : '') + '>' + ic(m[0], 16) + ' ' + m[1] + '</button>').join('') + '</div>'
                    + '<div class="stg-sub">备注</div><textarea id="dsNote" rows="3" placeholder="今天身体怎么样？">' + esc(r.note || '') + '</textarea><div class="stg-btns"><button id="dsSave">保存</button></div>';
                b.querySelectorAll('#dsFlow button').forEach(x => x.onclick = () => { flow = +x.dataset.i; draw(); });
                b.querySelectorAll('#dsSym button').forEach(x => x.onclick = () => { sym.has(x.dataset.s) ? sym.delete(x.dataset.s) : sym.add(x.dataset.s); draw(); });
                b.querySelectorAll('#dsMood button').forEach(x => x.onclick = () => { mood = mood === +x.dataset.i ? undefined : +x.dataset.i; draw(); });
                const keep = () => { r.note = $('dsNote').value; };
                $('dsStart').onclick = () => { keep(); const dd = D(); if (!inPeriod(date, dd)) { dd.logs.push({ start: date, end: null }); S(dd); } active = true; draw(); };
                $('dsEnd').onclick = () => { keep(); const dd = D(); const l = dd.logs.filter(x => x.start <= date).pop(); if (l) { l.end = date; S(dd); active = inPeriod(date, dd); draw(); } else uiAlert('这天之前还没有经期开始的记录'); };
                if ($('dsDel')) $('dsDel').onclick = () => { keep(); const dd = D(); dd.logs = dd.logs.filter(l => { const rg = rangeOf(l, dd); return !(date >= rg[0] && date <= rg[1]); }); S(dd); active = false; draw(); };
                $('dsSave').onclick = () => { const dd = D(); dd.days[date] = { flow, sym: [...sym], mood, note: $('dsNote').value.trim() }; S(dd); uiAlert('已保存'); stageClose(); };
            };
            draw();
        }, render);
    }
    function openSettings() {
        stageOpen('经期设置', (b) => {
            const d = D();
            b.innerHTML = '<div class="stg-sub">默认周期长度（没有足够记录时用来预测）</div><input id="psC" type="number" min="20" max="45" class="input-text" value="' + d.cycle + '"><div class="stg-sub">默认经期天数</div><input id="psL" type="number" min="2" max="10" class="input-text" value="' + d.plen + '">'
                + '<div class="cell-item" style="padding:14px 0"><span>让 TA 知道我的经期（TA 会更体贴，不会乱提）</span><input id="psShare" type="checkbox"' + (d.share ? ' checked' : '') + '></div>'
                + '<p class="hint-line">预测只是根据你的记录粗略估算，不能当作避孕或医疗依据；经期异常或疼痛明显请咨询医生。数据只保存在这个浏览器里。</p><div class="stg-btns"><button class="ghost" id="psClear">清空所有记录</button><button id="psSave">保存</button></div>';
            $('psSave').onclick = () => { const dd = D(); dd.cycle = Math.max(20, Math.min(45, +$('psC').value || 28)); dd.plen = Math.max(2, Math.min(10, +$('psL').value || 5)); dd.share = $('psShare').checked; S(dd); stageClose(); };
            $('psClear').onclick = async () => { if (await uiConfirm('确定清空所有经期记录吗？不能恢复哦。')) { store.setItem(KEY, '{}'); stageClose(); } };
        }, render);
    }
    async function care() {
        if (!getActiveCharId()) { uiAlert('请先创建并选择一个角色'); return; } if (!API_KEY) { uiAlert('需要先在「设置」里填好 API Key'); return; }
        const d = D(), ph = phase(d), r = d.days[T()] || {}, box = $('pdCareR'); box.innerHTML = '<div class="stg-load"><div class="spin"></div>' + esc(activeCharName()) + ' 在想怎么说…</div>';
        const info = '今天我处于' + ph.name + (ph.day ? '第' + ph.day + '天' : '') + (r.sym && r.sym.length ? '，症状：' + r.sym.join('、') : '') + (r.mood != null ? '，心情：' + MOODS[r.mood][1] : '') + (r.note ? '，我说：「' + r.note + '」' : '');
        try {
            const t = await callPersona(getActiveCharId(), info + '。请你以角色本人的口吻关心我一下，像男/女朋友发微信那样，口语、温柔、有具体的小行动（比如让我喝热水、陪我、给我点吃的），别说教，别讲生理知识，2-3句。直接输出。', 1.0);
            box.innerHTML = '<div class="td-react"><div class="bub-av">' + esc(activeCharName().slice(0, 1)) + '</div><div class="bub">' + esc(oneLine(t)) + '</div></div>'; addIntimacy(getActiveCharId(), 2);
        } catch (e) { box.innerHTML = '<div class="stg-empty">没连上，稍后再试</div>'; }
    }
    // ---------- 让 TA 在聊天里知道（可选） ----------
    if (typeof window.contextTail === 'function') {
        const o = window.contextTail;
        window.contextTail = function (c) {
            let s = o(c); try { const d = D(); if (!d.share || !d.logs.length) return s; const ph = phase(d), p = predict(d), left = p ? diff(p.next, T()) : 99;
                if (ph.name === '月经期') s += '\n\n【我的身体状况（私密，别频繁提起）】我现在在经期第' + ph.day + '天，可能不舒服、情绪敏感。请体贴一点、多心疼我，但不要每句话都提，也不要讲生理知识。';
                else if (left >= 0 && left <= 3) s += '\n\n【我的身体状况（私密，别频繁提起）】我的经期大概' + (left === 0 ? '今天' : left + '天后') + '会来，情绪可能有点敏感，请温柔一点，不要刻意点破。'; } catch (e) {}
            return s;
        };
    }
    ensure();
})();
