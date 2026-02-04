/**
 * CORINTHIA HOTEL - GLOBAL CONSTANTS
 * الإعدادات المركزية والوحيدة للمشروع
 * --------------------------------------------------
 * هذا الملف هو المصدر الوحيد لروابط الـ API وإعدادات النظام
 */

// =====================================================
// API CONFIGURATION - Easy Switch Between Local/Production
// =====================================================
const API_CONFIG = {
    local: 'http://localhost:5000',
    production: 'https://your-production-domain.com',
    // Get current API base URL based on environment
    get current() {
        const hostname = window.location.hostname;
        return hostname === 'localhost' || hostname === '127.0.0.1' 
            ? this.local 
            : this.production;
    },
    // Get API version prefix
    version: '/api',
    // Full API base URL
    get baseUrl() {
        return `${this.current}${this.version}`;
    }
};

// API_BASE_URL - detect the correct URL for API calls
// For browser: use current hostname and port
// For server-side rendering: use localhost:5000 as default
const getApiBaseUrl = () => {
    if (typeof window !== 'undefined') {
        // Browser environment - use API_CONFIG for easy switching
        return API_CONFIG.baseUrl;
    }
    // Server-side or Node.js environment
    return 'http://localhost:5000/api';
};

const API_BASE_URL = getApiBaseUrl();

const CONSTANTS = {
    // 1. روابط السيرفر (API Endpoints)
    API: {
        BASE: API_BASE_URL,
        BOOKINGS: API_BASE_URL ? `${API_BASE_URL}/bookings` : '/api/bookings',
        // دالة ديناميكية لجلب رابط عنصر محدد (تحديث أو حذف)
        ITEM: (id) => API_BASE_URL ? `${API_BASE_URL}/bookings/${id}` : `/api/bookings/${id}`,
        // تحديث حالة الحجز
        STATUS: (id) => API_BASE_URL ? `${API_BASE_URL}/bookings/${id}` : `/api/bookings/${id}`,
        // التحقق من التوافر
        AVAILABILITY: (date) => API_BASE_URL ? `${API_BASE_URL}/bookings/availability/${date}` : `/api/bookings/availability/${date}`,
        // إنشاء حجز بواسطة الأدمن
        ADMIN_CREATE: API_BASE_URL ? `${API_BASE_URL}/bookings/admin` : '/api/bookings/admin',
        // مسارات المصادقة (Authentication)
        AUTH: {
            LOGIN: API_BASE_URL ? `${API_BASE_URL}/auth/login` : '/api/auth/login',
            ME: API_BASE_URL ? `${API_BASE_URL}/auth/me` : '/api/auth/me',
            LOGOUT: API_BASE_URL ? `${API_BASE_URL}/auth/logout` : '/api/auth/logout'
        },
        // مسارات إدارة المستخدمين (Users Management - Admin Only)
        USERS: {
            LIST: API_BASE_URL ? `${API_BASE_URL}/admin/users` : '/api/admin/users',
            CREATE: API_BASE_URL ? `${API_BASE_URL}/admin/users` : '/api/admin/users',
            DELETE: (id) => API_BASE_URL ? `${API_BASE_URL}/admin/users/${id}` : `/api/admin/users/${id}`
        },
        // Analytics Dashboard (Admin Only)
        ANALYTICS: API_BASE_URL ? `${API_BASE_URL}/admin/analytics` : '/api/admin/analytics',
        
        // Archives Management (Admin Only)
        ARCHIVES: {
            LIST: API_BASE_URL ? `${API_BASE_URL}/admin/archived-bookings` : '/api/admin/archived-bookings',
            RESTORE: (id) => API_BASE_URL ? `${API_BASE_URL}/bookings/restore/${id}` : `/api/bookings/restore/${id}`
        }
    },

    // 2. معرفات العناصر في واجهة المستخدم (DOM Selectors)
    SELECTORS: {
        // الصفحة العامة
        BOOKING_FORM: "bookingForm",
        LANG_TOGGLE: "langToggle",
        STATUS_RESULT_BOX: "statusResult",
        
        // لوحة التحكم (Admin Dashboard)
        ADMIN_TABLE_BODY: "adminTableBody",
        TOTAL_COUNT: "totalCount",
        CONFIRMED_COUNT: "confirmedCount",
        PENDING_COUNT: "pendingCount",
        
        // صفحة الدخول
        LOGIN_FORM: "adminLoginForm",
        LOGIN_ERROR_MSG: "loginErrorMessage"
    },

    // 3. إعدادات النظام
    SETTINGS: {
        DEFAULT_LANG: "ar",
        ID_PREFIX: "CRN-", // البادئة المستخدمة في عرض أرقام الحجز
        AUTO_REFRESH_INTERVAL: 120000 // تحديث تلقائي كل دقيقتين (بالملي ثانية)
    },

    // 4. رسائل النظام الثابتة (Fallbacks)
    MESSAGES: {
        CONNECTION_ERROR: {
            ar: "تعذر الاتصال بالسيرفر، يرجى التأكد من تشغيل server.js",
            en: "Server connection failed, please ensure server.js is running"
        },
        CONFIRM_DELETE: {
            ar: "هل أنت متأكد من حذف هذا الحجز نهائياً؟",
            en: "Are you sure you want to delete this booking permanently?"
        }
    }
};

// 5. روابط مختصرة لسهولة الاستخدام في ملفات JS الأخرى (Backward Compatibility)
const ENDPOINTS = {
    GET_ALL_BOOKINGS: CONSTANTS.API.BOOKINGS,
    CREATE_BOOKING: CONSTANTS.API.BOOKINGS,
    UPDATE_STATUS: (id) => CONSTANTS.API.ITEM(id),
    DELETE_BOOKING: (id) => CONSTANTS.API.ITEM(id),
    GET_SINGLE_STATUS: (id) => CONSTANTS.API.ITEM(id)
};

// تجميد الكائن لضمان عدم التلاعب بالإعدادات أثناء التشغيل
Object.freeze(CONSTANTS);
Object.freeze(ENDPOINTS);

console.log("✅ Constants.js loaded successfully");