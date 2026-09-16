# Handoff: give DevLoop a native Harness UI

Audience: whoever maintains `@jhfnetboy/dsh-devloop`.

This repo (`dsh-devloop-ui`) is the **verified minimal reference**: it implements
the `sidebar.footer.action` half of the work below. Read `client.js` first — it is
~140 lines, and every contract in this document is exercised by
`check-client.mjs`. The `settings.section` half is the same shape with a different
slot.

## Context

Today DevLoop's only UI is an HTTP route (`/devloop/`) served on the Harness
origin. It works, and DSH Desktop opens it in an app window, but it is not part of
the app's chrome — there is no way to reach it except a link somebody hands you.
The goal is native surfaces: a **Settings section** (recommended, see §5) and/or a
sidebar entry.

**Read contracts from the published 0.6.7 build, not from a local checkout.** The
working copy at `~/Dev/jhfnetboy/DevLoop` is still 0.4.1 and predates the
project-registry architecture. The authoritative sources are:

- `~/.dsh/profiles/web/node_modules/@jhfnetboy/dsh-devloop/lib/` — the 0.6.7 build
- `/Applications/DSH Desktop.app/Contents/Resources/app/node_modules/@deepseek-ai/`
  — the Harness client packages, including the real-world `settings.section`
  example at `dsh-client-ui-agent-preset/lib/client.js:1960`

## 1. Package declaration

`package.json` must carry **both** halves. Today it declares only the bundle half:

```json
{
  "exports": {
    ".": { "types": "./lib/index.d.ts", "default": "./lib/index.js" },
    "./client": "./lib/client.js",
    "./package.json": "./package.json"
  },
  "dsh": {
    "bundle": { "patch": "./cordis.patch.yml" },
    "client": {
      "inject": [
        "@deepseek-ai/dsh-client-ui-settings",
        "@deepseek-ai/dsh-client-ui-renderer",
        "@deepseek-ai/dsh-client-locale"
      ],
      "platform": "web"
    }
  }
}
```

- `exports["./client"]` is resolved by `@deepseek-ai/dsh-client-modules`
  (`clientExportOf`), which accepts a string or an object with a string
  `default`. Put the built bundle at `lib/client.js` and `files` already covers it.
- `dsh.client.platform` is required and must be a string.
- `dsh.client.inject` lists **package names**.
- Optional: `dsh.client.external` (string array) declares module specifiers this
  bundle requires as separate rows, and it is what orders the module graph.
  `dsh.client.immediately` (boolean) pulls the bundle into an earlier batch.
- The host half stays a Loader entry via `dsh.bundle.patch` — that entry is what
  makes `dsh-client-modules` find a package declaring `dsh.client` at all.

## 2. Client bundle format

The bundle is **plain browser JavaScript, evaluated verbatim**. No TypeScript, no
JSX, no bundler, no top-level `import`. React must be written with
`React.createElement`. Wrap it exactly like this:

```js
window.__ModuleLoader__.load({
  id: '@jhfnetboy/dsh-devloop',        // MUST equal the package name
  factory: (require) => {
    var module = { exports: {} }
    var exports = module.exports
    Object.defineProperty(exports, Symbol.toStringTag, { value: 'Module' })

    const React = require('react')

    function apply(ctx) { /* register slots here */ }

    exports.apply = apply
    exports.inject = ['slots']          // service names, not package names
    return module.exports
  },
})
```

- `id` must equal the package name: the loader keys its rows by it.
- `exports.inject` is **service names**; `dsh.client.inject` is **package names**.
  They are not the same list and are not interchangeable.
