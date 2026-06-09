import math

# Ashtakoot (36 Points) System Implementation

# 1. VARNA (1 Point) - Spiritual Development / Ego match
# Rashi classification
# Brahmin: Cancer, Scorpio, Pisces
# Kshatriya: Aries, Leo, Sagittarius
# Vaishya: Taurus, Virgo, Capricorn
# Shudra: Gemini, Libra, Aquarius
VARNA_POINTS = {
    0: 1, 1: 2, 2: 3, 3: 0, 4: 1, 5: 2, 
    6: 3, 7: 0, 8: 1, 9: 2, 10: 3, 11: 0
} # 0=Brahmin, 1=Kshatriya, 2=Vaishya, 3=Shudra
# Rule: Boy's Varna should be <= Girl's Varna (where 0 is highest)
def calc_varna(b_rashi, g_rashi):
    b_v = VARNA_POINTS[b_rashi]
    g_v = VARNA_POINTS[g_rashi]
    return 1 if b_v <= g_v else 0

# 2. VASHYA (2 Points) - Attraction / Control
# 0=Chatushpad (Aries, Taurus, 2nd half Sag, 1st half Cap)
# 1=Manav (Gemini, Virgo, Libra, 1st half Sag, Aquarius)
# 2=Jalachar (Cancer, 2nd half Cap, Pisces)
# 3=Vanachar (Leo)
# 4=Keet (Scorpio)
# Simplified Vashya table:
VASHYA = [0, 0, 1, 2, 3, 1, 1, 4, 0, 0, 1, 2] # Approximate (treating half signs as predominant)
# Vashya score matrix [Boy][Girl]
VASHYA_SCORE = [
    [2, 1, 1, 0.5, 1], # Chatushpad
    [1, 2, 0.5, 0, 1], # Manav
    [1, 0.5, 2, 1, 1], # Jalachar
    [0, 0, 1, 2, 0],   # Vanachar
    [1, 1, 1, 0, 2]    # Keet
]
def calc_vashya(b_rashi, g_rashi):
    return VASHYA_SCORE[VASHYA[b_rashi]][VASHYA[g_rashi]]

# 3. TARA (3 Points) - Destiny / Health
def calc_tara(b_nak, g_nak):
    tara_b = ((g_nak - b_nak) % 27) % 9
    tara_g = ((b_nak - g_nak) % 27) % 9
    
    b_score = 1.5 if tara_b in [1, 3, 5, 7, 8] else 0  # 1-indexed conceptually: 2, 4, 6, 8, 9 are good
    g_score = 1.5 if tara_g in [1, 3, 5, 7, 8] else 0
    return b_score + g_score

# 4. YONI (4 Points) - Intimacy / Physical compatibility
# 14 animals mapped to 27 Nakshatras
YONI = [
    0, 1, 2, 3, 3, 4, 5, 2, 5, 5,  # 0-9
    6, 6, 7, 8, 8, 9, 10, 10, 4, 9, # 10-19
    11, 11, 0, 1, 12, 13, 12        # 20-26
] # 0=Horse, 1=Elephant, 2=Sheep, 3=Serpent, 4=Dog, 5=Cat, 6=Rat, 7=Cow, 8=Buffalo, 9=Tiger, 10=Hare, 11=Monkey, 12=Mongoose, 13=Lion

