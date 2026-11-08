# 有余 · 投资组合

本地优先的投资组合账本。手机版与电脑版共用同一套数据、会计口径和备份格式。

## 访问入口

- 手机版：`/`
- 电脑版：`/pc/`

GitHub Pages 示例：

- 手机版：https://yc-develop.github.io/youyu/
- 电脑版：https://yc-develop.github.io/youyu/pc/

手机版和电脑版在同一浏览器下共用 `localStorage`，但 iPhone 与电脑之间不会自动同步。跨设备请继续使用「导出账本 / 导入账本」。

## 源码与构建

```text
youyu-src/js/          共用业务逻辑（数据、收益、图表、表单、导入导出）
youyu-src/styles.css   手机版样式
youyu-src/pc.css       电脑版布局覆盖
youyu-src/template.html
youyu-src/template-pc.html
build_youyu.py         一次构建手机版和电脑版
```

构建：

```bash
python3 build_youyu.py
```

输出：

```text
youyu.html          手机版单文件
index.html          手机版入口
youyu-pc.html       电脑版单文件
pc/index.html       电脑版入口
```

## 数据

- 真实账本：`yingji.portfolio.v1`
- 演示账本：`yingji.demo.v1`
- 主题：`yingji.theme.v1`

电脑版没有独立的存储键，因此同一浏览器内的手机版和电脑版读写同一份账本。
