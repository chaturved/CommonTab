import type { ActivityEvent } from '@commontab/core';
import { useLiveQuery } from '@/hooks/useLiveQuery';

const NO_EVENTS: ActivityEvent[] = [];

export function useActivityEvents(): { ready: boolean; events: ActivityEvent[] } {
  const { ready, value } = useLiveQuery(({ storage }) => storage.listActivity(), NO_EVENTS);
  return { ready, events: value };
}
