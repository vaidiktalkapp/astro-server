"""
Muhurat Calculator — Vedic Auspicious Timing Engine
Finds auspicious dates for Marriage, Business, and Housewarming ceremonies
by scanning a date range and applying traditional Vedic filtering rules.
"""
import sys
import json
import datetime
import math
import swisseph as swe

# Import shared helpers from the calendar module
from astronomy_calendar import (
    get_panchang_for_jd, get_panchang_minimal, get_rise_set, jd_to_ist_str,
    find_start_time, find_end_time, format_jd_to_ampm,
    NAKSHATRAS, TITHI_NAMES, YOGA_NAMES
)
import concurrent.futures
import multiprocessing

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# MUHURAT FILTERING RULES PER CATEGORY
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

MUHURAT_RULES = {
    "marriage": {
        "label": "Marriage (Vivah)",
        "auspicious_tithis": [
            "Dwitiya", "Tritiya", "Panchami", "Saptami",
            "Dashami", "Ekadashi", "Trayodashi", "Purnima"
        ],
        "auspicious_nakshatras": [
            "Rohini", "Mrigashira", "Magha", "Uttara Phalguni",
            "Hasta", "Chitra", "Swati", "Anuradha", "Mula",
            "Uttara Ashadha", "Shravana", "Dhanishta", "Uttara Bhadrapada", 
            "Revati"
        ],
        "auspicious_yogas": [
            "Preeti", "Ayushman", "Saubhagya", "Shobhana",
            "Sukarma", "Dhriti", "Vriddhi", "Harshana",
            "Siddhi", "Shiva", "Siddha", "Sadhya", "Shubha"
        ],
        "avoid_days": [1, 5],  # Tuesday, Saturday (Penalty, not hard block)
        "shukla_paksha_required": False,
        "avoid_karanas": ["Vishti"],
    },
    "business": {
        "label": "Business (Vyapar)",
        "auspicious_tithis": [
            "Dwitiya", "Tritiya", "Panchami", "Saptami",
            "Dashami", "Ekadashi", "Trayodashi"
        ],
        "auspicious_nakshatras": [
            "Ashwini", "Rohini", "Mrigashira", "Pushya",
            "Hasta", "Chitra", "Swati", "Anuradha",
            "Shravana", "Dhanishta", "Revati"
        ],
        "auspicious_yogas": [
            "Preeti", "Ayushman", "Saubhagya", "Shobhana",
            "Sukarma", "Dhriti", "Vriddhi", "Siddhi",
            "Shiva", "Siddha", "Sadhya", "Shubha"
        ],
        "avoid_days": [5],  # Saturday
        "shukla_paksha_required": False,  # preferred but not required
        "avoid_karanas": ["Vishti"],
    },
    "housewarming": {
        "label": "Housewarming (Griha Pravesh)",
        "auspicious_tithis": [
            "Dwitiya", "Tritiya", "Panchami", "Saptami",
            "Dashami", "Ekadashi", "Dwadashi", "Trayodashi"
        ],
        "auspicious_nakshatras": [
            "Rohini", "Mrigashira", "Uttara Phalguni",
            "Hasta", "Swati", "Anuradha",
            "Uttara Ashadha", "Shravana", "Dhanishta",
            "Uttara Bhadrapada", "Revati"
        ],
        "auspicious_yogas": [
            "Preeti", "Ayushman", "Saubhagya", "Shobhana",
            "Sukarma", "Dhriti", "Vriddhi", "Harshana",
            "Siddhi", "Shiva", "Siddha", "Sadhya", "Shubha"
        ],
        "avoid_days": [1, 5],  # Tuesday, Saturday
        "shukla_paksha_required": True,
        "avoid_karanas": ["Vishti"],
    }
}


