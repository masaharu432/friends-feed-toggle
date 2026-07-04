# Chrome Web Store 公開手順(内部メモ)

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
