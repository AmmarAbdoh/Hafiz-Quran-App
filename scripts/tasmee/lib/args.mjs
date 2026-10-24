/*
 * Reading `--name value` off the command line.
 *
 * Eight scripts in this directory had written this out for themselves, one of
 * them twice and with a different signature, which is how `--fixtures` came
 * to mean a different default depending on which script was asked.
 */

/** The value after `--name`, or `fallback` when it was not passed. */
export function flag(name, fallback) {
  const index = process.argv.indexOf(`--${name}`);
  return index === -1 ? fallback : process.argv[index + 1];
}

/** True when `--name` is present at all, for switches that take no value. */
export function hasFlag(name) {
  return process.argv.includes(`--${name}`);
}
