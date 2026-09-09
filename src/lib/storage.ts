// Screenshot storage abstraction (Roadmap V2 A9).
//
// Prototype: downscale + compress in the browser and keep the image inline as a
// data: URL in `screenshot_ref`. To move to Supabase Storage (Track B), replace
// `putScreenshot` with a bucket upload that returns the object path, and
// `screenshotUrl` with `createSignedUrl`.

const MAX_DIM = 1280
const QUALITY = 0.72

/** Read + downscale an image File to a compressed JPEG data URL. */
export async function putScreenshot(file: File): Promise<string> {
  if (!file.type.startsWith('image/')) throw new Error('Bukan file gambar')
  const dataUrl = await readAsDataUrl(file)
  try {
    return await downscale(dataUrl)
  } catch {
    return dataUrl // fall back to the raw image if canvas fails
  }
}

/** Resolve a stored ref to something an <img src> can use. */
export function screenshotUrl(ref: string | null): string | null {
  return ref // data: URLs are already usable; Storage paths would be signed here
}

function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const fr = new FileReader()
    fr.onload = () => resolve(String(fr.result))
    fr.onerror = () => reject(fr.error ?? new Error('Gagal membaca file'))
    fr.readAsDataURL(file)
  })
}

function downscale(dataUrl: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => {
      const scale = Math.min(1, MAX_DIM / Math.max(img.width, img.height))
      const w = Math.round(img.width * scale)
      const h = Math.round(img.height * scale)
      const canvas = document.createElement('canvas')
      canvas.width = w
      canvas.height = h
      const ctx = canvas.getContext('2d')
      if (!ctx) return reject(new Error('canvas 2d unavailable'))
      ctx.drawImage(img, 0, 0, w, h)
      resolve(canvas.toDataURL('image/jpeg', QUALITY))
    }
    img.onerror = () => reject(new Error('Gagal memuat gambar'))
    img.src = dataUrl
  })
}
