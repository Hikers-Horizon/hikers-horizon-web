/**
 * Hikers Horizon — Global Header System v3
 * Single source of truth for the header across all pages.
 * Injects HTML, CSS, nav logic, auth status, mega menu, mobile drawer, and auto-loads global footer.
 */
(function () {
    const V = '15';

    // ─── 1. Inject Global Header CSS ───
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
        f.href = 'https://fonts.googleapis.com/css2?family=Outfit:wght@400;600;700;800;900&family=Inter:wght@400;500;600;700&display=swap';
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

    // Inject Universal Global Footer if missing
    if (!document.getElementById('global-footer-js')) {
        const footerScript = document.createElement('script');
        footerScript.id = 'global-footer-js';
        footerScript.src = '/global-footer.js?v=2';
        footerScript.defer = true;
        document.body ? document.body.appendChild(footerScript) : document.head.appendChild(footerScript);
    }

    // ─── 2. Inject High-Specificity Visual Overrides ───
    if (!document.getElementById('gh-overrides')) {
        const s = document.createElement('style');
        s.id = 'gh-overrides';
        s.textContent = `
            /* ═══════════════════════════════════════════════════
               ALPINE OBSIDIAN GLASS HEADER (Desktop & Mobile)
               ═══════════════════════════════════════════════════ */
            .header {
                position: fixed !important;
                top: 0 !important;
                left: 0 !important;
                right: 0 !important;
                z-index: 7000 !important;
                padding: calc(1rem + env(safe-area-inset-top, 0px)) 1.5rem 0.75rem 1.5rem !important;
                background: transparent !important;
                border: none !important;
                width: auto !important;
                box-sizing: border-box !important;
                transition: padding 0.35s cubic-bezier(0.16, 1, 0.3, 1), background 0.35s ease !important;
            }

            .header.scrolled {
                padding: calc(0.6rem + env(safe-area-inset-top, 0px)) 1.5rem 0.5rem 1.5rem !important;
            }

            .header-container {
                max-width: 1360px !important;
                margin: 0 auto !important;
                display: flex !important;
                align-items: center !important;
                justify-content: space-between !important;
                background: rgba(6, 11, 8, 0.78) !important;
                backdrop-filter: blur(20px) !important;
                -webkit-backdrop-filter: blur(20px) !important;
                border: 1px solid rgba(16, 185, 129, 0.22) !important;
                border-radius: 50px !important;
                padding: 0.65rem 1.4rem !important;
                box-shadow: 0 10px 30px rgba(0, 0, 0, 0.5), 0 0 20px rgba(16, 185, 129, 0.08) !important;
                transition: all 0.35s cubic-bezier(0.16, 1, 0.3, 1) !important;
                box-sizing: border-box !important;
            }

            .header.scrolled .header-container {
                background: rgba(4, 8, 6, 0.94) !important;
                border-color: rgba(245, 158, 11, 0.32) !important;
                box-shadow: 0 12px 35px rgba(0, 0, 0, 0.65), 0 0 25px rgba(245, 158, 11, 0.1) !important;
            }

            /* Brand Logo */
            .logo-link {
                display: inline-flex !important;
                align-items: center !important;
                gap: 0.65rem !important;
                text-decoration: none !important;
                flex-shrink: 0 !important;
            }

            #logo {
                width: 40px !important;
                height: 40px !important;
                border-radius: 50% !important;
                border: 1px solid rgba(16, 185, 129, 0.35) !important;
                box-shadow: 0 0 12px rgba(16, 185, 129, 0.25) !important;
                flex-shrink: 0 !important;
            }

            .logo-text-container {
                display: flex !important;
                flex-direction: column !important;
                gap: 1px !important;
            }

            #global-header .logo-text-container h1,
            .header .logo-text-container h1 {
                font-family: 'Outfit', sans-serif !important;
                font-size: 1.15rem !important;
                font-weight: 900 !important;
                letter-spacing: 0.04em !important;
                text-transform: uppercase !important;
                background: linear-gradient(90deg, #FFFFFF 30%, #FBBF24 100%) !important;
                -webkit-background-clip: text !important;
                background-clip: text !important;
                -webkit-text-fill-color: transparent !important;
                color: #FFFFFF !important;
                margin: 0 !important;
                white-space: nowrap !important;
                line-height: 1.1 !important;
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
                font-size: 0.58rem !important;
                color: rgba(16, 185, 129, 0.85) !important;
                -webkit-text-fill-color: rgba(16, 185, 129, 0.85) !important;
                text-transform: uppercase !important;
                letter-spacing: 1.5px !important;
                background: none !important;
                display: block !important;
                line-height: 1.2 !important;
                font-weight: 600 !important;
            }

            /* Desktop Navigation */
            .nav-menu {
                display: flex !important;
                align-items: center !important;
            }

            .nav-list {
                display: flex !important;
                align-items: center !important;
                gap: 0.4rem !important;
                list-style: none !important;
                margin: 0 !important;
                padding: 0 !important;
            }

            .nav-link {
                font-family: 'Outfit', sans-serif !important;
                font-size: 0.9rem !important;
                font-weight: 600 !important;
                color: rgba(255, 255, 255, 0.75) !important;
                text-decoration: none !important;
                padding: 0.5rem 0.95rem !important;
                border-radius: 50px !important;
                transition: all 0.25s ease !important;
                display: inline-flex !important;
                align-items: center !important;
                gap: 0.35rem !important;
                white-space: nowrap !important;
            }

            .nav-link:hover,
            .nav-link.active {
                color: #FFFFFF !important;
                background: rgba(16, 185, 129, 0.12) !important;
                box-shadow: 0 0 15px rgba(16, 185, 129, 0.15) !important;
            }

            .nav-link .arrow {
                font-size: 0.75rem !important;
                transition: transform 0.3s ease !important;
                color: var(--gold-bright, #FBBF24) !important;
            }

            .dropdown:hover .nav-link .arrow {
                transform: rotate(180deg) !important;
            }

            /* Auth & Action Buttons */
            .auth-nav-items {
                display: flex !important;
                align-items: center !important;
                gap: 0.65rem !important;
                flex-shrink: 0 !important;
            }

            .auth-link {
                font-family: 'Outfit', sans-serif !important;
                font-size: 0.8rem !important;
                font-weight: 700 !important;
                text-transform: uppercase !important;
                letter-spacing: 0.06em !important;
                padding: 0.48rem 1.15rem !important;
                border-radius: 50px !important;
                text-decoration: none !important;
                transition: all 0.3s ease !important;
                white-space: nowrap !important;
                display: inline-flex !important;
                align-items: center !important;
                gap: 0.4rem !important;
            }

            .login-link {
                color: #060B08 !important;
                background: linear-gradient(135deg, #F59E0B, #FBBF24) !important;
                border: 1px solid rgba(245, 158, 11, 0.5) !important;
                box-shadow: 0 4px 14px rgba(245, 158, 11, 0.3) !important;
            }

            .login-link:hover {
                transform: translateY(-1px) scale(1.03) !important;
                box-shadow: 0 6px 20px rgba(245, 158, 11, 0.45) !important;
            }

            .profile-link {
                color: #FFFFFF !important;
                background: rgba(16, 185, 129, 0.2) !important;
                border: 1px solid rgba(16, 185, 129, 0.4) !important;
                box-shadow: 0 4px 14px rgba(16, 185, 129, 0.2) !important;
            }

            .profile-link:hover {
                background: rgba(16, 185, 129, 0.32) !important;
                border-color: #10B981 !important;
            }

            /* Mega Menu Upgrades */
            .mega-menu {
                position: absolute !important;
                top: 100% !important;
                left: 50% !important;
                transform: translateX(-50%) translateY(10px) !important;
                width: 90vw !important;
                max-width: 1080px !important;
                background: rgba(6, 11, 8, 0.96) !important;
                backdrop-filter: blur(28px) !important;
                -webkit-backdrop-filter: blur(28px) !important;
                border: 1px solid rgba(16, 185, 129, 0.25) !important;
                border-radius: 0 0 24px 24px !important;
                box-shadow: 0 30px 60px rgba(0, 0, 0, 0.75), 0 0 35px rgba(16, 185, 129, 0.12) !important;
                opacity: 0 !important;
                visibility: hidden !important;
                transition: all 0.35s cubic-bezier(0.16, 1, 0.3, 1) !important;
                z-index: 1000 !important;
                padding: 2rem 0 !important;
            }

            .dropdown:hover .mega-menu,
            .dropdown.open .mega-menu {
                opacity: 1 !important;
                visibility: visible !important;
                transform: translateX(-50%) translateY(0) !important;
            }

            /* ═══════════════════════════════════════════════════
               MOBILE & TABLET RESPONSIVENESS (<= 920px)
               ═══════════════════════════════════════════════════ */
            @media (max-width: 920px) {
                .header {
                    padding: calc(0.5rem + env(safe-area-inset-top, 0px)) 0.75rem 0.5rem 0.75rem !important;
                }

                .header.scrolled {
                    padding: calc(0.4rem + env(safe-area-inset-top, 0px)) 0.75rem 0.4rem 0.75rem !important;
                }

                .header-container {
                    padding: 0.45rem 0.95rem !important;
                    gap: 0.5rem !important;
                    width: 96% !important;
                    max-width: 520px !important;
                    box-sizing: border-box !important;
                }

                .logo-text-container h1 {
                    font-size: 0.85rem !important;
                }

                .logo-text-container .tagline {
                    font-size: 0.5rem !important;
                    letter-spacing: 1px !important;
                }

                #logo {
                    width: 32px !important;
                    height: 32px !important;
                }

                .nav-menu {
                    display: none !important;
                }

                .hamburger {
                    display: flex !important;
                    z-index: 9500 !important;
                }

                .auth-link {
                    padding: 0.38rem 0.75rem !important;
                    font-size: 0.72rem !important;
                }
            }

            @media (max-width: 360px) {
                .header-container {
                    padding: 0.35rem 0.65rem !important;
                    gap: 0.35rem !important;
                }

                .logo-text-container .tagline {
                    display: none !important;
                }

                .header .logo-text-container h1,
                #global-header .logo-text-container h1 {
                    font-size: 0.75rem !important;
                }

                #logo {
                    width: 28px !important;
                    height: 28px !important;
                }

                .auth-link {
                    padding: 0.32rem 0.6rem !important;
                    font-size: 0.68rem !important;
                }
            }

            body.mobile-menu-open #enquiryButton {
                opacity: 0 !important;
                pointer-events: none !important;
            }

            /* Mobile Menu Drawer (Frosted Obsidian) */
            .nav-menu-mobile {
                position: fixed !important;
                top: 0 !important;
                right: 0 !important;
                height: 100vh !important;
                height: 100dvh !important;
                width: min(340px, 86vw) !important;
                background: linear-gradient(175deg, #060B08 0%, #0A140F 60%, #050806 100%) !important;
                border-left: 1px solid rgba(16, 185, 129, 0.25) !important;
                box-shadow: -15px 0 45px rgba(0, 0, 0, 0.85) !important;
                padding: calc(24px + env(safe-area-inset-top, 0px)) 1.25rem calc(30px + env(safe-area-inset-bottom, 0px)) 1.25rem !important;
                transform: translateX(100%) !important;
                transition: transform 0.45s cubic-bezier(0.16, 1, 0.3, 1) !important;
                z-index: 8000 !important;
                display: flex !important;
                flex-direction: column !important;
                overflow-y: auto !important;
                visibility: hidden !important;
                box-sizing: border-box !important;
            }

            .nav-menu-mobile.active {
                transform: translateX(0) !important;
                visibility: visible !important;
            }

            /* WhatsApp in Mobile Drawer */
            .mobile-wa-btn {
                display: flex !important;
                align-items: center !important;
                justify-content: center !important;
                gap: 0.5rem !important;
                background: rgba(37, 211, 102, 0.15) !important;
                border: 1px solid rgba(37, 211, 102, 0.35) !important;
                color: #25D366 !important;
                border-radius: 50px !important;
                padding: 0.65rem 1rem !important;
                font-family: 'Outfit', sans-serif !important;
                font-size: 0.82rem !important;
                font-weight: 700 !important;
                text-decoration: none !important;
                margin: 0.75rem 0.5rem !important;
                transition: all 0.25s ease !important;
            }

            .mobile-wa-btn svg {
                width: 17px !important;
                height: 17px !important;
                fill: currentColor !important;
            }

            .mobile-wa-btn:hover {
                background: rgba(37, 211, 102, 0.25) !important;
            }

            /* Top Padding for Non-Home Pages (Prevent Header Collision) */
            body:not(.home-page) {
                padding-top: calc(95px + env(safe-area-inset-top, 0px)) !important;
            }

            @media (max-width: 768px) {
                body:not(.home-page) {
                    padding-top: calc(80px + env(safe-area-inset-top, 0px)) !important;
                }
            }
        `;

        // Add home-page class to body if we are on the homepage
        if (window.location.pathname === '/' || window.location.pathname === '/index.html') {
            document.body.classList.add('home-page');
        }
        document.head.appendChild(s);
    }

    // ─── 3. Header HTML Template ───
    const headerHTML = `
    <div class="header-container">
        <a href="/" class="logo-link" aria-label="Hikers Horizon Home">
            <img id="logo" src="/img/lo.png" alt="Hikers Horizon Logo" loading="eager">
            <div class="logo-text-container">
                <h1>HIKERS <span>HORIZON</span></h1>
                <div class="tagline">Explore the Unexplored</div>
            </div>
        </a>
        <nav class="nav-menu" id="navMenu">
            <ul class="nav-list">
                <li><a href="/" class="nav-link" id="nav-home">Home</a></li>
                <li class="dropdown">
                    <a href="/#treks" class="nav-link" id="nav-treks">Treks <span class="arrow">▾</span></a>
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
                                    <li class="trek-list-item"><a href="/Sunrise/Skandagiri-sunrise-trek-from-bangalore/">Skandagiri Sunrise</a></li>
                                    <li class="trek-list-item"><a href="/Sunrise/Nandihills-sunrise-trek/">Nandi Hills Sunrise</a></li>
                                    <li class="trek-list-item"><a href="/Sunrise/Uttaribetta-sunrise-trek/">Uttari Betta Trail</a></li>
                                    <li class="trek-list-item"><a href="/Sunrise/Savandurga-sunrise-trek/">Savandurga Night Trek</a></li>
                                    <li class="trek-list-item"><a href="/Sunrise/Anthargange-trek/">Anthargange Exploration</a></li>
                                </ul>
                            </div>
                            <div class="mega-menu-column">
                                <h3 class="mega-column-title">Spotlight</h3>
                                <div class="featured-trek">
                                    <img src="/img/BP.webp" alt="Netravathi Peak Trek">
                                    <div class="featured-trek-content">
                                        <div class="featured-trek-title">Netravathi Peak (4,990 FT)</div>
                                        <a href="/Twodays/Netravathi/" class="featured-trek-btn">View Expedition</a>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </li>
                <li><a href="/Corporate/" class="nav-link" id="nav-corporate">Corporate</a></li>
                <li><a href="/Blog/" class="nav-link" id="nav-blog">Blog</a></li>
                <li><a href="/About/" class="nav-link" id="nav-about">About</a></li>
                <li><a href="/Contact/" class="nav-link" id="nav-contact">Contact</a></li>
            </ul>
        </nav>
        <div class="auth-nav-items" id="authNav"></div>
    </div>
    <div class="mobile-menu-overlay" id="menuOverlay"></div>
    `;

    // ─── 4. Inject Header ───
    function injectHeader() {
        const allHeaders = Array.from(document.querySelectorAll('header, .header'));
        let el = document.getElementById('global-header') || allHeaders.find(h => h.id === 'global-header') || allHeaders[0];

        if (!el) {
            el = document.createElement('header');
            el.id = 'global-header';
            document.body.prepend(el);
        } else {
            allHeaders.forEach(h => {
                if (h !== el) h.remove();
            });
        }

        el.className = 'header';
        el.innerHTML = headerHTML;
        initLogic();
    }

    // ─── 5. Interactivity & State ───
    function initLogic() {
        const header = document.querySelector('.header');
        const authNav = document.getElementById('authNav');
        const overlay = document.getElementById('menuOverlay');

        // Active nav link highlight
        const currentPath = window.location.pathname.toLowerCase();
        if (currentPath === '/' || currentPath === '/index.html') {
            document.getElementById('nav-home')?.classList.add('active');
        } else if (currentPath.includes('/sunrise') || currentPath.includes('/twoday') || currentPath.includes('/backpacking')) {
            document.getElementById('nav-treks')?.classList.add('active');
        } else if (currentPath.includes('/corporate')) {
            document.getElementById('nav-corporate')?.classList.add('active');
        } else if (currentPath.includes('/blog')) {
            document.getElementById('nav-blog')?.classList.add('active');
        } else if (currentPath.includes('/about')) {
            document.getElementById('nav-about')?.classList.add('active');
        } else if (currentPath.includes('/contact')) {
            document.getElementById('nav-contact')?.classList.add('active');
        }

        // Auth + Hamburger
        authNav.innerHTML = `
            <div id="authContent"></div>
            <button class="hamburger" id="hamburger" aria-label="Toggle navigation menu"><span></span><span></span><span></span></button>
        `;

        const hamburger = document.getElementById('hamburger');
        const authContent = document.getElementById('authContent');

        // Auth status
        const isAuthPage = currentPath.includes('login') || currentPath.includes('signup') || currentPath.includes('profile');
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
        window.logout = function () {
            localStorage.removeItem('userEmail');
            localStorage.removeItem('userName');
            alert('Logged out successfully!');
            window.location.href = '/';
        };

        // Hamburger Drawer Toggle
        hamburger.addEventListener('click', () => {
            const active = hamburger.classList.toggle('active');
            document.body.classList.toggle('mobile-menu-open', active);
            let mob = document.querySelector('.nav-menu-mobile');

            if (!mob) {
                mob = document.createElement('div');
                mob.className = 'nav-menu-mobile';
                document.body.appendChild(mob);
            }

            mob.innerHTML = '';

            // Brand Header in Drawer with Dedicated Close Button
            const brand = document.createElement('div');
            brand.className = 'mobile-menu-brand';
            const welcomeMsg = userName ? `Hi, ${userName.split(' ')[0]} ⛰️` : 'South India Trekking Community';
            brand.innerHTML = `
                <div style="display:flex; justify-content:space-between; align-items:flex-start; width:100%;">
                    <div>
                        <div style="font-family:'Outfit', sans-serif; font-size:1.1rem; font-weight:900; color:#FFFFFF; margin-bottom:0.25rem;">
                            HIKERS <span style="color:#FBBF24;">HORIZON</span>
                        </div>
                        <div class="mobile-menu-tagline">${welcomeMsg}</div>
                    </div>
                    <button id="mobileDrawerClose" aria-label="Close menu" style="background:rgba(255,255,255,0.08); border:1px solid rgba(255,255,255,0.18); color:#FFFFFF; width:34px; height:34px; border-radius:50%; display:flex; align-items:center; justify-content:center; cursor:pointer; font-size:1rem; flex-shrink:0;">✕</button>
                </div>
            `;
            mob.appendChild(brand);

            const closeBtn = brand.querySelector('#mobileDrawerClose');
            if (closeBtn) {
                closeBtn.addEventListener('click', () => hamburger.click());
            }

            // Nav links
            const navUl = document.createElement('ul');
            navUl.className = 'nav-list';

            const menuItems = [
                { icon: '🏠', label: 'Home', href: '/' },
                { icon: '🌅', label: 'Sunrise Treks', href: '/Sunrise/' },
                { icon: '⛰️', label: 'Two-Day Ridge Treks', href: '/Twodays/' },
                { icon: '🎒', label: 'Backpacking Trips', href: '/Backpacking/' },
                { icon: '🏢', label: 'Corporate Outings', href: '/Corporate/' },
                { icon: '📖', label: 'Mountain Blog', href: '/Blog/' },
                { icon: '🌿', label: 'About Us', href: '/About/' },
                { icon: '✉️', label: 'Contact Leads', href: '/Contact/' },
            ];

            menuItems.forEach(item => {
                const li = document.createElement('li');
                const isItemActive = currentPath === item.href.toLowerCase();
                li.innerHTML = `<a href="${item.href}" class="nav-link ${isItemActive ? 'active' : ''}"><span style="font-size:0.95rem;width:22px;text-align:center;">${item.icon}</span> ${item.label}</a>`;
                navUl.appendChild(li);
            });

            // WhatsApp Direct Lead Chat in Drawer
            const waLink = document.createElement('a');
            waLink.href = 'https://wa.me/919902653393?text=Hi%20Hikers%20Horizon,%20I%20have%20an%20enquiry%20about%20upcoming%20treks';
            waLink.target = '_blank';
            waLink.rel = 'noopener';
            waLink.className = 'mobile-wa-btn';
            waLink.innerHTML = `
                <svg viewBox="0 0 24 24"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/></svg>
                <span>Chat with Trek Lead</span>
            `;

            // Logout in list if logged in
            if (userEmail || userName) {
                const logoutLi = document.createElement('li');
                logoutLi.innerHTML = '<a href="javascript:void(0)" onclick="logout()" class="nav-link" style="color: #ff6b6b;"><span style="font-size:0.95rem;width:22px;text-align:center;">⏻</span> Logout</a>';
                navUl.appendChild(logoutLi);
            }

            mob.appendChild(navUl);
            mob.appendChild(waLink);

            // Auth buttons at bottom
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

            // Close on link click
            mob.querySelectorAll('a.nav-link').forEach(link => {
                link.addEventListener('click', () => hamburger.click());
            });

            mob.classList.toggle('active', active);
            overlay.classList.toggle('active', active);
        });

        // Scroll listener for glass transition
        window.addEventListener('scroll', () => {
            header.classList.toggle('scrolled', window.scrollY > 25);
        }, { passive: true });

        // Overlay close
        overlay.addEventListener('click', () => {
            if (hamburger.classList.contains('active')) {
                hamburger.click();
            }
        });

        // Mega menu hover logic
        initMegaMenu();
    }

    // ─── 6. Mega Menu Interactivity ───
    function initMegaMenu() {
        const items = document.querySelectorAll('.category-item');
        const list = document.getElementById('trek-items-list');
        const title = document.getElementById('region-title');
        if (!items.length || !list) return;

        const data = {
            sunrise: [
                { name: 'Skandagiri Sunrise (4,750 FT)', link: '/Sunrise/Skandagiri-sunrise-trek-from-bangalore/' },
                { name: 'Nandi Hills Sunrise Getaway', link: '/Sunrise/Nandihills-sunrise-trek/' },
                { name: 'Uttari Betta Sunrise Trail', link: '/Sunrise/Uttaribetta-sunrise-trek/' },
                { name: 'Savandurga Monolith Night Trek', link: '/Sunrise/Savandurga-sunrise-trek/' },
                { name: 'Anthargange Cave Exploration', link: '/Sunrise/Anthargange-trek/' },
                { name: 'Makalidurga Fort Trek', link: '/Sunrise/Makalidurga-sunrise-trek/' }
            ],
            twodays: [
                { name: 'Netravathi Peak (4,990 FT)', link: '/Twodays/Netravathi/' },
                { name: 'Kudremukh Peak & High Sholas', link: '/Twodays/Kuduremukha/' },
                { name: 'Kodachadri Sunset Expedition', link: '/Twodays/Kodachadri/' },
                { name: 'Tadiandamol Highest Peak Coorg', link: '/Twodays/Tadiandamol/' },
                { name: 'Kumara Parvatha Challenge', link: '/Twodays/Kumaraparvatha/' },
                { name: 'Gokarna Beach Trail & Camping', link: '/Twodays/Gokarna/' }
            ],
            backpacking: [
                { name: 'Gokarna, Honnavar & Murudeshwar (3D)', link: '/Backpacking/Gokarna/' },
                { name: 'Chikmagaluru Coffee Estate Escape', link: '/Backpacking/Chikmagaluru/' },
                { name: 'Coorg Highland 3-Day Journey', link: '/Backpacking/Coorg3days/' },
                { name: 'Hampi Ancient Boulders Heritage', link: '/Backpacking/Hampi/' },
                { name: 'Wayanad Chembra & Bamboo Forests', link: '/Backpacking/Wayanad/' },
                { name: 'Kodaikanal Mist & Pines Retreat', link: '/Backpacking/Kodaikanal/' },
                { name: 'Munnar & Kolukkumalai Sunrise', link: '/Backpacking/Munnar/' },
                { name: 'Dandeli & Dudhsagar Waterfalls', link: '/Backpacking/Dandeli/' }
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

    // ─── 7. Execute ───
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', injectHeader);
    } else {
        injectHeader();
    }
})();
