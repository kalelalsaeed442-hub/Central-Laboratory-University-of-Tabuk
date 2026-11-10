
/*
 University of Tabuk - Central Laboratory
 team.js
 Public team directory + Firebase synchronization
*/

(() => {
  "use strict";

  const $ = id => document.getElementById(id);

  const modal = $("teamModal");
  const nav = $("teamNavBtn");
  const cards = $("teamCards");
  const form = $("teamForm");

  if (!modal || !nav || !cards || !form) {
    console.error("Team interface elements are missing");
    return;
  }

  let members = [];
  let ready = false;
  let editingId = null;
  let saving = false;
  let subscribed = false;

  const safe = value =>
    String(value ?? "").replace(
      /[&<>"']/g,
      c => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;"
      }[c])
    );

  function isAdmin() {
    return ready &&
      window.centralLabIsAdmin?.() === true;
  }

  function status(message, error = false) {
    let el = $("teamSyncStatus");

    if (!el) {
      el = document.createElement("div");
      el.id = "teamSyncStatus";
      el.setAttribute("role", "status");
      el.style.cssText =
        "padding:9px 12px;margin:10px 0;" +
        "border-radius:9px;font-size:13px";
      cards.before(el);
    }

    el.textContent = message;
    el.style.background =
      error ? "#fff0f0" : "#eaf4fc";
    el.style.color =
      error ? "#a02020" : "#174567";
  }

  function normalize(data) {
    if (!Array.isArray(data)) {
      throw new Error("بيانات الفريق ليست قائمة صحيحة");
    }

    return data
      .filter(x => x && String(x.name || "").trim())
      .map((x, i) => ({
        id: Number(x.id) || i + 1,
        name: String(x.name || ""),
        affiliation: String(x.affiliation || ""),
        specialty: String(x.specialty || ""),
        group: String(x.group || "")
      }));
  }

  function parseValue(value) {
    const data =
      typeof value === "string"
        ? JSON.parse(value)
        : value;

    return normalize(data);
  }

  function initials(name) {
    const parts = name
      .replace(/^(أ\.د\.|د\.|أ\.|Dr\.)\s*/i, "")
      .trim()
      .split(/\s+/);

    return parts.length > 1
      ? parts[0][0] + parts[1][0]
      : (parts[0]?.slice(0, 2) || "؟");
  }

  function unique(field) {
    return [...new Set(
      members.map(x => x[field].trim()).filter(Boolean)
    )].sort((a, b) => a.localeCompare(b, "ar"));
  }

  function updateSelect(id, values, title) {
    const el = $(id);
    if (!el) return;

    const previous = el.value;

    el.innerHTML =
      `<option value="">${title}</option>` +
      values.map(x =>
        `<option value="${safe(x)}">${safe(x)}</option>`
      ).join("");

    el.value = values.includes(previous)
      ? previous
      : "";
  }

  function permissions() {
    const allowed = isAdmin();

    for (const id of ["teamAdd", "teamImport"]) {
      const el = $(id);
      if (!el) continue;
      el.hidden = !allowed;
      el.style.display = allowed ? "" : "none";
    }

    const importLabel = $("teamImport")?.closest("label");
    if (importLabel) {
      importLabel.hidden = !allowed;
      importLabel.style.display = allowed ? "" : "none";
    }

    cards.querySelectorAll(
      "[data-edit], [data-delete]"
    ).forEach(btn => {
      btn.hidden = !allowed;
      btn.style.display = allowed ? "" : "none";
    });

    if (!allowed) form.classList.add("hidden");
  }

  function render() {
    const groups = unique("group");
    const specialties = unique("specialty");

    updateSelect(
      "teamGroupFilter",
      groups,
      "كل المجموعات"
    );

    updateSelect(
      "teamSpecialtyFilter",
      specialties,
      "كل التخصصات"
    );

    if ($("teamGroupSuggestions")) {
      $("teamGroupSuggestions").innerHTML =
        groups.map(x =>
          `<option value="${safe(x)}"></option>`
        ).join("");
    }

    if ($("teamSpecialtySuggestions")) {
      $("teamSpecialtySuggestions").innerHTML =
        specialties.map(x =>
          `<option value="${safe(x)}"></option>`
        ).join("");
    }

    const query = ($("teamSearch")?.value || "")
      .trim()
      .toLocaleLowerCase();

    const group = $("teamGroupFilter")?.value || "";
    const specialty =
      $("teamSpecialtyFilter")?.value || "";

    let shown = members.filter(m =>
      (!group || m.group === group) &&
      (!specialty || m.specialty === specialty) &&
      [
        m.name,
        m.affiliation,
        m.specialty,
        m.group
      ].some(x =>
        x.toLocaleLowerCase().includes(query)
      )
    );

    const sort = $("teamSort")?.value;

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

    const counters = {
      teamCount: members.length,
      teamHeaderCount: members.length,
      teamShown: shown.length,
      teamGroupsCount: groups.length,
      teamSpecialtiesCount: specialties.length
    };

    Object.entries(counters).forEach(([id, value]) => {
      if ($(id)) $(id).textContent = value;
    });

    const allowed = isAdmin();

    cards.innerHTML = shown.map(m => `
      <article class="team-card">
        <div class="team-avatar">
          ${safe(initials(m.name))}
        </div>

        <div class="team-info">
          <div class="team-person-line">
            <strong>${safe(m.name)}</strong>
            <span class="team-number">
              ${String(m.id).padStart(2, "0")}
            </span>
          </div>

          <small>
            ${safe(m.affiliation) || "الجهة غير محددة"}
          </small>

          <div class="team-tags">
            <span class="team-tag">
              ◈ ${safe(m.specialty) || "غير محدد"}
            </span>

            <span class="team-tag gold">
              ♧ ${safe(m.group) || "غير محدد"}
            </span>
          </div>
        </div>

        <div class="team-actions"
          ${allowed ? "" : 'style="display:none"'}>
          <button type="button" data-edit="${m.id}">
            ✎ تعديل
          </button>

          <button type="button"
            class="team-delete"
            data-delete="${m.id}">
            حذف
          </button>
        </div>
      </article>
    `).join("") || `
      <div class="team-empty">
        <strong>لا توجد نتائج مطابقة</strong>
        <p>يمكن تغيير البحث أو عوامل التصفية.</p>
      </div>
    `;

    permissions();
  }

  function openModal() {
    modal.classList.remove("hidden");
    document.body.classList.add("team-modal-open");
    nav.setAttribute("aria-expanded", "true");
    render();
  }

  function closeModal() {
    modal.classList.add("hidden");
    document.body.classList.remove("team-modal-open");
    nav.setAttribute("aria-expanded", "false");
    form.classList.add("hidden");
  }

  nav.addEventListener("click", openModal);

  $("teamClose")?.addEventListener(
    "click",
    closeModal
  );

  modal.addEventListener("click", event => {
    if (event.target === modal) closeModal();
  });

  document.addEventListener("keydown", event => {
    if (event.key === "Escape") closeModal();
  });

  function editMember(id = null) {
    if (!isAdmin()) return;

    editingId = id;

    const m = members.find(x => x.id === id);

    $("teamFormTitle").textContent =
      m ? "تعديل بيانات العضو" : "إضافة عضو";

    $("teamName").value = m?.name || "";
    $("teamAffiliation").value =
      m?.affiliation || "";
    $("teamSpecialty").value =
      m?.specialty || "";
    $("teamGroup").value = m?.group || "";

    form.classList.remove("hidden");
    $("teamName").focus();
  }

  $("teamAdd")?.addEventListener(
    "click",
    () => editMember(null)
  );

  ["teamCancel", "teamCancelBottom"].forEach(id => {
    $(id)?.addEventListener("click", () => {
      form.classList.add("hidden");
    });
  });

  [
    "teamSearch",
    "teamGroupFilter",
    "teamSpecialtyFilter",
    "teamSort"
  ].forEach(id => {
    $(id)?.addEventListener(
      id === "teamSearch" ? "input" : "change",
      render
    );
  });

  async function saveTeam(change) {
    if (!isAdmin() || saving) return false;

    if (typeof window.centralLabSave !== "function") {
      status("خدمة حفظ Firebase غير متاحة", true);
      return false;
    }

    saving = true;

    try {
      const updated = change(
        members.map(m => ({ ...m }))
      );

      await window.centralLabSave(
        "centralLabTeamMembersV1",
        JSON.stringify(normalize(updated)),
        "تحديث فريق العمل"
      );

      status("تم إرسال التحديث إلى Firebase");
      return true;
    } catch (error) {
      status("فشل الحفظ: " + error.message, true);
      return false;
    } finally {
      saving = false;
    }
  }

  form.addEventListener("submit", async event => {
    event.preventDefault();
    if (!isAdmin()) return;

    const values = {
      name: $("teamName").value.trim(),
      affiliation: $("teamAffiliation").value.trim(),
      specialty: $("teamSpecialty").value.trim(),
      group: $("teamGroup").value.trim()
    };

    if (!values.name) return;

    const id = editingId;

    const success = await saveTeam(list => {
      if (id !== null) {
        const member = list.find(x => x.id === id);
        if (!member) throw new Error("العضو غير موجود");
        Object.assign(member, values);
      } else {
        list.push({
          id: Math.max(0, ...list.map(x => x.id)) + 1,
          ...values
        });
      }
      return list;
    });

    if (success) form.classList.add("hidden");
  });

  cards.addEventListener("click", async event => {
    if (!isAdmin()) return;

    const edit = event.target.closest("[data-edit]");
    const del = event.target.closest("[data-delete]");

    if (edit) {
      editMember(Number(edit.dataset.edit));
    }

    if (del && confirm("هل تريد حذف هذا العضو؟")) {
      const id = Number(del.dataset.delete);
      await saveTeam(list =>
        list.filter(x => x.id !== id)
      );
    }
  });

  $("teamExport")?.addEventListener("click", () => {
    if (!ready) {
      status("انتظر تحميل بيانات Firebase", true);
      return;
    }

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

  $("teamImport")?.addEventListener(
    "change",
    async event => {
      const file = event.target.files?.[0];
      if (!file) return;

      try {
        if (!isAdmin()) {
          throw new Error("غير مصرح بالاستيراد");
        }

        const data = normalize(
          JSON.parse(await file.text())
        );

        if (!confirm(
          "سيتم استبدال قائمة الفريق للجميع. هل أنت متأكد؟"
        )) return;

        await saveTeam(() => data);
      } catch (error) {
        status("فشل الاستيراد: " + error.message, true);
      } finally {
        event.target.value = "";
      }
    }
  );

  // Firebase public realtime subscription

  function connect() {
    if (subscribed) return;

    if (typeof window.centralLabSubscribe !== "function") {
      status("جارٍ الاتصال بخدمة Firebase...");
      return;
    }

    subscribed = true;

    try {
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
            render();
            status(
              "تعذر قراءة بيانات الفريق: " +
              error.message,
              true
            );
          }
        },
        error => {
          ready = false;
          render();
          status(
            "تعذر الاتصال بـ Firebase: " +
            (error?.code || error?.message || error),
            true
          );
        }
      );
    } catch (error) {
      subscribed = false;
      status("خطأ الاتصال: " + error.message, true);
    }
  }

  window.addEventListener(
    "centralLabFirebaseReady",
    connect
  );

  window.addEventListener(
    "centralLabAuthChanged",
    render
  );

  window.addEventListener(
    "centralLabFirebaseError",
    event => {
      status(
        "فشل تحميل Firebase: " +
        (event.detail || "خطأ غير معروف"),
        true
      );
    }
  );

  // Show public interface immediately
  nav.hidden = false;
  render();
  status("جارٍ تحميل أعضاء الفريق...");
  connect();

})();
