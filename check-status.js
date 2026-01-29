/**
 * CORINTHIA HOTEL - CHECK STATUS ENGINE
 * نظام الاستعلام عن الحجوزات وربطها بقاعدة البيانات
 */

document.addEventListener('DOMContentLoaded', () => {
  const statusInput = document.getElementById('statusBookingId');
  const checkBtn = document.getElementById('checkStatusBtn');
  const resultContainer = document.getElementById('statusResult');

  // 1. الفحص التلقائي عند وجود ID في الرابط (قادم من صفحة النجاح)
  const urlParams = new URLSearchParams(window.location.search);
  const bookingIdFromUrl = urlParams.get('id');

  if (bookingIdFromUrl) {
      statusInput.value = bookingIdFromUrl;
      fetchBookingStatus(bookingIdFromUrl);
  }

  // 2. تفعيل البحث عند الضغط على الزر
  if (checkBtn) {
      checkBtn.addEventListener('click', () => {
          const id = statusInput.value.trim();
          if (id) {
              fetchBookingStatus(id);
          } else {
              const msg = (typeof i18n !== 'undefined' && i18n.currentLang === 'en') 
                          ? "Please enter a Booking ID" : "يرجى إدخال رقم الحجز";
              alert(msg);
          }
      });
  }

  // 3. دالة جلب البيانات من الـ Back-end
  async function fetchBookingStatus(id) {
      try {
          // إظهار حالة تحميل بسيطة (اختياري)
          if (checkBtn) checkBtn.disabled = true;

          // توحيد مصدر الـ API مع constants.js
          const response = await fetch(CONSTANTS.API.ITEM(id));
          const result = await response.json();

          if (response.ok && result.data) {
              displayResult(result.data);
          } else {
              const errorMsg = (typeof i18n !== 'undefined' && i18n.currentLang === 'en') 
                              ? "Booking not found" : "لم يتم العثور على الحجز، يرجى التأكد من الرقم.";
              alert(errorMsg);
              if (resultContainer) resultContainer.style.display = 'none';
          }
      } catch (error) {
          console.error("Fetch Error:", error);
          const serverError = (typeof i18n !== 'undefined' && i18n.currentLang === 'en') 
                              ? "Server error, try again later" : "خطأ في الاتصال بالسيرفر";
          alert(serverError);
      } finally {
          if (checkBtn) checkBtn.disabled = false;
      }
  }

  // 4. دالة عرض النتائج وتنسيق الألوان
  function displayResult(data) {
      if (!resultContainer) return;

      resultContainer.style.display = 'block';
      resultContainer.classList.add('animate-fade-in'); // إضافة تأثير ظهور

      // تعبئة البيانات
      document.getElementById('guestName').innerText = data.name;
      document.getElementById('resDate').innerText = new Date(data.date).toLocaleDateString(
          (typeof i18n !== 'undefined' && i18n.currentLang === 'en') ? 'en-GB' : 'ar-EG'
      );
      
      const statusEl = document.getElementById('bookingStatus');
      const statusValue = data.status || "Pending";
      
      // ترجمة الحالة بصرياً
      if (typeof i18n !== 'undefined' && i18n.currentLang === 'ar') {
          statusEl.innerText = statusValue === 'Confirmed' ? "تم التأكيد" : "قيد الانتظار";
      } else {
          statusEl.innerText = statusValue;
      }
      
      // تغيير لون الحالة (أخضر للمؤكد، برتقالي للمنتظر)
      statusEl.style.color = "white";
      statusEl.style.backgroundColor = statusValue === 'Confirmed' ? '#27ae60' : '#e67e22';
      statusEl.style.padding = "2px 10px";
      statusEl.style.borderRadius = "15px";
  }

  // تهيئة الترجمة للصفحة
  if (typeof i18n !== 'undefined') i18n.init();
});