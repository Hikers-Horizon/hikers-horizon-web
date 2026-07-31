// ─── DOM REFERENCES ───
const consoleEl = document.getElementById('console');
const btnStart = document.getElementById('btn-start');
const btnStop = document.getElementById('btn-stop');
const swapBtn = document.getElementById('swap-btn');
const liveStreamImg = document.getElementById('live-stream');
const monitorEl = document.getElementById('monitor');
const autoModeSelect = document.getElementById('auto-mode');
const journeyClassSelect = document.getElementById('journey-class');

const API_BASE = window.location.origin;
let liveViewInterval = null;
let autoStartTimer = null;
let currentBotMode = 'desktop'; // 'desktop' or 'mobile'

// ─── INIT ───
function init() {
    if (window.lucide) {
        try { lucide.createIcons(); } catch (e) {}
    }
    setDefaultDate();
    startCountdown();
    attachEvents();

    const savedKey = localStorage.getItem('dashboard_license_key') || 'TF-TEST-TRIAL-KEY';
    const keyInput = document.getElementById('dashboard-license-key');
    if (keyInput) {
        keyInput.value = savedKey;
        keyInput.addEventListener('input', () => {
            localStorage.setItem('dashboard_license_key', keyInput.value.trim().toUpperCase());
            updateLicenseStatusText();
        });
        updateLicenseStatusText();
    }

    addLog('System initialized. Swift Seat v2.0 ready.', 'system');
    addLog('Route: Yelahanka (YNK) → Yadgiri (YG)', 'info');
    addLog('Train: 11312 | Class: Sleeper (SL)', 'info');
    addLog('Waiting for command...', 'info');
}

function updateLicenseStatusText() {
    const keyInput = document.getElementById('dashboard-license-key');
    const infoEl = document.getElementById('dashboard-license-info');
    if (!keyInput || !infoEl) return;
    const value = keyInput.value.trim();
    if (!value) {
        infoEl.textContent = 'No key entered. Please activate your subscription by entering your key here.';
        infoEl.style.color = 'var(--text-sub)';
        return;
    }
    infoEl.textContent = 'Key stored locally. It will be verified when you start automation.';
    infoEl.style.color = '#10b981';
}

// ─── SET DEFAULT DATE (tomorrow) ───
function setDefaultDate() {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const yyyy = tomorrow.getFullYear();
    const mm = String(tomorrow.getMonth() + 1).padStart(2, '0');
    const dd = String(tomorrow.getDate()).padStart(2, '0');
    const dateStr = `${yyyy}-${mm}-${dd}`;
    document.getElementById('journey-date').value = dateStr;
}

// ─── COUNTDOWN TIMER ───
function startCountdown() {
    const update = () => {
        const now = new Date();
        const cls = journeyClassSelect.value;
        const targetHour = (cls === 'SL') ? 11 : 10;

        // Update tag
        document.getElementById('target-class-tag').textContent = cls;
        document.getElementById('countdown-target-text').textContent =
            cls === 'SL' ? 'Targeting Sleeper Window' : 'Targeting AC Window';

        let target = new Date(now);
        target.setHours(targetHour, 0, 0, 0);

        // If past today's window, target tomorrow
        if (now >= target) {
            target.setDate(target.getDate() + 1);
        }

        const diff = target - now;
        const hours = Math.floor(diff / 3600000);
        const minutes = Math.floor((diff % 3600000) / 60000);
        const seconds = Math.floor((diff % 60000) / 1000);

        document.getElementById('cd-hours').textContent = String(hours).padStart(2, '0');
        document.getElementById('cd-minutes').textContent = String(minutes).padStart(2, '0');
        document.getElementById('cd-seconds').textContent = String(seconds).padStart(2, '0');

        // Auto-start check
        checkAutoStart(now, targetHour);
    };

    update();
    setInterval(update, 1000);
}

// ─── AUTO-START ───
function checkAutoStart(now, targetHour) {
    const mode = autoModeSelect.value;
    if (mode === 'manual') return;

    const modeHour = mode === 'auto-10' ? 10 : 11;
    if (modeHour !== targetHour) return;

    // Start 2 seconds before window opens (pre-login)
    const windowTime = new Date(now);
    windowTime.setHours(modeHour, 0, 0, 0);

    const msUntil = windowTime - now;
    // 30 seconds before: launch browser and login
    if (msUntil > 0 && msUntil <= 30000 && !autoStartTimer) {
        autoStartTimer = true;
        addLog(`⚡ AUTO-START: Launching ${Math.ceil(msUntil / 1000)}s before window!`, 'warning');
        startSequence();
    }
}

