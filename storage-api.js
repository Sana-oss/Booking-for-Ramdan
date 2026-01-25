/**
 * Storage management utilities with API integration and localStorage fallback
 */
class Storage {
  constructor() {
    this.keys = CONSTANTS.STORAGE_KEYS;
    this.status = CONSTANTS.STATUS;
    this.apiBaseUrl = this.getApiBaseUrl();
    this.isOnline = true; // Assume online initially
  }

  /**
   * Get API base URL from config or default to localhost
   */
  getApiBaseUrl() {
    // Check for global CONFIG object first (production)
    if (typeof CONFIG !== 'undefined' && CONFIG.API_BASE_URL) {
      return CONFIG.API_BASE_URL;
    }
    // Default to localhost for development
    return 'http://localhost:5000';
  }

  /**
   * Make API request with error handling
   */
  async apiRequest(endpoint, options = {}) {
    try {
      const url = `${this.apiBaseUrl}/api${endpoint}`;
      console.log('Making API request to:', url);

      const response = await fetch(url, {
        headers: {
          'Content-Type': 'application/json',
          ...options.headers
        },
        ...options
      });

      if (!response.ok) {
        throw new Error(`API request failed: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      this.isOnline = true; // API is working
      console.log('API request successful:', endpoint);
      return { success: true, data };
    } catch (error) {
      console.warn('API request failed, falling back to localStorage:', error.message);
      this.isOnline = false; // API is not available
      return { success: false, error: error.message };
    }
  }

  /**
   * Gets reservations from API or localStorage fallback
   * @returns {Array} - Array of reservations
   */
  async getReservations() {
    // Try API first
    const apiResult = await this.apiRequest('/reservations');
    if (apiResult.success) {
      console.log('Loaded reservations from API:', apiResult.data.reservations?.length || 0);
      return apiResult.data.reservations || [];
    }

    // Fallback to localStorage
    console.log('Using localStorage fallback for reservations');
    return this.getReservationsLocal();
  }

  /**
   * Get reservations from localStorage only
   */
  getReservationsLocal() {
    try {
      const data = localStorage.getItem(this.keys.RESERVATIONS);
      const reservations = data ? JSON.parse(data) : [];
      console.log('Loaded reservations from localStorage:', reservations.length);
      return reservations;
    } catch (error) {
      console.error('Error reading local reservations:', error);
      return [];
    }
  }

  /**
   * Saves reservations to API or localStorage fallback
   * @param {Array} reservations - Array of reservations
   */
  async saveReservations(reservations) {
    // Note: This method is mainly for localStorage compatibility
    // API operations are handled individually
    console.log('Saving reservations to localStorage:', reservations.length);
    this.saveReservationsLocal(reservations);
  }

  /**
   * Save reservations to localStorage only
   */
  saveReservationsLocal(reservations) {
    try {
      localStorage.setItem(this.keys.RESERVATIONS, JSON.stringify(reservations));
      console.log('Saved reservations to localStorage');
    } catch (error) {
      console.error('Error saving local reservations:', error);
    }
  }

  /**
   * Checks for duplicate reservation using API or localStorage
   * @param {string} phone - Phone number
   * @param {string} date - Date string
   * @returns {boolean} - True if duplicate exists
   */
  async hasDuplicateReservation(phone, date) {
    // Try API first
    const apiResult = await this.apiRequest(`/reservations/check/${encodeURIComponent(phone)}/${date}`);
    if (apiResult.success) {
      console.log('Duplicate check via API:', apiResult.data.hasDuplicate);
      return apiResult.data.hasDuplicate || false;
    }

    // Fallback to localStorage
    console.log('Using localStorage fallback for duplicate check');
    return this.hasDuplicateReservationLocal(phone, date);
  }

  /**
   * Check for duplicate in localStorage only
   */
  hasDuplicateReservationLocal(phone, date) {
    const reservations = this.getReservationsLocal();
    const normalizedPhone = this.normalizePhone(phone);

    const hasDuplicate = reservations.some(reservation => {
      if (!reservation) return false;
      if (String(reservation.date) !== date) return false;

      const statusText = String(reservation.status || '');
      if (this.status.CANCELLED_PATTERN.test(statusText)) return false;

      return this.normalizePhone(reservation.phone) === normalizedPhone;
    });

    console.log('Duplicate check in localStorage:', hasDuplicate);
    return hasDuplicate;
  }

  /**
   * Adds a new reservation via API or localStorage fallback
   * @param {Object} reservationData - Reservation data
   * @returns {number} - Reservation ID
   */
  async addReservation(reservationData) {
    console.log('Adding reservation:', reservationData);

    // Try API first
    const apiResult = await this.apiRequest('/reservations', {
      method: 'POST',
      body: JSON.stringify(reservationData)
    });

    if (apiResult.success) {
      console.log('Reservation added via API:', apiResult.data.reservation.id);
      // Sync to localStorage for offline access
      const localReservations = this.getReservationsLocal();
      localReservations.push(apiResult.data.reservation);
      this.saveReservationsLocal(localReservations);

      return apiResult.data.reservation.id;
    }

    // Fallback to localStorage
    console.log('Using localStorage fallback for adding reservation');
    return this.addReservationLocal(reservationData);
  }

  /**
   * Add reservation to localStorage only
   */
  addReservationLocal(reservationData) {
    const reservations = this.getReservationsLocal();
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
    this.saveReservationsLocal(reservations);

    console.log('Reservation added to localStorage:', newId);
    return newId;
  }

  /**
   * Updates reservation status via API
   * @param {number} id - Reservation ID
   * @param {string} status - New status
   * @returns {boolean} - Success status
   */
  async updateReservationStatus(id, status) {
    console.log('Updating reservation status:', id, status);

    const apiResult = await this.apiRequest(`/reservations/${id}`, {
      method: 'PUT',
      body: JSON.stringify({ status })
    });

    if (apiResult.success) {
      console.log('Reservation status updated via API');
      // Update localStorage as well
      const localReservations = this.getReservationsLocal();
      const reservation = localReservations.find(r => r.id === id);
      if (reservation) {
        reservation.status = status;
        this.saveReservationsLocal(localReservations);
      }
      return true;
    }

    console.log('API update failed, status not changed');
    return false;
  }

  /**
   * Deletes reservation via API
   * @param {number} id - Reservation ID
   * @returns {boolean} - Success status
   */
  async deleteReservation(id) {
    console.log('Deleting reservation:', id);

    const apiResult = await this.apiRequest(`/reservations/${id}`, {
      method: 'DELETE'
    });

    if (apiResult.success) {
      console.log('Reservation deleted via API');
      // Remove from localStorage as well
      const localReservations = this.getReservationsLocal();
      const filtered = localReservations.filter(r => r.id !== id);
      this.saveReservationsLocal(filtered);
      return true;
    }

    console.log('API delete failed, reservation not removed');
    return false;
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

  /**
   * Check if API is available
   * @returns {boolean} - True if API is online
   */
  isApiOnline() {
    return this.isOnline;
  }
}

// Export for use in other modules
const storage = new Storage();
