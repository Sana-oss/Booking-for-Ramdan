/**
 * CORINTHIA HOTEL - CHECK STATUS JAVASCRIPT
 * Dynamic Booking Status Tracking with Live Polling
 * Full i18n Support
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
    // Initialize i18n first
    i18n.init();
    
    // Set currentLang from i18n
    currentLang = i18n.getLang();
    
    // Reveal card
    setTimeout(() => {
        const mainCard = document.getElementById('mainCard');
        if (mainCard) {
            mainCard.classList.add('visible');
        }
    }, 100);
    
    // Check for booking ID in URL
    const urlParams = new URLSearchParams(window.location.search);
    const bookingId = urlParams.get('id');
    
    if (bookingId) {
        document.getElementById('bookingID').value = bookingId;
        performTrack();
    }
    
    // Listen for language changes
    window.addEventListener('languageChanged', (e) => {
        currentLang = e.detail.lang;
        if (currentBookingData) {
            updateUIByStatus(currentBookingData);
        }
    });
});

// ============================================
// LANGUAGE TOGGLE
// ============================================

function toggleLanguage() {
    i18n.toggleLang();
    currentLang = i18n.getLang();
}

// ============================================
// MAIN TRACK FUNCTION
// ============================================

async function performTrack() {
    const idInput = document.getElementById('bookingID');
    const id = idInput.value.trim();
    const errorEl = document.getElementById('errorMessage');
    const dict = i18n.translations[currentLang];
    
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
    errorEl.classList.add('show');
    
    const p = errorEl.querySelector('p');
    const dict = i18n.translations[currentLang];
    p.textContent = dict.error_not_found || 'Booking data not found. Please try again later.';
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
    const dict = i18n.translations[currentLang];
    
    // DOM Elements
    const guestNameEl = document.getElementById('checkGuestName');
    const dateEl = document.getElementById('checkDate');
    const guestsEl = document.getElementById('checkGuests');
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
            const locale = isAr ? 'ar-EG' : 'en-US';
            dateEl.textContent = dateObj.toLocaleDateString(locale, {
                year: 'numeric',
                month: 'long',
                day: 'numeric'
            });
        } catch (e) {
            dateEl.textContent = data.date;
        }
    }
    
    if (guestsEl) {
        guestsEl.textContent = data.numberOfSeats || data.guests || 2;
    }
    
    // Update Booking ID
    if (bookingIdEl) {
        bookingIdEl.textContent = data.referenceNumber || data._id || data.id || '----';
    }
    
    // Update Status Badge
    statusBadge.classList.remove('status-pending', 'status-confirmed', 'status-cancelled');
    
    // Get translated status message
    let statusMsg = dict.instr_pending || 'Please check your status later';
    let actionBtnsHTML = '';
    
    switch (status) {
        case 'confirmed':
            // Green/black badge, show download button
            statusBadge.classList.add('status-confirmed');
            statusIcon.className = 'fas fa-check-circle';
            statusText.textContent = dict.status_confirmed || 'Confirmed';
            statusMsg = dict.booking_guaranteed || 'Your booking is guaranteed - See you soon';
            
            // Action buttons - Download Receipt
            actionBtnsHTML = `
                <button class="result-btn primary" onclick="saveBookingPass()">
                    <i class="fas fa-download"></i>
                    <span>${dict.btn_download || 'Download Receipt'}</span>
                </button>
                <a href="index.html" class="result-btn secondary">
                    <i class="fas fa-plus"></i>
                    <span>${dict.btn_new_booking || 'New Booking'}</span>
                </a>
            `;
            
            // Update timeline - all completed
            updateTimeline(3);
            break;
            
        case 'cancelled':
        case 'expired':
            // Red badge, show contact support
            statusBadge.classList.add('status-cancelled');
            statusIcon.className = 'fas fa-times-circle';
            statusText.textContent = dict.status_cancelled || 'Cancelled';
            statusMsg = dict.instr_cancelled || 'Booking cancelled due to non-payment';
            
            // Action buttons - Contact Support
            actionBtnsHTML = `
                <a href="tel:+218910100708" class="result-btn secondary">
                    <i class="fas fa-phone-alt"></i>
                    <span>${dict.need_help || 'Contact Support'}</span>
                </a>
                <a href="index.html" class="result-btn primary">
                    <i class="fas fa-plus"></i>
                    <span>${dict.btn_new_booking || 'New Booking'}</span>
                </a>
            `;
            
            // Update timeline - only first step
            updateTimeline(1);
            break;
            
        default:
        case 'pending':
            // Gold badge, show waiting message
            statusBadge.classList.add('status-pending');
            statusIcon.className = 'fas fa-clock';
            statusText.textContent = dict.status_pending || 'Pending';
            statusMsg = dict.instr_pending || 'Please check your status later';
            
            // Action buttons - Refresh
            actionBtnsHTML = `
                <button class="result-btn secondary" onclick="performTrack()">
                    <i class="fas fa-sync-alt"></i>
                    <span>${dict.btn_check || 'Refresh'}</span>
                </button>
                <a href="index.html" class="result-btn primary">
                    <i class="fas fa-plus"></i>
                    <span>${dict.btn_new_booking || 'New Booking'}</span>
                </a>
            `;
            
            // Update timeline - first two steps
            updateTimeline(2);
            break;
    }
    
    // Update status message
    if (statusMessage) {
        statusMessage.textContent = statusMsg;
    }
    
    // Update action buttons
    if (actionButtons) {
        actionButtons.innerHTML = actionBtnsHTML;
    }
}

function updateTimeline(completedSteps) {
    const step1 = document.getElementById('step1');
    const step2 = document.getElementById('step2');
    const step3 = document.getElementById('step3');
    
    if (!step1 || !step2 || !step3) return;
    
    const icon1 = step1.querySelector('.step-icon');
    const icon2 = step2.querySelector('.step-icon');
    const icon3 = step3.querySelector('.step-icon');
    
    // Reset all
    icon1.classList.remove('active', 'current');
    icon2.classList.remove('active', 'current');
    icon3.classList.remove('active', 'current');
    
    if (completedSteps >= 1) {
        icon1.classList.add('active');
    }
    
    if (completedSteps >= 2) {
        icon2.classList.add('active');
    }
    
    if (completedSteps >= 3) {
        icon3.classList.add('active');
    }
}

// ============================================
// DOWNLOADABLE PASS
// ============================================

function populateDownloadPass(booking) {
    const isAr = currentLang === 'ar';
    
    // Reference
    const displayRef = booking.referenceNumber || booking._id || booking.id || '----';
    const passRefEl = document.getElementById('passReference');
    if (passRefEl) {
        passRefEl.textContent = displayRef;
    }
    
    // Guest Name
    const passGuestEl = document.getElementById('passGuestName');
    if (passGuestEl) {
        passGuestEl.textContent = booking.name || '----';
    }
    
    // Date
    if (booking.date) {
        const passDateEl = document.getElementById('passDate');
        if (passDateEl) {
            try {
                const dateObj = new Date(booking.date);
                const locale = isAr ? 'ar-EG' : 'en-US';
                passDateEl.textContent = dateObj.toLocaleDateString(locale, {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric'
                });
            } catch (e) {
                passDateEl.textContent = booking.date;
            }
        }
    }
    
    // Guests
    const passGuestsEl = document.getElementById('passGuests');
    if (passGuestsEl) {
        passGuestsEl.textContent = booking.numberOfSeats || booking.guests || 2;
    }
    
    // Status - QR code is now static (corinthia_qr.svg)
    const statusLower = (booking.status || 'pending').toLowerCase();
    const statusBox = document.getElementById('passStatusBox');
    const statusText = document.getElementById('passStatusText');
    
    if (statusBox && statusText) {
        statusBox.classList.remove('pending', 'confirmed', 'cancelled');
        
        if (statusLower === 'confirmed') {
            statusBox.style.background = 'rgba(39, 174, 96, 0.15)';
            statusBox.style.borderColor = '#2ecc71';
            statusText.textContent = 'CONFIRMED';
            statusText.style.color = '#27ae60';
        } else if (statusLower === 'cancelled') {
            statusBox.style.background = 'rgba(231, 76, 60, 0.15)';
            statusBox.style.borderColor = '#e74c3c';
            statusText.textContent = 'CANCELLED';
            statusText.style.color = '#c0392b';
        } else {
            statusBox.style.background = 'rgba(243, 156, 18, 0.15)';
            statusBox.style.borderColor = '#f39c12';
            statusText.textContent = 'PENDING';
            statusText.style.color = '#d35400';
        }
    }
    
    console.log('📋 Pass populated with static QR code');
}

async function saveBookingPass() {
    const booking = currentBookingData;
    if (!booking) {
        console.error('No booking data found');
        alert('No booking data found');
        return;
    }
    
    const passElement = document.getElementById('downloadablePass');
    
    if (!passElement) {
        console.error('Pass element not found');
        alert('Pass element not found');
        return;
    }
    
    try {
        console.log('📥 Starting pass generation...');
        
        // First, populate all pass data
        populateDownloadPass(booking);
        
        // Wait 200ms for QR code and texts to fully render
        await new Promise(resolve => setTimeout(resolve, 200));
        
        console.log('🎨 Capturing pass with html2canvas...');
        
        // Use html2canvas to capture the pass with proper settings
        const canvas = await html2canvas(passElement, {
            scale: 2,
            backgroundColor: '#FFFFFF',
            useCORS: true,
            allowTaint: true,
            logging: true
        });
        
        console.log('✅ Canvas captured successfully');
        
        // Convert to data URL
        const dataURL = canvas.toDataURL('image/png');
        
        console.log('📄 Data URL length:', dataURL.length);
        
        // Verify the data URL is valid
        if (!dataURL || dataURL.length < 100) {
            throw new Error('Invalid canvas data URL generated');
        }
        
        // Export to PNG
        const displayRef = booking.referenceNumber || booking._id || booking.id || 'pass';
        const link = document.createElement('a');
        link.href = dataURL;
        link.download = `booking-pass-${displayRef}.png`;
        
        // Trigger download
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        console.log('✅ Booking pass downloaded successfully:', link.download);
    } catch (error) {
        console.error('❌ Error generating pass:', error);
        alert('Error generating pass. Please try again.\nDetails: ' + error.message);
    }
}

// ============================================
// EVENT LISTENERS
// ============================================

const bookingIDInput = document.getElementById('bookingID');
if (bookingIDInput) {
    bookingIDInput.addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            performTrack();
        }
    });
}

// Cleanup on page unload
window.addEventListener('beforeunload', () => {
    stopPolling();
    if (countdownInterval) {
        clearInterval(countdownInterval);
    }
});
