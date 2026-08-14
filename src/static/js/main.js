import { state } from './state.js';

const COLORS = {
    'Red': '#DA291C',
    'Orange': '#ED8B00',
    'Blue': '#003DA5',
    'Green-B': '#00843D',
    'Green-C': '#00843D',
    'Green-D': '#00843D',
    'Green-E': '#00843D',
    'Mattapan': '#DA291C',
};

function fmtMins(min) {
    if (min == null) return '—';
    const s = Math.round(min * 60);
    return Math.floor(s / 60) + 'm ' + String(s % 60).padStart(2, '0') + 's';
}

function getLineDirections(lineId) {
    const raw = lineDirections[lineId] || '';
    if (!raw) return '';
    const dirAbbrev = { 'North': 'N', 'South': 'S', 'East': 'E', 'West': 'W', 'Inbound': 'In', 'Outbound': 'Out' };
    return raw.split(', ').map(d => dirAbbrev[d] || d).join(', ');
}

// get which station directions are supported by each stop
let stationDirections = {};
let lineDirections = {};


Promise.all([
    fetch('/api/directions').then(r => r.json()),
    fetch('/api/directions_by_line').then(r => r.json()),
]).then(([stationData, lineData]) => {
    stationDirections = stationData;
    lineDirections = lineData;
    renderStopList();
    syncDirAvailability();
});

// Per-station headway stats from the backend, keyed by parent_station id.
// Populated by fetchHeadwayData(); empty until the first API response arrives.
let stationStats = {};

// collect filter state and send to backend
function getFilterState() {
    const selectedStations = Array.from(state.sel).filter(sid => {
        const station = stations.find(s => s.id === sid);
        // exclude stations whose lines are all inactive — avoids inflating the station count
        // sent to the backend and triggering the "skip station filter" shortcut at 125
        if (!station || !station.lines.some(l => state.lines.has(l))) return false;
        const raw = stationDirections[sid] || '';
        if (!raw) return true; // no direction data, include it
        const stationDirs = raw.split(', ');
        return stationDirs.some(d => state.directions.has(d));
    });
    return {
        lines: Array.from(state.lines), // e.g. ["Red", "Green-B", "Orange"]
        glx: state.glx, // "all" | "glx" | "non-glx"
        selectedStations: selectedStations, // e.g. ["place-alfcl", "place-andrw"]
        directions: Array.from(state.directions),
    };
}

// GLX Focus Buttons
document.querySelector('.glx-btns').addEventListener('click', e => {
    const btn = e.target.closest('.glx-btn');
    if (!btn) return;

    state.glx = btn.dataset.v;

    document.querySelectorAll('.glx-btn').forEach(b => {
        b.classList.remove('active', 'glx-active');
        if (b.dataset.v === state.glx) {
            b.classList.add(state.glx === 'glx' ? 'glx-active' : 'active');
        }
    });

    // Apply GLX filter to state.sel within active lines only
    stations.forEach(s => {
        if (!s.lines.some(l => state.lines.has(l))) return; // outside active lines, don't touch
        if (state.glx === 'all')                        state.sel.add(s.id);
        if (state.glx === 'glx'     && !s.isGLX)        state.sel.delete(s.id);
        if (state.glx === 'glx'     &&  s.isGLX)        state.sel.add(s.id);
        if (state.glx === 'non-glx' &&  s.isGLX)        state.sel.delete(s.id);
        if (state.glx === 'non-glx' && !s.isGLX)        state.sel.add(s.id);
    });

    update();
});

// update later
function update() {
    // build lookup table from station name -> lines, from stations array
    const nameToLines = {};
    stations.forEach(s => {
        const key = (s.mapName || s.name).toLowerCase();
        nameToLines[key] = s.lines;
    });

    // fade station text labels based on whether any of their lines are active
    document.querySelectorAll('#labels text').forEach(el => {
        const name = el.textContent.trim().toLowerCase();
        const lines = nameToLines[name];
        if (lines) {
            // station label — use the station's line list
            const active = lines.some(l => state.lines.has(l));
            el.style.opacity = active ? 1 : 0.15;
        } else {
            // branch label or other non-station text — use data-lines attribute directly
            const elLines = (el.getAttribute('data-lines') || '').split(',');
            const active = elLines.some(l => state.lines.has(l));
            el.style.opacity = active ? 1 : 0.15;
        }
    });

    // fade rail line paths based on their data-lines attribute
    document.querySelectorAll('#lines path, #lines line').forEach(el => {
        const elLines = (el.getAttribute('data-lines') || '').split(',');
        const active = elLines.some(l => state.lines.has(l));
        el.style.opacity = active ? 1 : 0.15;
    });

    // fade station circles using data-name to look up lines from stations array
    document.querySelectorAll('#stations circle').forEach(el => {
        const name = (el.getAttribute('data-name') || '').toLowerCase();
        const lines = nameToLines[name];
        if (!lines) { el.style.opacity = 1; return; }
        const active = lines.some(l => state.lines.has(l));
        el.style.opacity = active ? 1 : 0.15;
    });

    // disable GLX buttons if Green-E is unchecked
    const glxSection = document.getElementById('map-GLX-focus');
    if (!state.lines.has('Green-E')) {
        glxSection.style.opacity = '0.4';
        glxSection.style.pointerEvents = 'none';
        state.glx = 'all';
        // restore any GLX stations on active lines back into sel
        stations.forEach(s => {
            if (s.isGLX && s.lines.some(l => state.lines.has(l))) state.sel.add(s.id);
        });
        document.querySelectorAll('.glx-btn').forEach(b => {
            b.classList.remove('active', 'glx-active');
            if (b.dataset.v === 'all') b.classList.add('active');
        });
    } else {
        glxSection.style.opacity = '1';
        glxSection.style.pointerEvents = 'auto';
    }

    // apply GLX filter on top of line filter
    if (state.glx !== 'all') {
        const nameToGLX = {};
        stations.forEach(s => {
            nameToGLX[(s.mapName || s.name).toLowerCase()] = s.isGLX;
        });

        // fade labels
        document.querySelectorAll('#labels text').forEach(el => {
            const name = el.textContent.trim().toLowerCase();
            if (!(name in nameToGLX)) return;
            const isGLX = nameToGLX[name];
            const show = state.glx === 'glx' ? isGLX : !isGLX;
            if (!show) el.style.opacity = 0.15;
        });

        // fade circles
        document.querySelectorAll('#stations circle').forEach(el => {
            const name = (el.getAttribute('data-name') || '').toLowerCase();
            if (!(name in nameToGLX)) return;
            const isGLX = nameToGLX[name];
            const show = state.glx === 'glx' ? isGLX : !isGLX;
            if (!show) el.style.opacity = 0.15;
        });

        // fade line paths using data-glx attribute
        document.querySelectorAll('#lines path').forEach(el => {
            const glx = el.getAttribute('data-glx');
            const isGLX = glx === 'true';  // anything without data-glx defaults to false
            const show = state.glx === 'glx' ? isGLX : !isGLX;
            if (!show) el.style.opacity = 0.15;
        });
    }

    // highlight selected stations in yellow
    document.querySelectorAll('#stations circle').forEach(el => {
        const dataName = (el.getAttribute('data-name') || '').toLowerCase();
        const station = stations.find(s => 
            (s.mapName || s.name).toLowerCase() === dataName ||
            s.name.toLowerCase() === dataName
        );
        if (!station) return;
        const r = parseFloat(el.getAttribute('r'));
        if (r <= 3) return;
        el.setAttribute('fill', state.sel.has(station.id) ? '#ffffff' : '#fff');
    });

    // fade labels of deselected stations
    document.querySelectorAll('#labels text').forEach(el => {
        const name = el.textContent.trim().toLowerCase();
        const station = stations.find(s => 
            (s.mapName || s.name).toLowerCase() === name
        );
        if (!station) return;
        if (!state.sel.has(station.id)) {
            el.style.opacity = 0.15;
        }
    });

    renderStopList();
    syncDirAvailability();
    syncLinesAll();
    syncSelectAll();
    fetchHeadwayData();
}

