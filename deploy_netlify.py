#!/usr/bin/env python3
"""构建 有余，并发布到已有的 Netlify 站点。

用法：
  python3 deploy_netlify.py --list                     # 列出当前 token 可访问的站点
  python3 deploy_netlify.py --site <site-id或站点名>    # 发布到指定站点
  python3 deploy_netlify.py                            # 使用 .netlify-site-id 中保存的站点

Token 读取顺序：环境变量 NETLIFY_AUTH_TOKEN -> 工作区 .netlify-token
站点读取顺序：--site -> 环境变量 NETLIFY_SITE_ID -> 工作区 .netlify-site-id
"""
from __future__ import annotations

import argparse
import json
import os
import subprocess
import sys
import time
import urllib.error
import urllib.request
import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parent
API = "https://api.netlify.com/api/v1"
TOKEN_FILE = ROOT / ".netlify-token"
SITE_FILE = ROOT / ".netlify-site-id"
BUILD_SCRIPT = ROOT / "build_youyu.py"
HTML_FILE = ROOT / "youyu.html"
ZIP_FILE = ROOT / "youyu-netlify.zip"
TEAM_SLUG = "cong-yu"


def read_token() -> str:
    return (os.environ.get("NETLIFY_AUTH_TOKEN") or "").strip() or (
        TOKEN_FILE.read_text().strip() if TOKEN_FILE.exists() else ""
    )


def read_saved_site() -> str:
    return (os.environ.get("NETLIFY_SITE_ID") or "").strip() or (
        SITE_FILE.read_text().strip() if SITE_FILE.exists() else ""
    )


def api(path: str, token: str, method: str = "GET", data=None, content_type=None):
    headers = {"Authorization": f"Bearer {token}", "Accept": "application/json"}
    if content_type:
        headers["Content-Type"] = content_type
    req = urllib.request.Request(API + path, data=data, method=method, headers=headers)
    try:
        with urllib.request.urlopen(req, timeout=60) as resp:
            raw = resp.read()
            return json.loads(raw) if raw else {}
    except urllib.error.HTTPError as e:
        detail = e.read().decode("utf-8", "replace")[:500]
        raise SystemExit(f"Netlify API 失败 ({e.code})：{detail}") from e
    except urllib.error.URLError as e:
        raise SystemExit(f"无法连接 Netlify：{e.reason}") from e


def build_and_zip() -> None:
    subprocess.run([sys.executable, str(BUILD_SCRIPT)], cwd=ROOT, check=True)
    with zipfile.ZipFile(ZIP_FILE, "w", zipfile.ZIP_DEFLATED) as z:
        z.write(HTML_FILE, "index.html")
    print(f"已打包 {ZIP_FILE.name} ({ZIP_FILE.stat().st_size / 1024:.1f} KB)")


def list_sites(token: str) -> None:
    sites = api("/sites?per_page=100", token)
    if not sites:
        print("当前 token 下没有站点。")
        return
    print("可发布站点：")
    for site in sites:
        account = site.get("account_slug") or site.get("account_name") or ""
        marker = "  ← cong-yu" if account == TEAM_SLUG else ""
        print(f"  {site.get('name', ''):<36} {site.get('id', '')}  {site.get('ssl_url') or site.get('url') or ''}{marker}")


def resolve_site(token: str, selector: str) -> dict:
    if not selector:
        raise SystemExit(
            "还没有配置站点。先运行 `python3 deploy_netlify.py --list` 查看站点，"
            "再把 Site ID 写入 .netlify-site-id（或在命令后加 --site）。"
        )
    if len(selector) == 36 and selector.count("-") == 4:
        return api(f"/sites/{selector}", token)
    sites = api("/sites?per_page=100", token)
    matches = [s for s in sites if s.get("name") == selector or s.get("id") == selector]
    if not matches:
        raise SystemExit(f"没有找到站点：{selector}")
    return matches[0]


def deploy(token: str, site: dict) -> None:
    site_id = site["id"]
    print(f"发布到 {site.get('name')} ({site_id})")
    payload = ZIP_FILE.read_bytes()
    dep = api(f"/sites/{site_id}/deploys", token, "POST", payload, "application/zip")
    deploy_id = dep.get("id")
    if not deploy_id:
        raise SystemExit(f"Netlify 未返回 deploy id：{dep}")
    print(f"部署已创建：{deploy_id}")
    state = dep.get("state", "")
    for _ in range(45):
        if state in ("ready", "current"):
            break
        if state in ("error", "rejected"):
            raise SystemExit(f"部署失败：{state}")
        time.sleep(2)
        dep = api(f"/deploys/{deploy_id}", token)
        state = dep.get("state", state)
    if state not in ("ready", "current"):
        raise SystemExit(f"部署未完成，当前状态：{state}")
    url = dep.get("ssl_url") or dep.get("deploy_ssl_url") or site.get("ssl_url") or site.get("url")
    print(f"发布完成：{url}")


def main() -> None:
    parser = argparse.ArgumentParser(description="构建并发布 有余 到 Netlify")
    parser.add_argument("--list", action="store_true", help="列出可访问的 Netlify 站点")
    parser.add_argument("--site", default="", help="Site ID 或站点名称")
    args = parser.parse_args()

    token = read_token()
    if not token:
        raise SystemExit(
            "缺少 Netlify token。请把 Personal Access Token 写入工作区 .netlify-token，"
            "或设置 NETLIFY_AUTH_TOKEN 环境变量。该文件已被 .gitignore 忽略。"
        )
    if args.list:
        list_sites(token)
        return
    build_and_zip()
    site = resolve_site(token, args.site or read_saved_site())
    if args.site:
        SITE_FILE.write_text(site["id"])
    deploy(token, site)


if __name__ == "__main__":
    main()
