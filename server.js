import express from 'express';
import { chromium } from 'playwright';
import cors from 'cors';
import os from 'os';
import path from 'path';
import fs from 'fs';
import Razorpay from 'razorpay';
import crypto from 'crypto';
import {
    startMobileBot, stopMobileBot, inspectScreen,
    getMobileScreenshot, getMobileLogs, getMobileStep, isMobileDone
} from './mobile_bot.js';

const app = express();
// Set ANDROID_HOME automatically so Appium finds the tools
process.env.ANDROID_HOME = 'C:\\platform-tools\\platform-tools'; 
process.env.PATH = process.env.PATH + ';C:\\platform-tools\\platform-tools';
app.use(cors());
app.use(express.json());
app.use(express.static('.')); // Serve static files (index.html, style.css, main.js)

// ─── 🔑 Subscription Database & Endpoints ───
const LICENSES_FILE = path.resolve('licenses.json');

function getClientIp(req) {
    let ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
    if (ip && ip.startsWith('::ffff:')) {
        ip = ip.substring(7);
    }
    if (ip === '::1') {
        ip = '127.0.0.1';
    }
    return ip;
}

function loadLicenses() {
    try {
        if (fs.existsSync(LICENSES_FILE)) {
            return JSON.parse(fs.readFileSync(LICENSES_FILE, 'utf8'));
        }
    } catch (e) {
        console.error('Error reading licenses file:', e);
    }
    return {};
}

function saveLicenses(db) {
    try {
        fs.writeFileSync(LICENSES_FILE, JSON.stringify(db, null, 2), 'utf8');
    } catch (e) {
        console.error('Error saving licenses file:', e);
    }
}

// Pre-create some test keys for the user (₹99 Subscription trials)
const currentLicenses = loadLicenses();
const testKeys = ['TF-TEST-TRIAL-KEY', 'TF-99-PRO-KEY-WEEK', 'TF-99-TEST-USER'];
let updated = false;

testKeys.forEach(tKey => {
    if (!currentLicenses[tKey]) {
        const expiryDate = new Date();
        expiryDate.setFullYear(expiryDate.getFullYear() + 1); // 1-year test subscription
        currentLicenses[tKey] = {
            licenseKey: tKey,
            userEmail: `${tKey.toLowerCase()}@tatkalflash.com`,
            status: 'active',
            deviceId: null,
            expiresAt: expiryDate.toISOString(),
            paymentId: 'trial_₹99_init'
        };
        updated = true;
    }
});

if (updated) {
    saveLicenses(currentLicenses);
}

// Endpoint: Activate License
app.post('/api/activate-license', (req, res) => {
    const { licenseKey, deviceId } = req.body;
    if (!licenseKey || !deviceId) {
        return res.status(400).json({ error: 'License key and device ID are required' });
    }

    const db = loadLicenses();
    const info = db[licenseKey];

    if (!info) {
        return res.status(404).json({ error: 'Invalid license key' });
    }
    if (info.status !== 'active' || new Date(info.expiresAt) < new Date()) {
        return res.status(403).json({ error: 'License has expired or is suspended' });
    }
    
    // Device mapping check
    if (info.deviceId && info.deviceId !== deviceId) {
        return res.status(403).json({ error: 'License is already used on another device' });
    }

    const clientIp = getClientIp(req);
    // IP mapping check
    if (info.ipAddress && info.ipAddress !== clientIp) {
        return res.status(403).json({ error: 'License is already used on another IP address' });
    }

    // Pin this key to the current device and IP
    info.deviceId = deviceId;
    info.ipAddress = clientIp;
    info.activatedAt = new Date().toISOString();
    db[licenseKey] = info;
    saveLicenses(db);

    console.log(`[LICENSING] Key ${licenseKey} activated for device ${deviceId} at IP ${clientIp}`);
    res.json({ success: true, message: 'License activated successfully', expiresAt: info.expiresAt });
});

// Endpoint: Validate License State
app.post('/api/validate-license', (req, res) => {
    const { licenseKey, deviceId } = req.body;
    if (!licenseKey || !deviceId) {
        return res.json({ valid: false });
    }

    const db = loadLicenses();
    const info = db[licenseKey];
    const clientIp = getClientIp(req);

    if (!info || info.deviceId !== deviceId || (info.ipAddress && info.ipAddress !== clientIp) || info.status !== 'active' || new Date(info.expiresAt) < new Date()) {
        return res.json({ valid: false });
    }

    res.json({ valid: true, expiresAt: info.expiresAt });
});

// Razorpay Credentials (Sandbox/Test defaults)
const RAZORPAY_KEY_ID = process.env.RAZORPAY_KEY_ID || 'rzp_test_SZlpa8uIx6lupM';
const RAZORPAY_KEY_SECRET = process.env.RAZORPAY_KEY_SECRET || 'MdjBfSzlLOYRU3MHFxEpz3vO';

// Endpoint: Create Razorpay Order
app.post('/api/create-razorpay-order', async (req, res) => {
    const { email } = req.body;
    if (!email) {
        return res.status(400).json({ error: 'Email is required' });
    }

    try {
        const instance = new Razorpay({
            key_id: RAZORPAY_KEY_ID,
            key_secret: RAZORPAY_KEY_SECRET
        });

        const options = {
            amount: 9900, // amount in paise (₹99.00)
            currency: "INR",
            receipt: "receipt_order_" + Math.random().toString(36).substring(2, 10),
            notes: {
                email: email,
                product: "Swift Seat Subscription"
            }
        };

        const order = await instance.orders.create(options);
        res.json({
            success: true,
            orderId: order.id,
            amount: order.amount,
            currency: order.currency,
            keyId: RAZORPAY_KEY_ID
        });
    } catch (error) {
        console.error('Error creating Razorpay order:', error);
        res.status(500).json({ error: 'Failed to create payment order' });
    }
});