- `apply` / `inject` as named exports is the supported module face
  (`cordis`'s `resolve` accepts `isApplicable(plugin) → plugin.apply`).
- `require` in the factory resolves package names such as `react` and
  `react/jsx-runtime`.

## 3. Slot registration

Register inside `ctx.slots.inject(name, …)` so the occupant belongs to the current
fiber and is removed on stop/update with nothing left behind:

```js
ctx.slots.inject('settings.section', () =>
  ctx.slots.register(
    { name: 'settings.section', id: 'devloop', order: 20, label: 'DevLoop' },
    DevloopSection,
  ),
)
```

`dsh-client-ui-slots`' `register()` enforces the slot's declared `kind`:

| kind | requirement |
| --- | --- |
| `single` | one occupant per `priority`; a second registration at the same priority **throws** |
| `list` | **`options.id` is required**; many occupants, ordered by `priority` then `order` |
| `keyed` | `options.key` is required |
| `chain` | `options.select` is required |

Accepted options: `name`, `id`, `key`, `order`, `priority`, `label`, `locale`,
`select`, `inject`, `children`, `store`, `registrant`. Registering into a slot that
no parent has declared **throws** (`slot "x" is not declared`).

### Slots worth using

| slot | kind | props | notes |
| --- | --- | --- | --- |
| `settings.section` | list | `{ close }` | **Recommended.** A full section in Settings with its own left-nav entry. Declared by `dsh-client-ui-settings-general`. |
| `settings.plugin.item` | keyed | — | A config card keyed by the settings namespace it edits; renders in the Plugins settings tab. |
| `sidebar.footer.action` | list | `{ wide }` | Sidebar footer. **Already occupied** by `dsh-client-ui-cordis` with a 28×28 icon button. |
| `sidebar.settings`, `sidebar.workspaces`, `sidebar.brand.*` | single | — | Already occupied; registering at the same priority throws. |
| `conversation.view`, `conversation.composer.dock`, `conversation.input.dock` | — | — | Conversation-area panels. |

**There is no top-level route or full-page slot.** A plugin cannot claim the main
content area; a Settings section is the closest thing to "a page".

## 4. Talking to the host

Simplest and recommended: **keep the existing `/devloop/api/*` routes as the API
and call them from the client half with same-origin `fetch`.** The page already
carries the Harness auth cookie and the routes are on the same origin, so
`fetch('/devloop/api/projects')` works with no extra wiring (fetch's default
`credentials` is `same-origin`).

If you would rather have real host↔client RPC, the packages are
`@deepseek-ai/dsh-api-remotes` / `ctx.remote` — see how `dsh-client-ui-cordis`
uses `ctx.remote.$on(...)`. That is more machinery for no additional capability
here.

Full surface, from 0.6.7's `lib/dashboard.js`:

| method | path | returns |
| --- | --- | --- |
| GET | `/devloop/` | dashboard HTML |
| GET | `/devloop/app.js`, `/i18n.js`, `/app.css` | assets |
| GET | `/devloop/api/projects` | `{ ok, value: { projects, registryError, global: { costUsdDay, cap } } }` |
| POST | `/devloop/api/projects` | register a project (body carries the goal) |
| GET | `/devloop/api/browse?path=<segments>` | `{ entries: [{ name, root, repo, registered }] }`, one level at a time |
| GET | `/devloop/api/projects/:id/status` | `describeProject` detail (summary + docs + readiness) |
| POST | `/devloop/api/projects/:id/start` | arm: writes `.devloop/GOAL.md`; body `{ goal }` |
| POST | `/devloop/api/projects/:id/next` | next goal; body `{ goal, revision }` |
| POST | `/devloop/api/projects/:id/{pause,resume,answer,unregister,cleanup}` | — |

A project id is `sha256(realpath).slice(0, 12)`. The per-project summary carries
`{ id, name, root, own, loop, armed, revision, lastAction, halted, paused,
completed, haltReasons, haltDetails, question, taskCounts, costUsdSession,
costUsdDay, updatedAt, error, lane, since }`.

Note `ownListed`: an **unarmed own root that is not a git repository is filtered
out** of the project list. That is deliberate — an unarmed own root that cannot
become a project is only noise.

## 5. Hard constraints and gotchas

These each cost real debugging time. They are properties of the harness, not
opinions.

1. **The dashboard cannot be iframed.** It answers with
   `x-frame-options: DENY` and `content-security-policy: …; frame-ancestors 'none'`
   (plus `default-src 'none'`). Do not try to embed `/devloop/` in a native
   surface; build real components against the API.

2. **DSH Desktop's `isTrustedAppUrl()` treats every `http://127.0.0.1` and
   `http://localhost` URL as trusted.** `will-navigate` lets such a URL navigate
   in-app, and `setWindowOpenHandler` returns `{ action: 'allow' }` — a new
   Electron window. Every other `http(s)` URL goes to `shell.openExternal`, i.e.
   the system browser. This is why the dashboard can open as an app window.

3. **Do not "fix" `config.root` by pinning a path.** `root: s.string().default(process.cwd())`
   is the *own root* only. Under DSH Desktop the process cwd is
   `~/Library/Application Support/dsh-desktop/launch-root` (empty, non-git) and that
   entry is filtered out of the dashboard. Registered projects live in a runtime
   registry at `$DSH_HOME/devloop/projects.json`. Nothing is hardcoded and nothing
   needs to be.

4. **`agentBackend` defaults to `noop`.** `NoopBackend.run()` returns
   `{ status: 'recorded' }`, so arming a project changes nothing real. The union is
   `noop | routed | dsh | claude | codex`. There is **no** `subagent` value —
   `subagent:<provider>` is a *route backend* name, usable only under `routed`,
   and it dispatches through `ctx.subagents` in-process.

5. **A new client bundle is composed at Harness boot.** It is not hot-loaded:
   every client-half change needs a Harness/Desktop restart. (`patchReload: "live"`
   covers patch layers, not new bundles.)

6. **Styling:** read the theme variables (`--dsw-alias-label-primary`,
   `--dsw-alias-label-secondary`, `--dsw-alias-border-l3`,
   `--dsw-alias-interactive-bg-hover`, `--dsw-alias-button-elevated-fill`,
   `--dsw-alias-button-floating-hover`) and prefer inline styles over shipping a
   stylesheet. For `sidebar.footer.action`, honour the `wide` prop: the collapsed
   rail is a different layout.

7. **Arming is creating `.devloop/GOAL.md`.** There is no separate running flag,
   so a surface must not invent one.

## 6. Acceptance checks

1. **Offline, before any restart.** Stub `window.__ModuleLoader__` and the `slots`
   service, evaluate the bundle, and assert the loader `id`, the exported face,
   the injected slot, the `id` (for a list slot), and the component's behaviour.
   `check-client.mjs` in this repo is a working template — copy its shape.
2. **Composition:** with `DSH_HOME` pointed at the profile,
   `dsh --profile web --dump-config` must show the entry and its `__dshPluginOwner`.
3. **After restart:**
   `grep -iE "client-modules|dsh-devloop" ~/Library/Logs/DSH\ Desktop/harness.log`
   — `client-modules` prints the package name and resolved path when a client
   bundle is missing or fails to compose.
4. **Served:** the harness serves composed client bundles from
   `/plugins/??<id>/client.js&rev=…`.
5. **Visually:** the section appears in Settings with its nav label; the sidebar
   entry appears next to the Cordis icon in the footer.

## 7. Installing and publishing

Install into a profile from the profile's own Harness (this is the form that
lands in the right `DSH_HOME`; a bare `dsh` on `PATH` may be a shim that forces a
different home):

```sh
DSH_HOME="$HOME/Library/Application Support/dsh-desktop/harness" \
PATH="$HOME/Library/Application Support/dsh-desktop/harness/.desktop-bin:$PATH" \
node "/Applications/DSH Desktop.app/Contents/Resources/app/node_modules/@deepseek-ai/dsh/lib/bin.js" \
  plugin --profile web add link:/Users/jason/Dev/jhfnetboy/dsh-devloop-ui
```

Restart DSH Desktop afterwards.

For publishing, remember: a scoped package needs `publishConfig.access: "public"`,
`private: true` blocks publishing entirely, and publishing requires
`registry.npmjs.org` — a mirror such as `registry.npmmirror.com` cannot accept a
publish.
