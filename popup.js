"use strict";

const STATE_KEY = "enabled";
const ZOOM_KEY = "zoomEnabled";
const toggle = document.getElementById("toggle");
const zoom = document.getElementById("zoom");
const stateLabel = document.getElementById("state");

for (const el of document.querySelectorAll("[data-i18n]")) {
  el.textContent = chrome.i18n.getMessage(el.dataset.i18n);
}

function render(enabled) {
  toggle.checked = enabled;
  stateLabel.textContent = chrome.i18n.getMessage(enabled ? "stateOn" : "stateOff");
  document.body.classList.toggle("on", enabled);
}

chrome.storage.local.get({ [STATE_KEY]: false, [ZOOM_KEY]: true }, (items) => {
  render(Boolean(items[STATE_KEY]));
  zoom.checked = Boolean(items[ZOOM_KEY]);
});

toggle.addEventListener("change", () => {
  chrome.storage.local.set({ [STATE_KEY]: toggle.checked });
  render(toggle.checked);
});

zoom.addEventListener("change", () => {
  chrome.storage.local.set({ [ZOOM_KEY]: zoom.checked });
});
