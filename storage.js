/**
 * Local storage management utilities
 */
class Storage {
  constructor() {
    this.keys = CONSTANTS.STORAGE_KEYS;
    this.status = CONSTANTS.STATUS;
  }

  /**
   * Gets reservations from localStorage
   * @returns {Array} - Array of reservations
   */
  getReservations() {
    try {
      const data = localStorage.getItem(this.keys.RESERVATIONS);
      return data ? JSON.parse(data) : [];
    } catch (error) {
      console.error('Error reading reservations:', error);
      return [];
    }
  }

  /**
   * Saves reservations to localStorage
   * @param {Array} reservations - Array of reservations
   */
  saveReservations(reservations) {
    try {
      localStorage.setItem(this.keys.RESERVATIONS, JSON.stringify(reservations));
    } catch (error) {
      console.error('Error saving reservations:', error);
    }
  }

  /**
   * Checks for duplicate reservation
   * @param {string} phone - Phone number
   * @param {string} date - Date string
   * @returns {boolean} - True if duplicate exists
   */
  hasDuplicateReservation(phone, date) {
    const reservations = this.getReservations();
    const normalizedPhone = this.normalizePhone(phone);

    return reservations.some(reservation => {
      if (!reservation) return false;
      if (String(reservation.date) !== date) return false;

      const statusText = String(reservation.status || '');
      if (this.status.CANCELLED_PATTERN.test(statusText)) return false;

      return this.normalizePhone(reservation.phone) === normalizedPhone;
    });
  }

  /**
   * Adds a new reservation
   * @param {Object} reservationData - Reservation data
   * @returns {number} - Reservation ID
   */
  addReservation(reservationData) {
    const reservations = this.getReservations();
    const newId = Date.now();

    const newReservation = {
      id: newId,
      name: reservationData.name.trim(),
      phone: reservationData.phone.trim(),
      date: reservationData.date,
      people: reservationData.people,
      group: reservationData.group || false,
      status: this.status.PENDING
    };

    reservations.push(newReservation);
    this.saveReservations(reservations);

    return newId;
  }

  /**
   * Normalizes phone number by removing non-digits
   * @param {string} phone - Phone number
   * @returns {string} - Normalized phone number
   */
  normalizePhone(phone) {
    return String(phone || '').replace(/\D/g, '');
  }

  /**
   * Gets form draft from localStorage
   * @returns {Object|null} - Draft data or null
   */
  getDraft() {
    try {
      const data = localStorage.getItem(this.keys.BOOKING_DRAFT);
      return data ? JSON.parse(data) : null;
    } catch (error) {
      console.error('Error reading draft:', error);
      return null;
    }
  }

  /**
   * Saves form draft to localStorage
   * @param {Object} draftData - Draft data
   */
  saveDraft(draftData) {
    try {
      const data = {
        payload: draftData,
        ts: Date.now()
      };
      localStorage.setItem(this.keys.BOOKING_DRAFT, JSON.stringify(data));
    } catch (error) {
      console.error('Error saving draft:', error);
    }
  }

  /**
   * Clears form draft from localStorage
   */
  clearDraft() {
    try {
      localStorage.removeItem(this.keys.BOOKING_DRAFT);
    } catch (error) {
      console.error('Error clearing draft:', error);
    }
  }

  /**
   * Gets current language from localStorage
   * @returns {string} - Language code
   */
  getLanguage() {
    return localStorage.getItem(this.keys.LANG) || 'ar';
  }

  /**
   * Saves language to localStorage
   * @param {string} lang - Language code
   */
  saveLanguage(lang) {
    try {
      localStorage.setItem(this.keys.LANG, lang);
    } catch (error) {
      console.error('Error saving language:', error);
    }
  }
}

// Export for use in other modules
const storage = new Storage();
