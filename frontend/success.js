/**
 * CORINTHIA HOTEL - SUCCESS PAGE SCRIPT (ROYAL EDITION)
 * إدارة عرض بيانات الحجز والتفاعل في صفحة النجاح مع تأثيرات فخمة
 */

document.addEventListener('DOMContentLoaded', () => {
    // 1. تهيئة نظام الترجمة فوراً لضمان ظهور النصوص الصحيحة
    if (typeof i18n !== 'undefined') {
        i18n.init();
    }

    // 2. معالجة رقم الحجز (المرجع) وتهيئة البطاقة
    const urlParams = new URLSearchParams(window.location.search);
    const bookingId = urlParams.get('id');
    const urlRef = urlParams.get('ref'); // CRT-XXXX format from URL
    const resDisplay = document.getElementById('reservationNumber');
    
    // بيانات الحجز من localStorage أو URL
    let bookingData = {
        name: localStorage.getItem('bookingName') || '----',
        phone: localStorage.getItem('bookingPhone') || '----',
        date: localStorage.getItem('bookingDate') || '----',
        id: bookingId || localStorage.getItem('bookingNumericId') || '----',
        referenceNumber: urlRef || localStorage.getItem('bookingReferenceNumber') || null,
        expiresAt: null
    };
    
    // إذا كان هناك bookingId، جلب البيانات من الخادم
    if (bookingId) {
        fetchBookingData(bookingId);
    } else {
        populateBookingCard(bookingData);
        showExpirationWarning(null);
    }
    
    // تحديث البطاقة بالبيانات
    populateBookingCard(bookingData);
    
    if (resDisplay) {
        // أولوية: referenceNumber → id → fallback
        const displayRef = bookingData.referenceNumber || bookingData.id;
        if (displayRef && displayRef !== 'null' && displayRef !== '----') {
            resDisplay.innerText = displayRef;
        } else {
            // في حال عدم وجود رقم، توليد رقم ملكي افتراضي (Fallback)
            const randomID = Math.floor(1000 + Math.random() * 9000);
            const fallbackId = `CRT-${randomID}`;
            resDisplay.innerText = fallbackId;
            bookingData.referenceNumber = fallbackId;
        }
    }

    // 5. إضافة تأثير حركة بسيطة (Entry Animation) للعناصر
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
 * جلب بيانات الحجز من الخادم للحصول على expiresAt الفعلي
 */
async function fetchBookingData(id) {
    try {
        const response = await fetch(`/api/bookings/${id}`);
        const result = await response.json();
        
        if (result.success && result.data) {
            const booking = result.data;
            
            // تحديث بيانات الحجز - استخدام referenceNumber إن وجد
            const bookingData = {
                name: booking.name,
                phone: booking.phone,
                date: booking.date,
                id: id,
                referenceNumber: booking.referenceNumber || id,
                expiresAt: booking.expiresAt,
                status: booking.status
            };
            
            // تحديث البطاقة
            populateBookingCard(bookingData);
            
            // إظهار العد التنازلي مع expiresAt الفعلي
            showExpirationWarning(booking.expiresAt);
            
            // تحديث رقم العرض باستخدام referenceNumber
            const resDisplay = document.getElementById('reservationNumber');
            const cardRefDisplay = document.getElementById('cardRef');
            const displayRef = booking.referenceNumber || id;
            
            if (resDisplay) {
                resDisplay.innerText = displayRef;
            }
            if (cardRefDisplay) {
                cardRefDisplay.innerText = displayRef;
            }
            
            console.log('✅ Booking data fetched:', booking);
        }
    } catch (error) {
        console.error('❌ Error fetching booking data:', error);
        // استخدام العد التنازلي الافتراضي
        showExpirationWarning(null);
    }
}

/**
 * إظهار تحذير انتهاء الصلاحية مع العد التنازلي
 * Uses actual expiresAt from database when available
 */
function showExpirationWarning(expiresAt) {
    const warningEl = document.getElementById('expirationWarning');
    if (!warningEl) return;
    
    let expirationTime;
    
    if (expiresAt) {
        // استخدام الوقت الفعلي من قاعدة البيانات
        expirationTime = new Date(expiresAt);
        console.log('⏰ Using DB expiresAt:', expirationTime.toISOString());
    } else {
        // Fallback: 24 ساعة من الآن (للتوافق مع الإصدارات القديمة)
        expirationTime = new Date();
        expirationTime.setHours(expirationTime.getHours() + 24);
        console.warn('⚠️ No expiresAt found, using fallback 24h');
    }
    
    // إظهار العنصر
    warningEl.style.display = 'flex';
    
    // بدء العد التنازلي
    updateCountdown(expirationTime);
    
    // تحديث كل ثانية
    const countdownInterval = setInterval(() => {
        const result = updateCountdown(expirationTime);
        if (result === 'expired') {
            clearInterval(countdownInterval);
            handleExpiration();
        }
    }, 1000);
}

/**
 * معالجة انتهاء الوقت
 */
function handleExpiration() {
    const warningEl = document.getElementById('expirationWarning');
    const warningContent = warningEl?.querySelector('.warning-content');
    const lang = (typeof i18n !== 'undefined') ? i18n.currentLang : 'ar';
    
    if (warningEl && warningContent) {
        warningEl.style.background = 'linear-gradient(135deg, rgba(192, 57, 43, 0.9) 0%, rgba(231, 76, 60, 0.9) 100%)';
        warningEl.style.borderColor = '#e74c3c';
        
        const h4 = warningContent.querySelector('h4');
        const p = warningContent.querySelector('p');
        const timer = warningContent.querySelector('.countdown-timer');
        
        if (h4) {
            h4.innerHTML = lang === 'ar' ? 'انتهت صلاحية الحجز' : 'Booking Expired';
            h4.style.color = '#fff';
        }
        
        if (p) {
            p.innerHTML = lang === 'ar' 
                ? 'انتهت صلاحية حجزك لعدم إتمام التأكيد. يرجى إعادة الحجز.'
                : 'Your booking has expired because confirmation was not completed. Please make a new booking.';
        }
        
        if (timer) {
            timer.style.display = 'none';
        }
        
        // تحديث حالة البطاقة
        const statusBadge = document.getElementById('cardStatus');
        if (statusBadge) {
            statusBadge.innerText = lang === 'ar' ? 'منتهي' : 'Expired';
            statusBadge.style.background = 'rgba(231, 76, 60, 0.2)';
            statusBadge.style.color = '#e74c3c';
            statusBadge.style.borderColor = '#e74c3c';
        }
    }
    
    console.log('⚠️ Booking expiration handled');
}

/**
 * تحديث عرض العد التنازلي
 * Returns 'expired' when time is up, otherwise returns formatted time
 */
function updateCountdown(expirationTime) {
    const displayEl = document.getElementById('countdownDisplay');
    if (!displayEl) return;
    
    const now = new Date();
    const diff = expirationTime - now;
    
    if (diff <= 0) {
        displayEl.innerText = "00:00:00";
        displayEl.style.color = "#e74c3c";
        return 'expired';
    }
    
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((diff % (1000 * 60)) / 1000);
    
    const timeStr = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    displayEl.innerText = timeStr;
    
    // تغيير اللون عند اقتراب الانتهاء
    if (diff < 3600000) { // أقل من ساعة
        displayEl.style.color = '#e74c3c';
    } else if (diff < 7200000) { // أقل من ساعتين
        displayEl.style.color = '#f39c12';
    } else {
        displayEl.style.color = '#fff';
    }
    
    return timeStr;
}

/**
 * تعبئة بطاقة الحجز بالبيانات
 */
function populateBookingCard(data) {
    // تحديث الاسم
    const nameEl = document.getElementById('cardName');
    if (nameEl && data.name) {
        nameEl.textContent = data.name;
    }
    
    // تحديث الهاتف
    const phoneEl = document.getElementById('cardPhone');
    if (phoneEl && data.phone) {
        phoneEl.textContent = data.phone;
    }
    
    // تحديث التاريخ (تنسيق عربي)
    const dateEl = document.getElementById('cardDate');
    if (dateEl && data.date && data.date !== '----') {
        try {
            const dateObj = new Date(data.date);
            const lang = (typeof i18n !== 'undefined') ? i18n.currentLang : 'ar';
            if (lang === 'ar') {
                dateEl.textContent = dateObj.toLocaleDateString('ar-EG', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric'
                });
            } else {
                dateEl.textContent = dateObj.toLocaleDateString('en-US', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric'
                });
            }
        } catch (e) {
            dateEl.textContent = data.date;
        }
    }
    
    // تحديث المرجع - استخدام referenceNumber إن وجد
    const refEl = document.getElementById('cardRef');
    const displayRef = data.referenceNumber || data.id;
    if (refEl && displayRef) {
        refEl.textContent = displayRef;
    }
}

