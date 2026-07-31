import { chromium } from 'playwright';

(async () => {
    const browser = await chromium.launch({
        headless: false, channel: 'chrome',
        args: ['--disable-blink-features=AutomationControlled', '--start-maximized'],
        ignoreDefaultArgs: ['--enable-automation']
    });
    const context = await browser.newContext({
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36',
        viewport: null
    });
    await context.addInitScript(() => { Object.defineProperty(navigator, 'webdriver', { get: () => undefined }); });
    const page = await context.newPage();

    // Navigate & login
    await page.goto('https://www.irctc.co.in/nget/train-search', { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForTimeout(3000);
    for (let i = 0; i < 3; i++) {
        await page.evaluate(() => { document.querySelectorAll('a, button, span').forEach(el => { const t = el.textContent.trim(); if (t === 'OK' || t === 'Got it') el.click(); }); });
        await page.waitForTimeout(500);
    }
    await page.evaluate(() => { document.querySelectorAll('a, button, span').forEach(el => { if (el.textContent.trim().toUpperCase().includes('LOGIN') && !el.textContent.includes('LOYALTY')) el.click(); }); });
    await page.waitForTimeout(2000);
    await page.waitForSelector('input[formcontrolname="userName"]', { timeout: 15000 });
    await page.fill('input[formcontrolname="userName"]', 'YOUR_USERNAME');
    await page.fill('input[formcontrolname="password"]', 'YOUR_PASSWORD');
    await page.evaluate(() => { document.querySelectorAll('button').forEach(el => { if (el.textContent.trim().toUpperCase().includes('SIGN IN') && !el.textContent.includes('SIGN UP')) el.click(); }); });
    await page.waitForFunction(() => document.body.innerText.includes('Welcome') || document.body.innerText.includes('MY ACCOUNT'), undefined, { timeout: 60000 });
    console.log('LOGGED IN');
    await page.waitForTimeout(2000);

    // Fill search form
    await page.waitForSelector('#origin input[role="searchbox"]', { timeout: 15000 });
    const fromInput = page.locator('#origin input[role="searchbox"]');
    await fromInput.click(); await fromInput.fill(''); await page.keyboard.type('YNK', { delay: 80 });
    await page.waitForTimeout(1500);
    await page.locator('li.ui-autocomplete-list-item').first().click();
    
    const toInput = page.locator('#destination input[role="searchbox"]');
    await toInput.click(); await toInput.fill(''); await page.keyboard.type('YG', { delay: 80 });
    await page.waitForTimeout(1500);
    await page.locator('li.ui-autocomplete-list-item').first().click();

    // Date
    const dateInput = page.locator('#jDate input');
    await dateInput.click({ clickCount: 3 });
    const tomorrow = new Date(); tomorrow.setDate(tomorrow.getDate() + 1);
    const dd = String(tomorrow.getDate()).padStart(2,'0');
    const mm = String(tomorrow.getMonth()+1).padStart(2,'0');
    const yyyy = tomorrow.getFullYear();
    await page.keyboard.type(`${dd}/${mm}/${yyyy}`, { delay: 30 });
    await page.keyboard.press('Escape');

    // Class
    await page.click('#journeyClass .ui-dropdown');
    await page.waitForTimeout(300);
    await page.click('li:has-text("Sleeper")');

    // Quota
    await page.click('#journeyQuota .ui-dropdown');
    await page.waitForTimeout(300);
    await page.click('li:has-text("TATKAL")');

    // Search
    await page.click('button.search_btn.train_Search');
    console.log('Search clicked, waiting for results...');

    // Wait for results
    await page.waitForSelector('.train-heading, .ui-panel, .bull-back, app-train-list', { timeout: 45000 }).catch(() => {});
    await page.waitForTimeout(5000);

    // DUMP train list elements
    console.log('\n=== DUMPING TRAIN LIST ELEMENTS ===\n');
    const trains = await page.evaluate(() => {
        const results = [];
        // Look for train number/name elements
        document.querySelectorAll('.train-heading, .trainNameArrow, strong, .bold, [class*="train"], app-train-list *').forEach(el => {
            const rect = el.getBoundingClientRect();
            const text = el.textContent.trim().substring(0, 100);
            if (rect.width > 0 && rect.height > 0 && text.length > 0) {
                results.push({
                    tag: el.tagName.toLowerCase(),
                    class: el.className ? el.className.substring(0, 80) : '',
                    id: el.id || '',
                    text: text,
                    x: Math.round(rect.x), y: Math.round(rect.y),
                    w: Math.round(rect.width), h: Math.round(rect.height)
                });
            }
        });
        return results;
    });
    trains.forEach((t, i) => {
        console.log(`[${i}] <${t.tag}> class="${t.class}" text="${t.text}" pos=(${t.x},${t.y}) size=${t.w}x${t.h}`);
    });

    // Dump class/availability buttons
    console.log('\n=== DUMPING CLASS AVAILABILITY / BOOK BUTTONS ===\n');
    const classButtons = await page.evaluate(() => {
        const results = [];
        document.querySelectorAll('td, .col-xs-12, .pre-avl, button, a').forEach(el => {
            const text = el.textContent.trim().substring(0, 80);
            const rect = el.getBoundingClientRect();
            if (rect.width > 0 && rect.height > 0 && (text.includes('SL') || text.includes('Book Now') || text.includes('BOOK NOW') || text.includes('Avl') || text.includes('WL') || text.includes('Available') || text.includes('RAC'))) {
                results.push({
                    tag: el.tagName.toLowerCase(),
                    class: el.className ? el.className.substring(0, 80) : '',
                    text: text,
                    x: Math.round(rect.x), y: Math.round(rect.y),
                    w: Math.round(rect.width), h: Math.round(rect.height)
                });
            }
        });
        return results;
    });
    classButtons.forEach((b, i) => {
        console.log(`[${i}] <${b.tag}> class="${b.class}" text="${b.text}" pos=(${b.x},${b.y}) size=${b.w}x${b.h}`);
    });

    console.log('\n=== DONE ===');
    await page.waitForTimeout(5000);
    await browser.close();
})();
