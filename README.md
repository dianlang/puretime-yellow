# PureTime·黄

基于用户提供的《PureTime·黄》原稿制作的中文网页视觉小说，使用 WebGAL 引擎。

## 当前版本

游戏转换器覆盖原稿的序章与第一至第五节：408 个正文段落、480 个阅读页面。保留原文顺序和现有结尾，不新增剧情分支。WebGAL 提供逐字显示、自动播放、历史记录、存档、读档和设置。

程序包含六张原创简化矢量场景、黄昏色调的标题与对话界面，以及原创合成环境声。引擎固定为 WebGAL 4.6.4，构建时校验官方发行包 SHA-256。

**这个公开仓库目前保存程序代码。剧本原文、原始设定图及据此整理的立绘，需要作者确认公开后再上传。** 因此当前仓库还不能单独构建完整游戏。

## 准备素材

将现有原稿提取为 `source/original.txt`，保持段落间的空行。使用 Pandoc 的 plain 输出可复现当前段落索引：

```sh
pandoc source/original.docx -t plain -o source/original.txt
```

将透明角色图放入 `game/figure/`：

| 文件 | 对应角色 | 当前整理情况 |
| --- | --- | --- |
| `flower.png` | 小花 | 已整理，尚未公开上传 |
| `clerk.png` | 店员小姐 | 已整理，尚未公开上传 |
| `witch.png` | 魔女 | 透明处理失败，当前暂不显示 |

角色文件缺失时不会引用坏图。补入 `witch.png` 后重新构建，即会在对应场景显示魔女。玛丽安没有对应的用户立绘，不借用其他角色的图像。

## 构建与运行

需要 Node.js 20 或更高版本，以及 `curl`、`unzip`。本工程没有 npm 依赖，无需 `npm install`。

```sh
npm run build
npm run serve
```

在浏览器打开 `http://localhost:8080`。`serve` 使用 Python 3；也可以使用其他静态 HTTP 服务器提供 `dist/`。不能直接用 `file://` 双击运行：WebGAL 需要通过 HTTP 读取剧本。

构建完成后，`dist/` 就是可以部署到静态网站托管服务的完整 HTML 游戏。不要把原稿目录作为网站根目录。手机建议横屏；iPhone 横屏后刷新。

## 修改与检查

- `scripts/convert-story.mjs`：原稿分页、说话人索引和场景演出。原稿结构改变时需同步更新索引；结构检查会阻止错位构建。
- `game/background/`：可直接修改的 SVG 场景。
- `game/template/`：WebGAL 原生标题和对话框样式。
- `web/`：启动页样式、作品信息和界面辅助代码。
- `scripts/make-audio.mjs`：合成环境声与提示音。
- `npm run check`：比较原稿、分页映射与实际游戏台词，验证章节和素材引用。

当前完成的是构建和静态检查，未进行浏览器端逐页试玩。存档属于当前浏览器，清除网站数据会丢失存档。

## 素材与引擎

原稿和原画版权归各自权利人所有；仓库公开可见不构成对这些素材的重新授权。白发魔女原图标注作者「@汉莫拉比大神」。透明立绘整理使用了图像生成工具，部分细节与原设定图不同。

没有收录原文提及的商业歌曲录音。WebGAL 来自 [OpenWebGAL/WebGAL 4.6.4](https://github.com/OpenWebGAL/WebGAL/releases/tag/4.6.4)，许可证保存在 `licenses/WebGAL-LICENSE.txt`。
