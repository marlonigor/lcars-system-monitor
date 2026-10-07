# Zabbix Telemetry and Red Alert Integration

This document describes the architectural integration between the LCARS System Monitor and the Zabbix monitoring platform (API JSON-RPC 2.0).

---

## 1. Overview

The integration operates in a hybrid model:

1. **Telemetry**: The LCARS backend queries Zabbix for real-time subsystem metrics (CPU utilization, memory, storage).
2. **Alerting & Incident Management**: Active triggers from Zabbix (`problem.get`) drive the visual condition of the LCARS interface (Nominal, Yellow Alert, Red Alert).

---

## 2. Configuration & Credentials

The integration is configured via environment variables. Add these settings to your `.env` file:

```ini
# Server Configuration
PORT=3001
COLLECT_INTERVAL=2000
LOG_LEVEL=info

# Zabbix JSON-RPC 2.0 API Settings
ZABBIX_URL=https://zabbix.example.com
ZABBIX_TOKEN=your_zabbix_api_bearer_token
ZABBIX_HOST_ID=10084
```

- `ZABBIX_URL`: Base URL of the Zabbix Web interface. The adapter appends `/api_jsonrpc.php`.
- `ZABBIX_TOKEN`: API Bearer token generated in the Zabbix UI (Users -> API tokens).
- `ZABBIX_HOST_ID`: Numeric Host ID of the machine monitored in Zabbix.

---

## 3. Severity Mapping & Alert Escalation

Zabbix categorizes incidents into 6 severity levels (0 to 5). The `SystemMonitorService` translates these severities into canonical Star Trek alert conditions:

| Zabbix Severity | Zabbix Label   | LCARS Alert Level | LCARS Global Status | Visual Behavior                                             |
| --------------- | -------------- | ----------------- | ------------------- | ----------------------------------------------------------- |
| **0**     | Not classified | `nominal`       | `ok`              | Normal teal/sky theme, "ALL SYSTEMS NOMINAL"                |
| **1**     | Information    | `nominal`       | `ok`              | Normal teal/sky theme, "ALL SYSTEMS NOMINAL"                |
| **2**     | Warning        | `nominal`       | `ok`              | Normal teal/sky theme, "ALL SYSTEMS NOMINAL"                |
| **3**     | Average        | `yellow`        | `degraded`        | Amber/gold accents, "CONDITION YELLOW", banner visible      |
| **4**     | High           | `red`           | `critical`        | Mars red theme, pulsating text, "RED ALERT", banner visible |
| **5**     | Disaster       | `red`           | `critical`        | Mars red theme, pulsating text, "RED ALERT", banner visible |

---

## 4. JSON-RPC 2.0 Protocol Details

All communications are stateless HTTP POST requests using the JSON-RPC 2.0 protocol:

### Telemetry Request (`item.get`)

```json
{
  "jsonrpc": "2.0",
  "method": "item.get",
  "params": {
    "hostids": "10084",
    "search": { "key_": "system.cpu.util" },
    "output": ["lastvalue"]
  },
  "id": 1
}
```

### Problem Request (`problem.get`)

```json
{
  "jsonrpc": "2.0",
  "method": "problem.get",
  "params": {
    "hostids": "10084",
    "sortfield": ["eventid"],
    "sortorder": "DESC",
    "output": ["eventid", "name", "severity", "clock"]
  },
  "id": 2
}
```

---

## 5. Local Mock Testing

To validate the integration without connecting to a live production Zabbix instance, run the local mock server:

```bash
node scripts/mock-zabbix-server.js 8080
```

And configure your `.env`:

```ini
ZABBIX_URL=http://localhost:8080
ZABBIX_TOKEN=mock-token
ZABBIX_HOST_ID=10084
```
