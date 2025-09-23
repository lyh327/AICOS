import { NextRequest, NextResponse } from 'next/server';
import { writeFile, mkdir } from 'fs/promises';
import { join } from 'path';
import crypto from 'crypto';

// 安全配置
const MAX_FILE_SIZE = parseInt(process.env.MAX_FILE_SIZE || '10485760'); // 10MB
const ALLOWED_TYPES = (process.env.ALLOWED_IMAGE_TYPES || 'image/jpeg,image/png,image/webp,image/gif').split(',');
const UPLOAD_DIR = join(process.cwd(), 'public', 'uploads');

// 确保上传目录存在
async function ensureUploadDir() {
  try {
    await mkdir(UPLOAD_DIR, { recursive: true });
  } catch (error) {
    console.error('Failed to create upload directory:', error);
  }
}

// 验证文件类型
function validateFileType(file: File): boolean {
  return ALLOWED_TYPES.includes(file.type);
}

// 验证文件大小
function validateFileSize(file: File): boolean {
  return file.size <= MAX_FILE_SIZE;
}

// 生成安全的文件名
function generateSecureFileName(originalName: string): string {
  const ext = originalName.split('.').pop() || '';
  const timestamp = Date.now();
  const randomBytes = crypto.randomBytes(8).toString('hex');
  return `${timestamp}_${randomBytes}.${ext}`;
}

// 验证图片内容（简单的魔数检查）
function validateImageContent(buffer: Buffer, mimeType: string): boolean {
  const signatures: Record<string, number[][]> = {
    'image/jpeg': [[0xFF, 0xD8, 0xFF]],
    'image/png': [[0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]],
    'image/webp': [[0x52, 0x49, 0x46, 0x46]], // RIFF header
    'image/gif': [[0x47, 0x49, 0x46, 0x38]] // GIF8
  };

  const fileSignatures = signatures[mimeType];
  if (!fileSignatures) return false;

  return fileSignatures.some(signature => 
    signature.every((byte, index) => buffer[index] === byte)
  );
}

export async function POST(request: NextRequest) {
  try {
    // 检查内容类型
    const contentType = request.headers.get('content-type');
    if (!contentType?.startsWith('multipart/form-data')) {
      return NextResponse.json(
        { error: 'Content-Type must be multipart/form-data' },
        { status: 400 }
      );
    }

    const formData = await request.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return NextResponse.json(
        { error: 'No file provided' },
        { status: 400 }
      );
    }

    // 验证文件大小
    if (!validateFileSize(file)) {
      return NextResponse.json(
        { error: `File size exceeds ${MAX_FILE_SIZE / 1024 / 1024}MB limit` },
        { status: 400 }
      );
    }

    // 验证文件类型
    if (!validateFileType(file)) {
      return NextResponse.json(
        { error: `File type ${file.type} is not allowed. Allowed types: ${ALLOWED_TYPES.join(', ')}` },
        { status: 400 }
      );
    }

    // 读取文件内容
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    // 验证文件内容
    if (!validateImageContent(buffer, file.type)) {
      return NextResponse.json(
        { error: 'Invalid image file content' },
        { status: 400 }
      );
    }

    // 确保上传目录存在
    await ensureUploadDir();

    // 生成安全的文件名
    const secureFileName = generateSecureFileName(file.name);
    const filePath = join(UPLOAD_DIR, secureFileName);

    // 保存文件
    await writeFile(filePath, buffer);

    // 返回可访问的URL（相对于public目录）
    const fileUrl = `/uploads/${secureFileName}`;

    console.log(`File uploaded successfully: ${secureFileName}, size: ${file.size} bytes`);

    return NextResponse.json({
      success: true,
      url: fileUrl,
      filename: secureFileName,
      originalName: file.name,
      size: file.size,
      type: file.type
    });

  } catch (error) {
    console.error('Upload error:', error);
    return NextResponse.json(
      { error: 'Failed to upload file' },
      { status: 500 }
    );
  }
}

// 处理 OPTIONS 请求（用于 CORS）
export async function OPTIONS(request: NextRequest) {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Allow': 'POST',
      'Content-Length': '0'
    }
  });
}