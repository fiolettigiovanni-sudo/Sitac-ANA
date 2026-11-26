(function() {
    let selectedMarkerUid = null;
    let wordResizeState = null;
    let wordRotateState = null;

    let activeDrawMode = null;
    let drawPoints = [];
    let drawDraftLayer = null;
    let drawColor = "#dc2626";
    let drawLabel = "Area perimetrata";

    function getApp() {
        return window.SITAC_APP || {};
    }

    function getConfig() {
        return window.SITAC_CONFIG || {};
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

    function getMap() {
        const app = getApp();
        return typeof app.getMap === "function" ? app.getMap() : null;
    }

    function isEditable() {
        const app = getApp();
        return typeof app.getIsEditable === "function" ? app.getIsEditable() : false;
    }

    function getZoomScaleFactor(entry) {
        const map = getMap();
        if (!map || !entry || typeof entry.baseZoom !== "number") return 1.0;
        return Math.pow(2, map.getZoom() - entry.baseZoom);
    }

    function applyLiveTransformToMarkerDom(entry) {
        if (!entry || !entry.marker) return;
        const el = entry.marker.getElement();
        if (!el) return;
        const shapeEl = el.querySelector(".sitac-shape");
        if (!shapeEl) return;
        const zf = getZoomScaleFactor(entry);
        const effScale = (entry.scale || 1.0) * zf;
        const sx = effScale * (entry.stretchX || 1.0);
        const sy = effScale * (entry.stretchY || 1.0);
        const rDeg = entry.rot || 0;
        shapeEl.style.transform = "rotate(" + rDeg + "deg) scale(" + sx.toFixed(4) + ", " + sy.toFixed(4) + ")";
        const capEl = el.querySelector(".sitac-caption");
        if (capEl) {
            capEl.style.transform = "scale(" + zf.toFixed(4) + ")";
            capEl.style.transformOrigin = "top center";
        }
    }

    window._sitacOpenMarkerPopup = function(uid, ev) {
        if (ev) {
            ev.stopPropagation();
            ev.preventDefault();
        }
        const app = getApp();
        const reg = typeof app.getMarkersRegistry === "function" ? app.getMarkersRegistry() : {};
        const entry = reg[uid];
        if (!entry || !entry.marker) return;
        selectedMarkerUid = uid;
        entry.marker.setPopupContent(getMarkerPopupHtml(entry));
        entry.marker.openPopup();
    };

    window._sitacSelectMarker = function(uid, ev) {
        if (ev) ev.stopPropagation();
        if (selectedMarkerUid === uid) return;
        const app = getApp();
        const reg = typeof app.getMarkersRegistry === "function" ? app.getMarkersRegistry() : {};
        const prev = selectedMarkerUid;
        selectedMarkerUid = uid;
        if (prev && reg[prev] && reg[prev].marker) {
            aggiornaIconaMarker(reg[prev]);
        }
        if (uid && reg[uid] && reg[uid].marker) {
            aggiornaIconaMarker(reg[uid]);
        }
    };

    window._sitacStartWordResize = function(ev, uid, dir) {
        if (!isEditable()) return;
        const app = getApp();
        const map = getMap();
        const reg = typeof app.getMarkersRegistry === "function" ? app.getMarkersRegistry() : {};
        const entry = reg[uid];
        if (!entry || !entry.marker) return;
        if (ev) {
            ev.preventDefault();
            ev.stopPropagation();
            if (ev.stopImmediatePropagation) ev.stopImmediatePropagation();
        }
        selectedMarkerUid = uid;
        if (map && map.dragging) map.dragging.disable();
        if (entry.marker.dragging) entry.marker.dragging.disable();
        const pt = (ev && ev.touches && ev.touches[0]) ? ev.touches[0] : ev;
        const zf = getZoomScaleFactor(entry);
        entry.stretchX = Number(((entry.stretchX || 1.0) * zf).toFixed(4));
        entry.stretchY = Number(((entry.stretchY || 1.0) * zf).toFixed(4));
        if (map) entry.baseZoom = map.getZoom();
        wordResizeState = {
            uid: uid,
            dir: dir || "se",
            startX: pt.clientX,
            startY: pt.clientY,
            baseStretchX: entry.stretchX || 1.0,
            baseStretchY: entry.stretchY || 1.0,
            baseScale: entry.scale || 1.0
        };
    };

    function onWordResizeMove(ev) {
        if (!wordResizeState || !isEditable()) return;
        const app = getApp();
        const reg = typeof app.getMarkersRegistry === "function" ? app.getMarkersRegistry() : {};
        const entry = reg[wordResizeState.uid];
        if (!entry) return;
        if (ev && ev.cancelable) ev.preventDefault();
        const pt = (ev && ev.touches && ev.touches[0]) ? ev.touches[0] : ev;
        const rawDx = pt.clientX - wordResizeState.startX;
        const rawDy = pt.clientY - wordResizeState.startY;
        const dir = wordResizeState.dir;

        const signX = (dir.indexOf("w") !== -1) ? -1 : ((dir.indexOf("e") !== -1) ? 1 : 0);
        const signY = (dir.indexOf("n") !== -1) ? -1 : ((dir.indexOf("s") !== -1) ? 1 : 0);
        const dx = rawDx * signX;
        const dy = rawDy * signY;

        if (signX !== 0 && signY !== 0 && !(ev && ev.altKey)) {
            const delta = (dx + dy) * 0.015;
            const factor = Math.max(0.4, Math.min(4.0, 1 + delta));
            entry.stretchX = Number(Math.max(0.35, Math.min(5.0, wordResizeState.baseStretchX * factor)).toFixed(2));
            entry.stretchY = Number(Math.max(0.35, Math.min(5.0, wordResizeState.baseStretchY * factor)).toFixed(2));
        } else {
            if (signX !== 0) {
                entry.stretchX = Math.max(0.35, Math.min(5.0, Number((wordResizeState.baseStretchX + dx * 0.022).toFixed(2))));
            }
            if (signY !== 0) {
                entry.stretchY = Math.max(0.35, Math.min(5.0, Number((wordResizeState.baseStretchY + dy * 0.022).toFixed(2))));
            }
        }
        applyLiveTransformToMarkerDom(entry);
    }

    function onWordResizeEnd() {
        if (!wordResizeState) return;
        const app = getApp();
        const map = getMap();
        const reg = typeof app.getMarkersRegistry === "function" ? app.getMarkersRegistry() : {};
        const entry = reg[wordResizeState.uid];
        if (map && map.dragging) map.dragging.enable();
        if (entry && entry.marker && entry.marker.dragging && isEditable()) entry.marker.dragging.enable();
        if (entry) {
            aggiornaIconaMarker(entry);
            if (typeof app.registraLog === "function") {
                app.registraLog("Ridimensionato #" + entry.sym.id + " (L:" + Math.round(entry.stretchX * 100) + "%, A:" + Math.round(entry.stretchY * 100) + "%)");
            }
        }
        wordResizeState = null;
    }

    document.addEventListener("mousemove", onWordResizeMove, { passive: false });
    document.addEventListener("mouseup", onWordResizeEnd);
    document.addEventListener("touchmove", onWordResizeMove, { passive: false });
    document.addEventListener("touchend", onWordResizeEnd);

    window._sitacStartRotate = function(ev, uid) {
        if (!isEditable()) return;
        const app = getApp();
        const map = getMap();
        const reg = typeof app.getMarkersRegistry === "function" ? app.getMarkersRegistry() : {};
        const entry = reg[uid];
        if (!entry || !entry.marker) return;
        if (ev) {
            ev.preventDefault();
            ev.stopPropagation();
            if (ev.stopImmediatePropagation) ev.stopImmediatePropagation();
        }
        selectedMarkerUid = uid;
        if (map && map.dragging) map.dragging.disable();
        if (entry.marker.dragging) entry.marker.dragging.disable();
        const pt = (ev && ev.touches && ev.touches[0]) ? ev.touches[0] : ev;
        const el = entry.marker.getElement();
        if (!el) return;
        const frame = el.querySelector(".word-frame") || el;
        const rect = frame.getBoundingClientRect();
        const cx = rect.left + rect.width / 2;
        const cy = rect.top + rect.height / 2;
        const startAngle = Math.atan2(pt.clientY - cy, pt.clientX - cx) * 180 / Math.PI;
        wordRotateState = {
            uid: uid,
            cx: cx,
            cy: cy,
            startAngle: startAngle,
            baseRot: entry.rot || 0
        };
    };

    function onWordRotateMove(ev) {
        if (!wordRotateState || !isEditable()) return;
        const app = getApp();
        const reg = typeof app.getMarkersRegistry === "function" ? app.getMarkersRegistry() : {};
        const entry = reg[wordRotateState.uid];
        if (!entry) return;
        if (ev && ev.cancelable) ev.preventDefault();
        const pt = (ev && ev.touches && ev.touches[0]) ? ev.touches[0] : ev;
        const ang = Math.atan2(pt.clientY - wordRotateState.cy, pt.clientX - wordRotateState.cx) * 180 / Math.PI;
        let deg = Math.round(wordRotateState.baseRot + (ang - wordRotateState.startAngle));
        if (ev && ev.shiftKey) deg = Math.round(deg / 15) * 15;
        entry.rot = ((deg % 360) + 360) % 360;
        applyLiveTransformToMarkerDom(entry);
    }

    function onWordRotateEnd() {
        if (!wordRotateState) return;
        const app = getApp();
        const map = getMap();
        const reg = typeof app.getMarkersRegistry === "function" ? app.getMarkersRegistry() : {};
        const entry = reg[wordRotateState.uid];
        if (map && map.dragging) map.dragging.enable();
        if (entry && entry.marker && entry.marker.dragging && isEditable()) entry.marker.dragging.enable();
        if (entry) {
            aggiornaIconaMarker(entry);
            if (typeof app.registraLog === "function") {
                app.registraLog("Ruotato #" + entry.sym.id + " (" + entry.rot + " deg)");
            }
        }
        wordRotateState = null;
    }

    document.addEventListener("mousemove", onWordRotateMove, { passive: false });
    document.addEventListener("mouseup", onWordRotateEnd);
    document.addEventListener("touchmove", onWordRotateMove, { passive: false });
    document.addEventListener("touchend", onWordRotateEnd);

    function populateSubscenarios() {
        const scenSel = document.getElementById("scenario-select");
        const subSel = document.getElementById("subscenario-select");
        const subMap = getConfig().SUBSCENARIOS_BY_SCENARIO || {};
        if (!scenSel || !subSel) return;
        const list = subMap[scenSel.value] || [{ value: "ALL", label: "Tutti i sottoscenari" }];
        subSel.innerHTML = "";
        list.forEach(function(item) {
            const opt = document.createElement("option");
            opt.value = item.value;
            opt.textContent = item.label;
            subSel.appendChild(opt);
        });
    }

    function renderOverlayControls() {
        const container = document.getElementById("wms-layers-list");
        const configs = getConfig().OVERLAY_CONFIGS || [];
        if (!container) return;
        container.innerHTML = "";

        configs.forEach(function(cfg) {
            const item = document.createElement("div");
            item.className = "layer-item";
            item.innerHTML =
                '<div class="layer-top">' +
                    '<label><input type="checkbox" id="wms-chk-' + cfg.id + '"' + (cfg.defaultOn ? ' checked' : '') + '> ' + escapeHtml(cfg.label) + '</label>' +
                '</div>' +
                '<div class="layer-op-row">' +
                    '<span>Opacita: <b id="wms-op-val-' + cfg.id + '">' + Math.round(cfg.defaultOpacity * 100) + '%</b></span>' +
                    '<input type="range" id="wms-op-' + cfg.id + '" min="0.1" max="1" step="0.05" value="' + cfg.defaultOpacity + '">' +
                '</div>';
            container.appendChild(item);

            const chk = item.querySelector("#wms-chk-" + cfg.id);
            const rng = item.querySelector("#wms-op-" + cfg.id);
            const valSpan = item.querySelector("#wms-op-val-" + cfg.id);

            const applyOverlayOpacity = function(layer, op) {
                if (!layer) return;
                if (typeof layer.setOpacity === "function") {
                    layer.setOpacity(op);
                } else if (typeof layer.setStyle === "function") {
                    layer.setStyle({ opacity: op, fillOpacity: Math.min(0.65, op * 0.45) });
                }
            };

            chk.addEventListener("change", function() {
                const map = getMap();
                const app = getApp();
                const overlayRegistry = typeof app.getOverlayRegistry === "function" ? app.getOverlayRegistry() : {};
                if (!map || typeof L === "undefined") return;
                const opVal = parseFloat(rng.value) || cfg.defaultOpacity;

                if (this.checked) {
                    if (cfg.type === "geojson") {
                        if (!overlayRegistry[cfg.id]) {
                            fetch(cfg.url + "?t=" + Date.now())
                                .then(function(r) {
                                    if (!r.ok) throw new Error("HTTP " + r.status);
                                    return r.json();
                                })
                                .then(function(gj) {
                                    if (!chk.checked) return;
                                    const geoLayer = L.geoJSON(gj, {
                                        style: function() {
                                            return {
                                                color: cfg.color || "#dc2626",
                                                weight: 2,
                                                opacity: opVal,
                                                fillColor: cfg.fillColor || cfg.color || "#ef4444",
                                                fillOpacity: Math.min(0.65, opVal * 0.45)
                                            };
                                        },
                                        onEachFeature: function(feature, lyr) {
                                            const props = feature && feature.properties ? feature.properties : {};
                                            const keys = Object.keys(props).slice(0, 6);
                                            const rows = keys.map(function(k) {
                                                return "<b>" + escapeHtml(k) + ":</b> " + escapeHtml(props[k]);
                                            }).join("<br>");
                                            lyr.bindPopup("<div style='font-size:11px;'><b>" + escapeHtml(cfg.label) + "</b>" + (rows ? "<br>" + rows : "") + "</div>");
                                        }
                                    });
                                    overlayRegistry[cfg.id] = geoLayer;
                                    geoLayer.addTo(map);
                                    if (typeof app.registraLog === "function") {
                                        app.registraLog("Caricato GeoJSON: " + cfg.label);
                                    }
                                })
                                .catch(function(err) {
                                    if (typeof app.registraLog === "function") {
                                        app.registraLog("Errore GeoJSON " + cfg.label + " (" + cfg.url + "): " + err.message);
                                    }
                                });
                        } else {
                            applyOverlayOpacity(overlayRegistry[cfg.id], opVal);
                            overlayRegistry[cfg.id].addTo(map);
                            if (typeof app.registraLog === "function") {
                                app.registraLog("Attivato layer: " + cfg.label);
                            }
                        }
                        return;
                    }

                    if (!overlayRegistry[cfg.id]) {
                        overlayRegistry[cfg.id] = L.tileLayer.wms(cfg.url, {
                            layers: cfg.wmsLayers || "0",
                            styles: "",
                            format: "image/png",
                            transparent: true,
                            version: "1.3.0",
                            crs: L.CRS.EPSG3857,
                            opacity: opVal,
                            attribution: cfg.attribution || "Geoportale Lombardia"
                        });
                        overlayRegistry[cfg.id].on("tileerror", function() {
                            if (typeof app.registraLog === "function") {
                                app.registraLog("Avviso: layer " + cfg.label + " non disponibile o bloccato dal server.");
                            }
                        });
                    }
                    applyOverlayOpacity(overlayRegistry[cfg.id], opVal);
                    overlayRegistry[cfg.id].addTo(map);
                    if (typeof app.registraLog === "function") {
                        app.registraLog("Attivato layer: " + cfg.label);
                    }
                } else if (overlayRegistry[cfg.id]) {
                    map.removeLayer(overlayRegistry[cfg.id]);
                    if (typeof app.registraLog === "function") {
                        app.registraLog("Disattivato layer: " + cfg.label);
                    }
                }
            });

            rng.addEventListener("input", function() {
                const app = getApp();
                const overlayRegistry = typeof app.getOverlayRegistry === "function" ? app.getOverlayRegistry() : {};
                const op = parseFloat(this.value) || 0.7;
                valSpan.textContent = Math.round(op * 100) + "%";
                applyOverlayOpacity(overlayRegistry[cfg.id], op);
            });
        });
    }

    function buildSymbolGraphicHtml(sym, stato, scale, stretchX, stretchY, rot) {
        const w = (sym.size && sym.size[0]) ? sym.size[0] : 46;
        const h = (sym.size && sym.size[1]) ? sym.size[1] : 22;
        const isPlanned = (stato === "PLANNED");
        const borderStyle = sym.borderStyle || (isPlanned ? "dashed" : "solid");
        const borderWidth = sym.borderWidth || "2px";
        const col = sym.col || "#c0392b";
        const sx = (scale || 1) * (stretchX || 1);
        const sy = (scale || 1) * (stretchY || 1);
        const rDeg = rot || 0;
        const transformCss = "transform: rotate(" + rDeg + "deg) scale(" + sx.toFixed(3) + ", " + sy.toFixed(3) + ");";

        const numStr = String(sym.id).padStart(2, "0");
        const pngSrc = (sym.id >= 1 && sym.id <= 29)
            ? "./symbols/sym_" + numStr + ".png"
            : ((sym.id >= 30 && sym.id <= 59)
                ? "./symbols/sym_" + numStr + "_" + (stato === "ACTIVE" ? "active" : "planned") + ".png"
                : "");

        if (pngSrc) {
            const imgW = (sym.id >= 1 && sym.id <= 29) ? Math.max(w * 1.4, 56) : Math.max(w, 42);
            const imgH = (sym.id >= 1 && sym.id <= 29) ? Math.max(h * 1.4, 34) : Math.max(h, 30);
            return '<div class="sitac-shape" style="' + transformCss + '">' +
                '<img src="' + pngSrc + '" alt="' + escapeHtml(sym.nome) + '" ' +
                'style="max-width:' + imgW + 'px; max-height:' + imgH + 'px; object-fit:contain; display:block;" ' +
                'onerror="this.style.display=\'none\'; if(this.nextElementSibling) this.nextElementSibling.style.display=\'flex\';">' +
                '<div class="sym-box" style="display:none; min-width:' + w + 'px; min-height:' + h + 'px; align-items:center; justify-content:center; border-color:' + col + '; border-style:' + borderStyle + '; border-width:' + borderWidth + '; color:' + col + ';">' + escapeHtml(sym.sigla || sym.tag || sym.id) + '</div>' +
            '</div>';
        }

        const labelTxt = escapeHtml(sym.sigla || sym.tag || sym.id);
        let bg = sym.customBg || (sym.solidBg ? col : "rgba(255,255,255,0.95)");
        let fg = sym.customText || (sym.solidBg ? "#ffffff" : col);
        let extraStyle = "";

        if (sym.tipoBox === "AEREO" || sym.tipoBox === "TERRA") {
            const topFill = isPlanned ? "#ffffff" : col;
            const boxDash = isPlanned ? 'stroke-dasharray="3,2"' : '';
            return '<div class="sitac-shape" style="' + transformCss + '">' +
                '<svg width="' + w + '" height="' + h + '" viewBox="0 0 56 32">' +
                    '<rect x="2" y="2" width="52" height="28" rx="' + (sym.tipoBox === "AEREO" ? "5" : "1") + '" fill="#ffffff" stroke="' + col + '" stroke-width="2" ' + boxDash + '/>' +
                    '<polygon points="2,2 54,2 28,11" fill="' + topFill + '" stroke="' + col + '" stroke-width="1.2"/>' +
                    '<polygon points="2,20 54,20 28,11" fill="' + topFill + '" stroke="' + col + '" stroke-width="1.2"/>' +
                    '<line x1="2" y1="20" x2="54" y2="20" stroke="' + col + '" stroke-width="1.6"/>' +
                    '<text x="28" y="28" text-anchor="middle" font-size="8.5" font-weight="bold" fill="' + col + '">' + labelTxt + '</text>' +
                '</svg></div>';
        }
        if (sym.tipoBox === "SANITARIO") {
            extraStyle = "border-radius:12px;";
        } else if (sym.tipoBox === "AZIONE") {
            extraStyle = "border-radius:4px; background:" + (isPlanned ? "#ffffff" : col) + "; color:" + (isPlanned ? col : "#ffffff") + ";";
        }

        return '<div class="sitac-shape" style="' + transformCss + '">' +
            '<div class="sym-box" style="min-width:' + w + 'px; min-height:' + h + 'px; display:flex; align-items:center; justify-content:center; border-color:' + col + '; border-style:' + borderStyle + '; border-width:' + borderWidth + '; background:' + bg + '; color:' + fg + '; ' + extraStyle + '">' +
            labelTxt +
            '</div></div>';
    }

    function renderSimboli() {
        const listEl = document.getElementById("symbol-list");
        const scenSel = document.getElementById("scenario-select");
        const subSel = document.getElementById("subscenario-select");
        const headerEl = document.getElementById("legend-header");
        const simboli = getConfig().SIMBOLI || [];
        if (!listEl || !scenSel) return;

        const scen = scenSel.value;
        const sub = subSel ? subSel.value : "ALL";
        const stato = "PLANNED";
        const editable = isEditable();

        const filtered = simboli.filter(function(s) {
            if (s.scenario !== scen) return false;
            if (sub && sub !== "ALL" && s.sub !== sub) return false;
            return true;
        });

        if (headerEl) {
            headerEl.textContent = "Scenario e Simboli (" + filtered.length + ")" + (editable ? " [Modifica]" : " [Lettura]");
        }

        listEl.innerHTML = "";
        if (filtered.length === 0) {
            listEl.innerHTML = '<div style="font-size:11px; color:#64748b; padding:6px;">Nessun simbolo trovato per i filtri selezionati.</div>';
            return;
        }

        filtered.forEach(function(sym) {
            const btn = document.createElement("button");
            btn.type = "button";
            btn.className = "sym-row";
            btn.style.borderLeftColor = sym.col || "#c0392b";
            btn.innerHTML =
                '<div class="sym-preview">' + buildSymbolGraphicHtml(sym, stato, 0.9, 1, 1, 0) + '</div>' +
                '<div class="sym-label"><b>#' + sym.id + '</b> ' + escapeHtml(sym.nome) + (sym.isPolygonTool ? ' <span style="color:#0369a1;font-weight:bold;">[Disegna Area]</span>' : '') + '</div>';

            btn.addEventListener("click", function() {
                const app = getApp();
                const map = getMap();
                if (!app.getOperatorModeActive() && !app.sbloccaModifica()) return;
                const currentEvId = app.getCurrentEventId();
                const currentEvPwd = app.getCurrentEventPassword();
                const unlockedMap = app.getUnlockedEventIds();
                if (currentEvId && currentEvPwd && !unlockedMap[currentEvId]) {
                    if (!app.promptUnlockCurrentEvent()) return;
                }
                if (!isEditable()) return;

                if (sym.isPolygonTool) {
                    startFreeDraw("POLYGON", sym.col || "#c0392b", sym.nome);
                    return;
                }

                const center = map ? map.getCenter() : { lat: app.getCurrentLat(), lng: app.getCurrentLng() };
                const uid = "M-" + Date.now() + "-" + app.nextMarkerCounter();
                addMarkerFromData({
                    uid: uid,
                    symId: sym.id,
                    stato: stato,
                    nota: "",
                    noteInterne: "",
                    autore: app.getCurrentOperator() || "Operatore",
                    ora: new Date().toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" }),
                    scale: 1.0,
                    stretchX: 1.0,
                    stretchY: 1.0,
                    rot: 0,
                    baseZoom: map ? map.getZoom() : 13,
                    latlng: [center.lat, center.lng],
                    openPopup: true
                });
                if (typeof app.registraLog === "function") {
                    app.registraLog("Inserito #" + sym.id + " (" + sym.nome + ")");
                }
            });

            listEl.appendChild(btn);
        });
    }

    function buildMarkerDivIcon(entry) {
        const zf = getZoomScaleFactor(entry);
        const effScale = (entry.scale || 1.0) * zf;
        const isSelected = (selectedMarkerUid === entry.uid) && isEditable();
        const safeUid = String(entry.uid).replace(/[^a-zA-Z0-9_-]/g, "");
        const dirs = ["nw", "n", "ne", "e", "se", "s", "sw", "w"];
        let handlesHtml = "";
        if (isSelected) {
            handlesHtml += '<div class="word-rotate-stem"></div>';
            handlesHtml += '<div class="word-rotate-handle" title="Trascina per ruotare" onmousedown="window._sitacStartRotate(event, \'' + safeUid + '\')" ontouchstart="window._sitacStartRotate(event, \'' + safeUid + '\')" onclick="event.stopPropagation()"></div>';
            dirs.forEach(function(d) {
                handlesHtml += '<div class="word-h word-h-' + d + '" title="Trascina per ridimensionare o stirare" onmousedown="window._sitacStartWordResize(event, \'' + safeUid + '\', \'' + d + '\')" ontouchstart="window._sitacStartWordResize(event, \'' + safeUid + '\', \'' + d + '\')" onclick="event.stopPropagation()"></div>';
            });
        }
        const captionHtml = entry.nota ? '<div class="sitac-caption" style="transform:scale(' + zf.toFixed(4) + ');transform-origin:top center;">' + escapeHtml(entry.nota) + '</div>' : '';
        const html =
            '<div class="sitac-wrapper' + (isSelected ? ' selected-item' : '') + '" onclick="window._sitacSelectMarker(\'' + safeUid + '\', event)" ondblclick="window._sitacOpenMarkerPopup(\'' + safeUid + '\', event)">' +
                '<div class="word-frame">' +
                    handlesHtml +
                    buildSymbolGraphicHtml(entry.sym, entry.stato, effScale, entry.stretchX || 1.0, entry.stretchY || 1.0, entry.rot || 0) +
                '</div>' +
                captionHtml +
            '</div>';

        return L.divIcon({
            className: "sitac-icon",
            html: html,
            iconSize: [84, 52],
            iconAnchor: [42, 26]
        });
    }

    function getMarkerPopupHtml(entry) {
        const app = getApp();
        const ll = entry.marker ? entry.marker.getLatLng() : { lat: app.getCurrentLat(), lng: app.getCurrentLng() };
        const editable = isEditable();
        let html =
            '<div style="min-width:230px; font-size:12px;">' +
                '<b>#' + entry.sym.id + ' - ' + escapeHtml(entry.sym.nome) + '</b><br>' +
                '<span style="font-size:10px; color:#475569;">Stato: ' + (entry.stato === "ACTIVE" ? "Attivo / Effettuata" : "Previsto / Prevista") +
                ' &bull; ' + escapeHtml(entry.autore || "Operatore") + (entry.ora ? ' (' + escapeHtml(entry.ora) + ')' : '') + '</span><br>' +
                '<span style="font-size:10px; color:#334155;">Coord: ' + ll.lat.toFixed(5) + ', ' + ll.lng.toFixed(5) + '</span>';

        if (!editable) {
            if (entry.nota) {
                html += '<div style="margin-top:4px; padding:3px 5px; background:#f1f5f9; border-radius:3px;"><b>Note mappa:</b> ' + escapeHtml(entry.nota) + '</div>';
            }
            if (entry.noteInterne) {
                html += '<div style="margin-top:4px; padding:4px 6px; background:#fefce8; border:1px solid #fde047; border-radius:3px; white-space:pre-wrap;"><b>Note interne:</b><br>' + escapeHtml(entry.noteInterne) + '</div>';
            }
            html += '</div>';
            return html;
        }

        html +=
            '<div class="popup-ctrl">' +
                '<div class="popup-ctrl-row">' +
                    '<label for="pop-note-' + entry.uid + '"><b>Note (visibili sulla mappa):</b></label>' +
                    '<input type="text" id="pop-note-' + entry.uid + '" value="' + escapeHtml(entry.nota || "") + '" placeholder="Testo etichetta sulla mappa...">' +
                '</div>' +
                '<div class="popup-ctrl-row">' +
                    '<label for="pop-internal-' + entry.uid + '"><b>Note interne (visibili solo qui):</b></label>' +
                    '<textarea id="pop-internal-' + entry.uid + '" rows="3" placeholder="Annotazioni operative su più righe...">' + escapeHtml(entry.noteInterne || "") + '</textarea>' +
                '</div>' +
                '<div style="display:flex; gap:4px; margin-top:5px;">' +
                    '<button type="button" class="small-btn" style="flex:1; background:#0369a1; color:#fff;" onclick="window._sitacSaveMarkerNote(\'' + entry.uid + '\')">Applica</button>' +
                    '<button type="button" class="small-btn" style="flex:1; background:#d97706; color:#fff;" onclick="window._sitacToggleMarkerStato(\'' + entry.uid + '\')">Stato</button>' +
                    '<button type="button" class="small-btn" style="background:#b91c1c; color:#fff;" onclick="window._sitacDeleteMarker(\'' + entry.uid + '\')">Elimina</button>' +
                '</div>' +
            '</div>';
        html += '</div>';
        return html;
    }

    function aggiornaIconaMarker(entry) {
        if (!entry || !entry.marker) return;
        entry.marker.setIcon(buildMarkerDivIcon(entry));
        entry.marker.setPopupContent(getMarkerPopupHtml(entry));
    }

    window._sitacSaveMarkerNote = function(uid) {
        const app = getApp();
        const reg = typeof app.getMarkersRegistry === "function" ? app.getMarkersRegistry() : {};
        const entry = reg[uid];
        if (!entry) return;
        const inp = document.getElementById("pop-note-" + uid);
        const intInp = document.getElementById("pop-internal-" + uid);
        if (inp) entry.nota = inp.value.trim();
        if (intInp) entry.noteInterne = intInp.value.trim();
        aggiornaIconaMarker(entry);
        if (entry.marker && entry.marker.getPopup) {
            entry.marker.setPopupContent(getMarkerPopupHtml(entry));
            entry.marker.openPopup();
        }
        if (typeof app.registraLog === "function") {
            app.registraLog("Aggiornate note #" + entry.sym.id + ": " + (entry.nota || "(vuota)"));
        }
    };

    window._sitacToggleMarkerStato = function(uid) {
        const app = getApp();
        const reg = typeof app.getMarkersRegistry === "function" ? app.getMarkersRegistry() : {};
        const entry = reg[uid];
        if (!entry) return;
        const inp = document.getElementById("pop-note-" + uid);
        const intInp = document.getElementById("pop-internal-" + uid);
        if (inp) entry.nota = inp.value.trim();
        if (intInp) entry.noteInterne = intInp.value.trim();
        entry.stato = (entry.stato === "ACTIVE") ? "PLANNED" : "ACTIVE";
        aggiornaIconaMarker(entry);
        if (entry.marker && entry.marker.getPopup) {
            entry.marker.setPopupContent(getMarkerPopupHtml(entry));
            entry.marker.openPopup();
        }
        if (typeof app.registraLog === "function") {
            app.registraLog("Cambiato stato #" + entry.sym.id + " in " + (entry.stato === "ACTIVE" ? "Effettuata" : "Prevista"));
        }
    };

    window._sitacDeleteMarker = function(uid) {
        if (!isEditable()) return;
        const app = getApp();
        const map = getMap();
        const reg = typeof app.getMarkersRegistry === "function" ? app.getMarkersRegistry() : {};
        const entry = reg[uid];
        if (!entry) return;
        if (map && entry.marker) map.removeLayer(entry.marker);
        delete reg[uid];
        if (selectedMarkerUid === uid) selectedMarkerUid = null;
        if (typeof app.registraLog === "function") {
            app.registraLog("Rimosso simbolo #" + entry.sym.id);
        }
    };

    function addMarkerFromData(opts) {
        const app = getApp();
        const map = getMap();
        const simboli = getConfig().SIMBOLI || [];
        if (!map || typeof L === "undefined") return null;

        const sym = simboli.find(function(s) { return s.id === Number(opts.symId); }) || simboli[0];
        const uid = opts.uid || ("M-" + Date.now() + "-" + app.nextMarkerCounter());
        const reg = typeof app.getMarkersRegistry === "function" ? app.getMarkersRegistry() : {};
        const editable = isEditable();

        const entry = {
            uid: uid,
            sym: sym,
            stato: opts.stato || "PLANNED",
            nota: opts.nota || "",
            noteInterne: opts.noteInterne || "",
            autore: opts.autore || app.getCurrentOperator() || "Operatore",
            ora: opts.ora || "",
            scale: opts.scale || 1.0,
            stretchX: opts.stretchX || 1.0,
            stretchY: opts.stretchY || 1.0,
            rot: opts.rot || 0,
            baseZoom: opts.baseZoom || map.getZoom(),
            marker: null
        };

        const marker = L.marker(opts.latlng, {
            draggable: editable,
            icon: buildMarkerDivIcon(entry)
        }).addTo(map);

        entry.marker = marker;
        reg[uid] = entry;

        marker.bindPopup(getMarkerPopupHtml(entry), { autoPan: false, closeOnClick: false });
        marker.on("click", function(ev) {
            if (ev && ev.originalEvent) {
                L.DomEvent.stopPropagation(ev.originalEvent);
            }
            selectedMarkerUid = uid;
            aggiornaIconaMarker(entry);
            marker.setPopupContent(getMarkerPopupHtml(entry));
            marker.openPopup();
        });
        marker.on("dblclick", function(ev) {
            if (ev && ev.originalEvent) {
                L.DomEvent.stopPropagation(ev.originalEvent);
                L.DomEvent.preventDefault(ev.originalEvent);
            }
            selectedMarkerUid = uid;
            aggiornaIconaMarker(entry);
            marker.setPopupContent(getMarkerPopupHtml(entry));
            marker.openPopup();
        });
        marker.on("dragend", function() {
            const pos = marker.getLatLng();
            marker.setPopupContent(getMarkerPopupHtml(entry));
            if (typeof app.registraLog === "function") {
                app.registraLog("Spostato #" + sym.id + " a " + pos.lat.toFixed(5) + ", " + pos.lng.toFixed(5));
            }
        });

        if (opts.openPopup) {
            selectedMarkerUid = uid;
            aggiornaIconaMarker(entry);
            marker.openPopup();
        }
        return entry;
    }

    function updateDrawToolButtonsUi() {
        const mapBtn = {
            LINE: "btn-draw-line",
            RECT: "btn-draw-rect",
            CIRCLE: "btn-draw-circle",
            TRIANGLE: "btn-draw-triangle"
        };
        Object.keys(mapBtn).forEach(function(k) {
            const b = document.getElementById(mapBtn[k]);
            if (b) {
                if (activeDrawMode === k) b.classList.add("active");
                else b.classList.remove("active");
            }
        });
        const cancelBtn = document.getElementById("btn-draw-cancel");
        if (cancelBtn) cancelBtn.style.display = activeDrawMode ? "block" : "none";
    }

    function startFreeDraw(mode, colorOverride, labelOverride) {
        const app = getApp();
        const map = getMap();
        if (!app.getOperatorModeActive() && !app.sbloccaModifica()) return;
        const currentEvId = app.getCurrentEventId();
        const currentEvPwd = app.getCurrentEventPassword();
        const unlockedMap = app.getUnlockedEventIds();
        if (currentEvId && currentEvPwd && !unlockedMap[currentEvId]) {
            if (!app.promptUnlockCurrentEvent()) return;
        }
        if (!isEditable() || !map) return;

        cancelActiveDraw();
        activeDrawMode = mode;
        drawPoints = [];
        const colorEl = document.getElementById("draw-color-input");
        const labelEl = document.getElementById("draw-label-input");
        drawColor = colorOverride || (colorEl ? colorEl.value : "#dc2626");
        drawLabel = labelOverride || (labelEl && labelEl.value.trim() ? labelEl.value.trim() : mode);
        updateDrawToolButtonsUi();

        const hintEl = document.getElementById("draw-hint");
        const msgs = {
            LINE: "LINEA: clicca sulla mappa per aggiungere punti, doppio clic per terminare.",
            POLYGON: "POLIGONO: clicca sulla mappa per aggiungere vertici, doppio clic per chiudere.",
            RECT: "QUADRATO / RETTANGOLO: clicca il 1° angolo sulla mappa, poi clicca l'angolo opposto.",
            CIRCLE: "CERCHIO: clicca il centro sulla mappa, poi clicca un punto sul bordo per il raggio.",
            TRIANGLE: "TRIANGOLO: clicca 3 vertici sulla mappa per chiudere il triangolo."
        };
        const msg = msgs[mode] || "Clicca sulla mappa per disegnare.";
        if (hintEl) hintEl.innerHTML = "<b>" + escapeHtml(msg) + "</b>";
        if (typeof app.setDiag === "function") {
            app.setDiag(msg, false);
        }
    }

    function cancelActiveDraw() {
        const map = getMap();
        activeDrawMode = null;
        drawPoints = [];
        if (map && drawDraftLayer) {
            map.removeLayer(drawDraftLayer);
            drawDraftLayer = null;
        }
        updateDrawToolButtonsUi();
        const hintEl = document.getElementById("draw-hint");
        if (hintEl) hintEl.textContent = "Seleziona uno strumento sopra per disegnare sulla mappa.";
    }

    function updateDraftGeometry() {
        const map = getMap();
        if (!map || typeof L === "undefined") return;
        if (drawDraftLayer) {
            map.removeLayer(drawDraftLayer);
            drawDraftLayer = null;
        }
        if (drawPoints.length === 1) {
            drawDraftLayer = L.circleMarker(drawPoints[0], { radius: 5, color: drawColor, fillColor: drawColor, fillOpacity: 0.8 }).addTo(map);
        } else if (drawPoints.length >= 2) {
            if (activeDrawMode === "LINE") {
                drawDraftLayer = L.polyline(drawPoints, { color: drawColor, weight: 3, dashArray: "6,4" }).addTo(map);
            } else {
                drawDraftLayer = L.polygon(drawPoints, {
                    color: drawColor, weight: 2, dashArray: "5,5", fillColor: drawColor, fillOpacity: 0.2
                }).addTo(map);
            }
        }
    }

    function handleMapClickForDraw(latlng) {
        const map = getMap();
        if (!activeDrawMode || !isEditable() || !map) return false;
        const pt = [latlng.lat, latlng.lng];

        if (activeDrawMode === "RECT") {
            if (drawPoints.length === 0) {
                drawPoints.push(pt);
                updateDraftGeometry();
            } else {
                const p1 = drawPoints[0];
                const p2 = pt;
                const rectPts = [
                    [p1[0], p1[1]],
                    [p1[0], p2[1]],
                    [p2[0], p2[1]],
                    [p2[0], p1[1]]
                ];
                finalizeDrawnShape("RECT", rectPts, 0);
            }
            return true;
        }

        if (activeDrawMode === "CIRCLE") {
            if (drawPoints.length === 0) {
                drawPoints.push(pt);
                updateDraftGeometry();
            } else {
                const centerPt = drawPoints[0];
                const radMeters = map.distance(centerPt, pt);
                finalizeDrawnShape("CIRCLE", [centerPt], Math.max(10, Math.round(radMeters)));
            }
            return true;
        }

        if (activeDrawMode === "TRIANGLE") {
            drawPoints.push(pt);
            if (drawPoints.length < 3) {
                updateDraftGeometry();
            } else {
                finalizeDrawnShape("TRIANGLE", drawPoints.slice(0, 3), 0);
            }
            return true;
        }

        if (activeDrawMode === "LINE" || activeDrawMode === "POLYGON") {
            drawPoints.push(pt);
            updateDraftGeometry();
            return true;
        }
        return false;
    }

    function finalizeDrawnShape(shapeType, pts, radiusMeters) {
        const app = getApp();
        const labelEl = document.getElementById("draw-label-input");
        const finalNote = (labelEl && labelEl.value.trim()) ? labelEl.value.trim() : drawLabel;
        const col = drawColor;
        cancelActiveDraw();
        if (typeof app.setDiag === "function") {
            app.setDiag("Sistema pronto | Eventi + 4 Scenari + Disegno + GPS", false);
        }

        if (shapeType === "LINE" && pts.length < 2) {
            return alert("Servono almeno 2 punti per tracciare una linea.");
        }
        if ((shapeType === "POLYGON" || shapeType === "TRIANGLE" || shapeType === "RECT") && pts.length < 3) {
            return alert("Servono almeno 3 vertici per chiudere l'area.");
        }

        const num = app.nextPolyCounter();
        addShapeToMap({
            uid: "P-" + Date.now() + "-" + num,
            num: num,
            shapeType: shapeType,
            radius: radiusMeters || 0,
            points: pts,
            color: col,
            nota: finalNote,
            scenarioLabel: shapeType,
            autore: app.getCurrentOperator() || "Operatore",
            ora: new Date().toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" }),
            openPopup: true
        });
        if (typeof app.registraLog === "function") {
            app.registraLog("Disegnato (" + shapeType + ") #" + num + ": " + finalNote);
        }
    }

    function getPolygonPopupContent(p) {
        const typeNames = {
            LINE: "Linea",
            RECT: "Quadrato / Rettangolo",
            CIRCLE: "Cerchio (" + (p.radius || 0) + " m)",
            TRIANGLE: "Triangolo",
            POLYGON: "Poligono"
        };
        const tLabel = typeNames[p.shapeType || "POLYGON"] || "Elemento";
        let html =
            '<div style="min-width:190px; font-size:12px;">' +
                '<b>' + escapeHtml(tLabel) + ' #' + p.num + '</b><br>' +
                '<span>' + escapeHtml(p.nota || p.scenarioLabel || "Area") + '</span><br>' +
                '<span style="font-size:10px; color:#475569;">Autore: ' + escapeHtml(p.autore || "Operatore") + (p.ora ? ' (' + escapeHtml(p.ora) + ')' : '') + '</span>';
        if (isEditable()) {
            html +=
                '<div class="popup-ctrl">' +
                    '<input type="text" id="poly-note-' + p.uid + '" value="' + escapeHtml(p.nota || "") + '">' +
                    '<div style="display:flex; gap:4px;">' +
                        '<button type="button" class="small-btn" style="flex:1; background:#0369a1; color:#fff;" onclick="window._sitacSavePolyNote(\'' + p.uid + '\')">Salva Nota</button>' +
                        '<button type="button" class="small-btn" style="background:#b91c1c; color:#fff;" onclick="window._sitacDeletePoly(\'' + p.uid + '\')">Elimina</button>' +
                    '</div>' +
                '</div>';
        }
        html += '</div>';
        return html;
    }

    window._sitacSavePolyNote = function(uid) {
        const app = getApp();
        const reg = typeof app.getPolygonsRegistry === "function" ? app.getPolygonsRegistry() : {};
        if (!isEditable() || !reg[uid]) return;
        const p = reg[uid];
        const inp = document.getElementById("poly-note-" + uid);
        if (inp) p.nota = inp.value.trim();
        p.layer.setPopupContent(getPolygonPopupContent(p));
        if (typeof app.registraLog === "function") {
            app.registraLog("Aggiornata nota elemento #" + p.num);
        }
    };

    window._sitacDeletePoly = function(uid) {
        const app = getApp();
        const map = getMap();
        const reg = typeof app.getPolygonsRegistry === "function" ? app.getPolygonsRegistry() : {};
        if (!isEditable() || !reg[uid]) return;
        const p = reg[uid];
        if (map && p.layer) map.removeLayer(p.layer);
        delete reg[uid];
        if (typeof app.registraLog === "function") {
            app.registraLog("Eliminato elemento #" + p.num);
        }
    };

    function addShapeToMap(opts) {
        const app = getApp();
        const map = getMap();
        if (!map || typeof L === "undefined" || !opts.points || opts.points.length === 0) return null;
        const reg = typeof app.getPolygonsRegistry === "function" ? app.getPolygonsRegistry() : {};
        const uid = opts.uid || ("P-" + Date.now() + "-" + app.nextPolyCounter());
        const shapeType = opts.shapeType || "POLYGON";
        const pObj = {
            uid: uid,
            num: opts.num || app.getPolyCounter(),
            shapeType: shapeType,
            radius: opts.radius || 0,
            points: opts.points,
            color: opts.color || "#c0392b",
            nota: opts.nota || "",
            scenarioLabel: opts.scenarioLabel || "",
            autore: opts.autore || "Operatore",
            ora: opts.ora || "",
            layer: null
        };

        let layer = null;
        if (shapeType === "LINE") {
            if (pObj.points.length < 2) return null;
            layer = L.polyline(pObj.points, {
                color: pObj.color,
                weight: 3.5
            }).addTo(map);
        } else if (shapeType === "CIRCLE") {
            layer = L.circle(pObj.points[0], {
                radius: pObj.radius || 100,
                color: pObj.color,
                weight: 2.5,
                fillColor: pObj.color,
                fillOpacity: 0.2
            }).addTo(map);
        } else {
            if (pObj.points.length < 3) return null;
            layer = L.polygon(pObj.points, {
                color: pObj.color,
                weight: 2.5,
                fillColor: pObj.color,
                fillOpacity: 0.22
            }).addTo(map);
        }

        pObj.layer = layer;
        reg[uid] = pObj;
        layer.bindPopup(getPolygonPopupContent(pObj));
        if (opts.openPopup) layer.openPopup();
        return pObj;
    }

    function getFreeTextPopupContent(t) {
        let html =
            '<div style="min-width:190px; font-size:12px;">' +
                '<b>Scritta su mappa</b><br>' +
                '<span style="font-size:10px; color:#475569;">' + escapeHtml(t.autore || "Operatore") + (t.ora ? ' (' + escapeHtml(t.ora) + ')' : '') + '</span>';
        if (isEditable()) {
            html +=
                '<div class="popup-ctrl">' +
                    '<input type="text" id="ftxt-val-' + t.uid + '" value="' + escapeHtml(t.text || "") + '">' +
                    '<div style="display:flex; gap:4px;">' +
                        '<button type="button" class="small-btn" style="flex:1; background:#0369a1; color:#fff;" onclick="window._sitacSaveFreeText(\'' + t.uid + '\')">Applica</button>' +
                        '<button type="button" class="small-btn" style="background:#b91c1c; color:#fff;" onclick="window._sitacDeleteFreeText(\'' + t.uid + '\')">Elimina</button>' +
                    '</div>' +
                '</div>';
        }
        html += '</div>';
        return html;
    }

    function buildFreeTextDivIcon(t) {
        return L.divIcon({
            className: "sitac-icon",
            html: '<div class="free-text-badge" style="color:#ffffff; border-color:' + escapeHtml(t.color || "#dc2626") + '; background:' + escapeHtml(t.color || "#dc2626") + ';">' + escapeHtml(t.text || "Testo") + '</div>',
            iconSize: [120, 24],
            iconAnchor: [60, 12]
        });
    }

    window._sitacSaveFreeText = function(uid) {
        const app = getApp();
        const reg = typeof app.getTextLabelsRegistry === "function" ? app.getTextLabelsRegistry() : {};
        if (!isEditable() || !reg[uid]) return;
        const t = reg[uid];
        const inp = document.getElementById("ftxt-val-" + uid);
        if (inp && inp.value.trim()) t.text = inp.value.trim();
        t.marker.setIcon(buildFreeTextDivIcon(t));
        t.marker.setPopupContent(getFreeTextPopupContent(t));
        if (typeof app.registraLog === "function") {
            app.registraLog("Aggiornata scritta: " + t.text);
        }
    };

    window._sitacDeleteFreeText = function(uid) {
        const app = getApp();
        const map = getMap();
        const reg = typeof app.getTextLabelsRegistry === "function" ? app.getTextLabelsRegistry() : {};
        if (!isEditable() || !reg[uid]) return;
        const t = reg[uid];
        if (map && t.marker) map.removeLayer(t.marker);
        delete reg[uid];
        if (typeof app.registraLog === "function") {
            app.registraLog("Rimossa scritta: " + t.text);
        }
    };

    function addFreeTextToMap(opts) {
        const app = getApp();
        const map = getMap();
        if (!map || typeof L === "undefined") return null;
        const reg = typeof app.getTextLabelsRegistry === "function" ? app.getTextLabelsRegistry() : {};
        const uid = opts.uid || ("T-" + Date.now() + "-" + app.nextTextLabelCounter());
        const tObj = {
            uid: uid,
            text: opts.text || "Nota",
            color: opts.color || "#dc2626",
            autore: opts.autore || app.getCurrentOperator() || "Operatore",
            ora: opts.ora || new Date().toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" }),
            marker: null
        };
        const m = L.marker(opts.latlng, {
            draggable: isEditable(),
            icon: buildFreeTextDivIcon(tObj)
        }).addTo(map);
        tObj.marker = m;
        reg[uid] = tObj;
        m.bindPopup(getFreeTextPopupContent(tObj));
        if (opts.openPopup) m.openPopup();
        return tObj;
    }

    function clearSelectedMarker() {
        selectedMarkerUid = null;
    }

    function getActiveDrawMode() {
        return activeDrawMode;
    }

    function getDrawPointsCopy() {
        return drawPoints.slice();
    }

    window.SITAC_DISEGNO = {
        populateSubscenarios: populateSubscenarios,
        renderOverlayControls: renderOverlayControls,
        renderSimboli: renderSimboli,
        aggiornaIconaMarker: aggiornaIconaMarker,
        getMarkerPopupHtml: getMarkerPopupHtml,
        getPolygonPopupContent: getPolygonPopupContent,
        getFreeTextPopupContent: getFreeTextPopupContent,
        addMarkerFromData: addMarkerFromData,
        addShapeToMap: addShapeToMap,
        addFreeTextToMap: addFreeTextToMap,
        startFreeDraw: startFreeDraw,
        cancelActiveDraw: cancelActiveDraw,
        handleMapClickForDraw: handleMapClickForDraw,
        finalizeDrawnShape: finalizeDrawnShape,
        applyLiveTransformToMarkerDom: applyLiveTransformToMarkerDom,
        clearSelectedMarker: clearSelectedMarker,
        getActiveDrawMode: getActiveDrawMode,
        getDrawPointsCopy: getDrawPointsCopy
    };
})();
```[cite: 1]

Quando ci sei, passiamo all'ultimo pezzo: **6/6 — `mappa.html`**, che collega CSS e moduli JS, coordina `window.SITAC_APP` e registra il Service Worker.