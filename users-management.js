/**
 * CORINTHIA HOTEL - USERS MANAGEMENT SYSTEM
 * نظام إدارة المستخدمين (Admin Only)
 */

let allUsers = [];

document.addEventListener('DOMContentLoaded', () => {
    checkAdminAuth();
    loadUsers();
    document.getElementById('createUserForm').addEventListener('submit', handleCreateUser);
});

/**
 * التحقق من صلاحية الدخول (Admin Only)
 */
async function checkAdminAuth() {
    const token = localStorage.getItem('adminToken');
    if (!token) {
        window.location.href = 'admin-login.html';
        return;
    }
    
    try {
        const response = await fetch(CONSTANTS.API.AUTH.ME, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        
        if (!response.ok) {
            window.location.href = 'admin-login.html';
            return;
        }
        
        const result = await response.json();
        if (result.admin.role !== 'admin') {
            alert('غير مصرح لك بالوصول إلى هذه الصفحة');
            window.location.href = 'admin-dashboard.html';
        }
    } catch (error) {
        window.location.href = 'admin-login.html';
    }
}

/**
 * جلب جميع المستخدمين
 */
async function loadUsers() {
    try {
        const token = localStorage.getItem('adminToken');
        const response = await fetch(CONSTANTS.API.USERS.LIST, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        
        if (response.status === 401 || response.status === 403) {
            window.location.href = 'admin-login.html';
            return;
        }
        
        const result = await response.json();
        if (result.success) {
            allUsers = result.data;
            renderUsersTable();
        }
    } catch (error) {
        console.error('Error loading users:', error);
        document.getElementById('usersTableBody').innerHTML = 
            '<tr><td colspan="6" style="text-align:center; padding:50px; color:#e74c3c;">خطأ في تحميل البيانات</td></tr>';
    }
}

/**
 * عرض جدول المستخدمين
 */
function renderUsersTable() {
    const tbody = document.getElementById('usersTableBody');
    if (allUsers.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; padding:50px; color:#999;">لا يوجد مستخدمين</td></tr>';
        return;
    }
    
    tbody.innerHTML = allUsers.map(user => `
        <tr>
            <td><strong>${user.username}</strong></td>
            <td>${user.name}</td>
            <td>
                <span style="padding: 5px 12px; border-radius: 15px; font-size: 0.85rem; 
                    background: ${user.role === 'admin' ? 'rgba(197, 160, 89, 0.2)' : 'rgba(52, 152, 219, 0.2)'}; 
                    color: ${user.role === 'admin' ? 'var(--gold)' : '#3498db'};">
                    ${user.role === 'admin' ? 'مدير' : 'موظف'}
                </span>
            </td>
            <td>
                <span style="color: ${user.isActive ? '#27ae60' : '#e74c3c'};">
                    ${user.isActive ? 'نشط' : 'غير نشط'}
                </span>
            </td>
            <td>${new Date(user.createdAt).toLocaleDateString('ar-EG')}</td>
            <td>
                <button onclick="confirmDeleteUser('${user._id}')" class="delete-btn" 
                    ${user.role === 'admin' && allUsers.filter(u => u.role === 'admin').length === 1 ? 'disabled title="لا يمكن حذف آخر مدير"' : ''}>
                    <i class="fas fa-trash-alt"></i>
                </button>
            </td>
        </tr>
    `).join('');
}

/**
 * إظهار نافذة إضافة مستخدم
 */
function showCreateUserModal() {
    document.getElementById('createUserModal').style.display = 'flex';
    document.getElementById('createUserForm').reset();
    document.getElementById('createUserError').style.display = 'none';
}

/**
 * إخفاء نافذة إضافة مستخدم
 */
function hideCreateUserModal() {
    document.getElementById('createUserModal').style.display = 'none';
}

/**
 * معالجة إنشاء مستخدم جديد
 */
async function handleCreateUser(e) {
    e.preventDefault();
    
    const username = document.getElementById('newUsername').value.trim();
    const name = document.getElementById('newName').value.trim();
    const password = document.getElementById('newPassword').value;
    const role = document.getElementById('newRole').value;
    const errorDiv = document.getElementById('createUserError');
    
    errorDiv.style.display = 'none';
    
    try {
        const token = localStorage.getItem('adminToken');
        const response = await fetch(CONSTANTS.API.USERS.CREATE, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ username, name, password, role })
        });
        
        const result = await response.json();
        
        if (response.ok && result.success) {
            hideCreateUserModal();
            loadUsers();
        } else {
            errorDiv.textContent = result.message || 'حدث خطأ أثناء إنشاء المستخدم';
            errorDiv.style.display = 'block';
        }
    } catch (error) {
        errorDiv.textContent = 'خطأ في الاتصال بالسيرفر';
        errorDiv.style.display = 'block';
    }
}

/**
 * حذف مستخدم
 */
async function confirmDeleteUser(userId) {
    const user = allUsers.find(u => u._id === userId);
    if (!user) return;
    
    if (!confirm(`هل أنت متأكد من حذف المستخدم "${user.name}"؟`)) return;
    
    try {
        const token = localStorage.getItem('adminToken');
        const response = await fetch(CONSTANTS.API.USERS.DELETE(userId), {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${token}` }
        });
        
        if (response.ok) {
            loadUsers();
        } else {
            const result = await response.json();
            alert(result.message || 'حدث خطأ أثناء الحذف');
        }
    } catch (error) {
        alert('خطأ في الاتصال بالسيرفر');
    }
}

/**
 * تسجيل الخروج
 */
async function logout() {
    if (!confirm('هل تريد تسجيل الخروج؟')) return;
    
    const token = localStorage.getItem('adminToken');
    if (token) {
        try {
            await fetch(CONSTANTS.API.AUTH.LOGOUT, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}` }
            });
        } catch (e) {}
    }
    
    localStorage.removeItem('adminToken');
    localStorage.removeItem('adminUser');
    window.location.href = 'admin-login.html';
}
