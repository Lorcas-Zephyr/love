# 我们的日常

正式网页入口为根目录的 `index.html`，只包含整理结果中标为“精选”的 113 张照片，以及新加入的“我们相识啦”截图，共 114 张图片。其余“保留”和“暂不展示”的照片不会进入正式页，也没有删除本地原图。

新增回忆为 **2025-10-30 · 我们相识啦**，日期取自截图中的成为好友日期。截图缩略图突出中间的友谊时间线卡片，点开后展示完整截图。

首页使用你们在南京的精选合照作为整屏背景，下方为按时间排列的时间轴。点击任意日子打开弹窗，显示你写的那句话、日期时间、地点，以及当天叠放的精选照片。点击照片、左右按钮或键盘左右键可以翻看。没有填写标题的日期使用“那天的我们”；三张未标日期的信件照片位于时间轴最后一项。首页的相识天数按北京时间自动计算。

## 本地预览

在项目根目录运行：

```bash
python -m http.server 4174 --bind 127.0.0.1
```

浏览器打开 `http://127.0.0.1:4174/`。也可以直接打开 `index.html`。筛选页保留在 `photo-review/`。

## 更新内容

本次整理结果已备份到 `content/selection.json`，新增截图保存在 `content/我们相识啦.png`。要根据更新后的筛选结果重新生成素材，将新导出的 JSON 替换到 `content/selection.json`，然后运行：

```bash
python scripts/build_site.py
```

需要 Python 和 Pillow，以及本地 `photo-review/` 的索引和图片副本。生成脚本只复制精选照片，并验证输出目录中没有额外的图片；如果以后取消了某张精选，它会提示已有的额外文件，便于先核对再处理。

网页是纯静态站点，页面和图片使用相对路径。它不依赖图床、接口或外部字体。

## GitHub Pages

仓库为 `Lorcas-Zephyr/love`，适配当前已开启的分支发布设置：**Settings → Pages → Build and deployment → Source: Deploy from a branch → main → / (root)**。

网页文件位于仓库根目录，`.nojekyll` 使 Pages 直接发布静态文件。推送到 `main` 后，GitHub 自带的 **pages build and deployment** 会自动发布，不需要额外工作流或在线重新处理原图。

当前访问地址为 `https://lorcas.top/love/`，GitHub 默认地址 `https://lorcas-zephyr.github.io/love/` 会跳转到这个域名。此项目使用账户站点的已有域名，不另行添加根域名的 `CNAME` 文件。

原始压缩包、全部原图、整理工具和完整的筛选导出已在根目录 `.gitignore` 中排除。公开网页文件为 `index.html`、`styles.css`、`app.js`、`data.js`、`icon.svg`、`.nojekyll` 和 `assets/`；`content/` 是本地可重建的源资料，不会推送。
