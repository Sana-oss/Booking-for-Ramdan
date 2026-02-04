/**
 * CORINTHIA HOTEL - UI MANAGER
 * إدارة الواجهة، تجميع البيانات، ومعالجة حالات التحميل بذكاء
 */

const ui = {
    /**
     * الوصول السريع للعناصر مع حماية من أخطاء عدم الوجود
     */
    get elements() {
        return {
            form: document.getElementById('bookingForm'),
            submitBtn: document.getElementById('submitBtn'),
            nameInput: document.getElementById('name'),
            phoneInput: document.getElementById('phone'),
            dateInput: document.getElementById('date'),
            guestsInput: document.getElementById('guests'),
            groupCheck: document.getElementById('isGroup')
        };
    },

    /**
     * تجميع بيانات النموذج بشكل آمن لاستخدامها في الإرسال
     */
    getFormData: function() {
        const els = this.elements;

        // التحقق من وجود الحقول الأساسية قبل قراءة القيم لمنع الانهيار
        if (!els.nameInput || !els.phoneInput) {
            return null;
        }

        return {
            name: els.nameInput.value.trim(),
            phone: els.phoneInput.value.trim(),
            date: els.dateInput ? els.dateInput.value : '',
            guests: els.guestsInput ? els.guestsInput.value : '1',
            isGroup: els.groupCheck ? els.groupCheck.checked : false
        };
    },

    /**
     * تفعيل التفاعلات البصرية (مثل تغيير لون الحقل عند اختيار حجز مجموعة)
     */
    setupEventListeners: function() {
        const els = this.elements;
        if (els.groupCheck && els.guestsInput) {
            els.groupCheck.addEventListener('change', () => {
                this.handleGroupUI(els.groupCheck.checked);
            });
        }
    },

    handleGroupUI: function(isGroup) {
        const els = this.elements;
        if (!els.guestsInput) return;
        
        // تغيير حدود حقل الضيوف للون الذهبي عند اختيار حجز مجموعة
        els.guestsInput.style.borderColor = isGroup ? "#c5a059" : "";
        els.guestsInput.style.boxShadow = isGroup ? "0 0 10px rgba(197, 160, 89, 0.3)" : "";
    },

    /**
     * التحكم في حالة الزر أثناء عملية الإرسال بالسيرفر
     */
    setLoading: function(isLoading) {
        const btn = this.elements.submitBtn;
        if (!btn) return;

        // جلب اللغة الحالية لتغيير نص الزر
        const currentLang = (typeof i18n !== 'undefined') ? i18n.currentLang : 'ar';
        btn.disabled = isLoading;

        if (isLoading) {
            btn.classList.add('loading');
            btn.innerText = (currentLang === 'ar') ? "جاري الإرسال..." : "Processing...";
            btn.style.opacity = "0.7";
        } else {
            btn.classList.remove('loading');
            btn.innerText = (currentLang === 'ar') ? "تأكيد الحجز الفاخر" : "Confirm Luxury Booking";
            btn.style.opacity = "1";
        }
    }
};

// تشغيل مستمعات الأحداث فور تحميل الصفحة إذا كان النموذج موجوداً
document.addEventListener('DOMContentLoaded', () => {
    if (ui.elements.form) {
        ui.setupEventListeners();
    }
});
// داخل setLoading في ui.js
if (isLoading) {
    btn.innerHTML = (currentLang === 'ar') ? 
        '<i class="fas fa-spinner fa-spin"></i> جاري الإرسال...' : 
        '<i class="fas fa-spinner fa-spin"></i> Processing...';
} else {
    // جلب النص الأصلي من قاموس الترجمة الذي أعددناه في i18n.js
    btn.innerText = i18n.translations[currentLang].submit_booking;
}
/**
 * CORINTHIA HOTEL - SYNC ENGINE
 */
class Sync {
    constructor() {
      this.tabId = Date.now() + '-' + Math.random().toString(36).slice(2);
      this.channel = ('BroadcastChannel' in window) ? new BroadcastChannel(CONSTANTS.STORAGE_KEYS.SYNC_CHANNEL) : null;
    }
  
    init() {
      if (this.channel) {
        this.channel.onmessage = (event) => this.handleMessage(event.data);
      }
      this.setupLanguageSync();
    }
  
    handleMessage(message) {
      if (!message || message.tabId === this.tabId) return;
      if (message.type === CONSTANTS.SYNC_TYPES.LANGUAGE) {
          if (typeof i18n !== 'undefined' && i18n.currentLang !== message.lang) {
              i18n.changeLang(message.lang);
          }
      }
    }
  
    broadcast(message) {
      if (this.channel) {
          message.tabId = this.tabId;
          this.channel.postMessage(message);
      }
    }
  
    setupLanguageSync() {
      window.addEventListener('storage', (e) => {
        if (e.key === CONSTANTS.STORAGE_KEYS.LANG && typeof i18n !== 'undefined') {
          i18n.init();
        }
      });
    }
  }
  const sync = new Sync();
  document.addEventListener('DOMContentLoaded', () => sync.init());