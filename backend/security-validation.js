/**
 * CORINTHIA HOTEL - ADVANCED SECURITY & VALIDATION LAYER
 * Comprehensive protection against NoSQL Injection, XSS, and business logic enforcement
 */

const mongoose = require('mongoose');

// Booking model will be injected from server.js
let Booking;

// ============================================
// CONFIGURATION CONSTANTS
// ============================================

const CONFIG = {
    BOOKING: {
        MAX_DAILY_BOOKINGS: 50,
        PHONE_MIN_LENGTH: 10,
        PHONE_MAX_LENGTH: 15,
        NAME_MIN_LENGTH: 3,
        NAME_MAX_LENGTH: 100,
        GUESTS_MIN: 1,
        GUESTS_MAX: 50
    },
    SECURITY: {
        SANITIZATION: {
            REMOVE_HTML_TAGS: true,
            ESCAPE_SPECIAL_CHARS: true,
            TRIM_WHITESPACE: true
        }
    }
};

// ============================================
// PHONE NUMBER VALIDATION (Robust Regex)
// ============================================

const phoneValidation = {
    validate: function(phone) {
        if (!phone || typeof phone !== 'string') {
            return { valid: false, error: 'Phone number is required' };
        }

        const cleaned = phone.trim().replace(/[\s\-\(\)\.]/g, '');
        
        if (cleaned.length < CONFIG.BOOKING.PHONE_MIN_LENGTH || 
            cleaned.length > CONFIG.BOOKING.PHONE_MAX_LENGTH) {
            return { 
                valid: false, 
                error: `Phone number must be between ${CONFIG.BOOKING.PHONE_MIN_LENGTH} and ${CONFIG.BOOKING.PHONE_MAX_LENGTH} digits` 
            };
        }

        const libyanRegex = /^(\+218|218|0)?(9[1-9]\d{7}|[1-9]\d{8})$/;
        const internationalRegex = /^\+?[1-9]\d{1,14}$/;
        
        if (!libyanRegex.test(cleaned) && !internationalRegex.test(cleaned)) {
            return { 
                valid: false, 
                error: 'Invalid phone number format. Please use a valid Libyan or international format' 
            };
        }

        return { valid: true, cleaned: cleaned };
    },

    sanitize: function(phone) {
        if (!phone) return null;
        return phone.trim().replace(/[^0-9+]/g, '');
    }
};

// ============================================
// NAME VALIDATION & SANITIZATION
// ============================================

const nameValidation = {
    validate: function(name) {
        if (!name || typeof name !== 'string') {
            return { valid: false, error: 'Guest name is required' };
        }

        const trimmed = name.trim();
        
        if (trimmed.length < CONFIG.BOOKING.NAME_MIN_LENGTH) {
            return { 
                valid: false, 
                error: `Name must be at least ${CONFIG.BOOKING.NAME_MIN_LENGTH} characters` 
            };
        }

        if (trimmed.length > CONFIG.BOOKING.NAME_MAX_LENGTH) {
            return { 
                valid: false, 
                error: `Name is too long (maximum ${CONFIG.BOOKING.NAME_MAX_LENGTH} characters)` 
            };
        }

        return { valid: true, trimmed: trimmed };
    },

    sanitize: function(name) {
        if (!name) return null;
        return name.trim().replace(/\s+/g, ' ');
    }
};

// ============================================
// DATE VALIDATION
// ============================================

const dateValidation = {
    validate: function(dateStr) {
        if (!dateStr) {
            return { valid: false, error: 'Booking date is required' };
        }

        const bookingDate = new Date(dateStr);
        
        if (isNaN(bookingDate.getTime())) {
            return { valid: false, error: 'Invalid date format' };
        }

        const today = new Date();
        today.setHours(0, 0, 0, 0);
        bookingDate.setHours(0, 0, 0, 0);

        if (bookingDate < today) {
            return { valid: false, error: 'Cannot book dates that have already passed' };
        }

        const maxDate = new Date();
        maxDate.setMonth(maxDate.getMonth() + 6);
        if (bookingDate > maxDate) {
            return { valid: false, error: 'Cannot book more than 6 months in advance' };
        }

        return { valid: true, date: bookingDate };
    }
};

