/**
 * CORINTHIA HOTELS - UNIFIED i18n ENGINE (v2.5)
 * المحرك الموحد لترجمة: الرئيسية، حالة الحجز، والداشبورد
 */

const i18n = {
    // 1. الحالة: جلب اللغة أو اعتماد العربية كافتراضية
    currentLang: localStorage.getItem('hotel_lang') || 'ar',

    // 2. القاموس الموحد للمشروع بالكامل
    translations: {
        ar: {
            // --- لوحة التحكم (Dashboard) ---
            admin_panel: "لوحة التحكم والإدارة",
            logout: "تسجيل الخروج",
            total_bookings: "إجمالي الحجوزات",
            confirmed_bookings: "تم التأكيد",
            pending_bookings: "قيد الانتظار",
            export_excel: "تصدير Excel",
            col_id: "المعرف",
            col_guest: "معلومات الضيف",
            col_date: "تاريخ الحجز",
            col_guests_count: "الأفراد",
            col_status: "الحالة",
            col_action: "الإجراءات",
            search_placeholder: "بحث عن ضيف أو رقم هاتف...",
            loading_data: "جاري مزامنة البيانات...",

            // --- حالات الحجز (Statuses) ---
            status_pending: "قيد الانتظار",
            status_confirmed: "تم التأكيد",
            status_rejected: "ملغي",

            // --- الصفحة الرئيسية (index.html) ---
            hotelName: "فندق كورنثيا",
            title_home: "تجربة إفطار ملكية",
            subtitle_home: "أهلاً بكم في قلب الفخامة بمدينة طرابلس",
            label_name: "الاسم الكامل",
            label_phone: "رقم الهاتف",
            label_date: "تاريخ الحجز",
            label_people: "الضيوف",
            group_booking: "حجز لمجموعة كبيرة / مناسبة",
            submit_booking: "تأكيد حجز طاولة",
            follow_up: "متابعة حالة الحجز",
            placeholder_name: "أدخل اسمك بالكامل",

            // --- صفحة النجاح (success.html) ---
            success_title: "تم استلام طلبك بنجاح",
            back_home: "العودة للرئيسية"
        },
        en: {
            // --- Dashboard ---
            admin_panel: "Management Dashboard",
            logout: "Logout",
            total_bookings: "Total Bookings",
            confirmed_bookings: "Confirmed",
            pending_bookings: "Pending",
            export_excel: "Export Excel",
            col_id: "ID",
            col_guest: "Guest Info",
            col_date: "Booking Date",
            col_guests_count: "Pax",
            col_status: "Status",
            col_action: "Actions",
            search_placeholder: "Search name or phone...",
            loading_data: "Synchronizing data...",

            // --- Statuses ---
            status_pending: "Pending Approval",
            status_confirmed: "Confirmed",
            status_rejected: "Cancelled",

            // --- Home Page ---
            hotelName: "Corinthia Hotel",
            title_home: "Royal Breakfast Experience",
            subtitle_home: "Welcome to the heart of luxury in Tripoli",
            label_name: "Full Name",
            label_phone: "Phone Number",
            label_date: "Booking Date",
            label_people: "Guests",
            group_booking: "Group / Special Event",
            submit_booking: "Confirm Reservation",
            follow_up: "Track Reservation",
            placeholder_name: "Enter your full name",

            // --- Success Page ---
            success_title: "Request Received Successfully",
            back_home: "Back to Home"
        }
    },

    /**
     * تشغيل المحرك وتحديث سمات الصفحة
     */
    init() {
        console.log("i18n Engine: Active Language is", this.currentLang);
        this.updatePageAttributes();
        this.apply();
    },

    /**
     * تحديث اتجاه الصفحة (RTL/LTR) والخطوط بناءً على اللغة
     */
    updatePageAttributes() {
        const isAr = this.currentLang === 'ar';
        document.documentElement.lang = this.currentLang;
        document.documentElement.dir = isAr ? 'rtl' : 'ltr';
        
        // كلاسات للتحكم في CSS الخاص بكل لغة
        document.body.classList.remove('lang-ar', 'lang-en');
        document.body.classList.add(isAr ? 'lang-ar' : 'lang-en');
    },

    /**
     * تبديل اللغة مع تأثير Fade-out فخم
     */
    toggleLang() {
        this.currentLang = this.currentLang === 'ar' ? 'en' : 'ar';
        localStorage.setItem('hotel_lang', this.currentLang);
        
        // تأثير انسيابي قبل إعادة التحميل
        document.body.style.transition = 'opacity 0.3s ease';
        document.body.style.opacity = '0';
        
        setTimeout(() => {
            location.reload();
        }, 300);
    },

    /**
     * تطبيق الترجمات على جميع العناصر المستهدفة
     */
    apply() {
        const dict = this.translations[this.currentLang];

        // 1. ترجمة النصوص التي تحمل السمة [data-i18n]
        document.querySelectorAll('[data-i18n]').forEach(el => {
            const key = el.getAttribute('data-i18n');
            if (dict[key]) {
                el.innerText = dict[key];
            }
        });

        // 2. ترجمة الـ Placeholders (البحث والاسم)
        const searchInput = document.getElementById('searchInput');
        if (searchInput) searchInput.placeholder = dict.search_placeholder;

        const nameInput = document.getElementById('name');
        if (nameInput) nameInput.placeholder = dict.placeholder_name;

        // 3. تحديث نص زر التبديل (يدعم id و class لضمان التوافق)
        const langText = document.getElementById('langText') || document.querySelector('.lang-text');
        if (langText) {
            langText.innerText = this.currentLang === 'ar' ? 'English' : 'العربية';
        }
    }
};

// تهيئة النظام عند جاهزية المتصفح
document.addEventListener('DOMContentLoaded', () => i18n.init());