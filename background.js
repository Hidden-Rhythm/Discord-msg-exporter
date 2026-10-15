// language: JavaScript (Chrome MV3 service worker)
// file: background.js

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (!msg || msg.to !== 'background') return false;
  if (msg.type === 'DOWNLOAD') {
    chrome.downloads.download({ url: msg.url, filename: msg.filename, saveAs: false }, (id) => {
      if (chrome.runtime.lastError) sendResponse({ ok: false, error: chrome.runtime.lastError.message });
      else sendResponse({ ok: true, id });
    });
    return true;
  }
  return false;
});

console.log('[DX-background] ready');