/**
 * حفظ بطاقة الحجز كصورة باستخدام html2canvas
 */
async function saveBookingCard() {
    const bookingCard = document.getElementById('bookingCard');
    const saveBtn = document.getElementById('saveCardBtn');
    
    if (!bookingCard) {
        console.error('Booking card element not found');
        return;
    }
    
    // تغيير نص الزر أثناء التحميل
    const originalContent = saveBtn.innerHTML;
    saveBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> جاري التحميل...';
    saveBtn.disabled = true;
    
    try {
        console.log('📸 Starting html2canvas capture...');
        
        // التقاط البطاقة كصورة
        const canvas = await html2canvas(bookingCard, {
            backgroundColor: '#0d0d0d',
            scale: 2, // جودة عالية
            useCORS: true,
            allowTaint: true,
            logging: false,
            width: bookingCard.offsetWidth,
            height: bookingCard.offsetHeight
        });
        
        console.log('📸 Canvas created successfully');
        
        // تحويل إلى blob للتحميل
        canvas.toBlob((blob) => {
            if (!blob) {
                throw new Error('Failed to create image blob');
            }
            
            // إنشاء رابط التحميل
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            
            // اسم الملف - استخدام referenceNumber إن وجد
            const refEl = document.getElementById('cardRef');
            const rawRef = refEl ? refEl.textContent.trim() : 'Corinthia';
            const cleanRef = rawRef.replace(/[^a-zA-Z0-9]/g, '_');
            link.download = `Corinthia_Booking_${cleanRef}.png`;
            
            // التحميل
            link.href = url;
            link.click();
            
            // تنظيف
            URL.revokeObjectURL(url);
            
            console.log('📸 Booking card downloaded successfully:', link.download);
            
            // رسالة نجاح
            showSaveMessage(true);
            
        }, 'image/png');
        
    } catch (error) {
        console.error('📸 Error capturing booking card:', error);
        showSaveMessage(false);
    } finally {
        // إعادة الزر لحالته الأصلية
        saveBtn.innerHTML = originalContent;
        saveBtn.disabled = false;
    }
}

