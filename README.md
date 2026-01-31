# SURVIVETRACK: AR Zombie Survival

> **STATUS:** CRITICAL  
> **SYSTEM:** ONLINE  
> **LOCATION:** [REDACTED]

**SurviveTrack** is a browser-based **Augmented Reality (AR) Survival Horror Game** that turns your real-world neighborhood into a zombie-infested wasteland. Using your device's GPS, you must scavenge for supplies, fight off the infected, and signal for help—all within a retro-futuristic terminal interface.

---

## Game Features

* **Real-World GPS Navigation**  
  Your physical location is your in-game position. You must walk in real life to find loot.

* **Dynamic Zombie Spawning**  
  The infected spawn randomly around your location.

* **Proximity Danger System**  
  Get too close to a zombie and your infection level spikes. The screen shakes and alarms activate.

* **Combat and Ammo Economy**  
  Tap zombies to shoot. Ammo is limited, so scavenging is required to reload.

* **Loot and Scavenging**  
  Green supply caches appear on the map containing rations, antibiotics, and ammunition.

* **Multiplayer Distress Signals**  
  Broadcast your location to other players using a global distress beacon.

* **Synth Audio Engine**  
  Custom-coded sound effects such as gunshots, alarms, and UI chimes are generated in real time without external audio files.

* **Retro Terminal UI**  
  CRT scanlines, pixel fonts, and a dark tactical interface inspired by classic terminals.

---

## Tech Stack

* **Frontend:** HTML5, CSS3, Vanilla JavaScript
* **Maps:** Mapbox GL JS API
* **Backend:** Python (Flask)
* **Deployment:** Vercel, Render, or PythonAnywhere

---

## Installation and Setup

### 1. Clone the Repository

```bash
git clone https://github.com/mrsiuuuu-x1/survivetrack.git
cd survivetrack
```

### 2. Install Dependencies

Python must be installed on your system.

```bash
pip install flask
```

### 3. Configure Mapbox

1. Sign up at Mapbox.com
2. Obtain your public access token
3. Open `index.html` (or the Python configuration file)
4. Replace `YOUR_MAPBOX_TOKEN` with your actual token

### 4. Run Locally

```bash
python app.py
```

Visit the application at:

```
http://127.0.0.1:5000
```

---

## How to Play

1. **Login**  
   Enter your callsign (for example: RANGER-01).

2. **Enable GPS**  
   Allow location access so the game can track your movement.

3. **Unlock Audio**  
   Tap the screen once to enable the sound engine.

4. **Survive**

   * **Keep Moving:** Stay away from red dots representing zombies
   * **Shoot:** Click a zombie to eliminate it (gain XP and reduce infection)
   * **Reload:** When ammo reaches zero, locate a green supply cache
   * **Watch Your Vitals:** If health reaches 0% or infection reaches 100%, the game ends

---

## Contributing

Transmission received. Contributions are welcome.

1. Fork the repository
2. Create a new feature branch

   ```bash
   git checkout -b feature/new-weapon
   ```
3. Commit your changes
4. Open a pull request

---

## Warning

This system is not responsible for any actual zombie outbreaks caused by playing this game.