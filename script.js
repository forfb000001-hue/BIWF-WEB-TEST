// ==========================
// Donation Management System
// ==========================

// ⚠️ গুগল শিট সিঙ্ক করতে নিচে আপনার Google Apps Script Web App URL বসান।
// (ধাপগুলো "Code.gs" ফাইলের সাথে দেওয়া হলো)
const GOOGLE_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbzTIDClX-zuaj1REE_xzPncB2q95hplrwq6-gTSIx-0dA_5bEZD-I6reOCXD05lTsA/exec";

let members = JSON.parse(localStorage.getItem("members")) || [];
let donations = JSON.parse(localStorage.getItem("donations")) || [];
let expenses = JSON.parse(localStorage.getItem("expenses")) || [];
let expenseCategories = JSON.parse(localStorage.getItem("expenseCategories")) || ["শিক্ষক বেতন", "বই ক্রয়", "ঈদ সহায়তা", "অন্যান্য"];

// এডিট মোড ট্র্যাক করার জন্য
let editingMemberId = null;
let editingExpenseIndex = null;
let editingDonationIndex = null;

// প্রোফাইল মডালে বর্তমানে কোন সদস্য দেখানো হচ্ছে
let currentProfileMemberId = null;

// সর্টিং স্টেট
let sortState = {
    donation: { key: null, dir: 1 },
    expense: { key: null, dir: 1 },
    member: { key: null, dir: 1 }
};

// গুগল শিটে সিঙ্ক হচ্ছে কিনা তা বোঝানোর জন্য ছোট্ট স্ট্যাটাস ইন্ডিকেটর
function setSyncStatus(text) {
    let el = document.getElementById("syncStatus");
    if (!el) {
        el = document.createElement("div");
        el.id = "syncStatus";
        el.style.cssText = "position:fixed;bottom:10px;right:10px;background:#222;color:#fff;padding:6px 12px;border-radius:8px;font-size:12px;z-index:2000;opacity:.85;";
        document.body.appendChild(el);
    }
    el.textContent = text;
    el.style.display = "block";
    if (text === "✅ সিঙ্ক হয়েছে") {
        setTimeout(() => { if (el) el.style.display = "none"; }, 2000);
    }
}

function saveData() {
    // লোকাল ব্যাকআপ হিসেবে localStorage-এও রাখা হচ্ছে (ইন্টারনেট না থাকলে কাজ চালানোর জন্য)
    localStorage.setItem("members", JSON.stringify(members));
    localStorage.setItem("donations", JSON.stringify(donations));
    localStorage.setItem("expenses", JSON.stringify(expenses));
    localStorage.setItem("expenseCategories", JSON.stringify(expenseCategories));

    syncToGoogleSheet();
}

// মূল ডাটা গুগল শিটে পাঠানো হচ্ছে
function syncToGoogleSheet() {
    if (!GOOGLE_SCRIPT_URL || GOOGLE_SCRIPT_URL.indexOf("PASTE_YOUR") === 0) {
        return; // এখনো URL সেট করা হয়নি
    }

    setSyncStatus("⏳ সিঙ্ক হচ্ছে...");

    fetch(GOOGLE_SCRIPT_URL, {
        method: "POST",
        headers: { "Content-Type": "text/plain;charset=utf-8" },
        body: JSON.stringify({ members, donations, expenses, expenseCategories })
    })
        .then(() => setSyncStatus("✅ সিঙ্ক হয়েছে"))
        .catch(() => setSyncStatus("⚠️ সিঙ্ক ব্যর্থ হয়েছে (ইন্টারনেট চেক করুন)"));
}

// গুগল শিট থেকে সর্বশেষ ডাটা লোড করা হচ্ছে (পেজ লোড হওয়ার সময়)
function loadFromGoogleSheet() {
    if (!GOOGLE_SCRIPT_URL || GOOGLE_SCRIPT_URL.indexOf("PASTE_YOUR") === 0) {
        return; // এখনো URL সেট করা হয়নি, শুধু localStorage দিয়ে চলবে
    }

    setSyncStatus("⏳ গুগল শিট থেকে ডাটা আনা হচ্ছে...");

    fetch(GOOGLE_SCRIPT_URL)
        .then(res => res.json())
        .then(data => {
            members = data.members || members;
            donations = data.donations || donations;
            expenses = data.expenses || expenses;
            expenseCategories = (data.expenseCategories && data.expenseCategories.length) ? data.expenseCategories : expenseCategories;
            normalizeMemberPhones();

            localStorage.setItem("members", JSON.stringify(members));
            localStorage.setItem("donations", JSON.stringify(donations));
            localStorage.setItem("expenses", JSON.stringify(expenses));
            localStorage.setItem("expenseCategories", JSON.stringify(expenseCategories));

            render();
            setSyncStatus("✅ সিঙ্ক হয়েছে");
        })
        .catch(() => setSyncStatus("⚠️ গুগল শিট থেকে ডাটা আনতে সমস্যা হয়েছে"));
}

// ==========================
// মোবাইল নম্বর ঠিক করা: বাংলা অঙ্ক -> ইংরেজি, +88/88 বাদ,
// শুরুর 0 হারিয়ে গেলে (Excel/Google Sheet সংখ্যা বানিয়ে ফেললে) আবার বসানো
// ==========================
function cleanPhone(raw) {
    const map = { "০": "0", "১": "1", "২": "2", "৩": "3", "৪": "4", "৫": "5", "৬": "6", "৭": "7", "৮": "8", "৯": "9" };
    let p = String(raw == null ? "" : raw).replace(/[০-৯]/g, d => map[d]).replace(/\D/g, "");
    if (p.startsWith("880")) p = p.slice(2);
    if (p.length === 10 && p.startsWith("1")) p = "0" + p;
    return p;
}
function isValidMobile(p) { return /^01\d{9}$/.test(p); }

// আগে থেকে থাকা সদস্যদের নম্বর মেমরিতে ঠিক করা (অ্যাডমিন পরের সেভে এটা স্থায়ী হয়ে যাবে)
function normalizeMemberPhones() {
    members.forEach(m => {
        if (m.phone === undefined || m.phone === null || m.phone === "") { m.phone = ""; return; }
        const c = cleanPhone(m.phone);
        m.phone = isValidMobile(c) ? c : String(m.phone).trim();
    });
}
normalizeMemberPhones();

function taka(n) {
    return Number(n).toLocaleString("bn-BD") + " টাকা";
}

// ==========================
// টোস্ট নোটিফিকেশন (ফর্ম সাবমিটে সফল/ব্যর্থ বার্তা, alert() এর বদলে)
// ==========================
function getToastContainer() {
    let container = document.getElementById("appToastContainer");
    if (!container) {
        container = document.createElement("div");
        container.id = "appToastContainer";
        container.setAttribute("aria-live", "polite");
        document.body.appendChild(container);
    }
    return container;
}

function showToast(message, type) {

    type = (type === "success") ? "success" : "error";

    const container = getToastContainer();

    const toast = document.createElement("div");
    toast.className = "app-toast " + type;
    toast.innerHTML = `<span class="app-toast-icon">${type === "success" ? "✅" : "⚠️"}</span><span>${String(message).replace(/\n/g, "<br>")}</span>`;

    container.appendChild(toast);

    requestAnimationFrame(() => toast.classList.add("show"));

    setTimeout(() => {
        toast.classList.remove("show");
        setTimeout(() => toast.remove(), 300);
    }, 4000);
}

// ==========================
// Undo Delete (টোস্ট নোটিফিকেশন)
// ==========================
function showUndoToast(message, restoreFn) {

    const old = document.getElementById("undoToast");
    if (old) old.remove();

    const toast = document.createElement("div");
    toast.id = "undoToast";
    toast.className = "undo-toast";
    toast.innerHTML = `<span>${message}</span><button id="undoBtn" type="button">↩️ ফিরিয়ে আনুন</button>`;

    document.body.appendChild(toast);

    const timeoutId = setTimeout(() => {
        const t = document.getElementById("undoToast");
        if (t) t.remove();
    }, 6000);

    document.getElementById("undoBtn").onclick = function () {
        clearTimeout(timeoutId);
        toast.remove();
        restoreFn();
    };
}

// ==========================
// অ্যাক্টিভিটি লগ (কে কী যোগ/এডিট/ডিলিট করলেন তার ইতিহাস)
// ==========================
let activityLog = JSON.parse(localStorage.getItem("activityLog")) || [];

function logActivity(action, detail) {

    const role = sessionStorage.getItem("role");
    const roleBase = role === "admin" ? "অ্যাডমিন" : (role === "viewer" ? "ভিউয়ার" : "অজানা");
    const who = sessionStorage.getItem("userName");
    const roleText = who ? who + " (" + roleBase + ")" : roleBase;

    activityLog.unshift({
        time: new Date().toISOString(),
        role: roleText,
        action,
        detail: detail || ""
    });

    // সর্বোচ্চ ৫০০টা এন্ট্রি রাখা হচ্ছে যাতে লোকাল স্টোরেজ অতিরিক্ত ভারী না হয়
    if (activityLog.length > 500) {
        activityLog = activityLog.slice(0, 500);
    }

    localStorage.setItem("activityLog", JSON.stringify(activityLog));

    renderActivityLog();

}

function formatLogTime(iso) {
    try {
        return new Date(iso).toLocaleString("bn-BD");
    } catch (e) {
        return iso;
    }
}

function renderActivityLog() {

    const table = document.getElementById("activityLogTable");
    if (!table) return;

    if (activityLog.length === 0) {
        table.innerHTML = `<tr class="empty-state-row"><td colspan="4" class="empty-state-msg">এখনো কোনো কার্যক্রম রেকর্ড হয়নি</td></tr>`;
        return;
    }

    table.innerHTML = activityLog.map(entry => `
<tr>
<td data-label="সময়">${formatLogTime(entry.time)}</td>
<td data-label="রোল">${entry.role}</td>
<td data-label="কার্যক্রম">${entry.action}</td>
<td data-label="বিস্তারিত">${entry.detail}</td>
</tr>
`).join("");

}

