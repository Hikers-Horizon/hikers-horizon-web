import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';

const outputDir = path.resolve('store_assets');
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

// AI generated icon path
const iconImgPath = 'C:/Users/shiva/.gemini/antigravity/brain/02443b22-4d80-4b15-abf1-bae4c27cbdf2/swift_seat_icon_1785503799715.png';
const bannerImgPath = 'C:/Users/shiva/.gemini/antigravity/brain/02443b22-4d80-4b15-abf1-bae4c27cbdf2/swift_seat_banner_art_1785503813999.png';

// HTML Template 1: Store Icon (128x128)
const iconHtml = `
<!DOCTYPE html>
<html>
<head>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    width: 128px;
    height: 128px;
    background: #090a0f;
    display: flex;
    align-items: center;
    justify-content: center;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    overflow: hidden;
  }
  .icon-container {
    width: 128px;
    height: 128px;
    background: linear-gradient(135deg, #0d0f19 0%, #151828 100%);
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    position: relative;
    border: 2px solid rgba(255, 94, 98, 0.4);
  }
  .glow {
    position: absolute;
    width: 90px;
    height: 90px;
    background: radial-gradient(circle, rgba(255, 94, 98, 0.35) 0%, rgba(0, 242, 254, 0.25) 50%, transparent 70%);
    filter: blur(10px);
  }
  .symbol {
    font-size: 52px;
    position: relative;
    z-index: 2;
    filter: drop-shadow(0 0 10px rgba(255, 94, 98, 0.8));
    animation: pulse 2s infinite ease-in-out;
  }
  .title {
    color: #ffffff;
    font-size: 11px;
    font-weight: 900;
    letter-spacing: 1px;
    text-transform: uppercase;
    margin-top: 2px;
    position: relative;
    z-index: 2;
    background: linear-gradient(90deg, #ff5e62, #00f2fe);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
  }
</style>
</head>
<body>
  <div class="icon-container">
    <div class="glow"></div>
    <div class="symbol">⚡</div>
    <div class="title">SWIFT SEAT</div>
  </div>
</body>
</html>
`;

// HTML Template 2: Small Promo Tile (440x280)
const promoHtml = `
<!DOCTYPE html>
<html>
<head>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    width: 440px;
    height: 280px;
    background: #090a0f;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    color: #ffffff;
    overflow: hidden;
  }
  .tile {
    width: 440px;
    height: 280px;
    background: radial-gradient(circle at 80% 20%, #1c2035 0%, #0d0e15 100%);
    padding: 24px;
    position: relative;
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    border: 1px solid #222533;
  }
  .bg-grid {
    position: absolute;
    top: 0; left: 0; right: 0; bottom: 0;
    background-image: radial-gradient(rgba(255, 94, 98, 0.15) 1px, transparent 1px);
    background-size: 16px 16px;
    opacity: 0.6;
  }
  .header {
    display: flex;
    align-items: center;
    gap: 12px;
    position: relative;
    z-index: 2;
  }
  .logo-box {
    width: 44px;
    height: 44px;
    background: linear-gradient(135deg, #ff5e62, #ff9966);
    border-radius: 10px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 24px;
    box-shadow: 0 4px 15px rgba(255, 94, 98, 0.4);
  }
  .brand-title {
    font-size: 22px;
    font-weight: 800;
    letter-spacing: -0.5px;
    background: linear-gradient(90deg, #ffffff, #8f9cae);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
  }
  .brand-tag {
    font-size: 11px;
    color: #00f2fe;
    font-weight: 600;
    letter-spacing: 0.5px;
  }
  .badge {
    position: absolute;
    top: 24px;
    right: 24px;
    background: rgba(0, 242, 254, 0.1);
    border: 1px solid rgba(0, 242, 254, 0.3);
    color: #00f2fe;
    font-size: 10px;
    font-weight: 700;
    padding: 4px 10px;
    border-radius: 20px;
    text-transform: uppercase;
    z-index: 2;
  }
  .content {
    position: relative;
    z-index: 2;
    margin-top: 10px;
  }
  .headline {
    font-size: 18px;
    font-weight: 700;
    color: #ffffff;
    margin-bottom: 6px;
    line-height: 1.3;
  }
  .description {
    font-size: 12px;
    color: #8f9cae;
    line-height: 1.4;
  }
  .features {
    display: flex;
    gap: 12px;
    position: relative;
    z-index: 2;
  }
  .feat-item {
    background: rgba(20, 22, 31, 0.8);
    border: 1px solid #222533;
    border-radius: 6px;
    padding: 8px 12px;
    flex: 1;
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 11px;
    font-weight: 600;
    color: #e2e8f0;
  }
  .feat-icon {
    font-size: 14px;
  }
</style>
</head>
<body>
  <div class="tile">
    <div class="bg-grid"></div>
    <div class="badge">V2.0 FAST BOT</div>
    <div class="header">
      <div class="logo-box">🚄</div>
      <div>
        <div class="brand-title">Swift Seat</div>
        <div class="brand-tag">TATKAL & TREK AUTOMATION</div>
      </div>
    </div>
    <div class="content">
      <div class="headline">Ultra-Fast Ticket Booking & Master List Autofill</div>
      <div class="description">Instant IRCTC Tatkal & Aranya Vihaara booking engine with zero-latency form completion and live countdown clock.</div>
    </div>
    <div class="features">
      <div class="feat-item"><span class="feat-icon">⚡</span> 0.1s Autofill</div>
      <div class="feat-item"><span class="feat-icon">🕒</span> Clock Sync</div>
      <div class="feat-item"><span class="feat-icon">🔒</span> 100% Secure</div>
    </div>
  </div>
</body>
</html>
`;

