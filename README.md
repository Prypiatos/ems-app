# Energy Management System (E3)

Currently in early development. This repository will host the backend Go service and eventually the frontend dashboard of the Energy Management System. 

## Project Structure
- `backend/` Go backend service
- `docker-compose.yml` Local container orchestration
- `frontend/` Next.js frontend dashboard UI

## Architecture Diagram

```mermaid
flowchart LR
    U[Client / Frontend / API Consumer] -->|1. Login OIDC OAuth2| KC[Keycloak IAM]
    U -->|2. API call + Bearer token | K[Kong API Gateway]
   
    subgraph Security["Identity & Access"]
      KC
    end

    subgraph AppLayer["Application Layer"]
      B[ems-backend<br/>Custom service]
    end

    subgraph Messaging["Event Streaming Layer"]
      KB[(Kafka Broker)]
     
    end

    K -->|Validate JWT via Keycloak JWKS Introspection| KC
    K -->|Route Proxy authorized requests| B
    B <--> |Produce Consume events| KB

```

## Quick Start - Backend

Install air for hot reload
```bash
go install github.com/air-verse/air@latest
```
Run the backend with air from the repo root
```bash
air -c backend/.air.toml
```

## Build and Run
From repo root:

```bash
docker compose up -d
```

Service will be exposed at `http://localhost:8080`.

## Stop Services
From repo root:
```bash
docker compose down
```

## Run Tests
From `backend/`:

```bash
go test ./...
```

## Run mock kafka producer
From `backend/`

```bash
go run cmd/misc/kafka_producer.go
```

## Simple Kafka -> Backend -> Frontend Demo
From repo root:

```bash
docker compose up -d
cd frontend && npm install && npm run dev
```

In another terminal (repo root), publish test readings:

```bash
./scripts/kafka_realtime_demo.sh
```

Open `http://localhost:3000/dashboard` and you should see incoming rows in realtime.

Backend routes used by the dashboard:
- WebSocket telemetry: `ws://localhost:8080/api/v1/readings`
- Node events API: `GET http://localhost:8080/api/v1/nodes/node_001/events?limit=10`
- Node health API: `GET http://localhost:8080/api/v1/nodes/node_001/health`

Optional:

```bash
COUNT=100 SLEEP_SECONDS=0.2 TOPIC=energy.readings ./scripts/kafka_realtime_demo.sh
```

## API Quick Check

```bash
curl http://localhost:8080/
curl http://localhost:8080/health
curl http://localhost:8080/health/node_1
curl http://localhost:8080/nodes
```

## PostgreSQL Metadata DB

From repo root:

```bash
make db-migrate-postgres
make db-seed-postgres
```

`POSTGRES_URL` must be set for the backend runtime.

Use the appropriate connection string for your environment:
- Running the backend from the host machine: `postgres://ems:ems@localhost:5432/ems_metadata?sslmode=disable`
- Running inside Docker Compose/networked containers: `postgres://ems:ems@postgres:5432/ems_metadata?sslmode=disable`

## Notes
- The backend includes a PostgreSQL metadata database; local development may still use seeded data for testing workflows.
- Future work includes expanding Kafka/MQTT broker integration and continuing to evolve data flows as needed.
- API endpoints and data models are subject to change as the project evolves.
