// ─── Swift Seat Content Script (WebView Version) ───

(async function () {
    // Check if automation is active
    const state = await getStorage(['extension_active', 'bookingConfig']);
    if (!state.extension_active || !state.bookingConfig) return;

    const cfg = state.bookingConfig;
    createOverlay();
    log('⚡ Swift Seat mobile automation engine active!', 'success');

    // Run the correct service logic based on host
    const host = window.location.hostname;
    if (host.includes('irctc.co.in')) {
        runIrctcAutomation(cfg);
    } else if (host.includes('aranyavihaara.karnataka.gov.in')) {
        runTrekAutomation(cfg);
    }
})();

// ─── Storage Helpers (Android Bridge Aware) ───
function getStorage(keys) {
    if (typeof AndroidInterface !== 'undefined') {
        const configJson = AndroidInterface.getBookingConfig();
        const active = AndroidInterface.isExtensionActive();
        return {
            extension_active: active,
            bookingConfig: configJson ? JSON.parse(configJson) : null
        };
    } else {
        return new Promise(resolve => {
            chrome.storage.local.get(keys, resolve);
        });
    }
}

function setStorage(data) {
    if (typeof AndroidInterface !== 'undefined') {
        if ('extension_active' in data) {
            AndroidInterface.setExtensionActive(data.extension_active);
        }
    } else {
        return new Promise(resolve => {
            chrome.storage.local.set(data, resolve);
        });
    }
}

// ─── Floating Overlay UI ───
let overlayConsole;
function createOverlay() {
    const container = document.createElement('div');
    container.id = 'tf-mobile-overlay';
    container.style.cssText = `
        position: fixed;
        bottom: 16px;
        right: 16px;
        left: 16px;
        background: #14161f;
        border: 2px solid #ff5e62;
        border-radius: 12px;
        color: #ffffff;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
        font-size: 13px;
        padding: 12px;
        z-index: 2147483647;
        box-shadow: 0 8px 32px rgba(0, 0, 0, 0.6);
        box-sizing: border-box;
        display: flex;
        flex-direction: column;
        gap: 8px;
    `;

    container.innerHTML = `
        <div style="display:flex; justify-content:space-between; align-items:center;">
            <div style="display:flex; align-items:center; gap:6px; font-weight:bold;">
                <span style="display:inline-block; width:10px; height:10px; background:#ff5e62; border-radius:50%; animation: pulse 1.5s infinite;"></span>
                <span>SWIFT SEAT BOT</span>
            </div>
            <button id="tf-overlay-stop" style="background:#ff4757; color:white; border:none; border-radius:4px; padding:3px 8px; font-size:11px; font-weight:bold; cursor:pointer;">ABORT</button>
        </div>
        <div id="tf-overlay-console" style="max-height:80px; overflow-y:auto; font-family:monospace; font-size:11px; background:#0d0e12; border-radius:6px; padding:6px; color:#cfd9e8; border:1px solid #222533;"></div>
    `;

    const style = document.createElement('style');
    style.textContent = `
        @keyframes pulse {
            0% { transform: scale(0.9); opacity: 0.6; }
            50% { transform: scale(1.1); opacity: 1; }
            100% { transform: scale(0.9); opacity: 0.6; }
        }
    `;
    document.head.appendChild(style);
    document.body.appendChild(container);

    overlayConsole = document.getElementById('tf-overlay-console');
    document.getElementById('tf-overlay-stop').addEventListener('click', () => {
        setStorage({ extension_active: false });
        log('■ Automation aborted by user.', 'error');
        setTimeout(() => container.remove(), 1500);
    });
}

function log(msg, type = 'info') {
    const entry = document.createElement('div');
    entry.style.marginBottom = '4px';
    let color = '#cfd9e8';
    if (type === 'success') color = '#00f2fe';
    if (type === 'warning') color = '#f1c40f';
    if (type === 'error') color = '#ff4757';
    entry.style.color = color;
    entry.textContent = `[${new Date().toLocaleTimeString()}] ${msg}`;
    
    if (overlayConsole) {
        overlayConsole.appendChild(entry);
        overlayConsole.scrollTop = overlayConsole.scrollHeight;
    }
    console.log(`[SWIFTSEAT] ${msg}`);
}

// ─── General UI Automation Helpers ───
function wait(ms) {
    return new Promise(r => setTimeout(r, ms));
}

async function waitForElement(selector, timeout = 15000) {
    const start = Date.now();
    while (Date.now() - start < timeout) {
        const el = document.querySelector(selector);
        if (el && el.offsetWidth > 0 && el.offsetHeight > 0) return el;
        await wait(500);
    }
    return null;
}

