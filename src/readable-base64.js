// Decode only complete, canonical Base64 containing printable UTF-8.
// A decoded preview is not decryption and never replaces the signed content.
export function readableBase64(content) {
  if (typeof content !== 'string' || content.length > 100000) return null;
  const value = content.trim();
  if (value.length < 8 || !/^[A-Za-z0-9+/_-]+={0,2}$/.test(value)) return null;
  const standard = value.replace(/-/g, '+').replace(/_/g, '/');
  try {
    const binary = atob(standard);
    if (btoa(binary).replace(/=+$/, '') !== standard.replace(/=+$/, '')) return null;
    const decoded = new TextDecoder('utf-8', { fatal: true }).decode(Uint8Array.from(binary, c => c.charCodeAt(0)));
    if (!decoded.trim() || /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f-\u009f]/u.test(decoded)) return null;
    if (/[\p{Cf}\p{Co}\p{Cn}]/u.test(decoded) || !/[\p{L}\p{N}]/u.test(decoded)) return null;
    return decoded;
  } catch { return null; }
}
