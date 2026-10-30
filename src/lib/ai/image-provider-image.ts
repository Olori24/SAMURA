export function getSafeProviderImageUrl(value: string): string | null {
  try {
    const imageUrl = new URL(value);
    if (imageUrl.protocol !== "https:" || imageUrl.username || imageUrl.password) return null;
    return imageUrl.toString();
  } catch {
    return null;
  }
}