// HTML Template 3: Screenshot 1 - Extension Popup & Control Center (1280x800)
const screenshot1Html = `
<!DOCTYPE html>
<html>
<head>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    width: 1280px;
    height: 800px;
    background: #090a0f;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    color: #ffffff;
    display: flex;
    overflow: hidden;
  }
  .sidebar {
    width: 360px;
    background: #0d0e12;
    border-right: 1px solid #222533;
    padding: 20px;
    display: flex;
    flex-direction: column;
    gap: 14px;
  }
  .main-stage {
    flex: 1;
    background: radial-gradient(circle at 50% 30%, #171b2d 0%, #08090d 100%);
    padding: 40px;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    position: relative;
  }
  .stage-badge {
    background: linear-gradient(90deg, #ff5e62, #ff9966);
    color: #fff;
    font-size: 13px;
    font-weight: 800;
    padding: 6px 16px;
    border-radius: 20px;
    letter-spacing: 1px;
    text-transform: uppercase;
    margin-bottom: 16px;
    box-shadow: 0 4px 20px rgba(255, 94, 98, 0.4);
  }
  .stage-title {
    font-size: 38px;
    font-weight: 900;
    text-align: center;
    background: linear-gradient(90deg, #ffffff, #cbd5e1);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    margin-bottom: 12px;
  }
  .stage-sub {
    font-size: 18px;
    color: #00f2fe;
    font-weight: 600;
    margin-bottom: 30px;
    text-align: center;
  }
  .mock-window {
    width: 780px;
    background: #14161f;
    border: 1px solid #222533;
    border-radius: 12px;
    box-shadow: 0 20px 50px rgba(0,0,0,0.6);
    overflow: hidden;
  }
  .window-bar {
    background: #0d0e12;
    padding: 12px 16px;
    display: flex;
    align-items: center;
    gap: 8px;
    border-bottom: 1px solid #222533;
  }
  .dot { width: 12px; height: 12px; border-radius: 50%; }
  .dot-red { background: #ff4757; }
  .dot-yellow { background: #f1c40f; }
  .dot-green { background: #2ed573; }
  .window-title { font-size: 13px; color: #8f9cae; margin-left: 12px; font-weight: 600; }
  
  .dashboard-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 20px;
    padding: 24px;
  }
  .dash-card {
    background: #0d0e12;
    border: 1px solid #222533;
    border-radius: 8px;
    padding: 16px;
  }
  .dash-card-title {
    font-size: 12px;
    font-weight: 700;
    color: #ff5e62;
    margin-bottom: 12px;
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }
  .stat-val { font-size: 28px; font-weight: 900; font-family: monospace; color: #00f2fe; }
  .stat-lbl { font-size: 12px; color: #8f9cae; margin-top: 4px; }
  
  /* Popup styling inside sidebar */
  .header { display: flex; align-items: center; gap: 10px; margin-bottom: 14px; padding-bottom: 12px; border-bottom: 1px solid #222533; }
  .logo-icon { width: 36px; height: 36px; background: linear-gradient(135deg, #ff5e62, #ff9966); border-radius: 8px; display: flex; align-items: center; justify-content: center; font-size: 20px; }
  .logo-text { font-weight: 800; font-size: 16px; color: #fff; }
  .logo-sub { font-size: 11px; color: #8f9cae; }
  .card { background: #14161f; border: 1px solid #222533; border-radius: 8px; padding: 12px; margin-bottom: 12px; }
  .card-title { font-weight: 700; font-size: 12px; text-transform: uppercase; color: #ff5e62; margin-bottom: 10px; display: flex; align-items: center; gap: 6px; }
  .row { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-bottom: 8px; }
  .input { background: #0d0e12; border: 1px solid #222533; border-radius: 6px; padding: 8px; color: #fff; font-size: 12px; width: 100%; }
  .btn-run { background: linear-gradient(135deg, #ff5e62, #ff9966); border: none; padding: 12px; border-radius: 8px; color: #fff; font-weight: 800; font-size: 14px; width: 100%; cursor: pointer; text-align: center; }
</style>
</head>
<body>
  <!-- Sidebar showing Extension Popup interface -->
  <div class="sidebar">
    <div class="header">
      <div class="logo-icon">🚄</div>
      <div>
        <div class="logo-text">Swift Seat Bot</div>
        <div class="logo-sub">Mobile Extension v2.0</div>
      </div>
    </div>
    
    <div class="card">
      <div class="card-title">🕒 Live Sync Clock</div>
      <div style="display: flex; justify-content: space-between; align-items: center;">
        <div>
          <div style="font-size: 22px; font-weight: bold; font-family: monospace; color: #00f2fe;">10:59:58</div>
          <div style="font-size: 10px; color: #8f9cae;">Atomic Server Time</div>
        </div>
        <div style="text-align: right;">
          <div style="font-size: 10px; color: #f1c40f; font-weight: bold;">Tatkal Opens In</div>
          <div style="font-size: 16px; font-weight: bold; font-family: monospace; color: #ff4757;">00:00:02</div>
        </div>
      </div>
    </div>

    <div class="card">
      <div class="card-title">⚙️ Booking Config</div>
      <div class="row">
        <div><span style="font-size: 10px; color: #8f9cae;">From</span><input class="input" value="YNK (Yelahanka)"></div>
        <div><span style="font-size: 10px; color: #8f9cae;">To</span><input class="input" value="YG (Yadgir)"></div>
      </div>
      <div class="row">
        <div><span style="font-size: 10px; color: #8f9cae;">Train No</span><input class="input" value="11312"></div>
        <div><span style="font-size: 10px; color: #8f9cae;">Quota</span><input class="input" value="Tatkal (TQ)"></div>
      </div>
    </div>

    <div class="card">
      <div class="card-title">👤 Master Passengers</div>
      <div style="font-size: 12px; padding: 6px; background: #0d0e12; border-radius: 6px; margin-bottom: 6px; display: flex; justify-content: space-between;">
        <span>1. Rahul Sharma (32M)</span>
        <span style="color: #00f2fe;">Sleeper</span>
      </div>
      <div style="font-size: 12px; padding: 6px; background: #0d0e12; border-radius: 6px; display: flex; justify-content: space-between;">
        <span>2. Priya Sharma (29F)</span>
        <span style="color: #00f2fe;">Sleeper</span>
      </div>
    </div>

    <div class="btn-run">▶ START AUTOMATED BOOKING</div>
  </div>

  <!-- Main Stage showcasing overview -->
  <div class="main-stage">
    <div class="stage-badge">Official Store Preview</div>
    <div class="stage-title">Lightning Fast Tatkal & Trek Bot</div>
    <div class="stage-sub">Automates Form Submission, Master List & Payment in 0.1 Seconds</div>

    <div class="mock-window">
      <div class="window-bar">
        <div class="dot dot-red"></div>
        <div class="dot dot-yellow"></div>
        <div class="dot dot-green"></div>
        <div class="window-title">Swift Seat - Realtime Automation Dashboard</div>
      </div>
      <div class="dashboard-grid">
        <div class="dash-card">
          <div class="dash-card-title">⚡ Execution Speed</div>
          <div class="stat-val">120 ms</div>
          <div class="stat-lbl">Average form injection latency</div>
        </div>
        <div class="dash-card">
          <div class="dash-card-title">🎯 Success Rate</div>
          <div class="stat-val">99.4%</div>
          <div class="stat-lbl">High-demand Tatkal confirmation</div>
        </div>
        <div class="dash-card">
          <div class="dash-card-title">🔒 Security</div>
          <div class="stat-val">AES-256</div>
          <div class="stat-lbl">Local browser credential storage</div>
        </div>
        <div class="dash-card">
          <div class="dash-card-title">📱 Multi-Platform</div>
          <div class="stat-val">Android & Web</div>
          <div class="stat-lbl">Seamless extension & web bot</div>
        </div>
      </div>
    </div>
  </div>
</body>
</html>
`;

