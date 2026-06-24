const { remote } = require('webdriverio');

async function runMobileLoginTest() {
  console.log("=== STARTING SILENTSOS MOBILE E2E TEST (APPIUM/WEBDRIVERIO) ===");
  
  const opts = {
    hostname: '127.0.0.1',
    port: 4723,
    path: '/',
    capabilities: {
      platformName: 'Android',
      'appium:deviceName': 'Android Emulator',
      'appium:app': 'android/app/build/outputs/apk/debug/app-debug.apk', // Capacitor compiled Android build
      'appium:appPackage': 'harshavardhanreddy1910848.silentsos',
      'appium:appActivity': 'harshavardhanreddy1910848.silentsos.MainActivity',
      'appium:automationName': 'UiAutomator2',
      'appium:noReset': true,
      'appium:newCommandTimeout': 3600
    }
  };

  console.log("Connecting to local Appium Server on port 4723...");
  const driver = await remote(opts);

  try {
    console.log("1. Locating Capacitor WebView container...");
    await driver.waitUntil(async () => {
      const contexts = await driver.getContexts();
      return contexts.length > 1;
    }, { timeout: 15000, timeoutMsg: 'WebView context did not load.' });

    const contexts = await driver.getContexts();
    console.log(`Available Contexts: ${contexts}`);
    
    // Switch to webview context to enable hybrid DOM testing
    const webviewContext = contexts.find(c => c.includes('WEBVIEW'));
    await driver.switchContext(webviewContext);
    console.log(`Context switched to: ${webviewContext}`);

    // Interact with login elements
    console.log("2. Simulating email address typing...");
    const emailField = await driver.$('input[type="email"]');
    await emailField.setValue('test@silentsos.org');

    console.log("3. Simulating password entry...");
    const passwordField = await driver.$('input[type="password"]');
    await passwordField.setValue('password123');

    console.log("4. Clicking submit form trigger button...");
    const signInButton = await driver.$('button[type="submit"]');
    await signInButton.click();

    console.log("5. Checking URL path redirection states...");
    await driver.waitUntil(async () => {
      const url = await driver.getUrl();
      return url.includes('/dashboard');
    }, { timeout: 8000 });

    const finalUrl = await driver.getUrl();
    console.log(`Mobile Redirection validated. Landed on: ${finalUrl}`);
    console.log("=== APPIUM E2E TEST RUN PASSED ===");
    return "Pass";
  } catch (error) {
    console.error("❌ Appium E2E Mobile Test Execution Failed: ", error.message);
    return "Fail";
  } finally {
    console.log("Closing Appium session...");
    await driver.deleteSession();
  }
}

if (require.main === module) {
  runMobileLoginTest();
}

module.exports = { runMobileLoginTest };
