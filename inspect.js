import { chromium } from 'playwright';

(async () => {
    const browser = await chromium.launch({
        headless: false,
        channel: 'chrome',
        args: ['--disable-blink-features=AutomationControlled', '--start-maximized'],
        ignoreDefaultArgs: ['--enable-automation']
    });

    const context = await browser.newContext({
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36',
        viewport: null
    });

    await context.addInitScript(() => {
        Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
    });

    const page = await context.newPage();

    // Navigate
    console.log('Navigating to IRCTC...');
    await page.goto('https://www.irctc.co.in/nget/train-search', { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForTimeout(3000);

    // Clear popups
    for (let i = 0; i < 3; i++) {
        await page.evaluate(() => {
            document.querySelectorAll('a, button, span').forEach(el => {
                const t = el.textContent.trim();
                if (t === 'OK' || t === 'Got it') el.click();
            });
        });
        await page.waitForTimeout(500);
    }

    // Click LOGIN
    console.log('Clicking LOGIN...');
    await page.evaluate(() => {
        document.querySelectorAll('a, button, span').forEach(el => {
            const t = el.textContent.trim().toUpperCase();
            if (t.includes('LOGIN') && !t.includes('LOYALTY') && !t.includes('AGENT')) {
                el.click();
            }
        });
    });
    await page.waitForTimeout(2000);

    // Fill credentials
    const userSel = 'input[formcontrolname="userName"], #userId, input[placeholder*="User Name"]';
    const passSel = 'input[formcontrolname="password"], #pwd, input[placeholder*="Password"]';
    await page.waitForSelector(userSel, { timeout: 15000 });
    await page.fill(userSel, 'YOUR_USERNAME');
    await page.fill(passSel, 'YOUR_PASSWORD');

    // Click Sign In
    await page.evaluate(() => {
        document.querySelectorAll('button, input[type="submit"]').forEach(el => {
            const t = el.textContent.trim().toUpperCase();
            if (t.includes('SIGN IN') && !t.includes('SIGN UP')) el.click();
        });
    });

    console.log('Waiting for login...');
    await page.waitForFunction(() => {
        return document.body.innerText.includes('Welcome') || document.body.innerText.includes('MY ACCOUNT');
    }, undefined, { timeout: 60000, polling: 1000 });
    console.log('LOGGED IN!');

    await page.waitForTimeout(3000);

    // Now dump all form elements on the page
    console.log('\n=== DUMPING ALL INPUT ELEMENTS ===\n');
    const inputs = await page.evaluate(() => {
        const results = [];
        document.querySelectorAll('input, select, textarea, p-autocomplete, p-calendar, p-dropdown').forEach(el => {
            const rect = el.getBoundingClientRect();
            results.push({
                tag: el.tagName.toLowerCase(),
                type: el.type || '',
                id: el.id || '',
                name: el.name || '',
                placeholder: el.placeholder || '',
                formcontrolname: el.getAttribute('formcontrolname') || '',
                class: el.className.substring(0, 80),
                role: el.getAttribute('role') || '',
                ariaLabel: el.getAttribute('aria-label') || '',
                value: el.value ? el.value.substring(0, 40) : '',
                visible: rect.width > 0 && rect.height > 0,
                x: Math.round(rect.x),
                y: Math.round(rect.y),
                w: Math.round(rect.width),
                h: Math.round(rect.height)
            });
        });
        return results;
    });

    inputs.forEach((inp, i) => {
        if (inp.visible) {
            console.log(`[${i}] <${inp.tag}> type="${inp.type}" id="${inp.id}" name="${inp.name}" placeholder="${inp.placeholder}" formcontrolname="${inp.formcontrolname}" role="${inp.role}" aria-label="${inp.ariaLabel}" class="${inp.class}" value="${inp.value}" pos=(${inp.x},${inp.y}) size=${inp.w}x${inp.h}`);
        }
    });

    // Also dump all dropdowns
    console.log('\n=== DUMPING ALL DROPDOWN/SELECT ELEMENTS ===\n');
    const dropdowns = await page.evaluate(() => {
        const results = [];
        document.querySelectorAll('.ui-dropdown, p-dropdown, select, [role="listbox"]').forEach(el => {
            const rect = el.getBoundingClientRect();
            results.push({
                tag: el.tagName.toLowerCase(),
                id: el.id || '',
                formcontrolname: el.getAttribute('formcontrolname') || '',
                class: el.className.substring(0, 80),
                innerText: el.innerText.substring(0, 60),
                visible: rect.width > 0 && rect.height > 0,
                x: Math.round(rect.x),
                y: Math.round(rect.y),
                w: Math.round(rect.width),
                h: Math.round(rect.height)
            });
        });
        return results;
    });

    dropdowns.forEach((dd, i) => {
        if (dd.visible) {
            console.log(`[${i}] <${dd.tag}> id="${dd.id}" formcontrolname="${dd.formcontrolname}" class="${dd.class}" text="${dd.innerText}" pos=(${dd.x},${dd.y}) size=${dd.w}x${dd.h}`);
        }
    });

    // Also dump the search button
    console.log('\n=== DUMPING BUTTONS ===\n');
    const buttons = await page.evaluate(() => {
        const results = [];
        document.querySelectorAll('button, input[type="submit"]').forEach(el => {
            const rect = el.getBoundingClientRect();
            if (rect.width > 0 && rect.height > 0) {
                results.push({
                    tag: el.tagName.toLowerCase(),
                    type: el.type || '',
                    id: el.id || '',
                    class: el.className.substring(0, 80),
                    text: el.textContent.trim().substring(0, 50),
                    x: Math.round(rect.x),
                    y: Math.round(rect.y),
                    w: Math.round(rect.width),
                    h: Math.round(rect.height)
                });
            }
        });
        return results;
    });

    buttons.forEach((btn, i) => {
        console.log(`[${i}] <${btn.tag}> type="${btn.type}" id="${btn.id}" class="${btn.class}" text="${btn.text}" pos=(${btn.x},${btn.y}) size=${btn.w}x${btn.h}`);
    });

    console.log('\n=== DONE ===');

    // Keep browser open for 5 seconds then close
    await page.waitForTimeout(5000);
    await browser.close();
})();
