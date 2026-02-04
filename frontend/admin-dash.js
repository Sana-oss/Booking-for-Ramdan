/**
 * CORINTHIA HOTEL - ADMIN DASHBOARD (V8 - ELITE EDITION)
 * المحرك التشغيلي: إدارة الحجوزات، البحث الذكي، تصدير التقارير، وتأمين الجلسة
 */

// Get the correct API base URL
const getApiUrl = () => {
    if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
        return 'http://localhost:5000';
    }
    return '';
};

const API_BASE = getApiUrl();
const BOOKINGS_URL = API_BASE ? `${API_BASE}/api/bookings` : '/api/bookings';
const BOOKING_STATUS_URL = (id) => API_BASE ? `${API_BASE}/api/bookings/${id}` : `/api/bookings/${id}`;
const BOOKING_ARCHIVE_URL = (id) => API_BASE ? `${API_BASE}/api/bookings/archive/${id}` : `/api/bookings/archive/${id}`;
const BOOKING_DELETE_URL = (id) => API_BASE ? `${API_BASE}/api/bookings/${id}` : `/api/bookings/${id}`;
const AUTH_ME_URL = API_BASE ? `${API_BASE}/api/auth/me` : '/api/auth/me';
const CAPACITY_URL = API_BASE ? `${API_BASE}/api/admin/capacity` : '/api/admin/capacity';
const ANALYTICS_URL = API_BASE ? `${API_BASE}/api/admin/analytics` : '/api/admin/analytics';

console.log('📊 Admin Dashboard API Base:', API_BASE || '(relative)');
console.log('📊 Bookings URL:', BOOKINGS_URL);
console.log('📊 Archive URL:', BOOKING_ARCHIVE_URL('test'));
console.log('📊 Capacity URL:', CAPACITY_URL);
console.log('📊 Analytics URL:', ANALYTICS_URL);

let allBookings = []; // قاعدة البيانات المؤقتة في المتصفح
let statusChart = null;
let weeklyChart = null;

// Pagination Configuration
const ITEMS_PER_PAGE = 50;
let currentPage = 1;
let filteredBookings = []; // Store filtered results for pagination

/**
 * Clean Search Input - Strict 8 character alphanumeric uppercase
 */
function cleanSearchInput(input) {
    let value = input.value.toUpperCase();
    value = value.replace(/[^A-Z0-9\-]/g, '');
    if (value.length > 10) {
        value = value.slice(0, 10);
    }
    input.value = value;
}

// Chart.js Configurations (NEW)
const statusChartConfig = {
    type: 'doughnut',
    data: {
        labels: ['Confirmed', 'Pending', 'Cancelled'],
        datasets: [{
            data: [0, 0, 0],
            backgroundColor: [
                'rgba(39, 174, 96, 0.8)',   // Green for Confirmed
                'rgba(243, 156, 18, 0.8)',  // Orange for Pending
                'rgba(231, 76, 60, 0.8)'    // Red for Cancelled
            ],
            borderColor: '#1a1a1a',
            borderWidth: 3,
            hoverOffset: 10
        }]
    },
    options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: {
                position: 'bottom',
                labels: {
                    color: '#c5a059',
                    font: { family: 'Poppins', size: 12 },
                    padding: 20
                }
            }
        },
        animation: {
            animateScale: true,
            animateRotate: true,
            duration: 1500,
            easing: 'easeOutQuart'
        }
    }
};

const weeklyChartConfig = {
    type: 'line',
    data: {
        labels: [], // Last 7 days dates
        datasets: [{
            label: 'الحجوزات',
            data: [],
            borderColor: '#c5a059',
            backgroundColor: (context) => {
                const ctx = context.chart.ctx;
                const gradient = ctx.createLinearGradient(0, 0, 0, 280);
                gradient.addColorStop(0, 'rgba(197, 160, 89, 0.4)');
                gradient.addColorStop(1, 'rgba(197, 160, 89, 0.0)');
                return gradient;
            },
            borderWidth: 3,
            fill: true,
            tension: 0.4,
            pointBackgroundColor: '#c5a059',
            pointBorderColor: '#ffffff',
            pointBorderWidth: 2,
            pointRadius: 6,
            pointHoverRadius: 8
        }]
    },
    options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
            x: {
                grid: { color: 'rgba(197, 160, 89, 0.1)' },
                ticks: { 
                    color: '#888',
                    font: { family: 'Poppins' }
                }
            },
            y: {
                beginAtZero: true,
                grid: { color: 'rgba(197, 160, 89, 0.1)' },
                ticks: { 
                    color: '#888',
                    font: { family: 'Poppins' },
                    stepSize: 1
                }
            }
        },
        plugins: {
            legend: { display: false }
        },
        animation: {
            duration: 2000,
            easing: 'easeOutQuart'
        }
    }
};

document.addEventListener('DOMContentLoaded', () => {
    // 1. الأمان: التحقق من أن المستخدم مدير
    checkAdminAuth();

    // 2. تهيئة النظام واللغة
    if (typeof i18n !== 'undefined') i18n.init();
    
    // 3. إظهار/إخفاء الروابط حسب دور المستخدم
    updateUIForUserRole();

    // 4. تهيئة Charts (NEW - FIXED)
    initializeCharts();
    
    // 5. جلب البيانات من السيرفر
    loadBookingsFromServer();
    
    // 6. جلب بيانات التحليلات (NEW)
    loadAnalyticsData();

    // 7. تفعيل مستمعات الأحداث للفلاتر الجديدة
    initializeEventListeners();

    // 8. المزامنة الحية: تحديث البيانات تلقائياً كل 60 ثانية
    setInterval(syncDataSilently, 60000);
    
    // 8. تزامن بيانات التحليلات (NEW)
    setInterval(loadAnalyticsData, 60000);
    
    // 9. تهيئة تحديث مواعيد الانتهاء (24-hour rule)
    initializeExpirationRefresh();
});

/**
 * التحقق من صلاحية دخول المسؤول باستخدام JWT Token
 */
async function checkAdminAuth() {
    const token = localStorage.getItem('adminToken');
    
    if (!token) {
        // لا يوجد توكن - توجيه لصفحة تسجيل الدخول
        window.location.href = 'admin-login.html';
        return;
    }
    
    // التحقق من صحة التوكن مع السيرفر
    try {
        const response = await fetch(AUTH_ME_URL, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });
        
        if (!response.ok) {
            // التوكن غير صالح - حذفه وتوجيه لصفحة تسجيل الدخول
            localStorage.removeItem('adminToken');
            localStorage.removeItem('adminUser');
            window.location.href = 'admin-login.html';
            return;
        }
        
        // التوكن صالح - يمكن المتابعة
        const result = await response.json();
        if (result.admin) {
            // حفظ معلومات المستخدم المحدثة
            localStorage.setItem('adminUser', JSON.stringify(result.admin));
            // إظهار/إخفاء رابط إدارة المستخدمين حسب الدور
            toggleUsersManagementLink(result.admin.role);
            // إظهار/إخفاء رابط الأرشيف حسب الدور
            toggleArchiveLink(result.admin.role);
        }
    } catch (error) {
        console.error('Auth verification error:', error);
        // في حالة خطأ في الاتصال، نسمح بالدخول لكن نعرض تحذير
        showNotification('تحذير: تعذر التحقق من صحة الجلسة. يرجى إعادة تسجيل الدخول.');
    }
}

/**
 * جلب الحجوزات من السيرفر
 */
