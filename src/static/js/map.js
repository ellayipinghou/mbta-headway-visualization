import { state } from './state.js';
import { stations } from './data.js';
import * as mapData from './mapData.js';

import {
    showTooltip,
    showLineTooltip,
    moveTooltip,
    hideTooltip
} from './tooltips.js';


const NS = 'http://www.w3.org/2000/svg';

const C = {
    red: '#DA291C',
    ora: '#ED8B00',
    blu: '#003DA5',
    grn: '#00843D'
};

const LW = 8;
const CR = 15;

let mapDiv;
let svg;

let gLineLayer;
let gStationLayer;
let gLabelLayer;

let bentCoords;
let drawnElements;

let vb = {
    x: 30,
    y: 20,
    w: 1280,
    h: 1060
};

let isPanning = false;

let panStart = {
    x: 0,
    y: 0
};


// Supplied by main.js.
let onUpdate;


// ─────────────────────────────────────────────────────────────────────────────
// SVG HELPERS
// ─────────────────────────────────────────────────────────────────────────────

function el(tag, attrs) {
    const element =
        document.createElementNS(NS, tag);

    for (const [key, value] of Object.entries(attrs)) {
        element.setAttribute(key, value);
    }

    return element;
}


function smoothPath(pts, r) {
    if (pts.length < 2) return '';

    let d =
        `M${pts[0][0]},${pts[0][1]}`;

    for (
        let i = 1;
        i < pts.length - 1;
        i++
    ) {
        const [x0, y0] = pts[i - 1];
        const [x1, y1] = pts[i];
        const [x2, y2] = pts[i + 1];

        const d1 =
            Math.hypot(
                x1 - x0,
                y1 - y0
            );

        const d2 =
            Math.hypot(
                x2 - x1,
                y2 - y1
            );

        const cr =
            Math.min(
                r,
                d1 / 2,
                d2 / 2
            );

        const p1x =
            x1 -
            cr * (x1 - x0) / d1;

        const p1y =
            y1 -
            cr * (y1 - y0) / d1;

        const p2x =
            x1 +
            cr * (x2 - x1) / d2;

        const p2y =
            y1 +
            cr * (y2 - y1) / d2;

        const mx =
            (p1x + 2 * x1 + p2x) / 4;

        const my =
            (p1y + 2 * y1 + p2y) / 4;

        bentCoords.set(
            `${x1},${y1}`,
            [mx, my]
        );

        d +=
            ` L${p1x},${p1y}` +
            ` Q${x1},${y1} ${p2x},${p2y}`;
    }

    return (
        d +
        ` L${pts[pts.length - 1][0]},` +
        `${pts[pts.length - 1][1]}`
    );
}


function drawPoly(
    arr,
    color,
    layer,
    opts = {}
) {
    const pts =
        arr.map(s => [s[1], s[2]]);

    drawPath(
        smoothPath(pts, CR),
        color,
        layer,
        opts
    );
}


function drawPath(
    d,
    color,
    layer,
    opts = {}
) {
    const attrs = {
        d,
        fill: 'none',
        stroke: color,
        'stroke-width': opts.w || LW,
        'stroke-linecap': 'round',
        'stroke-linejoin': 'round'
    };

    if (opts.dash) {
        attrs['stroke-dasharray'] =
            opts.dash;
    }

    if (opts.lines) {
        attrs['data-lines'] =
            opts.lines;
    }

    if (opts.glx !== undefined) {
        attrs['data-glx'] =
            opts.glx;
    }

    (
        layer || gLineLayer
    ).appendChild(
        el('path', attrs)
    );
}


// ─────────────────────────────────────────────────────────────────────────────
// STATIONS
// ─────────────────────────────────────────────────────────────────────────────

