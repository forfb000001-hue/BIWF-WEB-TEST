# সদস্যভিত্তিক লগইন ও চ্যাট চালু করার ধাপ

আগের Firebase প্রজেক্ট (BIWF) ও Firestore ডাটাবেসই ব্যবহার হবে। শুধু নিচের ধাপগুলো করতে হবে।

## ১. Email/Password লগইন চালু করুন
**Security → Authentication → Sign-in method → Email/Password → Enable → Save**
(এখন আর Anonymous লাগে না, চাইলে সেটা Disable করে দিতে পারেন।)

## ২. প্রথম অ্যাডমিন বানান (একবারই, হাতে)
**ক) Authentication অ্যাকাউন্ট:** Authentication → **Users** ট্যাব → **Add user**
- Email: `আপনারমোবাইল@biwf.app` (যেমন `01712345678@biwf.app`)
- Password: আপনার পছন্দের পাসওয়ার্ড (কমপক্ষে ৬ অক্ষর)
- তৈরি হলে তালিকায় ইউজারের **User UID** দেখাবে, সেটা কপি করুন।

**খ) প্রোফাইল ডকুমেন্ট:** Firestore Database → **Data** ট্যাব → **Start collection**
- Collection ID: `users`
- Document ID: ওপরে কপি করা **User UID** (Auto-ID নয়, UID-টাই বসাতে হবে)
- ফিল্ডগুলো:

| Field | Type | Value |
|---|---|---|
| name | string | আপনার নাম |
| phone | string | `01712345678` (আপনার নম্বর, ইংরেজি অঙ্কে) |
| role | string | `admin` |
| active | boolean | `true` |

