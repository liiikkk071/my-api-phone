/* card-import.js —— 角色卡「导入文件」：不管什么格式都能读出来，文件里有什么就分成什么项，每一项都能改 */
(function () {
    'use strict';
    const $ = (id) => document.getElementById(id), esc = (s) => escapeHtml(String(s == null ? '' : s));

    // ---------- 英文键名 → 中文 ----------
    const ZH = {
        basic_information: '基本信息', basic_info: '基本信息', basic: '基本信息', profile: '基本资料', info: '基本信息',
        name: '姓名', char_name: '姓名', nickname: '昵称', age: '年龄', gender: '性别', sex: '性别', birthday: '生日', birth: '生日', zodiac: '星座', mbti: 'MBTI',
        height: '身高', weight: '体重', occupation: '职业', job: '职业', identity: '身份', role: '身份', species: '种族', race: '种族',
        appearance: '外貌', look: '外貌', looks: '外貌', hair: '发型', eyes: '眼睛', clothing: '穿着', outfit: '穿着', clothes: '穿着',
        personality: '性格', character: '性格', traits: '性格特点', temperament: '性格',
        speech: '说话方式', speech_style: '说话方式', speaking_style: '说话方式', speechstyle: '说话方式', tone: '语气', catchphrase: '口头禅', catchphrases: '口头禅',
        likes: '喜欢', dislikes: '讨厌', hobbies: '爱好', habits: '习惯', quirks: '小癖好', skills: '技能', abilities: '能力', fears: '恐惧',
        background: '背景', backstory: '背景故事', history: '经历', family: '家庭', education: '教育背景',
        relationship: '关系', relationships: '人际关系', attitude: '对我的态度', how_met: '怎么认识的', howmet: '怎么认识的', call_me: '对我的称呼', callme: '对我的称呼',
        description: '角色描述', desc: '角色描述', summary: '概述', scenario: '场景设定', setting: '世界设定', world: '世界观',
        first_mes: '开场白', first_message: '开场白', greeting: '开场白', alternate_greetings: '备用开场白',
        mes_example: '对话示例', example_dialogue: '对话示例', examples: '示例', dialogue: '对话示例', samples: '说话示范',
        system_prompt: '系统提示词', post_history_instructions: '补充指令', creator_notes: '作者备注', notes: '备注', note: '备注', extra: '补充设定',
        rules: '规则', taboo: '禁忌', forbidden: '禁止事项', restrictions: '限制', tags: '标签', character_book: '设定集', lorebook: '设定集', entries: '条目',
        keys: '关键词', content: '内容', comment: '备注', title: '标题', text: '内容', value: '内容',
        persona: '人设', roleplay: '扮演要求', instructions: '要求', style: '风格', language: '语言',
        // —— 常见 XML / 分块角色卡的标签 ——
        occupation_identity: '职业身份', hairstyle_hair_color: '发型发色', hairstyle: '发型', hair_color: '发色', facial_features: '五官', physique: '身材', clothing_style: '穿衣风格', overall_aura: '整体气质', aura: '气质',
        core_personality: '核心性格', personality_keywords: '性格关键词', hidden_side: '隐藏的一面', upbringing: '成长经历', current_life: '现状', worldbuilding: '世界观', social_background: '社会背景', special_setting: '特殊设定',
        relationship_with_user: '与user的关系', first_meeting: '初遇', first_impression_of_user: '对user的第一印象', current_view_of_user: '现在怎么看user', hidden_feelings_toward_user: '对user的隐秘心思', shared_experiences_memories: '共同经历',
        online_chat: '线上聊天', offline_speech: '线下说话', offline_chat: '线下相处', overall_style: '整体风格', overall_tone: '整体语气', text_habits: '打字习惯', usual_forms_of_address: '常用称呼', forms_of_address: '称呼', typing_habits: '发消息习惯', common_expressions: '常用语',
        emotional_speech_patterns: '情绪下的说话方式', happy: '开心时', angry: '生气时', jealous: '吃醋时', sad: '难过时', truly_furious: '真正暴怒时', shy: '害羞时', anxious: '不安时',
        preferences_and_skills: '喜好与技能', weaknesses_in_skills: '弱点', family_friends: '家人朋友', other_important_people: '其他重要的人', secrets: '秘密', things_the_character_does_not_easily_tell_others: '不轻易告诉别人的事',
        character_supplement: '补充设定', values: '价值观', life_goal: '人生目标', boundaries: '底线', emotional_triggers: '情绪触发点', other_details: '其他细节', nsfw: '亲密相关',
        sexual_experience: '亲密经历', sexual_personality_attitude_orientation: '亲密中的性格与取向', initiative_in_intimacy: '亲密中的主动程度', preferred_positions_places_times_environments: '亲密偏好', arousal_triggers: '心动点', aftercare_and_post_intimacy_habits: '亲密后的习惯', other_nsfw_details: '其他亲密细节',
        user_info: '关于user', user_setting: '关于user', char_setting: '角色设定', character_setting: '角色设定', character_info: '角色信息', character_profile: '角色档案', dialogue_style: '对话风格', inner_thoughts: '内心想法', daily_life: '日常生活', daily_routine: '日常作息', love_language: '表达爱的方式', attachment_style: '依恋类型'
    };
    const SKIP = { extensions: 1, avatar: 1, spec: 1, spec_version: 1, create_date: 1, creation_date: 1, modification_date: 1, talkativeness: 1, fav: 1, character_version: 1, creator: 1, id: 1, uuid: 1, version: 1, depth: 1, enabled: 1, insertion_order: 1, position: 1, selective: 1, secondary_keys: 1, constant: 1, priority: 1, case_sensitive: 1, use_regex: 1, probability: 1, group: 1 };
    const zh = (k) => { const s = String(k).trim(), l = s.toLowerCase().replace(/[\s-]+/g, '_'); return ZH[l] || ZH[l.replace(/_/g, '')] || (/^[\x00-\x7f]+$/.test(s) ? s.replace(/_/g, ' ') : s); };
    const clean = (v) => String(v == null ? '' : v).replace(/\r/g, '').trim();

    // ---------- 读文件（任何格式都尽量读出文字） ----------
    function decodeBuf(buf) {
        const u = new Uint8Array(buf);
        if (u[0] === 0xff && u[1] === 0xfe) return new TextDecoder('utf-16le').decode(u.subarray(2));
        if (u[0] === 0xfe && u[1] === 0xff) return new TextDecoder('utf-16be').decode(u.subarray(2));
        if (u[0] === 0xef && u[1] === 0xbb && u[2] === 0xbf) return new TextDecoder('utf-8').decode(u.subarray(3));
        try { return new TextDecoder('utf-8', { fatal: true }).decode(u); } catch (e) { }
        for (const enc of ['gb18030', 'big5', 'utf-16le']) { try { return new TextDecoder(enc).decode(u); } catch (e) { } }
        return new TextDecoder('utf-8').decode(u);
    }
    function htmlToText(h) {
        try {
            const d = new DOMParser().parseFromString(h, 'text/html');
            d.querySelectorAll('script,style,noscript').forEach(n => n.remove());
            d.querySelectorAll('h1,h2,h3,h4,h5,h6').forEach(n => { n.textContent = '\n# ' + n.textContent.trim() + '\n'; });
            d.querySelectorAll('br').forEach(n => n.replaceWith('\n'));
            d.querySelectorAll('p,div,li,tr,section,article').forEach(n => n.appendChild(document.createTextNode('\n')));
            d.querySelectorAll('td,th').forEach(n => n.appendChild(document.createTextNode('\t')));
            return d.body.textContent.replace(/\n{3,}/g, '\n\n');
        } catch (e) { return h.replace(/<[^>]+>/g, '\n'); }
    }
    function rtfToText(r) {
        return r.replace(/\\par[d]?/g, '\n').replace(/\\'([0-9a-f]{2})/gi, (m, h) => String.fromCharCode(parseInt(h, 16))).replace(/\\u(-?\d+)\??/g, (m, n) => String.fromCharCode(n < 0 ? +n + 65536 : +n)).replace(/\{\\\*[^{}]*\}/g, '').replace(/\\[a-z]+-?\d* ?/gi, '').replace(/[{}]/g, '');
    }
    async function pngCard(buf) { // 内嵌角色数据的 png 角色卡：JSON 存在图片的 tEXt 块里
        const u = new Uint8Array(buf), dv = new DataView(buf);
        let p = 8;
        while (p + 8 <= u.length) {
            const len = dv.getUint32(p), type = String.fromCharCode(u[p + 4], u[p + 5], u[p + 6], u[p + 7]);
            if (type === 'tEXt' || type === 'iTXt') {
                const data = u.subarray(p + 8, p + 8 + len), z = data.indexOf(0), key = String.fromCharCode.apply(null, data.subarray(0, z));
                if (key === 'chara' || key === 'ccv3') {
                    let s = type === 'tEXt' ? new TextDecoder('latin1').decode(data.subarray(z + 1)) : new TextDecoder().decode(data.subarray(z + 1)).replace(/^[\s\S]*?(?=[A-Za-z0-9+/=]{20,}$)/, '');
                    const bin = atob(s.trim()), b = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) b[i] = bin.charCodeAt(i);
                    return new TextDecoder('utf-8').decode(b);
                }
            }
            if (type === 'IEND') break; p += 12 + len;
        }
        throw new Error('这张图片里没有角色卡数据');
    }
    async function readAny(file) {
        const name = (file.name || '').toLowerCase();
        if (name.endsWith('.docx') || name.endsWith('.dotx')) return await extractDocxText(file);
        const buf = await file.arrayBuffer();
        if (name.endsWith('.png') || (new Uint8Array(buf.slice(0, 4))[1] === 0x50 && new Uint8Array(buf.slice(0, 4))[2] === 0x4e)) return await pngCard(buf);
        if (name.endsWith('.pdf')) throw new Error('暂时读不了 PDF，请打开 PDF 全选复制文字，粘贴到下面的框里');
        if (name.endsWith('.doc')) throw new Error('旧版 .doc 读不了，请在 Word 里另存为 .docx 或 .txt');
        let t = decodeBuf(buf);
        if (/\.html?$/.test(name) || /^\s*<(!doctype|html)/i.test(t)) t = htmlToText(t);
        else if (name.endsWith('.rtf') || /^\{\\rtf/.test(t)) t = rtfToText(t);
        const bad = (t.match(/[\u0000-\u0008�]/g) || []).length;
        if (t.length && bad / t.length > 0.05) throw new Error('这个文件不是文字文件，读不出内容');
        return t;
    }

    // ---------- JSON → 分项 ----------
    const PRIM = (v) => v == null || typeof v !== 'object';
    function objLines(o, d) {
        d = d || 0; const out = [];
        Object.keys(o).forEach(k => {
            if (SKIP[k.toLowerCase()]) return; const v = o[k];
            if (v == null || v === '' || v === false) return;
            if (PRIM(v)) out.push(zh(k) + '：' + clean(v));
            else if (Array.isArray(v)) { const a = v.map(x => PRIM(x) ? clean(x) : objLines(x, d + 1).replace(/\n/g, '；')).filter(Boolean); if (a.length) out.push(zh(k) + '：' + a.join(a.every(x => x.length < 16) ? '、' : '；')); }
            else { const s = objLines(v, d + 1).replace(/\n/g, '；'); if (s) out.push(zh(k) + '：' + s); }
        });
        return out.join('\n');
    }
    function walk(key, val, group, depth, out) {
        if (val == null || val === '' || val === false || (typeof val === 'number' && key.toLowerCase().indexOf('age') < 0 && val === 0)) return;
        if (SKIP[String(key).toLowerCase()]) return;
        if (PRIM(val)) {
            const s = clean(val); if (!s) return;
            if (s.length > 500) { const sub = splitText(s); if (sub.length >= 3 && sub.some(x => x.explicit)) { sub.forEach(x => out.push({ g: zh(key), t: x.t, v: x.v })); return; } }
            out.push({ g: group, t: zh(key), v: s }); return;
        }
        if (Array.isArray(val)) {
            if (!val.length) return;
            if (val.every(PRIM)) { const a = val.map(clean).filter(Boolean); if (a.length) out.push({ g: group, t: zh(key), v: a.join(a.every(x => x.length < 16) ? '、' : '\n') }); return; }
            val.forEach((el, i) => {
                if (PRIM(el)) { out.push({ g: zh(key), t: zh(key) + (i + 1), v: clean(el) }); return; }
                const ttl = el.name || el.title || el.comment || el.key || (Array.isArray(el.keys) ? el.keys.join('、') : el.keys) || (zh(key) + (i + 1));
                const body = el.content != null ? clean(el.content) : el.text != null ? clean(el.text) : objLines(el);
                if (body) out.push({ g: zh(key), t: clean(ttl).slice(0, 24), v: body });
            }); return;
        }
        const keys = Object.keys(val).filter(k => !SKIP[k.toLowerCase()] && val[k] != null && val[k] !== '');
        if (depth >= 2) { const s = objLines(val); if (s) out.push({ g: group, t: zh(key), v: s }); return; }
        keys.forEach(k => walk(k, val[k], zh(key), depth + 1, out));
    }
    function jsonSections(obj) {
        if (Array.isArray(obj) && obj.length === 1) obj = obj[0];
        if (obj && obj.spec && obj.data && typeof obj.data === 'object') obj = obj.data;
        else if (obj && obj.data && typeof obj.data === 'object' && !Array.isArray(obj.data) && Object.keys(obj).length <= 3) obj = obj.data;
        const out = [];
        if (Array.isArray(obj)) walk('设定', obj, '', 1, out);
        else Object.keys(obj).forEach(k => walk(k, obj[k], '', 0, out));
        return out;
    }
    function repairJson(t) {
        t = t.replace(/^﻿/, '').replace(/```(?:json)?/gi, '').trim();
        const a = t.indexOf('{'), b = t.lastIndexOf('}'); if (a >= 0 && b > a) t = t.slice(a, b + 1);
        const tries = [t, t.replace(/[“”]/g, '"').replace(/,(\s*[}\]])/g, '$1'), t.replace(/[“”]/g, '"').replace(/,(\s*[}\]])/g, '$1').replace(/\/\/[^\n]*\n/g, '\n')];
        for (const s of tries) { try { const j = JSON.parse(s); if (j && typeof j === 'object') return j; } catch (e) { } }
        // 被截断的 JSON：补全括号再试
        let s = tries[1], stack = [], inS = false, esc2 = false;
        for (const ch of s) { if (inS) { if (esc2) esc2 = false; else if (ch === '\\') esc2 = true; else if (ch === '"') inS = false; } else if (ch === '"') inS = true; else if (ch === '{' || ch === '[') stack.push(ch); else if (ch === '}' || ch === ']') stack.pop(); }
        if (stack.length) { s = (inS ? s + '"' : s).replace(/,\s*$/, '') + stack.reverse().map(c => c === '{' ? '}' : ']').join(''); try { const j = JSON.parse(s); if (j && typeof j === 'object') return j; } catch (e) { } }
        return null;
    }
    function jsonishToText(t) { // 实在解析不了的 JSON：一行一行当文字读
        return t.replace(/\r/g, '').split('\n').map(l => {
            let m = /^\s*"([^"]+)"\s*:\s*[{[]\s*$/.exec(l); if (m) return '【' + zh(m[1]) + '】';
            m = /^\s*"([^"]+)"\s*:\s*"([\s\S]*?)"\s*,?\s*$/.exec(l); if (m) return zh(m[1]) + '：' + m[2].replace(/\\n/g, '\n').replace(/\\"/g, '"');
            m = /^\s*"([^"]+)"\s*:\s*(.+?),?\s*$/.exec(l); if (m) return zh(m[1]) + '：' + m[2];
            if (/^\s*[\]}[{],?\s*$/.test(l)) return null;
            m = /^\s*"([\s\S]*)"\s*,?\s*$/.exec(l); if (m) return m[1];
            return l;
        }).filter(x => x != null).join('\n');
    }


    // ---------- XML 标签格式（<character><basic_information><name>…</name>…）→ 分项 ----------
    function xmlTree(text) {
        const root = { tag: '', kids: [] }, stack = [root], re = /<(\/?)([A-Za-z_一-龥][\w:.\-一-龥]*)((?:\s[^<>]*)?)(\/?)>/g;
        let last = 0, m;
        const addText = (t) => { if (t.trim()) stack[stack.length - 1].kids.push({ text: t }); };
        while ((m = re.exec(text))) {
            addText(text.slice(last, m.index)); last = re.lastIndex;
            if (m[1]) { for (let i = stack.length - 1; i > 0; i--) if (stack[i].tag === m[2]) { stack.length = i; break; } }
            else if (m[4]) stack[stack.length - 1].kids.push({ tag: m[2], kids: [] });
            else { const n = { tag: m[2], kids: [] }; stack[stack.length - 1].kids.push(n); stack.push(n); }
        }
        addText(text.slice(last));
        return root;
    }
    function xmlFlat(node, path, out) {
        const els = node.kids.filter(k => k.tag), txt = node.kids.filter(k => !k.tag).map(k => k.text.trim()).filter(Boolean).join('\n');
        if (txt && path.length) out.push({ g: path.slice(0, -1).join(' · '), t: path[path.length - 1], v: txt, leafText: true });
        else if (txt) out.push({ g: '', t: '说明', v: txt });
        els.forEach(ch => {
            const hasEl = ch.kids.some(k => k.tag), name = zh(ch.tag);
            if (!hasEl) { const v = ch.kids.map(k => k.text.trim()).filter(Boolean).join('\n'); if (v) out.push({ g: path.join(' · '), t: name, v: v }); }
            else {
                const own = ch.kids.filter(k => !k.tag).map(k => k.text.trim()).filter(Boolean).join('\n');
                const np = path.concat(name);
                if (own) out.push({ g: np.join(' · '), t: '概述', v: own });
                const sub = { tag: ch.tag, kids: ch.kids.filter(k => k.tag) };
                xmlFlat(sub, np, out);
            }
        });
    }
    function xmlSections(text) {
        const root = xmlTree(text); let top = root;
        // 最外层只有一个包装标签（<character>…</character>）：拆开包装，里面的才是分组
        while (true) {
            const els = top.kids.filter(k => k.tag), txts = top.kids.filter(k => !k.tag && k.text.trim());
            if (els.length === 1 && els[0].kids.some(k => k.tag) && txts.every(t => t.text.trim().length < 60)) top = els[0]; else break;
        }
        const out = []; xmlFlat(top, [], out);
        return out.map(x => ({ g: x.g, t: x.t, v: x.v }));
    }
    function looksXml(t) {
        const tags = {}; let n = 0; t.replace(/<([A-Za-z_][\w:.\-]*)(?:\s[^<>]*)?>/g, (m, g) => { if (!tags[g]) { tags[g] = 1; n++; } return m; });
        return n >= 3 && /<\/[A-Za-z_][\w:.\-]*>/.test(t);
    }

    // ---------- 文字 → 分项 ----------
    const VOCAB = /^(基本信息|基础信息|基本资料|角色信息|人物信息|人设|设定|外貌|外形|外表|性格|性格特点|背景|背景故事|经历|喜好|爱好|说话方式|说话风格|语言风格|关系|人物关系|与我的关系|剧情|世界观|开场白|对话示例|示例|规则|禁忌|注意事项|补充|备注|要求|写作要求|相处模式|称呼|生活习惯|日常|能力|技能)$/;
    function headingOf(l) {
        let m;
        if (l.length > 44) return null;
        if ((m = /^#{1,6}\s*(.+?)\s*#*$/.exec(l))) return { t: m[1].replace(/\*+/g, ''), rest: '' };
        if ((m = /^【([^】]{1,24})】\s*[:：]?\s*(.*)$/.exec(l))) return { t: m[1], rest: m[2] };
        if ((m = /^\[([^\]]{1,20})\]\s*$/.exec(l)) && !/^\d+$/.test(m[1])) return { t: m[1], rest: '' };
        if ((m = /^《([^》]{1,24})》\s*$/.exec(l))) return { t: m[1], rest: '' };
        if ((m = /^<([A-Za-z_一-龥][\w一-龥 -]{0,22})>\s*$/.exec(l))) return { t: m[1], rest: '' };
        if ((m = /^\*\*([^*]{1,24})\*\*\s*[:：]?\s*$/.exec(l))) return { t: m[1], rest: '' };
        if ((m = /^[一二三四五六七八九十]{1,3}[、.．]\s*([^，。！？,.!?：:]{1,20})$/.exec(l))) return { t: m[1], rest: '' };
        if ((m = /^第[一二三四五六七八九十\d]{1,3}[部分章节项条]\s*[:：、.]?\s*(.{0,20})$/.exec(l))) return { t: l.replace(/[:：、.]\s*$/, ''), rest: '' };
        if ((m = /^[(（]?[\d]{1,2}[)）]?[、.．]\s*([^，。！？,.!?：:\s]{2,12})\s*$/.exec(l)) && !/[：:]/.test(l)) return { t: m[1], rest: '' };
        if ((m = /^[•·\-*]?\s*([^\s：:，。,.！？!?、•·\-*][^：:，。,.！？!?、]{0,13})[：:]\s*$/.exec(l))) return { t: m[1].trim(), rest: '' };
        return null;
    }
    const KV = /^[\s•·\-*+>]*([^\s:：，。！？!?、•·][^:：，。！？!?]{0,9}?)\s*[:：\t]\s*(\S[\s\S]*)$/;
    function expandKV(sec) {
        const lines = sec.v.split('\n').filter(x => x.trim()); if (lines.length < 2) return null;
        let hit = 0; lines.forEach(l => { if (KV.test(l) && l.trim().length < 400) hit++; });
        if (hit < 2 || hit / lines.length < 0.5) return null;
        const items = []; let lead = [];
        lines.forEach(l => {
            const m = KV.exec(l);
            if (m && l.trim().length < 400) items.push({ g: sec.t, t: m[1].trim(), v: m[2].trim() });
            else if (items.length) items[items.length - 1].v += '\n' + l.trim(); else lead.push(l.trim());
        });
        if (lead.length) items.unshift({ g: sec.t, t: '概述', v: lead.join('\n') });
        return items;
    }
    function splitText(text) {
        text = String(text).replace(/\r/g, '').replace(/^﻿/, '').replace(/ /g, ' ');
        const lines = text.split('\n'), secs = []; let cur = { t: '', v: [], explicit: false }, explicitN = 0;
        const flush = () => { const v = cur.v.join('\n').trim(); if (v || cur.t) secs.push({ t: cur.t, v: v, explicit: cur.explicit }); };
        lines.forEach(raw => {
            const l = raw.trim();
            if (/^[-=_*~─—·.]{3,}$/.test(l)) { flush(); cur = { t: '', v: [], explicit: false }; return; }
            if (/^<\/[^>]+>\s*$/.test(l)) return;
            const h = headingOf(l);
            if (h && h.t.trim()) { flush(); cur = { t: h.t.trim(), v: h.rest ? [h.rest] : [], explicit: true }; explicitN++; }
            else cur.v.push(raw);
        });
        flush();
        let out = secs.filter(s => s.v || s.t);
        if (explicitN < 2) { // 没有明显标题：再按「单独一行的短标题」试一次
            const L2 = [], re = (l) => { const s = l.trim(); return s && s.length <= 10 && !/[，。！？,.!?：:、；;“"（(]/.test(s) && (VOCAB.test(s)); };
            let n = 0; lines.forEach(l => { if (re(l)) n++; });
            if (n >= 1) {
                const o2 = []; let c = { t: '', v: [], explicit: false };
                const fl = () => { const v = c.v.join('\n').trim(); if (v || c.t) o2.push({ t: c.t, v: v, explicit: c.explicit }); };
                lines.forEach(l => { if (re(l)) { fl(); c = { t: l.trim(), v: [], explicit: true }; } else c.v.push(l); }); fl();
                out = o2.filter(s => s.v || s.t);
            }
        }
        if (out.length && !out[0].t) out[0].t = out.length > 1 ? '概述' : '';
        const res = [];
        out.forEach(s => {
            const kv = expandKV({ t: s.t || '设定', v: s.v });
            if (kv) kv.forEach(x => res.push({ g: x.g, t: x.t, v: x.v, explicit: true }));
            else res.push({ g: '', t: s.t, v: s.v, explicit: s.explicit });
        });
        // 完全没有结构：整份当一项（太长就按空行拆开，方便修改）
        if (res.length === 1 && !res[0].t) {
            const body = res[0].v;
            if (body.length > 2400) {
                const paras = body.split(/\n\s*\n/); const chunks = []; let c = '';
                paras.forEach(p => { if ((c + '\n\n' + p).length > 1400 && c) { chunks.push(c); c = p; } else c = c ? c + '\n\n' + p : p; }); if (c) chunks.push(c);
                return chunks.map((c, i) => ({ g: '', t: '设定 ' + (i + 1), v: c.trim(), explicit: false }));
            }
            res[0].t = '人设设定';
        }
        res.forEach(s => { if (!s.t) s.t = '未命名'; });
        return res;
    }

    // ---------- 总入口：任何文本 → 分项 ----------
    function parseAny(text) {
        text = String(text || '').replace(/^﻿/, '');
        const trimmed = text.trim(); if (!trimmed) return [];
        if (looksXml(trimmed) && !/^[\s`]*\{/.test(trimmed)) { const xs = norm(xmlSections(trimmed)); if (xs.length >= 2) return xs; }
        if (/^[\s`]*[{[]/.test(trimmed) || /```json/i.test(trimmed)) {
            const j = repairJson(trimmed);
            if (j) { const s = jsonSections(j); if (s.length) return norm(s); }
            const t2 = jsonishToText(trimmed.replace(/```(?:json)?/gi, '')); const s2 = splitText(t2); if (s2.length) return norm(s2);
        }
        return norm(splitText(trimmed));
    }
    function norm(a) {
        const seen = {};
        return a.map(x => ({ g: clean(x.g), t: clean(x.t).slice(0, 30) || '未命名', v: clean(x.v) })).filter(x => x.v).map(x => { const k = x.g + '|' + x.t; if (seen[k]) { seen[k]++; x.t += seen[k]; } else seen[k] = 1; return x; });
    }
    function guessName(secs) {
        let hit = secs.find(s => /^(姓名|名字|角色名|角色名字|名称|name|昵称)$/i.test(s.t));
        let n = hit ? hit.v : '';
        if (!n) { const m = /(?:^|\n)\s*(?:姓名|名字|角色名|name)\s*[:：]\s*([^\n]{1,40})/i.exec(secs.map(s => s.v).join('\n')); if (m) n = m[1]; }
        if (!n) return '';
        n = n.split(/\n/)[0].replace(/[（(].*?[)）]/g, '').split(/\s*[\/｜|;；、,，]\s*/)[0];
        n = n.replace(/^[^：:]{1,6}[：:]\s*/, '').trim();
        return n.slice(0, 16);
    }
    function guessGender(secs) {
        const hit = secs.find(s => /^(性别|gender|sex)$/i.test(s.t)); if (!hit) return '';
        const v = hit.v; return /女/.test(v) && !/男/.test(v) ? '女生' : /男/.test(v) && !/女/.test(v) ? '男生' : '';
    }

    // ---------- 界面 ----------
    let secs = [], raw = '';
    function itemHtml(s, i) {
        return '<div class="ci-item" data-i="' + i + '"><div class="ci-top"><input class="ci-t input-text" value="' + esc(s.t) + '" placeholder="这一项叫什么"><span class="ci-ops"><button type="button" data-op="up" title="上移">↑</button><button type="button" data-op="dn" title="下移">↓</button><button type="button" data-op="del" title="删除这一项">✕</button></span></div><textarea class="ci-v input-textarea" placeholder="内容">' + esc(s.v) + '</textarea></div>';
    }
    function sync() { // 把界面上改的内容读回 secs
        const box = $('cardImportList'); if (!box) return;
        const items = box.querySelectorAll('.ci-item'), out = [];
        items.forEach(el => { const i = +el.dataset.i, old = secs[i] || { g: '' }; out.push({ g: old.g || '', t: el.querySelector('.ci-t').value.trim(), v: el.querySelector('.ci-v').value.trim() }); });
        if (items.length) secs = out;
    }
    function draw(name) {
        const box = $('cardImportList'); if (!box) return;
        if (!secs.length) { box.innerHTML = ''; return; }
        const nm = name != null ? name : (($('ciName') || {}).value || '');
        let h = '<p class="section-title">识别出的角色内容（共 ' + secs.length + ' 项，随便改，不要的点 ✕）</p><input id="ciName" class="input-text" placeholder="角色名字（必填，用来显示和称呼）" value="' + esc(nm) + '">', lastG = null;
        secs.forEach((s, i) => { if (s.g !== lastG) { lastG = s.g; if (s.g) h += '<p class="section-title ci-group">' + esc(s.g) + '</p>'; } h += itemHtml(s, i); });
        h += '<button type="button" id="ciAdd" class="btn-small" style="margin-top:10px">＋ 添加一项</button>';
        box.innerHTML = h;
        box.querySelectorAll('.ci-v').forEach(t => { const fit = () => { t.style.height = 'auto'; t.style.height = Math.min(Math.max(t.scrollHeight + 2, 64), 320) + 'px'; }; t.addEventListener('input', fit); setTimeout(fit, 0); });
        box.onclick = (e) => {
            const b = e.target.closest('button'); if (!b) return;
            sync();
            if (b.id === 'ciAdd') { secs.push({ g: '', t: '', v: '' }); draw(); const ts = box.querySelectorAll('.ci-t'); if (ts.length) { ts[ts.length - 1].focus(); ts[ts.length - 1].scrollIntoView({ block: 'center' }); } return; }
            const el = b.closest('.ci-item'); if (!el) return; const i = +el.dataset.i, op = b.dataset.op;
            if (op === 'del') secs.splice(i, 1);
            else if (op === 'up' && i > 0) { const t = secs[i - 1]; secs[i - 1] = secs[i]; secs[i] = t; }
            else if (op === 'dn' && i < secs.length - 1) { const t = secs[i + 1]; secs[i + 1] = secs[i]; secs[i] = t; }
            draw();
        };
    }
    function status(msg, color) { const st = $('cardImportStatus'); if (st) { st.textContent = msg; st.style.color = color || ''; } }
    function applyParsed(list, note) {
        if (!list.length) { status('文件里没读到文字内容，试试直接粘贴到下面的框里', 'red'); return; }
        secs = list; draw(guessName(list));
        status('识别出 ' + list.length + ' 项' + (note || '') + '，检查修改后点最下面「保存角色卡」', 'green');
        const t = $('cardImportText'); if (t) t.value = ''; // 内容已经分到下面各项里，输入框清空，下次进来是干净的
    }
    function reset() { secs = []; raw = ''; const t = $('cardImportText'); if (t) t.value = ''; status(''); const box = $('cardImportList'); if (box) { box.innerHTML = ''; box.onclick = null; } }

    function bind() {
        const pick = $('cardImportPickBtn'), file = $('cardImportFile'), parse = $('cardImportParseBtn'), ai = $('cardImportAiBtn');
        if (file) file.setAttribute('accept', '*/*');
        if (pick) pick.onclick = () => file && file.click();
        if (file) file.onchange = async (e) => {
            const f = e.target.files[0]; if (!f) return;
            status('正在读取「' + f.name + '」…', '#ff9800');
            try { raw = await readAny(f); applyParsed(parseAny(raw), '（来自「' + f.name + '」）'); }
            catch (err) { status('读取失败：' + (err && err.message || err), 'red'); }
            e.target.value = '';
        };
        if (parse) parse.onclick = () => {
            const t = (($('cardImportText') || {}).value || '').trim();
            if (!t && !raw) { status('请先选择文件或粘贴文本~', 'red'); return; }
            if (t) raw = t; applyParsed(parseAny(raw));
        };
        if (ai) ai.onclick = async () => {
            const src = (($('cardImportText') || {}).value || '').trim() || raw;
            if (!src) { status('请先选择文件或粘贴文本~', 'red'); return; }
            if (typeof API_KEY === 'undefined' || !API_KEY) { status('请先在设置里填 API Key', 'red'); return; }
            raw = src; status('AI 正在帮你整理分项，长文件可能要等一会儿…', '#ff9800'); ai.disabled = true;
            try {
                const out = await chatCompletion([{ role: 'system', content: '你是角色设定整理助手。把用户给的角色设定原文，按原文自己的结构划分成若干项。必须忠实原文：不改写、不删减、不添加，原话原样放进 text 里；原文有大标题的用 group 表示，没有就留空。只输出 JSON，格式：{"name":"角色名","sections":[{"group":"","title":"项目名","text":"原文内容"}]}' }, { role: 'user', content: src.slice(0, 30000) }], 0.2);
                const j = parseJSONLoose(out); if (!j || !Array.isArray(j.sections)) throw new Error('AI 返回的格式不对，再试一次');
                const list = norm(j.sections.map(x => ({ g: x.group, t: x.title, v: x.text })));
                if (!list.length) throw new Error('AI 没整理出内容');
                secs = list; draw(j.name ? String(j.name).slice(0, 16) : guessName(list)); status('AI 整理出 ' + list.length + ' 项，检查修改后保存', 'green');
            } catch (err) { status('整理失败：' + (err && err.message || err), 'red'); }
            ai.disabled = false;
        };
        // 每次打开角色卡页面：粘贴框和提示都清空（正在编辑已保存的角色时，分项由 fillCardForm 负责显示）
        const app = $('characterApp');
        if (app) new MutationObserver(() => { if (!app.classList.contains('hidden')) { const t = $('cardImportText'); if (t) t.value = ''; status(''); } }).observe(app, { attributes: true, attributeFilter: ['class'] });
    }

    window.CardImport = {
        reset: reset,
        // 打开已保存的角色：有分项就显示分项并切到导入页，没有就回到手动填写
        show: function (card) {
            reset();
            if (card && Array.isArray(card.sections) && card.sections.length) { secs = card.sections.map(x => ({ g: x.g || '', t: x.t || '', v: x.v || '' })); draw(card.Name || ''); if (window.switchCardPane) switchCardPane('import'); }
            else if (window.switchCardPane) switchCardPane('form');
        },
        collect: function () { sync(); const nm = (($('ciName') || {}).value || '').trim(); const list = secs.filter(s => s.t || s.v).map(s => ({ g: s.g || '', t: s.t || '未命名', v: s.v })); return list.length ? { sections: list, name: nm || guessName(list), gender: guessGender(list) } : null; },
        parse: parseAny, read: readAny
    };
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', bind); else bind();
})();