function clearActivityLog() {

    if (!confirm("আপনি কি নিশ্চিত সব লগ মুছে ফেলতে চান? এটা ফিরিয়ে আনা যাবে না।")) {
        return;
    }

    activityLog = [];
    localStorage.setItem("activityLog", JSON.stringify(activityLog));
    renderActivityLog();

}

// ==========================
// Duplicate সদস্য চেক
// ==========================
function isDuplicateMember(name, phone, excludeId) {

    const nameL = name.trim().toLowerCase();
    const phoneT = cleanPhone(phone);

    return members.some(m => {
        if (excludeId !== null && m.id === excludeId) return false;
        const sameName = String(m.name).trim().toLowerCase() === nameL;
        const samePhone = phoneT !== "" && cleanPhone(m.phone) === phoneT;
        return sameName || samePhone;
    });
}

function addMember() {

    const name = document.getElementById("memberName").value.trim();
    const phoneRaw = document.getElementById("memberPhone").value.trim();
    const phone = phoneRaw ? cleanPhone(phoneRaw) : "";

    if (!name) {
        showToast("নাম লিখুন", "error");
        return;
    }

    // মোবাইল ঐচ্ছিক, কিন্তু দিলে সঠিক হতে হবে (নইলে "আমার অনুদান" মিলবে না)
    if (phone && !isValidMobile(phone)) {
        showToast("সঠিক মোবাইল নম্বর দিন (যেমন 01712345678)", "error");
        return;
    }

    if (isDuplicateMember(name, phone, editingMemberId)) {
        const proceed = confirm("⚠️ এই নাম বা মোবাইল নম্বর দিয়ে ইতিমধ্যে একজন সদস্য আছে। তারপরও যোগ/আপডেট করতে চান?");
        if (!proceed) return;
    }

    if (editingMemberId !== null) {

        // আপডেট মোড
        const member = members.find(m => m.id === editingMemberId);
        if (member) {
            member.name = name;
            member.phone = phone;
        }
        editingMemberId = null;
        document.getElementById("memberSubmitBtn").textContent = "যোগ করুন";

        logActivity("সদস্য আপডেট", name);

        showToast("সদস্যের তথ্য আপডেট হয়েছে", "success");

    } else {

        // নতুন সদস্য যোগ
        members.push({
            id: Date.now(),
            name,
            phone
        });

        logActivity("সদস্য যোগ", name);

        showToast("নতুন সদস্য যোগ হয়েছে", "success");

    }

    document.getElementById("memberName").value = "";
    document.getElementById("memberPhone").value = "";

    saveData();

    render();
}

function editMember(id) {

    const member = members.find(m => m.id === id);

    if (!member) return;

    document.getElementById("memberName").value = member.name;
    document.getElementById("memberPhone").value = member.phone;

    editingMemberId = id;

    document.getElementById("memberSubmitBtn").textContent = "✅ আপডেট করুন";

    document.getElementById("memberName").focus();
}

function deleteMember(id) {

    if (!confirm("আপনি কি নিশ্চিত এই সদস্যকে ডিলিট করতে চান?")) {
        return;
    }

    const idx = members.findIndex(m => m.id === id);
    if (idx === -1) return;

    const removed = members[idx];
    members.splice(idx, 1);

    // যদি এই সদস্যকেই এডিট করা অবস্থায় ছিল, ফর্ম রিসেট করুন
    if (editingMemberId === id) {
        editingMemberId = null;
        document.getElementById("memberName").value = "";
        document.getElementById("memberPhone").value = "";
        document.getElementById("memberSubmitBtn").textContent = "যোগ করুন";
    }

    saveData();

    render();

    logActivity("সদস্য ডিলিট", removed.name);

    showUndoToast("সদস্য ডিলিট হয়েছে।", function () {
        members.splice(idx, 0, removed);
        saveData();
        render();
        logActivity("সদস্য ডিলিট আনডু", removed.name);
    });
}

function importMembersFromExcel() {

    const fileInput = document.getElementById("memberExcelFile");
    const file = fileInput.files[0];

    if (!file) {
        showToast("প্রথমে একটি Excel বা CSV ফাইল নির্বাচন করুন", "error");
        return;
    }

    const reader = new FileReader();

    reader.onload = function (e) {

        try {

            const data = new Uint8Array(e.target.result);
            const workbook = XLSX.read(data, { type: "array" });

            const firstSheetName = workbook.SheetNames[0];
            const sheet = workbook.Sheets[firstSheetName];

            // প্রতিটা সারি একটি array হিসেবে পাওয়া যাবে: [নাম, মোবাইল]
            const rows = XLSX.utils.sheet_to_json(sheet, { header: 1 });

            let addedCount = 0;
            let duplicateCount = 0;
            let badPhoneCount = 0;

            rows.forEach((row, index) => {

                const name = row[0] ? String(row[0]).trim() : "";
                const phoneRaw = row[1] ? String(row[1]).trim() : "";
                let phone = phoneRaw ? cleanPhone(phoneRaw) : "";
                if (phone && !isValidMobile(phone)) { badPhoneCount++; phone = ""; }

                if (!name) return; // খালি সারি বাদ

                // হেডার সারি হলে বাদ দিন (নাম, Name, মোবাইল, Phone ইত্যাদি)
                const headerWords = ["নাম", "name", "মোবাইল", "phone", "mobile"];
                if (headerWords.includes(name.toLowerCase())) return;

                // ডুপ্লিকেট চেক (আগে থেকে থাকা সদস্য + এই ইম্পোর্টে ইতিমধ্যে যোগ হওয়া সদস্য)
                if (isDuplicateMember(name, phone, null)) {
                    duplicateCount++;
                    return;
                }

                members.push({
                    id: Date.now() + index, // প্রতিটা সদস্যের জন্য ইউনিক id
                    name,
                    phone
                });

                addedCount++;

            });

            if (addedCount === 0 && duplicateCount === 0) {
                showToast("কোনো বৈধ সদস্যের তথ্য পাওয়া যায়নি। ফাইলের ফরম্যাট চেক করুন।", "error");
                return;
            }

            saveData();
            render();

            fileInput.value = "";

            logActivity("এক্সেল থেকে সদস্য আমদানি", addedCount + " জন যোগ হয়েছে, " + duplicateCount + " জন ডুপ্লিকেট বাদ পড়েছে");

            let msg = addedCount + " জন সদস্য সফলভাবে যোগ হয়েছে।";
            if (badPhoneCount > 0) {
                msg += "\n" + badPhoneCount + " জনের মোবাইল নম্বর সঠিক নয় বলে খালি রাখা হয়েছে, সদস্য তালিকা থেকে এডিট করে দিন।";
            }
            if (duplicateCount > 0) {
                msg += "\n" + duplicateCount + " জন ডুপ্লিকেট (আগে থেকেই আছে) হওয়ায় বাদ দেওয়া হয়েছে।";
            }
            showToast(msg, duplicateCount > 0 && addedCount === 0 ? "error" : "success");

        } catch (err) {
            showToast("ফাইল পড়তে সমস্যা হয়েছে। ফাইলটি সঠিক Excel/CSV ফরম্যাটে আছে কিনা দেখুন।", "error");
        }

    };

    reader.readAsArrayBuffer(file);

}

function addDonation() {

    const memberId = Number(document.getElementById("donationMember").value);

    const type = document.getElementById("donationType").value;

    const month = document.getElementById("donationMonth").value;

    const amount = Number(document.getElementById("donationAmount").value);

    if (!memberId || !month || !(amount > 0)) {

        showToast("সব তথ্য দিন (সদস্য, মাস ও টাকা)", "error");

        return;

    }

    const donorName = (members.find(m => m.id === memberId) || {}).name || "";
    const typeText = type === "Monthly" ? "মাসিক" : "বাৎসরিক";

    if (editingDonationIndex !== null) {

        // আপডেট মোড
        donations[editingDonationIndex] = {
            memberId,
            type,
            month,
            amount
        };

        editingDonationIndex = null;
        document.getElementById("donationSubmitBtn").textContent = "সংরক্ষণ";

        logActivity("অনুদান আপডেট", donorName + " — " + typeText + " — " + month + " — " + taka(amount));

        showToast("অনুদান আপডেট হয়েছে", "success");

    } else {

        // নতুন অনুদান যোগ
        donations.push({

            memberId,

            type,

            month,

            amount

        });

        logActivity("অনুদান যোগ", donorName + " — " + typeText + " — " + month + " — " + taka(amount));

        showToast("অনুদান সংরক্ষণ করা হয়েছে", "success");

    }

    document.getElementById("donationAmount").value = "";

    saveData();

    render();

}

function editDonation(index) {

    const d = donations[index];

    if (!d) return;

    document.getElementById("donationMember").value = d.memberId;
    document.getElementById("donationType").value = d.type;
    document.getElementById("donationMonth").value = d.month;
    document.getElementById("donationAmount").value = d.amount;

    editingDonationIndex = index;

    document.getElementById("donationSubmitBtn").textContent = "✅ আপডেট করুন";

    document.getElementById("donationAmount").focus();
}

function deleteDonation(index) {

    if (!confirm("আপনি কি নিশ্চিত এই অনুদান এন্ট্রিটি ডিলিট করতে চান?")) {
        return;
    }

    const removed = donations[index];
    donations.splice(index, 1);

    if (editingDonationIndex === index) {
        editingDonationIndex = null;
        document.getElementById("donationAmount").value = "";
        document.getElementById("donationSubmitBtn").textContent = "সংরক্ষণ";
    }

    saveData();

    render();

    const removedDonorName = (members.find(m => m.id === removed.memberId) || {}).name || "";
    logActivity("অনুদান ডিলিট", removedDonorName + " — " + removed.month + " — " + taka(removed.amount));

    showUndoToast("অনুদান এন্ট্রি ডিলিট হয়েছে।", function () {
        donations.splice(index, 0, removed);
        saveData();
        render();
        logActivity("অনুদান ডিলিট আনডু", removedDonorName + " — " + removed.month);
    });

}

