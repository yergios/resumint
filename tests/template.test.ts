import assert from "node:assert/strict";
import { test } from "node:test";
import { renderTemplate } from "../src/generate/template.js";

test("interpolates dotted paths", () => {
    assert.equal(renderTemplate("{{a.b}}", { a: { b: "x" } }), "x");
});

test("missing paths render empty", () => {
    assert.equal(renderTemplate("[{{a.z}}]", { a: {} }), "[]");
    assert.equal(renderTemplate("[{{nope}}]", {}), "[]");
});

test("null renders empty, zero renders '0'", () => {
    assert.equal(renderTemplate("[{{v}}]", { v: null }), "[]");
    assert.equal(renderTemplate("[{{v}}]", { v: 0 }), "[0]");
});

test("{{ }} HTML-escapes all five entities", () => {
    assert.equal(
        renderTemplate("{{v}}", { v: `<b>&"'` }),
        "&lt;b&gt;&amp;&quot;&#39;"
    );
});

test("{{{ }}} interpolates raw, without escaping", () => {
    assert.equal(renderTemplate("{{{v}}}", { v: "<b>&" }), "<b>&");
});

test("each exposes this, @index, @first, @last", () => {
    const tpl =
        "{{#each items}}[{{@index}}:{{this}}{{#if @first}}F{{/if}}{{#if @last}}L{{/if}}]{{/each}}";
    assert.equal(renderTemplate(tpl, { items: ["a", "b"] }), "[0:aF][1:bL]");
});

test("each over an empty array or missing value renders nothing", () => {
    assert.equal(
        renderTemplate("x{{#each items}}y{{/each}}z", { items: [] }),
        "xz"
    );
    assert.equal(renderTemplate("x{{#each items}}y{{/each}}z", {}), "xz");
});

test("if/unless follow the falsy set (empty string, 0, empty array, null)", () => {
    const tpl = "{{#if v}}T{{/if}}{{#unless v}}F{{/unless}}";
    assert.equal(renderTemplate(tpl, { v: "" }), "F");
    assert.equal(renderTemplate(tpl, { v: 0 }), "F");
    assert.equal(renderTemplate(tpl, { v: [] }), "F");
    assert.equal(renderTemplate(tpl, { v: null }), "F");
    assert.equal(renderTemplate(tpl, { v: "hi" }), "T");
    assert.equal(renderTemplate(tpl, { v: ["x"] }), "T");
});

test("nested blocks resolve inner frames", () => {
    const tpl = "{{#each xs}}{{#if this}}{{this}},{{/if}}{{/each}}";
    assert.equal(renderTemplate(tpl, { xs: ["a", "", "b"] }), "a,b,");
});

test("unclosed block throws", () => {
    assert.throws(() => renderTemplate("{{#each x}}", {}), /Unclosed/);
});

test("mismatched close tag throws", () => {
    assert.throws(() => renderTemplate("{{#if a}}{{/each}}", {}), /Unexpected/);
});

test("stray close tag throws", () => {
    assert.throws(() => renderTemplate("{{/if}}", {}), /Unexpected/);
});
