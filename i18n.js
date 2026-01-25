/**
 * CORINTHIA HOTELS - i18n ENGINE (FINAL OPTIMIZED V11)
 * نظام الترجمة الذكي: يدعم اللغات، الاتجاهات، والعناصر الديناميكية
 */

const i18n = {
    // 1. الحالة الحالية: جلب اللغة من التخزين أو اعتماد العربية كافتراضية
    currentLang: localStorage.getItem('adminLang') || 'ar',
    
    // 2. القاموس الكامل (الثوابت)
    translations: {
        ar: {
            admin_panel: "لوحة التحكم والإدارة",
            logout: "تسجيل الخروج",
            total_bookings: "إجمالي الحجوزات",
            confirmed_bookings: "تم التأكيد",
            pending_bookings: "قيد الانتظار",
            export_excel: "تصدير Excel",
            col_id: "المعرف",
            col_guest: "معلومات الضيف",
            col_date: "التاريخ",
            col_guests_count: "الأفراد",
            col_status: "الحالة",
            col_action: "الإجراءات",
            search_placeholder: "بحث عن ضيف أو رقم هاتف...",
            no_results: "لا توجد نتائج تطابق معايير البحث"
        },
        en: {
            admin_panel: "Management Dashboard",
            logout: "Logout",
            total_bookings: "Total Bookings",
            confirmed_bookings: "Confirmed",
            pending_bookings: "Pending",
            export_excel: "Export Excel",
            col_id: "ID",
            col_guest: "Guest Info",
            col_date: "Date",
            col_guests_count: "Pax",
            col_status: "Status",
            col_action: "Actions",
            search_placeholder: "Search name or phone...",
            no_results: "No results found for your search"
        }
    },

    /**
     * تشغيل النظام عند الإقلاع
     */
    init() {
        console.log("i18n Engine: Initializing in", this.currentLang);
        this.updatePageAttributes();
        this.apply();
    },

    /**
     * تحديث خصائص الصفحة (لغة المتصفح واتجاه النص)
     */
    updatePageAttributes() {
        const isAr = this.currentLang === 'ar';
        document.documentElement.lang = this.currentLang;
        document.documentElement.dir = isAr ? 'rtl' : 'ltr';
        
        // إضافة كلاس للتحكم في الخطوط وتنسيقات الـ CSS الخاصة بكل لغة
        document.body.classList.remove('lang-ar', 'lang-en');
        document.body.classList.add(isAr ? 'lang-ar' : 'lang-en');
    },

    /**
     * تبديل اللغة مع تأثير انسيابي
     */
    toggleLang() {
        this.currentLang = this.currentLang === 'ar' ? 'en' : 'ar';
        localStorage.setItem('adminLang', this.currentLang);
        
        // تأثير تلاشي فخم قبل إعادة التحميل
        document.body.style.transition = 'opacity 0.3s ease';
        document.body.style.opacity = '0';
        
        setTimeout(() => {
            location.reload();
        }, 300);
    },

    /**
     * ترجمة العناصر الثابتة والمتحركة (Placeholders)
     */
    apply() {
        const dict = this.translations[this.currentLang];

        // 1. ترجمة النصوص التي تحمل data-i18n
        document.querySelectorAll('[data-i18n]').forEach(el => {
            const key = el.getAttribute('data-i18n');
            if (dict[key]) {
                el.innerText = dict[key];
            }
        });

        // 2. ترجمة الـ Placeholders (مثل مربعات البحث)
        const searchInput = document.getElementById('searchInput');
        if (searchInput) {
            searchInput.placeholder = dict.search_placeholder;
        }

        // 3. تحديث نص زر التبديل (يعرض اللغة الأخرى المتاحة)
        const langBtnText = document.querySelector('.lang-text');
        if (langBtnText) {
            langBtnText.innerText = this.currentLang === 'ar' ? 'English' : 'العربية';
        }
    }
};

// تهيئة النظام تلقائياً بمجرد جاهزية المستند
document.addEventListener('DOMContentLoaded', () => i18n.init());