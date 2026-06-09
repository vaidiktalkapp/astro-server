import sys
import json
import datetime
import calendar
import math

try:
    import swisseph as swe
    HAS_SWISSEPH = True
except ImportError:
    HAS_SWISSEPH = False

# Constants from bridge
ZODIAC_SIGNS = [
    "Aries (Mesha)", "Taurus (Vrishabha)", "Gemini (Mithuna)", "Cancer (Karka)", 
    "Leo (Simha)", "Virgo (Kanya)", "Libra (Tula)", "Scorpio (Vrishchika)", 
    "Sagittarius (Dhanu)", "Capricorn (Makara)", "Aquarius (Kumbha)", "Pisces (Meena)"
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
    "Trayodashi", "Chaturdashi", "Purnima", "Prathama (K)", "Dwitiya (K)",
    "Tritiya (K)", "Chaturthi (K)", "Panchami (K)", "Shashthi (K)", "Saptami (K)",
    "Ashtami (K)", "Navami (K)", "Dashami (K)", "Ekadashi (K)", "Dwadashi (K)",
    "Trayodashi (K)", "Chaturdashi (K)", "Amavasya"
]

YOGA_NAMES = [
    "Vishkumbha", "Preeti", "Ayushman", "Saubhagya", "Shobhana", "Atiganda",
    "Sukarma", "Dhriti", "Shoola", "Ganda", "Vriddhi", "Dhruva", "Vyaghata",
    "Harshana", "Vajra", "Siddhi", "Vyatipata", "Variyan", "Parigha", "Shiva",
    "Siddha", "Sadhya", "Shubha", "Shukla", "Brahma", "Indra", "Vaidhriti"
]

KARANA_NAMES = [
    "Bava", "Balava", "Kaulava", "Taitila", "Gara", "Vanija", "Vishti",
    "Shakuni", "Chatushpada", "Naga", "Kintughna"
]

RITU_NAMES = ["Vasanta", "Grishma", "Varsha", "Sharad", "Hemant", "Shishir"]

PLANET_IDS = {
    "Mars":    swe.MARS,
    "Mercury": swe.MERCURY,
    "Jupiter": swe.JUPITER,
    "Venus":   swe.VENUS,
    "Saturn":  swe.SATURN,
    "Rahu":    swe.MEAN_NODE
}

def get_ritu(sun_lon):
    """Standard Vedic Ritu mapping based on Sun's longitude.
    Shifting by 30 degrees to align Pisces/Aries with Vasanta.
    """
    idx = int((sun_lon + 30) / 60) % 6
    return RITU_NAMES[idx]

def get_yoga(sun_lon, moon_lon):
    yoga_idx = int(((sun_lon + moon_lon) % 360) / (360/27))
    return YOGA_NAMES[yoga_idx % 27]

def get_karana(tithi_val):
    k_idx = int(tithi_val * 2)
    if k_idx == 0: return "Kintughna"
    if k_idx >= 57:
        if k_idx == 57: return "Shakuni"
        if k_idx == 58: return "Chatushpada"
        if k_idx == 59: return "Naga"
        return "Kintughna"
    return KARANA_NAMES[(k_idx - 1) % 7]

def _get_altitude(jd_ut, body_id, lon, lat):
    """Calculate the apparent altitude of a celestial body above the horizon."""
    # Get tropical position (not sidereal) for rise/set calculation
    pos = swe.calc_ut(jd_ut, body_id, swe.FLG_SWIEPH)[0]
    ecliptic_lon = pos[0]
    ecliptic_lat = pos[1]
    # Calculate sidereal time at the location
    sidereal_time = swe.sidtime(jd_ut) + lon / 15.0
    # Convert ecliptic to equatorial coordinates
    obliquity = 23.4393  # approximate obliquity of ecliptic
    obl_rad = math.radians(obliquity)
    ecl_lon_rad = math.radians(ecliptic_lon)
    ecl_lat_rad = math.radians(ecliptic_lat)
    # Equatorial coordinates
    sin_dec = math.sin(ecl_lat_rad) * math.cos(obl_rad) + math.cos(ecl_lat_rad) * math.sin(obl_rad) * math.sin(ecl_lon_rad)
    dec = math.asin(max(-1, min(1, sin_dec)))
    ra = math.atan2(math.sin(ecl_lon_rad) * math.cos(obl_rad) - math.tan(ecl_lat_rad) * math.sin(obl_rad), math.cos(ecl_lon_rad))
    ra_hours = math.degrees(ra) / 15.0
    # Hour angle
    ha = math.radians((sidereal_time - ra_hours) * 15.0)
    lat_rad = math.radians(lat)
    # Altitude
    sin_alt = math.sin(lat_rad) * math.sin(dec) + math.cos(lat_rad) * math.cos(dec) * math.cos(ha)
    alt = math.degrees(math.asin(max(-1, min(1, sin_alt))))
    return alt

