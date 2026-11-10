
/*
  Central Laboratory - University of Tabuk
  Team Directory - Public View / Admin Edit
  File: team.js
*/

(() => {
  "use strict";

  const $ = id => document.getElementById(id);

  const nav = $("teamNavBtn");
  const modal = $("teamModal");
  const cards = $("teamCards");
  const form = $("teamForm");

  if (!nav || !modal || !cards || !form) {
    console.error("Team interface elements not found");
    return;
  }

  const KEY = "centralLabTeamMembersV1";

  let members = [];
  let ready = false;
  let editingId = null;
  let busy = false;
  let subscribed = false;

  const escapeHTML = value =>
    String(value ?? "").replace(/[&<>"']/g, char => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;"
    }[char]));

  function normalize(value) {
    if (!Array.isArray(value)) {
      throw new Error("بيانات الفريق ليست قائمة صحيحة");
    }

    return value
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
    if (typeof value === "string") {
      value = JSON.parse(value);
    }
    return normalize(value);
  }

  function isAdmin() {
    return ready &&
      typeof window.centralLabIsAdmin === "function" &&
      window.centralLabIsAdmin() === true;
  }

  function status(message, error = false) {
    let el = $("teamSyncStatus");

    if (!el) {
      el = document.createElement("div");
      el.id = "teamSyncStatus";
      el.setAttribute("role", "status");
      el.style.cssText =
        "padding:9px 14px;margin:10px 0;" +
        "border-radius:10px;font-size:13px";

      cards.before(el);
    }

    el.textContent = message;
    el.style.background = error ? "#fff0f0" : "#edf6ff";
    el.style.color = error ? "#a32121" : "#174a70";
  }

  function unique(field) {
    return [...new Set(
      members.map(m => m[field].trim()).filter(Boolean)
    )].sort((a, b) => a.localeCompare(b, "ar"));
  }

  function updateSelect(id, values, label) {
    const select = $(id);
    if (!select) return;

    const previous = select.value;

    select.innerHTML =
      `<option value="">${label}</option>` +
      values.map(value =>
        `<option value="${escapeHTML(value)}">` +
        `${escapeHTML(value)}</option>`
      ).join("");

    select.value = values.includes(previous)
      ? previous
      : "";
  }

  function initials(name) {
    const clean = String(name)
      .replace(/^(أ\.د\.|د\.|أ\.|Dr\.)\s*/i, "")
      .trim();

    const words = clean.split(/\s+/);

    return words.length > 1
      ? words[0].slice(0, 1) + words[1].slice(0, 1)
      : clean.slice(0, 2);
  }

  function permissions() {
    const allowed = isAdmin();

    const add = $("teamAdd");
    if (add) add.hidden = !allowed;

    const importInput = $("teamImport");
    const importLabel = importInput?.closest("label");

    if (importLabel) importLabel.hidden = !allowed;

    cards.querySelectorAll(
      "[data-edit], [data-delete]"
    ).forEach(button => {
      button.hidden = !allowed;
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
          `<option value="${escapeHTML(x)}"></option>`
        ).join("");
    }

    if ($("teamSpecialtySuggestions")) {
      $("teamSpecialtySuggestions").innerHTML =
        specialties.map(x =>
          `<option value="${escapeHTML(x)}"></option>`
        ).join("");
    }

    const search = ($("teamSearch")?.value || "")
      .trim()
      .toLocaleLowerCase();

    const group = $("teamGroupFilter")?.value || "";
    const specialty =
      $("teamSpecialtyFilter")?.value || "";

    let filtered = members.filter(member => {
      if (group && member.group !== group) return false;

      if (
        specialty &&
        member.specialty !== specialty
      ) return false;

      if (!search) return true;

      return [
        member.name,
        member.affiliation,
        member.specialty,
        member.group
      ].some(value =>
        value.toLocaleLowerCase().includes(search)
      );
    });

    const sort = $("teamSort")?.value;

    if (sort === "name") {
      filtered.sort((a, b) =>
        a.name.localeCompare(b.name, "ar")
      );
    }

    if (sort === "group") {
      filtered.sort((a, b) =>
        a.group.localeCompare(b.group, "ar")
      );
    }

    const counters = {
      teamCount: members.length,
      teamHeaderCount: members.length,
      teamShown: filtered.length,
      teamGroupsCount: groups.length,
      teamSpecialtiesCount: specialties.length
    };

    Object.entries(counters).forEach(([id, value]) => {
      if ($(id)) $(id).textContent = value;
    });

    const allowed = isAdmin();

    cards.innerHTML = filtered.map(member => `
      <article class="team-card">
        <div class="team-avatar">
          ${escapeHTML(initials(member.name))}
        </div>

        <div class="team-info">
          <div class="team-person-line">
            <strong>${escapeHTML(member.name)}</strong>
            <span class="team-number">
              ${String(member.id).padStart(2, "0")}
            </span>
          </div>

          <small>
            ${escapeHTML(member.affiliation)}
          </small>

          <div class="team-tags">
            <span class="team-tag">
              ${escapeHTML(member.specialty || "غير محدد")}
            </span>

            <span class="team-tag gold">
              ${escapeHTML(member.group || "غير محدد")}
            </span>
          </div>
        </div>

        ${allowed ? `
          <div class="team-actions">
            <button type="button"
              data-edit="${member.id}">
              تعديل
            </button>

            <button type="button"
              data-delete="${member.id}">
              حذف
            </button>
          </div>
        ` : ""}
      </article>
    `).join("");

    if (!filtered.length) {
      cards.innerHTML = `
        <div class="team-empty">
          <strong>
            ${ready ? "لا توجد نتائج مطابقة" : "جارٍ تحميل بيانات الفريق"}
          </strong>
        </div>
      `;
    }

    permissions();
  }

  function openModal() {
    modal.classList.remove("hidden");
    modal.style.display = "";
    modal.setAttribute("aria-hidden", "false");
    nav.setAttribute("aria-expanded", "true");

    render();
  }

  function closeModal() {
    modal.classList.add("hidden");
    modal.style.display = "";
    modal.setAttribute("aria-hidden", "true");
    nav.setAttribute("aria-expanded", "false");
    form.classList.add("hidden");
  }

  nav.type = "button";
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

  function editMember(id = null) {
    if (!isAdmin()) return;

    editingId = id;

    const member = members.find(m => m.id === id);

    $("teamFormTitle").textContent =
      member ? "تعديل بيانات العضو" : "إضافة عضو";

    $("teamName").value = member?.name || "";
    $("teamAffiliation").value =
      member?.affiliation || "";
    $("teamSpecialty").value =
      member?.specialty || "";
    $("teamGroup").value = member?.group || "";

    form.classList.remove("hidden");
    $("teamName").focus();
  }

  $("teamAdd")?.addEventListener("click", () => {
    editMember(null);
  });

  ["teamCancel", "teamCancelBottom"].forEach(id => {
    $(id)?.addEventListener("click", () => {
      form.classList.add("hidden");
    });
  });

  async function saveTeam(change) {
    if (!isAdmin()) {
      status("التعديل متاح للمدير فقط", true);
      return false;
    }

    if (busy) return false;

    if (typeof window.centralLabSave !== "function") {
      status("خدمة حفظ Firebase غير متاحة", true);
      return false;
    }

    busy = true;

    try {
      const copy = members.map(m => ({ ...m }));
      const updated = normalize(change(copy));

      await window.centralLabSave(
        KEY,
        JSON.stringify(updated),
        "تحديث فريق العمل"
      );

      status("تم حفظ التعديل في Firebase");
      return true;

    } catch (error) {
      status(
        "فشل حفظ التعديل: " + error.message,
        true
      );
      return false;

    } finally {
      busy = false;
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
        const member = list.find(m => m.id === id);

        if (!member) {
          throw new Error("لم يتم العثور على العضو");
        }

        Object.assign(member, values);
      } else {
        list.push({
          id: Math.max(0, ...list.map(m => m.id)) + 1,
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
    const remove = event.target.closest("[data-delete]");

    if (edit) {
      editMember(Number(edit.dataset.edit));
      return;
    }

    if (remove) {
      const id = Number(remove.dataset.delete);

      if (!confirm("هل تريد حذف هذا العضو؟")) {
        return;
      }

      await saveTeam(list =>
        list.filter(member => member.id !== id)
      );
    }
  });

  $("teamExport")?.addEventListener("click", () => {
    if (!ready) {
      status("انتظر تحميل بيانات الفريق", true);
      return;
    }

    const blob = new Blob(
      [JSON.stringify(members, null, 2)],
      { type: "application/json;charset=utf-8" }
    );

    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = url;
    link.download = "central-lab-team.json";
    link.click();

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
          "سيتم استبدال قائمة الأعضاء. هل أنت متأكد؟"
        )) return;

        await saveTeam(() => data);

      } catch (error) {
        status(
          "فشل الاستيراد: " + error.message,
          true
        );

      } finally {
        event.target.value = "";
      }
    }
  );

  // Firebase realtime synchronization

  function connect() {
    if (subscribed) return;

    if (
      typeof window.centralLabSubscribe !== "function"
    ) {
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
              "تعذر قراءة بيانات Firebase: " +
              error.message,
              true
            );
          }
        },

        error => {
          ready = false;
          render();

          status(
            "تعذر الاتصال ببيانات الفريق: " +
            (error?.code ||
             error?.message ||
             "خطأ غير معروف"),
            true
          );
        }
      );

    } catch (error) {
      subscribed = false;

      status(
        "تعذر بدء المزامنة: " + error.message,
        true
      );
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

  render();
  connect();

})();
