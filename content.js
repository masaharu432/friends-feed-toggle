"use strict";

(() => {
  const STATE_KEY = "enabled";
  const ZOOM_KEY = "zoomEnabled";
  const FACTOR_KEY = "zoomFactor";
  // 万一 Facebook 側が URL をホームに書き戻した場合のリロードループ防止:
  // 同一タブで短時間に何度も転送しようとしたら一時的に止める。
  const LOOP_GUARD_KEY = "fftRedirectTimes";
  const LOOP_GUARD_WINDOW_MS = 15000;
  const LOOP_GUARD_MAX = 2;

  let enabled = false;
  let zoomEnabled = true;
  let zoomSetting = "1.3";

  function loopGuardAllows() {
    try {
      const now = Date.now();
      const times = JSON.parse(sessionStorage.getItem(LOOP_GUARD_KEY) || "[]")
        .filter((t) => now - t < LOOP_GUARD_WINDOW_MS);
      if (times.length >= LOOP_GUARD_MAX) return false;
      times.push(now);
      sessionStorage.setItem(LOOP_GUARD_KEY, JSON.stringify(times));
      return true;
    } catch {
      return true;
    }
  }

  function maybeRedirect() {
    if (!enabled) return;
    const target = getRedirectTarget(location.href);
    if (!target) return;
    if (!loopGuardAllows()) return;
    location.replace(target);
  }

  // ---- 友達フィード表示中のレイアウト調整 ----
  // 拡大は「文字サイズの拡大」で実現する。
  // ・ブラウザ標準のページズームはレイアウト幅ごと拡大して横スクロールになる
  // ・CSS zoom はフィード内の座標系が Facebook のポップアップ位置計算と
  //   ズレて、いいね/リアクションの吹き出しが壊れる
  // 文字サイズの変更ならレイアウトが自然に折り返し、操作系も壊れない。

  function zoomFactor() {
    const n = parseFloat(zoomSetting);
    if (Number.isFinite(n) && n >= 1 && n <= 4) return n.toFixed(2);
    return "1.30";
  }

  // 画面端との間に残す余白
  const EDGE_GAP = "8px";

  function stripSideSpace(el, withWidth, sidePad = "0") {
    if (el.dataset.fftWide) return;
    el.dataset.fftWide = "1";
    if (withWidth) {
      el.style.setProperty("width", "100%", "important");
      el.style.setProperty("max-width", "none", "important");
    }
    el.style.setProperty("padding-left", sidePad, "important");
    el.style.setProperty("padding-right", sidePad, "important");
    el.style.setProperty("margin-left", "0", "important");
    el.style.setProperty("margin-right", "0", "important");
  }

  // 投稿カードの列は Facebook 側で固定幅になっているため、
  // フィード(role=feed)から main までの祖先の幅制限を外して
  // 画面いっぱいに広げる。外した要素には印を付けて復元できるようにする。
  function widenFeed(mainEl) {
    const feed = mainEl.querySelector('[role="feed"]');
    if (!feed) return;
    let el = feed;
    while (el && el !== mainEl) {
      stripSideSpace(el, true);
      el = el.parentElement;
    }
    // main 自身は画面端との余白を少しだけ残す(幅は触らない)
    stripSideSpace(mainEl, false, EDGE_GAP);
    // 各投稿カードのラッパー: 左右 margin を外して幅いっぱいに
    for (const child of feed.children) {
      stripSideSpace(child, true);
    }
  }

  // 投稿内のテキストを拡大率に応じて大きくする。
  // Facebook は短文だけの投稿を特大フォント(約 24px〜)で表示するため、
  // それらは通常サイズ扱いに揃えてから拡大する(サイズのばらつき防止)。
  // Facebook はスクロールや戻る操作でカードの中身を描き直す
  // (こちらの適用が消える)ため、「処理済み」の印は付けず、
  // 画面付近のカードだけを毎回走査し直す。
  const BIG_FONT_PX = 22;
  const BIG_FONT_BASE = 15;
  // これより大きい画像(=投稿写真など)は拡大しない。
  // 小さいもの(アバター・アイコン・絵文字画像)だけを対象にする。
  const UI_ICON_MAX_PX = 60;
  // アイコン類の拡大上限。文字ほど大きくする必要はなく、
  // 高倍率では枠からはみ出すため控えめにする。
  // アバター等の画像は 2 倍まで、スプライトアイコンは 1.5 倍まで。
  const UI_IMG_SCALE_MAX = 2;
  const UI_SPRITE_SCALE_MAX = 1.5;

  // px 値を含む CSS 値(background-size/position 等)を倍率で掛け直す
  function scalePxValues(value, f) {
    return value.replace(
      /(-?\d+(?:\.\d+)?)px/g,
      (_, n) => (parseFloat(n) * f).toFixed(2) + "px"
    );
  }

  // カード内の小さな画像/アイコン類を拡大率に合わせて大きくする。
  // 見た目だけの transform だと枠のサイズ計算に反映されず
  // はみ出すため、実寸(width/height)を変えてレイアウトに反映させる。
  function scaleUiIn(card, factor) {
    for (const el of card.querySelectorAll("img, svg, i")) {
      if (!el.dataset.fftUi) {
        const r = el.getBoundingClientRect();
        if (
          !r.width ||
          r.width > UI_ICON_MAX_PX ||
          r.height > UI_ICON_MAX_PX
        ) {
          el.dataset.fftUi = "skip";
          continue;
        }
        el.dataset.fftUi = r.width.toFixed(1) + "x" + r.height.toFixed(1);
        // スプライト画像は絵柄の位置も一緒に拡大する必要があるため
        // 元の background-size / background-position を記録しておく
        const cs = getComputedStyle(el);
        if (cs.backgroundImage && cs.backgroundImage !== "none") {
          el.dataset.fftUiBg =
            (cs.backgroundSize || "") + "|" + (cs.backgroundPosition || "");
        }
      }
      if (el.dataset.fftUi === "skip") continue;
      const f = Math.min(
        factor,
        el.dataset.fftUiBg ? UI_SPRITE_SCALE_MAX : UI_IMG_SCALE_MAX
      );
      const [w, h] = el.dataset.fftUi.split("x").map(Number);
      const tw = (w * f).toFixed(1) + "px";
      if (el.style.width === tw) continue;
      el.style.setProperty("width", tw, "important");
      el.style.setProperty("height", (h * f).toFixed(1) + "px", "important");
      if (el.dataset.fftUiBg) {
        const [bs, bp] = el.dataset.fftUiBg.split("|");
        if (bs.includes("px")) {
          el.style.setProperty("background-size", scalePxValues(bs, f), "important");
        }
        if (bp.includes("px")) {
          el.style.setProperty(
            "background-position",
            scalePxValues(bp, f),
            "important"
          );
        }
      }
    }
  }

  // 名前・日時などのヘッダー系テキスト(リンクや見出しの中)の拡大上限。
  // 本文と同じ倍率まで上げるとアバター横の行が折り返してしまう。
  const HEADER_TEXT_SCALE_MAX = 1.8;

  function scaleCard(card, factor) {
    scaleUiIn(card, factor);
    const walker = document.createTreeWalker(card, NodeFilter.SHOW_ELEMENT);
    for (let el = walker.nextNode(); el; el = walker.nextNode()) {
      const hasDirectText = [...el.childNodes].some(
        (n) => n.nodeType === Node.TEXT_NODE && n.textContent.trim()
      );
      if (!hasDirectText) continue;
      if (!el.dataset.fftBase) {
        // 元のサイズを一度だけ記録し、以後はそこから倍率で計算する
        let fs = parseFloat(getComputedStyle(el).fontSize);
        if (!Number.isFinite(fs) || fs <= 0) continue;
        if (fs >= BIG_FONT_PX) fs = BIG_FONT_BASE;
        el.dataset.fftBase = String(fs);
        const lh = getComputedStyle(el).lineHeight;
        if (lh && lh.endsWith("px")) {
          el.dataset.fftBaseLh = String(parseFloat(lh));
        }
      }
      const f = el.closest("a, h1, h2, h3, h4, h5, strong")
        ? Math.min(factor, HEADER_TEXT_SCALE_MAX)
        : factor;
      const target = parseFloat(el.dataset.fftBase) * f;
      if (Math.abs(parseFloat(el.style.fontSize || "0") - target) > 0.05) {
        el.style.setProperty("font-size", target.toFixed(1) + "px", "important");
        if (el.dataset.fftBaseLh) {
          const lh = parseFloat(el.dataset.fftBaseLh) * f;
          el.style.setProperty(
            "line-height",
            lh.toFixed(1) + "px",
            "important"
          );
        }
      }
    }
  }

  // 拡大対象の「投稿カード」を集める。
  // ・role=feed の直下要素(友達フィード等の一覧)
  // ・feed の外にある role=article(プロフィールのタイムライン、
  //   投稿の詳細表示など)。article 入れ子(コメント)は親側で処理する
  function collectCards() {
    const feeds = [...document.querySelectorAll('[role="feed"]')];
    const cards = [];
    for (const feed of feeds) cards.push(...feed.children);
    for (const a of document.querySelectorAll('[role="article"]')) {
      if (feeds.some((f) => f.contains(a))) continue;
      if (a.parentElement && a.parentElement.closest('[role="article"]')) continue;
      cards.push(a);
    }
    return cards;
  }

  function scaleAllPosts() {
    const factor = parseFloat(zoomFactor());
    const vh = window.innerHeight;
    for (const card of collectCards()) {
      // 画面の前後 1 画面分だけ処理(遠くのカードは表示時に処理される)
      const r = card.getBoundingClientRect();
      if (r.bottom < -vh || r.top > 2 * vh) continue;
      scaleCard(card, factor);
    }
  }

  function unwidenFeed() {
    for (const el of document.querySelectorAll("[data-fft-wide]")) {
      for (const p of [
        "width",
        "max-width",
        "padding-left",
        "padding-right",
        "margin-left",
        "margin-right",
      ]) {
        el.style.removeProperty(p);
      }
      delete el.dataset.fftWide;
    }
  }

  function restoreScaling() {
    for (const el of document.querySelectorAll("[data-fft-base]")) {
      el.style.removeProperty("font-size");
      el.style.removeProperty("line-height");
      delete el.dataset.fftBase;
      delete el.dataset.fftBaseLh;
    }
    for (const el of document.querySelectorAll("[data-fft-ui]")) {
      for (const p of [
        "width",
        "height",
        "transform",
        "transform-origin",
        "background-size",
        "background-position",
      ]) {
        el.style.removeProperty(p);
      }
      delete el.dataset.fftUi;
      delete el.dataset.fftUiBg;
    }
  }

  function findSidebar() {
    // フィード切り替えリンク(filter=...)を含む左サイドバーを探す。
    // 本文やヘッダー内の紛れ込みリンクは除外する。
    const main = document.querySelector('[role="main"]');
    const banner = document.querySelector('[role="banner"]');
    const links = [
      ...document.querySelectorAll('a[href*="filter="], a[href*="/feeds/friends"]'),
    ].filter(
      (a) => !(main && main.contains(a)) && !(banner && banner.contains(a))
    );
    if (links.length < 1) return null;
    // まず ARIA の navigation 祖先を試す(あれば最も確実)
    const nav = links[0].closest('[role="navigation"]');
    if (nav && !(main && nav.contains(main))) return nav;
    if (links.length < 2) return null;
    const last = links[links.length - 1];
    let el = links[0].parentElement;
    while (el && !el.contains(last)) el = el.parentElement;
    if (!el || el === document.body || el === document.documentElement) return null;
    if (main && el.contains(main)) return null;
    return el;
  }

  let hiddenSidebar = null;

  // フィードの描き直しを描画前に検知して即座に再適用する
  // (ポーリングだけだと、描き直された特大フォントが一瞬見えてしまう)
  let feedObserver = null;
  let observedFeeds = new WeakSet();

  function ensureFeedObservers() {
    if (!feedObserver) {
      feedObserver = new MutationObserver(() => {
        if (!isScaleActive()) return;
        if (isFriendsActive()) {
          const main = document.querySelector('[role="main"]');
          if (main) widenFeed(main);
        }
        scaleAllPosts();
      });
    }
    // feed 一覧に加えて main も見張る(プロフィール等、feed を持たない
    // ページの投稿描き直しに追従するため)
    const targets = [
      ...document.querySelectorAll('[role="feed"]'),
      ...document.querySelectorAll('[role="main"]'),
    ];
    for (const t of targets) {
      if (observedFeeds.has(t)) continue;
      feedObserver.observe(t, { childList: true, subtree: true });
      observedFeeds.add(t);
    }
  }

  function dropFeedObservers() {
    if (feedObserver) feedObserver.disconnect();
    feedObserver = null;
    observedFeeds = new WeakSet();
  }

  // 文字/アイコン拡大を効かせるか(facebook 上の全ページ対象)
  function isScaleActive() {
    return enabled && zoomEnabled;
  }

  // サイドバー非表示・カード幅の拡張を効かせるか(友達フィードのみ)
  function isFriendsActive() {
    return isScaleActive() && isFriendsFeedUrl(location.href);
  }

  function applyView() {
    const friendsActive = isFriendsActive();
    document.documentElement.classList.toggle("fft-zoom", friendsActive);

    if (friendsActive) {
      if (hiddenSidebar && !hiddenSidebar.isConnected) hiddenSidebar = null;
      const sidebar = hiddenSidebar || findSidebar();
      if (sidebar && sidebar !== hiddenSidebar) {
        sidebar.style.setProperty("display", "none", "important");
        hiddenSidebar = sidebar;
      }
      const main = document.querySelector('[role="main"]');
      if (main) widenFeed(main);
    } else {
      if (hiddenSidebar) {
        hiddenSidebar.style.removeProperty("display");
        hiddenSidebar = null;
      }
      unwidenFeed();
    }

    if (isScaleActive()) {
      scaleAllPosts();
      ensureFeedObservers();
    } else {
      dropFeedObservers();
      restoreScaling();
    }
  }

  function onStateLoaded(items) {
    enabled = Boolean(items[STATE_KEY]);
    zoomEnabled = Boolean(items[ZOOM_KEY]);
    zoomSetting = String(items[FACTOR_KEY]);
    maybeRedirect();
    applyView();
  }

  chrome.storage.local.get(
    { [STATE_KEY]: false, [ZOOM_KEY]: true, [FACTOR_KEY]: "1.3" },
    onStateLoaded
  );

  // ポップアップで切り替えた瞬間に反映する
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== "local") return;
    if (STATE_KEY in changes) enabled = Boolean(changes[STATE_KEY].newValue);
    if (ZOOM_KEY in changes) zoomEnabled = Boolean(changes[ZOOM_KEY].newValue);
    if (FACTOR_KEY in changes) zoomSetting = String(changes[FACTOR_KEY].newValue);
    maybeRedirect();
    applyView();
  });

  // Facebook は SPA なので、ロゴ/ホームボタンによる画面内遷移は
  // ページ読み込みを起こさない。URL の変化を監視して検知する。
  // applyView はフォールバックとして定期的にも呼ぶ(通常は observer が先に処理)。
  let lastHref = location.href;
  setInterval(() => {
    if (location.href !== lastHref) {
      lastHref = location.href;
      maybeRedirect();
    }
    applyView();
  }, 400);
  window.addEventListener("popstate", () => {
    maybeRedirect();
    applyView();
  });

  // ---- 診断ダンプ ----
  // ページ構造と実測フォントサイズを匿名化して JSON 化する。
  // 投稿の本文・名前は含めない(テキストは文字数のみ記録)。
  function buildDump() {
    const main = document.querySelector('[role="main"]');
    const feed = main && main.querySelector('[role="feed"]');
    const dump = {
      version: chrome.runtime.getManifest().version,
      url: location.href,
      ua: navigator.userAgent,
      innerWidth: window.innerWidth,
      innerHeight: window.innerHeight,
      dpr: window.devicePixelRatio,
      vvScale: window.visualViewport ? window.visualViewport.scale : null,
      settings: { enabled, zoomEnabled, zoomSetting },
      mainZoom: main ? main.style.zoom : null,
      hasMain: Boolean(main),
      hasFeed: Boolean(feed),
      sidebarHidden: Boolean(hiddenSidebar && hiddenSidebar.isConnected),
      sidebarFound: Boolean(findSidebar()),
      fontScale: feed ? fontScale(feed) : null,
      cards: [],
    };
    if (feed) {
      const vh = window.innerHeight;
      let i = -1;
      for (const card of feed.children) {
        i++;
        const r = card.getBoundingClientRect();
        if (r.bottom < -vh || r.top > 2 * vh) continue;
        const texts = [];
        const walker = document.createTreeWalker(card, NodeFilter.SHOW_ELEMENT);
        for (let el = walker.nextNode(); el; el = walker.nextNode()) {
          const t = [...el.childNodes]
            .filter((n) => n.nodeType === Node.TEXT_NODE)
            .map((n) => n.textContent)
            .join("")
            .trim();
          if (!t) continue;
          texts.push({
            tag: el.tagName.toLowerCase(),
            fontPx: getComputedStyle(el).fontSize,
            inline: el.getAttribute("style") || "",
            fft: el.dataset.fftFont || "",
            len: t.length,
          });
        }
        dump.cards.push({
          i,
          top: Math.round(r.top),
          h: Math.round(r.height),
          w: Math.round(r.width),
          texts,
        });
      }
    }
    return dump;
  }

  // ダウンロードが使えないブラウザ向けに、診断情報を画面上に表示して
  // スクショで共有できるようにする。押すたびに表示/非表示を切り替える。
  // ・上部の HUD: 実測のビューポート/入力欄の値をライブ表示(キーボード
  //   問題の診断用。入力欄にフォーカスした状態でスクショする)
  let hud = null;
  let hudTimer = null;
  let hudOutlined = null;

  function toggleDump() {
    if (hud) {
      hud.remove();
      hud = null;
      if (hudTimer) clearInterval(hudTimer);
      hudTimer = null;
      if (hudOutlined) {
        hudOutlined.style.removeProperty("outline");
        hudOutlined = null;
      }
      return;
    }
    hud = document.createElement("div");
    hud.style.cssText =
      "position:fixed;top:0;left:0;right:0;z-index:2147483647;" +
      "background:rgba(0,0,0,.85);color:#0f0;font:11px/1.5 monospace;" +
      "padding:6px 8px;white-space:pre-wrap;pointer-events:none;";
    document.documentElement.appendChild(hud);
    const update = () => {
      if (!hud) return;
      const vv = window.visualViewport;
      const el = focusedInput();
      const r = el ? el.getBoundingClientRect() : null;
      const anc = el ? scrollableAncestors(el).length : 0;
      // フォーカス中の入力欄を赤枠で可視化(実際の位置を目で確認するため)
      if (hudOutlined && hudOutlined !== el) {
        hudOutlined.style.removeProperty("outline");
        hudOutlined = null;
      }
      if (el) {
        el.style.setProperty("outline", "3px solid red", "important");
        hudOutlined = el;
      }
      hud.textContent =
        `v${chrome.runtime.getManifest().version}  ` +
        `iw/ih=${window.innerWidth}/${window.innerHeight}\n` +
        (vv
          ? `vv w/h=${Math.round(vv.width)}/${Math.round(vv.height)} ` +
            `offY=${Math.round(vv.offsetTop)} scale=${vv.scale.toFixed(2)}\n`
          : "vv=none\n") +
        `kbOpen=${keyboardOpen()} target=${Math.round(targetBottomY())}\n` +
        (el
          ? `input=${el.tagName.toLowerCase()} bottom=${Math.round(
              r.bottom
            )} scrollAnc=${anc}\n` +
            `dialog=${el.closest('[role="dialog"]') ? 1 : 0} ` +
            `lift=${liftedEl ? liftedEl.tagName.toLowerCase() : "-"} ` +
            `ty=${liftedEl ? Math.round(currentTranslateY(liftedEl)) : "-"}`
          : "input=none (入力欄をタップして)");
    };
    update();
    hudTimer = setInterval(update, 200);
  }

  // ---- コメント入力欄をソフトウェアキーボードに隠させない ----
  // PC 表示のページはスマホのキーボードを想定しておらず、キーボードが
  // 開いても入力欄が可視領域へスクロールされない。さらに Facebook は
  // 文字入力のたびに再描画してスクロール位置を戻すため、一度スクロール
  // しても再び隠れてしまう。そこで「入力欄が隠れていたら見える位置まで
  // スクロールする」処理を、フォーカス時・文字入力時・キーボード開閉時に
  // 繰り返し適用する。入力欄がすでに見えているとき(自分でスクロールして
  // 読んでいるとき等)は何もしないので、ユーザーの操作を邪魔しない。
  const INPUT_SELECTOR =
    'textarea, input, [contenteditable="true"], [role="textbox"]';
  const KB_MARGIN = 12;

  function keyboardOpen() {
    const vv = window.visualViewport;
    return Boolean(vv && vv.height < window.innerHeight - 80);
  }

  function focusedInput() {
    const el = document.activeElement;
    return el && el.matches && el.matches(INPUT_SELECTOR) ? el : null;
  }

  function scrollableAncestors(el) {
    const list = [];
    let n = el.parentElement;
    while (n && n !== document.documentElement) {
      const cs = getComputedStyle(n);
      if (
        /(auto|scroll)/.test(cs.overflowY) &&
        n.scrollHeight > n.clientHeight + 1
      ) {
        list.push(n);
      }
      n = n.parentElement;
    }
    return list;
  }

  // 入力欄を収めたい下端の Y 座標(画面上端からの px)。
  // ・visualViewport が縮む端末: キーボード上端のすぐ上
  // ・縮まない端末(PC 表示で多い): 画面のほぼ半分の位置
  // 両者の小さい方(=より上)を採用するので、キーボード検出に依存しない。
  function targetBottomY() {
    const vv = window.visualViewport;
    if (keyboardOpen() && vv) {
      // キーボードが可視領域を縮めている端末: キーボードのすぐ上
      return vv.offsetTop + vv.height - KB_MARGIN;
    }
    // 縮まない端末: 画面のほぼ半分の位置(キーボードは下半分を覆う想定)
    return window.innerHeight * 0.5;
  }

  // 要素に現在かかっている translateY を実測で取り出す
  // (Facebook の再描画で inline style が消えても実際の値を反映)
  function currentTranslateY(el) {
    const t = getComputedStyle(el).transform;
    if (!t || t === "none") return 0;
    try {
      return new DOMMatrixReadOnly(t).m42;
    } catch {
      return 0;
    }
  }

  let liftedEl = null;

  function clearFixedLift() {
    if (liftedEl) {
      liftedEl.style.removeProperty("transform");
      liftedEl = null;
    }
  }

  function bringInputUp() {
    if (!enabled) return;
    const el = focusedInput();
    if (!el) return;
    const target = targetBottomY();
    let r = el.getBoundingClientRect();
    let delta = r.bottom - target;
    if (delta <= 1) return; // すでに十分上にある → 何もしない(操作を邪魔しない)

    // スクロール可能な祖先を内側から順に動かして入力欄を持ち上げる
    for (const sc of scrollableAncestors(el)) {
      sc.scrollTop = Math.min(sc.scrollTop + delta, sc.scrollHeight);
      r = el.getBoundingClientRect();
      delta = r.bottom - target;
      if (delta <= 1) return;
    }

    // スクロールで解決しない = 入力欄が固定/絶対配置。入力欄を確実に含む
    // 要素(ダイアログ、なければ body)を transform で持ち上げる。
    // 実際に入力欄が動いたかを測って確認し、動いた候補を採用する。
    const candidates = [];
    const dialog = el.closest('[role="dialog"]');
    if (dialog) candidates.push(dialog);
    candidates.push(document.body);
    for (const c of candidates) {
      if (liftedEl && liftedEl !== c) clearFixedLift();
      const before = el.getBoundingClientRect().bottom;
      const cur = currentTranslateY(c);
      c.style.setProperty("transform", `translateY(${cur - delta}px)`, "important");
      const after = el.getBoundingClientRect().bottom;
      if (after < before - 1) {
        liftedEl = c; // 実際に動いた → 採用
        return;
      }
      // 動かなかった → 変更を戻して次の候補へ
      if (cur === 0) c.style.removeProperty("transform");
      else c.style.setProperty("transform", `translateY(${cur}px)`, "important");
    }
  }

  // 文字入力ごとに Facebook がスクロールを戻すので、入力を受けて再適用する
  document.addEventListener("input", () => {
    if (focusedInput()) {
      bringInputUp();
      // 再描画が入力後に走る場合に備えて少し遅れても一度試す
      requestAnimationFrame(bringInputUp);
    }
  });
  document.addEventListener("keyup", () => {
    if (focusedInput()) bringInputUp();
  });
  window.addEventListener("focusin", () => {
    if (!focusedInput()) return;
    // キーボードが出きるタイミングは端末差があるので複数回試す
    for (const t of [250, 500, 800]) setTimeout(bringInputUp, t);
  });
  window.addEventListener("focusout", () => {
    // 入力欄から離れたら持ち上げを解除して元に戻す
    setTimeout(() => {
      if (!focusedInput()) clearFixedLift();
    }, 200);
  });
  if (window.visualViewport) {
    const onVV = () => {
      // キーボードが閉じたら持ち上げを解除
      if (!keyboardOpen()) clearFixedLift();
      setTimeout(bringInputUp, 30);
    };
    window.visualViewport.addEventListener("resize", onVV);
    window.visualViewport.addEventListener("scroll", onVV);
  }

  // ポップアップからのメッセージ(診断表示・診断ダンプ)
  chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    if (!msg) return;
    if (msg.type === "fft-dump") {
      toggleDump();
      sendResponse({ ok: true });
      return;
    }
    if (msg.type !== "fft-status") return;
    sendResponse({
      friendsFeed: isFriendsFeedUrl(location.href),
      sidebarHidden: Boolean(hiddenSidebar && hiddenSidebar.isConnected),
      sidebarFound: Boolean(
        findSidebar() || (hiddenSidebar && hiddenSidebar.isConnected)
      ),
      linkCount: document.querySelectorAll('a[href*="filter="]').length,
      hasMain: Boolean(document.querySelector('[role="main"]')),
    });
  });
})();
