import { NextRequest, NextResponse } from 'next/server';
import { LLMService } from '@/services/llm';
import logger from '@/lib/logger';
import { getCharacterById } from '@/data/characters';

export async function POST(request: NextRequest) {
  try {
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
    } = await request.json();

    if (!characterId || (!message && !continueMessageId)) {
      return NextResponse.json(
        { error: 'Character ID and message (or continue message ID) are required' },
        { status: 400 }
      );
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
        hasImageUrl: !!imageUrl,
        messagePreview: message.substring(0, 50),
        characterId: character.id
      });
      
      // 使用新的生成方法，支持深度思考和视觉理解
      response = await LLMService.generateResponse(
        character,
        message,
        conversationHistory || [],
        {
          enableThinking,
          imageUrl,
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