async function loadBookingsFromServer() {
    try {
        console.log('📡 Fetching bookings from:', BOOKINGS_URL);
        
        const token = localStorage.getItem('adminToken');
        const headers = { 'Content-Type': 'application/json' };
        
        if (token) {
            headers['Authorization'] = `Bearer ${token}`;
        }
        
        const response = await fetch(BOOKINGS_URL, { headers });
        console.log('📡 Response status:', response.status);
        
        // Handle authentication errors
        if (response.status === 401) {
            console.log('🔐 Token expired - redirecting to login');
            localStorage.removeItem('adminToken');
            localStorage.removeItem('adminUser');
            window.location.href = 'admin-login.html';
            return;
        }
        
        const result = await response.json();
        console.log('📊 API response:', result);

        if (result.success && result.data) {
            // Filter out archived bookings from main dashboard
            allBookings = result.data.filter(booking => !booking.archived);
            console.log(`✅ Loaded ${allBookings.length} active bookings (filtered ${result.data.length - allBookings.length} archived)`);
            applySmartFilters(); 
        } else {
            console.error('❌ API returned error:', result.message);
            showNotification(result.message || "تعذر تحميل البيانات");
        }
    } catch (error) {
        console.error("❌ Connection Error:", error);
        showNotification("تعذر الاتصال بالسيرفر حالياً");
    }
}

/**
 * تفعيل مستمعات الأحداث (البحث والفلترة)
 */
function initializeEventListeners() {
    const searchInput = document.getElementById('searchInput');
    
    // البحث الفوري عند الكتابة
    if (searchInput) {
        searchInput.addEventListener('input', () => {
            applySmartFilters();
        });
    }

    // Initialize Flatpickr Range Picker
    const dateRangePicker = document.getElementById('dateRangePicker');
    if (dateRangePicker && typeof flatpickr !== 'undefined') {
        flatpickr("#dateRangePicker", {
            mode: "range",
            dateFormat: "Y-m-d",
            minDate: "today",
            locale: i18n?.currentLang === 'ar' ? 'ar' : 'en',
            onChange: function(selectedDates) {
                if (selectedDates.length === 2) {
                    // Trigger filter only when both dates are selected
                    applySmartFilters(selectedDates[0], selectedDates[1]);
                }
            }
        });
    }
}

/**
 * نظام الفلترة الذكي (بحث + تاريخ)
 */
function applySmartFilters(startDate, endDate) {
    // Reset pagination to first page when filtering
    currentPage = 1;
    
    const searchTerm = document.getElementById('searchInput')?.value.toLowerCase() || "";
    
    // Use provided dates or get from input
    if (!startDate && !endDate) {
        const dateRangePicker = document.getElementById('dateRangePicker');
        if (dateRangePicker && dateRangePicker._flatpickr) {
            const selectedDates = dateRangePicker._flatpickr.selectedDates;
            if (selectedDates.length === 2) {
                startDate = selectedDates[0];
                endDate = selectedDates[1];
            }
        }
    }
    
    const filteredResults = allBookings.filter(booking => {
        // Normalize booking date to start of day for accurate comparison
        const bDate = new Date(booking.date);
        bDate.setHours(0, 0, 0, 0);
        let isDateMatch = true;
        
        if (startDate) {
            const start = new Date(startDate);
            start.setHours(0, 0, 0, 0);
            isDateMatch = isDateMatch && bDate.getTime() >= start.getTime();
        }
        
        if (endDate) {
            const end = new Date(endDate);
            end.setHours(23, 59, 59, 999);
            isDateMatch = isDateMatch && bDate.getTime() <= end.getTime();
        }
        
        // فلترة البحث (اسم أو هاتف أو رقم مرجعي)
        const isSearchMatch = 
            booking.name.toLowerCase().includes(searchTerm) || 
            booking.phone.includes(searchTerm) ||
            (booking.referenceNumber && booking.referenceNumber.toLowerCase().includes(searchTerm));

        return isDateMatch && isSearchMatch;
    });

    renderAdminTable(filteredResults);
    updateDashboardStats(filteredResults);
}

/**
 * Get current user role from localStorage
 */
function getCurrentUserRole() {
    try {
        const adminUser = localStorage.getItem('adminUser');
        if (adminUser) {
            const user = JSON.parse(adminUser);
            return user.role || 'staff';
        }
    } catch (e) {
        console.error('Error parsing user role:', e);
    }
    return 'staff'; // Default to staff if no user found
}

/**
 * Check if current user is admin (can delete bookings)
 */
function isAdmin() {
    const role = getCurrentUserRole();
    return role === 'admin' || role === 'superadmin';
}

/**
 * Get status badge HTML with color
 */
function getStatusBadge(status) {
    const colors = {
        'Pending': { bg: 'rgba(243, 156, 18, 0.2)', color: '#f39c12', border: '#f39c12' },
        'Confirmed': { bg: 'rgba(39, 174, 96, 0.2)', color: '#27ae60', border: '#27ae60' },
        'Cancelled': { bg: 'rgba(231, 76, 60, 0.2)', color: '#e74c3c', border: '#e74c3c' }
    };
    
    const color = colors[status] || colors['Pending'];
    
    return `<span style="
        display: inline-block;
        padding: 4px 12px;
        border-radius: 20px;
        font-size: 0.75rem;
        font-weight: bold;
        background-color: ${color.bg};
        color: ${color.color};
        border: 1px solid ${color.border};
        min-width: 80px;
        text-align: center;
    ">${status}</span>`;
}

/**
 * Check if a Pending booking has expired (24-hour rule)
 * @param {Object} booking - The booking object
 * @returns {Object} - { isExpired: boolean, timeRemaining: string }
 */
function checkBookingExpiration(booking) {
    const statusLower = (booking.status || '').toLowerCase();
    
    // Only check Pending bookings
    if (statusLower !== 'pending') {
        return { isExpired: false, timeRemaining: null };
    }
    
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
    
    const diff = expiresAt - now;
    
    if (diff <= 0) {
        return { isExpired: true, timeRemaining: '00:00:00' };
    }
    
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((diff % (1000 * 60)) / 1000);
    
    const timeStr = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    
    return { isExpired: false, timeRemaining: timeStr };
}

/**
 * Refresh all expiration warnings in the admin table
 * Updates the countdown timers every second
 */
function refreshExpirationWarnings() {
    const warningElements = document.querySelectorAll('.expiration-warning');
    
    warningElements.forEach(element => {
        const bookingId = element.dataset.bookingId;
        const booking = allBookings.find(b => b._id === bookingId);
        
        if (booking) {
            const { isExpired, timeRemaining } = checkBookingExpiration(booking);
            const lang = document.documentElement.lang === 'ar' ? 'ar' : 'en';
            
            if (isExpired) {
                element.innerHTML = `<i class="fas fa-exclamation-triangle"></i><span>EXPIRED</span>`;
                element.style.background = 'rgba(231, 76, 60, 0.15)';
                element.style.borderColor = '#e74c3c';
                element.style.color = '#e74c3c';
            } else if (timeRemaining) {
                element.innerHTML = `<i class="fas fa-clock"></i><span>${timeRemaining}</span>`;
                element.style.background = 'rgba(243, 156, 18, 0.15)';
                element.style.borderColor = '#f39c12';
                element.style.color = '#f39c12';
            }
        }
    });
}

/**
 * Initialize expiration warning refresh interval
 */
function initializeExpirationRefresh() {
    // Update expiration warnings every second
    setInterval(refreshExpirationWarnings, 1000);
}

/**
 * Get expiration warning HTML for bookings
 */
