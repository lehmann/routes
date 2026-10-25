'use client';
import Map, { Layer, Marker, Popup, Source } from 'react-map-gl/maplibre';
import type { MapRef } from 'react-map-gl/maplibre';
import { useMemo, useRef, useState } from 'react';
import { trackColor, unionBounds, type GpxFile, type GpxPoi } from '../lib/gpx';
import type { UserPosition } from '../lib/useUserLocation';

interface Props {
  files: GpxFile[];
  position: UserPosition | null;
}

const BERLIN = { longitude: 13.405, latitude: 52.52, zoom: 12 };

export default function TrailMap({ files, position }: Props) {
  const mapRef = useRef<MapRef>(null);
  const [selected, setSelected] = useState<GpxPoi | null>(null);
  const bounds = useMemo(() => unionBounds(files), [files]);

  const tracksGeoJSON = useMemo(() => ({
    type: 'FeatureCollection' as const,
    features: files.flatMap(f => f.tracks.map(coordinates => ({
      type: 'Feature' as const,
      properties: { color: trackColor(f.id) },
      geometry: { type: 'LineString' as const, coordinates },
    }))),
  }), [files]);

  return (
    <>
      <Map
        ref={mapRef}
        initialViewState={bounds ? { bounds, fitBoundsOptions: { padding: 40 } } : BERLIN}
        style={{ position: 'absolute', inset: 0 }}
        mapStyle="https://basemaps.cartocdn.com/gl/voyager-gl-style/style.json"
      >
        <Source id="tracks" type="geojson" data={tracksGeoJSON}>
          <Layer
            id="track-line"
            type="line"
            paint={{ 'line-color': ['get', 'color'], 'line-width': 4, 'line-opacity': 0.9 }}
            layout={{ 'line-join': 'round', 'line-cap': 'round' }}
          />
        </Source>

        {files.flatMap(f => f.pois.map((poi, i) => (
          <Marker key={`${f.id}-${i}`} longitude={poi.lon} latitude={poi.lat} anchor="center" onClick={() => setSelected(poi)}>
            <div
              title={poi.name}
              style={{
                width: 10,
                height: 10,
                borderRadius: '50%',
                background: '#7c3aed',
                border: '2px solid white',
                boxShadow: '0 1px 3px rgba(0,0,0,0.4)',
                cursor: 'pointer',
              }}
            />
          </Marker>
        )))}

        {selected && (
          <Popup longitude={selected.lon} latitude={selected.lat} anchor="bottom" offset={8} onClose={() => setSelected(null)}>
            <div className="text-sm">
              <div className="font-semibold text-gray-900">{selected.name}</div>
              {selected.desc && <div className="text-xs text-gray-600">{selected.desc}</div>}
            </div>
          </Popup>
        )}

        {position && (
          <Marker longitude={position.lon} latitude={position.lat} anchor="center">
            <div
              title="Você está aqui"
              style={{
                width: 16,
                height: 16,
                borderRadius: '50%',
                background: '#2563eb',
                border: '3px solid white',
                boxShadow: '0 0 0 6px rgba(37,99,235,0.25)',
              }}
            />
          </Marker>
        )}
      </Map>

      <div className="absolute top-3 right-3 z-10 flex flex-col gap-2">
        <button
          onClick={() => bounds && mapRef.current?.fitBounds(bounds, { padding: 40 })}
          disabled={!bounds}
          className="bg-white border rounded shadow px-3 py-1.5 text-sm hover:bg-gray-50 disabled:opacity-40"
        >
          Ver trilhas
        </button>
        <button
          onClick={() => position && mapRef.current?.easeTo({ center: [position.lon, position.lat], zoom: 16 })}
          disabled={!position}
          className="bg-white border rounded shadow px-3 py-1.5 text-sm hover:bg-gray-50 disabled:opacity-40"
        >
          Minha posição
        </button>
      </div>
    </>
  );
}
