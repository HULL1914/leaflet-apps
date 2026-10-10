// ---------- 1. set up the map ----------

// start over Philadelphia; the map moves to your real location once it is found
const map = L.map('map', {
    center: [39.9526, -75.1652],
    zoom: 11
});

const streets = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}', {
    maxZoom: 19,
    attribution: 'Tiles &copy; Esri'
}).addTo(map);

const satellite = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
    maxZoom: 19,
    attribution: 'Tiles &copy; Esri'
});

// let the user switch between the two base maps
L.control.layers({ 'Streets': streets, 'Satellite': satellite }).addTo(map);

// ---------- 2. things we draw for the tracking ----------

const markers = L.layerGroup().addTo(map);                         // one marker per location update
const path = L.polyline([], { color: '#1f78b4', weight: 4 }).addTo(map); // line connecting the updates
let accuracy_circle = null;                                       // shows how accurate the latest fix is
let current_marker = null;                                        // the most recent location
let count = 0;                                                    // number of updates so far

// ---------- 3. start tracking ----------

let options = {
    enableHighAccuracy: true,
    maximumAge: 0,
    timeout: 45000
};

let watchid = null;

if (navigator.geolocation) {
    watchid = navigator.geolocation.watchPosition(successCallback, errorCallback, options);
} else {
    document.getElementById('log').innerHTML = 'Your browser does not natively support geolocation.';
}

// stop button uses clearWatch to end tracking
document.getElementById('stop-button').addEventListener('click', function() {
    if (watchid !== null) {
        navigator.geolocation.clearWatch(watchid);
        watchid = null;
        document.getElementById('log').innerHTML += ' <b>(tracking stopped)</b>';
        this.disabled = true;
    }
});

// ---------- 4. callbacks ----------

function successCallback(position) {
    const c = position.coords;
    const latlng = [c.latitude, c.longitude];
    count += 1;

    // popup with all the information the browser gives us
    let msg = `<strong>Location #${count}</strong><br/>
        Longitude: ${c.longitude.toFixed(7)}&deg;<br/>
        Latitude: ${c.latitude.toFixed(7)}&deg;<br/>
        Accuracy: ${c.accuracy.toFixed(2)} meters<br/>
        Time: ${new Date(position.timestamp).toLocaleString()}<br/>`;

    if (c.altitude) msg += `Altitude: ${c.altitude.toFixed(2)} meters<br/>`;
    if (c.altitudeAccuracy) msg += `Altitude Accuracy: ${c.altitudeAccuracy} meters<br/>`;
    if (c.heading) msg += `Heading: ${c.heading}&deg;<br/>`;
    if (c.speed) msg += `Speed: ${c.speed} m/s<br/>`;
    msg += `Likely source: ${guess_source(c.accuracy)}`;

    // turn the previous "current" marker into a small history dot
    if (current_marker) {
        const old = current_marker.getLatLng();
        const old_popup = current_marker.getPopup().getContent();
        markers.removeLayer(current_marker);
        L.circleMarker(old, {
            radius: 5, color: '#1f78b4', fillColor: '#ffffff', fillOpacity: 1, weight: 2
        }).bindPopup(old_popup).addTo(markers);
    }

    // add the newest location as a regular marker and open its popup
    current_marker = L.marker(latlng).bindPopup(msg).addTo(markers);
    current_marker.openPopup();

    // connect the dots
    path.addLatLng(latlng);

    // accuracy circle around the newest location
    if (accuracy_circle) map.removeLayer(accuracy_circle);
    accuracy_circle = L.circle(latlng, {
        radius: c.accuracy, color: '#1f78b4', fillOpacity: 0.1, weight: 1
    }).addTo(map);

    // zoom in close the first time we get a location, then just follow along
    if (count === 1) {
        map.setView(latlng, 17);
    } else {
        map.panTo(latlng);
    }

    document.getElementById('log').innerHTML =
        `Updates: ${count} &nbsp;|&nbsp; Accuracy: ${c.accuracy.toFixed(0)} m &nbsp;|&nbsp; Last: ${new Date(position.timestamp).toLocaleTimeString()}`;
}

function errorCallback(error) {
    const msgs = {
        [error.PERMISSION_DENIED]: 'Permission denied',
        [error.POSITION_UNAVAILABLE]: 'Position unavailable',
        [error.TIMEOUT]: 'Request timeout',
        [error.UNKNOWN_ERROR]: 'Unknown error'
    };
    document.getElementById('log').innerHTML = `Error: ${msgs[error.code]}`;
}

// rough guess at how the location was found, based on the accuracy radius
function guess_source(accuracy) {
    if (accuracy <= 15) return 'GPS';
    if (accuracy <= 500) return 'Wi-Fi / cell towers';
    return 'IP address';
}
