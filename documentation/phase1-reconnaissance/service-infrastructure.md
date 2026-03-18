# Sock Shop — Infrastructure & Deployment Profile

> Generated from Docker Compose configs in `sock-shop-demo/deploy/docker-compose/`

---

## 1. Service Map

### Application Services

| Service | Image | Exposed Ports | Read-Only FS | Restart Policy |
|---------|-------|---------------|-------------|----------------|
| **front-end** | `weaveworksdemos/front-end:0.3.12` | — (internal only) | Yes | always |
| **edge-router** | `weaveworksdemos/edge-router:0.1.1` | `80:80`, `8080:8080` | Yes | always |
| **catalogue** | `weaveworksdemos/catalogue:0.3.5` | — | Yes | always |
| **carts** | `weaveworksdemos/carts:0.4.8` | — | Yes | always |
| **orders** | `weaveworksdemos/orders:0.4.7` | — | Yes | always |
| **shipping** | `weaveworksdemos/shipping:0.4.8` | — | Yes | always |
| **payment** | `weaveworksdemos/payment:0.4.3` | — | Yes | always |
| **user** | `weaveworksdemos/user:0.4.4` | — | Yes | always |
| **queue-master** | `weaveworksdemos/queue-master:0.3.1` | — | Yes | always |
| **user-sim** | `weaveworksdemos/load-test:0.1.1` | — | Yes | — |

### Data Stores

| Service | Image | Read-Only FS | Restart Policy |
|---------|-------|-------------|----------------|
| **catalogue-db** | `weaveworksdemos/catalogue-db:0.3.0` (MySQL) | No | always |
| **carts-db** | `mongo:3.4` | Yes | always |
| **orders-db** | `mongo:3.4` | Yes | always |
| **user-db** | `weaveworksdemos/user-db:0.4.0` (MongoDB) | Yes | always |
| **rabbitmq** | `rabbitmq:3.6.8` | Yes | always |

### Monitoring Stack (docker-compose.monitoring.yml)

| Service | Image | Exposed Ports |
|---------|-------|---------------|
| **prometheus** | `prom/prometheus` | `9090:9090` |
| **nodeexporter** | `quay.io/prometheus/node-exporter:v1.1.2` | `9100:9100` |
| **alertmanager** | `prom/alertmanager` | `9093:9093` |
| **grafana** | `grafana/grafana` | `3000:3000` |
| **importer** | `giantswarm/tiny-tools` | — (one-shot dashboard import) |

### Logging Stack (docker-compose.logging.yml)

| Service | Image | Exposed Ports |
|---------|-------|---------------|
| **elasticsearch** | `elasticsearch` (untagged) | — |
| **kibana** | `kibana` (untagged) | `5601:5601` |
| **log-server** | `weaveworksdemos/log-server` | `24224:24224` |

---

## 2. Networking

### Network Segmentation

The compose file uses Compose v2 **without explicit network definitions**. All services share the **default bridge network** — every container can reach every other container by hostname.

### Service Communication Patterns

```
Internet
  │
  ▼
edge-router (:80, :8080)
  │
  ├──► front-end
  │
  ├──► catalogue ──► catalogue-db (MySQL)
  │
  ├──► carts ──► carts-db (MongoDB)
  │
  ├──► orders ──► orders-db (MongoDB)
  │
  ├──► shipping ──► rabbitmq ◄── queue-master
  │
  ├──► payment
  │
  └──► user ──► user-db (MongoDB, MONGO_HOST=user-db:27017)
```

- **edge-router** is the only externally exposed service (ports 80/8080) — acts as reverse proxy to `front-end`.
- **user-sim** sends load-test traffic to `edge-router` (`-h edge-router`).
- **queue-master** mounts the Docker socket (`/var/run/docker.sock`) — can interact with Docker daemon.

### Cross-Stack Communication

- Monitoring: Prometheus scrapes application services by hostname over the shared network.
- Logging: All application services use `fluentd` logging driver, forwarding to `log-server:24224`.

---

## 3. Resource Limits

**No CPU or memory limits are defined** in any of the compose files.

### JVM Heap Settings (Application-Level)

| Service | JAVA_OPTS |
|---------|-----------|
| carts | `-Xms64m -Xmx128m -XX:+UseG1GC` |
| orders | `-Xms64m -Xmx128m -XX:+UseG1GC` |
| shipping | `-Xms64m -Xmx128m -XX:+UseG1GC` |

All three Java services disable Zipkin tracing (`-Dspring.zipkin.enabled=false`).

---

## 4. Health Checks

**No health checks are configured** in any compose file. Services rely solely on Docker's `restart: always` policy for recovery.

---

## 5. Persistence

### Volumes

| Service | Volume Mount | Purpose |
|---------|-------------|---------|
| queue-master | `/var/run/docker.sock:/var/run/docker.sock` | Docker daemon access |
| prometheus | `./prometheus.yml`, `./alert.rules` (bind mounts) | Config files |
| alertmanager | `./alertmanager.yml` (bind mount) | Config file |
| nodeexporter | `/:/host:ro,rslave` | Host filesystem metrics |
| importer | `./grafana` (bind mount) | Dashboard import scripts |

### tmpfs Mounts

Services with `tmpfs` at `/tmp`: carts, carts-db, orders, orders-db, shipping, queue-master, user-db.
Edge-router uses `tmpfs` at `/var/run`.

### Data Durability

**No persistent volumes** are defined for any database. All data stores (catalogue-db, carts-db, orders-db, user-db, rabbitmq, elasticsearch) use **ephemeral container storage**. Data is lost on container removal.

