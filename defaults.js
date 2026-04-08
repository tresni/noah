// Pre-configured panel paths for known extensions, keyed by extension ID.
//
// To contribute a new entry: install the extension, find the path that works
// (try common ones first, then check the extension's "Inspect views" list on
// arc://extensions for clues), confirm it renders, then add an entry below
// with a comment naming the extension.
//
// Saved paths in chrome.storage.local always take precedence over these
// defaults — the user can override at any time via the ✎ button.

// Each entry can be either:
//   - a string: the panel path
//   - an object: { path: "panel.html", noInject: true, disclaimer: "..." }
//
// Fields:
//   path        — panel HTML path within the extension
//   noInject    — disable the default ?tabId=<id>&mode=window injection
//   disclaimer  — short text shown inline on the extension's row in the launcher

window.NOAH_DEFAULTS = {
  // Claude in Chrome
  fcoeoabgfenejglbffodgkkbkcdhcgfn: {
    path: "sidepanel.html",
    disclaimer:
      "Focus a tab first. One panel = one tab; reopen from another tab for a new chat. Multi-tab conversations don't work in Arc.",
  },

  // OpenTabs (https://opentabs.ai)
  mgjhicbneklejgflmpeillcbkgkkbpkf: "side-panel/side-panel.html",
};
