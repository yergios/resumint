# ResuMint

Generate multilingual, multi-variant PDF resumes from a single YAML or JSON file — using tools you already know. Write your content, get clean PDFs. Bring your own HTML/CSS template for pixel-perfect control, or use the default.

## Contents

- [Try it out](#try-it-out) — clone, run the example, use your own resume
- [Live preview](#live-preview) — edit content and styles with instant reload
- [Options and flags](#options-and-flags) — every flag, with examples
- [Data file](#data-file)
- [Variants](#variants)
- [Templates](#templates)
- [Spell checking](#spell-checking)
- [Fonts](#fonts)
- [Icons](#icons)
- [Workspace layout](#workspace-layout)
- [Browser detection](#browser-detection)
- [License](#license)

## Try it out

**Prerequisites:** [Node.js 20+](https://nodejs.org) and Chrome/Chromium (used to render PDFs).

Clone and build:

```bash
git clone https://github.com/yergios/resumint.git
cd resumint
pnpm install
pnpm build
```

Point ResuMint at your browser. Auto-detection handles common locations, so this is only needed if it fails:

```bash
cp .env.example .env
# edit .env and set PUPPETEER_EXECUTABLE_PATH to your Chrome/Chromium executable
```

Generate the bundled example:

```bash
pnpm demo
```

The PDFs land in `./resumes/`. Done.

### Use your own resume

Put your data at `./workspace/content/resume.yaml` (the default input path), then run:

```bash
pnpm start
```

To call `resumint` directly instead of `pnpm start`, link it globally once:

```bash
pnpm link --global
resumint          # equivalent to: pnpm start
```

The quickest start is to copy [`workspace/content/example.yaml`](workspace/content/example.yaml) to `resume.yaml` and edit it.

## Live preview

Develop your content and template with instant feedback, like a frontend dev server. `--serve` renders the resume to HTML and reloads your browser automatically whenever you save a change to the content, the template, or its stylesheet:

```bash
resumint --serve                                    # default input
resumint ./workspace/content/example.yaml --serve -v en
```

Open **http://localhost:3000** and edit away — the page reloads on every save.

- **HTML only** — no PDF is produced and no browser is launched, so `--serve` works even without Chrome installed. The preview renders in screen mode; use your browser's print preview to check page breaks.
- **One variant at a time** — `--serve` honors `-v` and otherwise previews the first variant in the file.
- **Error-tolerant** — a broken YAML or template shows an error page instead of crashing the server, and recovers on your next valid save.

## Options and flags

```bash
resumint [path] [options]
```

`path` is a YAML or JSON data file (relative or absolute); the extension (`.yaml`, `.yml`, `.json`) is required. Defaults to `./workspace/content/resume.yaml`.

| Flag                 | Alias | Description                                                            | Default                           |
| -------------------- | ----- | --------------------------------------------------------------------- | --------------------------------- |
| `--serve`            |       | Start a live-preview server (HTML only, auto-reload)                  | `false`                           |
| `--variant`          | `-v`  | Generate one variant only                                             | all variants in file              |
| `--format`           | `-f`  | Output format: `pdf`, `html`, or `both`                               | `pdf`                             |
| `--output-path`      | `-o`  | Output directory for PDFs                                             | `./resumes`                       |
| `--name`             | `-n`  | Output filename stem (e.g. `john-doe` → `20260512-en-john-doe.pdf`)   | input filename                    |
| `--template-path`    | `-t`  | Path to a template HTML file                                          | `./workspace/templates/default.html` |
| `--browser-path`     | `-b`  | Path to Chrome/Chromium executable                                    | auto-detected                     |
| `--skip-spell-check` | `-s`  | Skip spell checking                                                   | `false`                           |
| `--verbose`          | `-V`  | Print detailed logs and timing information                            | `false`                           |
| `--help`             | `-h`  | Show usage and exit                                                   |                                   |
| `--version`          |       | Show version and exit                                                 |                                   |

PDFs are written to `./resumes` (or `--output-path`). With `--format html` or `both`, the HTML file is written to the current working directory.

### Examples

```bash
# Default input, all variants, PDF
resumint

# One variant of a specific file
resumint ./workspace/content/example.yaml --variant en

# HTML and PDF, into a custom directory
resumint ./workspace/content/example.yaml -f both -o ./my-resumes

# HTML only, no PDF
resumint ./workspace/content/example.yaml --format html

# Custom template and output filename
resumint ./workspace/content/example.yaml -t ./workspace/templates/fancy.html -n john-doe

# Skip spell checking, with timings
resumint ./workspace/content/example.yaml -s --verbose
```

## Data file

ResuMint accepts YAML or JSON. YAML is recommended — it's less noisy for deeply nested data. See [`workspace/content/example.yaml`](workspace/content/example.yaml) for a complete example.

Contact items are displayed in the order they appear in the file.

## Variants

A **variant** is one output of your data file — a single PDF or HTML resume. ResuMint generates one resume per entry in the top-level `variants:` list. Pick whatever axis you like: language, role, length, audience.

Declare variants as a list of strings, or as objects with an optional `language:` for spell-checking:

```yaml
# Multilingual — string shorthand (name == language)
variants: [en, es]

# Role flavors — same language, different content slant
variants:
  - name: fullstack
    language: en
  - name: backend
    language: en
  - name: frontend
    language: en

# Mixed forms in the same file
variants:
  - en                       # spell-checked as English
  - name: backend            # no language → no spell-check
  - name: short
    language: en
```

A string entry `s` is sugar for `{ name: s, language: s }`. An object entry requires `name`; `language` is optional.

Any object in your data whose keys are all variant names is collapsed to the active variant's value:

```yaml
basic:
  title:
    fullstack: Full Stack Engineer
    backend: Backend Engineer
    frontend: Frontend Engineer
```

For multilingual variants this is the familiar `{ en: "...", es: "..." }` pattern — it works the same way, the keys are just variant names now.

The output filename includes the variant name: `20260512-fullstack-john-doe.pdf`.

## Templates

Templates are plain HTML files with a small set of mustache-style tags. The default is `./workspace/templates/default.html`.

To use a custom template:

1. Copy `workspace/templates/default.html` to a new file (any path).
2. Edit the markup and styles.
3. Pass it with `--template-path ./path/to/your-template.html`.

Supported template tags:

| Syntax                           | Behavior                                                                          |
| -------------------------------- | --------------------------------------------------------------------------------- |
| `{{path.to.var}}`                | HTML-escaped interpolation. Dotted paths supported.                               |
| `{{{path.to.var}}}`              | Raw interpolation (no escaping). Use for trusted HTML like SVG.                   |
| `{{#each arr}}...{{/each}}`      | Iterate. Inside: `{{this}}` for scalars, `{{@index}}`, `{{@first}}`, `{{@last}}`. |
| `{{#if path}}...{{/if}}`         | Render if value is truthy.                                                        |
| `{{#unless path}}...{{/unless}}` | Render if value is falsy.                                                         |

Variant-keyed strings are resolved before rendering: any object whose keys are all variant names (e.g. `{ en: "Hello", es: "Hola" }`) is replaced with the value for the active variant. Templates see the resolved string directly — no helpers needed.

Each `contactInfo` item gets an `iconSvg` field auto-attached (inline SVG looked up by `type`). Use `{{{iconSvg}}}` in custom templates.

## Spell checking

Spell checking runs by default and reports the misspelled words it finds. Use `--skip-spell-check` (`-s`) to skip it.

It is driven by `variant.language`. Variants declared without a `language:` (e.g. `- name: backend`) are skipped silently — useful for role-flavor variants where the dictionary doesn't matter.

### Adding dictionaries

English and Spanish dictionaries are included. To add another language:

1. Download the `.aff` and `.dic` files for your language from [wooorm/dictionaries](https://github.com/wooorm/dictionaries/tree/main/dictionaries).
2. Name them with the language code (e.g. `fr.aff`, `fr.dic`).
3. Place both files in `./workspace/dictionaries/`.

### Custom whitelist

Add terms to suppress false positives. Place text files directly in `./workspace/dictionaries/`:

- `whitelist.txt` — applies to all languages
- `whitelist-en.txt` — English only
- `whitelist-es.txt` — Spanish only

One term per line; lines starting with `#` are comments.

```text
# Technical terms
TypeScript
PostgreSQL

# Brand names
GitHub
LinkedIn
```

## Fonts

Fonts are vendored locally in `./workspace/assets/fonts/` and declared in `workspace/styles/styles.css` via `@font-face`. This avoids network requests during PDF generation.

To replace or add a font:

1. Download the `.woff2` file for the weight you need. [Fontsource](https://fontsource.org) provides woff2 files for most Google Fonts:

   ```bash
   # Example: download Inter 400 via jsDelivr
   curl -o workspace/assets/fonts/inter-400.woff2 \
     "https://cdn.jsdelivr.net/npm/@fontsource/inter@5.1.1/files/inter-latin-400-normal.woff2"
   ```

2. Add a `@font-face` rule in `workspace/styles/styles.css`:

   ```css
   @font-face {
     font-family: "Inter";
     font-style: normal;
     font-weight: 400;
     src: url("../assets/fonts/inter-400.woff2") format("woff2");
   }
   ```

3. Update the `--font-main` variable if switching families:

   ```css
   :root {
     --font-main: "Your Font", sans-serif;
   }
   ```

Only download the weights you actually use. ResuMint currently uses **400** (body), **600** (headings), and **700** (company names, institutions).

## Icons

Icons are inline SVGs defined in the `ICON_SVGS` record in `src/generate/icons.ts`. No external scripts or CDN requests are needed.

To add a new icon type:

1. Get the SVG markup. [Ionicons](https://ionic.io/ionicons) is a good source — find your icon, open the SVG file, and copy the markup:

   ```bash
   curl -s "https://cdn.jsdelivr.net/npm/ionicons@7.1.0/dist/svg/heart-outline.svg"
   ```

2. Add an entry to `ICON_SVGS` in `src/generate/icons.ts`:

   ```typescript
   export const ICON_SVGS: Record<string, string> = {
     // existing icons...
     heart: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">...</svg>`,
   };
   ```

3. Use the new type in your data file:

   ```yaml
   contactInfo:
     - type: heart
       value: some value
   ```

4. Rebuild: `pnpm build`.

The SVG inherits `color: currentColor` from the `.contact-item svg` CSS rule, so it matches the surrounding text color automatically.

## Workspace layout

All user-facing files live under `workspace/`. Everything else is implementation.

```
workspace/
├── content/       ← your YAML/JSON input files
├── styles/        ← CSS for templates
├── templates/     ← HTML templates
├── assets/
│   ├── fonts/     ← vendored woff2 font files
│   └── images/    ← profile photos and other images
└── dictionaries/  ← spell-check dictionaries and whitelists
```

## Browser detection

ResuMint uses your system Chrome/Chromium to render PDFs. The executable is resolved in this order:

1. `--browser-path` CLI argument
2. `PUPPETEER_EXECUTABLE_PATH` environment variable
3. Common system locations (`/usr/bin/google-chrome`, `/Applications/Google Chrome.app/...`, `C:\Program Files\Google\Chrome\...`, etc.)

If none are found, generation fails with a hint to install Chrome or pass `--browser-path`. To set the path once, put it in `.env` (copied from `.env.example`); ResuMint loads `.env` automatically on startup. Live preview (`--serve`) needs no browser at all.

## License

This project is licensed under the [MIT License](LICENSE).
