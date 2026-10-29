/**
 * ============================================================================
 * SilentSOS Baseline / Load Testing Engine
 * ============================================================================
 * Profile:
 *   • 100 Virtual Users (concurrent workers)
 *   • Running continuously for 1 minute (60 seconds)
 *   • Thousands of requests dispatched across primary API endpoints
 *   • Real-time measurement of:
 *       - Requests Per Second (RPS)
 *       - Response Times (Min, Average, Max, p50, p90, p95, p99)
 *       - HTTP Status Code distribution and error rates
 * ============================================================================
 */

const http = require('http');
const https = require('https');
const { performance } = require('perf_hooks');
const path = require('path');
const fs = require('fs');
const { generateLoadReport } = require('./generate-load-report');

// Parse command line arguments
const args = process.argv.slice(2).reduce((acc, arg) => {
  const [k, v] = arg.replace(/^--/, '').split('=');
  acc[k] = v || true;
  return acc;
}, {});

const TARGET_URL = args.target || process.env.LOAD_TARGET || 'http://localhost:3001';
const VUS = parseInt(args.vus || '100', 10);
const DURATION_SECONDS = parseInt(args.duration || '60', 10);

console.log('='.repeat(75));
console.log('🚀 SILENTSOS BASELINE / LOAD TESTING ENGINE');
console.log('='.repeat(75));
console.log(`🎯 Target API Base URL : ${TARGET_URL}`);
console.log(`👥 Virtual Users (VUs) : ${VUS} concurrent workers`);
console.log(`⏱️ Duration             : ${DURATION_SECONDS} seconds (1 minute continuous)`);
console.log(`🚦 Mode                 : High-Throughput Baseline Load Verification`);
console.log('='.repeat(75));

const isHttps = TARGET_URL.startsWith('https');
const agentOptions = {
  keepAlive: true,
  maxSockets: 250,
  maxFreeSockets: 100,
  timeout: 10000
};

const httpAgent = isHttps ? new https.Agent(agentOptions) : new http.Agent(agentOptions);
const client = isHttps ? https : http;
const urlObj = new URL(TARGET_URL);

// Realistic Emergency API Endpoint Traffic Mix
const ENDPOINTS = [
  { method: 'GET', path: '/', weight: 30 },
  { method: 'GET', path: '/api/debug/mail', weight: 25 },
  { method: 'GET', path: '/api/state', weight: 20 },
  { method: 'POST', path: '/api/auth/login', weight: 15, body: JSON.stringify({ email: 'loadtest@silentsos.org', password: 'testPassword123' }) },
  { method: 'GET', path: '/api/settings', weight: 10 }
];

function selectEndpoint() {
  const rand = Math.random() * 100;
  let cumulative = 0;
  for (const ep of ENDPOINTS) {
    cumulative += ep.weight;
    if (rand <= cumulative) return ep;
  }
  return ENDPOINTS[0];
}

// Metrics Collection State
const latencies = [];
const statusCodes = {};
const endpointStats = {};
const secondTimeline = [];
const latencyBuckets = {
  under50: 0,
  '50to100': 0,
  '100to250': 0,
  '250to500': 0,
  '500to1000': 0,
  over1000: 0
};

let totalRequests = 0;
let successfulRequests = 0;
let failedRequests = 0;
let totalBytes = 0;

let currentSecondRequests = 0;
let currentSecondErrors = 0;
let currentSecondLatencies = [];

let isRunning = true;
const testStartTime = Date.now();

// Single HTTP Request Dispatcher
function dispatchRequest(endpoint) {
  return new Promise((resolve) => {
    const start = performance.now();
    const headers = {
      'User-Agent': 'SilentSOS-LoadTester/1.0',
      'Accept': 'application/json, text/html, */*'
    };

    if (endpoint.body) {
      headers['Content-Type'] = 'application/json';
      headers['Content-Length'] = Buffer.byteLength(endpoint.body);
    }

    const reqOptions = {
      protocol: urlObj.protocol,
      hostname: urlObj.hostname,
      port: urlObj.port || (isHttps ? 443 : 80),
      path: endpoint.path,
      method: endpoint.method,
      agent: httpAgent,
      headers,
      timeout: 8000
    };

    const req = client.request(reqOptions, (res) => {
      let bodyLength = 0;
      res.on('data', (chunk) => {
        bodyLength += chunk.length;
      });

      res.on('end', () => {
        const duration = performance.now() - start;
        resolve({
          success: res.statusCode < 500, // 4xx are valid application responses
          statusCode: res.statusCode,
          duration,
          bytes: bodyLength,
          error: null
        });
      });
    });

    req.on('error', (err) => {
      const duration = performance.now() - start;
      resolve({
        success: false,
        statusCode: 0,
        duration,
        bytes: 0,
        error: err.message
      });
    });

    req.on('timeout', () => {
      req.destroy();
      const duration = performance.now() - start;
      resolve({
        success: false,
        statusCode: 408,
        duration,
        bytes: 0,
        error: 'Socket Timeout'
      });
    });

    if (endpoint.body) {
      req.write(endpoint.body);
    }
    req.end();
  });
}

