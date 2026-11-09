
/* Firebase-backed administration */
(async () => {
  'use strict';

  const config = {
    apiKey: 'AIzaSyDtr0qH-_87XYw26_b2wMjXaIhJC--9xbs',
    authDomain: 'centrallabuniversity-of-tabuk.firebaseapp.com',
    projectId: 'centrallabuniversity-of-tabuk',
    appId: '1:833984703398:web:fdb2e3de00e403340abd67'
  };

  const ROOT = 'zPzvmsBu9GTbQTc0njW62lOplr93';

  const KEYS = {
    centralLabsDigitalTwinData: 'labs',
    centralLabTeamMembersV1: 'team'
  };

  const [
    { initializeApp, deleteApp },
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
      setDoc,
      collection,
      addDoc,
      onSnapshot,
      query,
      orderBy,
      limit,
      serverTimestamp,
      runTransaction
    }
  ] = await Promise.all([
    import('https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js'),
    import('https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js'),
    import('https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js')
  ]);

  const app = initializeApp(config);
  const auth = getAuth(app);
  const db = getFirestore(app);

  const $ = id => document.getElementById(id);

  const esc = s => String(s ?? '').replace(
    /[&<>"']/g,
    c => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;'
    }[c])
  );

  let user = null;
  let profile = null;
  let unsubs = [];
  let authVersion = 0;
  let loginInProgress = false;

  const WELCOME_KEY = 'centralLabWelcomeShown';

  const overlay = document.createElement('div');
  overlay.id = 'adminOverlay';
  overlay.className = 'admin-overlay';
  overlay.style.display = 'none';
  document.body.append(overlay);

  function show(html) {
    overlay.innerHTML =
      '<section class="admin-panel" role="dialog" aria-modal="true">' +
      html +
      '</section>';

    overlay.style.display = 'flex';
  }

  function hide() {
    overlay.style.display = 'none';
  }

  function message(err) {
    return ({
      'auth/invalid-credential': 'بيانات الدخول غير صحيحة',
      'auth/email-already-in-use': 'البريد مستخدم بالفعل',
      'auth/weak-password': 'كلمة المرور ضعيفة',
      'permission-denied': 'لا توجد صلاحية لإجراء هذه العملية'
    }[err?.code] || err?.message || 'تعذرت العملية');
  }

  function displayName() {
    return profile?.name || user?.email || 'مستخدم';
  }

  function admin() {
    return user?.uid === ROOT;
  }

  function editor() {
    return !!user && (
      admin() || profile?.role === 'editor'
    );
  }

  function updateButtons() {
    document.querySelectorAll(
      '#editBtn,#teamAdd,#teamImport,#importFile,#reset'
    ).forEach(el => {
      el.disabled = !editor();
      el.title = editor()
        ? ''
        : 'يتطلب تسجيل الدخول بصلاحية التعديل';
    });

    document.querySelectorAll(
      '#teamCards [data-edit],#teamCards [data-delete]'
    ).forEach(el => {
      el.disabled = !editor();
    });
  }

  // Welcome is displayed only after an explicit login.
  function welcome() {
    if (!user) return;

    const welcomeId = user.uid;

    if (
      sessionStorage.getItem(WELCOME_KEY) === welcomeId
    ) {
      return;
    }

    sessionStorage.setItem(WELCOME_KEY, welcomeId);

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
              ? 'مدير النظام'
              : editor()
                ? 'محرر'
                : 'مشاهد'
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
            : ''
        }
      </div>
    `);

    $('adminContinue').onclick = hide;

    if (admin()) {
      $('adminManage').onclick = manage;
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
          <button class="admin-primary" type="submit">
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

    $('fbCancel').onclick = hide;

    $('fbLogin').onsubmit = async e => {
      e.preventDefault();

      const email = $('fbEmail').value.trim();
      const password = $('fbPass').value;

      $('fbError').textContent = 'جارٍ التحقق...';

      try {
        loginInProgress = true;

        await signInWithEmailAndPassword(
          auth,
          email,
          password
        );

        // The auth listener handles the welcome screen.
      } catch (err) {
        loginInProgress = false;

        if ($('fbError')) {
          $('fbError').textContent = message(err);
        }
      }
    };
  }

  async function write(key, value, action) {
    if (!editor()) {
      throw Error('يجب تسجيل الدخول بصلاحية محرر');
    }

    const id = KEYS[key];

    if (!id) {
      throw Error('مفتاح البيانات غير معروف');
    }

    const ref = doc(db, 'dashboard', id);

    await runTransaction(db, async tx => {
      const old = await tx.get(ref);

      const revision = (
        old.exists()
          ? old.data().revision || 0
          : 0
      ) + 1;

      tx.set(ref, {
        value: JSON.parse(value),
        revision,
        updatedAt: serverTimestamp(),
        updatedBy: user.uid,
        updatedByName: displayName()
      });
    });

    try {
      await addDoc(collection(db, 'auditLogs'), {
        action: action || 'تحديث البيانات',
        document: id,
        uid: user.uid,
        name: displayName(),
        email: user.email,
        at: serverTimestamp()
      });
    } catch (err) {
      console.error('Audit log error:', err);
    }
  }

  window.centralLabSave = async (key, value, action) => {
    try {
      await write(key, value, action);

      localStorage.setItem(key, value);

      return true;
    } catch (err) {
      alert(
        'لم يُحفظ التعديل في Firebase: ' +
        message(err)
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

  // Firebase synchronization without automatic page reload.
  function subscribe() {
    unsubs.forEach(unsubscribe => unsubscribe());
    unsubs = [];

    if (!user) return;

    Object.entries(KEYS).forEach(([key, id]) => {
      const unsubscribe = onSnapshot(
        doc(db, 'dashboard', id),

        snap => {
          if (!snap.exists()) return;

          const data = snap.data();

          if (!Object.prototype.hasOwnProperty.call(
            data,
            'value'
          )) {
            return;
          }

          const json = JSON.stringify(data.value);
          const old = localStorage.getItem(key);

          if (json === old) return;

          localStorage.setItem(key, json);

          console.info(
            'Firebase data synchronized:',
            id
          );

          // No location.reload() here.
          // Updated data will appear after a manual refresh
          // unless the application supports live rendering.
        },

        err => {
          console.error(
            'Firebase synchronization error:',
            err
          );
        }
      );

      unsubs.push(unsubscribe);
    });
  }

  async function manage() {
    if (!admin()) return;

    show(`
      <div class="admin-top">
        <h2>إدارة النظام</h2>

        <button id="fbClose" type="button">
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

    $('fbClose').onclick = hide;
    $('fbUsers').onclick = renderUsers;
    $('fbLogs').onclick = renderLogs;

    $('fbLogout').onclick = async () => {
      try {
        await signOut(auth);
        hide();
      } catch (err) {
        alert(message(err));
      }
    };

    renderUsers();
  }

  async function renderUsers() {
    if (!admin()) return;

    const el = $('fbContent');

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

    $('fbAdd').onsubmit = async e => {
      e.preventDefault();

      const name = $('fbName').value.trim();
      const email = $('fbNewEmail').value.trim();
      const pass = $('fbNewPass').value;
      const role = $('fbRole').value;

      const status = $('fbAddError');

      let secondary = null;

      try {
        if (status) {
          status.textContent = 'جارٍ إنشاء الحساب...';
        }

        secondary = initializeApp(
          config,
          'central-lab-user-provisioning'
        );

        const secondaryAuth = getAuth(secondary);

        const cred =
          await createUserWithEmailAndPassword(
            secondaryAuth,
            email,
            pass
          );

        await setDoc(
          doc(db, 'users', cred.user.uid),
          {
            name,
            email,
            role,
            createdAt: serverTimestamp(),
            createdBy: ROOT
          }
        );

        await signOut(secondaryAuth);

        if (status) {
          status.textContent = 'تم إنشاء الحساب بنجاح';
        }

        await renderUsers();
      } catch (err) {
        if (status && status.isConnected) {
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
        collection(db, 'users')
      );

      const list = $('fbUserList');

      if (!list) return;

      list.innerHTML =
        '<h3>الحسابات</h3>' +
        snap.docs.map(d => `
          <div class="admin-item">
            <b>
              ${esc(
                d.data().name ||
                d.data().email
              )}
            </b>

            <small>
              ${esc(
                d.data().role || 'viewer'
              )}
            </small>
          </div>
        `).join('');

    } catch (err) {
      if ($('fbUserList')) {
        $('fbUserList').textContent =
          message(err);
      }
    }
  }

  async function renderLogs() {
    if (!admin()) return;

    const el = $('fbContent');

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
          collection(db, 'auditLogs'),
          orderBy('at', 'desc'),
          limit(200)
        )
      );

      const list = $('fbLogList');

      if (!list) return;

      list.innerHTML =
        snap.docs.map(d => {
          const x = d.data();

          const date = x.at?.toDate?.()
            ?.toLocaleString('ar-SA') ||
            'قيد الحفظ';

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
        }).join('') ||
        'لا توجد سجلات';

    } catch (err) {
      if ($('fbLogList')) {
        $('fbLogList').textContent =
          message(err);
      }
    }
  }

  // Create one admin entry button only.
  let entry = $('adminEntry');

  if (!entry) {
    entry = document.createElement('button');
    entry.id = 'adminEntry';
    entry.className = 'admin-entry';
    entry.type = 'button';
    entry.textContent = '🔐 Admin';

    document
      .querySelector('.view-group')
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
          ${editor() ? 'محرر' : 'مشاهد'}
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

    $('fbCloseAccount').onclick = hide;

    $('fbAccountLogout').onclick = async () => {
      await signOut(auth);
      hide();
    };
  };

  // Authentication listener.
  onAuthStateChanged(auth, async u => {
    const version = ++authVersion;
    const previousUid = user?.uid || null;

    user = u;
    profile = null;

    if (!u) {
      loginInProgress = false;

      sessionStorage.removeItem(WELCOME_KEY);

      unsubs.forEach(fn => fn());
      unsubs = [];

      updateButtons();

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
        const s = await getDoc(
          doc(db, 'users', u.uid)
        );

        if (version !== authVersion) return;

        profile = s.exists()
          ? s.data()
          : null;

      } catch (err) {
        console.error(
          'User profile error:',
          err
        );
      }
    } else {
      profile = {
        name: 'د. خليل السعيد',
        role: 'admin'
      };
    }

    if (version !== authVersion) return;

    subscribe();
    updateButtons();

    // Do not show welcome when Firebase restores a session.
    // Show it only after an explicit successful login.
    if (loginInProgress) {
      loginInProgress = false;
      welcome();
    }
  });

  // Protect editing actions.
  document.addEventListener(
    'click',
    e => {
      const target = e.target.closest(
        '#editBtn,#teamAdd,' +
        '#teamCards [data-edit],' +
        '#teamCards [data-delete],' +
        '#save,#reset'
      );

      if (target && !editor()) {
        e.preventDefault();
        e.stopImmediatePropagation();

        if (!user) {
          login();
        } else {
          alert(
            'لا تمتلك صلاحية تعديل البيانات'
          );
        }
      }
    },
    true
  );

  document.addEventListener(
    'submit',
    e => {
      if (
        e.target.id === 'teamForm' &&
        !editor()
      ) {
        e.preventDefault();
        e.stopImmediatePropagation();

        if (!user) {
          login();
        } else {
          alert(
            'لا تمتلك صلاحية تعديل بيانات الفريق'
          );
        }
      }
    },
    true
  );

})();