YONI_MATRIX = [
    # 14x14 compatibility matrix (simplified rule approximation: same=4, friend=3, neutral=2, enemy=1, sworn enemy=0)
    # 0  1  2  3  4  5  6  7  8  9 10 11 12 13
    [4, 2, 2, 3, 2, 2, 2, 1, 0, 1, 2, 3, 2, 1], # 0
    [2, 4, 3, 3, 2, 2, 2, 2, 3, 1, 2, 3, 2, 0], # 1
    [2, 3, 4, 2, 1, 2, 1, 3, 3, 1, 2, 0, 3, 1], # 2
    [3, 3, 2, 4, 2, 1, 1, 1, 1, 2, 2, 2, 0, 2], # 3
    [2, 2, 1, 2, 4, 2, 1, 2, 2, 1, 0, 2, 1, 1], # 4
    [2, 2, 2, 1, 2, 4, 0, 2, 2, 1, 3, 3, 2, 1], # 5
    [2, 2, 1, 1, 1, 0, 4, 2, 2, 2, 2, 2, 1, 2], # 6
    [1, 2, 3, 1, 2, 2, 2, 4, 3, 0, 3, 2, 2, 1], # 7
    [0, 3, 3, 1, 2, 2, 2, 3, 4, 1, 2, 2, 2, 1], # 8
    [1, 1, 1, 2, 1, 1, 2, 0, 1, 4, 1, 1, 2, 1], # 9
    [2, 2, 2, 2, 0, 3, 2, 3, 2, 1, 4, 2, 2, 1], # 10
    [3, 3, 0, 2, 2, 3, 2, 2, 2, 1, 2, 4, 3, 2], # 11
    [2, 2, 3, 0, 1, 2, 1, 2, 2, 2, 2, 3, 4, 2], # 12
    [1, 0, 1, 2, 1, 1, 2, 1, 1, 1, 1, 2, 2, 4]  # 13
]
def calc_yoni(b_nak, g_nak):
    return YONI_MATRIX[YONI[b_nak]][YONI[g_nak]]

# 5. GRAHA MAITRI (5 Points) - Mental / Psychological compatibility
RASHI_LORDS = [0, 1, 2, 3, 4, 2, 1, 0, 5, 6, 6, 5] 
# 0=Mars, 1=Venus, 2=Mercury, 3=Moon, 4=Sun, 5=Jupiter, 6=Saturn

# Friendship array: 0=Enemy, 1=Neutral, 2=Friend
GRAHA_FRIENDSHIP = [
    # Ma Ve Me Mo Su Ju Sa
    [2, 1, 0, 2, 2, 2, 1], # Mars
    [1, 2, 2, 0, 0, 1, 2], # Venus
    [1, 2, 2, 0, 2, 1, 1], # Mercury
    [1, 1, 2, 2, 2, 1, 1], # Moon
    [2, 0, 1, 2, 2, 2, 0], # Sun
    [2, 0, 0, 2, 2, 2, 1], # Jupiter
    [0, 2, 2, 0, 0, 1, 2], # Saturn
]

def calc_maitri(b_rashi, g_rashi):
    b_lord = RASHI_LORDS[b_rashi]
    g_lord = RASHI_LORDS[g_rashi]
    b_feeling = GRAHA_FRIENDSHIP[b_lord][g_lord]
    g_feeling = GRAHA_FRIENDSHIP[g_lord][b_lord]
    
    val = b_feeling + g_feeling
    if val == 4: return 5     # Friend/Friend
    if val == 3: return 4     # Friend/Neutral
    if val == 2: 
        if b_feeling == 1: return 3 # Neutral/Neutral
        return 1             # Friend/Enemy
    if val == 1: return 0.5   # Enemy/Neutral
    return 0                 # Enemy/Enemy

# 6. GANA (6 Points) - Temperament
# 0=Deva, 1=Manushya, 2=Rakshasa
GANA_ARRAY = [
    0, 1, 2, 1, 0, 1, 0, 0, 2, 2,
    1, 1, 1, 2, 0, 0, 1, 2, 2, 1,
    1, 0, 2, 2, 1, 1, 0
]
GANA_SCORE = [
    [6, 5, 1],
    [6, 6, 0],
    [0, 0, 6]
]
def calc_gana(b_nak, g_nak):
    return GANA_SCORE[GANA_ARRAY[b_nak]][GANA_ARRAY[g_nak]]

# 7. BHAKOOT (7 Points) - Love / emotional connection
def calc_bhakoot(b_rashi, g_rashi):
    diff = ((b_rashi - g_rashi) % 12) + 1
    # Doshas: 6/8, 9/5, 12/2
    if diff in [6, 8, 5, 9, 2, 12]:
        return 0
    return 7

