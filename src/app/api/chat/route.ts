import { NextRequest, NextResponse } from 'next/server';
import { LLMService } from '@/services/llm';
import logger from '@/lib/logger';
import { getCharacterById } from '@/data/characters';
import { rateLimiter } from '@/lib/rate-limiter';
import { readFile } from 'fs/promises';
import { join } from 'path';

// 获取客户端IP地址
function getClientIP(request: NextRequest): string {
  const forwarded = request.headers.get('x-forwarded-for');
  const realIP = request.headers.get('x-real-ip');
  
  if (forwarded) {
    return forwarded.split(',')[0].trim();
  }
  
  if (realIP) {
    return realIP.trim();
  }
  
  // 本地开发环境fallback
  return 'localhost';
}

// 将本地图片转换为 Base64 格式，供 GLM API 使用
async function convertLocalImageToBase64(imageUrl: string): Promise<string> {
  try {
    if (imageUrl.startsWith('data:image/')) {
      // 已经是 Base64 格式，直接返回
      return imageUrl;
    }
    
    if (imageUrl.startsWith('/uploads/')) {
      // 本地上传的文件，转换为 Base64
      const filename = imageUrl.replace('/uploads/', '');
      const filePath = join(process.cwd(), 'public', 'uploads', filename);
      
      const fileBuffer = await readFile(filePath);
      const mimeType = filename.endsWith('.png') ? 'image/png' : 
                      filename.endsWith('.jpg') || filename.endsWith('.jpeg') ? 'image/jpeg' :
                      filename.endsWith('.webp') ? 'image/webp' : 
                      filename.endsWith('.gif') ? 'image/gif' : 'image/png';
      
      const base64 = fileBuffer.toString('base64');
      return `data:${mimeType};base64,${base64}`;
    }
    
    throw new Error('Unsupported image URL format');
  } catch (error) {
    console.error('Failed to convert image to Base64:', error);
    throw new Error('Failed to process image for GLM API');
  }
}

export async function POST(request: NextRequest) {
  try {
    // 速率限制检查
    const clientIP = getClientIP(request);
    const rateLimitCheck = rateLimiter.checkRateLimit(clientIP);
    
    if (!rateLimitCheck.allowed) {
      return NextResponse.json(
        { 
          error: 'Rate limit exceeded. Please try again later.',
          retryAfter: rateLimitCheck.retryAfter 
        },
        { 
          status: 429,
          headers: {
            'Retry-After': rateLimitCheck.retryAfter?.toString() || '60'
          }
        }
      );
    }

    // 记录请求
    rateLimiter.recordRequest(clientIP);
    
    // 输入验证和清理
    const body = await request.json();
    const { 
      characterId, 
      character: customCharacter, 
      message, 
      conversationHistory, 
      continueMessageId,
      previousContent,
      // GLM-4.5 新功能参数
      enableThinking = false,
      imageUrl,
      mode = 'smart' // 'standard' | 'smart' | 'thinking' | 'vision'
    } = body;

    // 输入验证
    if (!characterId || typeof characterId !== 'string') {
      return NextResponse.json(
        { error: 'Valid character ID is required' },
        { status: 400 }
      );
    }

    if (!message && !continueMessageId) {
      return NextResponse.json(
        { error: 'Message or continue message ID is required' },
        { status: 400 }
      );
    }

    // 消息长度限制
    if (message && typeof message === 'string' && message.length > 10000) {
      return NextResponse.json(
        { error: 'Message too long. Maximum 10,000 characters allowed.' },
        { status: 400 }
      );
    }

    // 验证模式参数
    const validModes = ['standard', 'smart', 'thinking', 'vision'];
    if (mode && !validModes.includes(mode)) {
      return NextResponse.json(
        { error: 'Invalid mode parameter' },
        { status: 400 }
      );
    }

    // 清理和验证图片URL
    let cleanImageUrl: string | undefined;
    if (imageUrl) {
      if (typeof imageUrl !== 'string') {
        return NextResponse.json(
          { error: 'Image URL must be a string' },
          { status: 400 }
        );
      }
      
      // 只允许本地上传的图片或base64数据
      if (imageUrl.startsWith('/uploads/') || imageUrl.startsWith('data:image/')) {
        cleanImageUrl = imageUrl;
      } else {
        return NextResponse.json(
          { error: 'Invalid image URL. Only local uploads or data URLs are allowed.' },
          { status: 400 }
        );
      }
    }

    // 验证对话历史
    if (conversationHistory && Array.isArray(conversationHistory)) {
      if (conversationHistory.length > 20) {
        // 限制对话历史长度
        conversationHistory.splice(0, conversationHistory.length - 20);
      }
      
      // 验证对话历史格式
      for (const msg of conversationHistory) {
        if (!msg.role || !msg.content || typeof msg.content !== 'string') {
          return NextResponse.json(
            { error: 'Invalid conversation history format' },
            { status: 400 }
          );
        }
        
        if (!['user', 'assistant'].includes(msg.role)) {
          return NextResponse.json(
            { error: 'Invalid role in conversation history' },
            { status: 400 }
          );
        }
      }
    }

    // 优先使用传入的自定义角色数据，否则从预设角色中查找
    let character = customCharacter;
    if (!character) {
      character = getCharacterById(characterId);
    }
    
    if (!character) {
      return NextResponse.json(
        { error: 'Character not found' },
        { status: 404 }
      );
    }

    let response;
    let context;

    if (continueMessageId && previousContent) {
      // 继续生成之前的回复（继续生成暂不支持新功能）
      response = await LLMService.continueResponse(
        character,
        previousContent,
        conversationHistory || []
      );
      context = { type: 'continue' };
    } else {
      // 生成新回复 - 支持GLM-4.5新功能
      context = LLMService.analyzeContext(message);
      
      logger.debug('API路由参数:', {
        mode,
        enableThinking,
        hasImageUrl: !!cleanImageUrl,
        messagePreview: message.substring(0, 50),
        characterId: character.id
      });
      
      // 如果有图片，转换为 GLM API 可用的格式
      let processedImageUrl = cleanImageUrl;
      if (cleanImageUrl) {
        try {
          processedImageUrl = await convertLocalImageToBase64(cleanImageUrl);
          logger.debug('图片已转换为Base64格式，长度:', processedImageUrl.length);
        } catch (error) {
          console.error('图片转换失败:', error);
          return NextResponse.json(
            { error: 'Failed to process image for analysis' },
            { status: 500 }
          );
        }
      }
      
      // 使用新的生成方法，支持深度思考和视觉理解
      response = await LLMService.generateResponse(
        character,
        message,
        conversationHistory || [],
        {
          enableThinking,
          imageUrl: processedImageUrl,
          mode
        }
      );
    }

    logger.debug('API响应数据:', {
      hasContent: !!response.content,
      hasThinking: !!response.thinkingProcess,
      thinkingLength: response.thinkingProcess?.length,
      success: response.success
    });

    return NextResponse.json({
      content: response.content,
      success: response.success,
      isComplete: response.isComplete,
      finishReason: response.finishReason,
      // GLM-4.5 新功能响应
      thinkingProcess: response.thinkingProcess,
      imageAnalysis: response.imageAnalysis,
      context,
      character: {
        id: character.id,
        name: character.name,
        avatar: character.avatar
      }
    });

  } catch (error) {
    console.error('Chat API Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}