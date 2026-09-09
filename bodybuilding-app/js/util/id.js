/**
 * Identifier generation.
 *
 * A timestamp alone is not unique: starting two blocks back to back, or
 * finishing a session while another write lands in the same millisecond,
 * produces a collision - and a collision here silently attaches your training
 * log to the wrong block. The counter and random suffix make that impossible
 * without needing a UUID library.
 */

let counter = 0;

export function uid(prefix) {
  counter = (counter + 1) % 1_000_000;
  const time = Date.now().toString(36);
  const seq = counter.toString(36);
  const rand = Math.random().toString(36).slice(2, 8);
  return `${prefix}_${time}${seq}${rand}`;
}
