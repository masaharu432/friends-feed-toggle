"use strict";

(() => {
  const STATE_KEY = "enabled";
  // 万一 Facebook 側が URL をホームに書き戻した場合のリロードループ防止:
  // 同一タブで短時間に何度も転送しようとしたら一時的に止める。
  const LOOP_GUARD_KEY = "fftRedirectTimes";
  const LOOP_GUARD_WINDOW_MS = 15000;
  const LOOP_GUARD_MAX = 2;

  let enabled = false;

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

  chrome.storage.local.get({ [STATE_KEY]: false }, (items) => {
    enabled = Boolean(items[STATE_KEY]);
    maybeRedirect();
  });

  // ポップアップで ON にした瞬間、ホーム表示中なら即転送する
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== "local" || !(STATE_KEY in changes)) return;
    enabled = Boolean(changes[STATE_KEY].newValue);
    maybeRedirect();
  });

  // Facebook は SPA なので、ロゴ/ホームボタンによる画面内遷移は
  // ページ読み込みを起こさない。URL の変化を監視して検知する。
  let lastHref = location.href;
  setInterval(() => {
    if (location.href !== lastHref) {
      lastHref = location.href;
      maybeRedirect();
    }
  }, 400);
  window.addEventListener("popstate", maybeRedirect);
})();
