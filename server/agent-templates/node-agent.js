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
const dns = require('dns');
const { promisify } = require('util');

// Promisify DNS resolution
const dnsLookup = promisify(dns.lookup);

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
 * Measure DNS resolution time for a hostname
 */
async function measureDnsResolutionTime(hostname) {
  // Skip DNS resolution for IP addresses
  if (/^(\d{1,3}\.){3}\d{1,3}$/.test(hostname)) {
    return null;
  }
  
  try {
    const startTime = Date.now();
    await dnsLookup(hostname);
    return Date.now() - startTime;
  } catch (error) {
    console.error(`DNS resolution error for ${hostname}:`, error.message);
    return null;
  }
}

/**
 * Check TLS certificate for HTTPS services
 */
async function checkTlsCertificate(host, port = 443) {
  return new Promise(resolve => {
    const startTime = Date.now();
    const req = https.request({
      host,
      port,
      method: 'HEAD',
      rejectUnauthorized: false,
    }, (res) => {
      try {
        const socket = res.socket;
        const cert = socket.getPeerCertificate && socket.getPeerCertificate();
        
        if (!cert || !cert.valid_to) {
          resolve({ expiryDays: null, handshakeTime: null });
          return;
        }
        
        const expiryDate = new Date(cert.valid_to);
        const currentDate = new Date();
        const diffTime = Math.abs(expiryDate.getTime() - currentDate.getTime());
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        
        const handshakeTime = Date.now() - startTime;
        
        resolve({ expiryDays: diffDays, handshakeTime });
      } catch (error) {
        console.error(`Certificate check error for ${host}:`, error);
        resolve({ expiryDays: null, handshakeTime: null });
      }
    });
    
    req.on('error', (err) => {
      console.error(`TLS request error for ${host}:${port}:`, err.message);
      resolve({ expiryDays: null, handshakeTime: null });
    });
    
    req.on('timeout', () => {
      req.destroy();
      console.error(`TLS request timeout for ${host}:${port}`);
      resolve({ expiryDays: null, handshakeTime: null });
    });
    
    req.setTimeout(3000);
    req.end();
  });
}

/**
 * Check if a service is online by attempting either a TCP socket connection
 * or HTTP connection depending on the service type
 */
