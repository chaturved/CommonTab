import { View } from 'react-native';
import { Text } from '@commontab/ui';
import { BrandMark } from '@/components/ui/BrandMark';

export function AuthBrand({ boxed }: { boxed?: boolean }) {
  return (
    <View accessibilityRole="header" accessibilityLabel="CommonTab" className="flex-row items-center gap-2">
      {boxed ? (
        <View aria-hidden className="h-[46px] w-[46px] items-center justify-center rounded-xl border border-site-line bg-hero-to">
          <BrandMark size={34} />
        </View>
      ) : (
        <BrandMark size={30} />
      )}
      <Text aria-hidden className="!text-lg tracking-[-0.72px]">
        <Text className="!text-lg font-bold">Common</Text>
        <Text className="!text-lg font-normal">Tab</Text>
      </Text>
    </View>
  );
}
