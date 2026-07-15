import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

// ─── Mobile Bot State ───
let currentUdid = '';
let isBotRunning = false;
let mobileScreenshot = '';
let mobileLogs = [];
let mobileStep = 0;
let mobileDone = false;

const adbPath = fs.existsSync('C:\\platform-tools\\platform-tools\\adb.exe') 
    ? 'C:\\platform-tools\\platform-tools\\adb.exe' 
    : 'adb';

function mLog(msg, type = 'info') {
    console.log(`[MOBILE-${type.toUpperCase()}] ${msg}`);
    mobileLogs.push({ msg, type });
}

function runAdb(cmd) {
    const target = currentUdid ? `-s ${currentUdid}` : '';
    try {
        return execSync(`"${adbPath}" ${target} ${cmd}`, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
    } catch (e) {
        return '';
    }
}

function getUiDump() {
    runAdb('shell uiautomator dump /data/local/tmp/window_dump.xml');
    return runAdb('shell cat /data/local/tmp/window_dump.xml');
}

function parseBounds(xml, attr, value, caseInsensitive = true) {
    if (!xml) return null;
    const nodeRegex = /<node[^>]*>/g;
    let match;
    const targets = Array.isArray(value) ? value : [value];
    
    while ((match = nodeRegex.exec(xml)) !== null) {
        const nodeStr = match[0];
        const attrRegex = new RegExp(`${attr}="([^"]*)"`);
        const attrMatch = attrRegex.exec(nodeStr);
        if (!attrMatch) continue;
        
        const nodeVal = attrMatch[1];
        let isMatch = false;
        for (const t of targets) {
            if (caseInsensitive) {
                if (nodeVal.toLowerCase().includes(t.toLowerCase())) {
                    isMatch = true;
                    break;
                }
            } else {
                if (nodeVal.includes(t)) {
                    isMatch = true;
                    break;
                }
            }
        }
        
        if (isMatch) {
            const boundsMatch = /bounds="\[(\d+),(\d+)\]\[(\d+),(\d+)\]"/.exec(nodeStr);
            if (boundsMatch) {
                const x1 = parseInt(boundsMatch[1], 10);
                const y1 = parseInt(boundsMatch[2], 10);
                const x2 = parseInt(boundsMatch[3], 10);
                const y2 = parseInt(boundsMatch[4], 10);
                return {
                    x: Math.floor((x1 + x2) / 2),
                    y: Math.floor((y1 + y2) / 2)
                };
            }
        }
    }
    return null;
}

function parseAllBounds(xml, attr, value, caseInsensitive = true) {
    if (!xml) return [];
    const nodeRegex = /<node[^>]*>/g;
    let match;
    const results = [];
    const targets = Array.isArray(value) ? value : [value];
    
    while ((match = nodeRegex.exec(xml)) !== null) {
        const nodeStr = match[0];
        const attrRegex = new RegExp(`${attr}="([^"]*)"`);
        const attrMatch = attrRegex.exec(nodeStr);
        if (!attrMatch) continue;
        
        const nodeVal = attrMatch[1];
        let isMatch = false;
        for (const t of targets) {
            if (caseInsensitive) {
                if (nodeVal.toLowerCase().includes(t.toLowerCase())) {
                    isMatch = true;
                    break;
                }
            } else {
                if (nodeVal.includes(t)) {
                    isMatch = true;
                    break;
                }
            }
        }
        
        if (isMatch) {
            const boundsMatch = /bounds="\[(\d+),(\d+)\]\[(\d+),(\d+)\]"/.exec(nodeStr);
            if (boundsMatch) {
                const x1 = parseInt(boundsMatch[1], 10);
                const y1 = parseInt(boundsMatch[2], 10);
                const x2 = parseInt(boundsMatch[3], 10);
                const y2 = parseInt(boundsMatch[4], 10);
                results.push({
                    x: Math.floor((x1 + x2) / 2),
                    y: Math.floor((y1 + y2) / 2)
                });
            }
        }
    }
    return results;
}

// ─── Screenshot Loop ───
async function mobileScreenshotLoop() {
    const tempDir = './user_data';
    if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true });
    }
    const tempFile = path.join(tempDir, 'screencap.png');

    while (isBotRunning) {
        try {
            runAdb('shell screencap -p /data/local/tmp/screen.png');
            runAdb(`pull /data/local/tmp/screen.png "${tempFile}"`);
            if (fs.existsSync(tempFile)) {
                const buf = fs.readFileSync(tempFile);
                mobileScreenshot = buf.toString('base64');
            }
        } catch (_) {}
        await new Promise(r => setTimeout(r, 1000));
    }
}

