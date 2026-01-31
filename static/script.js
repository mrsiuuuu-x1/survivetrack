let currentUserPos = { lat: 0, lng: 0 };
let distressMarkers = [];
let zombieMarkers = [];
let ammo = 6;
let hasZoomed = false;
let inventory = [];
let activeMarker = null;
let health = 100;
let infection = 0;
let gameActive = true;
let username = localStorage.getItem("survivor_name") || "RANGER-01";

mapboxgl.accessToken = MAPBOX_TOKEN;

// logging system
function addLog(message, color = "white") {
    const box = document.getElementById('log-container');
    if (!box) return; 

    box.style.height = "150px";
    box.style.overflowY = "auto";
    box.style.display = "flex";
    box.style.flexDirection = "column";

    const time = new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
    
    const entry = document.createElement('div');
    entry.style.marginBottom = "5px";
    entry.style.flexShrink = "0";
    entry.style.color = color;
    
    if (color === 'red' || color === '#ff3333') {
        entry.style.textShadow = "0 0 5px red";
    }
    
    entry.innerHTML = `<span style="opacity:0.7; color: white;">${time}</span> > ${message}`;
    
    box.appendChild(entry);
    
    setTimeout(() => {
        box.scrollTop = box.scrollHeight;
    }, 50);
}

// map intialization
const map = new mapboxgl.Map({
    container: 'map',
    style: MAPBOX_STYLE,
    center: [0, 0], 
    zoom: 1, 
    attributionControl: false
});

// Player Marker
const el = document.createElement('div');
el.className = 'survivor-marker';
const playerMarker = new mapboxgl.Marker(el).setLngLat([0, 0]).addTo(map);

// gps tracker
if (navigator.geolocation) {
    const gpsOptions = {
        enableHighAccuracy: true,
        timeout: 15000, 
        maximumAge: 0   
    };

    navigator.geolocation.watchPosition(
        (position) => {
            const { latitude, longitude, accuracy } = position.coords;
            currentUserPos = { lat: latitude, lng: longitude };
            playerMarker.setLngLat([longitude, latitude]);

            const loaderText = document.querySelector('#gps-loader div:last-child');
            if (loaderText) {
                loaderText.innerText = `PRECISION: ${Math.floor(accuracy)} METERS...`;
            }

            if (accuracy > 100 && !hasZoomed) {
                return;
            }

            if (!hasZoomed) {
                console.log(`GPS LOCKED. Precision: ${accuracy}m`);
                const loader = document.getElementById('gps-loader');
                if (loader) loader.style.display = 'none';
                map.flyTo({ center: [longitude, latitude], zoom: 17, speed: 3 });
                hasZoomed = true;
                
                addLog(`UPLINK ESTABLISHED: ${latitude.toFixed(5)}, ${longitude.toFixed(5)}`, "#00ff41");
            }
        },
        (err) => {
            console.error("GPS ERROR:", err);
            const loader = document.getElementById('gps-loader');
            if (loader) loader.innerHTML = "<span style='color:red'>SIGNAL LOST. RETRYING...</span>";
            addLog("GPS SIGNAL LOST.", "red");
        },
        gpsOptions
    );
} else {
    addLog("ERROR: GPS NOT SUPPORTED.", "red");
}

// panic btn
async function panicMode() {
    if (currentUserPos.lat === 0 && currentUserPos.lng === 0) {
        addLog("WAITING FOR GPS...", "yellow");
        return;
    }
    if (!confirm("BROADCAST LOCATION TO ALL SURVIVORS?")) return;

    addLog("BROADCASTING...", "yellow");
    try {
        await fetch("/api/distress", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                lat: currentUserPos.lat,
                lng: currentUserPos.lng,
                time: new Date().toLocaleTimeString(),
                username: username
            })
        });
        addLog("SIGNAL SENT.", "#00ff41");
    } catch (e) {
        addLog("BROADCAST FAILED.", "red");
    }
}

// ai scanner
async function scanArea() {
    addLog("ANALYZING ENVIRONMENT...", "cyan");
    try {
        const res = await fetch("/api/scan", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(currentUserPos)
        });
        const data = await res.json();
        addLog(data.message, "#ffcc00");
    } catch { 
        addLog("SCAN FAILED.", "red"); 
    }
}

