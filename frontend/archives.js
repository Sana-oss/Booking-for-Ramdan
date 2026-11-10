/**
 * Archives page (moved out of archives.html so the CSP can forbid inline script).
 */
// API_BASE compatibility (using constants.js)
const API_BASE = CONSTANTS.API.BASE || '';

// Debug: Log API_BASE to help troubleshoot URL issues
console.log('🔗 Archives Page - API_BASE:', API_BASE);
console.log('🔗 Archives Page - ARCHIVES.LIST:', CONSTANTS.API.ARCHIVES?.LIST || 'Not defined');

// =========================================
// LANGUAGE SWITCHER
// =========================================
let currentLanguage = 'ar';

function setLanguage(lang) {
    currentLanguage = lang;
    
    // Update HTML attributes
    document.documentElement.lang = lang;
    document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr';
    
    // Update language buttons
    document.querySelectorAll('.lang-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.lang === lang);
    });
    
    // Update text content for elements with data attributes
    updateTextContent();
    
    // Update placeholders
    updatePlaceholders();
    
    // Save preference
    localStorage.setItem('archiveLang', lang);
}

function updateTextContent() {
    // Update elements with data-ar/data-en attributes
    document.querySelectorAll('[data-ar][data-en]').forEach(el => {
        const key = currentLanguage === 'ar' ? 'data-ar' : 'data-en';
        if (el.tagName === 'INPUT' || el.tagName === 'SELECT') {
            // Skip input/select elements for text content
        } else {
            el.textContent = el.getAttribute(key);
        }
    });
    
    // Update button text
    document.querySelectorAll('.btn-text').forEach(btn => {
        btn.textContent = btn.getAttribute('data-' + currentLanguage);
    });
}

function updatePlaceholders() {
    document.querySelectorAll('.search-field').forEach(input => {
        input.placeholder = input.getAttribute('data-placeholder-' + currentLanguage);
    });
}

// Initialize language
function initLanguage() {
    const savedLang = localStorage.getItem('archiveLang') || 'ar';
    setLanguage(savedLang);
}

// =========================================
// AUTH & SECURITY
// =========================================
function checkAuth() {
    const token = localStorage.getItem('adminToken');
    const adminUser = localStorage.getItem('adminUser');
    
    if (!token || !adminUser) {
        window.location.href = 'admin-login.html';
        return false;
    }
    return true;
}

if (!checkAuth()) {
    throw new Error('Unauthorized - Redirecting to login');
}

function logout() {
    localStorage.removeItem('adminToken');
    localStorage.removeItem('adminUser');
    window.location.href = 'admin-login.html';
}

// =========================================
// DATA MANAGEMENT
// =========================================
let archivesData = [];
let totalPages = 1;
let currentPage = 1;
let archiveStats = { arrived: 0, noShow: 0, cancelled: 0, expired: 0 };

// Load archive stats
async function loadArchiveStats() {
    try {
        const token = localStorage.getItem('adminToken');
        const headers = { 'Content-Type': 'application/json' };
        if (token) headers['Authorization'] = 'Bearer ' + token;
        
        const response = await fetch(API_BASE + '/bookings/archive/stats', { headers: headers });
        const result = await response.json();
        
        if (result.success) {
            archiveStats = {
                arrived: result.data.Arrived?.count || 0,
                noShow: result.data['No-Show']?.count || 0,
                cancelled: result.data.Cancelled?.count || 0,
                expired: result.data.Expired?.count || 0
            };
            updateStatsDisplay();
        }
    } catch (error) {
        console.error('Error loading archive stats:', error);
    }
}

function updateStatsDisplay() {
    document.getElementById('servedCount').textContent = archiveStats.arrived || 0;
    document.getElementById('noShowCount').textContent = archiveStats.noShow || 0;
    document.getElementById('cancelledCount').textContent = archiveStats.cancelled || 0;
    document.getElementById('expiredCount').textContent = archiveStats.expired || 0;
}

// Store full data for client-side filtering
let fullArchivesData = [];
const ITEMS_PER_PAGE = 50;

