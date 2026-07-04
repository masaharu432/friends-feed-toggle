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

  // 拡大表示: 友達フィード表示中だけ html にクラスを付け(CSS 用)、
  // さらに JS でも直接スタイルを当てる(古い Chromium で :has() が
  // 使えない場合や、role 構造が想定と違う場合のフォールバック)。
  let hiddenSidebar = null;
  let zoomedMain = null;

  function zoomFactor() {
    const n = parseFloat(zoomSetting);
    if (Number.isFinite(n) && n >= 1 && n <= 3) return n.toFixed(2);
    // 自動: フィード幅(約 700px)が画面幅に収まる倍率
    return Math.min(2, Math.max(1, window.innerWidth / 720)).toFixed(2);
  }

  // 投稿カードの列は Facebook 側で固定幅になっているため、
  // フィード(role=feed)から main までの祖先の幅制限を外して
  // 画面いっぱいに広げる。外した要素には印を付けて復元できるようにする。
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

  function widenFeed(mainEl) {
    const feed = mainEl.querySelector('[role="feed"]');
    if (!feed) return;
    // feed から main までの祖先: 幅制限と左右の余白を外す
    let el = feed;
    while (el && el !== mainEl) {
      stripSideSpace(el, true);
      el = el.parentElement;
    }
    // main 自身は画面端との余白を少しだけ残す(幅は触らない)
    stripSideSpace(mainEl, false, EDGE_GAP);
    // 各投稿カードのラッパー: 左右 margin を外して幅いっぱいに
    // (カード内部の padding はデザインなので触らない)
    for (const child of feed.children) {
      stripSideSpace(child, true);
    }
    normalizeBigText(feed);
  }

  // Facebook は短文だけの投稿を特大フォント(約 24px〜)で表示する。
  // 拡大表示と重なると極端に大きくなるので、投稿本文の特大フォントを
  // 通常サイズに揃える。処理済みカードには印を付けて再走査を避ける。
  const BIG_FONT_PX = 22;
  const NORMAL_FONT = "15px";

  function normalizeBigText(feed) {
    for (const card of feed.children) {
      if (card.dataset.fftFontDone) continue;
      let sawText = false;
      const walker = document.createTreeWalker(card, NodeFilter.SHOW_ELEMENT);
      for (let el = walker.nextNode(); el; el = walker.nextNode()) {
        if (el.dataset.fftFont) continue;
        const hasDirectText = [...el.childNodes].some(
          (n) => n.nodeType === Node.TEXT_NODE && n.textContent.trim()
        );
        if (!hasDirectText) continue;
        sawText = true;
        if (parseFloat(getComputedStyle(el).fontSize) >= BIG_FONT_PX) {
          el.dataset.fftFont = "1";
          el.style.setProperty("font-size", NORMAL_FONT, "important");
        }
      }
      // テキストが描画済みのカードだけ処理完了にする(描画途中対策)
      if (sawText) card.dataset.fftFontDone = "1";
    }
  }

  function unwidenFeed() {
    for (const el of document.querySelectorAll("[data-fft-font]")) {
      el.style.removeProperty("font-size");
      delete el.dataset.fftFont;
    }
    for (const el of document.querySelectorAll("[data-fft-font-done]")) {
      delete el.dataset.fftFontDone;
    }
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
    if (links.length < 2) return null;
    const last = links[links.length - 1];
    let el = links[0].parentElement;
    while (el && !el.contains(last)) el = el.parentElement;
    if (!el || el === document.body || el === document.documentElement) return null;
    if (main && el.contains(main)) return null;
    return el;
  }

  function applyView() {
    const active = enabled && zoomEnabled && isFriendsFeedUrl(location.href);
    document.documentElement.classList.toggle("fft-zoom", active);
    document.documentElement.style.setProperty("--fft-zoom", zoomFactor());

    if (active) {
      if (hiddenSidebar && !hiddenSidebar.isConnected) hiddenSidebar = null;
      const sidebar = hiddenSidebar || findSidebar();
      if (sidebar && sidebar !== hiddenSidebar) {
        sidebar.style.setProperty("display", "none", "important");
        hiddenSidebar = sidebar;
      }
      const main = document.querySelector('[role="main"]');
      if (main) {
        // 同じ値の再適用は再レイアウトの無駄なので、変わったときだけ触る
        const desired = zoomFactor();
        if (Math.abs(parseFloat(main.style.zoom || "1") - parseFloat(desired)) > 0.001) {
          main.style.zoom = desired;
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
  // ポップアップからの状態問い合わせ(診断表示用)
  chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    if (!msg || msg.type !== "fft-status") return;
    sendResponse({
      friendsFeed: isFriendsFeedUrl(location.href),
      sidebarHidden: Boolean(hiddenSidebar && hiddenSidebar.isConnected),
      zoomApplied: Boolean(
        zoomedMain && zoomedMain.isConnected && zoomedMain.style.zoom
      ),
      linkCount: document.querySelectorAll('a[href*="filter="]').length,
      hasMain: Boolean(document.querySelector('[role="main"]')),
    });
  });
})();
