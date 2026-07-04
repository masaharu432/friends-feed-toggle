# Friends Feed Toggle for Facebook™

Facebook のホームフィード(広告・おすすめ投稿・リールが混ざる)を開いたとき、
Facebook 標準の **「友達」フィード(時系列・友達の投稿のみ)** へ自動転送する
Chrome 拡張です。ツールバーのボタンでいつでも ON/OFF を切り替えられます。

- Facebook の HTML 構造に一切依存しない(URL 転送のみ)ため、Facebook の
  デザイン変更でほぼ壊れません
- 権限は `storage`(ON/OFF 状態の保存)のみ。データ収集・外部通信なし
- 日本語 / 英語対応、ダークモード対応
- Chrome(デスクトップ)と Mises など Chromium 系ブラウザで動作

## 仕組み

ON の間、`facebook.com/`(ホーム)を開くと同一オリジンの
`/?filter=friends&sk=h_chr`(Facebook 標準の友達フィード)へ
`location.replace` で転送します。Facebook は SPA のため、ロゴやホームボタンでの
画面内遷移も URL 監視で検知して転送します。転送先自体は転送対象にならないため
ループしません(さらに 15 秒間に 3 回以上の転送を止める安全弁つき)。

## インストール(開発版)

### Chrome(デスクトップ)

1. `chrome://extensions` を開く
2. 右上の「デベロッパーモード」を ON
3. 「パッケージ化されていない拡張機能を読み込む」でこのフォルダを選択

### Mises(Android)

1. `python3 tools/build.py` で `dist/friends-feed-toggle-<version>.zip` を作成
2. zip をスマホへ転送し、Mises の拡張機能画面(`chrome://extensions`)で
   デベロッパーモードを ON にして zip を読み込む

## 使い方

ツールバーの拡張アイコンをタップ → スイッチを ON。
バッジに「ON」と表示され、以後 Facebook のホームは友達フィードになります。
通常のフィードに戻したいときはスイッチを OFF にするだけです。

## 開発

```bash
node --test test/lib.test.mjs   # 転送判定ロジックのユニットテスト
python3 tools/gen_icons.py      # アイコン再生成
python3 tools/build.py          # ストア申請用 zip 作成
```

友達フィードの URL を Facebook が変更した場合は
[lib.js](lib.js) の `FRIENDS_FEED_QUERY` を 1 行直すだけです。

## Chrome Web Store への公開手順

1. `python3 tools/build.py` で zip を作成
2. [Chrome Web Store Developer Dashboard](https://chrome.google.com/webstore/devconsole)
   に登録(初回のみ $5)し、「新しいアイテム」で zip をアップロード
3. ストア掲載情報に下記「ストア掲載文」を貼り付け、スクリーンショット
   (1280×800)を添付
4. プライバシー欄:
   - 「ユーザーデータを収集しない」を選択
   - 権限の理由: `storage` = ON/OFF 設定の保存、ホスト権限
     (facebook.com) = ホームを友達フィードへ転送するため
   - プライバシーポリシー URL には [PRIVACY.md](PRIVACY.md) を GitHub 等で
     公開した URL を指定
5. 審査へ提出(通常数日)

### ストア掲載文(コピー用)

**日本語:**

> ワンタップで Facebook のホームを標準の「友達」フィード(時系列・友達の投稿のみ)へ自動転送します。広告だらけのおすすめフィードではなく、友達の近況だけを見たい人のためのシンプルなスイッチです。
>
> ・ツールバーのボタンで ON/OFF を切り替え
> ・Facebook 標準機能への転送のみなので、デザイン変更で壊れにくい
> ・データ収集・トラッキング・外部通信は一切ありません
>
> ※ 本拡張は Meta Platforms, Inc. とは無関係の非公式ツールです。

**English:**

> One-tap switch that redirects the Facebook home page to the built-in Friends feed (chronological, friends only). For people who want to see what their friends are up to — not an endless wall of ads and suggested posts.
>
> - Toggle ON/OFF from the toolbar button
> - Redirects to a native Facebook feature, so it rarely breaks when Facebook changes its design
> - No data collection, no tracking, no external requests
>
> Note: This extension is not affiliated with Meta Platforms, Inc.

## ライセンス

MIT
