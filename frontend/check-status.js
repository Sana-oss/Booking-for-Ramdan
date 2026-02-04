/**
 * CORINTHIA HOTEL - CHECK STATUS JAVASCRIPT
 * Luxury Booking Status Tracking Page
 */

// API Configuration
const getApiUrl = () => {
    if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
        return 'http://localhost:5000';
    }
    return '';
};

const API_BASE = getApiUrl();
const BOOKING_ITEM_URL = (id) => API_BASE ? `${API_BASE}/api/bookings/${id}` : `/api/bookings/${id}`;

let countdownInterval = null;

/**
 * Clean and validate check-status input
 * Converts to uppercase, removes non-alphanumeric chars, limits to 8 chars
 */
function cleanCheckStatusInput(input) {
    let value = input.value.toUpperCase();
    value = value.replace(/[^A-Z0-9\-]/g, '');  // Allow alphanumeric and hyphens
    if (value.length > 10) {
        value = value.slice(0, 10);  // Limit to 10 chars
    }
    input.value = value;
}

/**
 * Main function to track booking status
 */
async function performTrack() {
    const idInput = document.getElementById('bookingID');
    const id = idInput.value.trim();
    
    if (!id) {
        const isAr = currentLang === 'ar';
        alert(isAr ? 'يرجى إدخال الرقم المرجعي' : 'Please enter the reference number');
        return;
    }

    // Validate booking ID format
    const isNumericId = /^[0-9]{10,}$/.test(id);
    const isMongoId = id.length === 24 && /^[a-f0-9]+$/.test(id.toLowerCase());
    const isRefNumber = /^CRT-[A-Z0-9]{4}$/i.test(id);
    
    if (!isNumericId && !isMongoId && !isRefNumber) {
        const isAr = currentLang === 'ar';
        alert(isAr 
            ? 'يرجى إدخال رقم الحجز الصحيح (مثال: CRT-ABCD)' 
            : 'Please enter a valid booking ID (e.g., CRT-ABCD)');
        return;
    }

    try {
        const response = await fetch(BOOKING_ITEM_URL(id));
        
        if (!response.ok) {
            const isAr = currentLang === 'ar';
            alert(isAr ? 'الحجز غير موجود' : 'Booking Not Found');
            return;
        }
        
        const result = await response.json();
        
        if (!result?.success || !result?.data) {
            const isAr = currentLang === 'ar';
            alert(isAr ? 'الحجز غير موجود' : 'Booking Not Found');
            return;
        }

        const booking = result.data;
        
        // Show result section with animation
        showResultSection(booking);

    } catch (err) {
        console.error('Fetch Error:', err);
        const isAr = currentLang === 'ar';
        alert(isAr ? 'حدث خطأ في الاتصال بالخادم' : 'Connection Error to Server');
    }
}

// Store current booking data for pass download and language switching
let currentBookingData = null;

/**
 * Update all UI content with current language
 * Called when language changes
 */
function updateUIContent() {
    if (!currentBookingData) return;
    
    // Update booking details
    updateBookingDetails(currentBookingData);
    
    // Update instruction card
    updateInstructionCard(currentBookingData.status, currentBookingData);
    
    // Update status timeline
    updateStatusTimeline(currentBookingData.status);
    
    // Update status badge
    updateStatusBadge(currentBookingData.status);
    
    // Update downloadable pass
    populateDownloadPass(currentBookingData);
    
    // Update text direction for static elements
    updateTextDirection();
}

// Listen for language changes
window.addEventListener('languageChanged', updateUIContent);

/**
 * Check if booking is expired and update status if needed
 */