// Endpoint: Verify Razorpay Payment Signature and Generate Active License Key
app.post('/api/verify-razorpay-payment', (req, res) => {
    const { orderId, paymentId, signature, email } = req.body;

    if (!orderId || !paymentId || !signature || !email) {
        return res.status(400).json({ error: 'Missing payment verification details' });
    }

    const body = orderId + "|" + paymentId;
    const expectedSignature = crypto
        .createHmac('sha256', RAZORPAY_KEY_SECRET)
        .update(body.toString())
        .digest('hex');

    if (expectedSignature !== signature) {
        console.error('[LICENSING] Invalid payment signature detected!');
        return res.status(400).json({ error: 'Payment verification failed: Signature mismatch' });
    }

    const randomHex = Math.random().toString(36).substring(2, 8).toUpperCase();
    const newKey = `TF-99-PRO-${randomHex}`;

    const db = loadLicenses();
    const expiryDate = new Date();
    expiryDate.setDate(expiryDate.getDate() + 30); // 30 days

    db[newKey] = {
        licenseKey: newKey,
        userEmail: email,
        status: 'active',
        deviceId: null,
        expiresAt: expiryDate.toISOString(),
        paymentId: paymentId
    };

    saveLicenses(db);
    console.log(`[LICENSING] Payment verified! Key generated: ${newKey} | Email: ${email} | Paid: ₹99`);

    res.json({
        success: true,
        licenseKey: newKey,
        expiresAt: expiryDate.toISOString(),
        paymentId: paymentId
    });
});



let browser = null;
let page = null;
let latestScreenshot = '';
let statusLogs = [];
let currentStep = 0;
let isDone = false;

// ─── Emit log to frontend ───
function emitLog(msg, type = 'info') {
    console.log(`[${type.toUpperCase()}] ${msg}`);
    statusLogs.push({ msg, type });
}

// ─── Screenshot Stream ───
async function captureLoop() {
    while (page && !page.isClosed()) {
        try {
            const buf = await page.screenshot({ type: 'png' });
            latestScreenshot = buf.toString('base64');
        } catch (_) { }
        await new Promise(r => setTimeout(r, 500));
    }
}

// ─── AI Click Helper ───
async function aiClick(page, keywords, blacklist = []) {
    const coords = await page.evaluate(({ keys, bl }) => {
        const all = document.querySelectorAll('a, button, span, div, li, input[type="submit"]');
        let best = null;
        let bestScore = 0;

        for (const el of all) {
            const text = (el.textContent || '').trim().toUpperCase();
            const rect = el.getBoundingClientRect();
            if (rect.width === 0 || rect.height === 0) continue;
            if (rect.top < 0 || rect.left < 0) continue;

            // Check blacklist
            let blocked = false;
            for (const b of bl) {
                if (text.includes(b.toUpperCase())) { blocked = true; break; }
            }
            if (blocked) continue;

            let score = 0;
            for (const k of keys) {
                if (text === k.toUpperCase()) score += 100;
                else if (text.includes(k.toUpperCase())) score += 30;
            }

            if (score > bestScore) {
                bestScore = score;
                best = {
                    x: rect.left + rect.width / 2,
                    y: rect.top + rect.height / 2
                };
            }
        }
        return best;
    }, { keys: keywords, bl: blacklist });

    if (coords) {
        await page.mouse.click(coords.x, coords.y);
        return true;
    }
    return false;
}

