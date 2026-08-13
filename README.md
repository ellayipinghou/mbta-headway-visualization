# MBTA Headway Visualization System

An interactive visualization system for exploring **MBTA subway and light rail headways** across stations, lines, and directions. The application combines cleaned MBTA headway data with an interactive map to help users investigate service frequency and variability across the transit network.

## Overview

This project was developed for **Tufts CS 178: Data Visualization** as a way to make MBTA service-frequency data easier to explore and interpret.

The visualization allows users to filter MBTA service by:

* **Transit line**
* **Station**
* **Direction**
* **Green Line Extension (GLX) vs. non-GLX stations**

After applying filters, the application calculates summary statistics and displays station-level information directly on the map.

The backend uses **Flask** to serve the visualization and API endpoints, while **DuckDB** provides an efficient local analytical database for querying the headway data.

## Screenshots

<!-- Replace with the actual screenshot path -->

<img src="src/images/homepage.png" alt="MBTA Headway Visualization Homepage" width="600" height="300">
<img src="src/images/non-glx.png" alt="Filtered to Non-GLX only" width="600" height="300">
<img src="src/images/filtered.png" alt="Filtered by Line, with Tooltip" width="600" height="300">

## Features

### Interactive MBTA Map

The application displays MBTA stations on an interactive map and provides station-level information about service headways.

### Filtering

Users can filter the displayed data by:

* Red Line
* Orange Line
* Blue Line
* Green-B
* Green-C
* Green-D
* Green-E
* Mattapan Line
* Individual stations
* Direction
* GLX / non-GLX stations

### Headway Statistics

For a selected set of filters, the application calculates:

* Number of stations visible
* Average headway
* Standard deviation of headway
* Total number of trips

Statistics are also calculated at the individual-station level and are used to provide information for map tooltips.

### Green Line Extension Analysis

The project gives particular attention to the **Green Line Extension (GLX)**. The five GLX stations included in the analysis are:

* Medford/Tufts
* Ball Square
* Magoun Square
* Gilman Square
* East Somerville

## Architecture

The application follows a data-processing and web-visualization pipeline:

```text
Cleaned MBTA Headway Data
          │
          ▼
       DuckDB
          │
          ▼
     Flask Backend
          │
          ├── /api/headways
          ├── /api/directions
          └── /api/directions_by_line
          │
          ▼
   Interactive Frontend
          │
          ▼
      MBTA Map
```

### Data

The cleaned MBTA headway data required by the application is already included in the repository under:

```text
data/
```

The project uses this preprocessed data directly; **no additional data cleaning or preprocessing is required to run the visualization**.

The repository also contains `clean_headways.py`, which documents the preprocessing pipeline originally used to create the cleaned dataset. This script is included for reproducibility and reference, but does not need to be run when using the existing project data.

The preprocessing pipeline included:

1. Combining monthly MBTA headway CSV files.
2. Adding a `source_month` field.
3. Correcting route labels for Green Line Extension stations.
4. Removing unreasonable headway values.
5. Identifying added/unscheduled trips.
6. Creating a `blended_headway` field using branch headway when available and trunk headway as a fallback.

### Database

The visualization uses **DuckDB** to store and query the cleaned MBTA data.

The Flask application opens the database in read-only mode and uses it to efficiently query headway statistics based on the selected filters.

### Backend

The backend is implemented using **Flask**.

The main application is contained in:

```text
mbta-visualization-system/app.py
```

The backend exposes API endpoints that provide the frontend with station directions and filtered headway statistics.

#### `GET /`

Serves the main interactive map.

#### `GET /api/directions`

Returns the available directions associated with each station.

#### `GET /api/directions_by_line`

Returns the available directions for each MBTA route.

#### `GET /api/headways`

Returns aggregate and station-level headway statistics based on the selected filters.

Example query parameters include:

```text
/api/headways?lines=Green-E&stations=place-mdftf&glx=glx&directions=North
```

## Project Structure

```text
CS178_final/
│
├── data/
│   └── [cleaned MBTA data]
│
├── images/
│   └── visualization.png
│
├── clean_headways.py
├── index.html
├── README.md
│
└── mbta-visualization-system/
    ├── app.py
    ├── db.py
    ├── directions_db.py
    ├── images/
    │   ├── filtered.png
    │   └── homepage.png
    │   └── non-glx.png
    │
    ├── static/
    │   ├── map.css
    │   └── map.js
    │
    └── templates/
        └── map.html
```

### Important Files

| File / Directory    | Description                                                      |
| ------------------- | ---------------------------------------------------------------- |
| `data/`             | Cleaned MBTA headway data used by the application                |
| `images/`           | Images used in the README/documentation                          |
| `clean_headways.py` | Script originally used to clean and preprocess the raw MBTA data |
| `app.py`            | Flask application and API endpoints                              |
| `db.py`             | Database-related functionality                                   |
| `directions_db.py`  | Direction-related database processing                            |
| `map.html`          | Main visualization page                                          |
| `map.js`            | Interactive map and frontend functionality                       |
| `map.css`           | Visualization styling                                            |

## Requirements

The application requires:

* Python 3
* Flask
* DuckDB
* Pandas

Install the Python dependencies with:

```bash
pip install flask duckdb pandas
```

## Running the Application

### 1. Clone the repository

```bash
git clone https://github.com/Yaman-B/CS178_final.git
cd CS178_final
```

### 2. Start the Flask application

Navigate to the visualization application:

```bash
cd mbta-visualization-system
```

Then run:

```bash
python app.py
```

The application will start using Flask's development server.

Open the local address shown in the terminal in a web browser.

> **Note:** The cleaned data required by the application is already included in the repository under `data/`. You do not need to download or preprocess the raw MBTA data to run the visualization.

## Understanding Headways

A **headway** is the amount of time between consecutive transit vehicles serving a station or route. In this project, headways are stored in seconds in the underlying data and converted to minutes when calculating visualization statistics.

The application uses a **blended headway**, using branch headway when available and trunk headway as a fallback.

## Data Preprocessing

Although preprocessing is not required to run the application, `clean_headways.py` contains the pipeline used to generate the cleaned dataset included in `data/`.

The preprocessing addressed several issues in the original MBTA data, including route labeling for Green Line Extension stations and unreasonable headway observations.

### GLX Route Correction

The five GLX stations are expected to be served by the Green-E branch. Records at these stations with another route ID were reassigned to Green-E during preprocessing.

### Removing Extreme Headways

Headways below 60 seconds and above 3600 seconds were removed during preprocessing to eliminate unreasonable observations.

### Added Trips

Trips whose IDs begin with `ADDED` were flagged using the `is_added_trip` field to distinguish added/unscheduled trips from regularly scheduled service.

## Technology Stack

**Backend**

* Python
* Flask
* DuckDB

**Data Processing**

* Pandas
* CSV

**Frontend**

* HTML
* CSS
* JavaScript
* Interactive map visualization

## Contributors

This project was developed collaboratively for **CS 178: Data Visualization at Tufts University**. This repo is a clone of the original at https://github.com/Yaman-B/CS178_final, with potential future updates.

* **Yaman Bosnali**
* **Ella Hou**
