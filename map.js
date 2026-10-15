/* map.js —— 「地图」：我们的地图（真实地图打卡）+ 约会规划。数据只存在你自己的浏览器里
 * 地图用 Leaflet（leaflet.js / leaflet.css 已经跟着文件一起给你）；底图瓦片、地点搜索需要联网。 */
(function () {
    'use strict';
    const $ = (id) => document.getElementById(id), esc = (s) => escapeHtml(String(s == null ? '' : s));
    const cid = () => getActiveCharId(), who = () => activeCharName() || 'TA';
    const Lget = () => { const c = getChar(cid()); return c ? lifeOf(c) : null; };
    const sleep = (ms) => new Promise(r => setTimeout(r, ms));
    const TYPES = { went: ['去过', '#e58aa3'], want: ['想去', '#7fa4c4'], mark: ['纪念', '#d9a441'] };

    // ---------- 坐标：国内高德底图用 GCJ-02，搜索结果和你存的点统一用 WGS-84 ----------
    const oc = (lng, lat) => lng < 72.004 || lng > 137.8347 || lat < 0.8293 || lat > 55.8271;
    const tLat = (x, y) => { let r = -100 + 2 * x + 3 * y + .2 * y * y + .1 * x * y + .2 * Math.sqrt(Math.abs(x)); r += (20 * Math.sin(6 * x * Math.PI) + 20 * Math.sin(2 * x * Math.PI)) * 2 / 3; r += (20 * Math.sin(y * Math.PI) + 40 * Math.sin(y / 3 * Math.PI)) * 2 / 3; r += (160 * Math.sin(y / 12 * Math.PI) + 320 * Math.sin(y * Math.PI / 30)) * 2 / 3; return r; };
    const tLng = (x, y) => { let r = 300 + x + 2 * y + .1 * x * x + .1 * x * y + .1 * Math.sqrt(Math.abs(x)); r += (20 * Math.sin(6 * x * Math.PI) + 20 * Math.sin(2 * x * Math.PI)) * 2 / 3; r += (20 * Math.sin(x * Math.PI) + 40 * Math.sin(x / 3 * Math.PI)) * 2 / 3; r += (150 * Math.sin(x / 12 * Math.PI) + 300 * Math.sin(x / 30 * Math.PI)) * 2 / 3; return r; };
    function wgs2gcj(lat, lng) {
        if (oc(lng, lat)) return [lat, lng]; const a = 6378245.0, ee = 0.00669342162296594323; let dLat = tLat(lng - 105, lat - 35), dLng = tLng(lng - 105, lat - 35); const rad = lat / 180 * Math.PI; let mg = Math.sin(rad); mg = 1 - ee * mg * mg; const sq = Math.sqrt(mg);
        dLat = (dLat * 180) / ((a * (1 - ee)) / (mg * sq) * Math.PI); dLng = (dLng * 180) / (a / sq * Math.cos(rad) * Math.PI); return [lat + dLat, lng + dLng];
    }
    const gcj2wgs = (lat, lng) => { const g = wgs2gcj(lat, lng); return [lat * 2 - g[0], lng * 2 - g[1]]; };
    const TILES = {
        amap: { name: '高德', url: 'https://webrd0{s}.is.autonavi.com/appmaptile?lang=zh_cn&size=1&scale=1&style=8&x={x}&y={y}&z={z}', sub: '1234', gcj: true },
        carto: { name: '浅色', url: 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', sub: 'abcd', gcj: false },
        osm: { name: 'OSM', url: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png', sub: 'abc', gcj: false }
    };
    const tileKey = () => { const k = store.getItem('mapTile'); return TILES[k] ? k : 'amap'; };
    const disp = (lat, lng) => TILES[tileKey()].gcj ? wgs2gcj(lat, lng) : [lat, lng];
    const real = (lat, lng) => TILES[tileKey()].gcj ? gcj2wgs(lat, lng) : [lat, lng];

    // ---------- 接入桌面 ----------
    try {
        if (allApps.indexOf('map') < 0) allApps.push('map');
        if (!HOME_APPS.some(a => a.id === 'map')) HOME_APPS.push({ id: 'map', name: '地图', cls: 'map-icon', face: '(｡•ᴗ•｡)', go: () => openApp('map') });
        GLYPH.map = '<path d="M9 5.5L4 7.5v11l5-2 6 2 5-2v-11l-5 2z"/><path d="M9 5.5v11M15 7.5v11"/>';
    } catch (e) {}

    let tab = 'places', map = null, tile = null, layerP = null, layerD = null, leafletP = null, curPlan = null, built = false;
    function loadLeaflet() {
        if (window.L) return Promise.resolve();
        if (leafletP) return leafletP;
        leafletP = new Promise((ok, no) => {
            const l = document.createElement('link'); l.rel = 'stylesheet'; l.href = 'leaflet.css?v=1.4'; document.head.appendChild(l);
            const s = document.createElement('script'); s.src = 'leaflet.js?v=1.4'; s.onload = ok; s.onerror = () => { leafletP = null; no(new Error('leaflet')); }; document.body.appendChild(s);
        }); return leafletP;
    }
    function ensure() {
        if ($('mapApp')) return;
        const el = document.createElement('div'); el.id = 'mapApp'; el.className = 'app-screen hidden';
        el.innerHTML = '<div class="app-header"><button onclick="goHome()">‹ 返回</button><span>地图</span><button class="hdr-btn" id="mpTile">底图</button></div>'
            + '<div class="mp-mapbox"><div id="mpMap"></div><div class="mp-fail hidden" id="mpFail">地图组件没加载出来：请确认 leaflet.js 和 leaflet.css 已经放进文件夹，然后刷新。</div></div>'
            + '<div class="mm-tabs mp-tabs"><button data-t="places" class="on">我们的地图</button><button data-t="date">约会规划</button><button data-t="play">足迹玩法</button></div><div class="scroll-area padded" id="mpBody"></div>';
        ($('callScreen') ? $('callScreen').parentElement : document.body).appendChild(el);
        el.querySelectorAll('.mp-tabs button').forEach(b => b.onclick = () => { tab = b.dataset.t; render(); });
        $('mpTile').onclick = () => { const ks = Object.keys(TILES), k = ks[(ks.indexOf(tileKey()) + 1) % ks.length]; store.setItem('mapTile', k); setTile(); drawPlaces(); if (curPlan && tab === 'date') drawPlan(curPlan); uiAlert('底图：' + TILES[k].name + '。哪个加载得出来就用哪个', 2400); };
        new MutationObserver(() => { if (!el.classList.contains('hidden')) open(); else stopWalk(); }).observe(el, { attributes: true, attributeFilter: ['class'] });
    }
    async function open() {
        try { await loadLeaflet(); } catch (e) { $('mpFail').classList.remove('hidden'); render(); return; }
        $('mpFail').classList.add('hidden');
        if (!map) {
            map = L.map('mpMap', { zoomControl: true, attributionControl: false, minZoom: 2 }).setView([35.5, 108], 4);
            layerP = L.layerGroup().addTo(map); layerD = L.layerGroup().addTo(map); setTile();
            map.on('click', (e) => { if (tab !== 'places') return; const w = real(e.latlng.lat, e.latlng.lng); addSheet({ lat: w[0], lng: w[1], name: '' }, true); });
            built = true; centerOnCity();
        }
        setTimeout(() => { map.invalidateSize(); }, 60); render();
    }
    function setTile() { if (!map) return; if (tile) map.removeLayer(tile); const t = TILES[tileKey()]; tile = L.tileLayer(t.url, { subdomains: t.sub, maxZoom: 18, attribution: '' }).addTo(map); }
    async function centerOnCity() {
        const ps = (Lget() || {}).places || [];
        if (ps.length) { fit(ps.map(p => [p.lat, p.lng])); return; }
        const city = store.getItem('userCity'); if (!city) return;
        let c = null; try { c = JSON.parse(store.getItem('mapCityCache') || 'null'); } catch (e) {}
        if (!c || c.city !== city) { const r = await geocode(city); if (r) { c = { city, lat: r.lat, lng: r.lng }; store.setItem('mapCityCache', JSON.stringify(c)); } }
        if (c && map && !ps.length) { const d = disp(c.lat, c.lng); map.setView(d, 11); }
    }
    function fit(pts) { if (!map || !pts.length) return; const ds = pts.map(p => disp(p[0], p[1])); if (ds.length === 1) map.setView(ds[0], 14); else map.fitBounds(L.latLngBounds(ds), { padding: [36, 36], maxZoom: 15 }); }
    const IC = { heart: 'M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.5A4 4 0 0 1 19 10c0 5.6-7 10-7 10z', cafe: 'M5 9h11v5a4 4 0 0 1-4 4H9a4 4 0 0 1-4-4zM16 10h2a2 2 0 0 1 0 4h-2M8 3v2M12 3v2', food: 'M7 3v8M5 3v5a2 2 0 0 0 4 0V3M7 11v10M17 3c-2 2-2 6 0 8v10', tree: 'M12 21v-6M12 3l5 7h-3l4 6H6l4-6H7z', film: 'M4 6h16v12H4zM8 6v12M16 6v12M4 10h4M4 14h4M16 10h4M16 14h4', star: 'M12 3l2.6 5.6 6 .7-4.5 4.1 1.2 6L12 16.5 6.7 19.4l1.2-6L3.4 9.3l6-.7z', home: 'M4 11l8-7 8 7M6 10v10h12V10', gift: 'M4 10h16v4H4zM6 14v7h12v-7M12 10v11M12 10c-3 0-4-4-1-4s3 4 1 4zM12 10c3 0 4-4 1-4s-3 4-1 4z' };
    const pin = (color, label, hollow, ic) => L.divIcon({ className: 'mp-pinw', iconSize: [30, 38], iconAnchor: [15, 36], popupAnchor: [0, -34], html: '<svg viewBox="0 0 30 38" width="30" height="38"><path d="M15 36S3 23 3 14a12 12 0 0 1 24 0c0 9-12 22-12 22z" fill="' + (hollow ? '#fff' : color) + '" stroke="' + color + '" stroke-width="2.4"/>' + (IC[ic] ? '<g transform="translate(8.5 7.5) scale(.55)" fill="none" stroke="' + (hollow ? color : '#fff') + '" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="' + IC[ic] + '"/></g>' : label ? '<text x="15" y="19" text-anchor="middle" font-size="12" font-weight="700" fill="' + (hollow ? color : '#fff') + '">' + label + '</text>' : '<circle cx="15" cy="14" r="4.2" fill="' + (hollow ? color : '#fff') + '"/>') + '</svg>' });

    // ---------- 搜索（OpenStreetMap Nominatim） ----------
    async function geocode(q, many) {
        try {
            const r = await fetch('https://nominatim.openstreetmap.org/search?format=json&limit=' + (many ? 6 : 1) + '&accept-language=zh&q=' + encodeURIComponent(q));
            if (!r.ok) return many ? [] : null; const a = await r.json();
            const m = a.map(x => ({ name: (x.name || String(x.display_name).split(',')[0]), full: x.display_name, lat: +x.lat, lng: +x.lon })); return many ? m : (m[0] || null);
        } catch (e) { return many ? [] : null; }
    }
    async function reverseName(lat, lng) { try { const r = await fetch('https://nominatim.openstreetmap.org/reverse?format=json&accept-language=zh&zoom=17&lat=' + lat + '&lon=' + lng); const j = await r.json(); return j && (j.name || (j.display_name || '').split(',')[0]) || ''; } catch (e) { return ''; } }

    // ---------- 渲染 ----------
    function render() {
        const el = $('mapApp'); if (!el) return; el.querySelectorAll('.mp-tabs button').forEach(b => b.classList.toggle('on', b.dataset.t === tab));
        if (!cid()) { $('mpBody').innerHTML = '<div class="stg-empty">先去通讯录创建并选择一个角色吧</div>'; return; }
        if (layerP) { layerP.clearLayers(); } if (layerD) { layerD.clearLayers(); }
        stopWalk(); tab === 'places' ? renderPlaces() : tab === 'play' ? renderPlay() : renderDate();
    }
    const places = () => ((Lget() || {}).places || []);
    function drawPlaces() {
        if (!layerP) return; layerP.clearLayers();
        places().forEach(p => { const t = TYPES[p.type] || TYPES.went, m = L.marker(disp(p.lat, p.lng), { icon: pin(t[1], '', p.type === 'want', p.ic) }).addTo(layerP); m.on('click', () => { placeSheet(p.id); }); m.bindTooltip(esc(p.name), { direction: 'top', offset: [0, -30] }); });
    }
    function renderPlaces() {
        const ps = places().slice().sort((a, b) => (b.ts || 0) - (a.ts || 0)); drawPlaces();
        let h = '<div class="mp-search"><input id="mpQ" class="input-text" placeholder="搜地点，比如：连云港 花果山" maxlength="40"><button id="mpGo">搜索</button></div><div id="mpRes"></div>'
            + '<p class="hint-line">也可以直接点地图上的任意位置插一个标记。蓝色空心＝想去，粉色＝去过，金色＝纪念。</p>'
            + '<div class="stg-btns" style="margin:8px 0"><button class="ghost" id="mpTa">让 ' + esc(who()) + ' 推荐想和你去的地方</button></div>'
            + '<div class="stg-sub">我们的地点（' + ps.length + '）</div>';
        h += ps.length ? ps.map(p => { const t = TYPES[p.type] || TYPES.went; return '<div class="mp-card" data-id="' + p.id + '"><i style="background:' + t[1] + '"></i><div><b>' + esc(p.name) + '</b><small>' + t[0] + (p.date ? ' · ' + esc(p.date) : '') + (p.by === 'ta' ? ' · ' + esc(who()) + ' 标的' : '') + '</small>' + (p.note ? '<p>' + esc(p.note) + '</p>' : '') + (p.react ? '<p class="mp-re">' + esc(who()) + '：' + esc(p.react) + '</p>' : '') + '</div></div>'; }).join('') : '<div class="stg-empty">还没有标记。搜一个你们去过或想去的地方吧</div>';
        $('mpBody').innerHTML = h;
        $('mpGo').onclick = search; $('mpQ').onkeydown = (e) => { if (e.key === 'Enter') search(); }; $('mpTa').onclick = taRecommend;
        $('mpBody').querySelectorAll('.mp-card').forEach(c => c.onclick = () => placeSheet(c.dataset.id));
    }
    async function search() {
        const q = $('mpQ').value.trim(); if (!q) return; const box = $('mpRes'); box.innerHTML = '<div class="stg-load"><div class="spin"></div>搜索中…</div>';
        const rs = await geocode(q, true);
        if (!rs.length) { box.innerHTML = '<div class="stg-empty" style="padding:12px">没搜到，换个说法试试（比如加上城市名），或者直接点地图插标记</div>'; return; }
        box.innerHTML = rs.map((r, i) => '<div class="mp-res" data-i="' + i + '"><b>' + esc(r.name) + '</b><small>' + esc(r.full) + '</small></div>').join('');
        box.querySelectorAll('.mp-res').forEach(e => e.onclick = () => { const r = rs[+e.dataset.i]; fit([[r.lat, r.lng]]); addSheet({ lat: r.lat, lng: r.lng, name: r.name }); });
    }

    // ---------- 添加 / 编辑地点 ----------
    function addSheet(pt, fromTap) {
        if (!cid()) { uiAlert('请先创建并选择一个角色'); return; }
        stageOpen('添加地点', (b) => {
            let type = 'went', ic = '';
            b.innerHTML = '<div class="stg-sub">地点名称</div><input id="apN" class="input-text" maxlength="30" value="' + esc(pt.name || '') + '" placeholder="给这里起个名字"><div class="stg-sub">这是</div><div class="mm-days" id="apT"><button data-t="went" class="on">我们去过</button><button data-t="want">想一起去</button><button data-t="mark">纪念的地方</button></div><div class="stg-sub">地图图标</div><div class="mp-ics" id="apI"><button data-i="" class="on"><svg viewBox="0 0 24 24" width="20" height="20"><circle cx="12" cy="12" r="4" fill="currentColor"/></svg></button>' + Object.keys(IC).map(k => '<button data-i="' + k + '"><svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="' + IC[k] + '"/></svg></button>').join('') + '</div><div class="stg-sub">日期</div><input id="apD" type="date" class="input-text" value="' + todayStr() + '"><div class="stg-sub">想记下的话</div><input id="apNote" class="input-text" maxlength="60" placeholder="比如：第一次牵手的地方（选填）"><div class="stg-btns"><button id="apOk">保存</button></div>';
            if (fromTap && !pt.name) reverseName(pt.lat, pt.lng).then(n => { if (n && $('apN') && !$('apN').value) $('apN').value = n; });
            b.querySelectorAll('#apT button').forEach(x => x.onclick = () => { type = x.dataset.t; b.querySelectorAll('#apT button').forEach(y => y.classList.toggle('on', y === x)); $('apD').parentElement; });
            b.querySelectorAll('#apI button').forEach(x => x.onclick = () => { ic = x.dataset.i; b.querySelectorAll('#apI button').forEach(y => y.classList.toggle('on', y === x)); });
            $('apOk').onclick = () => {
                const name = $('apN').value.trim(); if (!name) { uiAlert('给这个地方起个名字吧'); return; }
                const p = { id: lifeId(), name, lat: pt.lat, lng: pt.lng, type, ic, date: type === 'want' ? '' : $('apD').value, note: $('apNote').value.trim(), by: 'me', ts: Date.now() };
                lifeUpdate(cid(), (L) => { L.places = L.places || []; L.places.push(p); }); try { addIntimacy(cid(), 1); logActivity(cid(), 'map', (type === 'want' ? '我在地图上标了想和你一起去的地方：' : '我在地图上标记了我们' + (type === 'went' ? '去过' : '纪念') + '的地方：') + name); } catch (e) {}
                stageClose(); render(); fit([[p.lat, p.lng]]); react(p.id);
            };
        }, render);
    }
    async function react(id) {
        const p = places().find(x => x.id === id); if (!p || !API_KEY) return;
        try { const r = oneLine(await callPersona(cid(), '我在我们的地图上标记了一个地方：「' + p.name + '」，类型是' + (TYPES[p.type] || TYPES.went)[0] + (p.date ? '，日期' + p.date : '') + (p.note ? '，我写的话：「' + p.note + '」' : '') + '。请你以角色本人的口吻回一句，口语、有感情，不超过40字；只能依据我写的和你已知的事，不要编造我们在那里发生过的细节。只输出这句话。', 1.0)); if (!r) return; lifeUpdate(cid(), (L) => { const x = (L.places || []).find(y => y.id === id); if (x) x.react = r; }); if (!$('mapApp').classList.contains('hidden') && tab === 'places') renderPlaces(); } catch (e) {}
    }
    function placeSheet(id) {
        const p = places().find(x => x.id === id); if (!p) return; fit([[p.lat, p.lng]]); const t = TYPES[p.type] || TYPES.went;
        stageOpen(p.name, (b) => {
            b.innerHTML = '<div class="mp-detail"><span class="mp-badge" style="background:' + t[1] + '">' + t[0] + '</span>' + (p.date ? '<small>' + esc(p.date) + '</small>' : '') + (p.by === 'ta' ? '<small>' + esc(who()) + ' 标的</small>' : '') + '</div>' + (p.note ? '<p class="mp-note">' + esc(p.note) + '</p>' : '') + (p.react ? '<div class="td-react"><div class="bub-av">' + esc(who().slice(0, 1)) + '</div><div class="bub">' + esc(p.react) + '</div></div>' : '')
                + '<div class="stg-btns">' + (p.type === 'want' ? '<button id="plDone">我们去过啦</button>' : '') + '<button id="plCard">做成明信片</button><button class="ghost" id="plDel">删除</button></div>';
            $('plCard').onclick = () => { stageClose(); setTimeout(() => postcard(p.id), 60); };
            if ($('plDone')) $('plDone').onclick = () => { lifeUpdate(cid(), (L) => { const x = L.places.find(y => y.id === id); if (x) { x.type = 'went'; x.date = todayStr(); } }); try { addIntimacy(cid(), 2); } catch (e) {} stageClose(); render(); react(id); };
            $('plDel').onclick = async () => { if (await uiConfirm('删除这个地点吗？')) { lifeUpdate(cid(), (L) => { L.places = L.places.filter(y => y.id !== id); }); stageClose(); render(); } };
        }, null);
    }
    async function taRecommend() {
        if (needKey()) return; const city = await uiPrompt('想去哪个城市？', store.getItem('userCity') || ''); if (!city) return;
        const btn = $('mpTa'); btn.disabled = true; btn.textContent = who() + ' 在翻地图…';
        let arr = null;
        try { arr = parseJSONLoose(await callPersona(cid(), '请你以角色本人的身份，在「' + city + '」挑 3 个你想和我一起去的地方，要符合你的性格和我们的关系。只能选你确定真实存在、比较有名的地点（公园、景区、街区、商圈、博物馆、书店咖啡馆连锁等），不要编造。只输出 JSON 数组：[{"name":"地点全名","why":"你想和我去的理由（口语，25字内，有你的语气）"}]', 1.0)); } catch (e) {}
        let n = 0, miss = []; if (Array.isArray(arr)) { for (const a of arr.slice(0, 3)) { if (!a || !a.name) continue; const g = await geocode(city + ' ' + a.name); if (g) { lifeUpdate(cid(), (L) => { L.places = L.places || []; L.places.push({ id: lifeId(), name: String(a.name).slice(0, 30), lat: g.lat, lng: g.lng, type: 'want', date: '', note: String(a.why || '').slice(0, 60), by: 'ta', ts: Date.now() }); }); n++; } else miss.push(a.name); await sleep(1100); } }
        btn.disabled = false; render(); const ps = places().filter(p => p.by === 'ta'); if (ps.length) fit(ps.slice(-3).map(p => [p.lat, p.lng]));
        uiAlert(n ? who() + ' 标了 ' + n + ' 个想和你去的地方' + (miss.length ? '（' + miss.join('、') + ' 没在地图上找到）' : '') : '这次没成功，可能是网络搜不到地点，稍后再试');
    }

    // =====================================================================
    //  约会规划
    // =====================================================================
    let vibe = '轻松散步', span = '半天';
    function renderDate() {
        drawPlaces(); layerP.clearLayers(); const L0 = Lget(), dates = (L0.dates || []).slice().reverse();
        const vibes = ['轻松散步', '浪漫', '吃货', '文艺', '户外运动', '省钱'];
        let h = '<div class="mm-hero" style="padding-top:2px"><b>约会规划</b><p>告诉 ' + esc(who()) + ' 想在哪个城市、什么氛围，TA 会排一条路线，画在地图上。</p></div>'
            + '<div class="stg-sub">城市</div><input id="dtCity" class="input-text" value="' + esc(store.getItem('userCity') || '') + '" placeholder="比如：连云港">'
            + '<div class="stg-sub">氛围</div><div class="mm-days" id="dtVibe">' + vibes.map(v => '<button data-v="' + v + '"' + (v === vibe ? ' class="on"' : '') + '>' + v + '</button>').join('') + '</div>'
            + '<div class="stg-sub">时长</div><div class="mm-days" id="dtSpan">' + ['半天', '一整天'].map(v => '<button data-v="' + v + '"' + (v === span ? ' class="on"' : '') + '>' + v + '</button>').join('') + '</div>'
            + '<div class="stg-sub">还有什么想法（选填）</div><input id="dtNote" class="input-text" maxlength="50" placeholder="比如：想吃海鲜、不想走太多路">'
            + '<div class="stg-btns"><button id="dtGo">让 ' + esc(who()) + ' 规划</button></div><div id="dtOut"></div>';
        h += '<div class="stg-sub">以前的约会计划</div>' + (dates.length ? dates.map(d => '<div class="mp-card" data-d="' + d.id + '"><i style="background:' + (d.done ? '#e58aa3' : '#7fa4c4') + '"></i><div><b>' + esc(d.title) + '</b><small>' + esc(d.city) + ' · ' + esc(d.vibe) + ' · ' + fmtTs(d.ts) + (d.done ? ' · 已约过' : '') + '</small></div></div>').join('') : '<div class="stg-empty">还没有约会计划</div>');
        $('mpBody').innerHTML = h;
        $('mpBody').querySelectorAll('#dtVibe button').forEach(b => b.onclick = () => { vibe = b.dataset.v; $('mpBody').querySelectorAll('#dtVibe button').forEach(x => x.classList.toggle('on', x === b)); });
        $('mpBody').querySelectorAll('#dtSpan button').forEach(b => b.onclick = () => { span = b.dataset.v; $('mpBody').querySelectorAll('#dtSpan button').forEach(x => x.classList.toggle('on', x === b)); });
        $('dtGo').onclick = plan; $('mpBody').querySelectorAll('[data-d]').forEach(e => e.onclick = () => { const d = (Lget().dates || []).find(x => x.id === e.dataset.d); if (d) { curPlan = d; showPlan(d); } });
        if (curPlan) showPlan(curPlan, true);
    }
    async function plan() {
        if (needKey()) return; const city = $('dtCity').value.trim(); if (!city) { uiAlert('先填一个城市'); return; }
        store.setItem('userCity', store.getItem('userCity') || city);
        const btn = $('dtGo'), out = $('dtOut'); btn.disabled = true; btn.textContent = who() + ' 在排路线…'; out.innerHTML = '<div class="stg-load"><div class="spin"></div>' + esc(who()) + ' 在想去哪里…</div>';
        const n = span === '半天' ? '3~4' : '4~5';
        let o = null;
        try { o = parseJSONLoose(await callPersona(cid(), '请你以角色本人的身份，给我们在「' + city + '」安排一次约会，氛围：' + vibe + '，时长：' + span + (($('dtNote').value || '').trim() ? '，我的想法：' + $('dtNote').value.trim() : '') + '。安排 ' + n + ' 个地点，按先后顺序、路线尽量顺路，要符合你的性格和我们的关系。只能选你确定真实存在、比较有名的地点（景区、公园、步行街、知名商圈、博物馆、连锁品牌门店等），不要编造店名；吃饭可以写「某某商圈的当地特色餐厅」这种。只输出 JSON：{"title":"这次约会的名字（12字内）","intro":"你对我说的开场白（口语，50字内）","stops":[{"name":"地点名（要能在地图上搜到）","time":"14:00","what":"一起做什么（20字内）","why":"为什么选这里（20字内，有你的语气）"}]}', 1.0)); } catch (e) {}
        btn.disabled = false; btn.textContent = '让 ' + who() + ' 规划';
        if (!o || !Array.isArray(o.stops) || !o.stops.length) { out.innerHTML = '<div class="stg-empty">这次没规划成功，再试一次吧</div>'; return; }
        const d = { id: lifeId(), city, vibe, span, ts: Date.now(), title: String(o.title || '一次约会').slice(0, 20), intro: String(o.intro || '').slice(0, 120), stops: o.stops.slice(0, 6).map(s => ({ name: String(s.name || '').slice(0, 30), time: String(s.time || '').slice(0, 8), what: String(s.what || '').slice(0, 40), why: String(s.why || '').slice(0, 40) })).filter(s => s.name), done: false };
        curPlan = d; out.innerHTML = '<div class="stg-load"><div class="spin"></div>正在地图上找这些地点…</div>';
        for (let i = 0; i < d.stops.length; i++) { const g = await geocode(city + ' ' + d.stops[i].name); if (g) { d.stops[i].lat = g.lat; d.stops[i].lng = g.lng; } if (i < d.stops.length - 1) await sleep(1100); }
        lifeUpdate(cid(), (L) => { L.dates = L.dates || []; L.dates.push(d); L.dates = L.dates.slice(-30); }); try { logActivity(cid(), 'map', '你给我规划了一次约会：' + d.title); addIntimacy(cid(), 1); } catch (e) {}
        showPlan(d);
    }
    function drawPlan(d) {
        if (!layerD) return; layerD.clearLayers(); const pts = [];
        d.stops.forEach((s, i) => { if (s.lat == null) return; const dp = disp(s.lat, s.lng); pts.push(dp); L.marker(dp, { icon: pin('#e58aa3', String(i + 1)) }).addTo(layerD).bindTooltip(esc(s.name), { direction: 'top', offset: [0, -30] }); });
        if (pts.length > 1) L.polyline(pts, { color: '#e58aa3', weight: 4, opacity: .85, dashArray: '2 9', lineCap: 'round' }).addTo(layerD);
        if (pts.length) { if (pts.length === 1) map.setView(pts[0], 14); else map.fitBounds(L.latLngBounds(pts), { padding: [40, 40], maxZoom: 15 }); }
    }
    function showPlan(d, keep) {
        const out = $('dtOut'); if (!out) return; drawPlan(d); const miss = d.stops.filter(s => s.lat == null).length;
        out.innerHTML = '<div class="mp-plan"><h3>' + esc(d.title) + '</h3><p class="mp-intro">' + esc(who()) + '：' + esc(d.intro) + '</p>' + d.stops.map((s, i) => '<div class="mp-stop' + (s.lat == null ? ' miss' : '') + '" data-i="' + i + '"><i>' + (i + 1) + '</i><div><b>' + esc(s.name) + (s.time ? '<em>' + esc(s.time) + '</em>' : '') + '</b><p>' + esc(s.what) + '</p><small>' + esc(s.why) + (s.lat == null ? ' · 地图上没找到这个地点，仅供参考' : '') + '</small></div></div>').join('')
            + '<p class="hint-line">地点由 AI 按常识推荐，出发前请再确认一下营业时间' + (miss ? '；有 ' + miss + ' 处没能在地图上定位。' : '。') + '</p><div class="stg-btns"><button id="dtWalk">▶ 一起走一遍</button><button class="ghost" id="dtAgain">换一个方案</button><button id="dtDone">' + (d.done ? '已存进地图' : '约完啦，存进我们的地图') + '</button></div></div>';
        out.querySelectorAll('.mp-stop').forEach(e => e.onclick = () => { const s = d.stops[+e.dataset.i]; if (s.lat != null) fit([[s.lat, s.lng]]); });
        $('dtAgain').onclick = plan; $('dtWalk').onclick = () => walk(d);
        $('dtDone').onclick = () => {
            if (d.done) return; const L0 = d.stops.filter(s => s.lat != null); if (!L0.length) { uiAlert('没有能定位的地点可以存'); return; }
            lifeUpdate(cid(), (L) => { L.places = L.places || []; L0.forEach(s => L.places.push({ id: lifeId(), name: s.name, lat: s.lat, lng: s.lng, type: 'went', date: todayStr(), note: s.what || '', by: 'both', ts: Date.now() })); const x = (L.dates || []).find(y => y.id === d.id); if (x) x.done = true; });
            d.done = true; try { addIntimacy(cid(), 3); logActivity(cid(), 'map', '我们一起完成了约会「' + d.title + '」'); } catch (e) {}
            uiAlert('已存进「我们的地图」，也会出现在回忆里'); showPlan(d, true);
        };
    }
    // =====================================================================
    //  互动玩法：一起散步 / 足迹徽章 / 今天去哪儿 / 明信片
    // =====================================================================
    const hav = (a, b) => { const R = 6371, r = Math.PI / 180, dLa = (b.lat - a.lat) * r, dLo = (b.lng - a.lng) * r, x = Math.sin(dLa / 2) ** 2 + Math.cos(a.lat * r) * Math.cos(b.lat * r) * Math.sin(dLo / 2) ** 2; return 2 * R * Math.asin(Math.sqrt(x)); };
    function avs() { try { const c = getChar(cid()), h = c && lifeOf(c).couple && lifeOf(c).couple.home, av = (h && h.av) || {}, A = window.HLA; if (!A) return null; return { me: A.cleanAvatar(av.me, 'me'), ta: A.cleanAvatar(av.ta, 'ta') }; } catch (e) { return null; } }
    function spr(w) { const a = avs(); return a ? window.HLA.charSprite(a[w], 'stand', 0) : null; }
    function walkIcon() {
        const a = spr('me'), b = spr('ta'); if (!a || !b) return L.divIcon({ className: 'mp-pinw', iconSize: [30, 30], iconAnchor: [15, 28], html: '<div class="mp-walkfb">♡</div>' });
        const k = 2, w = (a.w + b.w - 2) * k, h = Math.max(a.h, b.h) * k, c = document.createElement('canvas'); c.width = w; c.height = h; const x = c.getContext('2d'); x.imageSmoothingEnabled = false;
        x.drawImage(a.c, 0, h - a.h * k, a.w * k, a.h * k); x.drawImage(b.c, (a.w - 2) * k, h - b.h * k, b.w * k, b.h * k);
        return L.divIcon({ className: 'mp-pinw', iconSize: [w, h], iconAnchor: [w / 2, h - 2], html: '<img class="mp-walk" src="' + c.toDataURL() + '" width="' + w + '" height="' + h + '">' });
    }
    let walkT = null, walkM = null, walkPop = null;
    function stopWalk() {
        if (walkT) { cancelAnimationFrame(walkT); walkT = null; }
        if (walkM && map) { try { map.removeLayer(walkM); } catch (e) {} } walkM = null;
        if (walkPop && map) { try { map.closePopup(walkPop); } catch (e) {} } walkPop = null;
        const b = $('dtWalk'); if (b) b.textContent = '▶ 一起走一遍';
        document.querySelectorAll('.mp-stop.cur').forEach(e => e.classList.remove('cur'));
    }
    function heartBurst(ll) {
        if (!map) return; let hs = ''; for (let i = 0; i < 6; i++) hs += '<i style="--dx:' + (Math.random() * 60 - 30).toFixed(0) + 'px;--dl:' + (i * 0.08).toFixed(2) + 's">♡</i>';
        const m = L.marker(ll, { icon: L.divIcon({ className: 'mp-pinw mp-burst', iconSize: [4, 4], html: hs }), interactive: false, zIndexOffset: 900 }).addTo(map); setTimeout(() => { try { map.removeLayer(m); } catch (e) {} }, 1700);
    }
    function walk(d) {
        if (walkT) { stopWalk(); return; }
        if (!map) return; const idx = []; d.stops.forEach((s, i) => { if (s.lat != null) idx.push(i); });
        if (idx.length < 2) { uiAlert('至少要有 2 个能在地图上定位的地点才能散步哦'); return; }
        drawPlan(d); const pts = idx.map(i => disp(d.stops[i].lat, d.stops[i].lng)), n = pts.length;
        walkM = L.marker(pts[0], { icon: walkIcon(), interactive: false, zIndexOffset: 1000 }).addTo(map); $('dtWalk').textContent = '■ 停下来';
        const ends = ['今天好开心，下次还想和你一起走。', '路线走完啦，牵着你的手一点都不累。', '到终点咯，今天的我们也很可爱。'];
        let i = 0, phase = 'pause', t0 = performance.now(), dur = 0, last = 0;
        const show = (k, fin) => {
            const s = d.stops[idx[k]]; heartBurst(pts[k]);
            walkPop = L.popup({ closeButton: false, autoClose: false, closeOnClick: false, className: 'mp-say', offset: [0, -52], autoPan: false }).setLatLng(pts[k]).setContent('<b>' + esc(k + 1 + '. ' + s.name) + '</b>' + (fin ? '<br>' + esc(ends[Math.floor(Math.random() * ends.length)]) : (s.what ? '<br>' + esc(s.what) : ''))).openOn(map);
            document.querySelectorAll('.mp-stop').forEach(e => e.classList.toggle('cur', +e.dataset.i === idx[k]));
            const el = document.querySelector('.mp-stop.cur'); if (el && el.scrollIntoView) { try { el.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); } catch (e) {} }
        };
        show(0, false);
        const tick = (now) => {
            if (!walkM) return;
            if (phase === 'pause') {
                if (now - t0 >= 2300) {
                    if (i >= n - 1) { walkT = null; const b = $('dtWalk'); if (b) b.textContent = '▶ 一起走一遍'; return; }
                    const a = map.latLngToContainerPoint(pts[i]), b = map.latLngToContainerPoint(pts[i + 1]); dur = Math.min(4200, Math.max(1500, Math.hypot(a.x - b.x, a.y - b.y) / 0.09)); phase = 'move'; t0 = now; try { map.closePopup(walkPop); } catch (e) {}
                }
            } else {
                const k = Math.min(1, (now - t0) / dur), e = k < .5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2, A = pts[i], B = pts[i + 1], pos = [A[0] + (B[0] - A[0]) * e, A[1] + (B[1] - A[1]) * e];
                walkM.setLatLng(pos); if (now - last > 120) { map.panTo(pos, { animate: false }); last = now; }
                if (k >= 1) { i++; phase = 'pause'; t0 = now; const fin = i >= n - 1; show(i, fin); if (fin && !d.walked) { d.walked = true; try { lifeUpdate(cid(), (L2) => { const x = (L2.dates || []).find(y => y.id === d.id); if (x) x.walked = true; }); addIntimacy(cid(), 1); logActivity(cid(), 'map', '我们在地图上一起走完了「' + d.title + '」'); } catch (e) {} } }
            }
            walkT = requestAnimationFrame(tick);
        };
        walkT = requestAnimationFrame(tick);
    }

    // ---------- 足迹玩法页 ----------
    function badges() {
        const ps = places(), went = ps.filter(p => p.type === 'went'), want = ps.filter(p => p.type === 'want'), mark = ps.filter(p => p.type === 'mark'), ds = (Lget().dates || []).filter(x => x.done || x.walked);
        let far = 0; for (let i = 0; i < ps.length; i++) for (let j = i + 1; j < ps.length; j++) far = Math.max(far, hav(ps[i], ps[j]));
        const cl = []; ps.forEach(p => { if (!cl.some(c => hav(c, p) < 40)) cl.push(p); });
        const B = [['初次打卡', '在地图上留下第一个地点', ps.length >= 1, '♡'], ['小小旅行家', '去过 5 个地方', went.length >= 5, '✦'], ['心愿清单', '标 3 个想去的地方', want.length >= 3, '☆'], ['纪念收藏家', '标 2 个纪念地点', mark.length >= 2, '❀'], ['约会达人', '完成或走完 3 次约会', ds.length >= 3, '♪'], ['地图收藏家', '地图上有 10 个地点', ps.length >= 10, '◎'], ['远行', '两个地点相距 300 公里以上', far >= 300, '➶'], ['足迹遍布', '足迹分布在 3 个不同区域', cl.length >= 3, '✿']];
        return { B, ps, went, want, mark, far, cl: cl.length, ds: ds.length };
    }
    function renderPlay() {
        drawPlaces(); const o = badges(), got = o.B.filter(b => b[2]).length;
        let h = '<div class="mp-stats"><div><b>' + o.went.length + '</b><small>去过</small></div><div><b>' + o.want.length + '</b><small>想去</small></div><div><b>' + o.mark.length + '</b><small>纪念</small></div><div><b>' + o.ds + '</b><small>约会</small></div></div>'
            + '<p class="hint-line" style="margin:2px 0 8px">' + (o.ps.length > 1 ? '足迹跨度约 ' + Math.round(o.far) + ' 公里，分布在 ' + o.cl + ' 个区域。' : '再多标几个地点，这里会算出你们的足迹跨度。') + '</p>'
            + '<div class="stg-sub">足迹徽章（' + got + '/' + o.B.length + '）</div><div class="mp-badges">' + o.B.map(b => '<div class="' + (b[2] ? 'got' : '') + '"><i>' + b[3] + '</i><b>' + b[0] + '</b><small>' + b[1] + '</small></div>').join('') + '</div>'
            + '<div class="stg-sub">今天去哪儿？</div><div class="mp-dice"><div class="mp-dshow" id="dcShow">?</div><p class="mp-dsay" id="dcSay">从「想去」的地方里抽一个，或者让 ' + esc(who()) + ' 来选。</p><div class="stg-btns"><button id="dcRoll">骰一下</button><button class="ghost" id="dcTa">让 ' + esc(who()) + ' 选</button></div><div class="stg-btns" id="dcGo" style="display:none"><button id="dcLook">去看看这个地方</button></div></div>'
            + '<div class="stg-sub">做成明信片</div>' + (o.ps.length ? '<div class="mp-pcs">' + o.ps.slice().sort((a, b) => (b.ts || 0) - (a.ts || 0)).slice(0, 12).map(p => '<button data-id="' + p.id + '">' + esc(p.name) + '</button>').join('') + '</div><p class="hint-line">选一个地点，生成带着你们小人的明信片，可以保存成图片。</p>' : '<div class="stg-empty">先标一个地点吧</div>');
        $('mpBody').innerHTML = h;
        $('mpBody').querySelectorAll('.mp-pcs button').forEach(b => b.onclick = () => postcard(b.dataset.id));
        let pick = null; const poolOf = () => { const ps = places(), w = ps.filter(p => p.type === 'want'); return w.length ? w : ps; };
        const result = (p, say) => { pick = p; $('dcShow').textContent = p.name; $('dcShow').classList.add('done'); if (say != null) $('dcSay').textContent = say; $('dcGo').style.display = ''; try { map.flyTo(disp(p.lat, p.lng), 14, { duration: 1.2 }); heartBurst(disp(p.lat, p.lng)); } catch (e) {} };
        $('dcRoll').onclick = () => {
            const pool = poolOf(); if (!pool.length) { uiAlert('先在地图上标几个想去的地方吧'); return; }
            $('dcRoll').disabled = $('dcTa').disabled = true; $('dcGo').style.display = 'none'; $('dcShow').classList.remove('done'); let k = 0; const total = 14;
            const step = () => { const p = pool[Math.floor(Math.random() * pool.length)]; $('dcShow').textContent = p.name; k++; if (k < total) setTimeout(step, 60 + k * k * 2.2); else { $('dcRoll').disabled = $('dcTa').disabled = false; result(p, pool.length === 1 ? '只有这一个啦，就它！' : '命运选中了这里～'); } };
            step();
        };
        $('dcTa').onclick = async () => {
            const pool = poolOf(); if (!pool.length) { uiAlert('先在地图上标几个想去的地方吧'); return; } if (needKey()) return;
            $('dcRoll').disabled = $('dcTa').disabled = true; $('dcShow').classList.remove('done'); $('dcShow').textContent = who() + ' 在想…'; let p = null, say = '';
            try { const o = parseJSONLoose(await callPersona(cid(), '下面是我们地图上的地点：' + pool.slice(0, 12).map((x, i) => i + '. ' + x.name + (x.note ? '（' + x.note + '）' : '')).join('；') + '。请你以角色本人的身份，挑一个你最想今天和我一起去的地方。只输出 JSON：{"i":序号,"say":"你的理由，口语，有你的语气，30字内"}', 1.0)); if (o && pool[+o.i]) { p = pool[+o.i]; say = who() + '：' + String(o.say || '').slice(0, 60); } } catch (e) {}
            if (!p) { p = pool[Math.floor(Math.random() * pool.length)]; say = who() + '：就这里吧，跟你去哪都行。'; }
            if ($('dcShow')) { $('dcRoll').disabled = $('dcTa').disabled = false; result(p, say); }
        };
        $('dcLook').onclick = () => { if (pick) placeSheet(pick.id); };
    }

    // ---------- 明信片 ----------
    function wrapText(x, str, maxW, font) { x.font = font; const out = []; let cur = ''; for (const ch of String(str)) { if (x.measureText(cur + ch).width > maxW && cur) { out.push(cur); cur = ch; } else cur += ch; } if (cur) out.push(cur); return out; }
    function postcard(id) {
        const p = places().find(x => x.id === id); if (!p) return; const t = TYPES[p.type] || TYPES.went, W = 720, H = 460, c = document.createElement('canvas'); c.width = W; c.height = H; const x = c.getContext('2d');
        const FF = '"PingFang SC","Microsoft YaHei","Noto Sans CJK SC",sans-serif';
        x.fillStyle = '#fff8ef'; x.fillRect(0, 0, W, H); x.strokeStyle = t[1]; x.lineWidth = 3; x.setLineDash([10, 8]); x.strokeRect(12, 12, W - 24, H - 24); x.setLineDash([]);
        // 左侧像素小场景
        const sx = 32, sy = 36, sw = 300, sh = 388; x.save(); x.beginPath(); x.rect(sx, sy, sw, sh); x.clip();
        const g = x.createLinearGradient(0, sy, 0, sy + sh * .66); g.addColorStop(0, p.type === 'want' ? '#b9d8f2' : p.type === 'mark' ? '#ffe3a3' : '#ffc9da'); g.addColorStop(1, '#fff3e6'); x.fillStyle = g; x.fillRect(sx, sy, sw, sh);
        x.fillStyle = 'rgba(255,255,255,.85)'; [[50, 70, 4], [210, 100, 3], [120, 150, 2]].forEach(a => { const px = sx + a[0], py = sy + a[1], u = a[2] * 6; x.fillRect(px, py, u * 4, u); x.fillRect(px + u, py - u, u * 2, u); x.fillRect(px - u, py + u, u * 6, u); });
        x.fillStyle = '#a8d98f'; x.fillRect(sx, sy + 250, sw, sh - 250); x.fillStyle = '#8fc977'; for (let i = 0; i < 12; i++) x.fillRect(sx + 10 + i * 26, sy + 252 + (i % 3) * 12, 14, 6);
        x.fillStyle = '#7fb867'; x.beginPath(); x.moveTo(sx, sy + 250); x.quadraticCurveTo(sx + 90, sy + 200, sx + 180, sy + 250); x.lineTo(sx, sy + 250); x.fill();
        x.fillStyle = '#f7c0d3'; [[30, 300], [250, 330], [60, 370], [270, 280]].forEach(a => { x.fillRect(sx + a[0], sy + a[1], 8, 8); x.fillStyle = '#ffe66b'; x.fillRect(sx + a[0] + 3, sy + a[1] + 3, 2, 2); x.fillStyle = '#f7c0d3'; });
        x.fillStyle = '#e8a6bd'; for (let i = 0; i < 5; i++) { const hx = sx + 40 + i * 55, hy = sy + 40 + (i % 2) * 30; x.fillRect(hx, hy, 6, 6); x.fillRect(hx + 10, hy, 6, 6); x.fillRect(hx - 2, hy + 4, 20, 6); x.fillRect(hx + 2, hy + 10, 12, 4); x.fillRect(hx + 5, hy + 14, 6, 4); }
        x.imageSmoothingEnabled = false; const a = spr('me'), b = spr('ta'), k = 6;
        if (a && b) { x.drawImage(a.c, sx + 62, sy + 340 - a.h * k + 30, a.w * k, a.h * k); x.drawImage(b.c, sx + 150, sy + 340 - b.h * k + 30, b.w * k, b.h * k); }
        x.restore(); x.strokeStyle = t[1]; x.lineWidth = 4; x.strokeRect(sx, sy, sw, sh);
        // 邮票
        const tx = W - 130, ty = 34; x.fillStyle = '#fff'; x.fillRect(tx, ty, 92, 108); x.strokeStyle = t[1]; x.lineWidth = 2; x.setLineDash([5, 4]); x.strokeRect(tx, ty, 92, 108); x.setLineDash([]);
        x.fillStyle = t[1]; x.font = 'bold 40px ' + FF; x.textAlign = 'center'; x.fillText('♡', tx + 46, ty + 58); x.font = '12px ' + FF; x.fillText(t[0], tx + 46, ty + 82); x.font = '11px ' + FF; x.fillText(p.date || todayStr(), tx + 46, ty + 98);
        x.beginPath(); x.arc(tx - 18, ty + 70, 30, 0, 7); x.strokeStyle = 'rgba(0,0,0,.18)'; x.lineWidth = 2; x.stroke(); x.textAlign = 'left';
        // 文字
        const lx = 364; x.fillStyle = t[1]; x.font = 'bold 15px ' + FF; x.fillText('POSTCARD', lx, 58); x.fillStyle = '#4a3a34';
        const nm = wrapText(x, p.name, 250, 'bold 30px ' + FF).slice(0, 2); x.font = 'bold 30px ' + FF; nm.forEach((l, i) => x.fillText(l, lx, 108 + i * 38));
        let y = 108 + nm.length * 38 + 6; x.font = '14px ' + FF; x.fillStyle = '#9a8a84'; x.fillText(t[0] + (p.date ? ' · ' + p.date : ''), lx, y); y += 34;
        x.fillStyle = '#4a3a34'; const body = (p.note ? p.note : '和你一起的地方，我想把它好好收起来。'); wrapText(x, body, 320, '17px ' + FF).slice(0, 4).forEach(l => { x.font = '17px ' + FF; x.fillText(l, lx, y); y += 28; });
        if (p.react) { y += 6; x.fillStyle = t[1]; x.font = '15px ' + FF; wrapText(x, who() + '：' + p.react, 320, '15px ' + FF).slice(0, 3).forEach(l => { x.fillText(l, lx, y); y += 24; }); }
        x.strokeStyle = 'rgba(0,0,0,.12)'; x.lineWidth = 1; for (let i = 0; i < 3; i++) { x.beginPath(); x.moveTo(lx, H - 92 + i * 20); x.lineTo(W - 36, H - 92 + i * 20); x.stroke(); }
        x.fillStyle = '#9a8a84'; x.font = '13px ' + FF; x.fillText('from 我 & ' + who(), lx, H - 36);
        const url = c.toDataURL('image/png');
        stageOpen('明信片', (bd) => {
            bd.innerHTML = '<img src="' + url + '" style="width:100%;border-radius:12px;display:block;box-shadow:0 4px 14px rgba(0,0,0,.12)"><div class="stg-btns"><button id="pcSave">保存图片</button></div><p class="hint-line">长按图片也能保存。</p>';
            $('pcSave').onclick = () => { const aEl = document.createElement('a'); aEl.href = url; aEl.download = '明信片-' + p.name.slice(0, 10) + '.png'; document.body.appendChild(aEl); aEl.click(); aEl.remove(); };
        }, null);
        try { addIntimacy(cid(), 1); } catch (e) {}
    }
    ensure();
    window.mapOpen = () => openApp('map');
})();