async function checkAndUpdateExpiredBooking(booking) {
    const statusLower = (booking.status || '').toLowerCase();
    
    // Only check for Pending bookings
    if (statusLower !== 'pending') {
        return booking;
    }
    
    // Check if booking has expired (24-hour rule)
    const now = new Date();
    let expiresAt = booking.expiresAt;
    
    // If expiresAt is a string, convert to Date
    if (typeof expiresAt === 'string') {
        expiresAt = new Date(expiresAt);
    }
    
    // If still no expiresAt, calculate from createdAt
    if (!expiresAt || isNaN(expiresAt.getTime())) {
        const createdAt = booking.createdAt ? new Date(booking.createdAt) : new Date();
        expiresAt = new Date(createdAt.getTime() + 24 * 60 * 60 * 1000);
    }
    
    // Check if expired
    if (now >= expiresAt) {
        // Booking has expired, update status to Cancelled
        const isAr = currentLang === 'ar';
        
        try {
            const response = await fetch(BOOKING_ITEM_URL(booking.referenceNumber || booking._id || booking.id), {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ status: 'Cancelled', reason: 'Auto-expired after 24 hours' })
            });
            
            if (response.ok) {
                booking.status = 'Cancelled';
                console.log('🔄 Booking automatically cancelled after 24-hour expiration');
            }
        } catch (error) {
            console.error('Failed to update expired booking:', error);
        }
    }
    
    return booking;
}

/**
 * Show the result section with luxury animations
 */
async function showResultSection(booking) {
    const searchSection = document.getElementById('searchSection');
    const resultSection = document.getElementById('resultSection');
    
    // Check and update expired booking
    booking = await checkAndUpdateExpiredBooking(booking);
    
    // Store booking data for pass download
    currentBookingData = booking;
    
    // Hide search section
    searchSection.style.display = 'none';
    
    // Update booking details
    updateBookingDetails(booking);
    
    // Populate downloadable pass
    populateDownloadPass(booking);
    
    // Show result section
    resultSection.style.display = 'block';
    resultSection.classList.add('fade-in-up');
    
    // Update status timeline
    updateStatusTimeline(booking.status);
    
    // Update instruction card based on status (pass booking for expiresAt access)
    updateInstructionCard(booking.status, booking);
}

/**
 * Update booking details on the card
 */
function updateBookingDetails(booking) {
    const lang = currentLang || 'ar';
    
    // Reference number
    const displayRef = booking.referenceNumber || booking._id || booking.id;
    document.getElementById('cardRef').textContent = displayRef;
    
    // Guest name
    document.getElementById('cardName').textContent = booking.name || '----';
    
    // Date
    if (booking.date) {
        const dateObj = new Date(booking.date);
        if (lang === 'ar') {
            document.getElementById('cardDate').textContent = dateObj.toLocaleDateString('ar-LY', {
                year: 'numeric', month: 'long', day: 'numeric'
            });
        } else {
            document.getElementById('cardDate').textContent = dateObj.toLocaleDateString('en-GB', {
                year: 'numeric', month: 'long', day: 'numeric'
            });
        }
    }
    
    // Guest count
    document.getElementById('cardGuests').textContent = booking.numberOfSeats || booking.guests || 1;
    
    // Update status badge
    updateStatusBadge(booking.status);
}

/**
 * Update status timeline based on booking status
 */
function updateStatusTimeline(status) {
    const stepReceived = document.getElementById('stepReceived');
    const stepPayment = document.getElementById('stepPayment');
    const stepConfirmed = document.getElementById('stepConfirmed');
    
    const statusLower = (status || 'Pending').toLowerCase();
    
    // Reset all steps
    stepReceived.classList.remove('active', 'current');
    stepPayment.classList.remove('active', 'current');
    stepConfirmed.classList.remove('active', 'current');
    
    if (statusLower === 'confirmed') {
        // All steps completed
        stepReceived.classList.add('active');
        stepPayment.classList.add('active');
        stepConfirmed.classList.add('active');
    } else if (statusLower === 'cancelled') {
        // Only received step is active
        stepReceived.classList.add('active');
    } else {
        // Pending - received and payment steps
        stepReceived.classList.add('active');
        stepPayment.classList.add('current');
    }
}

/**
 * Update instruction card based on booking status
 */
