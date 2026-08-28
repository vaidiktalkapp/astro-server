import sys
import json
import datetime
import os

# Add current directory to sys.path to allow importing local modules
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

try:
    import swisseph as swe
    HAS_SWISSEPH = True
except ImportError:
    HAS_SWISSEPH = False

# ─── Constants ────────────────────────────────────────────────────────────────

ZODIAC_SIGNS = [
    "Aries", "Taurus", "Gemini", "Cancer", "Leo", "Virgo",
    "Libra", "Scorpio", "Sagittarius", "Capricorn", "Aquarius", "Pisces"
]

NAKSHATRAS = [
    "Ashwini", "Bharani", "Krittika", "Rohini", "Mrigashira", "Ardra",
    "Punarvasu", "Pushya", "Ashlesha", "Magha", "Purva Phalguni",
    "Uttara Phalguni", "Hasta", "Chitra", "Swati", "Vishakha", "Anuradha",
    "Jyeshtha", "Mula", "Purva Ashadha", "Uttara Ashadha", "Shravana",
    "Dhanishta", "Shatabhisha", "Purva Bhadrapada", "Uttara Bhadrapada", "Revati"
]

TITHI_NAMES = [
    "Prathama", "Dwitiya", "Tritiya", "Chaturthi", "Panchami", "Shashthi",
    "Saptami", "Ashtami", "Navami", "Dashami", "Ekadashi", "Dwadashi",
    "Trayodashi", "Chaturdashi", "Purnima/Amavasya"
]

YOGA_NAMES = [
    "Vishkumbha", "Preeti", "Ayushman", "Saubhagya", "Shobhana", "Atiganda",
    "Sukarma", "Dhriti", "Shoola", "Ganda", "Vriddhi", "Dhruva", "Vyaghata",
    "Harshana", "Vajra", "Siddhi", "Vyatipata", "Variyan", "Parigha", "Shiva",
    "Siddha", "Sadhya", "Shubha", "Shukla", "Brahma", "Indra", "Vaidhriti"
]

KARANA_NAMES = [
    "Kintughna", "Bava", "Balava", "Kaulava", "Taitila", "Gara",
    "Vanija", "Vishti", "Shakuni", "Chatushpada", "Naga"
]

DASHA_LORDS = ["Ketu", "Venus", "Sun", "Moon", "Mars", "Rahu", "Jupiter", "Saturn", "Mercury"]
DASHA_YEARS = [7, 20, 6, 10, 7, 18, 16, 19, 17]

PLANET_IDS = {
    "Sun":     "SUN",
    "Moon":    "MOON",
    "Mars":    "MARS",
    "Mercury": "MERCURY",
    "Jupiter": "JUPITER",
    "Venus":   "VENUS",
    "Saturn":  "SATURN",
    "Rahu":    "MEAN_NODE",
    "Uranus":  "URANUS",
    "Neptune": "NEPTUNE",
    "Pluto":   "PLUTO"
}

HOUSE_THEMES = [
    "Self, appearance, personality, physical body, and beginnings",
    "Wealth, family, speech, food, and early childhood",
    "Courage, siblings, communication, short journeys, and efforts",
    "Home, mother, comforts, property, and inner emotions",
    "Intelligence, children, creativity, romance, and past merits",
    "Enemies, health, service, debts, daily work, and obstacles",
    "Marriage, partnerships, business relations, and public life",
    "Transformation, longevity, hidden matters, and inheritance",
    "Higher wisdom, spirituality, luck, long journeys, and teachers",
    "Career, status, father, authority, and public recognition",
    "Gains, social networks, desires, elder siblings, and income",
    "Losses, moksha, foreign lands, expenditure, and liberation"
]

SIGN_LORDS = {
    "Aries": "Mars", "Taurus": "Venus", "Gemini": "Mercury", "Cancer": "Moon",
    "Leo": "Sun", "Virgo": "Mercury", "Libra": "Venus", "Scorpio": "Mars",
    "Sagittarius": "Jupiter", "Capricorn": "Saturn", "Aquarius": "Saturn", "Pisces": "Jupiter"
}

# Simple Dignity & Relation Table (Vedic)
PLANET_FRIENDS = {
    "Sun":     {"Friends": ["Moon", "Mars", "Jupiter"], "Enemies": ["Venus", "Saturn"], "Neutral": ["Mercury"]},
    "Moon":    {"Friends": ["Sun", "Mercury"], "Enemies": [], "Neutral": ["Mars", "Jupiter", "Venus", "Saturn"]},
    "Mars":    {"Friends": ["Sun", "Moon", "Jupiter"], "Enemies": ["Mercury"], "Neutral": ["Venus", "Saturn"]},
    "Mercury": {"Friends": ["Sun", "Venus"], "Enemies": ["Moon"], "Neutral": ["Mars", "Jupiter", "Saturn"]},
    "Jupiter": {"Friends": ["Sun", "Moon", "Mars"], "Enemies": ["Mercury", "Venus"], "Neutral": ["Saturn"]},
    "Venus":   {"Friends": ["Mercury", "Saturn"], "Enemies": ["Sun", "Moon"], "Neutral": ["Mars", "Jupiter"]},
    "Saturn":  {"Friends": ["Mercury", "Venus"], "Enemies": ["Sun", "Moon", "Mars"], "Neutral": ["Jupiter"]},
    "Rahu":    {"Friends": ["Jupiter", "Venus", "Saturn"], "Enemies": ["Sun", "Moon", "Mars"], "Neutral": ["Mercury"]},
    "Ketu":    {"Friends": ["Sun", "Moon", "Mars"], "Enemies": ["Mercury", "Venus", "Saturn"], "Neutral": ["Jupiter"]}
}

