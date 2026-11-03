import { useCallback, useEffect, useState } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as Clipboard from 'expo-clipboard';
import { Share, View } from 'react-native';
import { describeAuthFailure, type InviteCode } from '@commontab/core';
import { Banner, Button, Card, Text } from '@commontab/ui';
import { useApp } from '../../../../src/app-context';
import { FormPage } from '../../../../src/components/FormPage';
import { useGroup } from '../../../../src/data';

const cache = new Map<string, InviteCode>();

const daysLeft = (expiresAt: string) => Math.max(1, Math.ceil((Date.parse(expiresAt) - Date.now()) / 86_400_000));

export default function Invite() {
  const router = useRouter();
  const { services } = useApp();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data } = useGroup(id);
  const [code, setCode] = useState<InviteCode | null>(id ? (cache.get(id) ?? null) : null);
  const [problem, setProblem] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const synced = data?.group.syncState === 'synced' && !data.group.localOnly;

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setProblem(null);
    try {
      const fresh = await services.api.createInviteCode(id);
      cache.set(id, fresh);
      setCode(fresh);
    } catch (error) {
      const failure = describeAuthFailure(error, 'signIn');
      setProblem(failure.kind === 'offline' ? 'Making a code needs an internet connection. Try again when you are back online.' : "Couldn't make a code right now. Try again in a moment.");
    } finally {
      setLoading(false);
    }
  }, [id, services]);

  useEffect(() => {
    if (!code && synced) void load();
  }, [code, synced, load]);

  const message = code && data ? `Join "${data.group.name}" on CommonTab with this code: ${code.code}` : '';

  const share = async () => {
    try {
      await Share.share({ message });
    } catch {
      await Clipboard.setStringAsync(message);
      setCopied(true);
    }
  };

  const copy = async () => {
    if (!code) return;
    await Clipboard.setStringAsync(code.code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <FormPage title="Invite people" trailing="done" onClose={() => router.back()}>
      <View className="w-full max-w-[560px] gap-4 self-center">
        <View className="gap-1 px-2 pt-2">
          <Text variant="large-title" accessibilityRole="header">Add friends to {data?.group.name ?? 'this group'}</Text>
          <Text variant="body-small" tone="muted" className="leading-[21px]">Send them this code. They enter it in CommonTab under Join with a code.</Text>
        </View>
        {data && !synced ? <Banner tone="warning" message="This group hasn't synced yet. Connect to the internet and wait for it to sync, then come back for a code." /> : null}
        {problem ? <Banner tone="error" message={problem} /> : null}
        <Card className="items-center gap-2 px-6 py-8">
          <Text variant="label" tone="muted">Invitation code</Text>
          <Text variant="large-title" accessibilityLabel={code ? `Invitation code ${code.code.split('').join(' ')}` : 'No code yet'} selectable className="text-[40px] leading-[46px] tracking-widest">
            {code ? code.code : loading ? '…' : '— — — —'}
          </Text>
          {code ? <Text variant="caption" tone="muted">Expires in {daysLeft(code.expiresAt)} days</Text> : null}
        </Card>
        {code ? (
          <>
            <Button label="Share invite" onPress={share} />
            <Button label={copied ? 'Copied' : 'Copy code'} variant="secondary" onPress={copy} />
          </>
        ) : (
          <Button label={problem ? 'Try again' : 'Get a code'} variant="secondary" loading={loading} disabled={!synced} onPress={load} />
        )}
        <View className="gap-1 rounded-card bg-card p-4">
          <Text variant="body-small" className="font-bold">Anyone with the code can join</Text>
          <Text variant="body-small" tone="muted" className="text-[13px] leading-[18px]">Only share it with people you want in this group.</Text>
        </View>
      </View>
    </FormPage>
  );
}
