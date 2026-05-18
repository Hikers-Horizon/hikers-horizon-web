/**
 * Hikers Horizon — WhatsApp Message Handler
 * Processes incoming messages and generates contextual responses
 */

const { COMPANY_INFO, TREKS, FAQ } = require("./trekData");

// ─── Helpers ──────────────────────────────────────────
function formatPrice(trek) {
  if (trek.prices.selfDrive !== undefined) {
    return `Self-Drive: ₹${trek.prices.selfDrive.toLocaleString("en-IN")}\nWith Transport: ₹${trek.prices.withTransport.toLocaleString("en-IN")}`;
  }
  return `₹${trek.prices.standard.toLocaleString("en-IN")} per person`;
}

function getTrekCard(trek) {
  const priceText = formatPrice(trek);
  const highlightsText = trek.highlights.map((h) => `  ✦ ${h}`).join("\n");
  const includesText = trek.includes.map((i) => `  ✅ ${i}`).join("\n");

  return (
    `🏔️ *${trek.name}*\n` +
    `━━━━━━━━━━━━━━━━\n` +
    `📍 ${trek.location}\n` +
    `⏱️ ${trek.duration}\n` +
    `🎯 Difficulty: ${trek.difficulty}\n` +
    (trek.altitude ? `⛰️ Altitude: ${trek.altitude}\n` : "") +
    (trek.distance ? `🥾 Distance: ${trek.distance}\n` : "") +
    `🗓️ Best Season: ${trek.bestSeason}\n\n` +
    `💰 *Price:*\n${priceText}\n\n` +
    `✨ *Highlights:*\n${highlightsText}\n\n` +
    `📦 *What's Included:*\n${includesText}\n\n` +
    `🔗 View Trek Details: ${COMPANY_INFO.website}/${trek.slug}\n` +
    `📞 Call: ${COMPANY_INFO.phone}`
  );
}

function getCategoryList(category) {
  const treksInCategory = Object.values(TREKS).filter(
    (t) => t.category === category
  );
  return treksInCategory
    .map((t, i) => {
      const price =
        t.prices.selfDrive !== undefined
          ? `₹${t.prices.selfDrive.toLocaleString("en-IN")}+`
          : `₹${t.prices.standard.toLocaleString("en-IN")}`;
      return `${i + 1}. *${t.name}* — ${price}`;
    })
    .join("\n");
}

// ─── Fuzzy Trek Matching ──────────────────────────────
function findTrek(query) {
  const q = query.toLowerCase().trim();
  
  // Direct key match
  if (TREKS[q]) return TREKS[q];

  // Keyword mapping for common variations
  const keywordMap = {
    skandagiri: ["skandagiri", "skanda", "skandha"],
    nandihills: ["nandi", "nandi hills", "nandihills"],
    savandurga: ["savandurga", "savan"],
    anthargange: ["anthargange", "anthar", "cave trek", "cave"],
    makalidurga: ["makalidurga", "makali"],
    kuntibetta: ["kuntibetta", "kunti"],
    uttaribetta: ["uttaribetta", "uttari"],
    gokarna: ["gokarna", "beach trek", "beach"],
    kodachadri: ["kodachadri", "kodach"],
    kuduremukha: ["kuduremukha", "kudremukha", "kudure"],
    kumaraparvatha: ["kumaraparvatha", "kumara", "kp trek", "pushpagiri"],
    netravathi: ["netravathi", "netravati", "nethravathi", "nethra"],
    tadiandamol: ["tadiandamol", "tadiyandamol", "tadi"],
    wayanad: ["wayanad"],
    chikmagaluru: ["chikmagaluru", "chikmagalur", "chikma", "chik"],
    coorg2days: ["coorg 2", "coorg two", "coorg2"],
    coorg3days: ["coorg 3", "coorg three", "coorg3"],
    hampi: ["hampi"],
    kodaikanal: ["kodaikanal", "kodai"],
  };

  for (const [key, keywords] of Object.entries(keywordMap)) {
    for (const kw of keywords) {
      if (q.includes(kw)) return TREKS[key];
    }
  }

  // Partial match on trek names
  for (const trek of Object.values(TREKS)) {
    if (trek.name.toLowerCase().includes(q) || q.includes(trek.name.toLowerCase().split(" ")[0])) {
      return trek;
    }
  }

  return null;
}

