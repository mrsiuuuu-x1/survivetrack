import os
import json
import requests
from flask import Flask, render_template, request, jsonify
from dotenv import load_dotenv

load_dotenv()
app = Flask(__name__)

# DB setup
DB_FILE = "signals.json"

def load_signals():
    """Reads the list of distress signals from the file."""
    if not os.path.exists(DB_FILE):
        return []
    try:
        with open(DB_FILE, 'r') as f:
            return json.load(f)
    except:
        return []

def save_signal(new_signal):
    """Saves a new signal to the file."""
    signals = load_signals()
    signals.append(new_signal)
    with open(DB_FILE, 'w') as f:
        json.dump(signals, f)

# routes
@app.route("/")
def index():
    token = os.getenv("MAPBOX_TOKEN")
    style = os.getenv("MAPBOX_STYLE_URL")
    
    if not token or not style:
        print("CRITICAL ERROR: Mapbox keys are missing from .env file!")
    
    return render_template("index.html", 
                           mapbox_token=token,
                           mapbox_style=style)

# AI scanner
@app.route("/api/scan", methods=["POST"])
def scan_area():
    try:
        api_key = os.getenv("GEMINI_API_KEY")
        data = request.json
        
        prompt_text = f"""
        You are a survival system AI.
        User location: {data.get('lat')}, {data.get('lng')}.
        Generate a ONE sentence scan report.
        - Threat: (zombies, radiation, raiders) OR Loot: (supplies, weapon).
        - Gritty, military style.
        - NO city names.
        """

        url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key={api_key}"
        payload = { "contents": [{ "parts": [{"text": prompt_text}] }] }
        response = requests.post(url, json=payload)
        
        if response.status_code == 200:
            ai_data = response.json()
            threat = ai_data["candidates"][0]["content"]["parts"][0]["text"]
            return jsonify({"message": threat.strip(), "status": "success"})
        else:
            return jsonify({"message": "ERROR: ENCRYPTED SIGNAL REJECTED.", "status": "error"})
    except:
        return jsonify({"message": "SYSTEM ERROR: SIGNAL LOST.", "status": "error"})

# send distress signal
@app.route("/api/distress", methods=["POST"])
def send_distress():
    try:
        data = request.json
        save_signal(data)
        return jsonify({"status": "success", "message": "DISTRESS SIGNAL BROADCASTED GLOBALLY."})
    except Exception as e:
        print(f"Distress Error: {e}")
        return jsonify({"status": "error", "message": "BROADCAST FAILED."})

# getting signals
@app.route("/api/distress", methods=["GET"])
def get_distress():
    signals = load_signals() 
    return jsonify(signals)

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))
    app.run(host='0.0.0.0', port=port)