function drawStations(
    arr,
    color,
    lineName
) {
    for (const [
        name,
        x,
        y,
        ld,
        tm,
        tilt
    ] of arr) {

        if (ld === null) continue;

        const key = `${x},${y}`;


        // Station already drawn by another line.
        if (drawnElements.has(key)) {
            const elements =
                drawnElements.get(key);

            elements.forEach(element => {
                const existing =
                    element.getAttribute(
                        'data-lines'
                    ) || '';

                if (
                    !existing
                        .split(',')
                        .includes(lineName)
                ) {
                    element.setAttribute(
                        'data-lines',
                        existing +
                        ',' +
                        lineName
                    );
                }
            });

            continue;
        }


        const tracked = [];

        const [sx, sy] =
            bentCoords.get(
                `${x},${y}`
            ) || [x, y];

        let hitTarget;


        // Transfer station.
        if (tm) {
            const c1 = el('circle', {
                cx: sx,
                cy: sy,
                r: 7.5,
                fill: '#ffffff',
                stroke: color,
                'stroke-width': 3,
                'data-lines': lineName,
                'data-name': name
            });

            const c2 = el('circle', {
                cx: sx,
                cy: sy,
                r: 3,
                fill: color,
                'data-lines': lineName,
                'data-name': name
            });

            // Let events fall through to c1.
            c2.style.pointerEvents =
                'none';

            gStationLayer.appendChild(c1);
            gStationLayer.appendChild(c2);

            tracked.push(c1, c2);

            hitTarget = c1;
        } else {
            const c = el('circle', {
                cx: sx,
                cy: sy,
                r: 4,
                fill: '#ffffff',
                stroke: color,
                'stroke-width': 2,
                'data-lines': lineName,
                'data-name': name
            });

            gStationLayer.appendChild(c);

            tracked.push(c);

            hitTarget = c;
        }


        // ─────────────────────────────────────────────────────────────────
        // STATION EVENTS
        // ─────────────────────────────────────────────────────────────────

        if (hitTarget) {
            hitTarget.style.cursor =
                'pointer';


            hitTarget.addEventListener(
                'mouseenter',
                e => {
                    const stationObj =
                        stations.find(
                            s =>
                                (
                                    s.mapName ||
                                    s.name
                                ) === name
                        );

                    if (stationObj) {
                        showTooltip(
                            e,
                            stationObj
                        );
                    }
                }
            );


            hitTarget.addEventListener(
                'mousemove',
                e => {
                    moveTooltip(e);
                }
            );


            hitTarget.addEventListener(
                'mouseleave',
                () => {
                    hideTooltip();
                }
            );


            hitTarget.addEventListener(
                'click',
                e => {
                    e.stopPropagation();

                    const stationObj =
                        stations.find(
                            s =>
                                (
                                    s.mapName ||
                                    s.name
                                ) === name
                        );

                    if (!stationObj) return;


                    // A station can only be selected if:
                    // 1. at least one of its lines is active
                    // 2. it passes the current GLX filter

                    const isActive =
                        stationObj.lines.some(
                            l =>
                                state.lines.has(l)
                        ) &&
                        (
                            state.glx === 'all' ||
                            (
                                state.glx === 'glx' &&
                                stationObj.isGLX
                            ) ||
                            (
                                state.glx === 'non-glx' &&
                                !stationObj.isGLX
                            )
                        );


                    if (!isActive) return;


                    if (
                        state.sel.has(
                            stationObj.id
                        )
                    ) {
                        state.sel.delete(
                            stationObj.id
                        );
                    } else {
                        state.sel.add(
                            stationObj.id
                        );
                    }


                    if (onUpdate) {
                        onUpdate();
                    }
                }
            );
        }


        // ─────────────────────────────────────────────────────────────────
        // LABEL POSITION
        // ─────────────────────────────────────────────────────────────────

        let tx = sx;
        let ty = sy;

        let anchor = 'start';
        let dy = '0.35em';

        const g = 11;


        switch (ld) {
            case 'r':
                tx += g;
                break;

            case 'l':
                tx -= g;
                anchor = 'end';
                break;

            case 'a':
                ty -= g;
                anchor = 'middle';
                dy = '0em';
                break;

            case 'b':
                ty += g + 4;
                anchor = 'middle';
                dy = '0em';
                break;

            case 'ar':
                tx += g - 2;
                ty -= g;
                dy = '0em';
                break;

            case 'al':
                tx -= g - 2;
                ty -= g;
                anchor = 'end';
                dy = '0em';
                break;

            case 'br':
                tx += g;
                ty += g + 4;
                dy = '0em';
                break;

            case 'bl':
                tx -= g;
                ty += g + 4;
                anchor = 'end';
                dy = '0em';
                break;
        }


        if (tilt) {
            const extra = 3;

            if (ld === 'b') {
                ty += extra;
            } else if (ld === 'a') {
                ty -= extra;
            } else if (ld === 'r') {
                tx += extra;
            } else if (ld === 'l') {
                tx -= extra;
            }
        }


        if (tilt && ld === 'b') {
            anchor = 'end';
        }

        if (tilt && ld === 'a') {
            anchor = 'start';
        }


        const fontSize =
            tm ? 10.5 : 8.5;

        const fontWeight =
            tm ? '700' : '400';


        const attrs = {
            x: tx,
            y: ty,
            'text-anchor': anchor,
            'font-size': fontSize,
            'font-weight': fontWeight,
            fill: '#222',
            dy,
            'data-lines': lineName
        };


        if (tilt) {
            attrs.transform =
                `rotate(${tilt}, ${tx}, ${ty})`;
        }


        const text =
            el('text', attrs);

        text.textContent = name;

        gLabelLayer.appendChild(text);

        tracked.push(text);

        drawnElements.set(
            key,
            tracked
        );
    }
}


