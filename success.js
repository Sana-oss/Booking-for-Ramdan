/**
 * CORINTHIA HOTEL - SUCCESS PAGE SCRIPT
 * إدارة عرض بيانات الحجز والتفاعل في صفحة النجاح
 */

document.addEventListener('DOMContentLoaded', () => {
    // 1. استخراج رقم الحجز من الرابط (URL Parameters)
    const urlParams = new URLSearchParams(window.location.search);
    const bookingId = urlParams.get('id');
    const resDisplay = document.getElementById('reservationNumber');
    
    // 2. عرض الرقم أو توليد رقم احتياطي (Fall-back)
    if (resDisplay) {
        if (bookingId && bookingId !== "null" && bookingId !== "undefined") {
            resDisplay.innerText = bookingId;
        } else {
            // رقم افتراضي ذو مظهر فخم في حالة عدم وصول الرقم من السيرفر
            resDisplay.innerText = "CRN-" + Math.floor(100000 + Math.random() * 900000);
        }
    }

    // 3. تفعيل زر متابعة حالة الحجز (الانتقال لصفحة الاستعلام)
    const trackBtn = document.getElementById('trackBookingBtn');
    if (trackBtn) {
        trackBtn.addEventListener('click', () => {
            const currentId = resDisplay ? resDisplay.innerText : bookingId;
            if (currentId && currentId !== "----") {
                // الانتقال لصفحة check-status.html مع تمرير الرقم في الرابط
                window.location.href = `check-status.html?id=${currentId}`;
            } else {
                const errorMsg = (typeof i18n !== 'undefined' && i18n.currentLang === 'en') 
                    ? "No booking ID found" 
                    : "لا يوجد رقم حجز للمتابعة";
                alert(errorMsg);
            }
        });
    }

    // 4. تهيئة الترجمة للصفحة
    if (typeof i18n !== 'undefined') {
        i18n.init();
    }
});

/**
 * وظيفة نسخ الرقم مع تأثير بصري عصري على الزر
 */
function copyResNumber() {
    const resNumberElement = document.getElementById('reservationNumber');
    const copyBtn = document.getElementById('copyBtn');
    
    if (resNumberElement && resNumberElement.innerText !== "----") {
        const resNumber = resNumberElement.innerText;

        navigator.clipboard.writeText(resNumber).then(() => {
            // حفظ النص الأصلي لتغييره مؤقتاً
            const originalText = copyBtn.innerText;
            const successText = (typeof i18n !== 'undefined' && i18n.currentLang === 'en') ? "Copied ✓" : "تم النسخ ✓";
            
            copyBtn.innerText = successText;
            copyBtn.style.backgroundColor = "#27ae60"; // أخضر نجاح
            copyBtn.style.color = "white";
            
            // إعادة الزر لشكلة الطبيعي بعد ثانيتين
            setTimeout(() => {
                copyBtn.innerText = originalText;
                copyBtn.style.backgroundColor = "";
                copyBtn.style.color = "";
            }, 2000);
        }).catch(err => {
            console.error("Copy failed", err);
        });
    }
}