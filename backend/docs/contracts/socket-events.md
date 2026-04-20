# WebSocket Event Contracts

> **Status**: Draft — API contracts not yet finalized.  
> **Protocol**: WebSocket (RFC 6455) over `ws://` / `wss://`  
> **Endpoint**: `GET /ws` (HTTP upgrade)  
> **Library**: `gorilla/websocket`

---

## Connection

| Property       | Value                                   |
|----------------|-----------------------------------------|
| Upgrade path   | `GET /ws`                               |
| Socket.io path | `GET /socket.io/?EIO=4&transport=websocket` |
| Subprotocol    | none (plain JSON text frames)           |
| Ping interval  | ~54 s (server → client)                 |
| Pong deadline  | 60 s                                    |
| Max message    | 64 KB (inbound)                         |
| Send buffer    | 256 messages per client                 |

---

## Wire Protocol

All messages are JSON text frames. A single WebSocket connection multiplexes all topics.

### Socket.io Compatibility

The server exposes a minimal Engine.IO/Socket.IO websocket endpoint at:

`/socket.io/?EIO=4&transport=websocket`

Handshake flow:

1. Server sends Engine.IO open packet (prefix `0`) with session metadata.
2. Client sends Socket.IO connect packet `40`.
3. Server sends Socket.IO connect ack packet `40{"sid":"..."}`.

When using this endpoint:
- Socket.IO event frames use prefix `42`.
- Server event payloads are emitted as `42["event",{...}]`.
- Control acks/errors are emitted as `42["ack",{...}]` or `42["error",{...}]`.

### Client → Server

#### `subscribe`

Subscribe to a topic, optionally scoped to a room.

```json
{
  "action": "subscribe",
  "topic": "<topic_name>",
  "room": "<room_key>"
}
```

| Field    | Type     | Required | Description                                            |
|----------|----------|----------|--------------------------------------------------------|
| `action` | `string` | ✅        | Must be `"subscribe"`                                  |
| `topic`  | `string` | ✅        | Logical event stream (see Topics below)                |
| `room`   | `string` | ❌        | Scoping key, e.g. `"division:5"`. Omit for global.     |

#### `unsubscribe`

```json
{
  "action": "unsubscribe",
  "topic": "<topic_name>",
  "room": "<room_key>"
}
```

Same fields as `subscribe`.

#### `joinDivision` (Socket.io endpoint)

Join a division room for a specific topic.

```text
42["joinDivision",{"topic":"readings","divisionId":"5"}]
```

Equivalent to:

```json
{
  "action": "subscribe",
  "topic": "readings",
  "room": "division:5"
}
```

#### `leaveDivision` (Socket.io endpoint)

Leave a division room for a specific topic.

```text
42["leaveDivision",{"topic":"readings","divisionId":"5"}]
```

Equivalent to:

```json
{
  "action": "unsubscribe",
  "topic": "readings",
  "room": "division:5"
}
```

---

### Server → Client

#### Event Message

Delivered when a producer publishes to a (topic, room) the client is subscribed to.

```json
{
  "topic": "<topic_name>",
  "room": "<room_key>",
  "data": { ... }
}
```

| Field  | Type     | Description                                         |
|--------|----------|-----------------------------------------------------|
| `topic`| `string` | The topic this message belongs to                   |
| `room` | `string` | The room (empty string if global broadcast)         |
| `data` | `object` | Opaque payload — structure depends on topic (below) |

#### Acknowledgement

Sent after a successful `subscribe` or `unsubscribe`.

```json
{
  "type": "ack",
  "action": "subscribe",
  "topic": "readings",
  "room": "division:5"
}
```

#### Error

Sent when the server cannot process a client message.

```json
{
  "type": "error",
  "message": "topic is required"
}
```

Known error messages:
- `"invalid JSON"` — message was not valid JSON
- `"topic is required"` — topic field was empty
- `"unknown action: <action>"` — action was not subscribe/unsubscribe

---

## Topics

| Topic        | Kafka Source          | Description                    |
|--------------|-----------------------|--------------------------------|
| `readings`   | `energy.readings`     | Real-time energy reading updates |
| `alerts`     | `energy.anomalies`    | Alert / anomaly events          |
| `forecasts`  | `energy.forecasts`    | Energy forecast updates          |

> **Note**: Topics are arbitrary strings. The WebSocket server does not validate topic names — any string is accepted. New topics can be added by publishing to them without code changes.

---

## Room Convention

Rooms scope messages within a topic. The current convention:

```
division:{division_id}
```

Examples: `division:1`, `division:42`

A client subscribed to `(topic="readings", room="division:5")` will only receive readings published to that exact (topic, room) pair. Omitting the room subscribes to global broadcasts for that topic.

---

## Payload Schemas (Per Topic)

> ⚠️ **These are placeholder schemas.** Final payload structures will be defined once API contracts are agreed upon.

### `readings`

```json
{
  "node_id": "node_1",
  "timestamp": 1713000000,
  "voltage": 230.5,
  "current": 12.3,
  "power": 2835.15,
  "energy_kwh": 1.42
}
```

### `alerts`

```json
{
  "alert_id": "alert_abc123",
  "node_id": "node_2",
  "severity": "high",
  "type": "anomaly",
  "message": "Current spike detected",
  "timestamp": 1713000100
}
```

### `forecasts`

```json
{
  "division_id": "5",
  "period_start": 1713000000,
  "period_end": 1713003600,
  "predicted_kwh": 42.5,
  "confidence": 0.92
}
```

---

## Example Session

```
# 1. Client connects
GET /ws HTTP/1.1
Upgrade: websocket
→ 101 Switching Protocols

# 2. Client subscribes
→ {"action":"subscribe","topic":"readings","room":"division:5"}
← {"type":"ack","action":"subscribe","topic":"readings","room":"division:5"}

# 3. Server pushes data
← {"topic":"readings","room":"division:5","data":{"node_id":"node_1","voltage":230.5}}

# 4. Client unsubscribes
→ {"action":"unsubscribe","topic":"readings","room":"division:5"}
← {"type":"ack","action":"unsubscribe","topic":"readings","room":"division:5"}

# 5. Client disconnects
→ close frame
```

### Socket.io Example Session

```text
# 1. Client connects
GET /socket.io/?EIO=4&transport=websocket
→ 101 Switching Protocols

# 2. Server open packet
← 0{"sid":"sio_...","upgrades":[],"pingInterval":25000,"pingTimeout":20000,"maxPayload":1000000}

# 3. Client namespace connect
→ 40
← 40{"sid":"sio_..."}

# 4. Join division room
→ 42["joinDivision",{"topic":"readings","divisionId":"5"}]
← 42["ack",{"type":"ack","action":"subscribe","topic":"readings","room":"division:5"}]

# 5. Server pushes topic event
← 42["event",{"topic":"readings","room":"division:5","data":{"node_id":"node_1","voltage":230.5}}]

# 6. Leave room
→ 42["leaveDivision",{"topic":"readings","divisionId":"5"}]
← 42["ack",{"type":"ack","action":"unsubscribe","topic":"readings","room":"division:5"}]
```

---

## Testing

### With wscat

```bash
npx wscat -c ws://localhost:8080/ws
> {"action":"subscribe","topic":"readings","room":"division:1"}
< {"type":"ack","action":"subscribe","topic":"readings","room":"division:1"}
```

### With Postman

1. Open Postman → New → WebSocket Request
2. URL: `ws://localhost:8080/ws`
3. Click **Connect**
4. In the message field, paste: `{"action":"subscribe","topic":"readings","room":"division:1"}`
5. Click **Send** — you should receive an ack
