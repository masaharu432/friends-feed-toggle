"use strict";

const STATE_KEY = "enabled";
const ZOOM_KEY = "zoomEnabled";
const FACTOR_KEY = "zoomFactor";
const toggle = document.getElementById("toggle");
const zoom = document.getElementById("zoom");
const factor = document.getElementById("factor");
const stateLabel = document.getElementById("state");

for (const el of document.querySelectorAll("[data-i18n]")) {
  el.textContent = chrome.i18n.getMessage(el.dataset.i18n);
}

function render(enabled) {
  toggle.checked = enabled;
  stateLabel.textContent = chrome.i18n.getMessage(enabled ? "stateOn" : "stateOff");
  document.body.classList.toggle("on", enabled);
}

chrome.storage.local.get(
  { [STATE_KEY]: false, [ZOOM_KEY]: true, [FACTOR_KEY]: "auto" },
  (items) => {
    render(Boolean(items[STATE_KEY]));
    zoom.checked = Boolean(items[ZOOM_KEY]);
    factor.value = String(items[FACTOR_KEY]);
    if (factor.selectedIndex < 0) factor.value = "auto";
  }
);

toggle.addEventListener("change", () => {
  chrome.storage.local.set({ [STATE_KEY]: toggle.checked });
  render(toggle.checked);
});

zoom.addEventListener("change", () => {
  chrome.storage.local.set({ [ZOOM_KEY]: zoom.checked });
});

factor.addEventListener("change", () => {
  chrome.storage.local.set({ [FACTOR_KEY]: factor.value });
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
      `${chrome.i18n.getMessage("diagZoom")}: ${mark(res.zoomApplied)}  ` +
      `(links:${res.linkCount} main:${res.hasMain ? 1 : 0})`;
  });
});