// ─── Helpers ───
async function tapByText(text, timeout = 10000) {
    const start = Date.now();
    while (Date.now() - start < timeout) {
        const xml = getUiDump();
        if (xml) {
            const coords = parseBounds(xml, 'text', text) || parseBounds(xml, 'content-desc', text);
            if (coords) {
                runAdb(`shell input tap ${coords.x} ${coords.y}`);
                return true;
            }
        }
        await new Promise(r => setTimeout(r, 800));
    }
    return false;
}

async function tapByDesc(desc, timeout = 10000) {
    const start = Date.now();
    while (Date.now() - start < timeout) {
        const xml = getUiDump();
        if (xml) {
            const coords = parseBounds(xml, 'content-desc', desc);
            if (coords) {
                runAdb(`shell input tap ${coords.x} ${coords.y}`);
                return true;
            }
        }
        await new Promise(r => setTimeout(r, 800));
    }
    return false;
}

async function tapById(resourceId, timeout = 10000) {
    const start = Date.now();
    while (Date.now() - start < timeout) {
        const xml = getUiDump();
        if (xml) {
            const coords = parseBounds(xml, 'resource-id', resourceId);
            if (coords) {
                runAdb(`shell input tap ${coords.x} ${coords.y}`);
                return true;
            }
        }
        await new Promise(r => setTimeout(r, 800));
    }
    return false;
}

async function typeInField(resourceId, value, timeout = 10000) {
    const tapped = await tapById(resourceId, timeout);
    if (!tapped) return false;
    await new Promise(r => setTimeout(r, 500));
    
    // Clear field
    runAdb('shell input keyevent 123'); // KEYCODE_MOVE_END
    for (let i = 0; i < 35; i++) {
        runAdb('shell input keyevent 67'); // KEYCODE_DEL
    }
    await new Promise(r => setTimeout(r, 200));

    const escapedValue = value.replace(/ /g, '%s');
    runAdb(`shell input text "${escapedValue}"`);
    return true;
}

async function waitForText(text, timeout = 30000) {
    const start = Date.now();
    while (Date.now() - start < timeout) {
        const xml = getUiDump();
        if (xml) {
            const coords = parseBounds(xml, 'text', text) || parseBounds(xml, 'content-desc', text);
            if (coords) return true;
        }
        await new Promise(r => setTimeout(r, 1000));
    }
    return false;
}

async function scrollToText(text) {
    const xml = getUiDump();
    if (xml && (parseBounds(xml, 'text', text) || parseBounds(xml, 'content-desc', text))) {
        return true;
    }
    for (let i = 0; i < 4; i++) {
        mLog('Scrolling screen...', 'info');
        runAdb('shell input swipe 500 1500 500 500 500');
        await new Promise(r => setTimeout(r, 1500));
        const newXml = getUiDump();
        if (newXml && (parseBounds(newXml, 'text', text) || parseBounds(newXml, 'content-desc', text))) {
            return true;
        }
    }
    return false;
}

async function humanDelay(min = 300, max = 800) {
    await new Promise(r => setTimeout(r, min + Math.random() * (max - min)));
}

