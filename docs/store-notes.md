# ストア公開手順(内部メモ)

## Microsoft Edge Add-ons(登録無料・こちらを先に)

出典: [Publish a Microsoft Edge extension](https://learn.microsoft.com/en-us/microsoft-edge/extensions/publish/publish-extension) /
[Register as a developer](https://learn.microsoft.com/en-us/microsoft-edge/extensions/publish/create-dev-account)

1. **開発者登録(無料・初回のみ)**: Microsoft アカウント(Outlook/Live/Hotmail
   の個人アカウント)で
   [Partner Center の Microsoft Edge プログラム](https://partner.microsoft.com/dashboard/microsoftedge/public/login)
   にサインインして登録
2. 「新しい拡張機能」→ **zip をアップロード**(`dist/friends-feed-toggle-<version>.zip`)
3. **Availability**: 公開範囲 Public、対象市場は全マーケットで OK
4. **Properties**: カテゴリ = Social & communication、
   サポート URL = https://github.com/masaharu432/friends-feed-toggle
5. **Privacy**: 「ユーザーデータを収集しない」を申告。
   プライバシーポリシー URL =
   https://github.com/masaharu432/friends-feed-toggle/blob/main/PRIVACY.md
6. **Store listings**(日本語と英語それぞれ):
   - 説明文 = 下の「ストア掲載文」を貼り付け
   - ストアロゴ = `store/logo-300.png`(300×300)
   - 小プロモーションタイル = `store/promo-440x280.png`(440×280)
   - スクリーンショット(任意、640×480 か 1280×800)
7. 審査へ提出(通常数営業日)。更新も同じ流れで zip を上げ直すだけ

メモ: Lemur Browser は Edge Add-ons ストアからのインストールに対応している。

## Chrome Web Store(初回 $5)

1. `python3 tools/build.py` で zip を作成
2. [Chrome Web Store Developer Dashboard](https://chrome.google.com/webstore/devconsole)
   に登録(初回のみ $5)し、「新しいアイテム」で zip をアップロード
3. ストア掲載情報に下記の掲載文を貼り付け、スクリーンショット(1280×800)を添付
4. プライバシー欄: 「ユーザーデータを収集しない」を選択。
   権限の理由: `storage` = 設定の保存。
   プライバシーポリシー URL には PRIVACY.md を公開した URL
   (GitHub の blob URL 等)を指定
5. 審査へ提出(通常数日)

補足: Microsoft Edge Add-ons は開発者登録が無料。Lemur Browser は
Edge ストアからのインストールにも対応しているため、無料で配布したい
場合は Edge Add-ons への公開も選択肢になる。

## ストア掲載文(コピー用)

**日本語:**

> ワンタップで Facebook のホームを標準の「友達」フィード(時系列・友達の投稿のみ)へ自動転送します。広告だらけのおすすめフィードではなく、友達の近況だけを見たい人のためのシンプルなスイッチです。
>
> ・ツールバーのボタンで ON/OFF を切り替え
> ・PC 表示ではフィードを画面幅いっぱいに拡大(100〜400%)
> ・Facebook 標準機能への転送なので、デザイン変更で壊れにくい
> ・データ収集・トラッキング・外部通信は一切ありません
>
> ※ 本拡張は Meta Platforms, Inc. とは無関係の非公式ツールです。

**English:**

> One-tap switch that redirects the Facebook home page to the built-in Friends feed (chronological, friends only). For people who want to see what their friends are up to — not an endless wall of ads and suggested posts.
>
> - Toggle ON/OFF from the toolbar button
> - In desktop view, enlarge the feed to fill your screen (100–400%)
> - Redirects to a native Facebook feature, so it rarely breaks when Facebook changes its design
> - No data collection, no tracking, no external requests
>
> Note: This extension is not affiliated with Meta Platforms, Inc.
