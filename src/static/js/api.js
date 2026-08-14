export async function fetchDirections() {
    const response = await fetch('/api/directions');

    if (!response.ok) {
        throw new Error(`Directions request failed: ${response.status}`);
    }

    return response.json();
}


export async function fetchDirectionsByLine() {
    const response = await fetch('/api/directions_by_line');

    if (!response.ok) {
        throw new Error(`Line directions request failed: ${response.status}`);
    }

    return response.json();
}

export async function fetchHeadways({ lines, selectedStations, glx, directions }) {
    const params = new URLSearchParams({
        lines: lines.join(','),
        stations: selectedStations.join(','),
        glx,
        directions: directions.join(',')
    });

    const response = await fetch(`/api/headways?${params}`);

    if (!response.ok) {
        throw new Error(`Headways request failed: ${response.status}`);
    }

    return response.json();
}