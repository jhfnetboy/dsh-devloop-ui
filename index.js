/**
 * Host half for the browser-only DevLoop sidebar entry.
 *
 * It deliberately registers nothing. Its whole job is to be a Loader entry whose
 * package declares `dsh.client`, which is what makes `dsh-client-modules` compose
 * and serve `./client.js` to the page.
 */
export function apply() {}
