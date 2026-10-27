# আমার হিসাব (Amar Hisab) — Offline Android APK (Capacitor + GitHub Actions)

একটি সম্পূর্ণ অফলাইন, প্রিমিয়াম ও মিনিমালিস্ট ব্যক্তিগত আয়-ব্যয়, দেনা-পাওনা (খাতা), বাজেট, শিডিউল টাস্ক রিমাইন্ডার, সঞ্চয় লক্ষ্যমাত্রা, মাসিক বিল, কন্টাক্ট বুক ও ক্যালকুলেটর ভল্ট অ্যাপ।

## কীভাবে GitHub থেকে অটোমেটিক `.apk` ফাইল তৈরি করবেন:

1. এই জিপ (`.zip`) ফাইলটি আনজিপ (Unzip) করুন।
2. **(ঐচ্ছিক — নিজস্ব আইকন দিতে চাইলে):** আপনার `1024x1024 px` সাইজের `icon.png` ফাইলটি `public/icon.png` ফাইলের জায়গায় রিপ্লেস (Overwrite) করে দিন। GitHub Actions অটোমেটিকভাবে সেটি দিয়ে অ্যাপ আইকন ও সাদা স্প্ল্যাশ স্ক্রিন তৈরি করে নেবে।
3. GitHub-এ একটি নতুন Repository খুলে আনজিপ করা সব ফাইল ও ফোল্ডার (বিশেষ করে `.github/workflows/build-apk.yml` সহ) আপলোড বা Push করুন।
   > **টিপস:** ব্রাউজার থেকে ড্র্যাগ-অ্যান্ড-ড্রপ করে ফাইল আপলোড করলে `.github` হিডেন ফোল্ডারটিও যেন আপলোড হয় তা নিশ্চিত করুন, অথবা GitHub-এ **Add file -> Create new file** গিয়ে নাম দিন `.github/workflows/build-apk.yml` এবং ফাইলটির কোড পেস্ট করে Commit করুন।
4. Repository-এর **Actions** ট্যাবে যান — দেখবেন **Build Offline Android APK (Amar Hisab)** অটোমেটিক চলছে। ২-৩ মিনিট পর বিল্ড শেষ হলে নিচে **Artifacts** সেকশন বা **Releases** থেকে সাইন্ড `amar-hisab.apk` ডাউনলোড করে ফোনে ইনস্টল করুন!

## অফলাইন পারমিশনসমূহ (অটোমেটিক যুক্ত করা আছে):
- `POST_NOTIFICATIONS`, `SCHEDULE_EXACT_ALARM`, `USE_EXACT_ALARM`, `RECEIVE_BOOT_COMPLETED` — ইন্টারনেট ছাড়াই নির্দিষ্ট সময়ে রিমাইন্ডার ও অ্যালার্ম নোটিফিকেশন পাঠানোর জন্য।
- `READ_MEDIA_IMAGES`, `READ_MEDIA_VIDEO` — কন্টাক্টের ছবি এবং ক্যালকুলেটর Secret Vault-এ ছবি/ভিডিও/ডকুমেন্ট সংরক্ষণের জন্য।
- `@capacitor/filesystem` ও `@capacitor/share` — অফলাইনে A4 PDF রিপোর্ট এবং JSON ব্যাকআপ সংরক্ষণ ও শেয়ারের জন্য।
