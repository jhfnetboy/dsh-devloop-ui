# dsh-devloop-ui

Native DSH Desktop surfaces for the [DevLoop](../../DevLoop) dashboard: a sidebar
entry, and a Settings overview.

This package exists because DevLoop's dashboard is a route on the Harness origin
(`/devloop/`) rather than a Harness UI plugin, and a host-only plugin cannot
appear in the app's chrome. Nothing in DevLoop changes: this is its companion
UI half, kept separate so it can be installed, removed, or rewritten without a
DevLoop release.

`HANDOFF.md` documents the two-half package contract, the client bundle format,
the slot rules, DevLoop's HTTP API, and the constraints that are easy to get
wrong. Both slots below follow it.

Neither slot below is the main content area: a sidebar button and a Settings
section are a launcher and a side panel. For a **page** in the app — a tab beside
Chat and Trajectory that fills the view area — register into `conversation.view`;
see §3 of `HANDOFF.md`.

## What it does

Registers two occupants:

- `sidebar.footer.action` — an icon button in the sidebar footer (icon plus
  label when the sidebar is expanded, icon only in the collapsed rail).
  Clicking it opens `/devloop/` in a new window.
- `settings.section` — a lean overview in Settings: each registered project's
  name, status (needs you / running / idle / done, mirroring the dashboard's
  own `lane` classification), and today's total spend. It only reads
  `GET /devloop/api/projects` (same-origin `fetch`, polled every 5s while the
  panel is open) — starting a project, answering a question, and everything
  else stays in the dashboard, one click away via "Open full dashboard →" or
  by clicking a project row (which opens straight to that project).

Both open the dashboard as a window rather than embedding it, because the
dashboard answers with `x-frame-options: DENY` and `frame-ancestors 'none'`.
The window is an app window, not the system browser: DSH Desktop's
`isTrustedAppUrl` treats every `127.0.0.1` / `localhost` URL as trusted and
allows it in-app.

## Layout

| File | Role |
| --- | --- |
| `index.js` | Host half. Registers nothing — it exists so the package is a Loader entry, which is what makes `dsh-client-modules` compose and serve the browser half. |
| `client.js` | Browser half. Plain browser JavaScript, evaluated verbatim by the client module loader: no TypeScript, no JSX, no bundler. |
| `cordis.patch.yml` | Bundle patch that inserts the single Loader entry. |

`package.json` carries both halves of the declaration: `dsh.bundle.patch` (the
Loader entry) and `dsh.client` (the browser half plus `platform: "web"`).

## Install

Into a DSH profile, from the profile's own Harness:

```sh
DSH_HOME="$HOME/Library/Application Support/dsh-desktop/harness" \
PATH="$HOME/Library/Application Support/dsh-desktop/harness/.desktop-bin:$PATH" \
node "/Applications/DSH Desktop.app/Contents/Resources/app/node_modules/@deepseek-ai/dsh/lib/bin.js" \
  plugin --profile web add link:/Users/jason/Dev/jhfnetboy/dsh-devloop-ui
```

Restart DSH Desktop afterwards — a new bundle is composed at Harness boot, so it
is not picked up live.

Removing it:

```sh
# same DSH_HOME / PATH prefix
  plugin --profile web remove dsh-devloop-ui
```

## Verify without restarting Desktop

```sh
node check-client.mjs
```

Stub-evaluates `client.js` against the loader and slot contracts for both
occupants: loader id, exported face, each injected slot, each list-slot `id`,
the sidebar button's `onClick` target, and the settings section's "Open full
dashboard" action (opens `/devloop/` and calls `close()`).
