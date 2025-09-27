import { NextRequest, NextResponse } from 'next/server';
import { LLMService } from '@/services/llm';
import logger from '@/lib/logger';
import { getCharacterById } from '@/data/characters';
import { rateLimiter } from '@/lib/rate-limiter';

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
      previousContent
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
      // 生成新回复
      context = LLMService.analyzeContext(message);
      
      logger.debug('API路由参数:', {
        messagePreview: message.substring(0, 50),
        characterId: character.id,
        hasMultilingualSkill: character.skills?.includes('多语言交流') || false
      });
      
      // 使用简化的生成方法
      response = await LLMService.generateResponse(
        character,
        message,
        conversationHistory || []
      );
    }

    logger.debug('API响应数据:', {
      hasContent: !!response.content,
      success: response.success
    });

    return NextResponse.json({
      content: response.content,
      success: response.success,
      isComplete: response.isComplete,
      finishReason: response.finishReason,
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