// Virtual User Worker Loop
async function runVirtualUser(workerId) {
  while (isRunning) {
    const ep = selectEndpoint();
    const result = await dispatchRequest(ep);

    if (!isRunning) break;

    totalRequests++;
    totalBytes += result.bytes;
    latencies.push(result.duration);

    currentSecondRequests++;
    currentSecondLatencies.push(result.duration);

    if (result.success) {
      successfulRequests++;
    } else {
      failedRequests++;
      currentSecondErrors++;
    }

    // Status codes
    const code = result.statusCode || 'ERR';
    statusCodes[code] = (statusCodes[code] || 0) + 1;

    // Endpoint breakdown
    const epKey = `${ep.method} ${ep.path}`;
    if (!endpointStats[epKey]) {
      endpointStats[epKey] = {
        method: ep.method,
        path: ep.path,
        count: 0,
        latencies: [],
        errors: 0,
        statusCodes: {}
      };
    }
    const epStat = endpointStats[epKey];
    epStat.count++;
    epStat.latencies.push(result.duration);
    if (!result.success) epStat.errors++;
    epStat.statusCodes[code] = (epStat.statusCodes[code] || 0) + 1;

    // Latency Buckets
    const d = result.duration;
    if (d < 50) latencyBuckets.under50++;
    else if (d < 100) latencyBuckets['50to100']++;
    else if (d < 250) latencyBuckets['100to250']++;
    else if (d < 500) latencyBuckets['250to500']++;
    else if (d < 1000) latencyBuckets['500to1000']++;
    else latencyBuckets.over1000++;

    // Minimal async yield
    await new Promise((r) => setImmediate(r));
  }
}

