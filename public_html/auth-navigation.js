// Authentication, Navigation & Footer Management (Synced with Home Page)
document.addEventListener('DOMContentLoaded', function () {
    // 1. Inject Theme Essentials globally
    if (!document.getElementById('premium-nav-css')) {
        const link = document.createElement('link');
        link.id = 'premium-nav-css';
        link.rel = 'stylesheet';
        link.href = '/auth-navigation.css?v=11';
        document.head.appendChild(link);
    }

    // 1b. Inject SEO script globally
    if (!document.getElementById('seo-injector-js')) {
        const seoScript = document.createElement('script');
        seoScript.id = 'seo-injector-js';
        seoScript.src = '/seo-injector.js';
        seoScript.defer = true;
        document.head.appendChild(seoScript);
    }

    // 2. Add Favicon and Google Fonts essentials if missing
    if (!document.querySelector('link[href*="fonts.googleapis.com"]')) {
        const fontLink = document.createElement('link');
        fontLink.rel = 'stylesheet';
        fontLink.href = 'https://fonts.googleapis.com/css2?family=Outfit:wght@400;700;900&family=Inter:wght@400;600&display=swap';
        document.head.appendChild(fontLink);
    }

    function syncHeaderLayout() {
        // 1. Identify or Create Header
        let header = document.querySelector('header');
        if (!header) {
            header = document.createElement('header');
            header.className = 'header';
            document.body.prepend(header);
        } else {
            header.className = 'header'; // Force class
        }

        // 2. Identify or Create Header Container
        let headerContainer = header.querySelector('.header-container');
        if (!headerContainer) {
            headerContainer = document.createElement('div');
            headerContainer.className = 'header-container';
            // Move existing children to container or rebuild
            headerContainer.innerHTML = header.innerHTML;
            header.innerHTML = '';
            header.appendChild(headerContainer);
        }

        // 3. Force Premium Logo Structure
        let logoSection = headerContainer.querySelector('.logo-link');
        if (!logoSection) {
            logoSection = document.createElement('a');
            logoSection.href = '/index.html';
            logoSection.className = 'logo-link';
            headerContainer.prepend(logoSection);
        }

        logoSection.innerHTML = `
            <img id="logo" src="/img/lo.png" alt="Hikers Horizon Logo" loading="eager">
            <div class="logo-text-container">
                <h1>HIKERS <span style="color: var(--color-accent)">HORIZON</span></h1>
                <div class="tagline">Explore the Unexplored</div>
            </div>
        `;

        // 4. Global Scrolled Effect
        window.addEventListener('scroll', () => {
            if (window.scrollY > 30) header.classList.add('scrolled');
            else header.classList.remove('scrolled');
        }, { passive: true });

        // 5. Cleanup conflicting internal styles (if any)
        const style = document.createElement('style');
        style.innerHTML = `
            @media (max-width: 768px) {
                #navMenu, .nav-menu:not(.nav-menu-mobile) { display: none !important; }
                .user-greeting { display: none !important; }
            }
        `;
        document.head.appendChild(style);
    }

    function updateNavLinks() {
        const navList = document.querySelector('.nav-list');
        if (!navList) return;

        const path = window.location.pathname;

        navList.innerHTML = `
            <li><a href="/" class="nav-link ${path === '/' || path.includes('index.html') ? 'active' : ''}">Home</a></li>
            <li class="dropdown">
                <a href="/#treks" class="nav-link ${path.includes('Sunrise') || path.includes('Twodays') ? 'active' : ''}">Treks <span class="arrow">▾</span></a>
                <div class="mega-menu">
                    <div class="mega-menu-container">
                        <div class="mega-menu-column">
                            <h3 class="mega-column-title">Categories</h3>
                            <ul class="category-list">
                                <li class="category-item active" data-region="sunrise">Sunrise Treks <span>›</span></li>
                                <li class="category-item" data-region="twodays">Two Days Treks <span>›</span></li>
                                <li class="category-item" data-region="backpacking">Backpacking Trips <span>›</span></li>
                            </ul>
                        </div>
                        <div class="mega-menu-column">
                            <h3 class="mega-column-title" id="region-title">Sunrise Treks</h3>
                            <ul class="trek-list-grid" id="trek-items-list">
                                <li><a href="/Sunrise/">Skandagiri Sunrise Trek</a></li>
                                <li><a href="/Sunrise/">Nandi Hills Sunrise</a></li>
                                <li><a href="/Sunrise/">Uttari Betta Trek</a></li>
                                <li><a href="/Sunrise/">Savandurga Night Trek</a></li>
                                <li><a href="/Sunrise/">Anthargange Exploration</a></li>
                                <li><a href="/Sunrise/">Makalidurga Adventure</a></li>
                            </ul>
                        </div>
                        <div class="mega-menu-column">
                            <h3 class="mega-column-title">Spotlight</h3>
                            <div class="featured-trek">
                                <img src="/img/BP.webp" alt="Gokarna Beach Trek">
                                <div class="featured-trek-content">
                                    <div class="featured-trek-title">Gokarna Beach Trek</div>
                                    <p style="font-size:0.8rem; color:#8a8a8a; margin-bottom:1rem">Trek across white sand beaches and rugged cliffs. A coastal adventure you'll never forget!</p>
                                    <a href="/Backpacking/" class="featured-trek-btn" style="background:var(--color-accent); color:var(--color-bg); padding:0.5rem 1rem; border-radius:50px; font-size:0.75rem; font-weight:700;">Explore Now</a>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </li>
            <li><a href="/Corporate/" class="nav-link ${path.includes('Corporate') ? 'active' : ''}">Corporate</a></li>
            <li><a href="/Blog/" class="nav-link ${path.includes('Blog') ? 'active' : ''}">Blog</a></li>
            <li><a href="/About/" class="nav-link ${path.includes('About') ? 'active' : ''}">About</a></li>
            <li><a href="/Contact/" class="nav-link ${path.includes('Contact') ? 'active' : ''}">Contact</a></li>
        `;

        initMegaMenuInteractivity();
    }

    function initMegaMenuInteractivity() {
        const categoryItems = document.querySelectorAll('.category-item');
        const trekItemsList = document.getElementById('trek-items-list');
        const regionTitle = document.getElementById('region-title');
        if (!categoryItems.length || !trekItemsList) return;

        const megaTrekData = {
            sunrise: [
                { name: 'Skandagiri Sunrise Trek', link: '/Sunrise/Skandagiri-sunrise-trek-from-bangalore' },
                { name: 'Nandihills Sunrise', link: '/Sunrise/Nandihills-sunrise-trek' },
                { name: 'Uttari Betta Trek', link: '/Sunrise/Uttaribetta-sunrise-trek' },
                { name: 'Savandurga Night Trek', link: '/Sunrise/Savandurga-sunrise-trek' },
                { name: 'Anthargange Exploration', link: '/Sunrise/Anthargange-trek' },
                { name: 'Makalidurga Adventure', link: '/Sunrise/Makalidurga-sunrise-trek' }
            ],
            twodays: [
                { name: 'Kudremukh Trek', link: '/Twodays/Kuduremukha' },
                { name: 'Netravathi Peak', link: '/Twodays/Netravathi' },
                { name: 'Kodachadri Adventure', link: '/Twodays/Kodachadri' },
                { name: 'Tadiandamol Trek', link: '/Twodays/Tadiandamol' },
                { name: 'Kumaraparvatha Trek', link: '/Twodays/Kumaraparvatha' },
                { name: 'Gokarna Beach Trek', link: '/Twodays/Gokarna' }
            ],
            backpacking: [
                { name: 'Wayanad Expedition', link: '/Backpacking/Wayanad' },
                { name: 'Hampi Heritage Trail', link: '/Backpacking/Hampi' },
                { name: 'Chikmagaluru Magic', link: '/Backpacking/Chikmagaluru' },
                { name: 'Coorg 2-Day Getaway', link: '/Backpacking/Coorg2days' },
                { name: 'Coorg 3-Day Journey', link: '/Backpacking/Coorg3days' },
                { name: 'Kodaikanal Lake Trail', link: '/Backpacking/Kodaikanal' },
                { name: 'Munnar & Kolukkumalai', link: '/Backpacking/Munnar' }
            ]
        };

        categoryItems.forEach(item => {
            item.addEventListener('mouseenter', () => {
                if (window.innerWidth > 768) {
                    const region = item.getAttribute('data-region');
                    categoryItems.forEach(i => i.classList.remove('active'));
                    item.classList.add('active');
                    regionTitle.textContent = `${item.childNodes[0].textContent.trim()} Treks`;
                    const treks = megaTrekData[region] || [];
                    trekItemsList.innerHTML = treks.map(trek => `
                        <li class="trek-list-item"><a href="${trek.link}">${trek.name}</a></li>
                    `).join('');
                }
            });
        });
    }

    function injectFooter() {
        const existingFooter = document.querySelector('footer');
        const newFooterHTML = `
            <div class="footer-top">
                <div class="footer-col">
                    <a href="/" class="logo-link" style="margin-bottom:2rem">
                        <img src="/img/lo.png" alt="Hikers Horizon" style="width:40px; border-radius:50%">
                        <div class="logo-text-container">
                            <h1 style="font-size:1rem; color:#fff">HIKERS <span style="color:var(--color-accent)">HORIZON</span></h1>
                        </div>
                    </a>
                    <p style="color:var(--color-text-muted); font-size:0.85rem; line-height:1.6">Your ultimate gateway to adventure. Premier trekking and backpacking trips from Bangalore. Join us for breathtaking sunrises and epic journeys.</p>
                </div>
                <div>
                    <div class="footer-col-title">Treks</div>
                    <ul class="footer-col-links">
                        <li><a href="/Sunrise/">Sunrise Treks</a></li>
                        <li><a href="/Twodays/">Two Day Treks</a></li>
                        <li><a href="/Backpacking/">Backpacking Trips</a></li>
                        <li><a href="/Corporate/">Corporate Outings</a></li>
                    </ul>
                </div>
                <div>
                    <div class="footer-col-title">Company</div>
                    <ul class="footer-col-links">
                        <li><a href="/About/">About Us</a></li>
                        <li><a href="/Contact/">Contact</a></li>
                        <li><a href="/Blogs">Blog</a></li>
                        <li><a href="/Privacy">Privacy Policy</a></li>
                    </ul>
                </div>
                <div>
                    <div class="newsletter-form">
                        <h3 class="footer-col-title">Stay Updated</h3>
                        <form class="newsletter-input" action="#" method="post">
                            <input type="email" placeholder="Enter email" required>
                            <button type="submit">Join</button>
                        </form>
                        <div class="social-links">
                            <a href="https://instagram.com/hikershorizon" aria-label="Instagram"><svg viewBox="0 0 24 24"><rect x="2" y="2" width="20" height="20" rx="5" ry="5" fill="none" stroke="currentColor" stroke-width="1.5"/><circle cx="12" cy="12" r="4.5" fill="none" stroke="currentColor" stroke-width="1.5"/><circle cx="17.5" cy="6.5" r="1.25" fill="currentColor"/></svg></a>
                            <a href="https://youtube.com/@hikershorizon" aria-label="YouTube"><svg viewBox="0 0 24 24"><path d="M19.6 3.2H4.4C2.5 3.2 1 4.7 1 6.6v10.8c0 1.9 1.5 3.4 3.4 3.4h15.2c1.9 0 3.4-1.5 3.4-3.4V6.6c0-1.9-1.5-3.4-3.4-3.4zM9.5 16V8l7 4-7 4z" fill="currentColor"/></svg></a>
                            <a href="https://facebook.com/hikershorizon" aria-label="Facebook"><svg viewBox="0 0 24 24"><path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg></a>
                        </div>
                    </div>
                </div>
            </div>
            <div class="footer-bottom">
                <p class="footer-copyright">© 2026 Hikers Horizon. All rights reserved.</p>
                <div class="footer-bottom-links">
                    <a href="/Terms">Terms</a>
                    <a href="/Privacy">Privacy</a>
                    <a href="/Cancellation">Cancellation</a>
                </div>
            </div>
        `;

        if (existingFooter) {
            existingFooter.className = 'footer';
            existingFooter.innerHTML = newFooterHTML;
        } else {
            const footer = document.createElement('footer');
            footer.className = 'footer';
            footer.innerHTML = newFooterHTML;
            document.body.appendChild(footer);
        }

        const newsletterInputForm = document.querySelector('.newsletter-input');
        if (newsletterInputForm && newsletterInputForm.tagName === 'FORM') {
            newsletterInputForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                const emailInput = newsletterInputForm.querySelector('input[type="email"]');
                const email = emailInput.value;
                try {
                    const response = await fetch('/api/subscribe', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ email })
                    });
                    if (response.ok) {
                        alert('Thank you for subscribing! Stay tuned for updates.');
                        e.target.reset();
                    } else {
                        alert('Error subscribing. Please try again.');
                    }
                } catch (err) {
                    console.error('Error:', err);
                    alert('Connection error. Please try again later.');
                }
            });
        }
    }

    function initAuthNavigation() {
        const userEmail = localStorage.getItem('userEmail');
        const userName = localStorage.getItem('userName');
        const headerContainer = document.querySelector('.header-container');
        if (!headerContainer) return;

        let authNav = document.getElementById('auth-nav');
        if (!authNav) {
            authNav = document.createElement('div');
            authNav.id = 'auth-nav';
            authNav.className = 'auth-nav';
            headerContainer.appendChild(authNav);
        }

        if (userEmail) {
            authNav.innerHTML = `
                <div class="auth-nav-items">
                    <span class="user-greeting" style="color:var(--color-text-muted); font-size:0.8rem">Hi, ${userName || 'Explorer'}</span>
                    <a href="/profile.html" class="auth-link">Account</a>
                    <button class="hamburger" id="hamburger"><span></span><span></span><span></span></button>
                </div>
            `;
        } else {
            authNav.innerHTML = `
                <div class="auth-nav-items">
                    <a href="/login.html" class="auth-link login-link">Login</a>
                    <button class="hamburger" id="hamburger"><span></span><span></span><span></span></button>
                </div>
            `;
        }
        attachHamburgerListener();
    }

    function attachHamburgerListener() {
        const hamburger = document.getElementById('hamburger');
        const header = document.querySelector('.header');
        if (!hamburger) return;

        // Mobile Menu Cleanup/Setup
        let mobileNav = document.querySelector('.nav-menu-mobile');
        if (!mobileNav) {
            mobileNav = document.createElement('div');
            mobileNav.className = 'nav-menu-mobile';

            const navListClone = document.querySelector('.nav-list').cloneNode(true);
            mobileNav.appendChild(navListClone);
            document.body.appendChild(mobileNav);

            // Close menu when clicking links
            mobileNav.querySelectorAll('a').forEach(link => {
                link.addEventListener('click', () => {
                    hamburger.classList.remove('active');
                    mobileNav.classList.remove('active');
                    document.body.classList.remove('mobile-menu-open');
                    document.body.style.overflow = ''; // Restore scroll
                });
            });
        }

        hamburger.onclick = () => {
            const isActive = hamburger.classList.toggle('active');
            mobileNav.classList.toggle('active');

            // Manage overlay and body scroll
            let overlay = document.querySelector('.mobile-menu-overlay');
            if (isActive) {
                if (!overlay) {
                    overlay = document.createElement('div');
                    overlay.className = 'mobile-menu-overlay';
                    document.body.appendChild(overlay);
                    overlay.onclick = () => hamburger.click(); // Close on click
                }
                setTimeout(() => overlay.classList.add('active'), 10);
                document.body.classList.add('mobile-menu-open');
                document.body.style.overflow = 'hidden';
            } else {
                if (overlay) {
                    overlay.classList.remove('active');
                    setTimeout(() => overlay.remove(), 400);
                }
                document.body.classList.remove('mobile-menu-open');
                document.body.style.overflow = '';
            }
        };
    }

    // Run Syncing
    syncHeaderLayout();
    updateNavLinks();
    initAuthNavigation();
    injectFooter();
});
