# ResuMint

A refreshing tool for developers who maintain multilingual resumes.

Stop fighting clunky Word docs, endless formatting battles, and sneaky typos. If you don't know Adobe and won't touch Canva, ResuMint takes your structured YAML data, applies your HTML/CSS templates, and outputs multilingual PDF resumes — all with a single command. It even spell-checks your content before generating.

## Getting Started

```bash
# Clone the repository
git clone https://github.com/yergios/resumint.git
cd resumint

# Install dependencies
pnpm install

# Build TypeScript source
pnpm build

# Install a headless browser (skip if Chrome is already installed)
npx puppeteer browsers install chrome

# (Optional) Make resumint available as a global CLI command
pnpm link --global
```

## Usage

```bash
resumint [file] [options]

# Or without global install
npm start [file] [options]
```

### Arguments

- `file`: YAML file name to look up in `./data/` (e.g. `example-data.yaml`). Omit to use `resume-data.yaml`. Overridden by `--data`.

### Options

| Flag             | Alias | Description                                                | Default                         |
| ---------------- | ----- | ---------------------------------------------------------- | ------------------------------- |
| `--data`         | `-d`  | Explicit path to a YAML file (overrides positional `file`) | —                               |
| `--language`     | `-l`  | Generate for a specific language only                      | all languages in file           |
| `--template`     | `-t`  | Template name to use                                       | from file metadata or `default` |
| `--output`       | `-o`  | Output directory                                           | `./output`                      |
| `--html`         |       | Save HTML alongside PDFs                                   | `false`                         |
| `--htmlOnly`     |       | Generate HTML only, no PDFs                                | `false`                         |
| `--templatesDir` |       | Directory containing templates                             | `./templates`                   |
| `--noSpellCheck` |       | Skip spell checking                                        | `false`                         |

### Examples

```bash
# Try the demo
pnpm demo

# Generate from a file in ./data/
resumint example-data.yaml

# English only
resumint example-data.yaml --language en

# Custom template
resumint example-data.yaml --template fancy

# Save both HTML and PDF
resumint example-data.yaml --html --output ./my-resumes

# File outside ./data/
resumint --data ./path/to/resume.yaml

# Skip spell checking
resumint example-data.yaml --noSpellCheck
```

## Data File

ResuMint reads YAML files. See [`data/example-data.yaml`](data/example-data.yaml) for a complete example with multilingual support.

Localized fields accept any language code that matches an entry in `languages`. Contact info is displayed in a fixed opinionated order (email → web → phone → github → location → linkedin) regardless of the order in the file.

## Templates

Templates are Handlebars HTML files in `./templates/`, named `[name]-template.html`. The default template is `default-template.html`.

To create a custom template:

1. Copy `templates/default-template.html` to `templates/[name]-template.html`
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

Fonts are vendored locally in `./fonts/` and declared in `css/styles.css` via `@font-face`. This avoids network requests during PDF generation.

To replace or add a font:

1. Download the `.woff2` file for the weight you need. [Fontsource](https://fontsource.org) provides woff2 files for most Google Fonts:

   ```bash
   # Example: download Inter 400 via jsDelivr
   curl -o fonts/inter-400.woff2 \
     "https://cdn.jsdelivr.net/npm/@fontsource/inter@5.1.1/files/inter-latin-400-normal.woff2"
   ```

2. Add a `@font-face` rule in `css/styles.css`:

   ```css
   @font-face {
     font-family: "Inter";
     font-style: normal;
     font-weight: 400;
     src: url("../fonts/inter-400.woff2") format("woff2");
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

Icons are inline SVGs rendered by the `getIconSvg` Handlebars helper, defined in `src/generator.ts`. No external scripts or CDN requests are needed.

To add a new icon type:

1. Get the SVG markup. [Ionicons](https://ionic.io/ionicons) is a good source — find your icon, open the SVG file, and copy the markup:

   ```bash
   curl -s "https://cdn.jsdelivr.net/npm/ionicons@7.1.0/dist/svg/heart-outline.svg"
   ```

2. Add an entry to the `ICON_SVGS` record in `src/generator.ts`:

   ```typescript
   const ICON_SVGS: Record<string, string> = {
     // existing icons...
     heart: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">...</svg>`
   };
   ```

3. Use the new type in your data file:

   ```yaml
   contactInfo:
     - type: heart
       value: some value
   ```

4. Rebuild: `pnpm build`

The SVG inherits `color: currentColor` from the `.contact-item svg` CSS rule, so it matches the surrounding text color automatically.

## Spell Checking

Spell checking runs by default and reports misspelled words with suggestions. Use `--noSpellCheck` to skip it.

### Adding Dictionaries

English and Spanish dictionaries are included. To add another language:

1. Download the `.aff` and `.dic` files for your language from [wooorm/dictionaries](https://github.com/wooorm/dictionaries/tree/main/dictionaries)
2. Name them using the language code (e.g. `fr.aff`, `fr.dic` for French)
3. Place both files in `./dictionaries/`

### Custom Whitelist

Add terms to suppress false positives:

1. Create a text file in `./dictionaries/whitelist/`:
   - `whitelist.txt` — applies to all languages
   - `whitelist-en.txt` — English only
   - `whitelist-es.txt` — Spanish only
2. One term per line; lines starting with `#` are comments

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
