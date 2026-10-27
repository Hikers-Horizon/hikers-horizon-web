/**
 * Hikers Horizon — Universal Global Footer System
 * Automatically renders a consistent, premium, responsive footer on all pages.
 */
(function () {
  const V = '2';

  // ─── 1. Inject Global Footer CSS ───
  if (!document.getElementById('hh-footer-css')) {
    const link = document.createElement('link');
    link.id = 'hh-footer-css';
    link.rel = 'stylesheet';
    link.href = '/global-footer.css?v=' + V;
    document.head.appendChild(link);
  }

  // ─── 2. Footer HTML Template ───
  const footerHTML = `
  <div class="hh-footer-container">
    <div class="hh-footer-top">
      
      <!-- Brand & Community Column -->
      <div class="hh-footer-brand-col">
        <a href="/" class="hh-footer-logo-link" aria-label="Hikers Horizon Home">
          <img src="/img/lo.png" alt="Hikers Horizon" class="hh-footer-logo-img" loading="lazy">
          <div class="hh-footer-logo-text">
            <span class="hh-footer-logo-title">Hikers Horizon</span>
            <span class="hh-footer-logo-tagline">Explore the Unexplored</span>
          </div>
        </a>
        <p class="hh-footer-desc">
          South India's premier trekking community. Curating ethical sunrise climbs, Western Ghats ridge expeditions, and scenic backpacking trails from Bangalore.
        </p>

        <!-- Trust Badges -->
        <div class="hh-footer-badges">
          <span class="hh-footer-badge">
            <svg viewBox="0 0 24 24"><path d="M12 2L3 7v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V7l-9-5zm-2 16l-4-4 1.41-1.41L10 15.17l6.59-6.59L18 10l-8 8z"/></svg>
            Forest Permits (Aranya Vihara)
          </span>
          <span class="hh-footer-badge">
            <svg viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z"/></svg>
            WFA Certified Leads
          </span>
          <span class="hh-footer-badge">
            <svg viewBox="0 0 24 24"><path d="M4 16c0 .88.39 1.67 1 2.22V20c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-1h8v1c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-1.78c.61-.55 1-1.34 1-2.22V6c0-3.5-3.58-4-8-4s-8 .5-8 4v10zm3.5 1c-.83 0-1.5-.67-1.5-1.5S6.67 14 7.5 14s1.5.67 1.5 1.5S8.33 17 7.5 17zm9 0c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zm1.5-6H6V6h12v5z"/></svg>
            12 Bangalore Pickups
          </span>
        </div>

        <!-- Social Media Buttons -->
        <div class="hh-footer-socials">
          <a href="https://instagram.com/hikershorizon" target="_blank" rel="noopener" class="hh-footer-social-btn" aria-label="Instagram">
            <svg viewBox="0 0 24 24"><rect x="2" y="2" width="20" height="20" rx="5" ry="5"></rect><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"></path><line x1="17.5" y1="6.5" x2="17.51" y2="6.5"></line></svg>
          </a>
          <a href="https://youtube.com/@hikershorizon" target="_blank" rel="noopener" class="hh-footer-social-btn" aria-label="YouTube">
            <svg viewBox="0 0 24 24"><path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/></svg>
          </a>
          <a href="https://facebook.com/hikershorizon" target="_blank" rel="noopener" class="hh-footer-social-btn" aria-label="Facebook">
            <svg viewBox="0 0 24 24"><path d="M22 12c0-5.52-4.48-10-10-10S2 6.48 2 12c0 4.84 3.44 8.87 8 9.8v-6.9H7v-2.9h3V9.36c0-2.91 1.78-4.5 4.38-4.5 1.25 0 2.32.09 2.62.13v3.04h-1.8c-1.41 0-1.68.67-1.68 1.65v2.16h3.36l-.44 2.9h-2.92V21.8c4.56-.93 8-4.96 8-9.8z"/></svg>
          </a>
          <a href="https://wa.me/919902653393?text=Hi%20Hikers%20Horizon,%20I%20have%20an%20enquiry%20about%20upcoming%20treks" target="_blank" rel="noopener" class="hh-footer-social-btn" aria-label="WhatsApp">
            <svg viewBox="0 0 24 24"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/></svg>
          </a>
        </div>
      </div>

      <!-- Column 2: Explore Trails -->
      <div>
        <h4 class="hh-footer-col-title">Explore Trails</h4>
        <ul class="hh-footer-links">
          <li><a href="/Sunrise/">Sunrise Climbs (1-Day)</a></li>
          <li><a href="/Sunrise/Skandagiri-sunrise-trek-from-bangalore/">Skandagiri Sunrise</a></li>
          <li><a href="/Sunrise/Uttaribetta-sunrise-trek/">Uttari Betta Trail</a></li>
          <li><a href="/Twodays/">Two-Day Ridge Treks</a></li>
          <li><a href="/Twodays/Netravathi/">Netravathi Peak (4,990 FT)</a></li>
          <li><a href="/Twodays/Kuduremukha/">Kudremukh National Park</a></li>
          <li><a href="/Backpacking/">Backpacking Expeditions</a></li>
          <li><a href="/Backpacking/Gokarna/">Gokarna Beach Trail</a></li>
          <li><a href="/Corporate/">Corporate Team Outings</a></li>
        </ul>
      </div>

      <!-- Column 3: Community & Company -->
      <div>
        <h4 class="hh-footer-col-title">Company</h4>
        <ul class="hh-footer-links">
          <li><a href="/About/">About Our Story</a></li>
          <li><a href="/Blog/">Mountain Journal & Guides</a></li>
          <li><a href="/Contact/">Contact Trek Leads</a></li>
          <li><a href="/swiftseat/">Swift Seat Booking</a></li>
          <li><a href="/Privacy/">Privacy Policy</a></li>
          <li><a href="/Terms/">Terms & Conditions</a></li>
          <li><a href="/Cancellation/">Cancellation & Refunds</a></li>
          <li><a href="/#howItWorks">How It Works</a></li>
        </ul>
      </div>

      <!-- Column 4: Newsletter & Slot Alerts -->
      <div>
        <h4 class="hh-footer-col-title">Weekend Alerts</h4>
        <div class="hh-footer-newsletter-card">
          <p>Get instant WhatsApp & email drops when Western Ghats permits open and new sunrise batches launch.</p>
          <form class="hh-footer-newsletter-form" id="hhGlobalNewsletterForm">
            <input type="email" class="hh-footer-newsletter-input" placeholder="Enter your email address" required aria-label="Email address for slot alerts">
            <button type="submit" class="hh-footer-newsletter-btn">
              <span>Join 12,000+ Trekkers</span>
              <svg viewBox="0 0 24 24"><path d="M5 12h14M12 5l7 7-7 7" stroke="currentColor" stroke-width="2.5" fill="none"/></svg>
            </button>
          </form>
        </div>
      </div>

    </div>

    <!-- Bottom Bar -->
    <div class="hh-footer-bottom">
      <p class="hh-footer-copy">
        © 2026 Hikers Horizon. Crafted with passion for the mountains.
      </p>
      <div class="hh-footer-coords">
        <span>📍 12.9716° N, 77.5946° E</span>
        <span>•</span>
        <span>Bangalore, Karnataka</span>
      </div>
      <div class="hh-footer-bottom-links">
        <a href="/Privacy/">Privacy</a>
        <a href="/Terms/">Terms</a>
        <a href="/Cancellation/">Refunds</a>
        <button type="button" class="hh-footer-top-btn" id="hhBackToTopBtn" aria-label="Back to top">
          Back to Top ↑
        </button>
      </div>
    </div>
  </div>
  `;

  // ─── 3. Inject / Replace Footer ───
  function injectFooter() {
    // If global footer is already injected, avoid duplicate
    if (document.querySelector('.hh-global-footer')) return;

    // Look for existing footer
    const existingFooters = Array.from(document.querySelectorAll('footer'));
    let targetFooter = existingFooters[0];

    if (!targetFooter) {
      targetFooter = document.createElement('footer');
      document.body.appendChild(targetFooter);
    } else {
      // Remove any extra duplicate footers if page had multiple
      for (let i = 1; i < existingFooters.length; i++) {
        existingFooters[i].remove();
      }
    }

    targetFooter.className = 'hh-global-footer';
    targetFooter.id = 'global-footer';
    targetFooter.innerHTML = footerHTML;

    // ─── 4. Wire Interactions ───
    // Back to top
    const topBtn = targetFooter.querySelector('#hhBackToTopBtn');
    if (topBtn) {
      topBtn.addEventListener('click', () => {
        window.scrollTo({ top: 0, behavior: 'smooth' });
      });
    }

    // Newsletter submit
    const form = targetFooter.querySelector('#hhGlobalNewsletterForm');
    if (form) {
      form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const input = form.querySelector('input[type="email"]');
        const email = input ? input.value.trim() : '';
        const btn = form.querySelector('button');
        const originalText = btn.innerHTML;

        btn.disabled = true;
        btn.innerHTML = 'Subscribing...';

        try {
          const resp = await fetch('/api/subscribe', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email })
          });
          btn.innerHTML = '✓ Subscribed!';
          btn.style.background = '#10B981';
          btn.style.color = '#FFFFFF';
          setTimeout(() => {
            btn.innerHTML = originalText;
            btn.disabled = false;
            btn.style.background = '';
            btn.style.color = '';
            form.reset();
          }, 3500);
        } catch (err) {
          btn.innerHTML = '✓ Subscribed!';
          setTimeout(() => {
            btn.innerHTML = originalText;
            btn.disabled = false;
            form.reset();
          }, 3500);
        }
      });
    }
  }

  // ─── 5. Auto Run on DOM Ready ───
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', injectFooter);
  } else {
    injectFooter();
  }
})();
