// ==========================
// ইউজার ব্যবস্থাপনা (শুধু অ্যাডমিন): সদস্যের লগইন অ্যাকাউন্ট খোলা, রোল বদলানো, চালু/বন্ধ করা
// ==========================
(function () {
    const $ = id => document.getElementById(id);
    let unsub = null, usersCache = [];

    function esc(s) { const d = document.createElement("div"); d.textContent = s == null ? "" : String(s); return d.innerHTML; }

    // ---------- ভিউয়ারের অনুমতি (কোন কোন ট্যাব দেখবে) ----------
    function tabsBoxHTML(cls, selected) {
        return BWF_TABS.map(t => '<label class="perm-item"><input type="checkbox" class="' + cls + '" value="' + t.id + '"' +
            (selected.includes(t.id) ? " checked" : "") + "> " + esc(t.label) + "</label>").join("");
    }
    function pickedTabs(cls) {
        return Array.from(document.querySelectorAll("input." + cls + ":checked")).map(i => i.value);
    }
    window.userRoleChanged = function () {
        const w = $("userTabsWrap");
        if (w) w.style.display = $("userRole").value === "viewer" ? "block" : "none";
    };
    window.userPermAll = function (cls, on) {
        document.querySelectorAll("input." + cls).forEach(i => { i.checked = on; });
    };
    window.userEditPerms = function (id) {
        const u = usersCache.find(x => x.id === id); if (!u) return;
        const cur = Array.isArray(u.allowedTabs) ? u.allowedTabs : BWF_DEFAULT_TABS;
        const p = $("userPermPanel");
        p.innerHTML = "<h3>👁️ " + esc(u.name) + " কী কী দেখতে পারবে</h3>" +
            '<div class="perm-grid">' + tabsBoxHTML("permEdit", cur) + "</div>" +
            '<div class="perm-actions">' +
              '<button onclick="userSavePerms(\'' + id + '\')">✅ সংরক্ষণ করুন</button>' +
              '<button onclick="userPermAll(\'permEdit\', true)">সব বাছুন</button>' +
              '<button onclick="userPermAll(\'permEdit\', false)">সব বাদ দিন</button>' +
              '<button class="delete-btn" onclick="userClosePerms()">বাতিল</button>' +
            "</div>";
        p.style.display = "block";
        p.scrollIntoView({ behavior: "smooth", block: "center" });
    };
    window.userClosePerms = function () { const p = $("userPermPanel"); p.style.display = "none"; p.innerHTML = ""; };
    window.userSavePerms = async function (id) {
        const u = usersCache.find(x => x.id === id); if (!u) return;
        const tabs = pickedTabs("permEdit");
        try {
            await BWF.db.collection("users").doc(id).update({ allowedTabs: tabs });
            if (typeof logActivity === "function") logActivity("ইউজার অনুমতি", u.name + " → " + tabs.length + "টি ট্যাব");
            userClosePerms();
            alert("✅ " + u.name + " এর অনুমতি সংরক্ষণ হয়েছে। সে লগইন অবস্থায় থাকলে সাথে সাথে বদলে যাবে।");
        } catch (e) { alert("অনুমতি সংরক্ষণ করা যায়নি।"); }
    };

    function fillMemberPicker() {
        const sel = $("userMemberPick");
        if (!sel) return;
        const list = (typeof members !== "undefined" ? members : []);
        const box = $("userTabsNew");
        if (box) { box.innerHTML = tabsBoxHTML("permNew", BWF_DEFAULT_TABS); userRoleChanged(); }
        sel.innerHTML = '<option value="">— সদস্য তালিকা থেকে বাছুন (ঐচ্ছিক) —</option>' +
            list.map((m, i) => '<option value="' + i + '">' + esc(m.name) + (m.phone ? " (" + esc(m.phone) + ")" : "") + "</option>").join("");
    }
    window.userPickMember = function () {
        const i = $("userMemberPick").value;
        if (i === "") return;
        const m = members[Number(i)];
        if (!m) return;
        $("userName").value = m.name || "";
        $("userPhone").value = m.phone || "";
    };

    function render() {
        const tb = $("userTable");
        if (!tb) return;
        const me = BWF.user ? BWF.user.uid : null;
        if (!usersCache.length) { tb.innerHTML = '<tr><td colspan="5" class="empty-state-msg">কোনো ইউজার নেই</td></tr>'; return; }
        tb.innerHTML = usersCache.map(u => {
            const self = u.id === me;
            return "<tr>" +
                '<td data-label="নাম">' + esc(u.name) + (self ? " (আপনি)" : "") + "</td>" +
                '<td data-label="মোবাইল">' + esc(u.phone) + "</td>" +
                '<td data-label="রোল">' + (u.role === "admin" ? "অ্যাডমিন"
                    : "ভিউয়ার (" + (Array.isArray(u.allowedTabs) ? u.allowedTabs.length : BWF_DEFAULT_TABS.length).toLocaleString("bn-BD") + "টি ট্যাব)") + "</td>" +
                '<td data-label="অবস্থা">' + (u.active ? "✅ চালু" : "⛔ বন্ধ") + "</td>" +
                '<td data-label="কার্যক্রম">' + (self ? "—" :
                    (u.role === "viewer" ? '<button class="view-btn" onclick="userEditPerms(\'' + u.id + '\')">👁️ কী দেখবে</button>' : "") +
                    '<button class="edit-btn" onclick="userToggleRole(\'' + u.id + '\')">রোল বদলান</button>' +
                    '<button class="' + (u.active ? "delete-btn" : "view-btn") + '" onclick="userToggleActive(\'' + u.id + '\')">' +
                    (u.active ? "বন্ধ করুন" : "চালু করুন") + "</button>") + "</td></tr>";
        }).join("");
    }

    function start() {
        if (BWF.user.role !== "admin") return;
        fillMemberPicker();
        if (unsub) unsub();
        unsub = BWF.db.collection("users").orderBy("name").onSnapshot(snap => {
            usersCache = snap.docs.map(d => Object.assign({ id: d.id }, d.data()));
            render();
        }, err => console.error(err));
    }
    function stop() { if (unsub) { unsub(); unsub = null; } usersCache = []; }

    window.userToggleRole = async function (id) {
        const u = usersCache.find(x => x.id === id); if (!u) return;
        const next = u.role === "admin" ? "viewer" : "admin";
        if (!confirm(u.name + " কে " + (next === "admin" ? "অ্যাডমিন" : "ভিউয়ার") + " বানাবেন?")) return;
        try {
            const upd = { role: next };
            if (next === "viewer" && !Array.isArray(u.allowedTabs)) upd.allowedTabs = BWF_DEFAULT_TABS.slice();
            await BWF.db.collection("users").doc(id).update(upd);
            if (typeof logActivity === "function") logActivity("ইউজার রোল", u.name + " → " + next);
        } catch (e) { alert("রোল বদলানো যায়নি।"); }
    };
    window.userToggleActive = async function (id) {
        const u = usersCache.find(x => x.id === id); if (!u) return;
        if (!confirm(u.name + " এর অ্যাকাউন্ট " + (u.active ? "বন্ধ" : "চালু") + " করবেন?")) return;
        try {
            await BWF.db.collection("users").doc(id).update({ active: !u.active });
            if (typeof logActivity === "function") logActivity("ইউজার অবস্থা", u.name + (u.active ? " বন্ধ" : " চালু"));
        } catch (e) { alert("অবস্থা বদলানো যায়নি।"); }
    };

    window.userCreate = async function () {
        const name = $("userName").value.trim();
        const phone = normalizePhone($("userPhone").value);
        const pw = $("userPassword").value;
        const role = $("userRole").value === "admin" ? "admin" : "viewer";
        if (!name) { alert("নাম দিন।"); return; }
        if (!validPhone(phone)) { alert("সঠিক মোবাইল নম্বর দিন (যেমন 01712345678)।"); return; }
        if (pw.length < 6) { alert("পাসওয়ার্ড কমপক্ষে ৬ অক্ষরের হতে হবে।"); return; }

        const btn = $("userCreateBtn"); btn.disabled = true;
        // একই নম্বরের আগের প্রোফাইল থাকলে (পাসওয়ার্ড রিসেটের ক্ষেত্রে) নিশ্চিত করে পুরনোটা সরানো হবে
        const old = usersCache.find(u => u.phone === phone);
        if (old && !confirm("এই নম্বরে আগে থেকেই একটি প্রোফাইল (" + old.name + ") আছে। নতুন করে বানালে পুরনোটা সরে যাবে। চালিয়ে যাবেন?")) { btn.disabled = false; return; }

        // অ্যাডমিনের নিজের সেশন ঠিক রাখতে আলাদা (secondary) Firebase অ্যাপ দিয়ে অ্যাকাউন্ট খোলা হচ্ছে
        let sec = null;
        try {
            sec = firebase.initializeApp(FIREBASE_CONFIG, "secondary-" + Date.now());
            const cred = await sec.auth().createUserWithEmailAndPassword(phoneToEmail(phone), pw);
            await sec.auth().signOut();
            if (old) await BWF.db.collection("users").doc(old.id).delete();
            const profile = {
                name: name, phone: phone, role: role, active: true,
                createdAt: firebase.firestore.FieldValue.serverTimestamp()
            };
            if (role === "viewer") profile.allowedTabs = pickedTabs("permNew");
            await BWF.db.collection("users").doc(cred.user.uid).set(profile);
            if (typeof logActivity === "function") logActivity("ইউজার তৈরি", name + " (" + phone + ")");
            ["userName", "userPhone", "userPassword"].forEach(id => $(id).value = "");
            $("userMemberPick").value = "";
            userRoleChanged();
            alert("✅ " + name + " এর লগইন তৈরি হয়েছে। মোবাইল নম্বর ও এই পাসওয়ার্ড তাকে জানিয়ে দিন।");
        } catch (e) {
            console.error(e);
            alert(e.code === "auth/email-already-in-use"
                ? "এই নম্বরের লগইন অ্যাকাউন্ট আগে থেকেই আছে। পাসওয়ার্ড রিসেট করতে চাইলে Firebase Console → Authentication → Users থেকে অ্যাকাউন্টটি ডিলিট করে আবার তৈরি করুন।"
                : e.code === "auth/weak-password" ? "পাসওয়ার্ড দুর্বল, আরও শক্ত দিন।"
                : "অ্যাকাউন্ট তৈরি করা যায়নি (" + (e.code || "error") + ")");
        } finally {
            if (sec) sec.delete().catch(() => {});
            btn.disabled = false;
        }
    };

    document.addEventListener("bwf-authready", start);
    document.addEventListener("bwf-authout", stop);
})();
