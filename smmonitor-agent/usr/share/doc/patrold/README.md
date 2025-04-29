# Patrol Monitoring Agent (patrold)

Real-time service monitoring agent for Service Monitor platform.

## Overview

The Patrol Monitoring Agent (patrold) is a lightweight, efficient monitoring agent that runs as a system service and monitors the status of network services. It sends heartbeats to the Service Monitor platform every second to ensure accurate, real-time monitoring.

## Features

- Real-time heartbeat monitoring with 1-second intervals
- Automatic service status checks (TCP, HTTP, HTTPS)
- Self-healing and automatic recovery
- Low resource usage and minimal dependencies
- Secure API communication

## Usage

The agent is automatically started as a systemd service after installation. No manual configuration is required.

### Checking the Agent Status

```bash
systemctl status patrold.service
```

### Viewing Agent Logs

```bash
journalctl -u patrold.service -f
```

### Stopping the Agent

```bash
systemctl stop patrold.service
```

### Starting the Agent

```bash
systemctl start patrold.service
```

## Configuration

Configuration is stored in `/etc/patrold/config.json`. The values in this file are configured during installation.

## Requirements

- Python 3.6 or higher
- SystemD (standard on most modern Linux distributions)
- Network connectivity to the Service Monitor platform