let _fetchTimer = null;

// Added a 300ms waiting time after user interacts with the filter panel
// to avoid spamming the backend
function fetchHeadwayData() {
    clearTimeout(_fetchTimer);
    _fetchTimer = setTimeout(() => {
        const fs = getFilterState();
        const params = new URLSearchParams({
            lines:    fs.lines.join(','),
            stations: fs.selectedStations.join(','),
            glx:      fs.glx,
            directions: fs.directions.join(','),
        });
        fetch(`/api/headways?${params}`)
            .then(r => r.json())
            .then(data => {
                // Store per-station stats so tooltips can show real data on hover
                stationStats = data.stationData;
                // Compute Filtered Summary from stationData (simple mean of station means)
                // so it stays consistent with the line-level tooltip calculation
                const entries = Object.values(stationStats);
                const n = entries.length;
                const avgHeadway    = n ? entries.reduce((s, e) => s + e.avgHeadway,    0) / n : 0;
                const stddevHeadway = n ? entries.reduce((s, e) => s + e.stddevHeadway, 0) / n : 0;
                const totalTrips    = entries.reduce((s, e) => s + e.trips, 0);
                document.getElementById('stations-visible').textContent = n;
                document.getElementById('average-headway').textContent  = fmtMins(avgHeadway);
                document.getElementById('stddev-headway').textContent   = fmtMins(stddevHeadway);
                document.getElementById('total-trips').textContent      = totalTrips.toLocaleString();
            })
            .catch(err => console.error('Headway fetch failed:', err));
    }, 300);
}

// ── Tooltip ──────────────────────────────────────────────────────────────────

const tooltip = document.getElementById('tooltip');

function showTooltip(e, station) {
    const stats = stationStats[station.id];

    // Build colored circle badges for each line serving this station.
    const badges = station.lines.map(l => {
        const color = COLORS[l] || '#00843D';
        const label = l.startsWith('Green-') ? l.split('-')[1]
                    : l === 'Red' ? 'RL' : l === 'Orange' ? 'OL'
                    : l === 'Blue' ? 'BL' : 'M';
        return `<div class="tt-badge" style="background:${color}">${label}</div>`;
    }).join('');

    const glxBadge = station.isGLX ? '<div class="tt-glx">GREEN LINE EXTENSION</div>' : '';

    // Abbreviate directions
    const dirAbbrev = { 'North': 'N', 'South': 'S', 'East': 'E', 'West': 'W', 'Inbound': 'In', 'Outbound': 'Out' };
    const rawDirs = stationDirections[station.id] || '';
    const dirs = rawDirs.split(', ').map(d => dirAbbrev[d] || d).join(', ');
    const dirLine = dirs ? `<div class="tt-stat"><span class="tt-label">Directions</span><span class="tt-value">${dirs}</span></div>` : '';

    tooltip.innerHTML = `
        <div class="tt-header">
            <span class="tt-name">${station.name}</span>
            <div class="tt-badges">${badges}</div>
        </div>
        <div class="tt-stat"><span class="tt-label">Avg Headway</span><span class="tt-value">${fmtMins(stats?.avgHeadway)}</span></div>
        <div class="tt-stat"><span class="tt-label">Std Dev</span><span class="tt-value">${fmtMins(stats?.stddevHeadway)}</span></div>
        <div class="tt-stat"><span class="tt-label">Daily Trips</span><span class="tt-value">${stats ? stats.trips.toLocaleString() : '—'}</span></div>
        ${dirLine}
        ${glxBadge}
    `;

    tooltip.classList.add('visible');
    moveTooltip(e);
}

function moveTooltip(e) {
    let x = e.clientX + 14, y = e.clientY + 14;
    const r = tooltip.getBoundingClientRect();
    // Flip to the left/above if the tooltip would overflow the viewport edge.
    if (x + r.width  > window.innerWidth  - 10) x = e.clientX - r.width  - 14;
    if (y + r.height > window.innerHeight - 10) y = e.clientY - r.height - 14;
    tooltip.style.left = x + 'px';
    tooltip.style.top  = y + 'px';
}

function hideTooltip() { tooltip.classList.remove('visible'); }

const LINE_DISPLAY_NAMES = {
    'Red':     'Red Line',
    'Orange':  'Orange Line',
    'Blue':    'Blue Line',
    'Green-B': 'Green Line — B Branch',
    'Green-C': 'Green Line — C Branch',
    'Green-D': 'Green Line — D Branch',
    'Green-E': 'Green Line — E Branch',
    'Mattapan':'Mattapan Trolley',
};

function computeLineStats(lineId) {
    const ids = lineStations[lineId] ?? [];
    const total = ids.length;
    const selectedCount = ids.filter(id => state.sel.has(id)).length;
    const withStats = ids.filter(id => stationStats[id]);
    if (!withStats.length) return null;
    const avgHeadway    = withStats.reduce((s, id) => s + stationStats[id].avgHeadway, 0) / withStats.length;
    const stddevHeadway = withStats.reduce((s, id) => s + stationStats[id].stddevHeadway, 0) / withStats.length;
    const trips         = withStats.reduce((s, id) => s + stationStats[id].trips, 0);
    return { avgHeadway, stddevHeadway, trips, activeCount: selectedCount, totalCount: total };
}

function showLineTooltip(e, lineId) {
    const color = COLORS[lineId] ?? '#00843D';
    const displayName = LINE_DISPLAY_NAMES[lineId] ?? lineId;

    // if this line isn't currently selected, show no data immediately
    if (!state.lines.has(lineId)) {
        tooltip.innerHTML = `
            <div class="tt-header tt-line-header" style="border-left: 4px solid ${color}; padding-left: 10px;">
                <span class="tt-name">${displayName}</span>
            </div>
            <div class="tt-stat"><span class="tt-label">No data for current filters</span></div>`;
        tooltip.classList.add('visible');
        moveTooltip(e);
        return;
    }

    const stats = computeLineStats(lineId);
    const lineDirs = getLineDirections(lineId);
    const dirLine = lineDirs ? `<div class="tt-stat"><span class="tt-label">Directions</span><span class="tt-value">${lineDirs}</span></div>` : '';

    const partial = stats && stats.activeCount < stats.totalCount / 2
        ? '<div class="tt-glx">Partial — some stations filtered out</div>'
        : '';

    tooltip.innerHTML = stats
        ? `<div class="tt-header tt-line-header" style="border-left: 4px solid ${color}; padding-left: 10px;">
               <span class="tt-name">${displayName}</span>
           </div>
           <div class="tt-stat"><span class="tt-label">Stations</span><span class="tt-value">${stats.activeCount} of ${stats.totalCount}</span></div>
           <div class="tt-stat"><span class="tt-label">Avg Headway</span><span class="tt-value">${fmtMins(stats.avgHeadway)}</span></div>
           <div class="tt-stat"><span class="tt-label">Std Dev</span><span class="tt-value">${fmtMins(stats.stddevHeadway)}</span></div>
           <div class="tt-stat"><span class="tt-label">Total Trips</span><span class="tt-value">${stats.trips.toLocaleString()}</span></div>
           ${dirLine}
           ${partial}`
        : `<div class="tt-header tt-line-header" style="border-left: 4px solid ${color}; padding-left: 10px;">
               <span class="tt-name">${displayName}</span>
           </div>
           <div class="tt-stat"><span class="tt-label">No data for current filters</span></div>`;

    tooltip.classList.add('visible');
    moveTooltip(e);
}

// ─────────────────────────────────────────────────────────────────────────────

