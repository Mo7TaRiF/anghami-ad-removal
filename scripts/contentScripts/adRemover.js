(() => {
  // منع التحميل المزدوج
  if (window.__anghamiAdRemoverLoaded) return;
  window.__anghamiAdRemoverLoaded = true;

  // اجعلها false بعد الانتهاء من الفحص
  const DEBUG = true;
  const log = (...a) => DEBUG && console.log("[AdRemover]", ...a);

  const PROTECTED = [
    "iframe[src*='recaptcha']",
    "iframe[src*='gstatic.com/recaptcha']",
    "iframe[src*='hcaptcha']",
    ".adblockdetector",
    "[class*='adblockdetector']",
    "[id*='adblockdetector']",
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

  function describe(el) {
    const cls = typeof el.className === "string" && el.className.trim() ? "." + el.className.trim().split(/\s+/).join(".") : "";
    return el.tagName.toLowerCase() + (el.id ? "#" + el.id : "") + cls;
  }

  function removeEl(el, why) {
    if (isProtected(el)) return;
    log("REMOVE (" + why + "):", describe(el));
    el.remove();
  }

  function clickEl(el) {
    try {
      el.click();
    } catch (e) {
      el.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true, view: window }));
    }
  }

  // أنواع نوافذ الإعلانات المعروفة (واسعة قليلًا: أي نافذة تحمل dfp أو ad-modal أو تحتوي anghami-ads-modal)
  const AD_MODAL =
    "ngb-modal-window[class*='dfp'], ngb-modal-window[class*='ad-modal'], ngb-modal-window[class*='native-ad'], ngb-modal-window:has(anghami-ads-modal)";

  // لتسجيل أي عنصر جديد يشبه الإعلان (مرة واحدة لكل وصف) لمعرفة شكل الإعلانات غير المعروفة
  const seenLog = new Set();
  function logPossibleAds(mutations) {
    if (!DEBUG) return;
    for (const m of mutations) {
      m.addedNodes.forEach((n) => {
        if (n.nodeType !== 1) return;
        const d = describe(n);
        if (seenLog.has(d)) return;
        if (n.tagName === "NGB-MODAL-WINDOW" || /(^|[^a-z])(ad|ads|dfp|advert|promo)([^a-z]|$)/i.test(d)) {
          seenLog.add(d);
          log("NEW ELEMENT:", d, "|", (n.outerHTML || "").slice(0, 300));
        }
      });
    }
  }

  // ---- الحد الأدنى من الإزالة ----

  function removeGoogleIframes() {
    document
      .querySelectorAll("iframe[name^='google_ads'], iframe[src*='googlead'], iframe[src*='doubleclick'], iframe[id^='google_ads']")
      .forEach((f) => {
        if (f.closest("ngb-modal-window")) {
          f.style.setProperty("visibility", "hidden", "important");
        } else {
          removeEl(f, "google iframe");
        }
      });
  }

  function removeKnownAdElements() {
    document.querySelectorAll("anghami-ads, .player-leaderboard").forEach((el) => removeEl(el, "known ad element"));
  }

  function handleAdVideo() {
    document.querySelectorAll("#native-ad-video, " + AD_MODAL + " video").forEach((v) => {
      try {
        v.muted = true;
        v.volume = 0;
        // تشغيل حقيقي بأقصى سرعة بدل القفز للنهاية، حتى يُطلق المتصفح أحداث timeupdate/ended
        // التي ينتظرها التطبيق (وعندها يظهر زر الإغلاق)
        if (v.src) {
          v.playbackRate = 16;
          if (v.paused && !v.ended) {
            const p = v.play();
            if (p && p.catch) p.catch(() => {});
          }
        }
      } catch (e) {}
    });
  }

  function skipAds() {
    document
      .querySelectorAll(AD_MODAL + " [class*='skip'], anghami-ads [class*='skip'], anghami-ads-modal [class*='skip']")
      .forEach((b) => {
        if (!isProtected(b)) clickEl(b);
      });
  }

  function cleanupModalState() {
    document.body.classList.remove("modal-open");
    document.body.style.removeProperty("overflow");
    document.body.style.removeProperty("padding-right");
  }

  // نافذة الإعلان: مخفية بالـ CSS، ونمنحها وقتًا لتنتهي بشكل طبيعي، والحذف فقط كحل أخير
  function handleAdModal() {
    document.querySelectorAll(AD_MODAL).forEach((modal) => {
      if (isProtected(modal)) return;
      modal.__t0 = modal.__t0 || Date.now();
      const elapsed = Date.now() - modal.__t0;

      // زر الإغلاق الحقيقي في نافذة الإعلان (div وليس button): نضغطه كلما وُجد، مرة كل ثانية
      const closeBtn = modal.querySelector("#native-ad-close-ad-button");
      if (closeBtn && Date.now() - (modal.__lastClose || 0) > 1000) {
        modal.__lastClose = Date.now();
        log("click #native-ad-close-ad-button");
        clickEl(closeBtn);
      }

      if (elapsed > 3000 && !modal.__closed) {
        modal.__closed = true;
        log("no close button yet after 3s, trying Escape. Modal HTML:", modal.innerHTML.slice(0, 700));
        modal.querySelectorAll("button.close, [aria-label='Close'], [aria-label='close']").forEach(clickEl);
        ["keydown", "keyup"].forEach((type) =>
          modal.dispatchEvent(new KeyboardEvent(type, { key: "Escape", code: "Escape", keyCode: 27, which: 27, bubbles: true }))
        );
      }
      if (elapsed > 8000) {
        log("force removing ad modal");
        modal.remove();
        document.querySelectorAll("ngb-modal-backdrop").forEach((b) => b.remove());
        cleanupModalState();
      }
    });
  }

  function pressPlay() {
    const playButton = document.querySelector(".play-pause-cont .play");
    if (playButton) {
      log("press play");
      clickEl(playButton);
    }
  }

  function injectHidingStyle() {
    if (document.getElementById("anghami-adblock-style")) return;
    const style = document.createElement("style");
    style.id = "anghami-adblock-style";
    style.textContent = `
      ${AD_MODAL} { opacity: 0 !important; pointer-events: none !important; }
      body:has(ngb-modal-window[class*='dfp']) ngb-modal-backdrop,
      body:has(ngb-modal-window[class*='ad-modal']) ngb-modal-backdrop,
      body:has(anghami-ads-modal) ngb-modal-backdrop { opacity: 0 !important; pointer-events: none !important; }
      body:has(ngb-modal-window[class*='dfp']),
      body:has(ngb-modal-window[class*='ad-modal']),
      body:has(anghami-ads-modal) { overflow: auto !important; }
    `;
    (document.head || document.documentElement).appendChild(style);
  }

  let adWasPresent = false;

  function optimizePage() {
    if (!document.body) return;
    const adPresent = !!document.querySelector(AD_MODAL + ", anghami-ads-modal");
    if (adPresent && !adWasPresent) log("ad modal appeared");
    if (!adPresent && adWasPresent) {
      log("ad modal gone");
      setTimeout(pressPlay, 800);
    }
    adWasPresent = adPresent;

    handleAdModal();
    handleAdVideo();
    removeGoogleIframes();
    removeKnownAdElements();
    skipAds();
  }

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
    new MutationObserver((mutations) => {
      logPossibleAds(mutations);
      schedule();
    }).observe(document.body, { childList: true, subtree: true });
    setInterval(optimizePage, 1500);
  }

  if (document.body) start();
  else document.addEventListener("DOMContentLoaded", start, { once: true });
})();
