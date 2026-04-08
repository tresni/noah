// Noah popup logic.
//
// For each installed extension that declares the sidePanel permission, we offer
// a configurable "panel path" (e.g. panel.html) and an Open button that opens
// chrome-extension://<id>/<path> in a popup window.
//
// chrome.storage.local keys:
//   paths       — { extId: "panel.html", … } user-saved per-extension panel path
//   lastUsed    — { extId: epochMs, … } last-opened timestamp, drives sort order
//
// Pre-configured paths for known extensions live in defaults.js (loaded as a
// sibling script and exposed on window.NOAH_DEFAULTS).
//
// We pass an initial 360x700 to chrome.windows.create as a hint for the very
// first popup ever, but Arc remembers the last-resized popup size and overrides
// us on every subsequent open — so user-configurable size settings would be
// vestigial. Same for position.

const COMMON_PATHS = [
  "panel.html",
  "sidepanel.html",
  "side_panel.html",
  "sidebar.html",
  "popup.html",
];

const els = {
  list: document.getElementById("list"),
  rowTpl: document.getElementById("row-tpl"),
};

async function load() {
  const [{ paths = {}, lastUsed = {} }, all] = await Promise.all([
    chrome.storage.local.get(["paths", "lastUsed"]),
    chrome.management.getAll(),
  ]);

  const me = await chrome.management.getSelf();
  const exts = all
    .filter((e) => e.type === "extension" && e.id !== me.id && e.enabled)
    // only extensions that declared the sidePanel permission can host a side panel
    .filter((e) => (e.permissions || []).includes("sidePanel"))
    .sort((a, b) => {
      // Most-recently-used first; never-used fall to the bottom alphabetically.
      const la = lastUsed[a.id] || 0;
      const lb = lastUsed[b.id] || 0;
      if (la !== lb) return lb - la;
      return a.name.localeCompare(b.name);
    });

  els.list.innerHTML = "";
  if (exts.length === 0) {
    els.list.innerHTML =
      '<div class="hint">No installed extensions declare the <code>sidePanel</code> permission.</div>';
    return;
  }

  const defaults = (typeof window !== "undefined" && window.NOAH_DEFAULTS) || {};

  for (const ext of exts) {
    const saved = paths[ext.id];
    const def = normalizeDefault(defaults[ext.id]);
    const path = saved || def.path || "";
    els.list.appendChild(
      renderRow(ext, path, {
        // Collapse rows with a known path (saved by user OR pre-configured in
        // defaults.js). The user can ✎ to expand and override either source.
        collapsed: !!path,
        defaults: def,
      })
    );
  }
}

// defaults.js entries can be either a string (just the path) or an object
// with extra options. Normalize to a consistent shape so the rest of the code
// can rely on it.
function normalizeDefault(entry) {
  if (!entry) return { path: "", noInject: false, disclaimer: "" };
  if (typeof entry === "string") return { path: entry, noInject: false, disclaimer: "" };
  return {
    path: entry.path || "",
    noInject: !!entry.noInject,
    disclaimer: entry.disclaimer || "",
  };
}

function renderRow(ext, savedPath, opts = {}) {
  const row = els.rowTpl.content.firstElementChild.cloneNode(true);
  if (opts.collapsed) row.classList.add("collapsed");

  const icon = row.querySelector(".icon");
  const bestIcon = (ext.icons || []).sort((a, b) => b.size - a.size)[0];
  if (bestIcon) icon.src = bestIcon.url;
  row.querySelector(".name").textContent = ext.name;
  row.querySelector(".id").textContent = ext.id;

  const input = row.querySelector(".path-input");
  input.value = savedPath;
  input.placeholder = COMMON_PATHS[0];

  const disclaimerEl = row.querySelector(".row-disclaimer");
  const disclaimer = (opts.defaults && opts.defaults.disclaimer) || "";
  if (disclaimer) {
    disclaimerEl.textContent = disclaimer;
    disclaimerEl.hidden = false;
  }

  const status = row.querySelector(".row-status");
  const setStatus = (msg, kind) => {
    status.textContent = msg || "";
    status.className = "row-status" + (kind ? " " + kind : "");
  };

  const doOpen = async () => {
    setStatus("Opening…");
    const path = input.value.trim() || COMMON_PATHS[0];
    try {
      await openPanel(ext, path, opts.defaults || {});
      await touchLastUsed(ext.id);
      setStatus("Opened.", "success");
      window.close();
    } catch (e) {
      setStatus(e.message || String(e), "error");
    }
  };

  // Whole-row click opens (only meaningful when collapsed; harmless when expanded
  // because the row-main isn't covering any other controls).
  row.querySelector(".row-main").addEventListener("click", (ev) => {
    if (ev.target.closest(".btn-edit")) return;
    doOpen();
  });

  row.querySelector(".btn-edit").addEventListener("click", (ev) => {
    ev.stopPropagation();
    row.classList.remove("collapsed");
    input.focus();
    input.select();
  });

  row.querySelector(".btn-save").addEventListener("click", async () => {
    await savePath(ext.id, input.value.trim());
    setStatus("Saved.", "success");
    if (input.value.trim()) row.classList.add("collapsed");
  });

  row.querySelector(".btn-open").addEventListener("click", doOpen);

  return row;
}

async function savePath(extId, path) {
  const { paths = {} } = await chrome.storage.local.get("paths");
  if (path) paths[extId] = path;
  else delete paths[extId];
  await chrome.storage.local.set({ paths });
}

async function touchLastUsed(extId) {
  const { lastUsed = {} } = await chrome.storage.local.get("lastUsed");
  lastUsed[extId] = Date.now();
  await chrome.storage.local.set({ lastUsed });
}

async function openPanel(ext, path, defOpts = {}) {
  let url = `chrome-extension://${ext.id}/${path.replace(/^\//, "")}`;

  // Inject context that a real chrome.sidePanel host would otherwise provide:
  //   ?tabId=<the user's currently active tab>
  //   &mode=window
  //
  // Some extensions read these to know which "host page" tab they're operating
  // on; without them they think there's no active tab and bail. Always inject
  // unless the entry explicitly opts out via noInject.
  //
  // Our launcher's action popup is a popover, NOT a window of its own, so
  // lastFocusedWindow correctly points at the user's actual Arc browser
  // window even while our popup is showing.
  if (!defOpts.noInject) {
    const params = new URLSearchParams();
    try {
      const [tab] = await chrome.tabs.query({
        active: true,
        lastFocusedWindow: true,
      });
      if (tab && typeof tab.id === "number") {
        params.set("tabId", String(tab.id));
      }
    } catch (e) {
      console.warn("[noah] failed to query active tab:", e);
    }
    params.set("mode", "window");
    const sep = url.includes("?") ? "&" : "?";
    url += sep + params.toString();
  }

  // 360 × 700 is just a hint for the very first popup ever — Arc remembers
  // the user's last-resized popup size and overrides us afterward.
  await chrome.windows.create({
    url,
    type: "popup",
    width: 360,
    height: 700,
    focused: true,
  });
}

load().catch((e) => {
  els.list.textContent = "Failed to load: " + (e.message || e);
});
