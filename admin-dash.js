/**
 * CORINTHIA HOTELS - ADMIN DASHBOARD ENGINE (FINAL ROYAL EDITION)
 * مخصص لإدارة الحجوزات، الترجمة الديناميكية، وتصدير التقارير
 */

let allBookings = []; // قاعدة البيانات المحلية

document.addEventListener('DOMContentLoaded', () => {
    // 1. الأمان والتحقق من الهوية
    checkAuthentication();

    // 2. تهيئة الترجمة (i18n)
    if (typeof i18n !== 'undefined') i18n.init();

    // 3. جلب البيانات الأولية
    refreshAdminData();

    // 4. تفعيل مستمعات أحداث الفلاتر
    setupActionListeners();

    // 5. التحديث التلقائي الصامت (كل دقيقة)
    setInterval(refreshAdminData, 60000);
});

function checkAuthentication() {
    if (localStorage.getItem('isAdminLoggedIn') !== 'true') {
        window.location.href = 'Admin-login.html';
    }
}

async function refreshAdminData() {
    try {
        const response = await fetch(CONSTANTS.API.BOOKINGS);
        const result = await response.json();

        if (result.success && result.data) {
            allBookings = result.data;
            applyAdvancedFilters();
        }
    } catch (error) {
        console.error("Data Sync Error:", error);
        showRamadanToast("فشل الاتصال بمزود البيانات");
    }
}

function setupActionListeners() {
    const sInput = document.getElementById('searchInput');
    const dInput = document.getElementById('dateFilter');

    if (sInput) sInput.addEventListener('input', applyAdvancedFilters);
    if (dInput) dInput.addEventListener('change', applyAdvancedFilters);
}

/**
 * تطبيق الفلترة المزدوجة (البحث + التاريخ)
 */
function applyAdvancedFilters() {
    const searchTerm = document.getElementById('searchInput')?.value.toLowerCase() || "";
    const selectedDate = document.getElementById('dateFilter')?.value || "";

    const filtered = allBookings.filter(booking => {
        const bDate = new Date(booking.date).toISOString().split('T')[0];
        const isDateMatch = !selectedDate || bDate === selectedDate;
        const isSearchMatch = booking.name.toLowerCase().includes(searchTerm) || 
                              booking.phone.includes(searchTerm);
        return isDateMatch && isSearchMatch;
    });

    renderAdminTable(filtered);
    updateStatsCards(filtered);
}

/**
 * بناء الجدول مع ترجمة البيانات (التواريخ والحالات)
 */
function renderAdminTable(data) {
    const tableBody = document.getElementById(CONSTANTS.SELECTORS.ADMIN_TABLE_BODY);
    if (!tableBody) return;

    const lang = i18n.currentLang; // جلب اللغة الحالية من محرك الترجمة

    if (data.length === 0) {
        tableBody.innerHTML = `<tr><td colspan="6" style="text-align:center; padding:50px; color:#999;">${i18n.translations[lang].no_results}</td></tr>`;
        return;
    }

    // خريطة ترجمة الحالات
    const statusMap = {
        ar: { Pending: "قيد الانتظار", Confirmed: "تم التأكيد", Cancelled: "ملغي" },
        en: { Pending: "Pending", Confirmed: "Confirmed", Cancelled: "Cancelled" }
    };

    const sorted = [...data].reverse();

    tableBody.innerHTML = sorted.map(booking => {
        // ترجمة التواريخ ديناميكياً
        const dateOptions = { year: 'numeric', month: 'long', day: 'numeric' };
        const displayDate = new Date(booking.date).toLocaleDateString(lang === 'ar' ? 'ar-EG' : 'en-US', dateOptions);

        return `
        <tr class="fade-in-row">
            <td class="id-cell">#${booking._id.slice(-6).toUpperCase()}</td>
            <td>
                <div class="guest-info">
                    <span class="g-name" style="font-weight:700; color:#333; display:block;">${booking.name}</span>
                    <span class="g-phone" style="font-size:0.8rem; color:var(--gold);">${booking.phone}</span>
                </div>
            </td>
            <td style="font-weight:600;">${displayDate}</td>
            <td><span class="badge-count">${booking.guests}</span></td>
            <td>
                <select class="status-badge status-${booking.status}" 
                        onchange="updateBookingStatus('${booking._id}', this.value)">
                    <option value="Pending" ${booking.status === 'Pending' ? 'selected' : ''}>${statusMap[lang].Pending}</option>
                    <option value="Confirmed" ${booking.status === 'Confirmed' ? 'selected' : ''}>${statusMap[lang].Confirmed}</option>
                    <option value="Cancelled" ${booking.status === 'Cancelled' ? 'selected' : ''}>${statusMap[lang].Cancelled}</option>
                </select>
            </td>
            <td>
                <button class="delete-btn" onclick="handleDelete('${booking._id}')">
                    <i class="fas fa-trash-alt"></i>
                </button>
            </td>
        </tr>
    `;}).join('');

    // إعادة ترجمة رؤوس الجدول الثابتة
    if (typeof i18n !== 'undefined') i18n.apply();
}

