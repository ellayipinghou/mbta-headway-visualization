import { state } from './state.js';
import { stations } from './data.js';
import { initializeMap } from './map.js';

import {
    setStationStats,
    setDirectionData,
    COLORS
} from './tooltips.js';


// ─────────────────────────────────────────────────────────────────────────────
// FORMATTING / DIRECTIONS
// ─────────────────────────────────────────────────────────────────────────────

function fmtMins(min) {
    if (min == null) return '—';

    const s = Math.round(min * 60);

    return (
        Math.floor(s / 60) +
        'm ' +
        String(s % 60).padStart(2, '0') +
        's'
    );
}


let stationDirections = {};
let lineDirections = {};


function getLineDirections(lineId) {
    const raw =
        lineDirections[lineId] || '';

    if (!raw) return '';

    const dirAbbrev = {
        'North': 'N',
        'South': 'S',
        'East': 'E',
        'West': 'W',
        'Inbound': 'In',
        'Outbound': 'Out'
    };

    return raw
        .split(', ')
        .map(
            d => dirAbbrev[d] || d
        )
        .join(', ');
}


// ─────────────────────────────────────────────────────────────────────────────
// DIRECTIONS API
// ─────────────────────────────────────────────────────────────────────────────

Promise.all([
    fetch('/api/directions')
        .then(r => r.json()),

    fetch('/api/directions_by_line')
        .then(r => r.json())
])
.then(
    ([stationData, lineData]) => {

        stationDirections =
            stationData;

        lineDirections =
            lineData;


        // Make the same data available
        // to tooltips.js.
        setDirectionData(
            stationData,
            lineData
        );


        renderStopList();
        syncDirAvailability();
    }
);


// ─────────────────────────────────────────────────────────────────────────────
// HEADWAY DATA
// ─────────────────────────────────────────────────────────────────────────────

let stationStats = {};


function getFilterState() {
    const selectedStations =
        Array.from(state.sel)
            .filter(sid => {

                const station =
                    stations.find(
                        s => s.id === sid
                    );


                // Exclude stations whose
                // lines are all inactive.
                if (
                    !station ||
                    !station.lines.some(
                        l =>
                            state.lines.has(l)
                    )
                ) {
                    return false;
                }


                const raw =
                    stationDirections[sid] ||
                    '';


                if (!raw) return true;


                const stationDirs =
                    raw.split(', ');


                return stationDirs.some(
                    d =>
                        state.directions.has(d)
                );
            });


    return {
        lines:
            Array.from(state.lines),

        glx:
            state.glx,

        selectedStations,

        directions:
            Array.from(state.directions)
    };
}


let _fetchTimer = null;


function fetchHeadwayData() {
    clearTimeout(_fetchTimer);


    _fetchTimer =
        setTimeout(() => {

            const fs =
                getFilterState();


            const params =
                new URLSearchParams({
                    lines:
                        fs.lines.join(','),

                    stations:
                        fs.selectedStations.join(','),

                    glx:
                        fs.glx,

                    directions:
                        fs.directions.join(',')
                });


            fetch(
                `/api/headways?${params}`
            )
            .then(r => r.json())
            .then(data => {

                stationStats =
                    data.stationData;


                // Make the latest headway data
                // available to tooltips.js.
                setStationStats(
                    stationStats
                );


                const entries =
                    Object.values(
                        stationStats
                    );

                const n =
                    entries.length;


                const avgHeadway =
                    n
                        ? entries.reduce(
                            (s, e) =>
                                s +
                                e.avgHeadway,
                            0
                        ) / n
                        : 0;


                const stddevHeadway =
                    n
                        ? entries.reduce(
                            (s, e) =>
                                s +
                                e.stddevHeadway,
                            0
                        ) / n
                        : 0;


                const totalTrips =
                    entries.reduce(
                        (s, e) =>
                            s + e.trips,
                        0
                    );


                document
                    .getElementById(
                        'stations-visible'
                    )
                    .textContent = n;


                document
                    .getElementById(
                        'average-headway'
                    )
                    .textContent =
                        fmtMins(
                            avgHeadway
                        );


                document
                    .getElementById(
                        'stddev-headway'
                    )
                    .textContent =
                        fmtMins(
                            stddevHeadway
                        );


                document
                    .getElementById(
                        'total-trips'
                    )
                    .textContent =
                        totalTrips.toLocaleString();
            })
            .catch(
                err =>
                    console.error(
                        'Headway fetch failed:',
                        err
                    )
            );

        }, 300);
}


