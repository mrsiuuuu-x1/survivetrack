let currentUserPos = { lat: 0, lng: 0 };
let distressMarkers = [];
let hasZoomed = false;

mapboxgl.accessToken = MAPBOX_TOKEN;

const map = new mapboxgl.Map({
    container: 'map',
    style: MAPBOX_STYLE,
    center: [0, 0], 
    zoom: 1, 
    attributionControl: false
});

// player marker
const el = document.createElement('div');
el.className = 'survivor-marker';
const playerMarker = new mapboxgl.Marker(el).setLngLat([0, 0]).addTo(map);

// logging system
function addLog(message, type = "info") {
    const logFeed = document.getElementById('log-feed');
    const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const entry = document.createElement('div');
    entry.className = 'log-entry';
    if (type === "danger") { entry.style.color = "red"; entry.style.textShadow = "0 0 5px red"; }
    if (type === "alert") { entry.style.color = "#ffcc00"; entry.style.textShadow = "0 0 5px #ffcc00"; }
    entry.innerHTML = `<span class="time">${time}</span> > ${message}`;
    logFeed.appendChild(entry);
    logFeed.scrollTop = logFeed.scrollHeight;
}

// gps tracker
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
                addLog(`SIGNAL LOCKED: ${latitude.toFixed(4)}, ${longitude.toFixed(4)}`);
            }
        },
        (err) => {
            console.error("GPS ERROR:", err);
            addLog("GPS ERROR: ALLOW LOCATION ACCESS.", "danger");
        },
        { enableHighAccuracy: true }
    );
} else {
    addLog("ERROR: GPS NOT SUPPORTED.", "danger");
}

// panic btn
async function panicMode() {
    if (currentUserPos.lat === 0 && currentUserPos.lng === 0) {
        alert("WAITING FOR GPS... (Check if Location is Allowed)");
        return;
    }
    if (!confirm("BROADCAST LOCATION TO ALL SURVIVORS?")) return;

    addLog("BROADCASTING...", "alert");
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
        addLog("SIGNAL SENT.", "alert");
    } catch (e) {
        addLog("BROADCAST FAILED.", "danger");
    }
}

// scanner
async function scanArea() {
    addLog("SCANNING...", "info");
    try {
        const res = await fetch("/api/scan", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(currentUserPos)
        });
        const data = await res.json();
        addLog(data.message, "danger");
    } catch { addLog("SCAN FAILED.", "danger"); }
}

// chekc for signals
setInterval(async () => {
    try {
        const res = await fetch("/api/distress");
        const signals = await res.json();
        
        // Remove old markers
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