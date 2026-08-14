export function appError(message, status = 400) {
  return Object.assign(new Error(message), { status });
}
