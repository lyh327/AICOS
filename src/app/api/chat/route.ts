import { NextRequest, NextResponse } from 'next/server';
import { LLMService } from '@/services/llm';
import { getCharacterById } from '@/data/characters';

export async function POST(request: NextRequest) {
  try {
    const { 
      characterId, 
      character: customCharacter, 
      message, 
      conversationHistory, 
      continueMessageId,
      previousContent 
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
      // 继续生成之前的回复
      response = await LLMService.continueResponse(
        character,
        previousContent,
        conversationHistory || []
      );
      context = { type: 'continue' };
    } else {
      // 生成新回复
      context = LLMService.analyzeContext(message);
      response = await LLMService.generateResponse(
        character,
        message,
        conversationHistory || []
      );
    }

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