// ==========================
// খরচের ক্যাটাগরি ব্যবস্থাপনা
// ==========================
function renderExpenseCategorySelect() {

    const select = document.getElementById("expenseCategory");
    if (!select) return;

    const current = select.value;

    select.innerHTML = "";

    expenseCategories.forEach(cat => {
        const opt = document.createElement("option");
        opt.value = cat;
        opt.textContent = cat;
        select.appendChild(opt);
    });

    if (expenseCategories.includes(current)) {
        select.value = current;
    }
}

function renderCategoryManageList() {

    const list = document.getElementById("categoryManageList");
    if (!list) return;

    if (expenseCategories.length === 0) {
        list.innerHTML = `<p class="empty-state-msg">এখনো কোনো ক্যাটাগরি যোগ করা হয়নি</p>`;
        return;
    }

    list.innerHTML = expenseCategories.map(cat => {
        const safeCat = cat.replace(/'/g, "\\'");
        return `<span class="category-chip">${cat} <button type="button" onclick="deleteExpenseCategory('${safeCat}')" aria-label="${cat} ক্যাটাগরিটি ডিলিট করুন">✕</button></span>`;
    }).join("");
}

function addExpenseCategory() {

    const input = document.getElementById("newCategoryInput");
    const val = input.value.trim();

    if (!val) {
        showToast("ক্যাটাগরির নাম লিখুন", "error");
        return;
    }

    if (expenseCategories.includes(val)) {
        showToast("এই ক্যাটাগরি আগে থেকেই আছে", "error");
        return;
    }

    expenseCategories.push(val);
    localStorage.setItem("expenseCategories", JSON.stringify(expenseCategories));

    input.value = "";

    renderExpenseCategorySelect();
    renderCategoryManageList();

    logActivity("খরচের ক্যাটাগরি যোগ", val);

    showToast("নতুন ক্যাটাগরি যোগ হয়েছে", "success");
}

function deleteExpenseCategory(cat) {

    // এই ক্যাটাগরিটি কতগুলো আগের খরচে ব্যবহৃত হয়েছে তা জানিয়ে দেওয়া হচ্ছে, যাতে ডিলিটের প্রভাব বোঝা যায়
    const usageCount = expenses.filter(e => e.category === cat).length;

    const warning = usageCount > 0
        ? `"${cat}" ক্যাটাগরিটি ${usageCount} টি খরচ এন্ট্রিতে ব্যবহৃত হয়েছে। ডিলিট করলে আগের খরচগুলোতে এই নামটি ঠিকই থেকে যাবে, তবে নতুন কোনো খরচে আর এটি বাছাই করা যাবে না। এগিয়ে যেতে চান?`
        : `"${cat}" ক্যাটাগরিটি তালিকা থেকে বাদ দিতে চান?`;

    if (!confirm(warning)) {
        return;
    }

    expenseCategories = expenseCategories.filter(c => c !== cat);
    localStorage.setItem("expenseCategories", JSON.stringify(expenseCategories));

    renderExpenseCategorySelect();
    renderCategoryManageList();

    logActivity("খরচের ক্যাটাগরি ডিলিট", cat);

    showToast("ক্যাটাগরি ডিলিট হয়েছে", "success");
}

function addExpense() {

    const category = document.getElementById("expenseCategory").value;

    const date = document.getElementById("expenseDate").value;

    const amount = Number(document.getElementById("expenseAmount").value);

    const note = document.getElementById("expenseNote").value;

    if (amount <= 0) {

        showToast("টাকার পরিমাণ লিখুন", "error");

        return;

    }

    if (editingExpenseIndex !== null) {

        // আপডেট মোড
        expenses[editingExpenseIndex] = {
            category,
            date,
            amount,
            note
        };

        editingExpenseIndex = null;
        document.getElementById("expenseSubmitBtn").textContent = "খরচ সংরক্ষণ";

        logActivity("খরচ আপডেট", category + " — " + date + " — " + taka(amount));

        showToast("খরচ আপডেট হয়েছে", "success");

    } else {

        // নতুন খরচ যোগ
        expenses.push({

            category,

            date,

            amount,

            note

        });

        logActivity("খরচ যোগ", category + " — " + date + " — " + taka(amount));

        showToast("খরচ সংরক্ষণ করা হয়েছে", "success");

    }

    document.getElementById("expenseAmount").value = "";

    document.getElementById("expenseNote").value = "";

    saveData();

    render();

}

function editExpense(index) {

    const e = expenses[index];

    if (!e) return;

    document.getElementById("expenseCategory").value = e.category;
    document.getElementById("expenseDate").value = e.date;
    document.getElementById("expenseAmount").value = e.amount;
    document.getElementById("expenseNote").value = e.note;

    editingExpenseIndex = index;

    document.getElementById("expenseSubmitBtn").textContent = "✅ আপডেট করুন";

    document.getElementById("expenseAmount").focus();
}

function deleteExpense(index) {

    if (!confirm("আপনি কি নিশ্চিত এই খরচটি ডিলিট করতে চান?")) {
        return;
    }

    const removed = expenses[index];
    expenses.splice(index, 1);

    // যদি এই খরচটিকেই এডিট করা অবস্থায় ছিল, ফর্ম রিসেট করুন
    if (editingExpenseIndex === index) {
        editingExpenseIndex = null;
        document.getElementById("expenseAmount").value = "";
        document.getElementById("expenseNote").value = "";
        document.getElementById("expenseSubmitBtn").textContent = "খরচ সংরক্ষণ";
    }

    saveData();

    render();

    logActivity("খরচ ডিলিট", removed.category + " — " + removed.date + " — " + taka(removed.amount));

    showUndoToast("খরচের এন্ট্রি ডিলিট হয়েছে।", function () {
        expenses.splice(index, 0, removed);
        saveData();
        render();
        logActivity("খরচ ডিলিট আনডু", removed.category + " — " + removed.date);
    });

}

function renderMemberSelect() {

    const select = document.getElementById("donationMember");

    select.innerHTML = "";

    members.forEach(m => {

        const option = document.createElement("option");

        option.value = m.id;

        option.textContent = m.name;

        select.appendChild(option);

    });

}

// ==========================
// টেবিল সর্টিং
// ==========================
function sortDonations(key) {
    if (sortState.donation.key === key) {
        sortState.donation.dir *= -1;
    } else {
        sortState.donation.key = key;
        sortState.donation.dir = 1;
    }
    renderDonations();
}

function sortExpenses(key) {
    if (sortState.expense.key === key) {
        sortState.expense.dir *= -1;
    } else {
        sortState.expense.key = key;
        sortState.expense.dir = 1;
    }
    renderExpenses();
}

function sortMembers(key) {
    if (sortState.member.key === key) {
        sortState.member.dir *= -1;
    } else {
        sortState.member.key = key;
        sortState.member.dir = 1;
    }
    renderMembers();
}

function updateSortIndicators(prefix, state) {
    document.querySelectorAll(`.sortable-th[data-table="${prefix}"]`).forEach(th => {
        const key = th.getAttribute("data-key");
        const base = th.getAttribute("data-label") || th.textContent.replace(/ ▲| ▼/g, "");
        th.setAttribute("data-label", base);
        if (state.key === key) {
            th.textContent = base + (state.dir === 1 ? " ▲" : " ▼");
        } else {
            th.textContent = base;
        }
    });
}

function renderDonations() {

    const table = document.getElementById("donationTable");

    const searchBox = document.getElementById("donationSearch");
    const keyword = searchBox ? searchBox.value.trim().toLowerCase() : "";

    let rows = donations.map((d, index) => ({ d, index }));

    rows = rows.filter(({ d }) => {
        const member = members.find(m => m.id === d.memberId);
        const memberName = member ? member.name : "";
        const typeText = d.type === "Monthly" ? "মাসিক" : "বাৎসরিক";
        if (!keyword) return true;
        const haystack = (memberName + " " + typeText + " " + d.month).toLowerCase();
        return haystack.includes(keyword);
    });

    if (sortState.donation.key) {
        const key = sortState.donation.key;
        const dir = sortState.donation.dir;
        rows.sort((a, b) => {
            let va = a.d[key];
            let vb = b.d[key];
            if (va < vb) return -1 * dir;
            if (va > vb) return 1 * dir;
            return 0;
        });
    }

    if (rows.length === 0) {
        table.innerHTML = `<tr class="empty-state-row"><td colspan="5" class="empty-state-msg">${keyword ? "কোনো ফলাফল পাওয়া যায়নি" : "এখনো কোনো অনুদান যোগ করা হয়নি"}</td></tr>`;
        updateSortIndicators("donation", sortState.donation);
        applyRoleVisibility();
        return;
    }

    // পারফরম্যান্সের জন্য: প্রতিটা সারি আলাদা করে innerHTML-এ যোগ না করে, সব একসাথে একবারে বসানো হচ্ছে
    const rowsHtml = rows.map(({ d, index }) => {

        const member = members.find(m => m.id === d.memberId);

        const memberName = member ? member.name : "";
        const typeText = d.type === "Monthly" ? "মাসিক" : "বাৎসরিক";

        return `
<tr>
<td data-label="সদস্যের নাম">${memberName}</td>
<td data-label="ধরন">${typeText}</td>
<td data-label="মাস">${d.month}</td>
<td data-label="টাকা">${taka(d.amount)}</td>
<td data-label="কার্যক্রম">
<button class="edit-btn admin-only" onclick="editDonation(${index})" aria-label="${memberName} এর অনুদান এডিট করুন">✏️ এডিট</button>
<button class="delete-btn admin-only" onclick="deleteDonation(${index})" aria-label="${memberName} এর অনুদান ডিলিট করুন">🗑️ ডিলিট</button>
<button class="view-btn" onclick="printDonationReceipt(${index})" aria-label="${memberName} এর অনুদানের রসিদ দেখুন">🧾 রসিদ</button>
<button class="view-btn" onclick="sendDonationReceiptWhatsApp(${index})" aria-label="${memberName} কে WhatsApp এ রসিদ পাঠান">📱 WhatsApp</button>
</td>
</tr>
`;
    }).join("");

    table.innerHTML = rowsHtml;

    updateSortIndicators("donation", sortState.donation);
    applyRoleVisibility();

}

function renderMembers() {

    const table = document.getElementById("memberTable");

    const searchBox = document.getElementById("memberSearch");
    const keyword = searchBox ? searchBox.value.trim().toLowerCase() : "";

    let rows = members.map(member => {
        const total = donations
            .filter(d => d.memberId === member.id)
            .reduce((sum, d) => sum + d.amount, 0);
        return { member, total };
    });

    rows = rows.filter(({ member }) => {
        if (!keyword) return true;
        const haystack = (member.name + " " + member.phone).toLowerCase();
        return haystack.includes(keyword);
    });

    if (sortState.member.key === "total") {
        const dir = sortState.member.dir;
        rows.sort((a, b) => (a.total - b.total) * dir);
    }

    if (rows.length === 0) {
        table.innerHTML = `<tr class="empty-state-row"><td colspan="4" class="empty-state-msg">${keyword ? "কোনো ফলাফল পাওয়া যায়নি" : "এখনো কোনো সদস্য যোগ করা হয়নি"}</td></tr>`;
        updateSortIndicators("member", sortState.member);
        applyRoleVisibility();
        return;
    }

    // পারফরম্যান্সের জন্য: প্রতিটা সারি আলাদা করে innerHTML-এ যোগ না করে, সব একসাথে একবারে বসানো হচ্ছে
    const rowsHtml = rows.map(({ member, total }) => `
<tr>
<td data-label="নাম">${member.name}</td>
<td data-label="মোবাইল">${member.phone}</td>
<td data-label="মোট অনুদান">${taka(total)}</td>
<td data-label="কার্যক্রম">
<button class="view-btn" onclick="showMemberProfile(${member.id})" aria-label="${member.name} এর বিস্তারিত দেখুন">👁️ বিস্তারিত</button>
<button class="edit-btn admin-only" onclick="editMember(${member.id})" aria-label="${member.name} কে এডিট করুন">✏️ এডিট</button>
<button class="delete-btn admin-only" onclick="deleteMember(${member.id})" aria-label="${member.name} কে ডিলিট করুন">🗑️ ডিলিট</button>
</td>
</tr>
`).join("");

    table.innerHTML = rowsHtml;

    updateSortIndicators("member", sortState.member);
    applyRoleVisibility();

}

function renderExpenses() {

    const table = document.getElementById("expenseTable");

    const searchBox = document.getElementById("expenseSearch");
    const keyword = searchBox ? searchBox.value.trim().toLowerCase() : "";

    let rows = expenses.map((e, index) => ({ e, index }));

    rows = rows.filter(({ e }) => {
        if (!keyword) return true;
        const haystack = (e.category + " " + e.note + " " + e.date).toLowerCase();
        return haystack.includes(keyword);
    });

    if (sortState.expense.key) {
        const key = sortState.expense.key;
        const dir = sortState.expense.dir;
        rows.sort((a, b) => {
            let va = a.e[key];
            let vb = b.e[key];
            if (va < vb) return -1 * dir;
            if (va > vb) return 1 * dir;
            return 0;
        });
    }

    if (rows.length === 0) {
        table.innerHTML = `<tr class="empty-state-row"><td colspan="5" class="empty-state-msg">${keyword ? "কোনো ফলাফল পাওয়া যায়নি" : "এখনো কোনো খরচ যোগ করা হয়নি"}</td></tr>`;
        updateSortIndicators("expense", sortState.expense);
        applyRoleVisibility();
        return;
    }

    // পারফরম্যান্সের জন্য: প্রতিটা সারি আলাদা করে innerHTML-এ যোগ না করে, সব একসাথে একবারে বসানো হচ্ছে
    const rowsHtml = rows.map(({ e, index }) => `
<tr>
<td data-label="তারিখ">${e.date}</td>
<td data-label="খাত">${e.category}</td>
<td data-label="পরিমাণ">${taka(e.amount)}</td>
<td data-label="মন্তব্য">${e.note}</td>
<td data-label="কার্যক্রম">
<button class="edit-btn admin-only" onclick="editExpense(${index})" aria-label="${e.category} খরচটি এডিট করুন">✏️ এডিট</button>
<button class="delete-btn admin-only" onclick="deleteExpense(${index})" aria-label="${e.category} খরচটি ডিলিট করুন">🗑️ ডিলিট</button>
</td>
</tr>
`).join("");

    table.innerHTML = rowsHtml;

    updateSortIndicators("expense", sortState.expense);
    applyRoleVisibility();

}

let incomeExpenseChartInstance = null;

function renderChart() {

    const canvas = document.getElementById("incomeExpenseChart");

    if (!canvas || typeof Chart === "undefined") return;

    // সব মাস (অনুদান ও খরচ থেকে) একত্র করে সাজানো
    const monthSet = new Set();

    donations.forEach(d => { if (d.month) monthSet.add(d.month); });
    expenses.forEach(e => { if (e.date) monthSet.add(e.date.slice(0, 7)); });

    const months = Array.from(monthSet).sort();

    const incomeData = months.map(m =>
        donations.filter(d => d.month === m).reduce((sum, d) => sum + d.amount, 0)
    );

    const expenseData = months.map(m =>
        expenses.filter(e => e.date.startsWith(m)).reduce((sum, e) => sum + e.amount, 0)
    );

    if (incomeExpenseChartInstance) {
        incomeExpenseChartInstance.destroy();
    }

    incomeExpenseChartInstance = new Chart(canvas, {
        type: "bar",
        data: {
            labels: months,
            datasets: [
                {
                    label: "অনুদান",
                    data: incomeData,
                    backgroundColor: "#1e6bff"
                },
                {
                    label: "ব্যয়",
                    data: expenseData,
                    backgroundColor: "#e53935"
                }
            ]
        },
        options: {
            responsive: true,
            scales: {
                y: { beginAtZero: true }
            }
        }
    });

}

function showMemberProfile(id) {

    const member = members.find(m => m.id === id);

    if (!member) return;

    currentProfileMemberId = id;

    const memberDonations = donations.filter(d => d.memberId === id);

    const total = memberDonations.reduce((sum, d) => sum + d.amount, 0);

    document.getElementById("profileMemberName").textContent = "👤 " + member.name;
    document.getElementById("profileMemberPhone").textContent = "📞 " + (member.phone || "মোবাইল নেই");
    document.getElementById("profileMemberTotal").textContent = "মোট অনুদান: " + taka(total);

    const table = document.getElementById("profileDonationTable");

    if (memberDonations.length === 0) {
        table.innerHTML = `<tr class="empty-state-row"><td colspan="3" class="empty-state-msg">কোনো অনুদান পাওয়া যায়নি</td></tr>`;
    } else {

        // নতুন মাস আগে দেখানোর জন্য সাজানো
        const sorted = [...memberDonations].sort((a, b) => b.month.localeCompare(a.month));

        table.innerHTML = sorted.map(d => `
<tr>
<td data-label="ধরন">${d.type === "Monthly" ? "মাসিক" : "বাৎসরিক"}</td>
<td data-label="মাস">${d.month}</td>
<td data-label="টাকা">${taka(d.amount)}</td>
</tr>
`).join("");

    }

    document.getElementById("memberProfileModal").classList.add("active");
}

function closeMemberProfile() {
    document.getElementById("memberProfileModal").classList.remove("active");
    currentProfileMemberId = null;
}

function updateDashboard() {

    const income = donations.reduce((sum, d) => sum + d.amount, 0);

    const expense = expenses.reduce((sum, e) => sum + e.amount, 0);

    document.getElementById("totalIncome").innerHTML = taka(income);

    document.getElementById("totalExpense").innerHTML = taka(expense);

    document.getElementById("balance").innerHTML = taka(income - expense);

    renderChart();
    renderExpensePieChart();
    renderTopDonorsWidget();

}

// ==========================
// খরচের পাই চার্ট (খাতভিত্তিক)
// ==========================
let expensePieChartInstance = null;

function renderExpensePieChart() {

    const canvas = document.getElementById("expensePieChart");

    if (!canvas || typeof Chart === "undefined") return;

    const totals = {};

    expenses.forEach(e => {
        const cat = e.category || "অন্যান্য";
        totals[cat] = (totals[cat] || 0) + e.amount;
    });

    const labels = Object.keys(totals);
    const data = labels.map(l => totals[l]);

    const colors = ["#1e6bff", "#e53935", "#2e9e5b", "#f5a623", "#8e44ad", "#16a085", "#d35400", "#2c3e50", "#c0392b", "#27ae60"];

    if (expensePieChartInstance) {
        expensePieChartInstance.destroy();
        expensePieChartInstance = null;
    }

    const emptyMsgId = "expensePieEmptyMsg";
    const existingMsg = document.getElementById(emptyMsgId);
    if (existingMsg) existingMsg.remove();

    if (labels.length === 0) {
        canvas.style.display = "none";
        const wrap = canvas.parentElement;
        const msg = document.createElement("p");
        msg.id = emptyMsgId;
        msg.style.cssText = "text-align:center;color:#888;";
        msg.textContent = "এখনো কোনো খরচ যোগ করা হয়নি";
        wrap.appendChild(msg);
        return;
    }

    canvas.style.display = "block";

    expensePieChartInstance = new Chart(canvas, {
        type: "pie",
        data: {
            labels,
            datasets: [{
                data,
                backgroundColor: labels.map((_, i) => colors[i % colors.length])
            }]
        },
        options: {
            responsive: true,
            plugins: {
                legend: { position: "bottom" }
            }
        }
    });

}

// ==========================
// ড্যাশবোর্ডে টপ ৫ দাতার তালিকা
// ==========================
function renderTopDonorsWidget() {

    const el = document.getElementById("topDonorsList");
    if (!el) return;

    const rows = members.map(member => {
        const total = donations.filter(d => d.memberId === member.id).reduce((sum, d) => sum + d.amount, 0);
        return { member, total };
    }).filter(r => r.total > 0)
      .sort((a, b) => b.total - a.total)
      .slice(0, 5);

    if (rows.length === 0) {
        el.innerHTML = "<p style='text-align:center;color:#888;'>এখনো কোনো অনুদান নেই</p>";
        return;
    }

    el.innerHTML = "<ol style='padding-left:22px; margin:0;'>" +
        rows.map(r => `<li style="padding:6px 0; border-bottom:1px dashed #ddd;">${r.member.name} — <b>${taka(r.total)}</b></li>`).join("") +
        "</ol>";
}

function printReport(){

    let type = document.getElementById("reportType").value;

    let month = document.getElementById("reportMonth").value;

    let year = document.getElementById("reportYear").value;


    let filteredDonation = donations;

    let filteredExpense = expenses;

    let previousDonation = 0;

    let previousExpense = 0;


    // মাসিক রিপোর্ট
    if(type=="month" && month){

        filteredDonation = donations.filter(d =>
            d.month === month
        );

        filteredExpense = expenses.filter(e =>
            e.date.startsWith(month)
        );

        // এই মাসের আগের সব অনুদান ও খরচ (পূর্ববর্তী জমা বের করার জন্য)
        previousDonation = donations
            .filter(d => d.month < month)
            .reduce((sum, d) => sum + d.amount, 0);

        previousExpense = expenses
            .filter(e => e.date < (month + "-01"))
            .reduce((sum, e) => sum + e.amount, 0);

    }


    // বাৎসরিক রিপোর্ট
    if(type=="year" && year){

        filteredDonation = donations.filter(d =>
            d.month.startsWith(year)
        );

        filteredExpense = expenses.filter(e =>
            e.date.startsWith(year)
        );

        // এই বছরের আগের সব অনুদান ও খরচ
        previousDonation = donations
            .filter(d => d.month.split("-")[0] < year)
            .reduce((sum, d) => sum + d.amount, 0);

        previousExpense = expenses
            .filter(e => e.date.split("-")[0] < year)
            .reduce((sum, e) => sum + e.amount, 0);

    }


    let totalDonation = filteredDonation.reduce(
        (sum,d)=>sum+d.amount,0
    );


    let totalExpense = filteredExpense.reduce(
        (sum,e)=>sum+e.amount,0
    );


    let openingBalance = previousDonation - previousExpense;

    let closingBalance = openingBalance + totalDonation - totalExpense;


let title = "";

let periodLabel = (type=="month") ? "এই মাসের" : "এই বছরের";


if(type=="month"){

    let parts = month.split("-");

    let reportMonth = Number(parts[1]);

    let monthNames = [
        "",
        "জানুয়ারি",
        "ফেব্রুয়ারি",
        "মার্চ",
        "এপ্রিল",
        "মে",
        "জুন",
        "জুলাই",
        "আগস্ট",
        "সেপ্টেম্বর",
        "অক্টোবর",
        "নভেম্বর",
        "ডিসেম্বর"
    ];


    title = "মাসিক রিপোর্টঃ " 
    + monthNames[reportMonth] 
    + " " 
    + parts[0];


}
else{

    title = "বাৎসরিক রিপোর্টঃ " + year;

}



let html = `

<html>

<head>

<title>বালাখুর দরিদ্র কল্যাণ তহবিল হিসাব রিপোর্ট</title>


<style>

body{

font-family:'Arial';

padding:30px;

}


h2,h3{

text-align:center;

}


table{

width:100%;

border-collapse:collapse;

margin-bottom:30px;

}


th,td{

border:1px solid black;

padding:8px;

text-align:center;

}


th{

background:#ddd;

}


.total{

font-weight:bold;

background:#f2f2f2;

}


</style>


</head>


<body>



<h2>বালাখুর দরিদ্র কল্যাণ তহবিল এর অনুদান ও ব্যয় রিপোর্ট</h2>


<h3>${title}</h3>



<h3>
পূর্ববর্তী জমা (ব্যালেন্স) : ${taka(openingBalance)}
</h3>


<h3>
${periodLabel} অনুদান : ${taka(totalDonation)}
</h3>


<h3>
${periodLabel} ব্যয় : ${taka(totalExpense)}
</h3>


<h3>
সর্বমোট ব্যালেন্স (আজ পর্যন্ত) : ${taka(closingBalance)}
</h3>




<h2>অনুদানের হিসাব</h2>


<table>


<tr>

<th style="text-align:left;">সদস্যের নাম</th>

<th>ধরন</th>

<th>মাস</th>

<th>টাকা</th>

</tr>



${
filteredDonation.map(d=>{


let member = members.find(
m=>m.id==d.memberId
);


return `


<tr>

<td style="text-align:left;">
${member ? member.name : ""}
</td>


<td>
${d.type=="Monthly" ? "মাসিক":"বাৎসরিক"}
</td>


<td>
${d.month}
</td>


<td>
${taka(d.amount)}
</td>


</tr>


`;


}).join("")
}



<tr class="total">

<td colspan="3">

মোট অনুদান

</td>


<td>

${taka(totalDonation)}

</td>


</tr>



</table>





<h2>ব্যয়ের হিসাব</h2>


<table>


<tr>

<th>তারিখ</th>

<th>খাত</th>

<th>টাকা</th>

<th>মন্তব্য</th>

</tr>



${
filteredExpense.map(e=>{


return `


<tr>

<td>${e.date}</td>

<td>${e.category}</td>

<td>${taka(e.amount)}</td>

<td>${e.note}</td>

</tr>


`;


}).join("")
}




<tr class="total">

<td colspan="2">

মোট ব্যয়

</td>


<td>

${taka(totalExpense)}

</td>


<td></td>


</tr>




</table>

<hr style="margin-top:30px;">

<p style="
    text-align:center;
    font-size:12px;
    color:#666;
    font-style:italic;
">
    This is a computer-generated report.
</p>


</body>

</html>

`;



let win = window.open(
"",
"",
"width=1000,height=800"
);


win.document.write(html);

win.document.close();


win.print();



}

function downloadReportPDF() {

    let type = document.getElementById("reportType").value;
    let month = document.getElementById("reportMonth").value;
    let year = document.getElementById("reportYear").value;

    if (type === "month" && !month) {
        showToast("প্রথমে মাস নির্বাচন করুন", "error");
        return;
    }

    if (type === "year" && !year) {
        showToast("প্রথমে বছর লিখুন", "error");
        return;
    }

    let filteredDonation = donations;
    let filteredExpense = expenses;
    let previousDonation = 0;
    let previousExpense = 0;

    if (type == "month" && month) {

        filteredDonation = donations.filter(d => d.month === month);
        filteredExpense = expenses.filter(e => e.date.startsWith(month));

        previousDonation = donations
            .filter(d => d.month < month)
            .reduce((sum, d) => sum + d.amount, 0);

        previousExpense = expenses
            .filter(e => e.date < (month + "-01"))
            .reduce((sum, e) => sum + e.amount, 0);

    }

    if (type == "year" && year) {

        filteredDonation = donations.filter(d => d.month.startsWith(year));
        filteredExpense = expenses.filter(e => e.date.startsWith(year));

        previousDonation = donations
            .filter(d => d.month.split("-")[0] < year)
            .reduce((sum, d) => sum + d.amount, 0);

        previousExpense = expenses
            .filter(e => e.date.split("-")[0] < year)
            .reduce((sum, e) => sum + e.amount, 0);

    }

    let totalDonation = filteredDonation.reduce((sum, d) => sum + d.amount, 0);
    let totalExpense = filteredExpense.reduce((sum, e) => sum + e.amount, 0);

    let openingBalance = previousDonation - previousExpense;
    let closingBalance = openingBalance + totalDonation - totalExpense;

    let periodLabel = (type == "month") ? "এই মাসের" : "এই বছরের";

    let title = "";

    const monthNames = [
        "", "জানুয়ারি", "ফেব্রুয়ারি", "মার্চ", "এপ্রিল", "মে", "জুন",
        "জুলাই", "আগস্ট", "সেপ্টেম্বর", "অক্টোবর", "নভেম্বর", "ডিসেম্বর"
    ];

    if (type == "month") {
        let parts = month.split("-");
        title = "মাসিক রিপোর্টঃ " + monthNames[Number(parts[1])] + " " + parts[0];
    } else {
        title = "বাৎসরিক রিপোর্টঃ " + year;
    }

    const contentHtml = `
        <div style="font-family:'Hind Siliguri', Arial, sans-serif; padding:20px; color:#000; background:#fff;">
            <h2 style="text-align:center;">বালাখুর দরিদ্র কল্যাণ তহবিল এর অনুদান ও ব্যয় রিপোর্ট</h2>
            <h3 style="text-align:center;">${title}</h3>

            <h3 style="text-align:center;">পূর্ববর্তী জমা (ব্যালেন্স) : ${taka(openingBalance)}</h3>
            <h3 style="text-align:center;">${periodLabel} অনুদান : ${taka(totalDonation)}</h3>
            <h3 style="text-align:center;">${periodLabel} ব্যয় : ${taka(totalExpense)}</h3>
            <h3 style="text-align:center;">সর্বমোট ব্যালেন্স (আজ পর্যন্ত) : ${taka(closingBalance)}</h3>

            <h2>অনুদানের হিসাব</h2>
            <table style="width:100%; border-collapse:collapse; margin-bottom:30px;">
                <tr>
                    <th style="border:1px solid #000; padding:8px; background:#ddd; text-align:left;">সদস্যের নাম</th>
                    <th style="border:1px solid #000; padding:8px; background:#ddd;">ধরন</th>
                    <th style="border:1px solid #000; padding:8px; background:#ddd;">মাস</th>
                    <th style="border:1px solid #000; padding:8px; background:#ddd;">টাকা</th>
                </tr>
                ${filteredDonation.map(d => {
                    const member = members.find(m => m.id == d.memberId);
                    return `<tr>
                        <td style="border:1px solid #000; padding:8px; text-align:left;">${member ? member.name : ""}</td>
                        <td style="border:1px solid #000; padding:8px; text-align:center;">${d.type == "Monthly" ? "মাসিক" : "বাৎসরিক"}</td>
                        <td style="border:1px solid #000; padding:8px; text-align:center;">${d.month}</td>
                        <td style="border:1px solid #000; padding:8px; text-align:center;">${taka(d.amount)}</td>
                    </tr>`;
                }).join("")}
                <tr style="font-weight:bold; background:#f2f2f2;">
                    <td colspan="3" style="border:1px solid #000; padding:8px; text-align:center;">মোট অনুদান</td>
                    <td style="border:1px solid #000; padding:8px; text-align:center;">${taka(totalDonation)}</td>
                </tr>
            </table>

            <h2>ব্যয়ের হিসাব</h2>
            <table style="width:100%; border-collapse:collapse; margin-bottom:30px;">
                <tr>
                    <th style="border:1px solid #000; padding:8px; background:#ddd;">তারিখ</th>
                    <th style="border:1px solid #000; padding:8px; background:#ddd;">খাত</th>
                    <th style="border:1px solid #000; padding:8px; background:#ddd;">টাকা</th>
                    <th style="border:1px solid #000; padding:8px; background:#ddd;">মন্তব্য</th>
                </tr>
                ${filteredExpense.map(e => {
                    return `<tr>
                        <td style="border:1px solid #000; padding:8px; text-align:center;">${e.date}</td>
                        <td style="border:1px solid #000; padding:8px; text-align:center;">${e.category}</td>
                        <td style="border:1px solid #000; padding:8px; text-align:center;">${taka(e.amount)}</td>
                        <td style="border:1px solid #000; padding:8px; text-align:center;">${e.note}</td>
                    </tr>`;
                }).join("")}
                <tr style="font-weight:bold; background:#f2f2f2;">
                    <td colspan="2" style="border:1px solid #000; padding:8px; text-align:center;">মোট ব্যয়</td>
                    <td style="border:1px solid #000; padding:8px; text-align:center;">${taka(totalExpense)}</td>
                    <td style="border:1px solid #000; padding:8px;"></td>
                </tr>
            </table>
<hr style="margin-top:30px;">

<p style="
    text-align:center;
    font-size:12px;
    color:#666;
    font-style:italic;
">
    This is a computer-generated report.
</p>
        </div>
    `;

    const container = document.getElementById("pdfReportContainer");

    if (!container || typeof html2canvas === "undefined" || typeof window.jspdf === "undefined") {
        showToast("PDF তৈরির লাইব্রেরি লোড হয়নি। ইন্টারনেট সংযোগ চেক করে আবার চেষ্টা করুন।", "error");
        return;
    }

    container.innerHTML = contentHtml;

    // একটু সময় দেওয়া হচ্ছে যাতে ব্রাউজার কন্টেন্টটা ঠিকমতো রেন্ডার করে নেয়
    setTimeout(function () {

        html2canvas(container, { scale: 2, backgroundColor: "#ffffff" }).then(function (canvas) {

            const imgData = canvas.toDataURL("image/png");

            const { jsPDF } = window.jspdf;

            const pdf = new jsPDF({
                orientation: canvas.width > canvas.height ? "l" : "p",
                unit: "px",
                format: [canvas.width, canvas.height]
            });

            pdf.addImage(imgData, "PNG", 0, 0, canvas.width, canvas.height);

            const fileName = (type == "month")
                ? "report-" + month + ".pdf"
                : "report-" + year + ".pdf";

            pdf.save(fileName);

            container.innerHTML = "";

        }).catch(function () {
            showToast("PDF তৈরিতে সমস্যা হয়েছে, আবার চেষ্টা করুন।", "error");
            container.innerHTML = "";
        });

    }, 100);

}

// ==========================
// রসিদ প্রিন্ট (একক অনুদান)
// ==========================
function printDonationReceipt(index) {

    const d = donations[index];
    if (!d) return;

    const member = members.find(m => m.id === d.memberId);

    const html = `
<html>
<head>
<title>অনুদান রসিদ</title>
<style>
body{font-family:'Arial'; padding:40px; background:#fff;}
.receipt{border:2px solid #000; padding:30px; max-width:500px; margin:auto;}
h2{text-align:center; margin-top:0;}
h3{text-align:center; margin-top:0; color:#333;}
table{width:100%; margin-top:20px; border-collapse:collapse;}
td{padding:8px; border-bottom:1px dashed #999;}
.label{font-weight:bold; width:40%;}
.footer{text-align:center; margin-top:40px; font-size:13px; color:#555;}
</style>
</head>
<body>
<div class="receipt">
<h2>বালাখুর দরিদ্র কল্যাণ তহবিল</h2>
<h3>অনুদান রসিদ</h3>
<table>
<tr><td class="label">দাতার নাম</td><td style="text-align:left;">${member ? member.name : ""}</td></tr>
<tr><td class="label">মোবাইল</td><td>${member ? (member.phone || "-") : "-"}</td></tr>
<tr><td class="label">ধরন</td><td>${d.type === "Monthly" ? "মাসিক" : "বাৎসরিক"}</td></tr>
<tr><td class="label">মাস</td><td>${d.month}</td></tr>
<tr><td class="label">পরিমাণ</td><td>${taka(d.amount)}</td></tr>
<tr><td class="label">রসিদ প্রদানের তারিখ</td><td>${new Date().toLocaleDateString("bn-BD")}</td></tr>
</table>
<p class="footer">ধন্যবাদান্তে — বালাখুর দরিদ্র কল্যাণ তহবিল</p>
</div>
</body>
</html>
`;

    const win = window.open("", "", "width=600,height=700");
    win.document.write(html);
    win.document.close();
    win.print();

}

// ==========================
// সদস্যের বাৎসরিক সামারি কার্ড
// ==========================
function printMemberYearlySummary(id) {

    const memberId = id !== undefined && id !== null ? id : currentProfileMemberId;
    const member = members.find(m => m.id === memberId);

    if (!member) {
        showToast("সদস্য খুঁজে পাওয়া যায়নি", "error");
        return;
    }

    const memberDonations = donations.filter(d => d.memberId === memberId);

    const yearTotals = {};
    memberDonations.forEach(d => {
        const year = d.month ? d.month.split("-")[0] : "অজানা";
        yearTotals[year] = (yearTotals[year] || 0) + d.amount;
    });

    const years = Object.keys(yearTotals).sort();
    const grandTotal = memberDonations.reduce((s, d) => s + d.amount, 0);

    const html = `
<html>
<head>
<title>বাৎসরিক সামারি</title>
<style>
body{font-family:'Arial'; padding:30px;}
h2,h3{text-align:center;}
p{text-align:center; color:#555;}
table{width:100%; border-collapse:collapse; margin-top:20px;}
th,td{border:1px solid #000; padding:8px; text-align:center;}
th{background:#ddd;}
.total{font-weight:bold; background:#f2f2f2;}
</style>
</head>
<body>
<h2>বালাখুর দরিদ্র কল্যাণ তহবিল</h2>
<h3>${member.name} — বাৎসরিক অনুদান সামারি</h3>
<p>মোবাইল: ${member.phone || "-"}</p>
<table>
<tr><th>বছর</th><th>মোট অনুদান</th></tr>
${years.length === 0 ? '<tr><td colspan="2">কোনো অনুদান পাওয়া যায়নি</td></tr>' : years.map(y => `<tr><td>${y}</td><td>${taka(yearTotals[y])}</td></tr>`).join("")}
<tr class="total"><td>সর্বমোট</td><td>${taka(grandTotal)}</td></tr>
</table>
</body>
</html>
`;

    const win = window.open("", "", "width=700,height=700");
    win.document.write(html);
    win.document.close();
    win.print();

}

// ==========================
// Excel এক্সপোর্ট
// ==========================
function exportMembersExcel() {

    if (typeof XLSX === "undefined") {
        showToast("Excel লাইব্রেরি লোড হয়নি। ইন্টারনেট সংযোগ চেক করুন।", "error");
        return;
    }

    const rows = members.map(m => ({
        "নাম": m.name,
        "মোবাইল": m.phone,
        "মোট অনুদান": donations.filter(d => d.memberId === m.id).reduce((s, d) => s + d.amount, 0)
    }));

    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "সদস্য তালিকা");
    XLSX.writeFile(wb, "সদস্য-তালিকা.xlsx");
}

