import { state } from './state.js';
import { stations } from './stationData.js';
import { COLORS } from './tooltips.js';

let onUpdate;
let getStationDirections;
let getLineDirections;

const ALL_DIRECTIONS = ['North', 'South', 'East', 'West', 'Inbound', 'Outbound'];

export function initializeFilters({ update, stationDirections, lineDirections }) {
    onUpdate = update;
    getStationDirections = stationDirections;
    getLineDirections = lineDirections;

    state.lines = new Set(
        Array.from(document.querySelectorAll('.lc:checked')).map(cb => cb.value)
    );

    document.querySelectorAll('.glx-btn').forEach(btn => {
        btn.addEventListener('click', handleGlxClick);
    });

    document.querySelectorAll('.dir-cb').forEach(cb => {
        cb.addEventListener('change', () => {
            if (cb.checked) state.directions.add(cb.value);
            else state.directions.delete(cb.value);

            syncDirsAll();
            onUpdate();
        });
    });

    document.querySelectorAll('.lc').forEach(cb => {
        cb.addEventListener('change', () => {
            if (cb.checked) {
                state.lines.add(cb.value);

                stations.forEach(s => {
                    if (s.lines.includes(cb.value)) state.sel.add(s.id);
                });

                state.sel.forEach(sid => {
                    const station = stations.find(s => s.id === sid);
                    if (!station || !station.lines.some(l => state.lines.has(l))) return;

                    const raw = getStationDirections()[sid] || '';
                    if (!raw) return;

                    raw.split(', ').forEach(d => state.directions.add(d));
                });
            } else {
                state.lines.delete(cb.value);
            }

            syncLinesAll();
            onUpdate();
        });
    });

    document.getElementById('lines-all').addEventListener('change', handleLinesAll);
    document.getElementById('station-search-input').addEventListener('input', e => {
        state.search = e.target.value.toLowerCase();
        renderStopList();
    });

    document.getElementById('stop-list').addEventListener('click', handleStationClick);
    document.getElementById('select-all').addEventListener('change', handleSelectAll);
    document.getElementById('directions-all').addEventListener('change', handleDirectionsAll);
}

function handleGlxClick(e) {
    const btn = e.target.closest('.glx-btn');
    if (!btn) return;

    state.glx = btn.dataset.v;

    document.querySelectorAll('.glx-btn').forEach(b => {
        b.classList.remove('active', 'glx-active');

        if (b.dataset.v === state.glx) {
            b.classList.add(state.glx === 'glx' ? 'glx-active' : 'active');
        }
    });

    stations.forEach(s => {
        if (!s.lines.some(l => state.lines.has(l))) return;

        if (state.glx === 'all') state.sel.add(s.id);
        if (state.glx === 'glx' && !s.isGLX) state.sel.delete(s.id);
        if (state.glx === 'glx' && s.isGLX) state.sel.add(s.id);
        if (state.glx === 'non-glx' && s.isGLX) state.sel.delete(s.id);
        if (state.glx === 'non-glx' && !s.isGLX) state.sel.add(s.id);
    });

    onUpdate();
}

function handleLinesAll() {
    const checked = document.getElementById('lines-all').checked;

    document.querySelectorAll('.lc').forEach(cb => {
        cb.checked = checked;

        if (checked) {
            state.lines.add(cb.value);

            stations.forEach(s => {
                if (s.lines.includes(cb.value)) state.sel.add(s.id);
            });
        } else {
            state.lines.delete(cb.value);
        }
    });

    if (checked) {
        ALL_DIRECTIONS.forEach(d => state.directions.add(d));
    }

    onUpdate();
}

function handleStationClick(e) {
    const item = e.target.closest('.stop-item');
    if (!item) return;

    const sid = item.dataset.sid;

    if (state.sel.has(sid)) state.sel.delete(sid);
    else state.sel.add(sid);

    onUpdate();
}

function handleSelectAll(e) {
    const selectAll = e.target.checked;

    stations.forEach(s => {
        if (!s.lines.some(l => state.lines.has(l))) return;
        if (state.glx === 'glx' && !s.isGLX) return;
        if (state.glx === 'non-glx' && s.isGLX) return;

        if (selectAll) state.sel.add(s.id);
        else state.sel.delete(s.id);
    });

    if (selectAll) {
        state.sel.forEach(sid => {
            const station = stations.find(s => s.id === sid);
            if (!station) return;

            station.lines
                .filter(l => state.lines.has(l))
                .forEach(lineId => {
                    const raw = getLineDirections()[lineId] || '';
                    if (!raw) return;
                    raw.split(', ').forEach(d => state.directions.add(d));
                });
        });
    }

    onUpdate();
}