function updateInstructionCard(status, booking = null) {
    const isAr = currentLang === 'ar';
    const card = document.getElementById('paymentInstructions');
    const icon = document.getElementById('instructionIcon');
    const title = document.getElementById('instructionTitle');
    const message = document.getElementById('instructionMessage');
    const timer = document.getElementById('instructionTimer');
    const action = document.getElementById('instructionAction');
    
    const statusLower = (status || 'pending').toLowerCase();
    
    // Get translated instruction based on status
    const instrKey = `instr_${statusLower}`;
    const instructionText = (i18n?.translations?.[currentLang || 'ar']?.[instrKey]) || 
                           (isAr ? 'يرجى مراجعة حالتكم لاحقاً' : 'Please check your status later');
    
    // Reset classes
    card.classList.remove('pending', 'confirmed', 'cancelled');
    
    if (statusLower === 'confirmed') {
        // CONFIRMED - Gold/Welcome theme
        card.classList.add('confirmed');
        icon.className = 'fas fa-star';
        icon.style.color = '#2ecc71';
        title.textContent = i18n?.translations?.[currentLang || 'ar']?.label_welcome || (isAr ? 'مرحباً بكم' : 'Welcome');
        message.textContent = instructionText;
        
        // Hide timer completely for confirmed bookings
        timer.style.display = 'none';
        
        // Show hotel location button
        action.innerHTML = `
            <a href="https://maps.google.com/?q=Corinthia+Hotel+Tripoli" target="_blank" class="btn-instruction" style="display: inline-flex; align-items: center; gap: 8px; padding: 12px 24px; border-radius: 8px; font-family: 'Cairo', sans-serif; font-size: 0.9rem; font-weight: 600; text-decoration: none; transition: all 0.3s ease; background: rgba(46, 204, 113, 0.2); border: 1px solid #2ecc71; color: #2ecc71;">
                <i class="fas fa-hotel"></i>
                <span>${i18n?.translations?.[currentLang || 'ar']?.label_hotel_location || (isAr ? 'موقع الفندق' : 'Hotel Location')}</span>
            </a>
        `;
        
    } else if (statusLower === 'cancelled') {
        // CANCELLED - Grey/New Booking theme
        card.classList.add('cancelled');
        icon.className = 'fas fa-calendar-plus';
        icon.style.color = '#95a5a6';
        title.textContent = i18n?.translations?.[currentLang || 'ar']?.label_new_booking || (isAr ? 'حجز جديد' : 'New Booking');
        message.textContent = instructionText;
        
        // Remove timer
        timer.style.display = 'none';
        
        // Show new booking button
        action.innerHTML = `
            <a href="index.html" class="btn-instruction" style="display: inline-flex; align-items: center; gap: 8px; padding: 14px 28px; border-radius: 8px; font-family: 'Cairo', sans-serif; font-size: 0.95rem; font-weight: 700; text-decoration: none; transition: all 0.3s ease; background: linear-gradient(135deg, var(--corinthia-gold) 0%, var(--corinthia-gold-dark) 100%); border: none; color: #1a0a0a;">
                <i class="fas fa-plus"></i>
                <span>${i18n?.translations?.[currentLang || 'ar']?.label_book_now || (isAr ? 'احجز الآن' : 'Book Now')}</span>
            </a>
        `;
        
    } else {
        // PENDING - Amber/Urgent theme
        card.classList.add('pending');
        icon.className = 'fas fa-hotel';
        icon.style.color = '#f39c12';
        title.textContent = i18n?.translations?.[currentLang || 'ar']?.label_pending_payment || (isAr ? 'بانتظار الدفع' : 'Pending Payment');
        message.textContent = instructionText;
        
        // Show timer
        timer.style.display = 'flex';
        
        // Show hotel location button
        action.innerHTML = `
            <a href="https://maps.google.com/?q=Corinthia+Hotel+Tripoli" target="_blank" class="btn-instruction" style="display: inline-flex; align-items: center; gap: 8px; padding: 12px 24px; border-radius: 8px; font-family: 'Cairo', sans-serif; font-size: 0.9rem; font-weight: 600; text-decoration: none; transition: all 0.3s ease; background: rgba(243, 156, 18, 0.2); border: 1px solid #f39c12; color: #f39c12;">
                <i class="fas fa-map-marker-alt"></i>
                <span>${i18n?.translations?.[currentLang || 'ar']?.label_hotel_location || (isAr ? 'موقع الفندق' : 'Hotel Location')}</span>
            </a>
        `;
        
        // Start countdown with the booking's expiresAt or calculate from createdAt
        let expiresAt = null;
        if (booking && booking.expiresAt) {
            expiresAt = booking.expiresAt;
        } else if (booking && booking.createdAt) {
            const createdAt = new Date(booking.createdAt);
            expiresAt = new Date(createdAt.getTime() + 24 * 60 * 60 * 1000);
        }
        startCountdown(expiresAt);
    }
}

