const OTP_BASE = process.env.OTP_URL ?? 'http://localhost:8080/otp/gtfs/v1';

export interface Waypoint {
  lat: number;
  lon: number;
  label: string;
  stopDurationMinutes?: number;
  arriveBy?: string; // ISO datetime — must arrive at this waypoint by this time
}

export interface RouteLeg {
  startTime: string; // ISO
  endTime: string;   // ISO
  mode: string;
  route?: string;
  headsign?: string;
  from: { name: string; lat: number; lon: number };
  to: { name: string; lat: number; lon: number };
  legGeometry: { points: string };
  duration: number; // seconds
}

export interface Itinerary {
  startTime: string; // ISO
  endTime: string;   // ISO
  duration: number;  // seconds
  legs: RouteLeg[];
}

const PLAN_QUERY = `
query PlanConnection(
  $fromLat: CoordinateValue!
  $fromLon: CoordinateValue!
  $toLat: CoordinateValue!
  $toLon: CoordinateValue!
  $dateTime: PlanDateTimeInput
  $numItineraries: Int!
) {
  planConnection(
    origin: { location: { coordinate: { latitude: $fromLat, longitude: $fromLon } } }
    destination: { location: { coordinate: { latitude: $toLat, longitude: $toLon } } }
    dateTime: $dateTime
    first: $numItineraries
  ) {
    edges {
      node {
        start
        end
        legs {
          startTime
          endTime
          mode
          duration
          route { shortName }
          headsign
          from { name lat lon }
          to { name lat lon }
          legGeometry { points }
        }
      }
    }
    routingErrors { code description }
  }
}
`;

// Format a JS Date as OffsetDateTime for Berlin timezone (OTP2 requires timezone-aware ISO 8601)
function toOffsetDateTime(date: Date): string {
  const parts = new Intl.DateTimeFormat('en', {
    timeZone: 'Europe/Berlin',
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
    hour12: false,
    timeZoneName: 'shortOffset',
  }).formatToParts(date);

  const get = (type: string) => parts.find(p => p.type === type)?.value ?? '00';
  const hour = get('hour') === '24' ? '00' : get('hour'); // midnight edge case

  // Normalize GMT+2 → +02:00, GMT+02 → +02:00, GMT+02:00 → +02:00
  const rawOffset = get('timeZoneName').replace('GMT', '') || '+00:00';
  const offset = rawOffset.replace(/^([+-])(\d)$/, '$10$2:00')
                           .replace(/^([+-]\d{2})$/, '$1:00');

  return `${get('year')}-${get('month')}-${get('day')}T${hour}:${get('minute')}:${get('second')}${offset}`;
}

export async function planLeg(
  from: Waypoint,
  to: Waypoint,
  dateTime: string,
  arriveBy: boolean
): Promise<Itinerary[]> {
  const dt = new Date(dateTime);
  const offsetDt = toOffsetDateTime(dt);

  const variables = {
    fromLat: from.lat,
    fromLon: from.lon,
    toLat: to.lat,
    toLon: to.lon,
    dateTime: arriveBy
      ? { latestArrival: offsetDt }
      : { earliestDeparture: offsetDt },
    numItineraries: 3,
  };

  const res = await fetch(OTP_BASE, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: PLAN_QUERY, variables }),
  });

  if (!res.ok) throw new Error(`OTP error: ${res.status}`);
  const data = await res.json();

  if (data.errors?.length) throw new Error(data.errors[0].message);

  const conn = data.data?.planConnection;
  if (conn?.routingErrors?.length) {
    const err = conn.routingErrors[0];
    throw new Error(`Routing error: ${err.code} — ${err.description}`);
  }

  return (conn?.edges ?? []).map((edge: any) => {
    const node = edge.node;
    return {
      startTime: node.start,
      endTime: node.end,
      duration: (new Date(node.end).getTime() - new Date(node.start).getTime()) / 1000,
      legs: node.legs.map((l: any) => ({
        startTime: new Date(l.startTime).toISOString(),
        endTime: new Date(l.endTime).toISOString(),
        mode: l.mode,
        route: l.route?.shortName,
        headsign: l.headsign,
        from: l.from,
        to: l.to,
        legGeometry: l.legGeometry ?? { points: '' },
        duration: l.duration,
      })),
    };
  });
}