def calculate_quality_score(panchang, rules):
    """Calculate a 0-100 quality score for a muhurat date."""
    score = 0
    max_score = 0

    # Tithi match (30 pts)
    max_score += 30
    current_tithi = panchang["tithi"].replace(" (K)", "")
    if current_tithi in rules["auspicious_tithis"]:
        score += 30

    # Nakshatra match (30 pts)
    max_score += 30
    if panchang["nakshatra"] in rules["auspicious_nakshatras"]:
        score += 30

    # Yoga match (15 pts)
    max_score += 15
    if panchang["yoga"] in rules["auspicious_yogas"]:
        score += 15

    # Shukla Paksha bonus (10 pts)
    max_score += 10
    if panchang["paksha"] == "Shukla":
        score += 10

    # Karana check (10 pts — penalty for bad karana)
    max_score += 10
    if panchang["karana"] not in rules["avoid_karanas"]:
        score += 10

    # Kharmas penalty (15 pts)
    max_score += 15
    if not panchang.get("is_kharmas", False):
        score += 15

    # Sankranti penalty (20 pts)
    max_score += 20
    if not panchang.get("is_sankranti", False):
        score += 20

    # Combustion penalty (30 pts)
    max_score += 30
    if not panchang.get("is_venus_combust", False) and not panchang.get("is_jupiter_combust", False):
        score += 30

    return int((score / max_score) * 100) if max_score > 0 else 0


def get_special_yogas(panchang):
    """Detect special auspicious yogas like Sarvartha Siddhi, Amrita Siddhi, etc."""
    yogas = []
    weekday = panchang["vara"]
    nak = panchang["nakshatra"]
    
    # 1. Sarvartha Siddhi Yoga rules (Day + Nakshatra)
    ssy_map = {
        "Sunday": ["Hasta", "Mula", "Uttara Phalguni", "Uttara Ashadha", "Uttara Bhadrapada", "Ashwini", "Pushya"],
        "Monday": ["Rohini", "Mrigashira", "Pushya", "Anuradha", "Shravana"],
        "Tuesday": ["Ashwini", "Mrigashira", "Chitra", "Anuradha"],
        "Wednesday": ["Rohini", "Mrigashira", "Ardra", "Hasta", "Anuradha"],
        "Thursday": ["Ashwini", "Punarvasu", "Pushya", "Anuradha", "Revati"],
        "Friday": ["Ashwini", "Bharani", "Ardra", "Anuradha", "Revati"],
        "Saturday": ["Rohini", "Swati", "Anuradha"]
    }
    
    if nak in ssy_map.get(weekday, []):
        yogas.append("Sarvartha Siddhi Yoga")

    # 2. Amrita Siddhi Yoga (Similar to SSY but stronger)
    asy_map = {
        "Sunday": ["Hasta"],
        "Monday": ["Mrigashira"],
        "Tuesday": ["Ashwini"],
        "Wednesday": ["Anuradha"],
        "Thursday": ["Pushya"],
        "Friday": ["Revati"],
        "Saturday": ["Rohini"]
    }
    
    if nak in asy_map.get(weekday, []):
        yogas.append("Amrita Siddhi Yoga")

    return yogas


def find_muhurats(category, start_date, end_date, lat, lon, tzone):
    """
    Scan a date range and return auspicious muhurat dates for the given category.
    """
    swe.set_sid_mode(swe.SIDM_LAHIRI)

    if category not in MUHURAT_RULES:
        raise ValueError(f"Unknown category: {category}. Use: marriage, business, housewarming")

    rules = MUHURAT_RULES[category]
    results = []

