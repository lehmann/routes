# OTP Data Directory

Place the following files here before starting OpenTripPlanner:

## Required files

### `berlin.osm.pbf`
OpenStreetMap extract for Berlin — used for walking/cycling legs.
Download from Geofabrik: https://download.geofabrik.de/europe/germany/berlin.html
Direct link: https://download.geofabrik.de/europe/germany/berlin-latest.osm.pbf

### `vbb-gtfs.zip`
GTFS feed for the VBB (Verkehrsverbund Berlin-Brandenburg) transit network.
Download from the VBB open data portal: https://www.vbb.de/unsere-themen/vbbdigital/api-entwicklerinfos/datensaetze
(Search for "GTFS" — the feed is updated weekly and is free to use)

## Building the graph

On first run, OTP2 will automatically build the routing graph from these files.
This takes ~5-10 minutes and produces a `graph.obj` file.
Subsequent starts load the cached graph instantly (`--load --serve`).

If you add new GTFS data or OSM, delete `graph.obj` and restart to rebuild.

## Starting OTP

```bash
docker compose up otp
```

OTP REST API will be available at: http://localhost:8080/otp/gtfs/v1/plan