Prometheus storage (`/prometheus`) and Alertmanager storage (`/alertmanager`) are also ephemeral — metrics history is lost on restart.

---

## 6. Monitoring

### Prometheus Scrape Targets

| Job Name | Target(s) | Scrape Interval | Metrics Path |
|----------|-----------|-----------------|-------------|
| frontend | `edge-router` | 5s | `/metrics` |
| catalogue | `catalogue` | 5s | (default `/metrics`) |
| payment | `payment` | 5s | (default `/metrics`) |
| user | `user` | 5s | (default `/metrics`) |
| orders | `orders` | 5s | `/metrics` |
| cart | `carts` | 5s | `/metrics` |
| shipping | `shipping` | 5s | `/metrics` |
| queue-master | `queue-master` | 5s | `/prometheus` |
| node-exporter | `nodeexporter:9100` | 5s | `/metrics` |

Global scrape interval: 1m (overridden to 5s per job). Evaluation interval: 1m.

### Alert Rules

| Alert | Expression | Duration | Severity |
|-------|-----------|----------|----------|
| **HighErrorRate** | `rate(request_duration_seconds_count{status_code="500"}[1m]) > 0.1` | 1m | email |

### Alertmanager

- Routes alerts grouped by `cluster` to the `email-all` receiver.
- Email receiver configured with placeholder SMTP (gmail:587, empty credentials, `alertmanager@example.org`).
- Sends resolved notifications.

### Grafana

- Default admin password: `foobar` (hardcoded).
- Sign-up disabled (`GF_USERS_ALLOW_SIGN_UP=false`).
- Dashboards auto-imported via `importer` sidecar container.
- Depends on Prometheus as data source.

### Logging (ELK-like)

- **log-server** (Fluentd-based) collects logs from all application services via Docker's `fluentd` logging driver.
- Logs are forwarded to **Elasticsearch** for indexing.
- **Kibana** provides a UI at port `5601`.
- Elasticsearch and Kibana images are untagged — version pinning is missing.

---

## 7. Single Points of Failure

| Risk | Impact | Details |
|------|--------|---------|
| **No replicas** | All services are single-instance | Every service is a SPOF. Loss of any one disrupts its function. |
| **Single RabbitMQ** | Order processing pipeline halts | `shipping` and `queue-master` both depend on `rabbitmq`. No clustering or HA. |
| **Single edge-router** | Complete outage | Only ingress point. If it fails, the entire application is unreachable. |
| **No persistent storage** | Data loss on container removal | All databases use ephemeral storage. A `docker-compose down` destroys all data. |
| **Shared flat network** | Lateral movement risk | No network segmentation. A compromised container can reach all others. |
| **No health checks** | Slow failure detection | Docker cannot detect application-level failures; only process crashes trigger restarts. |
| **queue-master Docker socket** | Privilege escalation | Mount of `/var/run/docker.sock` gives queue-master effective root access to the host. |
| **Single Prometheus** | Monitoring gap | If Prometheus crashes, no metrics are collected. No federation or HA setup. |
| **Alertmanager unconfigured** | Alerts never delivered | SMTP credentials are empty — email alerts will fail to send. |

---

## 8. Environment Variables

### Service Discovery

All services discover each other via **Docker Compose DNS** (hostname-based). No explicit service discovery configuration except:

| Service | Variable | Value |
|---------|----------|-------|
| user | `MONGO_HOST` | `user-db:27017` |

Other services use convention-based hostnames (e.g., `carts` connects to `carts-db` implicitly).

### Database Configuration

| Service | Variable | Value |
|---------|----------|-------|
| catalogue-db | `MYSQL_ROOT_PASSWORD` | `${MYSQL_ROOT_PASSWORD}` (from `.env` or shell) |
| catalogue-db | `MYSQL_ALLOW_EMPTY_PASSWORD` | `true` |
| catalogue-db | `MYSQL_DATABASE` | `socksdb` |

### Java Services

| Service | Variable | Value |
|---------|----------|-------|
| carts, orders, shipping | `JAVA_OPTS` | `-Xms64m -Xmx128m -XX:+UseG1GC -Djava.security.egd=file:/dev/urandom -Dspring.zipkin.enabled=false` |

### Monitoring

| Service | Variable | Value |
|---------|----------|-------|
| grafana | `GF_SECURITY_ADMIN_PASSWORD` | `foobar` |
| grafana | `GF_USERS_ALLOW_SIGN_UP` | `false` |

### Load Test

| Service | Command Args |
|---------|-------------|
| user-sim | `-d 60 -r 200 -c 2 -h edge-router` (60s duration, 200 requests, 2 concurrent) |

---

## 9. Security Posture Summary

### Hardening Applied
- **`cap_drop: all`** on most services — drops all Linux capabilities by default.
- **`read_only: true`** on most containers — immutable root filesystems.
- Minimal **`cap_add`** — only `NET_BIND_SERVICE` for app services; `CHOWN/SETGID/SETUID` for databases.
- **`tmpfs`** mounts for writable scratch space where needed.

### Security Concerns
- **Docker socket mount** on queue-master — container escape risk.
- **No network segmentation** — databases are reachable from all containers.
- **`MYSQL_ALLOW_EMPTY_PASSWORD=true`** — catalogue-db allows passwordless root.
- **Grafana admin password hardcoded** (`foobar`).
- **No TLS** configured between services or for external access.
- **Untagged images** (elasticsearch, kibana) — unpinned versions may introduce vulnerabilities.
