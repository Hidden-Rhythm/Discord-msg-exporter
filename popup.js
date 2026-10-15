// language: JavaScript (Chrome MV3 popup)
// file: popup.js

const $ = (id) => document.getElementById(id);
let scanResult = null;
let offscreenReady = false;
let channelPicker = {};

async function ensureOffscreen() {
  if (offscreenReady) return true;
  const ctxs = await chrome.runtime.getContexts({ contextTypes: ['OFFSCREEN_DOCUMENT'] });
  if (!ctxs.length) {
    try {
      await chrome.offscreen.createDocument({ url: 'offscreen.html', reasons: ['BLOBS'], justification: 'Discord export worker' });
    } catch (e) { if (!String(e).includes('single offscreen')) return false; }
  }
  offscreenReady = true;
  return true;
}
function setStatus(t, k) { const el = $('status'); el.textContent = t; el.className = 'pill' + (k ? ' ' + k : ''); }
function log(l) { const el = $('log'); el.textContent += (el.textContent ? '\n' : '') + l; el.scrollTop = el.scrollHeight; }
function clearLog() { $('log').textContent = ''; }
function setProgress(p, t) { $('bar').style.width = Math.max(0, Math.min(100, p || 0)) + '%'; $('ptxt').textContent = t || ''; }
function resetBtns() {
  $('scanBtn').disabled = false; $('scanBtn').textContent = 'Scan';
  $('exportBtn').disabled = false; $('exportBtn').textContent = 'Export Selected';
  $('runCtl').style.display = 'none';
  $('pauseBtn').style.display = ''; $('resumeBtn').style.display = 'none';
}

(async function init() {
  const saved = await chrome.storage.local.get(['token', 'target']);
  if (saved.token) $('token').value = saved.token;
  if (saved.target) $('target').value = saved.target;
  renderTargetList();
  $('token').addEventListener('blur', () => chrome.storage.local.set({ token: $('token').value.trim() }));
  $('target').addEventListener('input', () => { renderTargetList(); chrome.storage.local.set({ target: $('target').value.trim() }); });
  $('scanBtn').disabled = false;
  setStatus('ready', 'ok');
})();

function esc(s) { return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]); }
function parseTargets() {
  return $('target').value.split(/[,\s\n]+/).map((s) => s.trim()).filter((s) => /^\d{15,25}$/.test(s));
}
function renderTargetList() {
  const list = parseTargets();
  $('targetList').innerHTML = list.map((id) => `<span class="tag">${id}</span>`).join('');
}

function collectFilters() {
  return {
    dateFrom: $('dateFrom').value || null,
    dateTo: $('dateTo').value || null,
    keyword: $('kw').value.trim() || null,
    minLen: parseInt($('minLen').value, 10) || 0,
    chanWhite: $('chanWhite').value.trim() || null,
    chanBlack: $('chanBlack').value.trim() || null,
    attachOnly: $('attachOnly').checked,
    replyOnly: $('replyOnly').checked,
    includeThreads: $('includeThreads').checked,
    includeForwards: $('includeForwards').checked,
    incremental: $('incremental').checked,
    includeAvatars: $('includeAvatars').checked,
    reactionDetail: $('reactionDetail').checked,
    linkPreviews: $('linkPreviews').checked,
    mediaGallery: $('mediaGallery').checked,
    threadView: $('threadView').checked
  };
}

function getChecked() {
  const checked = Array.from(document.querySelectorAll('#list input[type=checkbox]:checked'));
  const includeDM = checked.some((c) => c.classList.contains('dmchk'));
  const guildIds = checked.filter((c) => c.classList.contains('gchk')).map((c) => c.dataset.id);
  return { includeDM, guildIds };
}

$('clearCache').addEventListener('click', async () => {
  await chrome.storage.local.remove(['dx_incremental', 'dx_checkpoint', 'dx_retry']);
  await chrome.runtime.sendMessage({ to: 'offscreen', type: 'CLEAR_CACHE' }).catch(() => {});
  log(`[+] cleared caches`);
});

