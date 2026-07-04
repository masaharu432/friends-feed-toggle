"use strict";

const STATE_KEY = "enabled";

function updateBadge(enabled) {
  chrome.action.setBadgeText({ text: enabled ? "ON" : "" });
  chrome.action.setBadgeBackgroundColor({ color: "#1b74e4" });
}

function syncBadge() {
  chrome.storage.local.get({ [STATE_KEY]: false }, (items) => {
    updateBadge(Boolean(items[STATE_KEY]));
  });
}

chrome.runtime.onInstalled.addListener(syncBadge);
chrome.runtime.onStartup.addListener(syncBadge);

chrome.storage.onChanged.addListener((changes, area) => {
  if (area === "local" && STATE_KEY in changes) {
    updateBadge(Boolean(changes[STATE_KEY].newValue));
  }
});
