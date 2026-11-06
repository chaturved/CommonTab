import { ReactNode, useState } from 'react';
import { View } from 'react-native';
import { Popover } from '@/components/ui/Popover';
import { useWindowAnchor } from '@/hooks/useWindowAnchor';

interface Props {
  label: string;
  width?: number;
  align?: 'start' | 'end';
  content: (close: () => void) => ReactNode;
  children: (open: () => void, isOpen: boolean) => ReactNode;
}

export function Dropdown({ label, width, align, content, children }: Props) {
  const { ref, box, measure } = useWindowAnchor();
  const [visible, setVisible] = useState(false);
  const close = () => setVisible(false);
  return (
    <>
      <View ref={ref} collapsable={false}>{children(() => measure(() => setVisible(true)), visible)}</View>
      <Popover visible={visible} onClose={close} anchor={box} label={label} width={width ?? Math.max(220, box?.w ?? 0)} align={align}>
        {content(close)}
      </Popover>
    </>
  );
}
