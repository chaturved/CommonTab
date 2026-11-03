import { fireEvent, render, screen } from '@testing-library/react-native';
import { BackButton, FieldGroup, FieldRow, PasswordMeter, SegmentedControl } from '../src';

describe('FieldRow', () => {
  test('the input is found by its label and reports typing', async () => {
    const onChangeText = jest.fn();
    await render(
      <FieldGroup>
        <FieldRow label="Email" onChangeText={onChangeText} />
        <FieldRow label="Password" secureTextEntry last />
      </FieldGroup>,
    );
    await fireEvent.changeText(screen.getByLabelText('Email'), 'a@b.co');
    expect(onChangeText).toHaveBeenCalledWith('a@b.co');
    expect(screen.getByLabelText('Password').props.secureTextEntry).toBe(true);
  });

  test('rows use min-height and only the last row drops its divider', async () => {
    await render(
      <FieldGroup>
        <FieldRow label="One" testID="one" />
        <FieldRow label="Two" testID="two" last />
      </FieldGroup>,
    );
    const classes = (id: string) => {
      let node = screen.getByTestId(id).parent;
      while (node && !String(node.props.className ?? '').includes('min-h-row')) node = node.parent;
      return String(node?.props.className);
    };
    expect(classes('one')).toContain('min-h-row');
    expect(classes('one')).toContain('border-b');
    expect(classes('two')).not.toContain('border-b');
  });
});

describe('PasswordMeter', () => {
  test('says how far along and how many to go, in one spoken label', async () => {
    await render(<PasswordMeter length={11} required={15} />);
    expect(screen.getByLabelText('11 of 15 characters. 4 more to go')).toBeTruthy();
    expect(screen.getByTestId('password-meter-fill', { includeHiddenElements: true }).props.style.width).toBe('73%');
  });

  test('turns to done at the required length and never goes past full', async () => {
    await render(<PasswordMeter length={30} required={15} />);
    expect(screen.getByLabelText('15 of 15 characters. Long enough')).toBeTruthy();
    expect(screen.getByTestId('password-meter-fill', { includeHiddenElements: true }).props.style.width).toBe('100%');
  });
});

describe('BackButton', () => {
  test('is a labeled button', async () => {
    const onPress = jest.fn();
    await render(<BackButton onPress={onPress} />);
    await fireEvent.press(screen.getByRole('button', { name: 'Back' }));
    expect(onPress).toHaveBeenCalled();
  });
});

describe('SegmentedControl', () => {
  test('marks the selected option and reports a change', async () => {
    const onChange = jest.fn();
    await render(<SegmentedControl options={[{ key: 'active', label: 'Active · 2' }, { key: 'settled', label: 'Settled · 1' }]} value="active" onChange={onChange} />);
    expect(screen.getByRole('tab', { name: 'Active · 2' }).props.accessibilityState).toMatchObject({ selected: true });
    expect(screen.getByRole('tab', { name: 'Settled · 1' }).props.accessibilityState).toMatchObject({ selected: false });
    await fireEvent.press(screen.getByRole('tab', { name: 'Settled · 1' }));
    expect(onChange).toHaveBeenCalledWith('settled');
  });
});
