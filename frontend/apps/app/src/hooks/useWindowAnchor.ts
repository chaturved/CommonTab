import { ComponentRef, useRef, useState } from 'react';
import type { View } from 'react-native';

export interface AnchorBox { x: number; y: number; w: number; h: number }

export function useWindowAnchor() {
  const ref = useRef<ComponentRef<typeof View>>(null);
  const [box, setBox] = useState<AnchorBox | null>(null);
  const measure = (then: () => void) => {
    ref.current?.measureInWindow((x: number, y: number, w: number, h: number) => {
      setBox({ x, y, w, h });
      then();
    });
  };
  return { ref, box, measure };
}
