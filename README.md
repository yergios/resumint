# ResuMint

A refreshing tool for developers who maintain multilingual resumes:

Stop fighting clunky Word docs, endless formatting battles, and sneaky typos.
If you don't know Adobe and won't touch Canva, ResuMint takes your structured JSON, applies your HTML/CSS templates and outputs multilingual PDF resumes — all with a single command.
It even spell-checks your content, so no more embarrassing mistakes 😉

## Getting Started

```bash
# Clone the repository
git clone https://github.com/asiansergio/resumint.git
cd resumint

# Install dependencies
npm install

# Build TypeScript source
npm run build

# If you have chrome installed you may skip this step
npx puppeteer browsers install chrome

# Run the tool
npm start [file] [options]

# (Optional) Use resumint directly as a CLI command from any directory
npm link --global
resumint [file] [options]
```

## Quick Start

```bash
# Try the demo with example data
npm demo

# Generate from a JSON file in the data/ directory
resumint start example-data.json
```

## Usage

```bash
resumint [file] [options]
```

### Arguments

- `file`: Resume data JSON file name from the `data/` directory (e.g. `example-data.json`). Overridden by `--data`.

### Options

- `--data, -d`: Explicit path to the resume data JSON file (overrides positional `file`)
- `--template, -t`: Template name to use (default: from metadata or "default")
- `--language, -l`: Generate resume for specific language only
- `--output, -o`: Output directory for the generated files (default: ./output)
- `--html`: Save HTML files along with PDFs
- `--htmlOnly`: Generate only HTML files, not PDFs
- `--templatesDir`: Directory containing templates (default: ./templates)
- `--noSpellCheck`: Skips spell checking

### Examples

```bash
# Generate from example data (resolves to ./data/example-data.json)
npm start example-data.json

# Generate only for English
npm start example-data.json --language en

# Use a specific template
npm start example-data.json --template fancy

# Save both HTML and PDF to custom directory
npm start example-data.json --html --output ./my-resumes

# Generate from a path outside the data/ directory
npm start --data ./my-resume.json

# Skip spell checking
npm start example-data.json --noSpellCheck
```

## Data Structure

ResuMint uses a JSON file to store your resume data. See [data/example-data.json](data/example-data.json) for a complete example with multilingual support.

## Templates

The default template is included. To create custom templates:

1. Create a new HTML file in the `templates` directory
2. Name it `[your-template-name]-template.html`
3. Use Handlebars syntax for templating

## Spell Checking

ResuMint includes built-in spell checking to catch embarrassing typos before they end up in your resume. English dictionaries are included by default.

Spell checking is active by default, use the `--noSpellCheck` flag to skip spell checking.

### Adding Additional Dictionaries

To add spell checking for other languages:

1. Download the appropriate `.aff` and `.dic` files for your language from [here](https://github.com/wooorm/dictionaries/tree/main/dictionaries) or any compatible Hunspell dictionary source.
2. Name the files using the language code (e.g., `es.aff` and `es.dic` for Spanish)
3. Place both files in the `dictionaries` directory

Example structure:

```text
resumint/
├── dictionaries/
│   ├── en.aff         # English (included)
│   ├── en.dic         # English (included)
│   ├── es.aff         # Spanish (added by user)
│   └── es.dic         # Spanish (added by user)
```

### Custom Whitelist

Add terms to prevent false positives:

1. Create whitelist files:
   - `whitelist.txt` - applies to all languages
   - `whitelist-en.txt` - applies only to English documents
   - `whitelist-es.txt` - applies only to Spanish documents
2. Add one term per line (comments start with `#`)

Example whitelist file:

```text
# Technical terms
TypeScript
PostgreSQL
Django
Redis
Kubernetes

# Company names
TechCorp
WebSolutions
```

## License

This project is licensed under the [LICENSE](LICENSE).