function handleDirectionsAll() {
    const checked = document.getElementById('directions-all').checked;

    document.querySelectorAll('.dir-cb').forEach(cb => {
        if (cb.disabled) return;

        cb.checked = checked;

        if (checked) state.directions.add(cb.value);
        else state.directions.delete(cb.value);
    });

    onUpdate();
}

export function getFilterState() {
    const selectedStations = Array.from(state.sel).filter(sid => {
        const station = stations.find(s => s.id === sid);

        if (!station || !station.lines.some(l => state.lines.has(l))) {
            return false;
        }

        const raw = getStationDirections()[sid] || '';
        if (!raw) return true;

        return raw.split(', ').some(d => state.directions.has(d));
    });

    return {
        lines: Array.from(state.lines),
        glx: state.glx,
        selectedStations,
        directions: Array.from(state.directions)
    };
}

export function renderStopList() {
    const list = document.getElementById('stop-list');

    const filtered = stations
        .filter(s => s.name.toLowerCase().includes(state.search))
        .sort((a, b) => a.name.localeCompare(b.name));

    list.innerHTML = filtered.map(s => {
        const active =
            s.lines.some(l => state.lines.has(l)) &&
            (
                state.glx === 'all' ||
                (state.glx === 'glx' && s.isGLX) ||
                (state.glx === 'non-glx' && !s.isGLX)
            );

        const sel = state.sel.has(s.id) ? 'selected' : '';
        const checked = state.sel.has(s.id) ? 'checked' : '';
        const dimmed = active ? '' : 'dimmed';
        const disabled = active ? '' : 'disabled';

        const dots = s.lines.map(line => {
            const c = COLORS[line] || '#00843D';
            let letter = line.startsWith('Green-') ? line.split('-')[1] : '';
            if (line === 'Mattapan') letter = 'M';

            return `<span class="ld" style="background:${c}">${letter}</span>`;
        }).join('');

        return `
            <div class="stop-item ${sel} ${dimmed}" data-sid="${s.id}">
                <input type="checkbox" class="stop-checkbox" value="${s.id}" ${checked} ${disabled}>
                ${dots}${s.name}
            </div>
        `;
    }).join('');
}

export function syncLinesAll() {
    const cbs = Array.from(document.querySelectorAll('.lc'));
    document.getElementById('lines-all').checked = cbs.every(c => c.checked);
}

export function syncDirsAll() {
    const dirsAllCb = document.getElementById('directions-all');
    const enabledCbs = Array.from(document.querySelectorAll('.dir-cb')).filter(c => !c.disabled);

    dirsAllCb.checked =
        enabledCbs.length > 0 &&
        enabledCbs.every(c => c.checked);
}

export function syncDirAvailability() {
    const availableDirs = new Set();

    state.sel.forEach(sid => {
        const station = stations.find(s => s.id === sid);
        if (!station) return;

        const activeLines = station.lines.filter(l => state.lines.has(l));
        if (!activeLines.length) return;

        activeLines.forEach(lineId => {
            const raw = getLineDirections()[lineId] || '';
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

    const dirsAllCb = document.getElementById('directions-all');
    const dirsLabel = dirsAllCb.closest('label');

    dirsAllCb.disabled = availableDirs.size === 0;

    if (dirsLabel) {
        dirsLabel.style.opacity = availableDirs.size === 0 ? '0.35' : '1';
    }

    syncDirsAll();
}

export function syncSelectAll() {
    const selectAllCb = document.getElementById('select-all');
    const hasLines = state.lines.size > 0;

    const activeStations = stations.filter(s => {
        if (!s.lines.some(l => state.lines.has(l))) return false;
        if (state.glx === 'glx' && !s.isGLX) return false;
        if (state.glx === 'non-glx' && s.isGLX) return false;
        return true;
    });

    selectAllCb.disabled = !hasLines;
    selectAllCb.checked =
        hasLines &&
        activeStations.length > 0 &&
        activeStations.every(s => state.sel.has(s.id));

    const item = document.getElementById('select-all-item');
    if (item) item.style.opacity = hasLines ? '1' : '0.35';
}