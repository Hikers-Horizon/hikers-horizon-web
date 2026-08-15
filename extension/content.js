// ─── Tatkal Flash Content Script ───

(async function () {
    if (window.tfBotRunningInitialized) {
        console.log('[SWIFTSEAT] Script already running on this tab.');
        return;
    }
    window.tfBotRunningInitialized = true;

    // Check if automation is active
    const state = await getStorage(['extension_active', 'bookingConfig', 'licenseStatus', 'deviceId']);
    if (!state.extension_active || !state.bookingConfig) return;

    // ─── Enforce License Check ───
    let subscriptionActive = false;
    if (state.licenseStatus && state.licenseStatus.active) {
        try {
            const response = await fetch('https://swiftseat.shop/api/validate-license', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    licenseKey: state.licenseStatus.key,
                    deviceId: state.deviceId
                })
            });
            const verification = await response.json();
            subscriptionActive = !!verification.valid;
        } catch (err) {
            // Fallback to locally cached expiry if offline or server can't be reached
            subscriptionActive = new Date(state.licenseStatus.expiresAt) > new Date();
        }
    }

    if (!subscriptionActive) {
        alert('🛑 Swift Seat: Subscription Required!\nPlease activate your subscription key in the extension dashboard to start booking. Price: ₹99/month.');
        await setStorage({ extension_active: false });
        return;
    }

    const cfg = state.bookingConfig;
    log('⚡ Swift Seat mobile automation engine active!', 'success');

    // Run the correct service logic based on host
    const host = window.location.hostname;
    if (host.includes('irctc.co.in')) {
        // Run continuously to handle dynamic Single Page App (SPA) pages and dialog overlays
        let inProgress = false;
        const intervalId = setInterval(async () => {
            const activeState = await getStorage(['extension_active']);
            if (!activeState.extension_active) {
                clearInterval(intervalId);
                return;
            }
            if (inProgress) return;
            inProgress = true;
            try {
                await runIrctcAutomation(cfg);
            } catch (err) {
                console.error('Automation step execution error:', err);
            } finally {
                inProgress = false;
            }
        }, 1500);
    }
})();

// ─── Storage Helpers ───
function getStorage(keys) {
    return new Promise(resolve => {
        if (!chrome.runtime || !chrome.runtime.id) {
            resolve({});
            return;
        }
        try {
            chrome.storage.local.get(keys, (res) => {
                if (chrome.runtime && chrome.runtime.lastError) {
                    resolve({});
                } else {
                    resolve(res || {});
                }
            });
        } catch (e) {
            resolve({});
        }
    });
}

function setStorage(data) {
    return new Promise(resolve => {
        if (!chrome.runtime || !chrome.runtime.id) {
            resolve();
            return;
        }
        try {
            chrome.storage.local.set(data, () => {
                if (chrome.runtime && chrome.runtime.lastError) {
                    // ignore
                }
                resolve();
            });
        } catch (e) {
            resolve();
        }
    });
}

// ─── Floating Overlay UI ───
let overlayConsole;
let dismissInterval = null;
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

    // Inject CSS pulse animation
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
        if (dismissInterval) clearInterval(dismissInterval);
        log('■ Automation aborted by user.', 'error');
        setTimeout(() => container.remove(), 1500);
    });
}

function log(msg, type = 'info') {
    console.log(`[SWIFTSEAT] ${msg}`);
    // Sync with the Swift Seat running backend
    fetch('https://hikershorizon.in/api/log', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ msg: `[Extension] ${msg}`, type })
    }).catch(err => {
        console.debug('Failed to sync log to local server (server may be offline):', err);
    });
}

// ─── General UI Automation Helpers ───

// Global click guard — prevents ANY two clicks within 1.5 seconds
let lastGlobalClickTime = 0;
const CLICK_COOLDOWN_MS = 1500;

// State machine to track automation progress
const tfState = {
    trainScrolled: false,
    passengersInjected: false,
    lastUrl: '',
    reset() {
        this.trainScrolled = false;
        this.passengersInjected = false;
    }
};

function tfClick(el) {
    if (!el) return false;
    
    // Enforce global click cooldown to prevent double-click detection
    const now = Date.now();
    if (now - lastGlobalClickTime < CLICK_COOLDOWN_MS) {
        console.log('[SWIFTSEAT] Click blocked by cooldown guard (' + (CLICK_COOLDOWN_MS - (now - lastGlobalClickTime)) + 'ms remaining)');
        return false;
    }
    lastGlobalClickTime = now;
    
    // Single clean native click only — NO synthetic event storm
    try { el.scrollIntoView({ behavior: 'instant', block: 'nearest' }); } catch(e){}
    try { el.focus(); } catch(e){}
    try { el.click(); } catch(e){}
    return true;
}

