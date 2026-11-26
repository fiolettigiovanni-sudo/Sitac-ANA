(function() {
    let liveGpsWatchId = null;
    let liveGpsPollTimer = null;
    let lastLivePushAt = 0;
    const remoteOperatorMarkers = {};

    function getApp() {
        return window.SITAC_APP || {};
    }

    function getCloud() {
        return window.SITAC_CLOUD || {};
    }

    function escapeHtml(str) {
        if (typeof getApp().escapeHtml === "function") {
            return getApp().escapeHtml(str);
        }
        return String(str || "")
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;");
    }

    function getBaseAppUrl() {
        if (window.location.href && window.location.href.indexOf("http") === 0) {
            return window.location.href.split("?")[0].split("#")[0];
        }
        return "./mappa.html";
    }

    function aggiornaGpsMarker(lat, lng, acc) {
        const app = getApp();
        const latStr = Number(lat).toFixed(6);
        const lngStr = Number(lng).toFixed(6);
        if (typeof app.setGpsCoords === "function") {
            app.setGpsCoords(latStr, lngStr, true);
        }

        const accTxt = acc ? " (+/- " + Math.round(acc) + " m)" : "";
        const statusEl = document.getElementById("gps-status");
        if (statusEl) {
            statusEl.innerHTML = "Posizione GPS: <b>" + latStr + ", " + lngStr + "</b>" + accTxt;
        }

        const map = typeof app.getMap === "function" ? app.getMap() : null;
        if (map && typeof L !== "undefined") {
            let gpsMarker = typeof app.getGpsMarker === "function" ? app.getGpsMarker() : null;
            if (!gpsMarker) {
                gpsMarker = L.circleMarker([parseFloat(latStr), parseFloat(lngStr)], {
                    radius: 8,
                    color: "#ffffff",
                    weight: 2,
                    fillColor: "#16a34a",
                    fillOpacity: 0.95
                }).addTo(map).bindTooltip("La mia posizione GPS", { direction: "top" });
                if (typeof app.setGpsMarker === "function") {
                    app.setGpsMarker(gpsMarker);
                }
            } else {
                gpsMarker.setLatLng([parseFloat(latStr), parseFloat(lngStr)]);
            }
        }
    }

    function richiediGps() {
        const app = getApp();
        const map = typeof app.getMap === "function" ? app.getMap() : null;
        const statusEl = document.getElementById("gps-status");
        if (statusEl) statusEl.textContent = "Rilevamento GPS in corso...";

        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(
                function(pos) {
                    aggiornaGpsMarker(pos.coords.latitude, pos.coords.longitude, pos.coords.accuracy);
                    if (map) map.setView([pos.coords.latitude, pos.coords.longitude], 15);
                    if (typeof app.registraLog === "function") {
                        app.registraLog("GPS aggiornato: " + app.getCurrentLat() + ", " + app.getCurrentLng());
                    }
                },
                function() {
                    if (map) {
                        const c = map.getCenter();
                        aggiornaGpsMarker(c.lat, c.lng, null);
                        if (statusEl) statusEl.innerHTML += " <i>(da centro mappa)</i>";
                    }
                },
                { enableHighAccuracy: true, timeout: 8000 }
            );
        } else if (map) {
            const c = map.getCenter();
            aggiornaGpsMarker(c.lat, c.lng, null);
        }
    }

    function condividiPosizioneGps() {
        const app = getApp();
        const map = typeof app.getMap === "function" ? app.getMap() : null;
        if (!app.getHasGpsFix() && map) {
            const c = map.getCenter();
            aggiornaGpsMarker(c.lat, c.lng, null);
        }
        const lat = app.getCurrentLat();
        const lng = app.getCurrentLng();
        const who = (app.getCurrentOperator() || document.getElementById("op-name-input").value.trim() || "Operatore").trim();
        const baseHref = (window.location.href && window.location.href.indexOf("http") === 0)
            ? window.location.href.split("?")[0].split("#")[0]
            : "https://example.org/mappa.html";
        const shareUrl = baseHref + "?gps=" + lat + "," + lng + "&who=" + encodeURIComponent(who);
        const mapsUrl = "https://www.google.com/maps?q=" + lat + "," + lng;

        const box = document.getElementById("gps-link-box");
        if (box) {
            box.style.display = "block";
            box.innerHTML =
                "<b>Link posizione (" + escapeHtml(who) + "):</b><br>" +
                escapeHtml(shareUrl) +
                '<br><a href="' + mapsUrl + '" target="_blank" rel="noopener">Apri su Google Maps</a>';
        }

        if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(shareUrl).catch(function() {});
        }
        if (typeof app.registraLog === "function") {
            app.registraLog("Condivisa posizione GPS (" + lat + ", " + lng + ") di " + who);
        }
    }

    function copiaLinkInvitoEvento() {
        const app = getApp();
        const evId = (typeof app.getCurrentEventId === "function" ? app.getCurrentEventId() : "") ||
            document.getElementById("event-select").value || "";
        const url = evId ? (getBaseAppUrl() + "?event=" + encodeURIComponent(evId)) : getBaseAppUrl();
        const box = document.getElementById("gps-link-box");
        if (box) {
            box.style.display = "block";
            box.innerHTML = "<b>Link invito evento" + (evId ? " (" + escapeHtml(evId) + ")" : "") + ":</b><br>" + escapeHtml(url);
        }
        if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(url).catch(function() {});
        }
        if (typeof app.registraLog === "function") {
            app.registraLog("Copiato link invito evento" + (evId ? " " + evId : ""));
        }
    }

    function inviaPosizioneLiveCloud(lat, lng, acc) {
        const now = Date.now();
        if (now - lastLivePushAt < 8000) return;
        lastLivePushAt = now;
        const app = getApp();
        const cloud = getCloud();
        const evId = (typeof app.getCurrentEventId === "function" ? app.getCurrentEventId() : "") || "LIVE_TRACK";
        const me = typeof cloud.getCurrentUserPayload === "function"
            ? cloud.getCurrentUserPayload()
            : { name: "Operatore", role: "GPS Live" };
        const label = (me.name || "Operatore") + (me.role ? " (" + me.role + ")" : "");
        const ora = new Date().toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
        const accTxt = acc ? Math.round(acc) + "m" : "n/d";
        const noteLive = "GPS_LIVE|" + label + "|" + Number(lat).toFixed(6) + "|" + Number(lng).toFixed(6) + "|" + accTxt + "|" + ora;
        const scriptUrl = cloud.SCRIPT_URL;
        if (!scriptUrl) return