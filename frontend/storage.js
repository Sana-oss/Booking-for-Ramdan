/**
 * Local Storage Manager for Corinthia Booking System
 * Handles data persistence with localStorage
 */

class Storage {
    constructor() {
        this.keys = {
            BOOKINGS: 'corinthia_bookings',
            ADMIN: 'corinthia_admin',
            LANGUAGE: 'corinthia_language'
        };
    }

    /**
     * Gets bookings from localStorage
     * @returns {Array} - Array of bookings
     */
    getBookings() {
        try {
            const data = localStorage.getItem(this.keys.BOOKINGS);
            return data ? JSON.parse(data) : [];
        } catch (error) {
            console.error('Error reading bookings:', error);
            return [];
        }
    }

    /**
     * Saves bookings to localStorage
     * @param {Array} bookings - Array of bookings
     */
    saveBookings(bookings) {
        try {
            localStorage.setItem(this.keys.BOOKINGS, JSON.stringify(bookings));
        } catch (error) {
            console.error('Error saving bookings:', error);
        }
    }

    hasDuplicateBooking(phone, date) {
        const bookings = this.getBookings();
        const normalizedPhone = this.normalizePhone(phone);

        return bookings.some(booking => {
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
    }

    addBooking(bookingData) {
        const bookings = this.getBookings();
        const newId = Date.now();
        
        const newBooking = {
            id: newId,
            ...bookingData,
            status: 'Pending',
            createdAt: new Date().toISOString()
        };

        // Add to beginning of array (newest first)
        bookings.unshift(newBooking);
        this.saveBookings(bookings);

        return newBooking;
    }

    updateBookingStatus(id, status) {
        const bookings = this.getBookings();
        const bookingIndex = bookings.findIndex(b => b.id === parseInt(id));
        
        if (bookingIndex !== -1) {
            bookings[bookingIndex].status = status;
            bookings[bookingIndex].updatedAt = new Date().toISOString();
            this.saveBookings(bookings);
            return true;
        }
        return false;
    }

    deleteBooking(id) {
        const bookings = this.getBookings();
        const filteredBookings = bookings.filter(b => b.id !== parseInt(id));
        
        if (filteredBookings.length !== bookings.length) {
            this.saveBookings(filteredBookings);
            return true;
        }
        return false;
    }

    normalizePhone(phone) {
        return phone.replace(/\D/g, '');
    }

    // Admin methods
    getAdmin() {
        try {
            const data = localStorage.getItem(this.keys.ADMIN);
            return data ? JSON.parse(data) : null;
        } catch (error) {
            console.error('Error reading admin:', error);
            return null;
        }
    }

    saveAdmin(adminData) {
        try {
            localStorage.setItem(this.keys.ADMIN, JSON.stringify(adminData));
        } catch (error) {
            console.error('Error saving admin:', error);
        }
    }

    clearAdmin() {
        localStorage.removeItem(this.keys.ADMIN);
    }

    // Language methods
    getLanguage() {
        return localStorage.getItem(this.keys.LANGUAGE) || 'ar';
    }

    setLanguage(lang) {
        localStorage.setItem(this.keys.LANGUAGE, lang);
    }
}

// Create global instance
const storage = new Storage();