# 8. NADI (8 Points) - Health and genes
# 0=Adi, 1=Madhya, 2=Antya
NADI_ARRAY = [
    0, 1, 2, 2, 1, 0, 0, 1, 2, 2,
    1, 0, 0, 1, 2, 2, 1, 0, 0, 1,
    2, 2, 1, 0, 0, 1, 2
]
def calc_nadi(b_nak, g_nak):
    b_nadi = NADI_ARRAY[b_nak]
    g_nadi = NADI_ARRAY[g_nak]
    return 0 if b_nadi == g_nadi else 8

# Dashakoot Additions
def calc_rajju(b_nak, g_nak):
    RAJJU_GROUPS = [
        [4, 13, 22], # Shiro
        [3, 5, 12, 14, 21, 23], # Kantha
        [2, 6, 11, 15, 20, 24], # Nabhi
        [1, 7, 10, 16, 19, 25], # Kati
        [0, 8, 9, 17, 18, 26]   # Padha
    ]
    b_r = next((i for i, group in enumerate(RAJJU_GROUPS) if b_nak in group), -1)
    g_r = next((i for i, group in enumerate(RAJJU_GROUPS) if g_nak in group), -1)
    return 0 if (b_r == g_r and b_r != -1) else 5

def calc_vedha(b_nak, g_nak):
    VEDHA_PAIRS = [
        (0,17), (1,16), (2,15), (3,14), (5,21), (6,20), 
        (7,19), (8,18), (9,26), (10,25), (11,24), (12,23)
    ]
    is_vedha = any((b_nak == p[0] and g_nak == p[1]) or (b_nak == p[1] and g_nak == p[0]) for p in VEDHA_PAIRS)
    return 0 if is_vedha else 2

def calc_mahendra(b_nak, g_nak):
    count = ((b_nak - g_nak) % 27) + 1
    return 2 if count in [4, 7, 10, 13, 16, 19, 22, 25] else 0

def calc_stree_deergha(b_nak, g_nak):
    count = ((b_nak - g_nak) % 27) + 1
    return 2 if count > 13 else 0

# Name Mappings
VARNA_NAMES = ["Brahmin", "Kshatriya", "Vaishya", "Shudra"]
VASHYA_NAMES = ["Chatushpad", "Manav", "Jalachar", "Vanachar", "Keet"]
TARA_NAMES = ["Janma", "Sampat", "Vipat", "Kshema", "Pratyari", "Sadhaka", "Vadha", "Mitra", "Ati-Mitra"]
YONI_NAMES = ["Ashwa", "Gaja", "Mesha", "Sarpa", "Shwan", "Marjara", "Mushaka", "Gau", "Mahisha", "Vyaghra", "Mriga", "Vanara", "Nakula", "Simha"]
LORD_NAMES = ["Mars", "Venus", "Mercury", "Moon", "Sun", "Jupiter", "Saturn"]
GANA_NAMES = ["Deva", "Manushya", "Rakshasa"]
RASHI_NAMES = ["Aries", "Taurus", "Gemini", "Cancer", "Leo", "Virgo", "Libra", "Scorpio", "Sagittarius", "Capricorn", "Aquarius", "Pisces"]
NADI_NAMES = ["Adi", "Madhya", "Antya"]
RAJJU_NAMES = ["Shiro", "Kantha", "Nabhi", "Kati", "Padha"]

# Manglik Dosh Calculation
def check_manglik(asc_rashi, mars_rashi):
    # Standard North Indian computation: Mars in 1, 2, 4, 7, 8, 12 from Ascendant
    house = ((mars_rashi - asc_rashi) % 12) + 1
    if house in [1, 2, 4, 7, 8, 12]:
        return True
    return False

