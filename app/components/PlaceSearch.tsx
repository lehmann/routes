'use client';
import { useState, useRef, useCallback } from 'react';

interface Suggestion {
  display_name: string;
  lat: string;
  lon: string;
}

interface Props {
  label: string;
  lat: string;
  lon: string;
  onChange: (label: string, lat: string, lon: string) => void;
}

export default function PlaceSearch({ label, lat, lon, onChange }: Props) {
  const [query, setQuery] = useState(label);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [searching, setSearching] = useState(false);
  const [open, setOpen] = useState(false);
  const debounce = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const search = useCallback((q: string) => {
    setQuery(q);
    clearTimeout(debounce.current);
    if (q.length < 3) { setSuggestions([]); setOpen(false); return; }
    debounce.current = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await fetch(
          `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}&format=json&limit=5&countrycodes=de&accept-language=de`,
          { headers: { 'User-Agent': 'Berlin-Transit-Planner/1.0' } }
        );
        const data: Suggestion[] = await res.json();
        setSuggestions(data);
        setOpen(data.length > 0);
      } catch (_) {
        setSuggestions([]);
      } finally {
        setSearching(false);
      }
    }, 400);
  }, []);

  const select = (s: Suggestion) => {
    const shortLabel = s.display_name.split(',')[0].trim();
    setQuery(shortLabel);
    setOpen(false);
    onChange(shortLabel, s.lat, s.lon);
  };

  const hasCoords = lat && lon;

  return (
    <div className="space-y-1">
      <div className="relative">
        <input
          className="w-full border rounded px-2 py-1 text-sm bg-white pr-6"
          placeholder="Search place…"
          value={query}
          onChange={e => search(e.target.value)}
          onFocus={() => suggestions.length > 0 && setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
        />
        {searching && (
          <span className="absolute right-2 top-1.5 text-xs text-gray-400 animate-pulse">…</span>
        )}
        {open && suggestions.length > 0 && (
          <div className="absolute z-50 top-full left-0 right-0 bg-white border rounded shadow-lg mt-0.5 max-h-52 overflow-y-auto">
            {suggestions.map((s, i) => (
              <button
                key={i}
                className="w-full text-left px-3 py-2 text-xs hover:bg-blue-50 border-b last:border-0"
                onMouseDown={e => e.preventDefault()}
                onClick={() => select(s)}
              >
                <div className="font-medium text-gray-800 truncate">{s.display_name.split(',')[0]}</div>
                <div className="text-gray-400 truncate">{s.display_name.split(',').slice(1, 3).join(',')}</div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Coordinate fields — always visible for manual entry */}
      <div className="flex gap-1.5">
        <input
          className="flex-1 border rounded px-2 py-1 text-xs bg-white text-gray-500 font-mono"
          placeholder="Latitude"
          value={lat}
          onChange={e => onChange(query, e.target.value, lon)}
        />
        <input
          className="flex-1 border rounded px-2 py-1 text-xs bg-white text-gray-500 font-mono"
          placeholder="Longitude"
          value={lon}
          onChange={e => onChange(query, lat, e.target.value)}
        />
      </div>
    </div>
  );
}
