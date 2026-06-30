#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const os = require('os');
const http = require('http');
const https = require('https');
const readline = require('readline');

const CONFIG_FILE = path.join(os.homedir(), '.workadu-config.json');

// We load cheerio lazily so `connect` doesn't fail if it's missing
function loadCheerio() {
    try {
        return require('cheerio');
    } catch (e) {
        console.error("Please run 'npm install' inside your workadu-cli directory.");
        process.exit(1);
    }
}

// ----------------------------------------------------
// Utility: Config
// ----------------------------------------------------
function getConfig() {
    if (fs.existsSync(CONFIG_FILE)) {
        return JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'));
    }
    return {};
}

function saveConfig(config) {
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2), 'utf8');
}

// ----------------------------------------------------
// Utility: HTTP Request
// ----------------------------------------------------
function makeRequest(urlStr, method = 'GET', payload = null, token = null) {
    return new Promise((resolve, reject) => {
        const url = new URL(urlStr);
        const options = {
            hostname: url.hostname,
            port: url.port,
            path: url.pathname + url.search,
            method: method,
            headers: {
                'Accept': 'application/vnd.rengine.v2+json'
            }
        };

        if (token) {
            options.headers['Authorization'] = `Basic ${Buffer.from(token + ':').toString('base64')}`;
        }

        if (payload) {
            options.headers['Content-Type'] = 'application/json';
            const payloadStr = typeof payload === 'string' ? payload : JSON.stringify(payload);
            options.headers['Content-Length'] = Buffer.byteLength(payloadStr);
            payload = payloadStr;
        }

        const client = url.protocol === 'https:' ? https : http;
        const req = client.request(options, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                if (res.statusCode >= 200 && res.statusCode < 300) {
                    try { resolve(JSON.parse(data)); } catch (e) { resolve(data); }
                } else {
                    reject({ status: res.statusCode, body: data });
                }
            });
        });

        req.on('error', (e) => reject(e));

        if (payload) {
            req.write(payload);
        }
        req.end();
    });
}

// ----------------------------------------------------
// Commands
// ----------------------------------------------------
const args = process.argv.slice(2);
const command = args[0];

function showHelp() {
    console.log(`
🚀 Workadu CLI v1.0.0

Usage: workadu <command> [options]

Commands:
  connect <api_key>          Save your Workadu API Key securely for deployments.
                             Example: workadu connect wk_abc123

  deploy <path_or_url>       Deploy an HTML file or a live URL to Workadu Pages.
                             Example: workadu deploy ./public/landing.html
                             Example: workadu deploy https://example.com/promo

Options for 'deploy':
  --page-id <id>             Deploy to an existing Workadu Page ID.
                             If omitted, a new page is automatically created.
  --slug <slug>              Define a custom URL slug when creating a new page.
  --api-url <url>            Override the API URL (defaults to http://workadu.local/api
                             or the WORKADU_API_URL environment variable).

Global Options:
  -h, --help                 Display this help message and exit.
    `);
    process.exit(0);
}

if (!command || command === '--help' || command === '-h' || command === 'help') {
    showHelp();
}

if (command === 'connect') {
    const apiKey = args[1];
    if (!apiKey) {
        console.error("Error: Please provide an API key. \nExample: workadu connect wk_WonV6a437d35e3628");
        process.exit(1);
    }
    
    const config = getConfig();
    config.apiKey = apiKey;
    saveConfig(config);
    console.log(`✅ API Key saved successfully to ${CONFIG_FILE}`);
    process.exit(0);
}

