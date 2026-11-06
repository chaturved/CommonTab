import { View } from 'react-native';
import { Big, OK, Row, Small, Tile } from '@/components/landing/PhoneParts';

export function AuthPeek() {
  return (
    <View aria-hidden pointerEvents="none" style={{ position: 'absolute', right: 56, bottom: -200, width: 300, height: 500, borderRadius: 52, padding: 12, backgroundColor: '#0B0F10', boxShadow: '0 40px 90px rgba(0,0,0,0.35)' } as never}>
      <View style={{ flex: 1, borderRadius: 40, backgroundColor: '#FFFFFF', overflow: 'hidden', paddingTop: 18 }}>
        <Tile>
          <Small>Dinner at Uchi</Small>
          <Big size={32}>$163.50</Big>
        </Tile>
        <Tile flush>
          <Row left="You pay" right="$54.50" />
          <Row left="Sam pays" right="$54.50" />
          <Row left="Riya pays" right="$54.50" />
          <Row left="Adds up to" right="$163.50" color={OK} strong last />
        </Tile>
      </View>
    </View>
  );
}