/**
 * تحديث حالة الحجز في السيرفر
 */
async function updateBookingStatus(id, newStatus) {
    try {
        const response = await fetch(CONSTANTS.API.ITEM(id), {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status: newStatus })
        });

        if (response.ok) {
            const index = allBookings.findIndex(b => b._id === id);
            if (index !== -1) {
                allBookings[index].status = newStatus;
                applyAdvancedFilters();
                showRamadanToast(i18n.currentLang === 'ar' ? "تم تحديث الحالة" : "Status Updated");
            }
        }
    } catch (err) {
        showRamadanToast("خطأ في تحديث البيانات");
    }
}

/**
 * تحديث أرقام الإحصائيات في الكروت
 */
function updateStatsCards(data) {
    const stats = {
        total: data.length,
        confirmed: data.filter(b => b.status === 'Confirmed').length,
        pending: data.filter(b => b.status === 'Pending').length
    };

    const s = CONSTANTS.SELECTORS;
    if (document.getElementById(s.TOTAL_COUNT)) document.getElementById(s.TOTAL_COUNT).innerText = stats.total;
    if (document.getElementById(s.CONFIRMED_COUNT)) document.getElementById(s.CONFIRMED_COUNT).innerText = stats.confirmed;
    if (document.getElementById(s.PENDING_COUNT)) document.getElementById(s.PENDING_COUNT).innerText = stats.pending;
}

/**
 * تصدير البيانات إلى Excel (يدعم العربية)
 */
function exportToExcel() {
    const lang = i18n.currentLang;
    if (allBookings.length === 0) return;

    const exportData = allBookings.map(b => ({
        [lang === 'ar' ? "المعرف" : "ID"]: b._id.slice(-6).toUpperCase(),
        [lang === 'ar' ? "الاسم" : "Name"]: b.name,
        [lang === 'ar' ? "الهاتف" : "Phone"]: b.phone,
        [lang === 'ar' ? "التاريخ" : "Date"]: new Date(b.date).toLocaleDateString(lang === 'ar' ? 'ar-EG' : 'en-US'),
        [lang === 'ar' ? "الأفراد" : "Pax"]: b.guests,
        [lang === 'ar' ? "الحالة" : "Status"]: b.status
    }));

    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Bookings");
    XLSX.writeFile(wb, `Corinthia_Report_${new Date().toISOString().split('T')[0]}.xlsx`);
}

/**
 * حذف حجز
 */
async function handleDelete(id) {
    const msg = i18n.currentLang === 'ar' ? "هل أنت متأكد من الحذف؟" : "Are you sure?";
    if (!confirm(msg)) return;

    try {
        const response = await fetch(CONSTANTS.API.ITEM(id), { method: 'DELETE' });
        if (response.ok) {
            allBookings = allBookings.filter(b => b._id !== id);
            applyAdvancedFilters();
            showRamadanToast(i18n.currentLang === 'ar' ? "تم الحذف" : "Deleted Successfully");
        }
    } catch (err) {
        showRamadanToast("فشل الحذف");
    }
}

/**
 * تصفير الفلاتر
 */
function resetFilter() {
    document.getElementById('dateFilter').value = '';
    document.getElementById('searchInput').value = '';
    applyAdvancedFilters();
}

/**
 * تسجيل الخروج
 */
function logout() {
    localStorage.removeItem('isAdminLoggedIn');
    window.location.href = 'Admin-login.html';
}

/**
 * التنبيهات الرمضانية الذهبية
 */
function showRamadanToast(message) {
    const old = document.querySelector('.new-booking-toast');
    if (old) old.remove();

    const toast = document.createElement('div');
    toast.className = 'new-booking-toast';
    toast.innerHTML = `<i class="fas fa-moon"></i> ${message}`;
    document.body.appendChild(toast);
    
    setTimeout(() => {
        toast.style.opacity = '0';
        setTimeout(() => toast.remove(), 500);
    }, 3000);
}