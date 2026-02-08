/**
 * CORINTHIA HOTEL - SUCCESS PAGE SCRIPT
 */

document.addEventListener('DOMContentLoaded', () => {
    console.log('🚀 Page initializing...');
    
    // Get booking ID from URL
    const urlParams = new URLSearchParams(window.location.search);
    const bookingId = urlParams.get('id');
    const urlRef = urlParams.get('ref');
    
    // Initialize translation system
    if (typeof i18n !== 'undefined') {
        i18n.init();
    }
    
    // Initialize data from localStorage
    let bookingData = {
        name: localStorage.getItem('bookingName') || '',
        phone: localStorage.getItem('bookingPhone') || '',
        date: localStorage.getItem('bookingDate') || '',
        id: bookingId || localStorage.getItem('bookingNumericId') || '',
        referenceNumber: urlRef || localStorage.getItem('bookingReferenceNumber') || '',
        expiresAt: null,
        status: 'pending'
    };
    
    // DOM Elements
    const refEl = document.getElementById('reservationNumber');
    const nameEl = document.getElementById('guestName');
    const dateEl = document.getElementById('guestDate');
    const phoneEl = document.getElementById('guestPhone');
    const badge = document.getElementById('statusBadge');
    const icon = document.getElementById('statusIcon');
    const text = document.getElementById('statusText');
    const timerSection = document.getElementById('timerSection');
    const displayEl = document.getElementById('countdownDisplay');
    
    // Update reference
    if (refEl) {
        refEl.textContent = bookingData.referenceNumber || bookingData.id || '----';
    }
    
    // Update name
    if (nameEl) {
        nameEl.textContent = bookingData.name || '----';
    }
    
    // Update date
    if (dateEl && bookingData.date) {
        try {
            const dateObj = new Date(bookingData.date);
            dateEl.textContent = dateObj.toLocaleDateString('ar-EG', {
                year: 'numeric',
                month: 'long',
                day: 'numeric'
            });
        } catch (e) {
            dateEl.textContent = bookingData.date;
        }
    } else if (dateEl) {
        dateEl.textContent = '----';
    }
    
    // Update phone
    if (phoneEl) {
        phoneEl.textContent = bookingData.phone || '----';
    }
    
    // Initialize status badge
    updateStatusBadge('pending');
    
    // Fetch from API if ID exists
    if (bookingId) {
        console.log('📡 Fetching from API:', bookingId);
        fetchBookingData(bookingId);
    } else {
        console.log('💾 Using localStorage data');
        startCountdownWithFallback();
    }
});

// ============================================
// FETCH BOOKING DATA
// ============================================

async function fetchBookingData(id) {
    try {
        const response = await fetch(`/api/bookings/${id}`);
        const result = await response.json();
        
        if (result.success && result.data) {
            const booking = result.data;
            
            console.log('✅ API Response:', booking);
            
            // Update DOM
            const refEl = document.getElementById('reservationNumber');
            const nameEl = document.getElementById('guestName');
            const dateEl = document.getElementById('guestDate');
            const phoneEl = document.getElementById('guestPhone');
            
            if (refEl) refEl.textContent = booking.referenceNumber || booking.id;
            if (nameEl) nameEl.textContent = booking.name;
            if (phoneEl) phoneEl.textContent = booking.phone;
            
            if (dateEl && booking.date) {
                try {
                    const dateObj = new Date(booking.date);
                    dateEl.textContent = dateObj.toLocaleDateString('ar-EG', {
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric'
                    });
                } catch (e) {
                    dateEl.textContent = booking.date;
                }
            }
            
            // Update status
            updateStatusBadge(booking.status);
            
            // Handle countdown
            const timerSection = document.getElementById('timerSection');
            
            if (booking.status === 'pending') {
                if (booking.expiresAt) {
                    if (timerSection) timerSection.classList.add('active');
                    startCountdown(booking.expiresAt);
                } else {
                    if (timerSection) timerSection.classList.add('active');
                    startCountdownWithFallback();
                }
            } else {
                if (timerSection) timerSection.classList.remove('active');
            }
        }
    } catch (error) {
        console.error('❌ API Error:', error);
        updateStatusBadge('pending');
        startCountdownWithFallback();
    }
}

// ============================================
// STATUS BADGE
// ============================================

