import { v2 as cloudinary } from 'cloudinary'
import { NextResponse } from 'next/server'

cloudinary.config({
  cloud_name: process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME!,
  api_key: process.env.CLOUDINARY_API_KEY!,
  api_secret: process.env.CLOUDINARY_API_SECRET!,
})

export async function POST(req: Request) {
  try {
    const { imageBase64, mimeType, folder } = await req.json()
    const dataUri = `data:${mimeType};base64,${imageBase64}`

    const result = await cloudinary.uploader.upload(dataUri, {
      folder: folder || 'photo-enhancer',
      resource_type: 'image',
    })

    return NextResponse.json({ url: result.secure_url, publicId: result.public_id })
  } catch (error) {
    console.error('Cloudinary upload error:', error)
    return NextResponse.json({ error: 'Upload failed' }, { status: 500 })
  }
}
