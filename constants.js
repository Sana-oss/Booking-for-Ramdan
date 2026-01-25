/**
 * CORINTHIA HOTEL - GLOBAL CONSTANTS
 * الإعدادات المركزية والوحيدة للمشروع
 * --------------------------------------------------
 * هذا الملف هو المصدر الوحيد لروابط الـ API وإعدادات النظام
 */

const API_BASE_URL = "http://localhost:5000";

const CONSTANTS = {
    // 1. روابط السيرفر (API Endpoints)
    API: {
        BASE: API_BASE_URL,
        BOOKINGS: `${API_BASE_URL}/api/bookings`,
        // دالة ديناميكية لجلب رابط عنصر محدد (تحديث أو حذف)
        ITEM: (id) => `${API_BASE_URL}/api/bookings/${id}`
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