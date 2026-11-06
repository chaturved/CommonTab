import { useRef, useState } from 'react';
import type { LayoutChangeEvent, NativeScrollEvent, NativeSyntheticEvent } from 'react-native';

export function usePinnedStep(count: number) {
  const top = useRef(0);
  const [step, setStep] = useState(0);
  const [onLight, setOnLight] = useState(false);
  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const { contentOffset, layoutMeasurement } = e.nativeEvent;
    const next = Math.floor((contentOffset.y - top.current + layoutMeasurement.height * 0.5) / layoutMeasurement.height);
    const clamped = Math.min(count - 1, Math.max(0, next));
    setStep((previous) => (previous === clamped ? previous : clamped));
    const headerY = contentOffset.y + 40;
    const light = top.current > 0 && headerY >= top.current && headerY < top.current + count * layoutMeasurement.height;
    setOnLight((previous) => (previous === light ? previous : light));
  };
  const onLayout = (e: LayoutChangeEvent) => {
    top.current = e.nativeEvent.layout.y;
  };
  return { step, onLight, onScroll, onLayout };
}
