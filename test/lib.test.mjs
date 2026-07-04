import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { getRedirectTarget, isFriendsFeedUrl } = require("../lib.js");

const FRIENDS = "https://www.facebook.com/?filter=friends&sk=h_chr";

test("ホーム(/)は友達フィードへ転送する", () => {
  assert.equal(getRedirectTarget("https://www.facebook.com/"), FRIENDS);
});

test("home.php も転送する", () => {
  assert.equal(getRedirectTarget("https://www.facebook.com/home.php"), FRIENDS);
});

test("sk=h_chr / sk=welcome 付きホームも転送する", () => {
  assert.equal(getRedirectTarget("https://www.facebook.com/?sk=h_chr"), FRIENDS);
  assert.equal(getRedirectTarget("https://www.facebook.com/?sk=welcome"), FRIENDS);
});

test("ref などの無害なパラメータ付きホームも転送する", () => {
  assert.equal(getRedirectTarget("https://www.facebook.com/?ref=tn_tnmn"), FRIENDS);
});

test("転送先そのもの(filter=friends)は転送しない(ループ防止)", () => {
  assert.equal(getRedirectTarget(FRIENDS), null);
  assert.equal(getRedirectTarget("https://www.facebook.com/?filter=all&sk=h_chr"), null);
});

test("ホーム以外のパスは転送しない", () => {
  assert.equal(getRedirectTarget("https://www.facebook.com/groups/12345"), null);
  assert.equal(getRedirectTarget("https://www.facebook.com/marketplace/"), null);
  assert.equal(getRedirectTarget("https://www.facebook.com/some.user"), null);
  assert.equal(getRedirectTarget("https://www.facebook.com/watch/"), null);
});

test("未知の sk 値は転送しない(レガシーURLの誤爆防止)", () => {
  assert.equal(getRedirectTarget("https://www.facebook.com/?sk=games"), null);
});

test("facebook.com 以外のホストは転送しない", () => {
  assert.equal(getRedirectTarget("https://www.facebook.com.evil.example/"), null);
  assert.equal(getRedirectTarget("https://developers.facebook.com/"), null);
  assert.equal(getRedirectTarget("https://example.com/"), null);
});

test("モバイル系ホスト(m / touch)は /feeds/friends へ転送する", () => {
  assert.equal(
    getRedirectTarget("https://m.facebook.com/"),
    "https://m.facebook.com/feeds/friends"
  );
  assert.equal(
    getRedirectTarget("https://touch.facebook.com/"),
    "https://touch.facebook.com/feeds/friends"
  );
});

test("デスクトップ系ホスト(web)はクエリ形式のままオリジンを維持する", () => {
  assert.equal(
    getRedirectTarget("https://web.facebook.com/home.php"),
    "https://web.facebook.com/?filter=friends&sk=h_chr"
  );
});

test("転送先の /feeds/friends 自体は転送しない(ループ防止)", () => {
  assert.equal(getRedirectTarget("https://m.facebook.com/feeds/friends"), null);
});

test("不正な URL は null を返す", () => {
  assert.equal(getRedirectTarget("not a url"), null);
});

test("isFriendsFeedUrl: 友達フィード表示中の URL だけ true", () => {
  assert.equal(isFriendsFeedUrl("https://www.facebook.com/?filter=friends&sk=h_chr"), true);
  assert.equal(isFriendsFeedUrl("https://m.facebook.com/feeds/friends"), true);
  // PC 表示でもホストが m. のままの場合がある
  assert.equal(isFriendsFeedUrl("https://m.facebook.com/?filter=friends&sk=h_chr"), true);
  assert.equal(isFriendsFeedUrl("https://www.facebook.com/feeds/friends"), true);
  assert.equal(isFriendsFeedUrl("https://www.facebook.com/"), false);
  assert.equal(isFriendsFeedUrl("https://www.facebook.com/?filter=groups&sk=h_chr"), false);
  assert.equal(isFriendsFeedUrl("https://www.facebook.com/groups/12345"), false);
  assert.equal(isFriendsFeedUrl("not a url"), false);
});
