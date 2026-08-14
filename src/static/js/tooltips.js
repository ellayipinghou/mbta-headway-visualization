import { state } from './state.js';
import { stations } from './stationData.js';

export const COLORS = {
    Red: '#DA291C',
    Orange: '#ED8B00',
    Blue: '#003DA5',
    'Green-B': '#00843D',
    'Green-C': '#00843D',
    'Green-D': '#00843D',
    'Green-E': '#00843D',
    Mattapan: '#DA291C'
};

const LINE_DISPLAY_NAMES = {
    Red: 'Red Line',
    Orange: 'Orange Line',
    Blue: 'Blue Line',
    'Green-B': 'Green Line — B Branch',
    'Green-C': 'Green Line — C Branch',
    'Green-D': 'Green Line — D Branch',
    'Green-E': 'Green Line — E Branch',
    Mattapan: 'Mattapan Trolley'
};

// Data is populated by main.js after the API responses arrive.
let stationStats = {};
let stationDirections = {};
let lineDirections = {};

export function setStationStats(stats) {
    stationStats = stats || {};
}

export function setDirectionData(stationData, lineData) {
    stationDirections = stationData || {};
    lineDirections = lineData || {};
}

const tooltip = document.getElementById('tooltip');

function fmtMins(min) {
    if (min == null) return '—';

    const s = Math.round(min * 60);
    return Math.floor(s / 60) + 'm ' + String(s % 60).padStart(2, '0') + 's';
}

export function showTooltip(e, station) {
    if (!station) return;

    const stats = stationStats[station.id];

    const badges = station.lines.map(line => {
        const color = COLORS[line] || '#00843D';
        let label;

        if (line.startsWith('Green-')) {
            label = line.split('-')[1];
        } else if (line === 'Red') {
            label = 'RL';
        } else if (line === 'Orange') {
            label = 'OL';
        } else if (line === 'Blue') {
            label = 'BL';
        } else {
            label = 'M';
        }

        return `
            <div class="tt-badge" style="background:${color}">
                ${label}
            </div>
        `;
    }).join('');

    const glxBadge = station.isGLX
        ? '<div class="tt-glx">GREEN LINE EXTENSION</div>'
        : '';

    const dirAbbrev = {
        North: 'N',
        South: 'S',
        East: 'E',
        West: 'W',
        Inbound: 'In',
        Outbound: 'Out'
    };

    const rawDirs = stationDirections[station.id] || '';

    const dirs = rawDirs
        ? rawDirs.split(', ').map(d => dirAbbrev[d] || d).join(', ')
        : '';

    const dirLine = dirs
        ? `
            <div class="tt-stat">
                <span class="tt-label">Directions</span>
                <span class="tt-value">${dirs}</span>
            </div>
        `
        : '';

    tooltip.innerHTML = `
        <div class="tt-header">
            <span class="tt-name">${station.name}</span>
            <div class="tt-badges">${badges}</div>
        </div>

        <div class="tt-stat">
            <span class="tt-label">Avg Headway</span>
            <span class="tt-value">${fmtMins(stats?.avgHeadway)}</span>
        </div>

        <div class="tt-stat">
            <span class="tt-label">Std Dev</span>
            <span class="tt-value">${fmtMins(stats?.stddevHeadway)}</span>
        </div>

        <div class="tt-stat">
            <span class="tt-label">Daily Trips</span>
            <span class="tt-value">${stats ? stats.trips.toLocaleString() : '—'}</span>
        </div>

        ${dirLine}
        ${glxBadge}
    `;

    tooltip.classList.add('visible');
    moveTooltip(e);
}

const lineStations = {};

for (const station of stations) {
    for (const line of station.lines) {
        (lineStations[line] ??= []).push(station.id);
    }
}

// Abbreviate direction names for use in tooltip displays.
function getLineDirections(lineId) {
    const raw = lineDirections[lineId] || '';
    if (!raw) return '';

    const dirAbbrev = {
        North: 'N',
        South: 'S',
        East: 'E',
        West: 'W',
        Inbound: 'In',
        Outbound: 'Out'
    };

    return raw.split(', ').map(d => dirAbbrev[d] || d).join(', ');
}

