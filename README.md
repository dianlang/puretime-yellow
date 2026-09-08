# PureTime·黄

基于《PureTime·黄》原稿的中文网页视觉小说，使用固定版本 WebGAL 4.6.4。

## 当前可玩内容

- 序章及第一至第五节，共 408 个正文段落、480 个阅读页面，忠于原稿顺序和现有结尾。
- 小花、店员小姐、魔女、玛丽安四张透明立绘，采用最多两人同屏的对话构图。
- 同一段对话保持站位；说话人轻微放大，倾听者降低亮度，旁白和画外音恢复自然亮度。
- 咖啡厅回忆与公路旅程使用各自的出场角色，不从相邻章节借用人物。酒保小姐没有立绘，保留画外音。
- 自动播放、历史记录、存档、读档和设置由 WebGAL 提供；保留手机横屏提示和简化的工具栏。
- 原稿、原始设定图和游戏素材已获用户确认公开。本仓库可完整构建，无需另行导入已有素材。

完整演出设计和可调整位置见 [演出说明](docs/direction.md)。

## Windows 本地试玩

1. 下载仓库 ZIP 并**完整解压**。
2. 安装 Node.js 20 或更高版本。
3. 双击 `start-game.cmd`，等待首次下载引擎。
4. 在浏览器打开 **http://127.0.0.1:8080**，保持命令窗口打开。

Windows 10/11 使用系统自带的 `curl.exe` 和 `tar.exe`。不需要 Python，也没有 npm 依赖。首次下载若遇到网络问题，可手动下载 [官方引擎 ZIP](https://github.com/OpenWebGAL/WebGAL/releases/download/4.6.4/WebGAL-4.6.4-web.zip)，放到项目的 `.cache/WebGAL-4.6.4-web.zip` 后重试；构建会检查完整性。

Windows 启动分支使用系统 tar；目前构建验证在 Linux 环境完成，尚未在 Windows 上实际运行该批处理。

## VS Code / 终端

在项目根目录执行：

```sh
npm start
```

也可以分开构建与启动：

```sh
npm run build
npm run serve
```

macOS / Linux 还需要 `curl` 和 `unzip`。构建生成的 `dist/` 是完整 HTML 游戏，可交给静态 HTTP 服务托管。**不能双击 `index.html` 用 file:// 运行**，因为引擎需要读取剧本文件。

修改源码后重新运行 `npm run build`，然后刷新浏览器。服务仅监听本机；Ctrl+C 停止。重新构建会清空并重新生成 `dist/`，请在源码目录修改。

## 如何改游戏

| 想改什么 | 修改位置 |
| --- | --- |
| 人物大小、高低、左右构图 | `game/presentation.json` |
| 立绘图片 | `game/figure/`，保持下表文件名 |
| 台词、原稿 | `source/original.txt` |
| 说话人、段落演出、切场 | `scripts/convert-story.mjs` |
| 入场、说话人聚焦 | `scripts/enhance-scenes.mjs` |
| 标题页、对话框 | `game/template/` |
| 横屏提示、工具栏 | `web/puretime-ui.js`、`web/puretime.css` |
| 背景 | `game/background/` |
| 原创环境声 | `scripts/make-audio.mjs` |

| 立绘文件 | 角色 |
| --- | --- |
| `flower.png` | 小花 |
| `clerk.png` | 店员小姐 |
| `witch.png` | 魔女 |
| `marian.png` | 玛丽安 |

原稿 Word 文件在 `source/original.docx`，三张最初的设定图在 `source/art/`。现有四张透明立绘使用仓库维护者新上传的版本。

`game/scene/` 是构建生成的可读 WebGAL 脚本；直接修改它们后再次构建会被转换器覆盖。建议改原稿和转换器。增删原稿段落后需同步更新说话人及章节索引，结构检查会阻止错位构建。若需用 WebGAL Terre 编辑，先构建，再把 `dist/game/` 导入自己的游戏工程；之后注意自行维护两边修改。

## 验证与已知限制

`npm run check` 检查原稿是否完整、实际游戏台词是否一致、章节和素材引用是否有效、角色是否误入场景，以及聚焦时是否被画面边缘裁切。当前已通过构建与静态检查，未进行浏览器逐页试玩。

现有立绘都是静态单表情图，没有 Live2D 或配音；场景是简化矢量背景。手机需要横屏阅读；竖屏遮罩出现时暂停自动播放和快进。存档保存在当前浏览器中，不会自动跨设备同步。

## 素材与引擎

原稿和原画版权归各自权利人所有，公开上传不构成重新授权。最初的白发魔女设定图标注「@汉莫拉比大神」。

环境声与提示音由代码原创合成，没有收录原文提及的商业歌曲录音。引擎来自 [OpenWebGAL/WebGAL 4.6.4](https://github.com/OpenWebGAL/WebGAL/releases/tag/4.6.4)，许可证保存在 `licenses/WebGAL-LICENSE.txt`。演出参数参照 [WebGAL 官方变换说明](https://docs.openwebgal.com/script-reference/others/transform-reference.html)。
