// content.js – Aggressive Ad Blocking for YouTube and x.com
(() => {
  const DEFAULT_DEBUG = true;
  const DEBOUNCE_DELAY = 400; // ms
  const CHECK_INTERVAL = 2000; // ms

  // Retrieve options from chrome.storage.sync (saved as JSON)
  async function getOptions() {
    return new Promise((resolve) => {
      chrome.storage.sync.get({ options: { debug: DEFAULT_DEBUG } }, (result) => {
        resolve(result.options);
      });
    });
  }

  // Utility: Run callback during idle time if possible
  function runWhenIdle(callback) {
    if (window.requestIdleCallback) {
      window.requestIdleCallback(callback);
    } else {
      setTimeout(callback, 0);
    }
  }

  async function initFiltering() {
    const options = await getOptions();
    const DEBUG = options.debug;
    if (DEBUG) console.log("[Content] Options loaded:", options);

    // -----------------------
    // YouTube Filtering Setup
    // -----------------------
    const badKeywords = [
      "sexy", "sex", "nude",  "meaningful minute,"
    ];
    const blockTitleKeywords = ["gone"];
    const badPhrases = [
      /hot.*(deal|new|reveal|girl|body|date)/i,
      /sexy.*(reveal|secret|hot|moment|star)/i,
      /nude.*(leak|scene|photo|video)/i,
      /strip.*(tease|show|dance|club)/i,
      /bikini.*(haul|try|beach|model)/i,
      /topless.*(beach|photo|dare)/i,
      /naughty.*(girl|boy|secret|fun)/i,
      /steamy.*(scene|romance|shower)/i,
      /erotic.*(story|dance|fantasy)/i,
      /seductive.*(look|pose|voice)/i,
      /provocative.*(pose|outfit|video)/i,
      /lingerie.*(try|haul|review)/i,
      /bare.*(skin|truth|all)/i,
      /exposed.*(body|secret|lie)/i,
      /risqué.*(dance|photo|clip)/i,
      /sponsored.*(content|video|post|event)/i,
      /watch.*(ad|promo|commercial|trailer)/i,
      /exclusive.*(deal|offer|content|access)/i,
      /best.*(deal|offer|ever|price|buy)/i,
      /limited.*(time|offer|stock|deal)/i,
      /special.*(offer|discount|promo|edition)/i,
      /get.*(free|discount|deal|now)/i,
      /save.*(money|big|huge|now)/i,
      /buy.*(now|today|cheap|fast)/i,
      /shop.*(now|today|sale|deals)/i,
      /redeem.*(code|coupon|offer|now)/i,
      /subscribe.*(now|today|free|channel)/i,
      /trial.*(free|offer|now|limited)/i,
      /cashback.*(deal|offer|now)/i,
      /partnered.*(with|content|video)/i,
      /affiliate.*(link|deal|program)/i,
      /click.*(now|here|fast|to see)/i,
      /shocking.*(truth|reveal|moment|news)/i,
      /unbelievable.*(story|deal|fact)/i,
      /hidden.*(secret|truth|gem)/i,
      /amazing.*(deal|reveal|trick)/i,
      /insane.*(deal|moment|hack)/i,
      /crazy.*(sale|story|video)/i,
      /wild.*(party|reveal|deal)/i,
      /stunning.*(reveal|look|deal)/i,
      /must.*(see|watch|buy|know)/i,
      /urgent.*(alert|deal|now)/i,
      /instant.*(access|deal|win)/i,
      /quick.*(fix|deal|hack|win)/i,
      /easy.*(money|trick|win|way)/i,
      /hack.*(life|deal|secret)/i,
      /trick.*(to|that|for)/i,
      /tip.*(to|for|that)/i,
      /scam.*(alert|warning|exposed)/i,
      /fake.*(news|deal|story)/i,
      /prank.*(gone|video|funny)/i,
      /spam.*(alert|warning|free)/i,
      /win.*(prize|money|now|big)/i,
      /prize.*(giveaway|win|claim)/i,
      /contest.*(enter|win|now)/i,
      /lottery.*(win|ticket|jackpot)/i,
      /gambling.*(tips|win|site)/i,
      /bet.*(now|win|big)/i,
      /casino.*(online|win|play)/i,
      /viral.*(video|trend|moment)/i,
      /buzz.*(worthy|now|trending)/i,
      /trend.*(alert|now|video)/i,
      /elon.*musk/i,
      /meaningful.*minute/i,
      /musk.*(news|update|tesla)/i
    ];

    // Helper: Check if an image appears to be an ad
    function isAdImage(img) {
      const src = img.src.toLowerCase();
      const alt = (img.alt || "").toLowerCase();
      const isAdSize = (img.width > 200 && img.height < 100) || (img.width === 88 && img.height === 31);
      return (
        badKeywords.some(word => src.includes(word) || alt.includes(word)) ||
        badPhrases.some(regex => regex.test(src) || regex.test(alt)) ||
        src.includes("promo") ||
        src.includes("sponsor") ||
        src.includes("ad") ||
        isAdSize
      );
    }

    // Remove entire video container from the page
    function removeVideoContainer(element, reason = "") {
      const container = element.closest("ytd-video-renderer, ytd-grid-video-renderer, ytd-compact-video-renderer, ytd-rich-item-renderer");
      if (container) {
        container.remove();
        if (DEBUG) console.log(`[Content YouTube] Removed video container due to ${reason}`);
      }
    }

    // -------------------------
    // YouTube Filtering Function
    // -------------------------
    function filterYouTube() {
      // Remove homepage ad components
      document.querySelectorAll(
        "ytd-ad-slot-renderer, ytd-in-feed-ad-layout-renderer, .ytd-banner-promo-renderer, ytd-rich-item-renderer[is-ad], ytd-promoted-video-renderer"
      ).forEach(ad => {
        ad.remove();
        if (DEBUG) console.log("[Content YouTube] Removed homepage ad:", ad.tagName);
      });

      // Remove Shorts items
      document.querySelectorAll("ytd-reel-item-renderer").forEach(el => {
        el.remove();
        if (DEBUG) console.log("[Content YouTube] Removed a Shorts reel item");
      });

      // Remove items linking to /shorts/
      document.querySelectorAll('a[href*="/shorts/"]').forEach(link => {
        const container = link.closest("ytd-video-renderer, ytd-grid-video-renderer, ytd-compact-video-renderer, ytd-rich-item-renderer");
        if (container) {
          container.remove();
          if (DEBUG) console.log("[Content YouTube] Removed item with Shorts link");
        }
      });

      // Remove videos with titles or descriptions matching ad keywords/phrases
      document.querySelectorAll("ytd-video-renderer, ytd-grid-video-renderer, ytd-compact-video-renderer, ytd-rich-item-renderer")
        .forEach(item => {
          const titleEl = item.querySelector("#video-title") || item.querySelector("#title-wrapper h3");
          if (!titleEl) return;
          const title = titleEl.textContent.toLowerCase();
          const descEl = item.querySelector("#description-text, .metadata-snippet-text");
          const desc = descEl ? descEl.textContent.toLowerCase() : "";
          if (
            blockTitleKeywords.some(word => title.includes(word)) ||
            badKeywords.some(word => title.includes(word) || desc.includes(word)) ||
            badPhrases.some(regex => regex.test(title) || regex.test(desc))
          ) {
            item.remove();
            if (DEBUG) console.log(`[Content YouTube] Removed video based on title/description: "${title.substring(0,20)}..."`);
          }
        });

      // Remove entire video container if a suspect ad image is detected
      document.querySelectorAll("ytd-thumbnail img, #thumbnail img")
        .forEach(img => {
          if (isAdImage(img)) {
            removeVideoContainer(img, "ad image detected");
          }
        });

      // Remove video player ad overlays
      document.querySelectorAll(".ytp-ad-module, .ytp-ad-overlay-container, .video-ads, .ytp-ad-image-overlay, .ytp-ad-text, .ytp-ad-preview-container")
        .forEach(ad => {
          ad.remove();
          if (DEBUG) console.log("[Content YouTube] Removed video ad overlay");
        });

      // Skip in-player ads by fast-forwarding
      const player = document.querySelector(".html5-video-player");
      if (player && (player.classList.contains("ad-showing") || player.classList.contains("ad-interrupting"))) {
        const video = player.querySelector("video");
        if (video && video.duration && video.currentTime < video.duration - 1) {
          video.currentTime = video.duration;
          if (DEBUG) console.log("[Content YouTube] Skipped in-player ad");
        }
      }
    }

    // -------------------------
    // x.com Filtering Function
    // -------------------------
    function filterXcom() {
      // Remove elements with class or id containing "ad" or "spon" (case-insensitive) or with data-ad attributes
      document.querySelectorAll("[class*='ad'], [id*='ad'], [class*='spon'], [id*='spon'], [data-ad]")
        .forEach(el => {
          el.remove();
          if (DEBUG) console.log("[Content x.com] Removed element (class/id contains 'ad' or 'spon'):", el);
        });
      // Remove elements with computed background images that contain "ad"
      document.querySelectorAll("*").forEach(el => {
        const bg = window.getComputedStyle(el).backgroundImage;
        if (bg && bg.toLowerCase().includes("ad")) {
          el.remove();
          if (DEBUG) console.log("[Content x.com] Removed element with ad-like background:", el);
        }
      });
      // Remove promoted tweets: find elements with data-testid="cellInnerDiv" that include "Promoted"
      document.querySelectorAll('[data-testid="cellInnerDiv"]').forEach(item => {
        if (item.innerText.includes("Promoted")) {
          const article = item.closest("article");
          if (article) {
            article.remove();
            if (DEBUG) console.log("[Content x.com] Removed promoted tweet article");
          }
        }
      });
    }

    // -------------------------
    // Main filterContent: Choose filtering based on hostname
    // -------------------------
    function filterContent() {
      runWhenIdle(() => {
        try {
          const hostname = window.location.hostname;
          if (hostname.includes("youtube.com")) {
            filterYouTube();
          } else if (hostname.includes("x.com")) {
            filterXcom();
          }
        } catch (error) {
          console.error("[Content] Error during filtering:", error);
        }
      });
    }

    // Debounce helper to avoid excessive calls
    let filterTimeout;
    function debouncedFilter() {
      clearTimeout(filterTimeout);
      filterTimeout = setTimeout(filterContent, DEBOUNCE_DELAY);
    }

    // Initial run on DOMContentLoaded
    document.addEventListener("DOMContentLoaded", () => {
      filterContent();
      if (DEBUG) console.log("[Content] Initial ad cleanup complete");
    });

    // Periodic check
    setInterval(filterContent, CHECK_INTERVAL);

    // Mutation Observer to catch dynamically added content
    const observer = new MutationObserver(mutations => {
      try {
        mutations.forEach(mutation => {
          mutation.addedNodes.forEach(node => {
            if (node.nodeType !== 1) return;
            debouncedFilter();
            // Immediately remove newly added ad overlays on YouTube
            if (node.matches(".ytp-ad-module, .video-ads, .ytp-ad-overlay-container")) {
              node.remove();
              if (DEBUG) console.log("[Content] Removed newly added ad overlay");
            }
          });
        });
      } catch (error) {
        console.error("[Content] Error in mutation observer:", error);
      }
    });
    observer.observe(document.body, { childList: true, subtree: true });

    // Periodically click skip-ad buttons (for in-player ads)
    function skipAds() {
      try {
        document.querySelectorAll(".ytp-skip-ad-button, .ytp-ad-skip-button, .ytp-ad-skip-button-modern")
          .forEach(button => {
            button.click();
            if (DEBUG) console.log("[Content] Clicked skip-ad button");
          });
      } catch (error) {
        console.error("[Content] Error attempting to skip ad:", error);
      }
    }
    setInterval(skipAds, 1000);
  }

  // Initialize filtering
  initFiltering();
})();
