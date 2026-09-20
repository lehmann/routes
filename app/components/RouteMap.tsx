'use client';
import Map, { Marker, Source, Layer } from 'react-map-gl/maplibre';
import { useMemo } from 'react';

interface WaypointInput {
  label: string;
  lat: string;
  lon: string;
}

interface RouteLeg {
  mode: string;
  legGeometry: { points: string };
}

interface LegResult {
  itinerary: { legs: RouteLeg[] };
}

interface Props {
  waypoints: WaypointInput[];
  legs?: LegResult[];
}

function decodePolyline(encoded: string): [number, number][] {
  const result: [number, number][] = [];
  let idx = 0, lat = 0, lng = 0;
  while (idx < encoded.length) {
    let b, shift = 0, res = 0;
    do { b = encoded.charCodeAt(idx++) - 63; res |= (b & 0x1f) << shift; shift += 5; } while (b >= 0x20);
    lat += res & 1 ? ~(res >> 1) : res >> 1;
    shift = res = 0;
    do { b = encoded.charCodeAt(idx++) - 63; res |= (b & 0x1f) << shift; shift += 5; } while (b >= 0x20);
    lng += res & 1 ? ~(res >> 1) : res >> 1;
    result.push([lng / 1e5, lat / 1e5]);
  }
  return result;
}

const MODE_COLORS: Record<string, string> = {
  WALK: '#94a3b8',
  BUS: '#f59e0b',
  SUBWAY: '#3b82f6',
  RAIL: '#22c55e',
  TRAM: '#ef4444',
  FERRY: '#06b6d4',
};

export default function RouteMap({ waypoints, legs }: Props) {
  const validWaypoints = waypoints.filter(w => w.lat && w.lon && !isNaN(parseFloat(w.lat)) && !isNaN(parseFloat(w.lon)));

  const center = useMemo(() => {
    if (!validWaypoints.length) return { longitude: 13.405, latitude: 52.52 };
    const lats = validWaypoints.map(w => parseFloat(w.lat));
    const lons = validWaypoints.map(w => parseFloat(w.lon));
    return {
      latitude: (Math.min(...lats) + Math.max(...lats)) / 2,
      longitude: (Math.min(...lons) + Math.max(...lons)) / 2,
    };
  }, [validWaypoints]);

  const routeGeoJSON = useMemo(() => {
    if (!legs?.length) return null;
    const features = legs.flatMap(leg =>
      leg.itinerary.legs
        .filter(l => l.legGeometry?.points)
        .map(l => ({
          type: 'Feature' as const,
          properties: { mode: l.mode, color: MODE_COLORS[l.mode] ?? '#6b7280' },
          geometry: {
            type: 'LineString' as const,
            coordinates: decodePolyline(l.legGeometry.points),
          },
        }))
    );
    return { type: 'FeatureCollection' as const, features };
  }, [legs]);

  return (
    <Map
      initialViewState={{ ...center, zoom: 12 }}
      style={{ position: 'absolute', inset: 0 }}
      mapStyle="https://basemaps.cartocdn.com/gl/voyager-gl-style/style.json"
    >
      {routeGeoJSON && (
        <Source id="route" type="geojson" data={routeGeoJSON}>
          <Layer
            id="route-line"
            type="line"
            paint={{
              'line-color': ['get', 'color'],
              'line-width': 4,
              'line-opacity': 0.85,
            }}
            layout={{ 'line-join': 'round', 'line-cap': 'round' }}
          />
        </Source>
      )}

      {validWaypoints.map((w, i) => {
        const validCount = validWaypoints.length;
        const color = i === 0 ? '#22c55e' : i === validCount - 1 ? '#ef4444' : '#f59e0b';
        return (
          <Marker key={i} longitude={parseFloat(w.lon)} latitude={parseFloat(w.lat)} anchor="center">
            <div
              title={w.label}
              style={{
                width: 14,
                height: 14,
                borderRadius: '50%',
                background: color,
                border: '2px solid white',
                boxShadow: '0 1px 4px rgba(0,0,0,0.35)',
              }}
            />
          </Marker>
        );
      })}
    </Map>
  );
}
