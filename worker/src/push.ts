export interface PushSubscriptionRecord {
  session_id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
  room_code: string;
  updated_at: number;
}

function base64UrlToBytes(b64url: string): Uint8Array {
  const pad = '='.repeat((4 - (b64url.length % 4)) % 4);
  const b64 = (b64url + pad).replace(/-/g, '+').replace(/_/g, '/');
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

function bytesToBase64Url(bytes: Uint8Array): string {
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function getVapidKeys(env: Env): { publicKey: string; privateKey: string; subject: string } | null {
  const pub = (env as unknown as Record<string, string | undefined>).VAPID_PUBLIC_KEY;
  const priv = (env as unknown as Record<string, string | undefined>).VAPID_PRIVATE_KEY;
  const subject =
    (env as unknown as Record<string, string | undefined>).VAPID_SUBJECT ||
    'mailto:lama@example.com';
  if (!pub || !priv) return null;
  return { publicKey: pub, privateKey: priv, subject };
}

interface Env {
  VAPID_PUBLIC_KEY?: string;
  VAPID_PRIVATE_KEY?: string;
  VAPID_SUBJECT?: string;
}

function buildVapidJwk(publicKeyB64Url: string, privateKeyB64Url: string): JsonWebKey {
  const pubBytes = base64UrlToBytes(publicKeyB64Url);
  if (pubBytes.length !== 65 || pubBytes[0] !== 0x04)
    throw new Error('Invalid VAPID public key length');
  const x = bytesToBase64Url(pubBytes.slice(1, 33));
  const y = bytesToBase64Url(pubBytes.slice(33, 65));
  return {
    kty: 'EC',
    crv: 'P-256',
    x,
    y,
    d: privateKeyB64Url,
    ext: true,
  };
}

async function createVapidJwt(
  endpoint: string,
  subject: string,
  publicKeyB64Url: string,
  privateKeyB64Url: string
): Promise<{ jwt: string; publicKey: string }> {
  const url = new URL(endpoint);
  const aud = `${url.protocol}//${url.host}`;
  const exp = Math.floor(Date.now() / 1000) + 12 * 60 * 60;

  const header = bytesToBase64Url(
    new TextEncoder().encode(JSON.stringify({ typ: 'JWT', alg: 'ES256' }))
  );
  const payload = bytesToBase64Url(
    new TextEncoder().encode(JSON.stringify({ aud, exp, sub: subject }))
  );
  const unsigned = `${header}.${payload}`;

  const jwk = buildVapidJwk(publicKeyB64Url, privateKeyB64Url);
  const key = await crypto.subtle.importKey(
    'jwk',
    jwk,
    { name: 'ECDSA', namedCurve: 'P-256' },
    false,
    ['sign']
  );
  const sigBuf = await crypto.subtle.sign(
    { name: 'ECDSA', hash: 'SHA-256' },
    key,
    new TextEncoder().encode(unsigned)
  );
  // ECDSA signature is 64 bytes (r||s) but subtle returns DER. Need to convert DER to JOSE.
  // Cloudflare's subtle returns raw? In WebCrypto, ECDSA sign returns DER. We need to convert.
  const jwtSig = derToJose(new Uint8Array(sigBuf));
  const jwt = `${unsigned}.${jwtSig}`;
  return { jwt, publicKey: publicKeyB64Url };
}

function derToJose(der: Uint8Array): string {
  // DER sequence: 0x30 len 0x02 rLen r 0x02 sLen s
  // Convert to 64-byte raw (32 r + 32 s)
  if (der[0] !== 0x30) {
    // Assume already raw (Cloudflare may return raw 64)
    if (der.length === 64) return bytesToBase64Url(der);
    throw new Error('Invalid DER signature');
  }
  let offset = 2;
  if (der[1] & 0x80) offset = 2 + (der[1] & 0x7f);
  // r
  if (der[offset] !== 0x02) throw new Error('Invalid DER');
  const rLen = der[offset + 1];
  let r = der.slice(offset + 2, offset + 2 + rLen);
  offset += 2 + rLen;
  // s
  if (der[offset] !== 0x02) throw new Error('Invalid DER');
  const sLen = der[offset + 1];
  let s = der.slice(offset + 2, offset + 2 + sLen);
  // Strip leading zeros
  if (r.length > 32) r = r.slice(r.length - 32);
  if (s.length > 32) s = s.slice(s.length - 32);
  const raw = new Uint8Array(64);
  raw.set(r, 32 - r.length);
  raw.set(s, 64 - s.length);
  return bytesToBase64Url(raw);
}

// Minimal push sender without payload encryption (empty body).
// This triggers the SW push event; SW shows a generic notification.
// Room-specific payload can be added later via encrypted payload.
export async function sendPush(
  env: Env,
  subscription: { endpoint: string; keys?: { p256dh: string; auth: string } },
  payload?: Record<string, unknown>
): Promise<{ ok: boolean; status: number; shouldDelete: boolean }> {
  const vapid = getVapidKeys(env);
  if (!vapid) return { ok: false, status: 0, shouldDelete: false };

  const { jwt, publicKey } = await createVapidJwt(
    subscription.endpoint,
    vapid.subject,
    vapid.publicKey,
    vapid.privateKey
  );

  const headers: Record<string, string> = {
    TTL: '60',
    Urgency: 'high',
    Authorization: `vapid t=${jwt}, k=${publicKey}`,
  };

  let body: Uint8Array | undefined;
  // If a JSON payload is provided, we send it as plain text for now.
  // Without encryption the push service will drop it, but the push itself still arrives (empty).
  // For proper encrypted payload we would need to implement aes128gcm here.
  // We signal via header that content is empty to keep it simple.
  if (payload) {
    // Attempt to send unencrypted for debugging – most browsers require encryption, so this will be ignored.
    // We keep it empty and let SW show generic fallback.
    body = undefined;
  }

  try {
    const res = await fetch(subscription.endpoint, {
      method: 'POST',
      headers,
      body: body as unknown as BodyInit | null | undefined,
    });
    const shouldDelete = res.status === 404 || res.status === 410;
    return { ok: res.ok, status: res.status, shouldDelete };
  } catch (e) {
    console.error('Push fetch failed', e);
    return { ok: false, status: 0, shouldDelete: false };
  }
}

export async function sendTurnPush(
  env: Env,
  subscription: PushSubscriptionRecord,
  roomCode: string,
  roundNumber: number
): Promise<void> {
  const payload = {
    title: 'LAMA \u2013 Du bist am Zug!',
    body: `Raum ${roomCode} \u00b7 Durchgang ${roundNumber} \u2013 du bist dran!`,
    roomCode,
    url: `/?room=${roomCode}`,
    tag: `lama-turn-${roomCode}`,
  };
  // We send empty push and rely on SW generic fallback that already reads payload if encrypted.
  // For now we attempt to send payload without encryption; SW will handle empty case.
  // Store payload on server? Not needed – SW has fallback.
  await sendPush(env, { endpoint: subscription.endpoint }, payload);
}