/**
 * Update status badge
 */
function updateStatusBadge(status) {
    const badge = document.getElementById('statusBadge');
    const statusLower = (status || 'Pending').toLowerCase();
    const isAr = currentLang === 'ar';
    
    badge.classList.remove('pending', 'confirmed', 'cancelled');
    
    if (statusLower === 'confirmed') {
        badge.classList.add('confirmed');
        badge.innerHTML = '<i class="fas fa-check-circle"></i> <span>' + 
            (isAr ? 'تم التأكيد' : 'Confirmed') + '</span>';
    } else if (statusLower === 'cancelled') {
        badge.classList.add('cancelled');
        badge.innerHTML = '<i class="fas fa-times-circle"></i> <span>' + 
            (isAr ? 'ملغى' : 'Cancelled') + '</span>';
    } else {
        badge.classList.add('pending');
        badge.innerHTML = '<i class="fas fa-clock"></i> <span>' + 
            (isAr ? 'قيد التأكيد' : 'Pending Confirmation') + '</span>';
    }
}

/**
 * Start countdown timer
 */
function startCountdown(expiresAt) {
    let expireDate;
    if (expiresAt) {
        expireDate = new Date(expiresAt);
    } else {
        expireDate = new Date();
        expireDate.setHours(expireDate.getHours() + 24);
    }
    
    const timerEl = document.getElementById('instructionTimer');
    
    function updateTimer() {
        const now = new Date();
        const diff = expireDate - now;
        
        if (diff <= 0) {
            if (timerEl) timerEl.querySelector('span').textContent = '00:00:00';
            if (countdownInterval) {
                clearInterval(countdownInterval);
                countdownInterval = null;
            }
            return;
        }
        
        const hours = Math.floor(diff / (1000 * 60 * 60));
        const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((diff % (1000 * 60)) / 1000);
        
        const timeStr = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
        
        if (timerEl) timerEl.querySelector('span').textContent = timeStr;
    }
    
    updateTimer();
    countdownInterval = setInterval(updateTimer, 1000);
}

/**
 * Populate the downloadable pass with booking data
 */
