import { state } from './state.js';
import { stations } from './stationData.js';
import { initializeMap } from './map.js';
import { fetchDirections, fetchDirectionsByLine, fetchHeadways } from './api.js';
import { setStationStats, setDirectionData } from './tooltips.js';
import { initializeFilters, getFilterState, renderStopList, syncDirAvailability, syncLinesAll, syncSelectAll } from './filters.js';

let stationDirections = {};
let lineDirections = {};
let stationStats = {};

// Convert a headway in minutes into a readable minutes/seconds format.
function fmtMins(min) {
    if (min == null) return '—';
    const s = Math.round(min * 60);
    return Math.floor(s / 60) + 'm ' + String(s % 60).padStart(2, '0') + 's';
}

// Fetch filtered headway data and update the map/tooltip statistics.
function fetchHeadwayData() {
    clearTimeout(fetchHeadwayData.timer);

    fetchHeadwayData.timer = setTimeout(async () => {
        try {
            const fs = getFilterState();
            const data = await fetchHeadways(fs);

            stationStats = data.stationData;
            setStationStats(stationStats);
            setDirectionData(stationDirections, lineDirections);

            const entries = Object.values(stationStats);
            const n = entries.length;

            const avgHeadway = n
                ? entries.reduce((sum, e) => sum + e.avgHeadway, 0) / n
                : 0;

            const stddevHeadway = n
                ? entries.reduce((sum, e) => sum + e.stddevHeadway, 0) / n
                : 0;

            const totalTrips = entries.reduce((sum, e) => sum + e.trips, 0);

            document.getElementById('stations-visible').textContent = n;
            document.getElementById('average-headway').textContent = fmtMins(avgHeadway);
            document.getElementById('stddev-headway').textContent = fmtMins(stddevHeadway);
            document.getElementById('total-trips').textContent = totalTrips.toLocaleString();
        } catch (err) {
            console.error('Headway fetch failed:', err);
        }
    }, 300);
}

// Apply the current filters to map elements and refresh dependent UI/data.
function update() {
    const nameToLines = {};

    stations.forEach(s => {
        const key = (s.mapName || s.name).toLowerCase();
        nameToLines[key] = s.lines;
    });

    // Fade labels for stations whose lines are inactive.
    document.querySelectorAll('#labels text').forEach(el => {
        const name = el.textContent.trim().toLowerCase();
        const lines = nameToLines[name];

        if (lines) {
            const active = lines.some(l => state.lines.has(l));
            el.style.opacity = active ? 1 : 0.15;
        } else {
            const elLines = (el.getAttribute('data-lines') || '').split(',');
            const active = elLines.some(l => state.lines.has(l));
            el.style.opacity = active ? 1 : 0.15;
        }
    });

    // Fade rail segments that do not belong to an active line.
    document.querySelectorAll('#lines path, #lines line').forEach(el => {
        const elLines = (el.getAttribute('data-lines') || '').split(',');
        const active = elLines.some(l => state.lines.has(l));
        el.style.opacity = active ? 1 : 0.15;
    });

    // Fade station markers whose lines are inactive.
    document.querySelectorAll('#stations circle').forEach(el => {
        const name = (el.getAttribute('data-name') || '').toLowerCase();
        const lines = nameToLines[name];

        if (!lines) {
            el.style.opacity = 1;
            return;
        }

        const active = lines.some(l => state.lines.has(l));
        el.style.opacity = active ? 1 : 0.15;
    });

    // Disable the GLX filter when Green-E is not selected.
    const glxSection = document.getElementById('map-GLX-focus');

    if (!state.lines.has('Green-E')) {
        glxSection.style.opacity = '0.4';
        glxSection.style.pointerEvents = 'none';
        state.glx = 'all';

        stations.forEach(s => {
            if (s.isGLX && s.lines.some(l => state.lines.has(l))) {
                state.sel.add(s.id);
            }
        });

        document.querySelectorAll('.glx-btn').forEach(b => {
            b.classList.remove('active', 'glx-active');

            if (b.dataset.v === 'all') {
                b.classList.add('active');
            }
        });
    } else {
        glxSection.style.opacity = '1';
        glxSection.style.pointerEvents = 'auto';
    }

    // Apply the GLX/non-GLX filter to stations, labels, and rail segments.
    if (state.glx !== 'all') {
        const nameToGLX = {};

        stations.forEach(s => {
            nameToGLX[(s.mapName || s.name).toLowerCase()] = s.isGLX;
        });

        document.querySelectorAll('#labels text').forEach(el => {
            const name = el.textContent.trim().toLowerCase();
            if (!(name in nameToGLX)) return;

            const isGLX = nameToGLX[name];
            const show = state.glx === 'glx' ? isGLX : !isGLX;

            if (!show) el.style.opacity = 0.15;
        });

        document.querySelectorAll('#stations circle').forEach(el => {
            const name = (el.getAttribute('data-name') || '').toLowerCase();
            if (!(name in nameToGLX)) return;

            const isGLX = nameToGLX[name];
            const show = state.glx === 'glx' ? isGLX : !isGLX;

            if (!show) el.style.opacity = 0.15;
        });

        document.querySelectorAll('#lines path').forEach(el => {
            const isGLX = el.getAttribute('data-glx') === 'true';
            const show = state.glx === 'glx' ? isGLX : !isGLX;

            if (!show) el.style.opacity = 0.15;
        });
    }

    // Highlight selected stations while preserving the map's transfer styling.
    document.querySelectorAll('#stations circle').forEach(el => {
        const dataName = (el.getAttribute('data-name') || '').toLowerCase();

        const station = stations.find(s =>
            (s.mapName || s.name).toLowerCase() === dataName ||
            s.name.toLowerCase() === dataName
        );

        if (!station) return;

        const r = parseFloat(el.getAttribute('r'));
        if (r <= 3) return;

        el.setAttribute(
            'fill',
            state.sel.has(station.id) ? '#ffffff' : '#fff'
        );
    });

    // Dim labels for stations that are not currently selected.
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

// Load direction metadata before rendering the dependent filter state.
Promise.all([
    fetchDirections(),
    fetchDirectionsByLine()
]).then(([stationData, lineData]) => {
    stationDirections = stationData;
    lineDirections = lineData;

    setDirectionData(stationDirections);

    renderStopList();
    syncDirAvailability();
    fetchHeadwayData();
});

// Let filters access direction metadata without creating circular dependencies.
initializeFilters({
    update,
    stationDirections: () => stationDirections,
    lineDirections: () => lineDirections
});

// Start with every station selected, then render the map and filter UI.
stations.forEach(s => state.sel.add(s.id));

initializeMap({ update });

renderStopList();
fetchHeadwayData();

// Handle opening, closing, and dismissing the information popup.
const infoBtn = document.getElementById('info-btn');
const infoPopup = document.getElementById('info-popup');
const infoClose = document.getElementById('info-popup-close');

infoBtn.addEventListener('click', e => {
    e.stopPropagation();
    infoPopup.classList.toggle('is-hidden');
});

infoClose.addEventListener('click', () => {
    infoPopup.classList.add('is-hidden');
});

document.addEventListener('keydown', e => {
    if (e.key === 'Escape') {
        infoPopup.classList.add('is-hidden');
    }
});

document.addEventListener('click', e => {
    if (!infoPopup.contains(e.target) && e.target !== infoBtn) {
        infoPopup.classList.add('is-hidden');
    }
});