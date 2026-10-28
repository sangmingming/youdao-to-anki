/*
 * 有道词典 → Anki · 内容脚本
 * 在有道搜索结果页注入「加入 Anki」按钮，点击后把当前词条发给背景脚本。
 * 有道页面是 SPA，通过监听 URL 变化处理连续查词。
 */
(function () {
  'use strict';

  const BTN_ID = 'anki-youdao-btn';

  function getCurrentWord() {
    const url = new URL(location.href);
    return (url.searchParams.get('word') || url.searchParams.get('q') || '').trim();
  }

  function pickTexts(selectors) {
    const out = [];
    const seen = new Set();
    for (const sel of selectors) {
      document.querySelectorAll(sel).forEach((el) => {
        const t = (el.innerText || el.textContent || '').trim();
        if (t && !seen.has(t)) { seen.add(t); out.push(t); }
      });
    }
    return out;
  }

  function collectEntry(word) {
    const phonetics = pickTexts(['.phone', '.word-phonetic', '.phonetic'])
      .map((t) => t.replace(/\s+/g, ' '))
      .filter((t) => t.length > 0 && t.length < 120);

    // 优先取「美」式音标，去掉"美"字只留音标符号
    let phonetic = '';
    const us = phonetics.find((t) => /美/.test(t));
    const src = us || phonetics[0] || '';
    if (src) {
      const m = src.match(/\[[^\]]+\]/) || src.match(/\/[^/]+\//);
      phonetic = m ? m[0] : src.replace(/^美\s*/, '');
    }

    // 简明释义：只取「简明」模块（.simple .basic .word-exp），按 "词性 释义" 配对
    let concise = [];
    document.querySelectorAll('.simple .basic .word-exp').forEach((li) => {
      const pos = (li.querySelector('.pos')?.textContent || '').trim();
      const tran = (li.querySelector('.trans')?.textContent || '').trim();
      if (tran) concise.push(pos ? `${pos} ${tran}` : tran);
    });
    // 兜底：旧版结构
    if (!concise.length) {
      concise = pickTexts([
        '.basic .trans li',
        '.trans-container li',
        '.trans',
        '.wordGroup li'
      ]).filter((t) => t.length < 160 && !/网络/.test(t)).slice(0, 6);
    }

    // 双语例句：英汉配对
    const examples = [];
    document.querySelectorAll('.blng_sents_part li, .bilingual li').forEach((li) => {
      const eng = (li.querySelector('.sen-eng')?.textContent || '').trim();
      const ch = (li.querySelector('.sen-ch')?.textContent || '').trim();
      if (eng) examples.push(ch ? `${eng}\n${ch}` : eng);
    });
    if (!examples.length) {
      pickTexts([
        '.mcols .sentence',
        '.sen .sentence',
        '.sentence li',
        '.bilingual .sentence'
      ]).filter((t) => t.length < 500).slice(0, 3).forEach((t) => examples.push(t));
    }

    return {
      word,
      phonetic,
      concise,
      examples,
      // type=2 为美式发音
      audio: 'https://dict.youdao.com/dictvoice?audio=' + encodeURIComponent(word) + '&type=2'
    };
  }

  function findAnchor(word) {
    const head = document.querySelector('.word-head');
    if (head) return head;
    const h1 = document.querySelector('h1');
    if (h1) return h1;
    if (word) {
      const els = document.querySelectorAll('span, div, b, strong');
      for (const el of els) {
        if ((el.innerText || '').trim() === word) return el;
        if (el.children.length > 3) break; // 避免深入正文
      }
    }
    return document.body;
  }

  function injectButton(entry) {
    document.getElementById(BTN_ID)?.remove();

    const btn = document.createElement('button');
    btn.id = BTN_ID;
    btn.type = 'button';
    btn.textContent = '＋ 加入 Anki';
    btn.addEventListener('click', () => sendToAnki(btn, entry));

    const anchor = findAnchor(entry.word);
    anchor.parentNode.insertBefore(btn, anchor.nextSibling);
  }

  async function sendToAnki(btn, entry) {
    btn.disabled = true;
    btn.textContent = '⏳ 导入中…';
    try {
      const resp = await chrome.runtime.sendMessage({ type: 'ADD_TO_ANKI', entry });
      if (resp.ok) {
        btn.textContent = resp.duplicate ? '✓ 已在 Anki 中' : '✓ 已加入 Anki';
        btn.classList.add('done');
      } else {
        btn.textContent = '✗ ' + (resp.error || '导入失败');
        btn.classList.add('failed');
      }
    } catch (e) {
      btn.textContent = '✗ 插件异常';
      btn.classList.add('failed');
    }
    btn.disabled = false;
    setTimeout(() => { btn.textContent = '＋ 加入 Anki'; btn.classList.remove('done', 'failed'); }, 4000);
  }

  function refresh() {
    const word = getCurrentWord();
    if (!word) return;
    // 等页面渲染出释义再收集
    setTimeout(() => injectButton(collectEntry(word)), 800);
  }

  // SPA：监听 URL 变化（有道跳转不刷新页面）
  let lastUrl = location.href;
  setInterval(() => {
    if (location.href !== lastUrl) { lastUrl = location.href; refresh(); }
  }, 500);

  refresh();
})();
