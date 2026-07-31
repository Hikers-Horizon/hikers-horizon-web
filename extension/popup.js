document.addEventListener('DOMContentLoaded', () => {
    const usernameInput = document.getElementById('username');
    const passwordInput = document.getElementById('password');
    const btnAddPax = document.getElementById('btn-add-pax');
    const paxList = document.getElementById('pax-list');
    const btnStart = document.getElementById('btn-start');
    const btnReset = document.getElementById('btn-reset');
    const statusBox = document.getElementById('status-box');

    // ─── Set Default Dates (Tomorrow) ───
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const dateStr = tomorrow.toISOString().split('T')[0];
    document.getElementById('journey-date').value = dateStr;

    // ─── Live Clock & Countdown Sync ───
    function updateClockAndCountdown() {
        const now = new Date();
        
        // 1. Update Live Clock
        const liveHrs = String(now.getHours()).padStart(2, '0');
        const liveMins = String(now.getMinutes()).padStart(2, '0');
        const liveSecs = String(now.getSeconds()).padStart(2, '0');
        const clockEl = document.getElementById('live-clock');
        const dateEl = document.getElementById('live-date');
        
        if (clockEl) clockEl.textContent = `${liveHrs}:${liveMins}:${liveSecs}`;
        if (dateEl) {
            const dateOptions = { weekday: 'long', month: 'short', day: 'numeric' };
            dateEl.textContent = now.toLocaleDateString('en-US', dateOptions);
        }

        // 2. Update Countdown
        const classSelector = document.getElementById('train-class');
        const quotaSelector = document.getElementById('train-quota');
        const countdownLabel = document.getElementById('countdown-label');
        const countdownClock = document.getElementById('countdown-clock');
        
        if (classSelector && quotaSelector && countdownLabel && countdownClock) {
            const trainClass = classSelector.value;
            const trainQuota = quotaSelector.value;
            const isTatkal = trainQuota === 'TQ' || trainQuota === 'PT';
            
            if (isTatkal) {
                const targetHour = (trainClass === 'SL') ? 11 : 10;
                countdownLabel.textContent = `${trainClass} Tatkal Opens In`;
                
                let target = new Date(now);
                target.setHours(targetHour, 0, 0, 0);
                
                if (now >= target) {
                    target.setDate(target.getDate() + 1);
                }
                
                const diff = target - now;
                const hours = Math.floor(diff / 3600000);
                const minutes = Math.floor((diff % 3600000) / 60000);
                const seconds = Math.floor((diff % 60000) / 1000);
                
                const countHrs = String(hours).padStart(2, '0');
                const countMins = String(minutes).padStart(2, '0');
                const countSecs = String(seconds).padStart(2, '0');
                countdownClock.textContent = `${countHrs}:${countMins}:${countSecs}`;
                countdownClock.style.color = 'var(--text)';
            } else {
                countdownLabel.textContent = 'General Booking';
                countdownClock.textContent = 'ACTIVE';
                countdownClock.style.color = 'var(--success)';
            }
        }
    }

    // Initialize and run interval
    updateClockAndCountdown();
    setInterval(updateClockAndCountdown, 1000);

    // Bind dropdown changes to immediately update display
    const classEl = document.getElementById('train-class');
    const quotaEl = document.getElementById('train-quota');
    if (classEl) classEl.addEventListener('change', updateClockAndCountdown);
    if (quotaEl) quotaEl.addEventListener('change', updateClockAndCountdown);

    // ─── Add Passenger ───
    btnAddPax.addEventListener('click', () => {
        const entries = paxList.querySelectorAll('.pax-entry');
        if (entries.length >= 10) return;
        const newEntry = entries[0].cloneNode(true);
        newEntry.querySelectorAll('input').forEach(input => input.value = '');
        paxList.appendChild(newEntry);
    });

    // ─── Load Saved Config ───
    chrome.storage.local.get(['bookingConfig'], (res) => {
        if (res.bookingConfig) {
            const cfg = res.bookingConfig;
            usernameInput.value = cfg.username || '';
            passwordInput.value = cfg.password || '';
            document.getElementById('mobile-num').value = cfg.mobile || '';

            document.getElementById('from-station').value = cfg.from || 'YNK';
            document.getElementById('to-station').value = cfg.to || 'YG';
            document.getElementById('train-num').value = cfg.trainNum || '11312';
            document.getElementById('train-class').value = cfg.className || 'SL';
            document.getElementById('journey-date').value = cfg.date || dateStr;
            document.getElementById('train-quota').value = cfg.quota || 'TQ';

            // Restore passengers
            if (cfg.passengers && cfg.passengers.length > 0) {
                paxList.innerHTML = '';
                cfg.passengers.forEach(p => {
                    const div = document.createElement('div');
                    div.className = 'pax-entry';
                    div.innerHTML = `
                        <input type="text" class="form-input pax-name" placeholder="Name" value="${p.name}">
                        <input type="number" class="form-input pax-age" placeholder="Age" value="${p.age}">
                        <select class="form-select pax-gender">
                            <option value="M" ${p.gender === 'M' ? 'selected' : ''}>M</option>
                            <option value="F" ${p.gender === 'F' ? 'selected' : ''}>F</option>
                        </select>
                    `;
                    paxList.appendChild(div);
                });
            }
        }
    });

    // ─── Reset Config ───
    btnReset.addEventListener('click', () => {
        chrome.storage.local.remove(['bookingConfig', 'extension_active'], () => {
            statusBox.className = 'status success';
            statusBox.textContent = 'Configuration cleared successfully.';
            setTimeout(() => {
                location.reload();
            }, 1000);
        });
    });

    // ─── Start Automation ───
    btnStart.addEventListener('click', () => {
        // Collect passenger entries
        const passengers = [];
        paxList.querySelectorAll('.pax-entry').forEach(entry => {
            const name = entry.querySelector('.pax-name').value;
            const age = entry.querySelector('.pax-age').value;
            const gender = entry.querySelector('.pax-gender').value;
            if (name && age) {
                passengers.push({ name, age, gender });
            }
        });

        // Config payload
        const config = {
            service: 'train',
            username: usernameInput.value,
            password: passwordInput.value,
            mobile: document.getElementById('mobile-num').value,
            passengers: passengers,
            from: document.getElementById('from-station').value,
            to: document.getElementById('to-station').value,
            trainNum: document.getElementById('train-num').value,
            className: document.getElementById('train-class').value,
            date: document.getElementById('journey-date').value,
            quota: document.getElementById('train-quota').value
        };

        const targetUrl = 'https://www.irctc.co.in/nget/train-search';

        // Save config and trigger active state
        chrome.storage.local.set({
            bookingConfig: config,
            extension_active: true
        }, () => {
            statusBox.className = 'status success';
            statusBox.textContent = 'Config saved! Navigating to website...';

            // Query current active tab and navigate
            chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
                if (tabs && tabs[0]) {
                    chrome.tabs.update(tabs[0].id, { url: targetUrl });
                }
            });
        });
    });

    // ─── Subscription / Licensing Management ───
    const licenseInput = document.getElementById('license-key');
    const activateBtn = document.getElementById('btn-activate');
    const licenseStatus = document.getElementById('license-status');

    // Helper: Retrieve or populate standard device uuid
    async function getOrCreateDeviceId() {
        return new Promise((resolve) => {
            chrome.storage.local.get(['deviceId'], (res) => {
                if (res.deviceId) {
                    resolve(res.deviceId);
                } else {
                    const newId = 'dev_' + Math.random().toString(36).substring(2, 15);
                    chrome.storage.local.set({ deviceId: newId });
                    resolve(newId);
                }
            });
        });
    }

    // Load license status on popup open
    chrome.storage.local.get(['licenseStatus'], (res) => {
        if (res.licenseStatus && res.licenseStatus.active) {
            licenseInput.value = res.licenseStatus.key;
            licenseStatus.textContent = `Active until: ${new Date(res.licenseStatus.expiresAt).toLocaleDateString()}`;
            licenseStatus.style.color = '#00f2fe';
        }
    });

    // Activation Click
    activateBtn.addEventListener('click', async () => {
        const key = licenseInput.value.trim().toUpperCase();
        if (!key) {
            licenseStatus.textContent = 'Please enter a key!';
            licenseStatus.style.color = '#ff4757';
            return;
        }

        licenseStatus.textContent = 'Activating...';
        licenseStatus.style.color = '#f1c40f';

        const deviceId = await getOrCreateDeviceId();

        try {
            const response = await fetch('https://hikershorizon.in/api/activate-license', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ licenseKey: key, deviceId })
            });

            if (!response.ok) {
                const data = await response.json();
                throw new Error(data.error || 'Server error');
            }

            const data = await response.json();
            chrome.storage.local.set({
                licenseStatus: { key, active: true, expiresAt: data.expiresAt }
            }, () => {
                licenseStatus.textContent = `Activated! Exp: ${new Date(data.expiresAt).toLocaleDateString()}`;
                licenseStatus.style.color = '#00f2fe';
            });
        } catch (err) {
            licenseStatus.textContent = `Failed: ${err.message}`;
            licenseStatus.style.color = '#ff4757';
        }
    });
});
