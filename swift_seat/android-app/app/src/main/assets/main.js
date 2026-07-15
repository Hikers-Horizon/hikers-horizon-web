document.addEventListener('DOMContentLoaded', () => {
    let currentService = 'train';

    const tabTrain = document.getElementById('tab-train');
    const tabTrek = document.getElementById('tab-trek');
    const trainFields = document.getElementById('train-fields');
    const trekFields = document.getElementById('trek-fields');
    const labelUser = document.getElementById('label-user');
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
    document.getElementById('trek-date').value = dateStr;

    // ─── Tab Switching ───
    function switchService(service) {
        currentService = service;
        const mpinContainer = document.getElementById('mpin-container');
        if (service === 'train') {
            tabTrain.classList.add('active');
            tabTrek.classList.remove('active');
            trainFields.style.display = 'block';
            trekFields.style.display = 'none';
            if (mpinContainer) mpinContainer.style.display = 'block';
            labelUser.textContent = 'Username';
            usernameInput.placeholder = 'IRCTC User ID';
            document.getElementById('logo-text').textContent = 'Swift Seat';
            document.getElementById('logo-sub').textContent = 'Android Booking Engine v1.0';
        } else {
            tabTrek.classList.add('active');
            tabTrain.classList.remove('active');
            trekFields.style.display = 'block';
            trainFields.style.display = 'none';
            if (mpinContainer) mpinContainer.style.display = 'none';
            labelUser.textContent = 'Email Address';
            usernameInput.placeholder = 'email@example.com';
            document.getElementById('logo-text').textContent = 'Swift Seat';
            document.getElementById('logo-sub').textContent = 'Android Booking Engine v1.0';
        }
    }

    tabTrain.addEventListener('click', () => switchService('train'));
    tabTrek.addEventListener('click', () => switchService('trek'));

    // ─── Add Passenger ───
    btnAddPax.addEventListener('click', () => {
        const entries = paxList.querySelectorAll('.pax-entry');
        if (entries.length >= 10) return;
        const newEntry = entries[0].cloneNode(true);
        newEntry.querySelectorAll('input').forEach(input => input.value = '');
        paxList.appendChild(newEntry);
    });

    // ─── Load Saved Config ───
    const loadConfig = () => {
        const configJson = AndroidInterface.getBookingConfig();
        if (configJson && configJson !== '{}') {
            try {
                const cfg = JSON.parse(configJson);
                currentService = cfg.service || 'train';
                switchService(currentService);
                usernameInput.value = cfg.username || '';
                passwordInput.value = cfg.password || '';
                const mpinInput = document.getElementById('mpin');
                if (mpinInput) mpinInput.value = cfg.mpin || '';
                document.getElementById('mobile-num').value = cfg.mobile || '';

                if (currentService === 'train') {
                    document.getElementById('from-station').value = cfg.from || 'YNK';
                    document.getElementById('to-station').value = cfg.to || 'YG';
                    document.getElementById('train-num').value = cfg.trainNum || '11312';
                    document.getElementById('train-class').value = cfg.className || 'SL';
                    document.getElementById('journey-date').value = cfg.date || dateStr;
                    document.getElementById('train-quota').value = cfg.quota || 'TQ';
                } else {
                    document.getElementById('trek-district').value = cfg.district || '';
                    document.getElementById('trek-trail').value = cfg.trail || '';
                    document.getElementById('trek-date').value = cfg.date || dateStr;
                    document.getElementById('trek-slot').value = cfg.slot || '';
                }

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
            } catch (e) {
                console.error("Failed to parse config", e);
            }
        }
    };

    if (typeof AndroidInterface !== 'undefined') {
        loadConfig();
    } else {
        setTimeout(loadConfig, 200); // retry if WebView initialization has a minor delay
    }

    // ─── Reset Config ───
    btnReset.addEventListener('click', () => {
        if (typeof AndroidInterface !== 'undefined') {
            AndroidInterface.saveBookingConfig('{}');
            AndroidInterface.setExtensionActive(false);
            statusBox.className = 'status success';
            statusBox.textContent = 'Configuration cleared successfully.';
            setTimeout(() => {
                location.reload();
            }, 1000);
        }
    });

    // ─── Start Automation ───
    btnStart.addEventListener('click', () => {
        const passengers = [];
        paxList.querySelectorAll('.pax-entry').forEach(entry => {
            const name = entry.querySelector('.pax-name').value;
            const age = entry.querySelector('.pax-age').value;
            const gender = entry.querySelector('.pax-gender').value;
            if (name && age) {
                passengers.push({ name, age, gender });
            }
        });

        const config = {
            service: currentService,
            username: usernameInput.value,
            password: passwordInput.value,
            mpin: document.getElementById('mpin') ? document.getElementById('mpin').value : '',
            mobile: document.getElementById('mobile-num').value,
            passengers: passengers
        };

        let targetUrl = '';
        if (currentService === 'train') {
            config.from = document.getElementById('from-station').value;
            config.to = document.getElementById('to-station').value;
            config.trainNum = document.getElementById('train-num').value;
            config.className = document.getElementById('train-class').value;
            config.date = document.getElementById('journey-date').value;
            config.quota = document.getElementById('train-quota').value;
            targetUrl = 'https://www.irctc.co.in/nget/train-search';
        } else {
            config.district = document.getElementById('trek-district').value;
            config.trail = document.getElementById('trek-trail').value;
            config.date = document.getElementById('trek-date').value;
            config.slot = document.getElementById('trek-slot').value;
            targetUrl = 'https://aranyavihaara.karnataka.gov.in/home';
        }

        if (typeof AndroidInterface !== 'undefined') {
            AndroidInterface.saveBookingConfig(JSON.stringify(config));
            AndroidInterface.setExtensionActive(true);

            if (currentService === 'train') {
                if (!AndroidInterface.isAccessibilityEnabled()) {
                    statusBox.className = 'status info';
                    statusBox.textContent = 'Please enable Accessibility Service for Swift Seat to automate RailOne.';
                    alert("Please enable the Accessibility Service permission for 'Swift Seat' in your settings to automate the RailOne app.");
                    AndroidInterface.openAccessibilitySettings();
                } else {
                    statusBox.className = 'status success';
                    statusBox.textContent = 'Launching RailOne app...';
                    AndroidInterface.launchRailOne();
                }
            } else {
                statusBox.className = 'status success';
                statusBox.textContent = 'Loading page... starting booking sequence.';
                AndroidInterface.navigateTo(targetUrl);
            }
        } else {
            statusBox.className = 'status error';
            statusBox.textContent = 'Error: Android native interface not found.';
        }
    });
});
