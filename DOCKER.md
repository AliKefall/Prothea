# Local Docker Compose setup

Copy `.env.example` to `.env` and set local secrets, then start the application:

```sh
docker compose up --build
```

The frontend is at `http://localhost:3000`, the API is at `http://localhost:8080`, and PostgreSQL and Redis run as supporting services. PostgreSQL initializes a new data volume from `sql/schema`; the SQL files are not rerun when that volume already exists.

To include the monitoring stack, start the application with the observability overlay:

```sh
docker compose -f compose.yaml -f deploy/observability/docker-compose.yml --profile observability up --build
```

Prometheus is available at `http://localhost:9090` and Grafana at `http://localhost:3001`. Grafana loads the provisioned **Prothea API and WebSocket** dashboard and Prometheus data source on startup. Set `GRAFANA_USER` and `GRAFANA_PASSWORD` in `.env` before exposing it beyond a local machine.

The API provides `/healthz` for liveness, `/readyz` for PostgreSQL and Redis readiness, and `/metrics` for Prometheus. PostgreSQL, Redis, Prometheus, Grafana, and their timeseries data use named volumes. Stopping the API no longer flushes Redis, so matchmaking and active game state are not discarded during a normal shutdown.