PLANET_DIGNITIES = {
    "Sun":     {"Exalted": "Aries", "Debilitated": "Libra", "Mool": "Leo", "Own": ["Leo"]},
    "Moon":    {"Exalted": "Taurus", "Debilitated": "Scorpio", "Mool": "Taurus", "Own": ["Cancer"]},
    "Mars":    {"Exalted": "Capricorn", "Debilitated": "Cancer", "Mool": "Aries", "Own": ["Aries", "Scorpio"]},
    "Mercury": {"Exalted": "Virgo", "Debilitated": "Pisces", "Mool": "Virgo", "Own": ["Gemini", "Virgo"]},
    "Jupiter": {"Exalted": "Cancer", "Debilitated": "Capricorn", "Mool": "Sagittarius", "Own": ["Sagittarius", "Pisces"]},
    "Venus":   {"Exalted": "Pisces", "Debilitated": "Virgo", "Mool": "Libra", "Own": ["Taurus", "Libra"]},
    "Saturn":  {"Exalted": "Libra", "Debilitated": "Aries", "Mool": "Aquarius", "Own": ["Capricorn", "Aquarius"]}
}

SIGN_TRAITS = {
    "Aries": "High energy, courageous, and pioneering spirit. You lead with action.",
    "Taurus": "Stable, patient, and appreciative of comfort and beauty. You value security.",
    "Gemini": "Intellectual, communicative, and adaptable. You enjoy variety and learning.",
    "Cancer": "Nurturing, intuitive, and deeply connected to home and family.",
    "Leo": "Creative, confident, and natural leaders who enjoy being the center of attention.",
    "Virgo": "Analytical, meticulous, and dedicated to service and perfection.",
    "Libra": "Harmonious, diplomatic, and focused on partnerships and aesthetic balance.",
    "Scorpio": "Intense, resourceful, and passionate. You seek depth and transformation.",
    "Sagittarius": "Philosophical, adventurous, and enthusiastic. You value freedom and truth.",
    "Capricorn": "Disciplined, ambitious, and practical. You build lasting structures.",
    "Aquarius": "Innovative, humanitarian, and independent. You think outside the box.",
    "Pisces": "Compassionate, artistic, and spiritually inclined. You are deeply intuitive."
}

NAKSHATRA_DETAILS = {
    "Ashwini": "Ketu", "Bharani": "Venus", "Krittika": "Sun", "Rohini": "Moon",
    "Mrigashira": "Mars", "Ardra": "Rahu", "Punarvasu": "Jupiter", "Pushya": "Saturn",
    "Ashlesha": "Mercury", "Magha": "Ketu", "Purva Phalguni": "Venus", "Uttara Phalguni": "Sun",
    "Hasta": "Moon", "Chitra": "Mars", "Swati": "Rahu", "Vishakha": "Jupiter",
    "Anuradha": "Saturn", "Jyeshtha": "Mercury", "Mula": "Ketu", "Purva Ashadha": "Venus",
    "Uttara Ashadha": "Sun", "Shravana": "Moon", "Dhanishta": "Mars", "Shatabhisha": "Rahu",
    "Purva Bhadrapada": "Jupiter", "Uttara Bhadrapada": "Saturn", "Revati": "Mercury"
}

NAK_SIZE = 360 / 27

# ─── Helpers ──────────────────────────────────────────────────────────────────

def _require_swisseph():
    if not HAS_SWISSEPH:
        return {"status": "error", "message": "pyswisseph not installed. Run: pip install pyswisseph"}
    return None


def _parse_datetime(date_str, time_str):
    """Parse date/time strings into a datetime object, auto-detecting format."""
    if not date_str:
        raise ValueError("Missing birth date (date_str is None or empty)")
    if not time_str:
        time_str = "12:00"

    # Standardize separator
    date_str = date_str.replace("/", "-").replace(".", "-")
    parts = list(map(int, date_str.split("-")))
    
    if parts[0] > 31: # Looks like YYYY-MM-DD
        year, month, day = parts
    else: # Looks like DD-MM-YYYY
        day, month, year = parts

    # Handle time
    if ":" in time_str:
        time_parts = list(map(int, time_str.split(":")))
        h = time_parts[0]
        m = time_parts[1] if len(time_parts) > 1 else 0
        s = time_parts[2] if len(time_parts) > 2 else 0
    else:
        h, m, s = 12, 0, 0

    return datetime.datetime(year, month, day, h, m, s)


def _to_jd(date_str, time_str, tzone):
    """Convert local date/time + timezone to Julian Day (UT)."""
    dt = _parse_datetime(date_str, time_str)
    utc_dt = dt - datetime.timedelta(hours=tzone)
    return swe.julday(utc_dt.year, utc_dt.month, utc_dt.day,
                      utc_dt.hour + utc_dt.minute / 60.0)


def get_house(planet_lon, cusps):
    """Return 1-based house number for a given ecliptic longitude."""
    for i in range(12):
        start = cusps[i]
        end   = cusps[(i + 1) % 12]
        if end > start:
            if start <= planet_lon < end:
                return i + 1
        else:
            if planet_lon >= start or planet_lon < end:
                return i + 1
    return 1


def _to_dms(deg: float):
    """Convert decimal degrees to DD-MM-SS string."""
    d = int(deg)
    m = int((float(deg) - d) * 60)
    s = int((float(deg) - d - m/60.0) * 3600)
    return f"{d:02d}-{m:02d}-{s:02d}"