function exportDonationsExcel() {

    if (typeof XLSX === "undefined") {
        showToast("Excel লাইব্রেরি লোড হয়নি। ইন্টারনেট সংযোগ চেক করুন।", "error");
        return;
    }

    const rows = donations.map(d => {
        const member = members.find(m => m.id === d.memberId);
        return {
            "সদস্যের নাম": member ? member.name : "",
            "ধরন": d.type === "Monthly" ? "মাসিক" : "বাৎসরিক",
            "মাস": d.month,
            "টাকা": d.amount
        };
    });

    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "অনুদান তালিকা");
    XLSX.writeFile(wb, "অনুদান-তালিকা.xlsx");
}

function exportExpensesExcel() {

    if (typeof XLSX === "undefined") {
        showToast("Excel লাইব্রেরি লোড হয়নি। ইন্টারনেট সংযোগ চেক করুন।", "error");
        return;
    }

    const rows = expenses.map(e => ({
        "তারিখ": e.date,
        "খাত": e.category,
        "টাকা": e.amount,
        "মন্তব্য": e.note
    }));

    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "খরচের তালিকা");
    XLSX.writeFile(wb, "খরচ-তালিকা.xlsx");
}

// ==========================
// Backup / Restore
// ==========================
function exportData() {

    const data = {

        members,

        donations,

        expenses,

        expenseCategories

    };

    const blob = new Blob(

        [JSON.stringify(data, null, 2)],

        {

            type: "application/json"

        }

    );

    const a = document.createElement("a");

    a.href = URL.createObjectURL(blob);

    a.download = "backup.json";

    a.click();

    localStorage.setItem("lastBackupDate", String(Date.now()));

}

