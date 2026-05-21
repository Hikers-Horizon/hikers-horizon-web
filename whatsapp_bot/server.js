/**
 * ╔══════════════════════════════════════════╗
 * ║   HIKERS HORIZON — WhatsApp Bot Server   ║
 * ║   Powered by whatsapp-web.js (QR Code)   ║
 * ╚══════════════════════════════════════════╝
 */

require("dotenv").config();
const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const fs = require("fs");
const path = require("path");
const { handleMessage } = require("./messageHandler");
const { initBroadcast } = require("./broadcast"); 
const { COMPANY_INFO } = require("./trekData");
const { isBlacklisted, addToBlacklist, removeFromBlacklist, getBlacklist, normalizeNumber } = require("./blacklist");

// --- LIVE LOG CAPTURE ---
const botLogs = [];
const MAX_LOGS = 100;
const originalLog = console.log;
const originalError = console.error;

function captureLog(type, ...args) {
    const msg = args.map(a => typeof a === 'object' ? JSON.stringify(a) : a).join(' ');
    const timestamp = new Date().toISOString();
    botLogs.push({ timestamp, type, message: msg });
    if (botLogs.length > MAX_LOGS) botLogs.shift();
}

console.log = function(...args) {
    captureLog('info', ...args);
    originalLog.apply(console, args);
};

console.error = function(...args) {
    captureLog('error', ...args);
    originalError.apply(console, args);
};

// --- CRASH PROTECTION (Global Error Handlers) ---
process.on('uncaughtException', (err) => {
    console.error('🔥 FATAL UNCAUGHT EXCEPTION:', err);
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('🔥 UNHANDLED PROMISE REJECTION:', reason);
});

// Get default admin number from company info
const defaultAdmin = COMPANY_INFO.phone ? COMPANY_INFO.phone.replace(/\D/g, "") : "";

// Admin numbers configured in .env or default to the company phone
const ADMIN_NUMBERS = (process.env.ADMIN_NUMBERS || defaultAdmin)
  .split(",")
  .map(num => num.trim().replace(/\D/g, ""))
  .filter(Boolean);

function isAdmin(number) {
  const cleanNum = normalizeNumber(number);
  return ADMIN_NUMBERS.some(admin => {
    if (cleanNum === admin) return true;
    if (cleanNum.length >= 10 && admin.length >= 10) {
      return cleanNum.slice(-10) === admin.slice(-10);
    }
    return false;
  });
} 

const CUSTOMERS_FILE = path.join(__dirname, "customers.json");

function saveCustomer(number) {
  try {
    let customers = [];
    if (fs.existsSync(CUSTOMERS_FILE)) {
        customers = JSON.parse(fs.readFileSync(CUSTOMERS_FILE, "utf8"));
    }
    if (!customers.includes(number)) {
      customers.push(number);
      fs.writeFileSync(CUSTOMERS_FILE, JSON.stringify(customers, null, 2));
      console.log(`👤 New customer saved: ${number}`);
    }
  } catch (err) {
    console.error("Error saving customer:", err.message);
  }
}

console.log("Initializing WhatsApp Client... Please wait.");

// Detect if running on Termux (Android)
const isAndroid = process.platform === 'android';

const client = new Client({
    authStrategy: new LocalAuth(),
    puppeteer: {
        executablePath: isAndroid ? '/data/data/com.termux/files/usr/bin/chromium-browser' : undefined,
        args: [
            '--no-sandbox', 
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-accelerated-2d-canvas',
            '--no-first-run',
            '--no-zygote',
            '--single-process',
            '--disable-gpu'
        ]
    }
});

// Status Tracking for Dashboard
let botStatus = "disconnected";
let latestQR = null;

client.on('qr', (qr) => {
    botStatus = "qr_ready";
    latestQR = qr;
    // Generate and scan this code with your phone
    console.log("\n=======================================================");
    console.log("📱 SCAN THE QR CODE BELOW WITH YOUR WHATSAPP APP");
    console.log("Go to: Settings > Linked Devices > Link a Device");
    console.log("=======================================================\n");
    qrcode.generate(qr, {small: true});
});

client.on('authenticated', () => {
    botStatus = "authenticated";
    latestQR = null;
    console.log('\n🔐 Authenticated successfully! Sychronizing chats (this may take a minute)...');
});

client.on('auth_failure', msg => {
    botStatus = "auth_failure";
    latestQR = null;
    console.error('\n❌ Authentication failed:', msg);
});

client.on('loading_screen', (percent, message) => {
    botStatus = `loading (${percent}%)`;
    console.log(`\n⏳ Loading Chats: ${percent}% - ${message}`);
});
// Track the time the bot goes live to prevent replying to historical messages sent when offline
let botReadyTime = Math.floor(Date.now() / 1000);

client.on('ready', () => {
    botStatus = "ready";
    latestQR = null;
    console.log('\n✅ Client is ready! Bot is now connected and running.');
    botReadyTime = Math.floor(Date.now() / 1000); // Update to exact ready time
    initBroadcast(client); // Start the weekend broadcast scheduler
});

