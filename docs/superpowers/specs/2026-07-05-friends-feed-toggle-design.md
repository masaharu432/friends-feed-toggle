# Friends Feed Toggle for Facebook™ — 設計書

日付: 2026-07-05
状態: 承認済み(ユーザー確認済み。「公開できる前提でコードを作る」ことで合意)

## 目的

Facebook のホームフィード(広告・おすすめ・リール等が混ざる)ではなく、
Facebook 標準の「友達フィード」(時系列・友達の投稿のみ)を常用できるようにする。
ツールバーのボタンで ON/OFF を切り替えられる(切り替え式)。

## 背景・調査結果

- 既存拡張(F.B. Purity / Facebook Friends Only Mode / Friends Feed Redirect / FB Feed Cleaner)は
  いずれも「更新停止・低評価・切り替え機能なし・DOM 依存で壊れている」のいずれかに該当。
- 投稿を 1 件ずつ DOM 判定して隠す方式は Facebook の頻繁な構造変更で壊れやすい。
- Facebook には標準で友達フィード `https://www.facebook.com/?filter=friends&sk=h_chr` が存在する。
  URL リダイレクトのみで実現すれば HTML 構造に依存せず、ほぼ壊れない。

## 方式(承認済み)

**リダイレクト方式**。ON の間、facebook.com のホーム(`/` または `/home.php`)を開くと
同一オリジンの `/?filter=friends&sk=h_chr` へ `location.replace` で転送する。

- 転送先 URL 自体に `filter=friends` が付くため無限ループしない
  (`filter` パラメータがある URL は転送対象外)。
- `sk` パラメータが `h_chr` / `h_nor` / `welcome` 以外の場合は転送しない(レガシー URL の誤爆防止)。
- Facebook は SPA のため、ロゴ/ホームボタンによる画面内遷移は URL ポーリング(400ms)+
  `popstate` で検知して転送する。
- 対応ホスト: `www` / `web` / `m` `.facebook.com`。転送先は現在のオリジンを維持する。

## 対象環境

- Chrome(デスクトップ)、Mises ブラウザ(Android・Chromium 系、Chrome 拡張互換)
- Manifest V3。Chrome Web Store に公開できる品質・構成とする。

## 構成

| ファイル | 役割 |
|---|---|
| `manifest.json` | MV3。権限は `storage` のみ。content script は facebook.com 限定 |
| `lib.js` | 転送判定の純粋関数 `getRedirectTarget(href)`(node でユニットテスト可能) |
| `content.js` | `document_start` で実行。状態が ON のとき転送。`storage.onChanged` で即時反映 |
| `popup.html` / `popup.css` / `popup.js` | ON/OFF スイッチ。状態は `chrome.storage.local` |
| `background.js` | 起動時・インストール時にバッジ(ON 表示)を状態と同期 |
| `_locales/en`, `_locales/ja` | ストア公開用の多言語対応(名前・説明) |
| `icons/` | 16/32/48/128px PNG(スクリプト生成) |
| `test/lib.test.mjs` | `getRedirectTarget` のユニットテスト(node:test) |
| `build.py` | ストア申請用 zip を `dist/` に生成 |
| `README.md` / `PRIVACY.md` | 導入手順・ストア掲載文・プライバシーポリシー |

## データフロー

popup のスイッチ → `chrome.storage.local.set({enabled})` →
(1) content script が `storage.onChanged` で受けて、ホーム表示中なら即転送
(2) popup/background がバッジ表示を更新

## エラー処理・保守

- Facebook が友達フィードの URL を変更した場合のみ壊れる。`lib.js` の定数 1 行で修正可能。
- データ収集・外部通信・リモートコードは一切なし(ストア審査・プライバシー要件対応)。

## テスト

- ユニット: `node --test`(転送判定ロジック)
- 手動: ON で転送/OFF で通常表示/SPA 遷移でも転送/ループしない/Mises で zip 読み込み

## やらないこと(YAGNI)

広告の DOM 非表示、Firefox 対応、オプションページ、複数モード。
