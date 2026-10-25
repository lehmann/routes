'use client';
import { useState } from 'react';
import dynamic from 'next/dynamic';
import PlaceSearch from '../components/PlaceSearch';
import TrailMode from '../components/TrailMode';

const RouteMap = dynamic(() => import('../components/RouteMap'), { ssr: false });

interface WaypointInput {
  label: string;
  lat: string;
  lon: string;
  stopDurationMinutes: string;
  arriveBy: string;
}

function roundToNextHour(offsetHours: number): string {
  const d = new Date();
  d.setHours(d.getHours() + offsetHours, 0, 0, 0);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

const DEFAULT_WAYPOINTS: WaypointInput[] = [
  { label: 'Origin', lat: '52.5219', lon: '13.4132', stopDurationMinutes: '0', arriveBy: '' },
  { label: 'Destination', lat: '52.5096', lon: '13.3761', stopDurationMinutes: '0', arriveBy: '' },
];

export default function Home() {
  const [waypoints, setWaypoints] = useState<WaypointInput[]>(DEFAULT_WAYPOINTS);
  const [arriveBy, setArriveBy] = useState(roundToNextHour(2));
  const [leaveBy, setLeaveBy] = useState('');
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [trailMode, setTrailMode] = useState(false);

  const addStop = () => {
    const stopMinutes = 30;
    let defaultArriveBy = '';
    if (arriveBy) {
      const dt = new Date(arriveBy);
      dt.setMinutes(dt.getMinutes() - stopMinutes);
      const pad = (n: number) => String(n).padStart(2, '0');
      defaultArriveBy = `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())}T${pad(dt.getHours())}:${pad(dt.getMinutes())}`;
    }
    setWaypoints(prev => {
      const next = [...prev];
      next.splice(prev.length - 1, 0, {
        label: `Stop ${prev.length - 1}`,
        lat: '',
        lon: '',
        stopDurationMinutes: String(stopMinutes),
        arriveBy: defaultArriveBy,
      });
      return next;
    });
  };

  const removeStop = (i: number) => setWaypoints(prev => prev.filter((_, idx) => idx !== i));

  const updateWaypoint = (i: number, field: keyof WaypointInput, value: string) =>
    setWaypoints(prev => prev.map((w, idx) => idx === i ? { ...w, [field]: value } : w));

  const plan = async () => {
    setLoading(true);
    setError('');
    setResult(null);
    try {
      const payload = {
        waypoints: waypoints.map(w => ({
          label: w.label,
          lat: parseFloat(w.lat),
          lon: parseFloat(w.lon),
          stopDurationMinutes: parseInt(w.stopDurationMinutes) || 0,
          ...(w.arriveBy ? { arriveBy: new Date(w.arriveBy).toISOString() } : {}),
        })),
        ...(arriveBy ? { arriveBy: new Date(arriveBy).toISOString() } : {}),
        ...(leaveBy ? { leaveBy: new Date(leaveBy).toISOString() } : {}),
      };
      const res = await fetch('/api/plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) setError(data.error);
      else setResult(data);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const modeColor: Record<string, string> = {
    WALK: 'bg-gray-100 text-gray-600',
    BUS: 'bg-yellow-100 text-yellow-800',
    SUBWAY: 'bg-blue-100 text-blue-800',
    RAIL: 'bg-green-100 text-green-800',
    TRAM: 'bg-red-100 text-red-800',
    FERRY: 'bg-cyan-100 text-cyan-800',
  };

  const fmt = (iso: string) =>
    new Date(iso).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Berlin' });

  const canPlan = (arriveBy || leaveBy) && waypoints.every(w => w.lat && w.lon);

  if (trailMode) return <TrailMode onBack={() => setTrailMode(false)} />;

  return (
    <main className="h-screen flex overflow-hidden bg-gray-50">
      {/* Left panel */}
      <div className="w-[520px] shrink-0 overflow-y-auto p-6 space-y-4 border-r border-gray-200 bg-white">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-bold text-gray-900">Berlin Transit Planner</h1>
          <button onClick={() => setTrailMode(true)} className="text-sm text-blue-600 hover:underline">🥾 Trilheiro</button>
        </div>

        {/* Waypoints */}
        <div className="space-y-2">
          {waypoints.map((w, i) => {
            const isOrigin = i === 0;
            const isDest = i === waypoints.length - 1;
            const isStop = !isOrigin && !isDest;
            return (
              <div key={i} className="bg-gray-50 rounded-lg border p-3 space-y-2">
                <div className="flex items-start gap-2">
                  <span className={`text-xs font-bold uppercase w-6 h-6 rounded-full flex items-center justify-center text-white shrink-0 mt-0.5 ${isOrigin ? 'bg-green-500' : isDest ? 'bg-red-500' : 'bg-yellow-500'}`}>
                    {isOrigin ? 'A' : isDest ? String.fromCharCode(65 + waypoints.length - 1) : String.fromCharCode(65 + i)}
                  </span>
                  <div className="flex-1 min-w-0">
                    <PlaceSearch
                      label={w.label}
                      lat={w.lat}
                      lon={w.lon}
                      onChange={(label, lat, lon) => setWaypoints(prev =>
                        prev.map((wp, idx) => idx === i ? { ...wp, label, lat, lon } : wp)
                      )}
                    />
                  </div>
                  {isStop && (
                    <button onClick={() => removeStop(i)} className="text-xs text-red-400 hover:text-red-600 mt-1 shrink-0">✕</button>
                  )}
                </div>
                {isStop && (
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs text-gray-500 whitespace-nowrap">Stop (min)</span>
                      <input
                        className="w-16 border rounded px-2 py-1 text-sm bg-white"
                        type="number" min="0"
                        value={w.stopDurationMinutes}
                        onChange={e => updateWaypoint(i, 'stopDurationMinutes', e.target.value)}
                      />
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs text-gray-500 whitespace-nowrap">Arrive by</span>
                      <input
                        type="datetime-local"
                        className="border rounded px-2 py-1 text-sm bg-white"
                        value={w.arriveBy}
                        onChange={e => updateWaypoint(i, 'arriveBy', e.target.value)}
                      />
                      {w.arriveBy && (
                        <button onClick={() => updateWaypoint(i, 'arriveBy', '')} className="text-xs text-gray-400 hover:text-gray-600">✕</button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <button onClick={addStop} className="text-sm text-blue-600 hover:underline">+ Add intermediate stop</button>

        {/* Global time constraints */}
        <div className="bg-gray-50 rounded-lg border p-3 space-y-2">
          <div className="flex items-center gap-3">
            <span className="text-xs font-medium text-gray-600 w-20">Leave by</span>
            <input
              type="datetime-local"
              className="border rounded px-2 py-1 text-sm bg-white"
              value={leaveBy}
              onChange={e => setLeaveBy(e.target.value)}
            />
            {leaveBy && <button onClick={() => setLeaveBy('')} className="text-xs text-gray-400 hover:text-gray-600">✕</button>}
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs font-medium text-gray-600 w-20">Arrive by</span>
            <input
              type="datetime-local"
              className="border rounded px-2 py-1 text-sm bg-white"
              value={arriveBy}
              onChange={e => setArriveBy(e.target.value)}
            />
            {arriveBy && <button onClick={() => setArriveBy('')} className="text-xs text-gray-400 hover:text-gray-600">✕</button>}
          </div>
        </div>

        <button
          onClick={plan}
          disabled={loading || !canPlan}
          className="w-full bg-blue-600 text-white py-2 rounded-lg font-medium hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          {loading ? 'Planning…' : 'Plan Route'}
        </button>

        {error && <div className="bg-red-50 border border-red-200 text-red-700 rounded p-3 text-sm">{error}</div>}

        {result && (
          <div className="space-y-3">
            <div className="flex justify-between text-sm font-medium">
              <span className={result.feasible ? 'text-green-700' : 'text-red-700'}>
                {result.feasible ? '✓ Route found' : '✗ No feasible route'}
              </span>
              {result.feasible && <span className="text-gray-500">{Math.round(result.totalDuration)} min total</span>}
            </div>
            {result.warnings?.map((w: string, i: number) => (
              <div key={i} className="text-yellow-700 bg-yellow-50 border border-yellow-200 rounded p-2 text-xs">{w}</div>
            ))}
            {result.legs?.map((leg: any, i: number) => (
              <div key={i} className="space-y-1">
                <div className="flex items-baseline gap-2">
                  <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">{leg.from.label} → {leg.to.label}</span>
                  {leg.itinerary.endTime && (
                    <span className="text-xs text-gray-400">arrive {fmt(leg.itinerary.endTime)}</span>
                  )}
                </div>
                {leg.itinerary.legs.map((l: any, j: number) => (
                  <div key={j} className={`flex items-center gap-2 text-sm rounded px-3 py-1.5 ${modeColor[l.mode] ?? 'bg-gray-100 text-gray-700'}`}>
                    <span className="font-semibold w-14 shrink-0 text-xs">{l.mode}</span>
                    {l.route && <span className="font-medium text-sm">{l.route}</span>}
                    {l.headsign && <span className="text-xs opacity-70 truncate">→ {l.headsign}</span>}
                    <span className="ml-auto text-xs whitespace-nowrap">{fmt(l.startTime)} – {fmt(l.endTime)}</span>
                  </div>
                ))}
                {leg.stopAfter > 0 && (
                  <div className="text-xs text-indigo-600 bg-indigo-50 rounded px-3 py-1">⏱ {leg.stopAfter} min stop at {leg.to.label}</div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Right panel — map */}
      <div className="flex-1 relative">
        <RouteMap waypoints={waypoints} legs={result?.legs} />
      </div>
    </main>
  );
}
