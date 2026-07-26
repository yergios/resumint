import assert from "node:assert/strict";
import { test } from "node:test";
import type { Variant } from "../src/generate/types.js";
import {
    getVariantsToRun,
    resolveVariantData
} from "../src/generate/variants.js";

// --- getVariantsToRun ---

test("string entries expand to { name, language }", () => {
    assert.deepEqual(getVariantsToRun(["en", "es"]), [
        { name: "en", language: "en" },
        { name: "es", language: "es" }
    ]);
});

test("object entry without a language omits the language key", () => {
    assert.deepEqual(getVariantsToRun([{ name: "backend" }]), [
        { name: "backend" }
    ]);
});

test("object entry keeps a provided language", () => {
    assert.deepEqual(getVariantsToRun([{ name: "short", language: "en" }]), [
        { name: "short", language: "en" }
    ]);
});

test("missing or empty variants list throws", () => {
    assert.throws(() => getVariantsToRun(undefined), /No variants/);
    assert.throws(() => getVariantsToRun([]), /No variants/);
});

test("empty-string entry throws", () => {
    assert.throws(() => getVariantsToRun([""]), /empty string/);
});

test("object entry without a name throws", () => {
    assert.throws(
        () => getVariantsToRun([{ language: "en" } as unknown as Variant]),
        /non-empty 'name'/
    );
});

test("a chosen variant selects just that one; unknown throws", () => {
    assert.deepEqual(getVariantsToRun(["en", "es"], "es"), [
        { name: "es", language: "es" }
    ]);
    assert.throws(
        () => getVariantsToRun(["en", "es"], "fr"),
        /Unknown variant/
    );
});

// --- resolveVariantData (variant-keyed collapse) ---

test("collapses a variant-keyed object to the active variant's value", () => {
    const [res] = resolveVariantData(
        {
            variants: ["en", "es"],
            basic: { title: { en: "Engineer", es: "Ingeniero" } }
        },
        [{ name: "en", language: "en" }]
    );
    assert.deepEqual(res.data["basic"], { title: "Engineer" });
});

test("collapses nested variant-keyed objects", () => {
    const [res] = resolveVariantData(
        { variants: ["en", "es"], a: { b: { en: "1", es: "2" } } },
        [{ name: "es", language: "es" }]
    );
    assert.deepEqual(res.data["a"], { b: "2" });
});

test("a single variant-name key still collapses", () => {
    const [res] = resolveVariantData(
        { variants: ["en", "es"], x: { en: "only" } },
        [{ name: "en" }]
    );
    assert.equal(res.data["x"], "only");
});

test("an object with any non-variant key is left intact", () => {
    const [res] = resolveVariantData(
        { variants: ["en", "es"], x: { en: "a", other: "b" } },
        [{ name: "en" }]
    );
    assert.deepEqual(res.data["x"], { en: "a", other: "b" });
});

test("an empty object is not collapsed", () => {
    const [res] = resolveVariantData({ variants: ["en", "es"], x: {} }, [
        { name: "en" }
    ]);
    assert.deepEqual(res.data["x"], {});
});

test("resolves variant-keyed objects inside arrays", () => {
    const [res] = resolveVariantData(
        { variants: ["en", "es"], list: [{ en: "a", es: "b" }] },
        [{ name: "es" }]
    );
    assert.deepEqual(res.data["list"], ["b"]);
});
