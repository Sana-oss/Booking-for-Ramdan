/**
 * CORINTHIA HOTEL - CHECK STATUS JAVASCRIPT
 * Dynamic Booking Status Tracking with Live Polling
 */

// API URLs
const BOOKING_ITEM_URL = (id) => `/api/bookings/${id}`;

console.log('🔍 Check Status page loaded');

let countdownInterval = null;
let pollingInterval = null;
let currentBookingData = null;
let currentLang = 'ar';

// ============================================
// INITIALIZATION
// ============================================

document.addEventListener('DOMContentLoaded', () => {
    // Reveal card
    setTimeout(() => {
        document.getElementById('mainCard').classList.add('visible');
    }, 100);
    
    // Check for booking ID in URL
    const urlParams = new URLSearchParams(window.location.search);
    const bookingId = urlParams.get('id');
    
    if (bookingId) {
        document.getElementById('bookingID').value = bookingId;
        performTrack();
    }
});

// ============================================
// LANGUAGE TOGGLE
// ============================================

function toggleLanguage() {
    currentLang = currentLang === 'ar' ? 'en' : 'ar';
    document.getElementById('langText').textContent = currentLang === 'ar' ? 'العربية' : 'English';
    document.body.dir = currentLang === 'ar' ? 'rtl' : 'ltr';
    document.documentElement.lang = currentLang;
    
    // Update UI content if booking is loaded
    if (currentBookingData) {
        updateUIByStatus(currentBookingData);
    }
}

// ============================================
// MAIN TRACK FUNCTION
// ============================================

async function performTrack() {
    const idInput = document.getElementById('bookingID');
    const id = idInput.value.trim();
    const errorEl = document.getElementById('errorMessage');
    
    // Hide error
    errorEl.classList.remove('show');
    
    if (!id) {
        showError();
        return;
    }
    
    // Validate booking ID format
    const isNumericId = /^[0-9]{10,}$/.test(id);
    const isMongoId = id.length === 24 && /^[a-f0-9]+$/.test(id.toLowerCase());
    const isRefNumber = /^CRT-[A-Z0-9]{4}$/i.test(id);
    
    if (!isNumericId && !isMongoId && !isRefNumber) {
        const msg = currentLang === 'ar' 
            ? 'يرجى إدخال رقم الحجز الصحيح (مثال: CRT-ABCD)' 
            : 'Please enter a valid booking ID (e.g., CRT-ABCD)';
        alert(msg);
        return;
    }
    
    try {
        const response = await fetch(BOOKING_ITEM_URL(id));
        
        if (!response.ok) {
            showError();
            return;
        }
        
        const result = await response.json();
        
        if (!result?.success || !result?.data) {
            showError();
            return;
        }
        
        const booking = result.data;
        currentBookingData = booking;
        
        // Show result section
        showResultSection(booking);
        
        // Start polling every 10 seconds
        startPolling(id);
        
    } catch (err) {
        console.error('Fetch Error:', err);
        showError();
    }
}

// ============================================
// ERROR HANDLING
// ============================================

function showError() {
    const errorEl = document.getElementById('errorMessage');
    errorEl.classList.add('show');
    
    const p = errorEl.querySelector('p');
    p.textContent = currentLang === 'ar'
        ? 'تعذر العثور على بيانات الحجز، يرجى المحاولة لاحقاً'
        : 'Booking data not found. Please try again later.';
}

// ============================================
// POLLING (LIVE STATUS UPDATES)
// ============================================

function startPolling(bookingId) {
    if (pollingInterval) {
        clearInterval(pollingInterval);
    }
    
    console.log('🔄 Starting polling for booking:', bookingId);
    
    // Poll every 10 seconds
    pollingInterval = setInterval(async () => {
        try {
            const response = await fetch(BOOKING_ITEM_URL(bookingId));
            
            if (!response.ok) {
                console.warn('Polling: Booking not found');
                return;
            }
            
            const result = await response.json();
            
            if (result?.success && result?.data) {
                const booking = result.data;
                
                // Check if status changed
                if (currentBookingData && booking.status !== currentBookingData.status) {
                    console.log('📊 Status changed:', currentBookingData.status, '→', booking.status);
                    
                    // If confirmed, stop polling
                    if (booking.status.toLowerCase() === 'confirmed') {
                        stopPolling();
                    }
                }
                
                currentBookingData = booking;
                updateUIByStatus(booking);
            }
        } catch (err) {
            console.error('Polling error:', err);
        }
    }, 10000); // 10 seconds
}

