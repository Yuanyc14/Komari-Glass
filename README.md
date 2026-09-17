# Komari Glass

![Komari Glass 预览](public/preview.png)

技术栈：`bun` + `TypeScript` + `React` + `Next.js`。

开发环境需要 Bun 1.3.x 和 Node.js 24，由 Bun 运行脚本、Next.js CLI 使用官方 Node 运行时。

## 开发

```bash
# 安装依赖
bun install

# 本地开发
bun run dev
```

## 构建与安装

```bash
bun run build
```

会生成：

- `dist/` — 静态站点（含 `index.html`）
- `release/komari-theme-glass-v*.zip` — 可直接上传到 Komari 的主题包

在 Komari 后台：**主题 → 上传 ZIP → 启用**。

启用后可在“主题设置 → 基础外观”中：

- 通过“毛玻璃不透明度 (%)”统一调整总览、服务器卡片和内部信息块；数值越低越通透。
- 通过“文字对比度增强程度 (%)”增强复杂背景上的文字对比度；浅色模式向纯黑增强，深色模式向纯白增强，切换模式不会改动设置值。
- 通过“字体加粗”开关统一加粗普通文字，同时保留标题原有的粗细层级。

### ZIP 结构

```
komari-theme-glass-xxx.zip
├── komari-theme.json
├── preview.png
└── dist/
    ├── index.html
    └── ...
```


## 兼容性

- 目标服务端：**Komari 1.3.0+**
- 数据接口：`/api/rpc2`、`/api/clients`（WS）
- 特殊路径不接管：`/admin`、`/terminal` 仍由官方界面处理
- 页脚保留：`Powered by Komari Monitor.`

## License

[MIT](LICENSE)