def get_relation(planet_name, sign_name):
    """Determine the relationship of a planet in a given sign."""
    if planet_name not in PLANET_DIGNITIES:
        return "Neutral"
    
    sign_lord = SIGN_LORDS.get(sign_name)
    d = PLANET_DIGNITIES[planet_name]
    
    if sign_name == d["Exalted"]: return "Exalted"
    if sign_name == d["Debilitated"]: return "Debilitated"
    if sign_name == d.get("Mool"): return "Mooltrikona"
    if sign_name in d["Own"]: return "Own Sign"
    
    # Check relationship with sign lord
    friends = PLANET_FRIENDS.get(planet_name, {}).get("Friends", [])
    enemies = PLANET_FRIENDS.get(planet_name, {}).get("Enemies", [])
    
    if sign_lord in friends: return "Friendly"
    if sign_lord in enemies: return "Enemy"
    return "Neutral"


def _planet_entry(name, pos, cusps, asc_lon=0):
    """Build a standard planet dict from an ecliptic longitude + speed."""
    # Handle nested tuple from calc_ut: ((lon, lat, dist, speed, ...), flags)
    # or flat list from manual entries: [lon, lat, dist, speed]
    if isinstance(pos[0], (tuple, list)):
        data = pos[0]
    else:
        data = pos

    lon_deg = data[0] % 360
    speed = data[3]
    
    sign_idx = int(lon_deg / 30) % 12
    sign = ZODIAC_SIGNS[sign_idx]
    
    # Whole sign house calculation
    asc_sign_idx = int(asc_lon / 30) % 12
    whole_sign_house = (sign_idx - asc_sign_idx) % 12 + 1
    
    # Navamsa (D9) sign calculation
    d9_lon = (lon_deg * 9) % 360
    d9_sign_idx = int(d9_lon / 30) % 12
    d9_sign = ZODIAC_SIGNS[d9_sign_idx]

    return {
        "name":      name,
        "longitude": round(lon_deg, 4),
        "longitude_dms": _to_dms(lon_deg % 30),
        "sign":      sign,
        "degree":    round(lon_deg % 30, 4),
        "nakshatra": NAKSHATRAS[int(lon_deg / NAK_SIZE) % 27],
        "house":     whole_sign_house,
        "bhav_house": get_house(lon_deg, cusps),
        "relation":  get_relation(name, sign),
        "navamsa_sign": d9_sign,
        "is_retrograde": speed < 0 if name not in ["Rahu", "Ketu", "Ascendant"] else False,
        "lords": [s for s, l in SIGN_LORDS.items() if l == name] # Bug #1 Fix: Explicitly state which signs this planet lords over
    }

# ─── Kundli ───────────────────────────────────────────────────────────────────

def calculate_kundli(data):
    """
    Calculate full sidereal (Lahiri) birth chart.
    Includes all planets + Rahu/Ketu (both with nakshatra), houses, aspects.
    """
    err = _require_swisseph()
    if err:
        return err

    try:
        date_str = data.get("date")
        time_str = data.get("time", "12:00")
        lat_val = data.get("lat")
        lon_val = data.get("lon")
        
        if lat_val is None or lon_val is None:
            return {"status": "error", "message": "Birth location coordinates (lat/lon) are required for accurate calculation."}

        lat      = float(lat_val)
        lon      = float(lon_val)
        tzone    = float(data.get("tzone", 5.5))

        swe.set_sid_mode(swe.SIDM_LAHIRI)
        jd    = _to_jd(date_str, time_str, tzone)
        
        # Some pyswisseph versions use get_ayanamsa_ut, others get_ayan_ms
        if hasattr(swe, 'get_ayanamsa_ut'):
            aya = swe.get_ayanamsa_ut(jd)
        elif hasattr(swe, 'get_ayan_ms'):
            aya = swe.get_ayan_ms(jd)
        else:
            # Bug #4 Fix: Ayanamsha fallback silently 0 was a major bug.
            # We throw error or use a safe Lahiri approx (around 24 degrees for modern times)
            # but better to throw error to prevent wrong charts.
            raise Exception("SwissEphemeris Ayanamsha calculation failed. Sidereal mode unavailable.")

        if aya < 10.0:
            # Extreme fallback: Lahiri ayanamsha for 2000s is ~23-24 deg.
            # 0.0 means Tropical mode, which is WRONG for Vedic.
            raise Exception(f"Invalid Ayanamsha detected ({aya}). Tropical fallback is prohibited for Vedic charts.")

        # Get tropical houses and manually convert to sidereal
        res = swe.houses(jd, lat, lon, b"P")
        cusps_tropical = res[0]
        ascmc_tropical = res[1]
        
        # Shift to sidereal by subtracting ayanamsha
        cusps = [(c - aya) % 360 for c in cusps_tropical]
        ascmc = [(a - aya) % 360 for a in ascmc_tropical]

        # Ascendant is at ascmc[0] in sidereal
        asc_lon = float(ascmc[0])
        asc_sign_idx = int(asc_lon / 30) % 12
        asc_sign = ZODIAC_SIGNS[asc_sign_idx]

        houses = {
            i + 1: {
                "cusp": round(cusps[i], 4),
                "sign": ZODIAC_SIGNS[(asc_sign_idx + i) % 12],
                "lord": SIGN_LORDS[ZODIAC_SIGNS[(asc_sign_idx + i) % 12]],
                "theme": HOUSE_THEMES[i]
            }
            for i in range(12)
        }

        planets = {}
        # Add Ascendant as a "planet" (speed is 0, idx 3)
        planets["Ascendant"] = _planet_entry("Ascendant", [asc_lon, 0, 0, 0], cusps, asc_lon)

        for name, id_attr in PLANET_IDS.items():
            swe.set_topo(lon, lat, 0.0)
            pos = swe.calc_ut(jd, getattr(swe, id_attr), swe.FLG_SWIEPH | swe.FLG_SIDEREAL | swe.FLG_SPEED | swe.FLG_TOPOCTR)
            planets[name] = _planet_entry(name, pos, cusps, asc_lon)

        # Rahu is typically retrograde in Mean Node calc, but we mark as False for tradition
        # Ketu — opposite Rahu
        rahu_lon = float(planets["Rahu"]["longitude"])
        ketu_lon = (rahu_lon + 180) % 360
        planets["Ketu"] = _planet_entry("Ketu", [ketu_lon, 0, 0, 0], cusps, asc_lon)

        # ─── Combustion (Asta) Logic ───
        COMBUST_ORBS = {
            "Moon": 12,
            "Mars": 17,
            "Mercury": 14,
            "Jupiter": 11,
            "Venus": 10,
            "Saturn": 15
        }
        
        sun_lon = planets.get("Sun", {}).get("longitude", 0)
        for p_name in planets:
            planets[p_name]["is_combust"] = False
            if p_name in COMBUST_ORBS:
                p_lon = planets[p_name]["longitude"]
                diff = min((p_lon - sun_lon) % 360, (sun_lon - p_lon) % 360)
                if diff <= COMBUST_ORBS[p_name]:
                    planets[p_name]["is_combust"] = True
        # Generate detailed Vedic descriptions
        generate_vedic_readings(planets, houses)

        return {
            "status": "success",
            "data": {
                "planets": planets,
                "houses":  houses,
                "aspects": calculate_aspects(planets),
                "ascendant": asc_sign,
                "ayanamsha": round(aya, 4)
            }
        }

    except Exception as e:
        import traceback
        traceback.print_exc()
        return {"status": "error", "message": str(e)}

