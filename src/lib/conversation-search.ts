export function escapeLikeSearchTerm(value: string): string {
  return value.replace(/[\\%_]/g, "\\$&");
}
