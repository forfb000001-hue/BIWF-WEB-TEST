// ==========================
// সদস্যভিত্তিক লগইন (Firebase Auth: মোবাইল নম্বর + পাসওয়ার্ড)
// মোবাইল নম্বরকে পর্দার আড়ালে 01XXXXXXXXX@biwf.app ইমেইল হিসেবে ব্যবহার করা হয়।
// ==========================
const EMAIL_DOMAIN = "biwf.app";

// বাংলা অঙ্ক -> ইংরেজি, +88/88 বাদ, শুধু সংখ্যা রাখা
function normalizePhone(raw) {
    const map = { "০": "0", "১": "1", "২": "2", "৩": "3", "৪": "4", "৫": "5", "৬": "6", "৭": "7", "৮": "8", "৯": "9" };
    let p = String(raw || "").replace(/[০-৯]/g, d => map[d]).replace(/\D/g, "");
    if (p.startsWith("880")) p = p.slice(2);
    return p;
}
function phoneToEmail(phone) { return normalizePhone(phone) + "@" + EMAIL_DOMAIN; }
function validPhone(p) { return /^01\d{9}$/.test(p); }

window.BWF = { auth: null, db: null, user: null };

// ভিউয়ার যে ট্যাবগুলো দেখতে পারে (অ্যাডমিন এখান থেকেই বাছাই করে দেয়)
window.BWF_TABS = [
    { id: "dashboardSection", label: "🏠 ড্যাশবোর্ড" },
    { id: "donationSection",  label: "💰 অনুদান (সবার)" },
    { id: "myDonationSection", label: "🧾 আমার অনুদান" },
    { id: "expenseSection",   label: "🌾 খরচ" },
    { id: "memberSection",    label: "👤 সদস্য" },
    { id: "reportSection",    label: "📊 রিপোর্ট" },
    { id: "backupSection",    label: "⚙️ Backup" },
    { id: "chatSection",      label: "💬 চ্যাট" }
];
// নতুন ভিউয়ার বা পুরনো ভিউয়ারের (যার জন্য কিছু বাছা হয়নি) ডিফল্ট
window.BWF_DEFAULT_TABS = ["dashboardSection", "donationSection", "myDonationSection", "expenseSection", "memberSection", "reportSection", "chatSection"];
const ADMIN_ONLY_TABS = ["logSection", "usersSection"];

BWF.can = function (id) {
    const u = BWF.user;
    if (!u) return false;
    if (u.role === "admin") return true;
    if (ADMIN_ONLY_TABS.includes(id)) return false;
    return u.tabs.includes(id);
};

