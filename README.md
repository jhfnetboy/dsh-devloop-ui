# dsh-devloop-ui

A sidebar entry that opens the [DevLoop](../../DevLoop) dashboard inside DSH Desktop.

This package exists because DevLoop's dashboard is a route on the Harness origin
(`/devloop/`) rather than a Harness UI plugin, and a host-only plugin cannot
appear in the app's chrome. Nothing in DevLoop changes: this is its companion
UI half, kept separate so it can be installed, removed, or rewritten without a
DevLoop release.

## What it does

Registers one occupant into the `sidebar.footer.action` slot — an icon button in
the sidebar footer (icon plus label when the sidebar is expanded, icon only in
the collapsed rail). Clicking it opens `/devloop/` in a new window.

It opens a window rather than embedding the dashboard because the dashboard
answers with `x-frame-options: DENY` and `frame-ancestors 'none'`. The window is
an app window, not the system browser: DSH Desktop's `isTrustedAppUrl` treats
every `127.0.0.1` / `localhost` URL as trusted and allows it in-app.

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

Stub-evaluates `client.js` against the loader and slot contracts: loader id,
exported face, injected slot, list-slot `id`, and the button's `onClick` target.
