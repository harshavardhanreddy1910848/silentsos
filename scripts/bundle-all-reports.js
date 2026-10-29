const fs = require('fs');
const path = require('path');

const bundleDir = path.join(__dirname, '..', 'All-Test-Excel-Reports');
if (!fs.existsSync(bundleDir)) {
  fs.mkdirSync(bundleDir, { recursive: true });
}

const reports = [
  {
    suite: "1. Selenium Web E2E Testing Suite (300+ Cases)",
    src: path.join(__dirname, '..', 'selenium-tests', 'selenium_test_results.xlsx'),
    fallbackSrc: path.join(__dirname, '..', 'selenium_test_results.xlsx'),
    dest: '1-Selenium-Web-E2E-Tests.xlsx'
  },
  {
    suite: "2. Appium Native Android Mobile E2E Suite (365 Cases)",
    src: path.join(__dirname, '..', 'appium-tests', 'appium_test_results.xlsx'),
    dest: '2-Appium-Mobile-E2E-Tests.xlsx'
  },
  {
    suite: "3. Baseline / Concurrency Load Testing Suite (100 VUs / 1 Min)",
    src: path.join(__dirname, '..', 'load-tests', 'load_test_results.xlsx'),
    dest: '3-Baseline-Load-Test-Results.xlsx'
  },
  {
    suite: "4A. Security Assessment & Vulnerability Findings Matrix",
    src: path.join(__dirname, '..', 'Vulnerability Test Results', 'findings.xlsx'),
    dest: '4A-Security-Findings-Matrix.xlsx'
  },
  {
    suite: "4B. Complete Backend API Attack Surface & Endpoint Inventory",
    src: path.join(__dirname, '..', 'Vulnerability Test Results', 'endpoint-inventory.xlsx'),
    dest: '4B-API-Endpoint-Inventory.xlsx'
  }
];

console.log('='.repeat(75));
console.log('📦 BUNDLING ALL 4 TEST EXCEL REPORTS FOR GITHUB ARTIFACTS DOWNLOAD');
console.log('='.repeat(75));

let bundledCount = 0;

reports.forEach(r => {
  let source = r.src;
  if (!fs.existsSync(source) && r.fallbackSrc && fs.existsSync(r.fallbackSrc)) {
    source = r.fallbackSrc;
  }

  if (fs.existsSync(source)) {
    const target = path.join(bundleDir, r.dest);
    fs.copyFileSync(source, target);
    const sizeKb = (fs.statSync(target).size / 1024).toFixed(1);
    console.log(`✅ [${sizeKb} KB] ${r.suite} -> ${r.dest}`);
    bundledCount++;
  } else {
    console.warn(`⚠️ Warning: Report not found at ${source}`);
  }
});

console.log('='.repeat(75));
console.log(`🎉 Bundled ${bundledCount} of ${reports.length} Excel reports into: ${bundleDir}`);
console.log('='.repeat(75));
