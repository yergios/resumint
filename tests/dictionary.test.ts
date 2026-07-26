import assert from "node:assert/strict";
import { test } from "node:test";
import { whitelistAppliesTo } from "../src/spell-check/dictionary.js";

test("a suffix-less whitelist applies to every language", () => {
    assert.equal(whitelistAppliesTo("whitelist.txt", "en"), true);
    assert.equal(whitelistAppliesTo("whitelist.txt", "es"), true);
});

test("a language-suffixed whitelist applies only to that language", () => {
    assert.equal(whitelistAppliesTo("whitelist-en.txt", "en"), true);
    assert.equal(whitelistAppliesTo("whitelist-en.txt", "es"), false);
    assert.equal(whitelistAppliesTo("whitelist-es.txt", "es"), true);
});
