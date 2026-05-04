export interface Corrections {
  brightness: number
  contrast: number
  saturation: number
  warmth: number
  sharpness: number
}

export function clamp(value: number): number {
  return Math.max(0, Math.min(255, value))
}

export function applyCorrections(_canvas: HTMLCanvasElement, src: string, corrections: Corrections): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => {
      try {
        const offscreen = document.createElement('canvas')
        offscreen.width = img.naturalWidth
        offscreen.height = img.naturalHeight
        const ctx = offscreen.getContext('2d')
        if (!ctx) { resolve(src); return }
        ctx.drawImage(img, 0, 0)

        const imageData = ctx.getImageData(0, 0, offscreen.width, offscreen.height)
        const data = imageData.data

        const brightnessFactor = corrections.brightness * 2.55
        const contrastFactor = (corrections.contrast + 100) / 100
        const warmthFactor = corrections.warmth

        for (let i = 0; i < data.length; i += 4) {
          let r = data[i], g = data[i + 1], b = data[i + 2]

          r = clamp(r + brightnessFactor)
          g = clamp(g + brightnessFactor)
          b = clamp(b + brightnessFactor)

          r = clamp((r - 128) * contrastFactor + 128)
          g = clamp((g - 128) * contrastFactor + 128)
          b = clamp((b - 128) * contrastFactor + 128)

          r = clamp(r + warmthFactor)
          b = clamp(b - warmthFactor)

          if (corrections.saturation !== 0) {
            const gray = 0.299 * r + 0.587 * g + 0.114 * b
            const satFactor = (corrections.saturation + 100) / 100
            r = clamp(gray + (r - gray) * satFactor)
            g = clamp(gray + (g - gray) * satFactor)
            b = clamp(gray + (b - gray) * satFactor)
          }

          data[i] = r
          data[i + 1] = g
          data[i + 2] = b
        }

        ctx.putImageData(imageData, 0, 0)
        resolve(offscreen.toDataURL('image/jpeg', 0.92))
      } catch (e) {
        reject(e)
      }
    }
    img.onerror = () => reject(new Error('Image load failed'))
    img.src = src
  })
}

export function resizeCanvas(canvas: HTMLCanvasElement, width: number, height: number): string {
  const resized = document.createElement('canvas')
  resized.width = width
  resized.height = height
  const ctx = resized.getContext('2d')!
  ctx.drawImage(canvas, 0, 0, width, height)
  return resized.toDataURL('image/jpeg', 0.92)
}
