// ==========================
// "আমার অনুদান": লগইন করা সদস্য শুধু নিজের অনুদানের হিস্ট্রি দেখবে।
// লগইনের মোবাইল নম্বর যে সদস্যের মোবাইল নম্বরের সাথে মেলে, তার অনুদানই দেখানো হয়।
// ==========================
(function () {
    const $ = id => document.getElementById(id);
    let year = "all";

    function esc(s) { const d = document.createElement("div"); d.textContent = s == null ? "" : String(s); return d.innerHTML; }
    const bn = n => Number(n).toLocaleString("bn-BD");

    function myMembers() {
        const ph = BWF.user && BWF.user.phone;
        if (!ph || typeof members === "undefined") return [];
        return members.filter(m => normalizePhone(m.phone) === ph);
    }

    function monthLabel(m) {
        return /^\d{4}-\d{2}$/.test(m || "") && typeof monthTitleFromValue === "function" ? monthTitleFromValue(m) : (m || "-");
    }

    window.myDonSetYear = function (v) { year = v; myDonRender(); };

    window.myDonRender = function () {
        const root = $("myDonRoot");
        if (!root || !BWF.user) return;

        const ms = myMembers();
        if (!ms.length) {
            root.innerHTML = '<div class="my-don-msg">আপনার মোবাইল নম্বরের সাথে মেলে এমন কোনো সদস্য পাওয়া যায়নি।<br>অ্যাডমিনকে বলুন সদস্য তালিকায় আপনার মোবাইল নম্বরটি ঠিকমতো দিতে।</div>';
            return;
        }

        const ids = ms.map(m => String(m.id));
        const all = (typeof donations === "undefined" ? [] : donations).filter(d => ids.includes(String(d.memberId)));
        const years = Array.from(new Set(all.map(d => (d.month || "").split("-")[0]).filter(Boolean))).sort().reverse();
        if (year !== "all" && !years.includes(year)) year = "all";

        const shown = (year === "all" ? all : all.filter(d => (d.month || "").split("-")[0] === year))
            .slice().sort((a, b) => String(b.month || "").localeCompare(String(a.month || "")));
        const total = shown.reduce((s, d) => s + Number(d.amount || 0), 0);
        const grand = all.reduce((s, d) => s + Number(d.amount || 0), 0);

        const rows = shown.length ? shown.map(d =>
            "<tr>" +
            '<td data-label="ধরন">' + (d.type === "Monthly" ? "মাসিক" : "বাৎসরিক") + "</td>" +
            '<td data-label="মাস">' + esc(monthLabel(d.month)) + "</td>" +
            '<td data-label="টাকা">' + taka(d.amount) + "</td></tr>"
        ).join("") : '<tr class="empty-state-row"><td colspan="3" class="empty-state-msg">কোনো অনুদান পাওয়া যায়নি</td></tr>';

        root.innerHTML =
            '<div class="my-don-head">👤 ' + esc(ms[0].name) + ' <small>📞 ' + esc(BWF.user.phone) + "</small></div>" +
            '<div class="cards">' +
              '<div class="card income"><h3>' + (year === "all" ? "মোট অনুদান" : year + " সালের অনুদান") + "</h3><h2>" + taka(total) + "</h2></div>" +
              '<div class="card balance"><h3>সর্বমোট (সব বছর)</h3><h2>' + taka(grand) + "</h2></div>" +
            "</div>" +
            '<div class="my-don-tools">' +
              '<select onchange="myDonSetYear(this.value)">' +
                '<option value="all">সব বছর</option>' +
                years.map(y => '<option value="' + y + '"' + (y === year ? " selected" : "") + ">" + y + "</option>").join("") +
              "</select>" +
              (ms.length === 1 && typeof printMemberYearlySummary === "function"
                ? '<button class="view-btn" onclick="printMemberYearlySummary(' + JSON.stringify(ms[0].id) + ')">📅 বাৎসরিক সামারি প্রিন্ট</button>' : "") +
              "<span>মোট এন্ট্রি: " + bn(shown.length) + "টি</span>" +
            "</div>" +
            '<table class="mobile-cards"><thead><tr><th>ধরন</th><th>মাস</th><th>টাকা</th></tr></thead><tbody>' + rows + "</tbody></table>";
    };

    // ট্যাব খুললে এবং ডাটা বদলালে নতুন করে আঁকা
    const origShow = window.showSection;
    window.showSection = function (id, btn) {
        origShow(id, btn);
        if (id === "myDonationSection") myDonRender();
    };
    const origRD = window.renderDonations;
    if (typeof origRD === "function") {
        window.renderDonations = function () {
            const r = origRD.apply(this, arguments);
            if (BWF.user) myDonRender();
            return r;
        };
    }

    document.addEventListener("bwf-authready", () => { year = "all"; myDonRender(); });
    document.addEventListener("bwf-authout", () => { const r = $("myDonRoot"); if (r) r.innerHTML = ""; });
})();
