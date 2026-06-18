/**
 * Hikers Horizon — Premium Booking Engine with Razorpay
 * Drop-in module for any trek booking page.
 *
 * USAGE:
 *   1. Include booking-premium.css + this script on your page
 *   2. Call BookingEngine.init({ ...config }) in a <script> tag
 */

const BookingEngine = (() => {
  // ——————— State ———————
  let config = {};
  let currentStep = 0;
  let totalCost = 0;
  let perHead = 0;
  let userEmail = null;
  let isGuestMode = false;
  let paymentMode = 'advance'; // 'advance' or 'full'

  // ——————— Helpers ———————
  function $(sel) { return document.querySelector(sel); }
  function $$(sel) { return document.querySelectorAll(sel); }

  function formatINR(n) {
    return '₹' + Number(n).toLocaleString('en-IN');
  }

  // ——————— Login Gate ———————
  function checkLogin() {
    userEmail = localStorage.getItem('userEmail');
    if (!userEmail) {
      showLoginGate();
      return false;
    }
    return true;
  }

  function showLoginGate() {
    // Store current URL so we can redirect back after login
    sessionStorage.setItem('postLoginRedirect', window.location.href);

    const overlay = document.createElement('div');
    overlay.className = 'login-gate';
    overlay.id = 'login-gate-overlay';
    overlay.innerHTML = `
      <div class="login-gate-card">
        <div class="gate-icon">
          <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
            <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
            <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
          </svg>
        </div>
        <h2>Book Your Trek</h2>
        <p>Choose how you would like to proceed with your booking. Log in to your Hikers Horizon account for a faster checkout, or book without logging in.</p>
        <div style="display: flex; flex-direction: column; gap: 1rem; width: 100%;">
          <a href="/login.html" class="btn-login" style="margin-bottom: 0;">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" style="margin-right: 0.5rem;"><path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"/><polyline points="10 17 15 12 10 7"/><line x1="15" y1="12" x2="3" y2="12"/></svg>
            Book with Login
          </a>
          <button class="btn-guest" id="btnBookGuest">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-right: 0.5rem;"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>
            Book without Login
          </button>
        </div>
      </div>`;
    document.body.appendChild(overlay);

    overlay.querySelector('#btnBookGuest').addEventListener('click', () => {
      overlay.remove();
      isGuestMode = true;
      startBookingFlow();
    });
  }

  // ——————— Particles ———————
  function initParticles() {
    const container = document.createElement('div');
    container.className = 'particles';
    for (let i = 0; i < 20; i++) {
      const p = document.createElement('div');
      p.className = 'particle';
      p.style.left = Math.random() * 100 + '%';
      p.style.animationDuration = (8 + Math.random() * 12) + 's';
      p.style.animationDelay = (Math.random() * 10) + 's';
      p.style.width = p.style.height = (2 + Math.random() * 4) + 'px';
      container.appendChild(p);
    }
    document.body.insertBefore(container, document.body.firstChild);
  }

  // ——————— Toast ———————
  function showToast(msg, type = 'info') {
    let container = $('.toast-container');
    if (!container) {
      container = document.createElement('div');
      container.className = 'toast-container';
      document.body.appendChild(container);
    }
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    const icons = { success: '✓', error: '✕', info: 'ℹ' };
    toast.innerHTML = `<span>${icons[type] || 'ℹ'}</span><span>${msg}</span>`;
    container.appendChild(toast);
    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateX(100px)';
      setTimeout(() => toast.remove(), 400);
    }, 4000);
  }

  // ——————— Price Calculation ———————
  function updatePrice() {
    const participants = parseInt($('#participants').value) || 1;
    
    if (config.pricingType === 'select') {
      const sel = $('#tripType');
      perHead = parseInt(sel.value);
    } else if (config.pricingType === 'transport') {
      const trans = $('#transportation');
      perHead = trans.value === 'true' ? config.transportPrice : config.basePrice;
    } else {
      perHead = config.basePrice;
    }

    totalCost = perHead * participants;
    const advanceCost = Math.round(totalCost * 0.30);
    const balanceDue = totalCost - advanceCost;

    const perHeadEl = $('#perHeadDisplay');
    const totalEl = $('#totalDisplay');
    const advanceEl = $('#advanceDisplay');
    const balanceEl = $('#balanceDisplay');
    const participantsEl = $('#participantsDisplay');
    const onlinePaidLabel = $('#onlinePaidLabel');
    const payBtn = $('#payBtn');

    if (perHeadEl) perHeadEl.textContent = formatINR(perHead);
    if (totalEl) totalEl.textContent = formatINR(totalCost);
    if (participantsEl) participantsEl.textContent = participants + (participants === 1 ? ' person' : ' people');

    if (paymentMode === 'full') {
      if (onlinePaidLabel) onlinePaidLabel.textContent = 'Amount Paid Now';
      if (advanceEl) advanceEl.textContent = formatINR(totalCost);
      if (balanceEl) balanceEl.textContent = formatINR(0);
      if (payBtn && !payBtn.disabled) {
        payBtn.innerHTML = '💳 Pay Full Amount ' + formatINR(totalCost);
      }
    } else {
      if (onlinePaidLabel) onlinePaidLabel.textContent = 'Advance Paid Now (30%)';
      if (advanceEl) advanceEl.textContent = formatINR(advanceCost);
      if (balanceEl) balanceEl.textContent = formatINR(balanceDue);
      if (payBtn && !payBtn.disabled) {
        payBtn.innerHTML = '💳 Pay Advance ' + formatINR(advanceCost);
      }
    }
  }

  // ——————— Steps ———————
  function goToStep(step) {
    const steps = $$('.form-step');
    const dots = $$('.step-dot');
    
    if (step === 1 && !validateStep1()) return;
    
    currentStep = step;
    steps.forEach((s, i) => {
      s.classList.toggle('active', i === step);
    });
    dots.forEach((d, i) => {
      d.classList.toggle('active', i === step);
      d.classList.toggle('completed', i < step);
    });

    if (step === 1) updatePrice();
  }

  function validateStep1() {
    const name = $('#fullName');
    const mobile = $('#mobileNumber');
    const date = $('#bookingDate');
    
    if (!name.value.trim()) { showToast('Please enter your full name', 'error'); name.focus(); return false; }
    if (!mobile.value.trim() || !/^\d{10,15}$/.test(mobile.value)) { showToast('Enter a valid mobile number (10-15 digits)', 'error'); mobile.focus(); return false; }
    
    if (isGuestMode) {
      const emailInput = $('#displayEmail');
      const emailVal = emailInput.value.trim();
      if (!emailVal || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailVal)) {
        showToast('Please enter a valid email address', 'error');
        emailInput.focus();
        return false;
      }
      userEmail = emailVal;
    }

    if (!date.value) { showToast('Please select a trek date', 'error'); date.focus(); return false; }
    
    // Validate date is in the future
    if (new Date(date.value) <= new Date()) { showToast('Please select a future date', 'error'); date.focus(); return false; }

    // Update review summary
    const s = $('#reviewName'); if (s) s.textContent = name.value;
    const m = $('#reviewMobile'); if (m) m.textContent = mobile.value;
    const e = $('#reviewEmail'); if (e) e.textContent = userEmail;
    const d = $('#reviewDate'); if (d) d.textContent = new Date(date.value).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' });

    return true;
  }

  // ——————— Razorpay Payment ———————
  async function initiatePayment() {
    const payBtn = $('#payBtn');
    payBtn.disabled = true;
    payBtn.innerHTML = '<span class="spinner"></span> Processing...';

    const participants = parseInt($('#participants').value) || 1;
    updatePrice();

    const bookingData = {
      userEmail,
      fullName: $('#fullName').value,
      mobileNumber: $('#mobileNumber').value,
      trekName: config.trekName,
      bookingDate: $('#bookingDate').value,
      transportation: config.pricingType === 'transport' ? ($('#transportation').value === 'true') : (config.transportInclusive || false),
      participants,
      amountPerHead: perHead,
      totalCost,
      paymentMode // 'advance' or 'full'
    };

    try {
      // Step 1: Create Razorpay Order on server
      const orderRes = await fetch('/api/create-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount: totalCost, paymentMode, bookingData })
      });

      if (!orderRes.ok) {
        const errText = await orderRes.text();
        throw new Error(errText || 'Failed to create payment order');
      }

      const orderData = await orderRes.json();

      // Step 2: Open Razorpay Checkout
      const options = {
        key: orderData.razorpayKeyId,
        amount: orderData.amount,
        currency: 'INR',
        name: 'Hikers Horizon',
        description: config.trekName + ' — Trek Booking',
        order_id: orderData.orderId,
        image: 'img/lo.png',
        prefill: {
          name: bookingData.fullName,
          email: userEmail,
          contact: bookingData.mobileNumber
        },
        theme: {
          color: '#0a1a2e',
          backdrop_color: 'rgba(10, 26, 46, 0.85)'
        },
        handler: async function (response) {
          // Step 3: Verify payment on server
          payBtn.innerHTML = '<span class="spinner"></span> Verifying...';
          
          try {
            const verifyRes = await fetch('/api/verify-payment', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                razorpay_order_id: response.razorpay_order_id,
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_signature: response.razorpay_signature,
                bookingData
              })
            });

            if (!verifyRes.ok) throw new Error('Payment verification failed');

            const result = await verifyRes.json();

            showToast('Payment Successful!', 'success');
            showReceipt(result, bookingData, response.razorpay_payment_id);

          } catch (verifyErr) {
            showToast('Payment verification failed. Contact support.', 'error');
            payBtn.disabled = false;
            updatePrice();
          }
        },
        modal: {
          ondismiss: function () {
            payBtn.disabled = false;
            updatePrice();
            showToast('Payment cancelled', 'info');
          }
        }
      };

      const rzp = new Razorpay(options);
      rzp.on('payment.failed', function (response) {
        showToast('Payment failed: ' + response.error.description, 'error');
        payBtn.disabled = false;
        updatePrice();
      });
      rzp.open();

    } catch (err) {
      console.error('Payment error:', err);
      showToast(err.message || 'Payment initiation failed', 'error');
      payBtn.disabled = false;
      updatePrice();
    }
  }

  // ——————— Receipt ———————
  function showReceipt(serverResult, bookingData, paymentId) {
    launchConfetti();

    const dateStr = new Date(bookingData.bookingDate).toLocaleDateString('en-IN', {
      day: 'numeric', month: 'long', year: 'numeric'
    });

    // Lock body scroll
    document.body.style.overflow = 'hidden';

    const overlay = document.createElement('div');
    overlay.className = 'receipt-overlay';
    overlay.innerHTML = `
      <div class="receipt-card">
        <!-- Decorative Background Mountain -->
        <div style="position:absolute; bottom:0; left:0; width:100%; height:120px; opacity:0.05; pointer-events:none; z-index:0;">
          <svg viewBox="0 0 1000 300" preserveAspectRatio="none" style="width:100%; height:100%; fill:currentColor;">
            <path d="M0,300 L250,100 L500,220 L750,50 L1000,300 Z"></path>
          </svg>
        </div>

        <div class="receipt-top">
          <div class="receipt-success-icon">
            <!-- Premium Shield Success Icon -->
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path>
              <polyline points="9 12 11 14 15 10"></polyline>
            </svg>
          </div>
          <h2 style="font-family:'Outfit', sans-serif; letter-spacing:0.2rem;">EXPLORATION READY</h2>
          <p>Your grand expedition has been authorized</p>
        </div>

        <div class="receipt-body" style="position:relative; z-index:1;">
          <div class="receipt-row">
            <span class="r-label">Trek Destination</span>
            <span class="r-value" style="color:var(--hh-gold);">${bookingData.trekName}</span>
          </div>
          <div class="receipt-row">
            <span class="r-label">Lead Explorer</span>
            <span class="r-value">${bookingData.fullName}</span>
          </div>
          <div class="receipt-row">
            <span class="r-label">Expedition Date</span>
            <span class="r-value">${dateStr}</span>
          </div>
          <div class="receipt-row">
            <span class="r-label">Total Explorers</span>
            <span class="r-value">${bookingData.participants} ${bookingData.participants === 1 ? 'Person' : 'People'}</span>
          </div>
          <div class="receipt-row">
            <span class="r-label">Total Cost</span>
            <span class="r-value">${formatINR(bookingData.totalCost)}</span>
          </div>
          <div class="receipt-row total-row" style="border-top: 1px dashed rgba(255,255,255,0.1); padding-top: 0.5rem;">
            <span class="r-label" style="color: var(--hh-gold);">${bookingData.paymentMode === 'full' ? 'Total Paid Online' : 'Advance Paid (30%)'}</span>
            <span class="r-value" style="color: var(--hh-gold); font-weight: bold;">${formatINR(bookingData.paymentMode === 'full' ? bookingData.totalCost : Math.round(bookingData.totalCost * 0.30))}</span>
          </div>
          ${bookingData.paymentMode === 'full' ? `
          <div class="receipt-row" style="padding-bottom: 0.5rem;">
            <span class="r-label">Balance Due</span>
            <span class="r-value" style="color: #55FF55; font-weight: bold;">₹0 (Fully Paid)</span>
          </div>
          ` : `
          <div class="receipt-row" style="padding-bottom: 0.5rem;">
            <span class="r-label">Balance Due on Departure</span>
            <span class="r-value" style="color: #FF5555; font-weight: bold;">${formatINR(bookingData.totalCost - Math.round(bookingData.totalCost * 0.30))}</span>
          </div>
          `}
        </div>

        <div class="receipt-id">
          <div style="text-transform:uppercase; font-size:0.65rem; opacity:0.6; margin-bottom:0.4rem;">Transaction Metadata</div>
          <div>PAYMENT_ID: ${paymentId}</div>
          <div>BOOKING_REF: HH-${serverResult.bookingId || '000'}</div>
        </div>

        <div class="email-sent-note">
          <svg viewBox="0 0 24 24"><path d="M9 16.2L4.8 12l-1.4 1.4L9 19 21 7l-1.4-1.4L9 16.2z"/></svg>
          Electronic receipt dispatched to ${bookingData.userEmail}
        </div>

        <div class="receipt-actions">
          <button class="btn btn-download" id="downloadReceiptBtn">📥 Save PDF</button>
          <button class="btn btn-done" id="doneBtn">${isGuestMode ? 'Explore More Adventures' : 'Adventure Awaits →'}</button>
        </div>
      </div>`;

    document.body.appendChild(overlay);

    overlay.querySelector('#doneBtn').addEventListener('click', () => {
      document.body.style.overflow = '';
      if (isGuestMode) {
        window.location.href = '/index.html';
      } else {
        window.location.href = '/profile.html';
      }
    });

    overlay.querySelector('#downloadReceiptBtn').addEventListener('click', () => {
      downloadReceipt(bookingData, paymentId, serverResult.bookingId);
    });
  }

  // ——————— Download Receipt (text-based) ———————
  function downloadReceipt(data, paymentId, bookingId) {
    const dateStr = new Date(data.bookingDate).toLocaleDateString('en-IN', {
      day: 'numeric', month: 'long', year: 'numeric'
    });

    const isFullPay = data.paymentMode === 'full';
    const amountPaid = isFullPay ? data.totalCost : Math.round(data.totalCost * 0.30);
    const balanceDue = data.totalCost - amountPaid;

    const receiptText = `
═══════════════════════════════════════
       HIKERS HORIZON — BOOKING RECEIPT
═══════════════════════════════════════

  Trek:          ${data.trekName}
  Name:          ${data.fullName}
  Email:         ${data.userEmail}
  Mobile:        ${data.mobileNumber}
  Date:          ${dateStr}
  Participants:  ${data.participants}
  Per Head:      ${formatINR(data.amountPerHead)}
  ─────────────────────────────────────
  TOTAL COST:    ${formatINR(data.totalCost)}
  AMOUNT PAID:   ${formatINR(amountPaid)} ${isFullPay ? '(100% Paid Online)' : '(30% Paid Online)'}
  BALANCE DUE:   ${formatINR(balanceDue)} ${isFullPay ? '(Fully Paid)' : '(Pay on Departure)'}
  ─────────────────────────────────────

  Payment ID:    ${paymentId}
  Booking Ref:   ${bookingId || 'N/A'}
  Booked On:     ${new Date().toLocaleString('en-IN')}

═══════════════════════════════════════
  Thank you for choosing Hikers Horizon!
  ${isFullPay ? 'Your booking is fully paid.' : 'Note: Settle balance on departure day.'}
  For support: hikershorizon@gmail.com
═══════════════════════════════════════
    `.trim();

    const blob = new Blob([receiptText], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `HH_Receipt_${data.trekName.replace(/\s+/g, '_')}_${Date.now()}.txt`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('Receipt downloaded!', 'success');
  }

  // ——————— Confetti ———————
  function launchConfetti() {
    const canvas = document.createElement('canvas');
    canvas.id = 'confetti-canvas';
    document.body.appendChild(canvas);
    const ctx = canvas.getContext('2d');
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    const colors = ['#FFD700', '#FFA500', '#FFFFFF', '#E5E7EB', '#FDBA74', '#FCD34D'];
    const particles = [];

    for (let i = 0; i < 150; i++) {
      particles.push({
        x: canvas.width / 2 + (Math.random() - 0.5) * 200,
        y: canvas.height / 2,
        vx: (Math.random() - 0.5) * 16,
        vy: -8 - Math.random() * 12,
        size: 4 + Math.random() * 6,
        color: colors[Math.floor(Math.random() * colors.length)],
        rotation: Math.random() * 360,
        rotSpeed: (Math.random() - 0.5) * 12,
        gravity: 0.15 + Math.random() * 0.1,
        opacity: 1,
        shape: Math.random() > 0.5 ? 'rect' : 'circle'
      });
    }

    let frame = 0;
    function animate() {
      frame++;
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      particles.forEach(p => {
        p.x += p.vx;
        p.vy += p.gravity;
        p.y += p.vy;
        p.rotation += p.rotSpeed;
        p.vx *= 0.99;
        if (frame > 60) p.opacity -= 0.015;

        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rotation * Math.PI / 180);
        ctx.globalAlpha = Math.max(0, p.opacity);
        ctx.fillStyle = p.color;
        if (p.shape === 'rect') {
          ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.6);
        } else {
          ctx.beginPath();
          ctx.arc(0, 0, p.size / 2, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.restore();
      });

      if (frame < 180) {
        requestAnimationFrame(animate);
      } else {
        canvas.remove();
      }
    }

    animate();
  }

  // ——————— Date min value ———————
  function setMinDate() {
    const dateInput = $('#bookingDate');
    if (dateInput) {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      dateInput.min = tomorrow.toISOString().split('T')[0];
    }
  }

  // ——————— Build HTML ———————
  function buildForm(container) {
    const emailField = `<div class="form-group">
      <label><span class="label-icon">📧</span> Email</label>
      <input type="email" id="displayEmail" value="${userEmail || ''}" ${userEmail ? 'readonly' : ''} placeholder="explorer@example.com">
    </div>`;

    // Pricing-specific fields
    let pricingField = '';
    if (config.pricingType === 'select') {
      pricingField = `<div class="form-group">
        <label><span class="label-icon">🎒</span> Trip Option</label>
        <select id="tripType">
          ${config.options.map(o => `<option value="${o.price}">${o.label} (₹${Number(o.price).toLocaleString('en-IN')}/head)</option>`).join('')}
        </select>
      </div>`;
    } else if (config.pricingType === 'transport') {
      pricingField = `<div class="form-group">
        <label><span class="label-icon">🚐</span> Transportation</label>
        <select id="transportation">
          <option value="false">Without Transport (₹${Number(config.basePrice).toLocaleString('en-IN')}/head)</option>
          <option value="true">With Transport (₹${Number(config.transportPrice).toLocaleString('en-IN')}/head)</option>
        </select>
      </div>`;
    } else if (config.transportInclusive) {
      pricingField = `<div class="form-group">
        <label><span class="label-icon">🚐</span> Transportation</label>
        <input type="text" value="✓ Included" readonly>
      </div>`;
    }

    container.innerHTML = `
      <!-- Step Indicator -->
      <div class="step-indicator">
        <div class="step-dot active"></div>
        <div class="step-dot"></div>
      </div>

      <!-- STEP 1: Details -->
      <div class="form-step active" id="step1">
        <div class="form-row">
          <div class="form-group">
            <label><span class="label-icon">👤</span> Full Name</label>
            <input type="text" id="fullName" required placeholder="Your Name">
          </div>
          <div class="form-group">
            <label><span class="label-icon">📱</span> Mobile</label>
            <input type="tel" id="mobileNumber" required placeholder="10-digit number" pattern="[0-9]{10,15}">
          </div>
        </div>

        ${emailField}

        <div class="form-row">
          <div class="form-group">
            <label><span class="label-icon">📅</span> Trek Date</label>
            <input type="date" id="bookingDate" required>
          </div>
          <div class="form-group">
            <label><span class="label-icon">👥</span> People</label>
            <input type="number" id="participants" min="1" max="50" value="1" required>
          </div>
        </div>

        ${pricingField}

        <div class="btn-row">
          <button type="button" class="btn btn-next" id="nextBtn">Review Booking →</button>
        </div>
      </div>

      <!-- STEP 2: Review & Pay -->
      <div class="form-step" id="step2">
        <div style="margin-bottom:0.75rem; font-size:0.8rem; text-transform:uppercase; letter-spacing:0.08em; color:rgba(255,255,255,0.5);">Review Your Booking</div>

        <!-- Payment Options Selector -->
        <div class="payment-options-selector" style="background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.08); border-radius: 12px; padding: 1rem; margin-bottom: 1rem; display: flex; flex-direction: column; gap: 0.75rem;">
          <div style="font-size: 0.75rem; text-transform: uppercase; letter-spacing: 0.05em; color: rgba(255,255,255,0.6); font-weight: bold; margin-bottom: 0.25rem;">Choose Payment Mode</div>
          <div style="display: flex; gap: 1rem; flex-wrap: wrap;">
            <label style="flex: 1; min-width: 140px; display: flex; align-items: center; gap: 0.5rem; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,215,0,0.4); border-radius: 8px; padding: 0.75rem; cursor: pointer; transition: all 0.2s;" id="labelPayAdvance">
              <input type="radio" name="paymentOption" value="advance" checked style="cursor: pointer; accent-color: var(--hh-gold);">
              <div style="display: flex; flex-direction: column;">
                <span style="font-size: 0.85rem; font-weight: 700; color: #fff;">30% Advance</span>
                <span style="font-size: 0.65rem; color: rgba(255,255,255,0.5);">Secure booking now</span>
              </div>
            </label>
            <label style="flex: 1; min-width: 140px; display: flex; align-items: center; gap: 0.5rem; background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.08); border-radius: 8px; padding: 0.75rem; cursor: pointer; transition: all 0.2s;" id="labelPayFull">
              <input type="radio" name="paymentOption" value="full" style="cursor: pointer; accent-color: var(--hh-gold);">
              <div style="display: flex; flex-direction: column;">
                <span style="font-size: 0.85rem; font-weight: 700; color: #fff;">100% Full Payment</span>
                <span style="font-size: 0.65rem; color: rgba(255,255,255,0.5);">Pay complete amount</span>
              </div>
            </label>
          </div>
        </div>

        <div class="price-panel" style="margin-top: 0;">
          <div class="price-row">
            <span class="price-label">👤 Name</span>
            <span class="price-value" id="reviewName">—</span>
          </div>
          <div class="price-row">
            <span class="price-label">📱 Mobile</span>
            <span class="price-value" id="reviewMobile">—</span>
          </div>
          <div class="price-row">
            <span class="price-label">📧 Email</span>
            <span class="price-value" id="reviewEmail">—</span>
          </div>
          <div class="price-row">
            <span class="price-label">📅 Date</span>
            <span class="price-value" id="reviewDate">—</span>
          </div>
        </div>

        <div class="price-panel">
          <div class="price-row">
            <span class="price-label">💰 Per Head</span>
            <span class="price-value" id="perHeadDisplay">${formatINR(config.basePrice || 0)}</span>
          </div>
          <div class="price-row">
            <span class="price-label">👥 Participants</span>
            <span class="price-value" id="participantsDisplay">1 person</span>
          </div>
          <div class="price-row">
            <span class="price-label">💵 Total Cost</span>
            <span class="price-value" id="totalDisplay">${formatINR(config.basePrice || 0)}</span>
          </div>
          <div class="price-divider"></div>
          <div class="price-row total" style="color: var(--hh-gold);">
            <span class="price-label" id="onlinePaidLabel">Advance Paid Now (30%)</span>
            <span class="price-value" id="advanceDisplay">₹0</span>
          </div>
          <div class="price-row" style="font-size: 0.9rem; opacity: 0.8;">
            <span class="price-label">Balance Due on Departure</span>
            <span class="price-value" id="balanceDisplay">₹0</span>
          </div>
        </div>

        <div class="btn-row">
          <button type="button" class="btn btn-back" id="backBtn">←</button>
          <button type="button" class="btn btn-pay" id="payBtn">💳 Pay Advance ${formatINR(Math.round((config.basePrice || 0) * 0.30))}</button>
        </div>

        <div class="secure-badge">
          <svg viewBox="0 0 24 24"><path d="M12 2L3 7v5c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V7l-9-5z"/></svg>
          Secured by Razorpay • 256-bit SSL Encryption
        </div>
      </div>
    `;
  }

  // ——————— Init ———————
  function init(cfg) {
    config = cfg;

    userEmail = localStorage.getItem('userEmail');
    if (!userEmail) {
      showLoginGate();
    } else {
      isGuestMode = false;
      startBookingFlow();
    }
  }

  function startBookingFlow() {
    initParticles();
    setMinDate();

    // Build the form inside the container
    const formContainer = $('#booking-form-container');
    if (formContainer) {
      buildForm(formContainer);
    }

    // Reset default paymentMode
    paymentMode = 'advance';

    // Bind events
    const nextBtn = $('#nextBtn');
    const backBtn = $('#backBtn');
    const payBtn = $('#payBtn');

    if (nextBtn) nextBtn.addEventListener('click', () => goToStep(1));
    if (backBtn) backBtn.addEventListener('click', () => goToStep(0));
    if (payBtn) payBtn.addEventListener('click', () => initiatePayment());

    // Bind payment mode selector radios
    const paymentRadios = $$('input[name="paymentOption"]');
    paymentRadios.forEach(radio => {
      radio.addEventListener('change', (e) => {
        paymentMode = e.target.value;
        updatePrice();
        
        // Highlight active radio label
        const advanceLabel = $('#labelPayAdvance');
        const fullLabel = $('#labelPayFull');
        if (paymentMode === 'advance') {
          if (advanceLabel) {
            advanceLabel.style.borderColor = 'rgba(255, 215, 0, 0.4)';
            advanceLabel.style.background = 'rgba(255, 255, 255, 0.05)';
          }
          if (fullLabel) {
            fullLabel.style.borderColor = 'rgba(255, 255, 255, 0.08)';
            fullLabel.style.background = 'rgba(255, 255, 255, 0.02)';
          }
        } else {
          if (advanceLabel) {
            advanceLabel.style.borderColor = 'rgba(255, 255, 255, 0.08)';
            advanceLabel.style.background = 'rgba(255, 255, 255, 0.02)';
          }
          if (fullLabel) {
            fullLabel.style.borderColor = 'rgba(255, 215, 0, 0.4)';
            fullLabel.style.background = 'rgba(255, 255, 255, 0.05)';
          }
        }
      });
    });

    // Price updates
    const participants = $('#participants');
    if (participants) participants.addEventListener('input', () => {
      updatePrice();
    });

    if (config.pricingType === 'select') {
      const tripType = $('#tripType');
      if (tripType) tripType.addEventListener('change', () => {
        updatePrice();
      });
    }

    if (config.pricingType === 'transport') {
      const trans = $('#transportation');
      if (trans) trans.addEventListener('change', () => {
        updatePrice();
      });
    }

    updatePrice();
  }

  return { init };
})();