// ─── EVENTS ───
function attachEvents() {
    const toggleBtn = document.getElementById('btn-toggle-password');
    if (toggleBtn) {
        toggleBtn.addEventListener('click', () => {
            const passInput = document.getElementById('irctc-pass');
            if (passInput) {
                passInput.type = passInput.type === 'password' ? 'text' : 'password';
            }
        });
    }

    btnStart.addEventListener('click', () => {
        if (currentBotMode === 'mobile') startMobileSequence();
        else startSequence();
    });
    btnStop.addEventListener('click', () => {
        if (currentBotMode === 'mobile') stopMobileSequence();
        else stopSequence();
    });

    swapBtn.addEventListener('click', () => {
        const fromEl = document.getElementById('from-code');
        const toEl = document.getElementById('to-code');
        const fromParent = fromEl.parentElement;
        const toParent = toEl.parentElement;

        const tempCode = fromEl.textContent;
        const tempName = fromParent.querySelector('.route-name').textContent;

        fromEl.textContent = toEl.textContent;
        fromParent.querySelector('.route-name').textContent = toParent.querySelector('.route-name').textContent;

        toEl.textContent = tempCode;
        toParent.querySelector('.route-name').textContent = tempName;

        addLog(`Route swapped: ${fromEl.textContent} → ${toEl.textContent}`, 'info');
    });

    journeyClassSelect.addEventListener('change', () => {
        const cls = journeyClassSelect.value;
        addLog(`Class changed to: ${cls}`, 'info');
    });

    const addPaxBtn = document.getElementById('add-pax-btn');
    const paxContainer = document.getElementById('passengers-container');
    if (addPaxBtn && paxContainer) {
        addPaxBtn.addEventListener('click', () => {
            const currentEntries = paxContainer.querySelectorAll('.passenger-entry');
            if (currentEntries.length >= 10) { // Trek booking allows up to 10 visitors
                addLog('Maximum 10 visitors allowed.', 'warning');
                return;
            }
            const firstEntry = currentEntries[0];
            const newEntry = firstEntry.cloneNode(true);
            newEntry.querySelectorAll('input').forEach(input => input.value = '');
            newEntry.querySelector('.remove-pax-btn').style.display = 'block';
            paxContainer.appendChild(newEntry);
        });

        paxContainer.addEventListener('click', (e) => {
            if (e.target.classList.contains('remove-pax-btn')) {
                e.target.closest('.passenger-entry').remove();
            }
        });
    }

    // ─── Mode Toggle ───
    document.querySelectorAll('.mode-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.mode-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            currentBotMode = btn.dataset.mode;

            const mobileCard = document.getElementById('mobile-config-card');
            if (currentBotMode === 'mobile') {
                mobileCard.style.display = 'block';
                btnStart.textContent = '▶ START MOBILE SEQUENCE';
                const targetApp = document.getElementById('mobile-app-target')?.value || 'railconnect';
                const appName = targetApp === 'railone' ? 'RailOne' : 'RailConnect';
                addLog(`📱 Switched to MOBILE BOT mode (Appium → ${appName})`, 'system');
            } else {
                mobileCard.style.display = 'none';
                btnStart.textContent = '▶ START TATKAL SEQUENCE';
                addLog('🖥️ Switched to DESKTOP BOT mode (Playwright → IRCTC Website)', 'system');
            }
        });
    });

    const mobileAppTarget = document.getElementById('mobile-app-target');
    if (mobileAppTarget) {
        mobileAppTarget.addEventListener('change', () => {
            const app = mobileAppTarget.value;
            const packageInput = document.getElementById('app-package');
            const activityInput = document.getElementById('app-activity');
            if (app === 'railone') {
                packageInput.value = 'org.cris.aikyam';
                activityInput.value = 'org.cris.aikyam.MainActivity';
                addLog('📱 Target App set to: CRIS RailOne', 'system');
            } else {
                packageInput.value = 'cris.org.in.prs.ima';
                activityInput.value = 'cris.org.in.ima.activities.IRCTCConnectActivity';
                addLog('📱 Target App set to: IRCTC Rail Connect', 'system');
            }
        });
    }

    // ─── Subscription Portal Event Handlers ───
    const btnPaySubscribe = document.getElementById('btn-pay-subscribe');
    if (btnPaySubscribe) {
        btnPaySubscribe.addEventListener('click', async () => {
            const email = document.getElementById('sub-email').value.trim();
            const paymentMethod = document.getElementById('sub-payment-method').value;

            if (!email || !email.includes('@')) {
                addLog('⚠️ Please enter a valid email address.', 'warning');
                alert('Please enter a valid email address.');
                return;
            }

            btnPaySubscribe.disabled = true;
            btnPaySubscribe.textContent = '⏱️ PROCESSING PAYMENT...';
            addLog(`💳 Initiating ₹99 payment order for ${email}...`, 'info');

            try {
                const ordRes = await fetch(`${API_BASE}/api/create-razorpay-order`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email })
                });
                const ordData = await ordRes.json();

                if (!ordData.success) {
                    addLog('❌ Failed to construct payment order: ' + (ordData.error || 'Server error'), 'error');
                    btnPaySubscribe.disabled = false;
                    btnPaySubscribe.textContent = '💳 PAY ₹99 & GET LICENSE KEY';
                    return;
                }

                addLog(`ℹ️ Payment order constructed: ${ordData.orderId}. Handing off to Razorpay Checkout...`, 'info');

                const options = {
                    key: ordData.keyId,
                    amount: ordData.amount,
                    currency: ordData.currency,
                    name: "Swift Seat",
                    description: "Premium Subscription (30 Days)",
                    image: "data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>⚡</text></svg>",
                    order_id: ordData.orderId,
                    handler: async function (response) {
                        try {
                            addLog('🔒 Verifying payment signature cryptographically...', 'info');
                            
                            const verRes = await fetch(`${API_BASE}/api/verify-razorpay-payment`, {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({
                                    orderId: ordData.orderId,
                                    paymentId: response.razorpay_payment_id,
                                    signature: response.razorpay_signature,
                                    email: email
                                })
                            });
                            const verData = await verRes.json();

                            if (verData.success) {
                                addLog(`🎉 Payment verified successfully! Txn ID: ${verData.paymentId}`, 'success');
                                addLog(`🔑 Fresh License Key generated: ${verData.licenseKey}`, 'success');
                                
                                document.getElementById('sub-txn-id').textContent = verData.paymentId;
                                document.getElementById('sub-key-value').value = verData.licenseKey;
                                document.getElementById('sub-result').style.display = 'block';
                            } else {
                                addLog('❌ Payment verification failed: ' + (verData.error || 'Unknown signature mismatch'), 'error');
                            }
                        } catch (err) {
                            addLog('❌ Connection error verifying payment signature: ' + err.message, 'error');
                        } finally {
                            btnPaySubscribe.disabled = false;
                            btnPaySubscribe.textContent = '💳 PAY ₹99 & GET LICENSE KEY';
                        }
                    },
                    prefill: {
                        email: email
                    },
                    theme: {
                        color: "#10b981"
                    },
                    modal: {
                        ondismiss: function () {
                            addLog('⚠️ Payment window closed by user.', 'warning');
                            btnPaySubscribe.disabled = false;
                            btnPaySubscribe.textContent = '💳 PAY ₹99 & GET LICENSE KEY';
                        }
                    }
                };

                const rzp = new Razorpay(options);
                rzp.open();

            } catch (err) {
                addLog('❌ Error establishing payment gateway session: ' + err.message, 'error');
                btnPaySubscribe.disabled = false;
                btnPaySubscribe.textContent = '💳 PAY ₹99 & GET LICENSE KEY';
            }
        });
    }

    const btnCopySubKey = document.getElementById('btn-copy-sub-key');
    if (btnCopySubKey) {
        btnCopySubKey.addEventListener('click', () => {
            const keyValue = document.getElementById('sub-key-value');
            if (keyValue) {
                keyValue.select();
                keyValue.setSelectionRange(0, 99999);
                navigator.clipboard.writeText(keyValue.value);
                
                const oldText = btnCopySubKey.textContent;
                btnCopySubKey.textContent = 'Copied!';
                btnCopySubKey.style.backgroundColor = '#10b981';
                btnCopySubKey.style.borderColor = '#10b981';
                btnCopySubKey.style.color = '#fff';

                setTimeout(() => {
                    btnCopySubKey.textContent = oldText;
                    btnCopySubKey.style.backgroundColor = '';
                    btnCopySubKey.style.borderColor = '';
                    btnCopySubKey.style.color = '';
                }, 2000);
            }
        });
    }
}


