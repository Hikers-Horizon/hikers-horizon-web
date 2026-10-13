"""Centralized Trek Catalog & Matching Service for Bengaluru Trails / Hikers Horizon.

Maintains accurate mapping between treks, official website URLs on bengalurutrails.in,
prices, inclusions, and keyword recognition.
"""
from __future__ import annotations
import re
from typing import Optional, Dict, Any

TREK_CATALOG: Dict[str, Dict[str, Any]] = {
    "munnar": {
        "key": "munnar",
        "name": "Munnar Backpacking",
        "category": "Backpacking",
        "url": "https://bengalurutrails.in/Backpacking/Munnar/",
        "price": "₹5,499",
        "price_num": 5499,
        "duration": "2 Days / 1 Night (leaves Friday night)",
        "keywords": [
            "munnar", "kolukkumalai", "meesapulimala", "mattupetty", "top station",
            "kundala", "munnar tea gardens", "jeep safari"
        ],
        "inclusions": (
            "Round-trip travel from Bangalore, comfortable mountain stay, 3 breakfasts & 2 campfire meals, "
            "Kolukkumalai sunrise jeep safari, tea plantation walks, and experienced trip captain."
        ),
    },
    "kudremukh": {
        "key": "kudremukh",
        "name": "Kudremukha Peak Trek",
        "category": "Twodays",
        "url": "https://bengalurutrails.in/Twodays/Kuduremukha/",
        "price": "₹3,499",
        "price_num": 3499,
        "duration": "2 Days / 1 Night (leaves Friday night)",
        "keywords": [
            "kudremukh", "kudremukha", "kuduremukha", "kudremuk", "horse face peak"
        ],
        "inclusions": (
            "Round-trip travel from Bangalore, homestay accommodation, 2 breakfasts, 1 packed lunch, 1 dinner, "
            "forest permit fees, and certified local guides (requires at least 20 days advance booking for permits)."
        ),
    },
    "gokarna": {
        "key": "gokarna",
        "name": "Gokarna Beach Trek",
        "category": "Twodays",
        "url": "https://bengalurutrails.in/Twodays/Gokarna/",
        "price": "₹3,499",
        "price_num": 3499,
        "duration": "2 Days / 1 Night (leaves Friday night)",
        "keywords": [
            "gokarna", "gokarn", "beach trek", "om beach", "kudle beach", "paradise beach", "half moon beach"
        ],
        "inclusions": (
            "Round-trip travel from Bangalore, beach campsite/stay, 2 breakfasts, 1 dinner, "
            "5-beach trek route, campfire (subject to weather), and trip lead."
        ),
    },
    "kodachadri": {
        "key": "kodachadri",
        "name": "Kodachadri Trek",
        "category": "Twodays",
        "url": "https://bengalurutrails.in/Twodays/Kodachadri/",
        "price": "₹3,799",
        "price_num": 3799,
        "duration": "2 Days / 1 Night (leaves Friday night)",
        "keywords": [
            "kodachadri", "hidlumane", "hidlumane falls", "sarvajna peetha"
        ],
        "inclusions": (
            "Round-trip travel from Bangalore, traditional Malnad homestay, 2 breakfasts, 1 lunch, 1 dinner, "
            "Hidlumane waterfalls visit, off-road 4x4 jeep ride, and trek lead."
        ),
    },
    "kumaraparvatha": {
        "key": "kumaraparvatha",
        "name": "Kumara Parvatha Trek",
        "category": "Twodays",
        "url": "https://bengalurutrails.in/Twodays/Kumaraparvatha/",
        "price": "₹3,299",
        "price_num": 3299,
        "duration": "2 Days / 1 Night (leaves Friday night)",
        "keywords": [
            "kumara parvatha", "kumaraparvatha", "kp", "pushpagiri", "bhattara mane", "shesha parvatha"
        ],
        "inclusions": (
            "Round-trip travel from Bangalore, stay/tents, vegetarian meals, forest entry permits, "
            "and experienced mountain guide."
        ),
    },
    "netravathi": {
        "key": "netravathi",
        "name": "Netravathi Peak Trek",
        "category": "Twodays",
        "url": "https://bengalurutrails.in/Twodays/Netravathi/",
        "price": "₹3,499",
        "price_num": 3499,
        "duration": "2 Days / 1 Night (leaves Friday night)",
        "keywords": [
            "netravathi", "netravati", "nethravathi", "nethravati"
        ],
        "inclusions": (
            "Round-trip travel from Bangalore, homestay accommodation, 2 breakfasts, 1 packed lunch, 1 dinner, "
            "forest department permits, and trek guide (requires advance permit booking)."
        ),
    },
    "tadiandamol": {
        "key": "tadiandamol",
        "name": "Tadiandamol Peak Trek",
        "category": "Twodays",
        "url": "https://bengalurutrails.in/Twodays/Tadiandamol/",
        "price": "₹2,299",
        "price_num": 2299,
        "duration": "2 Days / 1 Night (leaves Friday night)",
        "keywords": [
            "tadiandamol", "thadiyandamol", "coorg highest peak"
        ],
        "inclusions": (
            "Round-trip travel from Bangalore, Coorg homestay stay, 2 breakfasts, 1 dinner, "
            "forest entry fees, and trek guide."
        ),
    },
    "wayanad": {
        "key": "wayanad",
        "name": "Wayanad Backpacking",
        "category": "Backpacking",
        "url": "https://bengalurutrails.in/Backpacking/Wayanad/",
        "price": "₹3,699",
        "price_num": 3699,
        "duration": "2 Days / 1 Night (leaves Friday night)",
        "keywords": [
            "wayanad", "chembra", "banasura", "edakkal caves", "soochipara"
        ],
        "inclusions": (
            "Round-trip travel from Bangalore, resort/homestay stay, 2 breakfasts, 1 dinner, "
            "sightseeing across Wayanad, and trip coordinator."
        ),
    },
    "chikmagalur": {
        "key": "chikmagalur",
        "name": "Chikmagalur Plantation Tour",
        "category": "Backpacking",
        "url": "https://bengalurutrails.in/Backpacking/Chikmagaluru/",
        "price": "₹3,499",
        "price_num": 3499,
        "duration": "2 Days / 1 Night (leaves Friday night)",
        "keywords": [
            "chikmagalur", "chikmagaluru", "mullayanagiri", "baba budangiri", "jhari falls", "z point"
        ],
        "inclusions": (
            "Round-trip travel from Bangalore, coffee estate stay, 2 breakfasts, 1 dinner, "
            "Mullayanagiri peak visit, waterfalls, and tour lead."
        ),
    },
    "coorg": {
        "key": "coorg",
        "name": "Coorg Backpacking",
        "category": "Backpacking",
        "url": "https://bengalurutrails.in/Backpacking/Coorg2days/",
        "price": "₹3,499",
        "price_num": 3499,
        "duration": "2 Days / 1 Night (leaves Friday night)",
        "keywords": [
            "coorg", "madikeri", "coorg 2 days", "coorg 3 days", "abbey falls", "namdroling", "golden temple"
        ],
        "inclusions": (
            "Round-trip travel from Bangalore, coffee plantation homestay, 2 breakfasts, 1 dinner, "
            "camp fire, Dubare elephant camp, Tibetan monastery, and guide."
        ),
    },
    "kodaikanal": {
        "key": "kodaikanal",
        "name": "Kodaikanal Hill Station Tour",
        "category": "Backpacking",
        "url": "https://bengalurutrails.in/Backpacking/Kodaikanal/",
        "price": "₹4,499",
        "price_num": 4499,
        "duration": "2 Days / 1 Night (leaves Friday night)",
        "keywords": [
            "kodaikanal", "kodai", "vattakanal", "dolphin nose", "pillar rocks"
        ],
        "inclusions": (
            "Round-trip travel from Bangalore, hillside stay, 2 breakfasts, 1 dinner, "
            "sightseeing (Dolphin's Nose, Vattakanal), and tour coordinator."
        ),
    },
    "hampi": {
        "key": "hampi",
        "name": "Hampi Heritage Trip",
        "category": "Backpacking",
        "url": "https://bengalurutrails.in/Backpacking/Hampi/",
        "price": "₹4,499",
        "price_num": 4499,
        "duration": "2 Days / 1 Night (leaves Friday night)",
        "keywords": [
            "hampi", "hippie island", "tungabhadra", "sanapur lake", "virupaksha"
        ],
        "inclusions": (
            "Round-trip travel from Bangalore, cafe-side stay, 2 breakfasts, coracle boat ride, "
            "heritage ruins tour, sunrise point hike, and guide."
        ),
    },
    "skandagiri": {
        "key": "skandagiri",
        "name": "Skandagiri Sunrise Trek",
        "category": "Sunrise",
        "url": "https://bengalurutrails.in/Sunrise/Skandagiri-sunrise-trek-from-bangalore/",
        "price": "₹1,499",
        "price_num": 1499,
        "duration": "Night trek (11:00 PM to 10:00 AM next day)",
        "keywords": [
            "skandagiri", "skandagiri sunrise", "kalavara durga"
        ],
        "inclusions": (
            "Bangalore round-trip transportation, forest trek entry permit, certified trek lead, "
            "first aid, and morning breakfast."
        ),
    },
    "anthargange": {
        "key": "anthargange",
        "name": "Anthargange Sunrise Trek",
        "category": "Sunrise",
        "url": "https://bengalurutrails.in/Sunrise/Anthargange-trek/",
        "price": "₹1,099",
        "price_num": 1099,
        "duration": "Night trek (11:30 PM to 10:00 AM next day)",
        "keywords": [
            "anthargange", "antaragange", "anthargange cave", "cave exploration"
        ],
        "inclusions": (
            "Bangalore round-trip transportation, volcanic cave exploration with safety lead, "
            "sunrise viewpoint trek, and morning breakfast."
        ),
    },
    "uttaribetta": {
        "key": "uttaribetta",
        "name": "Uttaribetta Sunrise Trek",
        "category": "Sunrise",
        "url": "https://bengalurutrails.in/Sunrise/Uttaribetta-sunrise-trek/",
        "price": "₹999",
        "price_num": 999,
        "duration": "Night trek (11:30 PM to 10:00 AM next day)",
        "keywords": [
            "uttaribetta", "uttari betta", "hutridurga"
        ],
        "inclusions": (
            "Bangalore round-trip transportation, historic fort gate trek, sunrise viewpoint, "
            "trek lead, and morning breakfast."
        ),
    },
    "kuntibetta": {
        "key": "kuntibetta",
        "name": "Kuntibetta Sunrise Trek",
        "category": "Sunrise",
        "url": "https://bengalurutrails.in/Sunrise/Kuntibetta-sunrise-trek/",
        "price": "₹1,199",
        "price_num": 1199,
        "duration": "Night trek (11:30 PM to 10:00 AM next day)",
        "keywords": [
            "kuntibetta", "kunti betta", "tonnur lake"
        ],
        "inclusions": (
            "Bangalore round-trip transportation, mountain trek with sunrise views, "
            "Tonnur lake visit, trek lead, and morning breakfast."
        ),
    },
    "makalidurga": {
        "key": "makalidurga",
        "name": "Makalidurga Sunrise Trek",
        "category": "Sunrise",
        "url": "https://bengalurutrails.in/Sunrise/Makalidurga-sunrise-trek/",
        "price": "₹1,199",
        "price_num": 1199,
        "duration": "Night trek (11:30 PM to 10:00 AM next day)",
        "keywords": [
            "makalidurga", "makali"
        ],
        "inclusions": (
            "Bangalore round-trip transportation, railway track trail & fort trek, trek lead, "
            "and morning breakfast."
        ),
    },
    "nandihills": {
        "key": "nandihills",
        "name": "Nandi Hills Sunrise Tour",
        "category": "Sunrise",
        "url": "https://bengalurutrails.in/Sunrise/Nandihills-sunrise-trek/",
        "price": "₹999",
        "price_num": 999,
        "duration": "Early morning tour (3:30 AM to 11:30 AM)",
        "keywords": [
            "nandi hills", "nandihills", "nandi"
        ],
        "inclusions": (
            "Bangalore round-trip transportation, hilltop sunrise view, entry passes, and breakfast."
        ),
    },
    "savandurga": {
        "key": "savandurga",
        "name": "Savandurga Trek",
        "category": "Sunrise",
        "url": "https://bengalurutrails.in/Sunrise/Savandurga-sunrise-trek/",
        "price": "₹1,099",
        "price_num": 1099,
        "duration": "Day / morning trek (6:00 AM to 2:00 PM)",
        "keywords": [
            "savandurga", "savandurga trek", "monolith"
        ],
        "inclusions": (
            "Bangalore round-trip transportation, Asia's largest monolith trek with certified lead, "
            "and breakfast."
        ),
    },
}


