import { subMinutes, addMinutes, parseISO, formatISO } from 'date-fns';
import { planLeg, Waypoint, Itinerary } from './otp';

export interface PlanningResult {
  feasible: boolean;
  legs: Array<{
    from: Waypoint;
    to: Waypoint;
    itinerary: Itinerary;
    stopAfter?: number;
  }>;
  totalDuration: number;
  warnings: string[];
}

async function planRouteBackward(
  waypoints: Waypoint[],
  arriveByDeadline: string,
  leaveBy?: string
): Promise<PlanningResult> {
  const warnings: string[] = [];
  let currentDeadline = arriveByDeadline;
  const rawLegs: PlanningResult['legs'] = [];

  for (let i = waypoints.length - 1; i >= 1; i--) {
    const from = waypoints[i - 1];
    const to = waypoints[i];

    const itineraries = await planLeg(from, to, currentDeadline, true);
    if (itineraries.length === 0) {
      return {
        feasible: false,
        legs: [],
        totalDuration: 0,
        warnings: [`No route found from "${from.label}" to "${to.label}" arriving by ${currentDeadline}`],
      };
    }

    // Pick itinerary with latest departure to maximise flexibility for earlier legs
    const best = itineraries.reduce((a, b) =>
      new Date(a.startTime) > new Date(b.startTime) ? a : b
    );

    rawLegs.unshift({ from, to, itinerary: best, stopAfter: from.stopDurationMinutes });

    const bufferMinutes = from.stopDurationMinutes ?? 0;
    const propagatedDeadline = subMinutes(parseISO(best.startTime), bufferMinutes);

    if (from.arriveBy) {
      const explicit = parseISO(from.arriveBy);
      currentDeadline = formatISO(explicit < propagatedDeadline ? explicit : propagatedDeadline);
      if (explicit > propagatedDeadline) {
        warnings.push(`Arrival constraint at "${from.label}" (${from.arriveBy}) is looser than what's required to make the next connection — the connection deadline (${formatISO(propagatedDeadline)}) takes precedence.`);
      }
    } else {
      currentDeadline = formatISO(propagatedDeadline);
    }
  }

  const firstDeparture = parseISO(rawLegs[0].itinerary.startTime);
  const lastArrival = parseISO(rawLegs[rawLegs.length - 1].itinerary.endTime);
  const totalDuration = (lastArrival.getTime() - firstDeparture.getTime()) / 60000;

  if (leaveBy && firstDeparture > parseISO(leaveBy)) {
    warnings.push(`Earliest feasible departure is ${formatISO(firstDeparture)}, which is after the requested leave-by time (${leaveBy}).`);
  }

  return { feasible: true, legs: rawLegs, totalDuration, warnings };
}

async function planRouteForward(
  waypoints: Waypoint[],
  leaveBy: string
): Promise<PlanningResult> {
  const warnings: string[] = [];
  const rawLegs: PlanningResult['legs'] = [];
  let currentDeparture = leaveBy;

  for (let i = 0; i < waypoints.length - 1; i++) {
    const from = waypoints[i];
    const to = waypoints[i + 1];

    const itineraries = await planLeg(from, to, currentDeparture, false);
    if (itineraries.length === 0) {
      return {
        feasible: false,
        legs: [],
        totalDuration: 0,
        warnings: [`No route found from "${from.label}" to "${to.label}" departing at ${currentDeparture}`],
      };
    }

    // Pick itinerary with earliest arrival
    const best = itineraries.reduce((a, b) =>
      new Date(a.endTime) < new Date(b.endTime) ? a : b
    );

    if (to.arriveBy && new Date(best.endTime) > new Date(to.arriveBy)) {
      warnings.push(`Cannot arrive at "${to.label}" by ${to.arriveBy} — earliest arrival is ${best.endTime}`);
    }

    rawLegs.push({ from, to, itinerary: best, stopAfter: to.stopDurationMinutes });

    const stopMinutes = to.stopDurationMinutes ?? 0;
    currentDeparture = formatISO(addMinutes(parseISO(best.endTime), stopMinutes));
  }

  const firstDeparture = parseISO(rawLegs[0].itinerary.startTime);
  const lastArrival = parseISO(rawLegs[rawLegs.length - 1].itinerary.endTime);
  const totalDuration = (lastArrival.getTime() - firstDeparture.getTime()) / 60000;

  return { feasible: true, legs: rawLegs, totalDuration, warnings };
}

export async function planRoute(
  waypoints: Waypoint[],
  arriveByDeadline: string | null,
  leaveBy?: string
): Promise<PlanningResult> {
  if (waypoints.length < 2) throw new Error('Need at least 2 waypoints');
  if (!arriveByDeadline && !leaveBy) throw new Error('arriveBy or leaveBy required');

  if (arriveByDeadline) {
    return planRouteBackward(waypoints, arriveByDeadline, leaveBy ?? undefined);
  }
  return planRouteForward(waypoints, leaveBy!);
}
