# Sock Shop Service Topology

## Architecture Overview

```mermaid
graph TB
    subgraph "Client Layer"
        Browser["Browser / API Client"]
    end

    subgraph "Gateway Layer"
        ER["edge-router<br/>(nginx)"]
        FE["front-end<br/>(Node.js)"]
    end

    subgraph "Business Services"
        CAT["catalogue<br/>(Go)"]
        CART["carts<br/>(Java/Spring)"]
        ORD["orders<br/>(Java/Spring)"]
        PAY["payment<br/>(Go)"]
        SHIP["shipping<br/>(Java/Spring)"]
        USR["user<br/>(Go)"]
        QM["queue-master<br/>(Java/Spring)"]
    end

    subgraph "Data Layer"
        CATDB[("catalogue-db<br/>(MySQL)")]
        CARTDB[("carts-db<br/>(MongoDB)")]
        ORDDB[("orders-db<br/>(MongoDB)")]
        USRDB[("user-db<br/>(MongoDB)")]
        RMQ["rabbitmq<br/>(AMQP)"]
    end

    subgraph "AgentFlow MCP Layer"
        MCP["sockshop-mcp<br/>(TypeScript)<br/>23 tools"]
    end

    Browser -->|":8888"| ER
    ER -->|"proxy"| FE
    FE --> CAT
    FE --> CART
    FE --> ORD
    FE --> USR
    ORD --> USR
    ORD --> CART
    ORD --> PAY
    ORD --> SHIP
    SHIP -->|"publish"| RMQ
    QM -->|"consume"| RMQ
    CAT --> CATDB
    CART --> CARTDB
    ORD --> ORDDB
    USR --> USRDB
    MCP -->|"HTTP via<br/>edge-router"| ER

    style MCP fill:#4A90D9,stroke:#2C5F8A,color:#fff
    style RMQ fill:#FF6600,stroke:#CC5200,color:#fff
```

## Service Summary

| Service | Language | Port | Database | Purpose |
|---------|----------|------|----------|---------|
| edge-router | nginx | 8888 (external) | - | Reverse proxy / gateway |
| front-end | Node.js | 8079 | Redis (optional) | UI + API gateway |
| catalogue | Go | 80 | MySQL | Product browsing |
| carts | Java/Spring | 80 | MongoDB | Shopping cart |
| orders | Java/Spring | 80 | MongoDB | Order processing |
| payment | Go | 80 | - | Payment authorization |
| shipping | Java/Spring | 80 | - | Shipment creation |
| queue-master | Java/Spring | 80 | - | Async shipping processing |
| user | Go | 80 | MongoDB | Authentication & user data |
| sockshop-mcp | TypeScript | 3000 | - | MCP tool server (23 tools) |

## Key Data Flows

### Order Placement (Critical Path)
Touches 6 services in sequence: front-end -> orders -> (user + carts + payment + shipping) -> rabbitmq -> queue-master

### The $100 Payment Threshold
The payment service rejects any order with a total > $100. Combined with the flat $4.99 shipping cost, this makes the "Holy" sock ($99.99) mathematically impossible to purchase.

## Network Architecture
- All services communicate over a Docker bridge network
- No inter-service authentication (any service can call any other)
- No TLS between services
- No circuit breakers or retries
- 5-second timeout on all inter-service HTTP calls
