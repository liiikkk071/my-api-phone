/* tts.js —— 语音合成：浏览器自带 / ElevenLabs / Fish Audio（自己填 Key 和声音 ID）。用于通话开口说话 + 聊天气泡「朗读」 */
(function () {
    'use strict';
    const $ = (id) => document.getElementById(id);
    const esc = (s) => escapeHtml(String(s == null ? '' : s));
    const DEF = { provider: 'off', autoCall: true, speed: 1, el: { key: '', voice: '', model: 'eleven_multilingual_v2', base: '' }, fish: { key: '', voice: '', model: 's2-pro', base: '' } };
    function cfg() { let c = {}; try { c = JSON.parse(store.getItem('ttsCfg') || '{}'); } catch (e) {} return { provider: c.provider || DEF.provider, autoCall: c.autoCall !== false, speed: c.speed || 1, el: Object.assign({}, DEF.el, c.el), fish: Object.assign({}, DEF.fish, c.fish) }; }
    function save(c) { store.setItem('ttsCfg', JSON.stringify(c)); }
    let audio = null, objUrl = null;
    function stop() { try { if (audio) { audio.pause(); audio.src = ''; } if (objUrl) URL.revokeObjectURL(objUrl); if ('speechSynthesis' in window) speechSynthesis.cancel(); } catch (e) {} audio = null; objUrl = null; }
    function clean(t) {
        return String(t || '').replace(/\[[^\]]*\]\([^)]*\)/g, '').replace(/[（(][^）)]*[）)]/g, '').replace(/[*_`#>~]/g, '')
            .replace(/[^\p{L}\p{N}\s。，！？、；：,.!?…\-—'"“”‘’]/gu, '').replace(/\s+/g, ' ').trim().slice(0, 600);
    }
    function voiceFor(c, key, charId) { const ch = charId ? getChar(charId) : null; const o = ch && ch.voiceId && ch.voiceId[key]; return (o || c[key === 'elevenlabs' ? 'el' : 'fish'].voice || '').trim(); }
    async function fetchAudio(prov, text, charId, c) {
        let url, init;
        if (prov === 'elevenlabs') {
            const p = c.el, voice = voiceFor(c, 'elevenlabs', charId); if (!p.key) throw new Error('还没填 ElevenLabs 的 API Key'); if (!voice) throw new Error('还没填 ElevenLabs 的 Voice ID');
            url = (p.base || 'https://api.elevenlabs.io').replace(/\/+$/, '') + '/v1/text-to-speech/' + encodeURIComponent(voice) + '?output_format=mp3_44100_128';
            const body = { text, model_id: p.model || 'eleven_multilingual_v2' }; if (c.speed !== 1) body.voice_settings = { speed: c.speed };
            init = { method: 'POST', headers: { 'xi-api-key': p.key.trim(), 'Content-Type': 'application/json', Accept: 'audio/mpeg' }, body: JSON.stringify(body) };
        } else {
            const p = c.fish, voice = voiceFor(c, 'fish', charId); if (!p.key) throw new Error('还没填 Fish Audio 的 API Key'); if (!voice) throw new Error('还没填 Fish Audio 的声音 ID（reference_id）');
            url = (p.base || 'https://api.fish.audio').replace(/\/+$/, '') + '/v1/tts';
            const body = { text, reference_id: voice, format: 'mp3', mp3_bitrate: 128 }; if (c.speed !== 1) body.prosody = { speed: c.speed };
            init = { method: 'POST', headers: { Authorization: 'Bearer ' + p.key.trim(), 'Content-Type': 'application/json', model: p.model || 's2-pro' }, body: JSON.stringify(body) };
        }
        let res;
        try { res = await fetch(url, init); } catch (e) { throw new Error('连不上语音服务。可能是网络问题，或该服务不允许网页直接调用——可以在「接口地址」里填你自己的转发地址。'); }
        if (!res.ok) { let m = ''; try { m = (await res.text()).slice(0, 160); } catch (e) {} throw new Error('语音服务返回 ' + res.status + (res.status === 401 || res.status === 403 ? '（Key 不对或没有权限）' : res.status === 402 ? '（额度/余额不足）' : res.status === 422 ? '（参数不对，检查声音ID/模型）' : '') + (m ? '：' + m : '')); }
        return await res.blob();
    }
    function playBlob(blob) {
        return new Promise((resolve, reject) => {
            objUrl = URL.createObjectURL(blob); audio = new Audio(objUrl);
            audio.onended = () => resolve(); audio.onerror = () => reject(new Error('音频播放失败'));
            audio.play().catch(() => reject(new Error('浏览器拦截了自动播放，先点一下屏幕再试')));
        });
    }
    function speakBrowser(text) {
        return new Promise((resolve) => {
            if (!('speechSynthesis' in window)) { uiAlert('这个浏览器不支持语音朗读'); return resolve(); }
            const u = new SpeechSynthesisUtterance(text); u.lang = 'zh-CN'; u.rate = cfg().speed; u.onend = u.onerror = () => resolve(); speechSynthesis.speak(u);
        });
    }
    window.ttsStop = stop;
    window.ttsSpeak = async function (text, charId, opts) {
        const c = cfg(), prov = (opts && opts.provider) || c.provider; if (prov === 'off') { if (!(opts && opts.force)) return; }
        const t = clean(text); if (!t) return; stop();
        try {
            if (prov === 'browser') await speakBrowser(t);
            else if (prov === 'elevenlabs' || prov === 'fish') await playBlob(await fetchAudio(prov, t, charId, c));
        } catch (e) { uiAlert('语音：' + e.message, 4200); if (opts && opts.throw) throw e; }
    };

    // ---------- 设置面板 ----------
    function panel() {
        const area = document.querySelector('#settingsApp .scroll-area'); if (!area || $('ttsPanel')) return;
        const c = cfg(), box = document.createElement('div'); box.id = 'ttsPanel';
        const chars = getChars();
        box.innerHTML = '<p class="section-title">语音（让 TA 开口说话）</p><div class="tts-card">'
            + '<label>语音引擎</label><select id="ttsProv" class="input-text"><option value="off">关闭</option><option value="browser">浏览器自带（免费，音色一般）</option><option value="elevenlabs">ElevenLabs</option><option value="fish">Fish Audio</option></select>'
            + '<div id="ttsEl" class="tts-grp"><label>ElevenLabs API Key</label><input id="ttsElKey" type="password" class="input-text" placeholder="xi-api-key" autocomplete="off"><label>默认 Voice ID</label><input id="ttsElVoice" class="input-text" placeholder="在 ElevenLabs 声音库里复制 Voice ID"><label>模型</label><select id="ttsElModel" class="input-text"><option value="eleven_multilingual_v2">eleven_multilingual_v2（多语言，推荐）</option><option value="eleven_flash_v2_5">eleven_flash_v2_5（更快更省）</option><option value="eleven_v3">eleven_v3</option></select><label>接口地址（可选）</label><input id="ttsElBase" class="input-text" placeholder="默认 https://api.elevenlabs.io"></div>'
            + '<div id="ttsFish" class="tts-grp"><label>Fish Audio API Key</label><input id="ttsFishKey" type="password" class="input-text" placeholder="Bearer Key" autocomplete="off"><label>默认声音 ID（reference_id）</label><input id="ttsFishVoice" class="input-text" placeholder="在 Fish Audio 声音页复制模型 ID"><label>模型</label><select id="ttsFishModel" class="input-text"><option value="s2-pro">s2-pro</option><option value="s2.1-pro">s2.1-pro</option><option value="s1">s1</option></select><label>接口地址（可选）</label><input id="ttsFishBase" class="input-text" placeholder="默认 https://api.fish.audio"></div>'
            + '<label>语速 <b id="ttsSpeedV"></b></label><input id="ttsSpeed" type="range" min="0.8" max="1.3" step="0.05">'
            + '<div class="cell-item" style="padding:10px 0"><span>通话时 TA 开口说话</span><label class="switch"><input id="ttsAutoCall" type="checkbox"><span class="slider"></span></label></div>'
            + '<div id="ttsPerChar" class="tts-grp"><label>给某个角色单独指定声音（可选）</label><select id="ttsChar" class="input-text"><option value="">选择角色…</option>' + chars.map(x => '<option value="' + esc(x.id) + '">' + esc(x.name) + '</option>').join('') + '</select><input id="ttsCharVoice" class="input-text" placeholder="这个角色用的声音 ID（跟随上面选的引擎）" style="margin-top:6px"></div>'
            + '<div class="tts-btns"><button id="ttsSave" class="btn-small">保存</button><button id="ttsTest" class="btn-small">试听</button></div><p class="hint-line" id="ttsMsg">Key 只保存在你自己的浏览器里。网页直连失败时，可在“接口地址”填自己的转发服务。</p></div>';
        area.appendChild(box);
        const set = () => {
            const c = cfg(); $('ttsProv').value = c.provider; $('ttsElKey').value = c.el.key; $('ttsElVoice').value = c.el.voice; $('ttsElModel').value = c.el.model; $('ttsElBase').value = c.el.base;
            $('ttsFishKey').value = c.fish.key; $('ttsFishVoice').value = c.fish.voice; $('ttsFishModel').value = c.fish.model; $('ttsFishBase').value = c.fish.base;
            $('ttsSpeed').value = c.speed; $('ttsSpeedV').textContent = c.speed + 'x'; $('ttsAutoCall').checked = c.autoCall; vis();
        };
        const vis = () => { const p = $('ttsProv').value; $('ttsEl').style.display = p === 'elevenlabs' ? '' : 'none'; $('ttsFish').style.display = p === 'fish' ? '' : 'none'; $('ttsPerChar').style.display = (p === 'elevenlabs' || p === 'fish') ? '' : 'none'; };
        const read = () => ({ provider: $('ttsProv').value, autoCall: $('ttsAutoCall').checked, speed: +$('ttsSpeed').value || 1, el: { key: $('ttsElKey').value.trim(), voice: $('ttsElVoice').value.trim(), model: $('ttsElModel').value, base: $('ttsElBase').value.trim() }, fish: { key: $('ttsFishKey').value.trim(), voice: $('ttsFishVoice').value.trim(), model: $('ttsFishModel').value, base: $('ttsFishBase').value.trim() } });
        $('ttsProv').onchange = vis; $('ttsSpeed').oninput = () => { $('ttsSpeedV').textContent = $('ttsSpeed').value + 'x'; };
        $('ttsChar').onchange = () => { const ch = getChar($('ttsChar').value), p = $('ttsProv').value === 'fish' ? 'fish' : 'elevenlabs'; $('ttsCharVoice').value = (ch && ch.voiceId && ch.voiceId[p]) || ''; };
        $('ttsSave').onclick = () => {
            save(read()); const id = $('ttsChar').value;
            if (id) { const p = $('ttsProv').value === 'fish' ? 'fish' : 'elevenlabs', v = $('ttsCharVoice').value.trim(), cs = getChars(), ch = cs.find(x => x.id === id); if (ch) { ch.voiceId = ch.voiceId || {}; if (v) ch.voiceId[p] = v; else delete ch.voiceId[p]; saveChars(cs); } }
            uiAlert('语音设置已保存');
        };
        $('ttsTest').onclick = async () => {
            save(read()); const b = $('ttsTest'), prov = $('ttsProv').value; if (prov === 'off') { uiAlert('先选一个语音引擎'); return; }
            b.disabled = true; b.textContent = '合成中…'; $('ttsMsg').textContent = '';
            try { await window.ttsSpeak('你好呀，今天也想和你说说话。', $('ttsChar').value || getActiveCharId(), { throw: true, force: true }); $('ttsMsg').textContent = '试听完成 ✓'; } catch (e) { $('ttsMsg').textContent = '失败：' + e.message; }
            b.disabled = false; b.textContent = '试听';
        };
        set();
    }
    const sa = $('settingsApp'); if (sa) new MutationObserver(() => { if (!sa.classList.contains('hidden')) { const o = $('ttsPanel'); if (o) o.remove(); panel(); } }).observe(sa, { attributes: true, attributeFilter: ['class'] });
    panel();

    // ---------- 通话：TA 回复时开口 ----------
    const cap = $('callCaption');
    if (cap) new MutationObserver(() => { const t = (cap.textContent || '').trim(); if (!t || t === '......' || /^（/.test(t) || !cfg().autoCall) return; if (cap._last === t) return; cap._last = t; window.ttsSpeak(t, (typeof callState !== 'undefined' && callState.charId) || getActiveCharId()); }).observe(cap, { childList: true, characterData: true, subtree: true });
    if (typeof window.endCall === 'function') { const o = window.endCall; window.endCall = function () { stop(); if (cap) cap._last = ''; return o.apply(this, arguments); }; }

    // ---------- 聊天气泡：朗读 ----------
    const acts = document.querySelector('#msgSheet .msg-actions');
    if (acts && !$('msgSpeakBtn')) {
        const b = document.createElement('button'); b.className = 'btn-secondary'; b.id = 'msgSpeakBtn'; b.textContent = '朗读'; acts.insertBefore(b, acts.firstChild);
        b.onclick = () => { try { const m = curHistory()[msgSel.idx]; closeMsgSheet(); if (cfg().provider === 'off') { uiAlert('先去「设置」里选一个语音引擎'); return; } if (m && !m.img) window.ttsSpeak(String(m.content), currentGroupId ? null : currentChatCharId); } catch (e) {} };
    }
})();