// Initialize Flatpickr for archives (no minDate restriction for past dates)
document.addEventListener('DOMContentLoaded', () => {
    const archiveRangePicker = document.getElementById('archiveRangePicker');
    
    // Get current language
    const currentLang = localStorage.getItem('hotel_lang') || 'ar';
    
    // Set locale based on language
    const locale = currentLang === 'en' ? flatpickr.l10ns.en : flatpickr.l10ns.ar;
    
    if (archiveRangePicker) {
        flatpickr("#archiveRangePicker", {
            mode: "range",
            dateFormat: "Y-m-d",
            locale: locale,
            defaultDate: null,
            onChange: function(selectedDates) {
                if (selectedDates.length === 2) {
                    applyFilters(selectedDates[0], selectedDates[1]);
                } else if (selectedDates.length === 0) {
                    applyFilters(null, null);
                }
            }
        });
    }
});

// Clear date filters
function clearDateFilters() {
    const archiveRangePicker = document.getElementById('archiveRangePicker');
    if (archiveRangePicker && archiveRangePicker._flatpickr) {
        archiveRangePicker._flatpickr.clear();
    }
    applyFilters(null, null);
}

// Apply filters to full data (search + status + date range)
function applyFilters(startDateParam = null, endDateParam = null) {
    const searchTerm = document.getElementById('searchInput').value.toLowerCase().trim();
    const selectedStatus = document.getElementById('reasonFilter').value;
    
    // Use provided dates or default to null
    const startDate = startDateParam;
    const endDate = endDateParam;
    
    const filteredData = fullArchivesData.filter(booking => {
        const status = booking.status || booking.archiveReason || '';
        
        // Check status match (must match exactly, or show all if empty)
        const matchesStatus = !selectedStatus || status === selectedStatus;
        
        // Check search match (name, phone, or reference)
        const guestName = booking.name || (booking.firstName && booking.lastName ? booking.firstName + ' ' + booking.lastName : booking.firstName || booking.lastName || '');
        const matchesSearch = !searchTerm || 
            guestName.toLowerCase().includes(searchTerm) ||
            (booking.phone && booking.phone.includes(searchTerm)) ||
            (booking.referenceNumber && booking.referenceNumber.toLowerCase().includes(searchTerm));
        
        // Check date range match with proper normalization
        let matchesDateRange = true;
        if (startDate || endDate) {
            const bookingDate = new Date(booking.date || booking.createdAt || booking.archivedAt);
            bookingDate.setHours(0, 0, 0, 0); // Normalize to start of day
            
            if (startDate) {
                const start = new Date(startDate);
                start.setHours(0, 0, 0, 0); // Normalize to start of day
                matchesDateRange = matchesDateRange && bookingDate.getTime() >= start.getTime();
            }
            if (endDate) {
                const end = new Date(endDate);
                end.setHours(23, 59, 59, 999); // End of day
                matchesDateRange = matchesDateRange && bookingDate.getTime() <= end.getTime();
            }
        }
        
        return matchesStatus && matchesSearch && matchesDateRange;
    });
    
    // Sort and paginate filtered data
    filteredData.sort((a, b) => new Date(b.createdAt || b.archivedAt) - new Date(a.createdAt || a.archivedAt));
    
    currentPage = 1;
    const start = 0;
    const paginatedData = filteredData.slice(start, ITEMS_PER_PAGE);
    
    archivesData = filteredData;
    totalPages = Math.ceil(filteredData.length / ITEMS_PER_PAGE);
    renderTable(paginatedData);
    renderPagination();
    
    console.log('Filters applied:', { searchTerm, selectedStatus, totalResults: filteredData.length });
}

// Calculate stats from combined data (live calculation)
function updateStatCardsFromData(data) {
    const stats = {
        served: 0,
        noShow: 0,
        cancelled: 0,
        expired: 0
    };
    
    data.forEach(item => {
        const status = item.status || item.archiveReason || '';
        switch (status) {
            case 'Confirmed':
            case 'Arrived':
                stats.served++;
                break;
            case 'No Show':
            case 'No-Show':
                stats.noShow++;
                break;
            case 'Cancelled':
                stats.cancelled++;
                break;
            case 'Expired':
                stats.expired++;
                break;
            default:
                // Log unknown status for debugging
                console.log('Unknown status:', status, 'for item:', item.referenceNumber);
        }
    });
    
    // Debug: Log all unique statuses found in data
    const uniqueStatuses = [...new Set(data.map(item => item.status || item.archiveReason || 'undefined'))];
    console.log('Unique statuses in data:', uniqueStatuses);
    console.log('Calculated stats:', stats);
    
    // Update DOM elements with correct IDs (matching HTML)
    if(document.getElementById('servedCount'))
        document.getElementById('servedCount').innerText = stats.served;
    if(document.getElementById('noShowCount'))
        document.getElementById('noShowCount').innerText = stats.noShow;
    if(document.getElementById('cancelledCount'))
        document.getElementById('cancelledCount').innerText = stats.cancelled;
    if(document.getElementById('expiredCount'))
        document.getElementById('expiredCount').innerText = stats.expired;
    
    console.log('Stats Force-Updated:', stats);
}

