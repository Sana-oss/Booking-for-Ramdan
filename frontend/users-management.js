/**
 * CORINTHIA HOTEL - USERS MANAGEMENT SYSTEM
 * User Management for Super Admin
 */

let allUsers = [];
let currentAdmin = null;
let userToDelete = null;

document.addEventListener('DOMContentLoaded', () => {
    checkAdminAuth();
    loadUsers();
    document.getElementById('createUserForm').addEventListener('submit', handleCreateUser);
    
    // Initialize i18n translations
    if (typeof i18n !== 'undefined') {
        i18n.init();
    }
});

/**
 * Get translation helper
 */
function t(key) {
    if (typeof i18n !== 'undefined' && i18n.translations[i18n.currentLang] && i18n.translations[i18n.currentLang][key]) {
        return i18n.translations[i18n.currentLang][key];
    }
    return key;
}

/**
 * Get translated role
 */
function tRole(role) {
    const roleKey = role === 'superadmin' ? 'role_superadmin' : (role === 'admin' ? 'role_admin' : 'role_staff');
    return t(roleKey);
}

/**
 * Get translated status (Active/Inactive)
 */
function tStatus(isActive) {
    return isActive ? t('active_status') : t('inactive_status');
}

/**
 * Format date according to current language
 */
function formatDate(dateStr) {
    const date = new Date(dateStr);
    const lang = (typeof i18n !== 'undefined') ? i18n.currentLang : 'ar';
    return date.toLocaleDateString(lang === 'ar' ? 'ar-EG' : 'en-US');
}

/**
 * Check admin authentication (Super Admin Only)
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
        currentAdmin = result.admin;
        
        // Only superadmin can access this page
        if (result.admin.role !== 'superadmin') {
            alert('Access denied - Super Admin privileges required');
            window.location.href = 'admin-dashboard.html';
        }
    } catch (error) {
        window.location.href = 'admin-login.html';
    }
}

/**
 * Load all users from the server
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
        const lang = (typeof i18n !== 'undefined') ? i18n.currentLang : 'ar';
        document.getElementById('usersTableBody').innerHTML = 
            `<tr><td colspan="6" style="text-align:center; padding:50px; color:#e74c3c;">${t('error_loading')}</td></tr>`;
    }
}

/**
 * Render users table
 */
function renderUsersTable() {
    const tbody = document.getElementById('usersTableBody');
    if (allUsers.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; padding:50px; color:#999;">${t('no_users')}</td></tr>`;
        return;
    }
    
    const isSuperAdmin = currentAdmin && currentAdmin.role === 'superadmin';
    
    tbody.innerHTML = allUsers.map(user => {
        const isSelf = user._id === currentAdmin._id;
        const isSuperAdminUser = user.role === 'superadmin';
        const isLastSuperAdmin = isSuperAdminUser && allUsers.filter(u => u.role === 'superadmin').length <= 1;
        
        // Delete button only visible to superadmin and not on self or protected users
        const showDeleteBtn = isSuperAdmin && !isSelf && !isLastSuperAdmin;
        
        // Toggle disabled for last admin
        const isLastAdmin = user.role === 'admin' && allUsers.filter(u => u.role === 'admin').length <= 1;
        const toggleDisabled = user.role === 'superadmin' || isLastAdmin;
        
        return `
            <tr>
                <td><strong>${user.username}</strong></td>
                <td>${user.name}</td>
                <td>
                    <span style="padding: 5px 12px; border-radius: 15px; font-size: 0.85rem; 
                        background: ${user.role === 'superadmin' ? 'rgba(231, 76, 60, 0.2)' : (user.role === 'admin' ? 'rgba(197, 160, 89, 0.2)' : 'rgba(52, 152, 219, 0.2)')};
                        color: ${user.role === 'superadmin' ? '#e74c3c' : (user.role === 'admin' ? 'var(--gold)' : '#3498db')};">
                        ${tRole(user.role)}
                    </span>
                </td>
                <td>
                    <label class="toggle-switch">
                        <input type="checkbox" ${user.isActive ? 'checked' : ''} 
                            onchange="toggleUserStatus('${user._id}', this.checked)" 
                            ${toggleDisabled ? 'disabled' : ''}>
                        <span class="toggle-slider"></span>
                    </label>
                </td>
                <td>${formatDate(user.createdAt)}</td>
                <td>
                    <div class="action-btn-group">
                        <button onclick="editUser('${user._id}')" class="edit-btn" title="${t('btn_edit')}">
                            <i class="fas fa-pencil-alt"></i>
                        </button>
                        <button onclick="resetUserPassword('${user._id}')" class="reset-btn" title="${t('btn_reset_password')}">
                            <i class="fas fa-key"></i>
                        </button>
                        ${showDeleteBtn ? `
                        <button onclick="showDeleteConfirmModal('${user._id}')" class="delete-btn" 
                            title="${t('btn_delete')}">
                            <i class="fas fa-trash-alt"></i>
                        </button>
                        ` : ''}
                    </div>
                </td>
            </tr>
        `;
    }).join('');
}

