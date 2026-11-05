import { Banner } from '@commontab/ui';
import type { AuthFailure } from '@commontab/core';

export function FailureBanner({ failure }: { failure: AuthFailure | null }) {
  if (!failure) return null;
  return <Banner tone={failure.kind === 'offline' ? 'warning' : 'error'} title={failure.title} message={failure.message} />;
}
