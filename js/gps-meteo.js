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

    function hasEventGpsAccess() {
        const app = getApp();
        if (typeof app.canViewProtectedEventData === "function") {
            return app.canViewProtectedEventData();
        }
        return true;
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
        if (map && typeof L !== "undefined" && hasEventGpsAccess()) {
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
        if (!hasEventGpsAccess()) {
            if (typeof app.promptUnlockCurrentEvent === "function" && !app.promptUnlockCurrentEvent()) return;
        }
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
        if (!hasEventGpsAccess()) {
            if (typeof app.promptUnlockCurrentEvent === "function" && !app.promptUnlockCurrentEvent()) return;
        }
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
        if (!hasEventGpsAccess()) return;
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
        if (!scriptUrl) return;

        fetch(scriptUrl, {
            method: "POST",
            mode: "no-cors",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                action: "add_entry",
                event_id: evId,
                note: noteLive,
                role: me.role || "GPS Live",
                user: me
            })
        }).catch(function() {});
    }

    function aggiornaMarkerOperatoriRemoti() {
        const app = getApp();
        const cloud = getCloud();
        const map = typeof app.getMap === "function" ? app.getMap() : null;
        if (!map || typeof L === "undefined") return;

        if (!hasEventGpsAccess()) {
            Object.keys(remoteOperatorMarkers).forEach(function(existingWho) {
                map.removeLayer(remoteOperatorMarkers[existingWho]);
                delete remoteOperatorMarkers[existingWho];
            });
            const sumEl = document.getElementById("live-gps-summary");
            if (sumEl) {
                sumEl.innerHTML = "<span style='color:#b45309;'>GPS protetto: sblocca l'evento con password per vedere le posizioni.</span>";
            }
            return;
        }

        const state = typeof cloud.getCloudState === "function" ? cloud.getCloudState() : { entries: [] };
        const allEntries = Array.isArray(state.entries) ? state.entries : [];
        const targetEvId = typeof app.getCurrentEventId === "function" ? app.getCurrentEventId() : "";
        const latestByWho = {};

        allEntries.forEach(function(en) {
            const rawNote = String(en.note || "");
            if (rawNote.indexOf("GPS_LIVE|") !== 0) return;
            if (targetEvId && en.event_id && en.event_id !== targetEvId) return;
            const parts = rawNote.split("|");
            if (parts.length < 5) return;
            const who = parts[1] || en.author_name || "Operatore";
            const lat = parseFloat(parts[2]);
            const lng = parseFloat(parts[3]);
            const acc = parts[4] || "";
            const ts = parts[5] || en.created_at || "";
            if (isNaN(lat) || isNaN(lng)) return;
            latestByWho[who] = { who: who, lat: lat, lng: lng, acc: acc, ts: ts };
        });

        const activeNames = Object.keys(latestByWho);
        Object.keys(remoteOperatorMarkers).forEach(function(existingWho) {
            if (activeNames.indexOf(existingWho) === -1) {
                map.removeLayer(remoteOperatorMarkers[existingWho]);
                delete remoteOperatorMarkers[existingWho];
            }
        });

        activeNames.forEach(function(who) {
            const item = latestByWho[who];
            const popupHtml = "<b>Operatore in movimento:</b> " + escapeHtml(item.who) +
                "<br>Coord: " + item.lat.toFixed(6) + ", " + item.lng.toFixed(6) +
                "<br>Prec.: " + escapeHtml(item.acc) + " &bull; Fix: " + escapeHtml(item.ts);
            if (!remoteOperatorMarkers[who]) {
                remoteOperatorMarkers[who] = L.circleMarker([item.lat, item.lng], {
                    radius: 8,
                    color: "#ffffff",
                    weight: 2,
                    fillColor: "#7c3aed",
                    fillOpacity: 0.95
                }).addTo(map).bindTooltip(who, { direction: "top" }).bindPopup(popupHtml);
            } else {
                remoteOperatorMarkers[who].setLatLng([item.lat, item.lng]).bindPopup(popupHtml);
            }
        });

        const sumEl = document.getElementById("live-gps-summary");
        if (sumEl) {
            if (activeNames.length === 0) {
                sumEl.textContent = "Operatori in movimento: nessuno rilevato.";
            } else {
                sumEl.innerHTML = "Operatori in movimento (<b>" + activeNames.length + "</b>): " +
                    activeNames.map(function(w) { return escapeHtml(w) + " (" + escapeHtml(latestByWho[w].ts) + ")"; }).join(", ");
            }
        }
    }

    function toggleGpsLive() {
        const app = getApp();
        if (!hasEventGpsAccess()) {
            if (typeof app.promptUnlockCurrentEvent === "function" && !app.promptUnlockCurrentEvent()) return;
        }
        const cloud = getCloud();
        const btn = document.getElementById("btn-gps-live-toggle");

        if (liveGpsWatchId !== null) {
            if (navigator.geolocation && navigator.geolocation.clearWatch) {
                navigator.geolocation.clearWatch(liveGpsWatchId);
            }
            liveGpsWatchId = null;
            if (liveGpsPollTimer) {
                clearInterval(liveGpsPollTimer);
                liveGpsPollTimer = null;
            }
            if (btn) {
                btn.textContent = "Avvia GPS Live";
                btn.style.background = "#0f766e";
            }
            if (typeof app.registraLog === "function") {
                app.registraLog("Tracciamento GPS live fermato.");
            }
            return;
        }

        if (!navigator.geolocation) {
            alert("Geolocalizzazione non supportata dal browser.");
            return;
        }

        if (btn) {
            btn.textContent = "Ferma GPS Live";
            btn.style.background = "#b91c1c";
        }
        if (typeof app.registraLog === "function") {
            app.registraLog("Avviato tracciamento GPS live verso sala operativa.");
        }

        liveGpsWatchId = navigator.geolocation.watchPosition(
            function(pos) {
                aggiornaGpsMarker(pos.coords.latitude, pos.coords.longitude, pos.coords.accuracy);
                inviaPosizioneLiveCloud(pos.coords.latitude, pos.coords.longitude, pos.coords.accuracy);
            },
            function(err) {
                if (typeof app.registraLog === "function") {
                    app.registraLog("Avviso GPS live: " + (err && err.message ? err.message : "errore"));
                }
            },
            { enableHighAccuracy: true, maximumAge: 5000, timeout: 10000 }
        );

        aggiornaMarkerOperatoriRemoti();
        liveGpsPollTimer = setInterval(function() {
            const evId = typeof app.getCurrentEventId === "function" ? app.getCurrentEventId() : "";
            if (typeof cloud.syncFromCloud === "function") {
                cloud.syncFromCloud(evId, false).then(aggiornaMarkerOperatoriRemoti).catch(function() {});
            }
        }, 12000);
    }

    function applicaPosizioneCondivisaDaUrl() {
        try {
            const app = getApp();
            const map = typeof app.getMap === "function" ? app.getMap() : null;
            const params = new URLSearchParams(window.location.search || "");
            const evParam = params.get("event");
            if (evParam && typeof app.setInitialEventId === "function") {
                app.setInitialEventId(evParam);
            }
            const gpsParam = params.get("gps");
            if (!gpsParam) return;
            const parts = gpsParam.split(",");
            if (parts.length !== 2) return;
            const lat = parseFloat(parts[0]);
            const lng = parseFloat(parts[1]);
            if (isNaN(lat) || isNaN(lng)) return;
            const who = params.get("who") || "Operatore condiviso";
            const latStr = lat.toFixed(6);
            const lngStr = lng.toFixed(6);
            if (typeof app.setGpsCoords === "function") {
                app.setGpsCoords(latStr, lngStr, false);
            }

            if (map && typeof L !== "undefined" && hasEventGpsAccess()) {
                map.setView([lat, lng], 15);
                const sharedGpsMarker = L.circleMarker([lat, lng], {
                    radius: 9,
                    color: "#ffffff",
                    weight: 2,
                    fillColor: "#dc2626",
                    fillOpacity: 0.95
                }).addTo(map).bindPopup("<b>Posizione condivisa:</b> " + escapeHtml(who) + "<br>" + lat.toFixed(6) + ", " + lng.toFixed(6)).openPopup();
                if (typeof app.setSharedGpsMarker === "function") {
                    app.setSharedGpsMarker(sharedGpsMarker);
                }
            }
            const statusEl = document.getElementById("gps-status");
            if (statusEl) {
                statusEl.innerHTML = "Ricevuta GPS <b>" + escapeHtml(who) + "</b>: <b>" + latStr + ", " + lngStr + "</b>";
            }
            if (typeof app.registraLog === "function") {
                app.registraLog("Caricata posizione condivisa da " + who + " (" + latStr + ", " + lngStr + ")");
            }
        } catch (e) {}
    }

    function aggiornaMeteoVento() {
        const app = getApp();
        const map = typeof app.getMap === "function" ? app.getMap() : null;
        let lat = app.getCurrentLat();
        let lng = app.getCurrentLng();

        if (map) {
            const c = map.getCenter();
            lat = c.lat.toFixed(5);
            lng = c.lng.toFixed(5);
            if (typeof app.setGpsCoords === "function") {
                app.setGpsCoords(lat, lng, app.getHasGpsFix());
            }
        }

        const url = "https://api.open-meteo.com/v1/forecast?latitude=" + lat +
            "&longitude=" + lng +
            "&current=temperature_2m,precipitation,wind_speed_10m,wind_direction_10m,wind_gusts_10m" +
            "&hourly=temperature_2m,precipitation,wind_speed_10m,wind_direction_10m" +
            "&daily=temperature_2m_max,temperature_2m_min,precipitation_sum,wind_speed_10m_max,sunrise,sunset" +
            "&timezone=auto&forecast_days=3";

        const infoEl = document.getElementById("meteo-info");
        const curCol = document.getElementById("meteo-current-col");
        const futCol = document.getElementById("meteo-future-col");
        if (infoEl) infoEl.textContent = "Lettura meteo, effemeridi e previsioni in corso...";

        fetch(url)
            .then(function(r) {
                if (!r.ok) throw new Error("HTTP " + r.status);
                return r.json();
            })
            .then(function(d) {
                const cur = d.current || {};
                const s = (cur.wind_speed_10m !== undefined) ? cur.wind_speed_10m : "--";
                const g = (cur.wind_gusts_10m !== undefined) ? cur.wind_gusts_10m : "--";
                const dir = (cur.wind_direction_10m !== undefined) ? cur.wind_direction_10m : "--";
                const temp = (cur.temperature_2m !== undefined) ? cur.temperature_2m : "--";
                const prec = (cur.precipitation !== undefined) ? cur.precipitation : "--";

                const daily = d.daily || {};
                const sunriseRaw = (daily.sunrise && daily.sunrise[0]) ? String(daily.sunrise[0]) : "";
                const sunsetRaw = (daily.sunset && daily.sunset[0]) ? String(daily.sunset[0]) : "";
                const sunriseHm = sunriseRaw.indexOf("T") !== -1 ? sunriseRaw.split("T")[1].slice(0, 5) : (sunriseRaw || "--:--");
                const sunsetHm = sunsetRaw.indexOf("T") !== -1 ? sunsetRaw.split("T")[1].slice(0, 5) : (sunsetRaw || "--:--");

                if (infoEl) {
                    infoEl.innerHTML = "Coord: <b>" + lat + ", " + lng + "</b> (" + new Date().toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" }) + ") &bull; Alba <b>" + escapeHtml(sunriseHm) + "</b> / Tramonto <b>" + escapeHtml(sunsetHm) + "</b>";
                }

                if (curCol) {
                    curCol.innerHTML =
                        '<div class="mw-row"><span>Vento:</span><b>' + s + ' km/h</b></div>' +
                        '<div class="mw-row"><span>Raffiche:</span><b>' + g + ' km/h</b></div>' +
                        '<div class="mw-row"><span>Direzione:</span><b>' + dir + '&deg;</b></div>' +
                        '<div class="mw-row"><span>Temperatura:</span><b>' + temp + ' &deg;C</b></div>' +
                        '<div class="mw-row"><span>Precipitaz.:</span><b>' + prec + ' mm</b></div>' +
                        '<div class="mw-row"><span>Effemeridi:</span><b>' + escapeHtml(sunriseHm) + ' / ' + escapeHtml(sunsetHm) + '</b></div>';
                }

                let futureHtml = '<div style="font-weight:bold; color:#93c5fd; margin-bottom:2px;">Prossime ore:</div>';
                const hTimes = (d.hourly && d.hourly.time) ? d.hourly.time : [];
                const nowIso = cur.time || "";
                let startIdx = 0;
                if (nowIso && hTimes.length) {
                    const foundIdx = hTimes.findIndex(function(t) { return t >= nowIso; });
                    if (foundIdx >= 0) startIdx = foundIdx;
                }
                const step = 3;
                let shownHours = 0;
                for (let i = startIdx; i < hTimes.length && shownHours < 4; i += step) {
                    const hh = String(hTimes[i]).slice(11, 16);
                    const ht = (d.hourly.temperature_2m && d.hourly.temperature_2m[i] !== undefined) ? d.hourly.temperature_2m[i] : "--";
                    const hp = (d.hourly.precipitation && d.hourly.precipitation[i] !== undefined) ? d.hourly.precipitation[i] : "--";
                    const hw = (d.hourly.wind_speed_10m && d.hourly.wind_speed_10m[i] !== undefined) ? d.hourly.wind_speed_10m[i] : "--";
                    futureHtml += '<div class="mw-fc-item"><b>' + escapeHtml(hh) + '</b>: ' + ht + '&deg;C | ' + hw + ' km/h | ' + hp + ' mm</div>';
                    shownHours++;
                }

                const dTimes = (daily.time) ? daily.time : [];
                if (dTimes.length > 0) {
                    futureHtml += '<div style="font-weight:bold; color:#93c5fd; margin-top:4px; margin-bottom:2px;">Prossimi giorni:</div>';
                    for (let j = 0; j < Math.min(3, dTimes.length); j++) {
                        const dayLbl = String(dTimes[j]).slice(5);
                        const tMax = (daily.temperature_2m_max && daily.temperature_2m_max[j] !== undefined) ? daily.temperature_2m_max[j] : "--";
                        const tMin = (daily.temperature_2m_min && daily.temperature_2m_min[j] !== undefined) ? daily.temperature_2m_min[j] : "--";
                        const pSum = (daily.precipitation_sum && daily.precipitation_sum[j] !== undefined) ? daily.precipitation_sum[j] : "--";
                        const wMax = (daily.wind_speed_10m_max && daily.wind_speed_10m_max[j] !== undefined) ? daily.wind_speed_10m_max[j] : "--";
                        futureHtml += '<div class="mw-fc-item"><b>' + escapeHtml(dayLbl) + '</b>: ' + tMin + '&deg;/&nbsp;' + tMax + '&deg;C &bull; ' + pSum + ' mm &bull; max ' + wMax + ' km/h</div>';
                    }
                }

                if (futCol) futCol.innerHTML = futureHtml;
                if (typeof app.registraLog === "function") {
                    app.registraLog("Meteo (" + lat + ", " + lng + "): " + temp + " C, alba " + sunriseHm + ", tramonto " + sunsetHm);
                }
            })
            .catch(function() {
                if (infoEl) infoEl.textContent = "Errore lettura meteo.";
            });
    }

    window.SITAC_GPS_METEO = {
        aggiornaGpsMarker: aggiornaGpsMarker,
        richiediGps: richiediGps,
        condividiPosizioneGps: condividiPosizioneGps,
        copiaLinkInvitoEvento: copiaLinkInvitoEvento,
        inviaPosizioneLiveCloud: inviaPosizioneLiveCloud,
        aggiornaMarkerOperatoriRemoti: aggiornaMarkerOperatoriRemoti,
        toggleGpsLive: toggleGpsLive,
        applicaPosizioneCondivisaDaUrl: applicaPosizioneCondivisaDaUrl,
        aggiornaMeteoVento: aggiornaMeteoVento
    };
})();