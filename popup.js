"use strict";

const STATE_KEY = "enabled";
const toggle = document.getElementById("toggle");
const stateLabel = document.getElementById("state");

for (const el of document.querySelectorAll("[data-i18n]")) {
  el.textContent = chrome.i18n.getMessage(el.dataset.i18n);
}

function render(enabled) {
  toggle.checked = enabled;
  stateLabel.textContent = chrome.i18n.getMessage(enabled ? "stateOn" : "stateOff");
  document.body.classList.toggle("on", enabled);
}

chrome.storage.local.get({ [STATE_KEY]: false }, (items) => {
  render(Boolean(items[STATE_KEY]));
});

toggle.addEventListener("change", () => {
  chrome.storage.local.set({ [STATE_KEY]: toggle.checked });
  render(toggle.checked);
});