async function checkService(service) {
  // Metrics object to collect all measurements
  const metrics = {
    serviceId: service.id,
    status: 'unknown',
    responseTime: null,
    latency: null,
    packetLoss: null,
    jitter: null,
    bandwidth: null,
    dnsResolutionTime: null,
    tlsHandshakeTime: null,
    certificateExpiryDays: null
  };
  
  const startTime = Date.now();
  
  // Function to check if the host is an IP address
  function isIpAddress(host) {
    return /^(\d{1,3}\.){3}\d{1,3}$/.test(host);
  }
  
  // Step 1: Measure DNS resolution time if applicable
  if (!isIpAddress(service.host)) {
    console.log(`Measuring DNS resolution time for ${service.host}`);
    metrics.dnsResolutionTime = await measureDnsResolutionTime(service.host);
    
    // If DNS resolution failed, service is offline
    if (metrics.dnsResolutionTime === null) {
      console.log(`DNS resolution failed for ${service.host}`);
      metrics.status = 'offline';
      return {
        host: service.host,
        port: service.port,
        status: metrics.status,
        serviceId: service.id,
        metrics
      };
    }
  }
  
  // Step 2: For HTTPS services, check TLS certificate
  if (service.port === 443) {
    console.log(`Checking TLS certificate for ${service.host}`);
    const certCheck = await checkTlsCertificate(service.host, service.port);
    metrics.tlsHandshakeTime = certCheck.handshakeTime;
    metrics.certificateExpiryDays = certCheck.expiryDays;
  }
  
  // Step 3: Try a direct TCP socket connection, especially for local IPs and non-HTTP services
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
        
        // Update metrics
        metrics.status = status;
        metrics.responseTime = responseTime;
        metrics.latency = responseTime;
        
        resolve({
          host: service.host,
          port: service.port,
          serviceId: service.id,
          status,
          responseTime,
          metrics
        });
      });
      
      socket.on('timeout', () => {
        console.log(`Socket connection timeout to ${service.host}:${service.port}`);
        socket.destroy();
        
        metrics.status = 'offline';
        
        resolve({
          host: service.host,
          port: service.port,
          serviceId: service.id,
          status: 'offline',
          responseTime: null,
          metrics
        });
      });
      
      socket.on('error', (err) => {
        console.log(`Socket connection error to ${service.host}:${service.port}: ${err.message}`);
        socket.destroy();
        
        metrics.status = 'offline';
        
        resolve({
          host: service.host,
          port: service.port,
          serviceId: service.id,
          status: 'offline',
          responseTime: null,
          metrics
        });
      });
      
      try {
        socket.connect({
          host: service.host,
          port: service.port
        });
      } catch (err) {
        console.error(`Failed to initiate socket connection to ${service.host}:${service.port}:`, err.message);
        
        metrics.status = 'offline';
        
        resolve({
          host: service.host,
          port: service.port,
          serviceId: service.id,
          status: 'offline',
          responseTime: null,
          metrics
        });
      }
    });
  }
  
  // Step 4: For web services, use HTTP/HTTPS protocol
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
        
        // Update metrics
        metrics.status = status;
        metrics.responseTime = responseTime;
        metrics.latency = responseTime;
        
        resolve({
          host: service.host,
          port: service.port,
          serviceId: service.id,
          status,
          responseTime,
          metrics
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
          
          // Update metrics
          metrics.status = status;
          metrics.responseTime = responseTime;
          metrics.latency = responseTime;
          
          resolve({
            host: service.host,
            port: service.port,
            serviceId: service.id,
            status,
            responseTime,
            metrics
          });
        });
        
        socket.on('timeout', () => {
          console.log(`Fallback socket connection timeout to ${service.host}:${service.port}`);
          socket.destroy();
          
          metrics.status = 'offline';
          
          resolve({
            host: service.host,
            port: service.port,
            serviceId: service.id,
            status: 'offline',
            responseTime: null,
            metrics
          });
        });
        
        socket.on('error', (err) => {
          console.log(`Fallback socket connection error to ${service.host}:${service.port}: ${err.message}`);
          socket.destroy();
          
          metrics.status = 'offline';
          
          resolve({
            host: service.host,
            port: service.port,
            serviceId: service.id,
            status: 'offline',
            responseTime: null,
            metrics
          });
        });
        
        try {
          socket.connect({
            host: service.host,
            port: service.port
          });
        } catch (err) {
          console.error(`Failed to initiate fallback socket to ${service.host}:${service.port}:`, err.message);
          
          metrics.status = 'offline';
          
          resolve({
            host: service.host,
            port: service.port,
            serviceId: service.id,
            status: 'offline',
            responseTime: null,
            metrics
          });
        }
      } else {
        metrics.status = 'offline';
        
        resolve({
          host: service.host,
          port: service.port,
          serviceId: service.id,
          status: 'offline',
          responseTime: null,
          metrics
        });
      }
    });

    req.on('timeout', () => {
      console.log(`HTTP request timeout for ${service.host}:${service.port}`);
      req.destroy();
      
      metrics.status = 'offline';
      
      resolve({
        host: service.host,
        port: service.port,
        serviceId: service.id,
        status: 'offline',
        responseTime: null,
        metrics
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
 * Send service metrics to the API
 */
async function reportServiceMetrics(serviceId, metrics) {
  return new Promise((resolve, reject) => {
    const apiUrl = new URL('/api/agents/service-metrics', API_BASE_URL);
    const protocol = apiUrl.protocol === 'https:' ? https : http;
    
    const data = JSON.stringify({
      apiKey: API_KEY,
      serviceId,
      metrics
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
          console.log(`Service metrics reported for service ID ${serviceId}`);
          try {
            const json = JSON.parse(responseData);
            resolve(json);
          } catch (e) {
            console.error('Error parsing service metrics response:', e.message);
            reject(e);
          }
        } else {
          console.log(`Service metrics API error: ${res.statusCode} - ${responseData}`);
          reject(new Error(`API responded with status ${res.statusCode}`));
        }
      });
    });
    
    req.on('error', (e) => {
      console.error('Service metrics API request failed:', e.message);
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

/**
 * Split monitoring functions into separate tasks
 */
function runServiceChecks() {
  if (SERVICES.length === 0) {
    console.log('No services to check');
    return;
  }
  
  console.log(`Checking ${SERVICES.length} services...`);
  
  // Check each service
  (async () => {
    for (const service of SERVICES) {
      try {
        const result = await checkService(service);
        
        // Report basic status for backward compatibility
        await reportServiceStatus(result);
        
        // Also send detailed metrics if available
        if (result.metrics && result.serviceId) {
          await reportServiceMetrics(result.serviceId, result.metrics);
        }
      } catch (e) {
        console.error(`Error checking service ${service.host}:${service.port}:`, e.message);
      }
    }
  })();
}

function runHeartbeat() {
  console.log('Sending heartbeat...');
  
  // Send heartbeat to the API
  (async () => {
    try {
      await sendHeartbeat();
    } catch (e) {
      console.error('Error sending heartbeat:', e.message);
    }
  })();
}

// Start the monitoring process
console.log('Starting Service Monitor Agent...');
console.log(`Heartbeat interval: ${HEARTBEAT_INTERVAL / 1000} seconds`);
console.log(`Service check interval: ${CHECK_INTERVAL / 1000} seconds`);

// Run heartbeat immediately
runHeartbeat();

// Send heartbeats more frequently
setInterval(runHeartbeat, HEARTBEAT_INTERVAL);

// Run service checks on a separate interval
setInterval(runServiceChecks, CHECK_INTERVAL);