import type { ActivityEvent } from '@commontab/core';
import type { Services } from '@/services/createServices';
import { useLiveQuery } from '@/hooks/useLiveQuery';

const NO_EVENTS: ActivityEvent[] = [];

const loadActivity = ({ storage }: Services) => storage.listActivity();

export function useActivityEvents(): { ready: boolean; events: ActivityEvent[] } {
  const { ready, value } = useLiveQuery(loadActivity, NO_EVENTS);
  return { ready, events: value };
}
