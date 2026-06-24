const http = require('http');
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const PORT = 3001;
const TARGET_URL = `http://localhost:${PORT}/`;
const CONCURRENCY = 100;
const DURATION_MS = 60000; // 1 minute

let totalRequests = 0;
let successCount = 0;
let failCount = 0;
const latencies = [];
const perSecondLogs = {}; // second_bucket -> { reqs: X, totalTime: Y }

let testActive = true;
let startTime = 0;

// Test a single request and return its latency
function sendRequest() {
  if (!testActive) return;

  const start = Date.now();
  totalRequests++;

  const req = http.get(TARGET_URL, (res) => {
    const elapsed = Date.now() - start;
    latencies.push(elapsed);

    // Track per-second buckets
    const bucket = Math.floor((Date.now() - startTime) / 1000);
    if (bucket >= 0 && bucket < 60) {
      if (!perSecondLogs[bucket]) {
        perSecondLogs[bucket] = { reqs: 0, time: 0 };
      }
      perSecondLogs[bucket].reqs++;
      perSecondLogs[bucket].time += elapsed;
    }

    if (res.statusCode < 400) {
      successCount++;
    } else {
      failCount++;
    }

    // Read response body to release memory
    res.resume();
    
    // Immediately spawn the next request to maintain concurrency
    setImmediate(sendRequest);
  });

  req.on('error', (err) => {
    const elapsed = Date.now() - start;
    latencies.push(elapsed);
    failCount++;
    
    // Immediately spawn the next request to maintain concurrency
    setImmediate(sendRequest);
  });

  // Set timeout to prevent hanging connections
  req.setTimeout(3000, () => {
    req.destroy();
  });
}

function checkPortActive(port) {
  return new Promise((resolve) => {
    const client = new require('net').Socket();
    client.once('connect', () => {
      client.destroy();
      resolve(true);
    });
    client.once('error', () => {
      resolve(false);
    });
    client.connect({ port });
  });
}

async function startLoadTest() {
  console.log("=== INITIATING SILENTSOS CONCURRENT LOAD TEST ===");
  console.log(`Concurrency: ${CONCURRENCY} virtual users`);
  console.log(`Duration: ${DURATION_MS / 1000} seconds`);

  const serverAlreadyRunning = await checkPortActive(PORT);
  let serverProcess = null;

  if (!serverAlreadyRunning) {
    console.log("Backend server not running on port 3001. Spawning backend/server.js...");
    // Spawn Node process for server
    serverProcess = spawn('node', ['server.js'], {
      cwd: __dirname,
      env: { ...process.env, PORT: PORT, NODE_ENV: 'production' }
    });

    serverProcess.stdout.on('data', (data) => {
      // console.log(`[SERVER]: ${data}`);
    });

    serverProcess.stderr.on('data', (data) => {
      console.error(`[SERVER ERROR]: ${data}`);
    });

    console.log("Waiting 3 seconds for database self-init and server listener...");
    await new Promise((r) => setTimeout(r, 3000));
  } else {
    console.log("Backend server is already online and active on port 3001. Commencing test.");
  }

  // Start the timers
  startTime = Date.now();
  
  // Kick off concurrent requests
  for (let i = 0; i < CONCURRENCY; i++) {
    sendRequest();
  }

  // Stop test after 60 seconds
  await new Promise((resolve) => {
    setTimeout(() => {
      testActive = false;
      resolve();
    }, DURATION_MS);
  });

  console.log("=== LOAD TEST COMPLETE. AGGREGATING TELEMETRY ===");

  // Calculations
  const minLatency = latencies.length > 0 ? Math.min(...latencies) : 0;
  const maxLatency = latencies.length > 0 ? Math.max(...latencies) : 0;
  const avgLatency = latencies.length > 0 ? (latencies.reduce((a, b) => a + b, 0) / latencies.length) : 0;
  const rps = totalRequests / (DURATION_MS / 1000);
  const successRate = (successCount / totalRequests) * 100;

  console.log(`Total Requests: ${totalRequests}`);
  console.log(`RPS (Requests Per Second): ${rps.toFixed(2)}`);
  console.log(`Average Latency: ${avgLatency.toFixed(2)} ms`);
  console.log(`Min Latency: ${minLatency} ms`);
  console.log(`Max Latency: ${maxLatency} ms`);
  console.log(`Success Rate: ${successRate.toFixed(2)}%`);

  // Build second-by-second list for Excel charts
  const secondsSeries = [];
  for (let s = 0; s < 60; s++) {
    const bucket = perSecondLogs[s] || { reqs: 0, time: 0 };
    const avg = bucket.reqs > 0 ? (bucket.time / bucket.reqs) : 0;
    secondsSeries.push({
      second: s + 1,
      requests: bucket.reqs,
      avgLatencyMs: Math.round(avg)
    });
  }

  const outputMetrics = {
    summary: {
      concurrency: CONCURRENCY,
      durationSeconds: DURATION_MS / 1000,
      totalRequests,
      successCount,
      failCount,
      rps: parseFloat(rps.toFixed(2)),
      avgLatencyMs: parseFloat(avgLatency.toFixed(2)),
      minLatencyMs: minLatency,
      maxLatencyMs: maxLatency,
      successRate: parseFloat(successRate.toFixed(2))
    },
    timeSeries: secondsSeries
  };

  const outputFilePath = path.join(__dirname, 'load_test_metrics.json');
  fs.writeFileSync(outputFilePath, JSON.stringify(outputMetrics, null, 2));
  console.log(`Saved raw performance metrics to: ${outputFilePath}`);

  if (serverProcess) {
    console.log("Stopping spawned backend server process...");
    serverProcess.kill();
  }
}

startLoadTest().catch(console.error);