def calculate_ashtakoot(b_rashi, b_nak, b_asc, b_mars, g_rashi, g_nak, g_asc, g_mars):
    scores = {
        "varna": calc_varna(b_rashi, g_rashi),
        "vashya": calc_vashya(b_rashi, g_rashi),
        "tara": calc_tara(b_nak, g_nak),
        "yoni": calc_yoni(b_nak, g_nak),
        "maitri": calc_maitri(b_rashi, g_rashi),
        "gana": calc_gana(b_nak, g_nak),
        "bhakoot": calc_bhakoot(b_rashi, g_rashi),
        "nadi": calc_nadi(b_nak, g_nak)
    }

    details = {
        "varna": {"boy": VARNA_NAMES[VARNA_POINTS[b_rashi]], "girl": VARNA_NAMES[VARNA_POINTS[g_rashi]]},
        "vashya": {"boy": VASHYA_NAMES[VASHYA[b_rashi]], "girl": VASHYA_NAMES[VASHYA[g_rashi]]},
        "tara": {"boy": TARA_NAMES[((g_nak - b_nak) % 27) % 9], "girl": TARA_NAMES[((b_nak - g_nak) % 27) % 9]},
        "yoni": {"boy": YONI_NAMES[YONI[b_nak]], "girl": YONI_NAMES[YONI[g_nak]]},
        "maitri": {"boy": LORD_NAMES[RASHI_LORDS[b_rashi]], "girl": LORD_NAMES[RASHI_LORDS[g_rashi]]},
        "gana": {"boy": GANA_NAMES[GANA_ARRAY[b_nak]], "girl": GANA_NAMES[GANA_ARRAY[g_nak]]},
        "bhakoot": {"boy": RASHI_NAMES[b_rashi], "girl": RASHI_NAMES[g_rashi]},
        "nadi": {"boy": NADI_NAMES[NADI_ARRAY[b_nak]], "girl": NADI_NAMES[NADI_ARRAY[g_nak]]}
    }

    total = sum(scores.values())
    
    b_manglik = check_manglik(b_asc, b_mars)
    g_manglik = check_manglik(g_asc, g_mars)
    
    manglik_status = "No Mangal Dosha"
    if b_manglik and g_manglik:
        manglik_status = "Mangal Dosha Canceled (Both)"
    elif b_manglik:
        manglik_status = "Boy has Mangal Dosha"
    elif g_manglik:
        manglik_status = "Girl has Mangal Dosha"
        
    if total >= 25:
        conclusion = "Excellent compatibility. This marriage is highly preferable."
    elif total >= 18:
        conclusion = "Average compatibility. This marriage is acceptable."
    else:
        conclusion = "Poor compatibility. This marriage is not recommended without astrological remedies."
        
    guna_report = []
    max_scores = {"varna": 1, "vashya": 2, "tara": 3, "yoni": 4, "maitri": 5, "gana": 6, "bhakoot": 7, "nadi": 8}
    for k, v in scores.items():
        guna_report.append({
            "name": k.upper(),
            "received_points": v,
            "total_points": max_scores.get(k, 0),
            "description": f"{details.get(k, {}).get('boy', '')} & {details.get(k, {}).get('girl', '')}"
        })

    return {
        "system": "Ashtakoot",
        "guna_report": guna_report,
        "total_points": total,
        "total": total, # Legacy support
        "scores": scores, # Legacy support
        "details": details, # Legacy support
        "manglik_status": manglik_status,
        "conclusion": conclusion
    }

