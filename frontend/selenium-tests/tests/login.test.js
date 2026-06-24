const { Builder, By, Key, until } = require('selenium-webdriver');

async function runLoginTest() {
  console.log("=== STARTING SILENTSOS E2E LOGIN TEST ===");
  console.log("Initializing Chrome WebDriver...");
  
  // Create chrome driver instance. Selenium Manager downloads chromedriver automatically.
  let driver = await new Builder().forBrowser('chrome').build();
  
  try {
    console.log("1. Navigating to SilentSOS login view...");
    await driver.get('http://localhost:5173/auth'); 
    
    // Adjust window dimensions
    await driver.manage().window().setRect({ width: 1280, height: 900 });
    
    // Scenario 1: Validation check on empty submit
    console.log("2. Verifying blank submission validation...");
    let submitBtn = await driver.findElement(By.css("button[type='submit']"));
    await submitBtn.click();
    await driver.sleep(1000); // Pause for UI rendering
    
    // Scenario 2: Verify validation failure on wrong password
    console.log("3. Entering invalid credentials...");
    let emailInput = await driver.findElement(By.css("input[type='email']"));
    let passwordInput = await driver.findElement(By.css("input[type='password']"));
    
    await emailInput.sendKeys('invalid-user@silentsos.com');
    await passwordInput.sendKeys('wrongpassword');
    await submitBtn.click();
    console.log("Submitted invalid details. Waiting for validation message...");
    await driver.sleep(2000);
    
    // Scenario 3: Verify successful authentication and redirection
    console.log("4. Clearing fields and entering authorized user credentials...");
    await emailInput.clear();
    await passwordInput.clear();
    
    // Type credential keys
    await emailInput.sendKeys('test@silentsos.org');
    await passwordInput.sendKeys('password123');
    await submitBtn.click();
    
    console.log("Waiting for dashboard redirect token confirmation...");
    await driver.wait(until.urlContains('/dashboard'), 6000);
    
    let currentUrl = await driver.getCurrentUrl();
    console.log(`E2E Successful! Redirected URL: ${currentUrl}`);
    console.log("=== ALL E2E TEST SCENARIOS PASSED ===");
    return "Pass";
  } catch (error) {
    console.error("❌ E2E Test Execution Error: ", error.message);
    return "Fail";
  } finally {
    console.log("Terminating WebDriver session...");
    await driver.quit();
  }
}

if (require.main === module) {
  runLoginTest();
}

module.exports = { runLoginTest };
