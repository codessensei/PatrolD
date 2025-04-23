#!/usr/bin/env python3
"""
Python Agent for Service Monitor

This script monitors specified services and reports their status back to the 
Service Monitor API. It can be run on any server with Python 3.6+ installed.

Usage:
1. Replace API_KEY with your agent's API key
2. Configure the SERVICES list with the services you want to monitor
3. Run: python3 python-agent.py
"""

import json
import time
import socket
import platform
import urllib.request
import urllib.error
import ssl
import os
import datetime
import http.client
from urllib.parse import urlparse

# Configuration
API_KEY = "{{API_KEY}}"  # Replace with your agent API key
API_BASE_URL = "{{API_BASE_URL}}"  # Replace with your Service Monitor URL (e.g., https://your-app.replit.app)

# Services to monitor - each service should have a host and port
SERVICES = [
    # {"host": "example.com", "port": 80},
    # {"host": "192.168.1.1", "port": 8080},
    # Add your services here
]

# Monitoring interval in seconds (default: 60 seconds)
CHECK_INTERVAL = 60

# Timeout for service checks in seconds
REQUEST_TIMEOUT = 5

def get_server_info():
    """Collect information about the server this agent is running on"""
    try:
        mem_info = os.popen('free -b').readlines() if platform.system() == 'Linux' else None
        mem_total = mem_free = None
        
        if mem_info and len(mem_info) >= 2:
            parts = mem_info[1].split()
            if len(parts) >= 3:
                mem_total = int(parts[1])
                mem_free = int(parts[3])
        
        return {
            "hostname": socket.gethostname(),
            "platform": platform.system(),
            "platform_version": platform.version(),
            "architecture": platform.machine(),
            "processor": platform.processor(),
            "python_version": platform.python_version(),
            "memory": {
                "total": mem_total,
                "free": mem_free
            },
            "timestamp": datetime.datetime.now().isoformat()
        }
    except Exception as e:
        print(f"Error collecting server info: {e}")
        return {
            "hostname": socket.gethostname(),
            "platform": platform.system(),
            "error": str(e),
            "timestamp": datetime.datetime.now().isoformat()
        }

def check_service(service):
    """Check if a service is online by attempting a socket connection"""
    host = service["host"]
    port = service["port"]
    start_time = time.time()
    
    try:
        # Try connecting to the service
        s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        s.settimeout(REQUEST_TIMEOUT)
        s.connect((host, port))
        s.close()
        
        # Calculate response time in milliseconds
        response_time = int((time.time() - start_time) * 1000)
        
        # Basic status determination
        status = "online"
        if response_time > 1000:  # If response time > 1 second, consider it degraded
            status = "degraded"
            
        return {
            "host": host,
            "port": port,
            "status": status,
            "responseTime": response_time
        }
        
    except (socket.timeout, socket.error):
        return {
            "host": host,
            "port": port,
            "status": "offline",
            "responseTime": None
        }
    except Exception as e:
        print(f"Error checking {host}:{port}: {e}")
        return {
            "host": host,
            "port": port,
            "status": "offline",
            "responseTime": None
        }

def send_api_request(endpoint, data):
    """Send a request to the Service Monitor API"""
    try:
        # Parse the base URL
        parsed_url = urlparse(API_BASE_URL)
        host = parsed_url.netloc
        is_https = parsed_url.scheme == 'https'
        
        # Prepare the connection
        if is_https:
            conn = http.client.HTTPSConnection(host, timeout=REQUEST_TIMEOUT)
        else:
            conn = http.client.HTTPConnection(host, timeout=REQUEST_TIMEOUT)
            
        # Prepare headers and body
        headers = {
            'Content-Type': 'application/json'
        }
        body = json.dumps(data)
        
        # Send the request
        conn.request('POST', endpoint, body, headers)
        
        # Get the response
        response = conn.getresponse()
        response_data = response.read().decode('utf-8')
        
        # Parse the response
        if response.status == 200:
            return json.loads(response_data)
        else:
            print(f"API error: {response.status} - {response_data}")
            return None
            
    except Exception as e:
        print(f"Error sending API request to {endpoint}: {e}")
        return None
    finally:
        if 'conn' in locals():
            conn.close()

def send_heartbeat():
    """Send a heartbeat to the API"""
    try:
        data = {
            "apiKey": API_KEY,
            "serverInfo": get_server_info()
        }
        
        result = send_api_request('/api/agents/heartbeat', data)
        
        if result and 'agentId' in result:
            print(f"Heartbeat sent successfully, agent ID: {result['agentId']}")
            return True
        return False
        
    except Exception as e:
        print(f"Error sending heartbeat: {e}")
        return False

def report_service_status(result):
    """Send service check result to the API"""
    try:
        data = {
            "apiKey": API_KEY,
            **result
        }
        
        api_result = send_api_request('/api/agents/service-check', data)
        
        if api_result:
            print(f"Service status reported for {result['host']}:{result['port']} - {result['status']}")
            return True
        return False
        
    except Exception as e:
        print(f"Error reporting service status: {e}")
        return False

def run_monitoring():
    """Main monitoring function"""
    try:
        # Send heartbeat
        send_heartbeat()
        
        # Check each service
        for service in SERVICES:
            try:
                result = check_service(service)
                report_service_status(result)
            except Exception as e:
                print(f"Error in service check loop: {e}")
                
    except Exception as e:
        print(f"Error in monitoring routine: {e}")

def main():
    """Main entry point for the agent"""
    # Validate configuration
    if API_KEY == "{{API_KEY}}":
        print("Error: Please replace {{API_KEY}} with your actual agent API key")
        return 1
        
    if API_BASE_URL == "{{API_BASE_URL}}":
        print("Error: Please replace {{API_BASE_URL}} with your actual Service Monitor URL")
        return 1
        
    if not SERVICES:
        print("Warning: No services configured for monitoring")
    
    print("Starting Service Monitor Agent...")
    print(f"Monitoring {len(SERVICES)} services, checking every {CHECK_INTERVAL} seconds")
    
    # Run the monitoring loop
    while True:
        try:
            run_monitoring()
        except Exception as e:
            print(f"Unexpected error in monitoring loop: {e}")
            
        time.sleep(CHECK_INTERVAL)
        
if __name__ == "__main__":
    main()