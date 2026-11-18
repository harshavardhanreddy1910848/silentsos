"""
SilentSOS Web Application Page Object Model (POM) Definitions.
Defines page elements and locators for Selenium WebDriver E2E testing.
"""

from selenium.webdriver.common.by import By

class WebBasePage:
    def __init__(self, driver, base_url="http://localhost:5173"):
        self.driver = driver
        self.base_url = base_url

    def open(self, path=""):
        if self.driver:
            self.driver.get(f"{self.base_url}{path}")

class WebAuthPage(WebBasePage):
    EMAIL_INPUT = (By.ID, "email")
    PASSWORD_INPUT = (By.ID, "password")
    CONFIRM_PASSWORD_INPUT = (By.ID, "confirmPassword")
    SUBMIT_BUTTON = (By.CSS_SELECTOR, "button[type='submit']")
    TOGGLE_REGISTER_BTN = (By.XPATH, "//button[contains(text(), 'Sign Up')]")
    TOGGLE_LOGIN_BTN = (By.XPATH, "//button[contains(text(), 'Sign In')]")
    FORGOT_PASSWORD_BTN = (By.XPATH, "//button[contains(text(), 'Forgot')]")
    PIN_INPUT = (By.ID, "securityPin")

class WebDashboardPage(WebBasePage):
    SOS_HOLD_BUTTON = (By.CSS_SELECTOR, "[data-testid='sos-hold-button']")
    STEALTH_TOGGLE = (By.CSS_SELECTOR, "[data-testid='stealth-toggle']")
    MEDICAL_CRISIS_BTN = (By.CSS_SELECTOR, "[data-testid='dispatch-medical']")
    FIRE_CRISIS_BTN = (By.CSS_SELECTOR, "[data-testid='dispatch-fire']")
    POLICE_CRISIS_BTN = (By.CSS_SELECTOR, "[data-testid='dispatch-police']")
    DANGER_CRISIS_BTN = (By.CSS_SELECTOR, "[data-testid='dispatch-danger']")
    GPS_LAT_LABEL = (By.ID, "telemetry-lat")
    GPS_LNG_LABEL = (By.ID, "telemetry-lng")
    NAV_GESTURES = (By.CSS_SELECTOR, "a[href='/gestures']")
    NAV_EVIDENCE = (By.CSS_SELECTOR, "a[href='/evidence']")
    NAV_CONTACTS = (By.CSS_SELECTOR, "a[href='/contacts']")
    NAV_HISTORY = (By.CSS_SELECTOR, "a[href='/history']")
    NAV_SETTINGS = (By.CSS_SELECTOR, "a[href='/settings']")
    NAV_AI_ASSISTANT = (By.CSS_SELECTOR, "a[href='/ai-assistant']")

class WebGesturesPage(WebBasePage):
    PALM_CARD = (By.CSS_SELECTOR, "[data-testid='gesture-palm']")
    BLINK_CARD = (By.CSS_SELECTOR, "[data-testid='gesture-blink']")
    BOTH_CARD = (By.CSS_SELECTOR, "[data-testid='gesture-both']")
    SIMULATE_TRIGGER_BTN = (By.CSS_SELECTOR, "[data-testid='simulate-trigger']")
    CANCEL_COUNTDOWN_BTN = (By.CSS_SELECTOR, "[data-testid='cancel-gesture']")

class WebReceiverPage(WebBasePage):
    LIVE_MAP_CONTAINER = (By.ID, "receiver-map")
    TELEMETRY_LAT = (By.ID, "receiver-lat")
    TELEMETRY_LNG = (By.ID, "receiver-lng")
    ALERT_STATUS_BADGE = (By.ID, "receiver-status")
    RESOLVE_BUTTON = (By.ID, "btn-resolve-alert")

class WebAiAssistantPage(WebBasePage):
    CHAT_INPUT = (By.CSS_SELECTOR, "textarea, input[placeholder*='Ask']")
    SEND_BUTTON = (By.CSS_SELECTOR, "button[type='submit']")
    MESSAGES_LIST = (By.CSS_SELECTOR, "[data-testid='message-bubble']")
    SUGGESTION_CHIPS = (By.CSS_SELECTOR, "[data-testid='suggestion-chip']")

class WebAdminPage(WebBasePage):
    TAB_DASHBOARD = (By.XPATH, "//button[contains(text(), 'Dashboard')]")
    TAB_ALERTS = (By.XPATH, "//button[contains(text(), 'Alerts')]")
    TAB_USERS = (By.XPATH, "//button[contains(text(), 'Users')]")
    TAB_FEEDBACK = (By.XPATH, "//button[contains(text(), 'Feedback')]")
    TAB_SETTINGS = (By.XPATH, "//button[contains(text(), 'Settings')]")
    RESOLVE_ALERT_BTN = (By.CSS_SELECTOR, "[data-testid='admin-resolve-alert']")
    USERS_TABLE = (By.ID, "admin-users-table")

