#!/bin/bash
# Bash Agent for Service Monitor
#
# This script monitors specified services and reports their status back to the 
# Service Monitor API. It can be run on any server with bash and basic tools like
# curl installed.
#
# Usage:
# 1. Replace API_KEY with your agent's API key
# 2. Configure the services in the SERVICES array
# 3. Run: chmod +x bash-agent.sh && ./bash-agent.sh
#

# Configuration
API_KEY="{{API_KEY}}" # Replace with your agent API key
API_BASE_URL="{{API_BASE_URL}}" # Replace with your Service Monitor URL (e.g., https://your-app.replit.app)

# Services to monitor - each line should contain host:port
declare -a SERVICES=(
  "192.168.1.254:80"  # Yerel ağdaki router/gateway
  # "example.com:80"
  # "192.168.1.1:8080"
  # Add your services here
)

# Monitoring interval in seconds (default: 60 seconds)
CHECK_INTERVAL=60

# Timeout for service checks in seconds
REQUEST_TIMEOUT=5

# Function to check if a service is online
check_service() {
  local host=$(echo "$1" | cut -d':' -f1)
  local port=$(echo "$1" | cut -d':' -f2)
  local start_time=$(date +%s%3N)
  
  # Try different connection methods based on the host type (IP or hostname)
  if [[ "$host" =~ ^[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
    # For IP addresses, try using netcat if available
    if command -v nc >/dev/null 2>&1; then
      if nc -z -w $REQUEST_TIMEOUT "$host" "$port" >/dev/null 2>&1; then
        local end_time=$(date +%s%3N)
        local response_time=$((end_time - start_time))
        
        # Determine status based on response time
        local status="online"
        if [ $response_time -gt 1000 ]; then
          status="degraded"
        fi
        
        echo "{ \"host\": \"$host\", \"port\": $port, \"status\": \"$status\", \"responseTime\": $response_time }"
        return
      fi
    else
      # Fallback to /dev/tcp for IP addresses if netcat is not available
      if timeout $REQUEST_TIMEOUT bash -c "</dev/tcp/$host/$port" 2>/dev/null; then
        local end_time=$(date +%s%3N)
        local response_time=$((end_time - start_time))
        
        # Determine status based on response time
        local status="online"
        if [ $response_time -gt 1000 ]; then
          status="degraded"
        fi
        
        echo "{ \"host\": \"$host\", \"port\": $port, \"status\": \"$status\", \"responseTime\": $response_time }"
        return
      fi
    fi
  else
    # For hostnames, try standard /dev/tcp connection
    if timeout $REQUEST_TIMEOUT bash -c "</dev/tcp/$host/$port" 2>/dev/null; then
      local end_time=$(date +%s%3N)
      local response_time=$((end_time - start_time))
      
      # Determine status based on response time
      local status="online"
      if [ $response_time -gt 1000 ]; then
        status="degraded"
      fi
      
      echo "{ \"host\": \"$host\", \"port\": $port, \"status\": \"$status\", \"responseTime\": $response_time }"
      return
    fi
  fi
  
  # If we get here, all connection attempts failed
  echo "{ \"host\": \"$host\", \"port\": $port, \"status\": \"offline\", \"responseTime\": null }"
}

# Function to get system information
get_server_info() {
  local hostname=$(hostname 2>/dev/null || echo "unknown")
  local platform=$(uname -s 2>/dev/null || echo "unknown")
  local kernel=$(uname -r 2>/dev/null || echo "unknown")
  local architecture=$(uname -m 2>/dev/null || echo "unknown")
  
  # Try to get memory information
  local mem_total="null"
  local mem_free="null"
  
  if [ -f /proc/meminfo ]; then
    mem_total=$(grep "MemTotal" /proc/meminfo | awk '{print $2 * 1024}')
    mem_free=$(grep "MemAvailable" /proc/meminfo | awk '{print $2 * 1024}' || grep "MemFree" /proc/meminfo | awk '{print $2 * 1024}')
  elif command -v sysctl >/dev/null 2>&1; then
    # macOS or BSD
    mem_total=$(sysctl -n hw.memsize 2>/dev/null || echo "null")
    # Free memory is harder to get on macOS without vm_stat parsing
  fi
  
  local timestamp=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
  
  echo "{
    \"hostname\": \"$hostname\",
    \"platform\": \"$platform\",
    \"kernel\": \"$kernel\",
    \"architecture\": \"$architecture\",
    \"memory\": {
      \"total\": $mem_total,
      \"free\": $mem_free
    },
    \"timestamp\": \"$timestamp\"
  }"
}

# Function to send a heartbeat to the API
send_heartbeat() {
  local server_info=$(get_server_info)
  local data="{\"apiKey\": \"$API_KEY\", \"serverInfo\": $server_info}"
  
  # Send the heartbeat
  local response=$(curl -s -X POST "$API_BASE_URL/api/agents/heartbeat" \
    -H "Content-Type: application/json" \
    -d "$data" \
    --max-time $((REQUEST_TIMEOUT * 2)))
  
  # Check if the request was successful
  if echo "$response" | grep -q "agentId"; then
    echo "Heartbeat sent successfully"
    return 0
  else
    echo "Error sending heartbeat: $response"
    return 1
  fi
}

# Function to report service status to the API
report_service_status() {
  local result="$1"
  local data="{\"apiKey\": \"$API_KEY\", $(echo "$result" | sed 's/^{//; s/}$//')}"
  
  # Extract host and port for logging
  local host=$(echo "$result" | grep -o '"host":[^,]*' | cut -d'"' -f4)
  local port=$(echo "$result" | grep -o '"port":[^,]*' | cut -d':' -f2 | tr -d ' }')
  local status=$(echo "$result" | grep -o '"status":[^,]*' | cut -d'"' -f4)
  
  # Send the status report
  local response=$(curl -s -X POST "$API_BASE_URL/api/agents/service-check" \
    -H "Content-Type: application/json" \
    -d "$data" \
    --max-time $((REQUEST_TIMEOUT * 2)))
  
  # Check if the request was successful
  if echo "$response" | grep -q "status"; then
    echo "Service status reported for $host:$port - $status"
    return 0
  else
    echo "Error reporting service status for $host:$port: $response"
    return 1
  fi
}

# Function to run the monitoring process
run_monitoring() {
  # Send heartbeat
  send_heartbeat
  
  # Check each service
  for service in "${SERVICES[@]}"; do
    if [ -n "$service" ]; then
      result=$(check_service "$service")
      report_service_status "$result"
    fi
  done
}

# Display important configuration info
echo "Using API key: $API_KEY"
echo "Using API URL: $API_BASE_URL"

if [ ${#SERVICES[@]} -eq 0 ]; then
  echo "Warning: No services configured for monitoring"
fi

# Prerequisites check
if ! command -v curl >/dev/null 2>&1; then
  echo "Error: curl is required but not installed. Please install curl and try again."
  exit 1
fi

# Start the monitoring process
echo "Starting Service Monitor Agent..."
echo "Monitoring ${#SERVICES[@]} services, checking every $CHECK_INTERVAL seconds"

# Main loop
while true; do
  run_monitoring
  sleep $CHECK_INTERVAL
done