function getExpirationWarning(booking) {
    const { isExpired, timeRemaining } = checkBookingExpiration(booking);
    const lang = document.documentElement.lang === 'ar' ? 'ar' : 'en';
    
    if (isExpired) {
        return `<div class="expiration-warning" data-booking-id="${booking._id}" style="
            padding: 4px 8px;
            background: rgba(231, 76, 60, 0.15);
            border: 1px solid #e74c3c;
            border-radius: 4px;
            font-size: 0.7rem;
            color: #e74c3c;
            display: inline-flex;
            align-items: center;
            gap: 4px;
        ">
            <i class="fas fa-exclamation-triangle"></i>
            <span>${lang === 'ar' ? 'منتهي الصلاحية' : 'EXPIRED'}</span>
        </div>`;
    }
    
    if (timeRemaining && booking.status === 'Pending') {
        return `<div class="expiration-warning" data-booking-id="${booking._id}" style="
            padding: 4px 8px;
            background: rgba(243, 156, 18, 0.15);
            border: 1px solid #f39c12;
            border-radius: 4px;
            font-size: 0.7rem;
            color: #f39c12;
            display: inline-flex;
            align-items: center;
            gap: 4px;
        ">
            <i class="fas fa-clock"></i>
            <span>${timeRemaining}</span>
        </div>`;
    }
    
    return '';
}

/**
 * تنسيق التاريخ والوقت للعرض
 * @param {string} dateStr - التاريخ بتنسيق YYYY-MM-DD
 * @param {string} timeStr - الوقت بتنسيق HH:mm
 * @returns {string} - التاريخ والوقت بتنسيق YYYY-MM-DD | HH:mm
 */
function formatDateTime(dateStr, timeStr) {
    const date = new Date(dateStr);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const time = timeStr || '19:00'; // Default time if not provided
    return `${year}-${month}-${day} | ${time}`;
}

/**
 * بناء جدول الحجوزات في الصفحة
 */
function renderAdminTable(data) {
    const tableBody = document.getElementById(CONSTANTS.SELECTORS.ADMIN_TABLE_BODY);
    if (!tableBody) return;

    const activeBookings = data.filter(booking => 
        booking.status === 'Pending' || booking.status === 'Confirmed'
    );
    
    // Store filtered bookings for pagination
    filteredBookings = activeBookings;
    
    if (filteredBookings.length === 0) {
        const noBookingsText = (typeof i18n !== 'undefined' && i18n.translations[i18n.currentLang]?.no_active_bookings) 
            ? i18n.translations[i18n.currentLang].no_active_bookings 
            : (i18n?.currentLang === 'ar' ? 'لا توجد حجوزات نشطة' : 'No active bookings found');
        tableBody.innerHTML = `<tr><td colspan="6" style="text-align:center; padding:50px; color:#999; font-weight:bold;">${noBookingsText}</td></tr>`;
        document.getElementById('adminPagination').innerHTML = '';
        return;
    }

    // ترتيب البيانات: الأحدث يظهر أولاً
    const sortedData = [...filteredBookings].sort((a, b) => new Date(b.date) - new Date(a.date));

    // Calculate pagination
    const totalPages = Math.ceil(sortedData.length / ITEMS_PER_PAGE);
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    const displayData = sortedData.slice(start, start + ITEMS_PER_PAGE);
    
    const userIsAdmin = isAdmin();

    tableBody.innerHTML = displayData.map(booking => `
        <tr class="fade-in-row">
            <td class="id-cell">${booking.referenceNumber || (booking._id ? booking._id.slice(-6).toUpperCase() : 'N/A')}</td>
            <td class="guest-info-cell">
                <div class="guest-info">
                    <span class="name">${booking.name}</span>
                    <span class="phone">${booking.phone}</span>
                </div>
            </td>
            <td class="date-time-cell">${formatDateTime(booking.date, booking.time)}</td>
            <td style="text-align: center;"><span class="guests-count">${booking.guests}</span></td>
            <td>
                <div style="display: flex; flex-direction: column; gap: 5px;">
                    <select class="status-select status-${booking.status}" 
                            data-id="${booking._id}"
                            data-current="${booking.status}"
                            onchange="updateBookingStatus(this)"
                            title="Change Status">
                        <option value="Pending" ${booking.status === 'Pending' ? 'selected' : ''}>Pending</option>
                        <option value="Confirmed" ${booking.status === 'Confirmed' ? 'selected' : ''}>Confirmed</option>
                        <option value="Cancelled" ${booking.status === 'Cancelled' ? 'selected' : ''}>Cancelled</option>
                    </select>
                    ${getExpirationWarning(booking)}
                </div>
            </td>
            <td>
                <div class="action-buttons">
                    <button class="checkin-btn" 
                            onclick="archiveBooking('${booking._id}', 'Arrived')" 
                            title="Arrived"
                            style="background:linear-gradient(135deg, #27ae60, #2ecc71); color:white; border:none; padding:8px 12px; border-radius:6px; cursor:pointer; font-size:0.8rem;">
                        <i class="fas fa-check"></i>
                    </button>
                    <button class="noshow-btn" 
                            onclick="archiveBooking('${booking._id}', 'No-Show')" 
                            title="No Show"
                            style="background:linear-gradient(135deg, #e67e22, #f39c12); color:white; border:none; padding:8px 12px; border-radius:6px; cursor:pointer; font-size:0.8rem;">
                        <i class="fas fa-user-times"></i>
                    </button>
                    ${userIsAdmin ? `
                    <button class="delete-btn" onclick="confirmDelete('${booking._id}')" title="Delete Booking" style="background:linear-gradient(135deg, #c0392b, #e74c3c); color:white; border:none; padding:8px 12px; border-radius:6px; cursor:pointer;">
                        <i class="fas fa-trash-alt"></i>
                    </button>
                    ` : ''}
                </div>
            </td>
        </tr>
    `).join('');

    // Render pagination controls
    renderAdminPagination(totalPages);
}

/**
 * Render Pagination Controls
 */
function renderAdminPagination(totalPages) {
    const pagination = document.getElementById('adminPagination');
    if (!pagination) return;
    
    if (totalPages <= 1) {
        pagination.innerHTML = '';
        return;
    }
    
    let html = '';
    const prevIcon = '<i class="fas fa-chevron-left"></i>';
    const nextIcon = '<i class="fas fa-chevron-right"></i>';
    
    html += `<button ${currentPage === 1 ? 'disabled' : ''} onclick="goToAdminPage(${currentPage - 1})" class="pagination-btn">${prevIcon}</button>`;
    
    for (let i = 1; i <= totalPages; i++) {
        if (i === 1 || i === totalPages || (i >= currentPage - 2 && i <= currentPage + 2)) {
            html += `<button class="pagination-btn ${i === currentPage ? 'active' : ''}" onclick="goToAdminPage(${i})">${i}</button>`;
        } else if (i === currentPage - 3 || i === currentPage + 3) {
            html += `<button class="pagination-btn" disabled>...</button>`;
        }
    }
    
    html += `<button ${currentPage === totalPages ? 'disabled' : ''} onclick="goToAdminPage(${currentPage + 1})" class="pagination-btn">${nextIcon}</button>`;
    
    pagination.innerHTML = html;
}

/**
 * Go to specific page (client-side pagination)
 */
function goToAdminPage(page) {
    currentPage = page;
    renderAdminTable(filteredBookings);
    
    // Scroll to top of table
    document.querySelector('.admin-table-wrapper')?.scrollIntoView({ behavior: 'smooth' });
}

/**
 * تحديث حالة الحجز في قاعدة البيانات (مع JWT Token)
 */