(function() {
  const mapDiv = document.getElementById('map');
  const NS = 'http://www.w3.org/2000/svg';
  const C = { red:'#DA291C', ora:'#ED8B00', blu:'#003DA5', grn:'#00843D' };
  const LW = 8;
  const CR = 15;

  // Create SVG element and append to #map div
  const svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('viewBox', '30 20 1280 1060');
  svg.setAttribute('xmlns', NS);
  mapDiv.appendChild(svg);


  // ═══════════════════════════════════════
  // STATION DATA
  // [name, x, y, labelDir, term, tilt]
  // ═══════════════════════════════════════

  // ═══════ RED LINE ═══════
  const redMain = [
    ['Alewife',           479,161,'l',1, 0],
    ['Davis',             519,201,'l',0, 0],
    ['Porter',            559,241,'l',0, 0],
    ['Harvard',           599,281,'l',0, 0],
    ['Central',           639,321,'l',0, 0],
    ['Kendall/MIT',       679,361,'l',0, 0],
    ['Charles/MGH',       719,401,'l',0, 0],
    ['Park Street',       740,420,'r',0, 0],
    ['Downtown Crossing', 787,462,'r',0, 0],
    ['South Station',     820,500,'r',0, 0],
    ['Broadway',          820,540,'r',0, 0],
    ['Andrew',            820,580,'r',0, 0],
    ['JFK/UMass',         820,620,'r',0, 0],
  ];
  const redAsh = [
    ['JFK/UMass',    820,620,null,0, 0],
    ['Savin Hill',   785,655,'l',0, 0],
    ['Fields Corner',750,690,'l',0, 0],
    ['Shawmut',      715,725,'l',0, 0],
    ['Ashmont',      680,760,'l',1, 0],
  ];
  const redBra = [
    ['JFK/UMass',    820,620,null,0, 0],
    ['North Quincy', 855,655,'r',0, 0],
    ['Wollaston',    890,690,'r',0, 0],
    ['Quincy Center',925,725,'r',0, 0],
    ['Quincy Adams', 960,760,'r',0, 0],
    ['Braintree',    995,795,'r',1, 0],
  ];

  // ═══════ MATTAPAN ═══════
  const matt = [
    ['Ashmont',    680,760,null,0, 0],
    ['Cedar Grove',680,793,'r',0, 0],
    ['Butler',     680,826,'r',0, 0],
    ['Milton',     680,859,'br',0, 0],
    ['Central Ave',650,859,'b',0, -45],
    ['Valley Rd',  620,859,'b',0, -45],
    ['Capen St',   590,859,'b',0, -45],
    ['Mattapan',   560,859,'b',1, -45],
  ];

  // ═══════ ORANGE LINE ═══════
  const oraN = [
    ['Oak Grove',        835, 70,'r',1, 0],
    ['Malden Center',    835,108,'r',0, 0],
    ['Wellington',       835,146,'r',0, 0],
    ['Assembly',         835,184,'r',0, 0],
    ['Sullivan Square',  835,222,'r',0, 0],
    ['Community College',835,260,'r',0, 0],
    ['State',            835,415,'br',0, 0],
  ];
  const oraHub = [
    ['North Station', 835,285,'r',0, 0],
    ['Haymarket',     835,340,'r',0, 0],
  ];
  const oraS = [
    ['Downtown Crossing',800,450,null,0, 0],
    ['Chinatown',        765,485,'l',0, 0],
    ['Tufts Medical Ctr',730,520,'r',0, 0],
    ['Back Bay',         695,555,'r',0, 0],
    ['Massachusetts Ave',660,590,'r',0, 0],
    ['Ruggles',          625,625,'r',0, 0],
    ['Roxbury Crossing', 590,660,'r',0, 0],
    ['Jackson Square',   555,695,'r',0, 0],
    ['Stony Brook',      520,730,'r',0, 0],
    ['Green Street',     485,765,'r',0, 0],
    ['Forest Hills',     450,800,'r',1, 0],
  ];

  // ═══════ BLUE LINE ═══════
  const blu = [
    ['Bowdoin',        720,310,'l',1, 0],
    ['Government Ctr', 778,365,null,0, 0],
    ['State',          835,420,null,0, 0],
    ['Aquarium',       870,405,'r',0, 0],
    ['Maverick',       910,365,'r',0, 0],
    ['Airport',        950,325,'r',0, 0],
    ['Wood Island',    990,285,'r',0, 0],
    ['Orient Heights',1030,245,'r',0, 0],
    ['Suffolk Downs', 1070,205,'r',0, 0],
    ['Beachmont',     1110,165,'r',0, 0],
    ['Revere Beach',  1150,125,'r',0, 0],
    ['Wonderland',    1190, 85,'r',1, 0],
  ];

  // ═══════ GREEN LINE ═══════
const gEN_upper = [
    ['Medford/Tufts',  627, 75,'r',1, 0],
    ['Ball Square',    655, 105,'r',0, 0],
    ['Magoun Square',  683,135,'r',0, 0],
    ['Gilman Square',  711,165,'r',0, 0],
    ['East Somerville',739,195,'r',0, 0],
    [null,             754,212,null,0, 0],
];
const gEN_lower = [
    [null,             754,212,null,0, 0],  // branch point
    ['Lechmere',       766,225,'r',0, 0],
];
  const gDU = [
    [null,           752,212,null,0, 0],  // branch point
    ['Union Square', 700,212,'l',1, 0],
  ];

  const gBCDE = [
    ['Lechmere',             766,225,null,0, 0],
    ['Science Park/West End',793,255,'l',0, 0],
    ['Government Ctr',       787,373,'l',0, 0],
    ['Park Street',          740,420,'r',0, 0],
    ['Boylston',             700,460,'a',0, -45],
    ['Arlington',            660,460,'a',0, -45],
    ['Copley',               620,460,'a',0, -45],
];
const gBCD = [
    ['Copley',               620,460,null,0, 0],  // null so it doesn't re-draw the dot
    ['Hynes Ctr',            580,460,'a',0, -45],
    ['Kenmore',              540,460,'ar',0, -45],
];
  const gHub = [
    ['North Station',820,285,'l',0, 0],
    ['Haymarket',    820,340,'l',0, 0],
  ];
  const gES = [
    ['Copley',               620,460,null,0, 0],
    ['Prudential',           620,493,'l',0, 0],
    ['Symphony',             620,526,'l',0, 0],
    ['Northeastern',         595,551,'l',0, 0],
    ['Museum of Fine Arts',  570,576,'l',0, 0],
    ['Longwood Medical Area',545,601,'l',0, 0],
    ['Brigham Circle',       520,626,'l',0, 0],
    ['Fenwood Rd',           495,650,'l',0, 0],
    ['Mission Park',         470,675,'l',0, 0],
    ['Riverway',             445,700,'l',0, 0],
    ['Back of the Hill',     420,725,'l',0, 0],
    ['Heath Street',         395,750,'l',1, 0],
  ];
  const gB = [
    ['Kenmore',          540,460,null,0, 0],
    ['Blandford St',     513,430,'ar',0, 0],
    ['BU East',          486,400,'ar',0, 0],
    ['BU Central',       459,370,'ar',0, 0],
    ['Amory St',         432,340,'ar',0, 0],
    ['Babcock St',       405,310,'ar',0, 0],
    ["Packard's Corner", 378,280,'ar',0, 0],
    ['Harvard Ave',      351,250,'b',0, -45],
    ['Griggs St',        324,250,'b',0, -45],
    ['Allston St',       297,250,'b',0, -45],
    ['Warren St',        270,250,'b',0, -45],
    ['Washington St',    243,250,'b',0, -45],
    ['Sutherland Rd',    216,250,'b',0, -45],
    ['Chiswick Rd',      189,250,'b',0, -45],
    ['Chestnut Hill Ave',162,250,'b',0, -45],
    ['South St',         135,250,'b',0, -45],
    ['Boston College',   105,250,'b',1, -45],
  ];
  const gC = [
    ['Kenmore',         540,460,null,0, 0],
    ["St. Mary's St",   470,460,'b',0, 0],
    ['Hawes St',        443,430,'b',0, -45],
    ['Kent St',         416,400,'b',0, -45],
    ['St. Paul St',     386,400,'b',0, -45],
    ['Coolidge Corner', 356,400,'b',0, -45],
    ['Summit Ave',      326,400,'b',0, -45],
    ['Brandon Hall',    296,400,'b',0, -45],
    ['Fairbanks St',    266,400,'b',0, -45],
    ['Washington Sq',   236,400,'b',0, -45],
    ['Tappan St',       206,400,'b',0, -45],
    ['Dean Rd',         176,400,'b',0, -45],
    ['Englewood Ave',   146,400,'b',0, -45],
    ['Cleveland Circle',116,400,'b',1, -45],
  ];
  const gD = [
    ['Kenmore',           540,460,null,0, 0],
    ['Fenway',            515,485,'l',0, 0],
    ['Longwood',          490,510,'l',0, 0],
    ['Brookline Village', 465,535,'l',0, 0],
    ['Brookline Hills',   440,560,'l',0, 0],
    ['Beaconsfield',      415,585,'l',0, 0],
    ['Reservoir',         390,610,'l',0, 0],
    ['Chestnut Hill',     365,635,'l',0, 0],
    ['Newton Centre',     340,660,'l',0, 0],
    ['Newton Highlands',  315,685,'l',0, 0],
    ['Eliot',             290,710,'l',0, 0],
    ['Waban',             265,735,'l',0, 0],
    ['Woodland',          240,760,'l',0, 0],
    ['Riverside',         215,785,'l',1, 0],
  ];

  // ═══════════════════════════════════════
  // RENDERING HELPERS
  // ═══════════════════════════════════════
  function el(tag, attrs) {
    const e = document.createElementNS(NS, tag);
    for (const [k,v] of Object.entries(attrs)) e.setAttribute(k,v);
    return e;
  }

  const gLineLayer = el('g',{id:'lines'});
  const gStationLayer = el('g',{id:'stations'});
  const gLabelLayer = el('g',{id:'labels'});
  svg.append(gLineLayer, gStationLayer, gLabelLayer);

  const bentCoords = new Map();

  function smoothPath(pts, r) {
    if (pts.length < 2) return '';
    let d = `M${pts[0][0]},${pts[0][1]}`;
    for (let i = 1; i < pts.length - 1; i++) {
      const [x0,y0]=pts[i-1], [x1,y1]=pts[i], [x2,y2]=pts[i+1];
      const d1=Math.hypot(x1-x0,y1-y0), d2=Math.hypot(x2-x1,y2-y1);
      const cr=Math.min(r, d1/2, d2/2);
      const p1x=x1-cr*(x1-x0)/d1, p1y=y1-cr*(y1-y0)/d1;
      const p2x=x1+cr*(x2-x1)/d2, p2y=y1+cr*(y2-y1)/d2;
      const mx=(p1x+2*x1+p2x)/4, my=(p1y+2*y1+p2y)/4;
      bentCoords.set(`${x1},${y1}`, [mx, my]);
      d += ` L${p1x},${p1y} Q${x1},${y1} ${p2x},${p2y}`;
    }
    return d + ` L${pts[pts.length-1][0]},${pts[pts.length-1][1]}`;
  }

  function drawPoly(arr, color, layer, opts={}) {
    const pts = arr.map(s=>[s[1],s[2]]);
    drawPath(smoothPath(pts, CR), color, layer, opts);
  }

  function drawPath(d, color, layer, opts={}) {
    const a = { d, fill:'none', stroke:color, 'stroke-width':opts.w||LW,
        'stroke-linecap':'round','stroke-linejoin':'round' };
    if (opts.dash) a['stroke-dasharray'] = opts.dash;
    if (opts.lines) a['data-lines'] = opts.lines;
    if (opts.glx !== undefined) a['data-glx'] = opts.glx;
    (layer||gLineLayer).appendChild(el('path',a));
  }

  const drawnElements = new Map();

function drawStations(arr, color, lineName) {
    for (const [name,x,y,ld,tm,tilt] of arr) {
      if (ld===null) continue;
      const k=`${x},${y}`;

      // If already drawn, append this line to existing elements
      if (drawnElements.has(k)) {
        const els = drawnElements.get(k);
        els.forEach(e => {
          const existing = e.getAttribute('data-lines') || '';
          if (!existing.split(',').includes(lineName)) {
            e.setAttribute('data-lines', existing + ',' + lineName);
          }
        });
        continue;
      }

      const tracked = [];
      const [sx,sy] = bentCoords.get(`${x},${y}`) || [x,y];

      let hitTarget;
      if (tm) {
        const c1 = el('circle',{cx:sx,cy:sy,r:7.5,fill:'#ffffff',stroke:color,'stroke-width':3,'data-lines':lineName,'data-name':name});
        const c2 = el('circle',{cx:sx,cy:sy,r:3,fill:color,'data-lines':lineName,'data-name':name});
        c2.style.pointerEvents = 'none'; // let events fall through to c1 so tooltip fires anywhere on the dot
        gStationLayer.appendChild(c1);
        gStationLayer.appendChild(c2);
        tracked.push(c1, c2);
        hitTarget = c1;
    } else {
        const c = el('circle',{cx:sx,cy:sy,r:4,fill:'#ffffff',stroke:color,'stroke-width':2,'data-lines':lineName,'data-name':name});
        gStationLayer.appendChild(c);
        tracked.push(c);
        hitTarget = c;
    }

      // Attach tooltip listeners. The stations array is declared later in the file so we
      // defer the lookup to mouseenter time (always after full script execution).
      if (hitTarget) {
        hitTarget.style.cursor = 'pointer';
        hitTarget.addEventListener('mouseenter', e => {
            const stationObj = stations.find(s => (s.mapName || s.name) === name);
            if (stationObj) showTooltip(e, stationObj);
        });
        hitTarget.addEventListener('mousemove',  moveTooltip);
        hitTarget.addEventListener('mouseleave', hideTooltip);

        // make stations selectable by clicking on circles
        hitTarget.addEventListener('click', e => {
          e.stopPropagation(); // don't bubble to map pan handler
          const stationObj = stations.find(s => (s.mapName || s.name) === name);
          if (!stationObj) return;

          // Respect the same "disabled" rule as the sidebar checkboxes:
          // a station can only be toggled if at least one of its lines is active.
          const isActive = stationObj.lines.some(l => state.lines.has(l))
              && (state.glx === 'all' || (state.glx === 'glx' && stationObj.isGLX) || (state.glx === 'non-glx' && !stationObj.isGLX));
          if (!isActive) return;

          if (state.sel.has(stationObj.id)) state.sel.delete(stationObj.id);
          else state.sel.add(stationObj.id);

          update(); // update() already calls renderStopList() + syncSelectAll() etc.
      });
      }

      let tx=sx,ty=sy,anc='start',dy='0.35em';
      const g=11;
      switch(ld){
        case 'r':  tx+=g; break;
        case 'l':  tx-=g; anc='end'; break;
        case 'a':  ty-=g; anc='middle'; dy='0em'; break;
        case 'b':  ty+=g+4; anc='middle'; dy='0em'; break;
        case 'ar': tx+=g-2; ty-=g; dy='0em'; break;
        case 'al': tx-=g-2; ty-=g; anc='end'; dy='0em'; break;
        case 'br': tx+=g; ty+=g+4; dy='0em'; break;
        case 'bl': tx-=g; ty+=g+4; anc='end'; dy='0em'; break;
      }

      if (tilt) {
        const extra = 3;
        if (ld === 'b') ty += extra;
        else if (ld === 'a') ty -= extra;
        else if (ld === 'r') tx += extra;
        else if (ld === 'l') tx -= extra;
      }

      if (tilt && ld === 'b') anc = 'end';
      if (tilt && ld === 'a') anc = 'start';

      const fs = tm ? 10.5 : 8.5;
      const fw = tm ? '700' : '400';
      const attrs = {x:tx, y:ty, 'text-anchor':anc, 'font-size':fs, 'font-weight':fw, fill:'#222', dy, 'data-lines':lineName};
      if (tilt) {
        attrs.transform = `rotate(${tilt}, ${tx}, ${ty})`;
      }
      const t = el('text', attrs);
      t.textContent = name;
      gLabelLayer.appendChild(t);
      tracked.push(t);

      drawnElements.set(k, tracked);
    }
  }

  // ═══════════════════════════════════════
  // DRAW EVERYTHING
  // ═══════════════════════════════════════

  // ── 1. LINE PATHS ──
  drawPoly(gEN_upper, C.grn, gLineLayer, {lines:'Green-E', glx:'true'});
  drawPoly(gEN_lower, C.grn, gLineLayer, {lines:'Green-D,Green-E', glx:'false'});
  drawPoly(gDU, C.grn, gLineLayer, {lines:'Green-D', glx:'false'});

  // Lechmere → Gov Ctr via North Station/Haymarket — D and E only
  const gDEHub = [
      ...gBCDE.slice(0, 2), // Lechmere, Science Park
      ...gHub,               // North Station, Haymarket
      gBCDE[2],              // Government Ctr
  ];
  drawPoly(gDEHub, C.grn, gLineLayer, {lines:'Green-D,Green-E'});

  // Government Ctr → Copley — all four branches
  const gBCDECopley = gBCDE.slice(2); // Gov Ctr through Copley
  drawPoly(gBCDECopley, C.grn, gLineLayer, {lines:'Green-B,Green-C,Green-D,Green-E'});
  drawPoly(gBCD, C.grn, gLineLayer, {lines:'Green-B,Green-C,Green-D'});

  drawPoly(gES, C.grn, gLineLayer, {lines:'Green-E', glx:'false'});
  drawPoly(gB, C.grn, gLineLayer, {lines:'Green-B'});
  drawPoly(gC, C.grn, gLineLayer, {lines:'Green-C'});
  drawPoly(gD, C.grn, gLineLayer, {lines:'Green-D'});

  drawPoly(redMain, C.red, gLineLayer, {lines:'Red'});
  drawPoly(redAsh, C.red, gLineLayer, {lines:'Red'});
  drawPoly(redBra, C.red, gLineLayer, {lines:'Red'});
  drawPoly(matt, C.red, gLineLayer, {dash:'10 6', lines:'Mattapan'});

  const oraNFull = [...oraN, ...oraHub].sort((a, b) => a[2] - b[2]);
  drawPoly([...oraNFull, ...oraS], C.ora, gLineLayer, {lines:'Orange'});

  drawPoly(blu, C.blu, gLineLayer, {lines:'Blue'});

  // Green and Orange North station and Haymarket connections
  [285, 340].forEach(y => {
    const line = el('line', {
      x1: 820, y1: y, x2: 835, y2: y,
      stroke: '#333', 'stroke-width': 3, 'stroke-linecap': 'round',
      'data-lines': 'Orange,Green-D,Green-E'
    });
    gStationLayer.appendChild(line);
  });

  // ── 2. STATION DOTS + LABELS ──
  drawStations(gEN_upper, C.grn, 'Green-E');
  drawStations(gEN_lower, C.grn, 'Green-D,Green-E');
  drawStations(gDU, C.grn, 'Green-D');
  drawStations(gBCDE, C.grn, 'Green-B,Green-C,Green-D,Green-E');
  drawStations(gHub,  C.grn, 'Green-D,Green-E');
  drawStations(gBCD,  C.grn, 'Green-B,Green-C,Green-D');
  drawStations(gES, C.grn, 'Green-E');
  drawStations(gB, C.grn, 'Green-B');
  drawStations(gC, C.grn, 'Green-C');
  drawStations(gD, C.grn, 'Green-D');

  drawStations(redMain, C.red, 'Red');
  drawStations(redAsh, C.red, 'Red');
  drawStations(redBra, C.red, 'Red');
  drawStations(matt, C.red, 'Mattapan');

  drawStations(oraN, C.ora, 'Orange');
  drawStations(oraHub, C.ora, 'Orange');
  drawStations(oraS, C.ora, 'Orange');

  drawStations(blu, C.blu, 'Blue');

  // ── 3. BRANCH LABELS ──
  [
    ['RED LINE',    460,140, C.red, 'Red'],
    ['MATTAPAN',    510,865, C.red, 'Mattapan'],
    ['ORANGE LINE', 840,50,  C.ora, 'Orange'],
    ['BLUE LINE',  1240,60,  C.blu, 'Blue'],
    ['GREEN-E',     630,50,  C.grn, 'Green-E'],
    ['GREEN-B',     105,220, C.grn, 'Green-B'],
    ['GREEN-C',     120,380, C.grn, 'Green-C'],
    ['GREEN-D',     215,810, C.grn, 'Green-D'],
  ].forEach(([t,x,y,c,line])=>{
    const e=el('text',{x,y,'text-anchor':'middle','font-size':10,'font-weight':'800',fill:c,'letter-spacing':'1px','data-lines':line,'class':'line-label','data-line-id':line});
    e.textContent=t;
    gLabelLayer.appendChild(e);
  });

})();