$('scanBtn').addEventListener('click', async () => {
  const token = $('token').value.trim();
  const targets = parseTargets();
  if (!token) { setStatus('paste token', 'err'); return; }
  if (!targets.length) { setStatus('invalid user id', 'err'); return; }
  await chrome.storage.local.set({ token, target: $('target').value.trim() });
  await ensureOffscreen();
  $('scanBtn').disabled = true; $('scanBtn').textContent = 'Scanning…';
  $('exportBtn').style.display = 'none'; $('panel').classList.remove('open');
  clearLog(); setProgress(0, ''); setStatus('scanning', 'warn');
  scanResult = null;
  try {
    const res = await chrome.runtime.sendMessage({ to: 'offscreen', type: 'SCAN', token, targetId: targets[0] });
    if (!res || !res.ok) throw new Error((res && res.error) || 'scan failed');
  } catch (e) { setStatus('scan failed', 'err'); log('[x] ' + e.message); resetBtns(); }
});

$('exportBtn').addEventListener('click', async () => {
  if (!scanResult) return;
  const token = $('token').value.trim();
  const targets = parseTargets();
  if (!targets.length) { setStatus('no targets', 'err'); return; }
  const { includeDM, guildIds } = getChecked();
  if (!includeDM && guildIds.length === 0) { setStatus('nothing selected', 'err'); return; }

  const channelsByGuild = {};
  for (const gid of guildIds) {
    const set = channelPicker[gid];
    if (set && set.size) channelsByGuild[gid] = Array.from(set);
  }

  $('exportBtn').disabled = true; $('exportBtn').textContent = 'Running…';
  $('scanBtn').disabled = true;
  $('runCtl').style.display = 'flex';
  $('retryBtn').style.display = 'none';
  clearLog(); setProgress(0, 'starting…'); setStatus('exporting', 'warn');
  log(`[+] DM: ${includeDM}, guilds: ${guildIds.length}`);
  try {
    const res = await chrome.runtime.sendMessage({
      to: 'offscreen', type: 'EXPORT', token, targetIds: targets, includeDM, guildIds,
      filters: collectFilters(), channelsByGuild
    });
    if (!res || !res.ok) throw new Error((res && res.error) || 'export failed');
  } catch (e) { setStatus('export failed', 'err'); log('[x] ' + e.message); resetBtns(); }
});

$('pauseBtn').addEventListener('click', async () => {
  await chrome.runtime.sendMessage({ to: 'offscreen', type: 'PAUSE' });
  $('pauseBtn').style.display = 'none'; $('resumeBtn').style.display = '';
  setStatus('paused', 'warn');
});
$('resumeBtn').addEventListener('click', async () => {
  await chrome.runtime.sendMessage({ to: 'offscreen', type: 'RESUME' });
  $('pauseBtn').style.display = ''; $('resumeBtn').style.display = 'none';
  setStatus('exporting', 'warn');
});
$('cancelBtn').addEventListener('click', async () => {
  await chrome.runtime.sendMessage({ to: 'offscreen', type: 'CANCEL' });
  setStatus('cancelling…', 'warn');
});
$('retryBtn').addEventListener('click', async () => {
  const token = $('token').value.trim();
  const target = parseTargets()[0];
  $('retryBtn').disabled = true;
  clearLog();
  try {
    const res = await chrome.runtime.sendMessage({ to: 'offscreen', type: 'RETRY', token, targetId: target });
    if (!res || !res.ok) throw new Error((res && res.error) || 'retry failed');
  } catch (e) { log('[x] ' + e.message); $('retryBtn').disabled = false; }
});

function renderScan(data) {
  scanResult = data;
  resetBtns();
  clearLog(); setProgress(0, '');
  const list = $('list'); list.innerHTML = '';
  channelPicker = {};

  if (data.dm) {
    const r = document.createElement('label'); r.className = 'r dm';
    r.innerHTML = `<input type="checkbox" class="dmchk" checked data-id="${data.dm.id}">
      <span class="nm">${esc(data.dm.name)}</span><span class="tg">DM</span>`;
    list.appendChild(r);
  }
  for (const g of data.guilds) {
    const r = document.createElement('label'); r.className = 'r gd';
    r.innerHTML = `<input type="checkbox" class="gchk" checked data-id="${g.id}">
      <span class="nm">${esc(g.name)}</span><span class="tg">${g.count || 0} msgs</span>`;
    list.appendChild(r);
  }
  if (!data.dm && data.guilds.length === 0) {
    list.innerHTML = '<div style="padding:14px;color:#949ba4;font-size:12px;">nothing found</div>';
    $('exportBtn').style.display = 'none'; $('panel').classList.add('open');
    setStatus('nothing found', 'warn'); return;
  }
  $('pTitle').textContent = `${data.dm ? 'DM + ' : ''}${data.guilds.length} server(s)`;
  $('panel').classList.add('open');
  $('exportBtn').style.display = 'block';
  setStatus(`found ${data.dm ? 'DM + ' : ''}${data.guilds.length}`, 'ok');
}