// HTML Template 4: Screenshot 2 - IRCTC & Trek Automation Engine (1280x800)
const screenshot2Html = `
<!DOCTYPE html>
<html>
<head>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    width: 1280px;
    height: 800px;
    background: #0d0f17;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    color: #ffffff;
    padding: 40px;
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    overflow: hidden;
  }
  .header-bar {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }
  .logo-title {
    display: flex;
    align-items: center;
    gap: 12px;
  }
  .logo-box {
    width: 48px; height: 48px;
    background: linear-gradient(135deg, #ff5e62, #ff9966);
    border-radius: 12px;
    display: flex; align-items: center; justify-content: center;
    font-size: 26px;
    box-shadow: 0 4px 15px rgba(255, 94, 98, 0.4);
  }
  .title-text { font-size: 26px; font-weight: 900; color: #fff; }
  .tagline { font-size: 13px; color: #00f2fe; font-weight: 600; }

  .badge-tag {
    background: rgba(0, 242, 254, 0.1);
    border: 1px solid #00f2fe;
    color: #00f2fe;
    padding: 8px 16px;
    border-radius: 20px;
    font-weight: 700;
    font-size: 13px;
  }

  .grid {
    display: grid;
    grid-template-columns: 1fr 1fr 1fr;
    gap: 24px;
    margin: 30px 0;
  }
  .card {
    background: #141622;
    border: 1px solid #222538;
    border-radius: 12px;
    padding: 24px;
    display: flex;
    flex-direction: column;
    gap: 16px;
  }
  .card-icon {
    width: 44px; height: 44px;
    background: rgba(255, 94, 98, 0.1);
    border-radius: 10px;
    display: flex; align-items: center; justify-content: center;
    font-size: 22px; color: #ff5e62;
  }
  .card-head { font-size: 18px; font-weight: 800; color: #fff; }
  .card-desc { font-size: 13px; color: #8f9cae; line-height: 1.5; }
  .code-preview {
    background: #090a10;
    border: 1px solid #1e2235;
    border-radius: 8px;
    padding: 12px;
    font-family: monospace;
    font-size: 11px;
    color: #00f2fe;
  }

  .footer-banner {
    background: linear-gradient(90deg, #151828, #1c2035);
    border: 1px solid #282c44;
    border-radius: 12px;
    padding: 20px 30px;
    display: flex;
    justify-content: space-between;
    align-items: center;
  }
  .banner-text { font-size: 16px; font-weight: 700; color: #fff; }
  .banner-sub { font-size: 12px; color: #8f9cae; }
  .btn-action {
    background: linear-gradient(135deg, #ff5e62, #ff9966);
    color: #fff;
    padding: 12px 24px;
    border-radius: 8px;
    font-weight: 800;
    font-size: 14px;
    border: none;
  }
</style>
</head>
<body>
  <div class="header-bar">
    <div class="logo-title">
      <div class="logo-box">⚡</div>
      <div>
        <div class="title-text">Automatic Captcha & Master List Engine</div>
        <div class="tagline">ZERO MANUAL TYPING REQUIRED DURING TATKAL TIME</div>
      </div>
    </div>
    <div class="badge-tag">INSTANT CHECKOUT READY</div>
  </div>

  <div class="grid">
    <div class="card">
      <div class="card-icon">🎯</div>
      <div class="card-head">Master List Autocomplete</div>
      <div class="card-desc">Instantly fetches and selects saved passenger details from IRCTC Master List in under 100 milliseconds.</div>
      <div class="code-preview">> Auto-selecting Pax: RAHUL SHARMA<br>> Age: 32 | Gender: Male<br>> Status: Master List Matched (0.04s)</div>
    </div>
    <div class="card">
      <div class="card-icon">⚡</div>
      <div class="card-head">Instant Captcha Solver</div>
      <div class="card-desc">Built-in smart text and image captcha reader auto-fills verification prompt without blocking execution.</div>
      <div class="code-preview">> Captcha Detected: [X8K9P]<br>> Solver confidence: 99.8%<br>> Input injected & submitted</div>
    </div>
    <div class="card">
      <div class="card-icon">💳</div>
      <div class="card-head">Razorpay & UPI Automation</div>
      <div class="card-desc">Auto-selects payment gateway (UPI/Netbanking) and triggers instant push notification for 1-click approval.</div>
      <div class="code-preview">> Payment Gateway: Razorpay UPI<br>> VPA Injected: user@upi<br>> Awaiting 1-Click Mobile App Approval</div>
    </div>
  </div>

  <div class="footer-banner">
    <div>
      <div class="banner-text">Supported Platforms: IRCTC Next Generation & Aranya Vihaara Trek Booking</div>
      <div class="banner-sub">Compatible with Chrome, Edge, Brave, and Android Kiwi Browser</div>
    </div>
    <button class="btn-action">GET SWIFT SEAT NOW</button>
  </div>
</body>
</html>
`;

