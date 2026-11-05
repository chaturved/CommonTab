import { useState } from 'react';
import { View } from 'react-native';
import { MIN_PASSWORD_LENGTH, passwordProgress } from '@commontab/core';
import { Banner, Button, FieldGroup, FieldLayoutProvider, FieldRow, PasswordMeter, Sheet, Text } from '@commontab/ui';
import { useApp } from '@/context/AppContext';
import { FailureBanner } from '@/components/auth/FailureBanner';
import { useSubmit } from '@/hooks/useSubmit';

type SheetProps = { visible: boolean; onClose: () => void };

export function ChangeNameSheet({ visible, onClose }: SheetProps) {
  return (
    <Sheet visible={visible} onClose={onClose} title="Change name">
      <ChangeNameForm onClose={onClose} />
    </Sheet>
  );
}

function ChangeNameForm({ onClose }: { onClose: () => void }) {
  const { user, renameMe } = useApp();
  const [name, setName] = useState(user?.name ?? '');
  const { busy, failure, run } = useSubmit('rename');

  const save = async () => {
    if (await run(() => renameMe(name.trim()))) onClose();
  };

  return (
    <>
      <FailureBanner failure={failure} />
      <FieldLayoutProvider layout="stacked">
        <FieldGroup>
          <FieldRow label="Name" value={name} onChangeText={setName} maxLength={80} autoCapitalize="words" autoFocus onSubmitEditing={() => name.trim() && void save()} />
        </FieldGroup>
      </FieldLayoutProvider>
      <Button label="Save" loading={busy} disabled={name.trim().length === 0 || name.trim() === user?.name} onPress={save} />
    </>
  );
}

export function ChangePasswordSheet({ visible, onClose }: SheetProps) {
  return (
    <Sheet visible={visible} onClose={onClose} title="Change password">
      <ChangePasswordForm onClose={onClose} />
    </Sheet>
  );
}

function ChangePasswordForm({ onClose }: { onClose: () => void }) {
  const { changePassword } = useApp();
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [done, setDone] = useState(false);
  const { busy, failure, run } = useSubmit('changePassword');
  const progress = passwordProgress(next);

  const save = async () => {
    if (await run(() => changePassword(current, next))) setDone(true);
  };

  return (
    <>
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
    </>
  );
}

export function DeleteAccountSheet({ visible, onClose }: SheetProps) {
  return (
    <Sheet visible={visible} onClose={onClose} title="Delete your account?">
      <DeleteAccountForm onClose={onClose} />
    </Sheet>
  );
}

function DeleteAccountForm({ onClose }: { onClose: () => void }) {
  const { deleteAccount } = useApp();
  const [password, setPassword] = useState('');
  const { busy, failure, run } = useSubmit('deleteAccount');

  return (
    <>
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
    </>
  );
}
