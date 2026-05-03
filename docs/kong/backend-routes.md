# EMS Backend Routes (for Kong)

This file lists the backend HTTP and WebSocket endpoints and a minimal Kong configuration snippet for routing/proxying.

Quick endpoints

- GET /api/v1/health
  - Returns: JSON {"status":"ok"}

- GET /api/v1/health/{node_id}
  - Returns: per-node health status (JSON)

- GET /api/v1/nodes
  - Returns: list of nodes (JSON)

- GET /api/v1/nodes/{node_id}
  - Returns: node details (JSON)

- GET /api/v1/energy/aggregate
  - Returns: aggregated energy metrics (JSON)

- GET /api/v1/prediction
  - Returns: forecast/prediction data (JSON)

- GET /api/v1/anomalies
  - Returns: detected anomalies (JSON)

- GET /api/v1/alerts
  - Returns: active alerts (JSON)

WebSocket (realtime readings)

- WS Upgrade: /api/v1/readings
  - Backend performs a WebSocket upgrade and streams JSON frames for realtime readings.
  - The backend topics use `energy.readings` (internal hub). Frames are plain JSON messages (not Socket.IO frames).

Kong notes / example

- Ensure the route preserves the full request path (so `/api/v1/...` is forwarded to the backend).
- Allow websocket protocols on the Kong route (ws/wss) so upgrades reach the backend.
- Example (declarative snippet):

```yaml
_format_version: "1.1"
services:
  - name: ems-backend
    url: http://backend:8080
    routes:
      - name: ems-api
        paths:
          - /api
        protocols: [http, https, ws, wss]
        strip_path: false
``` 

Notes

- Authentication: Kong can enforce auth (Basic, OAuth, etc.). The backend expects the `Authorization` header to reach it for any protected endpoints. Configure your Kong plugins accordingly.
- WebSocket clients must connect to the Kong route (e.g., `ws://<kong-host>/api/v1/readings`) and Kong must allow the upgrade to pass through.

If you need a full example `kong.yml` for your environment or help adding authentication plugins, I can prepare one.