// direction filter
document.querySelectorAll('.dir-cb').forEach(cb => {
    cb.addEventListener('change', () => {
        if (cb.checked) state.directions.add(cb.value);
        else state.directions.delete(cb.value);
        // pruneStationsByDirection();
        syncDirsAll(); // keep "all" in sync
        update();
    });
});

// Initialize active lines from checked boxes
state.lines = new Set(
  Array.from(document.querySelectorAll('.lc:checked')).map(cb => cb.value)
);

// Listen for changes
document.querySelectorAll('.lc').forEach(cb => {
  cb.addEventListener('change', () => {
    if (cb.checked) {
      state.lines.add(cb.value);
      // When a line is newly checked, re-add all its stations
      stations.forEach(s => {
        if (s.lines.includes(cb.value)) state.sel.add(s.id);
      });
      // re-enable directions that are now available again
      state.sel.forEach(sid => {
          const station = stations.find(s => s.id === sid);
          if (!station || !station.lines.some(l => state.lines.has(l))) return;
          const raw = stationDirections[sid] || '';
          if (!raw) return;
          raw.split(', ').forEach(d => state.directions.add(d));
      });
    } else {
      state.lines.delete(cb.value);
    }
    syncLinesAll(); // keep "all" in sync
    update();
  });
});

// ── Lines "All" checkbox ──
const linesAllCb = document.getElementById('lines-all');

