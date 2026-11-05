import { WifiOff } from 'lucide-react-native';
import { View } from 'react-native';
import { Banner, Icon, Pill, Text } from '@commontab/ui';
import { useIsDesktop } from '@/hooks/useViewport';
import { useSyncStatus } from '@/hooks/useSyncStatus';

export function ConnectionBanner() {
  const status = useSyncStatus();
  const desktop = useIsDesktop();
  if (!status || status.connectivity === 'online' || status.connectivity === 'sessionExpired') return null;
  const offline = status.connectivity === 'offline';
  const where = desktop ? 'this browser' : 'this phone';
  const title = offline ? "You're offline." : "CommonTab can't be reached.";
  const message = offline ? `Changes are saved on ${where} and sync when you're back.` : `Changes are saved on ${where} and sync when it's back.`;
  if (desktop) {
    return (
      <View role="status" accessible accessibilityLabel={`${title} ${message}${status.waiting > 0 ? ` ${status.waiting} waiting` : ''}`} className="min-h-touch flex-row items-center gap-2.5 rounded-2xl bg-warn px-3.5 py-2.5">
        <Icon icon={WifiOff} size={20} strokeWidth={2} tone="warn-icon" />
        <Text variant="caption" tone="on-warn" className="flex-1 text-[13px] leading-[18px]">
          <Text variant="caption" tone="on-warn" className="text-[13px] font-bold">{title} </Text>
          {message}
        </Text>
        {status.waiting > 0 ? <Pill tone="warn" label={`${status.waiting} waiting`} /> : null}
      </View>
    );
  }
  return <Banner tone="warning" icon={<Icon icon={WifiOff} size={20} strokeWidth={2} tone="warn-icon" />} title={title} message={message} />;
}