// ─── FAQ Matching ─────────────────────────────────────
function findFAQ(query) {
  const q = query.toLowerCase();
  const faqKeywords = {
    cancellation: ["cancel", "refund", "cancellation"],
    payment: ["payment", "pay", "upi", "card", "razorpay"],
    groupSize: ["group", "batch", "how many people", "corporate"],
    fitness: ["fitness", "fit", "stamina", "beginner", "difficult"],
    whatToBring: ["bring", "carry", "pack", "what to", "essentials", "shoes"],
    transport: ["transport", "pickup", "pick up", "drop", "bus", "travel"],
    weather: ["weather", "rain", "monsoon", "season", "best time", "when"],
    safety: ["safety", "safe", "emergency", "first aid", "guide"],
    age: ["age", "kids", "children", "old", "senior", "minimum age"],
    corporate: ["corporate", "team building", "office", "company outing"],
  };

  for (const [key, keywords] of Object.entries(faqKeywords)) {
    for (const kw of keywords) {
      if (q.includes(kw)) return FAQ[key];
    }
  }
  return null;
}

// ─── Human Handover & Mute Logic ──────────────────────
const MUTED_USERS = new Map(); // Stores { phoneNumber: expiryTime }

const BOT_FOOTER = `\n\n━━━━━━━━━━━━━━━━\n🤖 *Bot Reply* | Type "Team" to chat with our team.`;