function stopPolling() {
    if (pollingInterval) {
        clearInterval(pollingInterval);
        pollingInterval = null;
        console.log('⏹️ Polling stopped');
    }
}

// ============================================
// UI UPDATES
// ============================================

function showResultSection(booking) {
    const searchSection = document.getElementById('searchSection');
    const resultSection = document.getElementById('resultSection');
    
    // Hide search, show results
    searchSection.style.display = 'none';
    resultSection.classList.add('show');
    
    // Update all UI elements
    updateUIByStatus(booking);
    
    // Populate downloadable pass
    populateDownloadPass(booking);
}

function updateUIByStatus(data) {
    const status = (data.status || 'pending').toLowerCase();
    const isAr = currentLang === 'ar';
    
    // DOM Elements
    const guestNameEl = document.getElementById('checkGuestName');
    const dateEl = document.getElementById('checkDate');
    const bookingIdEl = document.getElementById('checkBookingID');
    const statusBadge = document.getElementById('checkStatusBadge');
    const statusIcon = document.getElementById('statusIcon');
    const statusText = document.getElementById('statusText');
    const statusMessage = document.getElementById('statusMessage');
    const actionButtons = document.getElementById('actionButtons');
    
    // Update Guest Details
    if (guestNameEl) {
        guestNameEl.textContent = data.name || '----';
    }
    
    if (dateEl && data.date) {
        try {
            const dateObj = new Date(data.date);
            dateEl.textContent = dateObj.toLocaleDateString(isAr ? 'ar-EG' : 'en-GB', {
                year: 'numeric',
                month: 'long',
                day: 'numeric'
            });
        } catch (e) {
            dateEl.textContent = data.date;
        }
    }
    
    // Update Booking ID
    if (bookingIdEl) {
        bookingIdEl.textContent = data.referenceNumber || data._id || data.id || '----';
    }
    
    // Update Status Badge
    statusBadge.classList.remove('status-pending', 'status-confirmed', 'status-cancelled');
    
    switch (status) {
        case 'confirmed':
            // Green badge, show download button
            statusBadge.classList.add('status-confirmed');
            statusIcon.className = 'fas fa-check-circle';
            statusText.textContent = isAr ? 'تم تأكيد الحجز ✓' : 'Booking Confirmed ✓';
            statusMessage.textContent = isAr 
                ? 'حجزكم مضمون - نراكم قريباً' 
                : 'Your booking is guaranteed - See you soon';
            
            // Action buttons - Download Receipt
            actionButtons.innerHTML = `
                <button class="result-btn primary" onclick="saveBookingPass()">
                    <i class="fas fa-download"></i>
                    <span>${isAr ? 'تحميل إيصال الدفع' : 'Download Receipt'}</span>
                </button>
                <a href="index.html" class="result-btn secondary">
                    <i class="fas fa-plus"></i>
                    <span>${isAr ? 'حجز جديد' : 'New Booking'}</span>
                </a>
            `;
            
            // Update timeline - all completed
            document.getElementById('step1').querySelector('.step-icon').classList.add('active');
            document.getElementById('step2').querySelector('.step-icon').classList.add('active');
            document.getElementById('step3').querySelector('.step-icon').classList.add('active');
            break;
            
        case 'cancelled':
        case 'expired':
            // Red badge, show contact support
            statusBadge.classList.add('status-cancelled');
            statusIcon.className = 'fas fa-times-circle';
            statusText.textContent = isAr ? 'تم إلغاء الحجز' : 'Booking Cancelled';
            statusMessage.textContent = isAr 
                ? 'تم إلغاء الحجز لعدم إتمام الدفع' 
                : 'Booking cancelled due to non-payment';
            
            // Action buttons - Contact Support
            actionButtons.innerHTML = `
                <a href="tel:+218910100708" class="result-btn secondary">
                    <i class="fas fa-phone-alt"></i>
                    <span>${isAr ? 'اتصل بنا' : 'Contact Support'}</span>
                </a>
                <a href="index.html" class="result-btn primary">
                    <i class="fas fa-plus"></i>
                    <span>${isAr ? 'حجز جديد' : 'New Booking'}</span>
                </a>
            `;
            
            // Update timeline - only first step
            document.getElementById('step1').querySelector('.step-icon').classList.add('active');
            document.getElementById('step2').querySelector('.step-icon').classList.remove('active', 'current');
            document.getElementById('step3').querySelector('.step-icon').classList.remove('active', 'current');
            break;
            
        default:
        case 'pending':
            // Gold badge, show waiting message
            statusBadge.classList.add('status-pending');
            statusIcon.className = 'fas fa-clock';
            statusText.textContent = isAr ? 'بانتظار التأكيد' : 'Pending Confirmation';
            statusMessage.textContent = isAr 
                ? 'يرجى مراجعة حالتكم لاحقاً' 
                : 'Please check your status later';
            
            // Action buttons - Refresh
            actionButtons.innerHTML = `
                <button class="result-btn secondary" onclick="performTrack()">
                    <i class="fas fa-sync-alt"></i>
                    <span>${isAr ? 'تحديث' : 'Refresh'}</span>
                </button>
                <a href="index.html" class="result-btn primary">
                    <i class="fas fa-plus"></i>
                    <span>${isAr ? 'حجز جديد' : 'New Booking'}</span>
                </a>
            `;
            
            // Update timeline - first two steps
            document.getElementById('step1').querySelector('.step-icon').classList.add('active');
            document.getElementById('step2').querySelector('.step-icon').classList.add('current');
            document.getElementById('step3').querySelector('.step-icon').classList.remove('active', 'current');
            break;
    }
}

