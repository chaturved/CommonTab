import { Slot } from 'expo-router';
import { SessionExpiredSheet } from '../../src/auth/SessionExpiredSheet';

export default function AppLayout() {
  return (
    <>
      <Slot />
      <SessionExpiredSheet />
    </>
  );
}