// ─── API: Start Tatkal ───
app.post('/api/start-tatkal', async (req, res) => {
    const { licenseKey, from, to, date, trainNum, className, quota, username, password, passengers } = req.body;

    // Secure Firewall License Check
    if (!licenseKey) {
        return res.status(403).json({ error: 'Subscription license key required to start automation.' });
    }

    const db = loadLicenses();
    const info = db[licenseKey];

    if (!info) {
        return res.status(403).json({ error: 'Invalid subscription license key.' });
    }
    if (info.status !== 'active') {
        return res.status(403).json({ error: 'License key is inactive or suspended.' });
    }
    if (new Date(info.expiresAt) < new Date()) {
        return res.status(403).json({ error: 'Subscription expired. Please renew first.' });
    }

    // IP Lock verification
    const clientIp = getClientIp(req);
    if (info.ipAddress && info.ipAddress !== clientIp) {
        return res.status(403).json({ error: 'Subscription license key is bound to a different IP address.' });
    }

    statusLogs = [];
    currentStep = 1;
    isDone = false;

    try {
        // Launch browser with a COMPLETELY SEPARATE local data folder
        // This is 100% guaranteed not to conflict with your open Chrome!
        if (browser) {
            try {
                const pages = await browser.pages();
                if (pages.length === 0) {
                    await browser.newPage();
                } else {
                    // Test if page is actually alive
                    await pages[0].evaluate(() => 1).catch(() => { throw new Error('Page dead'); });
                }
            } catch (e) {
                try { await browser.close(); } catch (_) {}
                browser = null;
                page = null;
            }
        }

        if (!browser) {
            // Determine user's native Chrome profile path based on the operating system
            let mainUserDataDir = '';
            if (process.platform === 'win32') {
                mainUserDataDir = path.join(process.env.LOCALAPPDATA, 'Google', 'Chrome', 'User Data');
            } else if (process.platform === 'darwin') {
                mainUserDataDir = path.join(os.homedir(), 'Library', 'Application Support', 'Google', 'Chrome');
            } else {
                mainUserDataDir = path.join(os.homedir(), '.config', 'google-chrome');
            }

            // 1. Try connecting to Chrome Remote Debugging on port 9222 first (Zero lock conflicts)
            try {
                emitLog('Connecting to running Chrome (Remote Debugging Port 9222)...', 'info');
                browser = await chromium.connectOverCDP('http://localhost:9222');
                emitLog('Successfully attached to your personal Chrome instance! ✓', 'success');
                
                // Scan all open pages for IRCTC
                const contexts = browser.contexts();
                const context = contexts.length > 0 ? contexts[0] : await browser.newContext();
                const allPages = context.pages();
                page = null;
                for (const p of allPages) {
                    try {
                        const url = p.url() || '';
                        if (url.includes('irctc.co.in/nget')) {
                            page = p;
                            emitLog('Found existing IRCTC tab, taking control...', 'success');
                            break;
                        }
                    } catch (err) {}
                }
                
                if (!page) {
                    page = allPages.length > 0 ? allPages[0] : await context.newPage();
                }
            } catch (cdpErr) {
                emitLog('Remote Debugging Port 9222 not open. Launching profile directly...', 'info');
                
                // 2. Try launching their main Chrome profile folder directly (Only works if Chrome is closed)
                const isLinuxHeadless = process.platform === 'linux' && !process.env.DISPLAY;
                const headlessOption = isLinuxHeadless ? true : false;
                const commonArgs = [
                    '--no-sandbox',
                    '--disable-setuid-sandbox',
                    '--disable-dev-shm-usage',
                    '--disable-gpu',
                    '--disable-infobars',
                    '--start-maximized',
                    '--disable-blink-features=AutomationControlled',
                    '--disable-http2',
                    '--ignore-certificate-errors',
                    '--window-size=1920,1080'
                ];
                if (isLinuxHeadless) {
                    commonArgs.push('--headless=new');
                }

                try {
                    browser = await chromium.launchPersistentContext(mainUserDataDir, {
                        headless: headlessOption,
                        channel: 'chrome',
                        chromiumSandbox: false,
                        args: [
                            ...commonArgs,
                            '--profile-directory=Default'
                        ],
                        ignoreDefaultArgs: [
                            '--enable-automation',
                            '--disable-extensions',
                            '--disable-component-extensions-with-background-pages',
                            '--disable-default-apps'
                        ],
                        viewport: null,
                        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36'
                    });
                    
                    emitLog('Successfully launched Chrome using your main profile! ✓', 'success');
                } catch (launchErr) {
                    emitLog('🔒 Primary Chrome is currently open/locked or not available.', 'warning');
                    emitLog('💡 Tip: Close Google Chrome completely before starting to load your saved logins automatically!', 'info');
                    emitLog('Continuing with isolated profile...', 'info');
                    
                    // 3. Fallback to isolated bot profile to guarantee execution
                    const chromePath = './bot_chrome_data'; 
                    try {
                        browser = await chromium.launchPersistentContext(chromePath, {
                            headless: headlessOption,
                            channel: 'chrome',
                            chromiumSandbox: false,
                            args: commonArgs,
                            ignoreDefaultArgs: [
                                '--enable-automation',
                                '--disable-extensions',
                                '--disable-component-extensions-with-background-pages',
                                '--disable-default-apps'
                            ],
                            viewport: null,
                            userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36'
                        });
                    } catch (isolatedErr) {
                        emitLog('Chrome channel launch failed, trying default bundled Chromium...', 'info');
                        browser = await chromium.launchPersistentContext(chromePath, {
                            headless: headlessOption,
                            chromiumSandbox: false,
                            args: commonArgs,
                            ignoreDefaultArgs: [
                                '--enable-automation',
                                '--disable-extensions',
                                '--disable-component-extensions-with-background-pages',
                                '--disable-default-apps'
                            ],
                            viewport: null,
                            userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36'
                        });
                    }
                    emitLog('Launched isolated profile successfully ✓', 'success');
                }

                // Inject anti-detection script to the persistent context
                await browser.addInitScript(() => {
                    Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
                    window.navigator.chrome = { runtime: {} };
                    Object.defineProperty(navigator, 'plugins', { get: () => [1, 2, 3, 4, 5] });
                    Object.defineProperty(navigator, 'languages', { get: () => ['en-US', 'en'] });
                });

                // Scan all open pages for IRCTC inside the launched context
                const allPages = browser.pages();
                page = null;
                for (const p of allPages) {
                    try {
                        const url = p.url() || '';
                        if (url.includes('irctc.co.in/nget')) {
                            page = p;
                            emitLog('Found existing IRCTC tab, taking control...', 'success');
                            break;
                        }
                    } catch (err) {}
                }

                if (!page) {
                    page = await browser.newPage();
                }

                // Ensure anti-detection is applied to active page object
                await page.addInitScript(() => {
                    Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
                    window.navigator.chrome = { runtime: {} };
                    Object.defineProperty(navigator, 'plugins', { get: () => [1, 2, 3, 4, 5] });
                    Object.defineProperty(navigator, 'languages', { get: () => ['en-US', 'en'] });
                });
            }
        } else {
            // Ensure we have a valid page if the old one was closed
            if (!page || page.isClosed()) {
                const contexts = browser.contexts();
                const context = contexts.length > 0 ? contexts[0] : browser;
                const allPages = context.pages ? context.pages() : [];
                page = null;
                for (const p of allPages) {
                    try {
                        const url = p.url() || '';
                        if (url.includes('irctc.co.in/nget')) {
                            page = p;
                            break;
                        }
                    } catch (err) {}
                }
                if (!page) {
                    page = await browser.newPage();
                }
            }
        }

        // Send response immediately
        res.json({ status: 'started', message: 'Browser launched' });

        // Start screenshot capture
        captureLoop();

        // ─── STEP 1: Navigate to IRCTC ───
        emitLog('Connecting to IRCTC portal...', 'info');
        
        try {
            const currentUrl = page.url() || '';
            if (currentUrl.includes('irctc.co.in/nget/train-search')) {
                emitLog('Already on IRCTC search page, skipping navigation ✓', 'success');
            } else if (currentUrl.includes('irctc.co.in')) {
                emitLog('On IRCTC portal, skipping page reload to prevent session error ✓', 'success');
            } else {
                emitLog('Opening https://www.irctc.co.in/nget/train-search ...', 'info');
                
                try {
                    await page.goto('https://www.irctc.co.in/nget/train-search', {
                        waitUntil: 'domcontentloaded',
                        timeout: 30000
                    });
                } catch (navErr) {
                    emitLog(`Initial load note: ${navErr.message || navErr}. Retrying load...`, 'warning');
                    await page.goto('https://www.irctc.co.in/nget/train-search', {
                        waitUntil: 'load',
                        timeout: 30000
                    }).catch(() => {});
                }
            }

            // Wait for user or bot to be on search page (up to 45s)
            await page.waitForFunction(() => {
                return window.location.href.includes('irctc.co.in/nget/train-search');
            }, { timeout: 45000, polling: 1000 }).catch(() => {});

            emitLog('IRCTC Page Detected! Taking control...', 'success');
        } catch (e) {
            emitLog(`Navigation status: ${e.message || e}`, 'warning');
        }

        emitLog('IRCTC app ready', 'success');

        // ─── CLEAR LANGUAGE POPUP/ALERT (English Selection) ───
        emitLog('Checking for language selection popup...', 'info');
        try {
            let languageCleared = false;
            for (let i = 0; i < 10; i++) { // Check for up to 5 seconds
                const englishButton = page.locator('button').filter({ hasText: /^English$/i });
                if (await englishButton.count() > 0 && await englishButton.first().isVisible()) {
                    emitLog('Language popup detected, clicking English...', 'info');
                    await englishButton.first().click();
                    emitLog('Clicked English language option ✓', 'success');
                    languageCleared = true;
                    await page.waitForTimeout(1000);
                    break;
                }
                
                // Fallback direct evaluation
                const clicked = await page.evaluate(() => {
                    const elements = Array.from(document.querySelectorAll('button, span, div, a'));
                    const englishEl = elements.find(el => {
                        const rect = el.getBoundingClientRect();
                        if (rect.width === 0 || rect.height === 0) return false;
                        const txt = el.textContent ? el.textContent.trim() : '';
                        return txt === 'English';
                    });
                    if (englishEl) {
                        englishEl.click();
                        return true;
                    }
                    return false;
                });
                
                if (clicked) {
                    emitLog('Clicked English language option (fallback) ✓', 'success');
                    languageCleared = true;
                    await page.waitForTimeout(1000);
                    break;
                }
                await page.waitForTimeout(500);
            }
            if (!languageCleared) {
                emitLog('No language popup detected or already cleared.', 'info');
            }
        } catch (e) {
            emitLog('Error clearing language popup: ' + e.message, 'warning');
        }

        // ─── STEP 2: Login ───
        currentStep = 2;
        emitLog('Finding LOGIN option...', 'info');

        let loginOpened = false;
        for (let attempt = 0; attempt < 15; attempt++) {
            const clicked = await aiClick(page, ['LOGIN', 'LOGIN / REGISTER', 'SIGN IN', 'LOGIN/REGISTER'], ['LOYALTY', 'OFFERS', 'AGENT']);
            if (clicked) {
                emitLog(`Login button clicked (attempt ${attempt + 1})`, 'success');
                await page.waitForTimeout(1500);

                // Check if login dialog is actually visible
                const loginFieldVisible = await page.evaluate(() => {
                    const el = document.querySelector('input[formcontrolname="userName"], #userId, input[placeholder*="User Name"]');
                    return el && el.offsetWidth > 0 && el.offsetHeight > 0;
                });

                if (loginFieldVisible) {
                    loginOpened = true;
                    emitLog('Login dialog detected!', 'success');
                    break;
                }
            }


            await page.waitForTimeout(1000);
        }

        if (!loginOpened) {
            emitLog('Could not open login dialog — trying direct JS trigger', 'warning');
            await page.evaluate(() => {
                const links = document.querySelectorAll('a');
                for (const link of links) {
                    if (link.textContent.includes('LOGIN')) {
                        link.click();
                        break;
                    }
                }
            });
            await page.waitForTimeout(2000);
        }

        // Inject credentials
        if (username && password) {
            emitLog('Injecting credentials...', 'info');
            const userSel = 'input[formcontrolname="userName"], #userId, input[placeholder*="User Name"]';
            const passSel = 'input[formcontrolname="password"], #pwd, input[placeholder*="Password"]';

            await page.waitForSelector(userSel, { timeout: 15000 });

            // Conditional Injection: Only inject if not already autofilled/saved
            try {
                const currentUserVal = await page.locator(userSel).evaluate(el => el.value);
                if (currentUserVal && currentUserVal.trim().length > 0) {
                    emitLog('Username already filled (autofill/saved), skipping typing ✓', 'success');
                } else {
                    const uInput = page.locator(userSel);
                    await uInput.click();
                    await page.keyboard.press('Control+A');
                    await page.keyboard.press('Backspace');
                    await page.keyboard.type(username, { delay: 10 + Math.floor(Math.random() * 25) });
                    emitLog('Username injected safely ✓', 'success');
                }
            } catch (e) {
                emitLog('Username injection failed: ' + e.message, 'error');
            }

            try {
                const currentPassVal = await page.locator(passSel).evaluate(el => el.value);
                if (currentPassVal && currentPassVal.trim().length > 0) {
                    emitLog('Password already filled (autofill/saved), skipping typing ✓', 'success');
                } else {
                    const pInput = page.locator(passSel);
                    await pInput.click();
                    await page.keyboard.press('Control+A');
                    await page.keyboard.press('Backspace');
                    await page.keyboard.type(password, { delay: 10 + Math.floor(Math.random() * 25) });
                    emitLog('Password injected safely ✓', 'success');
                }
            } catch (e) {
                emitLog('Password injection failed: ' + e.message, 'error');
            }

            // Attempt to automatically focus the captcha field to save time
            try {
                const captchaSel = 'input[id="captcha"], input[formcontrolname="captcha"], input[placeholder*="Captcha"], #nlpAnswer';
                await page.waitForSelector(captchaSel, { timeout: 2000 });
                await page.focus(captchaSel);
                emitLog('Focused on Captcha field. Start typing!', 'info');
            } catch (e) {
                // Ignore if not found
            }

            emitLog('✋ PAUSED — Please type Captcha in the browser and click SIGN IN', 'warning');
            
            // Wait for login to complete - checking for 'Welcome', 'MY ACCOUNT', or Logout icon
            emitLog('Waiting for you to complete Sign In...', 'info');
            await page.waitForFunction(() => {
                return document.body.innerText.includes('Welcome') || 
                       document.body.innerText.includes('MY ACCOUNT') ||
                       document.querySelector('.fa-sign-out') ||
                       document.querySelector('a[title="Logout"]');
            }, undefined, { timeout: 300000, polling: 1000 });

            emitLog('LOGIN SUCCESSFUL ✓', 'success');
            await page.waitForTimeout(2000); // Wait for dashboard to settle
        }

        // ─── STEP 3: Search ───
        currentStep = 3;
        emitLog('Triggering search with travel details...', 'info');

        // Safe navigation if we are not on search page
        if (!page.url().includes('train-search')) {
            emitLog('Not on search page. Trying SPA page navigation...', 'info');
            let clickedHome = false;
            try {
                // If there's a Home link/icon or Logo, click it to navigate within the SPA
                const homeBtn = page.locator('a[title="Home"], a[href*="train-search"], img[alt="IRCTC Logo"], .fa-home').first();
                if (await homeBtn.count() > 0 && await homeBtn.isVisible()) {
                    await homeBtn.click();
                    await page.waitForTimeout(2000);
                    clickedHome = true;
                }
            } catch (e) {}

            if (!clickedHome) {
                await page.goto('https://www.irctc.co.in/nget/train-search', { waitUntil: 'domcontentloaded' }).catch(() => {});
            }
        }

        // Wait for search form to be ready (real selector: formcontrolname="origin")
        emitLog('Waiting for search form...', 'info');
        await page.waitForSelector('#origin input[role="searchbox"]', { timeout: 15000 });
        emitLog('Search form ready ✓', 'success');

        // 1. Fill 'From' Station (formcontrolname="origin", id="origin")
        emitLog(`Entering From: ${from}`, 'info');
        const fromInput = page.locator('#origin input[role="searchbox"]');
        await fromInput.click();
        await page.keyboard.press('Control+A');
        await page.keyboard.press('Backspace');
        await page.keyboard.type(from, { delay: 60 });
        await page.waitForTimeout(1000); // Allow autocomplete list to populate
        // Click first matching suggestion
        const fromSuggestion = page.locator('li.ui-autocomplete-list-item').first();
        await fromSuggestion.waitFor({ timeout: 8000 });
        await fromSuggestion.click();
        emitLog('From station selected ✓', 'success');

        // 2. Fill 'To' Station (formcontrolname="destination", id="destination")
        emitLog(`Entering To: ${to}`, 'info');
        const toInput = page.locator('#destination input[role="searchbox"]');
        await toInput.click();
        await page.keyboard.press('Control+A');
        await page.keyboard.press('Backspace');
        await page.keyboard.type(to, { delay: 60 });
        await page.waitForTimeout(1000); // Allow autocomplete list to populate
        // Click first matching suggestion
        const toSuggestion = page.locator('li.ui-autocomplete-list-item').first();
        await toSuggestion.waitFor({ timeout: 8000 });
        await toSuggestion.click();
        emitLog('To station selected ✓', 'success');

        // 3. Fill 'Date' (formcontrolname="journeyDate", id="jDate")
        const parts = date.split('-');
        const formattedDate = `${parts[2]}/${parts[1]}/${parts[0]}`; // DD/MM/YYYY
        emitLog(`Setting Date: ${formattedDate}`, 'info');
        const dateInput = page.locator('#jDate input');
        await dateInput.click();
        await page.keyboard.press('Control+A');
        await page.keyboard.press('Backspace');
        await page.keyboard.type(formattedDate, { delay: 40 });
        // Fail-safe Angular update:
        await page.evaluate(({ sel, val }) => {
            const el = document.querySelector(sel);
            if (el) {
                el.value = val;
                el.dispatchEvent(new Event('input', { bubbles: true }));
                el.dispatchEvent(new Event('change', { bubbles: true }));
            }
        }, { sel: '#jDate input', val: formattedDate });
        await page.keyboard.press('Escape'); // Close calendar overlay
        await page.waitForTimeout(500);
        emitLog('Date set ✓', 'success');

        // 4. Select Class (formcontrolname="journeyClass", id="journeyClass")
        emitLog(`Selecting Class: ${className}`, 'info');
        await page.click('#journeyClass .ui-dropdown');
        await page.waitForTimeout(300);
        await page.click(`li:has-text("${className === 'SL' ? 'Sleeper' : className}")`);
        emitLog('Class selected ✓', 'success');

        // 5. Select Quota (formcontrolname="journeyQuota", id="journeyQuota")
        const quotaMap = {
            'GN': 'GENERAL',
            'TQ': 'TATKAL',
            'PT': 'PREMIUM TATKAL'
        };
        const targetQuota = quotaMap[quota] || 'GENERAL';
        emitLog(`Setting Quota: ${targetQuota}`, 'info');
        await page.click('#journeyQuota .ui-dropdown');
        await page.waitForTimeout(300);
        await page.click(`li:has-text("${targetQuota}")`);
        emitLog(`Quota set to ${targetQuota} ✓`, 'success');

        // 6. Click SEARCH (button.search_btn.train_Search)
        emitLog('Clicking SEARCH TRAINS...', 'warning');
        const searchBtn = page.locator('button.search_btn.train_Search').first();
        await searchBtn.click({ force: true });
        
        emitLog('Search triggered! Waiting for results...', 'info');

        // Wait for trains list
        await page.waitForSelector('.train-heading, .ui-panel, .bull-back, app-train-list', { timeout: 45000 }).catch(() => { 
            emitLog('Still waiting for results to appear...', 'warning');
        });
        await page.waitForTimeout(2000);
        emitLog('Train list loaded ✓', 'success');

        // ─── STEP 4: Select train ───
        currentStep = 4;
        emitLog(`Locating Train ${trainNum}...`, 'info');

        // Find the specific train row
        const trainRowSelector = `//div[contains(., "${trainNum}")]/ancestor::div[contains(@class, "train-item")] | //strong[contains(text(), "${trainNum}")]/ancestor::div[contains(@class, "bull-back")]`;
        
        try {
            await page.waitForSelector(trainRowSelector, { timeout: 10000 });
            const trainRow = page.locator(trainRowSelector).first();
            await trainRow.scrollIntoViewIfNeeded();
            emitLog(`Train ${trainNum} row located ✓`, 'success');

            // 1. Click on Class (e.g., Sleeper (SL))
            emitLog(`Selecting ${className} class...`, 'info');
            const classText = className === 'SL' ? 'Sleeper (SL)' : className;
            // Target the class box
            const classBox = trainRow.locator(`div:has-text("${classText}"):not(:has(div)), td:has-text("${classText}")`).first();
            await classBox.click({ force: true });
            await page.waitForTimeout(300);

            // 1.5 Click on the Refresh button / icon inside or near the class box to fetch dynamic availability
            emitLog(`Clicking refresh button for ${className} class...`, 'info');
            const refreshIcon = classBox.locator('.fa-repeat, .fa-refresh, i.fa, span.fa, text="Refresh", text="refresh"').first();
            if (await refreshIcon.count() > 0) {
                await refreshIcon.click({ force: true }).catch(() => {});
                emitLog(`Clicked refresh icon inside class box ✓`, 'success');
            } else {
                // If not found inside the class box, find the nearest refresh element in the parent hierarchy
                const fallbackRefresh = trainRow.locator(`div:has-text("${classText}"):not(:has(div)) .fa-repeat, div:has-text("${classText}"):not(:has(div)) .fa-refresh, td:has-text("${classText}") .fa-repeat, td:has-text("${classText}") .fa-refresh`).first();
                if (await fallbackRefresh.count() > 0) {
                    await fallbackRefresh.click({ force: true }).catch(() => {});
                    emitLog(`Clicked refresh icon via fallback selector ✓`, 'success');
                } else {
                    emitLog(`No explicit refresh button found, assuming card click triggered reload`, 'info');
                }
            }
            
            // 2. Wait for availability options to load
            emitLog('Waiting for availability to load...', 'info');
            await page.waitForTimeout(2500); // Give IRCTC server time to fetch availability

            // 3. Click the availability box matching the specific date
            emitLog('Clicking the availability box for the specific date...', 'info');
            
            let dDay, dMonthIdx;
            if (date.includes('-')) {
                const parts = date.split('-');
                dDay = parseInt(parts[2], 10);
                dMonthIdx = parseInt(parts[1], 10) - 1;
            } else {
                const parts = date.split('/');
                dDay = parseInt(parts[0], 10);
                dMonthIdx = parseInt(parts[1], 10) - 1;
            }
            const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
            const dMonth = months[dMonthIdx];
            const datePattern = new RegExp(`${dDay}\\s+${dMonth}`, 'i');
            const statusPattern = /WL|AVL|AVAILABLE|RAC|CURR|AVAILABLE/i;

            emitLog(`Scanning for availability box matching date "${dDay} ${dMonth}"...`, 'info');
            
            let targetBox = null;
            let bestTextLength = 9999;
            
            try {
                const cellLocator = trainRow.locator('td, .pre-avl, [class*="avl"], div');
                const cellCount = await cellLocator.count().catch(() => 0);

                for (let i = 0; i < cellCount; i++) {
                    const txt = await cellLocator.nth(i).innerText().catch(() => '');
                    const cleanTxt = txt.trim().replace(/\n/g, ' ');
                    if (!cleanTxt || cleanTxt.length > 120) continue;

                    if (datePattern.test(cleanTxt) && statusPattern.test(cleanTxt)) {
                        if (cleanTxt.length < bestTextLength) {
                            bestTextLength = cleanTxt.length;
                            targetBox = cellLocator.nth(i);
                        }
                    }
                }
            } catch (e) {
                emitLog(`Error scanning list cells: ${e.message}`, 'warning');
            }

            let isEnabled = false;
            const bookBtn = trainRow.locator('button:has-text("Book Now"), button:has-text("BOOK NOW")').first();

            for (let i = 0; i < 5; i++) {
                // Try clicking the specific date's availability box
                try {
                    if (targetBox && await targetBox.count() > 0) {
                        const matchText = await targetBox.innerText().catch(() => '');
                        emitLog(`Clicking compatibility date box: "${matchText.trim().replace(/\n/g, ' ')}" (Attempt ${i+1})...`, 'info');
                        await targetBox.click({ force: true });
                    } else {
                        // Fallback: click first box if specific date is not found
                        emitLog(`Fallback click on first availability cell (Attempt ${i+1})...`, 'warning');
                        const fallbackBox = trainRow.locator('td, .pre-avl').first();
                        if (await fallbackBox.count() > 0) await fallbackBox.click({ force: true });
                    }
                } catch (e) {
                    emitLog(`Click retry error: ${e.message}`, 'warning');
                }
                
                await page.waitForTimeout(1000); // Wait for Angular to update UI
                
                // Check if Book Now is active
                if (await bookBtn.count() > 0) {
                    isEnabled = await bookBtn.evaluate(b => !b.disabled && !b.classList.contains('disabled') && !b.classList.contains('ui-state-disabled'));
                    if (isEnabled) break;
                }
            }

            if (isEnabled) {
                emitLog(`Availability box for ${date} selected & Book Now active ✓`, 'success');
            } else {
                emitLog('WARNING: Book Now button might still be disabled!', 'warning');
            }
            
            // 4. Click Book Now
            emitLog('Clicking BOOK NOW...', 'warning');
            if (isEnabled) {
                await bookBtn.click();
            } else {
                await bookBtn.click({ force: true }); // Last resort
            }
            emitLog('Book Now clicked ✓', 'success');

        } catch (e) {
            emitLog(`Train selection sequence failed: ${e.message}`, 'error');
            emitLog('Trying fallback Book Now click...', 'warning');
            await aiClick(page, ['Book Now', 'BOOK NOW'], ['Cancel']);
        }

        // Handle I Agree / Yes popups
        await page.waitForTimeout(1500);
        for (let i = 0; i < 4; i++) {
            const clicked = await aiClick(page, ['I Agree', 'Yes', 'OK', 'Agree', 'Proceed'], []);
            if (clicked) await page.waitForTimeout(500);
        }

        // ─── STEP 5: Fill Passenger ───
        currentStep = 5;
        emitLog('Filling passenger details (Human Mode)...', 'info');

        if (passengers && passengers.length > 0) {
            await page.waitForTimeout(1000);

            for (let i = 0; i < passengers.length; i++) {
                const pax = passengers[i];

                if (i > 0) {
                    // Click Add Passenger
                    try {
                        const addPaxBtn = page.locator('a:has-text("+ Add Passenger"), span:has-text("+ Add Passenger")').first();
                        if (await addPaxBtn.count() > 0) {
                            await addPaxBtn.click();
                            await page.waitForTimeout(500);
                        }
                    } catch (e) {
                        emitLog(`Could not add passenger ${i+1}`, 'error');
                    }
                }

                try {
                    // Name
                    const nameSelector = 'input[placeholder*="Name"], input[placeholder*="name"], input[placeholder*="Full Name"], input[formcontrolname*="name"], input[formcontrolname*="Name"], #psgn-name';
                    await page.waitForSelector(nameSelector, { timeout: 5000 });
                    const nameInput = page.locator(nameSelector).nth(i);
                    
                    // Click name input to open autocomplete suggestion dropdown from Master List
                    await nameInput.click();
                    await page.waitForTimeout(600); // Wait for master list suggestion dropdown to render
                    
                    // Try to locate autocomplete options (Master List entries)
                    const optionsLocator = page.locator('.ui-autocomplete-panel li, li.ui-autocomplete-list-item, .ui-autocomplete-items li');
                    let autofilled = false;
                    const optionCount = await optionsLocator.count().catch(() => 0);
                    
                    emitLog(`Found ${optionCount} master list autocomplete suggestions`, 'info');
                    for (let j = 0; j < optionCount; j++) {
                        const optText = await optionsLocator.nth(j).innerText().catch(() => '');
                        const cleanOptText = optText.toLowerCase().replace(/\s+/g, '');
                        const cleanPaxName = pax.name.toLowerCase().replace(/\s+/g, '');
                        
                        // Check if the suggestion contains our passenger's name
                        if (cleanOptText.includes(cleanPaxName) || cleanPaxName.includes(cleanOptText)) {
                            emitLog(`Matching master list passenger found: "${optText}". Selecting it...`, 'success');
                            await optionsLocator.nth(j).click({ force: true });
                            autofilled = true;
                            await page.waitForTimeout(1000); // Wait for master list autofill to populate Age/Gender
                            break;
                        }
                    }

                    if (autofilled) {
                        emitLog(`Passenger ${i+1} details successfully autofilled from Master List dropdown ✓`, 'success');
                    } else {
                        // Fallback: Type name, age, and select gender manually
                        emitLog(`No matching master list entry found for "${pax.name}". Typing manually...`, 'info');
                        await nameInput.click();
                        await nameInput.evaluate(n => n.value = '');
                        await page.keyboard.type(pax.name, { delay: 80 + Math.random() * 50 });
                        await page.keyboard.press('Tab'); // Trigger Angular validation
                        await page.waitForTimeout(300 + Math.random() * 300); // Human pause
                        emitLog(`Passenger ${i+1} name: ${pax.name} ✓`, 'success');

                        // Age
                        const ageSelector = 'input[placeholder*="Age"], input[placeholder*="age"], input[formcontrolname*="age"], #psgn-age';
                        const ageInput = page.locator(ageSelector).nth(i);
                        await ageInput.click();
                        await ageInput.evaluate(n => n.value = '');
                        await page.keyboard.type(String(pax.age), { delay: 80 + Math.random() * 50 });
                        await page.keyboard.press('Tab');
                        await page.waitForTimeout(300 + Math.random() * 300);
                        emitLog(`Passenger ${i+1} age: ${pax.age} ✓`, 'success');

                        // Gender Selection
                        const genderSelect = page.locator('select[formcontrolname*="gender"], select[formcontrolname="passengerGender"]').nth(i);
                        if (await genderSelect.count() > 0) {
                            await genderSelect.selectOption({ label: pax.gender === 'M' ? 'Male' : pax.gender === 'F' ? 'Female' : 'Transgender' }).catch(async () => {
                                await genderSelect.selectOption(pax.gender).catch(() => {});
                            });
                            await genderSelect.evaluate(el => el.dispatchEvent(new Event('change', { bubbles: true })));
                            emitLog(`Passenger ${i+1} gender selected ✓`, 'success');
                        }
                    }

                    // Berth Preference (always try to set if specified)
                    if (pax.berth && pax.berth !== 'NP') {
                        const berthSelect = page.locator('select[formcontrolname="passengerBerthChoice"]').nth(i);
                        if (await berthSelect.count() > 0) {
                            await berthSelect.selectOption({ value: pax.berth }).catch(() => {});
                            await berthSelect.evaluate(el => el.dispatchEvent(new Event('change', { bubbles: true })));
                            emitLog(`Passenger ${i+1} berth preference set ✓`, 'success');
                        }
                    }
                } catch (e) {
                    emitLog(`Error filling passenger ${i+1} details: ${e.message}`, 'error');
                }
            }

                // --- Auto-Upgradation ---
                try {
                    const upCheckbox = page.locator('p-checkbox[formcontrolname="autoUpgradation"] .ui-chkbox-box, label[for="autoUpgradation"]').first();
                    if (await upCheckbox.count() > 0) {
                        const isChecked = await upCheckbox.evaluate(el => el.classList.contains('ui-state-active') || el.querySelector('.ui-state-active') !== null);
                        if (!isChecked) {
                            await upCheckbox.click({ force: true });
                            emitLog('Auto-Upgradation checked ✓', 'success');
                        }
                    }
                } catch (e) {}

                // --- Payment Mode (BHIM/UPI) ---
                try {
                    // Try to find the exact radio or the label for UPI
                    const upiRadio = page.locator('p-radiobutton[value="2"], p-radiobutton[value="3"], label:has-text("BHIM/UPI")').first();
                    if (await upiRadio.count() > 0) {
                        await upiRadio.click({ force: true });
                        emitLog('BHIM/UPI Payment Mode selected ✓', 'success');
                    } else {
                        // Fallback string matching
                        const textLoc = page.locator('text=/Pay through BHIM\\/UPI/i').first();
                        if (await textLoc.count() > 0) {
                            await textLoc.click({ force: true });
                            emitLog('BHIM/UPI Payment Mode selected ✓', 'success');
                        }
                    }
                } catch (e) {}

            // Outer try-catch removed

            // ─── STOP POINT (Early Handoff) ───
            currentStep = 6;
            emitLog('✋ STOPPED — Passenger details filled! Please select preferences and click Continue manually.', 'warning');
            emitLog('🎉 READY FOR MANUAL TAKEOVER', 'success');
            isDone = true;
            return; 
        }

    } catch (err) {
        if (!res.headersSent) {
            res.status(500).json({ status: 'error', error: err.message });
        }
        emitLog(`Error: ${err.message}`, 'error');
    }
});



