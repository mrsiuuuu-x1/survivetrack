import random
import os
import json
import requests
from flask import Flask, render_template, request, jsonify, session, redirect, url_for
from dotenv import load_dotenv

load_dotenv()
app = Flask(__name__)

# Security key
app.secret_key = "flavortown_secure_bunker_key"

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

# login
@app.route('/', methods=['GET', 'POST'])
def login():
    if request.method == 'POST':
        username = request.form.get('username')
        session['user'] = username
        return redirect(url_for('map_view'))
    return render_template('login.html')

# map
@app.route("/map")
def map_view():
    if 'user' not in session:
        return redirect(url_for('login'))

    token = os.getenv("MAPBOX_TOKEN")
    style = os.getenv("MAPBOX_STYLE_URL")
    
    return render_template("index.html", 
                           mapbox_token=token,
                           mapbox_style=style,
                           user=session['user'])

# API scanner
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

        url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key={api_key}"
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

# API send distress signal
@app.route("/api/signal", methods=["POST"])
def send_distress():
    try:
        data = request.json
        if 'user' in session:
            data['user'] = session['user']
        save_signal(data)
        return jsonify({"status": "success", "message": "DISTRESS SIGNAL BROADCASTED."})
    except Exception as e:
        return jsonify({"status": "error", "message": "BROADCAST FAILED."})

# API get signals
@app.route("/api/signals", methods=["GET"])
def get_distress():
    signals = load_signals() 
    return jsonify(signals)

# API chat
@app.route('/api/gemini', methods=['POST'])
def gemini_chat():
    data = request.json
    user_message = data.get('message', '')
    api_key = os.getenv("GEMINI_API_KEY")
    url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key={api_key}"
    headers = {'Content-Type': 'application/json'}
    payload = {
        "contents": [{
            "parts": [{"text": "You are a survival AI. Be extremely concise. Max 2 sentences. " + user_message}]
        }]
    }

    response = requests.post(url, headers=headers, json=payload)
    return jsonify(response.json())

# loot system
@app.route('/api/loot', methods=['POST'])
def spawn_loot():
    data = request.json
    user_lat = data.get('lat')
    user_lng = data.get('lng')

    loot_items = [
        "MRE Ration Pack", "Antibiotics", "9mm Ammo Box", 
        "Clean Water", "Geiger Counter Battery", "Tactical Knife"
    ]
    stash_locations = []

    #generate 3 random loot spots
    for _ in range(3):
        offset_lat = random.uniform(-0.003,0.003)
        offset_lng = random.uniform(-0.003,0.003)

        stash = {
            "id": random.randint(1000,9999),
            "lat": user_lat + offset_lat,
            "lng": user_lng + offset_lng,
            "item": random.choice(loot_items)
        }
        stash_locations.append(stash)
    return jsonify(stash_locations)

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))
    app.run(host='0.0.0.0', port=port)