// distress signal
setInterval(async () => {
    try {
        const res = await fetch("/api/distress");
        if (!res.ok) return;
        
        const signals = await res.json();
        
        distressMarkers.forEach(m => m.remove());
        distressMarkers = [];

        signals.forEach(sig => {
            const lat = parseFloat(sig.lat);
            const lng = parseFloat(sig.lng);
            if (isNaN(lat) || isNaN(lng) || lat === 0 || lng === 0) return;

            const wrapper = document.createElement('div');
            wrapper.style.display = 'block';

            const dot = document.createElement('div');
            dot.style.width = '20px';
            dot.style.height = '20px';
            dot.style.backgroundColor = '#ffcc00';
            dot.style.borderRadius = '50%';
            dot.style.border = '2px solid white';
            dot.style.boxShadow = '0 0 20px #ffcc00';
            dot.style.cursor = 'pointer';

            dot.animate([
                { transform: 'scale(1)', opacity: 1 },
                { transform: 'scale(2.5)', opacity: 0 }
            ], {
                duration: 1500,
                iterations: Infinity
            });

            wrapper.appendChild(dot);

            const m = new mapboxgl.Marker(wrapper)
                .setLngLat([lng, lat])
                .setPopup(new mapboxgl.Popup({ offset: 25 }) 
                .setHTML(`
                    <h3 style="margin: 0; color: #ffcc00; font-size: 1.4rem;">
                         ⚠️ ${sig.username.toUpperCase()}
                    </h3>
                    <p style="margin: 5px 0 0 0; color: white; font-size: 1.1rem;">
                        REQ: ASSISTANCE
                    </p>
                    <small style="color: #888;">
                        TIME: ${sig.time}
                    </small>
                `))
                .addTo(map);

            sfx.alarm();
            distressMarkers.push(m);
        });
    } catch (e) {
        console.error("Signal Loop Error:", e);
    }
}, 3000);

setInterval(() => {
    if (!gameActive) return;

    infection += 1;
    health -= 0.5;

    // proximity check
    if (currentUserPos.lat !== 0 && zombieMarkers.length > 0) {
        const playerloc = new mapboxgl.LngLat(currentUserPos.lng, currentUserPos.lat);
        let inDangerZone = false;
        let closestDist = 9999;

        zombieMarkers.forEach(marker => {
            const zombieLoc = marker.getLngLat();
            const dist = playerloc.distanceTo(zombieLoc);

            if (dist < 50) {
                inDangerZone = true;
                if (dist < closestDist) closestDist = dist;
            }
        });

        if (inDangerZone) {
            infection += 5;
            addLog(`DANGER: INFECTED NEARBY (${Math.floor(closestDist)}m)`, "red");

            document.body.style.transform = `translate(${Math.random()*5}px, ${Math.random()*5}px)`;
            setTimeout(() => document.body.style.transform = 'none', 100);
        }
    }

    if (infection > 100) infection = 100;
    if (health < 0) health = 0;

    updateBioMonitor();
    checkGameOver();
}, 2000);

function updateBioMonitor() {
    const healthVal = document.getElementById('health-val');
    if (healthVal) {
        healthVal.innerText = Math.floor(health) + "%";
        document.getElementById('infection-val').innerText = infection + "%";

        const healthBar = document.getElementById('health-bar') || document.getElementById('heath-bar');
        if (healthBar) healthBar.style.width = health + "%";
        
        document.getElementById('infection-bar').style.width = infection + "%";
    }
}

function checkGameOver() {
    if (infection >= 100 || health <= 0) {
        if (!gameActive) return;
        gameActive = false;
        const deathInterval = setInterval(() => {
            sfx.alarm();
        }, 1000);
        const screen = document.getElementById('game-over-screen');
        if (screen) {
            screen.style.display = 'flex';
        }

        addLog("CRITICAL FAILURE: SYSTEM SHUTDOWN.", "red");
    }
}