def calculate_dashakoot(b_rashi, b_nak, b_asc, b_mars, g_rashi, g_nak, g_asc, g_mars):
    # Dashakoot (10 Poruthams) scaled to 36 points
    scores = {
        "dina": calc_tara(b_nak, g_nak), # 3 max
        "gana": int(calc_gana(b_nak, g_nak) * (4.0 / 6.0)), # 4 max
        "yoni": calc_yoni(b_nak, g_nak), # 4 max
        "rasi": calc_bhakoot(b_rashi, g_rashi), # 7 max
        "maitri": calc_maitri(b_rashi, g_rashi), # 5 max
        "rajju": calc_rajju(b_nak, g_nak), # 5 max
        "vedha": calc_vedha(b_nak, g_nak), # 2 max
        "vashya": calc_vashya(b_rashi, g_rashi), # 2 max
        "mahendra": calc_mahendra(b_nak, g_nak), # 2 max
        "stree": calc_stree_deergha(b_nak, g_nak) # 2 max
    }

    b_rajju = next((i for i, group in enumerate([[4,13,22],[3,5,12,14,21,23],[2,6,11,15,20,24],[1,7,10,16,19,25],[0,8,9,17,18,26]]) if b_nak in group), -1)
    g_rajju = next((i for i, group in enumerate([[4,13,22],[3,5,12,14,21,23],[2,6,11,15,20,24],[1,7,10,16,19,25],[0,8,9,17,18,26]]) if g_nak in group), -1)

    details = {
        "dina": {"boy": TARA_NAMES[((g_nak - b_nak) % 27) % 9], "girl": TARA_NAMES[((b_nak - g_nak) % 27) % 9]},
        "gana": {"boy": GANA_NAMES[GANA_ARRAY[b_nak]], "girl": GANA_NAMES[GANA_ARRAY[g_nak]]},
        "yoni": {"boy": YONI_NAMES[YONI[b_nak]], "girl": YONI_NAMES[YONI[g_nak]]},
        "rasi": {"boy": RASHI_NAMES[b_rashi], "girl": RASHI_NAMES[g_rashi]},
        "maitri": {"boy": LORD_NAMES[RASHI_LORDS[b_rashi]], "girl": LORD_NAMES[RASHI_LORDS[g_rashi]]},
        "rajju": {"boy": RAJJU_NAMES[b_rajju] if b_rajju!=-1 else "-", "girl": RAJJU_NAMES[g_rajju] if g_rajju!=-1 else "-"},
        "vedha": {"boy": "No Vedha" if scores["vedha"]==2 else "Vedha Dosha", "girl": "No Vedha" if scores["vedha"]==2 else "Vedha Dosha"},
        "vashya": {"boy": VASHYA_NAMES[VASHYA[b_rashi]], "girl": VASHYA_NAMES[VASHYA[g_rashi]]},
        "mahendra": {"boy": "Mahendra Ok" if scores["mahendra"]==2 else "No Mahendra", "girl": "-"},
        "stree": {"boy": "Stree D. Ok" if scores["stree"]==2 else "No Stree D.", "girl": "-"}
    }

    total = sum(scores.values())
    
    b_manglik = check_manglik(b_asc, b_mars)
    g_manglik = check_manglik(g_asc, g_mars)
    
    manglik_status = "No Mangal Dosha"
    if b_manglik and g_manglik: manglik_status = "Mangal Dosha Canceled (Both)"
    elif b_manglik: manglik_status = "Boy has Mangal Dosha"
    elif g_manglik: manglik_status = "Girl has Mangal Dosha"
        
    if total >= 25:
        conclusion = "Excellent compatibility. This marriage is highly preferable."
    elif total >= 18:
        conclusion = "Average compatibility. This marriage is acceptable."
    else:
        conclusion = "Poor compatibility. This marriage is not recommended without astrological remedies."
        
    guna_report = []
    max_scores = {
        "dina": 3, "gana": 4, "yoni": 4, "rasi": 7, 
        "maitri": 5, "rajju": 5, "vedha": 2, "vashya": 2,
        "mahendra": 2, "stree": 2
    }
    for k, v in scores.items():
        guna_report.append({
            "name": k.upper(),
            "received_points": v,
            "total_points": max_scores.get(k, 0),
            "description": f"{details.get(k, {}).get('boy', '')} & {details.get(k, {}).get('girl', '')}"
        })

    return {
        "system": "Dashakoot",
        "guna_report": guna_report,
        "total_points": total,
        "total": total, # Legacy support
        "scores": scores, # Legacy support
        "details": details, # Legacy support
        "manglik_status": manglik_status,
        "conclusion": conclusion
    }