// ─────────────────────────────────────────────────────────────────────────────
// UPDATE
// ─────────────────────────────────────────────────────────────────────────────

function update() {
    const nameToLines = {};


    stations.forEach(s => {
        const key =
            (
                s.mapName ||
                s.name
            ).toLowerCase();

        nameToLines[key] =
            s.lines;
    });


    // ─────────────────────────────────────────────────────────────────────
    // Fade station labels based on active lines.
    // ─────────────────────────────────────────────────────────────────────

    document
        .querySelectorAll(
            '#labels text'
        )
        .forEach(el => {

            const name =
                el.textContent
                    .trim()
                    .toLowerCase();

            const lines =
                nameToLines[name];


            if (lines) {
                const active =
                    lines.some(
                        l =>
                            state.lines.has(l)
                    );

                el.style.opacity =
                    active ? 1 : 0.15;

            } else {
                const elLines =
                    (
                        el.getAttribute(
                            'data-lines'
                        ) || ''
                    ).split(',');


                const active =
                    elLines.some(
                        l =>
                            state.lines.has(l)
                    );


                el.style.opacity =
                    active ? 1 : 0.15;
            }
        });


    // ─────────────────────────────────────────────────────────────────────
    // Fade rail lines.
    // ─────────────────────────────────────────────────────────────────────

    document
        .querySelectorAll(
            '#lines path, #lines line'
        )
        .forEach(el => {

            const elLines =
                (
                    el.getAttribute(
                        'data-lines'
                    ) || ''
                ).split(',');


            const active =
                elLines.some(
                    l =>
                        state.lines.has(l)
                );


            el.style.opacity =
                active ? 1 : 0.15;
        });


    // ─────────────────────────────────────────────────────────────────────
    // Fade station circles.
    // ─────────────────────────────────────────────────────────────────────

    document
        .querySelectorAll(
            '#stations circle'
        )
        .forEach(el => {

            const name =
                (
                    el.getAttribute(
                        'data-name'
                    ) || ''
                ).toLowerCase();


            const lines =
                nameToLines[name];


            if (!lines) {
                el.style.opacity = 1;
                return;
            }


            const active =
                lines.some(
                    l =>
                        state.lines.has(l)
                );


            el.style.opacity =
                active ? 1 : 0.15;
        });


    // ─────────────────────────────────────────────────────────────────────
    // Disable GLX buttons if Green-E
    // is unchecked.
    // ─────────────────────────────────────────────────────────────────────

    const glxSection =
        document.getElementById(
            'map-GLX-focus'
        );


    if (!state.lines.has('Green-E')) {

        glxSection.style.opacity =
            '0.4';

        glxSection.style.pointerEvents =
            'none';


        state.glx = 'all';


        stations.forEach(s => {
            if (
                s.isGLX &&
                s.lines.some(
                    l =>
                        state.lines.has(l)
                )
            ) {
                state.sel.add(s.id);
            }
        });


        document
            .querySelectorAll(
                '.glx-btn'
            )
            .forEach(b => {

                b.classList.remove(
                    'active',
                    'glx-active'
                );


                if (
                    b.dataset.v === 'all'
                ) {
                    b.classList.add(
                        'active'
                    );
                }
            });

    } else {

        glxSection.style.opacity =
            '1';

        glxSection.style.pointerEvents =
            'auto';
    }


    // ─────────────────────────────────────────────────────────────────────
    // Apply GLX filter on top of line
    // filter.
    // ─────────────────────────────────────────────────────────────────────

    if (state.glx !== 'all') {

        const nameToGLX = {};


        stations.forEach(s => {
            nameToGLX[
                (
                    s.mapName ||
                    s.name
                ).toLowerCase()
            ] = s.isGLX;
        });


        document
            .querySelectorAll(
                '#labels text'
            )
            .forEach(el => {

                const name =
                    el.textContent
                        .trim()
                        .toLowerCase();


                if (!(name in nameToGLX)) {
                    return;
                }


                const isGLX =
                    nameToGLX[name];


                const show =
                    state.glx === 'glx'
                        ? isGLX
                        : !isGLX;


                if (!show) {
                    el.style.opacity =
                        0.15;
                }
            });


        document
            .querySelectorAll(
                '#stations circle'
            )
            .forEach(el => {

                const name =
                    (
                        el.getAttribute(
                            'data-name'
                        ) || ''
                    ).toLowerCase();


                if (!(name in nameToGLX)) {
                    return;
                }


                const isGLX =
                    nameToGLX[name];


                const show =
                    state.glx === 'glx'
                        ? isGLX
                        : !isGLX;


                if (!show) {
                    el.style.opacity =
                        0.15;
                }
            });


        document
            .querySelectorAll(
                '#lines path'
            )
            .forEach(el => {

                const glx =
                    el.getAttribute(
                        'data-glx'
                    );


                const isGLX =
                    glx === 'true';


                const show =
                    state.glx === 'glx'
                        ? isGLX
                        : !isGLX;


                if (!show) {
                    el.style.opacity =
                        0.15;
                }
            });
    }


    // ─────────────────────────────────────────────────────────────────────
    // Highlight selected stations.
    // ─────────────────────────────────────────────────────────────────────

    document
        .querySelectorAll(
            '#stations circle'
        )
        .forEach(el => {

            const dataName =
                (
                    el.getAttribute(
                        'data-name'
                    ) || ''
                ).toLowerCase();


            const station =
                stations.find(s =>
                    (
                        s.mapName ||
                        s.name
                    ).toLowerCase() ===
                        dataName ||

                    s.name.toLowerCase() ===
                        dataName
                );


            if (!station) return;


            const r =
                parseFloat(
                    el.getAttribute('r')
                );


            if (r <= 3) return;


            el.setAttribute(
                'fill',
                state.sel.has(
                    station.id
                )
                    ? '#ffffff'
                    : '#fff'
            );
        });


    // ─────────────────────────────────────────────────────────────────────
    // Fade labels of deselected stations.
    // ─────────────────────────────────────────────────────────────────────

    document
        .querySelectorAll(
            '#labels text'
        )
        .forEach(el => {

            const name =
                el.textContent
                    .trim()
                    .toLowerCase();


            const station =
                stations.find(s =>
                    (
                        s.mapName ||
                        s.name
                    ).toLowerCase() ===
                    name
                );


            if (!station) return;


            if (
                !state.sel.has(
                    station.id
                )
            ) {
                el.style.opacity =
                    0.15;
            }
        });


    renderStopList();
    syncDirAvailability();
    syncLinesAll();
    syncSelectAll();
    fetchHeadwayData();
}