# ─── Aspects & Readings ────────────────────────────────────────────────────────

def ordinal(n):
    if 11 <= (n % 100) <= 13:
        return str(n) + 'th'
    return str(n) + {1: 'st', 2: 'nd', 3: 'rd'}.get(n % 10, 'th')

def generate_vedic_readings(planets, houses):
    """Calculates lordships, aspects, and generates a descriptive string per planet."""
    lordships = {}
    for h_num, h_data in houses.items():
        lord = h_data["lord"]
        if lord not in lordships:
            lordships[lord] = []
        lordships[lord].append(h_num)
        
    aspect_rules = {
        "Mars": [4, 7, 8],
        "Jupiter": [5, 7, 9],
        "Saturn": [3, 7, 10],
        "Rahu": [5, 7, 9],
        "Ketu": [5, 7, 9]
    }
    
    for name, p in planets.items():
        if name == "Ascendant":
            p["basic_reading"] = f"Your Ascendant (Lagna) is in {p['sign']}. This defines your physical appearance, vitality, and overall approach to life."
            continue
            
        rel = p.get("relation", "Neutral")
        rel_str = f"a {rel} sign" if rel != "Neutral" else "a Neutral sign"
        if rel == "Own Sign": rel_str = "its Own sign"
        elif rel == "Exalted": rel_str = "its Exalted sign"
        elif rel == "Debilitated": rel_str = "its Debilitated sign"
        elif rel == "Enemy": rel_str = "an Enemy sign"
            
        sentence1 = f"{name} is in {p['sign']} which is {rel_str}."
        
        p_house = p["house"]
        lords_houses = lordships.get(name, [])
        if lords_houses:
            lords_str = " and ".join([ordinal(h) for h in lords_houses]) + " House"
            sentence2 = f"{name} is lord of {lords_str} and situated in {ordinal(p_house)} House."
        else:
            sentence2 = f"{name} is situated in {ordinal(p_house)} House."
            
        aspects_from_here = aspect_rules.get(name, [7])
        aspected_houses = []
        for aspect_dist in aspects_from_here:
            target_house = (p_house + aspect_dist - 1)
            while target_house > 12: target_house -= 12
            aspected_houses.append((target_house, aspect_dist))
            
        aspected_houses.sort(key=lambda x: x[0])
        aspect_strs = [f"{ordinal(h)} House" for h, dist in aspected_houses]
        
        sentence3 = f"{name} fully aspects " + ", ".join(aspect_strs) + "."
        
        p["basic_reading"] = f"{name} is in Lagna Kundli. {sentence1} {sentence2} {sentence3}"

def calculate_aspects(planets):
    # Historical Western aspects for the planetary summary array (optional use)
    aspects = []
    names = list(planets.keys())
    for i, p1 in enumerate(names):
        for p2 in names[i + 1:]:
            p1_lon = float(planets[p1]["longitude"])
            p2_lon = float(planets[p2]["longitude"])
            diff = abs(p1_lon - p2_lon)
            if diff > 180:
                diff = 360 - diff
            if   abs(diff - 180) < 5: aspects.append(f"{p1} opposes {p2}")
            elif abs(diff - 120) < 5: aspects.append(f"{p1} trine {p2}")
            elif abs(diff -  90) < 5: aspects.append(f"{p1} square {p2}")
    return aspects

# ─── Doshas ───────────────────────────────────────────────────────────────────

