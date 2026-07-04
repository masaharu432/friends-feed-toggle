#!/usr/bin/env python3
"""Chrome Web Store 申請用 / Mises 読み込み用の zip を dist/ に生成する。"""
import json
import os
import zipfile

FILES = [
    "manifest.json",
    "lib.js",
    "content.js",
    "content.css",
    "background.js",
    "popup.html",
    "popup.css",
    "popup.js",
    "_locales/en/messages.json",
    "_locales/ja/messages.json",
    "icons/icon16.png",
    "icons/icon32.png",
    "icons/icon48.png",
    "icons/icon128.png",
]


def main():
    with open("manifest.json", encoding="utf-8") as f:
        version = json.load(f)["version"]
    os.makedirs("dist", exist_ok=True)
    out = f"dist/friends-feed-toggle-{version}.zip"
    with zipfile.ZipFile(out, "w", zipfile.ZIP_DEFLATED) as z:
        for path in FILES:
            z.write(path)
    print(out)


if __name__ == "__main__":
    main()
