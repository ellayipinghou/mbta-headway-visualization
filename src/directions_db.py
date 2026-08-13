import duckdb

con = duckdb.connect("headways_cleaned.duckdb", read_only=True)

rows = con.execute("""
    SELECT 
        parent_station,
        STRING_AGG(DISTINCT direction, ', ' ORDER BY direction) AS directions
    FROM mbta
    GROUP BY parent_station
    ORDER BY parent_station
""").fetchall()

for row in rows:
    print(f"{row[0]:<30} {row[1]}")

con.close()