document.addEventListener('DOMContentLoaded', () => {
    // إذا كان الموظف مسجل دخوله بالفعل، انقله للوحة التحكم مباشرة
    if (localStorage.getItem('isAdminLoggedIn') === 'true') {
        window.location.href = 'Admin-dashboard.html';
    }
    i18n.init(); // تشغيل الترجمة
});

document.getElementById('adminLoginForm').addEventListener('submit', function(e) {
    e.preventDefault();
    
    const user = document.getElementById('adminUser').value;
    const pass = document.getElementById('adminPass').value;
    const errorMsg = document.getElementById('loginErrorMessage');

    // تسجيل دخول تجريبي (يمكنك تغييره لاحقاً ليكون عبر السيرفر)
    if (user === "admin" && pass === "123456") {
        localStorage.setItem('isAdminLoggedIn', 'true');
        window.location.href = 'Admin-dashboard.html';
    } else {
        errorMsg.style.display = 'block';
        setTimeout(() => { errorMsg.style.display = 'none'; }, 3000);
    }
});