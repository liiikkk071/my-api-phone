/* home-folder.js —— 桌面文件夹：把一个应用叠到另一个应用上就合并成文件夹，可以起名字、整理、解散（合并和拖动逻辑在 home.js 里） */
(function () {
    'use strict';
    const $ = (id) => document.getElementById(id), esc = (s) => escapeHtml(String(s == null ? '' : s));
    function panel() {
        let p = $('hmFolder');
        if (!p) { p = document.createElement('div'); p.id = 'hmFolder'; p.className = 'hm-folder hidden'; $('desktop').appendChild(p); p.addEventListener('click', (e) => { if (e.target === p) close(); }); }
        return p;
    }
    function find(h, id) { return h.items.find(x => x.id === id && x.t === 'f'); }
    function close() { const p = $('hmFolder'); if (p) p.classList.add('hidden'); try { renderHome(); } catch (e) { } }
    function open(id, manage) { const h = getHome(); if (!find(h, id)) return; panel().classList.remove('hidden'); draw(id, !!manage); }
    function draw(id, manage) {
        const h = getHome(), f = find(h, id), p = panel(); if (!f) { close(); return; }
        p.innerHTML = '<div class="hf-card"><input class="hf-name" maxlength="8" value="' + esc(f.name || '文件夹') + '" aria-label="文件夹名字"><div class="hf-grid">'
            + f.apps.map(appId => { const a = appBy(appId); return a ? '<div class="hf-app">' + iconHtml(a, h, false) + (manage ? '<button class="hf-out" data-out="' + appId + '" title="移出文件夹">−</button>' : '') + '</div>' : ''; }).join('')
            + '</div><div class="hf-btns"><button data-a="manage">' + (manage ? '整理完了' : '整理') + '</button><button data-a="dissolve">解散文件夹</button><button data-a="close" class="pri">完成</button></div><p class="hf-tip">' + (manage ? '点图标左上角的「−」把应用移回桌面' : '点名字可以改，点图标打开应用') + '</p></div>';
        const nm = p.querySelector('.hf-name');
        nm.onchange = () => { const hh = getHome(), ff = find(hh, id); if (ff) { ff.name = nm.value.trim().slice(0, 8) || '文件夹'; saveHome(hh); } };
        p.querySelectorAll('[data-app]').forEach(el => el.onclick = (e) => { if (e.target.closest('.hf-out')) return; const a = appBy(el.dataset.app); if (!a) return; p.classList.add('hidden'); try { renderHome(); } catch (_) { } a.go(); });
        p.querySelectorAll('[data-out]').forEach(b => b.onclick = (e) => { e.stopPropagation(); removeApp(id, b.dataset.out); draw(id, true); });
        p.querySelector('[data-a="manage"]').onclick = () => draw(id, !manage);
        p.querySelector('[data-a="close"]').onclick = () => { nm.onchange(); close(); };
        p.querySelector('[data-a="dissolve"]').onclick = () => dissolve(id);
    }
    function removeApp(id, appId) {
        const h = getHome(), f = find(h, id); if (!f) return; f.apps = f.apps.filter(x => x !== appId);
        const i = h.items.indexOf(f); h.items.splice(i + 1, 0, { t: 'a', id: appId, page: f.page || 0 });
        if (!f.apps.length) h.items.splice(i, 1); saveHome(h); try { renderHome(); } catch (e) { }
    }
    async function dissolve(id) {
        const h0 = getHome(), f0 = find(h0, id); if (!f0) return;
        if (!(await uiConfirm('解散「' + (f0.name || '文件夹') + '」？里面的应用会回到桌面'))) return;
        const h = getHome(), f = find(h, id); if (!f) return; const i = h.items.indexOf(f);
        h.items.splice(i, 1, ...f.apps.map(a => ({ t: 'a', id: a, page: f.page || 0 }))); saveHome(h);
        const p = $('hmFolder'); if (p) p.classList.add('hidden'); try { renderHome(); } catch (e) { }
    }
    window.HOMEFOLDER = { open: open, dissolve: dissolve, close: close };
})();