## ৩. Firestore Rules বদলান
Firestore Database → **Rules** → সব মুছে নিচেরটা বসিয়ে **Publish**:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    function profile() {
      return get(/databases/$(database)/documents/users/$(request.auth.uid)).data;
    }
    function signedIn() {
      return request.auth != null
          && exists(/databases/$(database)/documents/users/$(request.auth.uid))
          && profile().active == true;
    }
    function isAdmin() {
      return signedIn() && profile().role == 'admin';
    }
    // অ্যাডমিন সবসময় পারে; ভিউয়ার শুধু তখনই চ্যাট দেখতে পারবে যখন অ্যাডমিন চ্যাট ট্যাব চালু করেছে
    function canChat() {
      return isAdmin() || (signedIn() && ('chatSection' in profile().get('allowedTabs', ['chatSection'])));
    }

    // ইউজার প্রোফাইল: নিজেরটা বা চালু ইউজাররা পড়তে পারবে, শুধু অ্যাডমিন লিখতে পারবে
    match /users/{uid} {
      allow read: if request.auth != null && (request.auth.uid == uid || signedIn());
      allow write: if isAdmin();
    }

    // গ্রুপ চ্যাট
    match /chatMessages/{id} {
      allow read: if canChat();
      allow create: if canChat()
                    && request.resource.data.uid == request.auth.uid
                    && request.resource.data.name == profile().name
                    && request.resource.data.role == profile().role
                    && request.resource.data.text is string
                    && request.resource.data.text.size() > 0
                    && request.resource.data.text.size() <= 1000;
      allow delete: if signedIn()
                    && (resource.data.uid == request.auth.uid || isAdmin());
      allow update: if false;
    }
  }
}
```

## ৪. ফাইল বদলান ও হোস্ট করুন
এই ফোল্ডারের সব ফাইল একসাথে আপলোড করুন (আগেরগুলো বদলে যাবে):
`index.html, script.js, style.css, chat.css, chat.js, auth.js, users.js, mydonations.js, firebase-config.js, logo.png`

হোস্ট করলে সাইটের ডোমেইন **Authentication → Settings → Authorized domains**-এ যোগ করুন।

## ৫. সদস্যদের লগইন খুলুন
অ্যাডমিন হিসেবে ঢুকে **👥 ইউজার** ট্যাবে যান → সদস্য বাছুন (বা নাম ও মোবাইল লিখুন) → প্রথম পাসওয়ার্ড দিন → **অ্যাকাউন্ট তৈরি করুন**।
সদস্যকে মোবাইল নম্বর ও পাসওয়ার্ড জানিয়ে দিন। সে ঢুকে **🔑 পাসওয়ার্ড বদলান** বাটনে নিজের পাসওয়ার্ড বদলাতে পারবে।

## পাসওয়ার্ড ভুলে গেলে
Firebase-এ মোবাইল নম্বরের জন্য আসল ইমেইল নেই, তাই রিসেট ইমেইল যায় না। নিয়ম:
1. Firebase Console → Authentication → Users → ওই সদস্যের সারির ⋮ → **Delete account**।
2. অ্যাপে অ্যাডমিন হিসেবে **👥 ইউজার** ট্যাবে একই নম্বর দিয়ে আবার অ্যাকাউন্ট তৈরি করুন (পুরনো প্রোফাইল সরানোর জন্য নিশ্চিত করতে বলবে)।

## ভিউয়ার কী কী দেখবে (অ্যাডমিন ঠিক করে দেবে)
- **👥 ইউজার** ট্যাবে নতুন ভিউয়ার বানানোর সময়ই ট্যাবের চেকবক্সগুলো টিক দিন।
- আগে বানানো ভিউয়ারের জন্য তালিকার **👁️ কী দেখবে** বাটনে চাপুন → টিক বদলে **সংরক্ষণ করুন**।
- যে ভিউয়ারের জন্য কিছু বাছা হয়নি, সে আপাতত Backup ছাড়া বাকি সব ট্যাব দেখবে।
- **🧾 আমার অনুদান** ট্যাব চালু থাকলে সদস্য শুধু নিজের অনুদান দেখে। লগইনের মোবাইল নম্বর সদস্য তালিকার মোবাইল নম্বরের সাথে মিললেই কাজ করে, তাই দুই জায়গায় নম্বর একই রাখুন। যাকে শুধু নিজেরটা দেখাতে চান তার জন্য **💰 অনুদান (সবার)** বন্ধ রেখে এটি টিক দিন।
- সদস্য লগইন অবস্থায় থাকলেও পরিবর্তন সাথে সাথে তার স্ক্রিনে প্রযোজ্য হয়।
- **চ্যাট ট্যাব** বন্ধ করলে Firebase Rules দিয়েই চ্যাট পড়া/লেখা আটকে যায় (সত্যিকারের সুরক্ষা)। বাকি ট্যাবের ডাটা ব্রাউজার/Google Sheet-এ থাকায় সেগুলো এখনো শুধু স্ক্রিনে লুকানো হয়।
- **নতুন Rules অবশ্যই Publish করুন** (ধাপ ৩-এর কোড বদলেছে), নইলে চ্যাটের অনুমতি কাজ করবে না।

## জেনে রাখুন
- **অ্যাডমিন লক হয়ে যাওয়া এড়াতে** কমপক্ষে দুজন অ্যাডমিন রাখুন।
- চ্যাট ও ইউজার প্রোফাইল এখন Firebase Rules দিয়ে সত্যিই সুরক্ষিত।
- অনুদান, খরচ ও সদস্যের ডাটা আগের মতোই ব্রাউজারে ও Google Sheet-এ আছে। তাই "ভিউয়ার এডিট করতে পারবে না" নিয়মটা এখনো কেবল অ্যাপের স্ক্রিনে প্রযোজ্য, Google Sheet-এর URL ধরে কারিগরি জানা কেউ ডাটা বদলাতে পারে। এটা পরে ডাটা Firestore-এ নিলে পুরোপুরি ঠিক হবে।
- আগের এক-পাসওয়ার্ডের লগইন (`balakhur` / `balakhur-view`) আর নেই।