function updateStatusBadge(status) {
    const badge = document.getElementById('statusBadge');
    const icon = document.getElementById('statusIcon');
    const text = document.getElementById('statusText');
    const timerSection = document.getElementById('timerSection');
    const title = document.getElementById('mainTitle');
    const subtitle = document.getElementById('mainSubtitle');
    const btn = document.getElementById('primaryBtn');
    const btnSpan = btn ? btn.querySelector('span') : null;
    
    const lang = (typeof i18n !== 'undefined' && i18n.currentLang === 'en') ? 'en' : 'ar';
    
    switch (status) {
        case 'confirmed':
            if (badge) {
                badge.style.background = 'rgba(39, 174, 96, 0.15)';
                badge.style.border = '1px solid #27ae60';
                badge.style.color = '#27ae60';
            }
            if (icon) {
                icon.className = 'fas fa-check-circle';
                icon.style.color = '#27ae60';
            }
            if (text) {
                text.textContent = lang === 'ar' ? 'تم تأكيد الحجز ✓' : 'Booking Confirmed ✓';
            }
            if (timerSection) timerSection.classList.remove('active');
            if (title) {
                title.textContent = lang === 'ar' ? 'مرحباً بكم في كورنثيا' : 'Welcome to Corinthia';
                title.style.color = '#27ae60';
            }
            if (subtitle) {
                subtitle.textContent = lang === 'ar' 
                    ? 'حجزكم مضمون - نراكم قريباً' 
                    : 'Your booking is guaranteed - See you soon';
            }
            if (btnSpan) {
                btnSpan.textContent = lang === 'ar' ? 'عرض تفاصيل الحجز' : 'View Booking Details';
            }
            break;
            
        case 'cancelled':
        case 'expired':
            if (badge) {
                badge.style.background = 'rgba(231, 76, 60, 0.15)';
                badge.style.border = '1px solid #e74c3c';
                badge.style.color = '#e74c3c';
            }
            if (icon) {
                icon.className = 'fas fa-times-circle';
                icon.style.color = '#e74c3c';
            }
            if (text) {
                text.textContent = lang === 'ar' ? 'تم إلغاء الحجز' : 'Booking Cancelled';
            }
            if (timerSection) timerSection.classList.remove('active');
            if (title) {
                title.textContent = lang === 'ar' ? 'نأسف لهذا الأمر' : 'We apologize';
                title.style.color = '#e74c3c';
            }
            if (subtitle) {
                subtitle.textContent = lang === 'ar' 
                    ? 'تم إلغاء الحجز لعدم إتمام الدفع' 
                    : 'Booking cancelled due to non-payment';
            }
            if (btnSpan) {
                btnSpan.textContent = lang === 'ar' ? 'إعادة الحجز' : 'Book Again';
            }
            break;
            
        default:
        case 'pending':
            if (badge) {
                badge.style.background = 'rgba(254, 163, 0, 0.1)';
                badge.style.border = '1px solid var(--corinthia-honey)';
                badge.style.color = 'var(--corinthia-anvil)';
            }
            if (icon) {
                icon.className = 'fas fa-clock';
                icon.style.color = 'var(--corinthia-honey)';
            }
            if (text) {
                text.textContent = lang === 'ar' ? 'بانتظار التأكيد' : 'Pending Confirmation';
            }
            if (title) {
                title.textContent = lang === 'ar' ? 'شكراً لاختياركم كورنثيا' : 'Thank you for choosing Corinthia';
                title.style.color = 'var(--corinthia-anvil)';
            }
            if (subtitle) {
                subtitle.textContent = lang === 'ar' 
                    ? 'تم استلام طلب الحجز بنجاح' 
                    : 'Your reservation request has been received';
            }
            if (btnSpan) {
                btnSpan.textContent = lang === 'ar' ? 'الانتقال للدفع' : 'Go to Payment';
            }
            break;
    }
}

// ============================================
// COUNTDOWN TIMER
// ============================================

let countdownInterval = null;

function startCountdownWithFallback() {
    const expiry = new Date();
    expiry.setHours(expiry.getHours() + 24);
    startCountdown(expiry.toISOString());
}

function startCountdown(expiresAtISO) {
    const displayEl = document.getElementById('countdownDisplay');
    const timerSection = document.getElementById('timerSection');
    
    if (timerSection) {
        timerSection.classList.add('active');
    }
    
    if (displayEl) {
        displayEl.innerHTML = '<i class="fas fa-clock" style="color: var(--corinthia-honey)"></i> <span>--:--:--</span>';
    }
    
    if (countdownInterval) {
        clearInterval(countdownInterval);
    }
    
    let expirationTime;
    if (typeof expiresAtISO === 'string') {
        expirationTime = new Date(expiresAtISO);
    } else if (expiresAtISO instanceof Date) {
        expirationTime = expiresAtISO;
    } else {
        expirationTime = new Date();
        expirationTime.setHours(expirationTime.getHours() + 24);
    }
    
    console.log('⏰ Timer starting:', expirationTime.toISOString());
    
    updateCountdown(expirationTime);
    
    countdownInterval = setInterval(() => {
        updateCountdown(expirationTime);
    }, 1000);
}

function updateCountdown(expirationTime) {
    const displayEl = document.getElementById('countdownDisplay');
    if (!displayEl) return;
    
    const now = new Date();
    const diff = expirationTime - now;
    
    if (diff <= 0) {
        displayEl.innerHTML = '<span style="color: #e74c3c">00:00:00</span>';
        if (countdownInterval) {
            clearInterval(countdownInterval);
        }
        updateStatusBadge('cancelled');
        return;
    }
    
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((diff % (1000 * 60)) / 1000);
    
    const timeStr = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    displayEl.innerHTML = `<i class="fas fa-clock" style="color: var(--corinthia-honey)"></i> <span>${timeStr}</span>`;
}
