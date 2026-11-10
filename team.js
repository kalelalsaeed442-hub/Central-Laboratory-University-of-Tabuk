
(() => {
  "use strict";

  // CENTRAL LAB — TEAM MANAGEMENT
  // Public viewing + Admin editing + Real-time sync

  const STORAGE_KEY = "centralLabTeamMembersV1";

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

  const escapeHTML = value =>
    String(value ?? "").replace(/[&<>"']/g, char => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;"
    })[char]);

  const normalize = arr => arr
    .filter(m => m && typeof m.name === "string")
    .map((m, i) => ({
      id: Number(m.id) || i + 1,
      name: m.name,
      affiliation: String(m.affiliation || ""),
      specialty: String(m.specialty || ""),
      group: String(m.group || "")
    }));

  let members = [];
  let editId = null;
  let isAdmin = false;
  let loadedFromServer = false;
  let saving = false;
  let unsubscribe = null;

  const modal = $("teamModal");
  const form = $("teamForm");

  if (!modal || !form) {
    console.error("Team UI elements not found");
    return;
  }

  // ---------------------------------------------------------
  // STATUS
  // ---------------------------------------------------------

  function status(message, isError = false) {
    console[isError ? "error" : "info"](
      "[Team Sync]", message
    );

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
        background:#153c55;
        color:#fff;
        font:14px Arial,sans-serif;
        box-shadow:0 5px 20px #0003;
        max-width:350px;
      `;

      document.body.appendChild(el);
    }

    el.textContent = message;
    el.style.background = isError
      ? "#a12626"
      : "#153c55";
  }

  // ---------------------------------------------------------
  // PERMISSIONS
  // ---------------------------------------------------------

  function checkAdmin() {
    // يجب أن تأتي هذه القيمة من نظام الإدارة الفعلي.
    // لا تستخدم localStorage لإثبات صلاحية المدير.
    return window.centralLabIsAdmin?.() === true;
  }

  function updatePermissions() {
    isAdmin = checkAdmin();

    const nav = $("teamNavBtn");

    if (nav) {
      nav.hidden = false;
      nav.disabled = false;
      nav.style.display = "";
      nav.removeAttribute("aria-disabled");
    }

    const adminIds = [
      "teamAdd",
      "teamImport"
    ];

    adminIds.forEach(id => {
      const element = $(id);
      if (element) element.hidden = !isAdmin;
    });

    const importLabel = $("teamImport")?.closest("label");
    if (importLabel) {
      importLabel.hidden = !isAdmin;
    }

    document.querySelectorAll(
      "#teamCards [data-edit], #teamCards [data-delete]"
    ).forEach(button => {
      button.hidden = !isAdmin;
    });

    if (!isAdmin) {
      form.classList.add("hidden");
    }
  }

  function requireAdmin() {
    updatePermissions();

    if (!isAdmin) {
      status("هذه العملية متاحة لمدير النظام فقط", true);
      return false;
    }

    if (!loadedFromServer) {
      status("انتظر تحميل البيانات من Firebase", true);
      return false;
    }

    if (saving) return false;

    return true;
  }

  // ---------------------------------------------------------
  // HELPERS
  // ---------------------------------------------------------

  function unique(key) {
    return [...new Set(
      members
        .map(m => m[key].trim())
        .filter(Boolean)
    )].sort((a, b) => a.localeCompare(b, "ar"));
  }

  function initials(name) {
    const parts = name
      .replace(/^(د\.|أ\.د\.|أ\.|Dr\.)\s*/i, "")
      .trim()
      .split(/\s+/);

    return parts.length > 1
      ? parts[0][0] + parts[1][0]
      : parts[0]?.slice(0, 2) || "؟";
  }

  // ---------------------------------------------------------
  // RENDER
  // ---------------------------------------------------------

  function render() {
    const search = $("teamSearch").value
      .trim()
      .toLocaleLowerCase();

    const group = $("teamGroupFilter").value;
    const specialty = $("teamSpecialtyFilter").value;

    const groups = unique("group");
    const specialties = unique("specialty");

    function fillSelect(id, title, values, previous) {
      const select = $(id);

      select.innerHTML =
        `<option value="">${title}</option>` +
        values.map(value =>
          `<option value="${escapeHTML(value)}">
            ${escapeHTML(value)}
          </option>`
        ).join("");

      select.value = values.includes(previous)
        ? previous
        : "";
    }

    fillSelect(
      "teamGroupFilter",
      "كل المجموعات",
      groups,
      group
    );

    fillSelect(
      "teamSpecialtyFilter",
      "كل التخصصات",
      specialties,
      specialty
    );

    $("teamGroupSuggestions").innerHTML =
      groups.map(value =>
        `<option value="${escapeHTML(value)}"></option>`
      ).join("");

    $("teamSpecialtySuggestions").innerHTML =
      specialties.map(value =>
        `<option value="${escapeHTML(value)}"></option>`
      ).join("");

    let shown = members.filter(m =>
      (!group || m.group === group) &&
      (!specialty || m.specialty === specialty) &&
      [
        m.name,
        m.affiliation,
        m.specialty,
        m.group
      ].some(value =>
        value.toLocaleLowerCase().includes(search)
      )
    );

    const sort = $("teamSort").value;

    if (sort === "name") {
      shown.sort((a, b) =>
        a.name.localeCompare(b.name, "ar")
      );
    }

    if (sort === "group") {
      shown.sort((a, b) =>
        a.group.localeCompare(b.group, "ar")
      );
    }

    $("teamCount").textContent = members.length;
    $("teamHeaderCount").textContent = members.length;
    $("teamShown").textContent = shown.length;
    $("teamGroupsCount").textContent = groups.length;
    $("teamSpecialtiesCount").textContent = specialties.length;

    $("teamCards").innerHTML = shown.map(m => {
      const icon = window.teamSpecialtyIcon?.(m);

      return `
        <article class="team-card">

          <div
            class="team-avatar team-avatar--${escapeHTML(icon?.key || "general")}"
            title="${escapeHTML(m.specialty || m.affiliation)}"
            aria-hidden="true"
          >
            ${icon?.html || escapeHTML(initials(m.name))}
          </div>

          <div class="team-info">

            <div class="team-person-line">
              <strong>${escapeHTML(m.name)}</strong>

              <span class="team-number">
                ${String(members.indexOf(m) + 1).padStart(2, "0")}
              </span>
            </div>

            <small>
              ${escapeHTML(m.affiliation) || "الجهة غير محددة"}
            </small>

            <div class="team-tags">

              <span class="team-tag ${m.specialty ? "" : "team-unset"}">
                ◈ ${escapeHTML(m.specialty) || "إضافة التخصص"}
              </span>

              <span class="team-tag gold ${m.group ? "" : "team-unset"}">
                ♧ ${escapeHTML(m.group) || "إضافة مجموعة العمل"}
              </span>

            </div>
          </div>

          <div class="team-actions" ${isAdmin ? "" : "hidden"}>

            <button
              type="button"
              data-edit="${m.id}"
              ${isAdmin ? "" : "hidden"}
            >
              ✎ تعديل
            </button>

            <button
              type="button"
              class="team-delete"
              data-delete="${m.id}"
              ${isAdmin ? "" : "hidden"}
            >
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

    updatePermissions();
  }

  // ---------------------------------------------------------
  // MODAL
  // ---------------------------------------------------------

  function open() {
    modal.classList.remove("hidden");
    document.body.classList.add("team-modal-open");

    $("teamNavBtn").setAttribute(
      "aria-expanded",
      "true"
    );

    render();
  }

  function close() {
    modal.classList.add("hidden");
    document.body.classList.remove("team-modal-open");

    $("teamNavBtn").setAttribute(
      "aria-expanded",
      "false"
    );

    form.classList.add("hidden");
  }

  function startEdit(id) {
    if (!requireAdmin()) return;

    editId = id;

    const member = members.find(m => m.id === id);

    $("teamFormTitle").textContent = member
      ? "تعديل بيانات العضو"
      : "إضافة عضو جديد";

    $("teamName").value = member?.name || "";
    $("teamAffiliation").value = member?.affiliation || "";
    $("teamSpecialty").value = member?.specialty || "";
    $("teamGroup").value = member?.group || "";

    form.classList.remove("hidden");

    form.scrollIntoView({
      behavior: "smooth",
      block: "nearest"
    });

    $("teamName").focus();
  }

  // ---------------------------------------------------------
  // REAL-TIME DATA
  // ---------------------------------------------------------

  function applyRemoteData(data) {
    let parsed = data;

    // dashboard/team -> value
    if (
      parsed &&
      !Array.isArray(parsed) &&
      typeof parsed === "object"
    ) {
      parsed = parsed.value ?? parsed;
    }

    if (typeof parsed === "string") {
      try {
        parsed = JSON.parse(parsed);
      } catch (error) {
        status("تعذر قراءة بيانات فريق العمل", true);
        return;
      }
    }

    if (!Array.isArray(parsed)) {
      status("صيغة بيانات الفريق غير صحيحة", true);
      return;
    }

    members = normalize(parsed);
    loadedFromServer = true;

    render();
    status("تمت مزامنة بيانات فريق العمل");
  }

  function startSync() {
    if (typeof window.centralLabSubscribe !== "function") {
      status(
        "مستمع Firebase غير متاح. يلزم ربط centralLabSubscribe.",
        true
      );
      return;
    }

    if (unsubscribe) unsubscribe();

    // يجب أن تستمع الدالة إلى dashboard/team
    // وتعمل للزوار دون اشتراط تسجيل الدخول.
    unsubscribe = window.centralLabSubscribe(
      "team",
      applyRemoteData,
      error => {
        loadedFromServer = false;
        status(
          "فشل الاتصال ببيانات Firebase: " +
          (error?.message || error),
          true
        );
      }
    );
  }

  // ---------------------------------------------------------
  // SAVE
  // ---------------------------------------------------------

  async function persist(nextMembers) {
    if (!requireAdmin()) return false;

    if (typeof window.centralLabSave !== "function") {
      status("دالة حفظ Firebase غير متاحة", true);
      return false;
    }

    saving = true;

    try {
      const normalized = normalize(nextMembers);

      // يجب أن تحفظ centralLabSave القيمة في:
      // dashboard/team -> value
      await window.centralLabSave(
        STORAGE_KEY,
        JSON.stringify(normalized),
        "تعديل بيانات فريق العمل"
      );

      // لا نغيّر البيانات المحلية إلا بعد نجاح الحفظ.
      members = normalized;
      render();

      status("تم حفظ التغييرات في Firebase");
      return true;

    } catch (error) {
      status(
        "فشل حفظ التعديلات: " +
        (error?.message || error),
        true
      );

      return false;

    } finally {
      saving = false;
    }
  }

  // ---------------------------------------------------------
  // EVENTS
  // ---------------------------------------------------------

  $("teamNavBtn").addEventListener("click", open);

  $("teamClose").addEventListener("click", close);

  modal.addEventListener("click", event => {
    if (event.target === modal) close();
  });

  document.addEventListener("keydown", event => {
    if (
      event.key === "Escape" &&
      !modal.classList.contains("hidden")
    ) {
      close();
    }
  });

  $("teamAdd").addEventListener(
    "click",
    () => startEdit(null)
  );

  ["teamCancel", "teamCancelBottom"].forEach(id => {
    $(id).addEventListener("click", () => {
      form.classList.add("hidden");
    });
  });

  [
    "teamSearch",
    "teamGroupFilter",
    "teamSpecialtyFilter",
    "teamSort"
  ].forEach(id => {
    $(id).addEventListener(
      id === "teamSearch" ? "input" : "change",
      render
    );
  });

  form.addEventListener("submit", async event => {
    event.preventDefault();

    if (!requireAdmin()) return;

    const values = {
      name: $("teamName").value.trim(),
      affiliation: $("teamAffiliation").value.trim(),
      specialty: $("teamSpecialty").value.trim(),
      group: $("teamGroup").value.trim()
    };

    if (!values.name) return;

    const next = normalize(members);

    if (editId !== null) {
      const member = next.find(m => m.id === editId);

      if (!member) {
        status("لم يتم العثور على العضو", true);
        return;
      }

      Object.assign(member, values);

    } else {
      next.push({
        id: Math.max(0, ...next.map(m => m.id)) + 1,
        ...values
      });
    }

    const success = await persist(next);

    if (success) {
      form.classList.add("hidden");
    }
  });

  $("teamCards").addEventListener(
    "click",
    async event => {
      const edit = event.target.closest("[data-edit]");
      const del = event.target.closest("[data-delete]");

      if (edit) {
        startEdit(Number(edit.dataset.edit));
        return;
      }

      if (del && requireAdmin()) {
        const id = Number(del.dataset.delete);

        if (!confirm("هل تريد حذف هذا العضو من فريق العمل؟")) {
          return;
        }

        await persist(
          members.filter(m => m.id !== id)
        );
      }
    }
  );

  // ---------------------------------------------------------
  // EXPORT
  // ---------------------------------------------------------

  $("teamExport").addEventListener("click", () => {
    if (!loadedFromServer) {
      status("انتظر تحميل البيانات أولاً", true);
      return;
    }

    const blob = new Blob(
      [JSON.stringify(members, null, 2)],
      {
        type: "application/json;charset=utf-8"
      }
    );

    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");

    anchor.href = url;
    anchor.download = "central-lab-team.json";
    anchor.click();

    setTimeout(() => URL.revokeObjectURL(url), 1000);
  });

  // ---------------------------------------------------------
  // IMPORT
  // ---------------------------------------------------------

  $("teamImport").addEventListener(
    "change",
    async event => {
      const file = event.target.files?.[0];
      if (!file) return;

      try {
        if (!requireAdmin()) return;

        const imported = JSON.parse(await file.text());

        if (
          !Array.isArray(imported) ||
          !imported.every(
            item => item &&
            typeof item.name === "string"
          )
        ) {
          throw Error("ملف JSON غير صحيح");
        }

        if (!confirm(
          "سيتم استبدال بيانات فريق العمل لجميع المستخدمين. هل أنت متأكد؟"
        )) {
          return;
        }

        await persist(normalize(imported));

      } catch (error) {
        status(
          "تعذر الاستيراد: " + error.message,
          true
        );

      } finally {
        event.target.value = "";
      }
    }
  );

  // ---------------------------------------------------------
  // STARTUP
  // ---------------------------------------------------------

  // إظهار الأيقونة فورًا لجميع المستخدمين.
  updatePermissions();

  // لا تعرض بيانات افتراضية على أنها بيانات Firebase.
  members = [];
  render();

  // ابدأ الاستماع للتغييرات.
  startSync();

  // تحديث أدوات الإدارة عند تغير حالة تسجيل الدخول.
  window.addEventListener(
    "centralLabAuthChanged",
    () => {
      updatePermissions();
      render();
    }
  );

  window.addEventListener("pagehide", () => {
    if (typeof unsubscribe === "function") {
      unsubscribe();
    }
  });

  // أدوات فحص آمنة
  window.centralLabTeamStatus = () => ({
    members: members.length,
    synced: loadedFromServer,
    admin: checkAdmin(),
    saving
  });

})();
