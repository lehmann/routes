export type Bounds = [minLon: number, minLat: number, maxLon: number, maxLat: number];

export interface GpxPoi {
  name: string;
  desc?: string;
  lon: number;
  lat: number;
}

export interface GpxFile {
  id: string;
  name: string;
  tracks: [number, number][][];
  pois: GpxPoi[];
  bounds: Bounds | null;
}

const TRACK_COLORS = ['#e11d48', '#0891b2', '#16a34a', '#ea580c', '#2563eb', '#db2777'];

function readPoints(parent: Element, tag: string): [number, number][] {
  return Array.from(parent.getElementsByTagName(tag)).flatMap(p => {
    const lat = parseFloat(p.getAttribute('lat') ?? '');
    const lon = parseFloat(p.getAttribute('lon') ?? '');
    return isNaN(lat) || isNaN(lon) ? [] : [[lon, lat] as [number, number]];
  });
}

function textOf(parent: Element, tag: string): string | undefined {
  return parent.getElementsByTagName(tag)[0]?.textContent?.trim() || undefined;
}

function boundsOf(coords: [number, number][]): Bounds | null {
  if (!coords.length) return null;
  let [minLon, minLat, maxLon, maxLat] = [Infinity, Infinity, -Infinity, -Infinity];
  for (const [lon, lat] of coords) {
    minLon = Math.min(minLon, lon);
    minLat = Math.min(minLat, lat);
    maxLon = Math.max(maxLon, lon);
    maxLat = Math.max(maxLat, lat);
  }
  return [minLon, minLat, maxLon, maxLat];
}

export function parseGpx(xml: string, name: string, id: string): GpxFile {
  const doc = new DOMParser().parseFromString(xml, 'application/xml');
  if (doc.getElementsByTagName('parsererror').length || doc.documentElement.localName !== 'gpx') {
    throw new Error(`"${name}" não é um arquivo GPX válido`);
  }

  // Trilhas (trk/trkseg) têm prioridade; rotas (rte) entram como trilha quando existem
  const segments = [
    ...Array.from(doc.getElementsByTagName('trkseg')).map(seg => readPoints(seg, 'trkpt')),
    ...Array.from(doc.getElementsByTagName('rte')).map(rte => readPoints(rte, 'rtept')),
  ].filter(coords => coords.length > 1);

  const pois = Array.from(doc.getElementsByTagName('wpt')).flatMap((w): GpxPoi[] => {
    const lat = parseFloat(w.getAttribute('lat') ?? '');
    const lon = parseFloat(w.getAttribute('lon') ?? '');
    if (isNaN(lat) || isNaN(lon)) return [];
    return [{ name: textOf(w, 'name') ?? 'POI', desc: textOf(w, 'desc') ?? textOf(w, 'cmt'), lon, lat }];
  });

  const bounds = boundsOf([...segments.flat(), ...pois.map(p => [p.lon, p.lat] as [number, number])]);
  return { id, name, tracks: segments, pois, bounds };
}

export function unionBounds(files: GpxFile[]): Bounds | null {
  const boxes = files.flatMap(f => (f.bounds ? [f.bounds] : []));
  if (!boxes.length) return null;
  return [
    Math.min(...boxes.map(b => b[0])),
    Math.min(...boxes.map(b => b[1])),
    Math.max(...boxes.map(b => b[2])),
    Math.max(...boxes.map(b => b[3])),
  ];
}

export function trackColor(id: string): string {
  const hash = [...id].reduce((acc, ch) => acc + ch.charCodeAt(0), 0);
  return TRACK_COLORS[hash % TRACK_COLORS.length];
}
