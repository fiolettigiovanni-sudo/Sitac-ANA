(function() {
    const SUBSCENARIOS_BY_SCENARIO = {
        SCENARIO_AIB: [
            { value: "ALL", label: "Tutti i sottoscenari AIB" },
            { value: "AIB_VIABILITA", label: "Viabilita e accessi" },
            { value: "AIB_PUNTI_ACQUA", label: "Punti acqua e piazzole" },
            { value: "AIB_RISCHI", label: "Linee elettriche, pendenze e punti sensibili" },
            { value: "AIB_EVOLUZIONE", label: "Evoluzione incendio e vento" },
            { value: "AIB_MEZZI", label: "Mezzi aerei, squadre e posti di comando" },
            { value: "AIB_AZIONI", label: "Azioni e manovre tattiche" }
        ],
        SCENARIO_IDRO: [
            { value: "ALL", label: "Tutti i sottoscenari Idrogeologico" },
            { value: "IDRO_AREE_POLIGONO", label: "Aree a rischio e poligoni perimetrati" },
            { value: "IDRO_RETI_IDRAULICA", label: "Dissesti, esondazioni, alvei e idrometri" },
            { value: "IDRO_COMANDO_FORZE", label: "COC, squadre, varchi e punti sensibili" }
        ],
        SCENARIO_RICERCA: [
            { value: "ALL", label: "Tutti i sottoscenari Ricerca e Soccorso" },
            { value: "RIC_SETTORI_TRACCE", label: "IPP, settori a poligono e tracce" },
            { value: "RIC_SQUADRE_ELISUPPORTO", label: "Squadre, cinofile/SAF e basi operative" },
            { value: "RIC_COORDINAMENTO_SANITA", label: "COC/CC, sanita e persone individuate" }
        ],
        SCENARIO_LOGISTICA: [
            { value: "ALL", label: "Tutti i sottoscenari Logistica e Assistenza" },
            { value: "LOG_ACCOGLIENZA_VIVERI", label: "Accoglienza, tende, mensa e viveri/H2O" },
            { value: "LOG_MEZZI_SANITA", label: "Aree sosta mezzi e punto sanitario" },
            { value: "LOG_COORDINAMENTO_CONTROLLO", label: "COC/CC, squadre e varchi" }
        ]
    };

    const OVERLAY_CONFIGS = [
        {
            id: "ctr_lombardia",
            label: "CTR / Base Cartografica Lombardia",
            attribution: "Geoportale Lombardia",
            type: "wms",
            url: "https://www.cartografia.servizirl.it/arcgis/services/wms/ctr_wms/MapServer/WMSServer",
            wmsLayers: "0",
            defaultOn: false,
            defaultOpacity: 0.75
        },
        {
            id: "aree_rme_pai_lombardia",
            label: "Aree RME Titolo IV PAI Lombardia (GeoJSON locale)",
            attribution: "PAI Lombardia",
            type: "geojson",
            url: "aree_rme_titoloiv_pai.geojson",
            color: "#dc2626",
            fillColor: "#ef4444",
            defaultOn: false,
            defaultOpacity: 0.70
        },
        {
            id: "elementi_esposti_lombardia",
            label: "Categorie Rischio Elementi Esposti Lombardia (GeoJSON locale)",
            attribution: "Rischio Lombardia",
            type: "geojson",
            url: "Categorie_rischio_elementi_esposti_poligonali_semplificato.geojson",
            color: "#d97706",
            fillColor: "#f59e0b",
            defaultOn: false,
            defaultOpacity: 0.70
        }
    ];

    const SIMBOLI = [
        { id: 1, scenario: "SCENARIO_AIB", sub: "AIB_VIABILITA", col: "#6d4c41", nome: "Sentiero o mulattiera", svgType: "TRAIL", size: [48, 20] },
        { id: 2, scenario: "SCENARIO_AIB", sub: "AIB_VIABILITA", col: "#111827", nome: "Strada per mezzi leggeri", svgType: "ROAD_LIGHT", size: [50, 20] },
        { id: 3, scenario: "SCENARIO_AIB", sub: "AIB_VIABILITA", col: "#6d4c41", nome: "Strada sterrata per mezzi leggeri", svgType: "TRACK_LIGHT", size: [50, 20] },
        { id: 4, scenario: "SCENARIO_AIB", sub: "AIB_VIABILITA", col: "#111827", nome: "Strada per mezzi pesanti", svgType: "ROAD_HEAVY", size: [52, 22] },
        { id: 5, scenario: "SCENARIO_AIB", sub: "AIB_VIABILITA", col: "#6d4c41", nome: "Strada sterrata per mezzi pesanti", svgType: "TRACK_HEAVY", size: [52, 22] },
        { id: 6, scenario: "SCENARIO_AIB", sub: "AIB_VIABILITA", col: "#1d4ed8", nome: "Senso di marcia obbligatorio", svgType: "ONE_WAY", size: [46, 20] },
        { id: 7, scenario: "SCENARIO_AIB", sub: "AIB_VIABILITA", col: "#c0392b", nome: "Accesso interrotto", svgType: "ROAD_CLOSED", size: [46, 20] },

        { id: 8, scenario: "SCENARIO_AIB", sub: "AIB_RISCHI", col: "#111827", nome: "Pendenza lieve", svgType: "SLOPE_1", size: [48, 22] },
        { id: 9, scenario: "SCENARIO_AIB", sub: "AIB_RISCHI", col: "#111827", nome: "Pendenza moderata", svgType: "SLOPE_2", size: [48, 22] },
        { id: 10, scenario: "SCENARIO_AIB", sub: "AIB_RISCHI", col: "#111827", nome: "Pendenza forte", svgType: "SLOPE_3", size: [48, 22] },
        { id: 11, scenario: "SCENARIO_AIB", sub: "AIB_RISCHI", col: "#ca8a04", nome: "Linea elettrica", svgType: "POWER_ON", size: [46, 22] },
        { id: 12, scenario: "SCENARIO_AIB", sub: "AIB_RISCHI", col: "#111827", nome: "Linea elettrica disattivata", svgType: "POWER_OFF", size: [34, 24] },
        { id: 13, scenario: "SCENARIO_AIB", sub: "AIB_PUNTI_ACQUA", col: "#0284c7", nome: "Punto d'acqua", svgType: "WATER", size: [26, 26] },
        { id: 14, scenario: "SCENARIO_AIB", sub: "AIB_PUNTI_ACQUA", col: "#0284c7", nome: "Punto d'acqua per elicotteri", svgType: "WATER_HELI", size: [30, 30] },
        { id: 15, scenario: "SCENARIO_AIB", sub: "AIB_RISCHI", col: "#e67e22", nome: "Punto sensibile", svgType: "SENSITIVE", size: [28, 28] },
        { id: 16, scenario: "SCENARIO_AIB", sub: "AIB_RISCHI", col: "#16a34a", nome: "Punto sensibile per interfaccia", svgType: "WUI", size: [30, 30] },
        { id: 17, scenario: "SCENARIO_AIB", sub: "AIB_PUNTI_ACQUA", col: "#111827", nome: "Piazzola per elicottero", svgType: "HELIPAD", size: [28, 28] },
        { id: 18, scenario: "SCENARIO_AIB", sub: "AIB_RISCHI", col: "#7e22ce", nome: "Altri ostacoli alla navigazione aerea", svgType: "AIR_OBSTACLE", size: [54, 22] },

        { id: 19, scenario: "SCENARIO_AIB", sub: "AIB_EVOLUZIONE", col: "#c0392b", nome: "Asse di sviluppo principale", svgType: "ARROW_MAIN", size: [54, 26] },
        { id: 20, scenario: "SCENARIO_AIB", sub: "AIB_EVOLUZIONE", col: "#c0392b", nome: "Asse di sviluppo secondario veloce", svgType: "ARROW_FAST", size: [50, 24] },
        { id: 21, scenario: "SCENARIO_AIB", sub: "AIB_EVOLUZIONE", col: "#c0392b", nome: "Asse di sviluppo secondario lento", svgType: "ARROW_SLOW", size: [50, 24] },
        { id: 22, scenario: "SCENARIO_AIB", sub: "AIB_EVOLUZIONE", col: "#dc2626", nome: "Punto di origine", svgType: "ORIGIN", size: [28, 28] },
        { id: 23, scenario: "SCENARIO_AIB", sub: "AIB_EVOLUZIONE", col: "#c0392b", nome: "Fronte dell'incendio", svgType: "FIRE_FRONT", size: [54, 24] },
        { id: 24, scenario: "SCENARIO_AIB", sub: "AIB_EVOLUZIONE", col: "#1e3a8a", nome: "Direzione del vento intensita debole", svgType: "WIND_1", size: [58, 22] },
        { id: 25, scenario: "SCENARIO_AIB", sub: "AIB_EVOLUZIONE", col: "#1e3a8a", nome: "Direzione del vento intensita moderata", svgType: "WIND_2", size: [62, 22] },
        { id: 26, scenario: "SCENARIO_AIB", sub: "AIB_EVOLUZIONE", col: "#1e3a8a", nome: "Direzione del vento intensita forte", svgType: "WIND_3", size: [66, 22] },
        { id: 27, scenario: "SCENARIO_AIB", sub: "AIB_EVOLUZIONE", col: "#c0392b", nome: "Incendio di chioma", svgType: "FIRE_CROWN", size: [54, 22] },
        { id: 28, scenario: "SCENARIO_AIB", sub: "AIB_EVOLUZIONE", col: "#ea580c", nome: "Incendio radente", svgType: "FIRE_SURFACE", size: [54, 22] },
        { id: 29, scenario: "SCENARIO_AIB", sub: "AIB_EVOLUZIONE", col: "#7c2d12", nome: "Incendio sotterraneo", svgType: "FIRE_GROUND", size: [54, 22] },

        { id: 30, scenario: "SCENARIO_AIB", sub: "AIB_MEZZI", col: "#c0392b", sigla: "CAN", nome: "Canadair", tipoBox: "AEREO", size: [50, 32] },
        { id: 31, scenario: "SCENARIO_AIB", sub: "AIB_MEZZI", col: "#c0392b", sigla: "S 64", nome: "S 64", tipoBox: "AEREO", size: [50, 32] },
        { id: 32, scenario: "SCENARIO_AIB", sub: "AIB_MEZZI", col: "#c0392b", sigla: "Boss", nome: "Fireboss", tipoBox: "AEREO", size: [50, 32] },
        { id: 33, scenario: "SCENARIO_AIB", sub: "AIB_MEZZI", col: "#c0392b", sigla: "Eli", nome: "Elicotteri medi e leggeri", tipoBox: "AEREO", size: [50, 32] },
        { id: 34, scenario: "SCENARIO_AIB", sub: "AIB_MEZZI", col: "#c0392b", sigla: "Eli Com", nome: "Elicottero Comando", tipoBox: "AEREO", size: [58, 32] },
        { id: 35, scenario: "SCENARIO_AIB", sub: "AIB_MEZZI", col: "#c0392b", sigla: "AEREO", nome: "Altro mezzo aereo", tipoBox: "AEREO", size: [52, 32] },
        { id: 36, scenario: "SCENARIO_AIB", sub: "AIB_MEZZI", col: "#c0392b", sigla: "VVF", nome: "Squadra Vigili del Fuoco", tipoBox: "TERRA", size: [48, 30] },
        { id: 37, scenario: "SCENARIO_AIB", sub: "AIB_MEZZI", col: "#c0392b", sigla: "VOL", nome: "Squadra Volontari", tipoBox: "TERRA", size: [48, 30] },
        { id: 38, scenario: "SCENARIO_AIB", sub: "AIB_MEZZI", col: "#c0392b", sigla: "GOS", nome: "Squadra GOS", tipoBox: "TERRA", size: [48, 30] },
        { id: 39, scenario: "SCENARIO_AIB", sub: "AIB_MEZZI", col: "#c0392b", sigla: "SAI", nome: "Squadra SAI", tipoBox: "TERRA", size: [48, 30] },
        { id: 40, scenario: "SCENARIO_AIB", sub: "AIB_MEZZI", col: "#c0392b", sigla: "SQ", nome: "Altra squadra", tipoBox: "TERRA", size: [48, 30] },
        { id: 41, scenario: "SCENARIO_AIB", sub: "AIB_MEZZI", col: "#c0392b", sigla: "GRP", nome: "Gruppo", tipoBox: "TERRA", size: [50, 30] },
        { id: 42, scenario: "SCENARIO_AIB", sub: "AIB_MEZZI", col: "#c0392b", sigla: "COL", nome: "Colonna", tipoBox: "TERRA", size: [50, 30] },
        { id: 43, scenario: "SCENARIO_AIB", sub: "AIB_MEZZI", col: "#c0392b", sigla: "CP", nome: "Posto di comando", tipoBox: "TERRA", size: [48, 30] },
        { id: 44, scenario: "SCENARIO_AIB", sub: "AIB_MEZZI", col: "#c0392b", sigla: "TP", nome: "Transit point", tipoBox: "TERRA", size: [48, 30] },
        { id: 45, scenario: "SCENARIO_AIB", sub: "AIB_MEZZI", col: "#16a34a", sigla: "SS", nome: "Soccorso sanitario", tipoBox: "SANITARIO", size: [48, 30] },

        { id: 46, scenario: "SCENARIO_AIB", sub: "AIB_AZIONI", col: "#d97706", sigla: "RIT CAN", nome: "Lancio mezzi aerei pesanti con ritardante", tipoBox: "AZIONE", size: [60, 22] },
        { id: 47, scenario: "SCENARIO_AIB", sub: "AIB_AZIONI", col: "#0284c7", sigla: "H2O CAN", nome: "Lancio mezzi aerei pesanti con acqua", tipoBox: "AZIONE", size: [60, 22] },
        { id: 48, scenario: "SCENARIO_AIB", sub: "AIB_AZIONI", col: "#d97706", sigla: "RIT ELI", nome: "Lancio elicotteri medi e leggeri con ritardante", tipoBox: "AZIONE", size: [60, 22] },
        { id: 49, scenario: "SCENARIO_AIB", sub: "AIB_AZIONI", col: "#0284c7", sigla: "H2O ELI", nome: "Lancio elicotteri medi e leggeri con acqua", tipoBox: "AZIONE", size: [60, 22] },
        { id: 50, scenario: "SCENARIO_AIB", sub: "AIB_AZIONI", col: "#2563eb", sigla: "RIC", nome: "Ricognizione", tipoBox: "AZIONE", size: [44, 22] },
        { id: 51, scenario: "SCENARIO_AIB", sub: "AIB_AZIONI", col: "#16a34a", sigla: "EV", nome: "Evacuazione", tipoBox: "AZIONE", size: [44, 22] },
        { id: 52, scenario: "SCENARIO_AIB", sub: "AIB_AZIONI", col: "#c0392b", sigla: "DIF LIN", nome: "Difesa in linea", tipoBox: "AZIONE", size: [58, 22] },
        { id: 53, scenario: "SCENARIO_AIB", sub: "AIB_AZIONI", col: "#c0392b", sigla: "DIF PER", nome: "Difesa perimetrale", tipoBox: "AZIONE", size: [58, 22] },
        { id: 54, scenario: "SCENARIO_AIB", sub: "AIB_AZIONI", col: "#c0392b", sigla: "ATT FIAN", nome: "Attacco sui fianchi", tipoBox: "AZIONE", size: [62, 22] },
        { id: 55, scenario: "SCENARIO_AIB", sub: "AIB_AZIONI", col: "#c0392b", sigla: "ATT LOC", nome: "Attacco localizzato", tipoBox: "AZIONE", size: [60, 22] },
        { id: 56, scenario: "SCENARIO_AIB", sub: "AIB_AZIONI", col: "#0284c7", sigla: "BON", nome: "Bonifica", tipoBox: "AZIONE", size: [48, 22] },
        { id: 57, scenario: "SCENARIO_AIB", sub: "AIB_AZIONI", col: "#d97706", sigla: "LIN SIC", nome: "Creazione linea di sicurezza", tipoBox: "AZIONE", size: [58, 22] },
        { id: 58, scenario: "SCENARIO_AIB", sub: "AIB_AZIONI", col: "#ea580c", sigla: "ACC PT", nome: "Accensione per punti", tipoBox: "AZIONE", size: [58, 22] },
        { id: 59, scenario: "SCENARIO_AIB", sub: "AIB_AZIONI", col: "#ea580c", sigla: "ACC LN", nome: "Accensione per linee", tipoBox: "AZIONE", size: [58, 22] },

        { id: 60, scenario: "SCENARIO_IDRO", sub: "IDRO_AREE_POLIGONO", col: "#c0392b", nome: "Poligono area frana / dissesto (perimetro area)", tag: "POLIGONO", borderStyle: "dashed", borderWidth: "3px", isPolygonTool: true, size: [62, 20] },
        { id: 65, scenario: "SCENARIO_IDRO", sub: "IDRO_AREE_POLIGONO", col: "#c0392b", nome: "Area evacuata / a rischio", tag: "EVAC", solidBg: true, size: [44, 20] },

        { id: 61, scenario: "SCENARIO_IDRO", sub: "IDRO_RETI_IDRAULICA", col: "#0284c7", nome: "Esondazione / allagamento", tag: "ESOND", borderStyle: "dashed", size: [52, 20] },
        { id: 62, scenario: "SCENARIO_IDRO", sub: "IDRO_RETI_IDRAULICA", col: "#ea580c", nome: "Dissesto stradale", tag: "DISS STR", size: [56, 20] },
        { id: 63, scenario: "SCENARIO_IDRO", sub: "IDRO_RETI_IDRAULICA", col: "#b45309", nome: "Occlusione alveo / ponti", tag: "OCCL ALV", size: [58, 20] },
        { id: 64, scenario: "SCENARIO_IDRO", sub: "IDRO_RETI_IDRAULICA", col: "#0369a1", nome: "Idrometro / soglia critica", tag: "IDROM", size: [52, 20] },
        { id: 66, scenario: "SCENARIO_IDRO", sub: "IDRO_RETI_IDRAULICA", col: "#1d4ed8", nome: "Punto di monitoraggio", tag: "MONIT", size: [50, 20] },

        { id: 67, scenario: "SCENARIO_IDRO", sub: "IDRO_COMANDO_FORZE", col: "#1e3a8a", sigla: "COC", nome: "Centro Operativo Comunale (COC)", tipoBox: "TERRA", size: [46, 28] },
        { id: 68, scenario: "SCENARIO_IDRO", sub: "IDRO_COMANDO_FORZE", col: "#1e3a8a", sigla: "CC", nome: "Centro Coordinamento (CC)", tipoBox: "TERRA", size: [44, 28] },
        { id: 69, scenario: "SCENARIO_IDRO", sub: "IDRO_COMANDO_FORZE", col: "#1e3a8a", sigla: "SALA OP", nome: "Sala Operativa", tipoBox: "TERRA", size: [56, 28] },
        { id: 70, scenario: "SCENARIO_IDRO", sub: "IDRO_COMANDO_FORZE", col: "#c0392b", nome: "Cancelli / varchi chiusi", tag: "X VARCO", solidBg: true, size: [54, 20] },
        { id: 71, scenario: "SCENARIO_IDRO", sub: "IDRO_COMANDO_FORZE", col: "#374151", sigla: "SQ ___", nome: "Squadra ___", tipoBox: "TERRA", size: [52, 28] },
        { id: 72, scenario: "SCENARIO_IDRO", sub: "IDRO_COMANDO_FORZE", col: "#1d4ed8", sigla: "POLZI", nome: "Polizia / Polizia Locale (POLZI)", tipoBox: "TERRA", size: [48, 28] },
        { id: 73, scenario: "SCENARIO_IDRO", sub: "IDRO_COMANDO_FORZE", col: "#0f766e", sigla: "RACCOLTA", nome