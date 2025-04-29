import Sidebar from "@/components/layout/sidebar";
import Topbar from "@/components/layout/topbar";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Download, Upload, Cpu, Server, RefreshCw, Copy, Globe, Trash2, AlertTriangle } from "lucide-react";
import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Agent } from "@shared/schema";
import { cn } from "@/lib/utils";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

// Define form schema for creating a new agent
const formSchema = z.object({
  name: z.string().min(3, {
    message: "Agent name must be at least 3 characters.",
  }),
  description: z.string().optional(),
});

type FormValues = z.infer<typeof formSchema>;

export default function AgentsPage() {
  const { user } = useAuth();
  const [openCreateDialog, setOpenCreateDialog] = useState(false);
  const [openScriptDialog, setOpenScriptDialog] = useState(false);
  const [openDeleteDialog, setOpenDeleteDialog] = useState(false);
  const [selectedAgent, setSelectedAgent] = useState<Agent | null>(null);
  const [copiedApiKey, setCopiedApiKey] = useState<string | null>(null);
  const [scriptType, setScriptType] = useState<'python' | 'bash' | 'node'>('python');
  
  // Form for creating a new agent
  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      description: "",
    },
  });

  // Query to get all agents
  const { data: agents, isLoading: isLoadingAgents } = useQuery({
    queryKey: ["/api/agents"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/agents");
      const data = await res.json();
      return data as Agent[];
    },
  });

  // Mutation to create a new agent
  const createAgentMutation = useMutation({
    mutationFn: async (data: FormValues) => {
      const res = await apiRequest("POST", "/api/agents", data);
      const newAgent = await res.json();
      return newAgent as Agent;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/agents"] });
      form.reset();
      setOpenCreateDialog(false);
    },
  });

  // Mutation to refresh an agent's status
  const refreshAgentMutation = useMutation({
    mutationFn: async (agentId: number) => {
      const res = await apiRequest("PUT", `/api/agents/${agentId}/refresh`);
      const updatedAgent = await res.json();
      return updatedAgent as Agent;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/agents"] });
    },
  });
  
  // Mutation to delete an agent
  const deleteAgentMutation = useMutation({
    mutationFn: async (agentId: number) => {
      await apiRequest("DELETE", `/api/agents/${agentId}`);
      return agentId;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/agents"] });
      queryClient.invalidateQueries({ queryKey: ["/api/services"] });
      setOpenDeleteDialog(false);
      setSelectedAgent(null);
    },
  });

  // Function to copy API key to clipboard
  const copyApiKey = (apiKey: string) => {
    navigator.clipboard.writeText(apiKey);
    setCopiedApiKey(apiKey);
    setTimeout(() => setCopiedApiKey(null), 2000);
  };

  // Function to handle form submission
  const onSubmit = (data: FormValues) => {
    createAgentMutation.mutate(data);
  };

  // Function to open script dialog
  const openScriptDialogHandler = (agent: Agent) => {
    setSelectedAgent(agent);
    setOpenScriptDialog(true);
  };

  // Function to download script directly from the API
  const downloadScript = () => {
    if (!selectedAgent) return;
    
    // Get the script URL from our API
    const scriptUrl = `/api/agents/${selectedAgent.id}/script/${scriptType}`;
    
    // Create a link element and trigger the download
    const a = document.createElement('a');
    a.href = scriptUrl;
    a.target = '_blank'; // Opens in a new tab if browser blocks direct downloads
    document.body.appendChild(a);
    a.click();
    
    // Clean up
    document.body.removeChild(a);
  };
  
  // Python script template
  function getPythonScript(agent: Agent): string {
    return `#!/usr/bin/env python3
"""
UptimeMonitor Agent Script (Python)
Version: 1.0.0
Agent ID: ${agent.id}
Agent Name: ${agent.name}

This script sends heartbeat signals and server stats to your UptimeMonitor instance.
It helps you monitor remote servers from your central dashboard.

Requirements:
- Python 3.6+ (works on all major operating systems)
- Minimal dependencies (only standard library)
"""
import os
import sys
import json
import time
import socket
import platform
import subprocess
import urllib.request
import urllib.error
from datetime import datetime
import ssl

# Agent configuration
API_KEY = "${agent.apiKey}"
MONITOR_URL = "${window.location.origin}" 
HEARTBEAT_INTERVAL = 30  # seconds
DEBUG = True  # Set to False to reduce console output

# Get the hostname of the current machine
HOSTNAME = socket.gethostname()

def log(message):
    """Simple logging function"""
    if DEBUG:
        print(f"[{datetime.now().strftime('%Y-%m-%d %H:%M:%S')}] {message}")

def get_system_info():
    """Gather system information for the heartbeat report"""
    info = {
        "hostname": HOSTNAME,
        "platform": sys.platform,
        "python_version": sys.version,
        "architecture": platform.machine(),
        "os_name": platform.system(),
        "os_version": platform.version(),
        "timestamp": datetime.now().isoformat()
    }
    
    # Add memory information if available
    try:
        if platform.system() == "Linux":
            with open('/proc/meminfo', 'r') as f:
                meminfo = f.read()
            total_mem = int([line for line in meminfo.split('\\n') if 'MemTotal' in line][0].split()[1]) * 1024
            free_mem = int([line for line in meminfo.split('\\n') if 'MemFree' in line][0].split()[1]) * 1024
            info["total_memory"] = total_mem
            info["free_memory"] = free_mem
            info["memory_usage"] = f"{((total_mem - free_mem) / total_mem * 100):.2f}%"
        elif platform.system() == "Darwin":  # macOS
            # Use vm_stat for macOS memory information
            vm_stat = subprocess.check_output(['vm_stat']).decode('utf-8')
            lines = vm_stat.split('\\n')
            page_size = 4096  # Default page size for macOS
            free_pages = int([line for line in lines if 'Pages free' in line][0].split()[2].strip('.'))
            active_pages = int([line for line in lines if 'Pages active' in line][0].split()[2].strip('.'))
            inactive_pages = int([line for line in lines if 'Pages inactive' in line][0].split()[2].strip('.'))
            speculative_pages = int([line for line in lines if 'Pages speculative' in line][0].split()[2].strip('.'))
            wired_pages = int([line for line in lines if 'Pages wired down' in line][0].split()[3].strip('.'))
            
            free_mem = free_pages * page_size
            used_mem = (active_pages + inactive_pages + wired_pages) * page_size
            total_mem = free_mem + used_mem
            
            info["total_memory"] = total_mem
            info["free_memory"] = free_mem
            info["memory_usage"] = f"{(used_mem / total_mem * 100):.2f}%"
        elif platform.system() == "Windows":
            # For Windows, we could use the wmi module, but it's not standard library
            # Only include it if it's already installed
            try:
                import wmi
                c = wmi.WMI()
                os_info = c.Win32_OperatingSystem()[0]
                free_mem = int(os_info.FreePhysicalMemory) * 1024
                total_mem = int(os_info.TotalVisibleMemorySize) * 1024
                info["total_memory"] = total_mem
                info["free_memory"] = free_mem
                info["memory_usage"] = f"{((total_mem - free_mem) / total_mem * 100):.2f}%"
            except ImportError:
                info["memory_info"] = "wmi module not installed"
    except Exception as e:
        info["memory_error"] = str(e)
    
    # Add uptime information
    try:
        if platform.system() == "Linux":
            with open('/proc/uptime', 'r') as f:
                uptime_seconds = float(f.readline().split()[0])
            info["uptime_seconds"] = uptime_seconds
        elif platform.system() == "Darwin":  # macOS
            uptime = subprocess.check_output(['uptime']).decode('utf-8')
            # Parse the uptime output to extract days, hours, mins
            info["uptime_raw"] = uptime.strip()
        elif platform.system() == "Windows":
            # For Windows, get the system boot time
            try:
                import wmi
                c = wmi.WMI()
                os_info = c.Win32_OperatingSystem()[0]
                last_boot = os_info.LastBootUpTime.split('.')[0]
                last_boot_time = datetime.strptime(last_boot, '%Y%m%d%H%M%S')
                now = datetime.now()
                uptime_seconds = (now - last_boot_time).total_seconds()
                info["uptime_seconds"] = uptime_seconds
            except ImportError:
                info["uptime_info"] = "wmi module not installed"
    except Exception as e:
        info["uptime_error"] = str(e)
    
    return info

def check_url(url, timeout=5):
    """Check if a URL is accessible and return status with response time"""
    start_time = time.time()
    try:
        # Create a context that doesn't verify SSL certificates
        context = ssl._create_unverified_context()
        req = urllib.request.Request(url)
        response = urllib.request.urlopen(req, timeout=timeout, context=context)
        status_code = response.getcode()
        response_time = int((time.time() - start_time) * 1000)  # Convert to ms
        return {
            "url": url,
            "status": "online" if 200 <= status_code < 400 else "degraded",
            "response_time_ms": response_time,
            "status_code": status_code,
            "last_checked": datetime.now().isoformat()
        }
    except urllib.error.HTTPError as e:
        response_time = int((time.time() - start_time) * 1000)
        return {
            "url": url,
            "status": "degraded" if 400 <= e.code < 500 else "offline",
            "response_time_ms": response_time,
            "status_code": e.code,
            "error": str(e),
            "last_checked": datetime.now().isoformat()
        }
    except Exception as e:
        response_time = int((time.time() - start_time) * 1000)
        return {
            "url": url,
            "status": "offline",
            "response_time_ms": response_time,
            "error": str(e),
            "last_checked": datetime.now().isoformat()
        }

def check_tcp_port(host, port, timeout=3):
    """Check if a TCP port is open and responsive"""
    start_time = time.time()
    sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    sock.settimeout(timeout)
    
    try:
        sock.connect((host, port))
        sock.close()
        response_time = int((time.time() - start_time) * 1000)  # Convert to ms
        return {
            "host": host,
            "port": port,
            "status": "online",
            "response_time_ms": response_time,
            "last_checked": datetime.now().isoformat()
        }
    except socket.error as e:
        response_time = int((time.time() - start_time) * 1000)
        return {
            "host": host,
            "port": port,
            "status": "offline",
            "error": str(e),
            "response_time_ms": response_time,
            "last_checked": datetime.now().isoformat()
        }
    finally:
        sock.close()

def check_service(service_name):
    """Check if a system service is running (works on systemd-based Linux systems)"""
    try:
        if platform.system() == "Linux":
            # For Linux with systemd
            process = subprocess.run(['systemctl', 'is-active', service_name], 
                                    stdout=subprocess.PIPE, 
                                    stderr=subprocess.PIPE,
                                    universal_newlines=True)
            is_active = process.stdout.strip() == 'active'
            return {
                "name": service_name,
                "status": "online" if is_active else "offline",
                "last_checked": datetime.now().isoformat()
            }
        elif platform.system() == "Darwin":  # macOS
            # For macOS, we check for launchd services
            process = subprocess.run(['launchctl', 'list', service_name], 
                                    stdout=subprocess.PIPE, 
                                    stderr=subprocess.PIPE,
                                    universal_newlines=True)
            is_running = process.returncode == 0
            return {
                "name": service_name,
                "status": "online" if is_running else "offline",
                "last_checked": datetime.now().isoformat()
            }
        elif platform.system() == "Windows":
            # For Windows, use the 'sc' command
            process = subprocess.run(['sc', 'query', service_name], 
                                    stdout=subprocess.PIPE, 
                                    stderr=subprocess.PIPE,
                                    universal_newlines=True)
            is_running = 'RUNNING' in process.stdout
            return {
                "name": service_name,
                "status": "online" if is_running else "offline",
                "last_checked": datetime.now().isoformat()
            }
        else:
            return {
                "name": service_name,
                "status": "unknown",
                "error": f"Unsupported platform: {platform.system()}",
                "last_checked": datetime.now().isoformat()
            }
    except Exception as e:
        return {
            "name": service_name,
            "status": "unknown",
            "error": str(e),
            "last_checked": datetime.now().isoformat()
        }

def report_to_server():
    """Send heartbeat and monitoring data to the UptimeMonitor server"""
    system_info = get_system_info()
    
    # Add your monitoring checks here for URLs, ports, or services
    checks = [
        # Example checks (uncomment and modify as needed):
        # check_url("https://example.com"),
        # check_tcp_port("localhost", 80),
        # check_service("nginx"),
    ]
    
    # Prepare the data payload
    payload = {
        "apiKey": API_KEY,
        "serverInfo": system_info,
        "checks": checks
    }
    
    # Convert to JSON
    data = json.dumps(payload).encode('utf-8')
    
    try:
        # Prepare the HTTP request
        url = f"{MONITOR_URL}/api/agents/heartbeat"
        headers = {
            "Content-Type": "application/json",
            "Content-Length": str(len(data)),
            "User-Agent": f"UptimeMonitorAgent/1.0.0 Python/{platform.python_version()}"
        }
        
        # Create a request object
        req = urllib.request.Request(url, data=data, headers=headers, method="POST")
        
        # Create a context that doesn't verify SSL certificates for development environments
        context = ssl._create_unverified_context()
        
        # Send the request
        with urllib.request.urlopen(req, context=context) as response:
            status_code = response.getcode()
            response_body = response.read().decode('utf-8')
            log(f"Heartbeat sent. Status: {status_code}")
            if status_code != 200:
                log(f"Error response: {response_body}")
    except Exception as e:
        log(f"Error sending heartbeat: {str(e)}")

def main():
    """Main function to run the agent"""
    log(f"UptimeMonitor Agent started for ${agent.name}")
    log(f"Sending heartbeats every {HEARTBEAT_INTERVAL} seconds")
    log(f"Press Ctrl+C to exit")
    
    # Send initial heartbeat
    report_to_server()
    
    # Set up regular heartbeat interval
    try:
        while True:
            time.sleep(HEARTBEAT_INTERVAL)
            report_to_server()
    except KeyboardInterrupt:
        log("Shutting down...")
        sys.exit(0)

if __name__ == "__main__":
    main()
`;
  }
  
  // Bash script template
  function getBashScript(agent: Agent): string {
    return `#!/bin/bash
#
# UptimeMonitor Agent Script (Bash)
# Version: 1.0.0
# Agent ID: ${agent.id}
# Agent Name: ${agent.name}
#
# This script sends heartbeat signals and server stats to your UptimeMonitor instance.
# It works on any Unix-like system with bash, curl, and common utilities.
#

# Agent configuration
API_KEY="${agent.apiKey}"
MONITOR_URL="${window.location.origin}"
HEARTBEAT_INTERVAL=30  # seconds
DEBUG=true  # Set to false to reduce console output

# Log function
log() {
  if [ "$DEBUG" = true ]; then
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1"
  fi
}

# Get hostname
HOSTNAME=$(hostname)

# Function to get system information
get_system_info() {
  # Create a temporary JSON file
  TMP_FILE=$(mktemp)
  
  # Basic system information
  OS_TYPE=$(uname -s)
  OS_RELEASE=$(uname -r)
  ARCHITECTURE=$(uname -m)
  
  # Start building JSON
  echo "{" > "$TMP_FILE"
  echo "  \\"hostname\\": \\"$HOSTNAME\\"," >> "$TMP_FILE"
  echo "  \\"platform\\": \\"$OS_TYPE\\"," >> "$TMP_FILE"
  echo "  \\"architecture\\": \\"$ARCHITECTURE\\"," >> "$TMP_FILE"
  echo "  \\"os_release\\": \\"$OS_RELEASE\\"," >> "$TMP_FILE"
  echo "  \\"timestamp\\": \\"$(date -u +'%Y-%m-%dT%H:%M:%SZ')\\"," >> "$TMP_FILE"
  
  # Memory information
  if [ "$OS_TYPE" = "Linux" ]; then
    # Linux memory information
    TOTAL_MEM=$(free -b | grep Mem | awk '{print $2}')
    FREE_MEM=$(free -b | grep Mem | awk '{print $4+$6}')
    USED_MEM=$((TOTAL_MEM - FREE_MEM))
    MEM_USAGE=$(echo "scale=2; $USED_MEM*100/$TOTAL_MEM" | bc)
    
    echo "  \\"total_memory\\": $TOTAL_MEM," >> "$TMP_FILE"
    echo "  \\"free_memory\\": $FREE_MEM," >> "$TMP_FILE"
    echo "  \\"memory_usage\\": \\"$MEM_USAGE%\\"," >> "$TMP_FILE"
    
    # Uptime information
    UPTIME_SECONDS=$(cat /proc/uptime | awk '{print $1}' | cut -d. -f1)
    echo "  \\"uptime_seconds\\": $UPTIME_SECONDS," >> "$TMP_FILE"
    
    # Load average
    LOAD_AVG=$(cat /proc/loadavg | awk '{print $1", "$2", "$3}')
    echo "  \\"load_average\\": \\"$LOAD_AVG\\"," >> "$TMP_FILE"
    
    # CPU info
    CPU_COUNT=$(grep -c "processor" /proc/cpuinfo)
    echo "  \\"cpu_count\\": $CPU_COUNT," >> "$TMP_FILE"
    
    # CPU model
    CPU_MODEL=$(grep "model name" /proc/cpuinfo | head -1 | cut -d: -f2 | sed 's/^[ \\t]*//')
    echo "  \\"cpu_model\\": \\"$CPU_MODEL\\"" >> "$TMP_FILE"
  elif [ "$OS_TYPE" = "Darwin" ]; then
    # macOS memory information
    TOTAL_MEM=$(sysctl -n hw.memsize)
    # This is an approximation for macOS free memory
    FREE_MEM=$(vm_stat | grep "Pages free" | awk '{print $3}' | sed 's/\\.//' | xargs -I {} echo "{} * 4096" | bc)
    USED_MEM=$((TOTAL_MEM - FREE_MEM))
    MEM_USAGE=$(echo "scale=2; $USED_MEM*100/$TOTAL_MEM" | bc)
    
    echo "  \\"total_memory\\": $TOTAL_MEM," >> "$TMP_FILE"
    echo "  \\"free_memory\\": $FREE_MEM," >> "$TMP_FILE"
    echo "  \\"memory_usage\\": \\"$MEM_USAGE%\\"," >> "$TMP_FILE"
    
    # Uptime information for macOS
    UPTIME_SECONDS=$(sysctl -n kern.boottime | awk '{print $4}' | sed 's/,//' | xargs -I {} echo $(date +%s) - {} | bc)
    echo "  \\"uptime_seconds\\": $UPTIME_SECONDS," >> "$TMP_FILE"
    
    # Load average
    LOAD_AVG=$(sysctl -n vm.loadavg | awk '{print $2", "$3", "$4}')
    echo "  \\"load_average\\": \\"$LOAD_AVG\\"," >> "$TMP_FILE"
    
    # CPU info
    CPU_COUNT=$(sysctl -n hw.ncpu)
    echo "  \\"cpu_count\\": $CPU_COUNT," >> "$TMP_FILE"
    
    # CPU model
    CPU_MODEL=$(sysctl -n machdep.cpu.brand_string)
    echo "  \\"cpu_model\\": \\"$CPU_MODEL\\"" >> "$TMP_FILE"
  else
    # Fallback for other Unix-like systems
    echo "  \\"memory_info\\": \\"Not available for this OS\\"," >> "$TMP_FILE"
    echo "  \\"uptime_info\\": \\"Not available for this OS\\"," >> "$TMP_FILE"
    echo "  \\"cpu_info\\": \\"Not available for this OS\\"" >> "$TMP_FILE"
  fi
  
  echo "}" >> "$TMP_FILE"
  
  # Read the file contents and clean up
  cat "$TMP_FILE"
  rm "$TMP_FILE"
}

# Function to check a URL
check_url() {
  URL="$1"
  START_TIME=$(date +%s.%N)
  
  # Use curl to check the URL
  HTTP_CODE=$(curl -o /dev/null -s -w "%{http_code}" --insecure --max-time 5 "$URL")
  
  # Calculate response time
  END_TIME=$(date +%s.%N)
  RESPONSE_TIME=$(echo "($END_TIME - $START_TIME) * 1000" | bc | cut -d. -f1)
  
  # Determine status
  if [ "$HTTP_CODE" -ge 200 ] && [ "$HTTP_CODE" -lt 400 ]; then
    STATUS="online"
  elif [ "$HTTP_CODE" -ge 400 ] && [ "$HTTP_CODE" -lt 500 ]; then
    STATUS="degraded"
  else
    STATUS="offline"
  fi
  
  # Return JSON
  echo "{"
  echo "  \\"url\\": \\"$URL\\","
  echo "  \\"status\\": \\"$STATUS\\","
  echo "  \\"response_time_ms\\": $RESPONSE_TIME,"
  echo "  \\"status_code\\": $HTTP_CODE,"
  echo "  \\"last_checked\\": \\"$(date -u +'%Y-%m-%dT%H:%M:%SZ')\\""
  echo "}"
}

# Function to check a TCP port
check_tcp_port() {
  HOST="$1"
  PORT="$2"
  TIMEOUT="$3"
  
  if [ -z "$TIMEOUT" ]; then
    TIMEOUT=3
  fi
  
  START_TIME=$(date +%s.%N)
  
  # Check if the port is open
  if timeout "$TIMEOUT" bash -c "echo > /dev/tcp/$HOST/$PORT" 2>/dev/null; then
    STATUS="online"
  else
    STATUS="offline"
  fi
  
  # Calculate response time
  END_TIME=$(date +%s.%N)
  RESPONSE_TIME=$(echo "($END_TIME - $START_TIME) * 1000" | bc | cut -d. -f1)
  
  # Return JSON
  echo "{"
  echo "  \\"host\\": \\"$HOST\\","
  echo "  \\"port\\": $PORT,"
  echo "  \\"status\\": \\"$STATUS\\","
  echo "  \\"response_time_ms\\": $RESPONSE_TIME,"
  echo "  \\"last_checked\\": \\"$(date -u +'%Y-%m-%dT%H:%M:%SZ')\\""
  echo "}"
}

# Function to send a heartbeat to the server
report_to_server() {
  SYSTEM_INFO=$(get_system_info)
  
  # Create a temporary file for the full JSON payload
  TMP_PAYLOAD=$(mktemp)
  
  # Start building the JSON payload
  echo "{" > "$TMP_PAYLOAD"
  echo "  \\"apiKey\\": \\"$API_KEY\\"," >> "$TMP_PAYLOAD"
  echo "  \\"serverInfo\\": $SYSTEM_INFO," >> "$TMP_PAYLOAD"
  
  # Add checks array (customize as needed)
  echo "  \\"checks\\": [" >> "$TMP_PAYLOAD"
  
  # Add your URL, port, or service checks here (examples)
  # Uncomment and modify as needed
  # URL_CHECK=$(check_url "https://example.com")
  # echo "    $URL_CHECK," >> "$TMP_PAYLOAD"
  
  # PORT_CHECK=$(check_tcp_port "localhost" 80)
  # echo "    $PORT_CHECK," >> "$TMP_PAYLOAD"
  
  # Close the checks array and the main JSON object
  echo "  ]" >> "$TMP_PAYLOAD"
  echo "}" >> "$TMP_PAYLOAD"
  
  # Send the payload to the server
  RESPONSE=$(curl -s -X POST \
    -H "Content-Type: application/json" \
    -H "User-Agent: UptimeMonitorAgent/1.0.0 Bash" \
    --data @"$TMP_PAYLOAD" \
    --insecure \
    "$MONITOR_URL/api/agents/heartbeat")
  
  STATUS_CODE=$?
  
  if [ $STATUS_CODE -eq 0 ]; then
    log "Heartbeat sent successfully"
  else
    log "Error sending heartbeat: $RESPONSE"
  fi
  
  # Clean up
  rm "$TMP_PAYLOAD"
}

# Main function
main() {
  log "UptimeMonitor Agent started for ${agent.name}"
  log "Sending heartbeats every $HEARTBEAT_INTERVAL seconds"
  log "Press Ctrl+C to exit"
  
  # Send initial heartbeat
  report_to_server
  
  # Set up regular heartbeat interval
  while true; do
    sleep $HEARTBEAT_INTERVAL
    report_to_server
  done
}

# Start the agent
main
`;
  }
  
  // Node.js script template
  function getNodeScript(agent: Agent): string {
    return `#!/usr/bin/env node
/**
 * UptimeMonitor Agent Script (Node.js)
 * Version: 1.0.0
 * Agent ID: ${agent.id}
 * Agent Name: ${agent.name}
 * 
 * This script sends heartbeat signals and server stats to your UptimeMonitor instance.
 * It helps you monitor remote servers from your central dashboard.
 */
const https = require('https');
const http = require('http');
const os = require('os');
const fs = require('fs');
const child_process = require('child_process');
const net = require('net');
const url = require('url');

// Agent configuration
const API_KEY = "${agent.apiKey}";
const MONITOR_URL = "${window.location.origin}";
const HEARTBEAT_INTERVAL = 30000; // milliseconds (30 seconds)
const DEBUG = true; // Set to false to reduce console output

// Log function
function log(message) {
  if (DEBUG) {
    console.log(\`[\${new Date().toISOString()}] \${message}\`);
  }
}

// Function to get system info
function getSystemInfo() {
  const totalMem = os.totalmem();
  const freeMem = os.freemem();
  const memUsage = ((totalMem - freeMem) / totalMem * 100).toFixed(2);
  
  return {
    hostname: os.hostname(),
    platform: os.platform(),
    arch: os.arch(),
    osType: os.type(),
    osRelease: os.release(),
    uptime: os.uptime(),
    cpuLoad: os.loadavg(),
    cpuCount: os.cpus().length,
    totalMemory: totalMem,
    freeMemory: freeMem,
    memoryUsage: memUsage + '%',
    timestamp: new Date().toISOString()
  };
}

// Function to check a URL
function checkUrl(urlToCheck, timeout = 5000) {
  return new Promise((resolve) => {
    const startTime = Date.now();
    const parsedUrl = url.parse(urlToCheck);
    const protocol = parsedUrl.protocol === 'https:' ? https : http;
    
    const req = protocol.request({
      hostname: parsedUrl.hostname,
      port: parsedUrl.port || (parsedUrl.protocol === 'https:' ? 443 : 80),
      path: parsedUrl.path,
      method: 'HEAD',
      timeout: timeout,
      rejectUnauthorized: false // Allow self-signed certificates
    }, (res) => {
      const responseTime = Date.now() - startTime;
      
      let status;
      if (res.statusCode >= 200 && res.statusCode < 400) {
        status = 'online';
      } else if (res.statusCode >= 400 && res.statusCode < 500) {
        status = 'degraded';
      } else {
        status = 'offline';
      }
      
      resolve({
        url: urlToCheck,
        status: status,
        response_time_ms: responseTime,
        status_code: res.statusCode,
        last_checked: new Date().toISOString()
      });
      
      res.resume(); // Consume response data to free up memory
    });
    
    req.on('error', (err) => {
      const responseTime = Date.now() - startTime;
      resolve({
        url: urlToCheck,
        status: 'offline',
        response_time_ms: responseTime,
        error: err.message,
        last_checked: new Date().toISOString()
      });
    });
    
    req.on('timeout', () => {
      req.abort();
      const responseTime = Date.now() - startTime;
      resolve({
        url: urlToCheck,
        status: 'offline',
        response_time_ms: responseTime,
        error: 'Connection timed out',
        last_checked: new Date().toISOString()
      });
    });
    
    req.end();
  });
}

// Function to check a TCP port
function checkTcpPort(host, port, timeout = 3000) {
  return new Promise((resolve) => {
    const startTime = Date.now();
    const socket = new net.Socket();
    socket.setTimeout(timeout);
    
    socket.on('connect', () => {
      const responseTime = Date.now() - startTime;
      socket.destroy();
      resolve({
        host: host,
        port: port,
        status: 'online',
        response_time_ms: responseTime,
        last_checked: new Date().toISOString()
      });
    });
    
    socket.on('timeout', () => {
      const responseTime = Date.now() - startTime;
      socket.destroy();
      resolve({
        host: host,
        port: port,
        status: 'offline',
        error: 'Connection timed out',
        response_time_ms: responseTime,
        last_checked: new Date().toISOString()
      });
    });
    
    socket.on('error', (err) => {
      const responseTime = Date.now() - startTime;
      resolve({
        host: host,
        port: port,
        status: 'offline',
        error: err.message,
        response_time_ms: responseTime,
        last_checked: new Date().toISOString()
      });
    });
    
    socket.connect(port, host);
  });
}

// Function to report data to UptimeMonitor
async function reportToServer() {
  const systemInfo = getSystemInfo();
  
  // Add your checks here (URL, TCP port, or service)
  // For example:
  const checks = [
    // Uncomment and modify these examples as needed:
    // await checkUrl('https://example.com'),
    // await checkTcpPort('localhost', 80),
  ];
  
  const data = JSON.stringify({
    apiKey: API_KEY,
    serverInfo: systemInfo,
    checks: checks
  });
  
  const parsedUrl = url.parse(MONITOR_URL);
  
  const options = {
    hostname: parsedUrl.hostname,
    port: parsedUrl.port || (parsedUrl.protocol === 'https:' ? 443 : 80),
    path: '/api/agents/heartbeat',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': data.length,
      'User-Agent': \`UptimeMonitorAgent/1.0.0 Node.js/\${process.version}\`
    },
    rejectUnauthorized: false // Allow self-signed certificates
  };
  
  const protocol = parsedUrl.protocol === 'https:' ? https : http;
  
  const req = protocol.request(options, (res) => {
    let responseData = '';
    res.on('data', (chunk) => {
      responseData += chunk;
    });
    
    res.on('end', () => {
      log(\`Heartbeat sent. Status: \${res.statusCode}\`);
      if (res.statusCode !== 200) {
        log(\`Error response: \${responseData}\`);
      }
    });
  });
  
  req.on('error', (error) => {
    log(\`Error sending heartbeat: \${error.message}\`);
  });
  
  req.write(data);
  req.end();
}

// Main execution
log(\`UptimeMonitor Agent started for ${agent.name}\`);
log(\`Sending heartbeats every \${HEARTBEAT_INTERVAL/1000} seconds\`);
log(\`Press Ctrl+C to exit\`);

// Send initial heartbeat
reportToServer();

// Set up regular heartbeat interval
const interval = setInterval(reportToServer, HEARTBEAT_INTERVAL);

// Handle graceful shutdown
process.on('SIGINT', () => {
  log('Shutting down...');
  clearInterval(interval);
  process.exit(0);
});
`;
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <Sidebar />
      
      <div className="md:ml-64 min-h-screen">
        <Topbar title="Agents" />
        
        <main className="p-4 md:p-6 max-w-7xl mx-auto">
          <div className="mb-6 flex flex-col md:flex-row md:items-center md:justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-800 dark:text-gray-100">Agent Management</h1>
              <p className="text-gray-600 dark:text-gray-400">Deploy and monitor agents on any server with Python, Bash, or Node.js</p>
            </div>
            
            <Dialog open={openCreateDialog} onOpenChange={setOpenCreateDialog}>
              <DialogTrigger asChild>
                <Button className="mt-4 md:mt-0 flex items-center gap-2">
                  <Server className="h-4 w-4" />
                  Create New Agent
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                  <DialogTitle>Create New Agent</DialogTitle>
                  <DialogDescription>
                    Create a new monitoring agent to deploy on your servers.
                  </DialogDescription>
                </DialogHeader>
                
                <Form {...form}>
                  <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                    <FormField
                      control={form.control}
                      name="name"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Agent Name</FormLabel>
                          <FormControl>
                            <Input placeholder="Production Server" {...field} />
                          </FormControl>
                          <FormDescription>
                            Give your agent a descriptive name
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    
                    <FormField
                      control={form.control}
                      name="description"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Description (Optional)</FormLabel>
                          <FormControl>
                            <Textarea placeholder="Main production web server hosted on AWS" {...field} />
                          </FormControl>
                          <FormDescription>
                            Add notes about this server's role or location
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    
                    <DialogFooter>
                      <Button type="submit" disabled={createAgentMutation.isPending}>
                        {createAgentMutation.isPending ? (
                          <>
                            <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                            Creating...
                          </>
                        ) : (
                          "Create Agent"
                        )}
                      </Button>
                    </DialogFooter>
                  </form>
                </Form>
              </DialogContent>
            </Dialog>
          </div>
          
          {isLoadingAgents ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {[1, 2, 3].map((i) => (
                <Card key={i} className="animate-pulse">
                  <CardHeader className="h-24 bg-gray-100 dark:bg-gray-800"></CardHeader>
                  <CardContent className="py-6">
                    <div className="h-4 bg-gray-100 dark:bg-gray-800 rounded mb-4 w-3/4"></div>
                    <div className="h-4 bg-gray-100 dark:bg-gray-800 rounded w-1/2"></div>
                  </CardContent>
                  <CardFooter className="flex justify-between">
                    <div className="h-10 bg-gray-100 dark:bg-gray-800 rounded w-1/4"></div>
                    <div className="h-10 bg-gray-100 dark:bg-gray-800 rounded w-1/4"></div>
                  </CardFooter>
                </Card>
              ))}
            </div>
          ) : agents && agents.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {agents.map((agent) => (
                <Card key={agent.id} className={cn(
                  "border-l-4",
                  agent.status === "active" ? "border-l-green-500" : 
                  agent.status === "inactive" ? "border-l-gray-400" : "border-l-yellow-500"
                )}>
                  <CardHeader>
                    <CardTitle className="flex items-center justify-between">
                      <span>{agent.name}</span>
                      <span className={cn(
                        "text-xs px-2 py-1 rounded-full",
                        agent.status === "active" ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100" : 
                        agent.status === "inactive" ? "bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300" : 
                        "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-100"
                      )}>
                        {agent.status === "active" ? "Active" : 
                         agent.status === "inactive" ? "Inactive" : "Connecting"}
                      </span>
                    </CardTitle>
                    <CardDescription>
                      {agent.description || "No description provided"}
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="mb-4">
                      <Label className="text-xs text-gray-500 dark:text-gray-400">API KEY</Label>
                      <div className="relative">
                        <Input 
                          type="text" 
                          value={agent.apiKey} 
                          readOnly 
                          className="pr-10 text-sm font-mono bg-gray-50 dark:bg-gray-800"
                        />
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button 
                                variant="ghost" 
                                size="icon" 
                                className="absolute right-0 top-0"
                                onClick={() => copyApiKey(agent.apiKey)}
                              >
                                <Copy className="h-4 w-4" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>
                              {copiedApiKey === agent.apiKey ? "Copied!" : "Copy API Key"}
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      </div>
                    </div>
                    
                    {agent.lastSeen && (
                      <div className="text-sm text-gray-500 dark:text-gray-400">
                        Last seen: {new Date(agent.lastSeen).toLocaleString()}
                      </div>
                    )}
                  </CardContent>
                  <CardFooter className="flex justify-between">
                    <div className="flex gap-2">
                      <Button 
                        variant="outline" 
                        size="sm" 
                        className="text-xs"
                        onClick={() => openScriptDialogHandler(agent)}
                      >
                        <Download className="h-3 w-3 mr-1" />
                        Script
                      </Button>
                      <Button 
                        variant="destructive" 
                        size="sm" 
                        className="text-xs"
                        onClick={() => {
                          setSelectedAgent(agent);
                          setOpenDeleteDialog(true);
                        }}
                      >
                        <Trash2 className="h-3 w-3 mr-1" />
                        Sil
                      </Button>
                    </div>
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      className="text-xs"
                      onClick={() => refreshAgentMutation.mutate(agent.id)}
                      disabled={refreshAgentMutation.isPending && selectedAgent?.id === agent.id}
                    >
                      <RefreshCw className={cn(
                        "h-3 w-3 mr-1",
                        refreshAgentMutation.isPending && selectedAgent?.id === agent.id ? "animate-spin" : ""
                      )} />
                      Refresh
                    </Button>
                  </CardFooter>
                </Card>
              ))}
            </div>
          ) : (
            <div className="text-center py-12">
              <Server className="h-12 w-12 mx-auto text-gray-400 dark:text-gray-600 mb-4" />
              <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">No agents found</h3>
              <p className="text-gray-500 dark:text-gray-400 mb-6 max-w-md mx-auto">
                Deploy monitoring agents on your servers to track their health and performance.
              </p>
              <Button onClick={() => setOpenCreateDialog(true)}>
                <Server className="h-4 w-4 mr-2" />
                Create Your First Agent
              </Button>
            </div>
          )}
        </main>
      </div>
      
      {/* Agent Silme Dialog */}
      <Dialog open={openDeleteDialog} onOpenChange={setOpenDeleteDialog}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-500">
              <AlertTriangle className="h-5 w-5" />
              Agent'ı Sil
            </DialogTitle>
            <DialogDescription>
              Bu agent'ı silmek istediğinizden emin misiniz? Bu işlem geri alınamaz ve agent'a bağlı tüm servisler doğrudan izleme moduna geçirilecektir.
            </DialogDescription>
          </DialogHeader>
          
          {selectedAgent && (
            <div className="p-3 border rounded-md mt-2 bg-slate-50 dark:bg-slate-900">
              <div className="flex flex-col space-y-1">
                <div className="font-medium">{selectedAgent.name}</div>
                <div className="text-sm text-muted-foreground">
                  Status: <span className={selectedAgent.status === "active" ? "text-green-500" : "text-gray-500"}>{selectedAgent.status}</span>
                </div>
                {selectedAgent.description && (
                  <div className="text-sm text-muted-foreground">{selectedAgent.description}</div>
                )}
              </div>
            </div>
          )}
          
          <DialogFooter className="mt-4">
            <Button
              variant="outline"
              onClick={() => setOpenDeleteDialog(false)}
            >
              İptal
            </Button>
            <Button 
              variant="destructive" 
              onClick={() => selectedAgent && deleteAgentMutation.mutate(selectedAgent.id)}
              disabled={deleteAgentMutation.isPending}
            >
              {deleteAgentMutation.isPending && (
                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
              )}
              Evet, Sil
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      {/* Script Type Selection Dialog */}
      <Dialog open={openScriptDialog} onOpenChange={setOpenScriptDialog}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Download Agent Script</DialogTitle>
            <DialogDescription>
              Choose the type of script for your agent deployment
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="p-4 border rounded-lg bg-slate-50 dark:bg-slate-900 text-sm mb-4">
              <p className="font-medium mb-2">Agent Information</p>
              <div className="grid grid-cols-2 gap-2">
                <div>Name:</div>
                <div className="font-semibold">{selectedAgent?.name}</div>
                
                <div>API Key:</div>
                <div className="flex items-center">
                  <span className="font-mono text-xs truncate mr-2">
                    {selectedAgent?.apiKey.substring(0, 12)}...
                  </span>
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="h-6 w-6"
                          onClick={() => selectedAgent && copyApiKey(selectedAgent.apiKey)}
                        >
                          <Copy className="h-3 w-3" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>
                        {copiedApiKey === selectedAgent?.apiKey ? "Copied!" : "Copy API Key"}
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </div>
              </div>
            </div>
            
            <Label htmlFor="script-type">Script Type</Label>
            <div className="flex flex-col space-y-2">
              <div className="flex items-center space-x-2">
                <Button 
                  variant={scriptType === 'python' ? 'default' : 'outline'} 
                  onClick={() => setScriptType('python')}
                  className="w-full justify-start"
                >
                  <Globe className="h-4 w-4 mr-2" />
                  Python (Cross-Platform)
                </Button>
              </div>
              <div className="flex items-center space-x-2">
                <Button 
                  variant={scriptType === 'bash' ? 'default' : 'outline'} 
                  onClick={() => setScriptType('bash')}
                  className="w-full justify-start"
                >
                  <Cpu className="h-4 w-4 mr-2" />
                  Bash (Linux/macOS)
                </Button>
              </div>
              <div className="flex items-center space-x-2">
                <Button 
                  variant={scriptType === 'node' ? 'default' : 'outline'} 
                  onClick={() => setScriptType('node')}
                  className="w-full justify-start"
                >
                  <Server className="h-4 w-4 mr-2" />
                  Node.js
                </Button>
              </div>
            </div>
            
            <div className="text-sm text-muted-foreground mt-4">
              <p className="mb-2">Installation instructions:</p>
              {scriptType === 'python' && (
                <ol className="list-decimal pl-5 space-y-1">
                  <li>Download the script to your server</li>
                  <li>Make it executable: <code className="bg-slate-100 dark:bg-slate-800 px-1 rounded">chmod +x python-agent.py</code></li>
                  <li>Run it: <code className="bg-slate-100 dark:bg-slate-800 px-1 rounded">python3 python-agent.py</code></li>
                </ol>
              )}
              {scriptType === 'bash' && (
                <ol className="list-decimal pl-5 space-y-1">
                  <li>Download the script to your server</li>
                  <li>Make it executable: <code className="bg-slate-100 dark:bg-slate-800 px-1 rounded">chmod +x bash-agent.sh</code></li>
                  <li>Run it: <code className="bg-slate-100 dark:bg-slate-800 px-1 rounded">./bash-agent.sh</code></li>
                </ol>
              )}
              {scriptType === 'node' && (
                <ol className="list-decimal pl-5 space-y-1">
                  <li>Download the script to your server</li>
                  <li>Install dependencies: <code className="bg-slate-100 dark:bg-slate-800 px-1 rounded">npm install</code></li>
                  <li>Run it: <code className="bg-slate-100 dark:bg-slate-800 px-1 rounded">node node-agent.js</code></li>
                </ol>
              )}
            </div>
          </div>
          
          <DialogFooter>
            <Button onClick={downloadScript}>
              <Download className="h-4 w-4 mr-2" />
              Download Script
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}