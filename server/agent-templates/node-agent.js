/**
 * Node.js Agent for Service Monitor
 * 
 * This script monitors specified services and reports their status back to the 
 * Service Monitor API. It can be run on any server with Node.js installed.
 * 
 * Usage:
 * 1. Replace API_KEY with your agent's API key
 * 2. Configure the services array with the services you want to monitor
 * 3. Run with Node.js: node node-agent.js
 */

const http = require('http');
const https = require('https');
const net = require('net');
const os = require('os');

// Configuration
const API_KEY = '{{API_KEY}}'; // Replace with your agent API key
const API_BASE_URL = '{{API_BASE_URL}}'; // Replace with your Service Monitor URL (e.g., https://your-app.replit.app)

// Services to monitor - this will be populated from the server response
// You can add additional custom services here if needed
let SERVICES = [];

// Service check interval in milliseconds (5 seconds)
const CHECK_INTERVAL = 5 * 1000;

// Heartbeat interval in milliseconds (1 second for frequent heartbeats)
const HEARTBEAT_INTERVAL = 1 * 1000;

// Timeout for service checks in milliseconds (3 seconds)
const REQUEST_TIMEOUT = 3000;

/**
 * Check if a service is online by attempting either a TCP socket connection
 * or HTTP connection depending on the service type
 */
async function checkService(service) {
  const startTime = Date.now();
  
  // Function to check if the host is an IP address
  function isIpAddress(host) {
    return /^(\d{1,3}\.){3}\d{1,3}$/.test(host);
  }
  
  // Try a direct TCP socket connection first, especially for local IPs and non-HTTP services
  if (isIpAddress(service.host) || service.port !== 80 && service.port !== 443 && service.port !== 8080) {
    return new Promise((resolve) => {
      console.log(`Checking ${service.host}:${service.port} using TCP socket connection`);
      
      const socket = new net.Socket();
      socket.setTimeout(REQUEST_TIMEOUT);
      
      socket.on('connect', () => {
        const responseTime = Date.now() - startTime;
        let status = responseTime > 1000 ? 'degraded' : 'online';
        
        console.log(`Socket connection successful to ${service.host}:${service.port}, response time: ${responseTime}ms`);
        socket.destroy();
        
        resolve({
          host: service.host,
          port: service.port,
          status,
          responseTime
        });
      });
      
      socket.on('timeout', () => {
        console.log(`Socket connection timeout to ${service.host}:${service.port}`);
        socket.destroy();
        
        resolve({
          host: service.host,
          port: service.port,
          status: 'offline',
          responseTime: null
        });
      });
      
      socket.on('error', (err) => {
        console.log(`Socket connection error to ${service.host}:${service.port}: ${err.message}`);
        socket.destroy();
        
        resolve({
          host: service.host,
          port: service.port,
          status: 'offline',
          responseTime: null
        });
      });
      
      try {
        socket.connect({
          host: service.host,
          port: service.port
        });
      } catch (err) {
        console.error(`Failed to initiate socket connection to ${service.host}:${service.port}:`, err.message);
        resolve({
          host: service.host,
          port: service.port,
          status: 'offline',
          responseTime: null
        });
      }
    });
  }
  
  // For web services, use HTTP/HTTPS protocol
  console.log(`Checking ${service.host}:${service.port} using HTTP request`);
  
  const protocol = service.port === 443 ? https : http;
  
  return new Promise((resolve) => {
    const req = protocol.request(
      {
        host: service.host,
        port: service.port,
        path: '/',
        method: 'GET',
        timeout: REQUEST_TIMEOUT,
      },
      (res) => {
        const responseTime = Date.now() - startTime;
        
        // Determine status based on response
        let status = 'online';
        if (res.statusCode >= 400) {
          status = 'offline';
        } else if (res.statusCode >= 300 || responseTime > 1000) {
          status = 'degraded';
        }
        
        console.log(`HTTP response from ${service.host}:${service.port}: ${res.statusCode}, time: ${responseTime}ms`);
        
        // Consume response data to free up memory
        res.resume();
        
        resolve({
          host: service.host,
          port: service.port,
          status,
          responseTime
        });
      }
    );

    req.on('error', (err) => {
      console.log(`HTTP request error for ${service.host}:${service.port}: ${err.message}`);
      
      // If the HTTP request fails and this is potentially an IP address,
      // fall back to a TCP socket connection
      if (isIpAddress(service.host)) {
        console.log(`Falling back to TCP socket for ${service.host}:${service.port}`);
        
        const socket = new net.Socket();
        socket.setTimeout(REQUEST_TIMEOUT);
        
        socket.on('connect', () => {
          const responseTime = Date.now() - startTime;
          let status = responseTime > 1000 ? 'degraded' : 'online';
          
          console.log(`Fallback socket connection successful to ${service.host}:${service.port}`);
          socket.destroy();
          
          resolve({
            host: service.host,
            port: service.port,
            status,
            responseTime
          });
        });
        
        socket.on('timeout', () => {
          console.log(`Fallback socket connection timeout to ${service.host}:${service.port}`);
          socket.destroy();
          
          resolve({
            host: service.host,
            port: service.port,
            status: 'offline',
            responseTime: null
          });
        });
        
        socket.on('error', (err) => {
          console.log(`Fallback socket connection error to ${service.host}:${service.port}: ${err.message}`);
          socket.destroy();
          
          resolve({
            host: service.host,
            port: service.port,
            status: 'offline',
            responseTime: null
          });
        });
        
        try {
          socket.connect({
            host: service.host,
            port: service.port
          });
        } catch (err) {
          console.error(`Failed to initiate fallback socket to ${service.host}:${service.port}:`, err.message);
          resolve({
            host: service.host,
            port: service.port,
            status: 'offline',
            responseTime: null
          });
        }
      } else {
        resolve({
          host: service.host,
          port: service.port,
          status: 'offline',
          responseTime: null
        });
      }
    });

    req.on('timeout', () => {
      console.log(`HTTP request timeout for ${service.host}:${service.port}`);
      req.destroy();
      
      resolve({
        host: service.host,
        port: service.port,
        status: 'offline',
        responseTime: null
      });
    });

    req.end();
  });
}

