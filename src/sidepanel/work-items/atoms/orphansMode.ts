/**
 * Which question the Orphans tab is answering.
 *
 * `orphans` is where an item sits in the hierarchy. `in-progress` is who moved
 * it and who holds it now — described separately, and kept as its own model
 * rather than folded into the first until it has been lived with.
 */
export type OrphansMode = 'orphans' | 'in-progress';