def detect_trek(text: str | None) -> Optional[Dict[str, Any]]:
    """Inspects text, ad titles, reel captions, or referral data to detect a matching trek."""
    if not text:
        return None
    lower = text.lower()
    
    # Priority matching: longer keyword combinations first
    # e.g., 'kumara parvatha' before 'kumara'
    best_match = None
    longest_match_len = 0
    
    for key, data in TREK_CATALOG.items():
        for kw in data["keywords"]:
            pattern = r"\b" + re.escape(kw) + r"\b"
            if re.search(pattern, lower) or kw in lower:
                if len(kw) > longest_match_len:
                    longest_match_len = len(kw)
                    best_match = data
                    
    return best_match


def get_trek_by_name(name: str | None) -> Optional[Dict[str, Any]]:
    """Look up catalog entry by trek name or partial name."""
    if not name:
        return None
    return detect_trek(name)


def get_trek_url(trek_name_or_key: str | None) -> str:
    """Returns the exact official page URL for the trek. Falls back to https://bengalurutrails.in/Twodays/ only if completely unknown."""
    if not trek_name_or_key:
        return "https://bengalurutrails.in/Twodays/"
    
    trek = get_trek_by_name(trek_name_or_key)
    if trek:
        return trek["url"]
    
    lower = trek_name_or_key.lower()
    if "backpack" in lower or "munnar" in lower or "wayanad" in lower or "coorg" in lower or "kodai" in lower or "hampi" in lower or "chikmagal" in lower:
        return "https://bengalurutrails.in/Backpacking/"
    if "sunrise" in lower or "skandagiri" in lower or "uttari" in lower or "kunti" in lower or "anthar" in lower:
        return "https://bengalurutrails.in/Sunrise/"
        
    return "https://bengalurutrails.in/Twodays/"


def get_trek_inclusions(trek_name_or_key: str | None) -> str:
    """Returns the accurate inclusions string for a trek."""
    trek = get_trek_by_name(trek_name_or_key)
    if trek:
        return trek["inclusions"]
    return "Round-trip travel from Bangalore, stay/campsite, meals, permits, and an experienced trek guide."


def get_trek_price(trek_name_or_key: str | None) -> str:
    """Returns the price string for a trek."""
    trek = get_trek_by_name(trek_name_or_key)
    if trek:
        return trek["price"]
    return "₹3,499"
