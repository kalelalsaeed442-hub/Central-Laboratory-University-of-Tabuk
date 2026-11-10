
/*
 CENTRAL LABORATORY — UNIVERSITY OF TABUK
 Firebase Administration & Real-Time Synchronization
 Public Team Directory / Admin-Only Team Editing
*/

(async () => {
  "use strict";

  const config = {
    apiKey: "AIzaSyDtr0qH-_87XYw26_b2wMjXaIhJC--9xbs",
    authDomain: "centrallabuniversity-of-tabuk.firebaseapp.com",
    projectId: "centrallabuniversity-of-tabuk",
    appId: "1:833984703398:web:fdb2e3de00e403340abd67"
  };

  const ROOT = "zPzvmsBu9GTbQTc0njW62lOplr93";

  const KEYS = {
    centralLabsDigitalTwinData: "labs",
    centralLabTeamMembersV1: "team"
  };

  const [
    { initializeApp, getApps, getApp, deleteApp },
    {
      getAuth,
      signInWithEmailAndPassword,
      signOut,
      onAuthStateChanged,
      createUserWithEmailAndPassword
    },
    {
      getFirestore,
      doc,
      getDoc,
      getDocs,
      collection,
      addDoc,
      setDoc,
      onSnapshot,
      query,
      orderBy,
      limit,
      serverTimestamp,
      runTransaction
    }
  ] = await Promise.all([
    import("https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js"),
    import("https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js"),
    import("https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js")
  ]);

  const app = getApps().length
    ? getApp()
    : initializeApp(config);

  if (app.options.projectId !== config.projectId) {
    console.error("Firebase project mismatch");
    return;
  }

  const auth = getAuth(app);
  const db = getFirestore(app);
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

  let user = null;
  let profile = null;
  let authVersion = 0;
  let loginInProgress = false;

  const listeners = new Map();
  const subscriptions = new Map();

  const WELCOME_KEY = "centralLabWelcomeShown";

  // =====================================================
  // AUTHORIZATION
  // =====================================================

  function admin() {
    return !!user && user.uid === ROOT;
  }

  function editor() {
    return !!user && (
      admin() || profile?.role === "editor"
    );
  }

  function displayName() {
    return profile?.name || user?.email || "مستخدم";
  }

  window.centralLabIsAdmin = () => admin();

  window.centralLabCanEdit = () => editor();

  window.centralLabCurrentUser = () => ({
    uid: user?.uid || null,
    name: user ? displayName() : null,
    role: admin()
      ? "admin"
      : editor()
        ? "editor"
        : "viewer"
  });

  function authChanged() {
    window.dispatchEvent(
      new CustomEvent("centralLabAuthChanged", {
        detail: {
          admin: admin(),
          editor: editor(),
          user: window.centralLabCurrentUser()
        }
      })
    );
  }

  // =====================================================
  // ADMIN OVERLAY
  // =====================================================

  let overlay = $("adminOverlay");

  if (!overlay) {
    overlay = document.createElement("div");
    overlay.id = "adminOverlay";
    overlay.className = "admin-overlay";
    overlay.style.display = "none";
    document.body.appendChild(overlay);
  }

  function show(html) {
    overlay.innerHTML =
      '<section class="admin-panel" role="dialog" aria-modal="true">' +
      html +
      "</section>";

    overlay.style.display = "flex";
  }

  function hide() {
    overlay.style.display = "none";
  }

  function message(err) {
    return ({
      "auth/invalid-credential": "بيانات الدخول غير صحيحة",
      "auth/email-already-in-use": "البريد مستخدم بالفعل",
      "auth/weak-password": "كلمة المرور ضعيفة",
      "permission-denied": "لا توجد صلاحية لإجراء العملية"
    }[err?.code] || err?.message || "تعذرت العملية");
  }

  // =====================================================
  // TEAM PERMISSIONS
  // =====================================================

  function updateButtons() {
    const canEdit = editor();
    const isAdmin = admin();

    // Team directory is public.
    const teamNav = $("teamNavBtn");

    if (teamNav) {
      teamNav.hidden = false;
      teamNav.disabled = false;
      teamNav.style.display = "";
      teamNav.removeAttribute("aria-disabled");
    }

    // Other laboratory editing permissions.
    document.querySelectorAll(
      "#editBtn,#importFile,#reset"
    ).forEach(el => {
      el.disabled = !canEdit;
      el.title = canEdit
        ? ""
        : "يتطلب تسجيل الدخول بصلاحية التعديل";
    });

    // Team editing is restricted to the root admin.
    document.querySelectorAll(
      "#teamAdd,#teamImport"
    ).forEach(el => {
      el.hidden = !isAdmin;
      el.disabled = !isAdmin;
      el.style.display = isAdmin ? "" : "none";
    });

    const importInput = $("teamImport");

    if (importInput) {
      const label = importInput.closest("label");

      if (label) {
        label.hidden = !isAdmin;
        label.style.display = isAdmin ? "" : "none";
      }
    }

    document.querySelectorAll(
      "#teamCards [data-edit]," +
      "#teamCards [data-delete]"
    ).forEach(el => {
      el.hidden = !isAdmin;
      el.disabled = !isAdmin;
      el.style.display = isAdmin ? "" : "none";
    });

    // Hide the editing form for visitors.
    if (!isAdmin) {
      $("teamForm")?.classList.add("hidden");
    }
  }

  // =====================================================
  // FIRESTORE DATA
  // =====================================================

  function dataRef(id) {
    return doc(db, "dashboard", id);
  }

  function parseValue(value) {
    if (typeof value === "string") {
      return JSON.parse(value);
    }

    return value;
  }

  function keyToId(key) {
    return KEYS[key] || null;
  }

  // =====================================================
  // CENTRAL SAVE
  // =====================================================

  async function write(key, value, action) {
    const id = keyToId(key);

    if (!id) {
      throw Error("مفتاح البيانات غير معروف");
    }

    // Team can be modified by root admin only.
    if (id === "team" && !admin()) {
      throw Error("تعديل فريق العمل متاح لمدير النظام فقط");
    }

    if (id !== "team" && !editor()) {
      throw Error("يجب تسجيل الدخول بصلاحية محرر");
    }

    const parsed = parseValue(value);
    const ref = dataRef(id);

    await runTransaction(db, async tx => {
      const old = await tx.get(ref);

      const revision =
        (old.exists() ? old.data().revision || 0 : 0) + 1;

      tx.set(ref, {
        value: parsed,
        revision,
        updatedAt: serverTimestamp(),
        updatedBy: user.uid,
        updatedByName: displayName()
      });
    });

    // Audit logging must not roll back a successful save.
    try {
      await addDoc(collection(db, "auditLogs"), {
        action: action || "تحديث البيانات",
        document: id,
        uid: user.uid,
        name: displayName(),
        email: user.email || "",
        at: serverTimestamp()
      });
    } catch (err) {
      console.error("Audit log error:", err);
    }

    return true;
  }

  window.centralLabSave = async (key, value, action) => {
    try {
      await write(key, value, action);

      localStorage.setItem(
        key,
        typeof value === "string"
          ? value
          : JSON.stringify(value)
      );

      return true;
    } catch (err) {
      console.error("Firebase save failed:", err);

      alert(
        "لم يُحفظ التعديل في Firebase: " + message(err)
      );

      return false;
    }
  };

  window.centralLabRemove = async (key, action) => {
    return window.centralLabSave(
      key,
      JSON.stringify(window.__LAB_DATA__),
      action
    );
  };

  // =====================================================
  // REAL-TIME FIREBASE SUBSCRIPTIONS
  // =====================================================

  /*
   centralLabSubscribe("team", callback, errorCallback)

   Works for visitors and signed-in users.
   Reads dashboard/team -> value.
  */

  window.centralLabSubscribe = (
    id,
    callback,
    errorCallback
  ) => {
    if (!["team", "labs"].includes(id)) {
      throw Error("نوع بيانات غير معروف");
    }

    if (typeof callback !== "function") {
      throw Error("يلزم تحديد دالة استقبال البيانات");
    }

    const unsubscribe = onSnapshot(
      dataRef(id),
      { includeMetadataChanges: true },
      snapshot => {
        // Do not treat cached data as confirmed server data.
        if (snapshot.metadata.fromCache) {
          console.info(
            "Waiting for Firebase server:", id
          );
          return;
        }

        if (!snapshot.exists()) {
          const err = Error(
            "مستند " + id + " غير موجود في Firebase"
          );

          console.warn(err.message);
          errorCallback?.(err);
          return;
        }

        const data = snapshot.data();

        if (!Object.prototype.hasOwnProperty.call(
          data, "value"
        )) {
          const err = Error(
            "الحقل value غير موجود في مستند " + id
          );

          errorCallback?.(err);
          return;
        }

        try {
          const value = parseValue(data.value);

          callback(value, {
            revision: data.revision || 0,
            updatedAt: data.updatedAt || null,
            updatedBy: data.updatedBy || null
          });

        } catch (err) {
          console.error("Invalid Firebase data:", err);
          errorCallback?.(err);
        }
      },
      err => {
        console.error(
          "Firebase listener error:",
          id,
          err
        );

        errorCallback?.(err);
      }
    );

    return unsubscribe;
  };

  // =====================================================
  // INTERNAL SYNCHRONIZATION
  // =====================================================

  function syncDocument(key, id) {
    const oldUnsubscribe = listeners.get(id);

    if (oldUnsubscribe) {
      oldUnsubscribe();
    }

    const unsubscribe = window.centralLabSubscribe(
      id,
      value => {
        const json = JSON.stringify(value);
        const old = localStorage.getItem(key);

        if (old !== json) {
          localStorage.setItem(key, json);
        }

        window.dispatchEvent(
          new CustomEvent("centralLabDataUpdated", {
            detail: {
              key,
              document: id,
              value
            }
          })
        );

        // Compatibility event for code listening to storage.
        if (old !== json) {
          window.dispatchEvent(
            new StorageEvent("storage", {
              key,
              oldValue: old,
              newValue: json,
              storageArea: localStorage
            })
          );
        }

        console.info(
          "Firebase data synchronized:", id
        );
      },
      err => {
        console.error(
          "Synchronization error:", id, err
        );
      }
    );

    listeners.set(id, unsubscribe);
  }

  function startSynchronization() {
    // Team is public, including users not signed in.
    syncDocument(
      "centralLabTeamMembersV1",
      "team"
    );

    // Preserve existing laboratory synchronization
    // for authenticated users.
    if (user) {
      syncDocument(
        "centralLabsDigitalTwinData",
        "labs"
      );
    } else {
      const previous = listeners.get("labs");

      if (previous) {
        previous();
        listeners.delete("labs");
      }
    }
  }

  // =====================================================
  // WELCOME
  // =====================================================

  function welcome() {
    if (!user) return;

    if (
      sessionStorage.getItem(WELCOME_KEY) === user.uid
    ) return;

    sessionStorage.setItem(WELCOME_KEY, user.uid);

    show(`
      <h2>مرحبًا بك، ${esc(displayName())}</h2>

      <p class="admin-success">
        يسعدنا انضمامك إلى منظومة المعامل المركزية
        بجامعة تبوك. تم تسجيل دخولك بنجاح.
      </p>

      <p>
        الصلاحية:
        <b>
          ${
            admin()
              ? "مدير النظام"
              : editor()
                ? "محرر"
                : "مشاهد"
          }
        </b>
      </p>

      <div class="admin-actions">
        <button
          class="admin-primary"
          id="adminContinue"
          type="button"
        >
          متابعة
        </button>

        ${
          admin()
            ? `
              <button
                class="admin-muted"
                id="adminManage"
                type="button"
              >
                إدارة النظام
              </button>
            `
            : ""
        }
      </div>
    `);

    $("adminContinue").onclick = hide;

    if (admin()) {
      $("adminManage").onclick = manage;
    }
  }

  // =====================================================
  // LOGIN
  // =====================================================

  function login() {
    show(`
      <h2>🔐 تسجيل الدخول</h2>

      <p>
        منظومة المعامل المركزية – جامعة تبوك
      </p>

      <form id="fbLogin">
        <label>البريد الإلكتروني</label>

        <input
          id="fbEmail"
          type="email"
          required
          autocomplete="username"
        >

        <label>كلمة المرور</label>

        <input
          id="fbPass"
          type="password"
          required
          autocomplete="current-password"
        >

        <p
          id="fbError"
          class="admin-error"
          role="alert"
        ></p>

        <div class="admin-actions">
          <button
            class="admin-primary"
            type="submit"
          >
            دخول
          </button>

          <button
            type="button"
            id="fbCancel"
            class="admin-muted"
          >
            إلغاء
          </button>
        </div>
      </form>
    `);

    $("fbCancel").onclick = hide;

    $("fbLogin").onsubmit = async e => {
      e.preventDefault();

      const email = $("fbEmail").value.trim();
      const password = $("fbPass").value;

      $("fbError").textContent = "جارٍ التحقق...";

      try {
        loginInProgress = true;

        await signInWithEmailAndPassword(
          auth,
          email,
          password
        );
      } catch (err) {
        loginInProgress = false;

        if ($("fbError")) {
          $("fbError").textContent = message(err);
        }
      }
    };
  }

  // =====================================================
  // ADMIN MANAGEMENT
  // =====================================================

  async function manage() {
    if (!admin()) return;

    show(`
      <div class="admin-top">
        <h2>إدارة النظام</h2>

        <button
          id="fbClose"
          type="button"
        >
          إغلاق
        </button>
      </div>

      <div class="admin-actions">
        <button
          id="fbUsers"
          class="admin-primary"
          type="button"
        >
          المستخدمون
        </button>

        <button
          id="fbLogs"
          class="admin-muted"
          type="button"
        >
          سجل النشاط
        </button>

        <button
          id="fbLogout"
          class="admin-muted"
          type="button"
        >
          تسجيل الخروج
        </button>
      </div>

      <div id="fbContent"></div>
    `);

    $("fbClose").onclick = hide;
    $("fbUsers").onclick = renderUsers;
    $("fbLogs").onclick = renderLogs;

    $("fbLogout").onclick = async () => {
      try {
        await signOut(auth);
        hide();
      } catch (err) {
        alert(message(err));
      }
    };

    renderUsers();
  }

  // =====================================================
  // USER MANAGEMENT
  // =====================================================

  async function renderUsers() {
    if (!admin()) return;

    const el = $("fbContent");
    if (!el) return;

    el.innerHTML = `
      <h3>إضافة مستخدم</h3>

      <form id="fbAdd">
        <label>الاسم</label>
        <input id="fbName" required>

        <label>البريد الإلكتروني</label>
        <input
          id="fbNewEmail"
          type="email"
          required
        >

        <label>
          كلمة مرور أولية (6 أحرف على الأقل)
        </label>

        <input
          id="fbNewPass"
          type="password"
          minlength="6"
          required
        >

        <label>الصلاحية</label>

        <select id="fbRole">
          <option value="editor">محرر</option>
          <option value="viewer">مشاهد</option>
        </select>

        <div class="admin-actions">
          <button
            class="admin-primary"
            type="submit"
          >
            إضافة مستخدم
          </button>
        </div>

        <p id="fbAddError" role="status"></p>
      </form>

      <div id="fbUserList"></div>
    `;

    $("fbAdd").onsubmit = async e => {
      e.preventDefault();

      const name = $("fbName").value.trim();
      const email = $("fbNewEmail").value.trim();
      const pass = $("fbNewPass").value;
      const role = $("fbRole").value;

      const status = $("fbAddError");

      let secondary = null;

      try {
        status.textContent = "جارٍ إنشاء الحساب...";

        secondary = initializeApp(
          config,
          "central-lab-user-provisioning"
        );

        const secondaryAuth = getAuth(secondary);

        const cred =
          await createUserWithEmailAndPassword(
            secondaryAuth,
            email,
            pass
          );

        await setDoc(
          doc(db, "users", cred.user.uid),
          {
            name,
            email,
            role,
            createdAt: serverTimestamp(),
            createdBy: ROOT
          }
        );

        await signOut(secondaryAuth);

        if (status.isConnected) {
          status.textContent = "تم إنشاء الحساب بنجاح";
        }

        await renderUsers();

      } catch (err) {
        if (status.isConnected) {
          status.textContent = message(err);
        } else {
          alert(message(err));
        }

      } finally {
        if (secondary) {
          await deleteApp(secondary).catch(
            console.error
          );
        }
      }
    };

    try {
      const snap = await getDocs(
        collection(db, "users")
      );

      const list = $("fbUserList");
      if (!list) return;

      list.innerHTML =
        "<h3>الحسابات</h3>" +
        snap.docs.map(d => `
          <div class="admin-item">
            <b>
              ${esc(
                d.data().name ||
                d.data().email
              )}
            </b>

            <small>
              ${esc(d.data().role || "viewer")}
            </small>
          </div>
        `).join("");

    } catch (err) {
      if ($("fbUserList")) {
        $("fbUserList").textContent = message(err);
      }
    }
  }

  // =====================================================
  // AUDIT LOGS
  // =====================================================

  async function renderLogs() {
    if (!admin()) return;

    const el = $("fbContent");
    if (!el) return;

    el.innerHTML = `
      <h3>سجل نشاط المستخدمين</h3>

      <p>
        سجل مركزي محفوظ في Firebase
      </p>

      <div id="fbLogList">
        جارٍ التحميل...
      </div>
    `;

    try {
      const snap = await getDocs(
        query(
          collection(db, "auditLogs"),
          orderBy("at", "desc"),
          limit(200)
        )
      );

      const list = $("fbLogList");
      if (!list) return;

      list.innerHTML =
        snap.docs.map(d => {
          const x = d.data();

          const date = x.at?.toDate?.()
            ?.toLocaleString("ar-SA") ||
            "قيد الحفظ";

          return `
            <div class="admin-item">
              <div>
                <b>${esc(x.action)}</b>

                <small>
                  ${esc(x.name)} ·
                  ${esc(date)}
                </small>
              </div>
            </div>
          `;
        }).join("") || "لا توجد سجلات";

    } catch (err) {
      if ($("fbLogList")) {
        $("fbLogList").textContent = message(err);
      }
    }
  }

  // =====================================================
  // ADMIN ENTRY BUTTON
  // =====================================================

  let entry = $("adminEntry");

  if (!entry) {
    entry = document.createElement("button");
    entry.id = "adminEntry";
    entry.className = "admin-entry";
    entry.type = "button";
    entry.textContent = "🔐 Admin";

    document
      .querySelector(".view-group")
      ?.append(entry);
  }

  entry.onclick = () => {
    if (!user) {
      login();
      return;
    }

    if (admin()) {
      manage();
      return;
    }

    show(`
      <h2>الحساب الحالي</h2>

      <p>
        المستخدم:
        <b>${esc(displayName())}</b>
      </p>

      <p>
        الصلاحية:
        <b>
          ${editor() ? "محرر" : "مشاهد"}
        </b>
      </p>

      <div class="admin-actions">
        <button
          id="fbCloseAccount"
          class="admin-primary"
          type="button"
        >
          متابعة
        </button>

        <button
          id="fbAccountLogout"
          class="admin-muted"
          type="button"
        >
          تسجيل الخروج
        </button>
      </div>
    `);

    $("fbCloseAccount").onclick = hide;

    $("fbAccountLogout").onclick = async () => {
      await signOut(auth);
      hide();
    };
  };

  // =====================================================
  // AUTHENTICATION LISTENER
  // =====================================================

  onAuthStateChanged(auth, async u => {
    const version = ++authVersion;
    const previousUid = user?.uid || null;

    user = u;
    profile = null;

    if (!u) {
      loginInProgress = false;
      sessionStorage.removeItem(WELCOME_KEY);

      updateButtons();
      authChanged();
      startSynchronization();

      return;
    }

    if (
      previousUid &&
      previousUid !== u.uid
    ) {
      sessionStorage.removeItem(WELCOME_KEY);
    }

    if (!admin()) {
      try {
        const snap = await getDoc(
          doc(db, "users", u.uid)
        );

        if (version !== authVersion) return;

        profile = snap.exists()
          ? snap.data()
          : null;

      } catch (err) {
        console.error(
          "User profile error:",
          err
        );
      }

    } else {
      profile = {
        name: "د. خليل السعيد",
        role: "admin"
      };
    }

    if (version !== authVersion) return;

    updateButtons();
    authChanged();
    startSynchronization();

    if (loginInProgress) {
      loginInProgress = false;
      welcome();
    }
  });

  // =====================================================
  // PROTECT EDITING ACTIONS
  // =====================================================

  document.addEventListener(
    "click",
    e => {
      const target = e.target.closest(
        "#editBtn,#teamAdd," +
        "#teamCards [data-edit]," +
        "#teamCards [data-delete]," +
        "#save,#reset"
      );

      if (!target) return;

      const teamAction = !!target.closest(
        "#teamAdd,#teamCards [data-edit]," +
        "#teamCards [data-delete]"
      );

      const permitted = teamAction
        ? admin()
        : editor();

      if (!permitted) {
        e.preventDefault();
        e.stopImmediatePropagation();

        if (!user) {
          login();
        } else {
          alert("لا تمتلك صلاحية تعديل البيانات");
        }
      }
    },
    true
  );

  document.addEventListener(
    "submit",
    e => {
      if (
        e.target.id === "teamForm" &&
        !admin()
      ) {
        e.preventDefault();
        e.stopImmediatePropagation();

        if (!user) {
          login();
        } else {
          alert(
            "تعديل فريق العمل متاح لمدير النظام فقط"
          );
        }
      }
    },
    true
  );

  // =====================================================
  // CLEANUP
  // =====================================================

  window.addEventListener("pagehide", () => {
    listeners.forEach(unsubscribe => {
      unsubscribe();
    });

    listeners.clear();
  });

  // Initial permissions while Firebase restores auth.
  updateButtons();

  console.info(
    "Central Laboratory Firebase administration initialized"
  );

})();
