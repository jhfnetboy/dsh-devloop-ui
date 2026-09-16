/**
 * Offline contract check for the dsh-devloop-ui client half.
 *
 * Evaluates client.js against a stub module loader and a stub `slots` service,
 * so a broken registration is caught here instead of after a Desktop restart.
 * It asserts the loader id, the exported face, the slot options, and that the
 * button's onClick opens the dashboard path.
 */
import { readFileSync } from 'node:fs'

const CLIENT = '/Users/jason/Dev/jhfnetboy/dsh-devloop-ui/client.js'

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
  createElement: (type, props, ...children) => ({ type, props, children }),
  useState: (initial) => [initial, () => {}],
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
let component
const ctx = {
  slots: {
    inject(name, callback) {
      calls.push({ kind: 'inject', name })
      return callback()
    },
    register(options, registered) {
      calls.push({ kind: 'register', name: options.name, id: options.id, order: options.order, label: options.label })
      component = registered
      return () => {}
    },
  },
}

face.apply(ctx)
console.log('slot calls    :', JSON.stringify(calls))

const injected = calls.find((c) => c.kind === 'inject')
if (injected?.name !== 'sidebar.footer.action') throw new Error(`injected the wrong slot: ${String(injected?.name)}`)
const registered = calls.find((c) => c.kind === 'register')
if (registered?.name !== 'sidebar.footer.action') throw new Error('registered into the wrong slot')
if (typeof registered.id !== 'string' || registered.id === '') {
  throw new Error('a list slot requires options.id')
}
if (typeof component !== 'function') throw new Error('no component was registered')

for (const wide of [true, false]) {
  const element = component({ wide })
  const button = element
  if (button.type !== 'button') throw new Error(`expected a button, got ${String(button.type)}`)
  if (button.props['aria-label'] !== 'DevLoop') throw new Error('button is missing its aria-label')
  const before = opened.length
  button.props.onClick()
  if (opened.length !== before + 1) throw new Error('onClick did not open a window')
  const [path, target] = opened.at(-1)
  if (path !== '/devloop/') throw new Error(`opened ${String(path)} instead of /devloop/`)
  if (target !== '_blank') throw new Error(`opened with target ${String(target)}`)
  const kids = element.children.filter(Boolean)
  console.log(`render wide=${String(wide)} :`, `children=${String(kids.length)}`, `gap=${String(button.props.style.gap ?? 'n/a')}`)
}

console.log('\nOK: client half satisfies the loader and slot contracts.')
