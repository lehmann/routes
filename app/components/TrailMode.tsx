'use client';
import { useEffect, useMemo, useState } from 'react';
import dynamic from 'next/dynamic';
import { parseGpx, trackColor, type GpxFile } from '../lib/gpx';
import { deleteStoredGpx, listStoredGpx, saveStoredGpx } from '../lib/gpx-store';
import { useUserLocation } from '../lib/useUserLocation';

const TrailMap = dynamic(() => import('./TrailMap'), { ssr: false });

interface Props {
  onBack: () => void;
}

export default function TrailMode({ onBack }: Props) {
  const [files, setFiles] = useState<GpxFile[]>([]);
  const [hidden, setHidden] = useState<Set<string>>(new Set());
  const [error, setError] = useState('');
  const { active: gpsActive, position, error: gpsError, start, stop } = useUserLocation();

  useEffect(() => {
    listStoredGpx()
      .then(items => setFiles(items.flatMap(i => {
        try {
          return [parseGpx(i.xml, i.name, i.id)];
        } catch {
          return [];
        }
      })))
      .catch(() => setError('Não foi possível ler os arquivos salvos.'));
  }, []);

  const visibleFiles = useMemo(() => files.filter(f => !hidden.has(f.id)), [files, hidden]);

  const addFiles = async (list: FileList | null) => {
    if (!list) return;
    setError('');
    const errors: string[] = [];
    const added: GpxFile[] = [];
    for (const file of Array.from(list)) {
      try {
        const xml = await file.text();
        const name = file.name.replace(/\.gpx$/i, '');
        const id = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
        const parsed = parseGpx(xml, name, id);
        await saveStoredGpx({ id, name, xml });
        added.push(parsed);
      } catch (e) {
        errors.push(e instanceof Error ? e.message : String(e));
      }
    }
    setFiles(prev => [...prev, ...added]);
    if (errors.length) setError(errors.join(' '));
  };

  const removeFile = async (id: string) => {
    try {
      await deleteStoredGpx(id);
      setFiles(prev => prev.filter(f => f.id !== id));
    } catch {
      setError('Não foi possível remover o arquivo.');
    }
  };

  const toggleVisible = (id: string) => setHidden(prev => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    return next;
  });

  return (
    <main className="h-dvh flex flex-col md:flex-row overflow-hidden bg-gray-50">
      {/* Left panel — no mobile fica em cima, com altura limitada; no desktop é a coluna lateral */}
      <div className="h-[55dvh] md:h-auto w-full md:w-[520px] shrink-0 overflow-y-auto p-4 md:p-6 space-y-4 border-b md:border-b-0 md:border-r border-gray-200 bg-white">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-bold text-gray-900">🥾 Trilheiro</h1>
          <button onClick={onBack} className="text-sm text-blue-600 hover:underline">← Planejador</button>
        </div>

        {/* GPX files */}
        <div className="bg-gray-50 rounded-lg border p-3 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-gray-700">Arquivos GPX</span>
            <label className="text-sm text-blue-600 hover:underline cursor-pointer">
              + Adicionar
              <input
                type="file"
                accept=".gpx,application/gpx+xml"
                multiple
                className="hidden"
                onChange={e => {
                  addFiles(e.target.files);
                  e.target.value = '';
                }}
              />
            </label>
          </div>
          {files.length === 0 && (
            <p className="text-xs text-gray-500">
              Nenhum arquivo carregado. Os arquivos ficam salvos neste navegador e funcionam offline.
            </p>
          )}
          {files.map(f => (
            <div key={f.id} className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={!hidden.has(f.id)} onChange={() => toggleVisible(f.id)} />
              <span className="w-3 h-3 rounded-full shrink-0" style={{ background: trackColor(f.id) }} />
              <span className="truncate flex-1">{f.name}</span>
              {f.pois.length > 0 && <span className="text-xs text-gray-400 whitespace-nowrap">{f.pois.length} POI</span>}
              <button onClick={() => removeFile(f.id)} className="text-xs text-red-400 hover:text-red-600">✕</button>
            </div>
          ))}
          {error && <div className="bg-red-50 border border-red-200 text-red-700 rounded p-2 text-xs">{error}</div>}
        </div>

        {/* Location */}
        <div className="bg-gray-50 rounded-lg border p-3 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-gray-700">Minha localização</span>
            <button
              onClick={gpsActive ? stop : start}
              className={`text-sm px-3 py-1 rounded ${gpsActive ? 'bg-gray-200 text-gray-700 hover:bg-gray-300' : 'bg-blue-600 text-white hover:bg-blue-700'}`}
            >
              {gpsActive ? 'Desligar GPS' : 'Ativar GPS'}
            </button>
          </div>
          <p className={`text-xs ${gpsError ? 'text-red-600' : 'text-gray-500'}`}>
            {gpsError
              || (position ? `Precisão ±${Math.round(position.accuracy)} m` : gpsActive
                ? 'Aguardando sinal do GPS…'
                : 'Ative o GPS para ver sua posição no mapa.')}
          </p>
        </div>
      </div>

      {/* Right panel — map */}
      <div className="flex-1 min-h-0 relative">
        <TrailMap files={visibleFiles} position={position} />
      </div>
    </main>
  );
}