def _find_rise_set_by_search(jd_ref, body_id, lon, lat):
    """Find rise and set times by binary search on altitude.
    jd_ref is approximately midnight UTC for the local day.
    We search a full 24-hour window around it.
    """
    rise_jd = None
    set_jd = None
    target_alt = -0.833  # standard refraction correction for Sun
    if body_id == swe.MOON:
        target_alt = 0.125  # Moon has different refraction + parallax

    # Search window: from jd_ref - 0.25 to jd_ref + 1.25 (covers 36 hours)
    # This ensures we catch Moonsets that happen early the next morning.
    search_start = jd_ref - 0.25
    search_end = jd_ref + 1.25
    step = 1.0 / 144  # 10-minute steps for better accuracy

    # Find rise (altitude crosses from below to above target)
    prev_alt = _get_altitude(search_start, body_id, lon, lat)
    for i in range(1, 145):
        t = search_start + i * step
        alt = _get_altitude(t, body_id, lon, lat)
        if prev_alt <= target_alt and alt > target_alt:
            # Binary search to refine
            a, b = t - step, t
            for _ in range(20):
                mid = (a + b) / 2
                if _get_altitude(mid, body_id, lon, lat) <= target_alt:
                    a = mid
                else:
                    b = mid
            rise_jd = (a + b) / 2
            break
        prev_alt = alt

    # Find set (altitude crosses from above to below target) - search after rise
    start_set = rise_jd + 0.01 if rise_jd else search_start + 0.25
    prev_alt = _get_altitude(start_set, body_id, lon, lat)
    steps_remaining = int((search_end - start_set) / step)
    for i in range(1, steps_remaining + 1):
        t = start_set + i * step
        if t > search_end:
            break
        alt = _get_altitude(t, body_id, lon, lat)
        if prev_alt >= target_alt and alt < target_alt:
            a, b = t - step, t
            for _ in range(20):
                mid = (a + b) / 2
                if _get_altitude(mid, body_id, lon, lat) >= target_alt:
                    a = mid
                else:
                    b = mid
            set_jd = (a + b) / 2
            break
        prev_alt = alt
    return rise_jd, set_jd

def get_rise_set(jd, lat, lon, body_id):
    """Calculate rise and set times for a celestial body."""
    try:
        return _find_rise_set_by_search(jd, body_id, lon, lat)
    except Exception as e:
        print(f"rise_set error: {e}", file=sys.stderr)
        return None, None

def jd_to_ist_str(jd_ut, tzone):
    if jd_ut is None: return "--:--"
    y, m, d, h = swe.revjul(jd_ut)
    hh = int(h)
    mm = int((h - hh) * 60)
    ss = int(((h - hh) * 60 - mm) * 60)
    # Ensure seconds are valid for datetime
    ss = min(59, max(0, ss))
    mm = min(59, max(0, mm))
    try:
        dt_utc = datetime.datetime(y, m, d, hh, mm, ss)
        dt_local = dt_utc + datetime.timedelta(hours=tzone)
        return dt_local.strftime("%H:%M:%S")
    except:
        return f"{hh:02d}:{mm:02d}"

