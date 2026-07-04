"use strict";

const STATE_KEY = "enabled";
const ZOOM_KEY = "zoomEnabled";
const FACTOR_KEY = "zoomFactor";
const toggle = document.getElementById("toggle");
const zoom = document.getElementById("zoom");
const factor = document.getElementById("factor");
const factorValue = document.getElementById("factorValue");
const stateLabel = document.getElementById("state");

for (const el of document.querySelectorAll("[data-i18n]")) {
  el.textContent = chrome.i18n.getMessage(el.dataset.i18n);
}

function render(enabled) {
  toggle.checked = enabled;
  stateLabel.textContent = chrome.i18n.getMessage(enabled ? "stateOn" : "stateOff");
  document.body.classList.toggle("on", enabled);
}

function renderFactor() {
  factorValue.textContent = factor.value + "%";
}

chrome.storage.local.get(
  { [STATE_KEY]: false, [ZOOM_KEY]: true, [FACTOR_KEY]: "1.3" },
  (items) => {
    render(Boolean(items[STATE_KEY]));
    zoom.checked = Boolean(items[ZOOM_KEY]);
    const n = parseFloat(items[FACTOR_KEY]);
    factor.value = String(Number.isFinite(n) ? Math.round(n * 100) : 130);
    renderFactor();
  }
);

toggle.addEventListener("change", () => {
  chrome.storage.local.set({ [STATE_KEY]: toggle.checked });
  render(toggle.checked);
});

zoom.addEventListener("change", () => {
  chrome.storage.local.set({ [ZOOM_KEY]: zoom.checked });
});

// ドラッグ中は数字表示だけ更新し、指を離したときに 1 回だけ適用する
// (zoom の変更はページ全体の再レイアウトになるため、連続適用すると重い)
factor.addEventListener("input", renderFactor);
factor.addEventListener("change", () => {
  chrome.storage.local.set({ [FACTOR_KEY]: String(Number(factor.value) / 100) });
});

// 診断ダンプ: 現在のタブのページ構造を匿名化 JSON でダウンロードさせる
document.getElementById("dump").addEventListener("click", () => {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    const tab = tabs && tabs[0];
    if (!tab || tab.id === undefined) return;
    chrome.tabs.sendMessage(tab.id, { type: "fft-dump" }, () => {
      const d = document.getElementById("diag");
      d.textContent = chrome.runtime.lastError
        ? chrome.i18n.getMessage("diagNoTab")
        : chrome.i18n.getMessage("dumpDone");
    });
  });
});

// 診断表示: 現在のタブの content script に状態を問い合わせる
document.getElementById("version").textContent =
  "v" + chrome.runtime.getManifest().version;

const diag = document.getElementById("diag");
chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
  const tab = tabs && tabs[0];
  if (!tab || tab.id === undefined) return;
  chrome.tabs.sendMessage(tab.id, { type: "fft-status" }, (res) => {
    if (chrome.runtime.lastError || !res) {
      diag.textContent = chrome.i18n.getMessage("diagNoTab");
      return;
    }
    const mark = (ok) => (ok ? "✓" : "✕");
    diag.textContent =
      `${chrome.i18n.getMessage("diagFeed")}: ${mark(res.friendsFeed)}  ` +
      `${chrome.i18n.getMessage("diagSidebar")}: ${mark(res.sidebarHidden)}  ` +
      `(links:${res.linkCount} main:${res.hasMain ? 1 : 0} found:${res.sidebarFound ? 1 : 0})`;
  });
});