def calculate_doshas(planets, houses):
    doshas = {
        "manglik": {"is_present": False, "details": "No Manglik Dosha detected.", "type": None},
        "kalsarp": {"is_present": False, "details": "No Kalsarp Dosha detected.", "type": None}
    }

    mars_house = planets.get("Mars", {}).get("house")
    if mars_house in [1, 2, 4, 7, 8, 12]:
        doshas["manglik"]["is_present"] = True
        doshas["manglik"]["details"] = f"Mars in house {mars_house} creates Manglik Dosha."
        doshas["manglik"]["type"] = "Anshik" if mars_house in [1, 2, 4, 12] else "Purna"

    rahu_house = planets.get("Rahu", {}).get("house", 0)
    ketu_house = planets.get("Ketu", {}).get("house", 0)
    
    rahu_lon = planets.get("Rahu", {}).get("longitude", 0)
    ketu_lon = planets.get("Ketu", {}).get("longitude", 0)
    others   = ["Sun", "Moon", "Mars", "Mercury", "Jupiter", "Venus", "Saturn"]

    def count_between(start, end):
        n = 0
        for p in others:
            lon = planets.get(p, {}).get("longitude", 0)
            if end > start:
                if start <= lon <= end: n += 1
            else:
                if lon >= start or lon <= end: n += 1
        return n

    # Kaal Sarp check: All planets between Rahu and Ketu
    if count_between(rahu_lon, ketu_lon) == 7 or count_between(ketu_lon, rahu_lon) == 7:
        kalsarp_types = {
            1: "Anant", 2: "Kulik", 3: "Vasuki", 4: "Shankhapal", 
            5: "Padma", 6: "Mahapadma", 7: "Takshak", 8: "Karkotak", 
            9: "Shankhachood", 10: "Ghatak", 11: "Vishdhar", 12: "Sheshnag"
        }
        y_type = kalsarp_types.get(rahu_house, "Unknown")
        doshas["kalsarp"]["is_present"] = True
        doshas["kalsarp"]["type"] = y_type
        doshas["kalsarp"]["details"] = f"{y_type} Kaal Sarp Yoga is present as Rahu is in house {rahu_house}."

    return doshas

def calculate_gemstones(planets, houses):
    """
    Recommends stones for Lagna (Life), 5th (Lucky), and 9th (Fortune) lords.
    """
    stone_map = {
        "Sun":     {"stone": "Ruby", "metal": "Gold/Copper", "finger": "Ring"},
        "Moon":    {"stone": "Pearl", "metal": "Silver", "finger": "Little"},
        "Mars":    {"stone": "Red Coral", "metal": "Gold/Copper", "finger": "Ring"},
        "Mercury": {"stone": "Emerald", "metal": "Gold/Silver", "finger": "Little"},
        "Jupiter": {"stone": "Yellow Sapphire", "metal": "Gold", "finger": "Index"},
        "Venus":   {"stone": "Diamond", "metal": "Platinum/Silver", "finger": "Middle/Ring"},
        "Saturn":  {"stone": "Blue Sapphire", "metal": "Iron/Silver", "finger": "Middle"},
        "Rahu":    {"stone": "Gomed", "metal": "Silver", "finger": "Middle"},
        "Ketu":    {"stone": "Cat's Eye", "metal": "Silver", "finger": "Ring"}
    }

    # Life stone (1st Lord)
    lagna_lord = houses.get(1, {}).get("lord")
    # Lucky stone (5th Lord)
    lucky_lord = houses.get(5, {}).get("lord")
    # Fortune stone (9th Lord)
    fortune_lord = houses.get(9, {}).get("lord")

    recommendations = []
    for role, lord in [("Life Stone", lagna_lord), ("Lucky Stone", lucky_lord), ("Fortune Stone", fortune_lord)]:
        if lord in stone_map:
            p_data = planets.get(lord, {})
            # Basic check: Don't recommend if lord is in 6, 8, 12 (Malefic houses)
            # unless it's the Lagna Lord which is generally safe.
            h = p_data.get("house", 0)
            is_risky = h in [6, 8, 12] and role != "Life Stone"
            
            recommendations.append({
                "role": role,
                "planet": lord,
                "gemstone": stone_map[lord]["stone"],
                "metal": stone_map[lord]["metal"],
                "finger": stone_map[lord]["finger"],
                "is_recommended": not is_risky,
                "reason": f"{lord} is the lord of {role.split(' ')[0]} house."
            })

    return recommendations

def calculate_sade_sati(planets, jd):
    """
    Calculates Sade Sati status of Saturn relative to the natal Moon.
    """
    moon_lon = float(planets.get("Moon", {}).get("longitude", 0))
    moon_sign_idx = int(moon_lon / 30) % 12
    
    # Get current Saturn position (Transit)
    # We use roughly constant flags for recent transits
    swe.set_sid_mode(swe.SIDM_LAHIRI)
    sat_pos = swe.calc_ut(jd, swe.SATURN, swe.FLG_SWIEPH | swe.FLG_SIDEREAL | swe.FLG_SPEED)
    sat_lon = float(sat_pos[0][0])
    sat_sign_idx = int(sat_lon / 30) % 12

    # Sade Sati logic: Saturn in 12, 1, or 2 from Moon
    dist = (sat_sign_idx - moon_sign_idx + 12) % 12
    
    is_active = False
    phase = None
    details = "You are not under the influence of Sade Sati currently."

    if dist == 11: # 12th house from Moon
        is_active = True
        phase = "First Phase (Rising)"
        details = "Saturn is in the 12th house from your natal Moon. This is the beginning of Sade Sati."
    elif dist == 0: # 1st house from Moon
        is_active = True
        phase = "Second Phase (Peak)"
        details = "Saturn is transiting over your natal Moon. This is the peak period of Sade Sati."
    elif dist == 1: # 2nd house from Moon
        is_active = True
        phase = "Third Phase (Setting)"
        details = "Saturn is in the 2nd house from your natal Moon. This is the final stage of Sade Sati."

    return {
        "is_active": is_active,
        "phase": phase,
        "details": details,
        "natal_moon_sign": ZODIAC_SIGNS[moon_sign_idx],
        "transit_saturn_sign": ZODIAC_SIGNS[sat_sign_idx]
    }

