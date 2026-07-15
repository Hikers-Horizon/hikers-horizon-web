import { chromium } from 'playwright';
import fs from 'fs';

(async () => {
    console.log('Launching browser to inspect Aranya Vihara...');
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

    try {
        console.log('Navigating to https://aranyavihaara.karnataka.gov.in/home ...');
        await page.goto('https://aranyavihaara.karnataka.gov.in/home', { waitUntil: 'networkidle', timeout: 60000 });
        console.log('Page loaded! Waiting 5 seconds to let everything settle...');
        await page.waitForTimeout(5000);

        // Take a screenshot
        const screenshotPath = 'aranya_home.png';
        await page.screenshot({ path: screenshotPath });
        console.log(`Saved homepage screenshot to: ${screenshotPath}`);

        // Dump elements
        console.log('\n=== DUMPING INTERACTIVE ELEMENTS ===\n');
        const elements = await page.evaluate(() => {
            const results = [];
            const interactive = document.querySelectorAll('a, button, select, input, textarea, [role="button"]');
            interactive.forEach((el, index) => {
                const rect = el.getBoundingClientRect();
                if (rect.width > 0 && rect.height > 0) {
                    results.push({
                        index,
                        tag: el.tagName.toLowerCase(),
                        id: el.id || '',
                        name: el.name || '',
                        type: el.type || '',
                        placeholder: el.placeholder || '',
                        text: (el.textContent || '').trim().substring(0, 50),
                        className: el.className.substring(0, 100),
                        role: el.getAttribute('role') || '',
                        value: el.value || '',
                        pos: `(${Math.round(rect.x)}, ${Math.round(rect.y)})`,
                        size: `${Math.round(rect.width)}x${Math.round(rect.height)}`
                    });
                }
            });
            return results;
        });

        elements.forEach(el => {
            console.log(`[${el.index}] <${el.tag}> text="${el.text}" id="${el.id}" name="${el.name}" type="${el.type}" placeholder="${el.placeholder}" class="${el.className}" pos=${el.pos} size=${el.size}`);
        });

        console.log('\n=== END OF DUMP ===');

        // Let's also check if there is an existing login or booking button and click it to see what happens
        console.log('Searching for "Book" or "Login" buttons...');
        const buttonsToTry = elements.filter(el => 
            el.text.toUpperCase().includes('BOOK') || 
            el.text.toUpperCase().includes('LOGIN') || 
            el.text.toUpperCase().includes('TREK')
        );
        console.log('Matching buttons:', buttonsToTry);

    } catch (e) {
        console.error('Inspection failed:', e);
    } finally {
        await page.waitForTimeout(5000);
        await browser.close();
    }
})();