linesAllCb.addEventListener('change', () => {
    document.querySelectorAll('.lc').forEach(cb => {
        cb.checked = linesAllCb.checked;
        if (linesAllCb.checked) {
            state.lines.add(cb.value);
            stations.forEach(s => {
                if (s.lines.includes(cb.value)) state.sel.add(s.id);
            });
        } else {
            state.lines.delete(cb.value);
        }
    });
    // re-add all directions when all lines are turned back on
    if (linesAllCb.checked) {
        ["North", "South", "East", "West", "Inbound", "Outbound"].forEach(d => state.directions.add(d));
    }
    update();
});

// Keep lines-all in sync with individual line checkboxes
function syncLinesAll() {
    const cbs = Array.from(document.querySelectorAll('.lc'));
    linesAllCb.checked = cbs.every(c => c.checked);
}

document.getElementById('station-search-input').addEventListener('input', e => {
    state.search = e.target.value.toLowerCase();
    renderStopList();
});

const stations = [
    { id: "place-alfcl",  name: "Alewife",                    lines: ["Red"],     isGLX: false },
    { id: "place-alsgr",  name: "Allston Street",             mapName: "Allston St",        lines: ["Green-B"], isGLX: false },
    { id: "place-amory",  name: "Amory Street",               mapName: "Amory St",          lines: ["Green-B"], isGLX: false },
    { id: "place-andrw",  name: "Andrew",                     lines: ["Red"],     isGLX: false },
    { id: "place-aport",  name: "Airport",                    lines: ["Blue"],    isGLX: false },
    { id: "place-aqucl",  name: "Aquarium",                   lines: ["Blue"],    isGLX: false },
    { id: "place-armnl",  name: "Arlington",                  lines: ["Green-B", "Green-C", "Green-D", "Green-E"], isGLX: false },
    { id: "place-asmnl",  name: "Ashmont",                    lines: ["Red"],     isGLX: false },
    { id: "place-astao",  name: "Assembly",                   lines: ["Orange"],  isGLX: false },
    { id: "place-babck",  name: "Babcock Street",             mapName: "Babcock St",        lines: ["Green-B"], isGLX: false },
    { id: "place-balsq",  name: "Ball Square",                lines: ["Green-E"], isGLX: true  },
    { id: "place-bbsta",  name: "Back Bay",                   lines: ["Orange"],  isGLX: false },
    { id: "place-bckhl",  name: "Back of the Hill",           lines: ["Green-E"], isGLX: false },
    { id: "place-bcnfd",  name: "Beaconsfield",               lines: ["Green-D"], isGLX: false },
    { id: "place-bcnwa",  name: "Washington Square",          mapName: "Washington Sq",     lines: ["Green-C"], isGLX: false },
    { id: "place-bland",  name: "Blandford Street",           mapName: "Blandford St",      lines: ["Green-B"], isGLX: false },
    { id: "place-bmmnl",  name: "Beachmont",                  lines: ["Blue"],    isGLX: false },
    { id: "place-bndhl",  name: "Brandon Hall",               lines: ["Green-C"], isGLX: false },
    { id: "place-bomnl",  name: "Bowdoin",                    lines: ["Blue"],    isGLX: false },
    { id: "place-boyls",  name: "Boylston",                   lines: ["Green-B", "Green-C", "Green-D", "Green-E"], isGLX: false },
    { id: "place-brdwy",  name: "Broadway",                   lines: ["Red"],     isGLX: false },
    { id: "place-brico",  name: "Packard's Corner",           lines: ["Green-B"], isGLX: false },
    { id: "place-brkhl",  name: "Brookline Hills",            lines: ["Green-D"], isGLX: false },
    { id: "place-brmnl",  name: "Brigham Circle",             lines: ["Green-E"], isGLX: false },
    { id: "place-brntn",  name: "Braintree",                  lines: ["Red"],     isGLX: false },
    { id: "place-bucen",  name: "Boston University Central",  mapName: "BU Central",        lines: ["Green-B"], isGLX: false },
    { id: "place-buest",  name: "Boston University East",     mapName: "BU East",           lines: ["Green-B"], isGLX: false },
    { id: "place-butlr",  name: "Butler",                     lines: ["Mattapan"],isGLX: false },
    { id: "place-bvmnl",  name: "Brookline Village",          lines: ["Green-D"], isGLX: false },
    { id: "place-capst",  name: "Capen Street",               mapName: "Capen St",          lines: ["Mattapan"], isGLX: false },
    { id: "place-ccmnl",  name: "Community College",          lines: ["Orange"],  isGLX: false },
    { id: "place-cedgr",  name: "Cedar Grove",                lines: ["Mattapan"],isGLX: false },
    { id: "place-cenav",  name: "Central Avenue",             mapName: "Central Ave",       lines: ["Mattapan"], isGLX: false },
    { id: "place-chhil",  name: "Chestnut Hill",              lines: ["Green-D"], isGLX: false },
    { id: "place-chill",  name: "Chestnut Hill Avenue",       mapName: "Chestnut Hill Ave", lines: ["Green-B"], isGLX: false },
    { id: "place-chmnl",  name: "Charles/MGH",                lines: ["Red"],     isGLX: false },
    { id: "place-chncl",  name: "Chinatown",                  lines: ["Orange"],  isGLX: false },
    { id: "place-chswk",  name: "Chiswick Road",              mapName: "Chiswick Rd",       lines: ["Green-B"], isGLX: false },
    { id: "place-clmnl",  name: "Cleveland Circle",           lines: ["Green-C"], isGLX: false },
    { id: "place-cntsq",  name: "Central",                    lines: ["Red"],     isGLX: false },
    { id: "place-coecl",  name: "Copley",                     lines: ["Green-B", "Green-C", "Green-D", "Green-E"], isGLX: false },
    { id: "place-cool",   name: "Coolidge Corner",            lines: ["Green-C"], isGLX: false },
    { id: "place-davis",  name: "Davis",                      lines: ["Red"],     isGLX: false },
    { id: "place-denrd",  name: "Dean Road",                  mapName: "Dean Rd",           lines: ["Green-C"], isGLX: false },
    { id: "place-dwnxg",  name: "Downtown Crossing",          lines: ["Red", "Orange"], isGLX: false },
    { id: "place-eliot",  name: "Eliot",                      lines: ["Green-D"], isGLX: false },
    { id: "place-engav",  name: "Englewood Avenue",           mapName: "Englewood Ave",     lines: ["Green-C"], isGLX: false },
    { id: "place-esomr",  name: "East Somerville",            lines: ["Green-E"], isGLX: true  },
    { id: "place-fbkst",  name: "Fairbanks Street",           mapName: "Fairbanks St",      lines: ["Green-C"], isGLX: false },
    { id: "place-fenwd",  name: "Fenwood Road",               mapName: "Fenwood Rd",        lines: ["Green-E"], isGLX: false },
    { id: "place-fenwy",  name: "Fenway",                     lines: ["Green-D"], isGLX: false },
    { id: "place-fldcr",  name: "Fields Corner",              lines: ["Red"],     isGLX: false },
    { id: "place-forhl",  name: "Forest Hills",               lines: ["Orange"],  isGLX: false },
    { id: "place-gilmn",  name: "Gilman Square",              lines: ["Green-E"], isGLX: true  },
    { id: "place-gover",  name: "Government Center",          mapName: "Government Ctr",    lines: ["Blue", "Green-B", "Green-C", "Green-D", "Green-E"], isGLX: false },
    { id: "place-grigg",  name: "Griggs Street",              mapName: "Griggs St",         lines: ["Green-B"], isGLX: false },
    { id: "place-grnst",  name: "Green Street",               lines: ["Orange"],  isGLX: false },
    { id: "place-haecl",  name: "Haymarket",                  lines: ["Orange", "Green-D", "Green-E"], isGLX: false },
    { id: "place-harsq",  name: "Harvard",                    lines: ["Red"],     isGLX: false },
    { id: "place-harvd",  name: "Harvard Avenue",             mapName: "Harvard Ave",       lines: ["Green-B"], isGLX: false },
    { id: "place-hsmnl",  name: "Heath Street",               lines: ["Green-E"], isGLX: false },
    { id: "place-hwsst",  name: "Hawes Street",               mapName: "Hawes St",          lines: ["Green-C"], isGLX: false },
    { id: "place-hymnl",  name: "Hynes Convention Center",    mapName: "Hynes Ctr",         lines: ["Green-B", "Green-C", "Green-D"], isGLX: false },
    { id: "place-jaksn",  name: "Jackson Square",             lines: ["Orange"],  isGLX: false },
    { id: "place-jfk",    name: "JFK/UMass",                  lines: ["Red"],     isGLX: false },
    { id: "place-kencl",  name: "Kenmore",                    lines: ["Green-B", "Green-C", "Green-D"], isGLX: false },
    { id: "place-knncl",  name: "Kendall/MIT",                lines: ["Red"],     isGLX: false },
    { id: "place-kntst",  name: "Kent Street",                mapName: "Kent St",           lines: ["Green-C"], isGLX: false },
    { id: "place-lake",   name: "Boston College",             lines: ["Green-B"], isGLX: false },
    { id: "place-lech",   name: "Lechmere",                   lines: ["Green-D","Green-E"], isGLX: false },
    { id: "place-lngmd",  name: "Longwood Medical Area",      lines: ["Green-E"], isGLX: false },
    { id: "place-longw",  name: "Longwood",                   lines: ["Green-D"], isGLX: false },
    { id: "place-masta",  name: "Massachusetts Avenue",       mapName: "Massachusetts Ave", lines: ["Orange"],  isGLX: false },
    { id: "place-matt",   name: "Mattapan",                   lines: ["Mattapan"],isGLX: false },
    { id: "place-mdftf",  name: "Medford/Tufts",              lines: ["Green-E"], isGLX: true  },
    { id: "place-mfa",    name: "Museum of Fine Arts",        lines: ["Green-E"], isGLX: false },
    { id: "place-mgngl",  name: "Magoun Square",              lines: ["Green-E"], isGLX: true  },
    { id: "place-miltt",  name: "Milton",                     lines: ["Mattapan"],isGLX: false },
    { id: "place-mispk",  name: "Mission Park",               lines: ["Green-E"], isGLX: false },
    { id: "place-mlmnl",  name: "Malden Center",              lines: ["Orange"],  isGLX: false },
    { id: "place-mvbcl",  name: "Maverick",                   lines: ["Blue"],    isGLX: false },
    { id: "place-newtn",  name: "Newton Highlands",           lines: ["Green-D"], isGLX: false },
    { id: "place-newto",  name: "Newton Centre",              lines: ["Green-D"], isGLX: false },
    { id: "place-north",  name: "North Station",              lines: ["Orange", "Green-D", "Green-E"], isGLX: false },
    { id: "place-nqncy",  name: "North Quincy",               lines: ["Red"],     isGLX: false },
    { id: "place-nuniv",  name: "Northeastern University",    mapName: "Northeastern",      lines: ["Green-E"], isGLX: false },
    { id: "place-ogmnl",  name: "Oak Grove",                  lines: ["Orange"],  isGLX: false },
    { id: "place-orhte",  name: "Orient Heights",             lines: ["Blue"],    isGLX: false },
    { id: "place-pktrm",  name: "Park Street",                lines: ["Red", "Green-B", "Green-C", "Green-D", "Green-E"], isGLX: false },
    { id: "place-portr",  name: "Porter",                     lines: ["Red"],     isGLX: false },
    { id: "place-prmnl",  name: "Prudential",                 lines: ["Green-E"], isGLX: false },
    { id: "place-qamnl",  name: "Quincy Adams",               lines: ["Red"],     isGLX: false },
    { id: "place-qnctr",  name: "Quincy Center",              lines: ["Red"],     isGLX: false },
    { id: "place-rbmnl",  name: "Revere Beach",               lines: ["Blue"],    isGLX: false },
    { id: "place-rcmnl",  name: "Roxbury Crossing",           lines: ["Orange"],  isGLX: false },
    { id: "place-river",  name: "Riverside",                  lines: ["Green-D"], isGLX: false },
    { id: "place-rsmnl",  name: "Reservoir",                  lines: ["Green-D"], isGLX: false },
    { id: "place-rugg",   name: "Ruggles",                    lines: ["Orange"],  isGLX: false },
    { id: "place-rvrwy",  name: "Riverway",                   lines: ["Green-E"], isGLX: false },
    { id: "place-sbmnl",  name: "Stony Brook",                lines: ["Orange"],  isGLX: false },
    { id: "place-sdmnl",  name: "Suffolk Downs",              lines: ["Blue"],    isGLX: false },
    { id: "place-shmnl",  name: "Savin Hill",                 lines: ["Red"],     isGLX: false },
    { id: "place-smary",  name: "Saint Mary's Street",        mapName: "St. Mary's St",     lines: ["Green-C"], isGLX: false },
    { id: "place-smmnl",  name: "Shawmut",                    lines: ["Red"],     isGLX: false },
    { id: "place-sougr",  name: "South Street",               mapName: "South St",          lines: ["Green-B"], isGLX: false },
    { id: "place-spmnl",  name: "Science Park/West End",      lines: ["Green-D","Green-E"], isGLX: false },
    { id: "place-sstat",  name: "South Station",              lines: ["Red"],     isGLX: false },
    { id: "place-state",  name: "State",                      lines: ["Orange", "Blue"], isGLX: false },
    { id: "place-sthld",  name: "Sutherland Road",            mapName: "Sutherland Rd",     lines: ["Green-B"], isGLX: false },
    { id: "place-stpul",  name: "Saint Paul Street",          mapName: "St. Paul St",       lines: ["Green-C"], isGLX: false },
    { id: "place-sull",   name: "Sullivan Square",            lines: ["Orange"],  isGLX: false },
    { id: "place-sumav",  name: "Summit Avenue",              mapName: "Summit Ave",        lines: ["Green-C"], isGLX: false },
    { id: "place-symcl",  name: "Symphony",                   lines: ["Green-E"], isGLX: false },
    { id: "place-tapst",  name: "Tappan Street",              mapName: "Tappan St",         lines: ["Green-C"], isGLX: false },
    { id: "place-tumnl",  name: "Tufts Medical Center",       mapName: "Tufts Medical Ctr", lines: ["Orange"],  isGLX: false },
    { id: "place-unsqu",  name: "Union Square",               lines: ["Green-D"], isGLX: false },
    { id: "place-valrd",  name: "Valley Road",                mapName: "Valley Rd",         lines: ["Mattapan"], isGLX: false },
    { id: "place-waban",  name: "Waban",                      lines: ["Green-D"], isGLX: false },
    { id: "place-wascm",  name: "Washington Street",          mapName: "Washington St",     lines: ["Green-B"], isGLX: false },
    { id: "place-welln",  name: "Wellington",                 lines: ["Orange"],  isGLX: false },
    { id: "place-wimnl",  name: "Wood Island",                lines: ["Blue"],    isGLX: false },
    { id: "place-wlsta",  name: "Wollaston",                  lines: ["Red"],     isGLX: false },
    { id: "place-wondl",  name: "Wonderland",                 lines: ["Blue"],    isGLX: false },
    { id: "place-woodl",  name: "Woodland",                   lines: ["Green-D"], isGLX: false },
    { id: "place-wrnst",  name: "Warren Street",              mapName: "Warren St",         lines: ["Green-B"], isGLX: false },
];

