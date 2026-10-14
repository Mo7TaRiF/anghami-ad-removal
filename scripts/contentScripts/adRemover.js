(() => {
  // منع التحميل المزدوج
  if (window.__anghamiAdRemoverLoaded) return;
  window.__anghamiAdRemoverLoaded = true;

  // اجعلها false بعد الانتهاء من الفحص
  const DEBUG = false;
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

  const AD_MODAL = "ngb-modal-window[class*='native-dfp-ad']";

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
        if (isFinite(v.duration) && v.duration > 0 && v.currentTime < v.duration - 0.1) {
          v.currentTime = v.duration;
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

      if (elapsed > 6000 && !modal.__closed) {
        modal.__closed = true;
        log("closing ad modal (button/Escape)");
        modal.querySelectorAll("button.close, [aria-label='Close'], [aria-label='close']").forEach(clickEl);
        ["keydown", "keyup"].forEach((type) =>
          modal.dispatchEvent(new KeyboardEvent(type, { key: "Escape", code: "Escape", keyCode: 27, which: 27, bubbles: true }))
        );
      }
      if (elapsed > 15000) {
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
      body:has(${AD_MODAL}) ngb-modal-backdrop { opacity: 0 !important; pointer-events: none !important; }
      body:has(${AD_MODAL}) { overflow: auto !important; }
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
    new MutationObserver(schedule).observe(document.body, { childList: true, subtree: true });
    setInterval(optimizePage, 1500);
  }

  if (document.body) start();
  else document.addEventListener("DOMContentLoaded", start, { once: true });
})();