// ─── Main Automation Flow ───
export async function startMobileBot(config) {
    mobileLogs = [];
    mobileStep = 0;
    mobileDone = false;

    const {
        username, password, from, to, date,
        trainNum, className, quota, passengers,
        deviceName = 'emulator-5554',
        appPackage = 'cris.org.in.prs.ima',
        appActivity = 'cris.org.in.ima.activities.IRCTCConnectActivity',
        udid = ''
    } = config;

    currentUdid = udid;

    try {
        // ─── STEP 1: Connect to Device via ADB ───
        mobileStep = 1;
        mLog('Connecting to Android device via ADB...', 'info');

        const devices = runAdb('devices');
        if (!devices.includes('device') || devices.trim().split('\n').length <= 1) {
            throw new Error('No Android devices connected. Please connect your phone with USB Debugging enabled.');
        }

        mLog('Connected to device successfully ✓', 'success');
        mLog(`Launching mobile app: ${appPackage}...`, 'info');

        runAdb(`shell am force-stop ${appPackage}`);
        await new Promise(r => setTimeout(r, 500));
        runAdb(`shell am start -n ${appPackage}/${appActivity}`);
        await new Promise(r => setTimeout(r, 3500));

        isBotRunning = true;
        mobileScreenshotLoop();

        const isRailOne = appPackage === 'org.cris.aikyam';

        if (isRailOne) {
            // ─── STEP 2: RailOne Login ───
            mobileStep = 2;
            mLog('Checking if dashboard is already active...', 'info');
            const alreadyLoggedIn = await waitForText('Book Ticket', 2000) || 
                                      await waitForText('Reserved Booking', 1000) || 
                                      await waitForText('Trains', 1000);
            
            if (alreadyLoggedIn) {
                mLog('Dashboard active! Skipping login step. ✓', 'success');
            } else {
                mLog('Searching for Login/Sign In option...', 'info');
                let loginClicked = false;
                for (let i = 0; i < 20; i++) {
                    loginClicked = await tapByText('Login', 500) || 
                                   await tapByText('LOGIN', 200) ||
                                   await tapByText('Sign In', 200) ||
                                   await tapByText('SIGN IN', 200) ||
                                   await tapById(`${appPackage}:id/login`, 200) ||
                                   await tapById(`${appPackage}:id/btn_login`, 200);
                    if (loginClicked) break;
                    await new Promise(r => setTimeout(r, 200));
                }
                
                if (loginClicked) {
                    mLog('Login option triggered ✓', 'success');
                    mLog('✋ WAITING FOR LOGIN/mPIN — Please authenticate on your device now', 'warning');
                    
                    const loginSuccess = await waitForText('Book Ticket', 120000) ||
                                          await waitForText('Reserved Booking', 5000) ||
                                          await waitForText('Trains', 5000);
                    if (loginSuccess) {
                        mLog('LOGIN SUCCESSFUL! ✓', 'success');
                    } else {
                        throw new Error('Timed out waiting for login completion');
                    }
                } else {
                    mLog('No login button found, assuming already logged in...', 'warning');
                }
            }

            // ─── STEP 3: Navigate to Book Ticket (RailOne) ───
            mobileStep = 3;
            mLog('Navigating to Reserved Ticket Booking...', 'info');
            let bookTicketClicked = await tapByText('Book Ticket', 5000) ||
                                    await tapByText('Reserved Booking', 2000) ||
                                    await tapByText('Trains', 2000) ||
                                    await tapById(`${appPackage}:id/ll_book_ticket`, 2000) ||
                                    await tapById(`${appPackage}:id/book_ticket`, 2000);
            
            if (!bookTicketClicked) {
                mLog('Could not find Reserved Ticket option. Attempting coordinate tap...', 'warning');
                try {
                    const size = await driver.getWindowSize();
                    // Tap roughly where the Train/Book Ticket icon sits on typical layouts (center-left)
                    await driver.action('pointer')
                        .move({ duration: 0, x: Math.floor(size.width * 0.25), y: Math.floor(size.height * 0.25) })
                        .down({ button: 0 })
                        .pause(100)
                        .up({ button: 0 })
                        .perform();
                    await humanDelay(1500, 2000);
                } catch (_) {}
            } else {
                mLog('Reserved Ticket Booking triggered ✓', 'success');
                await humanDelay(1000, 1500);
            }

            // ─── STEP 4: Fill Search Form (RailOne) ───
            mobileStep = 4;
            mLog(`Filling journey details: ${from} → ${to}`, 'info');

            // From Station
            let fromClicked = await tapByText('From Station', 5000) ||
                               await tapByText('From', 2000) ||
                               await tapByText('Source', 2000) ||
                               await tapById(`${appPackage}:id/et_from_station`, 2000) ||
                               await tapById(`${appPackage}:id/from_station`, 2000);
            
            if (fromClicked) {
                await humanDelay(500, 1000);
                try {
                    const searchInputs = await driver.$$('android.widget.EditText');
                    if (searchInputs.length > 0) {
                        await searchInputs[0].setValue(from);
                        await humanDelay(1500, 2000);
                        const suggestion = await driver.$(`android=new UiSelector().textContains("${from}")`);
                        await suggestion.click();
                        mLog(`From Station set to: ${from} ✓`, 'success');
                    }
                } catch (e) {}
            }

            await humanDelay();

            // To Station
            let toClicked = await tapByText('To Station', 5000) ||
                             await tapByText('To', 2000) ||
                             await tapByText('Destination', 2000) ||
                             await tapById(`${appPackage}:id/et_to_station`, 2000) ||
                             await tapById(`${appPackage}:id/to_station`, 2000);
            
            if (toClicked) {
                await humanDelay(500, 1000);
                try {
                    const searchInputs = await driver.$$('android.widget.EditText');
                    if (searchInputs.length > 0) {
                        await searchInputs[0].setValue(to);
                        await humanDelay(1500, 2000);
                        const suggestion = await driver.$(`android=new UiSelector().textContains("${to}")`);
                        await suggestion.click();
                        mLog(`To Station set to: ${to} ✓`, 'success');
                    }
                } catch (e) {}
            }

            await humanDelay();

            // Date selection
            mLog(`Setting journey date: ${date}`, 'info');
            let dateClicked = await tapByText('Date', 5000) ||
                               await tapByText('Journey Date', 2000) ||
                               await tapById(`${appPackage}:id/tv_date`, 2000) ||
                               await tapById(`${appPackage}:id/journey_date`, 2000);
            if (dateClicked) {
                await humanDelay(500, 1000);
                const parts = date.split('-');
                const day = parseInt(parts[2], 10);
                await tapByText(String(day), 5000);
                await humanDelay();
                await tapByText('OK', 3000) || await tapByText('Done', 3000);
                mLog(`Date set to: ${date} ✓`, 'success');
            }

            await humanDelay();

            // Quota selection (if not General)
            if (quota && quota !== 'GN') {
                mLog(`Selecting quota: ${quota}`, 'info');
                await tapByText('General', 2000) || await tapByText('GENERAL', 1000) || await tapByText('Quota', 1000);
                await humanDelay(500, 1000);
                const quotaName = quota === 'TQ' ? 'Tatkal' : quota === 'PT' ? 'Premium Tatkal' : 'General';
                await tapByText(quotaName, 3000) || await tapByText(quotaName.toUpperCase(), 2000);
                await humanDelay();
            }

            // Click Search button
            mLog('Clicking SEARCH TRAINS...', 'warning');
            await tapByText('Search', 5000) ||
                  await tapByText('SEARCH', 2000) ||
                  await tapByText('Search Trains', 2000) ||
                  await tapById(`${appPackage}:id/btn_search`, 2000) ||
                  await tapById(`${appPackage}:id/search_trains`, 2000);
            
            mLog('Search triggered, waiting for train results...', 'info');
            await new Promise(r => setTimeout(r, 8000));

            // ─── STEP 5: Select Train (RailOne) ───
            mobileStep = 5;
            mLog(`Locating train ${trainNum}...`, 'info');
            let trainFound = await scrollToText(trainNum);
            if (trainFound) {
                await tapByText(trainNum, 5000);
                mLog(`Train ${trainNum} selected ✓`, 'success');
            } else {
                mLog(`Train ${trainNum} not found automatically. Please select it manually if needed.`, 'warning');
            }

            await humanDelay(1000, 1500);

            // Select class
            const classLabels = { 'SL': 'SL', '3A': '3A', '2A': '2A', '1A': '1A', 'CC': 'CC' };
            await tapByText(classLabels[className] || className, 5000) || await tapByText(className, 2000);
            await humanDelay(1000, 1500);

            // Book Now
            mLog('Clicking Book Now...', 'warning');
            await tapByText('Book Now', 5000) || 
                  await tapByText('BOOK NOW', 3000) || 
                  await tapByText('Passenger Details', 3000);
            
            await humanDelay(2000, 3000);

            // Popups
            await tapByText('Yes', 2000);
            await tapByText('I Agree', 2000);
            await tapByText('OK', 2000);

            // ─── STEP 6: Passenger Details (RailOne) ───
            mobileStep = 6;
            mLog('Filling passenger information...', 'info');
            if (passengers && passengers.length > 0) {
                for (let i = 0; i < passengers.length; i++) {
                    const pax = passengers[i];
                    if (i > 0) {
                        await tapByText('Add Passenger', 3000) || await tapByText('+ Add', 3000) || await tapByText('Add New', 2000);
                        await humanDelay();
                    }

                    try {
                        const xml = getUiDump();
                        const inputs = parseAllBounds(xml, 'class', 'android.widget.EditText');
                        const nameIdx = i * 2;
                        if (inputs[nameIdx]) {
                            const coords = inputs[nameIdx];
                            runAdb(`shell input tap ${coords.x} ${coords.y}`);
                            await humanDelay(300, 500);
                            runAdb('shell input keyevent 123'); // KEYCODE_MOVE_END
                            for (let k = 0; k < 30; k++) runAdb('shell input keyevent 67');
                            const escapedVal = pax.name.replace(/ /g, '%s');
                            runAdb(`shell input text "${escapedVal}"`);
                            mLog(`Passenger ${i + 1} name: ${pax.name} ✓`, 'success');
                        }
                    } catch (e) {}

                    await humanDelay();

                    try {
                        const xml = getUiDump();
                        const inputs = parseAllBounds(xml, 'class', 'android.widget.EditText');
                        const ageIdx = i * 2 + 1;
                        if (inputs[ageIdx]) {
                            const coords = inputs[ageIdx];
                            runAdb(`shell input tap ${coords.x} ${coords.y}`);
                            await humanDelay(300, 500);
                            runAdb('shell input keyevent 123'); // KEYCODE_MOVE_END
                            for (let k = 0; k < 10; k++) runAdb('shell input keyevent 67');
                            runAdb(`shell input text "${pax.age}"`);
                            mLog(`Passenger ${i + 1} age: ${pax.age} ✓`, 'success');
                        }
                    } catch (e) {}

                    await humanDelay();
                    const genderText = pax.gender === 'M' ? 'Male' : pax.gender === 'F' ? 'Female' : 'Transgender';
                    await tapByText(genderText, 3000);
                    await humanDelay();
                }
            }

            // ─── STOP POINT ───
            mobileStep = 7;
            mLog('🎉 MOBILE BOT COMPLETE — Manual takeover', 'success');
            mobileDone = true;

        } else {
            // ─── STEP 2: Login ───
            mobileStep = 2;
            mLog('Searching for Login button (TURBO MODE)...', 'info');

            let loginClicked = false;
            for (let i = 0; i < 20; i++) {
                loginClicked = await tapByText('Login', 500) || 
                               await tapByText('LOGIN', 200) ||
                               await tapById(`${appPackage}:id/tv_login`, 200);
                if (loginClicked) break;
                await new Promise(r => setTimeout(r, 200));
            }

            if (loginClicked) {
                mLog('Login button clicked! ✓', 'success');
                mLog('✋ WAITING FOR FINGERPRINT — Please touch your sensor now', 'warning');
                
                const loginSuccess = await waitForText('Train', 120000) ||
                                      await waitForText('Book Ticket', 5000);

                if (loginSuccess) {
                    mLog('LOGIN SUCCESSFUL! ✓', 'success');
                    
                    // ─── STEP 3: Navigate to Train (DEEP SEARCH) ───
                    mobileStep = 3;
                    mLog('Deep searching for Train icon...', 'info');

                    let trainClicked = false;
                    for (let i = 0; i < 20; i++) {
                        // 1. Dismiss popups
                        await tapByText('OK', 300) || await tapByText('DISMISS', 300);

                        // 2. Try all possible selectors
                        trainClicked = await tapByText('Train', 500) || 
                                       await tapByDesc('Train', 300) ||
                                       await tapByText('TRAIN', 300) ||
                                       await tapByDesc('TRAIN', 300) ||
                                       await tapById(`${appPackage}:id/ll_train_icon`, 300) ||
                                       await tapById(`${appPackage}:id/tv_train`, 300);
                        
                        if (trainClicked) break;

                        // 3. Last Resort: Click by relative coordinates (Top-Left area)
                        if (i > 10) {
                            mLog('Trying coordinate tap...', 'warning');
                            try {
                                const size = await driver.getWindowSize();
                                // Tap roughly where "Train" icon is (approx 15% width, 15% height)
                                await driver.action('pointer')
                                    .move({ duration: 0, x: Math.floor(size.width * 0.15), y: Math.floor(size.height * 0.15) })
                                    .down({ button: 0 })
                                    .pause(100)
                                    .up({ button: 0 })
                                    .perform();
                                trainClicked = true; // Assume success if we tapped
                            } catch (_) {}
                        }
                        
                        if (trainClicked) break;
                        await new Promise(r => setTimeout(r, 400));
                    }

                    if (trainClicked) {
                        mLog('Train icon triggered ✓', 'success');
                        await humanDelay(1000, 2000);
                        
                        mLog('Navigating to Book Ticket...', 'info');
                        await tapByText('Book Ticket', 5000) || 
                        await tapByDesc('Book Ticket', 2000) ||
                        await tapByText('BOOK TICKET', 2000) ||
                        await tapById(`${appPackage}:id/ll_book_ticket`, 2000);
                    } else {
                        mLog('Could not find Train icon even with Deep Search.', 'error');
                    }
                } else {
                    mLog('Timed out waiting for login.', 'error');
                }
            } else {
                mLog('Login button not found.', 'error');
            }

            await humanDelay(1000, 1500);

            // ─── STEP 4: Fill Search Form ───
            mobileStep = 4;
            mLog(`Filling search: ${from} → ${to}`, 'info');

            // From Station
            let fromClicked = await tapByText('From Station', 5000) ||
                               await tapById(`${appPackage}:id/et_from_station`, 3000);

            if (fromClicked) {
                await humanDelay(500, 1000);
                try {
                    const xml = getUiDump();
                    const inputs = parseAllBounds(xml, 'class', 'android.widget.EditText');
                    if (inputs.length > 0) {
                        const coords = inputs[0];
                        runAdb(`shell input tap ${coords.x} ${coords.y}`);
                        await humanDelay(300, 500);
                        const escapedVal = from.replace(/ /g, '%s');
                        runAdb(`shell input text "${escapedVal}"`);
                        await humanDelay(1500, 2000);
                        await tapByText(from, 5000);
                        mLog(`From station: ${from} ✓`, 'success');
                    }
                } catch (e) {}
            }

            await humanDelay();

            // To Station
            let toClicked = await tapByText('To Station', 5000) ||
                             await tapById(`${appPackage}:id/et_to_station`, 3000);

            if (toClicked) {
                await humanDelay(500, 1000);
                try {
                    const xml = getUiDump();
                    const inputs = parseAllBounds(xml, 'class', 'android.widget.EditText');
                    if (inputs.length > 0) {
                        const coords = inputs[0];
                        runAdb(`shell input tap ${coords.x} ${coords.y}`);
                        await humanDelay(300, 500);
                        const escapedVal = to.replace(/ /g, '%s');
                        runAdb(`shell input text "${escapedVal}"`);
                        await humanDelay(1500, 2000);
                        await tapByText(to, 5000);
                        mLog(`To station: ${to} ✓`, 'success');
                    }
                } catch (e) {}
            }

            await humanDelay();

            // Date
            mLog(`Setting date: ${date}`, 'info');
            let dateClicked = await tapByText('Date', 5000) ||
                               await tapById(`${appPackage}:id/tv_date`, 3000);
            if (dateClicked) {
                await humanDelay(500, 1000);
                const parts = date.split('-');
                const day = parseInt(parts[2], 10);
                await tapByText(String(day), 5000);
                await humanDelay();
                await tapByText('OK', 3000) || await tapByText('Done', 3000);
                mLog(`Date set ✓`, 'success');
            }

            await humanDelay();

            // Search
            mLog('Clicking SEARCH...', 'warning');
            await tapByText('Search', 5000) ||
                await tapByText('SEARCH', 3000) ||
                await tapById(`${appPackage}:id/btn_search`, 3000);

            mLog('Search triggered, waiting for results...', 'info');
            await new Promise(r => setTimeout(r, 8000));

            // ─── STEP 5: Select Train ───
            mobileStep = 5;
            mLog(`Looking for train ${trainNum}...`, 'info');

            let trainFound = await scrollToText(trainNum);
            if (trainFound) {
                await tapByText(trainNum, 5000);
                mLog(`Train ${trainNum} selected ✓`, 'success');
            }

            await humanDelay(1000, 2000);

            // Select class availability
            const classLabels = { 'SL': 'SL', '3A': '3A', '2A': '2A', '1A': '1A', 'CC': 'CC' };
            await tapByText(classLabels[className] || className, 5000);
            await humanDelay(1000, 1500);

            // Book Now
            mLog('Clicking Book Now...', 'warning');
            await tapByText('Book Now', 5000) || await tapByText('BOOK NOW', 3000);

            await humanDelay(2000, 3000);

            // Handle popups
            await tapByText('Yes', 2000);
            await tapByText('I Agree', 2000);
            await tapByText('OK', 2000);

            // ─── STEP 6: Fill Passengers ───
            mobileStep = 6;
            mLog('Filling passenger details...', 'info');

            if (passengers && passengers.length > 0) {
                for (let i = 0; i < passengers.length; i++) {
                    const pax = passengers[i];
                    if (i > 0) {
                        await tapByText('Add Passenger', 3000) || await tapByText('+ Add', 3000);
                        await humanDelay();
                    }

                    try {
                        const xml = getUiDump();
                        const inputs = parseAllBounds(xml, 'class', 'android.widget.EditText');
                        const nameIdx = i * 2; 
                        if (inputs[nameIdx]) {
                            const coords = inputs[nameIdx];
                            runAdb(`shell input tap ${coords.x} ${coords.y}`);
                            await humanDelay(300, 500);
                            runAdb('shell input keyevent 123'); // KEYCODE_MOVE_END
                            for (let k = 0; k < 30; k++) runAdb('shell input keyevent 67');
                            const escapedVal = pax.name.replace(/ /g, '%s');
                            runAdb(`shell input text "${escapedVal}"`);
                            mLog(`Passenger ${i + 1} name: ${pax.name} ✓`, 'success');
                        }
                    } catch (e) {}

                    await humanDelay();

                    try {
                        const xml = getUiDump();
                        const inputs = parseAllBounds(xml, 'class', 'android.widget.EditText');
                        const ageIdx = i * 2 + 1;
                        if (inputs[ageIdx]) {
                            const coords = inputs[ageIdx];
                            runAdb(`shell input tap ${coords.x} ${coords.y}`);
                            await humanDelay(300, 500);
                            runAdb('shell input keyevent 123'); // KEYCODE_MOVE_END
                            for (let k = 0; k < 10; k++) runAdb('shell input keyevent 67');
                            runAdb(`shell input text "${pax.age}"`);
                            mLog(`Passenger ${i + 1} age: ${pax.age} ✓`, 'success');
                        }
                    } catch (e) {}

                    await humanDelay();
                    const genderText = pax.gender === 'M' ? 'Male' : pax.gender === 'F' ? 'Female' : 'Transgender';
                    await tapByText(genderText, 3000);
                    await humanDelay();
                }
            }

            // ─── STOP POINT ───
            mobileStep = 7;
            mLog('🎉 MOBILE BOT COMPLETE — Manual takeover', 'success');
            mobileDone = true;
        }

    } catch (err) {
        mLog(`Fatal error: ${err.message}`, 'error');
        mobileDone = true;
    }
}

export async function stopMobileBot() {
    isBotRunning = false;
    currentUdid = '';
    mLog('Mobile bot stopped', 'info');
}

export async function inspectScreen() {
    if (!currentUdid) return { error: 'No active session' };
    try {
        const source = getUiDump();
        return { source };
    } catch (e) {
        return { error: e.message };
    }
}

export function getMobileScreenshot() { return mobileScreenshot; }
export function getMobileLogs() {
    const logs = [...mobileLogs];
    mobileLogs = [];
    return logs;
}
export function getMobileStep() { return mobileStep; }
export function isMobileDone() { return mobileDone; }
export function getMobileDriver() { return null; }