def find_end_time(jd_start, calc_type="tithi"):
    swe.set_sid_mode(swe.SIDM_LAHIRI)
    def get_val(jd):
        sun_p = swe.calc_ut(jd, swe.SUN, swe.FLG_SWIEPH | swe.FLG_SIDEREAL)[0][0]
        moon_p = swe.calc_ut(jd, swe.MOON, swe.FLG_SWIEPH | swe.FLG_SIDEREAL)[0][0]
        if calc_type == "tithi":
            return int(((moon_p - sun_p + 360) % 360) / 12)
        elif calc_type == "nakshatra":
            return int(moon_p / (360/27))
        elif calc_type == "yoga":
            return int(((sun_p + moon_p) % 360) / (360/27))
        elif calc_type == "karana":
            diff = (moon_p - sun_p + 360) % 360
            return int((diff / 12) * 2)
        return 0
    start_val = get_val(jd_start)
    low = jd_start
    high = jd_start + 1.2
    curr = low
    step = 0.04
    while curr < high:
        if get_val(curr) != start_val:
            high = curr
            low = curr - step
            break
        curr += step
    for _ in range(12):
        mid = (low + high) / 2
        if get_val(mid) == start_val:
            low = mid
        else:
            high = mid
    return high

def find_start_time(jd_end, calc_type="tithi"):
    swe.set_sid_mode(swe.SIDM_LAHIRI)
    def get_val(jd):
        sun_p = swe.calc_ut(jd, swe.SUN, swe.FLG_SWIEPH | swe.FLG_SIDEREAL)[0][0]
        moon_p = swe.calc_ut(jd, swe.MOON, swe.FLG_SWIEPH | swe.FLG_SIDEREAL)[0][0]
        if calc_type == "tithi":
            return int(((moon_p - sun_p + 360) % 360) / 12)
        elif calc_type == "nakshatra":
            return int(moon_p / (360/27))
        elif calc_type == "yoga":
            return int(((sun_p + moon_p) % 360) / (360/27))
        elif calc_type == "karana":
            diff = (moon_p - sun_p + 360) % 360
            return int((diff / 12) * 2)
        return 0
    start_val = get_val(jd_end)
    high = jd_end
    low = jd_end - 1.2
    curr = high
    step = 0.04
    while curr > low:
        if get_val(curr) != start_val:
            low = curr
            high = curr + step
            break
        curr -= step
    for _ in range(12):
        mid = (low + high) / 2
        if get_val(mid) == start_val:
            high = mid
        else:
            low = mid
    return low

def format_jd_to_ampm(jd_ut, tzone, base_date_str=None):
    if jd_ut is None: return "--:--"
    y, m, d, h = swe.revjul(jd_ut)
    hh = int(h)
    mm = int((h - hh) * 60)
    ss = int(((h - hh) * 60 - mm) * 60)
    ss = min(59, max(0, ss))
    mm = min(59, max(0, mm))
    try:
        dt_utc = datetime.datetime(y, m, d, hh, mm, ss)
        dt_local = dt_utc + datetime.timedelta(hours=tzone)
        
        ampm = "AM" if dt_local.hour < 12 else "PM"
        hr_12 = dt_local.hour % 12
        if hr_12 == 0: hr_12 = 12
        time_str = f"{hr_12}:{dt_local.minute:02d} {ampm}"
        
        if base_date_str:
            base_date = datetime.datetime.strptime(base_date_str, "%Y-%m-%d").date()
            if dt_local.date() == base_date:
                return time_str
            elif (dt_local.date() - base_date).days == 1:
                return f"next morning ({dt_local.strftime('%d %b')}) {time_str}"
            elif (dt_local.date() - base_date).days > 1:
                return f"({dt_local.strftime('%d %b')}) {time_str}"
            else:
                return f"({dt_local.strftime('%d %b')}) {time_str}"
        return time_str
    except Exception as e:
        return "--:--"

