import assert from "node:assert/strict";
import { test } from "node:test";
import {
    cleanWord,
    extractText,
    shouldSkip
} from "../src/spell-check/worker.js";

// --- extractText ---

test("drops script and style contents", () => {
    assert.equal(extractText(`<p>Hi</p><script>var x="no";</script>`), "Hi");
    assert.equal(extractText(`<style>.a{color:red}</style><p>Yo</p>`), "Yo");
});

test("tags become separators, not deletions", () => {
    assert.equal(extractText("<b>Hello</b><i>World</i>"), "Hello World");
});

test("decodes the handled entity set", () => {
    assert.equal(extractText("Tom &amp; Jerry"), "Tom & Jerry");
    assert.equal(extractText("a &lt;b&gt; c"), "a <b> c");
    assert.equal(extractText("x&nbsp;y"), "x y");
});

test("collapses whitespace and trims", () => {
    assert.equal(extractText("  a\n\t b  "), "a b");
});

// --- cleanWord ---

test("strips leading and trailing punctuation only", () => {
    assert.equal(cleanWord("hello,"), "hello");
    assert.equal(cleanWord("(world)"), "world");
    assert.equal(cleanWord("co-op"), "co-op"); // internal hyphen kept
    assert.equal(cleanWord("a.b"), "a.b"); // internal dot kept
});

test("strips em/en dashes and straight quotes", () => {
    assert.equal(cleanWord("—dash—"), "dash"); // em dashes (U+2014)
    assert.equal(cleanWord('"hi"'), "hi"); // straight double quotes
    assert.equal(cleanWord("'hi'"), "hi"); // straight single quotes
});

test("an all-punctuation token collapses to empty", () => {
    assert.equal(cleanWord("..."), "");
});

// --- shouldSkip ---

test("skips tokens containing digits", () => {
    assert.equal(shouldSkip("abc123"), true);
    assert.equal(shouldSkip("v2"), true);
});

test("skips tokens with no letters", () => {
    assert.equal(shouldSkip("!!!"), true);
    assert.equal(shouldSkip("—"), true);
});

test("skips single-letter tokens after cleaning", () => {
    assert.equal(shouldSkip("a"), true);
    assert.equal(shouldSkip("(x)"), true);
});

test("keeps ordinary words, including accented ones", () => {
    assert.equal(shouldSkip("hello"), false);
    assert.equal(shouldSkip("go"), false);
    assert.equal(shouldSkip("café"), false);
});