function isVisible(el) {
    if (!el) return false;
    if (!(el.offsetWidth > 0 && el.offsetHeight > 0)) return false;
    try {
        const style = window.getComputedStyle(el);
        if (style.display === 'none') return false;
        if (style.visibility === 'hidden') return false;
        if (style.opacity === '0') return false;
    } catch(e){}
    const rect = el.getBoundingClientRect();
    if (rect.right < 0 || rect.bottom < 0) return false;
    if (rect.width === 0 || rect.height === 0) return false;
    return true;
}

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

async function triggerAutocomplete(inputEl, value) {
    inputEl.focus();
    inputEl.click();
    inputEl.value = '';
    
    // Simulate keyboard typing
    for (const char of value) {
        inputEl.value += char;
        inputEl.dispatchEvent(new KeyboardEvent('keydown', { key: char, bubbles: true }));
        inputEl.dispatchEvent(new KeyboardEvent('keypress', { key: char, bubbles: true }));
        inputEl.dispatchEvent(new Event('input', { bubbles: true }));
        inputEl.dispatchEvent(new KeyboardEvent('keyup', { key: char, bubbles: true }));
        await wait(100);
    }
    
    inputEl.dispatchEvent(new Event('change', { bubbles: true }));
    await wait(1200); // Wait for dropdown list to render
    
    // Filter active options in the suggestion panel (filtering separator rows like Journeys/Stations)
    const listItems = Array.from(document.querySelectorAll('li.ui-autocomplete-list-item, .ui-autocomplete-panel li'));
    const activeOptions = listItems.filter(li => 
        li.textContent && 
        !li.textContent.includes('Journeys') && 
        !li.textContent.includes('Stations') &&
        li.textContent.trim().length > 0
    );

    if (activeOptions.length > 0) {
        const targetOption = activeOptions[0];
        targetOption.focus && targetOption.focus();
        targetOption.click();
        
        // Also click any internal child tags to trigger bound listeners
        const childClickable = targetOption.querySelector('span, a');
        if (childClickable) {
            childClickable.click();
        }
        
        const selectedText = targetOption.innerText.split('\n')[0].trim();
        log(`Selected first option: ${selectedText} ✓`, 'success');
    } else {
        log(`⚠️ Warning: No active suggestion items found for station: ${value}`, 'warning');
    }
}

async function typeDateInput(inputEl, dateStr) {
    inputEl.focus();
    inputEl.select();
    inputEl.value = '';
    
    // Simulate keyboard typing
    for (const char of dateStr) {
        inputEl.value += char;
        inputEl.dispatchEvent(new KeyboardEvent('keydown', { key: char, bubbles: true }));
        inputEl.dispatchEvent(new KeyboardEvent('keypress', { key: char, bubbles: true }));
        inputEl.dispatchEvent(new Event('input', { bubbles: true }));
        inputEl.dispatchEvent(new KeyboardEvent('keyup', { key: char, bubbles: true }));
        await wait(50);
    }
    
    inputEl.dispatchEvent(new Event('change', { bubbles: true }));
    inputEl.dispatchEvent(new Event('blur', { bubbles: true }));
    
    // Send Escape or Enter key down to dismiss the calendar overlay pop panel
    inputEl.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', code: 'Escape', keyCode: 27, bubbles: true }));
    inputEl.dispatchEvent(new KeyboardEvent('keyup', { key: 'Escape', code: 'Escape', keyCode: 27, bubbles: true }));
}

