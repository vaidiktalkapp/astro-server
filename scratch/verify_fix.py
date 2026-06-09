import json
import subprocess
from datetime import datetime

payload = {
    "action": "all",
    "date": "10-10-2000",
    "time": "15:30",
    "lat": 18.5204,
    "lon": 73.8567,
    "name": "Vishal",
    "tzone": 5.5
}

script_path = r"d:\vaidiktalkAI\vaidik-server-main\src\ai-astrologers\scripts\astronomy_bridge.py"
result = subprocess.run(["python", script_path, json.dumps(payload)], capture_output=True, text=True)

data = json.loads(result.stdout)
current_dasha = data["data"]["dasha"]["current"]
print("Current Dasha:")
print(json.dumps(current_dasha, indent=2))

planets = data["data"]["kundli"]["planets"]
print("\nPlanetary Placements with Lordship:")
for p_name, p_data in planets.items():
    if p_name == "Ascendant": continue
    lords = ", ".join(p_data.get("lords", []))
    print(f"{p_name}: {p_data['sign']} in {p_data['house']} house. Lords: {lords}")