function importData() {

    const file = document.getElementById("restoreFile").files[0];

    if (!file) {

        showToast("ফাইল নির্বাচন করুন", "error");

        return;

    }

    const reader = new FileReader();

    reader.onload = function () {

        const data = JSON.parse(reader.result);

        members = data.members || [];

        donations = data.donations || [];

        expenses = data.expenses || [];

        expenseCategories = data.expenseCategories || expenseCategories;

        saveData();

        render();

        logActivity("ব্যাকআপ থেকে রিস্টোর", members.length + " সদস্য, " + donations.length + " অনুদান, " + expenses.length + " খরচ পুনরুদ্ধার হয়েছে");

        showToast("Restore সফল হয়েছে", "success");

    };

    reader.readAsText(file);

}

// ==========================
// ব্যাকআপ রিমাইন্ডার
// ==========================
function checkBackupReminder() {

    const last = localStorage.getItem("lastBackupDate");
    const now = Date.now();
    const sevenDays = 7 * 24 * 60 * 60 * 1000;

    if (!last || (now - Number(last)) > sevenDays) {
        setTimeout(function () {
            const wantsBackup = confirm("অনেকদিন ব্যাকআপ নেওয়া হয়নি। এখনই ব্যাকআপ ডাউনলোড করতে চান?");
            if (wantsBackup) {
                exportData();
            }
        }, 800);
    }
}

