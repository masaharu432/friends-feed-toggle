"use strict";

(() => {
  const STATE_KEY = "enabled";
  const ZOOM_KEY = "zoomEnabled";
  // 万一 Facebook 側が URL をホームに書き戻した場合のリロードループ防止:
  // 同一タブで短時間に何度も転送しようとしたら一時的に止める。
  const LOOP_GUARD_KEY = "fftRedirectTimes";
  const LOOP_GUARD_WINDOW_MS = 15000;
  const LOOP_GUARD_MAX = 2;

  let enabled = false;
  let zoomEnabled = true;
  // 拡大はブラウザ標準のページズーム(background が chrome.tabs.setZoom で
  // 適用)が基本。未対応ブラウザでは background からこの値が指示され、
  // CSS zoom でフォールバックする。0 はフォールバック不使用。
  let cssZoom = 0;

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

  function findSidebar() {
    // フィード切り替えリンク(filter=...)を 2 つ以上含み、かつ
    // フィード本体(role=main)を含まない最小の祖先 = 左サイドバー。
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
  let zoomedMain = null;

  function applyView() {
    const active = enabled && zoomEnabled && isFriendsFeedUrl(location.href);
    document.documentElement.classList.toggle("fft-zoom", active);

    if (active) {
      if (hiddenSidebar && !hiddenSidebar.isConnected) hiddenSidebar = null;
      const sidebar = hiddenSidebar || findSidebar();
      if (sidebar && sidebar !== hiddenSidebar) {
        sidebar.style.setProperty("display", "none", "important");
        hiddenSidebar = sidebar;
      }
      const main = document.querySelector('[role="main"]');
      if (main) {
        if (cssZoom > 1) {
          if (Math.abs(parseFloat(main.style.zoom || "1") - cssZoom) > 0.001) {
            main.style.zoom = String(cssZoom);
          }
        } else if (main.style.zoom) {
          main.style.removeProperty("zoom");
        }
        zoomedMain = main;
        widenFeed(main);
      }
    } else {
      if (hiddenSidebar) {
        hiddenSidebar.style.removeProperty("display");
        hiddenSidebar = null;
      }
      if (zoomedMain) {
        zoomedMain.style.removeProperty("zoom");
        zoomedMain = null;
      }
      unwidenFeed();
    }
  }

  function onStateLoaded(items) {
    enabled = Boolean(items[STATE_KEY]);
    zoomEnabled = Boolean(items[ZOOM_KEY]);
    maybeRedirect();
    applyView();
  }

  chrome.storage.local.get({ [STATE_KEY]: false, [ZOOM_KEY]: true }, onStateLoaded);

  // ポップアップで切り替えた瞬間に反映する
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== "local") return;
    if (STATE_KEY in changes) enabled = Boolean(changes[STATE_KEY].newValue);
    if (ZOOM_KEY in changes) zoomEnabled = Boolean(changes[ZOOM_KEY].newValue);
    maybeRedirect();
    applyView();
  });

  // Facebook は SPA なので、ロゴ/ホームボタンによる画面内遷移は
  // ページ読み込みを起こさない。URL の変化を監視して検知する。
  // applyView は React の再描画で要素が入れ替わっても追従できるよう
  // 毎回呼ぶ(対象が見つかり済みならほぼ何もしないので軽い)。
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

  // background / ポップアップからのメッセージ
  chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    if (!msg) return;
    if (msg.type === "fft-css-zoom") {
      // ブラウザズーム非対応時のフォールバック指示(0 で解除)
      cssZoom = Number(msg.factor) > 1 ? Number(msg.factor) : 0;
      applyView();
      return;
    }
    if (msg.type === "fft-status") {
      sendResponse({
        friendsFeed: isFriendsFeedUrl(location.href),
        sidebarHidden: Boolean(hiddenSidebar && hiddenSidebar.isConnected),
        sidebarFound: Boolean(findSidebar() || (hiddenSidebar && hiddenSidebar.isConnected)),
        cssZoom,
        linkCount: document.querySelectorAll('a[href*="filter="]').length,
        hasMain: Boolean(document.querySelector('[role="main"]')),
      });
    }
  });
})();
