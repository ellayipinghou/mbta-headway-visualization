import duckdb
from flask import Flask, render_template, request, jsonify, g

app = Flask(__name__)
DB_PATH = "headways_cleaned.duckdb"

# Allowlists for input validation — reject anything not in these sets before it touches SQL.
VALID_LINES  = {"Red", "Green-B", "Green-C", "Green-D", "Green-E", "Blue", "Orange", "Mattapan"}
VALID_GLX    = {"all", "glx", "non-glx"}
# Parent-station IDs whose isGLX flag is true in the frontend stations array.
GLX_STATIONS = ["place-balsq", "place-esomr", "place-gilmn", "place-mdftf", "place-mgngl"]
VALID_DIRECTIONS = {"North", "South", "East", "West", "Inbound", "Outbound"}



def get_db():
    # Open one read-only DuckDB connection per request and cache it on Flask's g object.
    # read_only=True allows concurrent access from multiple Flask threads.
    if 'db' not in g:
        g.db = duckdb.connect(DB_PATH, read_only=True)
    return g.db


@app.teardown_appcontext
def close_db(e=None):
    # Automatically close the connection when the request context is torn down.
    db = g.pop('db', None)
    if db is not None:
        db.close()


@app.route("/")
def index():
    return render_template("map.html")

@app.route("/api/directions")
def directions():
    db = get_db()
    rows = db.execute("""
        SELECT 
            parent_station,
            STRING_AGG(DISTINCT direction, ', ' ORDER BY direction) AS directions
        FROM mbta
        GROUP BY parent_station
    """).fetchall()
    return jsonify({row[0]: row[1] for row in rows})

@app.route("/api/directions_by_line")
def directions_by_line():
    db = get_db()
    rows = db.execute("""
        SELECT 
            route_id,
            STRING_AGG(DISTINCT direction, ', ' ORDER BY direction) AS directions
        FROM mbta
        GROUP BY route_id
    """).fetchall()
    return jsonify({row[0]: row[1] for row in rows})

@app.route("/api/headways")
def headways():
    lines_param    = request.args.get("lines", "")
    stations_param = request.args.get("stations", "")
    glx            = request.args.get("glx", "all")
    directions_param = request.args.get("directions", "")

    if glx not in VALID_GLX:
        glx = "all"

    # Strip any value not in the allowlist so user input never reaches the query unvalidated.
    lines    = [l for l in lines_param.split(",")    if l in VALID_LINES]       if lines_param    else []
    stations = [s for s in stations_param.split(",") if s.startswith("place-")] if stations_param else []
    directions = [d for d in directions_param.split(",") if d in VALID_DIRECTIONS] if directions_param else []

    # If no lines or no stations selected, return zeros immediately
    if not lines or not stations:
        return jsonify({
            "stats": {
                "stationsVisible": 0,
                "avgHeadway":      0,
                "stddevHeadway":   0,
                "totalTrips":      0,
            },
            "stationData": {},
        })
    
    # Build the WHERE clause 
    conditions = []
    params     = []

    if lines:
        conditions.append("route_id = ANY(?::VARCHAR[])")
        params.append(lines)

    # Skip the station filter when all 125 stations are selected
    if stations and len(stations) < 125:
        conditions.append("parent_station = ANY(?::VARCHAR[])")
        params.append(stations)

    # GLX filter
    if glx == "glx":
        conditions.append("parent_station = ANY(?::VARCHAR[])")
        params.append(GLX_STATIONS)
    elif glx == "non-glx":
        conditions.append("parent_station != ALL(?::VARCHAR[])")
        params.append(GLX_STATIONS)

    if directions and len(directions) < len(VALID_DIRECTIONS):
        conditions.append("direction = ANY(?::VARCHAR[])")
        params.append(directions)

    # Excluding rows with NULL blended_headway
    #conditions.append("blended_headway IS NOT NULL")

    where = "WHERE " + " AND ".join(conditions)

    # this computes the numbers for the Filtered Summary display
    agg_sql = f"""
        SELECT
            COUNT(DISTINCT parent_station)         AS stations_visible,
            ROUND(AVG(blended_headway) / 60, 2)    AS avg_headway_min,
            ROUND(STDDEV(blended_headway) / 60, 2) AS stddev_headway_min,
            COUNT(DISTINCT trip_id)                AS total_trips
        FROM mbta
        {where}
    """

    # basically the same query but grouped by station for tooltips and map coloring
    station_sql = f"""
        SELECT
            parent_station,
            ROUND(AVG(blended_headway) / 60, 2)    AS avg_headway_min,
            ROUND(STDDEV(blended_headway) / 60, 2) AS stddev_headway_min,
            COUNT(DISTINCT trip_id)                 AS total_trips
        FROM mbta
        {where}
        GROUP BY parent_station
    """

    db = get_db()
    agg_row      = db.execute(agg_sql, params.copy()).fetchone()
    station_rows = db.execute(station_sql, params.copy()).fetchall()

    return jsonify({
        "stats": {
            "stationsVisible": agg_row[0] or 0,
            "avgHeadway":      agg_row[1] or 0,
            "stddevHeadway":   agg_row[2] or 0,
            "totalTrips":      agg_row[3] or 0,
        },
        "stationData": {
            row[0]: {"avgHeadway": row[1], "stddevHeadway": row[2], "trips": row[3]}
            for row in station_rows
        },
    })


if __name__ == "__main__":
    app.run(debug=True)