// ─────────────────────────────────────────────────────────────────────────────
// DRAW MAP
// ─────────────────────────────────────────────────────────────────────────────

function drawMap() {
    const {
        redMain,
        redAsh,
        redBra,
        matt,
        oraN,
        oraHub,
        oraS,
        blu,
        gEN_upper,
        gEN_lower,
        gDU,
        gBCDE,
        gBCD,
        gHub,
        gES,
        gB,
        gC,
        gD
    } = mapData;


    // ─────────────────────────────────────────────────────────────────────
    // 1. LINE PATHS
    // ─────────────────────────────────────────────────────────────────────

    drawPoly(
        gEN_upper,
        C.grn,
        gLineLayer,
        {
            lines: 'Green-E',
            glx: 'true'
        }
    );


    drawPoly(
        gEN_lower,
        C.grn,
        gLineLayer,
        {
            lines: 'Green-D,Green-E',
            glx: 'false'
        }
    );


    drawPoly(
        gDU,
        C.grn,
        gLineLayer,
        {
            lines: 'Green-D',
            glx: 'false'
        }
    );


    // Lechmere → Government Center
    // via North Station/Haymarket
    // D and E only.

    const gDEHub = [
        ...gBCDE.slice(0, 2),
        ...gHub,
        gBCDE[2]
    ];


    drawPoly(
        gDEHub,
        C.grn,
        gLineLayer,
        {
            lines: 'Green-D,Green-E'
        }
    );


    // Government Center → Copley
    // All four branches.

    const gBCDECopley =
        gBCDE.slice(2);


    drawPoly(
        gBCDECopley,
        C.grn,
        gLineLayer,
        {
            lines:
                'Green-B,Green-C,Green-D,Green-E'
        }
    );


    drawPoly(
        gBCD,
        C.grn,
        gLineLayer,
        {
            lines:
                'Green-B,Green-C,Green-D'
        }
    );


    drawPoly(
        gES,
        C.grn,
        gLineLayer,
        {
            lines: 'Green-E',
            glx: 'false'
        }
    );


    drawPoly(
        gB,
        C.grn,
        gLineLayer,
        {
            lines: 'Green-B'
        }
    );


    drawPoly(
        gC,
        C.grn,
        gLineLayer,
        {
            lines: 'Green-C'
        }
    );


    drawPoly(
        gD,
        C.grn,
        gLineLayer,
        {
            lines: 'Green-D'
        }
    );


    drawPoly(
        redMain,
        C.red,
        gLineLayer,
        {
            lines: 'Red'
        }
    );


    drawPoly(
        redAsh,
        C.red,
        gLineLayer,
        {
            lines: 'Red'
        }
    );


    drawPoly(
        redBra,
        C.red,
        gLineLayer,
        {
            lines: 'Red'
        }
    );


    drawPoly(
        matt,
        C.red,
        gLineLayer,
        {
            dash: '10 6',
            lines: 'Mattapan'
        }
    );


    const oraNFull = [
        ...oraN,
        ...oraHub
    ].sort(
        (a, b) => a[2] - b[2]
    );


    drawPoly(
        [...oraNFull, ...oraS],
        C.ora,
        gLineLayer,
        {
            lines: 'Orange'
        }
    );


    drawPoly(
        blu,
        C.blu,
        gLineLayer,
        {
            lines: 'Blue'
        }
    );


    // ─────────────────────────────────────────────────────────────────────
    // GREEN / ORANGE NORTH STATION + HAYMARKET CONNECTIONS
    // ─────────────────────────────────────────────────────────────────────

    [285, 340].forEach(y => {
        const line = el('line', {
            x1: 820,
            y1: y,
            x2: 835,
            y2: y,
            stroke: '#333',
            'stroke-width': 3,
            'stroke-linecap': 'round',
            'data-lines':
                'Orange,Green-D,Green-E'
        });

        gStationLayer.appendChild(line);
    });


    // ─────────────────────────────────────────────────────────────────────
    // 2. STATION DOTS + LABELS
    // ─────────────────────────────────────────────────────────────────────

    drawStations(
        gEN_upper,
        C.grn,
        'Green-E'
    );

    drawStations(
        gEN_lower,
        C.grn,
        'Green-D,Green-E'
    );

    drawStations(
        gDU,
        C.grn,
        'Green-D'
    );

    drawStations(
        gBCDE,
        C.grn,
        'Green-B,Green-C,Green-D,Green-E'
    );

    drawStations(
        gHub,
        C.grn,
        'Green-D,Green-E'
    );

    drawStations(
        gBCD,
        C.grn,
        'Green-B,Green-C,Green-D'
    );

    drawStations(
        gES,
        C.grn,
        'Green-E'
    );

    drawStations(
        gB,
        C.grn,
        'Green-B'
    );

    drawStations(
        gC,
        C.grn,
        'Green-C'
    );

    drawStations(
        gD,
        C.grn,
        'Green-D'
    );


    drawStations(
        redMain,
        C.red,
        'Red'
    );

    drawStations(
        redAsh,
        C.red,
        'Red'
    );

    drawStations(
        redBra,
        C.red,
        'Red'
    );

    drawStations(
        matt,
        C.red,
        'Mattapan'
    );


    drawStations(
        oraN,
        C.ora,
        'Orange'
    );

    drawStations(
        oraHub,
        C.ora,
        'Orange'
    );

    drawStations(
        oraS,
        C.ora,
        'Orange'
    );


    drawStations(
        blu,
        C.blu,
        'Blue'
    );


    // ─────────────────────────────────────────────────────────────────────
    // 3. BRANCH LABELS
    // ─────────────────────────────────────────────────────────────────────

    [
        [
            'RED LINE',
            460,
            140,
            C.red,
            'Red'
        ],
        [
            'MATTAPAN',
            510,
            865,
            C.red,
            'Mattapan'
        ],
        [
            'ORANGE LINE',
            840,
            50,
            C.ora,
            'Orange'
        ],
        [
            'BLUE LINE',
            1240,
            60,
            C.blu,
            'Blue'
        ],
        [
            'GREEN-E',
            630,
            50,
            C.grn,
            'Green-E'
        ],
        [
            'GREEN-B',
            105,
            220,
            C.grn,
            'Green-B'
        ],
        [
            'GREEN-C',
            120,
            380,
            C.grn,
            'Green-C'
        ],
        [
            'GREEN-D',
            215,
            810,
            C.grn,
            'Green-D'
        ]
    ].forEach(
        ([text, x, y, color, line]) => {

            const element = el('text', {
                x,
                y,
                'text-anchor': 'middle',
                'font-size': 10,
                'font-weight': '800',
                fill: color,
                'letter-spacing': '1px',
                'data-lines': line,
                class: 'line-label',
                'data-line-id': line
            });

            element.textContent = text;

            gLabelLayer.appendChild(
                element
            );
        }
    );
}


