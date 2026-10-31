from pathlib import Path

root = Path(__file__).resolve().parent
src = root / 'youyu-src'
template = (src / 'template.html').read_text()
style = (src / 'styles.css').read_text()
parts = sorted((src / 'js').glob('*.js'))
app = "/* 有余 · 投资组合 */\n(function(){\n'use strict';\n" + "\n\n".join(p.read_text() for p in parts) + "\n})();\n"
if '</script' in app:
    raise SystemExit('app contains </script>')
html = template.replace('/*__STYLE__*/', style).replace('/*__APP__*/', app)
out = root / 'youyu.html'
out.write_text(html)
# GitHub Pages 直接使用仓库根目录，保持 index.html 同步
index = root / 'index.html'
index.write_text(html)
print('built', out, f'{out.stat().st_size / 1024:.1f} KB', 'js parts', len(parts))
print('built', index)