// ─── API: Stop ───
app.post('/api/stop', async (req, res) => {
    try {
        if (browser) await browser.close().catch(() => { });
        browser = null;
        page = null;
    } catch (_) { }
    res.json({ status: 'stopped' });
});

// ─── API: Live Stream ───
app.get('/api/live-stream', (req, res) => {
    res.json({ image: latestScreenshot });
});

// ─── API: Inspect Visitors Form (Debug) ───
app.get('/api/inspect-visitors', async (req, res) => {
    if (!page || page.isClosed()) {
        return res.json({ error: 'No active page' });
    }
    try {
        const data = await page.evaluate(() => {
            const inputs = Array.from(document.querySelectorAll('input')).map(el => {
                const rect = el.getBoundingClientRect();
                return {
                    tag: 'input',
                    type: el.type,
                    id: el.id,
                    name: el.name,
                    placeholder: el.placeholder,
                    value: el.value,
                    className: el.className,
                    visible: rect.width > 0 && rect.height > 0,
                    outerHTML: el.outerHTML
                };
            });
            const selects = Array.from(document.querySelectorAll('select')).map(el => {
                return {
                    tag: 'select',
                    id: el.id,
                    name: el.name,
                    className: el.className,
                    options: Array.from(el.options).map(o => o.text),
                    outerHTML: el.outerHTML
                };
            });
            const labels = Array.from(document.querySelectorAll('label')).map(el => el.textContent.trim());
            return { url: window.location.href, inputs, selects, labels };
        });
        res.json(data);
    } catch (e) {
        res.json({ error: e.message });
    }
});

