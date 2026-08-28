"use client";

import { createContext, useContext, useEffect, useState } from "react";

const translations = {
  en: {
    subheadline: "No calling ahead, no walk in gamble, just held, for you.",
    searchPlaceholder: "Search restaurant or cuisine",
    loadingRestaurants: "Loading restaurants…",
    noRestaurants: "No restaurants yet — check back soon.",
    trialPartner: "Trial partner",
    back: "Back",
    menuHighlights: "Menu highlights",
    availableTonight: "Available tonight",
    noMenuItems: "No menu items added yet.",
    reserveTable: "Continue",
    reserveAt: "Reserve at",
    partySize: "Party size",
    date: "Date",
    timeTonight: "Time",
    celebrating: "Celebrating anything?",
    occasionNone: "None",
    occasionBirthday: "Birthday",
    occasionAnniversary: "Anniversary",
    occasionBusiness: "Business",
    yourName: "Your name",
    fullName: "Full name",
    mobileNumber: "Mobile number",
    continueSeating: "Hold my table",
    whereSit: "Where would you like to sit?",
    continueSecure: "Continue to secure table",
    secureTable: "Secure your table",
    holdsTable: "holds this table for you. A card is required — you're only charged if you don't show up.",
    noShowFeeLabel: "No-show fee: AED {fee} per guest.",
    freeCancelLabel: "Free to cancel up to {hours} hours before your booking.",
    cardNumber: "Card number",
    confirmHold: "Confirm & hold table",
    cardDisclaimer: "Card is captured as text here for the prototype. Swap this input for Stripe Elements before going live — never send raw card numbers to your own database.",
    tableRequested: "Table requested",
    hasBeenNotified: "has been notified and will confirm shortly.",
    seating: "Seating",
    time: "Time",
    occasion: "Occasion",
    shareFriends: "Share with friends",
    done: "Done",
    myBookings: "My Bookings",
    myBookingsEmpty: "Nothing here yet, book a table, or open a link a friend shared with you.",
    awaitingConfirmation: "Awaiting confirmation",
    cancelled: "Cancelled",
    share: "Share",
    cancelReservation: "Cancel reservation",
    cancelRequest: "Cancel request",
    confirmCancelReservation: "Cancel this reservation? The restaurant will be notified right away.",
    confirmCancelRequest: "Cancel this request? The restaurant will be notified right away.",
    remove: "Remove",
    discover: "Discover",
    indoor: "Indoor",
    outdoor: "Outdoor",
    shishaTerrace: "Shisha Terrace",
    shishaDesc: "Open-air, may carry a minimum spend",
    outdoorDesc: "Al fresco seating",
    indoorDesc: "Climate-controlled dining room",
    fullyBooked: "Fully booked at this time",
    zoneJustFilled: "{zone} just filled up for this time. Please choose another zone or time.",
    currentBookings: "Current",
    pastBookings: "Past",
    pastBookingsEmpty: "No past reservations yet.",
    declined: "Declined",
    noShowStatus: "No-show",
    dined: "Dined",
    tablesLeft: "{count} left",
    slotFull: "Full",
    partySizeHint: "Enter your exact group size — we'll seat you at the right table.",
    partySizeMaxNote: "For groups larger than {max}, please contact the restaurant directly.",
    confirmedStatus: "Confirmed",
    heldStatus: "Held",
  },
  ar: {
    subheadline: "بدون اتصال مسبق، بدون مقامرة الحضور المباشر، فقط محجوزة لك.",
    searchPlaceholder: "ابحث عن مطعم أو نوع مأكولات",
    loadingRestaurants: "جاري تحميل المطاعم…",
    noRestaurants: "لا توجد مطاعم بعد — تحقق قريبًا.",
    trialPartner: "شريك تجريبي",
    back: "رجوع",
    menuHighlights: "أبرز أطباق القائمة",
    availableTonight: "المتاح الليلة",
    noMenuItems: "لم تتم إضافة أطباق بعد.",
    reserveTable: "متابعة",
    reserveAt: "احجز في",
    partySize: "عدد الضيوف",
    date: "التاريخ",
    timeTonight: "الوقت",
    celebrating: "هل تحتفلون بمناسبة؟",
    occasionNone: "لا شيء",
    occasionBirthday: "عيد ميلاد",
    occasionAnniversary: "ذكرى سنوية",
    occasionBusiness: "عمل",
    yourName: "اسمك",
    fullName: "الاسم الكامل",
    mobileNumber: "رقم الجوال",
    continueSeating: "احجز طاولتي",
    whereSit: "أين تودون الجلوس؟",
    continueSecure: "متابعة لتأكيد الطاولة",
    secureTable: "أكد طاولتك",
    holdsTable: "يحجز لك هذه الطاولة. مطلوب بطاقة — لن يتم خصم أي مبلغ إلا في حال عدم الحضور.",
    noShowFeeLabel: "رسوم عدم الحضور: {fee} درهم لكل ضيف.",
    freeCancelLabel: "يمكن الإلغاء مجانًا حتى {hours} ساعة قبل موعد الحجز.",
    cardNumber: "رقم البطاقة",
    confirmHold: "تأكيد وحجز الطاولة",
    cardDisclaimer: "بيانات البطاقة هنا لأغراض العرض التجريبي فقط. يجب استبدالها بـ Stripe قبل الإطلاق الفعلي — لا تُرسل أرقام البطاقات الحقيقية إلى قاعدة بياناتك الخاصة أبدًا.",
    tableRequested: "تم طلب الطاولة",
    hasBeenNotified: "تم إشعاره وسيقوم بالتأكيد قريبًا.",
    seating: "الجلسة",
    time: "الوقت",
    occasion: "المناسبة",
    shareFriends: "شارك مع الأصدقاء",
    done: "تم",
    myBookings: "حجوزاتي",
    myBookingsEmpty: "لا يوجد شيء هنا بعد، احجز طاولة، أو افتح رابطًا شاركه معك صديق.",
    awaitingConfirmation: "بانتظار التأكيد",
    cancelled: "ملغى",
    share: "مشاركة",
    cancelReservation: "إلغاء الحجز",
    cancelRequest: "إلغاء الطلب",
    confirmCancelReservation: "هل تريد إلغاء هذا الحجز؟ سيتم إشعار المطعم فورًا.",
    confirmCancelRequest: "هل تريد إلغاء هذا الطلب؟ سيتم إشعار المطعم فورًا.",
    remove: "إزالة",
    discover: "استكشف",
    indoor: "داخلي",
    outdoor: "خارجي",
    shishaTerrace: "تراس الشيشة",
    shishaDesc: "جلسة مفتوحة، قد يُشترط حد أدنى للإنفاق",
    outdoorDesc: "جلسة خارجية",
    indoorDesc: "قاعة مكيفة",
    fullyBooked: "محجوز بالكامل في هذا الوقت",
    zoneJustFilled: "{zone} امتلأ للتو في هذا الوقت. الرجاء اختيار جلسة أو وقت آخر.",
    currentBookings: "الحالية",
    pastBookings: "السابقة",
    pastBookingsEmpty: "لا توجد حجوزات سابقة بعد.",
    declined: "مرفوض",
    noShowStatus: "عدم حضور",
    dined: "تم الحضور",
    tablesLeft: "{count} متبقٍ",
    slotFull: "ممتلئ",
    partySizeHint: "أدخل عدد أفراد مجموعتك بالضبط — سنجهز لكم الطاولة المناسبة.",
    partySizeMaxNote: "للمجموعات الأكبر من {max}، يُرجى التواصل مع المطعم مباشرة.",
    confirmedStatus: "مؤكد",
    heldStatus: "محجوز",
  },
};

const LanguageContext = createContext(null);

export function LanguageProvider({ children }) {
  const [lang, setLang] = useState("en");

  useEffect(() => {
    const saved = window.localStorage.getItem("masa_lang");
    if (saved === "ar" || saved === "en") {
      setLang(saved);
    }
  }, []);

  useEffect(() => {
    document.documentElement.dir = lang === "ar" ? "rtl" : "ltr";
    document.documentElement.lang = lang;
    window.localStorage.setItem("masa_lang", lang);
  }, [lang]);

  function t(key, vars) {
    let str = translations[lang]?.[key] || translations.en[key] || key;
    if (vars) {
      Object.entries(vars).forEach(([k, v]) => {
        str = str.replace(`{${k}}`, v);
      });
    }
    return str;
  }

  return (
    <LanguageContext.Provider value={{ lang, setLang, t }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error("useLanguage must be used within LanguageProvider");
  return ctx;
}
