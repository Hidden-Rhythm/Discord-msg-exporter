// language: JavaScript (Chrome MV3 offscreen worker)
// file: offscreen.js

const API = 'https://discord.com/api/v9';
const CDN = 'https://cdn.discordapp.com';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

let running = false;
let cancelFlag = false;
let pauseFlag = false;

const MAX_ATTACHMENT_BYTES = 500 * 1024 * 1024;
const MAX_SINGLE_ATTACHMENT = 100 * 1024 * 1024;
let totalAttachmentBytes = 0;

const referencedCache = new Map();
const userCache = new Map();
const guildIconCache = new Map();
const attachmentHashCache = new Map();
const _retryQueue = [];
let _hydrateStats = { ok: 0, directFail: 0, aroundOk: 0, finalFail: 0 };

const store = {
  get(key) { try { const v = localStorage.getItem('dx2_' + key); return v ? JSON.parse(v) : null; } catch (_) { return null; } },
  set(key, val) { try { localStorage.setItem('dx2_' + key, JSON.stringify(val)); } catch (_) {} },
  remove(key) { try { localStorage.removeItem('dx2_' + key); } catch (_) {} }
};

function send(type, data) { chrome.runtime.sendMessage(Object.assign({ to: 'popup', type }, data || {})); }
function log(msg, level) {
  const p = ({ INFO: '[+]', WARN: '[!]', ERR: '[x]', DL: '[↓]' })[level || 'INFO'] || '[·]';
  send('LOG', { line: `${p} ${new Date().toLocaleTimeString()} ${msg}` });
}
function sanitize(name, fallback = 'unnamed', max = 60) {
  if (!name) return fallback;
  let s = String(name).normalize('NFKD')
    .replace(/[\u{1F000}-\u{1FFFF}]/gu, '').replace(/[\u{1F300}-\u{1F9FF}]/gu, '')
    .replace(/[\u{FE00}-\u{FE0F}]/gu, '').replace(/[\u{2000}-\u{206F}]/gu, '')
    .replace(/[\u{2100}-\u{21FF}]/gu, '').replace(/[\u{2300}-\u{23FF}]/gu, '')
    .replace(/[\u{25A0}-\u{25FF}]/gu, '').replace(/[\u{2600}-\u{27BF}]/gu, '')
    .replace(/[^\x20-\x7E]/g, '').replace(/[<>:"/\\|?*\x00-\x1f]/g, ' ')
    .replace(/[._]+/g, '-').replace(/[\s-]+/g, '-').replace(/^-+|-+$/g, '').trim();
  if (!s) return fallback;
  return s.slice(0, max).replace(/-+$/g, '') || fallback;
}
function pad(n) { return String(n).padStart(2, '0'); }
const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
function fullTime(iso) { const d = new Date(iso); return `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`; }
function timeOnly(iso) { const d = new Date(iso); return `${pad(d.getHours())}:${pad(d.getMinutes())}`; }
function dayHeader(iso) { const d = new Date(iso); return `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`; }
function dayKey(iso) { const d = new Date(iso); return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`; }
function fmtBytes(n) { if (!n) return ''; if (n < 1024) return `${n} B`; if (n < 1024*1024) return `${(n/1024).toFixed(1)} KB`; return `${(n/1024/1024).toFixed(1)} MB`; }
function fmtDuration(s) { if (!s) return '0:00'; const m = Math.floor(s/60); const sec = Math.floor(s%60); return `${m}:${pad(sec)}`; }

function authorName(a, fallbackId) {
  if (!a) return fallbackId ? `user-${fallbackId.slice(-6)}` : 'unknown';
  return a.global_name || a.display_name || a.username || (fallbackId ? `user-${fallbackId.slice(-6)}` : 'unknown');
}
function authorTag(a) {
  if (!a) return '';
  return (a.discriminator && a.discriminator !== '0') ? `#${a.discriminator}` : '';
}
function avatarExt(hash) { return hash && hash.startsWith('a_') ? 'gif' : 'png'; }
function avatarCdnUrl(userId, hash, size) {
  if (!hash || !userId) return null;
  return `${CDN}/avatars/${userId}/${hash}.${avatarExt(hash)}?size=${size || 64}`;
}

const IMG_EXT = ['png','jpg','jpeg','gif','webp','bmp','svg','avif','heic','heif','tiff'];
const VID_EXT = ['mp4','webm','mov','mkv','avi','m4v','wmv','flv'];
const AUD_EXT = ['mp3','ogg','wav','flac','m4a','aac','opus','weba'];

function extOf(name) {
  if (!name || !name.includes('.')) return '';
  return name.slice(name.lastIndexOf('.') + 1).toLowerCase();
}
function attachmentKind(a) {
  const ct = (a.content_type || '').toLowerCase();
  const ext = extOf(a.filename || '');
  const isVoice = !!(a.waveform && a.duration_secs);
  if (isVoice) return 'voice';
  if (ct.startsWith('image/')) return 'image';
  if (ct.startsWith('video/')) return 'video';
  if (ct.startsWith('audio/')) return 'audio';
  if (!ct) {
    if (IMG_EXT.includes(ext)) return 'image';
    if (VID_EXT.includes(ext)) return 'video';
    if (AUD_EXT.includes(ext)) return 'audio';
  }
  return 'file';
}
function mimeFor(kind, ext) {
  if (kind === 'video') return `video/${ext === 'mov' ? 'quicktime' : ext === 'mkv' ? 'x-matroska' : ext}`;
  if (kind === 'audio') return `audio/${ext === 'opus' ? 'ogg' : ext === 'weba' ? 'webm' : ext}`;
  if (kind === 'image') return `image/${ext === 'jpg' ? 'jpeg' : ext}`;
  return '';
}
function contentTypeIcon(ct, filename) {
  const ext = extOf(filename);
  if (ct) {
    if (ct.startsWith('image/')) return '🖼';
    if (ct.startsWith('video/')) return '🎬';
    if (ct.startsWith('audio/')) return '🎵';
    if (ct.includes('pdf')) return '📄';
    if (ct.includes('zip') || ct.includes('tar') || ct.includes('rar') || ct.includes('7z')) return '🗜';
    if (ct.includes('text/')) return '📝';
    if (ct.includes('json') || ct.includes('xml')) return '📋';
  }
  if (IMG_EXT.includes(ext)) return '🖼';
  if (VID_EXT.includes(ext)) return '🎬';
  if (AUD_EXT.includes(ext)) return '🎵';
  if (ext === 'pdf') return '📄';
  if (['zip','rar','7z','tar','gz'].includes(ext)) return '🗜';
  if (['txt','md','log'].includes(ext)) return '📝';
  if (['json','xml','yaml','yml'].includes(ext)) return '📋';
  if (['doc','docx','odt'].includes(ext)) return '📘';
  if (['xls','xlsx','ods','csv'].includes(ext)) return '📊';
  if (['ppt','pptx','odp'].includes(ext)) return '📙';
  if (['exe','msi','apk','deb','rpm'].includes(ext)) return '⚙️';
  return '📎';
}
function decodeWaveform(base64, bars) {
  bars = bars || 44;
  if (!base64) return new Array(bars).fill(0.15);
  try {
    const raw = atob(base64);
    const bytes = new Uint8Array(raw.length);
    for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
    if (!bytes.length) return new Array(bars).fill(0.15);
    const out = [];
    const step = bytes.length / bars;
    for (let i = 0; i < bars; i++) {
      const start = Math.floor(i * step);
      const end = Math.min(bytes.length, Math.floor((i + 1) * step) || (start + 1));
      let max = 0;
      for (let j = start; j < end; j++) if (bytes[j] > max) max = bytes[j];
      out.push(Math.max(0.08, max / 255));
    }
    return out;
  } catch (_) {
    return new Array(bars).fill(0.15);
  }
}

async function sha256Hex(buf) {
  const h = await crypto.subtle.digest('SHA-256', buf);
  return [...new Uint8Array(h)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

async function api(token, path, params, opts = {}) {
  const maxAttempts = opts.maxAttempts || 5;
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    if (cancelFlag) return { ok: false, status: 0, body: null, cancelled: true };
    while (pauseFlag) await sleep(300);
    const qs = params && Object.keys(params).length ? '?' + new URLSearchParams(params).toString() : '';
    let res;
    try {
      res = await fetch(`${API}${path}${qs}`, {
        headers: { 'Authorization': token, 'Accept': 'application/json', 'X-Discord-Locale': 'en-US' }
      });
    } catch (e) { await sleep(400 * Math.pow(2, attempt)); continue; }
    if (res.status === 429) {
      const hdr = parseFloat(res.headers.get('Retry-After'));
      const retry = Number.isFinite(hdr) ? Math.min(hdr, 15) : 1.5;
      await sleep((retry + Math.random() * 0.2) * 1000);
      continue;
    }
    if (res.status === 202) { await sleep(1200); continue; }
    if (res.status >= 500 && attempt < maxAttempts - 1) { await sleep(400 * Math.pow(2, attempt)); continue; }
    let body = null; try { body = await res.json(); } catch (_) {}
    return { ok: res.ok, status: res.status, body };
  }
  return { ok: false, status: 429, body: null };
}

async function ensureUser(token, id) {
  if (userCache.has(id)) return userCache.get(id);
  const r = await api(token, `/users/${id}`);
  const u = r.ok && r.body ? r.body : { id, username: `user-${id.slice(-6)}` };
  userCache.set(id, u);
  return u;
}

function findDmWithTarget(channels, targetId) {
  if (!Array.isArray(channels)) return null;
  return channels.find((c) => {
    if (!c || (c.type !== 1 && c.type !== 3)) return false;
    if (Array.isArray(c.recipient_ids) && c.recipient_ids.includes(targetId)) return true;
    if (Array.isArray(c.recipients) && c.recipients.some((r) => r && r.id === targetId)) return true;
    return false;
  }) || null;
}

function buildAvatarNamer() {
  const byUser = new Map();
  const usedNames = new Map();
  return function nameFor(user) {
    if (!user || !user.id) return null;
    if (byUser.has(user.id)) return byUser.get(user.id);
    const base = sanitize(authorName(user, user.id), `user-${user.id.slice(-4)}`, 40);
    const ext = avatarExt(user.avatar);
    let candidate = `${base}.${ext}`;
    if (usedNames.has(candidate) && usedNames.get(candidate) !== user.id) {
      candidate = `${base}-${user.id.slice(-4)}.${ext}`;
    }
    usedNames.set(candidate, user.id);
    byUser.set(user.id, candidate);
    return candidate;
  };
}
function buildGuildIconNamer() {
  const byGuild = new Map();
  const usedNames = new Map();
  return function nameFor(guildId, guildName, hash) {
    if (byGuild.has(guildId)) return byGuild.get(guildId);
    const base = sanitize(guildName, guildId, 40);
    const ext = hash.startsWith('a_') ? 'gif' : 'png';
    let candidate = `${base}.${ext}`;
    if (usedNames.has(candidate) && usedNames.get(candidate) !== guildId) {
      candidate = `${base}-${guildId.slice(-4)}.${ext}`;
    }
    usedNames.set(candidate, guildId);
    byGuild.set(guildId, candidate);
    return candidate;
  };
}

async function downloadAvatar(zip, user, namer, avatarMap) {
  if (!user || !user.id) return null;
  if (avatarMap.has(user.id)) return avatarMap.get(user.id);
  if (!user.avatar) { avatarMap.set(user.id, null); return null; }
  const fname = namer(user);
  const url = avatarCdnUrl(user.id, user.avatar, 64);
  try {
    const r = await fetch(url);
    if (!r.ok) { avatarMap.set(user.id, { remote: url }); return url; }
    const buf = await r.arrayBuffer();
    const zipPath = `_assets/avatars/${fname}`;
    zip.file(zipPath, buf);
    avatarMap.set(user.id, { local: zipPath });
    return zipPath;
  } catch (_) {
    avatarMap.set(user.id, { remote: url });
    return url;
  }
}

async function downloadGuildIcon(zip, guildId, guildName, hash, namer, iconMap) {
  if (!hash) { iconMap.set(guildId, null); return null; }
  if (iconMap.has(guildId)) return iconMap.get(guildId);
  const fname = namer(guildId, guildName, hash);
  const ext = hash.startsWith('a_') ? 'gif' : 'png';
  const url = `${CDN}/icons/${guildId}/${hash}.${ext}?size=64`;
  try {
    const r = await fetch(url);
    if (!r.ok) { iconMap.set(guildId, { remote: url }); return url; }
    const buf = await r.arrayBuffer();
    const zipPath = `_assets/icons/${fname}`;
    zip.file(zipPath, buf);
    iconMap.set(guildId, { local: zipPath });
    return zipPath;
  } catch (_) {
    iconMap.set(guildId, { remote: url });
    return url;
  }
}

async function fetchReactionUsers(token, channelId, messageId, emoji) {
  const enc = encodeURIComponent(emoji);
  const r = await api(token, `/channels/${channelId}/messages/${messageId}/reactions/${enc}`, { limit: 100 });
  if (!r.ok) return null;
  return Array.isArray(r.body) ? r.body.map((u) => authorName(u, u.id)) : null;
}

async function fetchOgPreview(url) {
  try {
    const ctrl = new AbortController();
    const to = setTimeout(() => ctrl.abort(), 5000);
    const r = await fetch(url, { method: 'GET', signal: ctrl.signal });
    clearTimeout(to);
    if (!r.ok) return null;
    const txt = await r.text();
    const og = (prop) => {
      const re = new RegExp(`<meta[^>]+property=["']og:${prop}["'][^>]+content=["']([^"']+)["']`, 'i');
      const m = txt.match(re);
      return m ? m[1] : null;
    };
    const title = og('title') || (txt.match(/<title>([^<]+)<\/title>/i) || [])[1];
    const desc = og('description');
    const image = og('image');
    if (!title && !desc) return null;
    return { title, desc, image };
  } catch (_) { return null; }
}

async function fetchParent(token, parentId, replyChannelId, refChannelId) {
  const targetCh = refChannelId || replyChannelId;
  let r = await api(token, `/channels/${targetCh}/messages/${parentId}`);
  if (r.ok && r.body) return { ok: true, body: r.body, method: 'direct' };

  const r2 = await api(token, `/channels/${targetCh}/messages`, { around: parentId, limit: 1 });
  if (r2.ok && Array.isArray(r2.body)) {
    const hit = r2.body.find((m) => m.id === parentId);
    if (hit) return { ok: true, body: hit, method: 'around-same' };
  }

  if (targetCh !== replyChannelId) {
    const r3 = await api(token, `/channels/${replyChannelId}/messages`, { around: parentId, limit: 1 });
    if (r3.ok && Array.isArray(r3.body)) {
      const hit = r3.body.find((m) => m.id === parentId);
      if (hit) return { ok: true, body: hit, method: 'around-reply' };
    }
  }

  return { ok: false, status: r.status, method: 'fail' };
}

async function hydrateReplies(token, messages, channelId) {
  const needs = messages.filter((m) => {
    if (!m.message_reference || !m.message_reference.message_id) return false;
    const r = m.referenced_message;
    if (!r) return true;
    if (!r.author) return true;
    if (!r.content && !(r.attachments && r.attachments.length)) return true;
    return false;
  });
  if (!needs.length) return;

  const uniqueIds = [...new Set(needs.map((m) => m.message_reference.message_id))];
  const pending = uniqueIds.filter((id) => {
    if (!referencedCache.has(id)) return true;
    const c = referencedCache.get(id);
    return !(c && !c._unavailable && c.author);
  });

  let idx = 0;
  const CONC = 6;
  await Promise.all(Array.from({ length: CONC }, async () => {
    while (true) {
      const i = idx++;
      if (i >= pending.length) return;
      if (cancelFlag) return;
      const id = pending[i];
      const refMsg = needs.find((m) => m.message_reference.message_id === id);
      const refCh = refMsg.message_reference.channel_id || null;
      const got = await fetchParent(token, id, channelId, refCh);
      if (got.ok && got.body) {
        referencedCache.set(id, got.body);
        _hydrateStats.ok++;
        if (got.method !== 'direct') _hydrateStats.aroundOk++;
      } else {
        _hydrateStats.directFail++;
        _hydrateStats.finalFail++;
        referencedCache.set(id, { _unavailable: true, _status: got.status });
      }
      await sleep(15);
    }
  }));

  for (const m of needs) {
    const stub = m.referenced_message;
    const ref = referencedCache.get(m.message_reference.message_id);
    if (ref && !ref._unavailable) {
      if (!ref.author && stub && stub.author) ref.author = stub.author;
      if (!ref.content && stub && stub.content) ref.content = stub.content;
      if (!ref.attachments && stub && stub.attachments) ref.attachments = stub.attachments;
      if (!ref.timestamp && stub && stub.timestamp) ref.timestamp = stub.timestamp;
      m.referenced_message = ref;
    } else if (stub && (stub.author || stub.content)) {
      m.referenced_message = stub;
    } else if (stub) {
      m.referenced_message = stub;
      m._refNoData = true;
    } else {
      m._refUnavailable = true;
    }
  }
}

async function doScan(token, targetId) {
  const me = await api(token, '/users/@me');
  if (!me.ok) throw new Error(`auth failed — HTTP ${me.status}`);
  log(`authed as ${me.body.username}`, 'INFO');
  const target = await ensureUser(token, targetId);
  const targetName = authorName(target, targetId);
  log(`target: ${targetName}`, 'INFO');
  send('PROGRESS', { percent: 5, label: 'DM check' });

  let dm = null;
  const dmList = await api(token, '/users/@me/channels');
  if (dmList.ok && Array.isArray(dmList.body)) {
    const hit = findDmWithTarget(dmList.body, targetId);
    if (hit) { dm = { id: hit.id, name: `DM with ${targetName}` }; log(`DM found`, 'INFO'); }
  }

  const guildsRes = await api(token, '/users/@me/guilds');
  if (!guildsRes.ok) throw new Error(`guild list HTTP ${guildsRes.status}`);
  const list = guildsRes.body || [];
  log(`${list.length} servers — 12-wide scan`, 'INFO');

  const mutual = []; let done = 0; const total = list.length;
  await Promise.all(Array.from({ length: 12 }, async () => {
    while (true) {
      const i = done++;
      if (i >= total) return;
      if (cancelFlag) return;
      const g = list[i];
      const sr = await api(token, `/guilds/${g.id}/messages/search`, { author_id: targetId, limit: 1 });
      if (sr.ok) {
        const count = (sr.body && sr.body.total_results) || 0;
        if (count > 0) { mutual.push({ id: g.id, name: g.name, count }); log(`  ${g.name}: ${count}`, 'INFO'); }
      }
      send('PROGRESS', { percent: 5 + (done / total) * 95, label: `${done}/${total}` });
      await sleep(60);
    }
  }));
  mutual.sort((a, b) => b.count - a.count);
  send('SCAN_RESULT', { data: { dm, guilds: mutual, targetName } });
}

async function listChannels(token, guildIds) {
  const out = {};
  await Promise.all(guildIds.map(async (gid) => {
    const r = await api(token, `/guilds/${gid}/channels`);
    if (!r.ok) { out[gid] = []; return; }
    const text = (r.body || []).filter((c) => c.type === 0 || c.type === 5 || c.type === 15);
    out[gid] = text.map((c) => ({ id: c.id, name: c.name, type: c.type, parentName: c.parent_id }));
  }));
  return out;
}

async function fetchGuildBySearch(token, guildId, targetId, onProgress) {
  const byChannel = new Map();
  const PAGE = 25, CAP = 5000;
  let offset = 0, total = null, pages = 0;
  while (offset < CAP) {
    if (cancelFlag) break;
    while (pauseFlag) await sleep(300);
    const r = await api(token, `/guilds/${guildId}/messages/search`, {
      author_id: targetId, offset, limit: PAGE, sort_by: 'timestamp', sort_order: 'asc', include_nsfw: 'true'
    });
    if (!r.ok) return { byChannel, total: total || 0, failed: r.status };
    const groups = (r.body && r.body.messages) || [];
    if (total === null) total = (r.body && r.body.total_results) || 0;
    if (!groups.length) break;
    for (const g of groups) {
      const m = Array.isArray(g) ? g[0] : g;
      if (!m || !m.author || m.author.id !== targetId) continue;
      const cid = m.channel_id;
      if (!byChannel.has(cid)) byChannel.set(cid, []);
      byChannel.get(cid).push(m);
    }
    pages++; offset += PAGE;
    if (onProgress && pages % 4 === 0) onProgress(`page ${pages} · ${offset}/${Math.min(total, CAP)}`);
    if (offset >= total) break;
    await sleep(400 + Math.random() * 150);
  }
  return { byChannel, total, done: true };
}

async function fetchChannelByWalk(token, channelId, targetId, sinceId) {
  const out = []; let before = null, pages = 0;
  while (pages < 10000) {
    if (cancelFlag) break;
    while (pauseFlag) await sleep(300);
    const q = { limit: 100 };
    if (before) q.before = before;
    const r = await api(token, `/channels/${channelId}/messages`, q);
    if (!r.ok) return out;
    const batch = r.body || [];
    if (!batch.length) break;
    let stop = false;
    for (const m of batch) {
      if (sinceId && m.id <= sinceId) { stop = true; break; }
      if (m.author && m.author.id === targetId) out.push(m);
    }
    if (stop) break;
    before = batch[batch.length - 1].id;
    pages++;
    if (batch.length < 100) break;
    await sleep(20);
  }
  return out;
}

async function listActiveThreads(token, channelId) {
  const r = await api(token, `/channels/${channelId}/threads/active`);
  if (!r.ok) return [];
  return (r.body && r.body.threads) || [];
}

function compileRegexes(f) {
  const out = {};
  if (f.keyword) { try { out.keyword = new RegExp(f.keyword, 'i'); } catch (_) {} }
  if (f.chanWhite) { try { out.chanWhite = new RegExp(f.chanWhite, 'i'); } catch (_) {} }
  if (f.chanBlack) { try { out.chanBlack = new RegExp(f.chanBlack, 'i'); } catch (_) {} }
  return out;
}
function channelAllowed(chName, re) {
  if (re.chanWhite && !re.chanWhite.test(chName)) return false;
  if (re.chanBlack && re.chanBlack.test(chName)) return false;
  return true;
}
function applyFilters(messages, f, re) {
  if (!f) return messages;
  const fromTs = f.dateFrom ? new Date(f.dateFrom).getTime() : null;
  const toTs = f.dateTo ? new Date(f.dateTo).getTime() + 86400000 : null;
  return messages.filter((m) => {
    const t = new Date(m.timestamp).getTime();
    if (fromTs && t < fromTs) return false;
    if (toTs && t > toTs) return false;
    if (f.minLen && (m.content || '').length < f.minLen) return false;
    if (f.attachOnly && !(m.attachments && m.attachments.length)) return false;
    if (f.replyOnly && !m.message_reference) return false;
    if (re.keyword && !re.keyword.test(m.content || '')) return false;
    return true;
  });
}

// ─── TXT FORMATTER ──────────────────────────────────────────────
function formatMessageText(m, grouped, prevDay) {
  const lines = [];
  const name = authorName(m.author, m.author && m.author.id);
  const tag = authorTag(m.author);
  const dk = dayKey(m.timestamp);
  if (prevDay && prevDay !== dk) {
    lines.push('');
    lines.push(`──────────  ${dayHeader(m.timestamp)}  ──────────`);
    lines.push('');
  }
  if (!grouped) {
    const edited = m.edited_timestamp ? '   (edited)' : '';
    lines.push('');
    lines.push(`${name}${tag}   ${fullTime(m.timestamp)}${edited}`);
  }
  if (m.referenced_message || m._refUnavailable) {
    const ref = m.referenced_message;
    if (ref && (ref.author || ref.content || (ref.attachments && ref.attachments.length))) {
      const rn = authorName(ref.author, ref.author && ref.author.id);
      const rt = authorTag(ref.author);
      const rtime = ref.timestamp ? timeOnly(ref.timestamp) : '';
      lines.push(`  ╭─ ${rn}${rt}${rtime ? '   ' + rtime : ''}`);
      const rc = (ref.content || '').replace(/\r\n/g, '\n').trim();
      if (rc) {
        for (const l of rc.split('\n')) lines.push(`  │ ${l}`);
      } else if (ref.attachments && ref.attachments.length) {
        lines.push(`  │ 📎 ${ref.attachments[0].filename}`);
      } else {
        lines.push(`  │ (no text content)`);
      }
      lines.push(`  ╰─`);
    } else {
      lines.push(`  ╭─ (original message unavailable)`);
      lines.push(`  ╰─`);
    }
  }
  if (m.content) {
    for (const l of m.content.replace(/\r\n/g, '\n').split('\n')) lines.push(`  ${l}`);
  }
  if (m.message_snapshots && m.message_snapshots.length) {
    for (const sn of m.message_snapshots) {
      const inner = sn.message; if (!inner) continue;
      lines.push(`  📩 forwarded from ${authorName(inner.author, inner.author && inner.author.id)}:`);
      if (inner.content) for (const l of inner.content.split('\n')) lines.push(`     │ ${l}`);
    }
  }
  if (m.sticker_items && m.sticker_items.length) {
    for (const s of m.sticker_items) lines.push(`  🏷 sticker: ${s.name || s.id}`);
  }
  if (m.poll) {
    lines.push(`  📊 poll: ${m.poll.question && m.poll.question.text || ''}`);
    for (const a of m.poll.answers || []) {
      lines.push(`     · ${a.poll_media && a.poll_media.text || a.answer_id || '?'} — ${a.count || 0} votes`);
    }
  }
  if (m.embeds && m.embeds.length) {
    for (const e of m.embeds) {
      const head = (e.author && e.author.name) || e.title || e.url || 'embed';
      lines.push(`  ┃ 🔗 ${head}`);
      if (e.description) lines.push(`  ┃    ${e.description.replace(/\s+/g, ' ').slice(0, 200)}`);
      if (e.url && e.url !== head) lines.push(`  ┃    ${e.url}`);
    }
  }
  if (m.attachments && m.attachments.length) {
    for (const a of m.attachments) {
      const kind = attachmentKind(a);
      if (kind === 'voice') {
        lines.push(`  🎙 voice message   ${fmtDuration(a.duration_secs)}`);
      } else {
        lines.push(`  ${contentTypeIcon(a.content_type, a.filename)} ${a.filename}   ${fmtBytes(a.size)}`);
      }
      if (a.url) lines.push(`     ${a.url}`);
    }
  }
  if (m.reactions && m.reactions.length) {
    const parts = [];
    for (const r of m.reactions) {
      const emoji = (r.emoji && r.emoji.name) || '?';
      if (r._users && r._users.length) {
        parts.push(`${emoji} ${r.count} (${r._users.slice(0, 5).join(', ')}${r._users.length > 5 ? '…' : ''})`);
      } else {
        parts.push(`${emoji} ${r.count}`);
      }
    }
    lines.push('  ' + parts.join('   '));
  }
  lines.push('');
  return lines.join('\n');
}

function formatAllText(messages) {
  const out = [];
  let prev = null;
  let prevDay = null;
  for (const m of messages) {
    const sameAuthor = prev && prev.author && m.author && prev.author.id === m.author.id;
    const within5 = prev && (new Date(m.timestamp).getTime() - new Date(prev.timestamp).getTime()) < 5 * 60 * 1000;
    const hasReply = !!m.referenced_message || !!m._refUnavailable;
    const grouped = !!(sameAuthor && within5 && !hasReply);
    out.push(formatMessageText(m, grouped, prevDay));
    prev = m;
    prevDay = dayKey(m.timestamp);
  }
  return out.join('\n');
}

function buildTxtHeader(channelLabel, guildLabel, count, exportDate) {
  const bar = '═'.repeat(63);
  const l1 = ` ${channelLabel}`;
  const l2 = ` ${guildLabel ? guildLabel + '  ·  ' : ''}${count} messages  ·  ${exportDate}`;
  return `${bar}\n${l1}\n${l2}\n${bar}\n`;
}

function htmlEscape(s) { return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]); }

function renderMarkdown(s, mentionMap) {
  let h = htmlEscape(s || '');
  h = h.replace(/```([\s\S]*?)```/g, (_, c) => `<pre class="code">${c.trim()}</pre>`);
  h = h.replace(/`([^`\n]+)`/g, '<code>$1</code>');
  h = h.replace(/\|\|([\s\S]+?)\|\|/g, '<span class="spoiler">$1</span>');
  h = h.replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>');
  h = h.replace(/\*([^*]+)\*/g, '<i>$1</i>');
  h = h.replace(/__([^_]+)__/g, '<u>$1</u>');
  h = h.replace(/&lt;@!?(\d+)&gt;/g, (full, id) => {
    const name = mentionMap && mentionMap.get(id);
    return `<span class="mention">@${htmlEscape(name || 'user')}</span>`;
  });
  h = h.replace(/&lt;@&amp;(\d+)&gt;/g, '<span class="mention">@role</span>');
  h = h.replace(/&lt;#(\d+)&gt;/g, '<span class="mention">#channel</span>');
  h = h.replace(/(https?:\/\/[^\s<]+)/g, '<a href="$1" target="_blank" rel="noopener">$1</a>');
  h = h.replace(/\n/g, '<br>');
  return h;
}

function resolveAvatarSrc(entry, user, depth) {
  if (entry && entry.local) {
    const prefix = depth === 'index' ? '' : '../';
    return `${prefix}${entry.local}`;
  }
  if (entry && entry.remote) return entry.remote;
  if (user && user.id && user.avatar) return avatarCdnUrl(user.id, user.avatar, 64);
  return null;
}

function userAvatarHtml(user, avatarEntry, depth) {
  const src = resolveAvatarSrc(avatarEntry, user, depth);
  if (src) return `<img class="av" src="${htmlEscape(src)}" alt="">`;
  const initial = (authorName(user, user && user.id) || '?').slice(0, 1).toUpperCase();
  const idNum = user && user.id ? parseInt(user.id.slice(-8), 10) : 0;
  const palette = ['#5865f2','#3ba55c','#faa81a','#ed4245','#eb459e','#9b59b6','#1abc9c','#e67e22'];
  const color = palette[idNum % palette.length];
  return `<div class="av av-ph" style="background:${color}">${htmlEscape(initial)}</div>`;
}

function renderVoicePlayer(a, rel) {
  const bars = decodeWaveform(a.waveform, 44);
  const barHtml = bars.map((v) => {
    const h = Math.max(6, Math.round(v * 100));
    const faded = v < 0.25 ? ' faded' : '';
    return `<span class="vw-bar${faded}" style="height:${h}%"></span>`;
  }).join('');
  return `<div class="voice-player">
    <button class="vp-play" data-src="${htmlEscape(rel)}" aria-label="play">
      <svg viewBox="0 0 24 24" width="16" height="16"><path fill="currentColor" d="M8 5v14l11-7z"/></svg>
    </button>
    <div class="vp-wave">${barHtml}</div>
    <span class="vp-time">${fmtDuration(a.duration_secs)}</span>
    <audio class="vp-audio" src="${htmlEscape(rel)}" preload="metadata"></audio>
  </div>`;
}

function renderImage(a, rel) {
  const w = a.width || null;
  const h = a.height || null;
  const dimAttr = (w && h) ? ` width="${w}" height="${h}"` : '';
  return `<div class="att-image">
    <a href="${htmlEscape(rel)}" target="_blank"><img class="att-img" src="${htmlEscape(rel)}"${dimAttr} loading="lazy" alt="${htmlEscape(a.filename)}"></a>
    <a class="att-link" href="${htmlEscape(rel)}" target="_blank">${htmlEscape(a.filename)} <span class="size">${fmtBytes(a.size)}</span></a>
  </div>`;
}

function renderVideo(a, rel) {
  const ext = extOf(a.filename);
  const mime = mimeFor('video', ext);
  return `<div class="att-video-wrap">
    <video class="att-video" controls preload="metadata">
      <source src="${htmlEscape(rel)}" type="${htmlEscape(mime)}">
      your browser can't play this video
    </video>
    <a class="att-link" href="${htmlEscape(rel)}" target="_blank">🎬 ${htmlEscape(a.filename)} <span class="size">${fmtBytes(a.size)}</span></a>
  </div>`;
}

function renderAudio(a, rel) {
  const ext = extOf(a.filename);
  const mime = mimeFor('audio', ext);
  return `<div class="att-audio">
    <audio controls preload="metadata"><source src="${htmlEscape(rel)}" type="${htmlEscape(mime)}"></audio>
    <a class="att-link" href="${htmlEscape(rel)}" target="_blank">🎵 ${htmlEscape(a.filename)} <span class="size">${fmtBytes(a.size)}</span></a>
  </div>`;
}

function renderFile(a, rel) {
  const icon = contentTypeIcon(a.content_type, a.filename);
  return `<div class="att-file"><a class="att-link" href="${htmlEscape(rel)}" target="_blank">${icon} ${htmlEscape(a.filename)} <span class="size">${fmtBytes(a.size)}</span></a></div>`;
}

function renderAttachments(attachments, mediaMap, depth) {
  const prefix = depth === 'index' ? '' : '../';
  const out = [];
  for (const a of attachments || []) {
    const entry = mediaMap.get(a.id);
    const rel = entry ? `${prefix}${entry}` : a.url;
    const kind = attachmentKind(a);
    if (kind === 'voice') out.push(renderVoicePlayer(a, rel));
    else if (kind === 'image') out.push(renderImage(a, rel));
    else if (kind === 'video') out.push(renderVideo(a, rel));
    else if (kind === 'audio') out.push(renderAudio(a, rel));
    else out.push(renderFile(a, rel));
  }
  return out.join('');
}

function renderEmbeds(embeds, depth) {
  const out = [];
  for (const e of embeds || []) {
    const t = e.type;
    const provider = (e.provider?.name || '').toLowerCase();
    if (t === 'gifv' || t === 'image') {
      const thumb = e.thumbnail?.url || e.image?.url || e.url;
      out.push(`<div class="embed gif"><a href="${htmlEscape(e.url || '#')}" target="_blank"><img src="${htmlEscape(thumb)}" loading="lazy"></a>${e.provider?.name ? `<div class="eprov">${htmlEscape(e.provider.name)}</div>` : ''}</div>`);
    } else if (t === 'video' && (provider === 'youtube' || provider === 'spotify')) {
      const thumb = e.thumbnail?.url || '';
      out.push(`<div class="embed vid"><a href="${htmlEscape(e.url || '#')}" target="_blank">${thumb ? `<img src="${htmlEscape(thumb)}" loading="lazy">` : ''}<div class="etitle">${htmlEscape(e.title || e.author?.name || 'video')}</div></a></div>`);
    } else if (t === 'rich' && e.url) {
      const head = e.author?.name || e.title || e.url;
      out.push(`<div class="embed rich"><a href="${htmlEscape(e.url)}" target="_blank">${htmlEscape(head)}</a>${e.description ? `<div class="edesc">${htmlEscape(e.description.slice(0, 240))}</div>` : ''}${e.image?.url ? `<img class="eimg" src="${htmlEscape(e.image.url)}" loading="lazy">` : ''}</div>`);
    }
  }
  return out.join('');
}

function buildMentionMap(message) {
  const map = new Map();
  if (message.mentions) for (const u of message.mentions) {
    if (u && u.id) map.set(u.id, authorName(u, u.id));
  }
  return map;
}

function renderReplyContext(parent, opts, depth) {
  if (!parent) return '';
  const pAuthor = parent.author;
  const pAv = pAuthor && pAuthor.id ? (opts.avatarMap.get(pAuthor.id) || null) : null;
  const pName = pAuthor ? authorName(pAuthor, pAuthor.id) : '(unknown user)';
  const pTime = parent.timestamp ? timeOnly(parent.timestamp) : '';
  const pMentionMap = buildMentionMap(parent);
  const pBody = parent.content ? `<div class="rbody">${renderMarkdown(parent.content, pMentionMap)}</div>` : '';
  const pAtts = renderAttachments(parent.attachments, opts.mediaMap, depth);
  const pEmbeds = renderEmbeds(parent.embeds, depth);
  return `<div class="reply-context">
    <div class="reply-parent">
      <div class="rp-msg-row">
        ${userAvatarHtml(pAuthor, pAv, depth)}
        <div class="rp-content">
          <div class="rp-head"><span class="rp-name">${htmlEscape(pName)}</span><span class="rp-time">${pTime}</span></div>
          ${pBody}${pAtts}${pEmbeds}
        </div>
      </div>
    </div>
  </div>`;
}

function renderOneMessage(m, grouped, opts, prevDay, depth) {
  const out = [];
  const dk = dayKey(m.timestamp);
  if (prevDay && prevDay !== dk) {
    out.push(`<div class="day-divider"><span>${htmlEscape(dayHeader(m.timestamp))}</span></div>`);
  }

  const hasReply = !!(m.referenced_message || m._refUnavailable);
  const avEntry = m.author && m.author.id ? (opts.avatarMap.get(m.author.id) || null) : null;
  const av = userAvatarHtml(m.author, avEntry, depth);
  const name = authorName(m.author, m.author?.id);
  const time = fullTime(m.timestamp);
  const edited = m.edited_timestamp ? '<span class="edited">(edited)</span>' : '';
  const mentionMap = buildMentionMap(m);

  let replyBlock = '';
  if (m.referenced_message) {
    replyBlock = renderReplyContext(m.referenced_message, opts, depth);
  } else if (m._refUnavailable) {
    replyBlock = `<div class="reply-context"><div class="reply-parent"><div class="rp-msg-row"><div class="av av-ph" style="background:#4f545c">?</div><div class="rp-content"><div class="rp-head"><span class="rp-name">(original message unavailable)</span></div></div></div></div></div>`;
  }

  const snapshots = (m.message_snapshots || []).map((sn) => {
    const inner = sn.message; if (!inner) return '';
    return `<div class="fwd">📩 forwarded from <b>${htmlEscape(authorName(inner.author, inner.author?.id))}</b><div class="fwd-body">${renderMarkdown(inner.content || '')}</div></div>`;
  }).join('');
  const stickers = (m.sticker_items || []).map((s) => `<div class="sticker">🏷 ${htmlEscape(s.name || s.id)}</div>`).join('');
  const poll = m.poll ? `<div class="poll"><b>${htmlEscape(m.poll.question?.text || '')}</b>${(m.poll.answers || []).map((a) => `<div>· ${htmlEscape(a.poll_media?.text || a.answer_id)} — ${a.count || 0} votes</div>`).join('')}</div>` : '';
  const atts = renderAttachments(m.attachments, opts.mediaMap, depth);
  const embeds = renderEmbeds(m.embeds, depth);
  const reactions = (m.reactions || []).length
    ? `<div class="rx">${m.reactions.map((r) => `<span class="rx-chip" title="${r._users ? htmlEscape(r._users.join(', ')) : ''}">${htmlEscape(r.emoji?.name || '?')} <span class="rx-count">${r.count}</span></span>`).join('')}</div>`
    : '';
  const content = m.content ? `<div class="body">${renderMarkdown(m.content, mentionMap)}</div>` : '';
  const head = grouped ? '' : `<div class="mhead"><span class="mname">${htmlEscape(name)}</span><span class="mtime">${time}</span>${edited}</div>`;

  const cls = 'msg' + (grouped ? ' grouped' : '') + (hasReply ? ' has-reply' : '');
  out.push(`<div class="${cls}" id="m-${m.id}">${replyBlock}<div class="msg-row">${av}<div class="msg-content">${head}${content}${snapshots}${stickers}${poll}${embeds}${atts}${reactions}</div></div></div>`);
  return { html: out.join(''), dayKey: dk };
}

function renderChannelMessages(messages, opts, depth) {
  const out = [];
  let prev = null; let prevDay = null;
  for (const m of messages) {
    const sameAuthor = prev && prev.author?.id === m.author?.id;
    const within5 = prev && (new Date(m.timestamp).getTime() - new Date(prev.timestamp).getTime()) < 5 * 60 * 1000;
    const hasReply = !!m.referenced_message || !!m._refUnavailable;
    const grouped = !!(sameAuthor && within5 && !hasReply);
    const r = renderOneMessage(m, grouped, opts, prevDay, depth);
    out.push(r.html);
    prev = m; prevDay = r.dayKey;
  }
  return out.join('');
}

const VIEWER_CSS = `
*{box-sizing:border-box;margin:0;padding:0}
:root{--bg:#313338;--bg2:#2b2d31;--bg3:#1e1f22;--bg4:#111214;--fg:#dbdee1;--dim:#949ba4;--acc:#5865f2;--bd:#3f4147;--hover:#35373c;--link:#00a8fc}
html,body{height:100%}
body{background:var(--bg);color:var(--fg);font:16px/1.375 "gg sans","Segoe UI",system-ui,-apple-system,sans-serif;overflow:hidden}
a{color:var(--link);text-decoration:none}a:hover{text-decoration:underline}
.layout{display:grid;grid-template-columns:280px 1fr;height:100vh}
.sidebar{background:var(--bg3);overflow-y:auto;display:flex;flex-direction:column}
.sidebar .title{padding:14px 16px;background:var(--bg2);border-bottom:1px solid var(--bd);font-weight:700;font-size:15px;color:#fff;position:sticky;top:0;z-index:2}
.sidebar .subtitle{padding:8px 16px 12px;font-size:12px;color:#5c6068;background:var(--bg2);border-bottom:1px solid var(--bd)}
.sidebar .grp{padding:14px 10px 4px;font-size:11px;text-transform:uppercase;letter-spacing:.02em;color:var(--dim);font-weight:600;display:flex;align-items:center;gap:6px}
.sidebar .grp .icon{width:20px;height:20px;border-radius:50%;flex-shrink:0;object-fit:cover;background:#5865f2}
.sidebar a.chan{display:flex;align-items:center;gap:6px;padding:5px 10px 5px 28px;font-size:14px;color:var(--dim);border-radius:4px;margin:1px 6px;cursor:pointer;text-decoration:none}
.sidebar a.chan:hover{background:var(--hover);color:var(--fg);text-decoration:none}
.sidebar a.chan.active{background:#404249;color:#fff}
.sidebar a.chan .hash{color:#80848e;font-weight:600}
.sidebar a.chan .cnt{margin-left:auto;font-size:11px;color:#5c6068}
.main{display:flex;flex-direction:column;overflow:hidden;background:var(--bg)}
.topbar{display:flex;gap:12px;align-items:center;padding:10px 16px;background:var(--bg2);border-bottom:1px solid var(--bd)}
.topbar input{flex:1;max-width:400px;padding:6px 10px;background:var(--bg3);border:none;border-radius:4px;color:var(--fg);font-size:14px;outline:none;font-family:inherit}
.topbar input:focus{outline:1px solid var(--acc)}
.topbar .stat{font-size:12px;color:var(--dim);margin-left:auto}
.content{flex:1;overflow-y:auto;padding:0}
.chan-header{padding:20px 24px 12px;background:var(--bg);position:sticky;top:0;z-index:5;border-bottom:1px solid var(--bd)}
.chan-header .gname{font-size:12px;color:var(--dim);margin-bottom:2px;text-transform:uppercase;letter-spacing:.04em}
.chan-header .cname{font-size:22px;font-weight:700;color:#fff;display:flex;align-items:center;gap:6px}
.chan-header .hash{color:#80848e;font-weight:600}
.chan-header .meta{font-size:12px;color:var(--dim);margin-top:4px}
.chan-wrap{padding:8px 0 60px}
.msg{padding:2px 16px;position:relative;margin-top:16px}
.msg.grouped{margin-top:2px}
.msg.has-reply{margin-top:12px}
.msg:target,.msg.flash{background:rgba(88,101,242,.1)}
.msg:hover{background:rgba(0,0,0,.06)}
.msg-row{display:flex;gap:14px;align-items:flex-start}
.msg-row>.av{flex-shrink:0;margin-top:1px}
.msg-content{flex:1;min-width:0}
.mhead{display:flex;align-items:baseline;gap:8px;margin-bottom:2px}
.mname{font-weight:600;color:#fff;font-size:15px}
.mtime{font-size:11px;color:var(--dim);margin-left:2px}
.edited{font-size:10px;color:var(--dim);margin-left:2px}
.av{width:40px;height:40px;border-radius:50%;flex-shrink:0;object-fit:cover;display:block}
.av-ph{display:flex;align-items:center;justify-content:center;color:#fff;font-weight:600;border-radius:50%;font-size:17px}
.body{word-wrap:break-word;white-space:pre-wrap;font-size:15px;line-height:1.4;color:var(--fg)}
.reply-context{margin-bottom:6px;padding-left:4px;position:relative}
.reply-parent{padding:0;border-left:2px solid #4f545c;padding-left:10px;margin-left:6px}
.rp-msg-row{display:flex;gap:14px;align-items:flex-start;padding-top:4px;padding-bottom:8px}
.rp-msg-row>.av{flex-shrink:0;margin-top:1px}
.rp-content{flex:1;min-width:0}
.rp-head{display:flex;align-items:baseline;gap:8px;margin-bottom:2px}
.rp-name{color:#c9cdfb;font-weight:600;font-size:15px}
.rp-time{color:#5c6068;font-size:11px;margin-left:2px}
.rbody{color:var(--dim);font-size:15px;line-height:1.4;word-wrap:break-word;white-space:pre-wrap;opacity:.9}
.fwd{margin:4px 0;padding:6px 10px;border-left:3px solid var(--acc);background:rgba(88,101,242,.06);border-radius:3px;font-size:14px}
.fwd-body{margin-top:4px;color:var(--dim);font-size:13px}
.sticker{margin:4px 0;font-size:14px;color:var(--dim)}
.poll{margin:6px 0;padding:8px 12px;border:1px solid var(--bd);border-radius:6px;font-size:14px;max-width:400px}
.embed{margin:6px 0;padding:8px 12px;background:var(--bg3);border-left:4px solid var(--acc);border-radius:4px;font-size:14px;max-width:520px}
.embed .edesc{margin-top:4px;color:var(--dim);font-size:13px}
.embed .eimg{max-width:100%;border-radius:4px;margin-top:6px}
.embed.gif img{max-width:400px;max-height:400px;border-radius:4px;display:block}
.embed.vid img{max-width:360px;border-radius:4px;display:block}
.embed.vid .etitle{margin-top:6px;color:var(--fg)}
.embed .eprov{margin-top:4px;font-size:11px;color:var(--dim);text-transform:uppercase;letter-spacing:.04em}
.att-image{margin:6px 0;font-size:14px}
.att-img{max-width:420px;max-height:420px;border-radius:8px;display:block;margin-bottom:4px;background:#1a1b1e}
.att-video-wrap{margin:6px 0;font-size:14px}
.att-video{max-width:500px;max-height:400px;border-radius:8px;display:block;margin-bottom:4px;background:#000}
.att-audio{margin:6px 0;font-size:14px;display:flex;flex-direction:column;gap:4px}
.att-audio audio{max-width:340px;height:40px}
.att-file{margin:6px 0;font-size:14px}
.att-link{color:var(--link);display:inline-flex;align-items:center;gap:4px}
.att-link .size{color:var(--dim);font-size:11px;margin-left:4px}
.voice-player{margin:6px 0;display:flex;align-items:center;gap:12px;padding:10px 14px;background:var(--bg3);border-radius:24px;max-width:420px;border:1px solid var(--bd)}
.vp-play{width:34px;height:34px;border-radius:50%;background:var(--fg);color:var(--bg3);border:none;cursor:pointer;display:flex;align-items:center;justify-content:center;flex-shrink:0;padding:0}
.vp-play:hover{background:#fff}
.vp-play svg{display:block;margin-left:2px}
.vp-play.playing svg{margin-left:0}
.vp-wave{flex:1;display:flex;align-items:center;gap:2px;height:26px}
.vw-bar{width:2px;background:var(--dim);border-radius:1px;min-height:3px;transition:background .15s}
.vw-bar.faded{opacity:.5}
.voice-player.played .vw-bar{background:var(--fg);opacity:1}
.vp-time{font-size:12px;color:var(--dim);font-variant-numeric:tabular-nums;flex-shrink:0;min-width:38px;text-align:right}
.vp-audio{display:none}
.rx{margin:4px 0 0;display:flex;gap:6px;flex-wrap:wrap}
.rx-chip{padding:2px 8px;border:1px solid var(--bd);border-radius:11px;font-size:13px;background:rgba(0,0,0,.2);cursor:help;display:inline-flex;gap:4px;align-items:center}
.rx-chip .rx-count{color:var(--dim);font-size:12px}
.code{background:var(--bg3);padding:8px 10px;border-radius:4px;font-family:ui-monospace,Consolas,monospace;font-size:13px;overflow-x:auto;margin:4px 0}
code{background:var(--bg3);padding:1px 4px;border-radius:3px;font-size:13px;font-family:ui-monospace,Consolas,monospace}
.spoiler{background:#1a1b1e;color:#1a1b1e;padding:0 3px;border-radius:3px;cursor:pointer;transition:color .12s}
.spoiler.open{color:var(--fg);background:rgba(0,0,0,.3)}
.mention{color:#c9cdfb;background:rgba(88,101,242,.3);padding:0 2px;border-radius:3px;font-weight:500}
.day-divider{display:flex;align-items:center;gap:8px;margin:22px 16px 8px;font-size:12px;color:var(--dim);font-weight:500;position:relative}
.day-divider::before,.day-divider::after{content:'';flex:1;height:1px;background:var(--bd)}
.day-divider span{padding:0 8px;white-space:nowrap}
mark.hit{background:#faa81a;color:#000;padding:0 2px;border-radius:2px}
.intro{padding:40px 24px;color:var(--dim)}
.intro h1{font-size:36px;color:#fff;margin-bottom:8px;border-bottom:1px solid var(--bd);padding-bottom:20px}
.intro p{font-size:15px;margin-top:6px}
::-webkit-scrollbar{width:10px;height:10px}
::-webkit-scrollbar-track{background:transparent}
::-webkit-scrollbar-thumb{background:#1a1b1e;border-radius:5px}
::-webkit-scrollbar-thumb:hover{background:#000}
`;

function buildSidebarHtml(channels, targetName, activeId, generated, totalMsgs, totalFiles, depth) {
  const prefix = depth === 'index' ? '' : '../';
  const chanPrefix = depth === 'index' ? 'channels/' : '';
  const parts = [];
  parts.push(`<div class="title">${htmlEscape(targetName)}</div>`);
  parts.push(`<div class="subtitle">${totalMsgs} msgs · ${totalFiles} files · ${generated}</div>`);
  let lastGuild = null;
  for (const c of channels) {
    if (c.guild !== lastGuild) {
      let iconHtml;
      if (c.guildIcon && c.guildIcon.local) {
        iconHtml = `<img class="icon" src="${prefix}${c.guildIcon.local}" alt="">`;
      } else if (c.guildIcon && c.guildIcon.remote) {
        iconHtml = `<img class="icon" src="${c.guildIcon.remote}" alt="">`;
      } else {
        iconHtml = `<div class="icon" style="display:flex;align-items:center;justify-content:center;font-size:11px;color:#fff;font-weight:700">${htmlEscape((c.guild||'?').slice(0,1).toUpperCase())}</div>`;
      }
      parts.push(`<div class="grp">${iconHtml}<span>${htmlEscape(c.guild)}</span></div>`);
      lastGuild = c.guild;
    }
    const href = `${chanPrefix}${c.slug}.html`;
    const isActive = c.id === activeId ? ' active' : '';
    const hashGlyph = c.isDM ? '' : '<span class="hash">#</span>';
    parts.push(`<a class="chan${isActive}" href="${href}"><span>${hashGlyph}${htmlEscape(c.name)}</span><span class="cnt">${c.count}</span></a>`);
  }
  return parts.join('');
}

const VOICE_PLAYER_JS = `
(function(){
  document.querySelectorAll('.voice-player').forEach(function(vp){
    var btn = vp.querySelector('.vp-play');
    var audio = vp.querySelector('.vp-audio');
    if (!btn || !audio) return;
    var playIcon = '<svg viewBox="0 0 24 24" width="16" height="16"><path fill="currentColor" d="M8 5v14l11-7z"/></svg>';
    var pauseIcon = '<svg viewBox="0 0 24 24" width="16" height="16"><path fill="currentColor" d="M6 5h4v14H6zM14 5h4v14h-4z"/></svg>';
    btn.addEventListener('click', function(){
      if (audio.paused) {
        document.querySelectorAll('.vp-audio').forEach(function(o){ if (o !== audio) o.pause(); });
        audio.play();
        btn.innerHTML = pauseIcon;
        btn.classList.add('playing');
        vp.classList.add('played');
      } else {
        audio.pause();
        btn.innerHTML = playIcon;
        btn.classList.remove('playing');
      }
    });
    audio.addEventListener('ended', function(){ btn.innerHTML = playIcon; btn.classList.remove('playing'); });
    audio.addEventListener('timeupdate', function(){
      if (!audio.duration) return;
      var pct = audio.currentTime / audio.duration;
      var bars = vp.querySelectorAll('.vw-bar');
      var lit = Math.round(pct * bars.length);
      bars.forEach(function(b, i){ if (i < lit) b.classList.remove('faded'); else b.classList.add('faded'); });
    });
  });
})();
`;

function buildChannelPage(opts) {
  const { channel, channels, targetName, generated, totalMsgs, totalFiles, bodyHtml } = opts;
  const sidebar = buildSidebarHtml(channels, targetName, channel.id, generated, totalMsgs, totalFiles, 'channel');
  const headerGuild = channel.isDM ? 'Direct Messages' : channel.guild;
  const hashGlyph = channel.isDM ? '' : '<span class="hash">#</span>';
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>${htmlEscape(channel.name)} — ${htmlEscape(targetName)}</title>
<style>${VIEWER_CSS}</style>
</head>
<body>
<div class="layout">
  <aside class="sidebar">${sidebar}</aside>
  <div class="main">
    <div class="topbar">
      <input id="search" placeholder="search in this channel… (Enter)">
      <span class="stat" id="stat"></span>
    </div>
    <div class="content" id="content">
      <header class="chan-header">
        <div class="gname">${htmlEscape(headerGuild)}</div>
        <div class="cname">${hashGlyph}${htmlEscape(channel.name)}</div>
        <div class="meta">${channel.count} messages${channel.parent ? ' · thread of #' + htmlEscape(channel.parent) : ''}</div>
      </header>
      <div class="chan-wrap">${bodyHtml}</div>
    </div>
  </div>
</div>
<script>
${VOICE_PLAYER_JS}
(function(){
  var input = document.getElementById('search');
  var stat = document.getElementById('stat');
  var content = document.getElementById('content');
  var hits = []; var idx = -1;
  function clearHits() {
    document.querySelectorAll('mark.hit').forEach(function(m) {
      var p = m.parentNode; p.replaceChild(document.createTextNode(m.textContent), m); p.normalize();
    });
    hits = []; idx = -1; stat.textContent = '';
  }
  function highlight(q) {
    if (!q || q.length < 2) return;
    var esc = q.replace(/[-\\/\\\\^$*+?.()|[\\]{}]/g, '\\\\$&');
    var re = new RegExp(esc, 'gi');
    var walker = document.createTreeWalker(content, NodeFilter.SHOW_TEXT, {
      acceptNode: function(n) {
        if (!n.nodeValue || !n.nodeValue.trim()) return NodeFilter.FILTER_REJECT;
        var p = n.parentNode; if (!p) return NodeFilter.FILTER_REJECT;
        var t = p.nodeName;
        if (t === 'SCRIPT' || t === 'STYLE' || t === 'MARK') return NodeFilter.FILTER_REJECT;
        return NodeFilter.FILTER_ACCEPT;
      }
    });
    var nodes = []; var n; while ((n = walker.nextNode())) nodes.push(n);
    nodes.forEach(function(node) {
      var txt = node.nodeValue;
      var matches = []; var m; re.lastIndex = 0;
      while ((m = re.exec(txt))) { matches.push({ s: m.index, e: m.index + m[0].length, t: m[0] }); if (matches.length > 800) break; }
      if (!matches.length) return;
      var frag = document.createDocumentFragment(); var pos = 0;
      for (var i = 0; i < matches.length; i++) {
        var mt = matches[i];
        if (mt.s > pos) frag.appendChild(document.createTextNode(txt.slice(pos, mt.s)));
        var mk = document.createElement('mark'); mk.className = 'hit'; mk.textContent = mt.t;
        frag.appendChild(mk); hits.push(mk); pos = mt.e;
      }
      if (pos < txt.length) frag.appendChild(document.createTextNode(txt.slice(pos)));
      node.parentNode.replaceChild(frag, node);
    });
    stat.textContent = hits.length + ' matches';
  }
  function next() {
    if (!hits.length) return;
    if (idx >= 0) hits[idx].style.outline = '';
    idx = (idx + 1) % hits.length;
    hits[idx].scrollIntoView({ behavior:'smooth', block:'center' });
    hits[idx].style.outline = '2px solid #faa81a';
    stat.textContent = (idx + 1) + ' / ' + hits.length;
  }
  input.addEventListener('keydown', function(e) {
    if (e.key === 'Enter') { e.preventDefault(); var q = input.value.trim(); if (!q) { clearHits(); return; } clearHits(); highlight(q); if (hits.length) { idx = -1; next(); } }
    else if (e.key === 'Escape') { input.value = ''; clearHits(); }
  });
  document.addEventListener('click', function(e) {
    if (e.target.classList && e.target.classList.contains('spoiler')) e.target.classList.toggle('open');
  });
})();
</script>
</body>
</html>`;
}

function buildIndexPage(opts) {
  const { channels, targetName, generated, totalMsgs, totalFiles } = opts;
  const sidebar = buildSidebarHtml(channels, targetName, null, generated, totalMsgs, totalFiles, 'index');
  const firstHref = channels[0] ? `channels/${channels[0].slug}.html` : '#';
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>Discord Export — ${htmlEscape(targetName)}</title>
<style>${VIEWER_CSS}</style>
</head>
<body>
<div class="layout">
  <aside class="sidebar">${sidebar}</aside>
  <div class="main">
    <div class="topbar"><input placeholder="pick a channel" disabled></div>
    <div class="content">
      <div class="intro">
        <h1>${htmlEscape(targetName)}</h1>
        <p>Exported ${generated}</p>
        <p>${totalMsgs} messages · ${totalFiles} files · ${channels.length} channel${channels.length === 1 ? '' : 's'}</p>
        <p style="margin-top:24px"><a href="${firstHref}">Open first channel →</a></p>
        <p style="margin-top:8px;color:#5c6068;font-size:12px">Click any channel in the sidebar.</p>
      </div>
    </div>
  </div>
</div>
</body>
</html>`;
}

async function getIncremental() { return store.get('incremental') || {}; }
async function setIncremental(m) { store.set('incremental', m); }
async function getRetry() { return store.get('retry') || []; }
async function setRetry(a) { store.set('retry', a); }

async function fetchAttachment(url, expectedSize) {
  if (expectedSize && expectedSize > MAX_SINGLE_ATTACHMENT) throw new Error('over cap');
  if (totalAttachmentBytes > MAX_ATTACHMENT_BYTES) throw new Error('budget');
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const res = await fetch(url);
      if (res.status === 429) { await sleep(900 * (attempt + 1)); continue; }
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const buf = await res.arrayBuffer();
      totalAttachmentBytes += buf.byteLength;
      return buf;
    } catch (e) { if (attempt === 2) throw e; await sleep(400 * (attempt + 1)); }
  }
}

async function runPool(items, concurrency, worker) {
  let idx = 0;
  const workers = Array.from({ length: concurrency }, async () => {
    while (idx < items.length) {
      if (cancelFlag) return;
      while (pauseFlag) await sleep(300);
      const i = idx++;
      try { await worker(items[i], i); } catch (_) {}
    }
  });
  await Promise.all(workers);
}

async function packChannel(zip, channelMeta, messages, stats, ctx) {
  if (!messages.length) return null;

  const seen = new Set();
  const unique = messages.filter((m) => { if (seen.has(m.id)) return false; seen.add(m.id); return true; });
  unique.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

  if (ctx.filters.includeAvatars) {
    const users = new Map();
    for (const m of unique) {
      if (m.author && m.author.id) users.set(m.author.id, m.author);
      if (m.referenced_message && m.referenced_message.author && m.referenced_message.author.id) {
        users.set(m.referenced_message.author.id, m.referenced_message.author);
      }
      if (m.mentions) for (const u of m.mentions) if (u && u.id) users.set(u.id, u);
    }
    const toFetch = [...users.values()].filter((u) => !ctx.avatarMap.has(u.id));
    let aIdx = 0;
    await Promise.all(Array.from({ length: 16 }, async () => {
      while (true) {
        const i = aIdx++;
        if (i >= toFetch.length) return;
        if (cancelFlag) return;
        await downloadAvatar(zip, toFetch[i], ctx.avatarNamer, ctx.avatarMap);
      }
    }));
  }

  if (ctx.filters.reactionDetail) {
    const withReactions = unique.filter((m) => m.reactions && m.reactions.length);
    let rIdx = 0;
    await Promise.all(Array.from({ length: 12 }, async () => {
      while (true) {
        const i = rIdx++;
        if (i >= withReactions.length) return;
        if (cancelFlag) return;
        const m = withReactions[i];
        for (const r of m.reactions) {
          if (!r.emoji) continue;
          const name = r.emoji.name || r.emoji.id;
          const users = await fetchReactionUsers(ctx.token, m.channel_id, m.id, name);
          if (users) r._users = users;
        }
      }
    }));
  }

  if (ctx.filters.linkPreviews) {
    const urls = new Set();
    for (const m of unique) {
      if (!m.content) continue;
      for (const u of m.content.match(/https?:\/\/[^\s<>"']+/g) || []) urls.add(u);
    }
    const urlList = [...urls].slice(0, 100);
    const ogMap = new Map();
    let oIdx = 0;
    await Promise.all(Array.from({ length: 8 }, async () => {
      while (true) {
        const i = oIdx++;
        if (i >= urlList.length) return;
        if (cancelFlag) return;
        const og = await fetchOgPreview(urlList[i]);
        if (og) ogMap.set(urlList[i], og);
      }
    }));
    for (const m of unique) {
      if (!m.content) continue;
      for (const [u, og] of ogMap) {
        if (m.content.includes(u)) {
          if (!m.embeds) m.embeds = [];
          m.embeds.push({ type: 'rich', url: u, title: og.title, description: og.desc, image: og.image ? { url: og.image } : null });
        }
      }
    }
  }

  const atts = [];
  for (const m of unique) {
    if (!m.attachments?.length) continue;
    const authorSlug = sanitize(authorName(m.author, m.author && m.author.id), 'user', 30);
    let idx = 0;
    for (const a of m.attachments) {
      idx++;
      atts.push({ attachment: a, msgId: m.id, authorSlug, seq: idx });
    }
  }
  const mediaMap = ctx.mediaMap;
  const CONC = 24;
  for (let i = 0; i < atts.length; i += CONC) {
    if (cancelFlag) break;
    while (pauseFlag) await sleep(300);
    const slice = atts.slice(i, i + CONC);
    await Promise.all(slice.map(async (item) => {
      const a = item.attachment;
      try {
        const buf = await fetchAttachment(a.url, a.size);
        const h = await sha256Hex(buf);
        if (attachmentHashCache.has(h)) {
          mediaMap.set(a.id, attachmentHashCache.get(h));
          stats.dedup++;
          return;
        }
        const ext = a.filename.includes('.') ? a.filename.slice(a.filename.lastIndexOf('.')) : '';
        const baseName = a.filename.slice(0, a.filename.length - ext.length);
        const fname = `${item.authorSlug}-${item.seq}-${sanitize(baseName, 'file', 40)}${ext}`;
        const dest = `_assets/media/${fname}`;
        zip.file(dest, buf);
        attachmentHashCache.set(h, dest);
        mediaMap.set(a.id, dest);
        stats.files++;
      } catch (e) {
        stats.errors++;
        _retryQueue.push({ url: a.url, dest: `_assets/media/${item.authorSlug}-${item.seq}-${sanitize(a.filename, 'file')}`, size: a.size });
      }
    }));
  }

  // ── TXT file alongside the HTML ────────────────────────────
  const exportDate = new Date().toISOString().slice(0, 16).replace('T', ' ');
  const txtHeader = buildTxtHeader(
    channelMeta.isDM ? channelMeta.name : `#${channelMeta.name}`,
    channelMeta.isDM ? 'Direct Messages' : channelMeta.guild,
    unique.length,
    exportDate
  );
  const txtBody = formatAllText(unique);
  zip.file(`channels/${channelMeta.slug}.txt`, txtHeader + '\n' + txtBody);

  stats.messages += unique.length;
  stats.channels++;

  return {
    id: channelMeta.id,
    name: channelMeta.name,
    guild: channelMeta.guild,
    guildId: channelMeta.guildId,
    count: unique.length,
    isDM: !!channelMeta.isDM,
    parent: channelMeta.parent || null,
    slug: channelMeta.slug,
    messages: unique
  };
}

async function exportOneTarget(token, targetId, includeDM, guildIds, opts) {
  const target = await ensureUser(token, targetId);
  const targetName = authorName(target, targetId);
  log(`target: ${targetName}`, 'INFO');
  _hydrateStats = { ok: 0, directFail: 0, aroundOk: 0, finalFail: 0 };

  const zip = new JSZip();
  const stats = { messages: 0, files: 0, errors: 0, channels: 0, servers: 0, dedup: 0 };
  totalAttachmentBytes = 0;

  const avatarMap = new Map();
  const iconMap = new Map();
  const mediaMap = new Map();
  const avatarNamer = buildAvatarNamer();
  const iconNamer = buildGuildIconNamer();

  const collected = [];
  const ctx = Object.assign({}, opts, { token, avatarMap, mediaMap, avatarNamer, iconNamer });

  const dmPromise = (async () => {
    if (!includeDM) return null;
    log(`DM phase`, 'INFO');
    const dmList = await api(token, '/users/@me/channels');
    if (!dmList.ok || !Array.isArray(dmList.body)) {
      log(`DM list failed: HTTP ${dmList.status}`, 'WARN');
      return null;
    }
    const hit = findDmWithTarget(dmList.body, targetId);
    if (!hit) { log(`no DM with ${targetId.slice(-6)}`, 'WARN'); return null; }
    log(`DM channel: ${hit.id}`, 'INFO');
    const inc = opts.filters.incremental ? await getIncremental() : {};
    const msgs = await fetchChannelByWalk(token, hit.id, targetId, inc[hit.id]);
    const re = compileRegexes(opts.filters);
    const filtered = applyFilters(msgs, opts.filters, re);
    log(`DM: ${msgs.length} raw → ${filtered.length} filtered`, 'INFO');
    if (!filtered.length) return null;
    await hydrateReplies(token, filtered, hit.id);
    const r = await packChannel(zip, {
      id: hit.id, name: targetName, guild: 'Direct Messages', guildId: null,
      isDM: true, slug: `dm-${sanitize(targetName, targetId, 40)}`
    }, filtered, stats, ctx);
    if (r) { collected.push(r); log(`  DM added: ${r.count} msgs`, 'DL'); }
    if (opts.filters.incremental) {
      const newest = filtered.reduce((m, x) => (x.id > m ? x.id : m), inc[hit.id] || '0');
      inc[hit.id] = newest;
      await setIncremental(inc);
    }
    return r;
  })();

  let gIdx = 0;
  const guildWorker = async () => {
    while (true) {
      if (cancelFlag) return;
      const i = gIdx++;
      if (i >= guildIds.length) return;
      const gid = guildIds[i];
      let guildName = gid, guildIconHash = null;
      try {
        const gRes = await api(token, `/guilds/${gid}`);
        if (gRes.ok && gRes.body) {
          guildName = gRes.body.name;
          guildIconHash = gRes.body.icon;
          if (opts.filters.includeAvatars && guildIconHash) {
            await downloadGuildIcon(zip, gid, guildName, guildIconHash, iconNamer, iconMap);
          }
        }
        log(`${guildName}: starting…`, 'INFO');
        send('PROGRESS', { percent: (i / guildIds.length) * 80, label: `${i + 1}/${guildIds.length} · ${guildName}` });

        const chRes = await api(token, `/guilds/${gid}/channels`);
        const channelMap = new Map();
        if (chRes.ok && Array.isArray(chRes.body)) for (const c of chRes.body) channelMap.set(c.id, c);

        const result = await fetchGuildBySearch(token, gid, targetId,
          (msg) => send('PROGRESS', { percent: null, label: `${guildName}: ${msg}` }));

        let byChannel = result.byChannel;

        if (result.failed) {
          log(`  search failed — history walk`, 'WARN');
          const textChannels = [...channelMap.values()].filter((c) => c.type === 0 || c.type === 5);
          const inc = opts.filters.incremental ? await getIncremental() : {};
          await runPool(textChannels, 16, async (c) => {
            if (cancelFlag) return;
            const msgs = await fetchChannelByWalk(token, c.id, targetId, inc[c.id]);
            if (msgs.length) byChannel.set(c.id, msgs);
          });
        }

        if (opts.filters.includeThreads) {
          await Promise.all([...byChannel.keys()].map(async (pid) => {
            const threads = await listActiveThreads(token, pid);
            for (const t of threads) {
              const r = await api(token, `/channels/${t.id}/messages`, { limit: 100 });
              if (r.ok && Array.isArray(r.body)) {
                const hits = r.body.filter((m) => m.author && m.author.id === targetId);
                if (hits.length) {
                  if (!byChannel.has(t.id)) byChannel.set(t.id, []);
                  byChannel.get(t.id).push(...hits);
                  channelMap.set(t.id, { name: `thread ${t.name}`, parent_id: pid });
                }
              }
            }
          }));
        }

        const re = compileRegexes(opts.filters);
        const inc = opts.filters.incremental ? await getIncremental() : {};
        const guildChannelWhitelist = opts.channelsByGuild && opts.channelsByGuild[gid] ? new Set(opts.channelsByGuild[gid]) : null;
        let guildChIdx = 0;

        for (const [cid, msgs] of byChannel) {
          if (cancelFlag) break;
          const ch = channelMap.get(cid);
          const chName = ch ? ch.name : cid;
          if (!channelAllowed(chName, re)) continue;
          if (guildChannelWhitelist && guildChannelWhitelist.size && !guildChannelWhitelist.has(cid)) continue;

          const lastId = inc[cid];
          let toExport = msgs;
          if (lastId && opts.filters.incremental) toExport = msgs.filter((m) => m.id > lastId);
          const filtered = applyFilters(toExport, opts.filters, re);
          if (!filtered.length) { log(`  #${chName}: no new`, 'DL'); continue; }

          await hydrateReplies(token, filtered, cid);
          const parent = ch && ch.parent_id ? channelMap.get(ch.parent_id) : null;
          guildChIdx++;
          const slug = `${String(guildChIdx).padStart(3, '0')}-${sanitize(chName, cid, 40)}`;
          const r = await packChannel(zip, {
            id: cid, name: chName, guild: guildName, guildId: gid,
            isDM: false, parent: parent ? parent.name : null,
            slug
          }, filtered, stats, ctx);
          if (r) collected.push(r);

          if (opts.filters.incremental) {
            const newest = filtered.reduce((max, m) => (m.id > max ? m.id : max), lastId || '0');
            inc[cid] = newest;
          }
          log(`  #${chName}: ${r ? r.count : 0}`, 'DL');
        }
        if (opts.filters.incremental) await setIncremental(inc);
        stats.servers++;
      } catch (e) { log(`  ${guildName} failed: ${e.message}`, 'ERR'); stats.errors++; }
    }
  };
  await Promise.all([guildWorker(), guildWorker(), guildWorker(), guildWorker()]);
  await dmPromise;

  log(`hydrate: ${_hydrateStats.ok} ok (${_hydrateStats.aroundOk} via around), ${_hydrateStats.finalFail} failed`, 'INFO');
  log(`collected ${collected.length} channels (${collected.filter(c=>c.isDM).length} DMs)`, 'INFO');

  collected.sort((a, b) => {
    if (a.isDM && !b.isDM) return 1;
    if (b.isDM && !a.isDM) return -1;
    if (a.guild !== b.guild) return a.guild.localeCompare(b.guild);
    return 0;
  });

  const generated = new Date().toISOString().slice(0, 16).replace('T', ' ');

  const sidebarChannels = collected.map((c) => ({
    id: c.id,
    name: c.name,
    guild: c.guild,
    guildId: c.guildId,
    count: c.count,
    isDM: c.isDM,
    parent: c.parent,
    guildIcon: c.guildId ? iconMap.get(c.guildId) : null,
    slug: c.slug
  }));

  for (const c of collected) {
    const bodyHtml = renderChannelMessages(c.messages, {
      avatarMap, mediaMap, includeAvatars: opts.filters.includeAvatars
    }, 'channel');
    const html = buildChannelPage({
      channel: c, channels: sidebarChannels, targetName, generated,
      totalMsgs: stats.messages, totalFiles: stats.files, bodyHtml
    });
    zip.file(`channels/${c.slug}.html`, html);
  }

  const indexHtml = buildIndexPage({
    channels: sidebarChannels, targetName, generated,
    totalMsgs: stats.messages, totalFiles: stats.files
  });
  zip.file('index.html', indexHtml);

  return { targetId, targetName, zip, stats };
}

async function doExport(token, targetIds, includeDM, guildIds, opts) {
  cancelFlag = false; pauseFlag = false;
  const me = await api(token, '/users/@me');
  if (!me.ok) throw new Error(`auth failed — HTTP ${me.status}`);
  log(`authed as ${me.body.username}`, 'INFO');
  _retryQueue.length = 0;
  await setRetry([]);

  const summaryStats = [];

  for (let i = 0; i < targetIds.length; i++) {
    if (cancelFlag) break;
    const tid = targetIds[i];
    log(`=== target ${i + 1}/${targetIds.length}: ${tid} ===`, 'INFO');
    const res = await exportOneTarget(token, tid, includeDM, guildIds, opts);
    if (cancelFlag) break;

    log('Compressing…', 'INFO');
    const blob = await res.zip.generateAsync(
      { type: 'blob', compression: 'DEFLATE', compressionOptions: { level: 6 } },
      (meta) => send('PROGRESS', { percent: 80 + meta.percent * 0.2, label: `compressing ${meta.percent.toFixed(0)}%` })
    );

    const d = new Date();
    const stamp = `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}_${pad(d.getHours())}-${pad(d.getMinutes())}`;
    const filename = `Discord_Export_${sanitize(res.targetName, tid, 40)}_${stamp}.zip`;

    const dataUrl = await new Promise((resolve, reject) => {
      const r = new FileReader();
      r.onloadend = () => resolve(r.result);
      r.onerror = reject;
      r.readAsDataURL(blob);
    });
    const dl = await chrome.runtime.sendMessage({ to: 'background', type: 'DOWNLOAD', url: dataUrl, filename });
    if (!dl || !dl.ok) throw new Error('download failed: ' + ((dl && dl.error) || 'unknown'));

    const sizeMB = blob.size / 1024 / 1024;
    log(`Done — ${filename} (${sizeMB.toFixed(2)} MB)`, 'INFO');
    summaryStats.push(`${res.targetName}: ${res.stats.messages} msgs · ${res.stats.files} files · ${res.stats.servers} servers`);

    send('DONE', {
      filename, sizeMB,
      messages: res.stats.messages, files: res.stats.files, errors: res.stats.errors,
      failedCount: _retryQueue.length,
      stats: [...summaryStats, `open: index.html inside the zip`]
    });
  }

  if (cancelFlag) { send('CANCELLED', {}); running = false; return; }
  await setRetry(_retryQueue.slice(0, 200));
}

async function doRetry(token, targetId) {
  const queue = await getRetry();
  if (!queue.length) { log('[!] nothing to retry'); return; }
  log(`[+] retrying ${queue.length} failed downloads`, 'INFO');
  const zip = new JSZip();
  const remaining = [];
  let ok = 0, fail = 0;
  let idx = 0;
  await Promise.all(Array.from({ length: 16 }, async () => {
    while (true) {
      const i = idx++;
      if (i >= queue.length) return;
      if (cancelFlag) return;
      const item = queue[i];
      try {
        const buf = await fetchAttachment(item.url, item.size);
        zip.file(item.dest, buf);
        ok++;
      } catch (e) { remaining.push(item); fail++; }
    }
  }));
  await setRetry(remaining);
  if (!ok) { log('[!] no retries succeeded'); return; }
  const blob = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE' });
  const d = new Date();
  const stamp = `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}_${pad(d.getHours())}-${pad(d.getMinutes())}`;
  const filename = `Discord_Retry_${targetId}_${stamp}.zip`;
  const dataUrl = await new Promise((res, rej) => { const r = new FileReader(); r.onloadend = () => res(r.result); r.onerror = rej; r.readAsDataURL(blob); });
  await chrome.runtime.sendMessage({ to: 'background', type: 'DOWNLOAD', url: dataUrl, filename });
  log(`[+] retry zip saved: ${filename} (${ok} ok, ${fail} still failing)`, 'INFO');
  send('DONE', { filename, sizeMB: blob.size / 1024 / 1024, messages: 0, files: ok, errors: fail, stats: [] });
}

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (!msg || msg.to !== 'offscreen') return false;
  if (msg.type === 'CANCEL') { cancelFlag = true; sendResponse({ ok: true }); return false; }
  if (msg.type === 'PAUSE') { pauseFlag = true; send('PAUSED', {}); sendResponse({ ok: true }); return false; }
  if (msg.type === 'RESUME') { pauseFlag = false; sendResponse({ ok: true }); return false; }
  if (msg.type === 'CLEAR_CACHE') { store.remove('incremental'); store.remove('retry'); store.remove('checkpoint'); sendResponse({ ok: true }); return false; }

  if (msg.type === 'SCAN') {
    if (running) { sendResponse({ ok: false, error: 'busy' }); return false; }
    running = true; sendResponse({ ok: true });
    (async () => {
      try { await doScan(msg.token, msg.targetId); }
      catch (e) { log('Scan failed: ' + e.message, 'ERR'); send('ERROR', { message: e.message }); }
      finally { running = false; }
    })();
    return false;
  }

  if (msg.type === 'LIST_CHANNELS') {
    (async () => {
      try { const data = await listChannels(msg.token, msg.guildIds); sendResponse({ ok: true, data }); }
      catch (e) { sendResponse({ ok: false, error: e.message }); }
    })();
    return true;
  }

  if (msg.type === 'EXPORT') {
    if (running) { sendResponse({ ok: false, error: 'busy' }); return false; }
    running = true; sendResponse({ ok: true });
    (async () => {
      try { await doExport(msg.token, msg.targetIds, msg.includeDM, msg.guildIds, {
        filters: msg.filters || {}, channelsByGuild: msg.channelsByGuild || {}
      }); }
      catch (e) { log('Export failed: ' + e.message, 'ERR'); send('ERROR', { message: e.message }); }
      finally { running = false; }
    })();
    return false;
  }

  if (msg.type === 'RETRY') {
    (async () => {
      try { await doRetry(msg.token, msg.targetId); sendResponse({ ok: true }); }
      catch (e) { sendResponse({ ok: false, error: e.message }); }
    })();
    return true;
  }

  return false;
});

console.log('[DX-offscreen] v10.3 +txt');