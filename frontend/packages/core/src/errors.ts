export type CoreErrorCode =
  | 'invalid_amount'
  | 'invalid_currency'
  | 'invalid_participants'
  | 'invalid_allocation'
  | 'invalid_percentage'
  | 'invalid_bill'
  | 'invalid_ledger'
  | 'invalid_settlement';

export class CoreError extends Error {
  constructor(
    readonly code: CoreErrorCode,
    message: string = code,
  ) {
    super(message);
    this.name = 'CoreError';
  }
}
