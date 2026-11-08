from pathlib import Path

root = Path(__file__).resolve().parent
src = root / 'youyu-src'
parts = sorted((src / 'js').glob('*.js'))
app = "/* 有余 · 投资组合 */\n(function(){\n'use strict';\n" + "\n\n".join(p.read_text() for p in parts) + "\n})();\n"
if '</script' in app:
    raise SystemExit('app contains </script>')


def build(template_name, style_names, outputs):
    template = (src / template_name).read_text()
    style = "\n\n".join((src / name).read_text() for name in style_names)
    html = template.replace('/*__STYLE__*/', style).replace('/*__APP__*/', app)
    for out in outputs:
        out.parent.mkdir(parents=True, exist_ok=True)
        out.write_text(html)
        print('built', out, f'{out.stat().st_size / 1024:.1f} KB')


# 手机版：保持原入口与单文件
build('template.html', ['styles.css'], [root / 'youyu.html', root / 'index.html'])

# 电脑版：同一个 GitHub Pages 下的 /pc/ 入口，并保留单文件
build(
    'template-pc.html',
    ['styles.css', 'pc.css'],
    [root / 'youyu-pc.html', root / 'pc' / 'index.html'],
)

print('js parts', len(parts))
