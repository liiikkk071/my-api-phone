/* splash.js —— 开屏画面（完全自定义版）。默认【不显示】开屏；想要的话到「设置」里打开，再自己选：
 * 简约文字 / 上传自己的图片，可调背景色、文字色、动画、时长。出错或超时都会自动消失，绝不会挡住小手机。 */
(function () {
    'use strict';
    var KEY = 'xsj_splash', DEF_BG = '#ffe3ef';
    var STAR = '<svg class="bs-star" viewBox="0 0 40 40" width="42" height="42"><path d="M20 3l4.6 10.4 11.4 1.2-8.5 7.7 2.4 11.2L20 27.7 10.1 33.5l2.4-11.2L4 14.6l11.4-1.2z" fill="#fff" stroke="currentColor" stroke-width="3" stroke-linejoin="round" paint-order="stroke"/></svg>';
    function cfg() {
        var c = {}; try { c = JSON.parse(localStorage.getItem(KEY) || '{}') || {}; } catch (e) {}
        if (c.mode === 'design') { c.mode = 'text'; c.on = 0; }   // 旧版的「设计图」已移除
        return { on: c.on === 1, mode: ['text', 'image'].indexOf(c.mode) >= 0 ? c.mode : 'text', text: String(c.text || '凛凛机').slice(0, 10), sub: c.sub == null ? '' : String(c.sub).slice(0, 20), bg: /^#[0-9a-f]{6}$/i.test(c.bg || '') ? c.bg : DEF_BG, fg: /^#[0-9a-f]{6}$/i.test(c.fg || '') ? c.fg : '#d77fa1', deco: c.deco === 0 ? 0 : 1, anim: ['fade', 'rise', 'pop'].indexOf(c.anim) >= 0 ? c.anim : 'fade', dur: [1.5, 2.5, 4].indexOf(+c.dur) >= 0 ? +c.dur : 2.5, img: typeof c.img === 'string' && c.img.indexOf('data:image') === 0 ? c.img : '' };
    }
    function save(c) { try { localStorage.setItem(KEY, JSON.stringify(c)); return true; } catch (e) { return false; } }
    var timer = null, fail = null;
    function remove() { var el = document.getElementById('bootSplash'); clearTimeout(timer); clearTimeout(fail); if (!el) return; el.classList.add('out'); setTimeout(function () { try { el.remove(); } catch (e) {} }, 600); }
    function clean(s) { return String(s).replace(/[<>&"]/g, ''); }
    function show(isBoot) {
        var c = cfg(), old = document.getElementById('bootSplash'); if (old) old.remove();
        var host = document.querySelector('.phone') || document.body, el = document.createElement('div'); el.id = 'bootSplash'; el.setAttribute('aria-hidden', 'true');
        var useImg = c.mode === 'image' && c.img;
        el.className = 'bs bs-' + c.anim; el.style.background = c.bg; el.style.color = c.fg;
        if (useImg) el.innerHTML = '<img class="bs-img" alt="" src="' + c.img + '">';
        else el.innerHTML = '<div class="bs-t">' + (c.deco ? '<span class="bs-d l">' + STAR + '</span>' : '') + '<span class="bs-w">' + clean(c.text) + '</span>' + (c.deco ? '<span class="bs-d r">' + STAR + '</span>' : '') + '</div>' + (c.sub ? '<div class="bs-s">' + clean(c.sub) + '</div>' : '');
        host.insertBefore(el, host.firstChild);
        var t0 = Date.now(), skipped = false, MIN = c.dur * 1000;
        function tick() { var ready = !isBoot || document.documentElement.classList.contains('app-ready'); if (ready && (skipped || Date.now() - t0 >= MIN)) { remove(); return; } timer = setTimeout(tick, 100); }
        el.addEventListener('click', function () { skipped = true; if (!isBoot) remove(); });
        timer = setTimeout(tick, 100); fail = setTimeout(remove, isBoot ? 9000 : 8000);
    }
    window.__splashShow = function () { try { show(false); } catch (e) {} };
    try { if (cfg().on) show(true); } catch (e) { try { remove(); } catch (e2) {} }

    // ---------- 设置 ----------
    function fileToImg(file, cb) {
        var r = new FileReader(); r.onerror = function () { cb(null); };
        r.onload = function () { var im = new Image(); im.onerror = function () { cb(null); }; im.onload = function () { try { var m = 900, s = Math.min(1, m / Math.max(im.width, im.height)), cv = document.createElement('canvas'); cv.width = Math.round(im.width * s); cv.height = Math.round(im.height * s); var x = cv.getContext('2d'); x.drawImage(im, 0, 0, cv.width, cv.height); var p = x.getImageData(2, 2, 1, 1).data, hex = '#' + [p[0], p[1], p[2]].map(function (v) { return ('0' + v.toString(16)).slice(-2); }).join(''); cb({ img: cv.toDataURL('image/jpeg', .85), bg: hex }); } catch (e) { cb(null); } }; im.src = r.result; };
        r.readAsDataURL(file);
    }
    function injectSettings() {
        try {
            var app = document.getElementById('settingsApp'); if (!app) return; var area = app.querySelector('.scroll-area'); if (!area || document.getElementById('bsSet')) return;
            var box = document.createElement('div'); box.id = 'bsSet';
            box.innerHTML = '<p class="section-title">开屏画面</p><div class="cell-group"><div class="cell-item"><span>打开小手机时显示开屏</span><input type="checkbox" id="bsOn" class="ios-switch"></div></div><p class="hint-line">默认不显示开屏。打开开关后，可以用自己的文字或图片做开屏。</p>'
                + '<div class="bs-lab">样式</div><div class="bs-chips" id="bsMode"><button data-v="text">简约文字</button><button data-v="image">上传图片</button></div>'
                + '<div id="bsTextBox"><input id="bsText" type="text" maxlength="10" placeholder="开屏文字，如：凛凛机" class="input-text"><input id="bsSub" type="text" maxlength="20" placeholder="副标题（可空）" class="input-text"><div class="bs-row"><label>文字色<input type="color" id="bsFg"></label><label>背景色<input type="color" id="bsBg"></label><label class="bs-chk"><input type="checkbox" id="bsDeco">星星装饰</label></div></div>'
                + '<div id="bsImgBox" style="display:none"><div class="bs-row"><button class="btn-secondary" id="bsUp" style="margin:0">选择图片</button><label>背景色<input type="color" id="bsBg2"></label></div><p class="hint-line" id="bsImgTip"></p><input type="file" id="bsFile" accept="image/*" style="display:none"></div>'
                + '<div class="bs-lab">动画</div><div class="bs-chips" id="bsAnim"><button data-v="fade">淡入</button><button data-v="rise">上浮</button><button data-v="pop">弹出</button></div>'
                + '<div class="bs-lab">停留时间</div><div class="bs-chips" id="bsDur"><button data-v="1.5">1.5 秒</button><button data-v="2.5">2.5 秒</button><button data-v="4">4 秒</button></div>'
                + '<div class="bs-row" style="margin-top:8px"><button class="btn-secondary" id="bsPrev" style="margin:0">预览</button><button class="btn-secondary" id="bsReset" style="margin:0">恢复默认</button></div>';
            var ref = area.querySelector('.section-title'); while (ref && ref.parentNode !== area) ref = ref.parentNode; area.insertBefore(box, ref || area.firstChild);
            var g = function (i) { return document.getElementById(i); };
            function fill() {
                var c = cfg(); g('bsOn').checked = c.on; g('bsText').value = c.text; g('bsSub').value = c.sub; g('bsFg').value = c.fg; g('bsBg').value = c.bg; g('bsBg2').value = c.bg; g('bsDeco').checked = !!c.deco;
                [['bsMode', c.mode], ['bsAnim', c.anim], ['bsDur', String(c.dur)]].forEach(function (p) { g(p[0]).querySelectorAll('button').forEach(function (b) { b.classList.toggle('on', b.dataset.v === p[1]); }); });
                g('bsTextBox').style.display = c.mode === 'text' ? '' : 'none'; g('bsImgBox').style.display = c.mode === 'image' ? '' : 'none'; g('bsImgTip').textContent = c.img ? '已选择图片，点预览看看效果' : '还没有选择图片（建议正方形或竖图，背景色会自动取图片边缘颜色）';
            }
            function upd() { var c = cfg(); c.on = g('bsOn').checked ? 1 : 0; c.text = g('bsText').value.trim() || '凛凛机'; c.sub = g('bsSub').value.trim(); c.fg = g('bsFg').value; c.bg = c.mode === 'image' ? g('bsBg2').value : g('bsBg').value; c.deco = g('bsDeco').checked ? 1 : 0; save(c); }
            ['bsOn', 'bsText', 'bsSub', 'bsFg', 'bsBg', 'bsBg2', 'bsDeco'].forEach(function (i) { g(i).oninput = g(i).onchange = upd; });
            [['bsMode', 'mode'], ['bsAnim', 'anim'], ['bsDur', 'dur']].forEach(function (p) { g(p[0]).querySelectorAll('button').forEach(function (b) { b.onclick = function () { upd(); var c = cfg(); c[p[1]] = p[1] === 'dur' ? +b.dataset.v : b.dataset.v; save(c); fill(); window.__splashShow(); }; }); });
            g('bsUp').onclick = function () { g('bsFile').click(); };
            g('bsFile').onchange = function () { var f = this.files && this.files[0]; if (!f) return; fileToImg(f, function (r) { if (!r) { alert('这张图片读取失败，换一张试试'); return; } var c = cfg(); c.img = r.img; c.bg = r.bg; c.mode = 'image'; if (!save(c)) { alert('图片太大存不下了，换一张小一点的'); return; } fill(); window.__splashShow(); }); g('bsFile').value = ''; };
            g('bsPrev').onclick = function () { upd(); window.__splashShow(); };
            g('bsReset').onclick = function () { try { localStorage.removeItem(KEY); } catch (e) {} fill(); };
            fill();
        } catch (e) {}
    }
    document.addEventListener('DOMContentLoaded', injectSettings); setTimeout(injectSettings, 1500); setTimeout(injectSettings, 4000);
})();