async function updateBookingStatus(selectElement) {
    const id = selectElement.dataset.id;
    const newStatus = selectElement.value;
    const previousStatus = selectElement.dataset.current;
    
    // Don't update if status hasn't changed
    if (newStatus === previousStatus) {
        return;
    }
    
    console.log('🔄 Updating booking status:', id, '->', newStatus);
    
    try {
        const token = localStorage.getItem('adminToken');
        const headers = {
            'Content-Type': 'application/json'
        };
        
        if (token) {
            headers['Authorization'] = `Bearer ${token}`;
        }
        
        // Use PUT method (as defined in backend route)
        const response = await fetch(BOOKING_STATUS_URL(id), {
            method: 'PUT',
            headers: headers,
            body: JSON.stringify({ status: newStatus })
        });
        
        console.log('📡 Status update response status:', response.status);
        
        if (response.status === 401) {
            localStorage.removeItem('adminToken');
            localStorage.removeItem('adminUser');
            window.location.href = 'admin-login.html';
            return;
        }
        
        const result = await response.json();
        console.log('📊 Status update response:', result);
        
        if (result.success) {
            // Update local data
            const index = allBookings.findIndex(b => b._id === id);
            if (index !== -1) {
                allBookings[index].status = newStatus;
                // If cancelled, mark as archived
                if (newStatus === 'Cancelled') {
                    allBookings[index].archived = true;
                    allBookings[index].archivedAt = new Date();
                }
            }
            
            // Update the select element's current status
            selectElement.dataset.current = newStatus;
            
            // Update the dropdown color class
            selectElement.className = `status-select status-${newStatus}`;
            
            // Show appropriate message
            if (newStatus === 'Cancelled') {
                showNotification('✅ Booking moved to Archive');
            } else {
                showNotification(`✅ Status updated to ${newStatus}`);
            }
            
            // Refresh the table (will filter out cancelled bookings)
            applySmartFilters();
            
            // Refresh capacity data after status change
            refreshCapacityData();
        } else {
            // Revert the dropdown on error
            selectElement.value = previousStatus;
            showNotification(`❌ ${result.message || 'Failed to update status'}`);
        }
    } catch (err) {
        console.error("Update Status Error:", err);
        // Revert the dropdown on error
        selectElement.value = previousStatus;
        showNotification("❌ Error updating status: " + err.message);
    }
}

/**
 * تصدير البيانات الظاهرة إلى ملف Excel
 */
function exportToExcel() {
    const tableBody = document.getElementById(CONSTANTS.SELECTORS.ADMIN_TABLE_BODY);
    // نصدّر البيانات المفلترة حالياً فقط
    const searchTerm = document.getElementById('searchInput')?.value.toLowerCase() || "";
    const startDate = document.getElementById('filterStartDate')?.value || "";
    const endDate = document.getElementById('filterEndDate')?.value || "";

    const dataToExport = allBookings.filter(booking => {
        const bDate = new Date(booking.date);
        let isDateMatch = true;
        
        if (startDate) {
            const start = new Date(startDate);
            isDateMatch = isDateMatch && bDate >= start;
        }
        
        if (endDate) {
            const end = new Date(endDate);
            end.setHours(23, 59, 59, 999);
            isDateMatch = isDateMatch && bDate <= end;
        }
        
        const isSearchMatch = booking.name.toLowerCase().includes(searchTerm) || booking.phone.includes(searchTerm) || (booking.referenceNumber && booking.referenceNumber.toLowerCase().includes(searchTerm));
        return isDateMatch && isSearchMatch;
    });

    if (dataToExport.length === 0) {
        alert("لا توجد بيانات لتصديرها");
        return;
    }

    const excelRows = dataToExport.map(b => ({
        "رقم الحجز": b.referenceNumber || (b._id ? b._id.slice(-6).toUpperCase() : 'N/A'),
        "اسم الضيف": b.name,
        "رقم الهاتف": b.phone,
        "تاريخ الحجز": new Date(b.date).toLocaleDateString('ar-EG'),
        "عدد الأفراد": b.guests,
        "الحالة": b.status
    }));

    const ws = XLSX.utils.json_to_sheet(excelRows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Bookings");
    
    const dateStamp = new Date().toISOString().split('T')[0];
    XLSX.writeFile(wb, `Corinthia_Bookings_${dateStamp}.xlsx`);
    showNotification("تم تحميل ملف Excel بنجاح");
}

/**
 * تحديث أرقام الإحصائيات العلوية
 */
function updateDashboardStats(data) {
    const counts = {
        total: data.length,
        confirmed: data.filter(b => b.status === 'Confirmed').length,
        pending: data.filter(b => b.status === 'Pending').length
    };

    const sel = CONSTANTS.SELECTORS;
    if (document.getElementById(sel.TOTAL_COUNT)) document.getElementById(sel.TOTAL_COUNT).innerText = counts.total;
    if (document.getElementById(sel.CONFIRMED_COUNT)) document.getElementById(sel.CONFIRMED_COUNT).innerText = counts.confirmed;
    if (document.getElementById(sel.PENDING_COUNT)) document.getElementById(sel.PENDING_COUNT).innerText = counts.pending;
}

/**
 * نقل حجز إلى الأرشيف (تسجيل الحضور أو عدم الحضور)
 */
async function archiveBooking(id, reason) {
    const messages = {
        'Arrived': {
            ar: 'هل تريد تسجيل حضور هذا الضيف؟',
            en: 'Mark this guest as Arrived?'
        },
        'No-Show': {
            ar: 'هل تريد تسجيل هذا الضيف كـ "لم يحضر"؟',
            en: 'Mark this guest as No-Show?'
        }
    };
    
    const lang = localStorage.getItem('hotel_lang') || 'ar';
    const message = messages[reason] ? messages[reason][lang] : 'Archive this booking?';
    
    if (!confirm(message)) return;

    console.log(`📂 Archiving booking ${id} as '${reason}'`);
    console.log(`📂 Archive URL: ${BOOKING_ARCHIVE_URL(id)}`);
    
    try {
        const token = localStorage.getItem('adminToken');
        const headers = {
            'Content-Type': 'application/json'
        };
        
        if (token) {
            headers['Authorization'] = `Bearer ${token}`;
        }
        
        const archiveUrl = BOOKING_ARCHIVE_URL(id);
        console.log(`📡 POST ${archiveUrl}`);
        
        const response = await fetch(archiveUrl, {
            method: 'POST',
            headers: headers,
            body: JSON.stringify({ archiveReason: reason })
        });
        
        console.log(`📡 Archive response status: ${response.status}`);
        
        if (response.status === 401) {
            localStorage.removeItem('adminToken');
            localStorage.removeItem('adminUser');
            window.location.href = 'admin-login.html';
            return;
        }
        
        const result = await response.json();
        console.log(`📊 Archive response:`, result);
        
        if (result.success) {
            showNotification(`✅ ${result.message}`);
            // Refresh the table to remove archived booking
            loadBookingsFromServer();
        } else {
            showNotification(`❌ ${result.message}`);
        }
        
    } catch (error) {
        console.error('Archive error:', error);
        showNotification('❌ Error archiving booking: ' + error.message);
    }
}

/**
 * حذف حجز مع رسالة تأكيد (مع JWT Token)
 */
async function confirmDelete(id) {
    if (!confirm("تحذير: هل أنت متأكد من حذف هذا الحجز نهائياً من النظام؟")) return;

    console.log('🗑️ Starting delete process for booking:', id);
    
    try {
        const token = localStorage.getItem('adminToken');
        const headers = {
            'Content-Type': 'application/json'
        };
        
        if (token) {
            headers['Authorization'] = `Bearer ${token}`;
            console.log('🗑️ Authorization header set');
        } else {
            console.error('🗑️ No adminToken found!');
            showNotification("❌ لم يتم العثور على توكن المصادقة");
            return;
        }
        
        // Use local BOOKINGS_URL constant instead of CONSTANTS.API.ITEM
        const deleteUrl = `${BOOKINGS_URL}/${id}`;
        console.log('🗑️ Sending DELETE request to:', deleteUrl);
        
        const response = await fetch(deleteUrl, { 
            method: 'DELETE',
            headers: headers
        });
        
        console.log('🗑️ Delete response status:', response.status);
        console.log('🗑️ Delete response ok:', response.ok);
        
        // Handle authentication errors
        if (response.status === 401) {
            console.error('🗑️ Unauthorized - redirecting to login');
            localStorage.removeItem('adminToken');
            localStorage.removeItem('adminUser');
            window.location.href = 'admin-login.html';
            return;
        }
        
        // Handle 405 Method Not Allowed
        if (response.status === 405) {
            console.error('🗑️ Method not allowed - checking if route supports DELETE');
            showNotification("❌ هذا الحذف غير مدعوم - يرجى التواصل مع المسؤول");
            return;
        }
        
        // Parse JSON response
        const result = await response.json();
        console.log('🗑️ Delete response:', result);
        
        if (result.success) {
            console.log('🗑️ Delete successful, removing from local array');
            // Remove from local array
            allBookings = allBookings.filter(b => b._id !== id);
            // Update UI
            applySmartFilters();
            // Show success message
            showNotification("✅ " + (result.message || "تم حذف الحجز بنجاح"));
        } else {
            console.error('🗑️ Delete failed:', result.message);
            // Show error message
            showNotification("❌ " + (result.message || "فشل في حذف الحجز"));
        }
    } catch (err) {
        console.error("🗑️ Delete Error:", err);
        showNotification("❌ حدث خطأ أثناء الحذف: " + err.message);
    }
}

/**
 * تحديث البيانات في الخلفية بدون إعادة تحميل الصفحة (مع JWT Token)
 */
async function syncDataSilently() {
    try {
        const token = localStorage.getItem('adminToken');
        const headers = {};
        
        if (token) {
            headers['Authorization'] = `Bearer ${token}`;
        }
        
        // Use local BOOKINGS_URL constant instead of CONSTANTS.API.BOOKINGS
        const response = await fetch(BOOKINGS_URL, {
            headers: headers
        });
        
        if (response.status === 401) {
            localStorage.removeItem('adminToken');
            localStorage.removeItem('adminUser');
            window.location.href = 'admin-login.html';
            return;
        }
        
        const result = await response.json();
        if (result.success && result.data.length !== allBookings.length) {
            allBookings = result.data;
            applySmartFilters();
            showNotification("تحديث: تتوفر بيانات حجوزات جديدة");
        }
    } catch (e) {
        // تجاهل الأخطاء في المزامنة الصامتة
    }
}

/**
 * تصفير كافة الفلاتر
 */
function resetFilter() {
    const dateRangePicker = document.getElementById('dateRangePicker');
    const sInput = document.getElementById('searchInput');
    
    // Clear Flatpickr
    if (dateRangePicker && dateRangePicker._flatpickr) {
        dateRangePicker._flatpickr.clear();
    }
    
    if (sInput) sInput.value = '';
    applySmartFilters();
    showNotification("تمت إعادة ضبط العرض");
}

/**
 * تسجيل الخروج بأمان
 */
/**
 * تسجيل الخروج بأمان (مع إزالة JWT Token)
 */
async function logout() {
    if (!confirm("هل تريد مغادرة لوحة التحكم؟")) {
        return;
    }
    
    const token = localStorage.getItem('adminToken');
    
    // محاولة إرسال طلب تسجيل الخروج للـ Backend (اختياري)
    if (token) {
        try {
            await fetch(CONSTANTS.API.AUTH.LOGOUT, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            });
        } catch (error) {
            console.error('Logout API error:', error);
            // نستمر في عملية تسجيل الخروج حتى لو فشل الطلب
        }
    }
    
    // حذف جميع بيانات الجلسة من localStorage
    localStorage.removeItem('adminToken');
    localStorage.removeItem('adminUser');
    
    // تأثير تلاشي ناعم للخروج
    document.body.style.opacity = '0';
    document.body.style.transition = 'opacity 0.6s';
    setTimeout(() => {
        window.location.href = 'admin-login.html';
    }, 600);
}