// ─────────────────────────────────────────────────────────────────────────────
// GLX FILTER
// ─────────────────────────────────────────────────────────────────────────────

document
    .querySelector('.glx-btns')
    .addEventListener(
        'click',
        e => {

            const btn =
                e.target.closest(
                    '.glx-btn'
                );


            if (!btn) return;


            state.glx =
                btn.dataset.v;


            document
                .querySelectorAll(
                    '.glx-btn'
                )
                .forEach(b => {

                    b.classList.remove(
                        'active',
                        'glx-active'
                    );


                    if (
                        b.dataset.v ===
                        state.glx
                    ) {
                        b.classList.add(
                            state.glx === 'glx'
                                ? 'glx-active'
                                : 'active'
                        );
                    }
                });


            stations.forEach(s => {

                if (
                    !s.lines.some(
                        l =>
                            state.lines.has(l)
                    )
                ) {
                    return;
                }


                if (
                    state.glx === 'all'
                ) {
                    state.sel.add(
                        s.id
                    );
                }


                if (
                    state.glx === 'glx' &&
                    !s.isGLX
                ) {
                    state.sel.delete(
                        s.id
                    );
                }


                if (
                    state.glx === 'glx' &&
                    s.isGLX
                ) {
                    state.sel.add(
                        s.id
                    );
                }


                if (
                    state.glx === 'non-glx' &&
                    s.isGLX
                ) {
                    state.sel.delete(
                        s.id
                    );
                }


                if (
                    state.glx === 'non-glx' &&
                    !s.isGLX
                ) {
                    state.sel.add(
                        s.id
                    );
                }
            });


            update();
        }
    );


