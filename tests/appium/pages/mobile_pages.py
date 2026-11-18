"""
SilentSOS Mobile Application Page Object Model (POM) Base and Screen Definitions.
Provides robust element locators matching the Android XML layout IDs and Appium selectors.
"""

class BasePage:
    def __init__(self, driver=None):
        self.driver = driver

    def find(self, locator):
        if self.driver:
            return self.driver.find_element(*locator)
        return None

class AuthPage(BasePage):
    EMAIL_INPUT = ("id", "com.silentsos.app.debug:id/etEmail")
    PASSWORD_INPUT = ("id", "com.silentsos.app.debug:id/etPassword")
    SUBMIT_BUTTON = ("id", "com.silentsos.app.debug:id/btnSubmit")
    REGISTER_TAB = ("id", "com.silentsos.app.debug:id/tabRegister")
    LOGIN_TAB = ("id", "com.silentsos.app.debug:id/tabLogin")
    FORGOT_PASSWORD_LINK = ("id", "com.silentsos.app.debug:id/tvForgotPassword")
    ADMIN_LOGIN_LINK = ("id", "com.silentsos.app.debug:id/tvAdminLoginLink")

class SosHubPage(BasePage):
    SOS_BUTTON = ("id", "com.silentsos.app.debug:id/btnSosContainer")
    SOS_HOLD_PROGRESS = ("id", "com.silentsos.app.debug:id/pbSosHoldProgress")
    STEALTH_TOGGLE = ("id", "com.silentsos.app.debug:id/btnToggleStealth")
    DISPATCH_MEDICAL = ("id", "com.silentsos.app.debug:id/btnDispatchMedical")
    DISPATCH_FIRE = ("id", "com.silentsos.app.debug:id/btnDispatchFire")
    DISPATCH_POLICE = ("id", "com.silentsos.app.debug:id/btnDispatchPolice")
    DISPATCH_DANGER = ("id", "com.silentsos.app.debug:id/btnDispatchDanger")
    PHOTO_BURST_CARD = ("id", "com.silentsos.app.debug:id/btnQuickPhoto")
    VIDEO_LOOP_CARD = ("id", "com.silentsos.app.debug:id/btnQuickVideo")
    SURVEILLANCE_AUDIO_CARD = ("id", "com.silentsos.app.debug:id/btnQuickAudio")

class GesturesPage(BasePage):
    PALM_MODE = ("id", "com.silentsos.app.debug:id/btnModePalm")
    BLINK_MODE = ("id", "com.silentsos.app.debug:id/btnModeBlink")
    BOTH_MODE = ("id", "com.silentsos.app.debug:id/btnModeBoth")
    DETECT_STATUS = ("id", "com.silentsos.app.debug:id/tvGestureDetectStatus")
    SIMULATE_BUTTON = ("id", "com.silentsos.app.debug:id/tvTriggerSimulation")
    CANCEL_ALERT = ("id", "com.silentsos.app.debug:id/btnCancelGestureAlert")

class EvidencePage(BasePage):
    PHOTOS_COUNT = ("id", "com.silentsos.app.debug:id/tvEvPhotosCount")
    VIDEOS_COUNT = ("id", "com.silentsos.app.debug:id/tvEvVideosCount")
    AUDIO_COUNT = ("id", "com.silentsos.app.debug:id/tvEvAudioCount")
    GPS_COUNT = ("id", "com.silentsos.app.debug:id/tvEvGpsCount")
    EVIDENCE_RECYCLER = ("id", "com.silentsos.app.debug:id/rvEvidenceList")

class ContactsPage(BasePage):
    ADD_CONTACT_BUTTON = ("id", "com.silentsos.app.debug:id/btnAddContact")
    CONTACTS_RECYCLER = ("id", "com.silentsos.app.debug:id/rvContactsList")
    CONTACT_NAME = ("id", "com.silentsos.app.debug:id/tvContactName")
    CONTACT_PHONE = ("id", "com.silentsos.app.debug:id/tvContactPhone")

class SettingsPage(BasePage):
    PROFILE_CARD = ("id", "com.silentsos.app.debug:id/cardProfileBanner")
    AI_ASSISTANT_CARD = ("id", "com.silentsos.app.debug:id/cardAiAssistant")
    SAFETY_PIN_BUTTON = ("id", "com.silentsos.app.debug:id/btnChangePin")
    STEALTH_SWITCH = ("id", "com.silentsos.app.debug:id/switchStealthMode")
    LOGOUT_BUTTON = ("id", "com.silentsos.app.debug:id/btnLogout")

class AiAssistantPage(BasePage):
    INPUT_EDIT_TEXT = ("id", "com.silentsos.app.debug:id/etAiInput")
    SEND_BUTTON = ("id", "com.silentsos.app.debug:id/btnAiSend")
    MESSAGE_CONTAINER = ("id", "com.silentsos.app.debug:id/llAiMessageContainer")
    SUGGESTIONS_CONTAINER = ("id", "com.silentsos.app.debug:id/llAiSuggestions")