// Main Execution Orchestrator
async function startBaselineLoadTest() {
  console.log(`\n⏳ Initializing ${VUS} Virtual Users and starting 1-minute baseline test...\n`);

  let elapsedSeconds = 0;

  // 1-second Ticker Interval
  const ticker = setInterval(() => {
    elapsedSeconds++;
    const currentRps = currentSecondRequests;
    const avgSecLatency = currentSecondLatencies.length > 0
      ? currentSecondLatencies.reduce((a, b) => a + b, 0) / currentSecondLatencies.length
      : 0;
    const minSecLatency = currentSecondLatencies.length > 0
      ? Math.min(...currentSecondLatencies)
      : 0;
    const maxSecLatency = currentSecondLatencies.length > 0
      ? Math.max(...currentSecondLatencies)
      : 0;

    secondTimeline.push({
      second: elapsedSeconds,
      vus: VUS,
      requests: currentSecondRequests,
      rps: currentRps,
      avgMs: avgSecLatency,
      minMs: minSecLatency,
      maxMs: maxSecLatency,
      errors: currentSecondErrors
    });

    const elapsedStr = `[${String(Math.floor(elapsedSeconds / 60)).padStart(2, '0')}:${String(elapsedSeconds % 60).padStart(2, '0')} / ${String(Math.floor(DURATION_SECONDS / 60)).padStart(2, '0')}:${String(DURATION_SECONDS % 60).padStart(2, '0')}]`;
    const rpsStr = `${currentRps} req/sec`.padStart(12, ' ');
    const latStr = `avg: ${avgSecLatency.toFixed(1)}ms | min: ${minSecLatency.toFixed(1)}ms | max: ${maxSecLatency.toFixed(1)}ms`;
    const totalStr = `Total: ${totalRequests.toLocaleString()}`;

    console.log(`${elapsedStr} VUs: ${VUS} | RPS: ${rpsStr} | Latency: ${latStr} | ${totalStr}`);

    currentSecondRequests = 0;
    currentSecondErrors = 0;
    currentSecondLatencies = [];

    if (elapsedSeconds >= DURATION_SECONDS) {
      clearInterval(ticker);
      isRunning = false;
    }
  }, 1000);

  // Launch all Virtual Users concurrently
  const workers = [];
  for (let i = 1; i <= VUS; i++) {
    workers.push(runVirtualUser(i));
  }

  // Await test completion
  await Promise.all(workers);

  const testEndTime = Date.now();
  const actualDurationSec = (testEndTime - testStartTime) / 1000;

  console.log('\n' + '='.repeat(75));
  console.log('🏁 BASELINE LOAD TEST COMPLETED SUCCESSFULLY');
  console.log('='.repeat(75));

  // Compute Latency Percentiles
  latencies.sort((a, b) => a - b);
  const minLatency = latencies.length > 0 ? latencies[0] : 0;
  const maxLatency = latencies.length > 0 ? latencies[latencies.length - 1] : 0;
  const avgLatency = latencies.length > 0 ? latencies.reduce((a, b) => a + b, 0) / latencies.length : 0;

  const getPercentile = (pct) => {
    if (latencies.length === 0) return 0;
    const index = Math.floor((pct / 100) * latencies.length);
    return latencies[Math.min(index, latencies.length - 1)];
  };

  const p50 = getPercentile(50);
  const p90 = getPercentile(90);
  const p95 = getPercentile(95);
  const p99 = getPercentile(99);

  // Compute RPS Stats
  const rpsValues = secondTimeline.map(s => s.rps);
  const avgRps = rpsValues.length > 0 ? rpsValues.reduce((a, b) => a + b, 0) / rpsValues.length : 0;
  const peakRps = rpsValues.length > 0 ? Math.max(...rpsValues) : 0;
  const minRps = rpsValues.length > 0 ? Math.min(...rpsValues) : 0;

  // Process Endpoint stats
  for (const key of Object.keys(endpointStats)) {
    const ep = endpointStats[key];
    ep.latencies.sort((a, b) => a - b);
    ep.min = ep.latencies.length > 0 ? ep.latencies[0] : 0;
    ep.max = ep.latencies.length > 0 ? ep.latencies[ep.latencies.length - 1] : 0;
    ep.avg = ep.latencies.length > 0 ? ep.latencies.reduce((a, b) => a + b, 0) / ep.latencies.length : 0;
    const p95Idx = Math.floor(ep.latencies.length * 0.95);
    ep.p95 = ep.latencies.length > 0 ? ep.latencies[Math.min(p95Idx, ep.latencies.length - 1)] : 0;
    delete ep.latencies; // Free memory
  }

  // Print Output matching the User's exact prompt specifications
  console.log(`\n________________________________________`);
  console.log(`Requests per second (RPS)`);
  console.log(`Average RPS : ${avgRps.toFixed(0)} req/sec`);
  console.log(`Peak RPS    : ${peakRps} req/sec`);
  console.log(`Meaning your API handled an average of ~${avgRps.toFixed(0)} requests every second.`);
  console.log(`________________________________________`);
  console.log(`Response Time`);
  console.log(`Average : ${avgLatency.toFixed(1)}ms`);
  console.log(`Min     : ${minLatency.toFixed(1)}ms`);
  console.log(`Max     : ${maxLatency.toFixed(1)}ms`);
  console.log(`p95     : ${p95.toFixed(1)}ms`);
  console.log(`Meaning:`);
  console.log(`• Fastest response = ${minLatency.toFixed(1)}ms`);
  console.log(`• Average          = ${avgLatency.toFixed(1)}ms`);
  console.log(`• Slowest (Max)    = ${maxLatency.toFixed(1)}ms (${(maxLatency / 1000).toFixed(2)}s)`);
  console.log(`________________________________________`);
  console.log(`Total Requests Processed in 1 Minute : ${totalRequests.toLocaleString()}`);
  console.log(`Success Rate                         : ${((successfulRequests / totalRequests) * 100).toFixed(2)}% (${successfulRequests.toLocaleString()} requests)`);
  console.log(`Errors                               : ${failedRequests}`);
  console.log(`HTTP Status Codes                    : ${JSON.stringify(statusCodes)}`);
  console.log(`Total Data Transferred               : ${(totalBytes / (1024 * 1024)).toFixed(2)} MB`);
  console.log('='.repeat(75));

  const testReportData = {
    targetUrl: TARGET_URL,
    virtualUsers: VUS,
    durationSeconds: DURATION_SECONDS,
    startTime: new Date(testStartTime).toISOString(),
    endTime: new Date(testEndTime).toISOString(),
    totalRequests,
    successfulRequests,
    failedRequests,
    totalBytes,
    avgRps,
    peakRps,
    minRps,
    latencies: {
      min: minLatency,
      avg: avgLatency,
      max: maxLatency,
      p50,
      p90,
      p95,
      p99
    },
    statusCodes,
    endpointStats,
    secondTimeline,
    latencyBuckets
  };

  // Save JSON Summary
  const jsonPath = path.join(__dirname, 'load_test_results.json');
  fs.writeFileSync(jsonPath, JSON.stringify(testReportData, null, 2));
  console.log(`\n💾 Raw results JSON saved at: ${jsonPath}`);

  // Generate Excel Report
  const excelPath = path.join(__dirname, 'load_test_results.xlsx');
  generateLoadReport(testReportData, excelPath);

  process.exit(0);
}

startBaselineLoadTest().catch((err) => {
  console.error('Fatal load testing error:', err);
  process.exit(1);
});

