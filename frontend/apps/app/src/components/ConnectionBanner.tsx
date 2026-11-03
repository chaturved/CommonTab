import { WifiOff } from 'lucide-react-native';
import { Banner, Icon } from '@commontab/ui';
import { useSyncStatus } from '../useSyncStatus';

export function ConnectionBanner() {
  const status = useSyncStatus();
  if (!status || status.connectivity === 'online' || status.connectivity === 'sessionExpired') return null;
  const offline = status.connectivity === 'offline';
  return (
    <Banner
      tone="warning"
      icon={<Icon icon={WifiOff} size={20} strokeWidth={2} tone="warn-icon" />}
      title={offline ? "You're offline." : "CommonTab can't be reached."}
      message={offline ? "Changes are saved on this phone and sync when you're back." : "Changes are saved on this phone and sync when it's back."}
    />
  );
}
