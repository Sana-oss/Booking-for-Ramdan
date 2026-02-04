/**
 * API Integration Layer for Corinthia Booking System
 * Handles communication with backend API
 */

class StorageAPI {
    constructor() {
        this.baseUrl = 'http://localhost:5000/api';
    }

    /**
     * Makes API request with proper headers
     * @param {string} endpoint - API endpoint
     * @param {Object} options - Fetch options
     * @returns {Object} - API response
     */
    async apiRequest(endpoint, options = {}) {
        const url = `${this.baseUrl}${endpoint}`;
        
        const defaultHeaders = {
            'Content-Type': 'application/json',
        };

        // Add auth token if available
        const admin = storage.getAdmin();
        if (admin && admin.token) {
            defaultHeaders['Authorization'] = `Bearer ${admin.token}`;
        }

        try {
            const response = await fetch(url, {
                ...options,
                headers: {
                    ...defaultHeaders,
                    ...options.headers
                }
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.message || `HTTP error! status: ${response.status}`);
            }

            return { success: true, ...data };
        } catch (error) {
            console.error(`API request failed: ${endpoint}`, error);
            return { success: false, message: error.message };
        }
    }

    /**
     * Gets bookings from API or localStorage fallback
     * @returns {Array} - Array of bookings
     */
    async getBookings() {
        // Try API first
        const apiResult = await this.apiRequest('/bookings');
        if (apiResult.success) {
            console.log('Loaded bookings from API:', apiResult.data.bookings?.length || 0);
            return apiResult.data.bookings || [];
        }

        // Fallback to localStorage
        console.log('Using localStorage fallback for bookings');
        return this.getBookingsLocal();
    }

    /**
     * Get bookings from localStorage only
     */
    getBookingsLocal() {
        try {
            const data = localStorage.getItem('corinthia_bookings');
            const bookings = data ? JSON.parse(data) : [];
            console.log('Loaded bookings from localStorage:', bookings.length);
            return bookings;
        } catch (error) {
            console.error('Error reading local bookings:', error);
            return [];
        }
    }

    /**
     * Saves bookings to API or localStorage fallback
     * @param {Array} bookings - Array of bookings
     */
    async saveBookings(bookings) {
        // Note: This method is mainly for localStorage compatibility
        // API operations are handled individually
        console.log('Saving bookings to localStorage:', bookings.length);
        this.saveBookingsLocal(bookings);
    }

    /**
     * Save bookings to localStorage only
     */
    saveBookingsLocal(bookings) {
        try {
            localStorage.setItem('corinthia_bookings', JSON.stringify(bookings));
            console.log('Saved bookings to localStorage');
        } catch (error) {
            console.error('Error saving local bookings:', error);
        }
    }

    /**
     * Check for duplicate booking via API
     * @param {string} phone - Phone number
     * @param {string} date - Booking date
     */
    async checkDuplicateBooking(phone, date) {
        // Try API first
        const apiResult = await this.apiRequest(`/bookings/check/${encodeURIComponent(phone)}/${date}`);
        if (apiResult.success) {
            return apiResult;
        }

        // Fallback to localStorage
        return this.hasDuplicateBookingLocal(phone, date);
    }

    hasDuplicateBookingLocal(phone, date) {
        const bookings = this.getBookingsLocal();
        const normalizedPhone = this.normalizePhone(phone);

        const hasDuplicate = bookings.some(booking => {
            if (!booking) return false;
            
            const bookingDate = new Date(booking.date);
            const requestedDate = new Date(date);
            
            // Normalize dates to midnight for comparison
            bookingDate.setHours(0, 0, 0, 0);
            requestedDate.setHours(0, 0, 0, 0);
            
            return this.normalizePhone(booking.phone) === normalizedPhone && 
                   bookingDate.getTime() === requestedDate.getTime() &&
                   booking.status !== 'Cancelled';
        });

        return { success: true, exists: hasDuplicate };
    }