// ─────────────────────────────────────────────────────────────────────────────
// DIRECTION FILTER
// ─────────────────────────────────────────────────────────────────────────────

document
    .querySelectorAll('.dir-cb')
    .forEach(cb => {

        cb.addEventListener(
            'change',
            () => {

                if (cb.checked) {
                    state.directions.add(
                        cb.value
                    );
                } else {
                    state.directions.delete(
                        cb.value
                    );
                }


                syncDirsAll();
                update();
            }
        );
    });


// ─────────────────────────────────────────────────────────────────────────────
// LINE FILTER
// ─────────────────────────────────────────────────────────────────────────────

state.lines = new Set(
    Array.from(
        document.querySelectorAll(
            '.lc:checked'
        )
    ).map(
        cb => cb.value
    )
);


document
    .querySelectorAll('.lc')
    .forEach(cb => {

        cb.addEventListener(
            'change',
            () => {

                if (cb.checked) {

                    state.lines.add(
                        cb.value
                    );


                    stations.forEach(s => {
                        if (
                            s.lines.includes(
                                cb.value
                            )
                        ) {
                            state.sel.add(
                                s.id
                            );
                        }
                    });


                    // Re-enable directions
                    // that are now available.

                    state.sel.forEach(
                        sid => {

                            const station =
                                stations.find(
                                    s =>
                                        s.id ===
                                        sid
                                );


                            if (
                                !station ||
                                !station.lines.some(
                                    l =>
                                        state.lines.has(
                                            l
                                        )
                                )
                            ) {
                                return;
                            }


                            const raw =
                                stationDirections[
                                    sid
                                ] || '';


                            if (!raw) return;


                            raw
                                .split(', ')
                                .forEach(
                                    d =>
                                        state
                                            .directions
                                            .add(d)
                                );
                        }
                    );

                } else {

                    state.lines.delete(
                        cb.value
                    );
                }


                syncLinesAll();
                update();
            }
        );
    });


// ─────────────────────────────────────────────────────────────────────────────
// LINES "ALL"
// ─────────────────────────────────────────────────────────────────────────────

const linesAllCb =
    document.getElementById(
        'lines-all'
    );


linesAllCb.addEventListener(
    'change',
    () => {

        document
            .querySelectorAll('.lc')
            .forEach(cb => {

                cb.checked =
                    linesAllCb.checked;


                if (
                    linesAllCb.checked
                ) {

                    state.lines.add(
                        cb.value
                    );


                    stations.forEach(s => {
                        if (
                            s.lines.includes(
                                cb.value
                            )
                        ) {
                            state.sel.add(
                                s.id
                            );
                        }
                    });

                } else {

                    state.lines.delete(
                        cb.value
                    );
                }
            });


        if (
            linesAllCb.checked
        ) {
            [
                'North',
                'South',
                'East',
                'West',
                'Inbound',
                'Outbound'
            ].forEach(
                d =>
                    state.directions.add(d)
            );
        }


        update();
    }
);


function syncLinesAll() {
    const cbs =
        Array.from(
            document.querySelectorAll(
                '.lc'
            )
        );


    linesAllCb.checked =
        cbs.every(
            c => c.checked
        );
}


// ─────────────────────────────────────────────────────────────────────────────
// STATION SEARCH / LIST
// ─────────────────────────────────────────────────────────────────────────────

document
    .getElementById(
        'station-search-input'
    )
    .addEventListener(
        'input',
        e => {

            state.search =
                e.target.value.toLowerCase();

            renderStopList();
        }
    );


