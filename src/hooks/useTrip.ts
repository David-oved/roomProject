import { useMemo } from 'react';
import { useRtdbList, useRtdbValue } from './useRtdb';
import { useRoom } from '../store/RoomContext';
import type { Trip, TripLine } from '../types/models';

/** מזהה הקנייה הגדולה הפעילה בחדר, אם יש — null אם אין. */
export function useActiveTripId() {
  const { roomCode } = useRoom();
  return useRtdbValue<string>(roomCode ? `rooms/${roomCode}/activeTripId` : null);
}

/** קנייה גדולה בודדת, כולל שורות הרשימה שלה, ממוינות לפי סדר הוספה. */
export function useTrip(tripId: string | null) {
  const { roomCode } = useRoom();
  const trip = useRtdbValue<Trip>(roomCode && tripId ? `rooms/${roomCode}/trips/${tripId}` : null);
  const linesState = useRtdbList<TripLine>(
    roomCode && tripId ? `rooms/${roomCode}/trips/${tripId}/lines` : null
  );

  const lines = useMemo(
    () => [...linesState.data].sort((a, b) => (a.addedAt ?? 0) - (b.addedAt ?? 0)),
    [linesState.data]
  );

  return {
    trip: trip.data,
    lines,
    loading: trip.loading || linesState.loading,
    error: trip.error ?? linesState.error,
    fromCache: trip.fromCache || linesState.fromCache,
  };
}