// Load archives from the deduplicated admin endpoint
async function loadArchives() {
    const search = document.getElementById('searchInput').value;
    const reason = document.getElementById('reasonFilter').value;
    
    try {
        const token = localStorage.getItem('adminToken');
        const headers = { 'Content-Type': 'application/json' };
        if (token) headers['Authorization'] = 'Bearer ' + token;
        
        // Use the deduplicated admin endpoint ONLY
        const adminUrlAll = CONSTANTS.API.ARCHIVES?.LIST || (API_BASE + '/admin/archived-bookings');
        console.log('📥 Fetching deduplicated data from:', adminUrlAll);
        const adminResponseAll = await fetch(adminUrlAll, { headers: headers });
        
        // Check for auth errors
        if (adminResponseAll.status === 401) {
            console.error('❌ Unauthorized - redirecting to login');
            localStorage.removeItem('adminToken');
            localStorage.removeItem('adminUser');
            window.location.href = 'admin-login.html';
            return;
        }
        
        const adminResultAll = await adminResponseAll.json();
        console.log('📊 Admin archived bookings result:', adminResultAll);
        
        if (!adminResultAll.success) {
            throw new Error(adminResultAll.message || 'Failed to fetch archives');
        }
        
        // Use deduplicated data directly
        let allDataForStats = adminResultAll.data || [];
        
        // Client-side deduplication as final safety net
        // Create a Map keyed by unique identifier
        const uniqueMap = new Map();
        allDataForStats.forEach(item => {
            // Generate unique key: referenceNumber or name+phone+date
            let key = item.referenceNumber;
            if (!key || key === 'N/A') {
                key = `${(item.name || '').toLowerCase()}:${(item.phone || '').replace(/\D/g, '')}:${item.date || ''}`;
            }
            // Only add if key doesn't exist OR this item has valid archivedAt
            if (!uniqueMap.has(key)) {
                uniqueMap.set(key, item);
            } else if (item.archivedAt && uniqueMap.get(key).archivedAt === null) {
                // Replace if current item has valid archivedAt and existing doesn't
                uniqueMap.set(key, item);
            }
        });
        
        allDataForStats = Array.from(uniqueMap.values());
        
        // Update stat cards
        updateStatCardsFromData(allDataForStats);
        
        // Store for client-side filtering
        fullArchivesData = allDataForStats;
        
        // Apply filters and render
        applyFilters();
        
        // FORCE UPDATE STATS at the absolute end (after all rendering)
        setTimeout(() => {
            updateStatCardsFromData(fullArchivesData);
            console.log('Stats Force-Updated to:', {
                served: allDataForStats.filter(b => b.status === 'Confirmed').length,
                noShow: allDataForStats.filter(b => b.status === 'No Show' || b.status === 'No-Show').length,
                cancelled: allDataForStats.filter(b => b.status === 'Cancelled').length,
                expired: allDataForStats.filter(b => b.status === 'Expired').length
            });
        }, 500);
    } catch (error) {
        console.error('Error loading archives:', error);
        const emptyMsg = currentLanguage === 'ar' ? 'لا توجد سجلات في الأرشيف' : 'No archive records found';
        document.getElementById('archiveTableBody').innerHTML = '<tr><td colspan="8" class="empty-state"><i class="fas fa-exclamation-triangle"></i><p>' + emptyMsg + '</p></td></tr>';
    }
}

