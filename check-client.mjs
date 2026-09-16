/**
 * Offline contract check for the dsh-devloop-ui client half.
 *
 * Evaluates client.js against a stub module loader, `slots` service, and React,
 * so a broken registration is caught here instead of after a Desktop restart.
 * Covers both slot occupants: the sidebar button (loader id, exported face, slot
 * options, onClick target) and the settings section (slot options, and that its
 * "open full dashboard" action opens the right path and closes the panel).
 */
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const CLIENT = fileURLToPath(new URL('./client.js', import.meta.url))

let registration
const opened = []
globalThis.window = {
  __ModuleLoader__: { load: (r) => { registration = r } },
  open: (...args) => { opened.push(args) },
}

const source = readFileSync(CLIENT, 'utf8')
new Function('window', source)(globalThis.window)

if (!registration) throw new Error('client.js did not call window.__ModuleLoader__.load')
if (registration.id !== 'dsh-devloop-ui') {
  throw new Error(`loader id must equal the package name, got ${String(registration.id)}`)
}
if (typeof registration.factory !== 'function') throw new Error('registration.factory is not a function')

const React = {
  createElement: (type, props, ...children) => ({ type, props: props || {}, children }),
  useState: (initial) => [initial, () => {}],
  useEffect: () => {},
}

const face = registration.factory((specifier) => {
  if (specifier === 'react') return React
  throw new Error(`client.js required an undeclared specifier: ${specifier}`)
})

if (typeof face.apply !== 'function') throw new Error('exported face has no apply()')
if (!Array.isArray(face.inject)) throw new Error('exported face has no inject array')
console.log('id            :', registration.id)
console.log('exports       :', Object.keys(face).join(', '))
console.log('inject        :', JSON.stringify(face.inject))

const calls = []
const components = {}
const ctx = {
  slots: {
    inject(name, callback) {
      calls.push({ kind: 'inject', name })
      return callback()
    },
    register(options, registered) {
      calls.push({ kind: 'register', name: options.name, id: options.id, order: options.order, label: options.label })
      components[options.name] = registered
      return () => {}
    },
  },
}

face.apply(ctx)
console.log('slot calls    :', JSON.stringify(calls))

// --- sidebar.footer.action -------------------------------------------------

const sidebarInject = calls.find((c) => c.kind === 'inject' && c.name === 'sidebar.footer.action')
if (!sidebarInject) throw new Error('did not inject sidebar.footer.action')
const sidebarRegister = calls.find((c) => c.kind === 'register' && c.name === 'sidebar.footer.action')
if (!sidebarRegister) throw new Error('did not register into sidebar.footer.action')
if (typeof sidebarRegister.id !== 'string' || sidebarRegister.id === '') {
  throw new Error('a list slot requires options.id')
}
const sidebarAction = components['sidebar.footer.action']
if (typeof sidebarAction !== 'function') throw new Error('no component was registered for sidebar.footer.action')

for (const wide of [true, false]) {
  const button = sidebarAction({ wide })
  if (button.type !== 'button') throw new Error(`expected a button, got ${String(button.type)}`)
  if (button.props['aria-label'] !== 'DevLoop') throw new Error('button is missing its aria-label')
  const before = opened.length
  button.props.onClick()
  if (opened.length !== before + 1) throw new Error('onClick did not open a window')
  const [path, target] = opened.at(-1)
  if (path !== '/devloop/') throw new Error(`opened ${String(path)} instead of /devloop/`)
  if (target !== '_blank') throw new Error(`opened with target ${String(target)}`)
  const kids = button.children.filter(Boolean)
  console.log(`render wide=${String(wide)} :`, `children=${String(kids.length)}`, `gap=${String(button.props.style.gap ?? 'n/a')}`)
}

// --- settings.section --------------------------------------------------------

const settingsInject = calls.find((c) => c.kind === 'inject' && c.name === 'settings.section')
if (!settingsInject) throw new Error('did not inject settings.section')
const settingsRegister = calls.find((c) => c.kind === 'register' && c.name === 'settings.section')
if (!settingsRegister) throw new Error('did not register into settings.section')
if (typeof settingsRegister.id !== 'string' || settingsRegister.id === '') {
  throw new Error('a list slot requires options.id')
}
const settingsSection = components['settings.section']
if (typeof settingsSection !== 'function') throw new Error('no component was registered for settings.section')

function findAll(node, predicate, out = []) {
  if (!node || typeof node !== 'object') return out
  if (predicate(node)) out.push(node)
  for (const child of node.children || []) findAll(child, predicate, out)
  return out
}

let closed = false
const panel = settingsSection({ close: () => { closed = true } })
if (panel.type !== 'div') throw new Error(`expected the section root to be a div, got ${String(panel.type)}`)

const buttons = findAll(panel, (n) => n.type === 'button')
const openButton = buttons.find((b) => (b.children || []).some((c) => c === 'Open full dashboard →'))
if (!openButton) throw new Error('settings section has no "Open full dashboard" button')

const before = opened.length
openButton.props.onClick()
if (opened.length !== before + 1) throw new Error('open-dashboard button did not open a window')
const [path] = opened.at(-1)
if (path !== '/devloop/') throw new Error(`open-dashboard button opened ${String(path)} instead of /devloop/`)
if (!closed) throw new Error('open-dashboard button did not call close()')

console.log('settings.section: renders with a close-on-open dashboard button')

console.log('\nOK: client half satisfies the loader and slot contracts (both slots).')
