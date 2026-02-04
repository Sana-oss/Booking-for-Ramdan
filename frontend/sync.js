/**
 * Multi-tab synchronization utilities
 */
class Sync {
  constructor() {
    this.keys = CONSTANTS.STORAGE_KEYS;
    this.types = CONSTANTS.SYNC_TYPES;
    this.tabId = Date.now() + '-' + Math.random().toString(36).slice(2);
    this.channel = null;
    this.isInitialized = false;
  }

  /**
   * Initializes synchronization
   */
  init() {
    if (this.isInitialized) return;
    this.isInitialized = true;

    this.setupBroadcastChannel();
    this.setupStorageListener();
    this.setupLanguageSync();
    this.setupBeforeUnload();
  }

  /**
   * Sets up BroadcastChannel or localStorage fallback
   */
  setupBroadcastChannel() {
    if ('BroadcastChannel' in window) {
      this.channel = new BroadcastChannel(this.keys.SYNC_CHANNEL);
      this.channel.onmessage = (event) => this.handleMessage(event.data);
    } else {
      window.addEventListener('storage', (event) => {
        if (event.key === this.keys.SYNC_CHANNEL && event.newValue) {
          try {
            const data = JSON.parse(event.newValue);
            this.handleMessage(data);
          } catch (error) {
            console.error('Error parsing sync message:', error);
          }
        }
      });
    }
  }

  /**
   * Sets up storage event listener for language changes
   */
  setupStorageListener() {
    window.addEventListener('storage', (event) => {
      if (event.key === this.keys.LANG && event.newValue) {
        if (currentLang() !== event.newValue) {
          setLang(event.newValue);
        }
        this.broadcast({ type: this.types.LANGUAGE, lang: event.newValue });
      }
    });
  }

  /**
   * Sets up language toggle synchronization
   */
  setupLanguageSync() {
    const langBtn = document.getElementById(CONSTANTS.SELECTORS.LANG_TOGGLE);
    if (langBtn) {
      langBtn.addEventListener('click', () => {
        setTimeout(() => {
          this.broadcast({ type: this.types.LANGUAGE, lang: currentLang() });
        }, CONSTANTS.VALIDATION.LANG_CHANGE_DELAY_MS);
      });
    }
  }

  /**
   * Sets up beforeunload cleanup
   */
  setupBeforeUnload() {
    window.addEventListener('beforeunload', () => {
      if (this.channel) {
        this.channel.close();
      }
    });
  }

  /**
   * Handles incoming synchronization messages
   * @param {Object} message - Message object
   */
  handleMessage(message) {
    if (!message || message.tabId === this.tabId) return;

    switch (message.type) {
      case this.types.LANGUAGE:
        if (typeof setLang === 'function' && currentLang() !== message.lang) {
          setLang(message.lang);
        }
        break;

      case this.types.FORM_DRAFT:
        this.handleFormDraft(message.payload);
        break;

      case this.types.BOOKING_SUBMITTED:
        this.handleBookingSubmitted();
        break;

      case this.types.LOGOUT:
        this.handleLogout();
        break;
    }
  }

  /**
   * Handles form draft synchronization
   * @param {Object} payload - Draft payload
   */
  handleFormDraft(payload) {
    if (!document.getElementById(CONSTANTS.SELECTORS.BOOKING_FORM)) return;

    // Avoid stomping while user is actively typing
    const activeElement = document.activeElement;
    if (activeElement && (activeElement.tagName === 'INPUT' || activeElement.tagName === 'TEXTAREA')) {
      return;
    }

    const selectors = CONSTANTS.SELECTORS;
    const nameInput = document.getElementById(selectors.NAME_INPUT);
    const phoneInput = document.getElementById(selectors.PHONE_INPUT);
    const dateInput = document.getElementById(selectors.DATE_INPUT);
    const peopleInput = document.getElementById(selectors.PEOPLE_INPUT);
    const groupCheckbox = document.getElementById(selectors.GROUP_CHECKBOX);

    if (nameInput) nameInput.value = payload.name || nameInput.value;
    if (phoneInput) phoneInput.value = payload.phone || phoneInput.value;
    if (dateInput) dateInput.value = payload.date || dateInput.value;
    if (peopleInput) peopleInput.value = payload.people || peopleInput.value;
    if (groupCheckbox) groupCheckbox.checked = !!payload.group;

    // Update group state if needed
    if (typeof updateGroupState === 'function') {
      updateGroupState();
    }
  }