function handleMessage(incomingMsg, from) {
  const msg = incomingMsg.toLowerCase().trim();

  // 1. Admin Commands
  if (msg === "!pause") {
    MUTED_USERS.set(from, Date.now() + 24 * 60 * 60 * 1000); // Mute for 24 hours
    return `🤫 *Bot Paused.* I will not reply to this number for 24 hours unless you type "!resume".`;
  }
  if (msg === "!resume") {
    MUTED_USERS.delete(from);
    return `🚀 *Bot Resumed.* I am now answering questions for this number again!`;
  }

  // 2. Check if user is muted
  if (MUTED_USERS.has(from)) {
    const expiry = MUTED_USERS.get(from);
    if (Date.now() < expiry) {
      console.log(`🙊 Bot is muted for ${from}. Ignoring message.`);
      return null; // Return null so server knows not to send anything
    } else {
      MUTED_USERS.delete(from); // Expiry passed
    }
  }

  // 3. Human Request Detection
  if (msg === "team" || msg === "staff" || msg === "expert" || msg === "owner" || msg === "talk to team" || msg === "human") {
    MUTED_USERS.set(from, Date.now() + 24 * 60 * 60 * 1000); // Mute for 24 hours
    return `👋 *Connecting you to our team!* \n\nI've paused myself for this chat so you can talk to us directly. Our team will get back to you shortly! 🏔️`;
  }

  // ── Greetings ──
  let response = "";
  if (
    ["hi", "hello", "hey", "hii", "hiii", "helo", "start", "menu"].includes(msg) ||
    msg.includes("good morning") ||
    msg.includes("good evening")
  ) {
    response = getWelcomeMessage();
  }

  // ── Category Selection ──
  else if (msg === "1" || msg.includes("sunrise") || msg.includes("night trek")) {
    response = (
      `🌅 *SUNRISE & NIGHT TREKS*\n` +
      `━━━━━━━━━━━━━━━━━━━━\n` +
      `Perfect for a quick weekend escape from Bangalore!\n\n` +
      getCategoryList("sunrise") +
      `\n\n💬 Reply with the *trek name* to get full details.\n` +
      `Example: "Skandagiri" or "Anthargange"`
    );
  }

  else if (msg === "2" || (msg.includes("two") && msg.includes("day")) || msg.includes("twoday") || msg.includes("2 day") || msg.includes("weekend trek")) {
    response = (
      `⛰️ *TWO-DAY TREKS*\n` +
      `━━━━━━━━━━━━━━━━━━━━\n` +
      `The ultimate Western Ghats adventure!\n\n` +
      getCategoryList("twoday") +
      `\n\n💬 Reply with the *trek name* to get full details.\n` +
      `Example: "Gokarna" or "Kodachadri"`
    );
  }

  else if (msg === "3" || msg.includes("backpack") || msg.includes("trip") || msg.includes("tour")) {
    response = (
      `🎒 *BACKPACKING TRIPS*\n` +
      `━━━━━━━━━━━━━━━━━━━━\n` +
      `Explore beyond the trails!\n\n` +
      getCategoryList("backpacking") +
      `\n\n💬 Reply with the *trip name* to get full details.\n` +
      `Example: "Wayanad" or "Hampi"`
    );
  }

  else if (msg === "4" || msg.includes("all trek") || msg.includes("every trek") || msg.includes("list")) {
    const sunriseList = getCategoryList("sunrise");
    const twodayList = getCategoryList("twoday");
    const backpackList = getCategoryList("backpacking");
    response = (
      `📋 *ALL TREKS BY HIKERS HORIZON*\n` +
      `━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n` +
      `🌅 *Sunrise Treks:*\n${sunriseList}\n\n` +
      `⛰️ *Two-Day Treks:*\n${twodayList}\n\n` +
      `🎒 *Backpacking Trips:*\n${backpackList}\n\n` +
      `💬 Reply with any *trek name* for full details!`
    );
  }

  // ── Contact ──
  else if (msg === "5" || msg.includes("contact") || msg.includes("call") || msg.includes("phone") || msg.includes("email") || msg.includes("address")) {
    response = (
      `📞 *CONTACT HIKERS HORIZON*\n` +
      `━━━━━━━━━━━━━━━━━━━━━━━━\n\n` +
      `📧 Email: ${COMPANY_INFO.email}\n` +
      `📱 Phone: ${COMPANY_INFO.phone}\n` +
      `📍 Location: ${COMPANY_INFO.location}\n` +
      `🌐 Website: ${COMPANY_INFO.website}\n` +
      `📸 Instagram: ${COMPANY_INFO.instagram}\n\n` +
      `Our team is available from 9 AM - 9 PM daily.\n` +
      `Feel free to call or visit our website anytime! 🙌`
    );
  }

  // ── FAQ ──
  else if (msg === "6" || msg.includes("faq") || msg.includes("question") || msg.includes("help")) {
    response = (
      `❓ *FREQUENTLY ASKED QUESTIONS*\n` +
      `━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n` +
      `Ask me anything about:\n` +
      `• Cancellation & Refund Policy\n` +
      `• Payment Options\n` +
      `• Group Size\n` +
      `• Fitness Requirements\n` +
      `• What to Carry\n` +
      `• Transport & Pickup Points\n` +
      `• Best Season / Weather\n` +
      `• Safety Measures\n` +
      `• Age Limits\n` +
      `• Corporate Packages\n\n` +
      `💬 Just type your question! e.g. "What is the cancellation policy?"`
    );
  }

  // ── Booking ──
  else if (msg.includes("book") && !msg.includes("facebook")) {
    const trek = findTrek(msg.replace("book", "").replace("booking", ""));
    if (trek) {
      response = (
        `🎫 *BOOK ${trek.name.toUpperCase()}*\n` +
        `━━━━━━━━━━━━━━━━━━━━━━\n\n` +
        `${formatPrice(trek)}\n\n` +
        `📱 *View Trek Details:* ${COMPANY_INFO.website}/${trek.slug}\n\n` +
        `Or call us directly:\n` +
        `📞 ${COMPANY_INFO.phone}\n\n` +
        `📧 ${COMPANY_INFO.email}`
      );
    } else {
      response = (
        `🎫 *READY TO BOOK?*\n` +
        `━━━━━━━━━━━━━━━━━━\n\n` +
        `You can book directly on our website:\n` +
        `🌐 ${COMPANY_INFO.website}\n\n` +
        `Or tell me which trek you'd like to book!\n` +
        `Reply with the *trek name* and I'll share the booking link.\n\n` +
        `📞 For instant booking: ${COMPANY_INFO.phone}`
      );
    }
  }

  // ── Price queries ──
  else if (msg.includes("price") || msg.includes("cost") || msg.includes("how much") || msg.includes("rate") || msg.includes("charge") || msg.includes("fee")) {
    const trek = findTrek(msg.replace(/price|cost|how much|rate|charge|fee|what|is|the|of|for/g, "").trim());
    if (trek) {
      response = (
        `💰 *${trek.name} Pricing*\n` +
        `━━━━━━━━━━━━━━━━\n\n` +
        `${formatPrice(trek)}\n\n` +
        `📦 *Includes:*\n${trek.includes.map((i) => `  ✅ ${i}`).join("\n")}\n\n` +
        `🔗 View Trek Details: ${COMPANY_INFO.website}/${trek.slug}\n` +
        `📞 Call: ${COMPANY_INFO.phone}`
      );
    } else {
      response = (
        `💰 *HIKERS HORIZON PRICE GUIDE*\n` +
        `━━━━━━━━━━━━━━━━━━━━━━━━━\n\n` +
        `🌅 *Sunrise Treks:* ₹299 — ₹1,399\n` +
        `⛰️ *Two-Day Treks:* ₹3,499 — ₹3,999\n` +
        `🎒 *Backpacking Trips:* ₹3,399 — ₹4,999\n\n` +
        `💬 Tell me the *trek name* for exact pricing!\n` +
        `e.g. "Skandagiri price" or "How much is Gokarna?"`
      );
    }
  }

  // ── Specific Trek Search ──
  else if (findTrek(msg)) {
    response = getTrekCard(findTrek(msg));
  }

  // ── FAQ Matching ──
  else if (findFAQ(msg)) {
    const faqAnswer = findFAQ(msg);
    response = `ℹ️ ${faqAnswer}\n\n💬 Any other questions? Type *menu* to see all options.`;
  }

  // ── Website ──
  else if (msg.includes("website") || msg.includes("site") || msg.includes("link") || msg.includes("url")) {
    response = (
      `🌐 *Visit Hikers Horizon*\n\n` +
      `${COMPANY_INFO.website}\n\n` +
      `Explore all our treks, read itineraries, view photos, and book online!\n\n` +
      `📸 Follow us: ${COMPANY_INFO.instagram}`
    );
  }

  // ── Thanks ──
  else if (msg.includes("thank") || msg.includes("thanks") || msg.includes("thx")) {
    response = `You're welcome! 🙌\n\nFeel free to reach out anytime. We're always here to help you plan your next adventure! 🏔️\n\nType *menu* to explore more.`;
  }

  // ── Default / Fallback ──
  else {
    response = (
      `Hey there! 👋 I didn't quite catch that.\n\n` +
      `Here's what I can help you with:\n` +
      `• Type a *trek name* (e.g., "Skandagiri")\n` +
      `• Type *1-6* for menu options\n` +
      `• Ask about *prices*, *booking*, or *FAQs*\n` +
      `• Type *menu* to see the full menu\n\n` +
      `Or call us directly: ${COMPANY_INFO.phone} 📞`
    );
  }

  return response + BOT_FOOTER;
}

// ─── Welcome Message ──────────────────────────────────
function getWelcomeMessage() {
  return (
    `🏔️ *Welcome to HIKERS HORIZON!*\n` +
    `━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
    `Your Gateway to the Wild 🌿\n\n` +
    `We're Bangalore's premier trekking company offering unforgettable adventures across Karnataka, Kerala & Tamil Nadu!\n\n` +
    `Choose an option below:\n\n` +
    `1️⃣ 🌅 Sunrise & Night Treks\n` +
    `2️⃣ ⛰️ Two-Day Treks\n` +
    `3️⃣ 🎒 Backpacking Trips\n` +
    `4️⃣ 📋 All Treks & Pricing\n` +
    `5️⃣ 📞 Contact Us\n` +
    `6️⃣ ❓ FAQs\n\n` +
    `💬 Or simply type the *name of any trek* to get instant details!\n` +
    `e.g. "Gokarna", "Skandagiri", "Wayanad"\n\n` +
    `🌐 ${COMPANY_INFO.website}`
  );
}

module.exports = { handleMessage, getWelcomeMessage };
