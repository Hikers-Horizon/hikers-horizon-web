// ══════════════════════════════════════════════════════════
//  Global SEO Injector — Hikers Horizon
//  Auto-injects structured data, OG tags, and meta for all pages
// ══════════════════════════════════════════════════════════
(function() {
  const DOMAIN = window.location.origin;
  const path = window.location.pathname;
  const head = document.head;

  // ── Trek Page Data (for schema markup) ──
  const trekSEO = {
    '/Sunrise/Skandagiri-sunrise-trek-from-bangalore': {
      name: 'Skandagiri Sunrise Trek from Bangalore',
      desc: 'Experience the iconic Skandagiri sunrise trek near Bangalore. Night trek to 4,757 ft with stunning cloud-filled sunrise views. Book from ₹999 with transport, guide & breakfast included.',
      price: '999', altitude: '4757 ft', difficulty: 'Moderate', distance: '4 km',
      image: '/img/Skandagiri.jpg', duration: '12 hours',
      keywords: 'Skandagiri trek, Skandagiri sunrise trek, night trek near Bangalore, Skandagiri trek from Bangalore, Skandagiri trek booking, trekking near Bangalore'
    },
    '/Sunrise/Nandihills-sunrise-trek': {
      name: 'Nandi Hills Sunrise Trek',
      desc: 'Witness the breathtaking sunrise at Nandi Hills. Easy trek perfect for beginners, just 60km from Bangalore. Book your spot from ₹999 with Hikers Horizon.',
      price: '999', altitude: '4851 ft', difficulty: 'Easy', distance: '3 km',
      image: '/img/nandihills.jpg', duration: '10 hours',
      keywords: 'Nandi Hills trek, Nandi Hills sunrise, sunrise point Nandi Hills, trek near Bangalore, Nandi Hills from Bangalore'
    },
    '/Sunrise/Uttaribetta-sunrise-trek': {
      name: 'Uttari Betta Sunrise Trek',
      desc: 'Trek the scenic Uttari Betta hills near Bangalore for a magical sunrise experience. Moderate trail with panoramic views. Book from ₹999.',
      price: '999', altitude: '3700 ft', difficulty: 'Easy-Moderate', distance: '3 km',
      image: '/img/uttaribetta.jpg', duration: '10 hours',
      keywords: 'Uttari Betta trek, Uttari Betta sunrise, sunrise trek Bangalore, weekend trek Bangalore'
    },
    '/Sunrise/Savandurga-sunrise-trek': {
      name: 'Savandurga Night Trek',
      desc: 'Conquer Savandurga, one of the largest monolith hills in Asia! Night trek from Bangalore with stunning sunrise views. Book from ₹999.',
      price: '999', altitude: '4022 ft', difficulty: 'Moderate-Difficult', distance: '4 km',
      image: '/img/savandurga.jpg', duration: '12 hours',
      keywords: 'Savandurga trek, Savandurga night trek, monolith hill trek, trekking near Bangalore, Savandurga from Bangalore'
    },
    '/Sunrise/Anthargange-trek': {
      name: 'Anthargange Cave Trek',
      desc: 'Explore the volcanic rock formations and mysterious caves of Anthargange. Night trek with cave exploration near Bangalore. Book from ₹999.',
      price: '999', altitude: '3800 ft', difficulty: 'Moderate', distance: '3.5 km',
      image: '/img/anthargange.jpg', duration: '12 hours',
      keywords: 'Anthargange trek, Anthargange cave trek, cave trekking Bangalore, night trek near Bangalore, Anthargange from Bangalore'
    },
    '/Sunrise/Makalidurga-sunrise-trek': {
      name: 'Makalidurga Sunrise Trek',
      desc: 'Trek along the railway tracks to Makalidurga summit for stunning sunrise views. Unique trail near Bangalore. Book from ₹999.',
      price: '999', altitude: '4432 ft', difficulty: 'Moderate', distance: '4 km',
      image: '/img/makalidurga.jpg', duration: '10 hours',
      keywords: 'Makalidurga trek, Makalidurga sunrise, railway track trek Bangalore, sunrise trek near Bangalore'
    },
    '/Sunrise/Kuntibetta-sunrise-trek': {
      name: 'Kunti Betta Sunrise Trek',
      desc: 'Trek Kunti Betta near Pandavapura for a serene sunrise overlooking Thonnur Lake. Easy-moderate trek from Bangalore. Book from ₹999.',
      price: '999', altitude: '2882 ft', difficulty: 'Easy', distance: '2.5 km',
      image: '/img/kuntibetta.jpg', duration: '14 hours',
      keywords: 'Kunti Betta trek, Kuntibetta sunrise, sunrise trek from Bangalore, Pandavapura trek, weekend trek'
    },
    '/Twodays/Kuduremukha': {
      name: 'Kudremukh Trek',
      desc: 'Trek through rolling green hills and shola grasslands at Kudremukh. 2-day trek from Bangalore with camping. Book from ₹3499.',
      price: '3499', altitude: '6207 ft', difficulty: 'Moderate-Difficult', distance: '20 km',
      image: '/img/kudremukh.jpg', duration: '2 days',
      keywords: 'Kudremukh trek, Kudremukh trek from Bangalore, 2 day trek Bangalore, Western Ghats trekking, Kudremukh Peak'
    },
    '/Twodays/Netravathi': {
      name: 'Netravathi Peak Trek',
      desc: 'Summit Netravathi Peak through dense forests and grasslands. 2-day adventure trek from Bangalore. Book from ₹3499.',
      price: '3499', altitude: '5500 ft', difficulty: 'Moderate', distance: '16 km',
      image: '/img/netravathi.jpg', duration: '2 days',
      keywords: 'Netravathi Peak trek, Netravathi trek from Bangalore, 2 day trek Karnataka, Western Ghats trek'
    },
    '/Twodays/Kodachadri': {
      name: 'Kodachadri Trek',
      desc: 'Trek to Kodachadri peak through lush rainforests with stunning sunset views. 2-day adventure from Bangalore. Book from ₹3199.',
      price: '3199', altitude: '4406 ft', difficulty: 'Moderate', distance: '14 km',
      image: '/img/kodachadri.jpg', duration: '2 days',
      keywords: 'Kodachadri trek, Kodachadri trek from Bangalore, sunset trek Karnataka, 2 day trek South India'
    },
    '/Twodays/Tadiandamol': {
      name: 'Tadiandamol Trek',
      desc: 'Summit the highest peak of Coorg at Tadiandamol. 2-day trek from Bangalore with camping in the Western Ghats. Book from ₹3499.',
      price: '3499', altitude: '5735 ft', difficulty: 'Moderate', distance: '12 km',
      image: '/img/tadiandamol.jpg', duration: '2 days',
      keywords: 'Tadiandamol trek, Coorg trekking, highest peak Coorg, 2 day trek from Bangalore, Western Ghats'
    },
    '/Twodays/Kumaraparvatha': {
      name: 'Kumaraparvatha Trek',
      desc: 'Conquer Kumaraparvatha, the toughest trek in Karnataka! 2-day challenging adventure from Bangalore. Book from ₹3499.',
      price: '3499', altitude: '5627 ft', difficulty: 'Difficult', distance: '22 km',
      image: '/img/kumaraparvatha.jpg', duration: '2 days',
      keywords: 'Kumaraparvatha trek, toughest trek Karnataka, Pushpagiri trek, difficult treks South India, 2 day trek Bangalore'
    },
    '/Twodays/Gokarna': {
      name: 'Gokarna Beach Trek',
      desc: 'Trek 5 pristine beaches of Gokarna — Paradise, Half Moon, Om, Kudle & Gokarna Beach. 2-day coastal trek from Bangalore with beach camping & Murudeshwar visit. Book at ₹3,499.',
      price: '3499', altitude: 'Sea level', difficulty: 'Easy-Moderate', distance: '10 km',
      image: '/img/gokarna4.jpg', duration: '2 days',
      keywords: 'gokarna trek, gokarna beach trek, gokarna beach trek from bangalore, gokarna trekking, gokarna trek from bangalore, gokarna coastal trek, gokarna trip from bangalore, gokarna beach trek booking, gokarna beach trek itinerary, gokarna om beach trek, gokarna half moon beach trek, gokarna paradise beach trek, gokarna murudeshwar trip, gokarna trek package price, gokarna beach camping trek, best gokarna trek organizer, gokarna 2 day trip from bangalore, weekend gokarna trip'
    },
    '/Backpacking/Wayanad': {
      name: 'Wayanad Backpacking Trip',
      desc: 'Explore the lush green hills and waterfalls of Wayanad. Multi-day backpacking trip from Bangalore. Book from ₹3699.',
      price: '3699', altitude: '3000 ft', difficulty: 'Easy', distance: 'Multiple spots',
      image: '/img/wayanad.jpg', duration: '3 days',
      keywords: 'Wayanad trip from Bangalore, Wayanad backpacking, Kerala trip from Bangalore, Wayanad tour package'
    },
    '/Backpacking/Hampi': {
      name: 'Hampi Heritage Trail',
      desc: 'Explore the ancient ruins and boulder-strewn landscapes of Hampi. Heritage backpacking trip from Bangalore. Book from ₹3999.',
      price: '3999', altitude: '1600 ft', difficulty: 'Easy', distance: 'Multiple spots',
      image: '/img/hampi.jpg', duration: '2 days',
      keywords: 'Hampi trip from Bangalore, Hampi backpacking, heritage tour Hampi, Hampi tour package, weekend trip Hampi'
    },
    '/Backpacking/Chikmagaluru': {
      name: 'Chikmagaluru Adventure',
      desc: 'Coffee plantations, waterfalls, and misty mountains in Chikmagaluru. Backpacking trip from Bangalore. Book from ₹3499.',
      price: '3499', altitude: '3400 ft', difficulty: 'Easy', distance: 'Multiple spots',
      image: '/img/chikmagaluru.jpg', duration: '2 days',
      keywords: 'Chikmagaluru trip from Bangalore, Chikmagaluru backpacking, coffee plantation trip, weekend getaway Bangalore'
    },
    '/Backpacking/Coorg2days': {
      name: 'Coorg 2-Day Getaway',
      desc: 'Explore the Scotland of India with a 2-day Coorg trip from Bangalore. Waterfalls, coffee estates & Abbey Falls. Book from ₹2999.',
      price: '2999', altitude: '4000 ft', difficulty: 'Easy', distance: 'Multiple spots',
      image: '/img/coorg.jpg', duration: '2 days',
      keywords: 'Coorg trip from Bangalore, Coorg 2 day trip, Coorg tour package, weekend trip Coorg, Madikeri trip'
    },
    '/Backpacking/Coorg3days': {
      name: 'Coorg 3-Day Journey',
      desc: 'The ultimate 3-day Coorg experience from Bangalore. Abbey Falls, Dubare, Raja Seat & more. Book from ₹5999.',
      price: '5999', altitude: '4000 ft', difficulty: 'Easy', distance: 'Multiple spots',
      image: '/img/coorg.jpg', duration: '3 days',
      keywords: 'Coorg 3 day trip, Coorg from Bangalore, Coorg holiday package, Madikeri 3 days, Coorg tour'
    },
    '/Backpacking/Kodaikanal': {
      name: 'Kodaikanal Lake Trail',
      desc: 'Explore the Princess of Hill Stations - Kodaikanal. Lakes, forests, and mountain trails from Bangalore. Book from ₹4999.',
      price: '4999', altitude: '7000 ft', difficulty: 'Easy', distance: 'Multiple spots',
      image: '/img/kodaikanal.jpg', duration: '3 days',
      keywords: 'Kodaikanal trip from Bangalore, Kodaikanal backpacking, hill station trip, Princess of Hills, Kodaikanal tour'
    },
    '/Backpacking/Munnar': {
      name: 'Munnar & Kolukkumalai Adventure',
      desc: 'Experience a stunning 2-day Munnar & Kolukkumalai tour from Bangalore. Misty trails, world\'s highest tea estate sunrise, and cultural show. Book from ₹5199.',
      price: '5199', altitude: '6000 ft', difficulty: 'Easy', distance: 'Multiple spots',
      image: '/img/munnar.png', duration: '2 days',
      keywords: 'Munnar tour, Kolukkumalai sunrise trek, Munnar trip from Bangalore, Munnar tour package, Munnar weekend getaway'
    }
  };

  // ── Normalize path ──
  let cleanPath = path.replace(/\/index\.html$/, '').replace(/\/$/, '') || '/';

  // ── Gokarna domain campaign support ──
  const hostname = window.location.hostname;
  const isGokarnaDomain = hostname.includes('gokarn.online') || hostname.includes('gokarnabeachtrek.in');
  if (isGokarnaDomain) {
    if (cleanPath === '/' || cleanPath === '/index') {
      cleanPath = '/Twodays/Gokarna';
    }
  }

  // ── Find matching trek ──
  const trek = trekSEO[cleanPath];

  // ── Determine correct URL for canonical & meta ──
  const fullUrl = isGokarnaDomain && (path === '/' || path === '/index.html') ? DOMAIN + '/' : DOMAIN + path;

  // ── 1. Inject or Update canonical link (Crucial for multi-domain campaign SEO) ──
  let canonicalLink = document.querySelector('link[rel="canonical"]');
  if (!canonicalLink) {
    canonicalLink = document.createElement('link');
    canonicalLink.rel = 'canonical';
    head.appendChild(canonicalLink);
  }
  canonicalLink.href = fullUrl;

  // If not a trek page, we can still set basic OG meta but stop before structured data
  if (!trek) {
    // Inject default meta for non-trek pages if they are missing
    function addPageMeta(prop, content, isProperty) {
      if (document.querySelector(`meta[${isProperty ? 'property' : 'name'}="${prop}"]`)) return;
      const meta = document.createElement('meta');
      meta.setAttribute(isProperty ? 'property' : 'name', prop);
      meta.content = content;
      head.appendChild(meta);
    }
    
    const pageTitle = document.title || 'Hikers Horizon | Premier Trekking & Adventure Trips';
    addPageMeta('robots', 'index, follow', false);
    addPageMeta('og:type', 'website', true);
    addPageMeta('og:url', fullUrl, true);
    addPageMeta('og:title', pageTitle, true);
    addPageMeta('og:image', DOMAIN + '/img/lo.png', true);
    addPageMeta('twitter:card', 'summary_large_image', false);
    return; // Exit early since we don't have trek structured data
  }

  // ── 2. Inject missing OG & Twitter meta ──
  function addMeta(prop, content, isProperty) {
    if (document.querySelector(`meta[${isProperty ? 'property' : 'name'}="${prop}"]`)) return;
    const meta = document.createElement('meta');
    meta.setAttribute(isProperty ? 'property' : 'name', prop);
    meta.content = content;
    head.appendChild(meta);
  }

  addMeta('robots', 'index, follow, max-snippet:-1, max-image-preview:large, max-video-preview:-1', false);
  addMeta('author', 'Hikers Horizon', false);
  addMeta('keywords', trek.keywords, false);
  addMeta('og:type', 'website', true);
  addMeta('og:url', fullUrl, true);
  addMeta('og:title', trek.name + ' | Hikers Horizon', true);
  addMeta('og:description', trek.desc, true);
  addMeta('og:image', DOMAIN + trek.image, true);
  addMeta('og:site_name', 'Hikers Horizon', true);
  addMeta('twitter:card', 'summary_large_image', false);
  addMeta('twitter:title', trek.name + ' | Hikers Horizon', false);
  addMeta('twitter:description', trek.desc, false);
  addMeta('twitter:image', DOMAIN + trek.image, false);

  // ── 3. Enhance title if too short ──
  if (document.title && !document.title.includes('Hikers Horizon')) {
    document.title = document.title + ' | Hikers Horizon';
  }

  // ── 4. Inject JSON-LD: TouristTrip ──
  const trekSchema = {
    "@context": "https://schema.org",
    "@type": "TouristTrip",
    "name": trek.name,
    "description": trek.desc,
    "url": fullUrl,
    "image": DOMAIN + trek.image,
    "touristType": "Adventure Tourist",
    "provider": {
      "@type": "Organization",
      "name": "Hikers Horizon",
      "url": DOMAIN,
      "logo": DOMAIN + "/img/lo.png",
      "telephone": "+91-9902653393"
    },
    "offers": {
      "@type": "Offer",
      "price": trek.price,
      "priceCurrency": "INR",
      "availability": "https://schema.org/InStock",
      "url": fullUrl
    }
  };

  const script1 = document.createElement('script');
  script1.type = 'application/ld+json';
  script1.textContent = JSON.stringify(trekSchema);
  head.appendChild(script1);

  // ── 5. Inject JSON-LD: BreadcrumbList ──
  const pathParts = cleanPath.split('/').filter(Boolean);
  const breadcrumbs = [{ "@type": "ListItem", "position": 1, "name": "Home", "item": DOMAIN + "/" }];

  if (pathParts.length >= 1) {
    const categoryNames = { 'Sunrise': 'Sunrise Treks', 'Twodays': 'Two Day Treks', 'Backpacking': 'Backpacking Trips' };
    breadcrumbs.push({
      "@type": "ListItem", "position": 2,
      "name": categoryNames[pathParts[0]] || pathParts[0],
      "item": DOMAIN + "/" + pathParts[0] + "/"
    });
  }
  if (pathParts.length >= 2) {
    breadcrumbs.push({
      "@type": "ListItem", "position": 3,
      "name": trek.name,
      "item": fullUrl
    });
  }

  const bcSchema = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    "itemListElement": breadcrumbs
  };

  const script2 = document.createElement('script');
  script2.type = 'application/ld+json';
  script2.textContent = JSON.stringify(bcSchema);
  head.appendChild(script2);

  // ── 6. Inject JSON-LD: FAQPage (common trek questions) ──
  const faqSchema = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    "mainEntity": [
      {
        "@type": "Question",
        "name": "How to book " + trek.name + "?",
        "acceptedAnswer": {
          "@type": "Answer",
          "text": "You can book the " + trek.name + " directly on hikershorizon.in starting from ₹" + trek.price + ". Choose your preferred date, select self-drive or transport package, and complete the payment online."
        }
      },
      {
        "@type": "Question",
        "name": "What is the difficulty level of " + trek.name + "?",
        "acceptedAnswer": {
          "@type": "Answer",
          "text": "The " + trek.name + " is rated " + trek.difficulty + ". The trek distance is approximately " + trek.distance + " reaching an altitude of " + trek.altitude + "."
        }
      },
      {
        "@type": "Question",
        "name": "Is transport included in " + trek.name + "?",
        "acceptedAnswer": {
          "@type": "Answer",
          "text": "Hikers Horizon offers both self-drive and with-transport packages. The transport package includes AC/Non-AC pickup from multiple points across Bangalore."
        }
      }
    ]
  };

  const script3 = document.createElement('script');
  script3.type = 'application/ld+json';
  script3.textContent = JSON.stringify(faqSchema);
  head.appendChild(script3);

})();
