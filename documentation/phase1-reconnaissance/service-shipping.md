# Shipping + Queue Master Service Profile

## Overview

The shipping pipeline is an **asynchronous, two-service architecture**. The **Shipping** service accepts REST requests and publishes messages to RabbitMQ. The **Queue Master** service consumes those messages and processes shipping tasks. Both are Java/Spring Boot applications.

---

## 1. Endpoints

### Shipping Service (port 8080)

| Method | Path | Status | Description |
|--------|------|--------|-------------|
| `GET` | `/shipping` | 200 | Returns static string `"GET ALL Shipping Resource."` — placeholder, no real data |
| `GET` | `/shipping/{id}` | 200 | Returns static string with the id — placeholder, no real data |
| `POST` | `/shipping` | 201 | Accepts a `Shipment` JSON body, publishes it to RabbitMQ, returns the shipment |
| `GET` | `/health` | 200 | Health check — tests RabbitMQ connectivity, reports `shipping` and `shipping-rabbitmq` status |

### Queue Master Service (port 8080)

| Method | Path | Status | Description |
|--------|------|--------|-------------|
| `GET` | `/health` | 200 | Health check — tests RabbitMQ connectivity, reports `queue-master` and `queue-master-rabbitmq` status |

> Queue Master has no other REST endpoints. It is a pure consumer.

---

## 2. Data Model — Shipment Entity

Both services contain an identical copy of `works.weave.socks.shipping.entities.Shipment`:

```java
public class Shipment {
    private String id;   // UUID string, auto-generated if not supplied
    private String name;  // shipment name / description
}
```

- **Identity**: `equals`/`hashCode` based on `id` only.
- **Default constructor** generates a random UUID and sets `name` to `""`.
- **Package duplication**: Both services use the same fully-qualified class name (`works.weave.socks.shipping.entities.Shipment`). The classes are structurally identical (same fields, constructors, methods). This is significant for JSON deserialization — the Queue Master's `DefaultClassMapper` maps incoming messages to its local copy of `Shipment.class`.

---

## 3. RabbitMQ Flow

### Topology

| Component | Value |
|-----------|-------|
| **Exchange** | `shipping-task-exchange` (TopicExchange) |
| **Queue** | `shipping-task` (non-durable: `durable=false`) |
| **Routing Key** | `shipping-task` |
| **Binding** | Queue `shipping-task` bound to exchange `shipping-task-exchange` with routing key `shipping-task` |

### Message Format

- **Serialization**: Jackson2 JSON (`Jackson2JsonMessageConverter`) on both sides.
- **Payload**: JSON representation of `Shipment` — `{"id": "...", "name": "..."}`.
- **Class mapping** (consumer side): `DefaultClassMapper` with `defaultType = Shipment.class` — any incoming JSON is deserialized as `Shipment` regardless of the `__TypeId__` header.

### Publishing (Shipping Service)

```java
rabbitTemplate.convertAndSend("shipping-task", shipment);
```

- Sends to the **default exchange** with routing key `shipping-task` (not directly to the topic exchange).
- The queue name matches the routing key, so the message lands in `shipping-task` via direct routing on the default exchange.

### Consuming (Queue Master)

- Uses `SimpleMessageListenerContainer` (single-threaded by default).
- `MessageListenerAdapter` wraps `ShippingTaskHandler.handleMessage(Shipment)`.
- **Processing**: Currently logs the shipment name to stdout. Docker spawning code (`DockerSpawner`) is commented out.

### Flow Diagram

```
Client --POST /shipping--> [Shipping Service]
                              |
                   convertAndSend("shipping-task", shipment)
                              |
                              v
                        [RabbitMQ]
                    Queue: shipping-task
                              |
                              v
                      [Queue Master]
                   ShippingTaskHandler.handleMessage()
                              |
                     (log to stdout)
```

---

## 4. Dependencies

### Shipping Service
- **RabbitMQ**: Publishes shipment messages. Host configured via `spring.rabbitmq.host` (default: `rabbitmq`).
- **Zipkin** (optional): Distributed tracing via Spring Sleuth. Disabled by default (`spring.zipkin.enabled=false`).
- **No database**: No persistence layer. The service is stateless.