// ============================================
// NoSQL INJECTION PREVENTION (Fixed)
// ============================================

const nosqlInjectionProtection = {
    dangerousOperators: [
        '$where', '$func', '$eval', '$regex', '$options',
        '$ne', '$not', '$nin', '$or', '$and', '$nor',
        '$exists', '$type', '$mod', '$text', '$search'
    ],

    // Safe characters - preserving JSON structure
    sanitize: function(obj, path = '') {
        if (typeof obj === 'string') {
            let sanitized = obj;
            
            this.dangerousOperators.forEach(op => {
                if (sanitized.toLowerCase().includes(op.toLowerCase())) {
                    throw new Error(`Suspicious pattern detected: ${op}`);
                }
            });

            return sanitized;
        }
        
        if (typeof obj === 'object' && obj !== null) {
            const sanitized = {};
            for (const key in obj) {
                if (this.dangerousOperators.some(op => key.includes(op))) {
                    throw new Error(`Suspicious field name detected: ${key}`);
                }
                sanitized[key] = this.sanitize(obj[key], `${path}.${key}`);
            }
            return sanitized;
        }
        
        return obj;
    }
};

// Add protect function after object is fully defined
nosqlInjectionProtection.protect = function(req, res, next) {
    try {
        if (req.body) {
            req.body = nosqlInjectionProtection.sanitize(req.body);
        }
        
        if (req.query) {
            req.query = nosqlInjectionProtection.sanitize(req.query);
        }
        
        if (req.params) {
            req.params = nosqlInjectionProtection.sanitize(req.params);
        }
        
        next();
    } catch (error) {
        console.error('NoSQL Injection attempt detected:', error.message);
        return res.status(400).json({
            success: false,
            message: 'Invalid input detected',
            error: 'Security validation failed'
        });
    }
};

// ============================================
// XSS PROTECTION
// ============================================

