/**
 * CORINTHIA HOTEL - SUCCESS PAGE SCRIPT
 * Synced with success.html UI
 */

document.addEventListener('DOMContentLoaded', () => {
    console.log('🚀 Success page initializing...');
    
    // Get booking ID from URL
    const urlParams = new URLSearchParams(window.location.search);
    const bookingId = urlParams.get('id');
    const urlRef = urlParams.get('ref');
    
    // Initialize translation system
    if (typeof i18n !== 'undefined') {
        i18n.init();
    }
    
    // Initialize data from localStorage as fallback
    let bookingData = {
        name: localStorage.getItem('bookingName') || '',
        phone: localStorage.getItem('bookingPhone') || '',
        date: localStorage.getItem('bookingDate') || '',
        id: bookingId || localStorage.getItem('bookingNumericId') || '',
        referenceNumber: urlRef || localStorage.getItem('bookingReferenceNumber') || '',
        expiresAt: null,
        status: 'pending'
    };
    
    // Populate UI with initial data (even before API call)
    populateGuestDetails(bookingData);
    
    // Fetch from API if ID exists
    if (bookingId) {
        console.log('📡 Fetching from API:', bookingId);
        fetchBookingData(bookingId);
    } else {
        console.log('💾 Using localStorage data');
        // Show card immediately with localStorage data
        revealCard();
        startCountdownWithFallback();
    }
});

// ============================================
// POPULATE GUEST DETAILS
// ============================================

function populateGuestDetails(data) {
    // Reference number
    const refEl = document.getElementById('reservationNumber');
    if (refEl) {
        refEl.textContent = data.referenceNumber || data.id || '----';
    }
    
    // Guest name
    const nameEl = document.getElementById('guestName');
    if (nameEl) {
        nameEl.textContent = data.name || '----';
    }
    
    // Date
    const dateEl = document.getElementById('guestDate');
    if (dateEl && data.date) {
        try {
            const dateObj = new Date(data.date);
            dateEl.textContent = dateObj.toLocaleDateString('ar-EG', {
                year: 'numeric',
                month: 'long',
                day: 'numeric'
            });
        } catch (e) {
            dateEl.textContent = data.date;
        }
    } else if (dateEl) {
        dateEl.textContent = '----';
    }
    
    // Phone
    const phoneEl = document.getElementById('guestPhone');
    if (phoneEl) {
        phoneEl.textContent = data.phone || '----';
    }
}

// ============================================
// REVEAL CARD (Anti-Flicker)
// ============================================

function revealCard() {
    const card = document.getElementById('mainCard');
    if (card) {
        // Small delay to ensure DOM is ready
        setTimeout(() => {
            card.classList.add('visible');
            console.log('✨ Card revealed');
        }, 100);
    }
}

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
            
            // Populate guest details
            populateGuestDetails(booking);
            
            // Update UI by status
            updateUIByStatus(booking);
        }
    } catch (error) {
        console.error('❌ API Error:', error);
        // Fallback to pending state
        revealCard();
        updateUIByStatus({ status: 'pending' });
        startCountdownWithFallback();
    }
}

// ============================================
// UPDATE UI BY STATUS
// ============================================

function updateUIByStatus(data) {
    const status = data.status || 'pending';
    const lang = (typeof i18n !== 'undefined' && i18n.currentLang === 'en') ? 'en' : 'ar';
    
    // DOM Elements
    const badge = document.getElementById('statusBadge');
    const icon = document.getElementById('statusIcon');
    const text = document.getElementById('statusText');
    const messageText = document.getElementById('statusMessageText');
    const title = document.getElementById('mainTitle');
    const subtitle = document.getElementById('mainSubtitle');
    const btn = document.getElementById('primaryBtn');
    const btnSpan = btn ? btn.querySelector('span') : null;
    const timerContainer = document.getElementById('timerContainer');
    
    // Remove all status classes
    badge.classList.remove('status-pending', 'status-confirmed', 'status-cancelled');
    
    switch (status.toLowerCase()) {
        case 'confirmed':
            // Green badge, hide timer
            badge.classList.add('status-confirmed');
            icon.className = 'fas fa-check-circle';
            text.textContent = lang === 'ar' ? 'تم تأكيد الحجز ✓' : 'Booking Confirmed ✓';
            timerContainer.classList.remove('active');
            
            // Title and message
            title.textContent = lang === 'ar' ? 'مرحباً بكم في كورنثيا' : 'Welcome to Corinthia';
            messageText.textContent = lang === 'ar' 
                ? 'حجزكم مضمون - نراكم قريباً' 
                : 'Your booking is guaranteed - See you soon';
            
            // Button
            if (btnSpan) {
                btnSpan.textContent = lang === 'ar' ? 'عرض تفاصيل الحجز' : 'View Booking Details';
            }
            btn.href = 'check-status.html';
            
            // Reveal card
            revealCard();
            break;
            
        case 'cancelled':
        case 'expired':
            // Red badge, hide timer
            badge.classList.add('status-cancelled');
            icon.className = 'fas fa-times-circle';
            text.textContent = lang === 'ar' ? 'تم إلغاء الحجز' : 'Booking Cancelled';
            timerContainer.classList.remove('active');
            
            // Title and message
            title.textContent = lang === 'ar' ? 'نأسف لهذا الأمر' : 'We apologize';
            messageText.textContent = lang === 'ar' 
                ? 'تم إلغاء الحجز لعدم إتمام الدفع' 
                : 'Booking cancelled due to non-payment';
            
            // Button
            if (btnSpan) {
                btnSpan.textContent = lang === 'ar' ? 'إعادة الحجز' : 'Book Again';
            }
            btn.href = 'index.html';
            
            // Reveal card
            revealCard();
            break;
            
        default:
        case 'pending':
            // Gold badge, show timer
            badge.classList.add('status-pending');
            icon.className = 'fas fa-clock';
            text.textContent = lang === 'ar' ? 'بانتظار التأكيد' : 'Pending Confirmation';
            
            // Title and message
            title.textContent = lang === 'ar' ? 'شكراً لاختياركم كورنثيا' : 'Thank you for choosing Corinthia';
            messageText.textContent = lang === 'ar' 
                ? 'تم استلام طلب الحجز بنجاح' 
                : 'Your reservation request has been received';
            
            // Button
            if (btnSpan) {
                btnSpan.textContent = lang === 'ar' ? 'الانتقال للدفع' : 'Go to Payment';
            }
            btn.href = 'check-status.html';
            
            // Handle countdown
            if (data.expiresAt) {
                timerContainer.classList.add('active');
                startCountdown(data.expiresAt);
            } else {
                timerContainer.classList.add('active');
                startCountdownWithFallback();
            }
            
            // Reveal card
            revealCard();
            break;
    }
    
    console.log('🎨 UI updated for status:', status);
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
    
    if (displayEl) {
        displayEl.textContent = '--:--:--';
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
        displayEl.textContent = '00:00:00';
        
        if (countdownInterval) {
            clearInterval(countdownInterval);
        }
        
        // Auto-trigger cancelled state
        updateUIByStatus({ status: 'cancelled' });
        return;
    }
    
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((diff % (1000 * 60)) / 1000);
    
    const timeStr = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    displayEl.textContent = timeStr;
}

// Cleanup on page unload
window.addEventListener('beforeunload', () => {
    if (countdownInterval) {
        clearInterval(countdownInterval);
    }
});
