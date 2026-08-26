/**
 * CampFlow Availability Widget — Embeddable JavaScript
 * 
 * Drop this single <script> tag on any page of hikershorizon.in (or any website)
 * to show live seat availability pulled from the CampFlow API.
 *
 * USAGE (add to your HTML):
 *   <div id="campflow-availability"></div>
 *   <script
 *     src="https://your-campflow-api.com/static/availability-widget.js"
 *     data-api="https://your-campflow-api.com"
 *     data-org="hikers-horizon"
 *     data-theme="dark"
 *   ></script>
 *
 *   OR load directly inline (no external script):
 *   <div id="campflow-availability"></div>
 *   <script>
 *     // Copy the contents of this file here
 *   </script>
 *
 * CONFIG attributes on the <script> tag:
 *   data-api     = Your CampFlow backend URL (required)
 *   data-org     = Organization slug (default: auto-detect)
 *   data-theme   = "dark" | "light" (default: "dark")
 *   data-trek    = Filter to a single trek name (optional)
 *   data-target  = CSS selector for the container element (default: "#campflow-availability")
 *   data-wa      = WhatsApp number for booking button (default: "919902653393")
 */
(function () {
  "use strict";

  // Read config from <script> tag attributes
  const scriptTag = document.currentScript;
  const API_BASE = scriptTag?.getAttribute("data-api") || "";
  const ORG_SLUG = scriptTag?.getAttribute("data-org") || "";
  const THEME = scriptTag?.getAttribute("data-theme") || "dark";
  const TREK_FILTER = scriptTag?.getAttribute("data-trek") || "";
  const TARGET = scriptTag?.getAttribute("data-target") || "#campflow-availability";
  const WA_NUMBER = scriptTag?.getAttribute("data-wa") || "919902653393";

  // Inject styles
  const style = document.createElement("style");
  style.textContent = `
    .cf-avail-widget {
      font-family: 'Inter', 'Outfit', -apple-system, BlinkMacSystemFont, sans-serif;
      max-width: 900px;
      margin: 0 auto;
      padding: 1rem 0;
    }
    .cf-avail-widget * { box-sizing: border-box; margin: 0; padding: 0; }
    
    .cf-avail-header {
      text-align: center;
      margin-bottom: 2rem;
    }
    .cf-avail-header h2 {
      font-size: 1.8rem;
      font-weight: 800;
      text-transform: uppercase;
      letter-spacing: -0.02em;
      ${THEME === "dark" ? "color: #fff;" : "color: #1a1a1a;"}
    }
    .cf-avail-header h2 .cf-accent {
      background: linear-gradient(135deg, #e2b75a, #ffdb80);
      -webkit-background-clip: text;
      background-clip: text;
      -webkit-text-fill-color: transparent;
    }
    .cf-avail-header p {
      font-size: 0.9rem;
      margin-top: 0.5rem;
      ${THEME === "dark" ? "color: #8a8a8a;" : "color: #666;"}
    }

    .cf-date-group {
      margin-bottom: 2rem;
    }
    .cf-date-label {
      font-size: 0.85rem;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.1em;
      padding-bottom: 0.75rem;
      margin-bottom: 0.75rem;
      ${THEME === "dark" ? "color: #e2b75a; border-bottom: 1px solid rgba(255,255,255,0.08);" : "color: #b8860b; border-bottom: 1px solid #eee;"}
    }

    .cf-trek-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 0.9rem 1rem;
      margin-bottom: 0.5rem;
      border-radius: 12px;
      transition: all 0.3s ease;
      ${THEME === "dark" 
        ? "background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.06);" 
        : "background: #f9f9f9; border: 1px solid #eee;"}
    }
    .cf-trek-row:hover {
      ${THEME === "dark" ? "background: rgba(255,255,255,0.08);" : "background: #f0f0f0;"}
      transform: translateX(4px);
    }

    .cf-trek-left {
      display: flex;
      align-items: center;
      gap: 1rem;
      flex: 1;
    }

    .cf-slots-badge {
      width: 52px;
      height: 52px;
      border-radius: 12px;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      font-weight: 800;
      font-size: 1.1rem;
      line-height: 1;
      flex-shrink: 0;
    }
    .cf-slots-badge .cf-slots-label {
      font-size: 0.55rem;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      margin-top: 2px;
    }
    .cf-slots-open {
      background: #1a3a2a;
      color: #4ade80;
    }
    .cf-slots-low {
      background: #3a2a1a;
      color: #fbbf24;
    }
    .cf-slots-full {
      background: #3a1a1a;
      color: #f87171;
    }

    .cf-trek-info h3 {
      font-size: 0.95rem;
      font-weight: 700;
      ${THEME === "dark" ? "color: #fff;" : "color: #1a1a1a;"}
    }
    .cf-trek-price {
      font-size: 0.8rem;
      margin-top: 2px;
      ${THEME === "dark" ? "color: #8a8a8a;" : "color: #666;"}
    }
    .cf-trek-price .cf-original {
      text-decoration: line-through;
      opacity: 0.6;
      margin-right: 4px;
    }

    .cf-trek-right {
      display: flex;
      align-items: center;
      gap: 0.75rem;
    }

    .cf-book-btn {
      display: inline-flex;
      align-items: center;
      gap: 0.4rem;
      padding: 0.55rem 1.2rem;
      border-radius: 50px;
      font-size: 0.75rem;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      text-decoration: none;
      transition: all 0.3s ease;
      cursor: pointer;
      border: none;
    }
    .cf-book-btn-primary {
      background: #e2b75a;
      color: #050505;
    }
    .cf-book-btn-primary:hover {
      background: #ffdb80;
      transform: translateY(-2px);
      box-shadow: 0 8px 24px rgba(212,167,74,0.3);
    }
    .cf-book-btn-full {
      background: rgba(255,255,255,0.06);
      color: #8a8a8a;
      cursor: default;
    }

    .cf-loading {
      text-align: center;
      padding: 3rem 1rem;
      ${THEME === "dark" ? "color: #8a8a8a;" : "color: #666;"}
    }
    .cf-loading-spinner {
      width: 32px;
      height: 32px;
      border: 3px solid ${THEME === "dark" ? "rgba(255,255,255,0.1)" : "#eee"};
      border-top-color: #e2b75a;
      border-radius: 50%;
      animation: cf-spin 0.8s linear infinite;
      margin: 0 auto 1rem;
    }
    @keyframes cf-spin {
      to { transform: rotate(360deg); }
    }

    .cf-error {
      text-align: center;
      padding: 2rem 1rem;
      color: #f87171;
      font-size: 0.9rem;
    }

    @media (max-width: 640px) {
      .cf-trek-row {
        flex-direction: column;
        align-items: flex-start;
        gap: 0.75rem;
      }
      .cf-trek-right {
        width: 100%;
        justify-content: flex-end;
      }
    }
  `;
  document.head.appendChild(style);

  // Render
  const container = document.querySelector(TARGET);
  if (!container) {
    console.error("CampFlow Widget: Target element not found:", TARGET);
    return;
  }

  // Show loading
  container.innerHTML = `
    <div class="cf-avail-widget">
      <div class="cf-loading">
        <div class="cf-loading-spinner"></div>
        Loading availability...
      </div>
    </div>
  `;

  // Fetch data
  let url = `${API_BASE}/api/public/availability`;
  const params = new URLSearchParams();
  if (ORG_SLUG) params.set("org_slug", ORG_SLUG);
  if (TREK_FILTER) params.set("trek_name", TREK_FILTER);
  if (params.toString()) url += `?${params}`;

  fetch(url)
    .then((r) => {
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      return r.json();
    })
    .then((data) => renderAvailability(data))
    .catch((err) => {
      container.innerHTML = `
        <div class="cf-avail-widget">
          <div class="cf-error">⚠️ Unable to load availability. Please try again later.</div>
        </div>
      `;
      console.error("CampFlow Widget Error:", err);
    });

  function renderAvailability(data) {
    if (!data.treks || data.treks.length === 0) {
      container.innerHTML = `
        <div class="cf-avail-widget">
          <div class="cf-avail-header">
            <h2>Upcoming <span class="cf-accent">Treks</span></h2>
            <p>No upcoming departures at the moment. Check back soon!</p>
          </div>
        </div>
      `;
      return;
    }

    // Group departures by date across all treks
    const byDate = {};
    for (const trek of data.treks) {
      for (const dep of trek.departures) {
        if (!byDate[dep.date]) byDate[dep.date] = [];
        byDate[dep.date].push({ ...dep, trek_name: trek.trek_name, trek_price: trek.price });
      }
    }

    const sortedDates = Object.keys(byDate).sort();
    let html = `
      <div class="cf-avail-widget">
        <div class="cf-avail-header">
          <h2>Upcoming <span class="cf-accent">Adventures</span></h2>
          <p>Live seat availability — book now before slots fill up!</p>
        </div>
    `;

    for (const date of sortedDates) {
      const d = new Date(date + "T00:00:00");
      const dayName = d.toLocaleDateString("en-IN", { weekday: "short" }).toUpperCase();
      const dateLabel = d.toLocaleDateString("en-IN", { day: "numeric", month: "short" });

      html += `<div class="cf-date-group">`;
      html += `<div class="cf-date-label">📅 ${dateLabel} &nbsp;${dayName}</div>`;

      for (const dep of byDate[date]) {
        const seats = dep.available_seats;
        const isFull = seats <= 0;
        const isLow = seats > 0 && seats <= 5;
        const badgeClass = isFull ? "cf-slots-full" : isLow ? "cf-slots-low" : "cf-slots-open";
        const badgeText = isFull ? "FULL" : seats;
        const price = dep.price || dep.trek_price;
        const waMsg = encodeURIComponent(
          `Hi! I'd like to book ${dep.trek_name} on ${dateLabel} for _ people.`
        );
        const bookUrl = `https://wa.me/${WA_NUMBER}?text=${waMsg}`;

        html += `
          <div class="cf-trek-row">
            <div class="cf-trek-left">
              <div class="cf-slots-badge ${badgeClass}">
                ${badgeText}
                <span class="cf-slots-label">SLOTS</span>
              </div>
              <div class="cf-trek-info">
                <h3>${dep.trek_name}</h3>
                <div class="cf-trek-price">₹${Number(price).toLocaleString("en-IN")} pp</div>
              </div>
            </div>
            <div class="cf-trek-right">
              ${isFull
                ? `<span class="cf-book-btn cf-book-btn-full">Sold Out</span>`
                : `<a href="${bookUrl}" target="_blank" rel="noopener" class="cf-book-btn cf-book-btn-primary">Book Now</a>`
              }
            </div>
          </div>
        `;
      }
      html += `</div>`;
    }

    html += `</div>`;
    container.innerHTML = html;
  }
})();