(function () {
    const $ = id => document.getElementById(id);
    let ready = false;

    function showLogin(msg) {
        $("appContent").style.display = "none";
        $("loginScreen").style.display = "flex";
        $("loginError").textContent = msg || "";
        const b = $("loginBtn"); if (b) { b.disabled = false; b.textContent = "প্রবেশ করুন"; }
    }

    // অ্যাডমিনের দেওয়া অনুমতি অনুযায়ী ট্যাব দেখানো/লুকানো
    function applyTabAccess() {
        const btns = Array.from(document.querySelectorAll(".nav-btn[data-target]"));
        btns.forEach(b => { b.style.display = BWF.can(b.dataset.target) ? "" : "none"; });
        const noMsg = $("noAccessMsg");
        const act = document.querySelector(".tab-section.active");
        if (!act || !BWF.can(act.id)) {
            document.querySelectorAll(".tab-section").forEach(sec => sec.classList.remove("active"));
            const first = btns.find(b => BWF.can(b.dataset.target));
            if (first) { window.showSection(first.dataset.target, first); if (noMsg) noMsg.style.display = "none"; }
            else if (noMsg) noMsg.style.display = "block";
        } else if (noMsg) noMsg.style.display = "none";
    }

    // ভুল ট্যাবে ঢোকা আটকানো (কোড থেকে ডাকলেও)
    const origShowSection = window.showSection;
    window.showSection = function (id, btn) {
        if (BWF.user && !BWF.can(id)) return;
        origShowSection(id, btn);
    };

    function buildUser(uid, p) {
        const role = p.role === "admin" ? "admin" : "viewer";
        const known = BWF_TABS.map(t => t.id);
        const tabs = Array.isArray(p.allowedTabs) ? p.allowedTabs.filter(t => known.includes(t)) : BWF_DEFAULT_TABS.slice();
        return { uid: uid, name: p.name, phone: p.phone, role: role, tabs: tabs };
    }

    // নিজের প্রোফাইল বদলালে (অনুমতি/রোল/বন্ধ) সাথে সাথে প্রয়োগ
    let profUnsub = null;
    function watchProfile(uid) {
        if (profUnsub) profUnsub();
        let first = true;
        profUnsub = BWF.db.collection("users").doc(uid).onSnapshot(snap => {
            if (first) { first = false; return; }
            const p = snap.exists ? snap.data() : null;
            if (!p || p.active !== true) { BWF.auth.signOut(); return; }
            const next = buildUser(uid, p);
            const roleChanged = next.role !== BWF.user.role;
            BWF.user = next; setSession(next);
            if (roleChanged) { location.reload(); return; }
            applyTabAccess();
        }, () => {});
    }

    function showApp() {
        $("loginScreen").style.display = "none";
        $("appContent").style.display = "block";
        $("loginError").textContent = "";
        if (typeof applyRoleVisibility === "function") applyRoleVisibility();
        applyTabAccess();
        if (BWF.user.role === "admin" && typeof checkBackupReminder === "function") checkBackupReminder();
    }

    function setSession(u) {
        sessionStorage.setItem("loggedIn", "true");
        sessionStorage.setItem("role", u.role);
        sessionStorage.setItem("userName", u.name);
        sessionStorage.setItem("userPhone", u.phone);
    }
    function clearSession() {
        ["loggedIn", "role", "userName", "userPhone"].forEach(k => sessionStorage.removeItem(k));
    }

    function init() {
        if (typeof firebase === "undefined" || !FIREBASE_CONFIG || String(FIREBASE_CONFIG.apiKey).indexOf("PASTE_") === 0) {
            showLogin("Firebase চালু করা যায়নি। ইন্টারনেট ও firebase-config.js চেক করুন।");
            return;
        }
        firebase.initializeApp(FIREBASE_CONFIG);
        BWF.auth = firebase.auth();
        BWF.db = firebase.firestore();

        // ৬ সেকেন্ডে সাড়া না এলে লগইন ফর্ম দেখানো
        const fallback = setTimeout(() => { if (!ready) showLogin(); }, 6000);

        BWF.auth.onAuthStateChanged(async fbUser => {
            clearTimeout(fallback);
            ready = true;
            if (!fbUser) {
                BWF.user = null; clearSession();
                if (profUnsub) { profUnsub(); profUnsub = null; }
                document.dispatchEvent(new Event("bwf-authout"));
                showLogin();
                return;
            }
            try {
                const snap = await BWF.db.collection("users").doc(fbUser.uid).get();
                const p = snap.exists ? snap.data() : null;
                if (!p || p.active !== true) {
                    await BWF.auth.signOut();
                    showLogin(!p ? "এই নম্বরের কোনো প্রোফাইল পাওয়া যায়নি। অ্যাডমিনের সাথে যোগাযোগ করুন।"
                                 : "আপনার অ্যাকাউন্ট বন্ধ আছে। অ্যাডমিনের সাথে যোগাযোগ করুন।");
                    return;
                }
                BWF.user = buildUser(fbUser.uid, p);
                setSession(BWF.user);
                showApp();
                watchProfile(fbUser.uid);
                document.dispatchEvent(new Event("bwf-authready"));
            } catch (e) {
                console.error(e);
                await BWF.auth.signOut().catch(() => {});
                showLogin("প্রোফাইল লোড করা যায়নি। ইন্টারনেট ও Firestore Rules চেক করুন।");
            }
        });
    }

    window.checkLogin = async function () {
        if (!BWF.auth) return;
        const phone = normalizePhone($("loginPhone").value);
        const pw = $("loginPassword").value;
        if (!validPhone(phone)) { $("loginError").textContent = "সঠিক মোবাইল নম্বর দিন (যেমন 01712345678)"; return; }
        if (!pw) { $("loginError").textContent = "পাসওয়ার্ড দিন"; return; }
        const b = $("loginBtn"); b.disabled = true; b.textContent = "অপেক্ষা করুন...";
        $("loginError").textContent = "";
        try {
            await BWF.auth.signInWithEmailAndPassword(phoneToEmail(phone), pw);
        } catch (e) {
            const bad = ["auth/invalid-credential", "auth/wrong-password", "auth/user-not-found", "auth/invalid-email"];
            $("loginError").textContent = bad.includes(e.code) ? "মোবাইল নম্বর বা পাসওয়ার্ড সঠিক নয়"
                : e.code === "auth/too-many-requests" ? "অনেকবার ভুল হয়েছে, কিছুক্ষণ পরে চেষ্টা করুন"
                : e.code === "auth/network-request-failed" ? "ইন্টারনেট সংযোগ চেক করুন"
                : "লগইন করা যায়নি (" + (e.code || "error") + ")";
            b.disabled = false; b.textContent = "প্রবেশ করুন";
        }
    };

    window.logout = function () {
        if (BWF.auth) BWF.auth.signOut();
        $("loginPassword").value = "";
    };

    // নিজের পাসওয়ার্ড বদলানো
    window.changeMyPassword = async function () {
        const u = BWF.auth && BWF.auth.currentUser;
        if (!u) return;
        const oldPw = prompt("বর্তমান পাসওয়ার্ড দিন:");
        if (oldPw === null) return;
        const newPw = prompt("নতুন পাসওয়ার্ড দিন (কমপক্ষে ৬ অক্ষর):");
        if (newPw === null) return;
        if (newPw.length < 6) { alert("পাসওয়ার্ড কমপক্ষে ৬ অক্ষরের হতে হবে।"); return; }
        try {
            const cred = firebase.auth.EmailAuthProvider.credential(u.email, oldPw);
            await u.reauthenticateWithCredential(cred);
            await u.updatePassword(newPw);
            alert("পাসওয়ার্ড বদলানো হয়েছে।");
        } catch (e) {
            alert(["auth/invalid-credential", "auth/wrong-password"].includes(e.code)
                ? "বর্তমান পাসওয়ার্ড ভুল হয়েছে।" : "পাসওয়ার্ড বদলানো যায়নি (" + (e.code || "error") + ")");
        }
    };

    init();
})();
