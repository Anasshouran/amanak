/**
 * WebCrypto's `BufferSource` requires an `ArrayBuffer`-backed view under newer
 * TypeScript DOM typings. Arbitrary callers may hand us a view over an
 * `ArrayBufferLike`, so copy into a fresh `Uint8Array<ArrayBuffer>` before
 * handing data to the Web Crypto API.
 *
 * Note: we hand Web Crypto a typed-array *view*, never a bare `ArrayBuffer`.
 * Under the jsdom test environment the realm of the global `ArrayBuffer`
 * differs from Node's WebCrypto, which accepts views (`ArrayBuffer.isView`) but
 * rejects cross-realm bare buffers.
 */
export function toBytes(bytes: Uint8Array): Uint8Array<ArrayBuffer> {
  const copy = new Uint8Array(bytes.length)
  copy.set(bytes)
  return copy
}