/**
 * إظهار/إخفاء رابط إدارة المستخدمين حسب الدور
 */
function toggleUsersManagementLink(userRole) {
    const link = document.getElementById('usersManagementLink');
    if (link) {
        // إظهار الرابط للمستخدمين من مستوى إداري (admin أو superadmin)
        const canManageUsers = userRole === 'admin' || userRole === 'superadmin';
        link.style.display = canManageUsers ? 'inline-flex' : 'none';
        console.log(`👤 User role: ${userRole}, Users link visible: ${canManageUsers}`);
    }
}

/**
 * إظهار/إخفاء رابط الأرشيف حسب الدور
 * Only admins can see the Archive link
 */
function toggleArchiveLink(userRole) {
    const link = document.getElementById('archiveNavLink');
    if (link) {
        // إظهار الرابط فقط للمستخدمين من مستوى إداري (admin أو superadmin)
        const canViewArchive = userRole === 'admin' || userRole === 'superadmin';
        link.style.display = canViewArchive ? 'inline-flex' : 'none';
        console.log(`📂 User role: ${userRole}, Archive link visible: ${canViewArchive}`);
    }
}

/**
 * تحديث واجهة المستخدم بناءً على دور المستخدم
 */
function updateUIForUserRole() {
    const userRole = getCurrentUserRole();
    toggleUsersManagementLink(userRole);
    toggleArchiveLink(userRole);
}

/**
 * إظهار إشعارات النظام الجذابة
 * type: 'info' | 'warning' | 'success' | 'error'
 */
function showNotification(msg, type = 'info') {
    const existing = document.querySelector('.new-booking-toast');
    if (existing) existing.remove();
    
    const toast = document.createElement('div');
    toast.className = 'new-booking-toast';
    
    // Set icon and color based on type
    let icon = 'fa-info-circle';
    let bgColor = 'linear-gradient(135deg, #27ae60, #2ecc71)';
    
    switch(type) {
        case 'warning':
            icon = 'fa-exclamation-triangle';
            bgColor = 'linear-gradient(135deg, #f39c12, #e67e22)';
            break;
        case 'error':
            icon = 'fa-times-circle';
            bgColor = 'linear-gradient(135deg, #c0392b, #e74c3c)';
            break;
        case 'success':
            icon = 'fa-check-circle';
            bgColor = 'linear-gradient(135deg, #27ae60, #2ecc71)';
            break;
        default:
            icon = 'fa-info-circle';
            bgColor = 'linear-gradient(135deg, #3498db, #2980b9)';
    }
    
    toast.innerHTML = `<i class="fas ${icon}"></i> ${msg}`;
    toast.style.background = bgColor;
    document.body.appendChild(toast);
    
    // إزالة الإشعار بعد 4 ثوانٍ
    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateY(20px)';
        setTimeout(() => toast.remove(), 500);
    }, 4000);
}

// === Analytics Dashboard Functions (NEW - FIXED) ===

/**
 * تهيئة Charts (Doughnut & Line) - FIXED VERSION
 */
