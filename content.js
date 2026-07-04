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
    return Math.min(2, Math.max(1, window.innerWidth / 720)).toFixed(2);
  }

  function findSidebar() {
    // フィード切り替えリンク(filter=...)を 2 つ以上含み、かつ
    // フィード本体(role=main)を含まない最小の祖先 = 左サイドバー
    const links = document.querySelectorAll(
      'a[href*="filter="], a[href*="/feeds/friends"]'
    );
    if (links.length < 2) return null;
    const first = links[0];
    const last = links[links.length - 1];
    const main = document.querySelector('[role="main"]');
    let el = first.parentElement;
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
        main.style.zoom = zoomFactor();
        zoomedMain = main;
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
  window.addEventListener("resize", () => {
    if (document.documentElement.classList.contains("fft-zoom")) updateZoomVar();
  });
})();