  /**
   * Handles booking submitted notification
   */
  handleBookingSubmitted() {
    if (!/success\.html$/.test(location.pathname)) {
      this.showNotification(CONSTANTS.MESSAGES.NEW_BOOKING_NOTIFICATION);
    }
  }

  /**
   * Handles logout synchronization
   */
  handleLogout() {
    if (location.pathname.endsWith('admin-dashboard.html')) {
      window.location.href = 'admin-login.html';
    }
  }

  /**
   * Broadcasts message to other tabs
   * @param {Object} message - Message to broadcast
   */
  broadcast(message) {
    message.tabId = this.tabId;
    message.ts = Date.now();

    try {
      if (this.channel) {
        this.channel.postMessage(message);
      } else {
        localStorage.setItem(this.keys.SYNC_CHANNEL, JSON.stringify(message));
      }
    } catch (error) {
      console.error('Error broadcasting message:', error);
    }
  }

  /**
   * Shows transient notification
   * @param {string} text - Notification text
   */
  showNotification(text) {
    try {
      const notification = document.createElement('div');
      notification.textContent = text;
      Object.assign(notification.style, CONSTANTS.NOTIFICATION_STYLES);
      document.body.appendChild(notification);

      setTimeout(() => {
        notification.style.transition = 'opacity 0.3s';
        notification.style.opacity = '0';
      }, 2200);

      setTimeout(() => {
        notification.remove();
      }, 2600);
    } catch (error) {
      console.error('Error showing notification:', error);
    }
  }

  /**
   * Sets up form draft autosave
   */
  setupDraftAutosave() {
    if (!document.getElementById(CONSTANTS.SELECTORS.BOOKING_FORM)) return;

    const getFormDraft = () => ({
      name: document.getElementById(CONSTANTS.SELECTORS.NAME_INPUT)?.value || '',
      phone: document.getElementById(CONSTANTS.SELECTORS.PHONE_INPUT)?.value || '',
      date: document.getElementById(CONSTANTS.SELECTORS.DATE_INPUT)?.value || '',
      people: document.getElementById(CONSTANTS.SELECTORS.PEOPLE_INPUT)?.value || '',
      group: document.getElementById(CONSTANTS.SELECTORS.GROUP_CHECKBOX)?.checked || false
    });

    let draftTimer = null;
    const sendDraft = () => {
      const payload = getFormDraft();
      storage.saveDraft(payload);
      this.broadcast({ type: this.types.FORM_DRAFT, payload });
    };

    const inputs = [
      CONSTANTS.SELECTORS.NAME_INPUT,
      CONSTANTS.SELECTORS.PHONE_INPUT,
      CONSTANTS.SELECTORS.DATE_INPUT,
      CONSTANTS.SELECTORS.PEOPLE_INPUT,
      CONSTANTS.SELECTORS.GROUP_CHECKBOX
    ];

    inputs.forEach(selector => {
      const element = document.getElementById(selector);
      if (!element) return;

      ['input', 'change'].forEach(eventType => {
        element.addEventListener(eventType, () => {
          clearTimeout(draftTimer);
          draftTimer = setTimeout(sendDraft, CONSTANTS.VALIDATION.DRAFT_DEBOUNCE_MS);
        });
      });
    });
  }

  /**
   * Restores form draft on page load
   */
  restoreDraft() {
    const draft = storage.getDraft();
    if (!draft?.payload) return;

    const payload = draft.payload;
    const selectors = CONSTANTS.SELECTORS;

    const nameInput = document.getElementById(selectors.NAME_INPUT);
    const phoneInput = document.getElementById(selectors.PHONE_INPUT);
    const dateInput = document.getElementById(selectors.DATE_INPUT);
    const peopleInput = document.getElementById(selectors.PEOPLE_INPUT);
    const groupCheckbox = document.getElementById(selectors.GROUP_CHECKBOX);

    if (nameInput) nameInput.value = payload.name || nameInput.value;
    if (phoneInput) phoneInput.value = payload.phone || phoneInput.value;
    if (dateInput) dateInput.value = payload.date || dateInput.value;
    if (peopleInput) peopleInput.value = payload.people || peopleInput.value;
    if (groupCheckbox) groupCheckbox.checked = !!payload.group;

    // Update group state if needed
    if (typeof updateGroupState === 'function') {
      updateGroupState();
    }
  }
}

// Export for use in other modules
const sync = new Sync();
