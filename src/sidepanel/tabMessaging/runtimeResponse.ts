export type RuntimeResponse<T> =
  | { ok: true; result: T }
  | { ok: false; error: string };
