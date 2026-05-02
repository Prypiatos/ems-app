# Smoke Test Day 1 - Kafka to Frontend Realtime Pipeline

Date: 2026-05-02
Project: EMS App

## Scope requested
- Publish synthetic `energy.readings` events to Kafka.
- Verify consumer group offsets.
- Verify InfluxDB writes.
- Verify Socket.IO room emission.
- Verify frontend chart updates.
- Measure end-to-end latency from publish timestamp to render timestamp.

## Environment observed
- Running containers:
  - `broker` (Kafka)
  - `ems-backend`
  - `kong`
- No InfluxDB service is defined in `docker-compose.yml`.
- Backend realtime route currently implemented as raw WebSocket `GET /readings` (not Socket.IO namespace room join).

## Artifacts created
- Kafka publish script: `scripts/publish_energy_readings_kcat.sh`
- WS probe script: `frontend/scripts/ws_latency_probe.cjs`

## Step-by-step trace

### 1) Publish 10 synthetic Kafka messages
Command:
```bash
scripts/publish_energy_readings_kcat.sh
```
Result:
- `Published 10 messages to energy.readings on localhost:9092`
- Messages include `ts_ms` publish timestamp and `division_id`/`divisionId` fields.

### 2) Verify consumer group offsets
Command:
```bash
docker compose exec broker /opt/kafka/bin/kafka-consumer-groups.sh --bootstrap-server localhost:9092 --describe --group e3-readings
```
Result:
- Failed: `Group e3-readings not found`.

Command:
```bash
docker compose exec broker /opt/kafka/bin/kafka-consumer-groups.sh --bootstrap-server localhost:9092 --describe --group energy-readings
```
Observed:
- `CURRENT-OFFSET=5`
- `LOG-END-OFFSET=10`
- `LAG=5`

Interpretation:
- Active backend group is `energy-readings` (not `e3-readings`).
- Consumer was not caught up after publish.

### 3) Backend log inspection
Command:
```bash
docker compose logs --tail=120 ems-backend
```
Observed critical line:
- `MAXPOLL ... Application maximum poll interval (300000ms) exceeded ... leaving group`

Interpretation:
- Kafka consumer left the group due max poll interval breach.
- This explains stale offsets and missing downstream realtime updates.

### 4) InfluxDB verification
Requested command:
```bash
influx query 'from(bucket:"energy-readings") |> range(start:-5m) |> last()'
```
Result:
- Blocked: no InfluxDB service/client/config is present in this repo environment.
- No backend Influx write path was found by code search.

### 5) Socket realtime verification
- Requested: Socket.IO namespace `/realtime/readings`, room `division:{divisionId}`, event `reading:update`.
- Actual backend implementation: raw WebSocket endpoint `GET /readings` with topic hub `energy.readings`.
- Kong route `/api/ws` currently strips to backend `/` and returns HTTP 200 (not websocket upgrade).
- Authenticated websocket to `/api/readings` does connect, but no reading frames arrived during probe while consumer lag persisted.

### 6) Frontend chart update and latency
- Frontend render verification (`LiveLineChart` visual update) was not completed in this headless CLI environment.
- Publish-to-chart-render latency was not measurable because no realtime payload reached websocket client after publish in this run.

## Acceptance criteria status
- Full pipeline verified end-to-end: **Not met**
- Latency < 1s publish to chart: **Not met (not measurable in current state)**
- InfluxDB data confirmed via CLI query: **Not met (Influx not present)**
- Test results documented: **Met**

## Key blockers found
1. Consumer group name mismatch vs request (`e3-readings` requested, `energy-readings` implemented).
2. Backend consumer hit `MAXPOLL` and left group.
3. Realtime contract mismatch: requested Socket.IO rooms/events vs current raw WebSocket topic stream.
4. Kong websocket route mismatch (`/api/ws` to backend `/`).
5. InfluxDB pipeline not present in current compose/codebase.

## Recommended next fixes before rerun
1. Stabilize Kafka consumer loop so `energy-readings` group remains healthy and lag reaches 0.
2. Align realtime protocol:
   - either implement Socket.IO `/realtime/readings` + room join/events,
   - or update frontend hook/requirements to raw websocket `/api/readings` topic feed.
3. Fix Kong WS route mapping so the public WS path upgrades correctly.
4. Add and wire InfluxDB service + writer path if Influx verification is mandatory.
5. Re-run this smoke trace and capture latency once payloads reliably reach frontend chart.
