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

    const AIB_WMS_URL = "https://gis.dw-cmvc.neratech.cloud/ows/?MAP=/io/projects/05.anticendio_boschivo/dwh_antincendio_boschivo.qgz";

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
        },
        {
            id: "aib_acqua",
            label: "AIB Vallecamonica — Punti acqua, idranti e vasche",
            attribution: "CM Valle Camonica / AIB",
            type: "wms",
            url: AIB_WMS_URL,
            wmsLayers: "bocchetta_aib,idranti,vasche,presa2,sorgente,bacino_edison,acquedotti_aib",
            defaultOn: false,
            defaultOpacity: 0.85
        },
        {
            id: "aib_viabilita",
            label: "AIB Vallecamonica — Viabilità, sentieri e piazzole",
            attribution: "CM Valle Camonica / AIB",
            type: "wms",
            url: AIB_WMS_URL,
            wmsLayers: "piazzole_elicottero,viabilita_principale,viab_second,mulattiere_e_sentieri_pedonali",
            defaultOn: false,
            defaultOpacity: 0.80
        },
        {
            id: "aib_reti_confini",
            label: "AIB Vallecamonica — Linee elettriche, Oglio e confini",
            attribution: "CM Valle Camonica / AIB",
            type: "wms",
            url: AIB_WMS_URL,
            wmsLayers: "lineel,oglio,comuni",
            defaultOn: false,
            defaultOpacity: 0.75
        },
        {
            id: "aib_incendi_cam",
            label: "AIB Vallecamonica — Incendi e videocamere",
            attribution: "CM Valle Camonica / AIB",
            type: "wms",
            url: AIB_WMS_URL,
            wmsLayers: "incendi,localizzazione_incendio,videocamera",
            defaultOn: false,
            defaultOpacity: 0.85
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
        { id: 29, scenario: "SCENARIO_AIB", sub: "AIB_EVOLUZIONE", col: "#7c2d12", nome: "Incendio sotterraneo", svgType: "FIRE_GROUND", size: [54, 22