// ============================================
// DOWNLOADABLE PASS
// ============================================

function populateDownloadPass(booking) {
    const isAr = currentLang === 'ar';
    
    // Reference
    const displayRef = booking.referenceNumber || booking._id || booking.id || '----';
    document.getElementById('passReference').textContent = displayRef;
    
    // Guest Name
    document.getElementById('passGuestName').textContent = booking.name || '----';
    
    // Date
    if (booking.date) {
        try {
            const dateObj = new Date(booking.date);
            document.getElementById('passDate').textContent = dateObj.toLocaleDateString(isAr ? 'ar-EG' : 'en-GB', {
                year: 'numeric',
                month: 'long',
                day: 'numeric'
            });
        } catch (e) {
            document.getElementById('passDate').textContent = booking.date;
        }
    }
    
    // Guests
    document.getElementById('passGuests').textContent = booking.numberOfSeats || booking.guests || 2;
    
    // Status
    const statusLower = (booking.status || 'pending').toLowerCase();
    const statusBox = document.getElementById('passStatusBox');
    const statusText = document.getElementById('passStatusText');
    
    statusBox.classList.remove('pending', 'confirmed', 'cancelled');
    
    if (statusLower === 'confirmed') {
        statusBox.classList.add('confirmed');
        statusText.textContent = 'CONFIRMED';
    } else if (statusLower === 'cancelled') {
        statusBox.classList.add('cancelled');
        statusText.textContent = 'CANCELLED';
    } else {
        statusBox.classList.add('pending');
        statusText.textContent = 'PENDING';
    }
}

async function saveBookingPass() {
    const passElement = document.getElementById('downloadablePass');
    
    if (!passElement) {
        alert('Pass element not found');
        return;
    }
    
    try {
        const canvas = await html2canvas(passElement, {
            scale: 2,
            backgroundColor: '#ffffff',
            useCORS: true,
            logging: false
        });
        
        const link = document.createElement('a');
        link.href = canvas.toDataURL('image/png');
        link.download = `booking-pass-${currentBookingData?.referenceNumber || 'pass'}.png`;
        link.click();
    } catch (err) {
        console.error('Save pass error:', err);
        alert('Failed to save pass. Please try again.');
    }
}

// ============================================
// EVENT LISTENERS
// ============================================

document.getElementById('bookingID').addEventListener('keypress', function(e) {
    if (e.key === 'Enter') {
        performTrack();
    }
});

// Cleanup on page unload
window.addEventListener('beforeunload', () => {
    stopPolling();
    if (countdownInterval) {
        clearInterval(countdownInterval);
    }
});
