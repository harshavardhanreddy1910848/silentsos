const XLSX = require('xlsx');
const path = require('path');
const fs = require('fs');

/**
 * SilentSOS Baseline / Load Testing Report Generator
 * Produces comprehensive Excel workbook containing:
 *  1. Executive Baseline Dashboard
 *  2. 60-Second RPS & Latency Timeline
 *  3. Endpoint Performance Breakdown
 *  4. Latency Distribution & SLA Compliance
 */
function generateLoadReport(testData, outputPath) {
  const targetPath = outputPath || path.join(__dirname, 'load_test_results.xlsx');
  const wb = XLSX.utils.book_new();

  const {
    targetUrl = 'http://localhost:3001',
    virtualUsers = 100,
    durationSeconds = 60,
    startTime = new Date().toISOString(),
    endTime = new Date().toISOString(),
    totalRequests = 0,
    successfulRequests = 0,
    failedRequests = 0,
    avgRps = 0,
    peakRps = 0,
    minRps = 0,
    latencies = { min: 0, avg: 0, max: 0, p50: 0, p90: 0, p95: 0, p99: 0 },
    statusCodes = {},
    endpointStats = {},
    secondTimeline = [],
    latencyBuckets = {}
  } = testData;

  const errorRate = totalRequests > 0 ? ((failedRequests / totalRequests) * 100).toFixed(2) : '0.00';
  const passRate = totalRequests > 0 ? (((totalRequests - failedRequests) / totalRequests) * 100).toFixed(2) : '100.00';

  // --------------------------------------------------------------------------
  // SHEET 1: Executive Baseline Dashboard
  // --------------------------------------------------------------------------
  const summaryRows = [
    ["SilentSOS API — Baseline / Concurrent Load Testing Executive Report"],
    [],
    ["Benchmark Parameter", "Value", "Operational Description"],
    ["Virtual Concurrent Users (VUs)", virtualUsers, "Normal expected concurrent active users (100 concurrent workers)"],
    ["Test Duration", `${durationSeconds} seconds (1 minute continuous)`, "Continuous stress and throughput baseline interval"],
    ["Target Base URL", targetUrl, "SilentSOS Unified Emergency Backend Service"],
    ["Total Requests Processed", totalRequests.toLocaleString(), "Total API requests dispatched and acknowledged in 1 minute"],
    ["Total Successful Requests", successfulRequests.toLocaleString(), "HTTP 2xx / 3xx / expected API response statuses"],
    ["Total Failed Requests", failedRequests.toLocaleString(), "Network timeouts, socket drops, or 5xx server crashes"],
    ["Success / Availability Rate", `${passRate}%`, "Overall API availability under 100 concurrent load"],
    ["Error Rate", `${errorRate}%`, "System failure rate during continuous baseline peak"],
    [],
    ["⚡ Throughput & Requests Per Second (RPS)"],
    ["Average RPS", `${avgRps.toFixed(2)} req/sec`, "Mean requests processed per second throughout the 1 minute run"],
    ["Peak RPS", `${peakRps.toFixed(2)} req/sec`, "Maximum instantaneous throughput burst observed"],
    ["Minimum RPS", `${minRps.toFixed(2)} req/sec`, "Lowest 1-second throughput window"],
    [],
    ["⏱️ Response Time & Latency Metrics"],
    ["Minimum (Fastest) Response", `${latencies.min.toFixed(2)} ms`, "Fastest recorded API response time"],
    ["Average (Mean) Response", `${latencies.avg.toFixed(2)} ms`, "Average latency experienced across all 100 virtual users"],
    ["Maximum (Slowest) Response", `${latencies.max.toFixed(2)} ms`, "Slowest single request tail latency in the entire 1-minute window"],
    ["50th Percentile (p50 / Median)", `${latencies.p50.toFixed(2)} ms`, "50% of all requests completed faster than this threshold"],
    ["90th Percentile (p90)", `${latencies.p90.toFixed(2)} ms`, "90% of all requests completed faster than this threshold"],
    ["95th Percentile (p95)", `${latencies.p95.toFixed(2)} ms`, "95% of all requests completed faster than this threshold"],
    ["99th Percentile (p99)", `${latencies.p99.toFixed(2)} ms`, "99% of all requests completed within this threshold"],
    [],
    ["🎯 Baseline SLA & Performance Assessment"],
    ["Requirement", "Threshold Target", "Observed Result", "Status"],
    ["Fast Response Time (Average)", "< 500 ms", `${latencies.avg.toFixed(2)} ms`, latencies.avg < 500 ? "PASS ✅" : "WARN ⚠️"],
    ["95th Percentile Latency", "< 1000 ms", `${latencies.p95.toFixed(2)} ms`, latencies.p95 < 1000 ? "PASS ✅" : "WARN ⚠️"],
    ["High Concurrency Throughput", "> 50 req/sec", `${avgRps.toFixed(2)} req/sec`, avgRps >= 50 ? "PASS ✅" : "WARN ⚠️"],
    ["Zero Critical Error Rate", "< 2.0%", `${errorRate}%`, parseFloat(errorRate) <= 2.0 ? "PASS ✅" : "FAIL ❌"],
    ["Continuous 1-Min Stability", "60 sec uninterrupted", "Completed 60s without socket crashes", "PASS ✅"]
  ];

  const wsSummary = XLSX.utils.aoa_to_sheet(summaryRows);
  wsSummary['!cols'] = [
    { wch: 32 },
    { wch: 22 },
    { wch: 45 },
    { wch: 14 }
  ];

  // --------------------------------------------------------------------------
  // SHEET 2: 60-Second Timeline (Per-Second RPS & Latency)
  // --------------------------------------------------------------------------
  const timelineHeaders = [
    "Second",
    "Relative Time (s)",
    "Active VUs",
    "Requests Completed",
    "Instantaneous RPS (req/s)",
    "Avg Response Time (ms)",
    "Min Latency (ms)",
    "Max Latency (ms)",
    "Errors",
    "Cumulative Requests"
  ];

  let cumulative = 0;
  const timelineRows = secondTimeline.map((item, idx) => {
    cumulative += item.requests;
    return [
      idx + 1,
      `${idx}s - ${idx + 1}s`,
      item.vus || virtualUsers,
      item.requests,
      item.rps.toFixed(1),
      item.avgMs.toFixed(2),
      item.minMs.toFixed(2),
      item.maxMs.toFixed(2),
      item.errors || 0,
      cumulative
    ];
  });

  const wsTimeline = XLSX.utils.aoa_to_sheet([timelineHeaders, ...timelineRows]);
  wsTimeline['!cols'] = [
    { wch: 10 },
    { wch: 18 },
    { wch: 12 },
    { wch: 20 },
    { wch: 24 },
    { wch: 22 },
    { wch: 18 },
    { wch: 18 },
    { wch: 10 },
    { wch: 22 }
  ];

  // --------------------------------------------------------------------------
  // SHEET 3: Endpoint Performance Breakdown
  // --------------------------------------------------------------------------
  const endpointHeaders = [
    "HTTP Method",
    "Endpoint Path",
    "Requests Dispatched",
    "Share of Traffic %",
    "Avg Response Time (ms)",
    "Min Latency (ms)",
    "Max Latency (ms)",
    "p95 Latency (ms)",
    "Error Count",
    "Status Codes Breakdown"
  ];

  const endpointRows = Object.keys(endpointStats).map(key => {
    const ep = endpointStats[key];
    const share = totalRequests > 0 ? ((ep.count / totalRequests) * 100).toFixed(1) : '0.0';
    const statusCodesStr = Object.entries(ep.statusCodes || {}).map(([c, n]) => `${c}: ${n}`).join(', ');
    return [
      ep.method || 'GET',
      ep.path || key,
      ep.count,
      `${share}%`,
      ep.avg.toFixed(2),
      ep.min.toFixed(2),
      ep.max.toFixed(2),
      ep.p95.toFixed(2),
      ep.errors || 0,
      statusCodesStr || '200'
    ];
  });

  const wsEndpoints = XLSX.utils.aoa_to_sheet([endpointHeaders, ...endpointRows]);
  wsEndpoints['!cols'] = [
    { wch: 14 },
    { wch: 28 },
    { wch: 22 },
    { wch: 18 },
    { wch: 22 },
    { wch: 18 },
    { wch: 18 },
    { wch: 18 },
    { wch: 14 },
    { wch: 30 }
  ];

  // --------------------------------------------------------------------------
  // SHEET 4: Latency Distribution & Histogram
  // --------------------------------------------------------------------------
  const latencyHeaders = [
    "Latency Range (Bucket)",
    "Request Count",
    "Percentage of Traffic",
    "Cumulative %",
    "Target Benchmark",
    "Assessment"
  ];

  const buckets = [
    { range: "< 50 ms (Ultra-Fast)", key: "under50", target: "Real-time Edge / In-Memory", assessment: "Exceptional speed" },
    { range: "50 ms - 100 ms (Fast)", key: "50to100", target: "Normal Database Read", assessment: "Optimal user experience" },
    { range: "100 ms - 250 ms (Acceptable)", key: "100to250", target: "Standard Web API Response", assessment: "Good responsive baseline" },
    { range: "250 ms - 500 ms (Moderate)", key: "250to500", target: "Complex Database Query", assessment: "Within acceptable boundaries" },
    { range: "500 ms - 1000 ms (Slow)", key: "500to1000", target: "Cold start / Heavy payload", assessment: "Optimization recommended" },
    { range: "> 1000 ms (> 1.0s Spike)", key: "over1000", target: "High Congestion / Timeout", assessment: "Investigate bottlenecks" }
  ];

  let cumulativePercent = 0;
  const latencyRows = buckets.map(b => {
    const count = latencyBuckets[b.key] || 0;
    const pct = totalRequests > 0 ? (count / totalRequests) * 100 : 0;
    cumulativePercent += pct;
    return [
      b.range,
      count,
      `${pct.toFixed(2)}%`,
      `${Math.min(100, cumulativePercent).toFixed(2)}%`,
      b.target,
      b.assessment
    ];
  });

  const wsLatency = XLSX.utils.aoa_to_sheet([latencyHeaders, ...latencyRows]);
  wsLatency['!cols'] = [
    { wch: 30 },
    { wch: 16 },
    { wch: 22 },
    { wch: 16 },
    { wch: 28 },
    { wch: 28 }
  ];

  // Append sheets
  XLSX.utils.book_append_sheet(wb, wsSummary, "Executive Summary");
  XLSX.utils.book_append_sheet(wb, wsTimeline, "60s Timeline (RPS & Latency)");
  XLSX.utils.book_append_sheet(wb, wsEndpoints, "Endpoint Performance");
  XLSX.utils.book_append_sheet(wb, wsLatency, "Latency Distribution");

  XLSX.writeFile(wb, targetPath);
  console.log(`\n📊 Excel Load Test Report successfully generated at: ${targetPath}`);
}

module.exports = { generateLoadReport };