def calculate_sade_sati_life_cycle(planets, birth_jd):
    """
    Calculates all Sade Sati and Small Panoti periods for a 120-year lifetime.
    """
    moon_lon = float(planets.get("Moon", {}).get("longitude", 0))
    moon_sign_idx = int(moon_lon / 30) % 12
    
    swe.set_sid_mode(swe.SIDM_LAHIRI)
    
    periods = []
    
    # Check every 15 days for 120 years to catch sign entries/exits and retrogrades
    # 120 years * 365.25 / 15 = ~2922 steps
    current_jd = birth_jd
    end_jd = birth_jd + (120 * 365.25)
    step = 15.0 
    
    last_type = None
    last_sign = None
    last_phase = None
    start_jd = None

    def get_status(jd):
        pos = swe.calc_ut(jd, swe.SATURN, swe.FLG_SWIEPH | swe.FLG_SIDEREAL | swe.FLG_SPEED)
        s_lon = float(pos[0][0])
        s_idx = int(s_lon / 30) % 12
        d = (s_idx - moon_sign_idx + 12) % 12
        
        t = None
        p = ""
        if d in [11, 0, 1]:
            t = "Sade Sati"
            p = "Rising" if d == 11 else ("Peak" if d == 0 else "Setting")
        elif d == 3: # 4th house from Moon
            t = "Small Panoti"
        elif d == 7: # 8th house from Moon
            t = "Small Panoti"
            
        return t, ZODIAC_SIGNS[s_idx], p, jd

    while current_jd <= end_jd:
        ctype, csign, cphase, cjd = get_status(current_jd)
        
        if ctype != last_type or csign != last_sign or cphase != last_phase:
            # Period changed
            if last_type:
                # Close previous period
                periods.append({
                    "type": last_type,
                    "sign": last_sign,
                    "phase": last_phase,
                    "start": swe.revjul(start_jd),
                    "end": swe.revjul(current_jd)
                })
            
            # Start new period if active
            if ctype:
                start_jd = current_jd
            else:
                start_jd = None
                
            last_type = ctype
            last_sign = csign
            last_phase = cphase
            
        current_jd += step

    # Format for JSON
    formatted = []
    for idx, p in enumerate(periods):
        sy, sm, sd, sh = p["start"]
        ey, em, ed, eh = p["end"]
        
        formatted.append({
            "index": idx + 1,
            "type": p["type"],
            "shani_rashi": p["sign"],
            "start_date": datetime.datetime(sy, sm, sd).strftime("%B %d, %Y"),
            "end_date": datetime.datetime(ey, em, ed).strftime("%B %d, %Y"),
            "phase": p["phase"]
        })
        
    return formatted

def calculate_interpretations(planets, houses, panchang, ascendant, name="User"):
    """Generate specific Vedic-style interpretations based on chart data."""
    
    sun_sign = panchang.get("sun_sign", "Aries")
    moon_sign = panchang.get("moon_sign", "Aries")
    nak = panchang.get("nakshatra", "Ashwini")
    nak_lord = NAKSHATRA_DETAILS.get(nak, "Unknown")

    # Jupiter & Saturn placements
    jup = planets.get("Jupiter", {})
    sat = planets.get("Saturn", {})
    
    # Simple Yoga: Benefics in Upachaya (3, 6, 10, 11)
    upachaya_houses = [3, 6, 10, 11]
    benefics = ["Jupiter", "Venus", "Mercury", "Moon"]
    upachaya_benefics = [p for p in benefics if planets.get(p, {}).get("house") in upachaya_houses]
    
    yoga_reading = "The chart shows a unique alignment of energies."
    if upachaya_benefics:
        yoga_reading = f"Benefics ({', '.join(upachaya_benefics)}) in upachaya houses indicate steady growth and success over time through consistent effort."
    elif len(upachaya_benefics) == 0:
        yoga_reading = "The chart shows balanced planetary energies, suggesting a life path that requires mindful cultivation of internal resources."

    interpretations = {
        "ascendant": {
            "sign": ascendant,
            "reading": f"Your rising sign in {ascendant} shapes your outward personality. {SIGN_TRAITS.get(ascendant, '')}"
        },
        "moon": {
            "sign": moon_sign,
            "reading": f"With Moon in {moon_sign}, your emotional nature is: {SIGN_TRAITS.get(moon_sign, '')}"
        },
        "sun": {
            "sign": sun_sign,
            "reading": f"Sun in {sun_sign} gives your core identity: {SIGN_TRAITS.get(sun_sign, '')}"
        },
        "nakshatra": {
            "name": nak,
            "lord": nak_lord,
            "reading": f"Born under {nak} ({nak_lord}), you carry the unique vibration and energetic blueprint of this asterism through life."
        },
        "jupiter": {
            "sign": jup.get("sign", "Aries"),
            "house": jup.get("house", 0),
            "reading": f"Jupiter in {jup.get('sign')} blesses you with wisdom and spiritual growth in the areas of {jup.get('sign')} themes."
        },
        "saturn": {
            "sign": sat.get("sign", "Aries"),
            "house": sat.get("house", 0),
            "reading": f"Saturn in {sat.get('sign')} calls for discipline, patience, and karmic learning, particularly regarding the themes of the {sat.get('sign')} house."
        },
        "yoga": {
            "title": "Special Combinations",
            "reading": yoga_reading
        },
        "life_path": {
            "name": name,
            "reading": f"{name}'s chart reveals a soul whose outer expression through {ascendant} Lagna combines with the inner emotional world of {moon_sign} Rashi. The journey is one of balancing these twin energies — the soul's light through {sun_sign} and the mental state of {moon_sign}. Key life lessons come through the {sat.get('sign')} placement, shaping your long-term legacy."
        }
    }
    return interpretations

