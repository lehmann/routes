import { NextRequest, NextResponse } from 'next/server';
import { planRoute } from '@/lib/planner';
import { Waypoint } from '@/lib/otp';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { waypoints, arriveBy, leaveBy }: { waypoints: Waypoint[]; arriveBy?: string; leaveBy?: string } = body;

    if (!waypoints || waypoints.length < 2) {
      return NextResponse.json({ error: 'At least 2 waypoints required' }, { status: 400 });
    }
    if (!arriveBy && !leaveBy) {
      return NextResponse.json({ error: 'arriveBy or leaveBy is required' }, { status: 400 });
    }

    const result = await planRoute(waypoints, arriveBy ?? null, leaveBy);
    return NextResponse.json(result);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
