
/*
  University of Tabuk — Central Laboratory
  TEAM.JS — Repaired Version

  Public: View and search team members
  Admin: Add, edit, delete, import
  Firebase: dashboard/team/value

  IMPORTANT:
  - Never automatically overwrite Firebase.
  - Preserve existing member IDs.
  - Backup data is read-only.
  - Requires firebase-admin.js:
      centralLabSubscribe
      centralLabSave
      centralLabIsAdmin
*/

(() => {
  "use strict";

  const $ = id => document.getElementById(id);

  const REQUIRED = [
    "teamNavBtn",
    "teamModal",
    "teamForm",
    "teamCards",
    "teamClose",
    "teamAdd",
    "teamName",
    "teamAffiliation",
    "teamSpecialty",
    "teamGroup",
    "teamFormTitle",
    "teamSearch",
    "teamGroupFilter",
    "teamSpecialtyFilter",
    "teamSort",
    "teamCount",
    "teamHeaderCount",
    "teamShown",
    "teamGroupsCount",
    "teamSpecialtiesCount",
    "teamGroupSuggestions",
    "teamSpecialtySuggestions",
    "teamCancel",
    "teamCancelBottom",
    "teamExport",
    "teamImport"
  ];

  const missing = REQUIRED.filter(id => !$(id));

  if (missing.length) {
    console.error("Missing Team UI elements:", missing);
    return;
  }

  // Original backup: 17 members.
  // Used only for display if Firebase is unavailable.

  const BACKUP_17 = [
    {
      id: 1,
      name: "د. عايشة نواف البلوي",
      affiliation: "كلية العلوم / الكيمياء",
      specialty: "Chemistry",
      group: "Lab managment and ISO"
    },
    {
      id: 2,
      name: "د. منال أحمد قبوس",
      affiliation: "كلية العلوم / الكيمياء الحيوية",
      specialty: "Biochemistry",
      group:
        "Group 2: Sample Preparation & Advanced Research Applications"
    },
    {
      id: 3,
      name: "د. الحسين عجيم",
      affiliation: "كلية العلوم الطبية التطبيقية",
      specialty: "Medical",
      group:
        "Group 1,Group 5 & Group 6 : Advanced Microscopy & Materials Characterization"
    },
    {
      id: 4,
      name: "د. مصطفى زبيدي كعبي",
      affiliation: "كلية العلوم / الأحياء",
      specialty: "Biology",
      group:
        "Group 1,Group 5 & Group 6 : Advanced Microscopy & Materials Characterization"
    },
    {
      id: 5,
      name: "د. خليل يحيى السعيد",
      affiliation: "كلية العلوم / قسم الفيزياء",
      specialty: "Physics",
      group:
        "Group 4 & Group 6 : Materials Science & Physical Measurements"
    },
    {
      id: 6,
      name: "د. نور القرشي",
      affiliation: "وحدة الجينوم",
      specialty: "Biochemistry",
      group:
        "Group 5 : Biotechnology & Molecular Sciences"
    },
    {
      id: 7,
      name: "د. رامي العسيري",
      affiliation: "كلية العلوم / الكيمياء الحيوية",
      specialty: "Biochemistry",
      group:
        "Group 5 : Biotechnology & Molecular Sciences"
    },
    {
      id: 9,
      name: "د. ماجدة راجي العتيبي",
      affiliation: "كلية العلوم / الكيمياء",
      specialty: "Chemistry",
      group:
        "Group 3 :Advanced Chemical & Chromatographic Analysis"
    },
    {
      id: 11,
      name: "Dr. Uzma Faridi",
      affiliation: "كلية العلوم / الكيمياء الحيوية",
      specialty: "Biochemistry",
      group:
        "Group 5 : Biotechnology & Molecular Sciences"
    },
    {
      id: 12,
      name: "د. عبدالرحمن العطوي",
      affiliation: "باحث ما بعد الدكتوراه / وحدة الجينوم",
      specialty: "Biology",
      group:
        "Group 5 : Biotechnology & Molecular Sciences"
    },
    {
      id: 13,
      name: "د. نادر محمد الضويمر",
      affiliation: "كلية العلوم / الكيمياء الحيوية",
      specialty: "Chemistry",
      group:
        "Group 3 :Advanced Chemical & Chromatographic Analysis"
    },
    {
      id: 14,
      name: "أ.د. هالة بيومي",
      affiliation: "كلية العلوم / علوم الغذاء",
      specialty: "Food science",
      group:
        "Group 3 :Advanced Chemical & Chromatographic Analysis"
    },
    {
      id: 15,
      name: "أ. محمد مسعود البلوي",
      affiliation: "كلية العلوم / الفيزياء",
      specialty: "Physics",
      group:
        "Group 2 & Group 6 : Materials Science & Physical Measurements"
    },
    {
      id: 16,
      name: "أ. فهد محمد الخثعمي",
      affiliation: "المركز الطبي",
      specialty: "Medical",
      group: "ISO"
    },
    {
      id: 17,
      name: "د. فاطمة العتيبي",
      affiliation: "كلية العلوم / قسم الكيمياء",
      specialty: "Chemistry",
      group:
        "Group 2 : Spectroscopic & Elemental Analysis & ISO"
    },
    {
      id: 18,
      name: "أ. أحمد العطوي",
      affiliation: "كلية العلوم / باحث أكاديمي",
      specialty: "Physics",
      group:
        "Group 2 & Group 6 : Materials Science & Physical Measurements"
    },
    {
      id: 19,
      name: "د. خلود النهدي",
      affiliation: "كلية العلوم / الفيزياء",
      specialty: "Physics",
      group:
        "Group 1 : Advanced Microscopy & Materials Characterization & ISO"
    }
  ];

  const modal = $("teamModal");
  const form = $("teamForm");

  let members = BACKUP_17.map(x => ({ ...x }));
  let ready = false;
  let busy = false;
  let editId = null;

  function isAdmin() {
    return ready &&
      window.centralLabIsAdmin?.() === true;
  }

  function escapeHTML(value) {
    return String(value ?? "").replace(
      /[&<>"']/g,
      c => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;"
      }[c])
    );
  }

  function normalize(arr) {
    return arr
      .filter(x =>
        x &&
        typeof x.name === "string" &&
        x.name.trim()
      )
      .map((m, i) => ({
        id: Number(m.id) || i + 1,
        name: m.name,
        affiliation: String(m.affiliation || ""),
        specialty: String(m.specialty || ""),
        group: String(m.group || "")
      }));
  }

  function parseValue(value) {
    const data =
      typeof value === "string"
        ? JSON.parse(value)
        : value;

    if (!Array.isArray(data)) {
      throw new Error(
        "dashboard/team.value must be an array"
      );
    }

    return normalize(data);
  }

  function status(message, error = false) {
    let el = $("teamSyncStatus");

    if (!el) {
      el = document.createElement("div");
      el.id = "teamSyncStatus";
      el.setAttribute("role", "status");

      el.style.cssText = `
        margin: 8px 0;
        padding: 8px 12px;
        border-radius: 8px;
        font: 13px Arial;
        background: #eaf3fa;
        color: #173b50;
      `;

      $("teamCards").before(el);
    }

    el.textContent = message;
    el.style.background =
      error ? "#fff0f0" : "#eaf3fa";
    el.style.color =
      error ? "#8b1e1e" : "#173b50";
  }

  function permissions() {
    $("teamNavBtn").hidden = false;

    const canEdit = isAdmin();

    for (const id of ["teamAdd", "teamImport"]) {
      const el = $(id);
      el.hidden = !canEdit;
      el.style.display = canEdit ? "" : "none";
    }

    const importLabel =
      $("teamImport").closest("label");

    if (importLabel) {
      importLabel.hidden = !canEdit;
      importLabel.style.display =
        canEdit ? "" : "none";
    }

    document
      .querySelectorAll(
        "#teamCards [data-edit], #teamCards [data-delete]"
      )
      .forEach(el => {
        el.hidden = !canEdit;
        el.style.display =
          canEdit ? "" : "none";
      });

    if (!canEdit) {
      form.classList.add("hidden");
    }
  }

  function initials(name) {
    const parts = name
      .replace(
        /^(د\.|أ\.د\.|أ\.|Dr\.)\s*/i,
        ""
      )
      .trim()
      .split(/\s+/);

    return parts.length > 1
      ? parts[0][0] + parts[1][0]
      : (parts[0]?.slice(0, 2) || "؟");
  }

  function uniqueValues(key) {
    return [
      ...new Set(
        members
          .map(m => m[key].trim())
          .filter(Boolean)
      )
    ].sort((a, b) => a.localeCompare(b, "ar"));
  }

  function render() {
    const search = $("teamSearch")
      .value.trim().toLocaleLowerCase();

    const group = $("teamGroupFilter").value;
    const specialty =
      $("teamSpecialtyFilter").value;

    const groups = uniqueValues("group");
    const specialties =
      uniqueValues("specialty");

    function updateOptions(
      id,
      values,
      label,
      selected
    ) {
      const el = $(id);

      el.innerHTML =
        `<option value="">${label}</option>` +
        values.map(value =>
          `<option value="${escapeHTML(value)}">` +
          `${escapeHTML(value)}</option>`
        ).join("");

      el.value = values.includes(selected)
        ? selected
        : "";
    }

    updateOptions(
      "teamGroupFilter",
      groups,
      "كل المجموعات",
      group
    );

    updateOptions(
      "teamSpecialtyFilter",
      specialties,
      "كل التخصصات",
      specialty
    );

    $("teamGroupSuggestions").innerHTML =
      groups.map(x =>
        `<option value="${escapeHTML(x)}"></option>`
      ).join("");

    $("teamSpecialtySuggestions").innerHTML =
      specialties.map(x =>
        `<option value="${escapeHTML(x)}"></option>`
      ).join("");

    let shown = members.filter(m =>
      (!group || m.group === group) &&
      (!specialty || m.specialty === specialty) &&
      [
        m.name,
        m.affiliation,
        m.specialty,
        m.group
      ].some(x =>
        x.toLocaleLowerCase().includes(search)
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
    $("teamHeaderCount").textContent =
      members.length;

    $("teamShown").textContent = shown.length;

    $("teamGroupsCount").textContent =
      groups.length;

    $("teamSpecialtiesCount").textContent =
      specialties.length;

    $("teamCards").innerHTML =
      shown.map(m => {
        const icon =
          window.teamSpecialtyIcon?.(m);

        const number = String(
          members.indexOf(m) + 1
        ).padStart(2, "0");

        return `
          <article class="team-card">
            <div
              class="team-avatar team-avatar--${escapeHTML(icon?.key || "general")}"
              title="${escapeHTML(m.specialty || m.affiliation || "التخصص غير محدد")}"
              aria-hidden="true"
            >
              ${icon?.html || escapeHTML(initials(m.name))}
            </div>

            <div class="team-info">
              <div class="team-person-line">
                <strong>${escapeHTML(m.name)}</strong>
                <span class="team-number">${number}</span>
              </div>

              <small>
                ${escapeHTML(m.affiliation) || "الجهة غير محددة"}
              </small>

              <div class="team-tags">
                <span class="team-tag">
                  ◈ ${escapeHTML(m.specialty) || "إضافة التخصص"}
                </span>

                <span class="team-tag gold">
                  ♧ ${escapeHTML(m.group) || "إضافة مجموعة العمل"}
                </span>
              </div>
            </div>

            <div class="team-actions">
              <button
                type="button"
                data-edit="${m.id}"
              >
                ✎ تعديل
              </button>

              <button
                type="button"
                class="team-delete"
                data-delete="${m.id}"
              >
                حذف
              </button>
            </div>
          </article>
        `;
      }).join("") ||
      `
        <div class="team-empty">
          <strong>لا توجد نتائج مطابقة</strong>
          <p>جرّب تغيير كلمات البحث أو إزالة عوامل التصفية.</p>
        </div>
      `;

    permissions();
  }

  function openModal() {
    modal.classList.remove("hidden");
    document.body.classList.add("team-modal-open");

    $("teamNavBtn").setAttribute(
      "aria-expanded",
      "true"
    );

    render();
  }

  function closeModal() {
    modal.classList.add("hidden");
    document.body.classList.remove(
      "team-modal-open"
    );

    $("teamNavBtn").setAttribute(
      "aria-expanded",
      "false"
    );

    form.classList.add("hidden");
  }

  function startEdit(id) {
    if (!isAdmin()) {
      status(
        "التعديل متاح للمدير فقط بعد اكتمال المزامنة",
        true
      );
      return;
    }

    editId = id;

    const member = members.find(
      x => x.id === id
    );

    $("teamFormTitle").textContent =
      member
        ? "تعديل بيانات العضو"
        : "إضافة عضو جديد";

    $("teamName").value =
      member?.name || "";

    $("teamAffiliation").value =
      member?.affiliation || "";

    $("teamSpecialty").value =
      member?.specialty || "";

    $("teamGroup").value =
      member?.group || "";

    form.classList.remove("hidden");

    form.scrollIntoView({
      behavior: "smooth",
      block: "nearest"
    });

    $("teamName").focus();
  }

  async function save(change) {
    if (!isAdmin() || busy) {
      status(
        "التعديل متاح للمدير فقط بعد تحميل Firebase",
        true
      );
      return false;
    }

    if (
      typeof window.centralLabSave !== "function"
    ) {
      status(
        "خدمة حفظ Firebase غير متاحة",
        true
      );
      return false;
    }

    busy = true;

    try {
      const latest = members.map(
        m => ({ ...m })
      );

      const result = change(latest);

      if (!Array.isArray(result)) {
        throw new Error("تعديل غير صالح");
      }

      await window.centralLabSave(
        "centralLabTeamMembersV1",
        JSON.stringify(normalize(result)),
        "تحديث فريق العمل"
      );

      status("تم حفظ بيانات الفريق في Firebase");
      return true;

    } catch (error) {
      status(
        "فشل الحفظ: " +
        (error.message || error),
        true
      );
      return false;

    } finally {
      busy = false;
    }
  }

  // Navigation

  $("teamNavBtn").addEventListener(
    "click",
    openModal
  );

  $("teamClose").addEventListener(
    "click",
    closeModal
  );

  modal.addEventListener("click", e => {
    if (e.target === modal) {
      closeModal();
    }
  });

  document.addEventListener(
    "keydown",
    e => {
      if (
        e.key === "Escape" &&
        !modal.classList.contains("hidden")
      ) {
        closeModal();
      }
    }
  );

  // Add member

  $("teamAdd").addEventListener(
    "click",
    () => startEdit(null)
  );

  // Cancel editing

  for (
    const id of [
      "teamCancel",
      "teamCancelBottom"
    ]
  ) {
    $(id).addEventListener(
      "click",
      () => form.classList.add("hidden")
    );
  }

  // Search and filters

  for (
    const id of [
      "teamSearch",
      "teamGroupFilter",
      "teamSpecialtyFilter",
      "teamSort"
    ]
  ) {
    $(id).addEventListener(
      id === "teamSearch"
        ? "input"
        : "change",
      render
    );
  }

  // Save member

  form.addEventListener(
    "submit",
    async e => {
      e.preventDefault();

      if (!isAdmin()) return;

      const values = {
        name: $("teamName").value.trim(),
        affiliation:
          $("teamAffiliation").value.trim(),
        specialty:
          $("teamSpecialty").value.trim(),
        group:
          $("teamGroup").value.trim()
      };

      if (!values.name) return;

      const target = editId;

      const success = await save(latest => {
        if (target !== null) {
          const member = latest.find(
            x => x.id === target
          );

          if (!member) {
            throw new Error(
              "العضو لم يعد موجودًا"
            );
          }

          Object.assign(member, values);

        } else {
          latest.push({
            id: Math.max(
              0,
              ...latest.map(x => x.id)
            ) + 1,
            ...values
          });
        }

        return latest;
      });

      if (success) {
        form.classList.add("hidden");
      }
    }
  );

  // Edit and delete

  $("teamCards").addEventListener(
    "click",
    async e => {
      const edit = e.target.closest(
        "[data-edit]"
      );

      const del = e.target.closest(
        "[data-delete]"
      );

      if (edit && isAdmin()) {
        startEdit(
          Number(edit.dataset.edit)
        );
      }

      if (
        del &&
        isAdmin() &&
        confirm(
          "هل تريد حذف هذا العضو من فريق العمل؟"
        )
      ) {
        const id = Number(
          del.dataset.delete
        );

        await save(latest =>
          latest.filter(
            member => member.id !== id
          )
        );
      }
    }
  );

  // Export current Firebase team

  $("teamExport").addEventListener(
    "click",
    () => {
      if (!ready) {
        status(
          "انتظر تحميل بيانات Firebase",
          true
        );
        return;
      }

      const blob = new Blob(
        [
          JSON.stringify(
            members,
            null,
            2
          )
        ],
        {
          type:
            "application/json;charset=utf-8"
        }
      );

      const url =
        URL.createObjectURL(blob);

      const link =
        document.createElement("a");

      link.href = url;
      link.download =
        "central-lab-team.json";

      link.click();

      setTimeout(
        () => URL.revokeObjectURL(url),
        1000
      );
    }
  );

  // Import team: admin only, with confirmation

  $("teamImport").addEventListener(
    "change",
    async e => {
      const file = e.target.files?.[0];

      if (!file) return;

      try {
        if (!isAdmin()) {
          throw new Error(
            "غير مصرح"
          );
        }

        const data = JSON.parse(
          await file.text()
        );

        if (
          !Array.isArray(data) ||
          !data.every(
            x =>
              x &&
              typeof x.name === "string"
          )
        ) {
          throw new Error(
            "ملف غير صحيح"
          );
        }

        if (
          !confirm(
            "سيتم استبدال قائمة الفريق لجميع المستخدمين. هل أنت متأكد؟"
          )
        ) {
          return;
        }

        await save(
          () => normalize(data)
        );

      } catch (error) {
        status(
          "فشل الاستيراد: " +
          error.message,
          true
        );

      } finally {
        e.target.value = "";
      }
    }
  );

  // Update permissions on login/logout

  window.addEventListener(
    "centralLabAuthChanged",
    permissions
  );

  // Initial read-only view

  permissions();
  render();

  status(
    "تُعرض نسخة احتياطية من 17 عضوًا مؤقتًا حتى الاتصال بـ Firebase"
  );

  // Firebase realtime synchronization

  function connect(attempt = 0) {
    if (
      typeof window.centralLabSubscribe ===
      "function"
    ) {
      window.centralLabSubscribe(
        "team",

        value => {
          try {
            members = parseValue(value);
            ready = true;

            render();

            status(
              `تمت مزامنة ${members.length} عضوًا من Firebase`
            );

          } catch (error) {
            ready = false;
            permissions();

            status(
              "تعذر قراءة بيانات Firebase: " +
              error.message,
              true
            );
          }
        },

        error => {
          ready = false;
          permissions();

          status(
            "تعذر الاتصال ببيانات الفريق: " +
            (error.code || error.message),
            true
          );
        }
      );

    } else if (attempt < 60) {
      setTimeout(
        () => connect(attempt + 1),
        250
      );

    } else {
      status(
        "تعذر تحميل خدمة Firebase. المعروض نسخة احتياطية للقراءة فقط.",
        true
      );
    }
  }

  connect();

})();