// initialize all stations as selected
stations.forEach(s => state.sel.add(s.id));

// build line → [stationId, ...] index for line-level tooltip aggregation
const lineStations = {};
for (const st of stations) {
    for (const ln of st.lines) {
        (lineStations[ln] ??= []).push(st.id);
    }
}

// bind hover events on the branch/line-name labels inside the SVG
document.querySelectorAll('.line-label').forEach(labelEl => {
    labelEl.addEventListener('mouseenter', e => showLineTooltip(e, labelEl.getAttribute('data-line-id')));
    labelEl.addEventListener('mousemove',  moveTooltip);
    labelEl.addEventListener('mouseleave', hideTooltip);
});

function renderStopList() {
    const list = document.getElementById('stop-list');
    const filtered = stations
        .filter(s => s.name.toLowerCase().includes(state.search))
        .sort((a, b) => a.name.localeCompare(b.name));

    list.innerHTML = filtered.map(s => {
        const active = s.lines.some(l => state.lines.has(l)) && (state.glx === 'all' || (state.glx === 'glx' && s.isGLX) || (state.glx === 'non-glx' && !s.isGLX));
        const sel = state.sel.has(s.id) ? 'selected' : '';
        const checked = state.sel.has(s.id) ? 'checked' : '';
        const dimmed = active ? '' : 'dimmed';
        const disabled = active ? '' : 'disabled';
        const dots = s.lines.map(line => {
            const c = COLORS[line] || '#00843D';
            let letter = line.startsWith('Green-') ? line.split('-')[1] : '';
            if (line == 'Mattapan') { letter = 'M'; }
            return `<span class="ld" style="background:${c}">${letter}</span>`;
        }).join('');

        return `<div class="stop-item ${sel} ${dimmed}" data-sid="${s.id}">
            <input type="checkbox" class="stop-checkbox" value="${s.id}" ${checked} ${disabled}>
            ${dots}${s.name}
        </div>`;
    }).join('');
}

