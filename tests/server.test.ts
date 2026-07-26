import assert from "node:assert/strict";
import { test } from "node:test";
import { collectAssetDirs, resolveSafePath } from "../src/serve/server.js";

// These tests assume POSIX paths (the development platform).
const ROOT = "/proj";

// --- resolveSafePath (path-traversal guard) ---

test("resolves a normal asset path under the root", () => {
    assert.equal(
        resolveSafePath(ROOT, "/styles/app.css"),
        "/proj/styles/app.css"
    );
});

test("rejects encoded traversal", () => {
    assert.equal(resolveSafePath(ROOT, "/%2e%2e/%2e%2e/etc/passwd"), null);
});

test("rejects literal traversal", () => {
    assert.equal(resolveSafePath(ROOT, "/../../etc/passwd"), null);
});

test("rejects malformed percent-encoding instead of throwing", () => {
    assert.equal(resolveSafePath(ROOT, "/%"), null);
});

test("inner ../ that stays within the root is allowed", () => {
    assert.equal(resolveSafePath(ROOT, "/a/../b.css"), "/proj/b.css");
});

// --- collectAssetDirs (watch targets for live reload) ---

test("collects the directory of a relative asset, resolved against baseHref", () => {
    const html = `<link href="../styles/app.css">`;
    assert.deepEqual(collectAssetDirs(html, ROOT, "/workspace/templates/"), [
        "/proj/workspace/styles"
    ]);
});

test("skips external, protocol-relative, anchor, data, and base refs", () => {
    const html = [
        `<base href="/workspace/templates/">`,
        `<script src="https://cdn.example/x.js"></script>`,
        `<a href="//cdn.example/y">`,
        `<a href="#top">`,
        `<img src="data:image/png;base64,AAAA">`
    ].join("");
    assert.deepEqual(collectAssetDirs(html, ROOT, "/workspace/templates/"), []);
});

test("dedups multiple assets from the same directory", () => {
    const html = `<link href="a.css"><script src="b.js"></script>`;
    assert.deepEqual(collectAssetDirs(html, ROOT, "/workspace/templates/"), [
        "/proj/workspace/templates"
    ]);
});
