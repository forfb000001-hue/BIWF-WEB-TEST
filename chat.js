// ==========================
// গ্রুপ চ্যাট (Firebase Firestore, রিয়েল-টাইম)
// লগইন করা সদস্যের নাম ও রোল auth.js থেকে আসে।
// ==========================
(function () {
    const PAGE = 50;          // এক সাথে কয়টি মেসেজ দেখানো হবে (আরও পুরনো দেখতে বাটন আছে)
    const MAX_LEN = 1000;

    let unsub = null, limitN = PAGE;
    let started = false, chatActive = false, lastDocs = [];
    let lastSeen = Number(localStorage.getItem("chatLastSeen") || 0);

    const $ = id => document.getElementById(id);
    const me = () => BWF.user;
    const isAdmin = () => me() && me().role === "admin";
    const bn = n => Number(n).toLocaleString("bn-BD");

    function dayLabel(d) { return d.toLocaleDateString("bn-BD", { day: "numeric", month: "long", year: "numeric" }); }
    function timeLabel(d) { return d.toLocaleTimeString("bn-BD", { hour: "numeric", minute: "2-digit" }); }
    function msgDate(doc) {
        const t = doc.data().createdAt;
        return t ? t.toDate() : new Date(); // সার্ভার টাইম আসার আগে লোকাল সময়
    }

    function showSetup(html) { $("chatRoot").innerHTML = '<div class="chat-setup">' + html + "</div>"; }

    function buildChat() {
        $("chatRoot").innerHTML =
            '<div class="chat-wrap">' +
              '<div class="chat-head"><span>💬 সবার গ্রুপ চ্যাট <small id="chatWho"></small></span></div>' +
              '<div class="chat-messages" id="chatMessages"></div>' +
              '<div class="chat-form">' +
                '<textarea id="chatInput" rows="1" maxlength="' + MAX_LEN + '" placeholder="মেসেজ লিখুন..."></textarea>' +
                '<button id="chatSend" onclick="chatSend()">পাঠান</button>' +
              "</div>" +
            "</div>";
        $("chatWho").textContent = "— " + me().name;
        const input = $("chatInput");
        input.addEventListener("keydown", e => {
            // Enter = পাঠান, Shift+Enter = নতুন লাইন
            if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); window.chatSend(); }
        });
        input.addEventListener("input", () => {
            input.style.height = "auto";
            input.style.height = Math.min(input.scrollHeight, 110) + "px";
        });
        subscribe();
    }

    function subscribe() {
        if (unsub) unsub();
        unsub = BWF.db.collection("chatMessages")
            .orderBy("createdAt", "desc").limit(limitN)
            .onSnapshot({ includeMetadataChanges: true }, snap => {
                lastDocs = snap.docs.slice().reverse();
                renderMessages(snap.size >= limitN);
                updateBadge();
            }, err => {
                console.error(err);
                showSetup("<h3>⚠️ চ্যাট লোড হয়নি</h3><p>ইন্টারনেট বা Firestore Rules চেক করুন। (বিস্তারিত: FIREBASE-SETUP.md)</p>");
            });
    }

    function renderMessages(hasMore) {
        const box = $("chatMessages");
        if (!box) return;
        const nearBottom = box.scrollHeight - box.scrollTop - box.clientHeight < 120;
        const prevHeight = box.scrollHeight, prevTop = box.scrollTop;
        box.innerHTML = "";

        if (hasMore) {
            const b = document.createElement("button");
            b.className = "chat-more"; b.textContent = "⬆️ আরও পুরনো মেসেজ দেখুন";
            b.onclick = () => { limitN += PAGE; box.dataset.keepPos = "1"; subscribe(); };
            box.appendChild(b);
        }
        if (!lastDocs.length) {
            const e = document.createElement("div");
            e.className = "chat-empty"; e.textContent = "এখনো কোনো মেসেজ নেই। প্রথম মেসেজটি আপনিই পাঠান!";
            box.appendChild(e);
        }

        let lastDay = "";
        lastDocs.forEach(doc => {
            const d = doc.data(), when = msgDate(doc), day = dayLabel(when);
            if (day !== lastDay) {
                const s = document.createElement("div");
                s.className = "chat-day"; s.textContent = day; box.appendChild(s);
                lastDay = day;
            }
            const mine = d.uid === me().uid;
            const el = document.createElement("div");
            el.className = "chat-msg" + (mine ? " mine" : "") + (doc.metadata.hasPendingWrites ? " pending" : "");

            const name = document.createElement("div");
            name.className = "chat-name";
            name.textContent = mine ? "আপনি" : (d.name || "অজানা");
            if (d.role === "admin") {
                const r = document.createElement("span"); r.className = "chat-role"; r.textContent = "অ্যাডমিন";
                name.appendChild(r);
            }
            const text = document.createElement("div");
            text.className = "chat-text"; text.textContent = d.text || "";
            const meta = document.createElement("div");
            meta.className = "chat-meta";
            const t = document.createElement("span"); t.textContent = timeLabel(when); meta.appendChild(t);
            if (mine || isAdmin()) {
                const del = document.createElement("button");
                del.className = "chat-del"; del.textContent = "মুছুন";
                del.onclick = () => { if (confirm("এই মেসেজটি মুছে ফেলবেন?")) doc.ref.delete().catch(() => alert("মেসেজ মোছা যায়নি")); };
                meta.appendChild(del);
            }
            el.append(name, text, meta);
            box.appendChild(el);
        });

        if (box.dataset.keepPos) {            // পুরনো মেসেজ লোডের পর স্ক্রল জায়গায় রাখা
            delete box.dataset.keepPos;
            box.scrollTop = prevTop + (box.scrollHeight - prevHeight);
        } else if (nearBottom || !prevHeight || (lastDocs.length && lastDocs[lastDocs.length - 1].data().uid === me().uid)) {
            box.scrollTop = box.scrollHeight;
        }
    }

    window.chatSend = async function () {
        const input = $("chatInput"), btn = $("chatSend");
        const text = input.value.trim();
        if (!text || !BWF.user) return;
        btn.disabled = true;
        try {
            await BWF.db.collection("chatMessages").add({
                text: text.slice(0, MAX_LEN),
                name: me().name,
                role: me().role,
                uid: me().uid,
                createdAt: firebase.firestore.FieldValue.serverTimestamp()
            });
            input.value = ""; input.style.height = "auto";
        } catch (e) {
            console.error(e);
            alert("মেসেজ পাঠানো যায়নি। ইন্টারনেট বা Firestore Rules চেক করুন।");
        }
        btn.disabled = false; input.focus();
    };

    // ---------- নতুন মেসেজের ব্যাজ ----------
    function updateBadge() {
        const badge = $("chatBadge");
        if (!badge || !me()) return;
        if (chatActive) {
            lastSeen = Date.now(); localStorage.setItem("chatLastSeen", String(lastSeen));
            badge.classList.remove("on"); return;
        }
        const n = lastDocs.filter(d => d.data().uid !== me().uid && msgDate(d).getTime() > lastSeen).length;
        badge.textContent = n > 99 ? "৯৯+" : bn(n);
        badge.classList.toggle("on", n > 0);
    }

    function start() {
        if (started) return;
        started = true;
        if (!localStorage.getItem("chatLastSeen")) { lastSeen = Date.now(); localStorage.setItem("chatLastSeen", String(lastSeen)); }
        buildChat();
    }

    function stop() {
        if (unsub) { unsub(); unsub = null; }
        started = false; lastDocs = []; limitN = PAGE; chatActive = false;
        const root = $("chatRoot"); if (root) root.innerHTML = "";
        const b = $("chatBadge"); if (b) b.classList.remove("on");
    }

    // showSection কে মুড়ে নেওয়া (আগের কোড অপরিবর্তিত থাকে)
    const origShow = window.showSection;
    window.showSection = function (id, btn) {
        origShow(id, btn);
        chatActive = (id === "chatSection");
        if (chatActive) {
            updateBadge();
            const box = $("chatMessages"); if (box) box.scrollTop = box.scrollHeight;
        }
    };

    document.addEventListener("bwf-authready", start);
    document.addEventListener("bwf-authout", stop);
})();
