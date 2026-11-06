import { Text, View } from 'react-native';
import { colors } from '@commontab/ui';
import { AMBER, Big, INK, OK, Row, Small, StatusBar, TitleBar, Tile } from '@/components/landing/PhoneParts';

const L = colors.light;

export function SplitScreen() {
  return (
    <View>
      <StatusBar />
      <TitleBar title="Dinner at Uchi" />
      <Tile><Small>Bill total</Small><Big>$163.50</Big></Tile>
      <Tile flush>
        <Row avatar="Y" left="You pay" right="$54.50" />
        <Row avatar="S" left="Sam pays" right="$54.50" />
        <Row avatar="R" left="Riya pays" right="$54.50" />
        <Row left="Adds up to" right="$163.50" color={OK} strong last />
      </Tile>
    </View>
  );
}

export function OfflineScreen() {
  return (
    <View>
      <StatusBar />
      <TitleBar title="Lisbon trip" />
      <View style={{ marginHorizontal: 12, marginVertical: 8, borderRadius: 12, backgroundColor: L.warn, paddingVertical: 10, paddingHorizontal: 12 }}>
        <Text style={{ fontSize: 13, color: L['on-warn'] }}>You're offline. 2 changes will sync when you're back.</Text>
      </View>
      <Tile flush>
        <Row left="Brunch · $54.00" right="waiting" color={AMBER} />
        <Row left="Taxi · $54.00" right="waiting" color={AMBER} />
        <Row left="Dinner at Uchi" right="synced" color={OK} last />
      </Tile>
    </View>
  );
}

export function CurrencyScreen() {
  return (
    <View>
      <StatusBar />
      <TitleBar title="Lisbon trip" />
      <Tile>
        <Small>Hotel</Small>
        <Big>€120.00</Big>
        <View style={{ marginTop: 8 }}>
          <Row left="Rate" right="1 EUR = 1.08 USD" />
          <Row left="Counts as" right="$129.60" color={OK} strong last />
        </View>
      </Tile>
    </View>
  );
}

export function SettleScreen() {
  return (
    <View>
      <StatusBar />
      <TitleBar title="Settle up" />
      <Tile>
        <Small>Simplified</Small>
        <Text style={{ fontSize: 36, lineHeight: 40, fontWeight: '600', letterSpacing: -1.8, color: INK }}>
          <Text style={{ textDecorationLine: 'line-through', color: '#9B9B9B' }}>4</Text> → 2
        </Text>
        <View style={{ marginTop: 8 }}>
          <Row left="Jordan pays You" right="$40.00" />
          <Row left="Sam pays You" right="$5.00" last />
        </View>
      </Tile>
    </View>
  );
}

export const FEATURE_SCREENS = [SplitScreen, OfflineScreen, CurrencyScreen, SettleScreen];