// Render table
function renderTable(data) {
    const tbody = document.getElementById('archiveTableBody');
    
    const emptyMsg = currentLanguage === 'ar' ? 'لا توجد سجلات في الأرشيف' : 'No archive records found';
    const errorMsg = currentLanguage === 'ar' ? 'حدث خطأ في تحميل البيانات' : 'Error loading data';
    
    if (!data || data.length === 0) {
        tbody.innerHTML = '<tr><td colspan="8" class="empty-state"><i class="fas fa-folder-open"></i><p>' + emptyMsg + '</p></td></tr>';
        return;
    }
    
    // Client-side deduplication as final safety net
    // Include ALL items, even without archivedAt
    const uniqueMap = new Map();
    data.forEach(item => {
        // Generate unique key
        let key = item.referenceNumber;
        if (!key || key === 'N/A') {
            key = `${(item.name || '').toLowerCase()}:${(item.phone || '').replace(/\D/g, '')}:${item.date || ''}`;
        }
        
        // Always add item (later items with same key replace earlier ones)
        uniqueMap.set(key, item);
    });
    
    const dedupedData = Array.from(uniqueMap.values());
    
    let html = '';
    const restoreText = currentLanguage === 'ar' ? 'استعادة' : 'Restore';
    const restoreIcon = currentLanguage === 'ar' ? 'fa-undo' : 'fa-rotate-left';
    
    for (let i = 0; i < dedupedData.length; i++) {
        const archive = dedupedData[i];
        
        // Debug: Log booking data to console
        console.log('Booking:', archive.referenceNumber, 'archivedAt:', archive.archivedAt, 'cancelledAt:', archive.cancelledAt, 'updatedAt:', archive.updatedAt);
        
        // Debug: Log full booking object to see all fields
        console.log('Full Booking Object:', archive);
        
        // Ultimate fallback for ARCHIVED/CANCELLED date (NOT booking date)
        const allDateFields = [
            archive.archivedAt,
            archive.cancelledAt,
            archive.updatedAt
        ];
        
        // Find first valid date from any field
        let rawDate = null;
        for (const field of allDateFields) {
            if (field && typeof field === 'object') {
                if (field instanceof Date && !isNaN(field.getTime())) {
                    rawDate = field;
                    break;
                }
                // Handle MongoDB $date wrapper
                if (field.$date) {
                    const d = new Date(field.$date);
                    if (!isNaN(d.getTime())) {
                        rawDate = d;
                        break;
                    }
                }
            } else if (field && (typeof field === 'string' || typeof field === 'number')) {
                const d = new Date(field);
                if (!isNaN(d.getTime())) {
                    rawDate = d;
                    break;
                }
            }
        }
        
        const formattedDate = rawDate 
            ? rawDate.toLocaleString('en-GB', { day:'2-digit', month:'2-digit', year:'numeric', hour:'2-digit', minute:'2-digit', hour12:true }) 
            : '<span class="date-na">N/A</span>';
        
        console.log('Found rawDate:', rawDate, 'formattedDate:', formattedDate);
        
        // Determine status from different possible fields
        const status = archive.status || archive.archiveReason || 'Cancelled';
        
        // Determine who archived it with proper fallback
        const archivedBy = archive.archivedBy || archive.cancelledBy || archive.updatedBy || 'Staff';
            
        html += '<tr>';
        html += '<td class="ref-cell"><span class="ref-number">' + escapeHtml(archive.referenceNumber || 'N/A') + '</span></td>';
        
        // Guest name - handle both formats
        const guestName = archive.name || (archive.firstName && archive.lastName ? archive.firstName + ' ' + archive.lastName : archive.firstName || archive.lastName || 'N/A');
        html += '<td><div class="guest-info"><span class="name">' + escapeHtml(guestName) + '</span><span class="phone">' + escapeHtml(archive.phone || '') + '</span></div></td>';
        
        html += '<td class="date-cell">' + formatDate(archive.date) + '</td>';
        html += '<td class="guests-cell"><span class="guests-count">' + (archive.guests || archive.numberOfSeats || 1) + '</span></td>';
        html += '<td class="status-cell">' + getStatusBadge(status) + '</td>';
        
        // Show Cancellation Date for cancelled bookings, otherwise show Archived Date
        let dateLabel = currentLanguage === 'ar' ? 'تاريخ الأرشفة' : 'Archived';
        if (status === 'Cancelled' || status === 'No-Show') {
            dateLabel = currentLanguage === 'ar' ? 'تاريخ الإلغاء' : 'Cancelled';
        } else if (status === 'Arrived') {
            dateLabel = currentLanguage === 'ar' ? 'تاريخ الوصول' : 'Arrived';
        } else if (status === 'Expired') {
            dateLabel = currentLanguage === 'ar' ? 'تاريخ الانتهاء' : 'Expired';
        }
        html += '<td class="archived-date-cell" title="' + dateLabel + '">' + formattedDate + '</td>';
        html += '<td class="performed-by-cell"><span class="admin-name">' + escapeHtml(archivedBy) + '</span></td>';
        html += '<td class="actions-cell"><button class="btn-restore" data-action="restoreBooking" data-args="[&quot;' + escapeHtml(archive._id) + '&quot;]"><i class="fas ' + restoreIcon + '"></i> ' + restoreText + '</button></td>';
        html += '</tr>';
    }
    
    tbody.innerHTML = html || '<tr><td colspan="8" class="empty-state"><i class="fas fa-folder-open"></i><p>' + emptyMsg + '</p></td></tr>';
}