function renderInventory() {
    const list = document.getElementById('inventory-list');
    const header = document.querySelector('#inventory-panel h3');
    
    if (!list || !header) return;

    list.innerHTML = "";
    header.innerText = `BACKPACK [${inventory.length}/5]`;

    inventory.forEach((item, index) => {
        const li = document.createElement('li');
        li.style.color = "#00ff41";
        li.style.textShadow = "0 0 5px #00ff41";
        li.style.marginBottom = "8px";

        let actionBtn = "";

        if (item.includes("Ration") || item.includes("Antibiotics") || item.includes("Water")) {
            actionBtn = `<span onclick="useItem(${index}, '${item}')" style="color: yellow; cursor: pointer; margin-left: 10px; border: 1px solid yellow; padding: 0 5px;">[USE]</span>`;
        } else {
            actionBtn = `<span onclick="dropItem(${index})" style="color: #ff3333; cursor: pointer; margin-left: 10px; border: 1px solid #ff3333; padding: 0 5px;">[DROP]</span>`;
        }

        li.innerHTML = `> ${item} ${actionBtn}`;
        list.appendChild(li);
    });

    if (inventory.length === 0) {
        list.innerHTML = '<li style="opacity: 0.5; color: white;">(Empty)</li>';
    }
}

// item actions (use/drop/grab)
window.useItem = function(index, itemName) {
    let used = false;

    if (itemName.includes("Antibiotics")) {
        infection -= 30;
        if (infection < 0) infection = 0;
        addLog("ANTIBIOTICS ADMINISTERED.", "#00ff41");
        used = true;
    } 
    else if (itemName.includes("Ration") || itemName.includes("Water")) {
        health += 20;
        if (health > 100) health = 100;
        addLog("RATIONS CONSUMED.", "#00ff41");
        used = true;
    }

    if (used) {
        updateBioMonitor();
        inventory.splice(index, 1);
        renderInventory();
    }
};

window.dropItem = function(index) {
    addLog(`DROPPED: ${inventory[index]}`, "grey");
    inventory.splice(index, 1);
    renderInventory();
};

window.collectItem = function(itemName) {
    if (inventory.length >= 5) {
        addLog("BACKPACK FULL! Drop something first.", "red");
        return;
    }

    inventory.push(itemName);
    sfx.loot();

    if (Math.random() > 0.5) {
        const foundAmmo = Math.floor(Math.random() * 3) + 1;
        ammo += foundAmmo;
        updateAmmoUI();
        addLog(`FOUND ${foundAmmo} ROUNDS OF AMMO.`, "#00ff41");
        addLog(`CURRENT AMMO: [ ${ammo} ]`, "yellow");
    }
    renderInventory();
    addLog(`COLLECTED: ${itemName}`, "#00ff41");

    if (activeMarker) {
        activeMarker.remove();
        activeMarker = null;
    }
};

// loot spawner
function scanForLoot() {
    const center = map.getCenter();
    
    addLog("SCANNING FOR SUPPLIES...", "cyan");

    fetch('/api/loot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lat: center.lat, lng: center.lng })
    })
    .then(response => response.json())
    .then(caches => {
        caches.forEach(cache => {
            const el = document.createElement('div');
            el.className = 'marker';
            el.style.backgroundColor = '#00ff41';
            el.style.width = '25px';
            el.style.height = '25px';
            el.style.borderRadius = '50%';
            el.style.boxShadow = '0 0 15px #00ff41';
            el.style.cursor = 'pointer';

            const marker = new mapboxgl.Marker(el)
                .setLngLat([cache.lng, cache.lat])
                .addTo(map);

            const popupHTML = `
                <div style="color: #00ff41; font-family: 'VT323', monospace; text-align: center;">
                    <strong style="font-size: 1.2rem; text-transform: uppercase;">SUPPLY CACHE</strong>
                    <hr style="border-color: #00ff41; opacity: 0.5;">
                    <p style="margin: 10px 0; color: white; font-size: 1rem;">Contains: <br><b>${cache.item}</b></p>
                    <button onclick="window.collectItem('${cache.item}')" 
                        style="background: #00ff41; color: black; border: none; padding: 5px 15px; font-weight: bold; cursor: pointer; font-family: 'VT323'; font-size: 1rem; width: 100%;">
                        GRAB ITEM
                    </button>
                </div>
            `;
            
            const popup = new mapboxgl.Popup({ offset: 25, closeButton: false }).setHTML(popupHTML);
            
            el.addEventListener('click', () => {
                activeMarker = marker;
                marker.togglePopup();
            });

            marker.setPopup(popup);
        });
        addLog("SCAN COMPLETE: CACHES DETECTED.", "#00ff41");
    });
}

