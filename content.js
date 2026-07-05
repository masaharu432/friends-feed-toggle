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

  // ポップアップからの状態問い合わせ(診断表示用)
  chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    if (!msg || msg.type !== "fft-status") return;
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