// Get status badge HTML (handles both status and archiveReason)
function getStatusBadge(status) {
    const iconMap = {
        'Arrived': 'fa-check-circle',
        'No-Show': 'fa-user-times',
        'No Show': 'fa-user-times',
        'Cancelled': 'fa-times-circle',
        'Expired': 'fa-clock',
        'Pending': 'fa-hourglass-half',
        'Confirmed': 'fa-check',
        'Rejected': 'fa-ban'
    };
    const classMap = {
        'Arrived': 'badge-arrived',
        'No-Show': 'badge-noshow',
        'No Show': 'badge-noshow',
        'Cancelled': 'badge-cancelled',
        'Expired': 'badge-expired',
        'Pending': 'badge-pending',
        'Confirmed': 'badge-confirmed',
        'Rejected': 'badge-cancelled'
    };
    const icon = iconMap[status] || 'fa-circle';
    const badgeClass = classMap[status] || 'badge-default';
    const text = i18n.tStatus(status);
    return '<span class="badge ' + badgeClass + '"><i class="fas ' + icon + '"></i> ' + escapeHtml(text) + '</span>';
}

// Format date with fallback for invalid dates
function formatDate(dateStr) {
    if (!dateStr) return '<span class="date-na">N/A</span>';
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return '<span class="date-na">N/A</span>';
    const options = currentLanguage === 'ar' 
        ? { year: 'numeric', month: 'long', day: 'numeric' }
        : { year: 'numeric', month: 'short', day: 'numeric' };
    return date.toLocaleDateString(currentLanguage === 'ar' ? 'ar-EG' : 'en-US', options);
}

// Format date with time (YYYY-MM-DD | HH:mm) - handles invalid dates
function formatDateTime(dateStr) {
    if (!dateStr) return '<span class="date-na">N/A</span>';
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return '<span class="date-na">N/A</span>';
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    return year + '-' + month + '-' + day + ' | ' + hours + ':' + minutes;
}

// Escape HTML to prevent XSS
function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Format time for Excel (HH:mm:ss)
function formatTimeForExcel(dateStr) {
    const date = new Date(dateStr);
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    const seconds = String(date.getSeconds()).padStart(2, '0');
    return hours + ':' + minutes + ':' + seconds;
}

// Render pagination
function renderPagination() {
    const pagination = document.getElementById('pagination');
    
    if (totalPages <= 1) {
        pagination.innerHTML = '';
        return;
    }
    
    let html = '';
    const prevText = currentLanguage === 'ar' ? '<i class="fas fa-chevron-right"></i>' : '<i class="fas fa-chevron-left"></i>';
    const nextText = currentLanguage === 'ar' ? '<i class="fas fa-chevron-left"></i>' : '<i class="fas fa-chevron-right"></i>';
    
    html += '<button' + (currentPage === 1 ? ' disabled' : '') + ' data-action="goToPage" data-args="[' + (currentPage - 1) + ']">' + prevText + '</button>';
    
    for (let i = 1; i <= totalPages; i++) {
        if (i === 1 || i === totalPages || (i >= currentPage - 2 && i <= currentPage + 2)) {
            html += '<button class="' + (i === currentPage ? 'active' : '') + '" data-action="goToPage" data-args="[' + i + ']">' + i + '</button>';
        } else if (i === currentPage - 3 || i === currentPage + 3) {
            html += '<button disabled>...</button>';
        }
    }
    
    html += '<button' + (currentPage === totalPages ? ' disabled' : '') + ' data-action="goToPage" data-args="[' + (currentPage + 1) + ']">' + nextText + '</button>';
    
    pagination.innerHTML = html;
}

