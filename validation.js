/**
 * CORINTHIA HOTEL - VALIDATION ENGINE
 * نظام فحص المدخلات الذكي مع حماية من الأخطاء ودعم اللغات
 */

const validation = {
    /**
     * الفحص الشامل قبل الإرسال للسيرفر
     */
    validateAll: function() {
        // جلب البيانات من ui.js مع الحماية من الـ Null
        const data = ui.getFormData();
        if (!data) return false;

        this.clearErrors();

        // 1. فحص الاسم (3 حروف كحد أدنى)
        if (data.name.length < 3) {
            this.showError('name', 'error_name');
            return false;
        }

        // 2. فحص الهاتف (يجب أن يكون 10 أرقام - يمكن تعديله حسب الحاجة)
        if (data.phone.length < 10) {
            this.showError('phone', 'error_phone');
            return false;
        }

        // 3. فحص التاريخ
        if (!data.date) {
            this.showError('date', 'date_required');
            return false;
        }

        return true;
    },

    /**
     * إظهار الخطأ وتنبيه المستخدم بصرياً وبالرسائل
     */
    showError: function(fieldId, errorKey) {
        const el = document.getElementById(fieldId);
        if (el) {
            el.style.borderColor = "#e74c3c"; // اللون الأحمر للخطأ
            el.focus();
        }

        // استخدام نظام الترجمة العالمي t() المبرمج في i18n.js
        const errorMessage = (typeof t !== 'undefined') ? t(errorKey) : "يرجى التحقق من البيانات";
        alert(errorMessage);
    },

    /**
     * إعادة الحقول لشكلها الطبيعي قبل الفحص الجديد
     */
    clearErrors: function() {
        const fields = ['name', 'phone', 'date', 'guests'];
        fields.forEach(id => {
            const el = document.getElementById(id);
            if (el) el.style.borderColor = "";
        });
    },

    /**
     * تحسين تجربة الإدخال اللحظية (Input Masking)
     */
    init: function() {
        const phoneInput = document.getElementById('phone');
        if (phoneInput) {
            phoneInput.addEventListener('input', (e) => {
                // يسمح بالأرقام فقط ويحذف أي حروف أو رموز فوراً
                e.target.value = e.target.value.replace(/[^0-9]/g, '').slice(0, 10);
            });
        }
    }
};

// تشغيل الفلترة اللحظية فور تحميل الصفحة
document.addEventListener('DOMContentLoaded', () => validation.init());