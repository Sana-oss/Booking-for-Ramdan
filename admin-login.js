/**
 * CORINTHIA HOTEL - ADMIN LOGIN SYSTEM (JWT AUTHENTICATION)
 * نظام تسجيل دخول آمن باستخدام JWT Token
 */

document.addEventListener('DOMContentLoaded', () => {
    // التحقق من وجود Token صالح - إذا كان موجوداً، توجيه للوحة التحكم
    const token = localStorage.getItem('adminToken');
    if (token) {
        // التحقق من صحة التوكن قبل التوجيه
        verifyTokenAndRedirect(token);
    }
    
    // تهيئة نظام الترجمة
    if (typeof i18n !== 'undefined') {
        i18n.init();
    }
    
    // ربط نموذج تسجيل الدخول
    const loginForm = document.getElementById('adminLoginForm');
    if (loginForm) {
        loginForm.addEventListener('submit', handleLogin);
    }
});

/**
 * التحقق من صحة التوكن وإعادة التوجيه
 */
async function verifyTokenAndRedirect(token) {
    try {
        const response = await fetch(CONSTANTS.API.AUTH.ME, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });
        
        if (response.ok) {
            // التوكن صالح - توجيه للوحة التحكم
            window.location.href = 'admin-dashboard.html';
        } else {
            // التوكن غير صالح - حذفه
            localStorage.removeItem('adminToken');
            localStorage.removeItem('adminUser');
        }
    } catch (error) {
        console.error('Token verification error:', error);
        localStorage.removeItem('adminToken');
        localStorage.removeItem('adminUser');
    }
}

/**
 * معالجة عملية تسجيل الدخول
 */
async function handleLogin(e) {
    e.preventDefault();
    
    const username = document.getElementById('adminUser').value.trim();
    const password = document.getElementById('adminPass').value;
    const errorMsg = document.getElementById('loginErrorMessage');
    const submitBtn = document.getElementById('loginSubmitBtn');
    
    // إخفاء رسالة الخطأ السابقة
    hideError();
    
    // التحقق من إدخال البيانات
    if (!username || !password) {
        showError('يرجى إدخال اسم المستخدم وكلمة المرور');
        return;
    }
    
    // تفعيل حالة التحميل
    setLoadingState(submitBtn, true);
    
    try {
        // إرسال طلب تسجيل الدخول للـ Backend
        const response = await fetch(CONSTANTS.API.AUTH.LOGIN, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                username: username,
                password: password
            })
        });
        
        const result = await response.json();
        
        if (response.ok && result.token) {
            // نجاح تسجيل الدخول
            // حفظ التوكن وبيانات المستخدم في localStorage
            localStorage.setItem('adminToken', result.token);
            localStorage.setItem('adminUser', JSON.stringify(result.admin));
            
            // إظهار رسالة نجاح مؤقتة
            showSuccess('تم تسجيل الدخول بنجاح');
            
            // الانتقال للوحة التحكم بعد تأخير بسيط
            setTimeout(() => {
                window.location.href = 'admin-dashboard.html';
            }, 500);
        } else {
            // فشل تسجيل الدخول
            const errorMessage = result.message || 'خطأ في اسم المستخدم أو كلمة المرور';
            showError(errorMessage);
            setLoadingState(submitBtn, false);
        }
    } catch (error) {
        console.error('Login error:', error);
        showError('تعذر الاتصال بالسيرفر. يرجى التأكد من تشغيل السيرفر.');
        setLoadingState(submitBtn, false);
    }
}

/**
 * إظهار رسالة خطأ
 */
function showError(message) {
    const errorMsg = document.getElementById('loginErrorMessage');
    if (errorMsg) {
        errorMsg.textContent = message;
        errorMsg.classList.add('show');
        
        // إخفاء الرسالة تلقائياً بعد 5 ثوانٍ
        setTimeout(() => {
            hideError();
        }, 5000);
    }
}

/**
 * إخفاء رسالة الخطأ
 */
function hideError() {
    const errorMsg = document.getElementById('loginErrorMessage');
    if (errorMsg) {
        errorMsg.classList.remove('show');
    }
}

/**
 * إظهار رسالة نجاح (مؤقتة)
 */
function showSuccess(message) {
    const errorMsg = document.getElementById('loginErrorMessage');
    if (errorMsg) {
        errorMsg.style.background = 'rgba(39, 174, 96, 0.15)';
        errorMsg.style.borderColor = 'var(--success-green)';
        errorMsg.style.color = 'var(--success-green)';
        errorMsg.textContent = message;
        errorMsg.classList.add('show');
    }
}

/**
 * تفعيل/تعطيل حالة التحميل
 */
function setLoadingState(button, isLoading) {
    if (!button) return;
    
    if (isLoading) {
        button.disabled = true;
        button.classList.add('loading');
    } else {
        button.disabled = false;
        button.classList.remove('loading');
    }
}
