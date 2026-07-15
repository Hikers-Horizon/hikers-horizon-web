/**
 * inspect_mobile.js — RailConnect Element Inspector
 * 
 * Run this AFTER Appium is started and device is connected.
 * It dumps all visible elements on the current screen for debugging selectors.
 *
 * Usage:
 *   node inspect_mobile.js [device-name]
 *
 * Prerequisites:
 *   1. Appium running: appium
 *   2. Device connected: adb devices
 *   3. RailConnect app installed on device
 */

import { remote } from 'webdriverio';

const deviceName = process.argv[2] || 'emulator-5554';
const appPackage = process.argv[3] || 'cris.org.in.prs.ima';
const appActivity = process.argv[4] || 'cris.org.in.prs.ima.activity.SplashScreenActivity';

(async () => {
    console.log('\n📱 RailConnect Element Inspector');
    console.log('═'.repeat(50));
    console.log(`Device: ${deviceName}`);
    console.log(`Package: ${appPackage}`);
    console.log(`Activity: ${appActivity}`);
    console.log('═'.repeat(50));

    let driver;

    try {
        driver = await remote({
            hostname: 'localhost',
            port: 4723,
            path: '/',
            capabilities: {
                platformName: 'Android',
                'appium:automationName': 'UiAutomator2',
                'appium:deviceName': deviceName,
                'appium:appPackage': appPackage,
                'appium:appActivity': appActivity,
                'appium:noReset': true,
                'appium:fullReset': false,
                'appium:autoGrantPermissions': true,
                'appium:newCommandTimeout': 120,
            },
            logLevel: 'warn'
        });

        console.log('\n✓ Connected to device!\n');

        // Wait for app to load
        console.log('Waiting 5s for app to load...\n');
        await new Promise(r => setTimeout(r, 5000));

        // Get page source (XML hierarchy)
        console.log('=== PAGE SOURCE (XML) ===\n');
        const source = await driver.getPageSource();
        console.log(source.substring(0, 5000)); // First 5000 chars
        console.log('\n... (truncated)\n');

        // Dump all visible text elements
        console.log('=== ALL TEXT VIEWS ===\n');
        const textViews = await driver.$$('android.widget.TextView');
        for (let i = 0; i < textViews.length; i++) {
            try {
                const text = await textViews[i].getText();
                const rect = await textViews[i].getLocation();
                const size = await textViews[i].getSize();
                const resId = await textViews[i].getAttribute('resource-id');
                console.log(`[${i}] text="${text}" resource-id="${resId || ''}" pos=(${rect.x},${rect.y}) size=${size.width}x${size.height}`);
            } catch (_) {}
        }

        // Dump all EditText (input fields)
        console.log('\n=== ALL INPUT FIELDS ===\n');
        const editTexts = await driver.$$('android.widget.EditText');
        for (let i = 0; i < editTexts.length; i++) {
            try {
                const text = await editTexts[i].getText();
                const hint = await editTexts[i].getAttribute('text');
                const resId = await editTexts[i].getAttribute('resource-id');
                const contentDesc = await editTexts[i].getAttribute('content-desc');
                console.log(`[${i}] text="${text}" hint="${hint}" resource-id="${resId || ''}" content-desc="${contentDesc || ''}"`);
            } catch (_) {}
        }

        // Dump all Buttons
        console.log('\n=== ALL BUTTONS ===\n');
        const buttons = await driver.$$('android.widget.Button');
        for (let i = 0; i < buttons.length; i++) {
            try {
                const text = await buttons[i].getText();
                const resId = await buttons[i].getAttribute('resource-id');
                console.log(`[${i}] text="${text}" resource-id="${resId || ''}"`);
            } catch (_) {}
        }

        // Dump clickable ImageViews
        console.log('\n=== CLICKABLE IMAGE VIEWS ===\n');
        const imageViews = await driver.$$('android.widget.ImageView');
        for (let i = 0; i < imageViews.length; i++) {
            try {
                const clickable = await imageViews[i].getAttribute('clickable');
                if (clickable === 'true') {
                    const resId = await imageViews[i].getAttribute('resource-id');
                    const contentDesc = await imageViews[i].getAttribute('content-desc');
                    const rect = await imageViews[i].getLocation();
                    console.log(`[${i}] resource-id="${resId || ''}" content-desc="${contentDesc || ''}" pos=(${rect.x},${rect.y})`);
                }
            } catch (_) {}
        }

        // Take screenshot
        console.log('\n=== SCREENSHOT ===\n');
        const screenshot = await driver.takeScreenshot();
        const fs = await import('fs');
        fs.writeFileSync('./mobile_screenshot.png', Buffer.from(screenshot, 'base64'));
        console.log('Screenshot saved to: mobile_screenshot.png');

        console.log('\n=== DONE ===\n');
        console.log('The device session will stay open for 30s for manual inspection...');
        await new Promise(r => setTimeout(r, 30000));

    } catch (e) {
        console.error('\n✗ Error:', e.message);
        console.error('\nTroubleshooting:');
        console.error('  1. Is Appium running? Run: appium');
        console.error('  2. Is device connected? Run: adb devices');
        console.error('  3. Is UiAutomator2 driver installed? Run: appium driver install uiautomator2');
        console.error(`  4. Is the app package correct? Current: ${appPackage}`);
        console.error('     Find it with: adb shell pm list packages | findstr irctc');
    } finally {
        if (driver) {
            try { await driver.deleteSession(); } catch (_) {}
        }
    }
})();