def check_eligibility_at_jd(jd, category, rules, lat, lon, tzone, daily_status=None):
    """
    Checks if a specific point in time is auspicious.
    Uses 'daily_status' for slowly-moving invariants to save CPU.
    """
    # Use minimal panchang for high-speed scanning
    panchang = get_panchang_minimal(jd, lat, lon, tzone)
    special_yogas = get_special_yogas(panchang)
    panchang["special_yogas"] = special_yogas

    # Merge daily invariants if provided
    if daily_status:
        panchang.update(daily_status)
    else:
        # Fallback to full check if no daily status provided
        full = get_panchang_for_jd(jd, lat, lon, tzone, detailed=False)
        panchang.update({
            "is_kharmas": full["is_kharmas"],
            "is_sankranti": full["is_sankranti"],
            "is_venus_combust": full["is_venus_combust"],
            "is_jupiter_combust": full["is_jupiter_combust"],
            "paksha": full["paksha"] # minimal already has it but full is safer
        })

    current_tithi = panchang["tithi"].replace(" (K)", "")
    tithi_match = current_tithi in rules["auspicious_tithis"]
    nakshatra_match = panchang["nakshatra"] in rules["auspicious_nakshatras"]
    bad_karana = panchang["karana"] in rules["avoid_karanas"]

    quality = calculate_quality_score(panchang, rules)

    is_kharmas = panchang.get("is_kharmas", False)
    is_sankranti = panchang.get("is_sankranti", False)
    is_v_combust = panchang.get("is_venus_combust", False)
    is_j_combust = panchang.get("is_jupiter_combust", False)

    if category == "marriage":
        is_eligible = ((tithi_match and nakshatra_match) or (len(special_yogas) > 0 and (tithi_match or nakshatra_match))) and (quality >= 82) and not bad_karana
        if is_v_combust or is_j_combust or is_sankranti or is_kharmas:
            is_eligible = False 
    else:
        is_eligible = (tithi_match or nakshatra_match or len(special_yogas) > 0) and (quality > 60) and not bad_karana

    if category == "housewarming" and is_kharmas:
        is_eligible = False

    reasons_good = []
    if tithi_match: reasons_good.append(f"Auspicious Tithi: {panchang['tithi']}")
    if nakshatra_match: reasons_good.append(f"Auspicious Nakshatra: {panchang['nakshatra']}")
    for sy in special_yogas: reasons_good.append(f"Divine Yoga: {sy}")
    if quality > 80: reasons_good.append(f"Overall High Quality Alignment ({quality}%)")
    
    reasons_bad = []
    if panchang["vara"][:3] in ["Tue", "Sat"] and category == "marriage":
        # Professional standard often treats these as significant rejections
        reasons_bad.append(f"{panchang['vara']} is traditionally avoided for Marriage")
    
    if rules["shukla_paksha_required"] and panchang["paksha"] != "Shukla":
        reasons_bad.append("Krishna Paksha (Waning phase)")

    if not tithi_match: reasons_bad.append(f"Tithi {panchang['tithi']} is neutral")
    if not nakshatra_match: reasons_bad.append(f"Nakshatra {panchang['nakshatra']} is neutral")
    if is_kharmas: reasons_bad.append("Kharmas (Sun in Sagittarius/Pisces)")
    if is_sankranti: reasons_bad.append("Sankranti Day")
    if is_v_combust: reasons_bad.append("Shukra Asta (Venus Combustion)")
    if is_j_combust: reasons_bad.append("Guru Asta (Jupiter Combustion)")
    if bad_karana: reasons_bad.append(f"Inauspicious Karana: {panchang['karana']}")

    return is_eligible, panchang, quality, reasons_good, reasons_bad, special_yogas


def process_day(current_date, category, rules, lat, lon, tzone):
    """Processes a single day and returns the best muhurat window."""
    swe.set_sid_mode(swe.SIDM_LAHIRI)
    # 1. Daily Invariants (Calculate once per day)
    dt = datetime.datetime(current_date.year, current_date.month, current_date.day, 6, 0)
    utc_dt = dt - datetime.timedelta(hours=tzone)
    base_jd = swe.julday(utc_dt.year, utc_dt.month, utc_dt.day, utc_dt.hour + utc_dt.minute / 60.0)
    
    sun_rise_jd, sun_set_jd = get_rise_set(base_jd, lat, lon, swe.SUN)
    next_sunrise_jd, _ = get_rise_set(base_jd + 1, lat, lon, swe.SUN)
    if not next_sunrise_jd: next_sunrise_jd = base_jd + 1
    
    morning_full = get_panchang_for_jd(sun_rise_jd or base_jd, lat, lon, tzone, detailed=False)
    daily_status = {
        "is_kharmas": morning_full["is_kharmas"],
        "is_sankranti": morning_full["is_sankranti"],
        "is_venus_combust": morning_full["is_venus_combust"],
        "is_jupiter_combust": morning_full["is_jupiter_combust"],
        "sun_rise": morning_full["sun_rise"],
        "sun_set": morning_full["sun_set"]
    }
    
    # Fast path: If the whole day has a hard block, return empty
    if category == "marriage":
        if daily_status["is_venus_combust"] or daily_status["is_jupiter_combust"] or daily_status["is_sankranti"] or daily_status["is_kharmas"]:
            return None # Day is blocked

    # 2. Time-window Scanning (30-minute steps)
    step_days = 30 / (24 * 60)
    windows = []
    current_window = None
    
    scan_jd = sun_rise_jd or base_jd
    while scan_jd < next_sunrise_jd:
        is_eligible, panchang, quality, rg, rb, sy = check_eligibility_at_jd(
            scan_jd, category, rules, lat, lon, tzone, daily_status
        )
        
        if is_eligible:
            if not current_window:
                current_window = {
                    "start": scan_jd, "end": scan_jd, "max_quality": quality,
                    "reasons_good": rg, "reasons_bad": rb, "special_yogas": sy, "panchang": panchang
                }
            else:
                current_window["end"] = scan_jd
                current_window["max_quality"] = max(current_window["max_quality"], quality)
                for y in sy:
                    if y not in current_window["special_yogas"]: current_window["special_yogas"].append(y)
        else:
            if current_window:
                if (current_window["end"] - current_window["start"]) * 24 >= 1.5:
                    windows.append(current_window)
                current_window = None
        scan_jd += step_days
        
    if current_window and (current_window["end"] - current_window["start"]) * 24 >= 1.5:
        windows.append(current_window)
        
    if not windows:
        return None
        
    best_window = max(windows, key=lambda w: (w["end"] - w["start"]) * w["max_quality"])
    base_date_str = current_date.strftime("%Y-%m-%d")
    
    return {
        "date": base_date_str,
        "day": morning_full["vara"],
        "is_auspicious": True,
        "quality_score": best_window["max_quality"],
        "special_yogas": best_window["special_yogas"],
        "tithi": best_window["panchang"]["tithi"],
        "paksha": best_window["panchang"]["paksha"],
        "nakshatra": best_window["panchang"]["nakshatra"],
        "yoga": best_window["panchang"]["yoga"],
        "karana": best_window["panchang"]["karana"],
        "sun_rise": daily_status["sun_rise"],
        "sun_set": daily_status["sun_set"],
        "muhurat_start": format_jd_to_ampm(best_window["start"], tzone, base_date_str),
        "muhurat_end": format_jd_to_ampm(best_window["end"], tzone, base_date_str),
        "reasons_good": best_window["reasons_good"],
        "reasons_bad": best_window["reasons_bad"],
    }