function initializeCharts() {
    console.log('🔧 initializing charts...');
    
    const statusCtx = document.getElementById('statusDistributionChart');
    const weeklyCtx = document.getElementById('weeklyTrendsChart');
    
    console.log('📊 Status Chart Canvas:', statusCtx);
    console.log('📈 Weekly Chart Canvas:', weeklyCtx);
    
    // تهيئة Status Distribution Chart (Doughnut)
    if (statusCtx) {
        const statusCtx2d = statusCtx.getContext('2d');
        statusChart = new Chart(statusCtx2d, {
            type: 'doughnut',
            data: {
                labels: ['Confirmed', 'Pending', 'Cancelled'],
                datasets: [{
                    data: [0, 0, 0],
                    backgroundColor: [
                        'rgba(39, 174, 96, 0.8)',   // Green for Confirmed
                        'rgba(243, 156, 18, 0.8)',  // Orange for Pending
                        'rgba(231, 76, 60, 0.8)'    // Red for Cancelled
                    ],
                    borderColor: '#1a1a1a',
                    borderWidth: 3,
                    hoverOffset: 10
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'bottom',
                        labels: {
                            color: '#c5a059',
                            font: { family: 'Cairo', size: 12 },
                            padding: 20
                        }
                    },
                    title: {
                        display: true,
                        text: 'Booking Status Distribution',
                        color: '#c5a059',
                        font: { family: 'Cairo', size: 16 }
                    }
                },
                animation: {
                    animateScale: true,
                    animateRotate: true,
                    duration: 1500,
                    easing: 'easeOutQuart'
                }
            }
        });
        console.log('✅ Status chart initialized:', statusChart);
    } else {
        console.error('❌ Status chart canvas not found!');
    }
    
    // تهيئة Weekly Trends Chart (Line)
    if (weeklyCtx) {
        const weeklyCtx2d = weeklyCtx.getContext('2d');
        weeklyChart = new Chart(weeklyCtx2d, {
            type: 'line',
            data: {
                labels: [], // Last 7 days dates
                datasets: [{
                    label: 'الحجوزات',
                    data: [],
                    borderColor: '#c5a059',
                    backgroundColor: function(context) {
                        const ctx = context.chart.ctx;
                        const gradient = ctx.createLinearGradient(0, 0, 0, 280);
                        gradient.addColorStop(0, 'rgba(197, 160, 89, 0.4)');
                        gradient.addColorStop(1, 'rgba(197, 160, 89, 0.0)');
                        return gradient;
                    },
                    borderWidth: 3,
                    fill: true,
                    tension: 0.4,
                    pointBackgroundColor: '#c5a059',
                    pointBorderColor: '#ffffff',
                    pointBorderWidth: 2,
                    pointRadius: 6,
                    pointHoverRadius: 8
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    x: {
                        grid: { color: 'rgba(197, 160, 89, 0.1)' },
                        ticks: { 
                            color: '#888',
                            font: { family: 'Cairo' }
                        }
                    },
                    y: {
                        beginAtZero: true,
                        grid: { color: 'rgba(197, 160, 89, 0.1)' },
                        ticks: { 
                            color: '#888',
                            font: { family: 'Cairo' },
                            stepSize: 1
                        }
                    }
                },
                plugins: {
                    legend: { display: false },
                    title: {
                        display: true,
                        text: 'Weekly Booking Trends',
                        color: '#c5a059',
                        font: { family: 'Cairo', size: 16 }
                    }
                },
                animation: {
                    duration: 2000,
                    easing: 'easeOutQuart'
                }
            }
        });
        console.log('✅ Weekly chart initialized:', weeklyChart);
    } else {
        console.error('❌ Weekly chart canvas not found!');
    }
}

/**
 * جلب بيانات التحليلات من السيرفر - ROBUST VERSION WITH DEBUGGING
 */
async function loadAnalyticsData() {
    try {
        console.log('🔄 Loading analytics data...');
        const token = localStorage.getItem('adminToken');
        
        if (!token) {
            console.warn('⚠️ No auth token available for analytics');
            console.log('💡 User needs to log in first');
            return;
        }
        
        // Use local ANALYTICS_URL constant instead of CONSTANTS.API.ANALYTICS
        console.log('📡 Fetching from:', ANALYTICS_URL);
        console.log('🔐 Token exists:', token ? 'Yes' : 'No');
        
        const response = await fetch(ANALYTICS_URL, {
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });
        
        console.log('📡 Analytics API Response status:', response.status);
        
        // Handle authentication errors
        if (response.status === 401) {
            console.log('🔐 Token expired or invalid - redirecting to login');
            localStorage.removeItem('adminToken');
            localStorage.removeItem('adminUser');
            window.location.href = 'admin-login.html';
            return;
        }
        
        // Handle non-JSON responses (like HTML error pages)
        const contentType = response.headers.get('content-type');
        if (!contentType || !contentType.includes('application/json')) {
            const textResponse = await response.text();
            console.error('❌ Server returned non-JSON response:', textResponse.substring(0, 200));
            console.error('💡 Make sure the backend server is running on port 5000');
            return;
        }
        
        const result = await response.json();
        console.log('📊 Analytics API Response:', result);
        
        if (result.success) {
            console.log('✅ Analytics data loaded successfully');
            console.log('   Status Distribution:', result.data.statusDistribution);
            console.log('   Weekly Trends:', result.data.weeklyTrends);
            updateCharts(result.data);
        } else {
            console.error('❌ Analytics API returned error:', result.message);
        }
    } catch (error) {
        console.error('❌ Analytics Error:', error.message);
        console.error('💡 Possible causes:');
        console.error('   - Backend server not running');
        console.error('   - MongoDB connection failed');
        console.error('   - CORS issues');
    }
}

/**
 * تحديث Charts بالبيانات الجديدة - FIXED VERSION
 */
function updateCharts(data) {
    console.log('🎨 Updating charts with data:', data);
    
    // تحديث Status Distribution Chart
    if (statusChart) {
        console.log('📊 Updating status chart...');
        
        // Map MongoDB aggregation results correctly
        const statusCounts = {
            'Confirmed': 0,
            'Pending': 0,
            'Cancelled': 0
        };
        
        if (data.statusDistribution && data.statusDistribution.length > 0) {
            data.statusDistribution.forEach(item => {
                console.log(`   ${item._id}: ${item.count}`);
                if (statusCounts.hasOwnProperty(item._id)) {
                    statusCounts[item._id] = item.count;
                }
            });
        } else {
            console.log('⚠️ No status distribution data available');
        }
        
        statusChart.data.datasets[0].data = [
            statusCounts['Confirmed'],
            statusCounts['Pending'],
            statusCounts['Cancelled']
        ];
        
        console.log('   Status chart data:', statusChart.data.datasets[0].data);
        statusChart.update();
        console.log('✅ Status chart updated');
    } else {
        console.error('❌ Status chart not initialized!');
    }
    
    // تحديث Weekly Trends Chart
    if (weeklyChart) {
        console.log('📈 Updating weekly trends chart...');
        
        if (data.weeklyTrends && data.weeklyTrends.length > 0) {
            const dates = data.weeklyTrends.map(item => item._id);
            const counts = data.weeklyTrends.map(item => item.count);
            
            console.log('   Weekly dates:', dates);
            console.log('   Weekly counts:', counts);
            
            weeklyChart.data.labels = dates;
            weeklyChart.data.datasets[0].data = counts;
        } else {
            // إذا لم توجد بيانات، عرض آخر 7 أيام فارغة
            console.log('⚠️ No weekly trends data - showing empty chart');
            const emptyDates = [];
            const emptyCounts = [];
            for (let i = 6; i >= 0; i--) {
                const date = new Date();
                date.setDate(date.getDate() - i);
                emptyDates.push(date.toISOString().split('T')[0]);
                emptyCounts.push(0);
            }
            weeklyChart.data.labels = emptyDates;
            weeklyChart.data.datasets[0].data = emptyCounts;
        }
        
        console.log('   Weekly chart data:', weeklyChart.data.datasets[0].data);
        weeklyChart.update();
        console.log('✅ Weekly chart updated');
    } else {
        console.error('❌ Weekly chart not initialized!');
    }
}

// === Capacity Management Functions (NEW) ===

/**
 * Load capacity overview data from server
 */
async function loadCapacityData() {
    try {
        console.log('🔄 Loading capacity data...');
        const token = localStorage.getItem('adminToken');
        
        if (!token) {
            console.warn('⚠️ No auth token available for capacity data');
            return;
        }
        
        const response = await fetch(`${CAPACITY_URL}?days=7`, {
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });
        
        if (response.status === 401) {
            localStorage.removeItem('adminToken');
            localStorage.removeItem('adminUser');
            window.location.href = 'admin-login.html';
            return;
        }
        
        const result = await response.json();
        console.log('📊 Capacity API Response:', result);
        
        if (result.success) {
            console.log('✅ Capacity data loaded successfully');
            renderCapacityBars(result.data);
        } else {
            console.error('❌ Capacity API returned error:', result.message);
        }
    } catch (error) {
        console.error('❌ Capacity Error:', error.message);
    }
}

/**
 * Load capacity data for a specific date
 */
async function loadCapacityDataForDate(date) {
    try {
        const token = localStorage.getItem('adminToken');
        
        const response = await fetch(`${CAPACITY_URL}?date=${date}`, {
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });
        
        if (response.status === 401) {
            localStorage.removeItem('adminToken');
            localStorage.removeItem('adminUser');
            window.location.href = 'admin-login.html';
            return;
        }
        
        const result = await response.json();
        if (result.success) {
            updateCapacityDisplayForDate(result.data);
        }
    } catch (error) {
        console.error('❌ Load capacity for date error:', error);
    }
}

/**
 * Update capacity display for a specific date (real-time refresh)
 */
function updateCapacityDisplayForDate(data) {
    const container = document.getElementById('capacityBarsContainer');
    if (!container) return;
    
    const maxCapacity = 200;
    const totalSeats = data.totalSeats || 0;
    const seatsRemaining = maxCapacity - totalSeats;
    const percentage = Math.round((totalSeats / maxCapacity) * 100);
    
    // Determine colors based on remaining seats
    let borderColor, gradientColor;
    if (seatsRemaining <= 40) {
        borderColor = '#e74c3c';
        gradientColor = 'linear-gradient(90deg, #c0392b, #e74c3c)';
    } else if (seatsRemaining <= 100) {
        borderColor = '#f39c12';
        gradientColor = 'linear-gradient(90deg, #d35400, #e67e22)';
    } else {
        borderColor = '#27ae60';
        gradientColor = 'linear-gradient(90deg, #27ae60, #2ecc71)';
    }
    
    // Find and update the specific date bar
    const existingBars = container.querySelectorAll('.capacity-bar-item');
    
    existingBars.forEach(bar => {
        const dateDisplay = bar.querySelector('span[style*="font-weight: 700"]');
        if (dateDisplay) {
            const dateNum = new Date(data.date).getDate();
            if (dateDisplay.textContent.includes(dateNum)) {
                // Update seats remaining text
                const remainingSpan = bar.querySelector('span[style*="font-weight: bold"]');
                if (remainingSpan) {
                    remainingSpan.textContent = `المتبقية: ${seatsRemaining}`;
                    remainingSpan.style.color = borderColor;
                }
                
                // Update progress bar
                const fillBar = bar.querySelector('div[style*="position: absolute"]');
                if (fillBar) {
                    fillBar.style.width = `${Math.min(percentage, 100)}%`;
                    fillBar.style.background = gradientColor;
                }
                
                // Update border color
                bar.style.borderColor = borderColor;
                
                // Add subtle animation
                bar.style.transform = 'scale(1.02)';
                setTimeout(() => {
                    bar.style.transform = 'scale(1)';
                }, 200);
            }
        }
    });
    
    console.log('✅ Capacity display updated for:', data.date);
}

/**
 * Refresh all capacity data (called after booking/cancellation)
 */
async function refreshCapacityData() {
    console.log('🔄 Refreshing capacity data...');
    await loadCapacityData();
}

/**
 * Fill in missing dates with 0 bookings
 */
function fillMissingDates(dailyCapacity, days = 7) {
    const maxCapacity = 200;
    const result = [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const dateMap = new Map();
    dailyCapacity.forEach(day => {
        dateMap.set(day.date, day);
    });
    
    for (let i = 0; i < days; i++) {
        const date = new Date(today);
        date.setDate(date.getDate() + i);
        const dateStr = date.toISOString().split('T')[0];
        
        if (dateMap.has(dateStr)) {
            result.push(dateMap.get(dateStr));
        } else {
            result.push({
                date: dateStr,
                totalSeats: 0,
                seatsRemaining: maxCapacity,
                bookingCount: 0,
                maxCapacity: maxCapacity,
                capacityPercentage: 0,
                isWarning: false,
                isFull: false
            });
        }
    }
    
    return result;
}

/**
 * Render capacity progress bars with warnings based on remaining seats
 * - Red (Critical) if remainingSeats <= 40
 * - Yellow (Warning) if remainingSeats <= 100
 * - Green (Normal) otherwise
 */
function renderCapacityBars(capacityData) {
    const container = document.getElementById('capacityBarsContainer');
    if (!container) {
        console.warn('⚠️ Capacity bars container not found');
        return;
    }
    
    container.innerHTML = '';
    
    if (!capacityData || !capacityData.dailyCapacity) {
        container.innerHTML = '<p style="color: #888; text-align: center;">' + 
            ((typeof i18n !== 'undefined') ? i18n.translations[lang]?.no_capacity_data || 'Loading...' : 'Loading...') + '</p>';
        return;
    }
    
    const maxCapacity = capacityData.maxCapacity || 200;
    const warningThreshold = capacityData.warningThreshold || 80;
    
    const lang = (typeof i18n !== 'undefined') ? i18n.currentLang : 'ar';
    
    // Check if i18n is available
    const i18nAvailable = typeof i18n !== 'undefined' && i18n.translations;
    const dict = i18nAvailable ? i18n.translations[lang] : {};
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayTimestamp = today.getTime();
    
    // Filter out past dates (only show today and future dates)
    const futureCapacity = capacityData.dailyCapacity.filter(day => {
        const dayDate = new Date(day.date);
        dayDate.setHours(0, 0, 0, 0);
        return dayDate.getTime() >= todayTimestamp;
    });
    
    // If no future dates, show empty state message
    if (futureCapacity.length === 0) {
        container.innerHTML = '<p style="color: #888; text-align: center; padding: 20px;">' + 
            ((typeof i18n !== 'undefined') ? i18n.translations[lang]?.no_upcoming_bookings || 'No upcoming booking slots configured' : 'No upcoming booking slots configured') + '</p>';
        return;
    }
    
    // Fill in missing dates with 0 bookings
    const filledCapacity = fillMissingDates(futureCapacity, 7);
    
    // Sort by date (chronological order from today)
    filledCapacity.sort((a, b) => new Date(a.date) - new Date(b.date));
    
    filledCapacity.forEach(day => {
        const seatsRemaining = day.seatsRemaining || (maxCapacity - day.totalSeats);
        const percentage = day.capacityPercentage || Math.round((day.totalSeats / maxCapacity) * 100);
        
        // Capacity Progress Logic based on remainingSeats
        let statusColor, borderColor, gradientColor;
        
        if (seatsRemaining <= 40) {
            // Critical - Red
            statusColor = '#e74c3c';
            borderColor = '#e74c3c';
            gradientColor = 'linear-gradient(90deg, #c0392b, #e74c3c)';
        } else if (seatsRemaining <= 100) {
            // Warning - Yellow
            statusColor = '#f39c12';
            borderColor = '#f39c12';
            gradientColor = 'linear-gradient(90deg, #d35400, #e67e22)';
        } else {
            // Normal - Green
            statusColor = '#27ae60';
            borderColor = '#27ae60';
            gradientColor = 'linear-gradient(90deg, #27ae60, #2ecc71)';
        }
        
        const isFull = day.totalSeats >= maxCapacity;
        const isWarning = seatsRemaining <= 100;
        const isCritical = seatsRemaining <= 40;
        
        // Status text
        let statusText;
        if (day.totalSeats === 0) {
            statusText = `${maxCapacity}/${maxCapacity} ` + ((typeof i18n !== 'undefined') ? i18n.translations[lang]?.status_available || (lang === 'ar' ? 'متاح' : 'Available') : (lang === 'ar' ? 'متاح' : 'Available'));
        } else if (isFull) {
            statusText = (typeof i18n !== 'undefined') ? i18n.translations[lang]?.status_full || (lang === 'ar' ? 'مكتمل' : 'Full') : (lang === 'ar' ? 'مكتمل' : 'Full');
        } else {
            statusText = `${day.totalSeats} / ${maxCapacity}`;
        }
        
        const dateObj = new Date(day.date);
        const isToday = dateObj.getTime() === todayTimestamp;
        
        // Get day name in English and translate it
        const dayName = dateObj.toLocaleDateString('en-US', { weekday: 'short' });
        const dayDisplay = (typeof i18n !== 'undefined' && i18n.translations[i18n.currentLang]?.days?.[dayName]) 
            ? i18n.translations[i18n.currentLang].days[dayName] 
            : dayName;
        
        const dateDisplay = dateObj.toLocaleDateString(lang === 'ar' ? 'ar-EG' : 'en-US', { 
            weekday: 'short', 
            day: 'numeric', 
            month: 'short' 
        }).replace(/^[a-zA-Z]+/, dayDisplay);
        
        // "Current" badge for today
        const currentBadge = isToday 
            ? `<span style="background: linear-gradient(135deg, #c5a059, #e6c885); color: #1a1a1a; padding: 2px 8px; border-radius: 12px; font-size: 10px; font-weight: bold; margin-right: 8px;">${(typeof i18n !== 'undefined') ? i18n.translations[lang]?.current_badge || 'CURRENT' : 'CURRENT'}</span>`
            : '';
        
        const todayBadge = isToday ? ' ' + ((typeof i18n !== 'undefined') ? i18n.translations[lang]?.today_badge || 'Today' : 'Today') : '';
        
        const barElement = document.createElement('div');
        barElement.className = 'capacity-bar-item';
        barElement.style.cssText = `
            background: linear-gradient(135deg, rgba(26, 26, 26, 0.9), rgba(40, 40, 40, 0.9));
            border-radius: 12px;
            padding: 18px;
            margin-bottom: 14px;
            border: 2px solid ${borderColor};
            transition: all 0.3s ease;
            position: relative;
            overflow: hidden;
        `;
        
        // Add glow effect for today
        if (isToday) {
            barElement.style.boxShadow = `0 0 20px ${borderColor}40`;
        }
        
        // Labels for progress bar
        const reservedLabel = (typeof i18n !== 'undefined') ? i18n.translations[lang]?.reserved_label || (lang === 'ar' ? 'المقاعد المحجوزة' : 'Reserved') : (lang === 'ar' ? 'المقاعد المحجوزة' : 'Reserved');
        const remainingLabel = (typeof i18n !== 'undefined') ? i18n.translations[lang]?.remaining_label || (lang === 'ar' ? 'المتبقية' : 'Remaining') : (lang === 'ar' ? 'المتبقية' : 'Remaining');
        
        barElement.innerHTML = `
            ${isToday ? `<div style="position: absolute; top: 0; left: 0; right: 0; height: 3px; background: linear-gradient(90deg, ${borderColor}, transparent);"></div>` : ''}
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; flex-wrap: wrap; gap: 8px;">
                <div style="display: flex; align-items: center; flex-wrap: wrap; gap: 5px;">
                    <span style="font-family: 'Cairo', sans-serif; font-weight: 700; color: #c5a059; font-size: 16px;">
                        ${dateDisplay}${todayBadge}
                    </span>
                    ${currentBadge}
                </div>
                <span style="font-family: 'Cairo', sans-serif; font-size: 13px; color: ${statusColor}; font-weight: 700;">
                    ${statusText}
                </span>
            </div>
            <div style="margin-bottom: 10px;">
                <div style="display: flex; justify-content: space-between; font-family: 'Cairo', sans-serif; font-size: 11px; color: #aaa; margin-bottom: 6px;">
                    <span>${reservedLabel}: ${day.totalSeats}</span>
                    <span style="color: ${statusColor}; font-weight: bold;">${remainingLabel}: ${seatsRemaining}</span>
                </div>
                <div style="position: relative; height: 28px; background: rgba(255,255,255,0.08); border-radius: 14px; overflow: hidden; box-shadow: inset 0 2px 4px rgba(0,0,0,0.2);">
                    <div style="
                        position: absolute;
                        top: 0;
                        left: 0;
                        height: 100%;
                        width: ${Math.min(percentage, 100)}%;
                        background: ${gradientColor};
                        border-radius: 14px;
                        transition: width 0.5s ease;
                    "></div>
                    <div style="
                        position: absolute;
                        top: 0;
                        left: 0;
                        width: 100%;
                        height: 100%;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        font-family: 'Cairo', sans-serif;
                        font-size: 13px;
                        font-weight: bold;
                        color: ${percentage > 50 ? '#fff' : '#c5a059'};
                        text-shadow: 0 1px 3px rgba(0,0,0,0.4);
                    ">
                        ${percentage}%
                    </div>
                </div>
            </div>
            ${isCritical ? `
                <div style="background: rgba(231, 76, 60, 0.15); border: 1px solid #e74c3c; border-radius: 8px; padding: 10px 12px; display: flex; align-items: center; gap: 10px;">
                    <i class="fas fa-exclamation-circle" style="color: #e74c3c; font-size: 16px;"></i>
                    <div>
                        <div style="font-family: 'Cairo', sans-serif; font-size: 12px; font-weight: bold; color: #e74c3c;">
                            ${lang === 'ar' ? 'سعة حرجة!' : 'Critical Capacity!'}
                        </div>
                        <div style="font-family: 'Cairo', sans-serif; font-size: 11px; color: #ccc;">
                            ${lang === 'ar' 
                                ? `只剩 ${seatsRemaining} 个座位 - 请尽快确认`
                                : `Only ${seatsRemaining} seats remaining - confirm soon`}
                        </div>
                    </div>
                </div>
            ` : isWarning ? `
                <div style="background: rgba(243, 156, 18, 0.1); border: 1px solid #f39c12; border-radius: 8px; padding: 8px 12px; display: flex; align-items: center; gap: 8px;">
                    <i class="fas fa-exclamation-triangle" style="color: #f39c12; font-size: 14px;"></i>
                    <span style="font-family: 'Cairo', sans-serif; font-size: 11px; color: #f39c12;">
                        ${lang === 'ar' 
                            ? `تنبيه: ${seatsRemaining}座位 remaining`
                            : `Warning: ${seatsRemaining} seats remaining`}
                    </span>
                </div>
            ` : ''}
        `;
        
        container.appendChild(barElement);
    });
    
    console.log('✅ Capacity bars rendered:', filledCapacity.length, 'days (chronological order from today)');
}

// Initialize capacity data loading
document.addEventListener('DOMContentLoaded', () => {
    // ... existing initialization code ...
    
    // Load capacity data after other data
    setTimeout(() => {
        loadCapacityData();
        // Refresh capacity data every 5 minutes
        setInterval(loadCapacityData, 5 * 60 * 1000);
    }, 2000);
});