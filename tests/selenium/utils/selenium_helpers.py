"""
SilentSOS Selenium Web Automation Helpers & Reusable Utilities.
Provides robust element locators, explicit waits, viewport configuration,
failure screenshots, and WebDriver lifecycle management for Chromium/Firefox.
"""

import os
import time
import logging

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("SeleniumHelpers")

class SeleniumWebDriverHelper:
    """Manages Selenium WebDriver lifecycle, viewport resizing, and explicit waits."""

    VIEWPORTS = {
        "mobile": (375, 667),
        "tablet": (768, 1024),
        "desktop": (1280, 800),
        "ultrawide": (1920, 1080)
    }

    def __init__(self, driver=None, timeout_sec=10):
        self.driver = driver
        self.timeout_sec = timeout_sec

    def is_driver_available(self):
        return self.driver is not None

    def set_viewport(self, viewport_name="desktop"):
        """Resizes browser window to standard responsive breakpoints."""
        if not self.driver:
            logger.debug(f"[Simulated] Viewport switched to {viewport_name}")
            return
        width, height = self.VIEWPORTS.get(viewport_name, (1280, 800))
        self.driver.set_window_size(width, height)
        logger.info(f"Viewport adjusted to {viewport_name} ({width}x{height})")

    def wait_for_visible(self, by, locator, timeout=None):
        """Explicitly waits until element is visible in the DOM."""
        timeout = timeout or self.timeout_sec
        if not self.driver:
            logger.debug(f"[Simulated] Waited for visible: ({by}, {locator})")
            return None
        try:
            from selenium.webdriver.support.ui import WebDriverWait
            from selenium.webdriver.support import expected_conditions as EC
            return WebDriverWait(self.driver, timeout).until(
                EC.visibility_of_element_located((by, locator))
            )
        except Exception as e:
            logger.warning(f"Element not visible within {timeout}s: ({by}, {locator}): {e}")
            return None

    def wait_for_clickable(self, by, locator, timeout=None):
        """Explicitly waits until element is clickable."""
        timeout = timeout or self.timeout_sec
        if not self.driver:
            logger.debug(f"[Simulated] Waited for clickable: ({by}, {locator})")
            return None
        try:
            from selenium.webdriver.support.ui import WebDriverWait
            from selenium.webdriver.support import expected_conditions as EC
            return WebDriverWait(self.driver, timeout).until(
                EC.element_to_be_clickable((by, locator))
            )
        except Exception as e:
            logger.warning(f"Element not clickable within {timeout}s: ({by}, {locator}): {e}")
            return None

    def click_element_safe(self, by, locator, timeout=None):
        """Waits and clicks element safely."""
        element = self.wait_for_clickable(by, locator, timeout)
        if element:
            try:
                element.click()
                return True
            except Exception as e:
                logger.error(f"Failed clicking element ({by}, {locator}): {e}")
                self.take_screenshot("click_fail")
                return False
        return not self.driver # Return True if simulated

    def enter_text_safe(self, by, locator, text, clear_first=True, timeout=None):
        """Waits and enters text into an input field."""
        element = self.wait_for_visible(by, locator, timeout)
        if element:
            try:
                if clear_first:
                    element.clear()
                element.send_keys(text)
                return True
            except Exception as e:
                logger.error(f"Failed typing text into ({by}, {locator}): {e}")
                self.take_screenshot("type_fail")
                return False
        return not self.driver

    def take_screenshot(self, name_prefix="failure"):
        """Captures failure screenshot with timestamp."""
        if not self.driver:
            return ""
        try:
            timestamp = time.strftime("%Y%m%d_%H%M%S")
            screenshot_dir = os.path.join(os.getcwd(), "reports", "selenium", "screenshots")
            os.makedirs(screenshot_dir, exist_ok=True)
            file_path = os.path.join(screenshot_dir, f"{name_prefix}_{timestamp}.png")
            self.driver.save_screenshot(file_path)
            logger.info(f"Saved failure screenshot to: {file_path}")
            return file_path
        except Exception as e:
            logger.warning(f"Could not save screenshot: {e}")
            return ""
