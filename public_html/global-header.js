/**
 * Hikers Horizon - Global Header System v2
 * Single source of truth for the header across all pages.
 * Injects HTML, CSS, nav logic, auth status, hamburger menu.
 */
(function () {
    const V = '13';

    // ─── 1. Inject Global CSS (with !important overrides) ───
    if (!document.getElementById('gh-css')) {
        const link = document.createElement('link');
        link.id = 'gh-css';
        link.rel = 'stylesheet';
        link.href = '/auth-navigation.css?v=' + V;
        document.head.appendChild(link);
    }

    // Inject Google Fonts if missing
    if (!document.querySelector('link[href*="fonts.googleapis.com"]')) {
        const f = document.createElement('link');
        f.rel = 'stylesheet';
        f.href = 'https://fonts.googleapis.com/css2?family=Outfit:wght@400;700;900&family=Inter:wght@400;600&display=swap';
        document.head.appendChild(f);
    }

    // Inject SEO injector globally if missing
    if (!document.getElementById('seo-injector-js')) {
        const seoScript = document.createElement('script');
        seoScript.id = 'seo-injector-js';
        seoScript.src = '/seo-injector.js';
        seoScript.defer = true;
        document.head.appendChild(seoScript);
    }

    // Inject inline overrides to kill any leftover local header CSS
    if (!document.getElementById('gh-overrides')) {
        const s = document.createElement('style');
        s.id = 'gh-overrides';
        s.textContent = `
            /* Force global header look on ALL pages */
            .header {
                position: fixed !important;
                top: 0 !important;
                left: 0 !important;
                right: 0 !important;
                z-index: 7000 !important;
                padding: 1.25rem 2rem !important;
                background: transparent !important;
                border: none !important;
                border-bottom: none !important;
                width: auto !important;
            }
            .header.scrolled {
                padding: 0.75rem 2rem !important;
            }
            .header-container {
                max-width: 1400px !important;
                margin: 0 auto !important;
                display: flex !important;
                align-items: center !important;
                justify-content: space-between !important;
                background: rgba(10, 10, 10, 0.8) !important;
                backdrop-filter: blur(12px) !important;
                -webkit-backdrop-filter: blur(12px) !important;
                border: 1px solid rgba(255, 255, 255, 0.1) !important;
                border-radius: 50px !important;
                padding: 0.75rem 1.5rem !important;
            }
            .logo-link {
                display: flex !important;
                align-items: center !important;
                gap: 0.5rem !important;
                text-decoration: none !important;
            }
            #logo {
                max-width: 45px !important;
                max-height: 45px !important;
                border-radius: 50% !important;
            }
            .logo-text-container {
                display: flex !important;
                flex-direction: column !important;
                gap: 2px !important;
                margin-left: 0 !important;
            }
            #global-header .logo-text-container h1,
            .header .logo-text-container h1 {
                font-family: 'Outfit', sans-serif !important;
                font-size: 1.25rem !important;
                font-weight: 900 !important;
                letter-spacing: 0.05rem !important;
                text-transform: uppercase !important;
                background: linear-gradient(to right, #f5c842 0%, #e2b75a 30%, #ffffff 80%, #ffffff 100%) !important;
                -webkit-background-clip: text !important;
                background-clip: text !important;
                -webkit-text-fill-color: transparent !important;
                color: transparent !important;
                margin: 0 !important;
                white-space: nowrap !important;
                line-height: 1.1 !important;
                filter: drop-shadow(0 0 10px rgba(226, 183, 90, 0.15)) !important;
            }
            #global-header .logo-text-container h1 span,
            .header .logo-text-container h1 span {
                background: none !important;
                -webkit-background-clip: unset !important;
                background-clip: unset !important;
                -webkit-text-fill-color: inherit !important;
                color: inherit !important;
            }
            .logo-text-container .tagline {
                font-family: 'Inter', sans-serif !important;
                font-size: 0.55rem !important;
                color: rgba(255, 255, 255, 0.6) !important;
                -webkit-text-fill-color: rgba(255, 255, 255, 0.6) !important;
                text-transform: uppercase !important;
                letter-spacing: 2px !important;
                background: none !important;
                display: block !important;
                line-height: 1.2 !important;
                margin-top: -2px !important;
                font-weight: 500 !important;
            }
            .auth-nav-items {
                display: flex !important;
                align-items: center !important;
                gap: 0.8rem !important;
            }
            .auth-link {
                font-family: 'Outfit', sans-serif !important;
                font-size: 0.8rem !important;
                font-weight: 700 !important;
                text-transform: uppercase !important;
                letter-spacing: 0.05rem !important;
                padding: 0.5rem 1.2rem !important;
                border-radius: 50px !important;
                text-decoration: none !important;
                transition: all 0.3s ease !important;
                white-space: nowrap !important;
            }
            .login-link {
                color: #fff !important;
                border: 1px solid rgba(255,255,255,0.2) !important;
                background: transparent !important;
            }
            .profile-link {
                color: #fff !important;
                border: 1px solid rgba(255,255,255,0.2) !important;
                background: transparent !important;
            }
            @media (max-width: 768px) {
                .header { padding: 0.5rem !important; }
                .header.scrolled { padding: 0.5rem !important; }
                .header-container {
                    padding: 0.4rem 1rem !important;
                    gap: 0.4rem !important;
                    width: 94% !important;
                    overflow: hidden !important;
                }
                .logo-text-container h1 { font-size: 0.72rem !important; flex-shrink: 1 !important; }
                .logo-text-container .tagline { font-size: 0.45rem !important; }
                #logo { width: 32px !important; height: 32px !important; flex-shrink: 0 !important; }
                .auth-link { padding: 0.4rem 0.6rem !important; font-size: 0.7rem !important; flex-shrink: 0 !important; }
                .auth-nav-items { gap: 0.4rem !important; flex-shrink: 0 !important; }
                .hamburger { flex-shrink: 0 !important; margin-right: -2px !important; }
                .user-greeting { display: none !important; }
                .nav-menu { display: none !important; }
                .hamburger { display: flex !important; }
            }

            /* Fix for content underlapping fixed header */
            body:not(.home-page) {
                padding-top: 100px !important;
            }
            @media (max-width: 768px) {
                body:not(.home-page) {
                    padding-top: 80px !important;
                }
            }
        `;
        
        // Add home-page class to body if we are on the homepage
        if (window.location.pathname === '/' || window.location.pathname === '/index.html' || window.location.pathname.endsWith('/index.html') && window.location.pathname.split('/').length <= 2) {
            document.body.classList.add('home-page');
        }
        document.head.appendChild(s);
    }

    // ─── 2. Header HTML Template ───
    const headerHTML = `
    <div class="header-container">
        <a href="/index.html" class="logo-link" aria-label="Hikers Horizon Home">
            <img id="logo" src="/img/lo.png" alt="Hikers Horizon Logo" loading="eager">
            <div class="logo-text-container">
                <h1>HIKERS <span>HORIZON</span></h1>
                <div class="tagline">Explore the Unexplored</div>
            </div>
        </a>
        <nav class="nav-menu" id="navMenu">
            <ul class="nav-list">
                <li><a href="/index.html" class="nav-link">Home</a></li>
                <li class="dropdown">
                    <a href="/index.html#treks" class="nav-link">Treks <span class="arrow">▾</span></a>
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
                                    <li class="trek-list-item"><a href="/Sunrise/Skandagiri-sunrise-trek-from-bangalore">Skandagiri Sunrise</a></li>
                                    <li class="trek-list-item"><a href="/Sunrise/Nandihills-sunrise-trek">Nandi Hills Sunrise</a></li>
                                    <li class="trek-list-item"><a href="/Sunrise/Uttaribetta-sunrise-trek">Uttari Betta Trek</a></li>
                                    <li class="trek-list-item"><a href="/Sunrise/Savandurga-sunrise-trek">Savandurga Night Trek</a></li>
                                    <li class="trek-list-item"><a href="/Sunrise/Anthargange-trek">Anthargange Exploration</a></li>
                                </ul>
                            </div>
                            <div class="mega-menu-column">
                                <h3 class="mega-column-title">Spotlight</h3>
                                <div class="featured-trek">
                                    <img src="/img/BP.webp" alt="Gokarna Beach Trek">
                                    <div class="featured-trek-content">
                                        <div class="featured-trek-title">Gokarna Beach Trek</div>
                                        <a href="/Backpacking/index.html" class="featured-trek-btn">Explore Now</a>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </li>
                <li><a href="/Corporate/index.html" class="nav-link">Corporate</a></li>
                <li><a href="/Blog/index.html" class="nav-link">Blog</a></li>
                <li><a href="/About/index.html" class="nav-link">About</a></li>
                <li><a href="/Contact/index.html" class="nav-link">Contact</a></li>
            </ul>
        </nav>
        <div class="auth-nav-items" id="authNav"></div>
    </div>
    <div class="mobile-menu-overlay" id="menuOverlay"></div>
    `;

    // ─── 3. Inject Header ───
    function injectHeader() {
        let el = document.getElementById('global-header') || document.querySelector('header');
        if (!el) {
            el = document.createElement('header');
            el.id = 'global-header';
            document.body.prepend(el);
        }
        el.className = 'header';
        el.innerHTML = headerHTML;
        initLogic();
    }

    // ─── 4. All interactivity ───
    function initLogic() {
        const header = document.querySelector('.header');
        const authNav = document.getElementById('authNav');
        const overlay = document.getElementById('menuOverlay');

        // Auth + Hamburger
        authNav.innerHTML = `
            <div id="authContent"></div>
            <button class="hamburger" id="hamburger"><span></span><span></span><span></span></button>
        `;

        const hamburger = document.getElementById('hamburger');
        const authContent = document.getElementById('authContent');

        // Auth status — hide on login/signup/profile pages
        const page = window.location.pathname;
        const isAuthPage = page.includes('login') || page.includes('signup') || page.includes('profile');
        
        const userEmail = localStorage.getItem('userEmail');
        const userName = localStorage.getItem('userName');

        if (!isAuthPage) {
            if (userEmail || userName) {
                authContent.innerHTML = '<a href="/profile.html" class="auth-link profile-link">ACCOUNT</a>';
            } else {
                authContent.innerHTML = '<a href="/login.html" class="auth-link login-link">LOGIN</a>';
            }
        }

        // Global Logout Function
        window.logout = function() {
            localStorage.removeItem('userEmail');
            localStorage.removeItem('userName');
            // Check if any other auth items are stored
            alert('Logged out successfully!');
            window.location.href = '/index.html';
        };

        // Hamburger
        hamburger.addEventListener('click', () => {
            const active = hamburger.classList.toggle('active');
            document.body.classList.toggle('mobile-menu-open', active);
            let mob = document.querySelector('.nav-menu-mobile');
            
            if (!mob) {
                mob = document.createElement('div');
                mob.className = 'nav-menu-mobile';
                document.body.appendChild(mob);
            }

            // Always rebuild mobile menu for fresh auth state
            mob.innerHTML = '';

            // ── Brand header ──
            const brand = document.createElement('div');
            brand.className = 'mobile-menu-brand';
            const welcomeMsg = userName ? `Hi, ${userName.split(' ')[0]}` : 'Explore the Unexplored';
            brand.innerHTML = `<div class="mobile-menu-tagline">${welcomeMsg}</div>`;
            mob.appendChild(brand);

            // ── Nav links ──
            const navUl = document.createElement('ul');
            navUl.className = 'nav-list';

            const menuItems = [
                { icon: '⌂', label: 'Home', href: '/index.html' },
                { icon: '▲', label: 'Treks', href: '/index.html#treks' },
                { icon: '◆', label: 'Corporate', href: '/Corporate/index.html' },
                { icon: '✎', label: 'Blog', href: '/Blog/index.html' },
                { icon: '◎', label: 'About', href: '/About/index.html' },
                { icon: '✉', label: 'Contact', href: '/Contact/index.html' },
            ];

            menuItems.forEach(item => {
                const li = document.createElement('li');
                li.innerHTML = `<a href="${item.href}" class="nav-link"><span style="font-size:0.9rem;opacity:0.4;width:20px;text-align:center;">${item.icon}</span> ${item.label}</a>`;
                navUl.appendChild(li);
            });

            // Add Logout to main list if logged in
            if (userEmail || userName) {
                const logoutLi = document.createElement('li');
                logoutLi.innerHTML = '<a href="javascript:void(0)" onclick="logout()" class="nav-link" style="color: #ff6b6b;"><span style="font-size:0.9rem;opacity:0.7;width:20px;text-align:center;">⏻</span> Logout</a>';
                navUl.appendChild(logoutLi);
            }

            mob.appendChild(navUl);

            // ── Auth section at bottom ──
            const authSection = document.createElement('div');
            authSection.className = 'mobile-menu-auth';
            
            if (userEmail || userName) {
                authSection.innerHTML = `
                    <a href="/profile.html" class="mobile-auth-btn primary" style="width: 100%;">View Account</a>
                `;
            } else {
                authSection.innerHTML = `
                    <a href="/login.html" class="mobile-auth-btn secondary">Login</a>
                    <a href="/signup.html" class="mobile-auth-btn primary">Sign Up</a>
                `;
            }
            mob.appendChild(authSection);

            // Close menu on link click
            mob.querySelectorAll('a.nav-link').forEach(link => {
                link.addEventListener('click', () => {
                    hamburger.click();
                });
            });
            
            mob.classList.toggle('active', active);
            overlay.classList.toggle('active', active);
        });

        // Scroll
        window.addEventListener('scroll', () => {
            header.classList.toggle('scrolled', window.scrollY > 30);
        }, { passive: true });

        // Overlay close
        overlay.addEventListener('click', () => {
            if (hamburger.classList.contains('active')) {
                hamburger.click();
            }
        });

        // Mega menu
        initMegaMenu();
    }

    function initMegaMenu() {
        const items = document.querySelectorAll('.category-item');
        const list = document.getElementById('trek-items-list');
        const title = document.getElementById('region-title');
        if (!items.length || !list) return;

        const data = {
            sunrise: [
                { name: 'Skandagiri Sunrise', link: '/Sunrise/Skandagiri-sunrise-trek-from-bangalore/index.html' },
                { name: 'Nandi Hills Sunrise', link: '/Sunrise/Nandihills-sunrise-trek/index.html' },
                { name: 'Uttari Betta Trek', link: '/Sunrise/Uttaribetta-sunrise-trek/index.html' },
                { name: 'Savandurga Night Trek', link: '/Sunrise/Savandurga-sunrise-trek/index.html' },
                { name: 'Anthargange Exploration', link: '/Sunrise/Anthargange-trek/index.html' },
                { name: 'Makalidurga Adventure', link: '/Sunrise/Makalidurga-sunrise-trek/index.html' }
            ],
            twodays: [
                { name: 'Kudremukh Trek', link: '/Twodays/Kuduremukha/index.html' },
                { name: 'Netravathi Trek', link: '/Twodays/Netravathi/index.html' },
                { name: 'Kodachadri Adventure', link: '/Twodays/Kodachadri/index.html' },
                { name: 'Tadiandamol Expedition', link: '/Twodays/Tadiandamol/index.html' },
                { name: 'Kumaraparvatha Trek', link: '/Twodays/Kumaraparvatha/index.html' },
                { name: 'Gokarna Beach Trek', link: '/Twodays/Gokarna/index.html' }
            ],
            backpacking: [
                { name: 'Gokarna Beach Trek', link: '/Backpacking/index.html' },
                { name: 'Chikmagaluru Escape', link: '/Backpacking/Chikmagaluru/index.html' },
                { name: 'Coorg 3-Day Trip', link: '/Backpacking/Coorg3days/index.html' },
                { name: 'Hampi Heritage Trail', link: '/Backpacking/Hampi/index.html' },
                { name: 'Wayanad Expedition', link: '/Backpacking/Wayanad/index.html' },
                { name: 'Kodaikanal Retreat', link: '/Backpacking/Kodaikanal/index.html' }
            ]
        };

        items.forEach(item => {
            item.addEventListener('mouseenter', () => {
                const region = item.getAttribute('data-region');
                items.forEach(i => i.classList.remove('active'));
                item.classList.add('active');
                title.textContent = item.childNodes[0].textContent.trim() + ' Treks';
                const treks = data[region] || [];
                list.innerHTML = treks.map(t => `<li class="trek-list-item"><a href="${t.link}">${t.name}</a></li>`).join('');
            });
        });
    }

    // ─── 5. Run ───
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', injectHeader);
    } else {
        injectHeader();
    }
})();
