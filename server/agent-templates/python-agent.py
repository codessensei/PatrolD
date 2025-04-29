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

# Services to monitor - this will be populated from the server response
# You can add additional custom services here if needed
SERVICES = []

# Monitoring interval in seconds - set to 1 for very frequent checks
CHECK_INTERVAL = 1

# Heartbeat interval in seconds - sends heartbeat every second
HEARTBEAT_INTERVAL = 1

# Timeout for service checks in seconds
REQUEST_TIMEOUT = 3

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
    """Send a heartbeat to the API and get the list of services to monitor"""
    global SERVICES
    
    try:
        data = {
            "apiKey": API_KEY,
            "serverInfo": get_server_info()
        }
        
        result = send_api_request('/api/agents/heartbeat', data)
        
        if result and 'agentId' in result:
            print(f"Heartbeat sent successfully, agent ID: {result['agentId']}")
            
            # Update services from response
            if 'services' in result and isinstance(result['services'], list):
                SERVICES = result['services']
                print(f"Received {len(SERVICES)} services to monitor from server:")
                for service in SERVICES:
                    print(f"- {service['name']} ({service['host']}:{service['port']})")
            else:
                print("No services received from server")
            
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

def run_service_checks():
    """Check all services and report their status"""
    try:
        # Check each service
        for service in SERVICES:
            try:
                result = check_service(service)
                report_service_status(result)
            except Exception as e:
                print(f"Error in service check loop: {e}")
    except Exception as e:
        print(f"Error in service check routine: {e}")

def run_heartbeat():
    """Send a heartbeat to the API"""
    try:
        send_heartbeat()
    except Exception as e:
        print(f"Error sending heartbeat: {e}")

def main():
    """Main entry point for the agent"""
    # Validate configuration
    if API_KEY == "{{API_KEY}}":
        print("Error: Please replace {{API_KEY}} with your actual agent API key")
        return 1
        
    if API_BASE_URL == "{{API_BASE_URL}}":
        print("Error: Please replace {{API_BASE_URL}} with your actual Service Monitor URL")
        return 1
    
    print("Starting Service Monitor Agent...")
    print(f"Heartbeat interval: {HEARTBEAT_INTERVAL} second(s)")
    print(f"Service check interval: {CHECK_INTERVAL} second(s)")
    
    # Initialize by sending the first heartbeat
    send_heartbeat()
    
    # Keep track of the last time we ran service checks
    last_service_check = time.time()
    last_heartbeat = time.time()
    
    # Run the monitoring loop
    while True:
        try:
            current_time = time.time()
            
            # Send heartbeat at regular intervals
            if current_time - last_heartbeat >= HEARTBEAT_INTERVAL:
                run_heartbeat()
                last_heartbeat = current_time
            
            # Run service checks at specified interval
            if current_time - last_service_check >= CHECK_INTERVAL:
                run_service_checks()
                last_service_check = current_time
                
            # Small sleep to prevent CPU hogging
            time.sleep(0.1)
            
        except Exception as e:
            print(f"Unexpected error in monitoring loop: {e}")
            time.sleep(1)  # Sleep on error to prevent rapid spinning
        
if __name__ == "__main__":
    main()