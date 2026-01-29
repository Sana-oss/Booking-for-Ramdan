/**
 * CORINTHIA HOTEL - ADMIN DASHBOARD (V8 - ELITE EDITION)
 * المحرك التشغيلي: إدارة الحجوزات، البحث الذكي، تصدير التقارير، وتأمين الجلسة
 */

let allBookings = []; // قاعدة البيانات المؤقتة في المتصفح

document.addEventListener('DOMContentLoaded', () => {
    // 1. الأمان: التحقق من أن المستخدم مدير
    checkAdminAuth();

    // 2. تهيئة النظام واللغة
    if (typeof i18n !== 'undefined') i18n.init();

    // 3. جلب البيانات من السيرفر
    loadBookingsFromServer();

    // 4. تفعيل مستمعات الأحداث للفلاتر الجديدة
    initializeEventListeners();

    // 5. المزامنة الحية: تحديث البيانات تلقائياً كل 60 ثانية
    setInterval(syncDataSilently, 60000);
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
        const response = await fetch(CONSTANTS.API.AUTH.ME, {
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
        const response = await fetch(CONSTANTS.API.BOOKINGS);
        const result = await response.json();

        if (result.success && result.data) {
            allBookings = result.data;
            applySmartFilters(); 
        }
    } catch (error) {
        console.error("خطأ أثناء جلب البيانات:", error);
        showNotification("تعذر الاتصال بالسيرفر حالياً");
    }
}

/**
 * تفعيل مستمعات الأحداث (البحث والفلترة)
 */
function initializeEventListeners() {
    const searchInput = document.getElementById('searchInput');
    const dateInput = document.getElementById('dateFilter');

    // البحث الفوري عند الكتابة
    if (searchInput) {
        searchInput.addEventListener('input', () => {
            applySmartFilters();
        });
    }

    // الفلترة عند اختيار تاريخ
    if (dateInput) {
        dateInput.addEventListener('change', () => {
            applySmartFilters();
        });
    }
}

/**
 * نظام الفلترة الذكي (بحث + تاريخ)
 */
function applySmartFilters() {
    const searchTerm = document.getElementById('searchInput')?.value.toLowerCase() || "";
    const selectedDate = document.getElementById('dateFilter')?.value || "";

    const filteredResults = allBookings.filter(booking => {
        // فلترة التاريخ
        const bDate = new Date(booking.date).toISOString().split('T')[0];
        const isDateMatch = !selectedDate || bDate === selectedDate;
        
        // فلترة البحث (اسم أو هاتف)
        const isSearchMatch = 
            booking.name.toLowerCase().includes(searchTerm) || 
            booking.phone.includes(searchTerm);

        return isDateMatch && isSearchMatch;
    });

    renderAdminTable(filteredResults);
    updateDashboardStats(filteredResults);
}

/**
 * بناء جدول الحجوزات في الصفحة
 */
function renderAdminTable(data) {
    const tableBody = document.getElementById(CONSTANTS.SELECTORS.ADMIN_TABLE_BODY);
    if (!tableBody) return;

    if (data.length === 0) {
        tableBody.innerHTML = `<tr><td colspan="6" style="text-align:center; padding:50px; color:#999; font-weight:bold;">لا توجد حجوزات مطابقة لمعايير البحث</td></tr>`;
        return;
    }

    // ترتيب البيانات: الأحدث يظهر أولاً (بدون reverse لأن السيرفر قد يرجعها مرتبة بالفعل)
    const sortedData = [...data].sort((a, b) => new Date(b.date) - new Date(a.date));

    // ضمان عرض 12 حجز فقط في الجدول (حسب المطلوب) مع بقاء الإحصائيات على النتائج المفلترة
    const displayData = sortedData.slice(0, 12);

    tableBody.innerHTML = displayData.map(booking => `
        <tr class="fade-in-row">
            <td class="id-cell">#${booking._id.slice(-6).toUpperCase()}</td>
            <td>
                <div class="guest-info">
                    <span class="name" style="display:block; font-weight:700;">${booking.name}</span>
                    <span class="phone" style="font-size:0.85rem; color:#888;">${booking.phone}</span>
                </div>
            </td>
            <td style="font-weight:bold;">${new Date(booking.date).toLocaleDateString('ar-EG')}</td>
            <td><span class="guests-count">${booking.guests}</span></td>
            <td>
                <select class="status-badge status-${booking.status}" 
                        onchange="updateBookingStatus('${booking._id}', this.value)">
                    <option value="Pending" ${booking.status === 'Pending' ? 'selected' : ''}>Pending</option>
                    <option value="Confirmed" ${booking.status === 'Confirmed' ? 'selected' : ''}>Confirmed</option>
                    <option value="Cancelled" ${booking.status === 'Cancelled' ? 'selected' : ''}>Cancelled</option>
                </select>
            </td>
            <td>
                <button class="delete-btn" onclick="confirmDelete('${booking._id}')" title="حذف الحجز">
                    <i class="fas fa-trash-alt"></i>
                </button>
            </td>
        </tr>
    `).join('');
}

/**
 * تحديث حالة الحجز في قاعدة البيانات (مع JWT Token)
 */
async function updateBookingStatus(id, newStatus) {
    try {
        const token = localStorage.getItem('adminToken');
        const headers = {
            'Content-Type': 'application/json'
        };
        
        if (token) {
            headers['Authorization'] = `Bearer ${token}`;
        }
        
        const response = await fetch(CONSTANTS.API.ITEM(id), {
            method: 'PATCH',
            headers: headers,
            body: JSON.stringify({ status: newStatus })
        });
        
        if (response.status === 401) {
            localStorage.removeItem('adminToken');
            localStorage.removeItem('adminUser');
            window.location.href = 'admin-login.html';
            return;
        }

        if (response.ok) {
            const index = allBookings.findIndex(b => b._id === id);
            if (index !== -1) {
                allBookings[index].status = newStatus;
                applySmartFilters(); // تحديث فوري للإحصائيات والألوان
                showNotification("تم تحديث حالة الحجز بنجاح");
            }
        }
    } catch (err) {
        console.error("Update Status Error:", err);
        showNotification("حدث خطأ أثناء التحديث");
    }
}

/**
 * تصدير البيانات الظاهرة إلى ملف Excel
 */
function exportToExcel() {
    const tableBody = document.getElementById(CONSTANTS.SELECTORS.ADMIN_TABLE_BODY);
    // نصدّر البيانات المفلترة حالياً فقط
    const searchTerm = document.getElementById('searchInput')?.value.toLowerCase() || "";
    const selectedDate = document.getElementById('dateFilter')?.value || "";

    const dataToExport = allBookings.filter(booking => {
        const bDate = new Date(booking.date).toISOString().split('T')[0];
        const isDateMatch = !selectedDate || bDate === selectedDate;
        const isSearchMatch = booking.name.toLowerCase().includes(searchTerm) || booking.phone.includes(searchTerm);
        return isDateMatch && isSearchMatch;
    });

    if (dataToExport.length === 0) {
        alert("لا توجد بيانات لتصديرها");
        return;
    }

    const excelRows = dataToExport.map(b => ({
        "رقم الحجز": b._id.slice(-6).toUpperCase(),
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
 * حذف حجز مع رسالة تأكيد (مع JWT Token)
 */
async function confirmDelete(id) {
    if (!confirm("تحذير: هل أنت متأكد من حذف هذا الحجز نهائياً من النظام؟")) return;

    try {
        const token = localStorage.getItem('adminToken');
        const headers = {};
        
        if (token) {
            headers['Authorization'] = `Bearer ${token}`;
        }
        
        const response = await fetch(CONSTANTS.API.ITEM(id), { 
            method: 'DELETE',
            headers: headers
        });
        
        if (response.status === 401) {
            localStorage.removeItem('adminToken');
            localStorage.removeItem('adminUser');
            window.location.href = 'admin-login.html';
            return;
        }
        
        if (response.ok) {
            allBookings = allBookings.filter(b => b._id !== id);
            applySmartFilters();
            showNotification("تم حذف الحجز بنجاح");
        }
    } catch (err) {
        console.error("Delete Error:", err);
        showNotification("حدث خطأ أثناء الحذف");
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
        
        const response = await fetch(CONSTANTS.API.BOOKINGS, {
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
    const dInput = document.getElementById('dateFilter');
    const sInput = document.getElementById('searchInput');
    if (dInput) dInput.value = '';
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
        link.style.display = userRole === 'admin' ? 'inline-flex' : 'none';
    }
}

/**
 * إظهار إشعارات النظام الجذابة
 */
function showNotification(msg) {
    const existing = document.querySelector('.new-booking-toast');
    if (existing) existing.remove();

    const toast = document.createElement('div');
    toast.className = 'new-booking-toast';
    toast.innerHTML = `<i class="fas fa-info-circle"></i> ${msg}`;
    document.body.appendChild(toast);
    
    // إزالة الإشعار بعد 4 ثوانٍ
    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateY(20px)';
        setTimeout(() => toast.remove(), 500);
    }, 4000);
}