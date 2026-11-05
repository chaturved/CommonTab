import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { MIN_PASSWORD_LENGTH, passwordProgress } from '@commontab/core';
import { Banner, Button, FieldGroup, FieldLayoutProvider, FieldRow, PasswordMeter, Sheet, Text } from '@commontab/ui';
import { useApp } from '@/context/AppContext';
import { FailureBanner } from '@/components/auth/FailureBanner';
import { useSubmit } from '@/hooks/useSubmit';

export function ChangeNameSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const { user, renameMe } = useApp();
  const [name, setName] = useState(user?.name ?? '');
  const { busy, failure, run, clear } = useSubmit('rename');

  useEffect(() => {
    if (visible) {
      setName(user?.name ?? '');
      clear();
    }
  }, [visible]);

  const save = async () => {
    if (await run(() => renameMe(name.trim()))) onClose();
  };

  return (
    <Sheet visible={visible} onClose={onClose} title="Change name">
      <FailureBanner failure={failure} />
      <FieldLayoutProvider layout="stacked">
        <FieldGroup>
          <FieldRow label="Name" value={name} onChangeText={setName} maxLength={80} autoCapitalize="words" autoFocus onSubmitEditing={() => name.trim() && void save()} />
        </FieldGroup>
      </FieldLayoutProvider>
      <Button label="Save" loading={busy} disabled={name.trim().length === 0 || name.trim() === user?.name} onPress={save} />
    </Sheet>
  );
}

export function ChangePasswordSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const { changePassword } = useApp();
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [done, setDone] = useState(false);
  const { busy, failure, run, clear } = useSubmit('changePassword');
  const progress = passwordProgress(next);

  useEffect(() => {
    if (visible) {
      setCurrent('');
      setNext('');
      setDone(false);
      clear();
    }
  }, [visible]);

  const save = async () => {
    if (await run(() => changePassword(current, next))) setDone(true);
  };

  return (
    <Sheet visible={visible} onClose={onClose} title="Change password">
      {done ? (
        <>
          <Banner tone="info" message="Your password was changed. Other devices were signed out." />
          <Button label="Done" onPress={onClose} />
        </>
      ) : (
        <>
          <FailureBanner failure={failure} />
          <FieldLayoutProvider layout="stacked">
            <FieldGroup>
              <FieldRow label="Current password" value={current} onChangeText={setCurrent} secureTextEntry autoComplete="current-password" textContentType="password" autoFocus />
              <FieldRow label="New password" value={next} onChangeText={setNext} secureTextEntry autoComplete="new-password" textContentType="newPassword" />
            </FieldGroup>
          </FieldLayoutProvider>
          <PasswordMeter length={progress.length} required={MIN_PASSWORD_LENGTH} />
          <Button label="Change password" loading={busy} disabled={current.length === 0 || !progress.complete} onPress={save} />
        </>
      )}
    </Sheet>
  );
}

export function DeleteAccountSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const { deleteAccount } = useApp();
  const [password, setPassword] = useState('');
  const { busy, failure, run, clear } = useSubmit('deleteAccount');

  useEffect(() => {
    if (visible) {
      setPassword('');
      clear();
    }
  }, [visible]);

  return (
    <Sheet visible={visible} onClose={onClose} title="Delete your account?">
      <Text variant="body-small" tone="fg-soft" className="leading-[22px]">
        This signs you out everywhere and removes your account. Groups that only you belong to are deleted. In shared groups your name stays on the expenses you were part of, so everyone else's balances stay the same. This can't be undone.
      </Text>
      <FailureBanner failure={failure} />
      <FieldLayoutProvider layout="stacked">
        <FieldGroup>
          <FieldRow label="Your password" value={password} onChangeText={setPassword} secureTextEntry autoComplete="current-password" textContentType="password" autoFocus />
        </FieldGroup>
      </FieldLayoutProvider>
      <View className="gap-2.5">
        <Button label="Delete my account" loading={busy} disabled={password.length === 0} onPress={() => void run(() => deleteAccount(password))} />
        <Button label="Keep my account" variant="secondary" onPress={onClose} />
      </View>
    </Sheet>
  );
}