// ─── START SEQUENCE (Desktop) ───
async function startSequence() {
    btnStart.disabled = true;
    btnStop.disabled = false;
    setStep(1);

    const licenseKey = document.getElementById('dashboard-license-key')?.value.trim() || '';
    if (!licenseKey) {
        addLog('⚠️ Subscription license key required. Please enter it in the Credentials card.', 'warning');
        alert('Please enter your Subscription License Key in the Credentials card to start automation.');
        resetButtons();
        return;
    }

    const passengerEntries = document.querySelectorAll('.passenger-entry');
    const paxArray = [];
    passengerEntries.forEach(entry => {
        const name = entry.querySelector('.pax-name').value;
        const age = entry.querySelector('.pax-age').value;
        if (name && age) {
            paxArray.push({
                name: name,
                age: age,
                gender: entry.querySelector('.pax-gender').value,
                berth: entry.querySelector('.pax-berth').value
            });
        }
    });

    const payload = {
        username: document.getElementById('irctc-user').value,
        password: document.getElementById('irctc-pass').value,
        from: document.getElementById('from-code').textContent,
        to: document.getElementById('to-code').textContent,
        date: document.getElementById('journey-date').value,
        trainNum: document.getElementById('train-number').value,
        className: journeyClassSelect.value,
        quota: document.getElementById('journey-quota').value,
        passengers: paxArray,
        mobile: document.getElementById('pax-mobile').value,
        licenseKey: licenseKey
    };

    addLog('▶ LAUNCHING TATKAL SEQUENCE', 'system');
    addLog(`Route: ${payload.from} → ${payload.to}`, 'info');
    addLog(`Train: ${payload.trainNum} | Class: ${payload.className} | Quota: ${payload.quota}`, 'info');
    addLog(`Date: ${payload.date}`, 'info');

    try {
        const res = await fetch(`${API_BASE}/api/start-tatkal`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        const data = await res.json();

        if (data.status === 'started') {
            addLog('✓ Browser engine launched successfully', 'success');
            addLog('Connecting live monitor...', 'info');
            startLiveView();
            startStatusPolling();
        } else {
            addLog('✗ Engine error: ' + (data.error || 'Unknown'), 'error');
            resetButtons();
        }
    } catch (e) {
        addLog('✗ Connection failed. Is the server running on port 3005?', 'error');
        addLog('Run: node server.js', 'warning');
        resetButtons();
    }
}

// ─── STOP SEQUENCE (Desktop) ───
async function stopSequence() {
    addLog('■ ABORTING SEQUENCE...', 'warning');
    try {
        await fetch(`${API_BASE}/api/stop`, { method: 'POST' });
        addLog('Sequence aborted. Browser closed.', 'system');
    } catch (e) {
        addLog('Could not reach server to abort.', 'error');
    }
    stopLiveView();
    resetButtons();
}

// ═══════════════════════════════════════════
// ─── MOBILE BOT FUNCTIONS ───
// ═══════════════════════════════════════════

function getPassengerPayload() {
    const entries = document.querySelectorAll('.passenger-entry');
    const pax = [];
    entries.forEach(entry => {
        const name = entry.querySelector('.pax-name').value;
        const age = entry.querySelector('.pax-age').value;
        if (name && age) {
            pax.push({
                name, age,
                gender: entry.querySelector('.pax-gender').value,
                berth: entry.querySelector('.pax-berth').value
            });
        }
    });
    return pax;
}

async function startMobileSequence() {
    btnStart.disabled = true;
    btnStop.disabled = false;
    setStep(1);

    const licenseKey = document.getElementById('dashboard-license-key')?.value.trim() || '';
    if (!licenseKey) {
        addLog('⚠️ Subscription license key required. Please enter it in the Credentials card.', 'warning');
        alert('Please enter your Subscription License Key in the Credentials card to start automation.');
        resetButtons();
        return;
    }

    const statusBadge = document.getElementById('mobile-connection-status');
    statusBadge.innerHTML = '<span class="status-indicator connecting"></span><span>Connecting...</span>';

    const payload = {
        username: document.getElementById('irctc-user').value,
        password: document.getElementById('irctc-pass').value,
        from: document.getElementById('from-code').textContent,
        to: document.getElementById('to-code').textContent,
        date: document.getElementById('journey-date').value,
        trainNum: document.getElementById('train-number').value,
        className: journeyClassSelect.value,
        quota: document.getElementById('journey-quota').value,
        passengers: getPassengerPayload(),
        appiumHost: document.getElementById('appium-host').value,
        appiumPort: document.getElementById('appium-port').value,
        deviceName: document.getElementById('device-name').value,
        appPackage: document.getElementById('app-package').value,
        appActivity: document.getElementById('app-activity').value,
        licenseKey: licenseKey
    };

    addLog('📱 LAUNCHING MOBILE BOT SEQUENCE', 'system');
    addLog(`Device: ${payload.deviceName || 'auto-detect'}`, 'info');
    addLog(`App: ${payload.appPackage}`, 'info');
    addLog(`Route: ${payload.from} → ${payload.to} | Train: ${payload.trainNum}`, 'info');

    try {
        const res = await fetch(`${API_BASE}/api/start-mobile-bot`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        const data = await res.json();
        if (data.status === 'started') {
            addLog('✓ Mobile bot engine started', 'success');
            statusBadge.innerHTML = '<span class="status-indicator online"></span><span>Connected</span>';
            startMobileLiveView();
            startMobileStatusPolling();
        } else {
            addLog('✗ Mobile engine error: ' + (data.error || 'Unknown'), 'error');
            statusBadge.innerHTML = '<span class="status-indicator offline"></span><span>Failed</span>';
            resetButtons();
        }
    } catch (e) {
        addLog('✗ Connection failed. Is the server running?', 'error');
        addLog('Make sure Appium is running: appium', 'warning');
        statusBadge.innerHTML = '<span class="status-indicator offline"></span><span>Error</span>';
        resetButtons();
    }
}

async function stopMobileSequence() {
    addLog('■ STOPPING MOBILE BOT...', 'warning');
    try {
        await fetch(`${API_BASE}/api/stop-mobile`, { method: 'POST' });
        addLog('Mobile bot stopped.', 'system');
    } catch (e) {
        addLog('Could not stop mobile bot.', 'error');
    }
    stopLiveView();
    resetButtons();
    const statusBadge = document.getElementById('mobile-connection-status');
    statusBadge.innerHTML = '<span class="status-indicator offline"></span><span>Disconnected</span>';
}

function startMobileLiveView() {
    monitorEl.classList.add('active');
    liveViewInterval = setInterval(async () => {
        try {
            const res = await fetch(`${API_BASE}/api/mobile-screenshot`);
            const data = await res.json();
            if (data.image) {
                liveStreamImg.src = 'data:image/png;base64,' + data.image;
            }
        } catch (_) { }
    }, 1000);
}

function startMobileStatusPolling() {
    const poll = setInterval(async () => {
        try {
            const res = await fetch(`${API_BASE}/api/mobile-status`);
            const data = await res.json();

            if (data.logs && data.logs.length > 0) {
                data.logs.forEach(log => addLog(log.msg, log.type || 'info'));
            }

            if (data.step) setStep(data.step);

            if (data.done) {
                addLog('✓ MOBILE SEQUENCE COMPLETE', 'success');
                clearInterval(poll);
                stopLiveView();
                resetButtons();
            }
        } catch (_) { }
    }, 1000);
}

// ─── LIVE VIEW (Desktop) ───
function startLiveView() {
    monitorEl.classList.add('active');
    liveViewInterval = setInterval(async () => {
        try {
            const res = await fetch(`${API_BASE}/api/live-stream`);
            const data = await res.json();
            if (data.image) {
                liveStreamImg.src = 'data:image/png;base64,' + data.image;
            }
        } catch (_) { }
    }, 600);
}

function stopLiveView() {
    if (liveViewInterval) {
        clearInterval(liveViewInterval);
        liveViewInterval = null;
    }
    monitorEl.classList.remove('active');
}

// ─── STATUS POLLING (Desktop) ───
function startStatusPolling() {
    const poll = setInterval(async () => {
        try {
            const res = await fetch(`${API_BASE}/api/status`);
            const data = await res.json();

            if (data.logs && data.logs.length > 0) {
                data.logs.forEach(log => {
                    addLog(log.msg, log.type || 'info');
                });
            }

            if (data.step) {
                setStep(data.step);
            }

            if (data.done) {
                addLog('✓ SEQUENCE COMPLETE — Proceed to payment', 'success');
                clearInterval(poll);
                stopLiveView();
                resetButtons();
            }
        } catch (_) { }
    }, 1000);
}

// ─── PROGRESS STEPS ───
function setStep(num) {
    document.querySelectorAll('.step').forEach(el => {
        const s = parseInt(el.dataset.step);
        el.classList.remove('active', 'done');
        if (s < num) el.classList.add('done');
        if (s === num) el.classList.add('active');
    });
}

// ─── LOGGING ───
function addLog(message, type = 'info') {
    const entry = document.createElement('div');
    entry.className = `log-entry ${type}`;

    const time = new Date().toLocaleTimeString('en-IN', {
        hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false
    });

    entry.innerHTML = `<span class="log-time">${time}</span><span class="log-msg">${message}</span>`;
    consoleEl.appendChild(entry);
    consoleEl.scrollTop = consoleEl.scrollHeight;
}

// ─── RESET ───
function resetButtons() {
    btnStart.disabled = false;
    btnStop.disabled = true;
}

// ─── BOOT ───
init();