// Go to page (client-side pagination)
function goToPage(page) {
    currentPage = page;
    
    // Paginate the already-filtered archivesData
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    const paginatedData = archivesData.slice(start, start + ITEMS_PER_PAGE);
    
    renderTable(paginatedData);
    renderPagination();
    
    // Scroll to top of table
    document.getElementById('archiveTableBody')?.scrollIntoView({ behavior: 'smooth' });
}

// Handle search
let searchTimeout;

/**
 * Clean Archive Search - Strict 8 character alphanumeric uppercase
 */
function cleanArchiveSearch(input) {
    let value = input.value.toUpperCase();
    value = value.replace(/[^A-Z0-9\-]/g, '');
    if (value.length > 10) {
        value = value.slice(0, 10);
    }
    input.value = value;
    handleSearch();
}

function handleSearch() {
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(function() {
        applyFilters();
    }, 300);
}

// Export to Excel
function exportToExcel() {
    const table = document.querySelector("#archivesTable");
    if (!table) return;
    
    let html = table.outerHTML;
    // Clean up HTML (remove action buttons or icons if they exist in the export)
    html = html.replace(/<button\b[^>]*>([\s\S]*?)<\/button>/gi, "");
    html = html.replace(/<i\b[^>]*>([\s\S]*?)<\/i>/gi, "");
    
    const url = 'data:application/vnd.ms-excel;base64,' + btoa(unescape(encodeURIComponent(html)));
    const link = document.createElement('a');
    link.href = url;
    
    // Filename with current date
    const date = new Date().toISOString().slice(0, 10);
    link.download = `Corinthia_Ramadan_Archives_${date}.xls`;
    
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

// Toast notification
function showToast(message, type) {
    type = type || 'info';
    
    const existingToast = document.querySelector('.toast');
    if (existingToast) {
        existingToast.remove();
    }
    
    const toast = document.createElement('div');
    toast.className = 'toast ' + type;
    const icon = type === 'success' ? 'fa-check-circle' : type === 'error' ? 'fa-times-circle' : 'fa-info-circle';
    toast.innerHTML = '<i class="fas ' + icon + '"></i> ' + message;
    document.body.appendChild(toast);
    
    setTimeout(function() {
        toast.style.animation = 'slideIn 0.3s ease reverse';
        setTimeout(function() { toast.remove(); }, 300);
    }, 3000);
}

// Restore booking
async function restoreBooking(id) {
    const confirmMsg = currentLanguage === 'ar' 
        ? 'هل أنت متأكد من استعادة هذا الحجز من الأرشيف؟\nسيتم نقله إلى الحجوزات النشطة.'
        : 'Are you sure you want to restore this booking from archive?\nIt will be moved back to active bookings.';
    
    if (!confirm(confirmMsg)) return;
    
    console.log('🔧 Restore Debug:');
    console.log('  - ID:', id);
    console.log('  - CONSTANTS.API.ARCHIVES.RESTORE:', CONSTANTS.API.ARCHIVES.RESTORE(id));
    
    try {
        const token = localStorage.getItem('adminToken');
        console.log('  - Token exists:', !!token);
        const response = await fetch(CONSTANTS.API.ARCHIVES.RESTORE(id), {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': 'Bearer ' + token
            }
        });
        
        const result = await response.json();
        
        if (result.success) {
            const successMsg = currentLanguage === 'ar' ? 'تم استعادة الحجز بنجاح!' : 'Booking restored successfully!';
            showToast(successMsg, 'success');
            loadArchives();
            loadArchiveStats();
        } else {
            const errorMsg = currentLanguage === 'ar' ? 'فشل في الاستعادة: ' : 'Restore failed: ';
            showToast(errorMsg + result.message, 'error');
        }
    } catch (error) {
        console.error('Restore error:', error);
        const errorMsg = currentLanguage === 'ar' ? 'حدث خطأ أثناء الاستعادة' : 'Error during restore';
        showToast(errorMsg, 'error');
    }
}

// =========================================
// INITIALIZE
// =========================================
document.addEventListener('DOMContentLoaded', function() {
    initLanguage();
    // loadArchives() already calculates stats from combined data
    // No need for separate loadArchiveStats() call
    loadArchives();
});
