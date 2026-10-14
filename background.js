// الـ content script يُحقن تلقائيًا من manifest.json على play.anghami.com
// لذلك لا نحقنه مرة ثانية من هنا (الحقن المزدوج كان يسبب خطأ "already been declared").

chrome.runtime.onInstalled.addListener(() => {
  console.log("Anghami Ad Blocker installed/updated");
});

// عند الضغط على أيقونة الإضافة: نحقن الاسكربت فقط إذا لم يكن محمّلًا
chrome.action.onClicked.addListener(async (tab) => {
  if (!tab.url || !tab.url.startsWith("https://play.anghami.com/")) return;
  try {
    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      files: ["scripts/contentScripts/adRemover.js"]
    });
  } catch (err) {
    console.error("Script injection failed:", err);
  }
});