// ==========================
// রোল (Admin / Viewer) অনুযায়ী বাটন লুকানো
// ==========================
function applyRoleVisibility() {
    const role = sessionStorage.getItem("role");
    document.body.classList.toggle("role-viewer", role === "viewer");
}

// ==========================
// WhatsApp রসিদ ও রিমাইন্ডার পাঠানো
// (এটি wa.me লিংক ব্যবহার করে — WhatsApp খুলে মেসেজ আগে থেকেই লেখা থাকবে,
//  শুধু "Send" চাপতে হবে। সম্পূর্ণ স্বয়ংক্রিয়/বাল্ক পাঠানোর জন্য পেইড WhatsApp
//  Business API ও ব্যাকএন্ড সার্ভার লাগবে, যা এই অফলাইন অ্যাপে সম্ভব নয়।)
// ==========================
const MONTH_NAMES_BN = ["", "জানুয়ারি", "ফেব্রুয়ারি", "মার্চ", "এপ্রিল", "মে", "জুন", "জুলাই", "আগস্ট", "সেপ্টেম্বর", "অক্টোবর", "নভেম্বর", "ডিসেম্বর"];

function monthTitleFromValue(monthValue) {
    const parts = monthValue.split("-");
    return (MONTH_NAMES_BN[Number(parts[1])] || "") + " " + parts[0];
}

