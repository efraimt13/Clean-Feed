// background.js – Advanced and Robust Version for YouTube Blocking (ES Module)
import { getStorageValue, setStorageValue } from './utils/storage.js'; // helper module (see below)

const DEBUG_DEFAULT = true;

const defaultAdDomains = [
  "doubleclick.net",
  "googlesyndication.com",
  "ads.youtube.com",
  "googleadservices.com",
  "ytimg.com/*promo*",
  "ytimg.com/*sponsor*",
  "googlevideo.com/*ad*",
  "admob.com",
  "adsensecustomsearchads.com",
  "yieldmanager.com"
];

// Retrieve options from storage with defaults
async function getOptions() {
  return await getStorageValue("options", {
    customAdDomains: [],
    debug: DEBUG_DEFAULT,
    ruleRefreshInterval: 10 * 60 * 1000 // 10 minutes
  });
}

// --- Utility wrappers for chrome APIs ---
function getDynamicRules() {
  return new Promise((resolve) => {
    chrome.declarativeNetRequest.getDynamicRules((rules) => {
      resolve(rules);
    });
  });
}

function updateDynamicRules(removeRuleIds, addRules) {
  return new Promise((resolve, reject) => {
    chrome.declarativeNetRequest.updateDynamicRules(
      { removeRuleIds, addRules },
      () => {
        if (chrome.runtime.lastError) {
          reject(chrome.runtime.lastError);
        } else {
          resolve();
        }
      }
    );
  });
}

// --- Rule Building Functions ---
function buildRules(adDomains) {
  // Build base rules for blocking known ad domains on YouTube
  const baseRules = adDomains.map((domain, index) => ({
    id: index + 1,
    priority: 1,
    action: { type: "block" },
    condition: {
      urlFilter: `*://${domain}/*`,
      resourceTypes: ["main_frame", "sub_frame", "script", "image", "media", "xmlhttprequest"],
      domains: ["youtube.com"]
    }
  }));

  // Additional regex-based blocking rules
  const advancedRules = [
    {
      id: adDomains.length + 1,
      priority: 1,
      action: { type: "block" },
      condition: {
        regexFilter: ".*(ads|ad-|advert|sponsored|promo|banner|infeed|overlay).*",
        resourceTypes: ["script", "image", "media"]
      }
    },
    {
      id: adDomains.length + 2,
      priority: 1,
      action: { type: "block" },
      condition: {
        regexFilter: ".*youtube\\.com\\/.*(adurl|ad_|sponsor|promo).*",
        resourceTypes: ["main_frame", "sub_frame"]
      }
    }
  ];

  // Rule to block YouTube Shorts pages
  const youtubeShortsRule = {
    id: adDomains.length + advancedRules.length + 1,
    priority: 1,
    action: { type: "block" },
    condition: {
      urlFilter: "*://*.youtube.com/shorts/*",
      resourceTypes: ["main_frame", "sub_frame"],
      domains: ["youtube.com"]
    }
  };

  return [...baseRules, ...advancedRules, youtubeShortsRule];
}

// --- Update Rules ---
async function updateRules() {
  try {
    const options = await getOptions();
    const debug = options.debug;
    if (debug) console.log("[Background] Options loaded:", options);

    const mergedAdDomains = defaultAdDomains.concat(options.customAdDomains || []);
    const newRules = buildRules(mergedAdDomains);

    const currentRules = await getDynamicRules();
    const currentRuleIds = currentRules.map(rule => rule.id);

    await updateDynamicRules(currentRuleIds, newRules);

    if (debug) {
      const updatedRules = await getDynamicRules();
      console.log("[Background] Updated blocking rules:", updatedRules);
    }
  } catch (error) {
    console.error("[Background] Failed to update rules:", error);
  }
}

// --- Event Listeners ---

chrome.runtime.onInstalled.addListener(() => {
  updateRules();
});

// Refresh rules on YouTube navigation
chrome.webNavigation.onCommitted.addListener((details) => {
  if (details.url.includes("youtube.com")) {
    updateRules().then(() => {
      getOptions().then(options => {
        if (options.debug) console.log("[Background] Refreshed rules after navigation:", details.url);
      });
    });
  }
});

// Listen for storage changes to update rules immediately if options change
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === "sync" && changes.options) {
    getOptions().then(options => {
      if (options.debug) console.log("[Background] Options changed; updating rules.");
      updateRules();
    });
  }
});

// Periodically refresh rules using interval from options
async function scheduleRuleRefresh() {
  const options = await getOptions();
  setInterval(() => {
    updateRules().then(() => {
      if (options.debug) console.log("[Background] Periodic rules refresh complete.");
    });
  }, options.ruleRefreshInterval);
}
scheduleRuleRefresh();

// Log tab updates for debugging and trigger content cleanup
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === "complete" && tab.url && tab.url.includes("youtube.com")) {
    chrome.scripting.executeScript({
      target: { tabId },
      func: () => {
        console.log("[Background] YouTube fully loaded; content cleanup triggered.");
      }
    });
  }
});

// Optionally add a listener for messages from the options page
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === "forceUpdateRules") {
    updateRules().then(() => {
      sendResponse({ status: "rules updated" });
    });
    return true;
  }
});
