/**
 * CORINTHIA HOTEL - MAIN BOOKING SCRIPT
 * المحرك الرئيسي لعملية الحجز والربط مع MongoDB
 */

document.addEventListener('DOMContentLoaded', () => {
    const bookingForm = document.getElementById('bookingForm');
    
    if (!bookingForm) {
        console.error("❌ Booking form not found in the DOM");
        return;
    }

    bookingForm.addEventListener('submit', async (event) => {
        event.preventDefault();

        // 1. تجميع البيانات من الحقول (تأكد أن الـ IDs تطابق الـ HTML)
        const formData = {
            name: document.getElementById('name').value,
            phone: document.getElementById('phone').value,
            date: document.getElementById('date').value,
            guests: parseInt(document.getElementById('guests').value),
            // إذا كان لديك حقل للمجموعات
            isGroup: document.getElementById('isGroup') ? document.getElementById('isGroup').checked : false,
            status: 'Pending' // مطابقة للـ Schema في السيرفر
        };

        try {
            // 2. تفعيل حالة التحميل في الزر
            const submitBtn = bookingForm.querySelector('button[type="submit"]');
            const originalBtnText = submitBtn.innerHTML;
            setLoadingState(submitBtn, true);

            // 3. إرسال البيانات إلى السيرفر (MongoDB API)
            // نستخدم الرابط المباشر أو من constants.js إذا كان معرفاً
            const apiUrl = 'http://localhost:5000/api/bookings';

            const response = await fetch(apiUrl, {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json' 
                },
                body: JSON.stringify(formData)
            });

            const result = await response.json();

            // 4. معالجة الرد
            if (response.ok && result.success) {
                // نجاح العملية: الانتقال لصفحة النجاح مع الرقم المرجعي
                // نستخدم result.bookingId لأن السيرفر يرسله بهذا الاسم
                const finalId = result.bookingId || result._id;
                window.location.href = `success.html?id=${finalId}`;
            } else {
                // فشل من جهة السيرفر
                throw new Error(result.message || "Server refused the booking");
            }

        } catch (error) {
            console.error("❌ Connection Error:", error);
            showErrorFeedback(error.message);
        } finally {
            // إعادة الزر لحالته الطبيعية
            const submitBtn = bookingForm.querySelector('button[type="submit"]');
            setLoadingState(submitBtn, false);
        }
    });

    /**
     * وظائف مساعدة (Utility Functions)
     */

    function setLoadingState(button, isLoading) {
        if (isLoading) {
            button.disabled = true;
            button.style.opacity = '0.7';
            button.innerHTML = i18n.currentLang === 'ar' ? 'جاري الحجز...' : 'Booking...';
        } else {
            button.disabled = false;
            button.style.opacity = '1';
            // إعادة الأيقونة والنص الأصلي
            const btnText = i18n.currentLang === 'ar' ? 'تأكيد حجز طاولة' : 'Confirm Booking';
            button.innerHTML = `<span>${btnText}</span> <i class="fas fa-chevron-left"></i>`;
        }
    }

    function showErrorFeedback(message) {
        const lang = (typeof i18n !== 'undefined') ? i18n.currentLang : 'ar';
        const msg = lang === 'ar' 
            ? `عذراً، حدث خطأ: ${message}. تأكد من تشغيل السيرفر.` 
            : `Error: ${message}. Please ensure the server is running.`;
        
        alert(msg);
    }
});