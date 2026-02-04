/**
 * CORINTHIA HOTEL - ADVANCED VALIDATION ENGINE
 * Comprehensive security & business logic validation with phone-first approach
 */

const validation = {
    // ============================================
    // CONFIGURATION
    // ============================================
    CONFIG: {
        PHONE: {
            MIN_LENGTH: 10,
            MAX_LENGTH: 15,
            REGEX: /^(\+218|218|0)?(9[1-9]\d{7}|[1-9]\d{8})$/
        },
        NAME: {
            MIN_LENGTH: 3,
            MAX_LENGTH: 100
        },
        GUESTS: {
            MIN: 1,
            MAX: 50
        }
    },

    // ============================================
    // ADVANCED PHONE VALIDATION
    // ============================================
    validatePhone: function(phone) {
        if (!phone || typeof phone !== 'string') {
            return { valid: false, error: 'رقم الهاتف مطلوب' };
        }

        // Clean phone number
        const cleaned = phone.trim().replace(/[\s\-\(\)\.]/g, '');
        
        // Length validation
        if (cleaned.length < this.CONFIG.PHONE.MIN_LENGTH || 
            cleaned.length > this.CONFIG.PHONE.MAX_LENGTH) {
            return { 
                valid: false, 
                error: `رقم الهاتف يجب أن يكون بين ${this.CONFIG.PHONE.MIN_LENGTH} و ${this.CONFIG.PHONE.MAX_LENGTH} أرقام` 
            };
        }

        // Format validation (Libyan & International)
        if (!this.CONFIG.PHONE.REGEX.test(cleaned)) {
            return { 
                valid: false, 
                error: 'صيغة رقم الهاتف غير صحيحة. مثال: 0912345678' 
            };
        }

        return { valid: true, cleaned: cleaned };
    },

    // ============================================
    // NAME VALIDATION WITH SANITIZATION
    // ============================================
    validateName: function(name) {
        if (!name || typeof name !== 'string') {
            return { valid: false, error: 'اسم الضيف مطلوب' };
        }

        // Sanitize: trim and remove extra whitespace
        const sanitized = name.trim().replace(/\s+/g, ' ');
        
        if (sanitized.length < this.CONFIG.NAME.MIN_LENGTH) {
            return { 
                valid: false, 
                error: `الاسم يجب أن يكون ${this.CONFIG.NAME.MIN_LENGTH} أحرف على الأقل` 
            };
        }

        if (sanitized.length > this.CONFIG.NAME.MAX_LENGTH) {
            return { 
                valid: false, 
                error: 'الاسم طويل جداً' 
            };
        }

        // Check for suspicious characters (XSS prevention)
        const suspiciousChars = /[<>{}()\[\];#$%^*+=|<>]/;
        if (suspiciousChars.test(sanitized)) {
            return { 
                valid: false, 
                error: 'الاسم يحتوي على رموز غير مسموحة' 
            };
        }

        return { valid: true, sanitized: sanitized };
    },

    // ============================================
    // DATE VALIDATION (No past dates)
    // ============================================
    validateDate: function(dateStr) {
        if (!dateStr) {
            return { valid: false, error: 'تاريخ الحجز مطلوب' };
        }

        const bookingDate = new Date(dateStr);
        const today = new Date();
        
        // Reset time for accurate comparison
        today.setHours(0, 0, 0, 0);
        bookingDate.setHours(0, 0, 0, 0);

        if (isNaN(bookingDate.getTime())) {
            return { valid: false, error: 'صيغة التاريخ غير صحيحة' };
        }

        if (bookingDate < today) {
            return { valid: false, error: 'لا يمكن حجز تواريخ سابقة' };
        }

        // Check max booking horizon (6 months)
        const maxDate = new Date();
        maxDate.setMonth(maxDate.getMonth() + 6);
        if (bookingDate > maxDate) {
            return { valid: false, error: 'لا يمكن حجز أكثر من 6 أشهر مسبقاً' };
        }

        return { valid: true, date: bookingDate };
    },

    // ============================================
    // GUESTS VALIDATION
    // ============================================
    validateGuests: function(guests) {
        const num = parseInt(guests);
        
        if (isNaN(num) || num < this.CONFIG.GUESTS.MIN) {
            return { valid: false, error: `عدد الضيوف يجب أن يكون ${this.CONFIG.GUESTS.MIN} على الأقل` };
        }
        
        if (num > this.CONFIG.GUESTS.MAX) {
            return { valid: false, error: `عدد الضيوف لا يمكن أن يتجاوز ${this.CONFIG.GUESTS.MAX}` };
        }
        
        return { valid: true, guests: num };
    },

    // ============================================
    // COMPREHENSIVE VALIDATION
    // ============================================
    validateAll: function() {
        const data = ui.getFormData();
        if (!data) return false;

        this.clearErrors();

        // 1. Validate Name
        const nameResult = this.validateName(data.name);
        if (!nameResult.valid) {
            this.showError('name', nameResult.error);
            return false;
        }

        // 2. Validate Phone
        const phoneResult = this.validatePhone(data.phone);
        if (!phoneResult.valid) {
            this.showError('phone', phoneResult.error);
            return false;
        }

        // 3. Validate Date
        const dateResult = this.validateDate(data.date);
        if (!dateResult.valid) {
            this.showError('date', dateResult.error);
            return false;
        }

        // 4. Validate Guests
        const guestsResult = this.validateGuests(data.guests);
        if (!guestsResult.valid) {
            this.showError('guests', guestsResult.error);
            return false;
        }

        return true;
    },

    // ============================================
    // ERROR HANDLING
    // ============================================
    showError: function(fieldId, errorMessage) {
        const el = document.getElementById(fieldId);
        if (el) {
            el.style.borderColor = "#e74c3c";
            el.focus();
        }
        
        // Show alert with the specific error
        alert(errorMessage);
    },

    clearErrors: function() {
        const fields = ['name', 'phone', 'date', 'guests'];
        fields.forEach(id => {
            const el = document.getElementById(id);
            if (el) el.style.borderColor = "";
        });
    },

    // ============================================
    // REAL-TIME INPUT MASKING
    // ============================================
    init: function() {
        const phoneInput = document.getElementById('phone');
        if (phoneInput) {
            phoneInput.addEventListener('input', (e) => {
                // Allow only numbers, +, and some special chars for international format
                e.target.value = e.target.value
                    .replace(/[^0-9+\s\-()]/g, '')
                    .slice(0, 15);
            });
        }
        
        // Add input masking for name field
        const nameInput = document.getElementById('name');
        if (nameInput) {
            nameInput.addEventListener('input', (e) => {
                // Remove any suspicious characters
                e.target.value = e.target.value
                    .replace(/[<>{}()\[\];#$%^*+=|<>]/g, '')
                    .trim();
            });
        }
    }
};

// Run validation initialization
document.addEventListener('DOMContentLoaded', () => validation.init());