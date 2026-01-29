# دليل إعداد نظام تسجيل دخول الأدمن - فندق كورنثيا

## 📋 نظرة عامة

تم تطوير نظام تسجيل دخول آمن واحترافي للأدمن باستخدام **JWT (JSON Web Tokens)** مع تشفير كلمات المرور باستخدام **bcrypt**.

---

## 🚀 خطوات الإعداد

### 1. تثبيت المتطلبات

```bash
cd "Booking for Ramdan/backend"
npm install
```

### 2. إعداد ملف البيئة (.env)

1. انسخ ملف `.env.example` إلى `.env`:
```bash
cp .env.example .env
```

2. افتح ملف `.env` وعدّل القيم التالية:

```env
MONGODB_URI=mongodb://localhost:27017/corinthiaDB
JWT_SECRET=your-super-secret-jwt-key-change-this-in-production
DEFAULT_ADMIN_USERNAME=admin
DEFAULT_ADMIN_PASSWORD=admin123
DEFAULT_ADMIN_NAME=Administrator
```

**⚠️ مهم جداً:**
- غيّر `JWT_SECRET` إلى مفتاح عشوائي قوي في الإنتاج
- يمكنك توليد مفتاح عشوائي باستخدام:
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### 3. إنشاء حساب المدير الأول

قم بتشغيل سكريبت الإعداد لإنشاء حساب المدير الافتراضي:

```bash
npm run setup
```

أو:

```bash
node setup.js
```

سيتم إنشاء حساب مدير بالبيانات التالية:
- **اسم المستخدم:** `admin` (أو القيمة في `DEFAULT_ADMIN_USERNAME`)
- **كلمة المرور:** `admin123` (أو القيمة في `DEFAULT_ADMIN_PASSWORD`)
- **الدور:** `superadmin`

**⚠️ تحذير:** بعد تسجيل الدخول الأول، يُنصح بتغيير كلمة المرور الافتراضية!

### 4. تشغيل السيرفر

```bash
npm start
```

أو للتطوير مع إعادة التشغيل التلقائي:

```bash
npm run dev
```

السيرفر سيعمل على: `http://localhost:5000`

---

## 🔐 كيفية إنشاء حساب مدير جديد يدوياً

إذا أردت إنشاء حساب مدير إضافي، يمكنك استخدام MongoDB Shell أو MongoDB Compass:

### الطريقة 1: استخدام Node.js Script

أنشئ ملف `create-admin.js`:

```javascript
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const Admin = require('./models/Admin');
require('dotenv').config();

async function createAdmin() {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/corinthiaDB', {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });

    const username = 'newadmin'; // غيّر هذا
    const password = 'securepassword123'; // غيّر هذا
    const name = 'New Administrator'; // غيّر هذا

    // التحقق من وجود المستخدم
    const existing = await Admin.findOne({ username });
    if (existing) {
      console.log('❌ المستخدم موجود بالفعل!');
      process.exit(1);
    }

    // إنشاء الحساب (سيتم تشفير كلمة المرور تلقائياً بواسطة Schema)
    const admin = new Admin({
      username,
      password, // سيتم تشفيره تلقائياً
      name,
      role: 'admin', // أو 'superadmin'
      isActive: true
    });

    await admin.save();
    console.log('✅ تم إنشاء حساب المدير بنجاح!');
    console.log(`👤 اسم المستخدم: ${username}`);
    console.log(`🔑 كلمة المرور: ${password}`);
    
    await mongoose.connection.close();
  } catch (error) {
    console.error('❌ خطأ:', error.message);
    process.exit(1);
  }
}

createAdmin();
```

ثم شغّله:

```bash
node create-admin.js
```

### الطريقة 2: استخدام MongoDB Compass أو Shell

1. افتح MongoDB Compass واتصل بقاعدة البيانات `corinthiaDB`
2. اذهب إلى Collection `admins`
3. أضف مستند جديد:

```json
{
  "username": "newadmin",
  "password": "$2a$10$...", // كلمة مرور مشفرة بـ bcrypt
  "name": "New Administrator",
  "role": "admin",
  "isActive": true,
  "createdAt": "2026-01-15T00:00:00.000Z",
  "updatedAt": "2026-01-15T00:00:00.000Z"
}
```

**ملاحظة:** يجب تشفير كلمة المرور باستخدام bcrypt. يمكنك استخدام هذا السكريبت:

```javascript
const bcrypt = require('bcryptjs');
bcrypt.hash('yourpassword', 10).then(hash => console.log(hash));
```

---

## 🎨 الميزات المطورة

### ✅ الواجهة (UI)
- تصميم احترافي متناسق مع هوية فندق كورنثيا
- حالة تحميل (Loading State) عند تسجيل الدخول
- رسائل خطأ واضحة ومصممة بشكل جذاب
- تأثيرات بصرية سلسة (Animations)

### ✅ الأمان (Security)
- **JWT Tokens:** مصادقة آمنة باستخدام JSON Web Tokens
- **Password Hashing:** تشفير كلمات المرور باستخدام bcrypt
- **Token Verification:** التحقق من صحة التوكن في كل طلب
- **Auto Logout:** تسجيل خروج تلقائي عند انتهاء صلاحية التوكن

### ✅ الوظائف (Features)
- تسجيل دخول آمن مع JWT
- التحقق التلقائي من صحة الجلسة
- عرض معلومات المستخدم في لوحة التحكم
- تسجيل خروج آمن مع تنظيف البيانات

---

## 📝 API Endpoints

### POST `/api/auth/login`
تسجيل الدخول

**Request:**
```json
{
  "username": "admin",
  "password": "admin123"
}
```

**Response (Success):**
```json
{
  "message": "Login successful",
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "admin": {
    "id": "...",
    "username": "admin",
    "role": "superadmin",
    "name": "Administrator"
  }
}
```

### GET `/api/auth/me`
الحصول على معلومات المستخدم الحالي (يتطلب Token)

**Headers:**
```
Authorization: Bearer <token>
```

**Response:**
```json
{
  "admin": {
    "id": "...",
    "username": "admin",
    "role": "superadmin",
    "name": "Administrator"
  }
}
```

### POST `/api/auth/logout`
تسجيل الخروج (يتطلب Token)

**Headers:**
```
Authorization: Bearer <token>
```

---

## 🔧 استكشاف الأخطاء

### المشكلة: "Cannot connect to MongoDB"
**الحل:** تأكد من تشغيل MongoDB:
```bash
# Windows
net start MongoDB

# Linux/Mac
sudo systemctl start mongod
```

### المشكلة: "Invalid credentials"
**الحل:** تأكد من:
1. اسم المستخدم وكلمة المرور صحيحة
2. تم إنشاء الحساب باستخدام `npm run setup`
3. الحساب نشط (`isActive: true`)

### المشكلة: "Token expired" أو "Authentication failed"
**الحل:** سجّل الخروج وأعد تسجيل الدخول

---

## 📞 الدعم

للمساعدة أو الاستفسارات، يرجى التواصل مع فريق التطوير.

---

**تم التطوير بواسطة:** فريق كورنثيا للتطوير  
**التاريخ:** يناير 2026
