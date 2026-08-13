import pandas as pd
import glob
import os

# -------------------------------------------------------------------
# Combine all monthly headway CSVs into one DataFrame.
# Put all your monthly files (e.g. 2025-01_Headway.csv,
# 2025-02_Headway.csv, ...) in INPUT_DIR.
# -------------------------------------------------------------------
INPUT_DIR = "Headways_2025"  # change to your data folder, e.g. "./data"
OUTPUT_FILE = "headways_cleaned_NEW2.csv"

files = sorted(glob.glob(os.path.join(INPUT_DIR, "2025-*_Headway.csv")))
if not files:
    files = sorted(glob.glob(os.path.join(INPUT_DIR, "*.csv")))
if not files:
    raise FileNotFoundError(f"No CSV files found in {INPUT_DIR}")

chunks = []
for f in files:
    chunk = pd.read_csv(f)
    basename = os.path.basename(f)
    month_label = basename.split("_")[0]  # "2025-01"
    chunk["source_month"] = month_label
    chunks.append(chunk)
    print(f"  {basename}: {len(chunk):,} rows")

df = pd.concat(chunks, ignore_index=True)
print(f"Combined total: {len(df):,} rows from {len(files)} file(s)\n")

# -------------------------------------------------------------------
# 1. Fix route mislabeling
#    GLX stops can only be served by Green-E. Any row at a GLX stop
#    with a different route_id is a data error — reassign it.
# -------------------------------------------------------------------
GLX_STOPS = [
    "Medford/Tufts", "Ball Square", "Magoun Square",
    "Gilman Square", "East Somerville"
]

is_glx_stop = df["stop_name"].isin(GLX_STOPS)
is_wrong_route = is_glx_stop & (df["route_id"] != "Green-E")
print(f"Mislabeled GLX rows fixed: {is_wrong_route.sum():,}")

df.loc[is_wrong_route, "route_id"] = "Green-E"
df.loc[is_wrong_route, "branch_route_id"] = "Green-E"
df.loc[is_wrong_route, "trunk_route_id"] = "Green"

# -------------------------------------------------------------------
# 2. Remove unreasonable headways
#    - Over 3600s (1 hour): first trip of day or missing prior trip
#    - Under 60s: likely duplicate pings / tracking glitch
#    Applied separately to both headway columns where non-null.
# -------------------------------------------------------------------
for col in ["headway_branch_seconds", "headway_trunk_seconds"]:
    if col in df.columns:
        mask = df[col].notna()
        too_high = mask & (df[col] > 3600)
        too_low = mask & (df[col] < 60)
        print(f"{col}: removed {too_high.sum():,} rows > 1hr, {too_low.sum():,} rows < 60s")
        df = df[~(too_high | too_low)]

# -------------------------------------------------------------------
# 3. Flag ADDED (unscheduled) trips for easy filtering later
# -------------------------------------------------------------------
df["is_added_trip"] = df["trip_id"].astype(str).str.startswith("ADDED")
print(f"ADDED trips flagged: {df['is_added_trip'].sum():,}")

# -------------------------------------------------------------------
# 4. Blended headway: use branch headway when available,
#    fall back to trunk headway when branch is null.
#    Equivalent to Tableau: IFNULL([Headway branch Seconds], [headway trunk seconds])
# -------------------------------------------------------------------
df["blended_headway"] = df["headway_branch_seconds"].fillna(df["headway_trunk_seconds"])
print(f"blended_headway: {df['blended_headway'].notna().sum():,} non-null values")

# -------------------------------------------------------------------
# Save
# -------------------------------------------------------------------
df.to_csv(OUTPUT_FILE, index=False)
print(f"\nCleaned dataset: {len(df):,} rows → {OUTPUT_FILE}")