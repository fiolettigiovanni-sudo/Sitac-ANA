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
            const res = await fetch(SCRIPT_URL + "?t=" + Date.now