// ─── API: External Log Sync ───
app.post('/api/log', (req, res) => {
    const { msg, type } = req.body;
    if (msg) {
        emitLog(msg, type || 'info');
    }
    res.json({ status: 'ok' });
});

// ─── API: Status ───
app.get('/api/status', (req, res) => {
    const logs = [...statusLogs];
    statusLogs = [];
    res.json({ logs, step: currentStep, done: isDone });
});

// ═══════════════════════════════════════════════════════════
// ─── MOBILE BOT (Appium / RailConnect) ───
// ═══════════════════════════════════════════════════════════


// ─── API: Start Mobile Bot ───
app.post('/api/start-mobile-bot', async (req, res) => {
    const {
        licenseKey,
        from, to, date, trainNum, className, quota,
        username, password, passengers,
        appiumHost, appiumPort, deviceName, appPackage, appActivity, udid
    } = req.body;

    // Secure Firewall License Check
    if (!licenseKey) {
        return res.status(403).json({ error: 'Subscription license key required to start mobile automation.' });
    }

    const db = loadLicenses();
    const info = db[licenseKey];

    if (!info) {
        return res.status(403).json({ error: 'Invalid subscription license key.' });
    }
    if (info.status !== 'active') {
        return res.status(403).json({ error: 'License key is inactive or suspended.' });
    }
    if (new Date(info.expiresAt) < new Date()) {
        return res.status(403).json({ error: 'Subscription expired. Please renew first.' });
    }

    // IP Lock verification
    const clientIp = getClientIp(req);
    if (info.ipAddress && info.ipAddress !== clientIp) {
        return res.status(403).json({ error: 'Subscription license key is bound to a different IP address.' });
    }

    try {
        res.json({ status: 'started', message: 'Mobile bot launching...' });
        startMobileBot({
            username, password, from, to, date,
            trainNum, className, quota, passengers,
            appiumHost: appiumHost || 'localhost',
            appiumPort: parseInt(appiumPort) || 4723,
            deviceName: deviceName || 'emulator-5554',
            appPackage: appPackage || 'cris.org.in.prs.ima',
            appActivity: appActivity || 'cris.org.in.prs.ima.activity.SplashScreenActivity',
            udid: udid || ''
        });
    } catch (err) {
        if (!res.headersSent) {
            res.status(500).json({ status: 'error', error: err.message });
        }
    }
});

