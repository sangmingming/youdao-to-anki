'use strict';

const deckInput = document.getElementById('deck');
const statusEl = document.getElementById('status');

chrome.storage.sync.get({ deck: '有道生词' }, ({ deck }) => {
  deckInput.value = deck;
});

document.getElementById('save').addEventListener('click', async () => {
  const deck = deckInput.value.trim() || '有道生词';
  await chrome.storage.sync.set({ deck });
  showStatus('✓ 已保存', 'ok');
});

document.getElementById('ping').addEventListener('click', async () => {
  showStatus('正在连接…', '');
  const resp = await chrome.runtime.sendMessage({ type: 'PING_ANKI' });
  if (resp.ok) {
    showStatus('✓ 已连接 AnkiConnect（API v' + resp.version + '）', 'ok');
  } else {
    showStatus('✗ 连接失败：' + resp.error + '（请确认 Anki 已打开且已安装 AnkiConnect）', 'err');
  }
});

function showStatus(text, cls) {
  statusEl.textContent = text;
  statusEl.className = cls;
}