/**
 * عرض رسالة نجاح/فشل الحفظ
 */
function showSaveMessage(success) {
    const lang = (typeof i18n !== 'undefined') ? i18n.currentLang : 'ar';
    const message = success 
        ? (lang === 'ar' ? '✅ تم حفظ بطاقة الحجز بنجاح' : '✅ Booking card saved successfully')
        : (lang === 'ar' ? '❌ حدث خطأ أثناء الحفظ' : '❌ Error saving booking card');
    
    // إنشاء عنصر الرسالة
    const toast = document.createElement('div');
    toast.style.cssText = `
        position: fixed;
        top: 20px;
        left: 50%;
        transform: translateX(-50%);
        background: ${success ? 'linear-gradient(135deg, #27ae60, #2ecc71)' : 'linear-gradient(135deg, #c0392b, #e74c3c)'};
        color: white;
        padding: 15px 30px;
        border-radius: 10px;
        font-family: 'Cairo', sans-serif;
        font-size: 14px;
        z-index: 10000;
        box-shadow: 0 4px 20px rgba(0,0,0,0.3);
        animation: slideIn 0.3s ease;
    `;
    toast.textContent = message;
    document.body.appendChild(toast);
    
    // إزالة الرسالة بعد 3 ثوانٍ
    setTimeout(() => {
        toast.style.animation = 'fadeOut 0.3s ease';
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

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

// إضافة أنيميشن CSS للحركة
const style = document.createElement('style');
style.textContent = `
    @keyframes slideIn {
        from { transform: translateX(-50%) translateY(-20px); opacity: 0; }
        to { transform: translateX(-50%) translateY(0); opacity: 1; }
    }
    @keyframes fadeOut {
        from { opacity: 1; }
        to { opacity: 0; }
    }
`;
document.head.appendChild(style);