/**
 * Send a heartbeat to the API to let it know the agent is running
 * and get the list of services to monitor
 */
async function sendHeartbeat() {
  const serverInfo = {
    hostname: os.hostname(),
    platform: os.platform(),
    arch: os.arch(),
    cpus: os.cpus().length,
    memory: {
      total: os.totalmem(),
      free: os.freemem()
    },
    uptime: os.uptime(),
    timestamp: new Date().toISOString()
  };

  return new Promise((resolve, reject) => {
    const apiUrl = new URL('/api/agents/heartbeat', API_BASE_URL);
    const protocol = apiUrl.protocol === 'https:' ? https : http;
    
    const data = JSON.stringify({
      apiKey: API_KEY,
      serverInfo
    });
    
    const options = {
      hostname: apiUrl.hostname,
      port: apiUrl.port || (apiUrl.protocol === 'https:' ? 443 : 80),
      path: apiUrl.pathname,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': data.length
      }
    };
    
    const req = protocol.request(options, (res) => {
      let responseData = '';
      
      res.on('data', (chunk) => {
        responseData += chunk;
      });
      
      res.on('end', () => {
        if (res.statusCode === 200) {
          try {
            const json = JSON.parse(responseData);
            console.log(`Heartbeat sent successfully, agent ID: ${json.agentId}`);
            
            // Update the services list if returned from the server
            if (json.services && Array.isArray(json.services)) {
              SERVICES = json.services;
              console.log(`Received ${SERVICES.length} services to monitor from server:`);
              SERVICES.forEach(service => {
                console.log(`- ${service.name} (${service.host}:${service.port})`);
              });
            } else {
              console.log('No services received from server');
            }
            
            resolve(json);
          } catch (e) {
            console.error('Error parsing heartbeat response:', e.message);
            reject(e);
          }
        } else {
          console.error(`Heartbeat API error: ${res.statusCode} - ${responseData}`);
          reject(new Error(`API responded with status ${res.statusCode}`));
        }
      });
    });
    
    req.on('error', (e) => {
      console.error('Heartbeat API request failed:', e.message);
      reject(e);
    });
    
    req.write(data);
    req.end();
  });
}

/**
 * Send service check results to the API
 */
async function reportServiceStatus(result) {
  return new Promise((resolve, reject) => {
    const apiUrl = new URL('/api/agents/service-check', API_BASE_URL);
    const protocol = apiUrl.protocol === 'https:' ? https : http;
    
    const data = JSON.stringify({
      apiKey: API_KEY,
      ...result
    });
    
    const options = {
      hostname: apiUrl.hostname,
      port: apiUrl.port || (apiUrl.protocol === 'https:' ? 443 : 80),
      path: apiUrl.pathname,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': data.length
      }
    };
    
    const req = protocol.request(options, (res) => {
      let responseData = '';
      
      res.on('data', (chunk) => {
        responseData += chunk;
      });
      
      res.on('end', () => {
        if (res.statusCode === 200) {
          console.log(`Service status reported for ${result.host}:${result.port} - ${result.status}`);
          try {
            const json = JSON.parse(responseData);
            resolve(json);
          } catch (e) {
            console.error('Error parsing service check response:', e.message);
            reject(e);
          }
        } else {
          console.log(`Service report API error: ${res.statusCode} - ${responseData}`);
          reject(new Error(`API responded with status ${res.statusCode}`));
        }
      });
    });
    
    req.on('error', (e) => {
      console.error('Service report API request failed:', e.message);
      reject(e);
    });
    
    req.write(data);
    req.end();
  });
}

/**
 * Main monitoring function
 */
async function runMonitoring() {
  try {
    // Send heartbeat
    await sendHeartbeat();
    
    // Check each service
    for (const service of SERVICES) {
      try {
        const result = await checkService(service);
        await reportServiceStatus(result);
      } catch (e) {
        console.error(`Error checking service ${service.host}:${service.port}:`, e.message);
      }
    }
  } catch (e) {
    console.error('Error in monitoring routine:', e.message);
  }
}

// Display configuration info
console.log(`Using API key: ${API_KEY}`);
console.log(`Using API URL: ${API_BASE_URL}`);

if (SERVICES.length === 0) {
  console.warn('Warning: No services configured for monitoring');
}

// Start the monitoring process
console.log('Starting Service Monitor Agent...');
console.log(`Monitoring ${SERVICES.length} services, checking every ${CHECK_INTERVAL / 1000} seconds`);

// Run immediately
runMonitoring();

// Then run on interval
setInterval(runMonitoring, CHECK_INTERVAL);