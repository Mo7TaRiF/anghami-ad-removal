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
    document
      .querySelectorAll(
        "iframe[name^='google_ads'], iframe[src*='googlead'], iframe[src*='doubleclick'], iframe[id^='google_ads']"
      )
      .forEach((f) => {
        if (isProtected(f)) return;
        // داخل نافذة الإعلان: نخفيه فقط حتى لا يتعطل منطق التطبيق
        if (f.closest("ngb-modal-window")) {
          f.style.setProperty("visibility", "hidden", "important");
        } else {
          f.remove();
        }
      });
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
      .querySelectorAll("#native-ad-video, ngb-modal-window video")
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

  // تسريع أي وسائط داخل نافذة الإعلان فقط (لا نلمس مشغّل الأغاني الرئيسي أبدًا)
  function fastForwardMedia(root) {
    root.querySelectorAll("video, audio").forEach((m) => {
      try {
        m.muted = true;
        m.volume = 0;
        m.playbackRate = 16;
        if (isFinite(m.duration) && m.duration > 0 && m.currentTime < m.duration - 0.1) {
          m.currentTime = m.duration;
        }
      } catch (e) {}
    });
  }

  // نافذة الإعلان تبقى في الصفحة (مخفية بالـ CSS) ونسرّع الإعلان حتى ينتهي ويكمل التطبيق للأغنية التالية.
  // الحذف بالقوة فقط كحل أخير جدًا بعد 15 ثانية.
  function dismissAdModal() {
    const modals = new Set();
    document.querySelectorAll("ngb-modal-window[class*='native-dfp-ad'], anghami-ads-modal").forEach((el) => {
      const m = el.closest("ngb-modal-window") || el;
      if (!isProtected(m)) modals.add(m);
    });

    modals.forEach((modal) => {
      modal.__t0 = modal.__t0 || Date.now();
      const elapsed = Date.now() - modal.__t0;

      fastForwardMedia(modal);

      // بعد 3 ثوانٍ: نُعلم التطبيق بانتهاء الإعلان
      if (elapsed > 3000 && !modal.__ended) {
        modal.__ended = true;
        modal.querySelectorAll("video, audio").forEach((m) => {
          ["timeupdate", "ended"].forEach((t) => m.dispatchEvent(new Event(t)));
        });
      }

      // بعد 6 ثوانٍ: نحاول الإغلاق بالطريقة الطبيعية (زر إغلاق ثم Escape)
      if (elapsed > 6000 && !modal.__closed) {
        modal.__closed = true;
        modal
          .querySelectorAll("button.close, [aria-label='Close'], [aria-label='close'], [class*='close']")
          .forEach(clickEl);
        ["keydown", "keyup"].forEach((type) =>
          modal.dispatchEvent(
            new KeyboardEvent(type, { key: "Escape", code: "Escape", keyCode: 27, which: 27, bubbles: true })
          )
        );
      }

      // بعد 15 ثانية: حل أخير
      if (elapsed > 15000) {
        modal.remove();
        document.querySelectorAll("ngb-modal-backdrop").forEach((b) => b.remove());
        cleanupModalState();
        setTimeout(pressPlay, 300);
      }
    });
  }

  // إخفاء بصري فقط (العنصر يبقى في الـ DOM)
  function injectHidingStyle() {
    if (document.getElementById("anghami-adblock-style")) return;
    const style = document.createElement("style");
    style.id = "anghami-adblock-style";
    style.textContent = `
      ngb-modal-window[class*='native-dfp-ad'] { opacity: 0 !important; pointer-events: none !important; }
      body:has(ngb-modal-window[class*='native-dfp-ad']) ngb-modal-backdrop { opacity: 0 !important; pointer-events: none !important; }
      body:has(ngb-modal-window[class*='native-dfp-ad']) { overflow: auto !important; }
    `;
    (document.head || document.documentElement).appendChild(style);
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
    injectHidingStyle();
    optimizePage();
    new MutationObserver(schedule).observe(document.body, { childList: true, subtree: true });
    setInterval(optimizePage, 1000);
  }

  if (document.body) start();
  else document.addEventListener("DOMContentLoaded", start, { once: true });
})();
