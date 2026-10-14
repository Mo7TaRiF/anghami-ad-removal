(() => {
  // منع التحميل المزدوج (يحل خطأ: Identifier 'targetToObserve' has already been declared)
  if (window.__anghamiAdRemoverLoaded) return;
  window.__anghamiAdRemoverLoaded = true;

  // عناصر يجب ألا تُحذف أبدًا (reCAPTCHA / hCaptcha)
  const PROTECTED = [
    "iframe[src*='recaptcha']",
    "iframe[src*='gstatic.com/recaptcha']",
    "iframe[src*='hcaptcha']",
    ".grecaptcha-badge",
    ".g-recaptcha",
    "[class*='recaptcha']",
    "[id*='recaptcha']",
    "[class*='captcha']",
    "[id*='captcha']"
  ].join(", ");

  function isProtected(el) {
    try {
      return el.matches(PROTECTED) || !!el.closest(PROTECTED) || !!el.querySelector(PROTECTED);
    } catch (e) {
      return false;
    }
  }

  function removeItems(items) {
    items.forEach((item) => {
      if (!isProtected(item)) item.remove();
    });
  }

  function hideItems(items) {
    items.forEach((item) => {
      if (isProtected(item)) return;
      item.style.visibility = "hidden";
      item.style.display = "none";
    });
  }

  function clickEl(el) {
    try {
      el.click();
    } catch (e) {
      el.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true, view: window }));
    }
  }

  function googleIframesRemover() {
    removeItems(
      document.querySelectorAll(
        "iframe[name^='google_ads'], iframe[src*='googlead'], iframe[src*='doubleclick'], iframe[id^='google_ads']"
      )
    );
  }

  function removeAdContainers() {
    removeItems(
      document.querySelectorAll(
        "anghami-ads, [class^='ad-'], [class*=' ad-'], [id^='ad-'], [class*='ads-'], [id*='ads-']"
      )
    );
  }

  function removeAllAdElements() {
    const selectors = [
      "[class*='ad-container']", "[class*='ad-wrapper']", "[class*='ad-slot']",
      "[class*='ad-banner']", "[class*='advert']", "[id*='ad-container']",
      "[id*='ad-wrapper']", "[id*='ad-slot']", "[id*='ad-banner']", "[id*='advert']",
      "[data-ad]", "[data-ads]", "[data-adunit]", "[aria-label*='advertisement']"
    ];
    removeItems(document.querySelectorAll(selectors.join(", ")));
  }

  function skipAds() {
    document
      .querySelectorAll("button[class*='skip'], div[class*='skip'], span[class*='skip'], a[class*='skip']")
      .forEach((b) => {
        if (!isProtected(b)) clickEl(b);
      });
  }

  function pressPlay() {
    // محدد دقيق فقط حتى لا يتم الضغط على أزرار play أخرى بالخطأ
    const playButton = document.querySelector(".play-pause-cont .play");
    if (playButton) clickEl(playButton);
  }

  function muteVideoAds() {
    document
      .querySelectorAll("#native-ad-video, video[src*='/ad'], video[class*='ad-'], video[id*='ad-']")
      .forEach((videoAd) => {
        videoAd.muted = true;
        videoAd.volume = 0;
        if (videoAd.duration && isFinite(videoAd.duration)) {
          videoAd.currentTime = videoAd.duration;
        }
        if (!videoAd.__adHooked) {
          videoAd.__adHooked = true;
          videoAd.addEventListener("play", (e) => {
            e.target.muted = true;
            e.target.volume = 0;
            hideAdModals();
            skipAds();
            pressPlay();
          });
        }
      });
  }

  function cleanupModalState() {
    document.body.classList.remove("modal-open");
    document.body.style.removeProperty("overflow");
    document.body.style.removeProperty("padding-right");
  }

  // إغلاق نافذة الإعلان بين الأغاني بالطريقة التي يفهمها Angular، ثم الحذف بالقوة كحل أخير
  function dismissAdModal() {
    const modals = new Set();
    document.querySelectorAll("ngb-modal-window[class*='native-dfp-ad'], anghami-ads-modal").forEach((el) => {
      const m = el.closest("ngb-modal-window") || el;
      if (!isProtected(m)) modals.add(m);
    });

    modals.forEach((modal) => {
      modal.__dismissTries = (modal.__dismissTries || 0) + 1;

      if (modal.__dismissTries <= 2) {
        // 1) زر إغلاق إن وُجد
        modal
          .querySelectorAll("button.close, [aria-label='Close'], [aria-label='close'], [class*='close']")
          .forEach(clickEl);
        // 2) مفتاح Escape (ngb-modal يغلق عليه)
        ["keydown", "keyup"].forEach((type) =>
          modal.dispatchEvent(
            new KeyboardEvent(type, { key: "Escape", code: "Escape", keyCode: 27, which: 27, bubbles: true })
          )
        );
        // 3) نقرة على الخلفية (ngb-modal-window نفسه)
        modal.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true, view: window }));
      } else {
        // 4) حل أخير: حذف النافذة والخلفية وتنظيف حالة الصفحة
        modal.remove();
        document.querySelectorAll("ngb-modal-backdrop").forEach((b) => b.remove());
        cleanupModalState();
        setTimeout(pressPlay, 300);
      }
    });
  }

  function hideAdModals() {
    cleanupModalState();
    dismissAdModal();
  }

  function removeLeaderboard() {
    removeItems(document.querySelectorAll(".player-leaderboard, div[class*='leaderboard']"));
  }

  function removePopups() {
    // بدون [class*='modal'] العامة حتى لا تُحذف نوافذ تسجيل الدخول والتحقق
    removeItems(document.querySelectorAll("[class*='ad-popup'], [class*='ads-popup'], [id*='ad-popup']"));
  }

  function removeOverlays() {
    document.querySelectorAll("[class*='overlay'], [id*='overlay']").forEach((el) => {
      if (isProtected(el)) return;
      const style = window.getComputedStyle(el);
      if (
        (style.position === "fixed" || style.position === "absolute") &&
        parseInt(style.zIndex) > 100 &&
        el.offsetWidth > window.innerWidth * 0.5 &&
        el.offsetHeight > window.innerHeight * 0.3 &&
        /ad|promo|upgrade|premium/i.test(el.className + " " + el.id)
      ) {
        el.remove();
      }
    });
  }

  function optimizePage() {
    if (!document.body) return;
    dismissAdModal();
    googleIframesRemover();
    removeAdContainers();
    removeAllAdElements();
    skipAds();
    pressPlay();
    muteVideoAds();
    removeLeaderboard();
    removePopups();
    removeOverlays();
  }

  // Debounce: لا نشغّل الفحص عند كل تغيير في الصفحة (كان يسبب بطء وتعارض مع reCAPTCHA)
  let timer = null;
  function schedule() {
    if (timer) return;
    timer = setTimeout(() => {
      timer = null;
      optimizePage();
    }, 300);
  }

  function start() {
    optimizePage();
    new MutationObserver(schedule).observe(document.body, { childList: true, subtree: true });
    setInterval(optimizePage, 1000);
  }

  if (document.body) start();
  else document.addEventListener("DOMContentLoaded", start, { once: true });
})();
