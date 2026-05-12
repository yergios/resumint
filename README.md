# ResuMint

A refreshing tool for web developers who maintain multilingual resumes. It uses exactly what you already know. No need to learn yet another syntax.

No more clunky Word docs, figuring out Canva nor need to learn Adobe. Just write your content in a YAML or JSON file and get your PDF resumes generated. ResuMint may even check out spelling for you.

For those who may want further customization and pixel-perfect control, you can create your own HTML templates and style them with CSS.

## Prerequisites

- **Node.js 20+** — [nodejs.org](https://nodejs.org)
- **Chromium** — required for PDF generation. ResuMint uses your system browser. Skip if you only use `--htmlOnly`.

## Getting Started

```bash
# Clone the repository
git clone https://github.com/yergios/resumint.git
cd resumint

# Install dependencies
npm ci

# Build TypeScript source
npm run build

# (Optional) Make resumint available as a global CLI command
npm link --global
```

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

Generated PDFs and HTML go to `./resumes/` at the project root.

## Usage

```bash
resumint [path] [options]

# Or without global install
npm start [path] [options]
```

### Arguments

- `path`: Full path (relative or absolute) to a YAML or JSON data file. Extension (`.yaml`, `.yml`, `.json`) is required. Defaults to `./workspace/content/resume.yaml` if omitted.

### Options

| Flag                 | Alias | Description                                                           | Default                                                                      |
| -------------------- | ----- | --------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| `--language`         | `-l`  | Generate for a specific language only                                 | all languages in file                                                        |
| `--name`             | `-n`  | Output filename stem (e.g. `john-doe` → `2026-05-12-en-john-doe.pdf`) | content input filename                                                       |
| `--template-path`    | `-t`  | Path to a template HTML file                                          | `metadata.template` in input file, else `./workspace/templates/default.html` |
| `--output-path`      | `-o`  | Output directory                                                      | `./resumes`                                                                  |
| `--browser-path`     | `-b`  | Path to Chrome/Chromium executable                                    | auto-detected                                                                |
| `--format`           | `-f`  | Output format: `pdf`, `html`, or `both`                               | `pdf`                                                                        |
| `--skip-spell-check` | `-s`  | Skip spell checking                                                   | `false`                                                                      |
| `--verbose`          | `-V`  | Print detailed logs and timing information                            | `false`                                                                      |

### Examples

```bash
# Use default ./workspace/content/resume.yaml
resumint

# Explicit data file path
resumint ./workspace/content/example.yaml

# English only
resumint ./workspace/content/example.yaml --language en

# Custom template path
resumint ./workspace/content/example.yaml -t ./workspace/templates/fancy.html

# Keep HTML alongside the PDF, custom output dir
resumint ./workspace/content/example.yaml -f both -o ./my-resumes

# HTML only, no PDF
resumint ./workspace/content/example.yaml --format html

# Skip spell checking
resumint ./workspace/content/example.yaml -s

# Custom output filename stem
resumint ./workspace/content/example.yaml --name john-doe

# Verbose output with timings
resumint ./workspace/content/example.yaml --verbose
```

### Browser detection

ResuMint uses your system Chrome/Chromium to render PDFs. The executable is resolved in this order:

1. `--browser-path` CLI argument
2. `PUPPETEER_EXECUTABLE_PATH` environment variable
3. Common system locations (`/usr/bin/google-chrome`, `/Applications/Google Chrome.app/...`, `C:\Program Files\Google\Chrome\...`, etc.)

If none are found, generation fails with a hint to install Chrome or pass `--browser-path`.

To set the browser path once for convenience, copy `.env.example` to `.env` and fill in the value:

```bash
cp .env.example .env
# then edit .env and set PUPPETEER_EXECUTABLE_PATH to your browser path
```

ResuMint loads `.env` automatically on startup if the file exists.

## Data File

ResuMint accepts YAML or JSON. YAML is recommended — it's less noisy for deeply nested, multilingual data. See [`workspace/content/example.yaml`](workspace/content/example.yaml) for a complete example.

Localized fields accept any language code that matches an entry in `languages`. Contact items are displayed in the order they appear in the file.

## Templates

Templates are plain HTML files with a small set of mustache-style tags. The default template is `./workspace/templates/default.html`.

To create a custom template:

1. Copy `workspace/templates/default.html` to a new file (any path)
2. Edit the markup and styles as needed
3. Set `metadata.template: ./path/to/your-template.html` in your data file, or pass `--template-path ./path/to/your-template.html`

Supported template tags:

| Syntax                           | Behavior                                                                          |
| -------------------------------- | --------------------------------------------------------------------------------- |
| `{{path.to.var}}`                | HTML-escaped interpolation. Dotted paths supported.                               |
| `{{{path.to.var}}}`              | Raw interpolation (no escaping). Use for trusted HTML like SVG.                   |
| `{{#each arr}}...{{/each}}`      | Iterate. Inside: `{{this}}` for scalars, `{{@index}}`, `{{@first}}`, `{{@last}}`. |
| `{{#if path}}...{{/if}}`         | Render if value is truthy.                                                        |
| `{{#unless path}}...{{/unless}}` | Render if value is falsy.                                                         |

Localized strings are resolved before rendering: any object in your data file whose keys are all language codes (e.g. `{ en: "Hello", es: "Hola" }`) is replaced with the value for the active language. Templates see the resolved string directly — no helpers needed.

Each `contactInfo` item gets an `iconSvg` field auto-attached (inline SVG looked up by `type`). Use `{{{iconSvg}}}` in custom templates.

## Vendoring Fonts

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

## Vendoring Icons

Icons are inline SVGs rendered by the `getIconSvg` Handlebars helper, defined in `src/icons.ts`. No external scripts or CDN requests are needed.

To add a new icon type:

1. Get the SVG markup. [Ionicons](https://ionic.io/ionicons) is a good source — find your icon, open the SVG file, and copy the markup:

   ```bash
   curl -s "https://cdn.jsdelivr.net/npm/ionicons@7.1.0/dist/svg/heart-outline.svg"
   ```

2. Add an entry to the `ICON_SVGS` record in `src/icons.ts`:

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

4. Rebuild: `npm run build`

The SVG inherits `color: currentColor` from the `.contact-item svg` CSS rule, so it matches the surrounding text color automatically.

## Spell Checking

Spell checking runs by default and reports misspelled words with suggestions. Use `--noSpellCheck` to skip it.

### Adding Dictionaries

English and Spanish dictionaries are included. To add another language:

1. Download the `.aff` and `.dic` files for your language from [wooorm/dictionaries](https://github.com/wooorm/dictionaries/tree/main/dictionaries)
2. Name them using the language code (e.g. `fr.aff`, `fr.dic` for French)
3. Place both files in `./workspace/dictionaries/`

### Custom Whitelist

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

## License

This project is licensed under the [MIT License](LICENSE).
