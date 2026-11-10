import { Text, View, type TextStyle } from 'react-native';
import { Button, colors } from '@commontab/ui';
import { PINNED_STEPS, type PinnedAction } from '@/constants/landing';
import { FEATURE_SCREENS } from '@/components/landing/FeatureScreens';
import { PhoneShell } from '@/components/landing/PhoneParts';

const L = colors.light;
const FADE = { transition: 'opacity 600ms cubic-bezier(0.22, 1, 0.36, 1), transform 600ms cubic-bezier(0.22, 1, 0.36, 1)' };
const HEADING: TextStyle = { fontSize: 46, lineHeight: 47, fontWeight: '300', letterSpacing: -2.07, color: L.fg };
const BODY: TextStyle = { fontSize: 19, lineHeight: 24.7, letterSpacing: -0.38, color: L.fg };
const GLOW = { position: 'absolute', left: '50%', top: '50%', width: 760, height: 760, marginLeft: -380, marginTop: -380, backgroundImage: 'radial-gradient(closest-side, rgba(11,67,80,0.07), rgba(11,67,80,0))' };

interface Props {
  step: number;
  onLayout: (e: never) => void;
  onAction: (action: PinnedAction) => void;
}

export function PinnedFeatures({ step, onLayout, onAction }: Props) {
  return (
    <View onLayout={onLayout as never} className="w-full" style={{ backgroundColor: '#FFFFFF' }}>
      <View className="hidden lg:flex" style={{ height: `${PINNED_STEPS.length * 100}vh` } as never}>
        <View className="px-5" style={{ position: 'sticky', top: 0, height: '100vh', width: '100%', flexDirection: 'row', alignItems: 'center', gap: 48, overflow: 'hidden' } as never}>
          <View pointerEvents="none" style={GLOW as never} />
          <View style={{ flex: 1, height: '60vh' } as never}>
            {PINNED_STEPS.map((item, index) => (
              <View key={item.title} style={{ position: 'absolute', left: 0, bottom: 0, maxWidth: 340, opacity: index === step ? 1 : 0, transform: [{ translateY: index === step ? 0 : 12 }], ...FADE } as never}>
                <Text accessibilityRole="header" style={HEADING}>{item.title}</Text>
              </View>
            ))}
          </View>

          <View aria-hidden style={{ width: 332, height: 560 }}>
            <PhoneShell width={332} height={560} radius={44} shadow={0.18}>
              {FEATURE_SCREENS.map((Screen, index) => (
                <View key={index} style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, opacity: index === step ? 1 : 0, ...FADE } as never}>
                  <Screen />
                </View>
              ))}
            </PhoneShell>
          </View>

          <View style={{ flex: 1, height: '60vh' } as never}>
            {PINNED_STEPS.map((item, index) => (
              <View key={item.title} pointerEvents={index === step ? 'auto' : 'none'} style={{ position: 'absolute', left: 0, top: '38%', maxWidth: 340, opacity: index === step ? 1 : 0, transform: [{ translateY: index === step ? 0 : 12 }], ...FADE } as never}>
                <Text style={BODY}>{item.body}</Text>
                <View style={{ marginTop: 24 }}><Button label={item.label} variant="outline" size="small" className="self-start" onPress={() => onAction(item.action)} /></View>
              </View>
            ))}
          </View>
        </View>
      </View>

      <View className="px-5 pb-14 pt-6 lg:hidden">
        {PINNED_STEPS.map((item, index) => {
          const Screen = FEATURE_SCREENS[index] as (typeof FEATURE_SCREENS)[number];
          return (
            <View key={item.title} style={{ paddingVertical: 40 }}>
              <Text accessibilityRole="header" style={{ ...HEADING, fontSize: 34, lineHeight: 34.7, letterSpacing: -1.53 }}>{item.title}</Text>
              <Text style={{ ...BODY, fontSize: 18, lineHeight: 23.4, marginTop: 12 }}>{item.body}</Text>
              <View style={{ marginTop: 20 }}><Button label={item.label} variant="outline" size="small" className="self-start" onPress={() => onAction(item.action)} /></View>
              <View aria-hidden style={{ alignSelf: 'center', marginTop: 28 }}>
                <PhoneShell width={300} height={560} radius={40} shadow={0.15}><Screen /></PhoneShell>
              </View>
            </View>
          );
        })}
      </View>
    </View>
  );
}