function computeLineStats(lineId) {
    const ids = lineStations[lineId] ?? [];
    const total = ids.length;
    const selectedCount = ids.filter(id => state.sel.has(id)).length;
    const withStats = ids.filter(id => stationStats[id]);

    if (!withStats.length) return null;

    const avgHeadway =
        withStats.reduce((sum, id) => sum + stationStats[id].avgHeadway, 0) /
        withStats.length;

    const stddevHeadway =
        withStats.reduce((sum, id) => sum + stationStats[id].stddevHeadway, 0) /
        withStats.length;

    const trips =
        withStats.reduce((sum, id) => sum + stationStats[id].trips, 0);

    return {
        avgHeadway,
        stddevHeadway,
        trips,
        activeCount: selectedCount,
        totalCount: total
    };
}

export function showLineTooltip(e, lineId) {
    const color = COLORS[lineId] || '#00843D';
    const displayName = LINE_DISPLAY_NAMES[lineId] || lineId;

    // Inactive lines have no statistics under the current filter state.
    if (!state.lines.has(lineId)) {
        tooltip.innerHTML = `
            <div class="tt-header tt-line-header"
                 style="border-left:4px solid ${color};padding-left:10px">
                <span class="tt-name">${displayName}</span>
            </div>

            <div class="tt-stat">
                <span class="tt-label">No data for current filters</span>
            </div>
        `;

        tooltip.classList.add('visible');
        moveTooltip(e);
        return;
    }

    const stats = computeLineStats(lineId);
    const lineDirs = getLineDirections(lineId);

    const dirLine = lineDirs
        ? `
            <div class="tt-stat">
                <span class="tt-label">Directions</span>
                <span class="tt-value">${lineDirs}</span>
            </div>
        `
        : '';

    const partial =
        stats && stats.activeCount < stats.totalCount / 2
            ? `
                <div class="tt-glx">
                    Partial — some stations filtered out
                </div>
            `
            : '';

    tooltip.innerHTML = stats
        ? `
            <div class="tt-header tt-line-header"
                 style="border-left:4px solid ${color};padding-left:10px">
                <span class="tt-name">${displayName}</span>
            </div>

            <div class="tt-stat">
                <span class="tt-label">Stations</span>
                <span class="tt-value">${stats.activeCount} of ${stats.totalCount}</span>
            </div>

            <div class="tt-stat">
                <span class="tt-label">Avg Headway</span>
                <span class="tt-value">${fmtMins(stats.avgHeadway)}</span>
            </div>

            <div class="tt-stat">
                <span class="tt-label">Std Dev</span>
                <span class="tt-value">${fmtMins(stats.stddevHeadway)}</span>
            </div>

            <div class="tt-stat">
                <span class="tt-label">Total Trips</span>
                <span class="tt-value">${stats.trips.toLocaleString()}</span>
            </div>

            ${dirLine}
            ${partial}
        `
        : `
            <div class="tt-header tt-line-header"
                 style="border-left:4px solid ${color};padding-left:10px">
                <span class="tt-name">${displayName}</span>
            </div>

            <div class="tt-stat">
                <span class="tt-label">No data for current filters</span>
            </div>
        `;

    tooltip.classList.add('visible');
    moveTooltip(e);
}

export function moveTooltip(e) {
    if (!tooltip) return;

    let x = e.clientX + 14;
    let y = e.clientY + 14;
    const r = tooltip.getBoundingClientRect();

    if (x + r.width > window.innerWidth - 10) {
        x = e.clientX - r.width - 14;
    }

    if (y + r.height > window.innerHeight - 10) {
        y = e.clientY - r.height - 14;
    }

    tooltip.style.left = x + 'px';
    tooltip.style.top = y + 'px';
}

export function hideTooltip() {
    if (!tooltip) return;
    tooltip.classList.remove('visible');
}