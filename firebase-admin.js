
/*
 * CENTRAL LABORATORY — UNIVERSITY OF TABUK
 * firebase-admin.js
 *
 * Firebase Authentication + Firestore
 * Public realtime team synchronization
 * Admin-only team editing
 * Dashboard administration
 *
 * Firestore:
 *   dashboard/team
 *   dashboard/labs
 *   users/{uid}
 *   auditLogs/{id}
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

  const WELCOME_KEY = "centralLabWelcomeShown";

  const $ = id => document.getElementById(id);

  const esc = value => String(value ?? "").replace(
    /[&<>"']/g,
    c => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;"
    }[c])
  );

  // Public interfaces are registered immediately,
  // so team.js can find them even while Firebase loads.

  let firebaseReady = false;
  let user = null;
  let profile = null;
  let authVersion = 0;
  let loginInProgress = false;

  let auth = null;
  let db = null;

  let firestoreAPI = null;
  let authAPI = null;
  let appAPI = null;

  const listeners = new Map();
  const snapshots = new Map();
  const callbacks = new Map();

  let labsUnsubscribe = null;

  function admin() {
    return !!user && user.uid === ROOT;
  }

  function editor() {
    return !!user && (
      admin() || profile?.role === "editor"
    );
  }

  function canEditDocument(id) {
    if (id === "team") return admin();
    return editor();
  }

  function displayName() {
    return profile?.name || user?.email || "مستخدم";
  }

  function message(err) {
    const errors = {
      "auth/invalid-credential": "بيانات الدخول غير صحيحة",
      "auth/email-already-in-use": "البريد مستخدم بالفعل",
      "auth/weak-password": "كلمة المرور ضعيفة",
      "permission-denied": "لا توجد صلاحية لإجراء العملية",
      "unavailable": "تعذر الاتصال بخدمة Firebase"
    };

    return errors[err?.code] ||
      err?.message ||
      "تعذرت العملية";
  }

  window.centralLabIsAdmin = () => admin();
  window.centralLabIsEditor = () => editor();

  function notifyAuth() {
    window.dispatchEvent(
      new CustomEvent("centralLabAuthChanged", {
        detail: {
          authenticated: !!user,
          admin: admin(),
          editor: editor()
        }
      })
    );
  }

  function notifySubscribers(id, value) {
    const registered = callbacks.get(id);

    if (!registered) return;

    for (const item of registered) {
      try {
        item.callback(value);
      } catch (err) {
        console.error(
          "Team rendering callback error:",
          err
        );
      }
    }
  }

  function notifyErrors(id, error) {
    const registered = callbacks.get(id);

    if (!registered) return;

    for (const item of registered) {
      try {
        item.onError?.(error);
      } catch (err) {
        console.error(err);
      }
    }
  }

  function startListener(id) {
    if (!firebaseReady || listeners.has(id)) {
      return;
    }

    const {
      doc,
      onSnapshot
    } = firestoreAPI;

    const unsubscribe = onSnapshot(
      doc(db, "dashboard", id),

      snapshot => {
        if (!snapshot.exists()) {
          notifyErrors(
            id,
            new Error(
              "مستند dashboard/" + id + " غير موجود"
            )
          );
          return;
        }

        const data = snapshot.data();

        if (!Object.prototype.hasOwnProperty.call(
          data,
          "value"
        )) {
          notifyErrors(
            id,
            new Error("الحقل value غير موجود")
          );
          return;
        }

        const value = data.value;

        snapshots.set(id, value);

        const key = Object.keys(KEYS).find(
          k => KEYS[k] === id
        );

        if (key) {
          try {
            localStorage.setItem(
              key,
              JSON.stringify(value)
            );
          } catch (err) {
            console.warn(
              "Local cache unavailable:",
              err
            );
          }
        }

        notifySubscribers(id, value);

        console.info(
          "Firebase data synchronized:",
          id
        );
      },

      error => {
        console.error(
          "Firebase listener error:",
          id,
          error
        );

        listeners.delete(id);
        notifyErrors(id, error);
      }
    );

    listeners.set(id, unsubscribe);
  }

  /*
   * Compatible with:
   *
   * centralLabSubscribe(
   *   "team",
   *   value => render(value),
   *   error => showError(error)
   * )
   *
   * Also accepts:
   * centralLabSubscribe("centralLabTeamMembersV1", ...)
   */

  window.centralLabSubscribe = (
    requestedId,
    callback,
    onError
  ) => {
    const id = KEYS[requestedId] || requestedId;

    if (!["team", "labs"].includes(id)) {
      throw new Error(
        "Unknown dashboard document: " + id
      );
    }

    if (typeof callback !== "function") {
      throw new TypeError(
        "Subscription callback must be a function"
      );
    }

    const item = { callback, onError };

    if (!callbacks.has(id)) {
      callbacks.set(id, new Set());
    }

    callbacks.get(id).add(item);

    if (snapshots.has(id)) {
      try {
        callback(snapshots.get(id));
      } catch (err) {
        console.error(err);
      }
    }

    startListener(id);

    return () => {
      callbacks.get(id)?.delete(item);

      if (
        callbacks.get(id)?.size === 0 &&
        id !== "team"
      ) {
        listeners.get(id)?.();
        listeners.delete(id);
      }
    };
  };

  // Public team listener remains active without login.

  function startPublicSynchronization() {
    startListener("team");
  }

  function startPrivateSynchronization() {
    if (!user) {
      if (labsUnsubscribe) {
        labsUnsubscribe();
        labsUnsubscribe = null;
      }

      return;
    }

    startListener("labs");
  }

  // Overlay for authentication and administration.

  const overlay = document.createElement("div");
  overlay.id = "adminOverlay";
  overlay.className = "admin-overlay";
  overlay.style.display = "none";

  document.body.appendChild(overlay);

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

  function updateButtons() {
    const dashboardEditor = editor();
    const teamAdmin = admin();

    document.querySelectorAll(
      "#editBtn,#importFile,#reset"
    ).forEach(el => {
      el.disabled = !dashboardEditor;
      el.title = dashboardEditor
        ? ""
        : "يتطلب صلاحية التعديل";
    });

    document.querySelectorAll(
      "#teamAdd,#teamImport"
    ).forEach(el => {
      el.disabled = !teamAdmin;
      el.hidden = !teamAdmin;
      el.style.display = teamAdmin ? "" : "none";
    });

    document.querySelectorAll(
      "#teamCards [data-edit],#teamCards [data-delete]"
    ).forEach(el => {
      el.disabled = !teamAdmin;
      el.hidden = !teamAdmin;
      el.style.display = teamAdmin ? "" : "none";
    });

    notifyAuth();
  }

  function welcome() {
    if (!user) return;

    if (
      sessionStorage.getItem(WELCOME_KEY) ===
      user.uid
    ) {
      return;
    }

    sessionStorage.setItem(
      WELCOME_KEY,
      user.uid
    );

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

        await authAPI.signInWithEmailAndPassword(
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

  /*
   * Firestore write:
   * Team: root administrator only
   * Labs: administrator or editor
   *
   * Does not overwrite existing data automatically.
   */

  async function write(key, value, action) {
    const id = KEYS[key];

    if (!id) {
      throw new Error(
        "مفتاح البيانات غير معروف"
      );
    }

    if (!canEditDocument(id)) {
      throw new Error(
        "لا تمتلك صلاحية تعديل " + id
      );
    }

    if (!firebaseReady) {
      throw new Error(
        "Firebase لم يكتمل تحميله"
      );
    }

    const parsed =
      typeof value === "string"
        ? JSON.parse(value)
        : value;

    const {
      doc,
      runTransaction,
      serverTimestamp,
      addDoc,
      collection
    } = firestoreAPI;

    const ref = doc(db, "dashboard", id);

    await runTransaction(db, async tx => {
      const previous = await tx.get(ref);

      const revision =
        Number(
          previous.exists()
            ? previous.data().revision || 0
            : 0
        ) + 1;

      tx.set(ref, {
        value: parsed,
        revision,
        updatedAt: serverTimestamp(),
        updatedBy: user.uid,
        updatedByName: displayName()
      });
    });

    try {
      await addDoc(
        collection(db, "auditLogs"),
        {
          action: action || "تحديث البيانات",
          document: id,
          uid: user.uid,
          name: displayName(),
          email: user.email,
          at: serverTimestamp()
        }
      );
    } catch (err) {
      console.error(
        "Audit log error:",
        err
      );
    }

    try {
      localStorage.setItem(
        key,
        JSON.stringify(parsed)
      );
    } catch (err) {
      console.warn(err);
    }

    return true;
  }

  window.centralLabSave = async (
    key,
    value,
    action
  ) => {
    // Reject failures so team.js cannot
    // report a successful save incorrectly.
    return write(key, value, action);
  };

  window.centralLabRemove = async (
    key,
    action
  ) => {
    if (key === "centralLabTeamMembersV1") {
      throw new Error(
        "لا يمكن إعادة تعيين فريق العمل تلقائيًا"
      );
    }

    return write(
      key,
      JSON.stringify(window.__LAB_DATA__),
      action || "استعادة البيانات"
    );
  };

  // Admin management interface.

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
        await authAPI.signOut(auth);
        hide();
      } catch (err) {
        alert(message(err));
      }
    };

    renderUsers();
  }

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
        status.textContent =
          "جارٍ إنشاء الحساب...";

        secondary = appAPI.initializeApp(
          config,
          "central-lab-user-provisioning"
        );

        const secondaryAuth =
          authAPI.getAuth(secondary);

        const credential =
          await authAPI.createUserWithEmailAndPassword(
            secondaryAuth,
            email,
            pass
          );

        await firestoreAPI.setDoc(
          firestoreAPI.doc(
            db,
            "users",
            credential.user.uid
          ),
          {
            name,
            email,
            role,
            createdAt:
              firestoreAPI.serverTimestamp(),
            createdBy: ROOT
          }
        );

        await authAPI.signOut(
          secondaryAuth
        );

        if (status.isConnected) {
          status.textContent =
            "تم إنشاء الحساب بنجاح";
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
          await appAPI.deleteApp(
            secondary
          ).catch(console.error);
        }
      }
    };

    try {
      const snapshot =
        await firestoreAPI.getDocs(
          firestoreAPI.collection(
            db,
            "users"
          )
        );

      const list = $("fbUserList");
      if (!list) return;

      list.innerHTML =
        "<h3>الحسابات</h3>" +
        snapshot.docs.map(d => {
          const x = d.data();

          return `
            <div class="admin-item">
              <b>
                ${esc(x.name || x.email)}
              </b>

              <small>
                ${esc(x.role || "viewer")}
              </small>
            </div>
          `;
        }).join("");

    } catch (err) {
      if ($("fbUserList")) {
        $("fbUserList").textContent =
          message(err);
      }
    }
  }

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
      const snapshot =
        await firestoreAPI.getDocs(
          firestoreAPI.query(
            firestoreAPI.collection(
              db,
              "auditLogs"
            ),
            firestoreAPI.orderBy(
              "at",
              "desc"
            ),
            firestoreAPI.limit(200)
          )
        );

      const list = $("fbLogList");
      if (!list) return;

      list.innerHTML =
        snapshot.docs.map(d => {
          const x = d.data();

          const date =
            x.at?.toDate?.()
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
        }).join("") ||
        "لا توجد سجلات";

    } catch (err) {
      if ($("fbLogList")) {
        $("fbLogList").textContent =
          message(err);
      }
    }
  }

  // Single admin entry button.

  let entry = $("adminEntry");

  if (!entry) {
    entry = document.createElement("button");
    entry.id = "adminEntry";
    entry.className = "admin-entry";
    entry.type = "button";
    entry.textContent = "🔐 Admin";

    document.querySelector(
      ".view-group"
    )?.append(entry);
  }

  entry.onclick = () => {
    if (!firebaseReady) {
      alert(
        "يرجى انتظار اكتمال اتصال Firebase"
      );
      return;
    }

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

    $("fbAccountLogout").onclick =
      async () => {
        await authAPI.signOut(auth);
        hide();
      };
  };

  // Protect editing from unauthorized UI actions.
  // Firestore Security Rules must independently
  // enforce these permissions.

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

      const isTeamAction =
        !!target.closest(
          "#teamAdd,#teamCards [data-edit]," +
          "#teamCards [data-delete]"
        );

      const allowed = isTeamAction
        ? admin()
        : editor();

      if (!allowed) {
        e.preventDefault();
        e.stopImmediatePropagation();

        if (!user && firebaseReady) {
          login();
        } else {
          alert(
            "لا تمتلك صلاحية تعديل البيانات"
          );
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

        if (!user && firebaseReady) {
          login();
        } else {
          alert(
            "تعديل فريق العمل متاح للمدير فقط"
          );
        }
      }
    },
    true
  );

  // Load Firebase SDK.

  try {
    const [
      firebaseApp,
      firebaseAuth,
      firebaseFirestore
    ] = await Promise.all([
      import(
        "https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js"
      ),
      import(
        "https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js"
      ),
      import(
        "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js"
      )
    ]);

    appAPI = firebaseApp;
    authAPI = firebaseAuth;
    firestoreAPI = firebaseFirestore;

    const app =
      firebaseApp.initializeApp(config);

    auth = firebaseAuth.getAuth(app);

    db = firebaseFirestore.getFirestore(app);

    firebaseReady = true;

    console.info(
      "Central Laboratory Firebase initialized"
    );

    // Public team synchronization starts immediately,
    // without waiting for login.

    startPublicSynchronization();

    // Start any subscriptions registered before
    // Firebase finished loading.

    for (const id of callbacks.keys()) {
      startListener(id);
    }

    firebaseAuth.onAuthStateChanged(
      auth,
      async currentUser => {
        const version = ++authVersion;
        const previousUid = user?.uid || null;

        user = currentUser;
        profile = null;

        if (!currentUser) {
          loginInProgress = false;

          sessionStorage.removeItem(
            WELCOME_KEY
          );

          if (listeners.has("labs")) {
            listeners.get("labs")();
            listeners.delete("labs");
          }

          snapshots.delete("labs");

          updateButtons();
          return;
        }

        if (
          previousUid &&
          previousUid !== currentUser.uid
        ) {
          sessionStorage.removeItem(
            WELCOME_KEY
          );
        }

        if (!admin()) {
          try {
            const snapshot =
              await firebaseFirestore.getDoc(
                firebaseFirestore.doc(
                  db,
                  "users",
                  currentUser.uid
                )
              );

            if (version !== authVersion) {
              return;
            }

            profile = snapshot.exists()
              ? snapshot.data()
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

        if (version !== authVersion) {
          return;
        }

        startPrivateSynchronization();

        updateButtons();

        // Show welcome only for explicit login.

        if (loginInProgress) {
          loginInProgress = false;
          welcome();
        }
      }
    );

    updateButtons();

    window.dispatchEvent(
      new CustomEvent(
        "centralLabFirebaseReady"
      )
    );

  } catch (error) {
    console.error(
      "Firebase initialization failed:",
      error
    );

    window.dispatchEvent(
      new CustomEvent(
        "centralLabFirebaseError",
        { detail: error.message }
      )
    );

    notifyErrors("team", error);
  }

})();
