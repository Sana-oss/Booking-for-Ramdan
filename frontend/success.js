/**
 * CORINTHIA HOTEL - SUCCESS PAGE SCRIPT
 * Smooth Reveal + Live Status
 */

document.addEventListener('DOMContentLoaded', () => {
    console.log('🚀 Page initializing...');
    
    // Get booking ID from URL
    const urlParams = new URLSearchParams(window.location.search);
    const bookingId = urlParams.get('id');
    const urlRef = urlParams.get('ref');
    
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
    
    // Initialize UI immediately
    initializeUI();
    
    // Fetch from API if ID exists, otherwise use localStorage
    if (bookingId) {
        console.log('📡 Fetching from API...');
        fetchBookingData(bookingId).then(() => {
            // API response received, now show the card
            revealCard();
        });
    } else {
        console.log('💾 Using localStorage data...');
        // Use localStorage data immediately
        revealCard();
    }
});

// ============================================
// INITIALIZE UI
// ============================================

function initializeUI() {
    // Initialize translation system
    if (typeof i18n !== 'undefined') {
        i18n.init();
    }
    
    // Get booking data
    const urlParams = new URLSearchParams(window.location.search);
    const bookingId = urlParams.get('id');
    const urlRef = urlParams.get('ref');
    
    let bookingData = {
        name: localStorage.getItem('bookingName') || '',
        phone: localStorage.getItem('bookingPhone') || '',
        date: localStorage.getItem('bookingDate') || '',
        id: bookingId || localStorage.getItem('bookingNumericId') || '',
        referenceNumber: urlRef || localStorage.getItem('bookingReferenceNumber') || '',
        expiresAt: null,
        status: 'pending'
    };
    
    // Populate UI with available data
    populateUI(bookingData);
    
    // Initialize status badge
    updateStatusBadge('pending');
}

// ============================================
// POPULATE UI
// ============================================

function populateUI(data) {
    console.log('📝 Populating UI with:', data);
    
    // Reference number
    const refEl = document.getElementById('reservationNumber');
    if (refEl) {
        const ref = data.referenceNumber || data.id || '----';
        refEl.textContent = ref;
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
// REVEAL CARD
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
        console.log('🔄 Fetching booking:', id);
        
        const response = await fetch(`/api/bookings/${id}`);
        const result = await response.json();
        
        if (result.success && result.data) {
            const booking = result.data;
            
            console.log('✅ API Response:', booking);
            
            // Update booking data
            bookingData = {
                name: booking.name || '',
                phone: booking.phone || '',
                date: booking.date || '',
                id: id,
                referenceNumber: booking.referenceNumber || id,
                expiresAt: booking.expiresAt,
                status: booking.status || 'pending'
            };
            
            // Populate UI
            populateUI(bookingData);
            
            // Update status
            updateStatusBadge(bookingData.status);
            
            // Handle countdown
            if (bookingData.status === 'pending' && booking.expiresAt) {
                startCountdown(booking.expiresAt);
            } else if (bookingData.status === 'pending') {
                startCountdownWithFallback();
            } else {
                // Hide timer for confirmed/cancelled
                const timerSection = document.getElementById('timerSection');
                if (timerSection) {
                    timerSection.classList.remove('active');
                }
            }
        }
    } catch (error) {
        console.error('❌ API Error:', error);
        // On error, show pending state with fallback
        updateStatusBadge('pending');
        startCountdownWithFallback();
    }
}

// ============================================
// STATUS BADGE
// ============================================

function updateStatusBadge(status) {
    console.log('🎨 Updating status badge:', status);
    
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
            // GREEN - Confirmed
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
            // Hide timer
            if (timerSection) {
                timerSection.classList.remove('active');
            }
            // Update title
            if (title) {
                title.textContent = lang === 'ar' ? 'مرحباً بكم في كورنثيا' : 'Welcome to Corinthia';
                title.style.color = '#27ae60';
            }
            if (subtitle) {
                subtitle.textContent = lang === 'ar' 
                    ? 'حجزكم مضمون - نراكم قريباً' 
                    : 'Your booking is guaranteed - See you soon';
            }
            // Update button
            if (btnSpan) {
                btnSpan.textContent = lang === 'ar' ? 'عرض تفاصيل الحجز' : 'View Booking Details';
            }
            break;
            
        case 'cancelled':
        case 'expired':
            // RED - Cancelled
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
            // Hide timer
            if (timerSection) {
                timerSection.classList.remove('active');
            }
            // Update title
            if (title) {
                title.textContent = lang === 'ar' ? 'نأسف لهذا الأمر' : 'We apologize';
                title.style.color = '#e74c3c';
            }
            if (subtitle) {
                subtitle.textContent = lang === 'ar' 
                    ? 'تم إلغاء الحجز لعدم إتمام الدفع' 
                    : 'Booking cancelled due to non-payment';
            }
            // Update button
            if (btnSpan) {
                btnSpan.textContent = lang === 'ar' ? 'إعادة الحجز' : 'Book Again';
            }
            break;
            
        default:
        case 'pending':
            // GOLD - Pending
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
            // Update title
            if (title) {
                title.textContent = lang === 'ar' ? 'شكراً لاختياركم كورنثيا' : 'Thank you for choosing Corinthia';
                title.style.color = 'var(--corinthia-anvil)';
            }
            if (subtitle) {
                subtitle.textContent = lang === 'ar' 
                    ? 'تم استلام طلب الحجز بنجاح' 
                    : 'Your reservation request has been received';
            }
            // Update button
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
    // Show loading first
    const displayEl = document.getElementById('countdownDisplay');
    const timerSection = document.getElementById('timerSection');
    
    if (timerSection) {
        timerSection.classList.add('active');
    }
    
    if (displayEl) {
        displayEl.innerHTML = '<span class="loading-spinner"></span>';
    }
    
    // Clear existing
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
    
    // Update immediately
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
        displayEl.style.color = '#e74c3c';
        
        // Stop and show cancelled
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
    displayEl.textContent = timeStr;
    
    // Color based on time
    if (diff < 3600000) {
        displayEl.style.color = '#e74c3c';
    } else if (diff < 7200000) {
        displayEl.style.color = '#f39c12';
    } else {
        displayEl.style.color = 'var(--corinthia-anvil)';
    }
}

// ============================================
// POLLING (Optional)
// ============================================

let pollingInterval = null;

function startPolling(bookingId) {
    if (pollingInterval) return;
    
    pollingInterval = setInterval(() => {
        fetchBookingData(bookingId);
    }, 10000); // 10 seconds
    
    console.log('🔄 Polling started');
}

function stopPolling() {
    if (pollingInterval) {
        clearInterval(pollingInterval);
        pollingInterval = null;
    }
    if (countdownInterval) {
        clearInterval(countdownInterval);
        countdownInterval = null;
    }
}

window.addEventListener('beforeunload', stopPolling);

// ============================================
// LANGUAGE UPDATE
// ============================================

function updateLanguageText() {
    // Re-apply status badge with new language
    const urlParams = new URLSearchParams(window.location.search);
    const bookingId = urlParams.get('id');
    
    if (bookingId) {
        fetchBookingData(bookingId);
    } else {
        updateStatusBadge('pending');
    }
}
