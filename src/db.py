"""
init_db.py
Run once (python init_db.py) to load the headways dataset into a DuckDB database
"""
import duckdb

DB_PATH = "headways_cleaned.duckdb"
CSV_PATH = "data/headways_cleaned_NEW2.csv"

def init():
    con = duckdb.connect(DB_PATH)

    con.execute(f"""
        CREATE OR REPLACE TABLE mbta AS
        SELECT * FROM read_csv('{CSV_PATH}',
            header=true,
            columns = {{
                'service_date':             'DATE',
                'route_id':                 'VARCHAR',
                'trunk_route_id':           'VARCHAR',
                'branch_route_id':          'VARCHAR',
                'trip_id':                  'VARCHAR',
                'direction_id':             'SMALLINT',
                'direction':                'VARCHAR',
                'parent_station':           'VARCHAR',
                'stop_id':                  'VARCHAR',
                'stop_name':                'VARCHAR',
                'stop_departure_datetime':  'TIMESTAMP',
                'stop_departure_sec':       'INTEGER',
                'headway_branch_seconds':   'DOUBLE',
                'headway_trunk_seconds':    'DOUBLE',
                'source_month':             'VARCHAR',
                'is_added_trip':            'BOOLEAN',
                'blended_headway':          'DOUBLE'
            }}
        );
    """)

    row_count = con.execute("SELECT COUNT(*) FROM mbta").fetchone()[0]
    cols = con.execute("DESCRIBE mbta").fetchall()

    print(f"Loaded {row_count} rows into 'mbta' table.")
    print("Schema:")
    for col in cols:
        print(f"  {col[0]:<30} {col[1]}")

    con.close()

if __name__ == "__main__":
    init()