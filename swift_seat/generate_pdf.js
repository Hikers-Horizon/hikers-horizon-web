import { chromium } from 'playwright';
import path from 'path';

const htmlContent = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <title>Swift Seat - Simple User Guide</title>
    <style>
        @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700&display=swap');
        
        body {
            font-family: 'Outfit', sans-serif;
            color: #334155;
            background: #ffffff;
            line-height: 1.5;
            margin: 0;
            padding: 30px;
        }

        .header {
            background: linear-gradient(135deg, #1e3a8a 0%, #3b82f6 100%);
            padding: 24px;
            border-radius: 12px;
            color: #ffffff;
            margin-bottom: 25px;
        }

        .logo-text {
            font-size: 26px;
            font-weight: 700;
            letter-spacing: -0.02em;
            margin: 0;
        }

        .subtitle {
            font-size: 13px;
            color: #bfdbfe;
            margin-top: 4px;
            font-weight: 400;
        }

        h1 {
            font-size: 22px;
            color: #0f172a;
            margin: 0 0 12px;
            font-weight: 700;
        }

        .intro {
            font-size: 14px;
            color: #475569;
            margin-bottom: 20px;
        }

        /* Roles Summary Grid */
        .role-summary {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 15px;
            margin-bottom: 25px;
        }

        .role-box {
            padding: 16px;
            border-radius: 10px;
            font-size: 13px;
        }

        .role-box-bot {
            background-color: #eff6ff;
            border: 1px solid #bfdbfe;
        }

        .role-box-bot h3 {
            color: #1e40af;
            margin: 0 0 8px 0;
            font-size: 14px;
            font-weight: 600;
        }

        .role-box-user {
            background-color: #fff7ed;
            border: 1px solid #ffedd5;
        }

        .role-box-user h3 {
            color: #c2410c;
            margin: 0 0 8px 0;
            font-size: 14px;
            font-weight: 600;
        }

        .role-list {
            margin: 0;
            padding-left: 18px;
        }

        .role-list li {
            margin-bottom: 4px;
            color: #334155;
        }

        /* Steps Layout */
        .steps-container {
            display: flex;
            flex-direction: column;
            gap: 14px;
            margin-bottom: 25px;
        }

        .step-card {
            display: flex;
            background: #f8fafc;
            border: 1px solid #e2e8f0;
            border-radius: 10px;
            padding: 16px;
            align-items: flex-start;
            gap: 16px;
        }

        .step-number {
            background: #3b82f6;
            color: #ffffff;
            width: 32px;
            height: 32px;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            font-weight: 700;
            font-size: 15px;
            flex-shrink: 0;
        }

        .step-content {
            flex-grow: 1;
        }

        .step-title {
            font-size: 15px;
            font-weight: 600;
            color: #0f172a;
            margin: 0 0 4px 0;
            display: flex;
            align-items: center;
            gap: 8px;
        }

        .step-desc {
            font-size: 13px;
            color: #475569;
            margin: 0;
        }

        .badge-bot {
            background-color: #dbeafe;
            color: #1e40af;
            font-size: 10px;
            padding: 2px 8px;
            border-radius: 50px;
            font-weight: 600;
        }

        .badge-user {
            background-color: #fee2e2;
            color: #991b1b;
            font-size: 10px;
            padding: 2px 8px;
            border-radius: 50px;
            font-weight: 600;
            border: 1px solid #fca5a5;
        }

        /* Highlighting critical manual action */
        .step-card.user-action {
            border: 2px solid #f97316;
            background: #fffaf5;
        }
        .step-card.user-action .step-number {
            background: #f97316;
        }

        /* Tips section */
        .tips-section {
            background: #f0fdf4;
            border: 1px solid #bbf7d0;
            border-radius: 10px;
            padding: 16px;
        }

        .tips-title {
            color: #166534;
            font-weight: 600;
            font-size: 14px;
            margin: 0 0 8px 0;
        }

        .tips-list {
            margin: 0;
            padding-left: 18px;
            font-size: 13px;
            color: #14532d;
        }

        .tips-list li {
            margin-bottom: 4px;
        }

        @media print {
            body {
                padding: 10px;
            }
        }
    </style>
</head>
<body>
    <div class="header">
        <h2 class="logo-text">SWIFT SEAT</h2>
        <div class="subtitle">Easy Guide to Ticket Booking (Manual + Bot Hybrid)</div>
    </div>

    <h1>How to Book Your Ticket Easily</h1>
    <p class="intro">To make sure the website does not block you, the bot automatically fills all passenger details, but leaves the train reservation class click for you. Follow these simple steps for a successful booking.</p>

    <!-- Roles Division -->
    <div class="role-summary">
        <div class="role-box role-box-bot">
            <h3>🤖 What the Bot Does (Automatic)</h3>
            <ul class="role-list">
                <li>Enters from & to stations on the search page.</li>
                <li>Finds your train and scrolls to it.</li>
                <li>Injects all passenger names, ages, and genders instantly.</li>
            </ul>
        </div>
        
        <div class="role-box role-box-user">
            <h3>👤 What You Must Do (Manual)</h3>
            <ul class="role-list">
                <li>Log in with your Password/Captcha if asked.</li>
                <li><strong>Click on Sleeper/AC and click 'Book Now'.</strong></li>
                <li>Select your preferred payment method on the form.</li>
                <li>Type the Captcha and complete the payment.</li>
            </ul>
        </div>
    </div>

    <!-- Clear Step Cards -->
    <div class="steps-container">
        <div class="step-card">
            <div class="step-number">1</div>
            <div class="step-content">
                <div class="step-title">Set up Passenger List <span class="badge-user">USER STEP</span></div>
                <div class="step-desc">Open the Swift Seat extension in <strong>Microsoft Edge</strong> (Note: The extension works on Edge only; do not install it in Chrome), enter credentials, train codes (like YNK and YG), and add the list of passengers. Click <strong>Start Booking</strong>.</div>
            </div>
        </div>

        <div class="step-card">
            <div class="step-number">2</div>
            <div class="step-content">
                <div class="step-title">Log in & Search Setup <span class="badge-bot">BOT + LOG-IN</span></div>
                <div class="step-desc">The bot loads the search page. If you are logged out, enter Captcha. Once logged in, the bot sets stations and initiates the search.</div>
            </div>
        </div>

        <div class="step-card user-action">
            <div class="step-number">3</div>
            <div class="step-content">
                <div class="step-title">Select Class & Book Now <span class="badge-user">USER ACTION REQUIRED!</span></div>
                <div class="step-desc"><strong>This step is manual:</strong> The bot scrolls down to the correct train. You must immediately click Sleeper (SL) or AC class, then click <strong>Book Now</strong>. This bypasses IRCTC bot sensors.</div>
            </div>
        </div>

        <div class="step-card">
            <div class="step-number">4</div>
            <div class="step-content">
                <div class="step-title">Passenger Form autofill <span class="badge-bot">BOT AUTOMATION</span></div>
                <div class="step-desc">The bot automatically adds passenger rows, writes the names, ages, genders, and points you to the payment & Captcha blocks.</div>
            </div>
        </div>

        <div class="step-card">
            <div class="step-number">5</div>
            <div class="step-content">
                <div class="step-title">Select Payment, Solve Captcha & Pay <span class="badge-user">USER STEP</span></div>
                <div class="step-desc">Look at the details, select your preferred payment mode manually, type the Captcha text into the box, click Continue, and complete the transaction.</div>
            </div>
        </div>
    </div>

    <!-- Pro Tips -->
    <div class="tips-section">
        <div class="tips-title">💡 Pro-Tips for Success:</div>
        <ul class="tips-list">
            <li>Keep the extension dashboard filled in advance so that you don't waste time at Tatkal opening hours (10:00 AM / 11:00 AM).</li>
            <li>If the page gets stuck or hangs, simply refresh (F5 or reload). The bot will automatically pick up where it left off.</li>
            <li>Make sure your UPI app (like GPay, PhonePe, or Paytm) is open on your mobile to accept/pay instantly.</li>
        </ul>
    </div>
</body>
</html>
`;

async function main() {
    try {
        console.log('Rendering user-friendly PDF...');
        const browser = await chromium.launch({ headless: true });
        const context = await browser.newContext();
        const page = await context.newPage();
        
        await page.setContent(htmlContent);
        
        const pdfPath = path.resolve('Swift_Seat_User_Guide.pdf');
        
        console.log(`Generating PDF at: ${pdfPath}...`);
        await page.pdf({
            path: pdfPath,
            format: 'A4',
            printBackground: true,
            margin: {
                top: '20px',
                bottom: '20px',
                left: '20px',
                right: '20px'
            }
        });
        
        console.log('PDF generated successfully!');
        await browser.close();
    } catch (err) {
        console.error('Error rendering PDF:', err);
        process.exit(1);
    }
}

main();
