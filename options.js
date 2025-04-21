// options.js – Options Page Script
document.addEventListener("DOMContentLoaded", restoreOptions);
document.getElementById("options-form").addEventListener("submit", saveOptions);

function saveOptions(e) {
  e.preventDefault();
  const debug = document.getElementById("debug-toggle").checked;
  const customDomains = document.getElementById("custom-ad-domains").value
    .split(",")
    .map(s => s.trim())
    .filter(Boolean);
  const customKeywords = document.getElementById("custom-keywords").value
    .split(",")
    .map(s => s.trim())
    .filter(Boolean);
  const refreshIntervalMinutes = parseInt(document.getElementById("refresh-interval").value, 10);
  
  const options = {
    debug,
    customAdDomains: customDomains,
    customFilterKeywords: customKeywords, // new field for custom keywords
    ruleRefreshInterval: refreshIntervalMinutes * 60 * 1000
  };

  chrome.storage.sync.set({ options }, () => {
    const status = document.getElementById("status");
    status.textContent = "Options saved.";
    console.log("Options saved:", options);
    setTimeout(() => {
      status.textContent = "";
    }, 2000);
    // Notify background to update rules immediately if needed
    chrome.runtime.sendMessage({ action: "forceUpdateRules" });
  });
}

function restoreOptions() {
  chrome.storage.sync.get(
    { options: { debug: true, customAdDomains: [], customFilterKeywords: [], ruleRefreshInterval: 600000 } },
    (result) => {
      const options = result.options;
      document.getElementById("debug-toggle").checked = options.debug;
      document.getElementById("custom-ad-domains").value = options.customAdDomains.join(", ");
      document.getElementById("custom-keywords").value = options.customFilterKeywords.join(", ");
      document.getElementById("refresh-interval").value = options.ruleRefreshInterval / (60 * 1000);
    }
  );
}
