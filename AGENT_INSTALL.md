# Patrol Agent Installation Guide

This guide provides instructions for installing and configuring the Patrol Monitoring Agent (patrold).

## Installation

### Debian-based Systems (Debian, Ubuntu, Raspberry Pi OS, etc.)

1. Download the DEB package:

```bash
wget https://beta.patrold.com/patrold_1.0.0_all.deb
```

2. Install the package:

```bash
sudo dpkg -i patrold_1.0.0_all.deb
```

3. If there are missing dependencies, install them:

```bash
sudo apt-get install -f
```

4. During installation, you'll be prompted to enter:
   - Your API key (from the Agents page in the Service Monitor interface)
   - Your Service Monitor URL (the URL of your Service Monitor installation)

### Other Systems (Manual Installation)

1. Download the agent script:

```bash
wget https://beta.patrold.com/api/agents/download/script -O /usr/local/bin/patrold
chmod +x /usr/local/bin/patrold
```

2. Create the configuration directory and file:

```bash
mkdir -p /etc/patrold
```

3. Create a config file:

```bash
cat > /etc/patrold/config.json << EOF
{
  "api_url": "https://beta.patrold.com/api",
  "api_key": "your-api-key-from-agents-page",
  "check_interval": 1,
  "heartbeat_interval": 1,
  "debug": false,
  "server_info": {
    "hostname": "auto",
    "location": "unspecified",
    "notes": ""
  }
}
EOF
```

## Verifying Installation

To verify that the agent is running properly:

```bash
systemctl status patrold.service
```

You should see output indicating that the service is active (running).

## Viewing Logs

To view the agent logs:

```bash
journalctl -u patrold.service -f
```

## Managing the Service

### Stopping the Agent

```bash
sudo systemctl stop patrold.service
```

### Starting the Agent

```bash
sudo systemctl start patrold.service
```

### Restarting the Agent

```bash
sudo systemctl restart patrold.service
```

### Disabling Automatic Startup

```bash
sudo systemctl disable patrold.service
```

### Enabling Automatic Startup

```bash
sudo systemctl enable patrold.service
```

## Advanced Configuration

You can edit the configuration file at `/etc/patrold/config.json` to modify settings like:

- `check_interval`: How often to check services (in seconds)
- `heartbeat_interval`: How often to send heartbeats to the server (in seconds)
- `debug`: Enable or disable verbose logging
- `server_info`: Server details and metadata

After making changes, restart the service:

```bash
sudo systemctl restart patrold.service
```

## Troubleshooting

### Common Issues

1. **Agent not connecting to the server**
   - Check your API URL and API key in the configuration
   - Verify network connectivity to the Service Monitor server
   - Check firewall settings

2. **Service checks not working**
   - Verify the services are assigned to the agent in the Service Monitor interface
   - Check that the agent has network connectivity to the services it's monitoring

3. **High CPU or memory usage**
   - Increase the check and heartbeat intervals in the configuration
   - Reduce the number of services being monitored by this agent