def get_panchang_minimal(jd, lat, lon, tzone):
    """
    High-performance minimal Panchang calculation.
    Only calculates Tithi, Nakshatra, Yoga, and Karana.
    Skips binary searches for end times and skipped planets.
    """
    swe.set_sid_mode(swe.SIDM_LAHIRI)
    sun_pos = swe.calc_ut(jd, swe.SUN, swe.FLG_SWIEPH | swe.FLG_SIDEREAL)[0]
    sun_lon = sun_pos[0] % 360
    moon_pos = swe.calc_ut(jd, swe.MOON, swe.FLG_SWIEPH | swe.FLG_SIDEREAL)[0]
    moon_lon = moon_pos[0] % 360
    
    diff = (moon_lon - sun_lon + 360) % 360
    tithi_val = diff / 12
    tithi_index = int(tithi_val)
    
    tithi_name = TITHI_NAMES[tithi_index % 30]
    paksha = "Shukla" if tithi_index < 15 else "Krishna"
    
    nak_index = int(moon_lon / (360/27))
    nak_name = NAKSHATRAS[nak_index % 27]
    
    yoga = get_yoga(sun_lon, moon_lon)
    karana = get_karana(tithi_val)
    
    # Calculate Weekday (Vara)
    y, m, d, h = swe.revjul(jd)
    vara_names = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]
    dt_utc = datetime.datetime(y, m, d) + datetime.timedelta(hours=h)
    dt_local = dt_utc + datetime.timedelta(hours=tzone)
    vara = vara_names[dt_local.weekday()]

    return {
        "tithi": tithi_name,
        "paksha": paksha,
        "nakshatra": nak_name,
        "yoga": yoga,
        "karana": karana,
        "vara": vara,
        "sun_lon": sun_lon,
        "moon_lon": moon_lon
    }



def get_panchang_for_jd(jd, lat, lon, tzone, detailed=False):
    swe.set_sid_mode(swe.SIDM_LAHIRI)
    sun_pos = swe.calc_ut(jd, swe.SUN, swe.FLG_SWIEPH | swe.FLG_SIDEREAL)[0]
    sun_lon = sun_pos[0] % 360
    moon_pos = swe.calc_ut(jd, swe.MOON, swe.FLG_SWIEPH | swe.FLG_SIDEREAL)[0]
    moon_lon = moon_pos[0] % 360
    diff = (moon_lon - sun_lon + 360) % 360
    tithi_val = diff / 12
    tithi_index = int(tithi_val)
    tithi_name = TITHI_NAMES[tithi_index % 30]
    paksha = "Shukla" if tithi_index < 15 else "Krishna"
    nak_index = int(moon_lon / (360/27))
    nak_name = NAKSHATRAS[nak_index % 27]
    tithi_end_jd = find_end_time(jd, "tithi")
    nak_end_jd = find_end_time(jd, "nakshatra")
    yoga = get_yoga(sun_lon, moon_lon)
    karana = get_karana(tithi_val)
    sun_sign = ZODIAC_SIGNS[int(sun_lon / 30) % 12]
    moon_sign = ZODIAC_SIGNS[int(moon_lon / 30) % 12]
    sun_rise_jd, sun_set_jd = get_rise_set(jd, lat, lon, swe.SUN)
    moon_rise_jd, moon_set_jd = get_rise_set(jd, lat, lon, swe.MOON)
    muhurats = {"abhijit": "--:--", "rahu_kaal": "--:--"}
    if sun_rise_jd and sun_set_jd:
        day_length = (sun_set_jd - sun_rise_jd) * 24
        midday_jd = (sun_rise_jd + sun_set_jd) / 2
        
        y, m, d, h = swe.revjul(jd)
        dt_utc = datetime.datetime(y, m, d) + datetime.timedelta(hours=h)
        dt_local = dt_utc + datetime.timedelta(hours=tzone)
        weekday = dt_local.weekday()
        
        # Abhijit Muhurat is traditionally avoided on Wednesdays
        if weekday == 2:
            muhurats["abhijit"] = "None"
        else:
            muhurats["abhijit"] = f"{jd_to_ist_str(midday_jd - 24/(24*60), tzone)} - {jd_to_ist_str(midday_jd + 24/(24*60), tzone)}"
        
        rahu_map = {0:2, 1:7, 2:5, 3:6, 4:4, 5:3, 6:8}
        start_factor = rahu_map[weekday] - 1
        rahu_start_jd = sun_rise_jd + (start_factor * (day_length / 8)) / 24
        rahu_end_jd = rahu_start_jd + (day_length / 8) / 24
        muhurats["rahu_kaal"] = f"{jd_to_ist_str(rahu_start_jd, tzone)} - {jd_to_ist_str(rahu_end_jd, tzone)}"
    planets = {}
    for name, pid in PLANET_IDS.items():
        p_pos = swe.calc_ut(jd, pid, swe.FLG_SWIEPH | swe.FLG_SIDEREAL)[0]
        planets[name] = p_pos[0] % 360
    vara_names = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]
    y, m, d, h = swe.revjul(jd)
    dt_utc = datetime.datetime(y, m, d) + datetime.timedelta(hours=h)
    dt_local = dt_utc + datetime.timedelta(hours=tzone)
    vara = vara_names[dt_local.weekday()]

    result = {
        "tithi": tithi_name,
        "tithi_end": jd_to_ist_str(tithi_end_jd, tzone),
        "paksha": paksha,
        "nakshatra": nak_name,
        "nakshatra_end": jd_to_ist_str(nak_end_jd, tzone),
        "yoga": yoga,
        "karana": karana,
        "vara": vara,
        "sun_sign": sun_sign,
        "moon_sign": moon_sign,
        "ritu": get_ritu(sun_lon),
        "sun_rise": jd_to_ist_str(sun_rise_jd, tzone),
        "sun_set": jd_to_ist_str(sun_set_jd, tzone),
        "moon_rise": jd_to_ist_str(moon_rise_jd, tzone),
        "moon_set": jd_to_ist_str(moon_set_jd, tzone),
        "muhurats": muhurats,
        "planets": planets,
        "is_kharmas": (int(sun_lon / 30) % 12) in [8, 11],
        "is_venus_combust": min(abs(sun_lon - planets.get("Venus", 0)), 360 - abs(sun_lon - planets.get("Venus", 0))) < 10,
        "is_jupiter_combust": min(abs(sun_lon - planets.get("Jupiter", 0)), 360 - abs(sun_lon - planets.get("Jupiter", 0))) < 11,
        "is_sankranti": int(sun_lon / 30) != int((swe.calc_ut(jd - 1.0, swe.SUN, swe.FLG_SWIEPH | swe.FLG_SIDEREAL)[0][0]) / 30)
    }

    # If detailed mode (for Today Panchang), add yoga_end and karana details
    if detailed:
        yoga_end_jd = find_end_time(jd, "yoga")
        result["yoga_end"] = jd_to_ist_str(yoga_end_jd, tzone)

        karana_end_jd = find_end_time(jd, "karana")
        karana1_name = karana
        karana1_end = jd_to_ist_str(karana_end_jd, tzone)
        # Second karana of the day
        jd2 = karana_end_jd + 0.001
        sun_p2 = swe.calc_ut(jd2, swe.SUN, swe.FLG_SWIEPH | swe.FLG_SIDEREAL)[0][0]
        moon_p2 = swe.calc_ut(jd2, swe.MOON, swe.FLG_SWIEPH | swe.FLG_SIDEREAL)[0][0]
        diff2 = (moon_p2 - sun_p2 + 360) % 360
        karana2_name = get_karana(diff2 / 12)
        karana2_end_jd = find_end_time(jd2, "karana")
        karana2_end = jd_to_ist_str(karana2_end_jd, tzone)
        result["karana_details"] = [
            {"name": karana1_name, "end": karana1_end},
            {"name": karana2_name, "end": karana2_end}
        ]

    return result

