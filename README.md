# Noah 🌈

A Chrome extension that lets [Arc](https://arc.net) actually use extensions
that ship a `chrome.sidePanel`. Arc built most of the infrastructure for this
feature but never finished wiring it to the UI; **Noah** fills the gap by
launching any extension's panel page in a free-floating popup window.

(Noah's ark. Arc. Get it?)

## What Noah does

- Lists every installed extension that declares the `sidePanel` permission.
- Lets you give each one a panel-page path (e.g. `panel.html`,
  `sidepanel.html`, `src/panel/index.html`) and persists it.
- Opens the panel page in a Chromium popup window (`chrome.windows.create`,
  `type: "popup"`) — a free-floating panel rather than a docked sidebar, but
  it's a real Chromium-rendered extension page with full extension privileges.
- Injects `?tabId=<current>&mode=window` query params so panels that expect to
  inherit the parent window's active tab (Claude in Chrome, etc.) work
  correctly. Noah captures the last-focused real browser window's active tab
  at launch time.
- Sorts extensions by most-recently-used so daily-use panels stay on top.
- Ships pre-configured paths for known extensions in `defaults.js`. If you've
  figured out the right path for a useful extension, add it there so the next
  person doesn't have to repeat the work.

## Installation

1. Open Arc to `arc://extensions`
2. Toggle **Developer mode** on (top-right)
3. Click **Load unpacked** → select `noah/`
4. Pin the extension to the toolbar (puzzle-piece menu → pin)

## Usage

1. Focus the Arc tab you'd want a tab-aware panel to act on.
2. Click the **Noah** toolbar button.
3. The popup lists every extension with the `sidePanel` permission,
   most-recently-used first.
4. For each new extension, type the path to its panel HTML page (most often
   `panel.html` or `sidepanel.html` — check the extension's "Inspect views"
   list in `arc://extensions` to see what's available) and click **Save**.
5. From then on, click the row (anywhere on the icon/name) to open that
   extension's panel as a popup window.
6. If you've figured out the right path for a useful extension, add it to
   `defaults.js` so the next person doesn't have to.

## Caveats

- **Free-floating popup, not docked sidebar.** For chat-style panels (LLM
  clients, notes, etc.) this is usually fine.
- **Tab context is a snapshot.** Noah captures the currently-focused real tab
  at launch time and passes it to the panel via `?tabId=`. If you switch tabs
  after the panel is open, the panel still thinks the original tab is "its"
  tab — unlike a real chrome.sidePanel which auto-follows the active tab.
  Close and reopen the panel to re-snapshot.
- **Open from a real page.** If the focused tab is `arc://`, `chrome://`, or
  another privileged URL, tab-aware extensions will complain because they
  can't read content from those.
- **Single-tab only for grouping extensions.** Arc disables `chrome.tabs.group`,
  so extensions that depend on Chrome tab groups (Claude in Chrome, etc.) can't
  be given multiple tabs to look at in one conversation. Open the panel again
  from a different tab for a second conversation.
- **Some extensions have broken `panel.html` files** with inline `<script>`
  tags that violate MV3's extension CSP. You'll see CSP violations in the
  panel's devtools console. The same errors appear in stock Brave/Chrome with
  the same extensions — they're bugs in the extensions, not in Noah, and the
  pages usually still mostly render. There is no fix from our side; the
  extension has to ship a CSP-clean panel page.
- **Panel lifecycle events don't fire.** Panels relying on
  `chrome.sidePanel.onOpened` / `onClosed` won't get those events. Features
  depending on them won't work.

## Development notes

Plain JavaScript, no build step. Edit files in `noah/` and click the reload
(↻) button on the extension card in `arc://extensions` to apply changes.

| File            | Role                                                              |
| --------------- | ----------------------------------------------------------------- |
| `manifest.json` | MV3 manifest. Permissions: `management`, `storage`, `windows`     |
| `popup.html`    | Popup UI shell + row template                                     |
| `popup.css`     | Styles for the popup                                              |
| `popup.js`      | List/sort/render/save logic; opens the panel popup windows        |
| `defaults.js`   | Pre-configured panel paths for known extensions, keyed by ext ID  |
