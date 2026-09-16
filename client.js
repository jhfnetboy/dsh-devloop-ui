/**
 * The DevLoop client half: two slot occupants sharing one bundle.
 *
 * - `sidebar.footer.action`: an icon button that opens the dashboard.
 * - `settings.section`: a lean summary (project list, status, today's spend)
 *   that fetches DevLoop's own HTTP API and links out to the dashboard for
 *   anything beyond a glance — writing a goal, answering a question, reading
 *   documents. It does not reimplement the dashboard; the dashboard is one
 *   route away for everything this panel does not show.
 *
 * Two facts shape both:
 *
 * - The dashboard is a route on this same Harness origin (`/devloop/`), and DSH
 *   Desktop's `isTrustedAppUrl` treats every `127.0.0.1` / `localhost` URL as
 *   trusted. It therefore allows the window instead of handing the URL to the
 *   system browser, so the dashboard opens as an app window.
 * - It is opened as a window rather than embedded: the dashboard answers with
 *   `x-frame-options: DENY` and `frame-ancestors 'none'`, so an iframe would be
 *   refused. That is the dashboard's own choice, not something to work around.
 *
 * The API is same-origin (`fetch`'s default `credentials` is `same-origin`),
 * so the page's own Harness auth cookie carries; nothing extra to wire up.
 *
 * Plain browser JavaScript: the client module loader evaluates this verbatim, so
 * there is no TypeScript, no JSX, and no bundler in the path.
 */