// বাংলাদেশি নম্বরকে wa.me এর জন্য আন্তর্জাতিক ফরম্যাটে (৮৮০...) রূপান্তর
function formatPhoneForWhatsApp(phone) {
    if (!phone) return null;
    const digits = String(phone).replace(/[^\d]/g, "");
    if (!digits) return null;
    if (digits.startsWith("880")) return digits;
    if (digits.startsWith("0")) return "880" + digits.slice(1);
    if (digits.length === 10) return "880" + digits;
    return digits;
}

function openWhatsApp(phone, message) {
    const formatted = formatPhoneForWhatsApp(phone);
    if (!formatted) {
        showToast("সঠিক মোবাইল নম্বর পাওয়া যায়নি", "error");
        return false;
    }
    const url = "https://wa.me/" + formatted + "?text=" + encodeURIComponent(message);
    window.open(url, "_blank");
    return true;
}

function sendDonationReceiptWhatsApp(index) {

    const d = donations[index];
    if (!d) return;

    const member = members.find(m => m.id === d.memberId);
    if (!member) {
        showToast("সদস্য খুঁজে পাওয়া যায়নি", "error");
        return;
    }

    const typeText = d.type === "Monthly" ? "মাসিক" : "বাৎসরিক";

    const message =
`🙏 বালাখুর দরিদ্র কল্যাণ তহবিল

প্রিয় ${member.name},
আপনার অনুদান সফলভাবে গ্রহণ করা হয়েছে।

ধরন: ${typeText}
মাস: ${d.month}
পরিমাণ: ${taka(d.amount)}
তারিখ: ${new Date().toLocaleDateString("bn-BD")}

আপনার উদারতার জন্য আন্তরিক ধন্যবাদ। 🙏`;

    if (openWhatsApp(member.phone, message)) {
        logActivity("WhatsApp রসিদ পাঠানো হয়েছে", member.name + " — " + d.month);
    }
}

// ===== যারা অনুদান দেয়নি — WhatsApp রিমাইন্ডার মডাল =====
function openDueMemberReminder() {

    const month = document.getElementById("reportMonth").value;

    if (!month) {
        showToast("প্রথমে মাস নির্বাচন করুন", "error");
        return;
    }

    const dueMembers = members.filter(member => {
        const paid = donations.some(d => d.memberId == member.id && d.month == month);
        return !paid;
    });

    document.getElementById("dueReminderMonthTitle").textContent = monthTitleFromValue(month);

    const listEl = document.getElementById("dueReminderList");

    if (members.length === 0) {
        listEl.innerHTML = `<p class="empty-state-msg">এখনো কোনো সদস্য যোগ করা হয়নি</p>`;
    } else if (dueMembers.length === 0) {
        listEl.innerHTML = `<p class="empty-state-msg">🎉 এই মাসে সবাই অনুদান দিয়েছেন</p>`;
    } else {
        listEl.innerHTML = dueMembers.map(m => `
<div class="due-reminder-row">
<span>${m.name}${m.phone ? "" : " <em>(মোবাইল নম্বর নেই)</em>"}</span>
<button class="view-btn" onclick="sendDueReminderWhatsApp(${m.id}, '${month}')" aria-label="${m.name} কে WhatsApp রিমাইন্ডার পাঠান" ${m.phone ? "" : "disabled"}>📱 রিমাইন্ডার পাঠান</button>
</div>
`).join("");
    }

    document.getElementById("dueReminderModal").classList.add("active");
}

function closeDueReminderModal() {
    document.getElementById("dueReminderModal").classList.remove("active");
}

function sendDueReminderWhatsApp(memberId, month) {

    const member = members.find(m => m.id === memberId);
    if (!member) return;

    const monthTitle = monthTitleFromValue(month);

    const message =
`🙏 বালাখুর দরিদ্র কল্যাণ তহবিল

প্রিয় ${member.name},
${monthTitle} মাসের অনুদান এখনো জমা হয়নি। সুবিধাজনক সময়ে অনুদান দেওয়ার জন্য বিনীত অনুরোধ রইলো।

ধন্যবাদান্তে,
বালাখুর দরিদ্র কল্যাণ তহবিল কমিটি`;

    if (openWhatsApp(member.phone, message)) {
        logActivity("WhatsApp রিমাইন্ডার পাঠানো হয়েছে", member.name + " — " + monthTitle);
    }
}

function render() {

    renderExpenseCategorySelect();
    renderCategoryManageList();

    renderMemberSelect();

    renderDonations();

    renderMembers();

    renderExpenses();

    updateDashboard();

    renderActivityLog();

    applyRoleVisibility();

}

render();
loadFromGoogleSheet();

function printDueMemberReport(){

    let month = document.getElementById("reportMonth").value;


    if(!month){

        showToast("প্রথমে মাস নির্বাচন করুন", "error");

        return;

    }


    let dueMembers = members.filter(member=>{


        let paid = donations.some(d=>

            d.memberId == member.id &&
            d.month == month

        );


        return !paid;


    });



    let parts = month.split("-");


    let monthNames = [
        "",
        "জানুয়ারি",
        "ফেব্রুয়ারি",
        "মার্চ",
        "এপ্রিল",
        "মে",
        "জুন",
        "জুলাই",
        "আগস্ট",
        "সেপ্টেম্বর",
        "অক্টোবর",
        "নভেম্বর",
        "ডিসেম্বর"
    ];


    let title = 
    monthNames[Number(parts[1])]
    +" "
    +parts[0];



    let html = `

<html>

<head>

<title>অনুদান বাকি তালিকা</title>


<style>

body{

font-family:Arial;
padding:30px;

}


h2{

text-align:center;

}


table{

width:100%;
border-collapse:collapse;

}


th,td{

border:1px solid black;
padding:10px;
text-align:center;

}


</style>


</head>


<body>


<h2>
বালাখুর দরিদ্র কল্যাণ তহবিল
</h2>


<h3>
${title} মাসের অনুদান প্রদান করেননি
</h3>



<table>


<tr>

<th>ক্রমিক</th>

<th style="text-align:left;">সদস্যের নাম</th>

<th>মোবাইল</th>

</tr>



${
dueMembers.map((m,index)=>`

<tr>

<td>${index+1}</td>

<td style="text-align:left;">${m.name}</td>

<td>${m.phone}</td>

</tr>


`).join("")
}



</table>



<h3>
মোট বাকি সদস্য : ${dueMembers.length} জন
</h3>



</body>

</html>

`;



let win = window.open(
"",
"",
"width=800,height=700"
);


win.document.write(html);

win.document.close();


win.print();


}

