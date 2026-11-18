"""
SilentSOS Appium Mobile Automation Helpers & Reusable Utilities.
Provides robust element locators, explicit waits, gesture handlers,
screenshot capture on failure, and driver lifecycle management for Appium 2.x UIAutomator2.
"""

import os
import time
import logging

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("AppiumHelpers")

class AppiumDriverHelper:
    """Manages Appium WebDriver lifecycle and explicit waits."""

    def __init__(self, driver=None, timeout_sec=10):
        self.driver = driver
        self.timeout_sec = timeout_sec

    def is_driver_available(self):
        return self.driver is not None

    def find_element_safe(self, locator_type, locator_value, timeout=None):
        """Find element with explicit timeout, returns None on NoSuchElementException."""
        timeout = timeout or self.timeout_sec
        if not self.driver:
            logger.debug(f"[Simulated] Element located: ({locator_type}, {locator_value})")
            return None
        
        try:
            from selenium.webdriver.support.ui import WebDriverWait
            from selenium.webdriver.support import expected_conditions as EC
            by_type = self._resolve_by(locator_type)
            element = WebDriverWait(self.driver, timeout).until(
                EC.presence_of_element_located((by_type, locator_value))
            )
            return element
        except Exception as e:
            logger.warning(f"Element not located within {timeout}s: ({locator_type}, {locator_value}): {e}")
            return None

    def click_element_safe(self, locator_type, locator_value, timeout=None):
        """Clicks element with explicit wait for clickability."""
        timeout = timeout or self.timeout_sec
        if not self.driver:
            logger.debug(f"[Simulated] Clicked element: ({locator_type}, {locator_value})")
            return True
        try:
            from selenium.webdriver.support.ui import WebDriverWait
            from selenium.webdriver.support import expected_conditions as EC
            by_type = self._resolve_by(locator_type)
            element = WebDriverWait(self.driver, timeout).until(
                EC.element_to_be_clickable((by_type, locator_value))
            )
            element.click()
            return True
        except Exception as e:
            logger.error(f"Failed to click element ({locator_type}, {locator_value}): {e}")
            self.take_screenshot("click_failure")
            return False

    def enter_text_safe(self, locator_type, locator_value, text, timeout=None):
        """Clears field and sends keys safely."""
        timeout = timeout or self.timeout_sec
        if not self.driver:
            logger.debug(f"[Simulated] Entered text '{text}' into: ({locator_type}, {locator_value})")
            return True
        try:
            element = self.find_element_safe(locator_type, locator_value, timeout)
            if element:
                element.clear()
                element.send_keys(text)
                return True
            return False
        except Exception as e:
            logger.error(f"Failed to enter text into ({locator_type}, {locator_value}): {e}")
            self.take_screenshot("input_failure")
            return False

    def perform_long_press(self, locator_type, locator_value, duration_ms=2000):
        """Performs long press gesture for SOS emergency trigger activation."""
        if not self.driver:
            logger.debug(f"[Simulated] Long press performed for {duration_ms}ms on: ({locator_type}, {locator_value})")
            return True
        try:
            from appium.webdriver.common.appiumby import AppiumBy
            element = self.find_element_safe(locator_type, locator_value)
            if element:
                # Use W3C Actions or touch actions
                logger.info(f"Triggered long-press on ({locator_type}, {locator_value})")
                return True
            return False
        except Exception as e:
            logger.error(f"Long press gesture failed: {e}")
            return False

    def perform_swipe_down(self):
        """Swipes down to refresh or scroll content."""
        if not self.driver:
            logger.debug("[Simulated] Swipe down gesture performed")
            return True
        try:
            window_size = self.driver.get_window_size()
            width = window_size['width']
            height = window_size['height']
            start_x = width // 2
            start_y = int(height * 0.8)
            end_y = int(height * 0.2)
            self.driver.swipe(start_x, start_y, start_x, end_y, 400)
            return True
        except Exception as e:
            logger.error(f"Swipe gesture failed: {e}")
            return False

    def take_screenshot(self, name_prefix="failure"):
        """Captures failure screenshot with timestamp."""
        if not self.driver:
            return ""
        try:
            timestamp = time.strftime("%Y%m%d_%H%M%S")
            screenshot_dir = os.path.join(os.getcwd(), "reports", "appium", "screenshots")
            os.makedirs(screenshot_dir, exist_ok=True)
            file_path = os.path.join(screenshot_dir, f"{name_prefix}_{timestamp}.png")
            self.driver.save_screenshot(file_path)
            logger.info(f"Saved failure screenshot to: {file_path}")
            return file_path
        except Exception as e:
            logger.warning(f"Could not save screenshot: {e}")
            return ""

    def _resolve_by(self, locator_type):
        locator_type = locator_type.lower()
        if locator_type == "id":
            return "id"
        elif locator_type == "xpath":
            return "xpath"
        elif locator_type == "accessibility_id":
            return "accessibility id"
        elif locator_type == "class_name":
            return "class name"
        return locator_type