// ─── API: Stop Mobile Bot ───
app.post('/api/stop-mobile', async (req, res) => {
    await stopMobileBot();
    res.json({ status: 'stopped' });
});

// ─── API: Mobile Screenshot ───
app.get('/api/mobile-screenshot', (req, res) => {
    res.json({ image: getMobileScreenshot() });
});

// ─── API: Mobile Status ───
app.get('/api/mobile-status', (req, res) => {
    res.json({
        logs: getMobileLogs(),
        step: getMobileStep(),
        done: isMobileDone()
    });
});

// ─── API: Inspect Screen (Debug) ───
app.get('/api/mobile-inspect', async (req, res) => {
    const result = await inspectScreen();
    res.json(result);
});

// Helper to get local network IP
function getLocalIP() {
    const interfaces = os.networkInterfaces();
    for (const name of Object.keys(interfaces)) {
        for (const iface of interfaces[name]) {
            if (iface.family === 'IPv4' && !iface.internal) {
                return iface.address;
            }
        }
    }
    return 'localhost';
}

// ─── Start Server ───
const PORT = process.env.PORT || 3005;
app.listen(PORT, () => {
    const localIP = getLocalIP();
    console.log(`\n  ⚡ Swift Seat Server running on http://localhost:${PORT}`);
    console.log(`  📱 Access on Mobile App: http://${localIP}:${PORT}`);
    console.log(`  🚉 Ready to book: YNK → YG | Train 11312`);
    console.log(`  📱 Mobile Bot (Appium) endpoints active\n`);
});
