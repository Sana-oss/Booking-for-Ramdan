/**
 * CORINTHIA HOTEL - MAIN BOOKING SCRIPT
 * المحرك الرئيسي لعملية الحجز والربط مع السيرفر
 */

document.addEventListener('DOMContentLoaded', () => {
    // جلب النموذج باستخدام المعرفات المركزية من constants.js
    const bookingForm = document.getElementById('bookingForm') || 
                       (typeof CONSTANTS !== 'undefined' ? document.getElementById(CONSTANTS.SELECTORS.BOOKING_FORM) : null);
    
    if (!bookingForm) return;

    bookingForm.addEventListener('submit', async (event) => {
        event.preventDefault();

        // 1. التحقق من صحة المدخلات عبر محرك الفحص
        if (typeof validation !== 'undefined' && !validation.validateAll()) return;

        try {
            // 2. تفعيل حالة التحميل في الواجهة
            if (typeof ui !== 'undefined') ui.setLoading(true);

            const formData = ui.getFormData();
            const apiUrl = (typeof CONSTANTS !== 'undefined') ? CONSTANTS.API_URL : 'http://localhost:5000/api/bookings';

            // 3. إرسال البيانات إلى السيرفر
            const response = await fetch(apiUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(formData)
            });

            // 4. معالجة الرد بذكاء (JSON vs HTML)
            const contentType = response.headers.get("content-type");
            
            if (contentType && contentType.includes("application/json")) {
                const result = await response.json();
                
                if (response.ok) {
                    // استخراج المعرف الفريد للحجز للانتقال لصفحة النجاح
                    const bookingId = result.data?._id || result._id || result.id || "SUCCESS";
                    window.location.href = `success.html?id=${bookingId}`;
                } else {
                    throw new Error(result.message || "رفض السيرفر الطلب");
                }
            } else {
                // التعامل مع حالات الأخطاء التي ترجع HTML (مثل خطأ 404 أو تعطل السيرفر)
                throw new Error("السيرفر غير مستجيب بشكل صحيح (Invalid Response Format)");
            }

        } catch (error) {
            console.error("❌ Connection Error:", error);
            const lang = (typeof i18n !== 'undefined') ? i18n.currentLang : 'ar';
            
            // رسالة خطأ واضحة للمستخدم بناءً على اللغة
            const msg = lang === 'ar' 
                ? `عذراً: ${error.message}. تأكد من تشغيل السيرفر المحلي.` 
                : `Error: ${error.message}. Please ensure the local server is running.`;
            
            alert(msg);
            
            // إعادة الزر لحالته الطبيعية ليتمكن المستخدم من المحاولة مرة أخرى
            if (typeof ui !== 'undefined') ui.setLoading(false);
        }
    });
});