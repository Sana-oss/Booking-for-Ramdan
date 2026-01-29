/**
 * CORINTHIA HOTEL - SUCCESS PAGE SCRIPT (ROYAL EDITION)
 * إدارة عرض بيانات الحجز والتفاعل في صفحة النجاح مع تأثيرات فخمة
 */

document.addEventListener('DOMContentLoaded', () => {
    // 1. تهيئة نظام الترجمة فوراً لضمان ظهور النصوص الصحيحة
    if (typeof i18n !== 'undefined') {
        i18n.init();
    }

    // 2. معالجة رقم الحجز (المرجع)
    const urlParams = new URLSearchParams(window.location.search);
    const bookingId = urlParams.get('id');
    const resDisplay = document.getElementById('reservationNumber');
    
    if (resDisplay) {
        if (bookingId && bookingId !== "null" && bookingId !== "undefined") {
            // عرض الرقم القادم من الرابط
            resDisplay.innerText = bookingId;
        } else {
            // في حال عدم وجود رقم، توليد رقم ملكي افتراضي (Fallback)
            // التنسيق: C (Corinthia) + السنة + رقم عشوائي
            const randomID = Math.floor(1000 + Math.random() * 9000);
            resDisplay.innerText = `C-2026-${randomID}`;
        }
    }

    // 3. إضافة تأثير حركة بسيطة (Entry Animation) للعناصر
    const card = document.querySelector('.luxury-card');
    if (card) {
        card.style.opacity = '0';
        card.style.transform = 'translateY(20px)';
        setTimeout(() => {
            card.style.transition = 'all 0.8s ease-out';
            card.style.opacity = '1';
            card.style.transform = 'translateY(0)';
        }, 100);
    }
});

/**
 * وظيفة نسخ رقم الحجز مع تأثيرات بصرية ذهبية
 */
function copyResNumber() {
    const resNumberElement = document.getElementById('reservationNumber');
    const copyBtn = document.getElementById('copyBtn');
    
    if (resNumberElement && copyBtn) {
        const resNumber = resNumberElement.innerText;

        // استخدام واجهة Clipboard لنسخ النص
        navigator.clipboard.writeText(resNumber).then(() => {
            // التحقق من اللغة الحالية لتغيير نص الزر
            const isEn = (typeof i18n !== 'undefined' && i18n.currentLang === 'en');
            const successText = isEn ? "Copied ✓" : "تم النسخ ✓";
            
            // تخزين الحالة الأصلية للزر
            const originalHTML = copyBtn.innerHTML;

            // تطبيق تأثير "النجاح الذهبي"
            copyBtn.style.transition = "all 0.3s ease";
            copyBtn.style.background = "var(--gold)";
            copyBtn.style.color = "#000"; // نص أسود فوق الخلفية الذهبية
            copyBtn.innerHTML = `<i class="fas fa-check"></i> ${successText}`;
            copyBtn.style.boxShadow = "0 0 20px var(--gold-glow)";

            // إعادة الزر لحالته الأصلية بعد 2.5 ثانية
            setTimeout(() => {
                copyBtn.innerHTML = originalHTML;
                copyBtn.style.background = "none";
                copyBtn.style.color = "var(--gold)";
                copyBtn.style.boxShadow = "none";
            }, 2500);

        }).catch(err => {
            console.error("فشل النسخ:", err);
        });
    }
}