def get_monthly_calendar(year, month, lat, lon, tzone):
    swe.set_sid_mode(swe.SIDM_LAHIRI)
    num_days = calendar.monthrange(year, month)[1]
    results = []
    prev_planets_signs = {}
    for day_num in range(1, num_days + 1):
        dt = datetime.datetime(year, month, day_num, 6, 0) # Base for sunrise search
        utc_dt = dt - datetime.timedelta(hours=tzone)
        base_jd = swe.julday(utc_dt.year, utc_dt.month, utc_dt.day, utc_dt.hour + utc_dt.minute / 60.0)
        
        # Use Sunrise for the day's attributes to match traditional Panchang
        sun_rise_jd, _ = get_rise_set(base_jd, lat, lon, swe.SUN)
        jd = sun_rise_jd if sun_rise_jd else base_jd
        
        day_data = get_panchang_for_jd(jd, lat, lon, tzone, detailed=False)
        transitions = []
        current_signs = {"Sun": day_data["sun_sign"], "Moon": day_data["moon_sign"]}
        for name, lon_val in day_data.get("planets", {}).items():
            current_signs[name] = ZODIAC_SIGNS[int(lon_val / 30) % 12]
        if prev_planets_signs:
            for name, sign in current_signs.items():
                if sign != prev_planets_signs.get(name):
                    transitions.append({"planet": name, "from": prev_planets_signs.get(name), "to": sign})
        auspicious_tithis = ["Dwitiya", "Tritiya", "Panchami", "Saptami", "Dashami", "Ekadashi", "Dwadashi", "Trayodashi"]
        is_auspicious = day_data["tithi"] in auspicious_tithis and day_data["paksha"] == "Shukla"
        inauspicious_tithis = ["Chaturthi", "Navami", "Chaturdashi", "Amavasya"]
        is_inauspicious = day_data["tithi"] in inauspicious_tithis
        status = "Auspicious" if is_auspicious else "Inauspicious" if is_inauspicious else "Regular"
        results.append({
            "day": day_num,
            "date": dt.strftime("%Y-%m-%d"),
            **day_data,
            "transitions": transitions,
            "is_auspicious": is_auspicious,
            "is_inauspicious": is_inauspicious,
            "status": status
        })
        prev_planets_signs = current_signs
    return results

