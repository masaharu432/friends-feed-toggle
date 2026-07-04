"use strict";

importScripts("lib.js");

const STATE_KEY = "enabled";
const ZOOM_KEY = "zoomEnabled";
const FACTOR_KEY = "zoomFactor";

const FB_URL_PATTERNS = [
  "https://www.facebook.com/*",
  "https://web.facebook.com/*",
  "https://m.facebook.com/*",
  "https://touch.facebook.com/*",
  "https://mbasic.facebook.com/*",
];
const FB_URL_RE = /^https:\/\/(www|web|m|touch|mbasic)\.facebook\.com\//;

const state = { enabled: false, zoomEnabled: true, factor: 1.3 };

function loadState(done) {
  chrome.storage.local.get(
    { [STATE_KEY]: false, [ZOOM_KEY]: true, [FACTOR_KEY]: "1.3" },
    (items) => {
      state.enabled = Boolean(items[STATE_KEY]);
      state.zoomEnabled = Boolean(items[ZOOM_KEY]);
      const n = parseFloat(items[FACTOR_KEY]);
      state.factor = Number.isFinite(n) && n >= 1 && n <= 3 ? n : 1.3;
      if (done) done();
    }
  );
}

function updateBadge() {
  chrome.action.setBadgeText({ text: state.enabled ? "ON" : "" });
  chrome.action.setBadgeBackgroundColor({ color: "#1b74e4" });
}

function desiredZoom(url) {
  if (!state.enabled || !state.zoomEnabled) return 1;
  return isFriendsFeedUrl(url) ? state.factor : 1;
}

// ブラウザ標準のページズーム(Chrome の Ctrl+/− と同じ)で拡大する。
// ページ全体が均一に拡大されるので、フォントサイズ補正のような
// DOM 操作は不要になる。未対応ブラウザでは content script に
// CSS zoom フォールバックを指示する。
function applyZoomToTab(tabId, url) {
  const factor = desiredZoom(url);
  const tellContent = (cssFactor) => {
    chrome.tabs.sendMessage(
      tabId,
      { type: "fft-css-zoom", factor: cssFactor },
      () => void chrome.runtime.lastError
    );
  };
  try {
    // per-tab: このタブだけに適用し、他の facebook.com タブや
    // ブラウザ全体のズーム設定を汚さない
    chrome.tabs.setZoomSettings(tabId, { scope: "per-tab" }, () => {
      if (chrome.runtime.lastError) return tellContent(factor);
      chrome.tabs.setZoom(tabId, factor, () => {
        if (chrome.runtime.lastError) return tellContent(factor);
        tellContent(0); // ブラウザズームが効いたので CSS 側は解除
      });
    });
  } catch {
    tellContent(factor);
  }
}

function refreshAllTabs() {
  chrome.tabs.query({ url: FB_URL_PATTERNS }, (tabs) => {
    if (chrome.runtime.lastError || !tabs) return;
    for (const t of tabs) {
      if (t.id !== undefined && t.url) applyZoomToTab(t.id, t.url);
    }
  });
}

function syncAll() {
  loadState(() => {
    updateBadge();
    refreshAllTabs();
  });
}

// ページ読み込み・SPA での URL 変化のたびにズームを適用し直す
chrome.tabs.onUpdated.addListener((tabId, info, tab) => {
  if (!tab || !tab.url || !FB_URL_RE.test(tab.url)) return;
  if (info.url || info.status === "loading" || info.status === "complete") {
    applyZoomToTab(tabId, tab.url);
  }
});

chrome.storage.onChanged.addListener((_changes, area) => {
  if (area === "local") syncAll();
});

chrome.runtime.onInstalled.addListener(() => {
  // 初回インストール時は ON で開始する(未設定のときだけ)
  chrome.storage.local.get(STATE_KEY, (items) => {
    if (items[STATE_KEY] === undefined) {
      chrome.storage.local.set({ [STATE_KEY]: true }, syncAll);
    } else {
      syncAll();
    }
  });
});
chrome.runtime.onStartup.addListener(syncAll);

// service worker が起き上がるたびに状態を反映
syncAll();