// ─── IRCTC Ticket Booking Automation ───
async function runIrctcAutomation(cfg) {
    const path = window.location.href;

    // A. Fill Login credentials if form matches
    const userField = document.querySelector('input[formcontrolname="userName"], #userId, input[placeholder*="User Name"]');
    if (userField && cfg.username) {
        log('Injecting IRCTC credentials...', 'info');
        userField.value = cfg.username;
        userField.dispatchEvent(new Event('input', { bubbles: true }));

        const passField = document.querySelector('input[formcontrolname="password"], #pwd, input[placeholder*="Password"]');
        if (passField && cfg.password) {
            passField.value = cfg.password;
            passField.dispatchEvent(new Event('input', { bubbles: true }));
        }

        const captchaField = document.querySelector('input[id="captcha"], input[formcontrolname="captcha"], input[placeholder*="Captcha"], #nlpAnswer');
        if (captchaField) {
            captchaField.focus();
            log('✋ PAUSED — Please enter the Captcha and sign in!', 'warning');
        }
        return;
    }

    // B. Search Page Form Autofill
    if (path.includes('train-search')) {
        const originInput = await waitForElement('#origin input[role="searchbox"]', 5000);
        if (originInput) {
            log('Filling journey Search form details...', 'info');
            
            originInput.click();
            originInput.value = cfg.from;
            originInput.dispatchEvent(new Event('input', { bubbles: true }));
            await wait(1000);
            const fromSug = document.querySelector('li.ui-autocomplete-list-item');
            if (fromSug) fromSug.click();

            const destInput = document.querySelector('#destination input[role="searchbox"]');
            if (destInput) {
                destInput.click();
                destInput.value = cfg.to;
                destInput.dispatchEvent(new Event('input', { bubbles: true }));
                await wait(1000);
                const toSug = document.querySelector('li.ui-autocomplete-list-item');
                if (toSug) toSug.click();
            }

            const dateInput = document.querySelector('#jDate input');
            if (dateInput && cfg.date) {
                const parts = cfg.date.split('-');
                const formattedDate = `${parts[2]}/${parts[1]}/${parts[0]}`; // DD/MM/YYYY
                dateInput.value = formattedDate;
                dateInput.dispatchEvent(new Event('input', { bubbles: true }));
            }

            const classDropdown = document.querySelector('#journeyClass .ui-dropdown-trigger');
            if (classDropdown && cfg.className) {
                classDropdown.click();
                await wait(500);
                const matchClass = Array.from(document.querySelectorAll('li')).find(li => li.innerText.includes(cfg.className));
                if (matchClass) matchClass.click();
            }

            const quotaDropdown = document.querySelector('#journeyQuota .ui-dropdown-trigger');
            if (quotaDropdown && cfg.quota) {
                quotaDropdown.click();
                await wait(500);
                const quotaMap = { 'TQ': 'TATKAL', 'GN': 'GENERAL', 'PT': 'PREMIUM TATKAL' };
                const matchQuota = Array.from(document.querySelectorAll('li')).find(li => li.innerText.includes(quotaMap[cfg.quota] || 'GENERAL'));
                if (matchQuota) matchQuota.click();
            }

            log('Clicking SEARCH TRAINS...', 'warning');
            const searchBtn = document.querySelector('button.search_btn.train_Search');
            if (searchBtn) searchBtn.click();
            return;
        }

        // C. Train & Availability Selection
        const trainHeading = document.body.innerText.includes(cfg.trainNum);
        if (trainHeading) {
            log(`Locating train ${cfg.trainNum}...`, 'info');
            const trainRow = Array.from(document.querySelectorAll('.train-item, .bull-back')).find(el => el.innerText.includes(cfg.trainNum));
            if (trainRow) {
                log(`Train box found! Selecting class box...`, 'info');
                const classText = cfg.className === 'SL' ? 'Sleeper (SL)' : cfg.className;
                const classBox = Array.from(trainRow.querySelectorAll('div, td')).find(el => el.textContent.trim() === classText);
                if (classBox) {
                    classBox.click();
                    await wait(2000);

                    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
                    const parts = cfg.date.split('-');
                    const dDay = parseInt(parts[2], 10);
                    const dMonth = months[parseInt(parts[1], 10) - 1];
                    const shortDate = `${dDay < 10 ? '0' + dDay : dDay} ${dMonth}`;

                    log(`Finding availability for ${shortDate}...`, 'info');
                    const availabilityBox = Array.from(trainRow.querySelectorAll('table td')).find(el => el.innerText.includes(shortDate));
                    if (availabilityBox) {
                        availabilityBox.click();
                        await wait(1000);

                        const bookBtn = Array.from(trainRow.querySelectorAll('button')).find(btn => btn.innerText.toUpperCase().includes('BOOK NOW'));
                        if (bookBtn) {
                            log('Clicking BOOK NOW...', 'warning');
                            bookBtn.click();

                            await wait(1500);
                            const popups = Array.from(document.querySelectorAll('span, button, a')).filter(el => 
                                ['I AGREE', 'YES', 'OK', 'PROCEED'].includes(el.textContent.trim().toUpperCase())
                            );
                            popups.forEach(p => p.click());
                        }
                    }
                }
            }
            return;
        }

        // D. Passenger Details Form Page
        const paxInput = document.querySelector('input[placeholder*="Name"], #psgn-name');
        if (paxInput && cfg.passengers && cfg.passengers.length > 0) {
            log('Autofilling passenger profiles...', 'info');
            for (let i = 0; i < cfg.passengers.length; i++) {
                const p = cfg.passengers[i];
                if (i > 0) {
                    const addBtn = Array.from(document.querySelectorAll('a, span')).find(el => el.textContent.includes('Add Passenger'));
                    if (addBtn) {
                        addBtn.click();
                        await wait(500);
                    }
                }

                const names = document.querySelectorAll('input[placeholder*="Name"], #psgn-name');
                const ages = document.querySelectorAll('input[placeholder*="Age"], #psgn-age');
                const genders = document.querySelectorAll('select[formcontrolname*="gender"], select[formcontrolname="passengerGender"]');

                if (names[i]) {
                    names[i].value = p.name;
                    names[i].dispatchEvent(new Event('input', { bubbles: true }));
                }
                if (ages[i]) {
                    ages[i].value = String(p.age);
                    ages[i].dispatchEvent(new Event('input', { bubbles: true }));
                }
                if (genders[i]) {
                    genders[i].value = p.gender === 'M' ? 'M' : 'F';
                    genders[i].dispatchEvent(new Event('change', { bubbles: true }));
                }
            }

            const upiRadio = Array.from(document.querySelectorAll('p-radiobutton, label')).find(el => el.textContent.includes('BHIM/UPI'));
            if (upiRadio) {
                upiRadio.click();
                log('UPI payment method selected ✓', 'success');
            }

            log('🎉 Passenger details pre-filled successfully!', 'success');
            log('✋ STOPPING AUTOMATION — Proceed manually to input payment Captcha.', 'warning');
            
            setStorage({ extension_active: false });
        }
    }
}