def get_today_panchang(lat, lon, tzone, date_str=None):
    swe.set_sid_mode(swe.SIDM_LAHIRI)
    if date_str:
        # Use Sunrise for a specific historical/calendar date
        dt = datetime.datetime.strptime(date_str, "%Y-%m-%d").replace(hour=6, minute=0)
        utc_base = dt - datetime.timedelta(hours=tzone)
        jd_base = swe.julday(utc_base.year, utc_base.month, utc_base.day, utc_base.hour + utc_base.minute / 60.0)
        sun_rise_jd, _ = get_rise_set(jd_base, lat, lon, swe.SUN)
        jd = sun_rise_jd if sun_rise_jd else jd_base
    else:
        # Use ACTUAL CURRENT TIME for the "Today" dashboard view
        dt = datetime.datetime.now()
        utc_now = dt - datetime.timedelta(hours=tzone)
        jd = swe.julday(utc_now.year, utc_now.month, utc_now.day, utc_now.hour + utc_now.minute / 60.0 + utc_now.second / 3600.0)
    data = get_panchang_for_jd(jd, lat, lon, tzone, detailed=True)
    auspicious_tithis = ["Dwitiya", "Tritiya", "Panchami", "Saptami", "Dashami", "Ekadashi", "Dwadashi", "Trayodashi"]
    is_auspicious = data["tithi"] in auspicious_tithis and data["paksha"] == "Shukla"
    inauspicious_tithis = ["Chaturthi", "Navami", "Chaturdashi", "Amavasya"]
    is_inauspicious = data["tithi"] in inauspicious_tithis
    data["is_auspicious"] = is_auspicious
    data["is_inauspicious"] = is_inauspicious
    data["status"] = "Auspicious" if is_auspicious else "Inauspicious" if is_inauspicious else "Regular"
    data["day"] = dt.day
    data["date"] = dt.strftime("%Y-%m-%d")
    return data

if __name__ == "__main__":
    if not HAS_SWISSEPH:
        print(json.dumps({"status": "error", "message": "pyswisseph not installed. Run: pip install pyswisseph"}, ensure_ascii=False))
        sys.exit(1)
    try:
        if len(sys.argv) < 2:
            raise ValueError("No input JSON provided")
        input_data = json.loads(sys.argv[1])
        req_type = input_data.get("type", "monthly")
        lat = float(input_data.get("lat", 28.6139))
        lon = float(input_data.get("lon", 77.2090))
        tzone = float(input_data.get("tzone", 5.5))

        if req_type == "today":
            date_str = input_data.get("date", None)
            data = get_today_panchang(lat, lon, tzone, date_str)
            print(json.dumps({"status": "success", "data": data}, indent=2, ensure_ascii=False))
        else:
            year = int(input_data.get("year", datetime.datetime.now().year))
            month = int(input_data.get("month", datetime.datetime.now().month))
            calendar_data = get_monthly_calendar(year, month, lat, lon, tzone)
            print(json.dumps({"status": "success", "data": calendar_data}, indent=2, ensure_ascii=False))
    except Exception as e:
        print(json.dumps({"status": "error", "message": str(e)}))