const xssProtection = {
    escapeMap: {
        '&': '&',
        '<': '<',
        '>': '>',
        '"': '"',
        "'": '&#x27;',
        '/': '&#x2F;',
        '`': '&#x60;',
        '=': '&#x3D;'
    },

    escapeHtml: function(str) {
        if (!str || typeof str !== 'string') return str;
        return str.replace(/[&<>"'`=/]/g, (char) => this.escapeMap[char]);
    },

    sanitizeObject: function(obj, depth = 0, visited = new Set()) {
        if (depth > 10) return obj;
        
        const objId = typeof obj === 'object' && obj !== null ? (obj._id || obj.id || obj) : obj;
        if (visited.has(objId)) return obj;
        if (typeof obj === 'object' && obj !== null) {
            visited.add(objId);
        }
        
        if (typeof obj === 'string') {
            return this.escapeHtml(obj);
        }
        
        if (Array.isArray(obj)) {
            return obj.map(item => this.sanitizeObject(item, depth + 1, new Set(visited)));
        }
        
        if (typeof obj === 'object' && obj !== null) {
            const sanitized = {};
            for (const key in obj) {
                sanitized[key] = this.sanitizeObject(obj[key], depth + 1, new Set(visited));
            }
            return sanitized;
        }
        
        return obj;
    },

    protect: function(req, res, next) {
        if (req.skipSanitization) {
            return next();
        }
        
        req.skipSanitization = true;
        
        const originalJson = res.json.bind(res);
        res.json = function(data) {
            return originalJson(xssProtection.sanitizeObject(data));
        };
        
        next();
    }
};

// ============================================
// BUSINESS LOGIC: BOOKING LIMITS
// ============================================

const bookingBusinessLogic = {
    checkGlobalDailyLimit: async function(bookingDate) {
        const startOfDay = new Date(bookingDate);
        startOfDay.setHours(0, 0, 0, 0);
        
        const endOfDay = new Date(bookingDate);
        endOfDay.setHours(23, 59, 59, 999);

        const dailyBookings = await Booking.countDocuments({
            date: { $gte: startOfDay, $lte: endOfDay }
        });

        if (dailyBookings >= CONFIG.BOOKING.MAX_DAILY_BOOKINGS) {
            return { 
                allowed: false, 
                error: `Daily booking limit of ${CONFIG.BOOKING.MAX_DAILY_BOOKINGS} reached.` 
            };
        }

        return { allowed: true, currentCount: dailyBookings };
    },

    checkPerUserDailyLimit: async function(phoneNumber, bookingDate) {
        const startOfDay = new Date(bookingDate);
        startOfDay.setHours(0, 0, 0, 0);
        
        const endOfDay = new Date(bookingDate);
        endOfDay.setHours(23, 59, 59, 999);

        const existingBooking = await Booking.findOne({
            phone: phoneNumber,
            date: { $gte: startOfDay, $lte: endOfDay }
        });

        if (existingBooking) {
            return { 
                allowed: false, 
                error: 'You already have a booking for this date.' 
            };
        }

        return { allowed: true };
    }
};

// ============================================
// MAIN VALIDATION MIDDLEWARE
// ============================================

const validationMiddleware = {
    validateBookingRequest: async function(req, res, next) {
        try {
            nosqlInjectionProtection.sanitize(req.body);

            const sanitizedData = {
                name: nameValidation.sanitize(req.body.name),
                phone: phoneValidation.sanitize(req.body.phone),
                date: req.body.date ? String(req.body.date).trim() : null,
                guests: parseInt(req.body.guests) || 1,
                notes: req.body.notes ? xssProtection.escapeHtml(req.body.notes.trim()) : ''
            };

            const nameResult = nameValidation.validate(sanitizedData.name);
            if (!nameResult.valid) {
                return res.status(400).json({
                    success: false,
                    message: nameResult.error,
                    field: 'name'
                });
            }
            sanitizedData.name = nameResult.trimmed;

            const phoneResult = phoneValidation.validate(sanitizedData.phone);
            if (!phoneResult.valid) {
                return res.status(400).json({
                    success: false,
                    message: phoneResult.error,
                    field: 'phone'
                });
            }
            sanitizedData.phone = phoneResult.cleaned;

            const dateResult = dateValidation.validate(sanitizedData.date);
            if (!dateResult.valid) {
                return res.status(400).json({
                    success: false,
                    message: dateResult.error,
                    field: 'date'
                });
            }
            sanitizedData.date = dateResult.date;

            if (sanitizedData.guests < CONFIG.BOOKING.GUESTS_MIN || 
                sanitizedData.guests > CONFIG.BOOKING.GUESTS_MAX) {
                return res.status(400).json({
                    success: false,
                    message: `Number of guests must be between ${CONFIG.BOOKING.GUESTS_MIN} and ${CONFIG.BOOKING.GUESTS_MAX}`,
                    field: 'guests'
                });
            }

            const globalCheck = await bookingBusinessLogic.checkGlobalDailyLimit(sanitizedData.date);
            if (!globalCheck.allowed) {
                return res.status(400).json({
                    success: false,
                    message: globalCheck.error,
                    type: 'capacity_limit'
                });
            }

            const userCheck = await bookingBusinessLogic.checkPerUserDailyLimit(
                sanitizedData.phone, 
                sanitizedData.date
            );
            if (!userCheck.allowed) {
                return res.status(400).json({
                    success: false,
                    message: userCheck.error,
                    type: 'duplicate_booking'
                });
            }

            req.sanitizedBooking = sanitizedData;
            next();

        } catch (error) {
            console.error('Validation Error:', error.message);
            if (error.message.includes('is not defined')) {
                console.error('Hint: Make sure Booking model is properly injected via setBookingModel()');
            }
            return res.status(400).json({
                success: false,
                message: 'Validation failed: ' + error.message,
                error: error.message
            });
        }
    }
};

// Function to inject Booking model from server.js (safe, non-recursive)
function setBookingModel(bookingModel) {
    Booking = bookingModel;
    console.log('Booking model injected into security validation module');
}

// Export all modules
module.exports = {
    CONFIG,
    phoneValidation,
    nameValidation,
    dateValidation,
    nosqlInjectionProtection,
    xssProtection,
    bookingBusinessLogic,
    validationMiddleware,
    setBookingModel
};
