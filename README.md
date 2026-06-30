# Workadu CLI

The **Workadu CLI** is a powerful command-line tool designed to seamlessly deploy any static HTML website or live URL directly into the [Workadu Builder](https://workadu.com) ecosystem. 

It handles advanced HTML parsing, localized translations, dynamic asset fetching (CSS/JS), and automatic CSS transformations (like `rem` to `px` conversions and specificity scoping) to ensure that your external designs look **exactly** as intended when imported into Workadu.

---

## 🚀 Features

- **Deploy via URL or Local File**: Pass a local HTML file or a live web URL. The CLI will automatically fetch and inline remote CSS stylesheets and Scripts.
- **Multilingual Support**: Define your text using `data-i18n="key"` in your HTML and map it to multiple languages. The CLI will generate localized versions of your page automatically.
- **Pixel-Perfect CSS Protection**: Workadu Builder uses a global Bootstrap CSS reset that can alter text sizing. The CLI automatically converts `rem` units to pixels and injects protective scoped CSS wrappers to guarantee a 1:1 visual replica of your design.
- **Dual Deployment Modes**:
  - **Editable Sections (Native)**: Splits elements by `.row` and `.col-` into editable Workadu sections.
  - **Exact Static HTML**: Wraps your code in an isolated container to preserve complex, modern CSS grid and flexbox layouts.

---

## 📦 Installation

### Option 1: Install directly from GitHub (Recommended)
You can install the CLI globally on your machine straight from the GitHub repository using NPM:
```bash
npm install -g workadu/cli
```

### Option 2: Clone and Install Locally
If you want to view the code or contribute:
```bash
git clone https://github.com/workadu/cli.git
cd cli
npm install -g .
```

> **Note**: Node.js and NPM are required to install and run the CLI.

---

## 💻 Commands & Usage

Once installed, the `workadu` command becomes available globally on your terminal.

### 1. Deploy a Page
The main command to compile, translate, and deploy a page to your Workadu environment.

**Syntax:**
```bash
workadu deploy <path_or_url> [options]
```

**Examples:**
```bash
# Deploy a local HTML file
workadu deploy ./public/landing.html

# Deploy directly from a live URL
workadu deploy https://example.com/promo
```

#### Available Options:
| Option | Description |
|--------|-------------|
| `--page-id <id>` | The target Workadu Page ID where the content will be deployed. If omitted, the CLI will create a **new page** automatically. |

### Deployment Process Flow
When you run `workadu deploy`:
1. **Source Fetching**: The CLI reads your local file or downloads the DOM structure of your provided URL.
2. **Interactive Selection**: You will be prompted to choose the deployment mode:
   - `1`: Editable Sections (Native Builder format)
   - `2`: Exact Static HTML (Absolute visual fidelity)
3. **Asset Inlining**: Any `<link rel="stylesheet">` or external `<script src="...">` with relative paths are downloaded and compiled directly into your HTML payload.
4. **CSS Corrections**: `rem` units inside `<style>` tags or inline `style=""` attributes are automatically converted to `px`. Specific CSS resets are injected to prevent Workadu's core styles from affecting your typography.
5. **Translations (Optional)**: If a `translations.js` file exists in the deployment directory, the CLI replaces `data-i18n` tags with their respective localized strings.
6. **API Sync**: The compiled HTML payloads for all languages are sent securely to your Workadu project via the Workadu MCP Server/API.

---

## 🌍 Configuring Translations

To deploy multiple languages simultaneously, create a `translations.js` file in the directory where you run the CLI.

**Format example (`translations.js`):**
```javascript
module.exports = {
    targetLangs: ['el_GR', 'en_GB', 'es_ES'],
    translations: {
        el_GR: {
            "hero_title": "Καλώς ήρθατε",
            "hero_desc": "Ανακαλύψτε τις υπηρεσίες μας"
        },
        en_GB: {
            "hero_title": "Welcome",
            "hero_desc": "Discover our services"
        }
    }
};
```

In your HTML, use the `data-i18n` attribute:
```html
<h1 data-i18n="hero_title">Fallback Title</h1>
<p data-i18n="hero_desc">Fallback Description</p>
```

---

## ⚠️ Requirements
- A running instance of the **Workadu Platform** (either locally at `http://workadu.local` or a remote API endpoint). You can set the API endpoint using the `--api-url` flag or the `WORKADU_API_URL` environment variable.
- Node.js v16+