// ─── Aranya Vihara Permit booking Automation ───
async function runTrekAutomation(cfg) {
    const path = window.location.href;

    const emailField = document.querySelector('input#email, input[name="email"], input[type="email"]');
    if (emailField && cfg.username) {
        log('Injecting credentials...', 'info');
        emailField.value = cfg.username;
        emailField.dispatchEvent(new Event('input', { bubbles: true }));

        const passField = document.querySelector('input#password, input[name="password"], input[type="password"]');
        if (passField && cfg.password) {
            passField.value = cfg.password;
            passField.dispatchEvent(new Event('input', { bubbles: true }));
        }

        const captchaField = document.querySelector('input[placeholder*="Captcha"], input[name="captcha"]');
        if (captchaField) {
            captchaField.focus();
            log('✋ PAUSED — Please enter the Captcha and click login!', 'warning');
        }
        return;
    }

    if (path.includes('/gettimeslot')) {
        const nameInp = document.querySelector('input[name="data[0][name]"], input[id="name"]');
        if (nameInp && cfg.passengers && cfg.passengers.length > 0) {
            log('Autofilling visitor profiles...', 'info');

            for (let i = 0; i < cfg.passengers.length; i++) {
                const visitor = cfg.passengers[i];
                if (i > 0) {
                    const addBtn = Array.from(document.querySelectorAll('button, a, span')).find(el => 
                        el.textContent.includes('+ Add') || el.textContent.includes('Add Visitors')
                    );
                    if (addBtn) {
                        addBtn.click();
                        await wait(1000);
                    }
                }

                const nameFields = document.querySelectorAll('input[name*="[name]"], input[id="name"]');
                const ageFields = document.querySelectorAll('input[name*="[age]"], input[id="age"]');
                const genderFields = document.querySelectorAll('select[name*="[gender]"], select[id="gender"]');

                if (nameFields[i]) {
                    nameFields[i].value = visitor.name;
                    nameFields[i].dispatchEvent(new Event('input', { bubbles: true }));
                }
                if (ageFields[i]) {
                    ageFields[i].value = String(visitor.age);
                    ageFields[i].dispatchEvent(new Event('input', { bubbles: true }));
                }
                if (genderFields[i]) {
                    const select = genderFields[i];
                    select.value = visitor.gender === 'M' ? 'MALE' : 'FEMALE';
                    select.dispatchEvent(new Event('change', { bubbles: true }));
                }
            }

            const mobileInp = document.querySelector('input[name="data[0][mobile_no]"], input[id="mobile_no"]');
            if (mobileInp && cfg.mobile) {
                mobileInp.value = cfg.mobile;
                mobileInp.dispatchEvent(new Event('input', { bubbles: true }));
            }

            const tnc = document.querySelector('input[id="defaultCheck1"], input[type="checkbox"]');
            if (tnc) tnc.click();

            log('🎉 Visitor forms filled successfully!', 'success');
            log('✋ STOPPING AUTOMATION — Proceed manually to request OTP.', 'warning');
            
            setStorage({ extension_active: false });
        }
    }
}
