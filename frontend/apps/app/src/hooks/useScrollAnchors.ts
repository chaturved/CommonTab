import { ComponentRef, useRef } from 'react';
import type { ScrollView } from 'react-native';

type LayoutEvent = { nativeEvent: { layout: { y: number } } };

export function useScrollAnchors<K extends string>(offset = 12) {
  const scroll = useRef<ComponentRef<typeof ScrollView>>(null);
  const spots = useRef<Partial<Record<K, number>>>({});
  return {
    scroll,
    mark: (anchor: K) => ({ onLayout: (e: LayoutEvent) => { spots.current[anchor] = e.nativeEvent.layout.y; } }),
    jump: (anchor: K) => scroll.current?.scrollTo({ y: Math.max(0, (spots.current[anchor] ?? 0) - offset), animated: true }),
  };
}