// ==========================
// কাস্টম তারিখ-রেঞ্জ রিপোর্ট
// ==========================
function printCustomRangeReport() {

    const fromDate = document.getElementById("customFromDate").value;
    const toDate = document.getElementById("customToDate").value;

    if (!fromDate || !toDate) {
        showToast("শুরু ও শেষ তারিখ দিন", "error");
        return;
    }

    if (fromDate > toDate) {
        showToast("শুরুর তারিখ শেষের তারিখের পরে হতে পারবে না", "error");
        return;
    }

    // অনুদানের 'month' ফিল্ড YYYY-MM ফরম্যাটে থাকে, তাই সেটার সাথে তুলনা করার জন্য মাস বের করা হচ্ছে
    const fromMonth = fromDate.slice(0, 7);
    const toMonth = toDate.slice(0, 7);

    const filteredDonation = donations.filter(d => d.month >= fromMonth && d.month <= toMonth);
    const filteredExpense = expenses.filter(e => e.date >= fromDate && e.date <= toDate);

    const previousDonation = donations
        .filter(d => d.month < fromMonth)
        .reduce((sum, d) => sum + d.amount, 0);

    const previousExpense = expenses
        .filter(e => e.date < fromDate)
        .reduce((sum, e) => sum + e.amount, 0);

    const totalDonation = filteredDonation.reduce((sum, d) => sum + d.amount, 0);
    const totalExpense = filteredExpense.reduce((sum, e) => sum + e.amount, 0);

    const openingBalance = previousDonation - previousExpense;
    const closingBalance = openingBalance + totalDonation - totalExpense;

    const title = "কাস্টম রিপোর্টঃ " + fromDate + " থেকে " + toDate;

    const html = `
<html>
<head>
<title>বালাখুর দরিদ্র কল্যাণ তহবিল হিসাব রিপোর্ট</title>
<style>
body{font-family:'Arial';padding:30px;}
h2,h3{text-align:center;}
table{width:100%;border-collapse:collapse;margin-bottom:30px;}
th,td{border:1px solid black;padding:8px;text-align:center;}
th{background:#ddd;}
.total{font-weight:bold;background:#f2f2f2;}
</style>
</head>
<body>

<h2>বালাখুর দরিদ্র কল্যাণ তহবিল এর অনুদান ও ব্যয় রিপোর্ট</h2>
<h3>${title}</h3>

<h3>পূর্ববর্তী জমা (ব্যালেন্স) : ${taka(openingBalance)}</h3>
<h3>এই সময়ে অনুদান : ${taka(totalDonation)}</h3>
<h3>এই সময়ে ব্যয় : ${taka(totalExpense)}</h3>
<h3>সর্বমোট ব্যালেন্স (আজ পর্যন্ত) : ${taka(closingBalance)}</h3>

<h2>অনুদানের হিসাব</h2>
<table>
<tr>
<th style="text-align:left;">সদস্যের নাম</th>
<th>ধরন</th>
<th>মাস</th>
<th>টাকা</th>
</tr>
${
filteredDonation.map(d => {
    const member = members.find(m => m.id == d.memberId);
    return `
<tr>
<td style="text-align:left;">${member ? member.name : ""}</td>
<td>${d.type == "Monthly" ? "মাসিক" : "বাৎসরিক"}</td>
<td>${d.month}</td>
<td>${taka(d.amount)}</td>
</tr>
`;
}).join("")
}
<tr class="total">
<td colspan="3">মোট অনুদান</td>
<td>${taka(totalDonation)}</td>
</tr>
</table>

<h2>ব্যয়ের হিসাব</h2>
<table>
<tr>
<th>তারিখ</th>
<th>খাত</th>
<th>টাকা</th>
<th>মন্তব্য</th>
</tr>
${
filteredExpense.map(e => `
<tr>
<td>${e.date}</td>
<td>${e.category}</td>
<td>${taka(e.amount)}</td>
<td>${e.note}</td>
</tr>
`).join("")
}
<tr class="total">
<td colspan="2">মোট ব্যয়</td>
<td>${taka(totalExpense)}</td>
<td></td>
</tr>
</table>

<hr style="margin-top:30px;">
<p style="text-align:center;font-size:12px;color:#666;font-style:italic;">This is a computer-generated report.</p>

</body>
</html>
`;

    const win = window.open("", "", "width=1000,height=800");
    win.document.write(html);
    win.document.close();
    win.print();

}

// ==========================
// নিয়মিত / অনিয়মিত দাতাদের তালিকা
// ==========================
function printDonorRegularityReport() {

    const monthlyDonations = donations.filter(d => d.type === "Monthly");

    if (members.length === 0) {
        showToast("এখনো কোনো সদস্য যোগ করা হয়নি", "error");
        return;
    }

    const now = new Date();
    const currentMonth = now.getFullYear() + "-" + String(now.getMonth() + 1).padStart(2, "0");

    const REGULAR_THRESHOLD = 0.8; // ৮০% বা তার বেশি মাস পরিশোধ করলে "নিয়মিত" ধরা হচ্ছে

    const rows = members.map(member => {

        const memberMonths = monthlyDonations
            .filter(d => d.memberId === member.id)
            .map(d => d.month)
            .sort();

        if (memberMonths.length === 0) {
            return { member, paid: 0, total: 0, rate: 0, status: "দান করেননি" };
        }

        const startMonth = memberMonths[0];

        const [sy, sm] = startMonth.split("-").map(Number);
        const [ey, em] = currentMonth.split("-").map(Number);
        const totalMonths = Math.max(1, (ey - sy) * 12 + (em - sm) + 1);

        const paidMonths = new Set(memberMonths).size;
        const rate = paidMonths / totalMonths;

        const status = rate >= REGULAR_THRESHOLD ? "✅ নিয়মিত" : "⚠️ অনিয়মিত";

        return { member, paid: paidMonths, total: totalMonths, rate, status };

    });

    rows.sort((a, b) => b.rate - a.rate);

    const html = `
<html>
<head>
<title>নিয়মিত / অনিয়মিত দাতাদের তালিকা</title>
<style>
body{font-family:Arial;padding:30px;}
h2,h3{text-align:center;}
p.note{text-align:center;color:#555;font-size:13px;}
table{width:100%;border-collapse:collapse;margin-top:20px;}
th,td{border:1px solid black;padding:8px;text-align:center;}
th{background:#ddd;}
</style>
</head>
<body>

<h2>বালাখুর দরিদ্র কল্যাণ তহবিল</h2>
<h3>নিয়মিত / অনিয়মিত দাতাদের তালিকা (মাসিক অনুদান অনুযায়ী)</h3>
<p class="note">যিনি নিজের প্রথম অনুদানের মাস থেকে এখন পর্যন্ত মোট মাসের কমপক্ষে ৮০% পরিশোধ করেছেন, তাকে "নিয়মিত" ধরা হয়েছে।</p>

<table>
<tr>
<th style="text-align:left;">সদস্যের নাম</th>
<th>মোবাইল</th>
<th>পরিশোধিত মাস</th>
<th>মোট মাস (শুরু থেকে)</th>
<th>হার</th>
<th>অবস্থা</th>
</tr>
${
rows.map(r => `
<tr>
<td style="text-align:left;">${r.member.name}</td>
<td>${r.member.phone || "-"}</td>
<td>${r.paid}</td>
<td>${r.total}</td>
<td>${Math.round(r.rate * 100)}%</td>
<td>${r.status}</td>
</tr>
`).join("")
}
</table>

<hr style="margin-top:30px;">
<p style="text-align:center;font-size:12px;color:#666;font-style:italic;">This is a computer-generated report.</p>

</body>
</html>
`;

    const win = window.open("", "", "width=900,height=700");
    win.document.write(html);
    win.document.close();
    win.print();

}

// ==========================
// টপ ডোনার তালিকা
// ==========================
function printTopDonorsReport() {

    const rows = members.map(member => {
        const memberDonations = donations.filter(d => d.memberId === member.id);
        const total = memberDonations.reduce((sum, d) => sum + d.amount, 0);
        return { member, total, count: memberDonations.length };
    }).filter(r => r.total > 0)
      .sort((a, b) => b.total - a.total);

    if (rows.length === 0) {
        showToast("এখনো কোনো অনুদান পাওয়া যায়নি", "error");
        return;
    }

    const html = `
<html>
<head>
<title>টপ ডোনার তালিকা</title>
<style>
body{font-family:Arial;padding:30px;}
h2,h3{text-align:center;}
table{width:100%;border-collapse:collapse;margin-top:20px;}
th,td{border:1px solid black;padding:8px;text-align:center;}
th{background:#ddd;}
tr:first-child td{font-weight:bold;}
</style>
</head>
<body>

<h2>বালাখুর দরিদ্র কল্যাণ তহবিল</h2>
<h3>টপ ডোনার তালিকা</h3>

<table>
<tr>
<th>ক্রমিক</th>
<th style="text-align:left;">সদস্যের নাম</th>
<th>মোবাইল</th>
<th>মোট অনুদান</th>
<th>অনুদানের সংখ্যা</th>
</tr>
${
rows.map((r, index) => `
<tr>
<td>${index + 1}</td>
<td style="text-align:left;">${r.member.name}</td>
<td>${r.member.phone || "-"}</td>
<td>${taka(r.total)}</td>
<td>${r.count}</td>
</tr>
`).join("")
}
</table>

<hr style="margin-top:30px;">
<p style="text-align:center;font-size:12px;color:#666;font-style:italic;">This is a computer-generated report.</p>

</body>
</html>
`;

    const win = window.open("", "", "width=900,height=700");
    win.document.write(html);
    win.document.close();
    win.print();

}
