"use client";

import { useEffect, useState } from 'react';
import { nodeService } from '@/services/nodeService';

interface Node {
  node_id: string;
  node_type: string;
  status: string;
}

export function NodeGrid() {
  const [nodes, setNodes] = useState<Node[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    async function fetchNodes() {
      try {
        const data = await nodeService.getAllNodes();
        setNodes(data);
      } catch (err) {
        console.error("Failed to fetch nodes:", err);
        setError('Failed to load system nodes');
      } finally {
        setLoading(false);
      }
    }

    fetchNodes();
  }, []);

  if (loading) {
    return (
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-32 animate-pulse rounded-2xl bg-panel border border-border-subtle" />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-2xl bg-red-500/10 p-4 text-center text-sm font-medium text-red-500 border border-red-500/20">
        {error}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {nodes.map((node) => (
        <div key={node.node_id} className="rounded-2xl border border-border-subtle bg-panel p-5 transition-all hover:shadow-md">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-muted">{node.node_type}</p>
              <h3 className="mt-1 text-lg font-bold">{node.node_id}</h3>
            </div>
            <div className={`flex h-8 w-8 items-center justify-center rounded-lg ${
              node.status === 'online' ? 'bg-green-500/10 text-green-500' : 
              node.status === 'degraded' ? 'bg-yellow-500/10 text-yellow-500' : 'bg-red-500/10 text-red-500'
            }`}>
              <div className={`h-2 w-2 rounded-full ${
                node.status === 'online' ? 'bg-green-500 animate-pulse' : 
                node.status === 'degraded' ? 'bg-yellow-500' : 'bg-red-500'
              }`} />
            </div>
          </div>
          <div className="mt-4 flex items-center justify-between text-sm">
            <span className="text-muted">Status</span>
            <span className="font-medium capitalize">{node.status}</span>
          </div>
        </div>
      ))}
    </div>
  );
}