function renderStopList() {
    const list =
        document.getElementById(
            'stop-list'
        );


    const filtered =
        stations
            .filter(
                s =>
                    s.name
                        .toLowerCase()
                        .includes(
                            state.search
                        )
            )
            .sort(
                (a, b) =>
                    a.name.localeCompare(
                        b.name
                    )
            );


    list.innerHTML =
        filtered.map(s => {

            const active =
                s.lines.some(
                    l =>
                        state.lines.has(l)
                ) &&
                (
                    state.glx === 'all' ||
                    (
                        state.glx === 'glx' &&
                        s.isGLX
                    ) ||
                    (
                        state.glx === 'non-glx' &&
                        !s.isGLX
                    )
                );


            const sel =
                state.sel.has(s.id)
                    ? 'selected'
                    : '';


            const checked =
                state.sel.has(s.id)
                    ? 'checked'
                    : '';


            const dimmed =
                active
                    ? ''
                    : 'dimmed';


            const disabled =
                active
                    ? ''
                    : 'disabled';


            const dots =
                s.lines
                    .map(line => {

                        const c =
                            COLORS[line] ||
                            '#00843D';


                        let letter =
                            line.startsWith(
                                'Green-'
                            )
                                ? line.split(
                                    '-'
                                )[1]
                                : '';


                        if (
                            line ===
                            'Mattapan'
                        ) {
                            letter = 'M';
                        }


                        return `
                            <span class="ld"
                                  style="background:${c}">
                                ${letter}
                            </span>
                        `;
                    })
                    .join('');


            return `
                <div class="stop-item ${sel} ${dimmed}"
                     data-sid="${s.id}">

                    <input
                        type="checkbox"
                        class="stop-checkbox"
                        value="${s.id}"
                        ${checked}
                        ${disabled}>

                    ${dots}${s.name}
                </div>
            `;
        })
        .join('');
}


document
    .getElementById(
        'stop-list'
    )
    .addEventListener(
        'click',
        e => {

            const item =
                e.target.closest(
                    '.stop-item'
                );


            if (!item) return;


            const sid =
                item.dataset.sid;


            if (
                state.sel.has(sid)
            ) {
                state.sel.delete(sid);
            } else {
                state.sel.add(sid);
            }


            update();
        }
    );


// ─────────────────────────────────────────────────────────────────────────────
// SELECT ALL STATIONS
// ─────────────────────────────────────────────────────────────────────────────

document
    .getElementById(
        'select-all'
    )
    .addEventListener(
        'change',
        e => {

            const selectAll =
                e.target.checked;


            stations.forEach(s => {

                if (
                    !s.lines.some(
                        l =>
                            state.lines.has(l)
                    )
                ) {
                    return;
                }


                if (
                    state.glx === 'glx' &&
                    !s.isGLX
                ) {
                    return;
                }


                if (
                    state.glx === 'non-glx' &&
                    s.isGLX
                ) {
                    return;
                }


                if (selectAll) {
                    state.sel.add(
                        s.id
                    );
                } else {
                    state.sel.delete(
                        s.id
                    );
                }
            });


            if (selectAll) {

                state.sel.forEach(
                    sid => {

                        const station =
                            stations.find(
                                s =>
                                    s.id ===
                                    sid
                            );


                        if (!station) return;


                        station.lines
                            .filter(
                                l =>
                                    state.lines.has(
                                        l
                                    )
                            )
                            .forEach(
                                lineId => {

                                    const raw =
                                        lineDirections[
                                            lineId
                                        ] || '';


                                    if (!raw) {
                                        return;
                                    }


                                    raw
                                        .split(', ')
                                        .forEach(
                                            d =>
                                                state
                                                    .directions
                                                    .add(d)
                                        );
                                }
                            );
                    }
                );
            }


            update();
        }
    );


// ─────────────────────────────────────────────────────────────────────────────
// DIRECTIONS "ALL"
// ─────────────────────────────────────────────────────────────────────────────

const dirsAllCb =
    document.getElementById(
        'directions-all'
    );


dirsAllCb.addEventListener(
    'change',
    () => {

        document
            .querySelectorAll(
                '.dir-cb'
            )
            .forEach(cb => {

                if (cb.disabled) {
                    return;
                }


                cb.checked =
                    dirsAllCb.checked;


                if (
                    dirsAllCb.checked
                ) {
                    state.directions.add(
                        cb.value
                    );
                } else {
                    state.directions.delete(
                        cb.value
                    );
                }
            });


        update();
    }
);


function syncDirsAll() {
    const enabledCbs =
        Array.from(
            document.querySelectorAll(
                '.dir-cb'
            )
        ).filter(
            c => !c.disabled
        );


    dirsAllCb.checked =
        enabledCbs.length > 0 &&
        enabledCbs.every(
            c => c.checked
        );
}