### Queue Master
- **RabbitMQ**: Consumes from `shipping-task` queue. Same host config (`rabbitmq`).
- **DockerSpawner**: Injected via `@Autowired` but usage is commented out. Presumably intended to spawn Docker containers for shipping fulfillment.
- **No database**: No persistence layer.

### Shared Infrastructure
- **RabbitMQ** at hostname `rabbitmq`, port 5672 (default), credentials `guest/guest`.

---

## 5. Security Assessment

### Authentication & Authorization
- **None**. The `POST /shipping` endpoint has no authentication. Any caller can submit shipments.
- No `@PreAuthorize`, no Spring Security filters, no API key validation observed.

### RabbitMQ Credentials
- **Hardcoded** `guest/guest` in both services' `RabbitMqConfiguration`. Not externalized to properties or environment variables.
- Default RabbitMQ `guest` user typically only allows localhost connections — this works inside Docker/Kubernetes but is a security concern if RabbitMQ is exposed.

### Message Validation
- **No input validation** on the `POST /shipping` endpoint. The `Shipment` body is accepted as-is with no field-level constraints.
- **No message validation** on the consumer side. The `DefaultClassMapper` force-deserializes any message as `Shipment` — no schema validation or content checks.
- **Silent failure on publish**: If RabbitMQ is down, the shipping service catches the exception, logs a warning, and **returns 201 anyway**. The shipment is silently lost.

### Findings Summary
| Issue | Severity | Location |
|-------|----------|----------|
| No auth on POST /shipping | High | ShippingController |
| Hardcoded RabbitMQ guest/guest | Medium | Both RabbitMqConfiguration classes |
| Silent message loss on queue failure | High | ShippingController.postShipping() |
| No input validation | Medium | ShippingController.postShipping() |

---

## 6. Performance & Reliability

### Consumer Threading
- `SimpleMessageListenerContainer` defaults to **1 concurrent consumer** thread. No `setConcurrentConsumers()` or `setMaxConcurrentConsumers()` is called.
- Under high load, message processing is sequential — one shipment at a time.

### Prefetch & Acknowledgement
- **Prefetch**: Not configured — uses Spring AMQP default (250 for `SimpleMessageListenerContainer`).
- **Acknowledgement mode**: Not explicitly set — defaults to `AUTO` (messages acknowledged after `handleMessage()` returns without exception).

### Backpressure
- No backpressure mechanism. The non-durable queue will grow unboundedly in memory if the consumer falls behind.
- **Queue is non-durable** (`durable=false`): All pending messages are **lost on RabbitMQ restart**.

### Dead Letter Handling
- **None configured**. No dead-letter exchange (`x-dead-letter-exchange`) or dead-letter routing key on the queue.
- If `handleMessage()` throws an exception, the message will be requeued (default AUTO ack behavior) — potentially causing an infinite retry loop for poison messages.

### Error Recovery
- **Shipping side**: Swallows RabbitMQ exceptions entirely — no retry, no fallback queue, no persistent store. Messages are silently dropped.
- **Queue Master side**: No explicit error handling in `ShippingTaskHandler`. Exceptions propagate to the listener container which may requeue the message.

### Connection Configuration
- Both services set `closeTimeout=5000ms` and `connectionTimeout=5000ms`.
- No connection retry/recovery configuration beyond Spring AMQP defaults (automatic reconnection is enabled by default in `CachingConnectionFactory`).

### Findings Summary
| Issue | Impact | Recommendation |
|-------|--------|----------------|
| Single consumer thread | Low throughput | Set `concurrentConsumers` for parallel processing |
| Non-durable queue | Message loss on broker restart | Set `durable=true` |
| No dead-letter queue | Poison messages cause infinite requeue | Configure DLX/DLQ |
| Silent publish failure | Data loss | Persist failed messages or return error to caller |
| No message TTL | Unbounded queue growth | Set `x-message-ttl` or consumer-side limits |
