/**
 * Hikers Horizon — Automated Weekend Broadcast
 * Schedules and sends weekend trek updates to all customers.
 * Updated to use whatsapp-web.js
 */

const fs = require("fs");
const path = require("path");
const cron = require("node-cron");
const { isBlacklisted } = require("./blacklist");

const CUSTOMERS_FILE = path.join(__dirname, "customers.json");

// ─── The Unique Weekend Message ───────────────────────
const WEEKEND_MESSAGE = `🏔️ *WEEKEND ADVENTURE CALLING!* 🌿
━━━━━━━━━━━━━━━━━━━━━━━━━━
Hey Explorer! Ready to escape the city? Here's what's happening at *Hikers Horizon* this weekend:

🌅 *1-DAY SUNRISE SPECIALS*
(Departure: TONIGHT!)
✦ 1-Day Uttari Betta Trek
✦ 1-Day Nandi Hills Trek
✦ 1-Day Antharagange Trek
✦ 1-Day Shivagange Trek
✦ 1-Day Madhugiri Trek
✦ 1-Day Savandurga Trek

⛰️ *2-DAY EPIC ESCAPES*
(Departure: TOMORROW!)
✦ 2-Day Gokarna Adventure
✦ 2-Day Coorg Adventure
✦ 2-Day Munnar Adventure
✦ 2-Day Ooty Adventure
✦ 2-Day Chikmagalur Adventure

🔥 *Limited spots left for this weekend!*
Book your escape now and make some memories.

📞 *Queries:* +91 99026 53393
🌐 *Website:* hikershorizon.in

Thank you!
*Hikers Horizon Team* 🏔️🤖`;

// ─── Broadcast Function ───────────────────────────────
function initBroadcast(client) {
  async function runBroadcast() {
    console.log("\n🚀 Starting Friday Broadcast...");
    
    let customers = [];
    try {
      customers = JSON.parse(fs.readFileSync(CUSTOMERS_FILE, "utf8"));
    } catch (err) {
      console.error("❌ Error reading customers file:", err.message);
      return;
    }

    if (customers.length === 0) {
      console.log("ℹ️ No customers in database yet. Skipping broadcast.");
      return;
    }

    console.log(`📢 Sending to ${customers.length} customers...`);

    for (const rawNumber of customers) {
      try {
        if (isBlacklisted(rawNumber)) {
          console.log(`🔕 Skipped broadcast for blacklisted number: ${rawNumber}`);
          continue;
        }
        const to = `${rawNumber}@c.us`; // Required format for whatsapp-web.js
        await client.sendMessage(to, WEEKEND_MESSAGE);
        console.log(`✅ Sent to ${rawNumber}`);
      } catch (error) {
        console.error(`❌ Failed for ${rawNumber}:`, error.message);
      }
    }
    console.log("🏁 Broadcast complete!\n");
  }

  // Schedule for every Friday at 10:00 AM
  // (Format: minute hour day-of-month month day-of-week)
  cron.schedule("0 10 * * 5", () => {
    runBroadcast();
  });
  
  console.log("🕒 Broadcast scheduler running (Every Friday at 10:00 AM)");
}

module.exports = { initBroadcast };
