// --- GLOBAL VARIABLES ---
let currentUserPos = { lat: 0, lng: 0 };
let distressMarkers = [];
let hasZoomed = false;
let inventory = [];
let activeMarker = null; // Track the open marker to delete it later
let health = 100;
let infection = 0;
let gameActive = true;

mapboxgl.accessToken = MAPBOX_TOKEN;

// --- 1. THE TERMINAL LOGGING SYSTEM (With Auto-Scroll) ---
// --- 1. THE TERMINAL LOGGING SYSTEM (Fixed Auto-Scroll) ---
function addLog(message, color = "white") {
    const box = document.getElementById('log-container');
    if (!box) return; 

    // FORCE CSS: Ensure the box has a height so it CAN scroll
    box.style.height = "150px";       // Fixed height
    box.style.overflowY = "auto";     // Force scrollbar
    box.style.display = "flex";       // Stack items
    box.style.flexDirection = "column";

    const time = new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
    
    const entry = document.createElement('div');
    entry.style.marginBottom = "5px";
    entry.style.flexShrink = "0";     // Prevent shrinking
    entry.style.color = color;
    
    if (color === 'red' || color === '#ff3333') {
        entry.style.textShadow = "0 0 5px red";
    }
    
    entry.innerHTML = `<span style="opacity:0.7; color: white;">${time}</span> > ${message}`;
    
    box.appendChild(entry);
    
    // AUTO-SCROLL FIX: Slight delay to ensure the browser renders the text first
    setTimeout(() => {
        box.scrollTop = box.scrollHeight;
    }, 50);
}

// --- 2. MAP INITIALIZATION ---
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

// --- 3. GPS TRACKER ---
if (navigator.geolocation) {
    navigator.geolocation.watchPosition(
        (position) => {
            const { latitude, longitude } = position.coords;
            
            playerMarker.setLngLat([longitude, latitude]);
            currentUserPos = { lat: latitude, lng: longitude };

            if (!hasZoomed) {
                console.log("GPS LOCKED. Zooming in...");
                map.flyTo({ center: [longitude, latitude], zoom: 15, speed: 2 });
                hasZoomed = true;
                addLog(`SIGNAL LOCKED: ${latitude.toFixed(4)}, ${longitude.toFixed(4)}`, "#00ff41");
            }
        },
        (err) => {
            console.error("GPS ERROR:", err);
            addLog("GPS ERROR: ALLOW LOCATION ACCESS.", "red");
        },
        { enableHighAccuracy: true }
    );
} else {
    addLog("ERROR: GPS NOT SUPPORTED.", "red");
}

// --- 4. PANIC BUTTON ---
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
                time: new Date().toLocaleTimeString()
            })
        });
        addLog("SIGNAL SENT.", "#00ff41");
    } catch (e) {
        addLog("BROADCAST FAILED.", "red");
    }
}

// --- 5. AI SCANNER ---
async function scanArea() {
    addLog("ANALYZING ENVIRONMENT...", "cyan");
    try {
        const res = await fetch("/api/scan", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(currentUserPos)
        });
        const data = await res.json();
        addLog(data.message, "#ffcc00"); // AI Message in yellow
    } catch { 
        addLog("SCAN FAILED.", "red"); 
    }
}

// --- 6. CHECK FOR DISTRESS SIGNALS (Loop) ---
setInterval(async () => {
    try {
        const res = await fetch("/api/distress");
        const signals = await res.json();
        
        // Remove old markers to prevent duplicates
        distressMarkers.forEach(m => m.remove());
        distressMarkers = [];

        signals.forEach(sig => {
            const div = document.createElement('div');
            div.style.width = '25px';
            div.style.height = '25px';
            div.style.backgroundColor = '#ffcc00';
            div.style.borderRadius = '50%';
            div.style.border = '2px solid white';
            div.style.boxShadow = '0 0 20px #ffcc00';
            div.style.cursor = 'pointer';
            
            const m = new mapboxgl.Marker(div)
                .setLngLat([sig.lng, sig.lat])
                .setPopup(new mapboxgl.Popup({offset: 25}).setText(`${sig.time}`))
                .addTo(map);
            
            distressMarkers.push(m);
        });
    } catch (e) {}
}, 3000);

// --- 7. SURVIVAL STATS LOOP ---
setInterval(() => {
    if (!gameActive) return;

    infection += 1;
    health -= 0.5;

    if (infection > 100) infection = 100;
    if (health < 0) health = 0;

    updateBioMonitor();
    checkGameOver();
}, 2000);

function updateBioMonitor() {
    const healthVal = document.getElementById('health-val');
    // Safety check if elements exist
    if (healthVal) {
        healthVal.innerText = Math.floor(health) + "%";
        document.getElementById('infection-val').innerText = infection + "%";
        
        // Fixed typo: 'health-bar' instead of 'heath-bar'
        const healthBar = document.getElementById('health-bar') || document.getElementById('heath-bar');
        if (healthBar) healthBar.style.width = health + "%";
        
        document.getElementById('infection-bar').style.width = infection + "%";
    }
}

function checkGameOver() {
    if (infection >= 100 || health <= 0) {
        gameActive = false;
        addLog("CRITICAL FAILURE: SYSTEM SHUTDOWN.", "red");
        
        // Small delay before the alert so they see the log
        setTimeout(() => {
            alert("YOU DID NOT SURVIVE.");
            location.reload();
        }, 1000);
    }
}

// --- 8. INVENTORY RENDERER ---
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

// --- 9. ITEM ACTIONS (USE / DROP / COLLECT) ---
window.useItem = function(index, itemName) {
    let used = false;

    if (itemName.includes("Antibiotics")) {
        infection -= 30;
        if (infection < 0) infection = 0;
        addLog("💉 ANTIBIOTICS ADMINISTERED.", "#00ff41");
        used = true;
    } 
    else if (itemName.includes("Ration") || itemName.includes("Water")) {
        health += 20;
        if (health > 100) health = 100;
        addLog("🥫 RATIONS CONSUMED.", "#00ff41");
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
    renderInventory();
    addLog(`COLLECTED: ${itemName}`, "#00ff41");

    if (activeMarker) {
        activeMarker.remove();
        activeMarker = null;
    }
};

// --- 10. LOOT SPAWNER ---
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

            // Force Styles for Popup (Fixes Black Box Issue)
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