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
├── content/       ← your YAML/JSON data files
├── styles/        ← CSS for templates
├── templates/     ← Handlebars HTML templates
├── assets/
│   ├── fonts/     ← vendored woff2 font files
│   └── images/    ← profile photos and other images
└── dictionaries/  ← spell-check dictionaries and whitelists
```

Generated PDFs and HTML go to `./resumes/` at the project root.

## Usage

```bash
resumint [file] [options]

# Or without global install
npm start [file] [options]
```

### Arguments

- `file`: Data file name to look up in `./workspace/content/` (e.g. `example.yaml`). Accepts YAML or JSON. Omit the extension to default to `.yaml`. Omit entirely to use `resume.yaml`. Overridden by `--data`.

### Options

| Flag             | Alias | Description                                                           | Default                         |
| ---------------- | ----- | --------------------------------------------------------------------- | ------------------------------- |
| `--data`         | `-d`  | Explicit path to a YAML or JSON file (overrides positional `file`)    | —                               |
| `--language`     | `-l`  | Generate for a specific language only                                 | all languages in file           |
| `--name`         | `-n`  | Output filename stem (e.g. `john-doe` → `2026-05-11-en-john-doe.pdf`) | data filename                   |
| `--template`     | `-t`  | Template name to use                                                  | from file metadata or `default` |
| `--output`       | `-o`  | Output directory                                                      | `./resumes`                     |
| `--html`         |       | Save HTML alongside PDFs                                              | `false`                         |
| `--htmlOnly`     |       | Generate HTML only, no PDFs                                           | `false`                         |
| `--templatesDir` |       | Directory containing templates                                        | `./workspace/templates`         |
| `--browserPath`  |       | Path to Chrome/Chromium executable                                    | auto-detected                   |
| `--noSpellCheck` |       | Skip spell checking                                                   | `false`                         |
| `--verbose`      | `-V`  | Print detailed logs and timing information                            | `false`                         |

### Examples

```bash
# Generate from a file in ./workspace/content/
resumint example.yaml

# English only
resumint example.yaml --language en

# Custom template
resumint example.yaml --template fancy

# Save both HTML and PDF
resumint example.yaml --html --output ./my-resumes

# File outside workspace/content/
resumint --data ./path/to/resume.yaml

# Skip spell checking
resumint example.yaml --noSpellCheck

# Custom output filename stem
resumint example.yaml --name john-doe

# Verbose output with timings
resumint example.yaml --verbose
```

### Browser detection

ResuMint uses your system Chrome/Chromium to render PDFs. The executable is resolved in this order:

1. `--browserPath` CLI argument
2. `PUPPETEER_EXECUTABLE_PATH` environment variable
3. Common system locations (`/usr/bin/google-chrome`, `/Applications/Google Chrome.app/...`, `C:\Program Files\Google\Chrome\...`, etc.)

If none are found, generation fails with a hint to install Chrome or pass `--browserPath`.

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

Templates are Handlebars HTML files in `./workspace/templates/`, named `[name].html`. The default template is `default.html`.

To create a custom template:

1. Copy `workspace/templates/default.html` to `workspace/templates/[name].html`
2. Edit the markup and styles as needed
3. Set `metadata.template: [name]` in your data file, or pass `--template [name]`

Available Handlebars helpers:

| Helper       | Usage                   | Description                                 |
| ------------ | ----------------------- | ------------------------------------------- |
| `lookup`     | `{{lookup obj key}}`    | Resolves a localized string by language key |
| `join`       | `{{join array ", "}}`   | Joins an array with a separator             |
| `eq`         | `{{#if (eq a b)}}`      | Equality check                              |
| `getIconSvg` | `{{{getIconSvg type}}}` | Renders an inline SVG icon by contact type  |

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
