/*
 * 有道词典 → Anki · 背景脚本（MV3 Service Worker）
 * 负责与本地 AnkiConnect（127.0.0.1:8765）通信：
 *  - 自动创建目标牌组
 *  - 自动创建卡片模板「Youdao-Basic」（Word / Phonetic / Concise / Examples / Audio，含美式发音）
 *  - 导入前去重（牌组内同词不重复添加）
 */
'use strict';

const ANKI_URL = 'http://127.0.0.1:8765';
const MODEL_NAME = 'Youdao-Basic';
const DEFAULT_DECK = '有道生词';
const FIELDS = ['Word', 'Phonetic', 'Concise', 'Examples', 'Audio'];

function sameFields(a, b) { return a.join('|') === b.join('|'); }

const MODEL_CSS = `
  .card { font-family: -apple-system, "Segoe UI", sans-serif; font-size: 22px; text-align: center; padding: 24px; line-height: 1.6; }
  .word { font-size: 30px; font-weight: 700; }
  .phonetic { color: #888; font-size: 18px; margin: 6px 0 14px; }
  .back { text-align: left; font-size: 20px; }
  .back ul { margin: 0; padding-left: 1.2em; }
  .back li { margin: 5px 0; }
  .examples { margin-top: 16px; color: #666; font-size: 15px; border-top: 1px dashed #ddd; padding-top: 10px; text-align: left; }
  .examples p { margin: 4px 0; }
`;

const MODEL_TEMPLATE = {
  Name: '正面→背面',
  Front: `<div class="word">{{Word}}</div><div class="phonetic">{{Phonetic}}</div><div>{{Audio}}</div>`,
  Back: `{{FrontSide}}<hr id="answer"><div class="back">{{Concise}}</div><div class="examples">{{Examples}}</div>`
};

async function getDeck() {
  const { deck } = await chrome.storage.sync.get({ deck: DEFAULT_DECK });
  return deck || DEFAULT_DECK;
}

async function invoke(action, params = {}) {
  const res = await fetch(ANKI_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action, version: 6, params })
  });
  if (!res.ok) throw new Error('AnkiConnect 无响应（' + res.status + '）');
  const data = await res.json();
  if (data.error) throw new Error(data.error);
  return data.result;
}

async function ensureDeck(deck) {
  const decks = await invoke('deckNames');
  if (!decks.includes(deck)) await invoke('createDeck', { deck });
}

// 找一个字段结构匹配的模板：优先默认名，已存在但结构不符时改用 v2、v3…
// 不原地升级，兼容不支持 updateModel* 接口的旧版 AnkiConnect。
async function ensureModel() {
  const models = await invoke('modelNames');
  const candidates = [MODEL_NAME];
  for (let i = 2; i < 50; i++) candidates.push(`${MODEL_NAME}-v${i}`);

  for (const name of candidates) {
    if (!models.includes(name)) {
      await invoke('createModel', {
        modelName: name,
        inOrderFields: FIELDS,
        css: MODEL_CSS,
        isCloze: false,
        cardTemplates: [MODEL_TEMPLATE]
      });
      return name;
    }
    const fields = await invoke('modelFieldNames', { modelName: name });
    if (sameFields(fields, FIELDS)) return name;
  }
  throw new Error('找不到可用的模板名');
}

function buildList(items) {
  if (!items || !items.length) return '';
  return '<ul>' + items.map((t) => `<li>${escapeHtml(t)}</li>`).join('') + '</ul>';
}

function buildExamples(items) {
  if (!items || !items.length) return '';
  return items.map((t) => `<p>${escapeHtml(t).replace(/\n/g, '<br>')}</p>`).join('');
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
  ));
}

async function addToAnki(entry) {
  const deck = await getDeck();
  await ensureDeck(deck);
  await ensureModel();

  // 去重：同一牌组内已存在该词则跳过
  const found = await invoke('findNotes', { query: `"deck:${deck}" "Word:${entry.word}"` });
  if (found && found.length) return { ok: true, duplicate: true };

  const modelName = await ensureModel();

  const note = {
    deckName: deck,
    modelName,
    fields: {
      Word: entry.word,
      Phonetic: entry.phonetic || '',
      Concise: buildList(entry.concise),
      Examples: buildExamples(entry.examples),
      Audio: ''
    },
    // 由 AnkiConnect 下载美式发音并挂到 Audio 字段
    audio: [{
      url: entry.audio,
      filename: `${entry.word}_us.mp3`,
      fields: ['Audio']
    }],
    tags: ['youdao'],
    options: { allowDuplicate: false, duplicateScope: 'deck' }
  };
  const noteId = await invoke('addNote', { note });
  return { ok: true, duplicate: false, noteId };
}

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === 'ADD_TO_ANKI') {
    addToAnki(msg.entry)
      .then(sendResponse)
      .catch((e) => sendResponse({ ok: false, error: e.message || String(e) }));
    return true; // 异步响应
  }
  if (msg.type === 'PING_ANKI') {
    invoke('version')
      .then((v) => sendResponse({ ok: true, version: v }))
      .catch((e) => sendResponse({ ok: false, error: e.message || String(e) }));
    return true;
  }
  if (msg.type === 'LIST_DECKS') {
    invoke('deckNames')
      .then((decks) => sendResponse({ ok: true, decks }))
      .catch((e) => sendResponse({ ok: false, error: e.message || String(e) }));
    return true;
  }
});