def find_muhurats(category, start_date, end_date, lat, lon, tzone):
    """Scan a date range with parallel processing."""
    swe.set_sid_mode(swe.SIDM_LAHIRI)
    if category not in MUHURAT_RULES:
        raise ValueError(f"Unknown category: {category}")

    rules = MUHURAT_RULES[category]
    date_list = []
    curr = start_date
    while curr <= end_date:
        date_list.append(curr)
        curr += datetime.timedelta(days=1)

    all_results_raw = []
    
    # Use parallel processing for ranges longer than 15 days
    if len(date_list) > 15:
        cpu_count = min(multiprocessing.cpu_count(), 8)
        with concurrent.futures.ProcessPoolExecutor(max_workers=cpu_count) as executor:
            future_to_date = {executor.submit(process_day, d, category, rules, lat, lon, tzone): d for d in date_list}
            for future in concurrent.futures.as_completed(future_to_date):
                res = future.result()
                if res: all_results_raw.append(res)
    else:
        # Sequential for small ranges
        for d in date_list:
            res = process_day(d, category, rules, lat, lon, tzone)
            if res: all_results_raw.append(res)

    # Sort results by date
    all_results_raw.sort(key=lambda x: x["date"])
    
    # Filter for the summary
    auspicious = sorted(all_results_raw, key=lambda x: x["quality_score"], reverse=True)

    return {
        "category": category,
        "label": rules["label"],
        "scan_range": {
            "start": start_date.strftime("%Y-%m-%d"),
            "end": end_date.strftime("%Y-%m-%d"),
            "total_days": len(date_list),
        },
        "auspicious_dates": auspicious,
        "summary": {
            "total_scanned": len(date_list),
            "total_auspicious": len(auspicious),
        }
    }


if __name__ == "__main__":
    try:
        if len(sys.argv) < 2:
            raise ValueError("No input JSON provided")

        input_data = json.loads(sys.argv[1])

        category = input_data.get("category", "marriage")
        lat = float(input_data.get("lat", 28.6139))
        lon = float(input_data.get("lon", 77.2090))
        tzone = float(input_data.get("tzone", 5.5))

        start_str = input_data.get("start_date")
        end_str = input_data.get("end_date")

        if start_str:
            start_date = datetime.datetime.strptime(start_str, "%Y-%m-%d").date()
        else:
            start_date = datetime.date.today()

        if end_str:
            end_date = datetime.datetime.strptime(end_str, "%Y-%m-%d").date()
        else:
            end_date = start_date + datetime.timedelta(days=30)

        result = find_muhurats(category, start_date, end_date, lat, lon, tzone)
        print(json.dumps({"status": "success", "data": result}, indent=2, ensure_ascii=False))

    except Exception as e:
        print(json.dumps({"status": "error", "message": str(e)}))
