/**
 * imageResize.ts — Client-side image resize and crop utility (ACCT-05).
 *
 * Uses an off-screen HTMLCanvasElement to resize and center-crop an image
 * to an exact square. Works in all modern browsers.
 */

const ALLOWED_AVATAR_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp'])

/**
 * Validates that a file is an allowed avatar image type (JPEG, PNG, or WebP).
 * Returns an error string if invalid, or null if OK.
 */
export function validateAvatarMimeType(file: File): string | null {
  if (!ALLOWED_AVATAR_TYPES.has(file.type)) {
    return 'Avatar must be a JPEG, PNG, or WebP image.'
  }
  return null
}

/**
 * Resize and center-crop a File to a square of the given pixel size.
 *
 * Draws the image into an off-screen canvas, crops to the largest
 * centered square, scales to `size × size`, and exports as JPEG at
 * 0.9 quality.
 *
 * @param file — The source image File.
 * @param size — The target square side length in pixels (default: 256).
 * @returns A new File object with the resized/cropped image.
 */
export async function resizeAndCropToSquare(file: File, size = 256): Promise<File> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    const objectUrl = URL.createObjectURL(file)

    img.onload = () => {
      URL.revokeObjectURL(objectUrl)

      const { naturalWidth: w, naturalHeight: h } = img

      // Center-crop: take the largest square from the center.
      const sideLength = Math.min(w, h)
      const sx = (w - sideLength) / 2
      const sy = (h - sideLength) / 2

      const canvas = document.createElement('canvas')
      canvas.width = size
      canvas.height = size

      const ctx = canvas.getContext('2d')
      if (!ctx) {
        reject(new Error('Canvas 2D context unavailable'))
        return
      }

      ctx.drawImage(img, sx, sy, sideLength, sideLength, 0, 0, size, size)

      canvas.toBlob(
        (blob) => {
          if (!blob) {
            reject(new Error('Canvas toBlob failed'))
            return
          }
          const baseName = file.name.replace(/\.[^.]+$/, '')
          resolve(new File([blob], `${baseName}.jpg`, { type: 'image/jpeg' }))
        },
        'image/jpeg',
        0.9,
      )
    }

    img.onerror = () => {
      URL.revokeObjectURL(objectUrl)
      reject(new Error('Failed to load image for resizing'))
    }

    img.src = objectUrl
  })
}

/**
 * Create a temporary object URL for preview purposes.
 * Remember to call URL.revokeObjectURL(url) when done.
 */
export function createPreviewUrl(file: File): string {
  return URL.createObjectURL(file)
}