# ─── Panchang ─────────────────────────────────────────────────────────────────

def calculate_panchang(data):
    err = _require_swisseph()
    if err: return err
    try:
        kundli = calculate_kundli(data)
        if not isinstance(kundli, dict) or kundli.get("status") == "error":
            return kundli

        # Access planets safely from the 'data' key
        kundli_data = kundli.get("data", {})
        if not isinstance(kundli_data, dict): kundli_data = {}
        planets_data = kundli_data.get("planets", {})
        if not isinstance(planets_data, dict): planets_data = {}
        
        sun_lon  = float(planets_data.get("Sun", {}).get("longitude", 0))
        moon_lon = float(planets_data.get("Moon", {}).get("longitude", 0))
        diff     = (moon_lon - sun_lon + 360) % 360

        tithi_num = int(diff / 12) + 1
        tithi     = TITHI_NAMES[(tithi_num - 1) % 15]
        nakshatra = NAKSHATRAS[int(moon_lon / NAK_SIZE) % 27]
        yoga_num  = int(((sun_lon + moon_lon) % 360) / NAK_SIZE)
        yoga      = YOGA_NAMES[yoga_num % 27]
        karana_num = int(diff / 6) + 1
        karana = KARANA_NAMES[(karana_num % 7) + 1] if tithi_num not in [1, 60] else ("Kintughna" if tithi_num == 1 else "Naga")

        return {
            "status": "success",
            "data": {
                "tithi":     tithi,
                "nakshatra": nakshatra,
                "yoga":      yoga,
                "karana":    karana,
                "sun_sign":  str(planets_data.get("Sun", {}).get("sign", "")),
                "moon_sign": str(planets_data.get("Moon", {}).get("sign", ""))
            }
        }
    except Exception as e:
        return {"status": "error", "message": str(e)}

# ─── Vimshottari Dasha ────────────────────────────────────────────────────────

def calculate_dasha(data):
    err = _require_swisseph()
    if err: return err
    try:
        kundli = calculate_kundli(data)
        if not isinstance(kundli, dict) or kundli.get("status") == "error":
            return kundli

        kundli_data = kundli.get("data", {})
        if not isinstance(kundli_data, dict): kundli_data = {}
        planets_data = kundli_data.get("planets", {})
        if not isinstance(planets_data, dict): planets_data = {}
        
        moon_lon     = float(planets_data.get("Moon", {}).get("longitude", 0))
        nak_index    = int(moon_lon / NAK_SIZE)
        nak_fraction = (moon_lon % NAK_SIZE) / NAK_SIZE

        start_lord_index     = nak_index % 9
        first_maha_duration  = DASHA_YEARS[start_lord_index]
        first_remain_years   = first_maha_duration * (1 - nak_fraction)

        birth_dt = _parse_datetime(data['date'], data.get('time', '12:00'))
        
        timeline = []
        current_start_date = birth_dt
        
        # Calculate full cycle (120 years)
        for i in range(9):
            idx = (start_lord_index + i) % 9
            m_lord = DASHA_LORDS[idx]
            m_years = DASHA_YEARS[idx]
            
            duration = m_years if i > 0 else first_remain_years
            m_end_date = current_start_date + datetime.timedelta(days=duration * 365.25)
            
            # Calculate Antardashas for this Mahadasha
            antardashas = []
            a_start = current_start_date
            
            # The first Antardasha of a Mahadasha is always the lord itself
            # The sequence follows the same loop: Ketu -> Venus -> Sun -> ...
            for j in range(9):
                a_idx = (idx + j) % 9
                a_lord = DASHA_LORDS[a_idx]
                a_years = DASHA_YEARS[a_idx]
                
                # Formula: (M_years * A_years) / 120 = duration in years
                # We normalize for the first shortened Mahadasha
                m_factor = duration / m_years
                a_days = (m_years * a_years / 120.0) * 365.25 * m_factor
                
                a_end = a_start + datetime.timedelta(days=a_days)
                
                # Check if this is the current Antardasha
                is_current_a = a_start <= datetime.datetime.now() <= a_end
                
                antardashas.append({
                    "lord": a_lord,
                    "start": a_start.strftime("%d %b %Y"),
                    "end": a_end.strftime("%d %b %Y"),
                    "is_current": is_current_a
                })
                a_start = a_end

            timeline.append({
                "lord": m_lord,
                "start": current_start_date.strftime("%Y"),
                "end": m_end_date.strftime("%Y"),
                "is_current": current_start_date <= datetime.datetime.now() <= m_end_date,
                "antardashas": antardashas
            })
            current_start_date = m_end_date

        return {
            "status": "success",
            "data": {
                "timeline": timeline,
                "current": next((t for t in timeline if t["is_current"]), timeline[0])
            }
        }
    except Exception as e:
        return {"status": "error", "message": str(e)}