$('allBtn').addEventListener('click', () => document.querySelectorAll('#list input[type=checkbox]').forEach((cb) => cb.checked = true));
$('noneBtn').addEventListener('click', () => document.querySelectorAll('#list input[type=checkbox]').forEach((cb) => cb.checked = false));

$('chBtn').addEventListener('click', async () => {
  if (!scanResult) return;
  const token = $('token').value.trim();
  const targetId = parseTargets()[0];
  const selected = Array.from(document.querySelectorAll('#list input.gchk:checked')).map((c) => c.dataset.id);
  if (!selected.length) { log('[!] select a server first'); return; }
  log(`[+] loading channels…`);
  setStatus('loading…', 'warn');
  try {
    const res = await chrome.runtime.sendMessage({ to: 'offscreen', type: 'LIST_CHANNELS', token, targetId, guildIds: selected });
    if (!res || !res.ok) throw new Error((res && res.error) || 'failed');
    for (const gid of selected) {
      const channels = res.data[gid] || [];
      if (!channels.length) continue;
      const header = document.querySelector(`#list input.gchk[data-id="${gid}"]`)?.closest('.r');
      if (!header) continue;
      const wrap = document.createElement('div');
      for (const c of channels) {
        const sub = document.createElement('label'); sub.className = 'r sub';
        sub.innerHTML = `<input type="checkbox" class="cchk" data-guild="${gid}" data-id="${c.id}" checked><span class="nm">#${esc(c.name)}</span>`;
        wrap.appendChild(sub);
      }
      header.after(wrap);
      channelPicker[gid] = new Set(channels.map((c) => c.id));
    }
    document.querySelectorAll('#list input.cchk').forEach((cb) => {
      cb.addEventListener('change', () => {
        const gid = cb.dataset.guild;
        if (!channelPicker[gid]) channelPicker[gid] = new Set();
        if (cb.checked) channelPicker[gid].add(cb.dataset.id);
        else channelPicker[gid].delete(cb.dataset.id);
      });
    });
    setStatus('channels loaded', 'ok');
  } catch (e) { setStatus('failed', 'err'); log('[x] ' + e.message); }
});

chrome.runtime.onMessage.addListener((msg) => {
  if (!msg || msg.to !== 'popup') return;
  switch (msg.type) {
    case 'LOG': log(msg.line); break;
    case 'PROGRESS': setProgress(msg.percent || 0, msg.label || ''); break;
    case 'SCAN_RESULT': renderScan(msg.data); break;
    case 'VERIFY_LINE': log(msg.line); break;
    case 'VERIFY_DONE':
      log(''); log('═══════════ summary ═══════════');
      log(`  servers with messages: ${msg.withHits} / ${msg.total}`);
      log(`  total exported:        ${msg.totalMsgs} msgs · ${msg.totalFiles || 0} files`);
      if (msg.shortfall.length) log(`  [!] partial: ${msg.shortfall.join(', ')}`);
      break;
    case 'DONE':
      setStatus('done', 'ok');
      setProgress(100, `complete — ${msg.messages} msgs · ${msg.files} files`);
      log(`[+] saved ${msg.filename} (${msg.sizeMB.toFixed(2)} MB)`);
      if (msg.stats) for (const s of msg.stats) log('   ' + s);
      if (msg.failedCount > 0) { $('retryBtn').style.display = 'block'; $('retryBtn').textContent = `Retry ${msg.failedCount} Failed`; }
      resetBtns();
      break;
    case 'ERROR': setStatus('error', 'err'); log('[x] ' + msg.message); resetBtns(); break;
    case 'CANCELLED': setStatus('cancelled', 'warn'); log('[!] cancelled'); resetBtns(); break;
    case 'PAUSED': setStatus('paused', 'warn'); break;
  }
});