function syncDirAvailability() {
    const availableDirs =
        new Set();


    state.sel.forEach(
        sid => {

            const station =
                stations.find(
                    s =>
                        s.id === sid
                );


            if (!station) return;


            const activeLines =
                station.lines.filter(
                    l =>
                        state.lines.has(l)
                );


            if (
                !activeLines.length
            ) {
                return;
            }


            activeLines.forEach(
                lineId => {

                    const raw =
                        lineDirections[
                            lineId
                        ] || '';


                    if (!raw) return;


                    raw
                        .split(', ')
                        .forEach(
                            d =>
                                availableDirs.add(d)
                        );
                }
            );
        }
    );


    document
        .querySelectorAll(
            '.dir-cb'
        )
        .forEach(cb => {

            const available =
                availableDirs.has(
                    cb.value
                );


            cb.disabled =
                !available;


            cb.checked =
                available &&
                state.directions.has(
                    cb.value
                );


            if (!available) {
                state.directions.delete(
                    cb.value
                );
            }


            const label =
                cb.closest('label');


            if (label) {
                label.style.opacity =
                    available
                        ? '1'
                        : '0.35';
            }
        });


    const dirsLabel =
        dirsAllCb.closest('label');


    if (
        availableDirs.size === 0
    ) {

        dirsAllCb.disabled =
            true;


        if (dirsLabel) {
            dirsLabel.style.opacity =
                '0.35';
        }

    } else {

        dirsAllCb.disabled =
            false;


        if (dirsLabel) {
            dirsLabel.style.opacity =
                '1';
        }
    }


    syncDirsAll();
}


// ─────────────────────────────────────────────────────────────────────────────
// SELECT-ALL SYNCHRONIZATION
// ─────────────────────────────────────────────────────────────────────────────

function syncSelectAll() {
    const selectAllCb =
        document.getElementById(
            'select-all'
        );


    const hasLines =
        state.lines.size > 0;


    const activeStations =
        stations.filter(s => {

            if (
                !s.lines.some(
                    l =>
                        state.lines.has(l)
                )
            ) {
                return false;
            }


            if (
                state.glx === 'glx' &&
                !s.isGLX
            ) {
                return false;
            }


            if (
                state.glx === 'non-glx' &&
                s.isGLX
            ) {
                return false;
            }


            return true;
        });


    selectAllCb.disabled =
        !hasLines;


    selectAllCb.checked =
        hasLines &&
        activeStations.length > 0 &&
        activeStations.every(
            s =>
                state.sel.has(
                    s.id
                )
        );


    const item =
        document.getElementById(
            'select-all-item'
        );


    if (item) {
        item.style.opacity =
            hasLines
                ? '1'
                : '0.35';
    }
}


// ─────────────────────────────────────────────────────────────────────────────
// INITIAL STATE
// ─────────────────────────────────────────────────────────────────────────────

stations.forEach(
    s =>
        state.sel.add(s.id)
);


// ─────────────────────────────────────────────────────────────────────────────
// MAP INITIALIZATION
// ─────────────────────────────────────────────────────────────────────────────

initializeMap({
    update
});


// ─────────────────────────────────────────────────────────────────────────────
// INITIAL RENDER
// ─────────────────────────────────────────────────────────────────────────────

renderStopList();
fetchHeadwayData();


// ─────────────────────────────────────────────────────────────────────────────
// INFO BUTTON / POPUP
// ─────────────────────────────────────────────────────────────────────────────

const infoBtn =
    document.getElementById(
        'info-btn'
    );

const infoPopup =
    document.getElementById(
        'info-popup'
    );

const infoClose =
    document.getElementById(
        'info-popup-close'
    );


infoBtn.addEventListener(
    'click',
    e => {

        e.stopPropagation();

        infoPopup.classList.toggle(
            'is-hidden'
        );
    }
);


infoClose.addEventListener(
    'click',
    () => {
        infoPopup.classList.add(
            'is-hidden'
        );
    }
);


document.addEventListener(
    'keydown',
    e => {

        if (e.key === 'Escape') {
            infoPopup.classList.add(
                'is-hidden'
            );
        }
    }
);


document.addEventListener(
    'click',
    e => {

        if (
            !infoPopup.contains(
                e.target
            ) &&
            e.target !== infoBtn
        ) {
            infoPopup.classList.add(
                'is-hidden'
            );
        }
    }
);