if (command === 'deploy') {
    const filePath = args[1];
    if (!filePath || filePath.startsWith('--')) {
        console.error("Error: Please provide the HTML file path to deploy. \nExample: workadu deploy public/index.html");
        process.exit(1);
    }
    
    let pageId = null;
    let customApiUrl = process.env.WORKADU_API_URL || 'http://workadu.local/api';
    let slug = null;
    
    for (let i = 2; i < args.length; i++) {
        if (args[i] === '--page-id') pageId = args[i+1];
        if (args[i] === '--api-url') customApiUrl = args[i+1];
        if (args[i] === '--slug') slug = args[i+1];
    }
    
    const config = getConfig();
    const token = config.apiKey;
    
    if (!token) {
        console.error("Error: No API key found. Please run 'workadu connect <api_key>' first.");
        process.exit(1);
    }
    
    (async () => {
        let htmlContent = '';
        let absolutePath = filePath;
        
        if (filePath.startsWith('http://') || filePath.startsWith('https://')) {
            console.log(`\n🌍 Fetching HTML from ${filePath}...`);
            try {
                const res = await fetch(filePath);
                if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText}`);
                htmlContent = await res.text();
            } catch (err) {
                console.error(`❌ Error fetching URL: ${err.message}`);
                process.exit(1);
            }
        } else {
            absolutePath = path.resolve(process.cwd(), filePath);
            if (!fs.existsSync(absolutePath)) {
                console.error(`Error: File not found at ${absolutePath}`);
                process.exit(1);
            }
            htmlContent = fs.readFileSync(absolutePath, 'utf8');
        }
        
        const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
        
        const CYAN = '\x1b[36m';
        const GREEN = '\x1b[32m';
        const YELLOW = '\x1b[33m';
        const RESET = '\x1b[0m';
        const BOLD = '\x1b[1m';
        
        console.log(`\n${CYAN}=================================${RESET}`);
        console.log(`${BOLD}DEPLOYMENT TYPE${RESET}`);
        console.log(`${CYAN}=================================${RESET}`);
        
        console.log(`${GREEN}1. Editable Sections (Native Builder format)${RESET}`);
        console.log("   - Split into editable boxes.");
        console.log("   - Useful if HTML relies strictly on '.row' and '.col-'.");
        
        console.log(`\n${YELLOW}2. Exact Static HTML${RESET}`);
        console.log("   - Deploys as a single 100% width static block.");
        console.log("   - Preserves exact HTML & CSS but is not block-by-block editable.");
        
        rl.question(`\n${BOLD}Choose deployment type (1 or 2) [default: 1]: ${RESET}`, async (answer) => {
            rl.close();
            const deployType = answer.trim() === '2' ? 'static' : 'editable';
            await runDeploy(htmlContent, token, pageId, customApiUrl, deployType, slug, absolutePath);
        });
    })();
}

// ----------------------------------------------------
// Deployment Logic
// ----------------------------------------------------
async function runDeploy(baseHtmlContent, token, pageId, apiUrl, deployType, slug, absolutePath) {
    try {
        let activePageId = pageId;
        if (!activePageId) {
            console.log("\n🔍 No --page-id provided. Creating a new page automatically...");
            const createRes = await makeRequest(`${apiUrl}/pages`, 'POST', {
                title: slug || 'AI Promo Page',
                slug: slug || undefined,
                language: 'en_GB'
            }, token);
            activePageId = createRes.data.id;
            console.log(`✅ Created new page with ID: ${activePageId}`);
        }

        console.log(`\nPreparing to deploy to Page ID: ${activePageId} (Mode: ${deployType})`);
        
        const cheerio = loadCheerio();
        let $ = cheerio.load(baseHtmlContent);
        
        // Find supported languages
        const targetLangs = ['el_GR', 'en_GB', 'es_ES', 'it_IT'];
        
        for (const locale of targetLangs) {
            console.log(`⏳ Deploying language: ${locale} ...`);
            
            $ = cheerio.load(baseHtmlContent);
            $('#langSwitch').remove();
            $('.reveal').removeClass('reveal active delay-1 delay-2 delay-3');
            
            // Fix inline styles with rem to px (Workadu builder root font size fix)
            $('[style]').each((i, el) => {
                let styleStr = $(el).attr('style');
                if (styleStr && styleStr.includes('rem')) {
                    styleStr = styleStr.replace(/([\d.]+)rem/g, (match, val) => {
                        return (parseFloat(val) * 16) + 'px';
                    });
                    $(el).attr('style', styleStr);
                }
            });
            
let styles = `
<style>
/* Workadu Builder CSS Reset for injected content */
.workadu-injected-content .container::before,
.workadu-injected-content .container::after,
.is-box-centered .container::before,
.is-box-centered .container::after {
    display: none !important;
}

/* Force base font size to 16px to override Builder's small root font */
/* Using :where() for the wrapper keeps specificity at 0 0 1 so it beats builder's p but loses to classes */
:where(.workadu-injected-content) { font-size: 16px; }
:where(.workadu-injected-content) p,
:where(.workadu-injected-content) li,
:where(.workadu-injected-content) a,
:where(.workadu-injected-content) span,
:where(.workadu-injected-content) button {
    font-size: 16px;
}
/* Bootstrap override for .btn specifically so it doesn't get squashed by Builder's .btn (specificity 0 1 0) */
:where(.workadu-injected-content) .btn {
    font-size: 16px;
}
</style>
`;
            $('head style, body style').each((i, el) => {
                let cssText = $(el).html();
                // Browsers often ignore @import in scoped/body <style> tags.
                // Convert @import url('...') to <link rel="stylesheet" href="...">
                cssText = cssText.replace(/@import\s+url\(['"]?(https?:\/\/[^'"]+)['"]?\);?/g, (match, url) => {
                    styles += `<link rel="stylesheet" href="${url}">\n`;
                    return ''; // Remove from cssText
                });
                // Fix Workadu root font-size issue: convert rem to px (assuming 1rem = 16px)
                cssText = cssText.replace(/([\d.]+)rem/g, (match, val) => {
                    return (parseFloat(val) * 16) + 'px';
                });
                styles += `<style>\n${cssText}\n</style>\n`;
            });
            
            // Read local CSS files
            let fetchPromises = [];
            $('link[rel="stylesheet"]').each((i, el) => {
                const href = $(el).attr('href');
                if (href) {
                    const isUrl = absolutePath.startsWith('http://') || absolutePath.startsWith('https://');
                    
                    if (isUrl && !href.startsWith('http') && !href.startsWith('//')) {
                        // resolve relative URL
                        const baseUrl = new URL(absolutePath);
                        const cssUrl = new URL(href, baseUrl).href;
                        fetchPromises.push(
                            fetch(cssUrl).then(res => res.text()).then(cssContent => {
                                cssContent = cssContent.replace(/([\d.]+)rem/g, (match, val) => {
                                    return (parseFloat(val) * 16) + 'px';
                                });
                                styles += `<style>\n${cssContent}\n</style>\n`;
                                $(el).remove();
                            }).catch(err => {
                                console.warn(`⚠️ Could not fetch CSS from ${cssUrl}: ${err.message}`);
                            })
                        );
                    } else if (!isUrl && !href.startsWith('http') && !href.startsWith('//')) {
                        const cssFilePath = path.join(path.dirname(absolutePath), href);
                        if (fs.existsSync(cssFilePath)) {
                            let cssContent = fs.readFileSync(cssFilePath, 'utf8');
                            // Fix Workadu root font-size issue: convert rem to px (assuming 1rem = 16px)
                            cssContent = cssContent.replace(/([\d.]+)rem/g, (match, val) => {
                                return (parseFloat(val) * 16) + 'px';
                            });
                            styles += `<style>\n${cssContent}\n</style>\n`;
                            $(el).remove();
                        }
                    } else {
                        styles += $.html(el) + '\n';
                        $(el).remove();
                    }
                }
            });
            
            await Promise.all(fetchPromises);

            // Read local JS files
            let jsFetchPromises = [];
            let scriptsHtml = '';
            $('script').each((i, el) => {
                const src = $(el).attr('src');
                if (src) {
                    const isUrl = absolutePath.startsWith('http://') || absolutePath.startsWith('https://');
                    
                    if (isUrl && !src.startsWith('http') && !src.startsWith('//')) {
                        const baseUrl = new URL(absolutePath);
                        const jsUrl = new URL(src, baseUrl).href;
                        jsFetchPromises.push(
                            fetch(jsUrl).then(res => res.text()).then(jsContent => {
                                scriptsHtml += `<script>\n/* Inlined from ${src} */\n${jsContent}\n</script>\n`;
                                $(el).remove();
                            }).catch(err => {
                                console.warn(`⚠️ Could not fetch JS from ${jsUrl}: ${err.message}`);
                            })
                        );
                    } else if (!isUrl && !src.startsWith('http') && !src.startsWith('//')) {
                        const jsFilePath = path.join(path.dirname(absolutePath), src);
                        if (fs.existsSync(jsFilePath)) {
                            const jsContent = fs.readFileSync(jsFilePath, 'utf8');
                            scriptsHtml += `<script>\n/* Inlined from ${src} */\n${jsContent}\n</script>\n`;
                        }
                        $(el).remove();
                    } else {
                        scriptsHtml += $.html(el) + '\n';
                        $(el).remove();
                    }
                } else {
                    // Inline script (e.g. translation script)
                    scriptsHtml += $.html(el) + '\n';
                    $(el).remove();
                }
            });
            
            await Promise.all(jsFetchPromises);
            
            let layoutHtml = '';
            let contentArray = [];
            let stylesInjected = false;
            
            if (deployType === 'static') {
                const containerId = '$container_id_static' + Math.random().toString(36).substr(2, 6) + '$';
                
                // Put styles and scripts in layoutHtml to prevent them from being stripped by the builder!
                if (styles) {
                    layoutHtml += styles + '\n';
                }
                
                // No is-section wrapper so it doesn't become an editable Workadu section!
                layoutHtml += `<div data-contid="${containerId}"></div>\n\n`;
                
                if (scriptsHtml) {
                    layoutHtml += scriptsHtml + '\n';
                }
                
                let staticHtml = `<div class="workadu-injected-content">\n` + $('body').html() + `\n</div>`;
                
                contentArray.push({
                    container_id: containerId,
                    container_html: staticHtml
                });
            } else {
                layoutHtml += styles + '\n';
                $('body').children().each((i, el) => {
                    const $el = $(el);
                    const elClass = $el.attr('class') || '';
                    const elId = $el.attr('id') ? `id="${$el.attr('id')}"` : '';
                    const containerId = '$container_id_' + Math.random().toString(36).substr(2, 9) + '$';
                    
                    let innerHtml = '';
                    const $container = $el.find('.container').first();
                    if ($container.length > 0) {
                        innerHtml = $container.html();
                    } else {
                        innerHtml = $el.html();
                    }
                    
                    if (!stylesInjected && styles) {
                        // Wrap styles in a row so Innova builder DOM parser doesn't crash expecting columns
                        innerHtml = `<div class="row" style="display:none;"><div class="col-md-12">${styles}</div></div>\n` + innerHtml;
                        stylesInjected = true;
                    }
                    
                    layoutHtml += 
                    `<div ${elId} class="is-section is-box is-section-100 ${elClass}">\n` +
                    `    <div class="is-boxes">\n` +
                    `        <div class="is-box-centered">\n` +
                    `            <div class="is-container container-fluid" data-contid="${containerId}"></div>\n` +
                    `        </div>\n` +
                    `    </div>\n` +
                    `</div>\n\n`;
                    
                    contentArray.push({
                        container_id: containerId,
                        container_html: innerHtml
                    });
                });
            }

            const payloadData = { html: layoutHtml, content: contentArray, language: locale };
            const deployRes = await makeRequest(`${apiUrl}/pages/${activePageId}/deploy`, 'POST', payloadData, token);
            console.log(`✅ ${locale} deployment successful! URL: ${deployRes.data.url}`);
        }
        
        console.log('\n🎉 All requested languages have been deployed!');
    } catch (e) {
        console.error(`❌ Deployment failed.`);
        console.error(e);
    }
}
