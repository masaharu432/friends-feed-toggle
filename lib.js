"use strict";

// Facebook 標準の「友達フィード」(時系列・友達の投稿のみ)。
// Facebook 側でこの URL が変わった場合はここだけ直せばよい。
const FRIENDS_FEED_QUERY = "?filter=friends&sk=h_chr";

const FACEBOOK_HOSTS = /^(www|web|m|touch|mbasic)\.facebook\.com$/;
const HOME_PATHS = new Set(["/", "/home.php"]);
// これ以外の sk 値(レガシー URL)はホームではない可能性があるため転送しない
const HOME_SK_VALUES = new Set(["h_chr", "h_nor", "welcome"]);

/**
 * href がホームフィードなら転送先(同一オリジンの友達フィード URL)を返す。
 * 転送対象でなければ null。転送先自体は filter パラメータを持つため
 * この関数を通すと必ず null になり、ループしない。
 */
function getRedirectTarget(href) {
  let url;
  try {
    url = new URL(href);
  } catch {
    return null;
  }
  if (url.protocol !== "https:") return null;
  if (!FACEBOOK_HOSTS.test(url.hostname)) return null;
  if (!HOME_PATHS.has(url.pathname)) return null;
  if (url.searchParams.has("filter")) return null;
  const sk = url.searchParams.get("sk");
  if (sk !== null && !HOME_SK_VALUES.has(sk)) return null;
  return url.origin + "/" + FRIENDS_FEED_QUERY;
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = { getRedirectTarget };
}