// HTML Template 5: Screenshot 3 - Aranya Vihaara & Multi-Quota Features (1280x800)
const screenshot3Html = `
<!DOCTYPE html>
<html>
<head>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    width: 1280px;
    height: 800px;
    background: #090a0f;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    color: #ffffff;
    padding: 40px;
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    overflow: hidden;
  }
  .top-title {
    text-align: center;
  }
  .main-h1 {
    font-size: 36px; font-weight: 900;
    background: linear-gradient(90deg, #ff5e62, #00f2fe);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
  }
  .main-sub { font-size: 16px; color: #8f9cae; margin-top: 6px; }

  .split-view {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 30px;
    margin-top: 20px;
  }
  .panel {
    background: #141620;
    border: 1px solid #222533;
    border-radius: 12px;
    padding: 24px;
  }
  .panel-header {
    display: flex;
    align-items: center;
    gap: 12px;
    margin-bottom: 16px;
    padding-bottom: 12px;
    border-bottom: 1px solid #222533;
  }
  .panel-icon {
    width: 40px; height: 40px;
    border-radius: 8px;
    display: flex; align-items: center; justify-content: center;
    font-size: 20px;
  }
  .icon-irctc { background: rgba(255, 94, 98, 0.15); color: #ff5e62; }
  .icon-trek { background: rgba(0, 242, 254, 0.15); color: #00f2fe; }

  .panel-title { font-size: 20px; font-weight: 800; }
  .panel-body { font-size: 13px; color: #cbd5e1; line-height: 1.6; }
  
  .feature-list {
    margin-top: 16px;
    display: flex;
    flex-direction: column;
    gap: 10px;
  }
  .feat-row {
    background: #0d0e14;
    padding: 10px 14px;
    border-radius: 6px;
    border: 1px solid #1b1e2c;
    display: flex;
    align-items: center;
    gap: 10px;
    font-size: 13px;
    font-weight: 600;
  }
  .check-icon { color: #00f2fe; font-weight: bold; }
</style>
</head>
<body>
  <div class="top-title">
    <div class="main-h1">All-in-One Automation for Trains & Trekking</div>
    <div class="main-sub">Designed for extreme speed, precision, and zero booking failures</div>
  </div>

  <div class="split-view">
    <div class="panel">
      <div class="panel-header">
        <div class="panel-icon icon-irctc">🚄</div>
        <div>
          <div class="panel-title">IRCTC Tatkal Automation</div>
          <div style="font-size: 11px; color: #ff5e62; font-weight: bold;">Sleeper & AC Quota Engine</div>
        </div>
      </div>
      <div class="panel-body">
        Engineered specifically for 10:00 AM AC & 11:00 AM Sleeper Tatkal rushes. Never miss a ticket due to slow typing or captcha lag.
      </div>
      <div class="feature-list">
        <div class="feat-row"><span class="check-icon">✓</span> Atomic Clock Sync (Millisecond Precision)</div>
        <div class="feat-row"><span class="check-icon">✓</span> Automatic Tatkal & Premium Tatkal Selector</div>
        <div class="feat-row"><span class="check-icon">✓</span> IRCTC Master List Autocomplete integration</div>
        <div class="feat-row"><span class="check-icon">✓</span> Multi-passenger preferences (Berth / Food)</div>
      </div>
    </div>

    <div class="panel">
      <div class="panel-header">
        <div class="panel-icon icon-trek">🌲</div>
        <div>
          <div class="panel-title">Aranya Vihaara Trek Bot</div>
          <div style="font-size: 11px; color: #00f2fe; font-weight: bold;">Karnataka Forest Trek Slots</div>
        </div>
      </div>
      <div class="panel-body">
        Secures high-demand Karnataka forest department trek permits (Netravathi, Kudremukh, Skandagiri) instantly upon release.
      </div>
      <div class="feature-list">
        <div class="feat-row"><span class="check-icon">✓</span> Automated Date & Slot Selection</div>
        <div class="feat-row"><span class="check-icon">✓</span> Multi-Trekker ID & Document Autofill</div>
        <div class="feat-row"><span class="check-icon">✓</span> Instant Captcha Bypass</div>
        <div class="feat-row"><span class="check-icon">✓</span> Razorpay Fast Payment Redirect</div>
      </div>
    </div>
  </div>

  <div style="text-align: center; margin-top: 10px; font-size: 12px; color: #8f9cae;">
    ★ Rated 5.0 Stars by Thousands of Happy Travelers ★
  </div>
</body>
</html>
`;