document.getElementById('stop-list').addEventListener('click', e => {
    const item = e.target.closest('.stop-item');
    if (!item) return;
    const sid = item.dataset.sid;

    if (state.sel.has(sid)) state.sel.delete(sid);
    else state.sel.add(sid);

    update();
});

document.getElementById('select-all').addEventListener('change', e => {
    const selectAll = e.target.checked;

    stations.forEach(s => {
        if (!s.lines.some(l => state.lines.has(l))) return;
        if (state.glx === 'glx'     && !s.isGLX) return;
        if (state.glx === 'non-glx' &&  s.isGLX) return;
        if (selectAll) state.sel.add(s.id);
        else           state.sel.delete(s.id);
    });

    // when re-selecting all stations, re-add directions for all active lines
    if (selectAll) {
        state.sel.forEach(sid => {
            const station = stations.find(s => s.id === sid);
            if (!station) return;
            station.lines.filter(l => state.lines.has(l)).forEach(lineId => {
                const raw = lineDirections[lineId] || '';
                if (!raw) return;
                raw.split(', ').forEach(d => state.directions.add(d));
            });
        });
    }

    update();
});

// ── Directions "All" checkbox ──
const dirsAllCb = document.getElementById('directions-all');

dirsAllCb.addEventListener('change', () => {
    document.querySelectorAll('.dir-cb').forEach(cb => {
        if (cb.disabled) return; // skip unavailable directions
        cb.checked = dirsAllCb.checked;
        if (dirsAllCb.checked) state.directions.add(cb.value);
        else state.directions.delete(cb.value);
    });
    // pruneStationsByDirection();
    update();
});

