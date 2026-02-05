/**
 * CORINTHIA HOTEL - MAIN BOOKING SCRIPT
 * المحرك الرئيسي لعملية الحجز والربط مع MongoDB
 * مع التحقق من الصحة على جانب العميل
 */

// Using relative API paths for Cloudflare Tunnel compatibility
const BOOKINGS_URL = '/api/bookings';
const AVAILABILITY_URL = (date) => `/api/bookings/availability/${date}`;

console.log('📋 Using relative API paths');

document.addEventListener('DOMContentLoaded', () => {
    const bookingForm = document.getElementById('bookingForm');
    const phoneInput = document.getElementById('phone');
    const guestsInput = document.getElementById('guests');
    const isGroupCheckbox = document.getElementById('isGroup');
    const dateInput = document.getElementById('bookingDate');
    const nameInput = document.getElementById('guestName');
    
    if (!bookingForm) {
        console.error("❌ Booking form not found in the DOM");
        return;
    }

    // ============================================
    // 0. Name Input Validation (Letters Only, Max 100 chars)
    // ============================================
    if (nameInput) {
        nameInput.addEventListener('input', function(e) {
            // Allow only letters (English & Arabic) and spaces
            const regex = /[^a-zA-Z\s\u0600-\u06FF]/g;
            if (this.value.match(regex)) {
                this.value = this.value.replace(regex, '');
            }
            
            // Visual warning when approaching 100 chars
            const borderEl = this.parentElement.querySelector('.luxury-border');
            if (this.value.length >= 100) {
                if (borderEl) borderEl.style.background = '#ff6b6b';
            } else {
                if (borderEl) borderEl.style.background = '';
            }
        });
        
        // Block paste of invalid characters
        nameInput.addEventListener('paste', function(e) {
            e.preventDefault();
            const pastedData = e.clipboardData.getData('text');
            const cleanData = pastedData.replace(/[^a-zA-Z\s\u0600-\u06FF]/g, '');
            e.target.value = (e.target.value + cleanData).substring(0, 100);
            
            // Trigger input event for validation
            e.target.dispatchEvent(new Event('input'));
        });
    }

    // ============================================
    // 1. Initialize Luxury Flatpickr Date Picker
    // ============================================
    if (dateInput && typeof flatpickr !== 'undefined') {
        // Get current language from i18n
        const currentLang = localStorage.getItem('hotel_lang') || 'ar';
        
        flatpickr("#bookingDate", {
            dateFormat: "Y-m-d",
            minDate: "today",
            locale: currentLang === 'ar' ? 'ar' : 'default',
            disableMobile: true,
            monthSelectorType: "static",
            nextArrow: "<i class='fas fa-chevron-right'></i>",
            prevArrow: "<i class='fas fa-chevron-left'></i>",
            onReady: function(selectedDates, dateStr, instance) {
                // Apply luxury styling to the calendar
                instance.calendarContainer.classList.add('luxury-flatpickr');
            }
        });
        
        console.log('📅 Luxury Flatpickr date picker initialized');
    }

    // ============================================
    // 2. Phone Number Validation (Max 13 digits, numbers only)
    // ============================================
    if (phoneInput) {
        phoneInput.addEventListener('input', function(e) {
            let value = e.target.value.replace(/[^0-9]/g, '');
            if (value.length > 13) {
                value = value.substring(0, 13);
            }
            e.target.value = value;
        });

        phoneInput.addEventListener('paste', function(e) {
            e.preventDefault();
            const pastedData = e.clipboardData.getData('text').replace(/[^0-9]/g, '');
            let currentValue = e.target.value.replace(/[^0-9]/g, '');
            let newValue = (currentValue + pastedData).substring(0, 13);
            e.target.value = newValue;
        });
    }

    // ============================================
    // 2. Group Policy Logic (Auto-check for >10 guests)
    // ============================================
    if (guestsInput && isGroupCheckbox) {
        guestsInput.addEventListener('change', function() {
            const guests = parseInt(this.value) || 0;
            
            // Auto-check group option if guests > 10
            if (guests > 10) {
                isGroupCheckbox.checked = true;
                showLuxuryFeedback(
                    i18n.currentLang === 'ar' 
                        ? 'تم تفعيل خيار الحجز الجماعي تلقائياً للطلبات لأكثر من 10 أشخاص'
                        : 'Group booking option auto-activated for parties over 10 guests',
                    'info'
                );
            }
        });
    }

    // ============================================
    // 3. Create Seats Remaining Indicator
    // ============================================
    createSeatsIndicator();
    
    // Update capacity when date changes
    if (dateInput) {
        dateInput.addEventListener('change', () => {
            updateSeatsIndicator(dateInput.value);
        });
    }

    // ============================================
    // 4. Form Submission with Validation
    // ============================================
    bookingForm.addEventListener('submit', async (event) => {
        event.preventDefault();

        // Get form values
        const name = document.getElementById('guestName').value.trim();
        const phone = document.getElementById('phone').value.trim();
        const date = document.getElementById('bookingDate').value;
        const guests = parseInt(document.getElementById('guests').value) || 0;
        const isGroup = document.getElementById('isGroup') ? document.getElementById('isGroup').checked : false;
        const notes = document.getElementById('notes') ? document.getElementById('notes').value.trim() : '';

        // ============================================
        // CLIENT-SIDE VALIDATION
        // ============================================

        // ============================================
        // PAST DATE PROTECTION (Client-side backup)
        // ============================================
        const selectedDate = new Date(date);
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        if (selectedDate < today) {
            showLuxuryFeedback(
                i18n.currentLang === 'ar'
                    ? 'يرجى اختيار تاريخ مستقبلي صحيح'
                    : 'Please select a valid future date',
                'error'
            );
            return;
        }

        // Phone validation: 10-13 digits
        if (phone.length < 10 || phone.length > 13) {
            showLuxuryFeedback(
                i18n.currentLang === 'ar'
                    ? 'يرجى إدخال رقم هاتف صحيح (10-13 رقم)'
                    : 'Please enter a valid phone number (10-13 digits)',
                'error'
            );
            document.getElementById('phone').focus();
            return;
        }

        // Name validation: no special characters
        const nameValidation = sanitizeAndValidateName(name);
        if (!nameValidation.valid) {
            showLuxuryFeedback(
                i18n.currentLang === 'ar'
                    ? nameValidation.message_ar
                    : nameValidation.message_en,
                'error'
            );
            document.getElementById('guestName').focus();
            return;
        }

        // Group Policy: >10 guests requires group checkbox
        if (guests > 10 && !isGroup) {
            showLuxuryFeedback(
                i18n.currentLang === 'ar'
                    ? 'للطلبات الأكثر من 10 أشخاص، يرجى تفعيل خيار الحجز الجماعي'
                    : 'For parties over 10 guests, please activate the group booking option',
                'warning'
            );
            document.getElementById('isGroup').focus();
            return;
        }

        // Notes validation: no special characters (if exists)
        if (notes && !sanitizeAndValidateNotes(notes)) {
            showLuxuryFeedback(
                i18n.currentLang === 'ar'
                    ? 'حقل الملاحظات يحتوي على رموز غير مسموحة'
                    : 'Notes field contains disallowed special characters',
                'error'
            );
            if (document.getElementById('notes')) {
                document.getElementById('notes').focus();
            }
            return;
        }

        // ============================================
        // Add capacity-based error message below input
        // ============================================
        const guestsInputContainer = document.getElementById('guests').parentElement;
        let capacityErrorEl = document.getElementById('capacityError');
        if (!capacityErrorEl) {
            capacityErrorEl = document.createElement('div');
            capacityErrorEl.id = 'capacityError';
            capacityErrorEl.style.cssText = `
                color: #e67e22;
                font-size: 0.8rem;
                margin-top: 5px;
                text-align: right;
                display: none;
                padding: 0 15px;
            `;
            guestsInputContainer.parentElement.insertBefore(capacityErrorEl, guestsInputContainer.nextSibling);
        }
        
        // Get language for messages
        const lang = (typeof i18n !== 'undefined') ? i18n.currentLang : 'ar';
        
        // Prepare form data with sanitized values and numberOfSeats
        const formData = {
            name: sanitizeText(name),
            phone: phone,
            date: date,
            people: guests,
            numberOfSeats: guests, // Send numberOfSeats explicitly
            group: isGroup,
            notes: sanitizeText(notes)
        };

        try {
            // Show loading state
            const submitBtn = bookingForm.querySelector('button[type="submit"]');
            setLoadingState(submitBtn, true);

            // Check capacity before submitting
            console.log(`📊 Checking capacity for date: ${date}`);
            try {
                const capacityResponse = await fetch(AVAILABILITY_URL(date));
                
                if (!capacityResponse.ok) {
                    console.warn('⚠️ Capacity check failed:', capacityResponse.status);
                } else {
                    const capacityResult = await capacityResponse.json();
                    if (capacityResult.success && capacityResult.data.isFull) {
                        capacityErrorEl.textContent = lang === 'ar'
                            ? `عذراً، لا توجد مقاعد متاحة لهذا التاريخ`
                            : `Sorry, no seats available for this date`;
                        capacityErrorEl.style.display = 'block';
                        showSweetAlert(
                            lang === 'ar' ? 'اكتمل الحجز' : 'Fully Booked',
                            lang === 'ar' 
                                ? `عذراً، لا توجد مقاعد متاحة لهذا التاريخ. يرجى اختيار تاريخ آخر.`
                                : `Sorry, this date is fully booked. Please select another date.`,
                            'error'
                        );
                        setLoadingState(submitBtn, false);
                        return;
                    }
                    
                    // Check if requested seats exceed remaining
                    if (capacityResult.success && capacityResult.data.seatsRemaining < guests) {
                        capacityErrorEl.textContent = lang === 'ar'
                            ? `عذراً، لا يمكنك حجز ${guests} مقاعد. فقط ${capacityResult.data.seatsRemaining} مقاعد متاحة.`
                            : `Sorry, you cannot book ${guests} seats. Only ${capacityResult.data.seatsRemaining} seats available.`;
                        capacityErrorEl.style.display = 'block';
                        showSweetAlert(
                            lang === 'ar' ? 'غير كافٍ' : 'Not Enough Seats',
                            lang === 'ar'
                                ? `عذراً، لا يمكنك حجز ${guests} مقاعد. فقط ${capacityResult.data.seatsRemaining} مقاعد متاحة.`
                                : `Cannot book ${guests} seats. Only ${capacityResult.data.seatsRemaining} seats available.`,
                            'warning'
                        );
                        setLoadingState(submitBtn, false);
                        return;
                    }
                    
                    // Hide error if passed
                    capacityErrorEl.style.display = 'none';
                }
            } catch (capacityError) {
                console.warn('⚠️ Could not check capacity, proceeding anyway:', capacityError);
            }

            // Send to server
            console.log('📤 Sending booking to:', BOOKINGS_URL);
            const response = await fetch(BOOKINGS_URL, {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json' 
                },
                body: JSON.stringify(formData)
            });

            console.log('📥 Booking response status:', response.status, response.statusText);

            // Check response before parsing JSON
            if (!response.ok) {
                let errorMessage = 'Server error occurred';
                let seatsInfo = null;
                try {
                    const errorResult = await response.json();
                    errorMessage = errorResult.message || errorResult.error || errorMessage;
                    seatsInfo = errorResult.seatsRemaining ? ` (${errorResult.seatsRemaining} seats remaining)` : '';
                } catch (e) {
                    console.error('Error parsing response:', e);
                }
                throw new Error(errorMessage + seatsInfo);
            }

            const result = await response.json();
            console.log('📥 Booking result:', result.success ? 'SUCCESS' : 'FAILED');
            
            // Handle successful response
            if (result.success) {
                const finalId = result.bookingId || result._id;
                const finalRef = result.referenceNumber || (finalId ? finalId.toString().slice(-8).toUpperCase() : 'CRT-0000');
                
                // حفظ بيانات الحجز في localStorage لعرضها في صفحة النجاح
                localStorage.setItem('bookingName', formData.name);
                localStorage.setItem('bookingPhone', formData.phone);
                localStorage.setItem('bookingDate', formData.date);
                localStorage.setItem('bookingNumericId', finalId.toString());
                localStorage.setItem('bookingReferenceNumber', finalRef);
                
                // Show success message with remaining capacity
                if (result.capacity) {
                    showLuxuryFeedback(
                        i18n.currentLang === 'ar'
                            ? `تم الحجز بنجاح! ${result.capacity.seatsRemaining} مقاعد متبقية لهذا التاريخ.`
                            : `Booking successful! ${result.capacity.seatsRemaining} seats remaining for this date.`,
                        'success'
                    );
                }
                
                // الانتقال لصفحة النجاح
                setTimeout(() => {
                    window.location.href = `success.html?id=${finalId}&ref=${finalRef}`;
                }, 1500);
            } else {
                throw new Error(result.message || "Server refused the booking");
            }

        } catch (error) {
            console.error("❌ Connection Error:", error);
            showLuxuryFeedback(
                i18n.currentLang === 'ar'
                    ? `عذراً، ${error.message}`
                    : `Error: ${error.message}`,
                'error'
            );
        } finally {
            // Reset button state
            const submitBtn = bookingForm.querySelector('button[type="submit"]');
            setLoadingState(submitBtn, false);
        }
    });

    /**
     * Create Seats Remaining Indicator in the form
     */
    function createSeatsIndicator() {
        // Find a good place to add the indicator (after date input or guests input)
        const guestsContainer = document.getElementById('guests')?.parentElement;
        if (!guestsContainer) return;
        
        // Create indicator element
        const indicator = document.createElement('div');
        indicator.id = 'seatsIndicator';
        indicator.className = 'seats-indicator';
        indicator.style.cssText = `
            margin-top: 10px;
            padding: 12px 15px;
            border-radius: 8px;
            font-family: 'Cairo', sans-serif;
            font-size: 14px;
            display: none;
            transition: all 0.3s ease;
        `;
        
        indicator.innerHTML = `
            <div class="seats-info" style="display: flex; align-items: center; gap: 10px;">
                <i class="fas fa-chair" style="font-size: 18px;"></i>
                <div style="flex: 1;">
                    <div class="seats-text" style="font-weight: 600;"></div>
                    <div class="seats-progress" style="height: 6px; background: rgba(255,255,255,0.2); border-radius: 3px; margin-top: 5px; overflow: hidden;">
                        <div class="seats-fill" style="height: 100%; width: 0%; transition: width 0.3s ease; border-radius: 3px;"></div>
                    </div>
                </div>
            </div>
        `;
        
        guestsContainer.parentElement.insertBefore(indicator, guestsContainer.nextSibling);
    }

    /**
     * Update Seats Remaining Indicator
     */
    async function updateSeatsIndicator(date) {
        const indicator = document.getElementById('seatsIndicator');
        if (!indicator || !date) {
            if (indicator) indicator.style.display = 'none';
            return;
        }
        
        try {
            const response = await fetch(AVAILABILITY_URL(date));
            const result = await response.json();
            
            if (result.success && result.data) {
                const data = result.data;
                const seatsRemaining = data.seatsRemaining;
                const capacityPercentage = data.capacityPercentage;
                
                indicator.style.display = 'block';
                
                const seatsText = indicator.querySelector('.seats-text');
                const seatsFill = indicator.querySelector('.seats-fill');
                
                // Update text with internationalization
                const lang = (typeof i18n !== 'undefined') ? i18n.currentLang : 'ar';
                
                if (data.isFull) {
                    indicator.style.background = 'linear-gradient(135deg, #c0392b, #e74c3c)';
                    indicator.style.border = '1px solid #e74c3c';
                    seatsText.innerHTML = lang === 'ar' 
                        ? '<span style="color: #ffcccc;">⚠️ اكتمل الحجز لهذا التاريخ</span>'
                        : '<span style="color: #ffcccc;">⚠️ Fully booked for this date</span>';
                } else if (capacityPercentage >= 80) {
                    indicator.style.background = 'linear-gradient(135deg, #d35400, #e67e22)';
                    indicator.style.border = '1px solid #e67e22';
                    seatsText.innerHTML = lang === 'ar'
                        ? `🔴 ${seatsRemaining} مقاعد متبقية (${capacityPercentage}% ممتلئ)`
                        : `🔴 ${seatsRemaining} seats remaining (${capacityPercentage}% full)`;
                } else {
                    indicator.style.background = 'linear-gradient(135deg, #27ae60, #2ecc71)';
                    indicator.style.border = '1px solid #2ecc71';
                    seatsText.innerHTML = lang === 'ar'
                        ? `🟢 ${seatsRemaining} مقاعد متبقية`
                        : `🟢 ${seatsRemaining} seats remaining`;
                }
                
                // Update progress bar
                seatsFill.style.width = `${capacityPercentage}%`;
                seatsFill.style.background = data.isFull ? '#e74c3c' : (capacityPercentage >= 80 ? '#f39c12' : '#2ecc71');
            }
        } catch (error) {
            console.warn('⚠️ Could not update seats indicator:', error);
        }
    }

    // Initialize seats indicator if date is already selected
    if (dateInput && dateInput.value) {
        updateSeatsIndicator(dateInput.value);
    }

    /**
     * Sanitize and validate name input
     * Removes special characters but allows Arabic and English letters, spaces, and dashes
     */
    function sanitizeAndValidateName(name) {
        if (!name || name.length < 3) {
            return {
                valid: false,
                message_ar: 'الاسم يجب أن يكون 3 أحرف على الأقل',
                message_en: 'Name must be at least 3 characters'
            };
        }

        // Remove special characters (keep letters, numbers, spaces, dashes, and Arabic characters)
        const sanitized = name.replace(/[^\u0600-\u06FFa-zA-Z0-9\s\-']/g, '');
        
        // Check if name contained only allowed characters
        if (sanitized !== name) {
            return {
                valid: false,
                message_ar: 'الاسم يحتوي على رموز غير مسموحة',
                message_en: 'Name contains disallowed special characters'
            };
        }

        return { valid: true, sanitized: sanitized };
    }

    /**
     * Sanitize text input (通用文本清理)
     * Removes potentially dangerous characters
     */
    function sanitizeText(text) {
        if (!text) return '';
        return text.replace(/[<>'"{}[\];$@#%&*()+=]/g, '').trim();
    }

    /**
     * Sanitize and validate notes input
     */
    function sanitizeAndValidateNotes(notes) {
        if (!notes) return true;
        
        // Check for potentially dangerous characters
        const dangerousPattern = /[<>'"{}[\];$@#%&*\\|=`~]/;
        return !dangerousPattern.test(notes);
    }

    /**
     * Show luxury-styled feedback message
     */
    function showLuxuryFeedback(message, type) {
        const lang = (typeof i18n !== 'undefined') ? i18n.currentLang : 'ar';
        
        // Create feedback element
        const feedback = document.createElement('div');
        feedback.className = `luxury-feedback ${type}`;
        feedback.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            padding: 15px 25px;
            border-radius: 8px;
            font-family: 'Cairo', sans-serif;
            font-size: 14px;
            max-width: 350px;
            z-index: 10000;
            animation: slideIn 0.3s ease;
            box-shadow: 0 4px 20px rgba(0,0,0,0.3);
        `;

        // Style based on type
        if (type === 'error') {
            feedback.style.background = 'linear-gradient(135deg, #c0392b, #e74c3c)';
            feedback.style.color = 'white';
            feedback.style.border = '1px solid #e74c3c';
        } else if (type === 'warning') {
            feedback.style.background = 'linear-gradient(135deg, #d35400, #e67e22)';
            feedback.style.color = 'white';
            feedback.style.border = '1px solid #e67e22';
        } else {
            feedback.style.background = 'linear-gradient(135deg, #27ae60, #2ecc71)';
            feedback.style.color = 'white';
            feedback.style.border = '1px solid #2ecc71';
        }

        feedback.textContent = message;
        document.body.appendChild(feedback);

        // Auto-remove after 4 seconds
        setTimeout(() => {
            feedback.style.animation = 'fadeOut 0.3s ease';
            setTimeout(() => feedback.remove(), 300);
        }, 4000);
    }

    /**
     * Set loading state for submit button
     */
    function setLoadingState(button, isLoading) {
        if (isLoading) {
            button.disabled = true;
            button.style.opacity = '0.7';
            button.innerHTML = i18n.currentLang === 'ar' ? 'جاري الحجز...' : 'Booking...';
        } else {
            button.disabled = false;
            button.style.opacity = '1';
            const btnText = i18n.currentLang === 'ar' ? 'تأكيد حجز طاولة' : 'Confirm Booking';
            button.innerHTML = `<span>${btnText}</span> <i class="fas fa-chevron-left"></i>`;
        }
    }

    /**
     * Show SweetAlert modal for capacity errors
     */
    function showSweetAlert(title, text, icon) {
        const lang = (typeof i18n !== 'undefined') ? i18n.currentLang : 'ar';
        
        Swal.fire({
            title: title,
            text: text,
            icon: icon,
            confirmButtonText: lang === 'ar' ? 'حسناً' : 'OK',
            confirmButtonColor: '#C5A059',
            background: '#1a1a1a',
            color: '#ffffff',
            customClass: {
                popup: 'sweet-alert-popup',
                title: 'sweet-alert-title',
                content: 'sweet-alert-content'
            }
        });
    }
});

// Add CSS animations for feedback
const style = document.createElement('style');
style.textContent = `
    @keyframes slideIn {
        from { transform: translateX(100%); opacity: 0; }
        to { transform: translateX(0); opacity: 1; }
    }
    @keyframes fadeOut {
        from { opacity: 1; }
        to { opacity: 0; }
    }
`;
document.head.appendChild(style);

// =========================================
// PROFESSIONAL FLOATING INFO CARD
// =========================================
let infoCardTimeout = null;

// Toggle Info Popup
function toggleInfoCard() {
    const popup = document.getElementById('infoPopup');
    if (!popup) return;
    
    popup.classList.toggle('show');
    
    // Store state
    if (popup.classList.contains('show')) {
        sessionStorage.setItem('infoPopupOpen', 'true');
    } else {
        sessionStorage.removeItem('infoPopupOpen');
    }
}

// Close Info Popup
function closeInfoCard() {
    const popup = document.getElementById('infoPopup');
    if (!popup) return;
    
    popup.classList.remove('show');
    sessionStorage.removeItem('infoPopupOpen');
}

// Initialize info popup on page load
document.addEventListener('DOMContentLoaded', () => {
    const popup = document.getElementById('infoPopup');
    if (!popup) return;
    
    // Show popup after 3 seconds if not already closed
    if (!sessionStorage.getItem('infoPopupClosed')) {
        infoCardTimeout = setTimeout(() => {
            popup.classList.add('show');
            sessionStorage.setItem('infoPopupOpen', 'true');
            
            // Auto-hide after 10 seconds
            setTimeout(() => {
                popup.classList.remove('show');
                sessionStorage.removeItem('infoPopupOpen');
                sessionStorage.setItem('infoPopupClosed', 'true');
            }, 10000);
        }, 3000);
    }
});