window.__ModuleLoader__.load({
  id: 'dsh-devloop-ui',
  factory: (require) => {
    const module = { exports: {} }
    const exports = module.exports
    Object.defineProperty(exports, Symbol.toStringTag, { value: 'Module' })

    const React = require('react')

    const DASHBOARD_PATH = '/devloop/'
    const API = '/devloop/api'
    const REFRESH_MS = 5000

    /** The glyph: an open loop, the cycle the factory is named for. */
    function LoopMark(props) {
      const size = props.size
      return React.createElement(
        'svg',
        {
          width: size,
          height: size,
          viewBox: '0 0 16 16',
          fill: 'none',
          'aria-hidden': 'true',
        },
        React.createElement('path', {
          d: 'M13.4 7.9a5.5 5.5 0 1 1-1.62-3.9',
          stroke: 'currentColor',
          strokeWidth: 1.5,
          strokeLinecap: 'round',
        }),
        React.createElement('path', {
          d: 'M13.6 1.8v3.4h-3.4',
          stroke: 'currentColor',
          strokeWidth: 1.5,
          strokeLinecap: 'round',
          strokeLinejoin: 'round',
        }),
      )
    }

    /**
     * The footer entry.
     *
     * `wide` is supplied by the sidebar's own `renderSlot` call and says whether
     * the sidebar is expanded, so this follows the rail without reading layout
     * state of its own. The rail size, radius, and hover fill mirror the sibling
     * entry the Cordis panel already registers into this same slot, and every
     * colour comes from the sidebar's own theme variables — so this needs no
     * stylesheet and follows both themes.
     */
    function DevloopDashboardAction(props) {
      const wide = props.wide === true
      const [hover, setHover] = React.useState(false)

      const style = wide
        ? {
            boxSizing: 'border-box',
            cursor: 'pointer',
            border: '0.5px solid var(--dsw-alias-border-l3)',
            background: hover
              ? 'var(--dsw-alias-button-floating-hover)'
              : 'var(--dsw-alias-button-elevated-fill)',
            height: 28,
            color: 'var(--dsw-alias-label-secondary)',
            borderRadius: 999,
            flex: 'none',
            display: 'inline-flex',
            justifyContent: 'center',
            alignItems: 'center',
            gap: 6,
            padding: '0 10px',
            font: 'inherit',
            fontSize: 12,
            lineHeight: '16px',
            whiteSpace: 'nowrap',
          }
        : {
            cursor: 'pointer',
            width: 28,
            height: 28,
            color: 'var(--dsw-alias-label-secondary)',
            background: hover ? 'var(--dsw-alias-interactive-bg-hover)' : 'transparent',
            border: 'none',
            borderRadius: 999,
            flex: 'none',
            display: 'inline-flex',
            justifyContent: 'center',
            alignItems: 'center',
            padding: 0,
          }

      return React.createElement(
        'button',
        {
          type: 'button',
          style,
          title: 'DevLoop',
          'aria-label': 'DevLoop',
          onClick: () => {
            window.open(DASHBOARD_PATH, '_blank', 'noopener')
          },
          onMouseEnter: () => setHover(true),
          onMouseLeave: () => setHover(false),
        },
        React.createElement(LoopMark, { size: wide ? 14 : 16 }),
        wide
          ? React.createElement(
              'span',
              { style: { display: 'inline-block' } },
              'DevLoop',
            )
          : null,
      )
    }

    /**
     * Per-project status, derived from the one field the server already
     * classifies with: `lane`. Kept in step with the same four buckets the
     * dashboard's own home page sorts into, rather than re-deriving `armed` /
     * `halted` / `paused` / `completed` a second time and risking drift.
     */
    const LANE_LABEL = {
      needs_you: 'needs you',
      running: 'running',
      idle: 'idle',
      done: 'done',
    }
    const LANE_COLOR = {
      needs_you: 'var(--dsw-alias-label-warning, #b45309)',
      running: 'var(--dsw-alias-label-positive, #15803d)',
      idle: 'var(--dsw-alias-label-secondary)',
      done: 'var(--dsw-alias-label-tertiary, var(--dsw-alias-label-secondary))',
    }

    function projectLabel(p) {
      if (p.error) return 'unreadable'
      if (!p.armed) return 'not started'
      return LANE_LABEL[p.lane] || p.lane || '—'
    }

    function usd(n) {
      return typeof n === 'number' ? `$${n.toFixed(n < 1 ? 4 : 2)}` : '—'
    }

    function row(props, ...children) {
      return React.createElement('div', props, ...children)
    }

    /**
     * One project line: name, status, and (when it has one) the question or
     * error that put it there. The whole row opens the project's own page.
     */
    function ProjectRow(props) {
      const p = props.project
      const [hover, setHover] = React.useState(false)
      const detail = p.error || p.question || null
      return React.createElement(
        'button',
        {
          type: 'button',
          onClick: props.onOpen,
          onMouseEnter: () => setHover(true),
          onMouseLeave: () => setHover(false),
          style: {
            display: 'block',
            width: '100%',
            textAlign: 'left',
            cursor: 'pointer',
            border: 'none',
            borderRadius: 8,
            background: hover ? 'var(--dsw-alias-interactive-bg-hover)' : 'transparent',
            padding: '8px 10px',
            font: 'inherit',
            color: 'inherit',
          },
        },
        row(
          { style: { display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 8 } },
          row(
            { style: { fontSize: 13, fontWeight: 500, color: 'var(--dsw-alias-label-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' } },
            p.name,
          ),
          row(
            { style: { fontSize: 12, color: LANE_COLOR[p.error ? 'needs_you' : p.lane] || 'var(--dsw-alias-label-secondary)', flex: 'none' } },
            projectLabel(p),
          ),
        ),
        detail
          ? row(
              { style: { fontSize: 12, color: 'var(--dsw-alias-label-secondary)', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' } },
              detail,
            )
          : null,
      )
    }

    /**
     * The Settings section: registered projects, at a glance. Fetches on
     * mount and every REFRESH_MS while the section is open; nothing here
     * writes anything — starting a project, answering a question, and
     * everything else stays in the dashboard, one click away.
     */
    function DevloopSection(props) {
      const [state, setState] = React.useState({ loading: true, error: null, projects: null, global: null })

      React.useEffect(() => {
        let cancelled = false
        async function load() {
          try {
            const res = await fetch(`${API}/projects`)
            if (res.status === 401) throw new Error('not signed in')
            const body = await res.json()
            if (!body || body.ok !== true) throw new Error((body && body.error && body.error.message) || `HTTP ${res.status}`)
            if (!cancelled) setState({ loading: false, error: null, projects: body.value.projects, global: body.value.global })
          } catch (error) {
            if (!cancelled) setState((prev) => ({ ...prev, loading: false, error: error.message || String(error) }))
          }
        }
        load()
        const timer = setInterval(load, REFRESH_MS)
        return () => {
          cancelled = true
          clearInterval(timer)
        }
      }, [])

      function openDashboard(hash) {
        window.open(DASHBOARD_PATH + (hash || ''), '_blank', 'noopener')
        if (typeof props.close === 'function') props.close()
      }

      const header = row(
        { style: { display: 'flex', alignItems: 'center', gap: 8, padding: '4px 10px 12px' } },
        React.createElement(LoopMark, { size: 16 }),
        row({ style: { fontSize: 15, fontWeight: 600, color: 'var(--dsw-alias-label-primary)' } }, 'DevLoop'),
      )

      let body
      if (state.error) {
        body = row(
          { style: { padding: '4px 10px', fontSize: 13, color: 'var(--dsw-alias-label-warning, #b45309)' } },
          `Could not read projects: ${state.error}`,
        )
      } else if (state.loading) {
        body = row({ style: { padding: '4px 10px', fontSize: 13, color: 'var(--dsw-alias-label-secondary)' } }, 'Loading…')
      } else if (!state.projects.length) {
        body = row(
          { style: { padding: '4px 10px', fontSize: 13, color: 'var(--dsw-alias-label-secondary)' } },
          'No projects registered yet. Add one from the dashboard.',
        )
      } else {
        body = row(
          { style: { display: 'flex', flexDirection: 'column' } },
          ...state.projects.map((p) =>
            React.createElement(ProjectRow, {
              key: p.id,
              project: p,
              onOpen: () => openDashboard(`#/p/${p.id}`),
            }),
          ),
        )
      }

      const g = state.global
      const footer = row(
        {
          style: {
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 8,
            marginTop: 12,
            paddingTop: 12,
            borderTop: '0.5px solid var(--dsw-alias-border-l3)',
          },
        },
        row(
          { style: { fontSize: 12, color: 'var(--dsw-alias-label-secondary)' } },
          g ? `Spent today ${usd(g.costUsdDay)}${g.cap !== null ? ` / ${usd(g.cap)}` : ''}` : '',
        ),
        React.createElement(
          'button',
          {
            type: 'button',
            onClick: () => openDashboard(''),
            style: {
              cursor: 'pointer',
              border: '0.5px solid var(--dsw-alias-border-l3)',
              background: 'var(--dsw-alias-button-elevated-fill)',
              color: 'var(--dsw-alias-label-secondary)',
              borderRadius: 999,
              padding: '4px 12px',
              font: 'inherit',
              fontSize: 12,
            },
          },
          'Open full dashboard →',
        ),
      )

      return row({ style: { padding: 8, maxWidth: 420 } }, header, body, footer)
    }

    const inject = ['slots']

    /**
     * Both registrations happen inside `ctx.slots.inject`, so they belong to
     * this fiber: stopping or updating the plugin removes both with nothing
     * left behind. Both slots are `list`, which is why each needs an `id`.
     */
    function apply(ctx) {
      ctx.slots.inject('sidebar.footer.action', () =>
        ctx.slots.register(
          {
            name: 'sidebar.footer.action',
            id: 'devloop-dashboard',
            order: 100,
            label: 'DevLoop',
          },
          DevloopDashboardAction,
        ),
      )
      ctx.slots.inject('settings.section', () =>
        ctx.slots.register(
          {
            name: 'settings.section',
            id: 'devloop',
            order: 20,
            label: 'DevLoop',
          },
          DevloopSection,
        ),
      )
    }

    exports.apply = apply
    exports.inject = inject
    return module.exports
  },
})
