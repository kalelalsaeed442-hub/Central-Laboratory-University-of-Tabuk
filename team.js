
(async () => {
  "use strict";

  // =========================================================
  // CENTRAL LAB — TEAM REAL-TIME SYNC
  // Firebase Firestore / dashboard / team
  // =========================================================

  const FIREBASE_VERSION = "12.6.0";

  const [
    { initializeApp, getApps, getApp },
    {
      getFirestore, doc, getDocFromServer,
      onSnapshot, setDoc, runTransaction,
      serverTimestamp
    },
    { getAuth, onAuthStateChanged }
  ] = await Promise.all([
    import(`https://www.gstatic.com/firebasejs/${FIREBASE_VERSION}/firebase-app.js`),
    import(`https://www.gstatic.com/firebasejs/${FIREBASE_VERSION}/firebase-firestore.js`),
    import(`https://www.gstatic.com/firebasejs/${FIREBASE_VERSION}/firebase-auth.js`)
  ]);

  // ضع إعدادات تطبيق Firebase الموجودة في مشروعك.
  // لا تستخدم مشروعًا جديدًا.
  const firebaseConfig = {
    apiKey: "YOUR_API_KEY",
    authDomain: "centrallabuniversity-of-tabuk.firebaseapp.com",
    projectId: "centrallabuniversity-of-tabuk",
    storageBucket: "YOUR_STORAGE_BUCKET",
    messagingSenderId: "YOUR_SENDER_ID",
    appId: "YOUR_APP_ID"
  };

  if (firebaseConfig.apiKey === "YOUR_API_KEY") {
    console.error("أكمل إعدادات firebaseConfig أولاً");
    return;
  }

  const app = getApps().length ? getApp() :
    initializeApp(firebaseConfig);

  if (app.options.projectId !== firebaseConfig.projectId) {
    console.error("الموقع متصل بمشروع Firebase مختلف");
    return;
  }

  const db = getFirestore(app);
  const auth = getAuth(app);
  const teamRef = doc(db, "dashboard", "team");

  const initial = [
    ["د. عائشة نواف البلوي", "كلية العلوم / الكيمياء"],
    ["د. منال أحمد قريش", "كلية العلوم / الكيمياء الحيوية"],
    ["د. الحسين عجيم", "كلية العلوم الطبية التطبيقية"],
    ["د. مصطفى زبيدي كعبي", "كلية العلوم / الأحياء"],
    ["د. خليل يحيى السعيد", "كلية العلوم / قسم الفيزياء"],
    ["د. نور القرشي", "وحدة الجينوم"],
    ["د. رامي العسيري", "كلية العلوم / الكيمياء الحيوية"],
    ["د. رجى عبدالله الغديري", "كلية العلوم"],
    ["د. ماجدة راجي العتيبي", "كلية العلوم / الكيمياء"],
    ["أ. هبة محمد العطوي", "فنية مختبر / كلية العلوم"],
    ["Dr. Uzma Faridi", "كلية العلوم / الكيمياء الحيوية"],
    ["د. عبدالرحمن العطوي", "باحث ما بعد الدكتوراه / وحدة الجينوم"],
    ["د. نادر محمد الضويمر", "كلية العلوم / الكيمياء الحيوية"],
    ["أ.د. هالة بيومي", "كلية العلوم / علوم الغذاء"],
    ["أ. محمد محمود البلوي", "كلية العلوم / الفيزياء"],
    ["أ. فهد محمد الخثعمي", "المركز الطبي"],
    ["د. فاطمة العتيبي", "كلية العلوم / قسم الكيمياء"],
    ["أ. أحمد العطوي", "كلية العلوم / باحث أكاديمي"]
  ].map((x, i) => ({
    id: i + 1,
    name: x[0],
    affiliation: x[1],
    specialty: "",
    group: ""
  }));

  const $ = id => document.getElementById(id);

  const esc = s => String(s ?? "").replace(
    /[&<>"']/g,
    c => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;"
    })[c]
  );

  const normalize = arr => arr.map((m, i) => ({
    id: Number(m.id) || i + 1,
    name: String(m.name || ""),
    affiliation: String(m.affiliation || ""),
    specialty: String(m.specialty || ""),
    group: String(m.group || "")
  })).filter(m => m.name.trim());

  let members = [];
  let editId = null;
  let ready = false;
  let saving = false;
  let currentUser = null;
  let unsubscribe = null;

  // لا تستخدم localStorage بوصفه مصدر البيانات.
  // القائمة الافتراضية لا تُحفظ تلقائيًا في Firebase.

  const modal = $("teamModal");
  const form = $("teamForm");

  if (!modal || !form) {
    console.error("عناصر واجهة فريق العمل غير موجودة");
    return;
  }

  function notify(message, error = false) {
    console[error ? "error" : "info"](message);

    let el = $("teamSyncStatus");
    if (!el) {
      el = document.createElement("div");
      el.id = "teamSyncStatus";
      el.setAttribute("role", "status");
      el.style.cssText = `
        position:fixed;
        bottom:20px;
        left:20px;
        z-index:99999;
        padding:12px 18px;
        border-radius:12px;
        background:#12364d;
        color:white;
        font:14px Arial;
        box-shadow:0 5px 20px #0003;
      `;
      document.body.appendChild(el);
    }

    el.textContent = message;
    el.style.background = error ? "#9b2424" : "#12364d";
  }

  function requireReady() {
    if (!ready) {
      notify("انتظر تحميل بيانات Firebase", true);
      return false;
    }
    return true;
  }

  function requireEditor() {
    if (!requireReady()) return false;

    if (!currentUser) {
      notify("يجب تسجيل الدخول للتعديل", true);
      return false;
    }

    // صلاحية الكتابة النهائية تتحكم بها Firestore Rules.
    return true;
  }

  function uniq(key) {
    return [...new Set(
      members.map(m => m[key].trim()).filter(Boolean)
    )].sort((a, b) => a.localeCompare(b, "ar"));
  }

  function initials(name) {
    const parts = name.replace(
      /^(د\.|أ\.د\.|أ\.|Dr\.)\s*/i, ""
    ).trim().split(/\s+/);

    return parts.length > 1
      ? parts[0][0] + parts[1][0]
      : parts[0]?.slice(0, 2) || "؟";
  }

  function render() {
    const search = $("teamSearch")?.value.trim().toLowerCase() || "";
    const group = $("teamGroupFilter")?.value || "";
    const spec = $("teamSpecialtyFilter")?.value || "";

    const groups = uniq("group");
    const specs = uniq("specialty");

    function updateSelect(id, values, title, selected) {
      const el = $(id);
      if (!el) return;

      el.innerHTML =
        `<option value="">${title}</option>` +
        values.map(x =>
          `<option value="${esc(x)}">${esc(x)}</option>`
        ).join("");

      el.value = values.includes(selected) ? selected : "";
    }

    updateSelect(
      "teamGroupFilter", groups, "كل المجموعات", group
    );

    updateSelect(
      "teamSpecialtyFilter", specs, "كل التخصصات", spec
    );

    $("teamGroupSuggestions").innerHTML =
      groups.map(x =>
        `<option value="${esc(x)}"></option>`
      ).join("");

    $("teamSpecialtySuggestions").innerHTML =
      specs.map(x =>
        `<option value="${esc(x)}"></option>`
      ).join("");

    let shown = members.filter(m =>
      (!group || m.group === group) &&
      (!spec || m.specialty === spec) &&
      [
        m.name, m.affiliation, m.specialty, m.group
      ].some(v => v.toLowerCase().includes(search))
    );

    const sort = $("teamSort")?.value;

    if (sort === "name") {
      shown.sort((a, b) => a.name.localeCompare(b.name, "ar"));
    }

    if (sort === "group") {
      shown.sort((a, b) => a.group.localeCompare(b.group, "ar"));
    }

    $("teamCount").textContent = members.length;
    $("teamHeaderCount").textContent = members.length;
    $("teamShown").textContent = shown.length;
    $("teamGroupsCount").textContent = groups.length;
    $("teamSpecialtiesCount").textContent = specs.length;

    $("teamCards").innerHTML = shown.map(m => {
      const icon = window.teamSpecialtyIcon?.(m);

      return `
        <article class="team-card">
          <div class="team-avatar team-avatar--${esc(icon?.key || "general")}"
               title="${esc(m.specialty || m.affiliation)}"
               aria-hidden="true">
            ${icon?.html || esc(initials(m.name))}
          </div>

          <div class="team-info">
            <div class="team-person-line">
              <strong>${esc(m.name)}</strong>
              <span class="team-number">
                ${String(members.indexOf(m) + 1).padStart(2, "0")}
              </span>
            </div>

            <small>${esc(m.affiliation) || "الجهة غير محددة"}</small>

            <div class="team-tags">
              <span class="team-tag ${m.specialty ? "" : "team-unset"}">
                ◈ ${esc(m.specialty) || "إضافة التخصص"}
              </span>

              <span class="team-tag gold ${m.group ? "" : "team-unset"}">
                ♧ ${esc(m.group) || "إضافة مجموعة العمل"}
              </span>
            </div>
          </div>

          <div class="team-actions">
            <button type="button" data-edit="${m.id}">
              ✎ تعديل
            </button>
            <button type="button" class="team-delete"
                    data-delete="${m.id}">
              حذف
            </button>
          </div>
        </article>
      `;
    }).join("") || `
      <div class="team-empty">
        <strong>لا توجد نتائج مطابقة</strong>
        <p>جرّب تغيير كلمات البحث أو عوامل التصفية.</p>
      </div>
    `;
  }

  function open() {
    modal.classList.remove("hidden");
    document.body.classList.add("team-modal-open");
    $("teamNavBtn").setAttribute("aria-expanded", "true");
    render();
  }

  function close() {
    modal.classList.add("hidden");
    document.body.classList.remove("team-modal-open");
    $("teamNavBtn").setAttribute("aria-expanded", "false");
    form.classList.add("hidden");
  }

  function startEdit(id) {
    if (!requireEditor()) return;

    editId = id;
    const m = members.find(x => x.id === id);

    $("teamFormTitle").textContent =
      m ? "تعديل بيانات العضو" : "إضافة عضو جديد";

    $("teamName").value = m?.name || "";
    $("teamAffiliation").value = m?.affiliation || "";
    $("teamSpecialty").value = m?.specialty || "";
    $("teamGroup").value = m?.group || "";

    form.classList.remove("hidden");
    form.scrollIntoView({
      behavior: "smooth",
      block: "nearest"
    });
    $("teamName").focus();
  }

  // =========================================================
  // FIREBASE REAL-TIME LISTENER
  // =========================================================

  function startRealtimeSync() {
    if (unsubscribe) unsubscribe();

    notify("جارٍ الاتصال ببيانات فريق العمل...");

    unsubscribe = onSnapshot(
      teamRef,
      { includeMetadataChanges: true },
      snapshot => {
        if (snapshot.metadata.fromCache) {
          notify("البيانات من الذاكرة المؤقتة؛ جارٍ انتظار الخادم");
          return;
        }

        const data = snapshot.data();

        if (!snapshot.exists()) {
          ready = true;
          members = [];
          render();
          notify("مستند الفريق غير موجود؛ لم يتم إنشاء بيانات تلقائيًا");
          return;
        }

        if (!Array.isArray(data.members)) {
          ready = false;
          notify(
            "مستند team موجود لكن حقل members غير صحيح",
            true
          );
          return;
        }

        members = normalize(data.members);
        ready = true;
        render();

        notify(
          snapshot.metadata.hasPendingWrites
            ? "جارٍ إرسال التغييرات..."
            : "تمت مزامنة فريق العمل مع Firebase"
        );
      },
      error => {
        ready = false;
        notify(
          `فشل استقبال البيانات: ${error.code || error.message}`,
          true
        );
      }
    );
  }

  // =========================================================
  // FIREBASE SAVE WITH TRANSACTION
  // =========================================================

  async function saveChange(change) {
    if (!requireEditor() || saving) return false;

    saving = true;

    try {
      await runTransaction(db, async transaction => {
        const snapshot = await transaction.get(teamRef);

        if (!snapshot.exists()) {
          throw Error(
            "مستند الفريق غير موجود. يجب تهيئته أولاً."
          );
        }

        const data = snapshot.data();

        if (!Array.isArray(data.members)) {
          throw Error("صيغة بيانات الفريق غير صحيحة");
        }

        const latest = normalize(data.members);
        const updated = change(latest);

        if (!Array.isArray(updated)) {
          throw Error("عملية تعديل غير صحيحة");
        }

        transaction.update(teamRef, {
          members: normalize(updated),
          updatedAt: serverTimestamp(),
          updatedBy: currentUser.uid,
          updatedByEmail: currentUser.email || ""
        });
      });

      notify("تم حفظ التعديل ومزامنته بنجاح");
      return true;

    } catch (error) {
      console.error("Firebase save error:", error);
      notify(
        `فشل الحفظ: ${error.code || error.message}`,
        true
      );
      return false;

    } finally {
      saving = false;
    }
  }

  // =========================================================
  // EVENTS
  // =========================================================

  $("teamNavBtn").addEventListener("click", open);
  $("teamClose").addEventListener("click", close);

  modal.addEventListener("click", e => {
    if (e.target === modal) close();
  });

  document.addEventListener("keydown", e => {
    if (
      e.key === "Escape" &&
      !modal.classList.contains("hidden")
    ) close();
  });

  $("teamAdd").addEventListener("click", () => startEdit(null));

  for (const id of ["teamCancel", "teamCancelBottom"]) {
    $(id).addEventListener("click", () => {
      form.classList.add("hidden");
    });
  }

  for (const id of [
    "teamSearch",
    "teamGroupFilter",
    "teamSpecialtyFilter",
    "teamSort"
  ]) {
    $(id).addEventListener(
      id === "teamSearch" ? "input" : "change",
      render
    );
  }

  form.addEventListener("submit", async e => {
    e.preventDefault();

    const values = {
      name: $("teamName").value.trim(),
      affiliation: $("teamAffiliation").value.trim(),
      specialty: $("teamSpecialty").value.trim(),
      group: $("teamGroup").value.trim()
    };

    if (!values.name) return;

    const targetId = editId;

    const success = await saveChange(latest => {
      if (targetId !== null) {
        const member = latest.find(x => x.id === targetId);

        if (!member) {
          throw Error("العضو لم يعد موجودًا في قاعدة البيانات");
        }

        Object.assign(member, values);
      } else {
        latest.push({
          id: Math.max(0, ...latest.map(x => x.id)) + 1,
          ...values
        });
      }

      return latest;
    });

    if (success) {
      form.classList.add("hidden");
    }
  });

  $("teamCards").addEventListener("click", async e => {
    const edit = e.target.closest("[data-edit]");
    const del = e.target.closest("[data-delete]");

    if (edit) {
      startEdit(Number(edit.dataset.edit));
      return;
    }

    if (del && requireEditor()) {
      const id = Number(del.dataset.delete);

      if (!confirm("هل تريد حذف هذا العضو من فريق العمل؟")) {
        return;
      }

      await saveChange(latest =>
        latest.filter(m => m.id !== id)
      );
    }
  });

  $("teamExport").addEventListener("click", () => {
    if (!requireReady()) return;

    const blob = new Blob(
      [JSON.stringify(members, null, 2)],
      { type: "application/json;charset=utf-8" }
    );

    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");

    a.href = url;
    a.download = "central-lab-team.json";
    a.click();

    setTimeout(() => URL.revokeObjectURL(url), 1000);
  });

  $("teamImport").addEventListener("change", async e => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      if (!requireEditor()) return;

      const arr = JSON.parse(await file.text());

      if (
        !Array.isArray(arr) ||
        !arr.every(x => x && typeof x.name === "string")
      ) {
        throw Error("ملف JSON غير صحيح");
      }

      if (!confirm(
        "سيتم استبدال بيانات الفريق في Firebase لجميع المستخدمين. هل أنت متأكد؟"
      )) return;

      const imported = normalize(arr);

      await saveChange(() => imported);

    } catch (error) {
      notify(`تعذر الاستيراد: ${error.message}`, true);

    } finally {
      e.target.value = "";
    }
  });

  // =========================================================
  // FIRST-TIME INITIALIZATION — MANUAL ONLY
  // =========================================================

  // لا تستدعِ هذه الدالة تلقائيًا.
  // استخدامها فقط عندما لا يوجد مستند team،
  // وبعد التأكد من عدم وجود بيانات محفوظة سابقًا.

  window.centralLabInitializeTeam = async function () {
    if (!currentUser) {
      throw Error("يجب تسجيل الدخول");
    }

    const existing = await getDocFromServer(teamRef);

    if (existing.exists()) {
      throw Error("مستند team موجود بالفعل؛ لن تتم الكتابة فوقه");
    }

    if (!confirm(
      "إنشاء قائمة الفريق الافتراضية في Firebase لأول مرة؟"
    )) return;

    // الإنشاء مشروط بعدم وجود المستند لحظة المعاملة.
    await runTransaction(db, async transaction => {
      const check = await transaction.get(teamRef);

      if (check.exists()) {
        throw Error("تم إنشاء المستند من جهاز آخر");
      }

      transaction.set(teamRef, {
        members: initial,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        updatedBy: currentUser.uid
      });
    });
  };

  // =========================================================
  // AUTHENTICATION + STARTUP
  // =========================================================

  onAuthStateChanged(auth, user => {
    currentUser = user;
    console.info(
      "Firebase auth:",
      user ? user.email : "Guest"
    );
  });

  startRealtimeSync();

  window.addEventListener("pagehide", () => {
    if (unsubscribe) unsubscribe();
  });

})();