// Keep directions-all in sync with individual direction checkboxes
function syncDirsAll() {
    const enabledCbs = Array.from(document.querySelectorAll('.dir-cb')).filter(c => !c.disabled); // only consider available options
    dirsAllCb.checked = enabledCbs.length > 0 && enabledCbs.every(c => c.checked);
}

function syncDirAvailability() {
    const availableDirs = new Set();

    state.sel.forEach(sid => {
        const station = stations.find(s => s.id === sid);
        if (!station) return;
        // only consider lines that are both serving this station AND active
        const activeLines = station.lines.filter(l => state.lines.has(l));
        if (!activeLines.length) return;

        // only add directions that at least one active line at this station serves
        activeLines.forEach(lineId => {
            const raw = lineDirections[lineId] || '';
            if (!raw) return;
            raw.split(', ').forEach(d => availableDirs.add(d));
        });
    });

    document.querySelectorAll('.dir-cb').forEach(cb => {
        const available = availableDirs.has(cb.value);
        cb.disabled = !available;
        cb.checked = available && state.directions.has(cb.value);
        if (!available) state.directions.delete(cb.value);
        const label = cb.closest('label');
        if (label) label.style.opacity = available ? '1' : '0.35';
    });

    const dirsLabel = dirsAllCb.closest('label');
    if (availableDirs.size === 0) {
        dirsAllCb.disabled = true;
        if (dirsLabel) dirsLabel.style.opacity = '0.35';
    } else {
        dirsAllCb.disabled = false;
        if (dirsLabel) dirsLabel.style.opacity = '1';
    }

    syncDirsAll();
}

// ── Zoom & Pan (map only, filter panel unaffected) ──
const mapDiv = document.getElementById('map');
const svg = mapDiv.querySelector('svg');

let vb = { x: 30, y: 20, w: 1280, h: 1060 }; 
let isPanning = false;
let panStart = { x: 0, y: 0 };

mapDiv.addEventListener('wheel', (e) => {
  e.preventDefault();
  const scale = e.deltaY > 0 ? 1.1 : 0.9;

  const rect = svg.getBoundingClientRect();
  const mx = (e.clientX - rect.left) / rect.width;
  const my = (e.clientY - rect.top) / rect.height;

  const newW = vb.w * scale;
  const newH = vb.h * scale;
  vb.x += (vb.w - newW) * mx;
  vb.y += (vb.h - newH) * my;
  vb.w = newW;
  vb.h = newH;

  svg.setAttribute('viewBox', `${vb.x} ${vb.y} ${vb.w} ${vb.h}`);
}, { passive: false });

mapDiv.addEventListener('mousedown', (e) => {
  isPanning = true;
  panStart = { x: e.clientX, y: e.clientY };
  mapDiv.style.cursor = 'grabbing';
});

window.addEventListener('mousemove', (e) => {
  if (!isPanning) return;
  const dx = (e.clientX - panStart.x) * (vb.w / mapDiv.clientWidth);
  const dy = (e.clientY - panStart.y) * (vb.h / mapDiv.clientHeight);
  vb.x -= dx;
  vb.y -= dy;
  panStart = { x: e.clientX, y: e.clientY };
  svg.setAttribute('viewBox', `${vb.x} ${vb.y} ${vb.w} ${vb.h}`);
});

window.addEventListener('mouseup', () => {
  isPanning = false;
  mapDiv.style.cursor = 'default';
});

// Double-click to reset
mapDiv.addEventListener('dblclick', () => {
  vb = { x: 30, y: 20, w: 1280, h: 1060 };
  svg.setAttribute('viewBox', `${vb.x} ${vb.y} ${vb.w} ${vb.h}`);
});

function syncSelectAll() {
    const selectAllCb = document.getElementById('select-all');
    const hasLines = state.lines.size > 0;

    // respect GLX filter when determining which stations are "in scope"
    const activeStations = stations.filter(s => {
        if (!s.lines.some(l => state.lines.has(l))) return false;
        if (state.glx === 'glx'     && !s.isGLX) return false;
        if (state.glx === 'non-glx' &&  s.isGLX) return false;
        return true;
    });

    selectAllCb.disabled = !hasLines;
    selectAllCb.checked = hasLines && activeStations.length > 0 && activeStations.every(s => state.sel.has(s.id));
    const item = document.getElementById('select-all-item');
    if (item) item.style.opacity = hasLines ? '1' : '0.35';
}

// Initial render
renderStopList();
fetchHeadwayData();

// ── Info button / popup ──
const infoBtn = document.getElementById('info-btn');
const infoPopup = document.getElementById('info-popup');
const infoClose = document.getElementById('info-popup-close');

infoBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    infoPopup.classList.toggle('is-hidden');
});

infoClose.addEventListener('click', () => {
    infoPopup.classList.add('is-hidden');
});

document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') infoPopup.classList.add('is-hidden');
});

document.addEventListener('click', (e) => {
    if (!infoPopup.contains(e.target) && e.target !== infoBtn) {
        infoPopup.classList.add('is-hidden');
    }
});

// NOTE:
// For filter by line: a stop should continue being shown as long as there is at least
// one line that it services still checked
// and we want to get the line information from the stations list.

// increase station text size