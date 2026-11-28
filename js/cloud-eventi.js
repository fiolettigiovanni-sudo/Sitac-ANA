(function() {
    const SCRIPT_URL = "https://script.google.com/macros/s/AKfycbylNmfLJC_B72_y1CAUcpQUIfX60RLNNX7CS2FiSuh1yCchYxKRyVPXZqGvatqmUg4Piw/exec";
    const STORAGE_KEY = "sitac_mappe_operative_events_v1";
    const FOLDERS_KEY = "sitac_mappe_operative_folders_v1";
    const DEFAULT_FOLDERS = ["prove", "Corteno Golgi", "Niardo"];
    const memoryStorage = {};

    let cloudState = { events: [], entries: [], history: [], folders: DEFAULT_FOLDERS.slice() };

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

    function readFoldersList() {
        const set = new Set(DEFAULT_FOLDERS);
        try {
            if (window.localStorage) {
                const raw = window.localStorage.getItem(FOLDERS_KEY);
                if (raw) {
                    const arr = JSON.parse(raw);
                    if (Array.isArray(arr)) arr.forEach(function(f) { if (f) set.add(String(f).trim()); });
                }
            }
        } catch (e) {}
        if (Array.isArray(cloudState.folders)) {
            cloudState.folders.forEach(function(f) { if (f) set.add(String(f).trim()); });
        }
        safeReadStorage().forEach(function(ev) {
            if (ev && ev.folder) set.add(String(ev.folder).trim());
        });
        return Array.from(set).filter(Boolean);
    }

    function writeFoldersList(list) {
        const clean = Array.from(new Set(["prove", "Corteno Golgi", "Niardo"].concat(list || []).map(function(x) { return String(x || "").trim(); }).filter(Boolean)));
        cloudState.folders = clean;
        memoryStorage[FOLDERS_KEY] = JSON.stringify(clean);
        try {
            if (window.localStorage) window.localStorage.setItem(FOLDERS_KEY, JSON.stringify(clean));
        } catch (e) {}
        return clean;
    }

    function refreshFolderDropdowns(selectedFolder) {
        const folders = readFoldersList();
        const filterSel = document.getElementById("event-folder-filter");
        const assignSel = document.getElementById("event-folder-select");
        const curFilter = filterSel ? filterSel.value : "ALL";

        if (filterSel) {
            filterSel.innerHTML = '<option value="ALL">Tutte le cartelle (' + folders.length + ')</option>';
            folders.forEach(function(f) {
                const opt = document.createElement("option");
                opt.value = f;
                opt.textContent = f;
                if (curFilter === f) opt.selected = true;
                filterSel.appendChild(opt);
            });
        }

        if (assignSel) {
            const targetVal = selectedFolder || assignSel.value || "";
            assignSel.innerHTML = '<option value="">-- Seleziona cartella --</option>';
            folders.forEach(function(f) {
                const opt = document.createElement("option");
                opt.value = f;
                opt.textContent = f;
                if (targetVal === f) opt.selected = true;
                assignSel.appendChild(opt);
            });
        }
    }

    async function handleCreateFolder() {
        const app = getApp();
        if (!app.getOperatorModeActive() && !app.sbloccaModifica()) return;
        const inp = document.getElementById("new-folder-input");
        const rawName = inp ? inp.value.trim() : prompt("Nome nuova cartella:");
        const folderName = String(rawName || "").trim();
        if (!folderName) return alert("Inserire un nome per la cartella.");

        const updated = writeFoldersList(readFoldersList().concat([folderName]));
        refreshFolderDropdowns(folderName);
        if (inp) inp.value = "";

        await postToCloud({
            action: "create_folder",
            folder_name: folderName
        });
        if (typeof app.registraLog === "function") {
            app.registraLog("Creata cartella eventi: " + folderName + " (totale " + updated.length + ")");
        }
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
        const rawTest = row.is_test;
        const isTest = (typeof rawTest === "boolean")
            ? rawTest
            : (String(rawTest).toLowerCase() === "true" || Boolean(snap.isTest));
        const folder = String(row.folder || snap.folder || (isTest ? "prove" : "Corteno Golgi")).trim() || "prove";

        return {
            id: row.event_id,
            title: row.title || snap.title || row.event_id,
            editPassword: snap.editPassword || "",
            isTest: isTest,
            folder: folder,
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
                history: Array.isArray(data.history) ? data.history : [],
                folders: Array.isArray(data.folders) ? data.folders : DEFAULT_FOLDERS.slice()
            };
            writeFoldersList(cloudState.folders);

            const mappedEvents = cloudState.events
                .filter(function(ev) { return String(ev.status || "") !== "Eliminato"; })
                .map(cloudRowToMapEvent)
                .reverse();

            safeWriteStorage(mappedEvents);
            refreshFolderDropdowns();
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
                const firstSafe = mappedEvents.find(function(e) { return e.isTest; });
                if (firstSafe && typeof app.loadEventIntoMap === "function") {
                    app.loadEventIntoMap(firstSafe);
                }
            }
        } catch (err) {
            if (statusEl) {
                statusEl.innerHTML = "<span style='color:#b91c1c;'>Offline / cache locale (" + escapeHtml(err.message) + ")</span>";
            }
            const localCached = safeReadStorage();
            refreshFolderDropdowns();
            refreshEventDropdown(currentEvId);
            if (autoLoadFirst && localCached.length > 0 && !currentEvId) {
                const firstSafe = localCached.find(function(e) { return e.isTest; });
                if (firstSafe && typeof app.loadEventIntoMap === "function") {
                    app.loadEventIntoMap(firstSafe);
                }
            }
        }
    }

    function renderCloudCollaboration(eventId) {
        const app = getApp();
        const isEditable = typeof app.getIsEditable === "function" ? app.getIsEditable() : false;
        const canView = typeof app.canViewProtectedEventData === "function" ? app.canViewProtectedEventData() : true;
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
        if (!canView) {
            box.style.display = "none";
            if (emptyEl) {
                emptyEl.style.display = "block";
                emptyEl.innerHTML = "<span style='color:#b45309;font-weight:bold;'>Evento reale protetto: sblocca con password per vedere gli interventi.</span>";
            }
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
        const filterEl = document.getElementById("event-folder-filter");
        const activeFolder = filterEl ? filterEl.value : "ALL";
        const events = safeReadStorage().filter(function(ev) {
            if (!activeFolder || activeFolder === "ALL") return true;
            return (ev.folder || (ev.isTest ? "prove" : "Corteno Golgi")) === activeFolder;
        });

        sel.innerHTML = '<option value="">-- Seleziona un evento online (' + events.length + ') --</option>';
        const grouped = {};
        events.forEach(function(ev) {
            const f = ev.folder || (ev.isTest ? "prove" : "Corteno Golgi");
            if (!grouped[f]) grouped[f] = [];
            grouped[f].push(ev);
        });

        readFoldersList().forEach(function(f) {
            if (!grouped[f] || grouped[f].length === 0) return;
            const og = document.createElement("optgroup");
            og.label = "Cartella: " + f;
            grouped[f].forEach(function(ev) {
                const opt = document.createElement("option");
                opt.value = ev.id;
                const kindTag = ev.isTest ? "[TEST/PROVA] " : "[REALE] ";
                opt.textContent = kindTag + ev.title + (ev.operator ? " - " + ev.operator : "");
                if (selectedId && ev.id === selectedId) opt.selected = true;
                og.appendChild(opt);
            });
            sel.appendChild(og);
        });
    }

    function handleNewEvent() {
        const app = getApp();
        if (!app.getOperatorModeActive() && !app.sbloccaModifica()) return;
        const titleEl = document.getElementById("event-title-input");
        const pwdEl = document.getElementById("event-pwd-input");
        const typeEl = document.getElementById("event-type-select");
        const folderEl = document.getElementById("event-folder-select");
        const title = titleEl.value.trim() || ("Evento " + new Date().toLocaleTimeString("it-IT"));
        app.clearMapElements();
        app.setCurrentEventState("", "", true, folderEl ? folderEl.value : "");
        if (pwdEl) pwdEl.value = "";
        if (typeEl) typeEl.value = "";
        titleEl.value = title;
        app.applyEditStateToUi();
        document.getElementById("event-active-info").innerHTML = "Nuovo evento in corso: <b>" + escapeHtml(title) + "</b> (scelga tipo Reale/Test, cartella, password e premi Salva Online)";
        renderCloudCollaboration("");
        app.registraLog("Preparato nuovo evento: " + title);
    }

    function handleSaveEvent() {
        const app = getApp();
        if (!app.getOperatorModeActive() && !app.sbloccaModifica()) return;

        const typeEl = document.getElementById("event-type-select");
        const chosenType = typeEl ? typeEl.value : "";
        if (chosenType !== "TEST" && chosenType !== "REAL") {
            return alert("Scelta obbligatoria: selezioni se l'evento è TEST / PROVA oppure REALE prima di salvare.");
        }
        const isTest = (chosenType === "TEST");

        const folderEl = document.getElementById("event-folder-select");
        const chosenFolder = (folderEl && folderEl.value.trim()) ? folderEl.value.trim() : (isTest ? "prove" : "Corteno Golgi");

        const pwdEl = document.getElementById("event-pwd-input");
        const selectEl = document.getElementById("event-select");
        const currentEvId = (typeof app.getCurrentEventId === "function" ? app.getCurrentEventId() : "") ||
            (selectEl ? selectEl.value : "");
        const currentEvPwd = app.getCurrentEventPassword();
        const unlockedMap = app.getUnlockedEventIds();

        if (!isTest && !currentEvId && pwdEl && !pwdEl.value.trim()) {
            const chosen = prompt("Evento REALE: inserisca obbligatoriamente una password dedicata per questo evento:");
            if (!chosen || !chosen.trim()) {
                return alert("Per gli eventi reali è richiesta una password.");
            }
            pwdEl.value = chosen.trim();
        } else if (!currentEvId && pwdEl && !pwdEl.value.trim()) {
            const chosen = prompt("Scelga una password per proteggere le modifiche di questo evento (o lasci vuoto):");
            if (chosen === null) return;
            pwdEl.value = chosen;
        }

        if (currentEvId && typeof app.canViewProtectedEventData === "function" && !app.canViewProtectedEventData()) {
            if (!app.promptUnlockCurrentEvent()) return;
        }

        const snap = app.serializeCurrentState();
        if (currentEvId) snap.id = currentEvId;
        snap.isTest = isTest;
        snap.folder = chosenFolder;

        app.setCurrentEventState(currentEvId, snap.editPassword || "", isTest, chosenFolder);
        const summaryNote = "[" + chosenFolder + "] Simboli: " + snap.markers.length + ", Forme: " + snap.polygons.length + ", Scritte: " + snap.textLabels.length + " (" + snap.savedAt + ")";
        const packedSummary = buildCloudSummary(summaryNote, snap);
        const me = getCurrentUserPayload();

        const existingCloud = (cloudState.events || []).find(function(e) { return e.event_id === currentEvId; });
        const localCached = safeReadStorage();
        const existingLocal = localCached.find(function(e) { return e.id === currentEvId; });

        if (currentEvId && (existingCloud || existingLocal)) {
            const authorEmail = existingCloud ? existingCloud.author_email : (existingLocal ? existingLocal.authorEmail : "");
            const authorName = existingCloud ? existingCloud.author_name : (existingLocal ? existingLocal.operator : "");
            if (authorEmail && me.email && authorEmail.toLowerCase() !== me.email.toLowerCase()) {
                if (!confirm("Questo evento è stato aperto da " + (authorName || authorEmail) + ". Le sue modifiche verranno registrate nella cronologia. Continuare?")) {
                    return;
                }
            }
            postToCloud({
                action: "update_event",
                event_id: currentEvId,
                title: snap.title,
                summary: packedSummary,
                is_test: isTest,
                folder: chosenFolder,
                role: me.role
            });
            app.registraLog("Aggiornato evento online '" + snap.title + "' in cartella '" + chosenFolder + "'");
        } else {
            postToCloud({
                action: "create_event",
                title: snap.title,
                summary: packedSummary,
                is_test: isTest,
                folder: chosenFolder,
                role: me.role,
                status: "Aperto"
            });
            app.registraLog("Creato nuovo evento online '" + snap.title + "' in cartella '" + chosenFolder + "'");
        }
    }

    function handleDeleteEvent() {
        const app = getApp();
        if (!app.getOperatorModeActive() && !app.sbloccaModifica()) return;
        const currentEvId = app.getCurrentEventId();
        if (currentEvId && typeof app.canViewProtectedEventData === "function" && !app.canViewProtectedEventData()) {
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
            app.setCurrentEventState("", "", true, "");
            document.getElementById("event-title-input").value = "";
            document.getElementById("event-active-info").textContent = "Evento rimosso dall'elenco attivo.";
            renderCloudCollaboration("");
        }
        app.registraLog("Contrassegnato evento come Eliminato online.");
    }

    function handleExportJson() {
        const app = getApp();
        if (typeof app.canViewProtectedEventData === "function" && !app.canViewProtectedEventData()) {
            if (!app.promptUnlockCurrentEvent()) return;
        }
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
        DEFAULT_FOLDERS: DEFAULT_FOLDERS,
        safeReadStorage: safeReadStorage,
        safeWriteStorage: safeWriteStorage,
        readFoldersList: readFoldersList,
        refreshFolderDropdowns: refreshFolderDropdowns,
        handleCreateFolder: handleCreateFolder,
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