// ─── IRCTC Ticket Booking Automation ───
async function runIrctcAutomation(cfg) {
    const path = window.location.href;
    
    // Reset state machine when page/URL changes (SPA navigation)
    if (path !== tfState.lastUrl) {
        tfState.reset();
        tfState.lastUrl = path;
        log(`📍 Page changed → ${path.split('/').pop()} (state reset)`, 'info');
    }
    
    // Check for train results - use the actual IRCTC page content, NOT our overlay
    const resultsExist = path.includes('booking/train-list') || path.includes('train-list') || 
        document.querySelector('app-train-list, .bull-back, .train-heading') !== null;
    
    // Debug only — don't spam server with every 1.5s poll cycle
    console.debug(`[SWIFTSEAT] URL: ${path.split('/').pop()} | Results: ${resultsExist} | State: avail=${tfState.availClicked} book=${tfState.bookNowClicked}`);

    // Start dynamic overlay dismisser in the background
    if (!dismissInterval) {
        dismissInterval = setInterval(() => {
            const dialogElements = Array.from(document.querySelectorAll('button, span, a, div, p-button, label, input[type="submit"]')).filter(el => {
                if (el.closest('#tf-mobile-overlay')) return false;
                
                // CRITICAL: Check if element is visible on the screen
                if (!isVisible(el)) return false;
                
                // Allow English language selection page/alerts
                const txt = (el.textContent || el.innerText || '').trim().toUpperCase();
                if (txt === 'ENGLISH') return true;
                
                // Otherwise only match actual dialog wrapper descendants to prevent clicking random buttons on search form
                return el.closest('.ui-dialog, .ui-confirmdialog, p-confirmdialog, p-dialog, .modal-content, .modal-dialog, app-covid-banner');
            });
            const englishBtn = dialogElements.find(el => {
                const txt = (el.textContent || el.innerText || '').trim().toUpperCase();
                return txt === 'ENGLISH';
            });

            if (englishBtn) {
                log('Language popup detected, clicking English...', 'info');
                tfClick(englishBtn);
            } else {
                const okBtn = dialogElements.find(el => {
                    const txt = (el.textContent || el.innerText || '').trim().toUpperCase();
                    return ['OK', 'DISMISS', 'PROCEED', 'I AGREE', 'YES', 'SUBMIT', 'CLOSE'].includes(txt);
                });
                if (okBtn) {
                    log('Alert dialog detected, clicking OK...', 'info');
                    tfClick(okBtn);
                }
            }
        }, 1000);
    }

    // Check if we need to click LOGIN button in the header first
    const userLoggedIn = Array.from(document.querySelectorAll('a, button, span')).some(el => 
        el.textContent && el.textContent.trim().toUpperCase().includes('LOGOUT')
    );
    
    if (!userLoggedIn) {
        const loginFormOpen = document.querySelector('input[formcontrolname="userName"], #userId, input[placeholder*="User Name"]');
        if (!loginFormOpen) {
            const loginBtn = Array.from(document.querySelectorAll('a, button, span, strong')).find(el => 
                el.textContent && ['LOGIN', 'SIGN IN', 'LOGIN / REGISTER'].includes(el.textContent.trim().toUpperCase())
            );
            if (loginBtn) {
                log('Header login button detected, opening login dialog...', 'info');
                loginBtn.click();
                await wait(1000);
                return;
            }
        }
    }

    // A. Fill Login credentials if form matches
    const userField = document.querySelector('input[formcontrolname="userName"], #userId, input[placeholder*="User Name"]');
    const passField = document.querySelector('input[formcontrolname="password"], #pwd, input[placeholder*="Password"]');
    if ((userField && cfg.username) || (passField && cfg.password)) {
        let usernameFilled = userField && userField.value && userField.value.trim().length > 0;
        let passwordFilled = passField && passField.value && passField.value.trim().length > 0;

        if (usernameFilled) {
            log('Username already filled (autofill/saved), skipping typing ✓', 'success');
        } else if (userField) {
            log('Injecting IRCTC username...', 'info');
            userField.value = cfg.username;
            userField.dispatchEvent(new Event('input', { bubbles: true }));
            userField.dispatchEvent(new Event('change', { bubbles: true }));
            userField.dispatchEvent(new Event('blur', { bubbles: true }));
        }

        if (passwordFilled) {
            log('Password already filled (autofill/saved), skipping typing ✓', 'success');
        } else if (passField) {
            log('Injecting IRCTC password...', 'info');
            passField.value = cfg.password;
            passField.dispatchEvent(new Event('input', { bubbles: true }));
            passField.dispatchEvent(new Event('change', { bubbles: true }));
            passField.dispatchEvent(new Event('blur', { bubbles: true }));
        }

        // Focus captcha
        const captchaField = document.querySelector('input[id="captcha"], input[formcontrolname="captcha"], input[placeholder*="Captcha"], #nlpAnswer');
        if (captchaField) {
            captchaField.focus();
            log('✋ PAUSED — Please enter the Captcha and sign in!', 'warning');
        }
        return;
    }

    // B. Search Page Form Autofill
    if (path.includes('train-search')) {
        if (!resultsExist) {
            const originInput = await waitForElement('#origin input[role="searchbox"]', 2000);
            if (originInput) {
            // Check if already filled to prevent duplicate typing loop
            const fromVal = originInput.value || '';
            const destInput = document.querySelector('#destination input[role="searchbox"]');
            const toVal = destInput ? (destInput.value || '') : '';
            
            const fromStateMatch = fromVal.toUpperCase().includes(cfg.from.toUpperCase());
            const toStateMatch = toVal.toUpperCase().includes(cfg.to.toUpperCase());

            if (!fromStateMatch || !toStateMatch) {
                log('Filling journey Search form details...', 'info');
                
                // From Station
                await triggerAutocomplete(originInput, cfg.from);
                await wait(500);

                // To Station
                if (destInput) {
                    await triggerAutocomplete(destInput, cfg.to);
                    await wait(500);
                }
            }

            // Date
            const dateInput = document.querySelector('#jDate input');
            if (dateInput && cfg.date) {
                const parts = cfg.date.split('-');
                const formattedDate = `${parts[2]}/${parts[1]}/${parts[0]}`; // DD/MM/YYYY
                if (dateInput.value !== formattedDate) {
                    log(`Typing journey date: ${formattedDate}...`, 'info');
                    await typeDateInput(dateInput, formattedDate);
                }
            }

            // Class selection
            const classDropdown = document.querySelector('#journeyClass .ui-dropdown-trigger');
            if (classDropdown && cfg.className) {
                const classLabel = document.querySelector('#journeyClass .ui-dropdown-label');
                const crntClass = classLabel ? classLabel.innerText : '';
                if (!crntClass.toUpperCase().includes(cfg.className.toUpperCase())) {
                    classDropdown.click();
                    await wait(500);
                    const matchClass = Array.from(document.querySelectorAll('li')).find(li => li.innerText.includes(cfg.className));
                    if (matchClass) matchClass.click();
                }
            }

            // Quota selection
            const quotaDropdown = document.querySelector('#journeyQuota .ui-dropdown-trigger');
            if (quotaDropdown && cfg.quota) {
                const quotaLabel = document.querySelector('#journeyQuota .ui-dropdown-label');
                const crntQuota = quotaLabel ? quotaLabel.innerText : '';
                const quotaMap = { 'TQ': 'TATKAL', 'GN': 'GENERAL', 'PT': 'PREMIUM TATKAL' };
                const targetQuotaText = quotaMap[cfg.quota] || 'GENERAL';
                if (!crntQuota.toUpperCase().includes(targetQuotaText.toUpperCase())) {
                    quotaDropdown.click();
                    await wait(500);
                    const matchQuota = Array.from(document.querySelectorAll('li')).find(li => li.innerText.includes(targetQuotaText));
                    if (matchQuota) matchQuota.click();
                }
            }

            log('Clicking SEARCH TRAINS...', 'warning');
            const searchBtn = document.querySelector('button.search_btn.train_Search, button.search_btn, button[type="submit"].train_Search, .train_Search');
            if (searchBtn) {
                searchBtn.click();
            } else {
                const submitBtn = Array.from(document.querySelectorAll('button')).find(btn => btn.innerText.toUpperCase().includes('SEARCH'));
                if (submitBtn) submitBtn.click();
            }
            return;
        }
    }
    }

    // C. Train List — Just scroll to the train, let user click Sleeper & Book Now manually
    if (resultsExist && !path.includes('psgninput')) {
        const trainNum = (cfg.trainNum || '').trim();
        if (!trainNum) return;
        
        // Only scroll once
        if (tfState.trainScrolled) return;
        
        const allElements = document.querySelectorAll('strong, span, b, a, td, div.train-heading, div.trainNameArrow, [class*="train-name"], [class*="trainName"]');
        for (const el of allElements) {
            if (el.closest('#tf-mobile-overlay')) continue;
            const txt = (el.textContent || '').trim();
            if (txt.includes(trainNum) && txt.length < 100 && el.children.length <= 3) {
                log(`✅ Found train ${trainNum} — scrolling into view`, 'success');
                el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                tfState.trainScrolled = true;
                log(`✋ Click Sleeper (SL) → select date → Book Now manually`, 'warning');
                return;
            }
        }
        
        log(`⏳ Waiting for train ${trainNum} to appear...`, 'info');
        return;
    }

    // D. Passenger Details Page — auto-inject when URL contains psgninput
    if (path.includes('psgninput')) {
        if (tfState.passengersInjected) return;
        
        if (!cfg.passengers || cfg.passengers.length === 0) {
            log('⚠️ No passenger data configured.', 'warning');
            return;
        }
        
        log('⏳ Waiting for Passenger page form inputs to render...', 'info');
        
        // Wait for first passenger name input to appear in DOM (up to 5s)
        let firstInput = null;
        for (let attempt = 0; attempt < 50; attempt++) {
            firstInput = document.querySelector('input[placeholder*="Name" i], input[placeholder*="name" i], input[formcontrolname*="name" i]');
            if (firstInput) break;
            await wait(100);
        }
        
        if (!firstInput) {
            log('⚠️ Passenger entry inputs not found. Re-trying...', 'warning');
            return;
        }
        
        await wait(200); // small stabilizer pause
        
        log(`📝 Passenger page detected! Directly injecting ${cfg.passengers.length} passenger(s)...`, 'success');
        
        for (let i = 0; i < cfg.passengers.length; i++) {
            const p = cfg.passengers[i];
            
            // Check if we need to click "+ Add Passenger" in the DOM for this passenger
            const currentFields = document.querySelectorAll('input[placeholder*="Name" i], input[placeholder*="name" i], input[placeholder*="Full Name" i], input[formcontrolname*="passengerName" i], input[formcontrolname*="name" i]');
            
            if (currentFields.length <= i) {
                let addBtn = null;
                const candidates = Array.from(document.querySelectorAll('*')).filter(el => {
                    if (el.closest('#tf-mobile-overlay')) return false;
                    const txt = (el.textContent || '').trim().toUpperCase().replace(/\s+/g, ' ');
                    return txt.includes('ADD PASSENGER');
                });
                
                // Sort to find the deepest/shortest matching element
                candidates.sort((a, b) => (a.textContent || '').length - (b.textContent || '').length);
                if (candidates.length > 0) {
                    addBtn = candidates[0];
                }

                if (addBtn) {
                    log(`Clicked "+ Add Passenger" element: <${addBtn.tagName.toLowerCase()}>`, 'info');
                    try { addBtn.scrollIntoView({ behavior: 'instant', block: 'center' }); } catch(err){}
                    addBtn.click();
                    
                    // Wait dynamically for the i-th passenger name field to appear (up to 2 seconds)
                    for (let attempt = 0; attempt < 20; attempt++) {
                        const fields = document.querySelectorAll('input[placeholder*="Name" i], input[placeholder*="name" i], input[placeholder*="Full Name" i], input[formcontrolname*="passengerName" i], input[formcontrolname*="name" i]');
                        if (fields.length > i) {
                            break;
                        }
                        await wait(100);
                    }
                } else {
                    log(`⚠️ "+ Add Passenger" button not found.`, 'warning');
                }
            }
            
            // Re-query all passenger form fields
            const nameFields = document.querySelectorAll('input[placeholder*="Name" i], input[placeholder*="name" i], input[placeholder*="Full Name" i], input[formcontrolname*="passengerName" i], input[formcontrolname*="name" i]');
            const ageFields = document.querySelectorAll('input[placeholder*="Age" i], input[placeholder*="age" i], input[formcontrolname*="passengerAge" i], input[formcontrolname*="age" i]');
            const genderDropdowns = document.querySelectorAll('select[formcontrolname*="gender" i], select[formcontrolname="passengerGender" i]');
            
            const nameEl = nameFields[i];
            const ageEl = ageFields[i];
            const genderEl = genderDropdowns[i];
            
            if (!nameEl) {
                log(`⚠️ Name field not found for passenger ${i + 1}`, 'warning');
                continue;
            }
            
            // Inject Name directly
            log(`Typing passenger ${i + 1}: ${p.name}`, 'info');
            nameEl.focus();
            nameEl.value = p.name;
            nameEl.dispatchEvent(new Event('input', { bubbles: true }));
            nameEl.dispatchEvent(new Event('change', { bubbles: true }));
            nameEl.dispatchEvent(new Event('blur', { bubbles: true }));
            
            // Inject Age directly
            if (ageEl && p.age) {
                ageEl.focus();
                ageEl.value = String(p.age);
                ageEl.dispatchEvent(new Event('input', { bubbles: true }));
                ageEl.dispatchEvent(new Event('change', { bubbles: true }));
                ageEl.dispatchEvent(new Event('blur', { bubbles: true }));
            }
            
            // Inject Gender directly
            if (genderEl && p.gender) {
                genderEl.focus();
                genderEl.value = p.gender === 'M' ? 'M' : p.gender === 'F' ? 'F' : 'T';
                genderEl.dispatchEvent(new Event('change', { bubbles: true }));
                genderEl.dispatchEvent(new Event('blur', { bubbles: true }));
            }
            
            await wait(100);
        }
        

        
        tfState.passengersInjected = true;
        log('🎉 All passengers injected!', 'success');
        log('✋ DONE — Enter captcha and proceed manually.', 'warning');
        
        // Terminate active extension state
        setStorage({ extension_active: false });
        if (dismissInterval) {
            clearInterval(dismissInterval);
            dismissInterval = null;
        }
    }
}