client.on('message', async msg => {
    // Ignore status broadcasts and group messages
    if (msg.from === 'status@broadcast' || msg.from.includes('@g.us')) return;

    // Ignore messages sent by ourselves
    if (msg.fromMe) return;

    // Ignore historical/backlogged messages sent while the bot was offline
    if (msg.timestamp < botReadyTime) {
        console.log(`⏳ Ignored offline backlog message from ${msg.from.replace('@c.us', '')}`);
        return;
    }

    // The sender number (e.g., 919902653393@c.us)
    let from = msg.from;
    
    // Attempt to resolve real phone number if it's a hidden @lid (often happens in communities or certain privacy settings)
    if (from.includes('@lid')) {
        try {
            const contact = await msg.getContact();
            if (contact && contact.number) {
                from = `${contact.number}@c.us`;
            }
        } catch (e) {}
    }

    const text = msg.body;
    
    // Skip empty messages or media messages without body
    if (!text) return;
    
    const cleanText = text.trim();
    
    // Check if the sender is an admin and sent a blacklist command
    if (isAdmin(from)) {
        if (cleanText.toLowerCase().startsWith("!block ")) {
            const numToBlock = cleanText.substring(7).trim();
            const normalized = normalizeNumber(numToBlock);
            if (!normalized) {
                await client.sendMessage(from, "❌ *Error:* Invalid phone number provided.");
                return;
            }
            const added = addToBlacklist(normalized);
            if (added) {
                await client.sendMessage(from, `🚫 *Number Blacklisted:* ${normalized} will no longer receive replies from the bot.`);
                console.log(`🚫 Admin blacklisted number: ${normalized}`);
            } else {
                await client.sendMessage(from, `⚠️ *Note:* ${normalized} is already in the blacklist.`);
            }
            return;
        }
        
        if (cleanText.toLowerCase().startsWith("!unblock ")) {
            const numToUnblock = cleanText.substring(9).trim();
            const normalized = normalizeNumber(numToUnblock);
            if (!normalized) {
                await client.sendMessage(from, "❌ *Error:* Invalid phone number provided.");
                return;
            }
            const removed = removeFromBlacklist(normalized);
            if (removed) {
                await client.sendMessage(from, `✅ *Number Unblocked:* ${normalized} is removed from the blacklist.`);
                console.log(`✅ Admin unblocked number: ${normalized}`);
            } else {
                await client.sendMessage(from, `⚠️ *Note:* ${normalized} was not found in the blacklist.`);
            }
            return;
        }
        
        if (cleanText.toLowerCase() === "!blacklist" || cleanText.toLowerCase() === "!blocklist") {
            const list = getBlacklist();
            if (list.length === 0) {
                await client.sendMessage(from, "📝 *Blacklist is empty.*");
            } else {
                const formattedList = list.map((num, i) => `${i + 1}. ${num}`).join("\n");
                await client.sendMessage(from, `📝 *Blacklisted Numbers:*\n\n${formattedList}`);
            }
            return;
        }
    }
    
    // Extract raw number - preserve @lid if the real number couldn't be found so we can still message them later
    const rawNumber = from.includes('@lid') ? from : from.replace('@c.us', '');
    
    // Check if the sender is blacklisted
    if (await isBlacklisted(from)) {
        console.log(`🔕 Ignored blacklisted number: ${rawNumber}`);
        return;
    }
    
    saveCustomer(rawNumber);
    
    console.log(`\n📩 Received from ${rawNumber}: "${text}"`);
    
    // Pass 'from' to handleMessage for muting logic
    const replyText = handleMessage(text, from);
    
    // If replyText is null, it means the bot is muted for this user
    if (replyText) {
        try {
            await client.sendMessage(msg.from, replyText);
            console.log(`✅ Replied to ${rawNumber}`);
        } catch (err) {
            console.error("❌ Send Error:", err.message);
        }
    }
});

client.initialize();

// --- CLOUD SYNC ARCHITECTURE ---
const axios = require('axios');
const SYNC_URL = 'https://hikershorizon.in/api/bot/sync';

async function processCommands(commands) {
    for (const cmd of commands) {
        try {
            if (cmd.type === 'blacklist_add') {
                const normalized = normalizeNumber(cmd.payload.number);
                if (normalized) {
                    addToBlacklist(normalized);
                    console.log(`🚫 Synced Blacklist Addition: ${normalized}`);
                }
            }
            else if (cmd.type === 'blacklist_remove') {
                removeFromBlacklist(cmd.payload.number);
                console.log(`✅ Synced Blacklist Removal: ${cmd.payload.number}`);
            }
            else if (cmd.type === 'broadcast') {
                const message = cmd.payload.message;
                const customers = JSON.parse(fs.readFileSync(CUSTOMERS_FILE, "utf8") || "[]");
                let count = 0;
                console.log(`📣 Starting broadcast to ${customers.length} customers...`);
                for (const num of customers) {
                    const formattedNum = num.includes('@') ? num : `${num}@c.us`;
                    if (!(await isBlacklisted(formattedNum))) {
                        await client.sendMessage(formattedNum, message);
                        count++;
                    }
                }
                console.log(`📣 Broadcast completed. Sent to ${count} customers.`);
            }
        } catch (err) {
            console.error('❌ Error processing cloud command:', err.message);
        }
    }
}

async function syncWithCloud() {
    try {
        let customers = [];
        try {
            customers = JSON.parse(fs.readFileSync(CUSTOMERS_FILE, "utf8"));
        } catch (e) {}

        const payload = {
            status: botStatus,
            qr: latestQR,
            uptime: Math.floor(process.uptime()),
            blacklist: getBlacklist(),
            customers,
            logs: botLogs
        };

        const response = await axios.post(SYNC_URL, payload);
        
        if (response.data && response.data.commands && response.data.commands.length > 0) {
            await processCommands(response.data.commands);
        }
    } catch (err) {
        // Sync errors are suppressed so they don't spam the console if AWS is down
    }
}

// Sync with AWS every 3 seconds
setInterval(syncWithCloud, 3000);