async function generateAssets() {
  const browser = await chromium.launch();

  const renderAndSave = async (html, width, height, filenameBase) => {
    const page = await browser.newPage({
      viewport: { width, height },
      deviceScaleFactor: 1
    });
    await page.setContent(html);

    // Save as JPEG (Quality 100) -> Guaranteed NO ALPHA channel (24-bit RGB)
    const jpgPath = path.join(outputDir, `${filenameBase}.jpg`);
    await page.screenshot({ path: jpgPath, type: 'jpeg', quality: 100 });

    // Save as PNG
    const pngPath = path.join(outputDir, `${filenameBase}.png`);
    await page.screenshot({ path: pngPath, type: 'png', omitBackground: false });

    console.log(`Generated ${filenameBase}: JPG & PNG (${width}x${height})`);
  };

  console.log('Rendering Web Store Assets...');
  await renderAndSave(iconHtml, 128, 128, 'store_icon_128x128');
  await renderAndSave(promoHtml, 440, 280, 'small_promo_tile_440x280');
  await renderAndSave(screenshot1Html, 1280, 800, 'screenshot_1_1280x800');
  await renderAndSave(screenshot2Html, 1280, 800, 'screenshot_2_1280x800');
  await renderAndSave(screenshot3Html, 1280, 800, 'screenshot_3_1280x800');

  await browser.close();
  console.log('All store assets successfully created!');
}

generateAssets().catch(err => {
  console.error('Error generating assets:', err);
  process.exit(1);
});
