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

  // ---- 友達フィード表示中のレイアウト調整 ----
  // 拡大は「文字サイズの拡大」で実現する。
  // ・ブラウザ標準のページズームはレイアウト幅ごと拡大して横スクロールになる
  // ・CSS zoom はフィード内の座標系が Facebook のポップアップ位置計算と
  //   ズレて、いいね/リアクションの吹き出しが壊れる
  // 文字サイズの変更ならレイアウトが自然に折り返し、操作系も壊れない。

  function zoomFactor() {
    const n = parseFloat(zoomSetting);
    if (Number.isFinite(n) && n >= 1 && n <= 4) return n.toFixed(2);
    return "1.30";
  }

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

  // 投稿内のテキストを拡大率に応じて大きくする。
  // Facebook は短文だけの投稿を特大フォント(約 24px〜)で表示するため、
  // それらは通常サイズ扱いに揃えてから拡大する(サイズのばらつき防止)。
  // Facebook はスクロールや戻る操作でカードの中身を描き直す
  // (こちらの適用が消える)ため、「処理済み」の印は付けず、
  // 画面付近のカードだけを毎回走査し直す。
  const BIG_FONT_PX = 22;
  const BIG_FONT_BASE = 15;

  function scaleTextIn(feed) {
    const factor = parseFloat(zoomFactor());
    const vh = window.innerHeight;
    for (const card of feed.children) {
      // 画面の前後 1 画面分だけ処理(遠くのカードは表示時に処理される)
      const r = card.getBoundingClientRect();
      if (r.bottom < -vh || r.top > 2 * vh) continue;
      const walker = document.createTreeWalker(card, NodeFilter.SHOW_ELEMENT);
      for (let el = walker.nextNode(); el; el = walker.nextNode()) {
        const hasDirectText = [...el.childNodes].some(
          (n) => n.nodeType === Node.TEXT_NODE && n.textContent.trim()
        );
        if (!hasDirectText) continue;
        if (!el.dataset.fftBase) {
          // 元のサイズを一度だけ記録し、以後はそこから倍率で計算する
          let fs = parseFloat(getComputedStyle(el).fontSize);
          if (!Number.isFinite(fs) || fs <= 0) continue;
          if (fs >= BIG_FONT_PX) fs = BIG_FONT_BASE;
          el.dataset.fftBase = String(fs);
          const lh = getComputedStyle(el).lineHeight;
          if (lh && lh.endsWith("px")) {
            el.dataset.fftBaseLh = String(parseFloat(lh));
          }
        }
        const target = parseFloat(el.dataset.fftBase) * factor;
        if (Math.abs(parseFloat(el.style.fontSize || "0") - target) > 0.05) {
          el.style.setProperty("font-size", target.toFixed(1) + "px", "important");
          if (el.dataset.fftBaseLh) {
            const lh = parseFloat(el.dataset.fftBaseLh) * factor;
            el.style.setProperty(
              "line-height",
              lh.toFixed(1) + "px",
              "important"
            );
          }
        }
      }
    }
  }

  function restoreFeed() {
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
    for (const el of document.querySelectorAll("[data-fft-base]")) {
      el.style.removeProperty("font-size");
      el.style.removeProperty("line-height");
      delete el.dataset.fftBase;
      delete el.dataset.fftBaseLh;
    }
  }

  function findSidebar() {
    // フィード切り替えリンク(filter=...)を含む左サイドバーを探す。
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

  // フィードの描き直しを描画前に検知して即座に再適用する
  // (ポーリングだけだと、描き直された特大フォントが一瞬見えてしまう)
  let feedObserver = null;
  let observedFeed = null;

  function ensureFeedObserver(mainEl) {
    const feed = mainEl.querySelector('[role="feed"]');
    if (!feed || feed === observedFeed) return;
    if (feedObserver) feedObserver.disconnect();
    feedObserver = new MutationObserver(() => {
      if (!isActive()) return;
      const main = document.querySelector('[role="main"]');
      if (!main) return;
      widenFeed(main);
      const f = main.querySelector('[role="feed"]');
      if (f) scaleTextIn(f);
    });
    feedObserver.observe(feed, { childList: true, subtree: true });
    observedFeed = feed;
  }

  function dropFeedObserver() {
    if (feedObserver) feedObserver.disconnect();
    feedObserver = null;
    observedFeed = null;
  }

  function isActive() {
    return enabled && zoomEnabled && isFriendsFeedUrl(location.href);
  }

  function applyView() {
    const active = isActive();
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
        widenFeed(main);
        const feed = main.querySelector('[role="feed"]');
        if (feed) scaleTextIn(feed);
        ensureFeedObserver(main);
      }
    } else {
      dropFeedObserver();
      if (hiddenSidebar) {
        hiddenSidebar.style.removeProperty("display");
        hiddenSidebar = null;
      }
      restoreFeed();
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
  // applyView はフォールバックとして定期的にも呼ぶ(通常は observer が先に処理)。
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

  // ---- 診断ダンプ ----
  // ページ構造と実測フォントサイズを匿名化して JSON 化する。
  // 投稿の本文・名前は含めない(テキストは文字数のみ記録)。
  function buildDump() {
    const main = document.querySelector('[role="main"]');
    const feed = main && main.querySelector('[role="feed"]');
    const dump = {
      version: chrome.runtime.getManifest().version,
      url: location.href,
      ua: navigator.userAgent,
      innerWidth: window.innerWidth,
      innerHeight: window.innerHeight,
      dpr: window.devicePixelRatio,
      vvScale: window.visualViewport ? window.visualViewport.scale : null,
      settings: { enabled, zoomEnabled, zoomSetting },
      mainZoom: main ? main.style.zoom : null,
      hasMain: Boolean(main),
      hasFeed: Boolean(feed),
      sidebarHidden: Boolean(hiddenSidebar && hiddenSidebar.isConnected),
      sidebarFound: Boolean(findSidebar()),
      fontScale: feed ? fontScale(feed) : null,
      cards: [],
    };
    if (feed) {
      const vh = window.innerHeight;
      let i = -1;
      for (const card of feed.children) {
        i++;
        const r = card.getBoundingClientRect();
        if (r.bottom < -vh || r.top > 2 * vh) continue;
        const texts = [];
        const walker = document.createTreeWalker(card, NodeFilter.SHOW_ELEMENT);
        for (let el = walker.nextNode(); el; el = walker.nextNode()) {
          const t = [...el.childNodes]
            .filter((n) => n.nodeType === Node.TEXT_NODE)
            .map((n) => n.textContent)
            .join("")
            .trim();
          if (!t) continue;
          texts.push({
            tag: el.tagName.toLowerCase(),
            fontPx: getComputedStyle(el).fontSize,
            inline: el.getAttribute("style") || "",
            fft: el.dataset.fftFont || "",
            len: t.length,
          });
        }
        dump.cards.push({
          i,
          top: Math.round(r.top),
          h: Math.round(r.height),
          w: Math.round(r.width),
          texts,
        });
      }
    }
    return dump;
  }

  function downloadDump() {
    const blob = new Blob([JSON.stringify(buildDump(), null, 1)], {
      type: "application/json",
    });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "fft-diagnostic.json";
    document.body.appendChild(a);
    a.click();
    a.remove();
  }

  // ポップアップからのメッセージ(診断表示・診断ダンプ)
  chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    if (!msg) return;
    if (msg.type === "fft-dump") {
      downloadDump();
      sendResponse({ ok: true });
      return;
    }
    if (msg.type !== "fft-status") return;
    sendResponse({
      friendsFeed: isFriendsFeedUrl(location.href),
      sidebarHidden: Boolean(hiddenSidebar && hiddenSidebar.isConnected),
      sidebarFound: Boolean(
        findSidebar() || (hiddenSidebar && hiddenSidebar.isConnected)
      ),
      linkCount: document.querySelectorAll('a[href*="filter="]').length,
      hasMain: Boolean(document.querySelector('[role="main"]')),
    });
  });
})();
