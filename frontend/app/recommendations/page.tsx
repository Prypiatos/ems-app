'use client';

import { useEffect, useState } from 'react';
import Recommendations from '../components/recommendations';
import { Shell } from '../components/shared/shell';
import { wsUrl } from '../../lib/apiGateway';

export default function Page() {
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    const ws = new WebSocket(wsUrl('/py/ws/live'));
    ws.onopen = () => setConnected(true);
    ws.onclose = () => setConnected(false);
    ws.onerror = () => setConnected(false);
    return () => ws.close();
  }, []);

  return (
    <Shell title="Recommendations" connected={connected}>
      <Recommendations />
    </Shell>
  );
}
