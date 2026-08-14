export const state = {
    glx: 'all',
    search: '',
    lines: new Set(),
    sel: new Set(),
    directions: new Set([
        'North',
        'South',
        'East',
        'West',
        'Inbound',
        'Outbound'
    ])
};