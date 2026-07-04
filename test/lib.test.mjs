import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { getRedirectTarget } = require("../lib.js");

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

test("m / web / touch サブドメインはオリジンを維持して転送する", () => {
  assert.equal(
    getRedirectTarget("https://m.facebook.com/"),
    "https://m.facebook.com/?filter=friends&sk=h_chr"
  );
  assert.equal(
    getRedirectTarget("https://web.facebook.com/home.php"),
    "https://web.facebook.com/?filter=friends&sk=h_chr"
  );
});

test("不正な URL は null を返す", () => {
  assert.equal(getRedirectTarget("not a url"), null);
});
