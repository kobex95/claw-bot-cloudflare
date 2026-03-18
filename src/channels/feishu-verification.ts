/**
 * Feishu webhook signature verification helper
 */

export function verifyFeishuSignature(
  body: string,
  signature: string,
  timestamp: string,
  encryptKey: string
): boolean {
  const stringToSign = `${timestamp}\n${body}`;
  
  // Use Web Crypto API (Workers-native)
  const keyData = new TextEncoder().encode(encryptKey);
  const key = await crypto.subtle.importKey(
    'raw',
    keyData,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify']
  );
  
  const signatureData = base64ToUint8Array(signature);
  const data = new TextEncoder().encode(stringToSign);
  
  const isValid = await crypto.subtle.verify(
    'HMAC',
    key,
    signatureData,
    data
  );
  
  return isValid;
}

/**
 * Convert base64 string to Uint8Array
 */
function base64ToUint8Array(base64: string): Uint8Array {
  const json = atob(base64);
  const bytes = new Uint8Array(json.length);
  for (let i = 0; i < json.length; i++) {
    bytes[i] = json.charCodeAt(i);
  }
  return bytes;
}