# ─── Entry Point ──────────────────────────────────────────────────────────────

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print(json.dumps({"status": "error", "message": "No input provided."}))
        sys.exit(1)
    try:
        input_data = json.loads(sys.argv[1])
        action     = input_data.get("action", "kundli")
        if action == "all":
            k = calculate_kundli(input_data)
            d = calculate_dasha(input_data)
            p = calculate_panchang(input_data)
            if k["status"] == "success" and d["status"] == "success" and p["status"] == "success":
                doshas = calculate_doshas(k["data"]["planets"], k["data"]["houses"])
                gemstones = calculate_gemstones(k["data"]["planets"], k["data"]["houses"])
                
                now_jd = swe.julday(datetime.datetime.now().year, datetime.datetime.now().month, datetime.datetime.now().day, datetime.datetime.now().hour)
                sade_sati = calculate_sade_sati(k["data"]["planets"], now_jd)
                life_timeline = calculate_sade_sati_life_cycle(k["data"]["planets"], _to_jd(input_data.get("date"), input_data.get("time", "12:00"), float(input_data.get("tzone", 5.5))))
                
                user_name = input_data.get("name", "User")
                interpretations = calculate_interpretations(
                    k["data"]["planets"], 
                    k["data"]["houses"], 
                    p["data"], 
                    k["data"]["ascendant"],
                    name=user_name
                )
                
                result = {
                    "status": "success",
                    "data": {
                        "kundli":   k["data"],
                        "dasha":    d["data"],
                        "panchang": p["data"],
                        "doshas":   doshas,
                        "gemstones": gemstones,
                        "sade_sati": {
                            **sade_sati,
                            "life_timeline": life_timeline
                        },
                        "interpretations": interpretations,
                        "input": {
                            "name": user_name,
                            "date": input_data.get("date"),
                            "time": input_data.get("time"),
                            "place": input_data.get("place")
                        }
                    }
                }
            else:
                result = k if k["status"] == "error" else (d if d["status"] == "error" else p)
        else:
            # Basic routing for single actions
            if action == "kundli": result = calculate_kundli(input_data)
            elif action == "panchang": result = calculate_panchang(input_data)
            elif action == "dasha": result = calculate_dasha(input_data)
            elif action == "match":
                import astronomy_match as am
                boy_k = calculate_kundli(input_data.get("boy", {}))
                girl_k = calculate_kundli(input_data.get("girl", {}))
                
                if boy_k["status"] == "success" and girl_k["status"] == "success":
                    bp = boy_k["data"]["planets"]
                    gp = girl_k["data"]["planets"]
                    
                    b_rashi = int(bp["Moon"]["longitude"] / 30) % 12
                    g_rashi = int(gp["Moon"]["longitude"] / 30) % 12
                    
                    b_nak = int(bp["Moon"]["longitude"] / (360/27)) % 27
                    g_nak = int(gp["Moon"]["longitude"] / (360/27)) % 27
                    
                    b_asc = int(bp["Ascendant"]["longitude"] / 30) % 12
                    g_asc = int(gp["Ascendant"]["longitude"] / 30) % 12
                    
                    b_mars = int(bp["Mars"]["longitude"] / 30) % 12
                    g_mars = int(gp["Mars"]["longitude"] / 30) % 12
                    
                    system = input_data.get("system", "north_indian")
                    if system == "south_indian":
                        match_result = am.calculate_dashakoot(b_rashi, b_nak, b_asc, b_mars, g_rashi, g_nak, g_asc, g_mars)
                    else:
                        match_result = am.calculate_ashtakoot(b_rashi, b_nak, b_asc, b_mars, g_rashi, g_nak, g_asc, g_mars)
                        
                    result = {"status": "success", "data": match_result}
                else:
                    err = boy_k.get("message") if boy_k["status"] == "error" else girl_k.get("message")
                    result = {"status": "error", "message": f"Base chart error: {err}"}
            elif action == "calendar":
                import astronomy_calendar as ac
                result = {"status": "success", "data": ac.get_monthly_calendar(
                    int(input_data.get("year", datetime.datetime.now().year)),
                    int(input_data.get("month", datetime.datetime.now().month)),
                    float(input_data.get("lat", 28.6139)),
                    float(input_data.get("lon", 77.2090)),
                    float(input_data.get("tzone", 5.5))
                )}
            elif action == "today_panchang":
                import astronomy_calendar as ac
                result = {"status": "success", "data": ac.get_today_panchang(
                    float(input_data.get("lat", 28.6139)),
                    float(input_data.get("lon", 77.2090)),
                    float(input_data.get("tzone", 5.5)),
                    input_data.get("date", None)
                )}
            elif action == "muhurat":
                import astronomy_muhurat as amuh
                import datetime as dt_mod
                start_str = input_data.get("start_date")
                end_str = input_data.get("end_date")
                start_date = dt_mod.datetime.strptime(start_str, "%Y-%m-%d").date() if start_str else dt_mod.date.today()
                end_date = dt_mod.datetime.strptime(end_str, "%Y-%m-%d").date() if end_str else start_date + dt_mod.timedelta(days=30)
                result = {"status": "success", "data": amuh.find_muhurats(
                    input_data.get("category", "marriage"),
                    start_date, end_date,
                    float(input_data.get("lat", 28.6139)),
                    float(input_data.get("lon", 77.2090)),
                    float(input_data.get("tzone", 5.5))
                )}
            else:
                result = {"status": "error", "message": "Unknown action"}
                
        print(json.dumps(result, indent=2, ensure_ascii=False))
    except Exception as e:
        print(json.dumps({"status": "error", "message": str(e)}))