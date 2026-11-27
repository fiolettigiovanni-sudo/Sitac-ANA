(function() {
    const SCRIPT_URL = "https://script.google.com/macros/s/AKfycbylNmfLJC_B72_y1CAUcpQUIfX60RLNNX7CS2FiSuh1yCchYxKRyVPXZqGvatqmUg4Piw/exec";
    const STORAGE_KEY = "sitac_mappe_operative_events_v1";
    const memoryStorage = {};

    let cloudState = { events: [], entries: [], history: [] };

    function getApp() {
        return window.SITAC_APP || {};
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

    function safeReadStorage() {
        try {
            if (window.localStorage) {
                const raw = window.localStorage.getItem(STORAGE_KEY);
                if (raw) return JSON.parse(raw);
            }
        } catch (e) {}
        try {
            if (memoryStorage[STORAGE_KEY]) return JSON.parse(memoryStorage[STORAGE_KEY]);
        } catch (e) {}
        return [];
    }

    function safeWriteStorage(eventsArr) {
        const serialized = JSON.stringify(eventsArr || []);
        memoryStorage[STORAGE_KEY] = serialized;
        try {
            if (window.localStorage) {
                window.localStorage.setItem(STORAGE_KEY, serialized);
                return true;
            }
        } catch (e) {}
        return false;
    }

    function getCurrentUserPayload() {
        const app = getApp();
        return {
            name: (app.getCurrentOperator() || document.getElementById("op-name-input").value.trim() || "Consultazione").trim(),
            email: (app.getCurrentOperatorEmail() || document.getElementById("op-email-input").value.trim() || "").trim(),
            role: (app.getCurrentOperatorRole() || document.getElementById("op-role-input").value.trim() || "Operatore").trim()
        };
    }

    function parseCloudSummary(summaryStr) {
        if (!summaryStr) return { text: "", snapshot: null };
        const str = String(summaryStr);
        const marker = "||SITAC_JSON||";
        const idx = str.indexOf(marker);
        if (idx === -1) return { text: str, snapshot: null };
        const textPart = str.slice(0, idx).trim();
        const jsonPart = str.slice(idx + marker.length).trim();
        try {
            return { text: textPart, snapshot: JSON.parse(jsonPart) };
        } catch (e) {
            return { text: textPart, snapshot: null };
        }
    }

    function buildCloudSummary(textNote, snapshotObj) {
        const cleanNote = String(textNote || "").trim();
        return cleanNote + "\n||SITAC_JSON||" + JSON.stringify(snapshotObj);
    }

    function cloudRowToMapEvent(row) {
        const parsed = parseCloudSummary(row.summary);
        const snap = parsed.snapshot || {};
        return {
            id: row.event_id,
            title: row.title || snap.title || row.event_id,
            editPassword: snap.editPassword || "",
            savedAt: row.created_at || snap.savedAt || "",
            operator: row.author_name || snap.operator || "Operatore",
            authorEmail: row.author_email || "",
            role: row.role || "",
            status: row.status || "Aperto",
            summaryText: parsed.text || "",
            rawSummary: row.summary || "",
            scenario: snap.scenario || "SCENARIO_AIB",
            subscenario: snap.subscenario || "ALL",
            stato: snap.stato || "PLANNED",
            mapCenter: snap.mapCenter || { lat: 46.16, lng: 10.33, zoom: 13 },
            markers: Array.isArray(snap.markers) ? snap.markers : [],
            polygons: Array.isArray(snap.polygons) ? snap.polygons : [],
            textLabels: Array.isArray(snap.textLabels) ? snap.textLabels : [],
            logs: Array.isArray(snap.logs) ? snap.logs : []
        };
    }

    async function postToCloud(payload) {
        const app = getApp();
        const statusEl = document.getElementById("cloud-sync-status");
        if (statusEl) statusEl.textContent = "Salvataggio online in corso...";
        await fetch(SCRIPT_URL, {
            method: "POST",
            mode: "no-cors",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ ...payload, user: getCurrentUserPayload() })
        });
        setTimeout(function() {
            const currentEvId = typeof app.getCurrentEventId === "function" ? app.getCurrentEventId() : "";
            syncFromCloud(currentEvId, false);
        }, 1100);
    }

    async function syncFromCloud(preferredEventId, autoLoadFirst) {
        const app = getApp();
        const statusEl = document.getElementById("cloud-sync-status");
        if (statusEl) statusEl.textContent = "Sincronizzazione archivio online...";
        const currentEvId = typeof app.getCurrentEventId === "function" ? app.getCurrentEventId() : "";

        try {
            const res = await fetch(SCRIPT_URL + "?t=" + Date.now());
            if (!res.ok) throw new Error("HTTP " + res.status);
            const data = await res.json();
            cloudState = {
                events: Array.isArray(data.events) ? data.events : [],
                entries: Array.isArray(data.entries) ? data.entries : [],
                history: Array.isArray(data.history) ? data.history : []
            };
            const mappedEvents = cloudState.events
                .filter(function(ev) { return String(ev.status || "") !== "Eliminato"; })
                .map(cloudRowToMapEvent)
                .reverse();

            safeWriteStorage(mappedEvents);
            const targetId = preferredEventId || currentEvId;
            refreshEventDropdown(targetId);

            if (statusEl) {
                statusEl.innerHTML = "Online: <b>" + mappedEvents.length + "</b> eventi (" + new Date().toLocaleTimeString("it-IT") + ")";
            }

            if (targetId) {
                const found = mappedEvents.find(function(e) { return e.id === targetId; });
                if (found && typeof app.loadEventIntoMap === "function") {
                    app.loadEventIntoMap(found);
                    return;
                }
            }
            if (typeof app.aggiornaMarkerOperatoriRemoti === "function") {
                app.aggiornaMarkerOperatoriRemoti();
            }
            if (autoLoadFirst && mappedEvents.length > 0 && !(new URLSearchParams(window.location.search || "").get("gps"))) {
                if (typeof app.loadEventIntoMap === "function") {
                    app.loadEventIntoMap(mappedEvents[0]);
                }
            }
        } catch (err) {
            if (statusEl) {
                statusEl.innerHTML = "<span style='color:#b91c1c;'>Offline / cache locale (" + escapeHtml(err.message) + ")</span>";
            }
            const localCached = safeReadStorage();
            refreshEventDropdown(currentEvId);
            if (autoLoadFirst && localCached.length > 0 && !currentEvId) {
                if (typeof app.loadEventIntoMap === "function") {
                    app.loadEventIntoMap(localCached[0]);
                }
            }
        }
    }

    function renderCloudCollaboration(eventId) {
        const app = getApp();
        const isEditable = typeof app.getIsEditable === "function" ? app.getIsEditable() : false;
        const box = document.getElementById("cloud-collab-box");
        const emptyEl = document.getElementById("cloud-collab-empty");
        const entriesBox = document.getElementById("cloud-entries-list");
        const historyBox = document.getElementById("cloud-history-list");
        if (!box || !entriesBox || !historyBox) return;

        if (!eventId) {
            box.style.display = "none";
            if (emptyEl) emptyEl.style.display = "block";
            return;
        }
        box.style.display = "block";
        if (emptyEl) emptyEl.style.display = "none";

        const evRow = (cloudState.events || []).find(function(e) { return e.event_id === eventId; });
        const evEntries = (cloudState.entries || []).filter(function(en) {
            return en.event_id === eventId && String(en.note || "").indexOf("GPS_LIVE|") !== 0;
        });
        const evHistory = (cloudState.history || []).filter(function(h) { return h.event_id === eventId; });

        if (evEntries.length === 0) {
            entriesBox.innerHTML = "<div class='event-meta'>Nessun intervento registrato.</div>";
        } else {
            entriesBox.innerHTML = evEntries.map(function(en) {
                const safeEntryId = String(en.entry_id || "").replace(/'/g, "\\'");
                const editBtn = isEditable
                    ? ' <button type="button" class="small-btn" style="padding:1px 5px;font-size:10px;background:#475569;color:#fff;" onclick="window._sitacEditCloudEntry(\'' + safeEntryId + '\')">Modifica</button>'
                    : '';
                return '<div class="cloud-entry-card">' +
                    '<b>' + escapeHtml(en.author_name || en.author_email || "Operatore") + '</b> (' + escapeHtml(en.role || "") + '): ' +
                    escapeHtml(en.note || "") + editBtn +
                '</div>';
            }).join("");
        }

        if (evHistory.length === 0) {
            historyBox.innerHTML = "<div class='event-meta'>Nessuna modifica registrata.</div>";
        } else {
            historyBox.innerHTML = evHistory.map(function(h) {
                const origEntry = evEntries.find(function(e) { return e.entry_id === h.target_id; });
                const origAuthorEmail = h.target_type === "evento"
                    ? (evRow ? evRow.author_email : "")
                    : (origEntry ? origEntry.author_email : "");
                const isForeign = origAuthorEmail && h.editor_email && (origAuthorEmail.toLowerCase() !== h.editor_email.toLowerCase());
                const oldShort = parseCloudSummary(h.old_value).text || "(aggiornamento mappa/dati)";
                const newShort = parseCloudSummary(h.new_value).text || "(aggiornamento mappa/dati)";
                return '<div class="' + (isForeign ? 'cloud-mod-alert' : 'cloud-entry-card') + '">' +
                    (isForeign ? '<b>[MODIFICA SU CONTENUTO ALTRUI]</b> ' : '') +
                    '<b>' + escapeHtml(h.editor_name || h.editor_email || "Operatore") + '</b> su <i>' + escapeHtml(h.target_type || "") + '.' + escapeHtml(h.field || "") + '</i>: ' +
                    '"' + escapeHtml(oldShort) + '" &rarr; "<b>' + escapeHtml(newShort) + '</b>"' +
                '</div>';
            }).join("");
        }
    }

    window._sitacEditCloudEntry = function(entryId) {
        const app = getApp();
        if (!app.getIsEditable || !app.getIsEditable()) return alert("Sbloccare con password per modificare.");
        const en = (cloudState.entries || []).find(function(item) { return item.entry_id === entryId; });
        if (!en) return;
        const nextNote = prompt("Modifica testo intervento:", en.note || "");
        if (nextNote === null || nextNote.trim() === "" || nextNote.trim() === (en.note || "")) return;
        const me = getCurrentUserPayload();
        if (en.author_email && me.email && en.author_email.toLowerCase() !== me.email.toLowerCase()) {
            if (!confirm("Sta modificando un intervento scritto da " + (en.author_name || en.author_email) + ". La modifica restera visibile nello storico. Continuare?")) {
                return;
            }
        }
        postToCloud({
            action: "edit_field",
            event_id: app.getCurrentEventId(),
            target_type: "intervento",
            target_id: entryId,
            field: "note",
            new_value: nextNote.trim()
        });
        app.registraLog("Modificato intervento di " + (en.author_name || en.author_email));
    };

    function handleAddCloudEntry() {
        const app = getApp();
        if (!app.getOperatorModeActive() && !app.sbloccaModifica()) return;
        const currentEvId = app.getCurrentEventId();
        const currentEvPwd = app.getCurrentEventPassword();
        const unlockedMap = app.getUnlockedEventIds();
        if (currentEvId && currentEvPwd && !unlockedMap[currentEvId]) {
            if (!app.promptUnlockCurrentEvent()) return;
        }
        if (!currentEvId || String(currentEvId).indexOf("EVT-") !== 0) {
            return alert("Salvi prima l'evento online (Salva Online) per poter aggiungere interventi.");
        }
        const inp = document.getElementById("cloud-entry-input");
        const txt = inp ? inp.value.trim() : "";
        if (!txt) return alert("Inserire il testo dell'intervento.");
        postToCloud({
            action: "add_entry",
            event_id: currentEvId,
            note: txt,
            role: getCurrentUserPayload().role
        });
        inp.value = "";
        app.registraLog("Inviato intervento online: " + txt);
    }

    function refreshEventDropdown(selectedId) {
        const sel = document.getElementById("event-select");
        if (!sel) return;
        const events = safeReadStorage();
        sel.innerHTML = '<option value="">-- Seleziona un evento online (' + events.length + ') --</option>';
        events.forEach(function(ev) {
            const opt = document.createElement("option");
            opt.value = ev.id;
            opt.textContent = ev.title + (ev.operator ? " - " + ev.operator : "");
            if (selectedId && ev.id === selectedId) opt.selected = true;
            sel.appendChild(opt);
        });
    }

    function handleNewEvent() {
        const app = getApp();
        if (!app.getOperatorModeActive() && !app.sbloccaModifica()) return;
        const titleEl = document.getElementById("event-title-input");
        const pwdEl = document.getElementById("event-pwd-input");
        const title = titleEl.value.trim() || ("Evento " + new Date().toLocaleTimeString("it-IT"));
        app.clearMapElements();
        app.setCurrentEventState("", "");
        if (pwdEl) pwdEl.value = "";
        titleEl.value = title;
        app.applyEditStateToUi();
        document.getElementById("event-active-info").innerHTML = "Nuovo evento in corso: <b>" + escapeHtml(title) + "</b> (scelga la password evento e premi Salva Online)";
        renderCloudCollaboration("");
        app.registraLog("Preparato nuovo evento: " + title);
    }

function handleSaveEvent() {
        const app = getApp();
        if (!app.getOperatorModeActive() && !app.sbloccaModifica()) return;
        const pwdEl = document.getElementById("event-pwd-input");
        const selectEl = document.getElementById("event-select");
        const currentEvId = (typeof app.getCurrentEventId === "function" ? app.getCurrentEventId() : "") ||
            (selectEl ? selectEl.value : "");
        const currentEvPwd = app.getCurrentEventPassword();
        const unlockedMap = app.getUnlockedEventIds();

        if (!currentEvId && pwdEl && !pwdEl.value.trim()) {
            const chosen = prompt("Scelga una password per proteggere le modifiche di questo nuovo evento (o lasci vuoto per evento aperto):");
            if (chosen === null) return;
            pwdEl.value = chosen;
        }
        if (currentEvId && currentEvPwd && !unlockedMap[currentEvId]) {
            if (!app.promptUnlockCurrentEvent()) return;
        }
        const snap = app.serializeCurrentState();
        if (currentEvId) {
            snap.id = currentEvId;
        }
        app.setCurrentEventState(currentEvId, snap.editPassword || "");
        const isTest = document.getElementById("event-is-test").checked;
        const summaryNote = "Simboli: " + snap.markers.length + ", Forme: " + snap.polygons.length + ", Scritte: " + snap.textLabels.length + " (" + snap.savedAt + ")";
        const packedSummary = buildCloudSummary(summaryNote, snap);
        const me = getCurrentUserPayload();

        const existingCloud = (cloudState.events || []).find(function(e) { return e.event_id === currentEvId; });
        const localCached = safeReadStorage();
        const existingLocal = localCached.find(function(e) { return e.id === currentEvId; });

        if (currentEvId && (existingCloud || existingLocal)) {
            const authorEmail = existingCloud ? existingCloud.author_email : (existingLocal ? existingLocal.authorEmail : "");
            const authorName = existingCloud ? existingCloud.author_name : (existingLocal ? existingLocal.operator : "");
            if (authorEmail && me.email && authorEmail.toLowerCase() !== me.email.toLowerCase()) {
                if (!confirm("Questo evento e stato aperto da " + (authorName || authorEmail) + ". Le tue modifiche alla mappa verranno registrate nella cronologia. Continuare?")) {
                    return;
                }
            }
            postToCloud({
                action: "update_event",
                event_id: currentEvId,
                title: snap.title,
                summary: packedSummary,
                is_test: isTest,
                role: me.role
            });
            app.registraLog("Aggiornato evento online '" + snap.title + "'");
        } else {
            postToCloud({
                action: "create_event",
                title: snap.title,
                summary: packedSummary,
                is_test: isTest,
                role: me.role,
                status: "Aperto"
            });
            app.registraLog("Creato nuovo evento online '" + snap.title + "'");
        }
    }            postToCloud({
                action: "edit_field",
                event_id: currentEvId,
                target_type: "evento",
                target_id: currentEvId,
                field: "summary",
                new_value: packedSummary
            });
            app.registraLog("Aggiornato evento online '" + snap.title + "'");
        } else {
            postToCloud({
                action: "create_event",
                title: snap.title,
                summary: packedSummary,
                is_test: isTest,
                role: me.role,
                status: "Aperto"
            });
            app.registraLog("Creato nuovo evento online '" + snap.title + "'");
        }
    }

    function handleDeleteEvent() {
        const app = getApp();
        if (!app.getOperatorModeActive() && !app.sbloccaModifica()) return;
        const currentEvId = app.getCurrentEventId();
        const currentEvPwd = app.getCurrentEventPassword();
        const unlockedMap = app.getUnlockedEventIds();

        if (currentEvId && currentEvPwd && !unlockedMap[currentEvId]) {
            if (!app.promptUnlockCurrentEvent()) return;
        }
        const targetId = currentEvId || document.getElementById("event-select").value;
        if (!targetId) return alert("Selezionare un evento da chiudere/rimuovere.");
        if (!confirm("Contrassegnare questo evento come Eliminato nell'archivio online?")) return;
        postToCloud({
            action: "edit_field",
            event_id: targetId,
            target_type: "evento",
            target_id: targetId,
            field: "status",
            new_value: "Eliminato"
        });
        if (currentEvId === targetId) {
            app.setCurrentEventState("", "");
            document.getElementById("event-title-input").value = "";
            document.getElementById("event-active-info").textContent = "Evento rimosso dall'elenco attivo.";
            renderCloudCollaboration("");
        }
        app.registraLog("Contrassegnato evento come Eliminato online.");
    }

    function handleExportJson() {
        const app = getApp();
        const snap = app.serializeCurrentState();
        const blob = new Blob([JSON.stringify(snap, null, 2)], { type: "application/json;charset=utf-8" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        const safeName = (snap.title || "evento_sitac").toLowerCase().replace(/[^a-z0-9_-]+/g, "_");
        a.href = url;
        a.download = safeName + ".json";
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        app.registraLog("Esportato evento in JSON: " + a.download);
    }

    function handleImportJsonFile(e) {
        const app = getApp();
        const file = e.target.files && e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = function(evt) {
            try {
                const parsed = JSON.parse(evt.target.result);
                if (!parsed || !Array.isArray(parsed.markers)) {
                    return alert("File JSON non valido per SITAC.");
                }
                parsed.id = "";
                app.loadEventIntoMap(parsed);
                app.registraLog("Importato evento da file: " + (parsed.title || file.name) + " (premi Salva Online per condividerlo)");
            } catch (err) {
                alert("Errore lettura JSON: " + err.message);
            }
        };
        reader.readAsText(file);
        e.target.value = "";
    }

    function getCloudState() {
        return cloudState;
    }

    window.SITAC_CLOUD = {
        SCRIPT_URL: SCRIPT_URL,
        STORAGE_KEY: STORAGE_KEY,
        safeReadStorage: safeReadStorage,
        safeWriteStorage: safeWriteStorage,
        getCurrentUserPayload: getCurrentUserPayload,
        parseCloudSummary: parseCloudSummary,
        buildCloudSummary: buildCloudSummary,
        cloudRowToMapEvent: cloudRowToMapEvent,
        postToCloud: postToCloud,
        syncFromCloud: syncFromCloud,
        renderCloudCollaboration: renderCloudCollaboration,
        handleAddCloudEntry: handleAddCloudEntry,
        refreshEventDropdown: refreshEventDropdown,
        handleNewEvent: handleNewEvent,
        handleSaveEvent: handleSaveEvent,
        handleDeleteEvent: handleDeleteEvent,
        handleExportJson: handleExportJson,
        handleImportJsonFile: handleImportJsonFile,
        getCloudState: getCloudState
    };
})();