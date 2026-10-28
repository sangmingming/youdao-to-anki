# 有道词典 → Anki

一个 Chrome 扩展（Manifest V3）：在有道词典搜索结果页一键将单词（音标、释义、例句）加入 Anki，基于 [AnkiConnect](https://foosoft.net/projects/anki-connect)。

## 功能

- 在有道词典（`www.youdao.com/result*`、`dict.youdao.com`）查词页面注入「加入 Anki」按钮
- 自动抓取单词的音标、释义和例句
- 通过 AnkiConnect 将卡片写入指定牌组
- 弹出设置页：自定义目标牌组名称、测试 AnkiConnect 连接

## 安装

1. 在 Anki 中安装 AnkiConnect 插件（插件代码 `2055492159`），并保持 Anki 运行
2. 打开 Chrome，进入 `chrome://extensions/`
3. 开启右上角「开发者模式」
4. 点击「加载已解压的扩展程序」，选择本仓库目录
5. 点击扩展图标，设置目标牌组名称，并测试连接

## 使用

在有道词典查询任意单词，点击结果页中的「加入 Anki」按钮即可。

## 项目结构

| 文件 | 说明 |
| --- | --- |
| `manifest.json` | 扩展清单（MV3） |
| `content.js` | 内容脚本：抓取单词信息并注入按钮 |
| `content.css` | 注入按钮的样式 |
| `background.js` | Service Worker：与 AnkiConnect 通信 |
| `popup.html` / `popup.js` | 设置弹窗：牌组配置与连接测试 |

## License

MIT
