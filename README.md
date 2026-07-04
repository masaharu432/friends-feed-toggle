# Friends Feed Toggle for Facebook™

Facebook のホームフィード(広告・おすすめ投稿・リールが混ざる)を開いたとき、
Facebook 標準の **「友達」フィード(時系列・友達の投稿のみ)** へ自動転送する
Chrome 拡張です。ワンタップで ON/OFF を切り替えられます。

スマホの Chromium 系ブラウザ(Lemur Browser など、Chrome 拡張が動くもの)で
「PC 版サイト」表示と組み合わせると、スマホでも友達の近況だけを
大きな文字で快適に読めます。

> [!IMPORTANT]
> **Facebook のモバイル版ページ(m.facebook.com のスマホ向け表示)では
> この拡張は効きません。** モバイル版は URL でのページ指定を受け付けない
> 作りのためです。スマホのブラウザで使うときは、
> ①ブラウザのメニューで **「PC 版サイト」(Desktop site)を有効**にし、
> ②PC 版の URL **`https://www.facebook.com/`** にアクセスしてください。

## 機能

- **友達フィードへ自動転送** — ON の間、facebook.com のホームを開くと
  標準の友達フィードへ転送。SPA 遷移(ロゴ/ホームボタン)にも追従
- **フィード拡大表示**(PC 表示向け・任意) —
  - フィードのタブ一覧(左サイドバー)を非表示
  - 投稿カードの固定幅を解除して画面幅いっぱいに(左右 8px の余白は維持)
  - 拡大率スライダー: 100〜400%・5% 刻み
  - 短文投稿の特大フォントを通常サイズに統一
  - Android Chromium の「フォントブースト」(一部テキストだけ勝手に
    拡大されてサイズがバラつく機能)を無効化
- **診断ファイル** — ポップアップから、ページ構造・実測フォントサイズ・
  ブラウザ情報を匿名化した JSON でダウンロード可能(投稿本文・名前は
  含まない)。不具合報告に添付できます
- 権限は `storage`(設定の保存)のみ。**データ収集・外部通信なし**
- 日本語 / 英語対応、ダークモード対応

## 仕組み(壊れにくさ)

転送は URL の置き換えだけで実現しています(デスクトップは
`/?filter=friends&sk=h_chr`、モバイル版は `/feeds/friends`)。
Facebook の HTML 構造にほぼ依存しないため、デザイン変更の影響を
受けにくい作りです。レイアウト調整(サイドバー非表示・カード幅)も
ARIA ロール(`role="main"` / `role="feed"` / `role="navigation"`)と
リンクの href だけを手がかりにしており、Facebook 内部の class 名には
依存していません。

Facebook 側で友達フィードの URL が変わった場合は
[lib.js](lib.js) の定数を直すだけで復旧できます。

## インストール

### Chrome(デスクトップ)

1. このリポジトリをダウンロード(Code → Download ZIP → 展開)
2. `chrome://extensions` を開き、右上の「デベロッパーモード」を ON
3. 「パッケージ化されていない拡張機能を読み込む」で展開したフォルダを選択

### Lemur Browser など(Android)

1. [Releases](https://github.com/masaharu432/friends-feed-toggle/releases) から
   `friends-feed-toggle-<version>.zip` をスマホにダウンロード
2. ブラウザの `chrome://extensions` でデベロッパーモードを ON にし、
   「Load *.zip」で zip を読み込む
3. ブラウザのメニューで **「PC 版サイト」(Desktop site)を有効**にして
   `https://www.facebook.com/` を開く(モバイル版ページでは動きません。
   上の IMPORTANT 参照)

## 使い方

- インストール直後から ON です。`facebook.com` を開くと友達フィードに切り替わります
- 設定(ON/OFF・拡大表示・拡大率)は拡張のポップアップ、または
  `chrome://extensions` → Details → **Extension options** から開けます
  (ポップアップが開けないブラウザでも Options はタブとして開けます)
- 通常のフィードに戻したいときはスイッチを OFF にするだけです

## 開発

```bash
node --test test/lib.test.mjs   # 転送判定ロジックのユニットテスト
python3 tools/gen_icons.py      # アイコン再生成
python3 tools/build.py          # 配布用 zip 作成(dist/)
```

構成:

| ファイル | 役割 |
|---|---|
| `lib.js` | 転送先判定の純粋関数(node でテスト可能) |
| `content.js` | 転送・サイドバー非表示・拡大・カード幅調整・診断ダンプ |
| `content.css` | サイドバー非表示(CSS 経路)とフォントブースト無効化 |
| `background.js` | バッジ表示と初期設定 |
| `popup.html/js/css` | 設定 UI(ポップアップ / オプションページ兼用) |

## ライセンス

MIT
