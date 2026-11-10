
  // Firebase realtime synchronization
  // الاتصال المباشر دون مهلة انتهاء

  let teamFirebaseConnected = false;
  let teamSubscriptionStarted = false;

  function connect() {
    if (teamSubscriptionStarted) return;

    if (
      typeof window.centralLabSubscribe !== "function"
    ) {
      status("جارٍ الاتصال بخدمة Firebase...");
      return;
    }

    teamSubscriptionStarted = true;

    try {
      window.centralLabSubscribe(
        "team",

        value => {
          try {
            members = parseValue(value);
            ready = true;
            teamFirebaseConnected = true;

            render();

            status(
              `تمت مزامنة ${members.length} عضوًا من Firebase`
            );

          } catch (error) {
            ready = false;
            teamFirebaseConnected = false;

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
          teamFirebaseConnected = false;

          permissions();

          status(
            "تعذر الاتصال ببيانات الفريق: " +
            (
              error?.code ||
              error?.message ||
              "خطأ غير معروف"
            ),
            true
          );
        }
      );

    } catch (error) {
      teamSubscriptionStarted = false;

      status(
        "تعذر بدء مزامنة الفريق: " +
        error.message,
        true
      );
    }
  }

  // يعمل عند اكتمال تحميل Firebase
  window.addEventListener(
    "centralLabFirebaseReady",
    connect
  );

  // يعرض أخطاء Firebase الحقيقية
  window.addEventListener(
    "centralLabFirebaseError",
    event => {
      if (!teamFirebaseConnected) {
        status(
          "فشل تحميل Firebase: " +
          (
            event.detail ||
            "خطأ غير معروف"
          ),
          true
        );
      }
    }
  );

  // محاولة الاتصال فورًا
  connect();