function populateDownloadPass(booking) {
    const lang = currentLang || 'ar';
    
    // Reference Number
    const displayRef = booking.referenceNumber || booking._id || booking.id;
    document.getElementById('passRefNumber').textContent = displayRef;
    document.getElementById('passQR').innerHTML = displayRef.substring(0, 3) + '<br>' + displayRef.substring(3);
    
    // Guest Name
    document.getElementById('passGuestName').textContent = booking.name || '----';
    
    // Date
    if (booking.date) {
        const dateObj = new Date(booking.date);
        if (lang === 'ar') {
            document.getElementById('passDate').textContent = dateObj.toLocaleDateString('ar-LY', {
                year: 'numeric', month: 'long', day: 'numeric'
            });
        } else {
            document.getElementById('passDate').textContent = dateObj.toLocaleDateString('en-GB', {
                year: 'numeric', month: 'long', day: 'numeric'
            });
        }
    } else {
        document.getElementById('passDate').textContent = '----';
    }
    
    // Time (use booking.time if available, otherwise default)
    const time = booking.time || '19:00';
    document.getElementById('passTime').textContent = time;
    
    // Guests
    document.getElementById('passGuests').textContent = booking.numberOfSeats || booking.guests || 1;
    
    // Status
    const statusLower = (booking.status || 'Pending').toLowerCase();
    const statusBadge = document.getElementById('passStatus');
    const statusText = document.getElementById('passStatusBadge');
    
    statusBadge.classList.remove('pending', 'confirmed', 'cancelled');
    
    if (statusLower === 'confirmed') {
        statusBadge.classList.add('confirmed');
        statusText.textContent = 'CONFIRMED';
    } else if (statusLower === 'cancelled') {
        statusBadge.classList.add('cancelled');
        statusText.textContent = 'CANCELLED';
    } else {
        statusBadge.classList.add('pending');
        statusText.textContent = 'PENDING';
    }
}

/**
 * Save booking pass - entry point called from HTML button
 */
async function saveBookingPass() {
    // First populate the pass template with stored booking data
    if (currentBookingData) {
        populateDownloadPass(currentBookingData);
    }
    
    // Call the capture function
    await saveBookingCard();
}

/**
 * Save downloadable pass as image using html2canvas
 * Modified version for check-status page to capture #downloadablePass
 */
async function saveBookingCard() {
    const passElement = document.getElementById('downloadablePass');
    const saveBtn = document.getElementById('savePassBtn');
    
    if (!passElement) {
        console.error('Downloadable pass element not found');
        const isAr = currentLang === 'ar';
        alert(isAr ? 'عنصر البطاقة غير موجود' : 'Pass element not found');
        return;
    }
    
    // Show loading state on button
    const originalContent = saveBtn ? saveBtn.innerHTML : '';
    if (saveBtn) {
        saveBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> ' + (currentLang === 'ar' ? 'جاري التحميل...' : 'Loading...');
        saveBtn.disabled = true;
    }
    
    try {
        console.log('📸 Starting html2canvas capture for downloadable pass...');
        
        // Temporarily show the element for capture
        passElement.style.display = 'block';
        
        // Capture the pass as image
        const canvas = await html2canvas(passElement, {
            backgroundColor: '#1a0a0a',
            scale: 3, // High quality for print
            useCORS: true,
            allowTaint: true,
            logging: false,
            width: passElement.offsetWidth,
            height: passElement.offsetHeight
        });
        
        console.log('📸 Canvas created successfully');
        
        // Convert to blob for download
        canvas.toBlob((blob) => {
            if (!blob) {
                throw new Error('Failed to create image blob');
            }
            
            // Create download link
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            
            // File name - use reference number
            const refEl = document.getElementById('passRefNumber');
            const rawRef = refEl ? refEl.textContent.trim() : 'Corinthia';
            const cleanRef = rawRef.replace(/[^a-zA-Z0-9]/g, '_');
            link.download = `Corinthia_Booking_Pass_${cleanRef}.png`;
            
            // Download
            link.href = url;
            link.click();
            
            // Cleanup
            URL.revokeObjectURL(url);
            
            console.log('📸 Booking pass downloaded successfully:', link.download);
            
            // Show success message
            const isAr = currentLang === 'ar';
            alert(isAr ? '✅ تم حفظ بطاقة الحجز بنجاح' : '✅ Booking pass saved successfully');
            
        }, 'image/png');
        
    } catch (error) {
        console.error('📸 Error capturing booking pass:', error);
        const isAr = currentLang === 'ar';
        alert(isAr ? '❌ حدث خطأ أثناء الحفظ' : '❌ Error saving booking pass');
    } finally {
        // Restore button state
        if (saveBtn) {
            saveBtn.innerHTML = originalContent;
            saveBtn.disabled = false;
        }
    }
}