    /**
     * Create new booking
     * @param {Object} bookingData - Booking data
     */
    async createBooking(bookingData) {
        // Try API first
        const apiResult = await this.apiRequest('/bookings', {
            method: 'POST',
            body: JSON.stringify(bookingData)
        });

        if (apiResult.success) {
            console.log('✅ Booking created successfully via API');
            return apiResult;
        }

        // Fallback to localStorage
        console.log('Using localStorage fallback for booking creation');
        return this.createBookingLocal(bookingData);
    }

    createBookingLocal(bookingData) {
        try {
            const bookings = this.getBookingsLocal();
            const newBooking = {
                id: Date.now(),
                ...bookingData,
                status: 'Pending',
                createdAt: new Date().toISOString()
            };

            // Add to beginning of array (newest first)
            bookings.unshift(newBooking);
            this.saveBookingsLocal(bookings);

            console.log('✅ Booking created in localStorage');
            return { success: true, data: newBooking };
        } catch (error) {
            console.error('❌ Error creating booking locally:', error);
            return { success: false, message: error.message };
        }
    }

    /**
     * Update booking status
     * @param {number} id - Booking ID
     * @param {string} status - New status
     */
    async updateBookingStatus(id, status) {
        // Try API first
        const apiResult = await this.apiRequest(`/bookings/${id}`, {
            method: 'PUT',
            body: JSON.stringify({ status })
        });

        if (apiResult.success) {
            console.log(`✅ Updated booking ${id} status to ${status}`);
            return apiResult;
        }

        // Fallback to localStorage
        console.log('Using localStorage fallback for booking update');
        return this.updateBookingStatusLocal(id, status);
    }

    updateBookingStatusLocal(id, status) {
        try {
            const bookings = this.getBookingsLocal();
            const bookingIndex = bookings.findIndex(b => b.id === parseInt(id));
            
            if (bookingIndex !== -1) {
                bookings[bookingIndex].status = status;
                bookings[bookingIndex].updatedAt = new Date().toISOString();
                this.saveBookingsLocal(bookings);
                console.log(`✅ Updated booking ${id} status in localStorage`);
                return { success: true, data: bookings[bookingIndex] };
            } else {
                return { success: false, message: 'Booking not found' };
            }
        } catch (error) {
            console.error('❌ Error updating booking locally:', error);
            return { success: false, message: error.message };
        }
    }

    /**
     * Delete booking
     * @param {number} id - Booking ID
     */
    async deleteBooking(id) {
        // Try API first
        const apiResult = await this.apiRequest(`/bookings/${id}`, {
            method: 'DELETE'
        });

        if (apiResult.success) {
            console.log(`✅ Deleted booking ${id} via API`);
            return apiResult;
        }

        // Fallback to localStorage
        console.log('Using localStorage fallback for booking deletion');
        return this.deleteBookingLocal(id);
    }

    deleteBookingLocal(id) {
        try {
            const bookings = this.getBookingsLocal();
            const filteredBookings = bookings.filter(b => b.id !== parseInt(id));
            
            if (filteredBookings.length !== bookings.length) {
                this.saveBookingsLocal(filteredBookings);
                console.log(`✅ Deleted booking ${id} from localStorage`);
                return { success: true };
            } else {
                return { success: false, message: 'Booking not found' };
            }
        } catch (error) {
            console.error('❌ Error deleting booking locally:', error);
            return { success: false, message: error.message };
        }
    }

    normalizePhone(phone) {
        return phone.replace(/\D/g, '');
    }

    // Admin Authentication Methods
    async login(username, password) {
        const result = await this.apiRequest('/auth/login', {
            method: 'POST',
            body: JSON.stringify({ username, password })
        });

        if (result.success) {
            // Save admin data
            storage.saveAdmin({
                username: result.username,
                token: result.token
            });
        }

        return result;
    }

    async logout() {
        await this.apiRequest('/auth/logout', { method: 'POST' });
        storage.clearAdmin();
    }

    isLoggedIn() {
        const admin = storage.getAdmin();
        return !!admin && admin.token;
    }

    getAuthToken() {
        const admin = storage.getAdmin();
        return admin ? admin.token : null;
    }
}

// Create global instance
const storageAPI = new StorageAPI();
