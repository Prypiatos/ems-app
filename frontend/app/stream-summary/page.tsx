'use client';

import StreamSummary from '../components/stream-summary';
import { Shell } from '../components/shared/shell';

export default function Page() {
  return (
    <Shell title="Stream Summary">
      <StreamSummary />
    </Shell>
  );
}