/**
 * Toggle user status (active/inactive)
 */
async function toggleUserStatus(userId, isActive) {
    try {
        const token = localStorage.getItem('adminToken');
        const response = await fetch(CONSTANTS.API.USERS.UPDATE_STATUS.replace('{id}', userId), {
            method: 'PUT',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ isActive })
        });
        
        const result = await response.json();
        if (result.success) {
            // Update local data
            const userIndex = allUsers.findIndex(u => u._id === userId);
            if (userIndex !== -1) {
                allUsers[userIndex].isActive = isActive;
            }
            renderUsersTable();
        } else {
            alert(result.message || t('error_loading'));
            renderUsersTable(); // Revert toggle
        }
    } catch (error) {
        console.error('Error toggling user status:', error);
        alert(t('error_loading'));
        renderUsersTable(); // Revert toggle
    }
}

/**
 * Edit user placeholder
 */
function editUser(userId) {
    alert(t('feature_coming_soon'));
}

/**
 * Reset user password placeholder
 */
function resetUserPassword(userId) {
    alert(t('feature_coming_soon'));
}

/**
 * Show delete confirmation modal
 */
function showDeleteConfirmModal(userId) {
    userToDelete = userId;
    document.getElementById('deleteConfirmModal').style.display = 'flex';
}

/**
 * Hide delete confirmation modal
 */
function hideDeleteConfirmModal() {
    userToDelete = null;
    document.getElementById('deleteConfirmModal').style.display = 'none';
}

/**
 * Confirm and execute user deletion
 */
async function confirmDeleteUserAction() {
    if (!userToDelete) return;
    
    try {
        const token = localStorage.getItem('adminToken');
        const deleteUrl = CONSTANTS.API.USERS.DELETE(userToDelete);
        const response = await fetch(deleteUrl, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${token}` }
        });
        
        const result = await response.json();
        if (result.success) {
            // Remove from local list
            allUsers = allUsers.filter(u => u._id !== userToDelete);
            renderUsersTable();
            hideDeleteConfirmModal();
            
            // Show success message
            alert(t('delete_success') || 'User deleted successfully');
        } else {
            alert(result.message || t('error_loading'));
        }
    } catch (error) {
        console.error('Error deleting user:', error);
        alert(t('error_loading'));
    }
}

/**
 * Show create user modal
 */
function showCreateUserModal() {
    document.getElementById('createUserModal').style.display = 'flex';
    document.getElementById('createUserForm').reset();
    document.getElementById('createUserError').style.display = 'none';
}

/**
 * Hide create user modal
 */
function hideCreateUserModal() {
    document.getElementById('createUserModal').style.display = 'none';
}

/**
 * Handle new user creation
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
            errorDiv.textContent = result.message || 'Error creating user';
            errorDiv.style.display = 'block';
        }
    } catch (error) {
        errorDiv.textContent = 'Server connection error';
        errorDiv.style.display = 'block';
    }
}

/**
 * Legacy delete user function (kept for compatibility)
 */
async function confirmDeleteUser(userId) {
    const user = allUsers.find(u => u._id === userId);
    if (!user) return;
    
    if (!confirm(`Are you sure you want to delete user "${user.name}"?`)) return;
    
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
            alert(result.message || 'Error deleting user');
        }
    } catch (error) {
        alert('Server connection error');
    }
}

/**
 * Logout and redirect to login
 */
async function logout() {
    if (!confirm('Do you want to logout?')) return;
    
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