function forceUplink() {
    console.log("FORCE UPLINK INITIATED.");
    const loader = document.getElementById('gps-loader');
    if (loader) loader.style.display = 'none';
    if (currentUserPos.lat !== 0) {
        map.flyTo({ center: [currentUserPos.lng, currentUserPos.lat], zoom: 15, speed: 3 });
        hasZoomed = true;
        addLog("UPLINK FORCED. SIGNAL UNSTABLE.", "red");
    } else {
        alert("NO GPS SIGNAL RECEIVED YET. CANNOT FORCE.");
    }
}

function spawnZombies() {
    if (currentUserPos === 0) return;

    zombieMarkers.forEach(m => m.remove());
    zombieMarkers = [];

    for (let i=0; i<5; i++) {
        const latOffset = (Math.random() - 0.5) * 0.006;
        const lngOffset = (Math.random() - 0.5) * 0.006;

        const zLat = currentUserPos.lat + latOffset;
        const zLng = currentUserPos.lng + lngOffset;

        const el = document.createElement('div');
        el.innerHTML = '🧟';
        el.style.fontSize = '30px';
        el.style.textShadow = '0 0 10px red';
        el.style.cursor = 'crosshair';

        const marker = new mapboxgl.Marker(el)
            .setLngLat([zLng,zLat])
            .addTo(map);

        el.addEventListener('click', (e) => {
            e.stopPropagation();

            if (ammo <= 0) {
                addLog("CLICK... CLICK... NO AMMO!", "red");
                return;
            }

            sfx.shoot();
            ammo--;
            updateAmmoUI()
            addLog(`AMMO REMAINING: [ ${ammo} ]`, "yellow");

            el.innerHTML = '💥';
            el.style.textShadow = '0 0 20px yellow';
            el.style.transform = 'scale(1.5)';
            addLog("TARGET ELIMINATED.", "#00ff41");
            infection -= 5;
            if (infection < 0) infection = 0;
            updateBioMonitor();

            setTimeout(() => {
                marker.remove();
            },500);
        });

        zombieMarkers.push(marker);
    }
    addLog("WARNING: INFECTED ACTIVITY NEARBY.", "red");
}
setInterval(spawnZombies,11000);

function updateAmmoUI() {
    const el = document.getElementById('ammo-val');
    if (el) {
        el.innerText = ammo;
        if (ammo === 0) el.style.color = "red";
        else el.style.color = "white";
    }
}

const audioCtx = new (window.AudioContext || window.webkitAudioContext)();

const sfx = {
    shoot: () => {
        const bufferSize = audioCtx.sampleRate * 0.2;
        const buffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
            data[i] = Math.random() * 2 - 1;
        }

        const noise = audioCtx.createBufferSource();
        noise.buffer = buffer;

        const filter = audioCtx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.value = 1000;

        const gainNode = audioCtx.createGain();
        gainNode.gain.setValueAtTime(1, audioCtx.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.15);

        noise.connect(filter);
        filter.connect(gainNode);
        gainNode.connect(audioCtx.destination);
        noise.start();
    },

    empty: () => {
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.type = 'square';
        osc.frequency.setValueAtTime(800, audioCtx.currentTime);
        gain.gain.setValueAtTime(0.1, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.05);

        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.start();
        osc.stop(audioCtx.currentTime + 0.05);
    },

    loot: () => {
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(400, audioCtx.currentTime);
        osc.frequency.linearRampToValueAtTime(800, audioCtx.currentTime + 0.1);
        gain.gain.setValueAtTime(0.2, audioCtx.currentTime);
        gain.gain.linearRampToValueAtTime(0, audioCtx.currentTime + 0.3);

        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.start();
        osc.stop(audioCtx.currentTime + 0.3);
    },

    alarm: () => {
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(150, audioCtx.currentTime);
        osc.frequency.linearRampToValueAtTime(100, audioCtx.currentTime + 0.2);
        gain.gain.setValueAtTime(0.2, audioCtx.currentTime);
        gain.gain.linearRampToValueAtTime(0, audioCtx.currentTime + 0.5);

        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.start();
        osc.stop(audioCtx.currentTime + 0.5)
    }
};

document.body.addEventListener('click', () => {
    if (audioCtx.state === 'suspended') {
        audioCtx.resume();
        console.log("AUDIO SYSTEM UNLOCKED");
    }
}, {once: true});