// ─────────────────────────────────────────────────────────────────────────────
// ZOOM + PAN
// ─────────────────────────────────────────────────────────────────────────────

function setupZoomAndPan() {

    mapDiv.addEventListener(
        'wheel',
        e => {
            e.preventDefault();

            const scale =
                e.deltaY > 0
                    ? 1.1
                    : 0.9;

            const rect =
                svg.getBoundingClientRect();

            const mx =
                (e.clientX - rect.left) /
                rect.width;

            const my =
                (e.clientY - rect.top) /
                rect.height;

            const newW =
                vb.w * scale;

            const newH =
                vb.h * scale;

            vb.x +=
                (vb.w - newW) * mx;

            vb.y +=
                (vb.h - newH) * my;

            vb.w = newW;
            vb.h = newH;

            svg.setAttribute(
                'viewBox',
                `${vb.x} ${vb.y} ${vb.w} ${vb.h}`
            );
        },
        { passive: false }
    );


    mapDiv.addEventListener(
        'mousedown',
        e => {
            isPanning = true;

            panStart = {
                x: e.clientX,
                y: e.clientY
            };

            mapDiv.style.cursor =
                'grabbing';
        }
    );


    window.addEventListener(
        'mousemove',
        e => {
            if (!isPanning) return;

            const dx =
                (e.clientX - panStart.x) *
                (
                    vb.w /
                    mapDiv.clientWidth
                );

            const dy =
                (e.clientY - panStart.y) *
                (
                    vb.h /
                    mapDiv.clientHeight
                );

            vb.x -= dx;
            vb.y -= dy;

            panStart = {
                x: e.clientX,
                y: e.clientY
            };

            svg.setAttribute(
                'viewBox',
                `${vb.x} ${vb.y} ${vb.w} ${vb.h}`
            );
        }
    );


    window.addEventListener(
        'mouseup',
        () => {
            isPanning = false;
            mapDiv.style.cursor =
                'default';
        }
    );


    mapDiv.addEventListener(
        'dblclick',
        () => {
            vb = {
                x: 30,
                y: 20,
                w: 1280,
                h: 1060
            };

            svg.setAttribute(
                'viewBox',
                `${vb.x} ${vb.y} ${vb.w} ${vb.h}`
            );
        }
    );
}


