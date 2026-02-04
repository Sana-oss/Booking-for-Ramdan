/**
 * CORINTHIA HOTELS - UNIFIED i18n ENGINE (v3.0)
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
            btn_export: "تصدير Excel",
            from_date: "من تاريخ",
            to_date: "إلى تاريخ",
            select_date_range: "اختر نطاق التاريخ",
            col_id: "المعرف",
            col_guest: "معلومات الضيف",
            col_date: "تاريخ الحجز",
            col_guests_count: "الأفراد",
            col_guests: "الأفراد",
            no_active_bookings: "لا توجد حجوزات نشطة",
            col_status: "الحالة",
            col_action: "الإجراءات",
            search_placeholder: "بحث عن ضيف أو رقم هاتف...",
            loading_data: "جاري مزامنة البيانات...",
            
            // --- Analytics Dashboard (NEW) ---
            status_distribution: "توزيع حالات الحجز",
            weekly_trends: "الاتجاه الأسبوعي",
            capacity_overview: "سعة الحجوزات",
            restaurant_archives: "أرشيف المطعم",
            booking_capacity: "سعة الحجوزات",
            daily_capacity: "السعة اليومية",
            status_available: "متاح",
            status_full: "مكتمل",
            seats_count: "200 مقعد",
            users_management: "إدارة المستخدمين",
            no_capacity_data: "لا توجد بيانات سعة متاحة",
            no_upcoming_bookings: "لا توجد حجوزات مستقبلية",
            current_badge: "الحالي",
            today_badge: "اليوم",
            days: {
                'Saturday': "السبت",
                'Sunday': "الأحد",
                'Monday': "الاثنين",
                'Tuesday': "الثلاثاء",
                'Wednesday': "الأربعاء",
                'Thursday': "الخميس",
                'Friday': "الجمعة"
            },
            
            // --- User Management ---
            user_mgmt_title: "إدارة المستخدمين",
            add_user: "إضافة مستخدم جديد",
            col_username: "اسم المستخدم",
            col_fullname: "الاسم الكامل",
            col_role: "الدور",
            col_status: "الحالة",
            col_date: "تاريخ الإنشاء",
            col_actions: "الإجراءات",
            role_admin: "مدير",
            role_staff: "موظف",
            back_to_dashboard: "العودة للوحة التحكم",
            no_users: "لا يوجد مستخدمين",
            loading_users: "جاري التحميل...",
            error_loading: "خطأ في تحميل البيانات",
            delete_confirm_title: "تأكيد الحذف",
            delete_confirm_message: "هل أنت متأكد من حذف هذا المستخدم؟",
            btn_cancel: "إلغاء",
            btn_delete: "حذف",
            btn_save: "حفظ",
            label_password: "كلمة المرور",
            delete_last_admin: "لا يمكن حذف آخر مدير",
            active_status: "نشط",
            inactive_status: "غير نشط",
            btn_edit: "تعديل",
            btn_reset_password: "إعادة تعيين كلمة المرور",
            feature_coming_soon: "الميزة قادمة قريباً",
            
            // --- Admin Login (NEW) ---
            admin_login_title: "بوابة الموظفين الملكية",
            admin_login_subtitle: "الرجاء تسجيل الدخول للوصول إلى لوحة التحكم الملكية",
            placeholder_username: "أدخل اسم المستخدم",
            placeholder_password: "أدخل كلمة المرور",
            btn_login: "دخول آمن",
            error_login: "خطأ في اسم المستخدم أو كلمة المرور",
            back_to_site: "العودة للموقع الرئيسي",
            
            // --- Check Status (NEW) ---
            title_status: "الخدمة الرقمية",
            subtitle_status: "الرقم المرجعي للحجز",
            placeholder_booking_id: "مثال: RMD12345",
            btn_check: "بحث",
            
            // --- Success Page (NEW) ---
            success_title: "شكراً لك",
            success_desc: "يسعدنا استضافتكم في فندق كورنثيا طرابلس",
            ramadan_blessing: "رمضان مبارك، ننتظر تشريفكم لنا",
            res_num_label: "الرقم المرجعي للحجز",
            copy_btn: "نسخ الرقم",
            success_note: "يرجى الاحتفاظ بالرقم المرجعي لمتابعة حالة حجزكم",
            new_booking: "حجز جديد",
            follow_up: "متابعة حالة الحجز",
            save_card: "حفظ البطاقة كصورة",

            // --- حالات الحجز (Database Statuses) ---
            statuses: {
                'Confirmed': 'مؤكد',
                'Cancelled': 'ملغى',
                'Expired': 'منتهي الصلاحية',
                'No Show': 'لم يحضر',
                'Pending': 'قيد الانتظار',
                'Rejected': 'مرفوض'
            },
            
            // --- أسباب الرفض (Rejection Reasons) ---
            rejection_reasons: {
                'Fully Booked': 'المطعم ممتلئ',
                'Invalid Date': 'تاريخ غير صالح',
                'No Availability': 'لا توجد أماكن متاحة',
                'Payment Failed': 'فشل في الدفع',
                'System Error': 'خطأ في النظام',
                'User Request': 'طلب من المستخدم',
                'Capacity Exceeded': 'تجاوز السعة',
                'Double Booking': 'حجز مكرر',
                'Invalid Phone': 'رقم هاتف غير صالح',
                'Suspicious Booking': 'حجز مشبوه'
            },
            
            // --- Status Instructions ---
            instr_confirmed: "تم استلام الدفع، شكراً لكم! تجربتكم الفريدة في كورنثيا بانتظاركم. نحن نجهز كل التفاصيل لاستقبالكم.",
            instr_pending: "حجزك في انتظار التأكيد. يرجى إتمام عملية الدفع وإرسال الإيصال لتفعيل الحجز نهائياً.",
            instr_cancelled: "نأسف، هذا الحجز ملغى حالياً. يرجى التواصل مع الإدارة إذا كان لديك أي استفسار.",
            
            // --- Labels ---
            label_payment_instructions: "تعليمات الدفع",
            label_booking_date: "تاريخ الحجز",
            label_book_now: "احجز الآن",
            label_hotel_location: "موقع الفندق",
            label_welcome: "مرحباً بكم",
            label_pending_payment: "بانتظار الدفع",
            label_new_booking: "حجز جديد",
            
            // --- Info Card (Floating) ---
            info_title: "معلومات الحجز",
            info_expiry: "تنتهي صلاحية الحجز خلال 24 ساعة في حالة عدم الدفع",
            info_capacity: "السعة اليومية: 200 مقعد",
            notice_expiry: "تنتهي صلاحية الحجز خلال 24 ساعة في حالة عدم الدفع",
            notice_capacity: "السعة اليومية: 200 مقعد",
            
            // --- Pay at Hotel Instructions ---
            pay_at_hotel_title: "الدفع عند الفندق",
            pay_at_hotel_instructions: "يرجى الوصول إلى الفندق قبل موعد الحجز بوقت كافٍ|سدد رسوم الحجز عند مكتب الاستقبال|أظهر بطاقة الحجز الإلكترونية أو الرقم المرجعي",
            hotel_location: "موقع الفندق",
            need_help: "مساعدة",
            payment_time_limit: "يجب إتمام الدفع خلال 24 ساعة من وقت الحجز",
            expires_in: "تنتهي خلال",
            card_note: "يرجى إظهار هذه البطاقة عند دخول الفندق",

            // --- الصفحة الرئيسية (index.html) ---
            hotelName: "فندق كورنثيا",
            title_home: "تجربة رمضانية فاخرة في فندق كورنثيا",
            subtitle_home: "أهلاً بكم في قلب الفخامة بمدينة طرابلس",
            ramadan_greeting: "رمضان مبارك",
            label_name: "الاسم الكامل",
            label_phone: "رقم الهاتف",
            label_date: "تاريخ الحجز",
            label_people: "الضيوف",
            group_booking: "حجز لمجموعة كبيرة / مناسبة",
            submit_booking: "تأكيد حجز طاولة",
            follow_up: "متابعة حالة الحجز",
            placeholder_name: "أدخل اسمك بالكامل",
            placeholder_phone: "09XXXXXXXX",
            select_date: "اختر تاريخاً",
            
            // --- pagination ---
            pagination_prev: "السابق",
            pagination_next: "التالي",
            pagination_page: "صفحة",
            
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
            btn_export: "Export Excel",
            from_date: "From Date",
            to_date: "To Date",
            select_date_range: "Select Date Range",
            col_id: "ID",
            col_guest: "Guest Info",
            col_date: "Booking Date",
            col_guests_count: "Pax",
            col_guests: "Guests",
            no_active_bookings: "No active bookings found",
            col_status: "Status",
            col_action: "Actions",
            search_placeholder: "Search name or phone...",
            loading_data: "Synchronizing data...",
            
            // --- Analytics Dashboard (NEW) ---
            status_distribution: "Booking Status Distribution",
            weekly_trends: "Weekly Trends",
            capacity_overview: "Booking Capacity",
            restaurant_archives: "Restaurant Archives",
            booking_capacity: "Booking Capacity",
            daily_capacity: "Daily Capacity",
            status_available: "Available",
            status_full: "Full",
            seats_count: "200 Seats",
            users_management: "Users Management",
            no_capacity_data: "No capacity data available",
            no_upcoming_bookings: "No upcoming booking slots configured",
            current_badge: "CURRENT",
            today_badge: "Today",
            days: {
                'Saturday': "Saturday",
                'Sunday': "Sunday",
                'Monday': "Monday",
                'Tuesday': "Tuesday",
                'Wednesday': "Wednesday",
                'Thursday': "Thursday",
                'Friday': "Friday"
            },
            
            // --- User Management ---
            user_mgmt_title: "User Management",
            add_user: "Add New User",
            col_username: "Username",
            col_fullname: "Full Name",
            col_role: "Role",
            col_status: "Status",
            col_date: "Created Date",
            col_actions: "Actions",
            role_admin: "Manager",
            role_staff: "Staff",
            back_to_dashboard: "Back to Dashboard",
            no_users: "No users found",
            loading_users: "Loading...",
            error_loading: "Error loading data",
            delete_confirm_title: "Confirm Delete",
            delete_confirm_message: "Are you sure you want to delete this user?",
            btn_cancel: "Cancel",
            btn_delete: "Delete",
            btn_save: "Save",
            label_password: "Password",
            delete_last_admin: "Cannot delete the last admin",
            active_status: "Active",
            inactive_status: "Inactive",
            btn_edit: "Edit",
            btn_reset_password: "Reset Password",
            feature_coming_soon: "Feature coming soon",
            
            // --- Admin Login (NEW) ---
            admin_login_title: "Royal Staff Portal",
            admin_login_subtitle: "Please sign in to access the royal dashboard",
            placeholder_username: "Enter username",
            placeholder_password: "Enter password",
            btn_login: "Secure Access",
            error_login: "Invalid username or password",
            back_to_site: "Back to Main Site",
            
            // --- Check Status (NEW) ---
            title_status: "Digital Reservation",
            subtitle_status: "Booking Reference Number",
            placeholder_booking_id: "e.g., RMD12345",
            btn_check: "Search",
            
            // --- Success Page (NEW) ---
            success_title: "Thank You",
            success_desc: "We are honored to host you at Corinthia Hotel Tripoli",
            ramadan_blessing: "Ramadan Kareem, we look forward to welcoming you",
            res_num_label: "Booking Reference Number",
            copy_btn: "Copy Number",
            success_note: "Please keep your reference number to track your booking status",
            new_booking: "New Booking",
            follow_up: "Track Booking Status",
            save_card: "Save Card as Image",

            // --- Database Statuses ---
            statuses: {
                'Confirmed': 'Confirmed',
                'Cancelled': 'Cancelled',
                'Expired': 'Expired',
                'No Show': 'No Show',
                'Pending': 'Pending',
                'Rejected': 'Rejected'
            },
            
            // --- Rejection Reasons ---
            rejection_reasons: {
                'Fully Booked': 'Fully Booked',
                'Invalid Date': 'Invalid Date',
                'No Availability': 'No Availability',
                'Payment Failed': 'Payment Failed',
                'System Error': 'System Error',
                'User Request': 'User Request',
                'Capacity Exceeded': 'Capacity Exceeded',
                'Double Booking': 'Double Booking',
                'Invalid Phone': 'Invalid Phone',
                'Suspicious Booking': 'Suspicious Booking'
            },
            
            // --- Status Instructions ---
            instr_confirmed: "Payment received, thank you! Your unique experience at Corinthia awaits. We are preparing every detail for your arrival.",
            instr_pending: "Your booking is pending confirmation. Please complete the payment and send the receipt to finalize your reservation.",
            instr_cancelled: "We're sorry, this booking is currently cancelled. Please contact management if you have any questions.",
            
            // --- Labels ---
            label_payment_instructions: "Payment Instructions",
            label_booking_date: "Booking Date",
            label_book_now: "Book Now",
            label_hotel_location: "Hotel Location",
            label_welcome: "Welcome",
            label_pending_payment: "Pending Payment",
            label_new_booking: "New Booking",
            
            // --- Info Card (Floating) ---
            info_title: "Booking Information",
            info_expiry: "Bookings expire within 24h if unpaid",
            info_capacity: "Daily Capacity: 200 Guests",
            notice_expiry: "Bookings expire within 24h if unpaid",
            notice_capacity: "Daily Capacity: 200 Guests",
            
            // --- Pay at Hotel Instructions ---
            pay_at_hotel_title: "Pay at Hotel",
            pay_at_hotel_instructions: "Please arrive at the hotel before your reservation time|Pay the booking fee at the reception desk|Show your digital booking card or reference number",
            hotel_location: "Hotel Location",
            need_help: "Help",
            payment_time_limit: "Payment must be completed within 24 hours of booking",
            expires_in: "Expires in",
            card_note: "Please show this card upon entering the hotel",

            // --- Home Page ---
            hotelName: "Corinthia Hotel",
            title_home: "Luxury Ramadan Experience at Corinthia Hotel",
            subtitle_home: "Welcome to the heart of luxury in Tripoli",
            ramadan_greeting: "Ramadan Kareem",
            label_name: "Full Name",
            label_phone: "Phone Number",
            label_date: "Booking Date",
            label_people: "Guests",
            group_booking: "Group / Special Event",
            submit_booking: "Confirm Reservation",
            follow_up: "Track Reservation",
            placeholder_name: "Enter your full name",
            placeholder_phone: "09XXXXXXXX",
            select_date: "Select a date",
            
            // --- pagination ---
            pagination_prev: "Previous",
            pagination_next: "Next",
            pagination_page: "Page",
            
            // --- Success Page ---
            success_title: "Request Received Successfully",
            back_home: "Back to Home"
        }
    },

    /**
     * Helper function to translate status
     */
    tStatus(status) {
        const dict = this.translations[this.currentLang];
        if (dict.statuses && dict.statuses[status]) {
            return dict.statuses[status];
        }
        return status; // Fallback to original
    },

    /**
     * Helper function to translate rejection reason
     */
    tReason(reason) {
        const dict = this.translations[this.currentLang];
        if (dict.rejection_reasons && dict.rejection_reasons[reason]) {
            return dict.rejection_reasons[reason];
        }
        return reason; // Fallback to original
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

        // 2. ترجمة النصوص التي تحمل السمة [data-i18n-attr]
        document.querySelectorAll('[data-i18n-attr]').forEach(el => {
            const parts = el.getAttribute('data-i18n-attr').split(':');
            if (parts.length === 2 && dict[parts[1]]) {
                el[parts[0]] = dict[parts[1]];
            }
        });

        // 3. ترجمة الـ Placeholders (البحث والاسم)
        const searchInput = document.getElementById('searchInput');
        if (searchInput) searchInput.placeholder = dict.search_placeholder;

        const nameInput = document.getElementById('guestName');
        if (nameInput) nameInput.placeholder = dict.placeholder_name;
        
        const phoneInput = document.getElementById('phone');
        if (phoneInput) phoneInput.placeholder = dict.placeholder_phone;

        // 4. تحديث حالة زر التبديل (تبديل class active)
        const langAr = document.getElementById('langAr');
        const langEn = document.getElementById('langEn');
        if (langAr && langEn) {
            if (this.currentLang === 'ar') {
                langAr.classList.add('active');
                langEn.classList.remove('active');
            } else {
                langEn.classList.add('active');
                langAr.classList.remove('active');
            }
        }
        
        // 5. تحديث نص زر التبديل لعرض اللغة المقابلة
        const langToggle = document.getElementById('langToggle');
        const langText = langToggle ? langToggle.querySelector('.lang-text') : null;
        if (langText) {
            langText.textContent = this.currentLang === 'ar' ? 'English' : 'العربية';
        }
    }
};

// تهيئة النظام عند جاهزية المتصفح
document.addEventListener('DOMContentLoaded', () => i18n.init());