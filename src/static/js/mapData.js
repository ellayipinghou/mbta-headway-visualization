// ═══════════════════════════════════════
// Map geometry data for each station
// [name, x, y, labelDir, term, tilt]
// ═══════════════════════════════════════

// ═══════ RED LINE ═══════
export const redMain = [
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
export const redAsh = [
    ['JFK/UMass',    820,620,null,0, 0],
    ['Savin Hill',   785,655,'l',0, 0],
    ['Fields Corner',750,690,'l',0, 0],
    ['Shawmut',      715,725,'l',0, 0],
    ['Ashmont',      680,760,'l',1, 0],
];
export const redBra = [
    ['JFK/UMass',    820,620,null,0, 0],
    ['North Quincy', 855,655,'r',0, 0],
    ['Wollaston',    890,690,'r',0, 0],
    ['Quincy Center',925,725,'r',0, 0],
    ['Quincy Adams', 960,760,'r',0, 0],
    ['Braintree',    995,795,'r',1, 0],
];

// ═══════ MATTAPAN ═══════
export const matt = [
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
export const oraN = [
    ['Oak Grove',        835, 70,'r',1, 0],
    ['Malden Center',    835,108,'r',0, 0],
    ['Wellington',       835,146,'r',0, 0],
    ['Assembly',         835,184,'r',0, 0],
    ['Sullivan Square',  835,222,'r',0, 0],
    ['Community College',835,260,'r',0, 0],
    ['State',            835,415,'br',0, 0],
];
export const oraHub = [
    ['North Station', 835,285,'r',0, 0],
    ['Haymarket',     835,340,'r',0, 0],
];
export const oraS = [
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
export const blu = [
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
export const gEN_upper = [
    ['Medford/Tufts',  627, 75,'r',1, 0],
    ['Ball Square',    655, 105,'r',0, 0],
    ['Magoun Square',  683,135,'r',0, 0],
    ['Gilman Square',  711,165,'r',0, 0],
    ['East Somerville',739,195,'r',0, 0],
    [null,             754,212,null,0, 0],
];

export const gEN_lower = [
[null,             754,212,null,0, 0],  // branch point
    ['Lechmere',       766,225,'r',0, 0],
];

export const gDU = [
[null,           752,212,null,0, 0],  // branch point
    ['Union Square', 700,212,'l',1, 0],
];

export const gBCDE = [
    ['Lechmere',             766,225,null,0, 0],
    ['Science Park/West End',793,255,'l',0, 0],
    ['Government Ctr',       787,373,'l',0, 0],
    ['Park Street',          740,420,'r',0, 0],
    ['Boylston',             700,460,'a',0, -45],
    ['Arlington',            660,460,'a',0, -45],
    ['Copley',               620,460,'a',0, -45],
];
export const gBCD = [
    ['Copley',               620,460,null,0, 0],  // null so it doesn't re-draw the dot
    ['Hynes Ctr',            580,460,'a',0, -45],
    ['Kenmore',              540,460,'ar',0, -45],
];

export const gHub = [
    ['North Station',820,285,'l',0, 0],
    ['Haymarket',    820,340,'l',0, 0],
];

export const gES = [
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

export const gB = [
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

export const gC = [
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

export const gD = [
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