// ─────────────────────────────────────────────────────────────────────────────
// INITIALIZE MAP
// ─────────────────────────────────────────────────────────────────────────────

export function initializeMap({ update }) {
    onUpdate = update;

    mapDiv =
        document.getElementById('map');

    svg =
        document.createElementNS(
            NS,
            'svg'
        );

    svg.setAttribute(
        'viewBox',
        '30 20 1280 1060'
    );

    svg.setAttribute(
        'xmlns',
        NS
    );

    mapDiv.appendChild(svg);


    gLineLayer =
        el('g', {
            id: 'lines'
        });

    gStationLayer =
        el('g', {
            id: 'stations'
        });

    gLabelLayer =
        el('g', {
            id: 'labels'
        });


    svg.append(
        gLineLayer,
        gStationLayer,
        gLabelLayer
    );


    bentCoords = new Map();
    drawnElements = new Map();


    drawMap();
    setupZoomAndPan();


    // ─────────────────────────────────────────────────────────────────────
    // BRANCH / LINE LABEL TOOLTIP EVENTS
    // ─────────────────────────────────────────────────────────────────────

    document
        .querySelectorAll('.line-label')
        .forEach(labelEl => {

            labelEl.addEventListener(
                'mouseenter',
                e => {
                    showLineTooltip(
                        e,
                        labelEl.getAttribute(
                            'data-line-id'
                        )
                    );
                }
            );


            labelEl.addEventListener(
                'mousemove',
                e => {
                    moveTooltip(e);
                }
            );


            labelEl.addEventListener(
                'mouseleave',
                () => {
                    hideTooltip();
                }
            );
        });
}