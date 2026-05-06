'use client';

import Recommendations from '../components/recommendations';
import { Shell } from '../components/shared/shell';

export default function Page() {
  return (
    <Shell title="Recommendations">
      <Recommendations />
    </Shell>
  );
}
