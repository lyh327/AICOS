"use client";
import Image from 'next/image';

import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { useState, useEffect, useRef } from 'react';
import { getCharacterById } from '@/data/characters';
import { Character, ChatMessage, ChatSession } from '@/types';
import { Button } from '@/components/ui/button';
import { ChatLayout } from '@/components/ChatLayout';
import { SessionStorageService } from '@/services/session-storage';
import { Volume2, MoreHorizontal } from 'lucide-react';
import { ASRService, AdvancedVoiceService } from '@/services/voice';
import { generateMessageId } from '@/lib/utils';

import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import logger from '@/lib/logger';

export default function ChatPage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();

  const [character, setCharacter] = useState<Character | null>(null);
  const [currentSession, setCurrentSession] = useState<ChatSession | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputMessage, setInputMessage] = useState('');
  const [isListening, setIsListening] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isContinuing, setIsContinuing] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [voiceError, setVoiceError] = useState('');
  const [showVoiceError, setShowVoiceError] = useState(true);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  // 消息编辑状态
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [editingContent, setEditingContent] = useState('');
  // 中文拼音等输入法组合态
  const [isComposing, setIsComposing] = useState(false);

  useEffect(() => {
    console.log('useEffect 被调用了！params.id:', params.id);

    const loadSession = async (sessionId: string) => {
      try {
        console.log('正在加载会话:', sessionId);
        const session = await SessionStorageService.getSession(sessionId);
        if (session) {
          console.log('会话加载成功:', session.title);
          setCurrentSession(session);
          setMessages(session.messages || []);
        }
      } catch (error) {
        logger.error('加载会话错误:', error);
      }
    };

    if (params.id) {
      console.log('开始获取角色, ID:', params.id);
      const char = getCharacterById(params.id as string);
      console.log('获取到的角色:', char?.name);

      if (char) {
        console.log('设置角色:', char.name);
        setCharacter(char);

        // 检查是否有指定的会话ID
        const sessionId = searchParams.get('session');
        const isNew = searchParams.get('new');

        console.log('URL参数 - sessionId:', sessionId, 'isNew:', isNew);

        if (sessionId) {
          loadSession(sessionId);
        } else if (isNew) {
          // 当 ?new=1 时，强制进入空的新会话页面，哪怕存在历史会话，避免自动加载
          console.log('强制进入新会话模式');
          setCurrentSession(null);
          setMessages([]);
        } else {
          // 尝试加载最近的会话，但不自动创建新会话
          const recentSessions = SessionStorageService.getSessionsByCharacter(char.id);
          console.log('最近的会话数量:', recentSessions.length);
          if (recentSessions.length > 0) {
            loadSession(recentSessions[0].id);
          } else {
            // 不自动创建会话，用户需要主动开始对话
            console.log('没有历史会话，等待用户开始对话');
            setCurrentSession(null);
            setMessages([]);
          }
        }
      } else {
        console.log('角色未找到，跳转到首页');
        router.push('/');
      }
    } else {
      console.log('params.id 不存在');
    }
  }, [params.id, searchParams, router]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);


  const createNewSession = (characterId: string, existingMessages: ChatMessage[] = []): ChatSession => {
    const newSession = SessionStorageService.createSession(characterId);
    if (existingMessages.length > 0) {
      for (const msg of existingMessages) {
        SessionStorageService.addMessage(newSession.id, msg);
      }
      // 重新加载会话以获取保存后的消息和可能更新的标题
      const reloaded = SessionStorageService.getSession(newSession.id);
      if (reloaded) {
        setCurrentSession(reloaded);
        setMessages(reloaded.messages || []);
      } else {
        setCurrentSession(newSession);
        setMessages([]);
      }
    } else {
      // 若无初始消息，保持会话消息为空，由页面欢迎界面提示用户开始对话。
      newSession.messages = [];
      SessionStorageService.saveSession(newSession);
      setCurrentSession(newSession);
      setMessages(newSession.messages);
    }

    // 更新 URL 到新会话
    const newUrl = `/chat/${characterId}?session=${newSession.id}`;
    window.history.replaceState({}, '', newUrl);

    return newSession;
  };

  const saveCurrentMessage = (message: ChatMessage) => {
    if (currentSession) {
      const updatedSession = SessionStorageService.addMessage(currentSession.id, message);
      if (updatedSession) {
        setCurrentSession(updatedSession);
      }
    }
  };

  // 长文本分段处理
  const splitLongText = (text: string, maxLength: number = 2000): string[] => {
    if (text.length <= maxLength) return [text];

    const segments = [];
    let currentSegment = '';
    const sentences = text.split(/([。！？；\n])/);

    for (let i = 0; i < sentences.length; i++) {
      const sentence = sentences[i];
      if (currentSegment.length + sentence.length <= maxLength) {
        currentSegment += sentence;
      } else {
        if (currentSegment) {
          segments.push(currentSegment.trim());
          currentSegment = sentence;
        } else {
          // 单个句子太长，强制分割
          const words = sentence.split('');
          for (let j = 0; j < words.length; j += maxLength) {
            segments.push(words.slice(j, j + maxLength).join(''));
          }
        }
      }
    }

    if (currentSegment) {
      segments.push(currentSegment.trim());
    }

    return segments.filter(seg => seg.length > 0);
  };

  // 带超时和重试的API调用
  type ApiChatResponse = {
    content: string;
    isComplete?: boolean;
    finishReason?: string;
    thinkingProcess?: string;
    imageAnalysis?: string;
  };

  const makeAPICallWithTimeout = async (
    requestBody: Record<string, unknown>,
    timeoutMs: number = 70000, // 默认70秒，给后端充足时间
    maxRetries: number = 1 // 减少前端重试，因为后端已经有重试机制
  ): Promise<ApiChatResponse> => {
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

        const response = await fetch('/api/chat', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(requestBody),
          signal: controller.signal
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
          throw new Error(`API request failed with status: ${response.status}`);
        }

        const json = await response.json();
        return json as ApiChatResponse;
      } catch (error) {
        console.warn(`API call attempt ${attempt + 1} failed:`, error);

        if (attempt === maxRetries) {
          if (error instanceof Error && error.name === 'AbortError') {
            throw new Error('请求超时，建议分段发送较短的消息，或稍后重试');
          }
          throw error;
        }

        // 前端重试间隔稍长一些
        await new Promise(resolve => setTimeout(resolve, 3000));
      }
    }
    // 如果所有重试都未能成功，则抛出错误以满足返回类型要求
    throw new Error('API 调用在所有重试后失败');
  };

  const handleSendMessage = async () => {
    if (!inputMessage.trim() || !character) return;

    const currentInput = inputMessage.trim();
    // 检查文本长度，如果太长则提示用户
    const isLongText = currentInput.length > 2000;
    if (isLongText) {
      const confirmed = window.confirm(
        `您的消息较长（${currentInput.length}字符），可能需要较长处理时间。\n\n建议：\n1. 分段发送（推荐）\n2. 继续发送完整消息\n\n点击"确定"继续发送完整消息，点击"取消"可以分段发送`
      );

      if (!confirmed) {
        // 用户选择分段发送
        const segments = splitLongText(currentInput, 1500);

        if (segments.length > 1) {
          const segmentConfirm = window.confirm(
            `将分为${segments.length}段发送：\n${segments.map((seg, i) => `第${i + 1}段: ${seg.substring(0, 50)}...`).join('\n')}\n\n确认分段发送吗？`
          );

          if (segmentConfirm) {
            // 分段发送
            setInputMessage('');
            for (let i = 0; i < segments.length; i++) {
              const segmentPrefix = segments.length > 1 ? `[${i + 1}/${segments.length}] ` : '';
              const segmentMessage = segmentPrefix + segments[i];

              await handleSingleMessage(segmentMessage, true);

              // 段间延迟，避免API压力
              if (i < segments.length - 1) {
                await new Promise(resolve => setTimeout(resolve, 500));
              }
            }
            return;
          }
        }
      }
    }

    // 单条消息发送
    setInputMessage('');
    await handleSingleMessage(currentInput, true);
  };

  const handleSingleMessage = async (
    messageContent: string,
    createSessionIfNeeded: boolean = true
  ) => {
    if (!character) return;

    const userMessageId = generateMessageId('user');
    const userMessage: ChatMessage = {
      id: userMessageId,
      type: 'user',
      content: messageContent,
      timestamp: new Date(),
    };

    // 如果没有当前会话且需要创建，创建新会话并包含用户消息
    let session = currentSession;
    if (!session && createSessionIfNeeded) {
      session = createNewSession(character.id, [userMessage]);
    } else {
      // 如果已有会话，正常添加消息
      setMessages(prev => [...prev, userMessage]);
      saveCurrentMessage(userMessage);
    }

    setIsLoading(true);

    try {
      // 准备对话历史
      const conversationHistory = messages.slice(-6).map(msg => ({
        role: msg.type === 'user' ? 'user' as const : 'assistant' as const,
        content: msg.content
      }));

      // 使用带超时的API调用
      const data = await makeAPICallWithTimeout({
        characterId: character.id,
        character: character.isCustom ? character : undefined,
        message: messageContent,
        conversationHistory
      }, messageContent.length > 2000 ? 100000 : messageContent.length > 1000 ? 85000 : 70000); // 根据长度动态调整超时

      // 直接添加实际回复

      const aiMessageId = generateMessageId('ai');
      const aiResponse: ChatMessage = {
        id: aiMessageId,
        type: 'character',
        content: data.content,
        timestamp: new Date(),
        isComplete: data.isComplete !== false,
        canContinue: data.isComplete === false && data.finishReason === 'length'
      };

      setMessages(prev => [...prev, aiResponse]);
      saveCurrentMessage(aiResponse);
      setIsLoading(false);
    } catch (error) {
      console.error('Chat error:', error);

      // 移除所有loading消息
      setMessages(prev => prev.filter(msg => !msg.id.startsWith('loading-')));

      // 根据错误类型提供不同的fallback
      let errorMessage = '抱歉，处理您的消息时出现了问题。';
      if (error instanceof Error) {
        if (error.message.includes('超时') || error.message.includes('timeout')) {
          errorMessage = `处理超时了！这通常发生在文本较长或网络较慢时。

建议尝试：
1. 将长文本分段发送（每段1000字符以内）
2. 检查网络连接后重试
3. 稍后再试，服务可能临时繁忙

您的消息长度：${messageContent.length}字符${messageContent.length > 2000 ? '（建议分段）' : ''}`;
        } else if (error.message.includes('failed') || error.message.includes('网络')) {
          errorMessage = '网络连接出现问题，请检查网络后重试。如果问题持续，请联系管理员。';
        } else if (error.message.includes('Rate limit')) {
          errorMessage = '请求过于频繁，请稍等片刻再试。';
        }
      }

      const fallbackMessageId = generateMessageId('fallback');
      const fallbackResponse: ChatMessage = {
        id: fallbackMessageId,
        type: 'character',
        content: errorMessage,
        timestamp: new Date(),
        isComplete: true,
        canContinue: false
      };
      setMessages(prev => [...prev, fallbackResponse]);
      saveCurrentMessage(fallbackResponse);

    } finally {
      setIsLoading(false);
    }
  };

  // 生成模拟回复
  const generateMockResponse = (userInput: string, char: Character): string => {
    const responses = {
      'harry-potter': [
        '这让我想起了在霍格沃茨的日子...',
        '赫敏总是说学习是最重要的，你觉得呢？',
        '在格兰芬多，我们重视勇气和友谊。',
        '对抗黑魔法防御术课教会了我很多东西。'
      ],
      'socrates': [
        '让我们一起思考这个问题的本质是什么...',
        '你认为你真的了解你所说的吗？',
        '智慧开始于承认自己的无知。',
        '通过提问，我们能够发现真理。'
      ],
      'shakespeare': [
        '生活就像一个舞台，每个人都在演自己的角色...',
        '语言是思想的翅膀，让我们的想象力翱翔。',
        '爱情是盲目的，但它却能看见心灵深处。',
        '戏剧反映了人性的光辉与黑暗。'
      ],
      'confucius': [
        '学而时习之，不亦说乎？',
        '己所不欲，勿施于人。',
        '三人行，必有我师焉。',
        '温故而知新，可以为师矣。'
      ],
      'einstein': [
        '想象力比知识更重要...',
        '宇宙中最令人难以理解的是它是可以理解的。',
        '好奇心是我最大的动力。',
        '科学不过是日常思维的完善。'
      ]
    };

    const charResponses = responses[char.id as keyof typeof responses] || [
      '这是一个很有趣的观点...',
      '让我们深入探讨这个话题。',
      '你的想法很独特。'
    ];

    return charResponses[Math.floor(Math.random() * charResponses.length)];
  };

  const handleContinueMessage = async (messageId: string) => {
    if (!character || isContinuing) return;

    const messageToUpdate = messages.find(msg => msg.id === messageId);
    if (!messageToUpdate || messageToUpdate.type !== 'character') return;

    setIsContinuing(true);

    try {
      // 准备对话历史（不包含要继续的消息）
      const historyMessages = messages.filter(msg => msg.id !== messageId);
      const conversationHistory = historyMessages.slice(-6).map(msg => ({
        role: msg.type === 'user' ? 'user' as const : 'assistant' as const,
        content: msg.content
      }));

      // 调用继续生成API
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          characterId: character.id,
          character: character.isCustom ? character : undefined,
          continueMessageId: messageId,
          previousContent: messageToUpdate.content,
          conversationHistory
        })
      });

      if (!response.ok) {
        throw new Error('API request failed');
      }

      const data = await response.json();

      // 合并内容，确保没有重复
      const newContent = data.content.trim();

      // 如果新内容为空或者过短，跳过更新
      if (!newContent || newContent.length < 5) {
        throw new Error('继续生成的内容过短或为空');
      }

      // 更新消息内容 - 直接追加新内容
      const updatedMessage: ChatMessage = {
        ...messageToUpdate,
        content: messageToUpdate.content + newContent,
        isComplete: data.isComplete !== false,
        canContinue: data.isComplete === false && data.finishReason === 'length'
      };

      // 更新消息列表
      setMessages(prev => prev.map(msg =>
        msg.id === messageId ? updatedMessage : msg
      ));

      // 保存更新后的消息
      if (currentSession) {
        const updatedSession = { ...currentSession };
        updatedSession.messages = updatedSession.messages.map(msg =>
          msg.id === messageId ? updatedMessage : msg
        );
        SessionStorageService.saveSession(updatedSession);
        setCurrentSession(updatedSession);
      }

    } catch (error) {
      console.error('Continue message error:', error);
      // 降级处理：标记为继续失败，显示重试按钮
      const updatedMessage: ChatMessage = {
        ...messageToUpdate,
        isComplete: false,
        canContinue: true // 保持可继续状态，允许重试
      };

      setMessages(prev => prev.map(msg =>
        msg.id === messageId ? updatedMessage : msg
      ));
    } finally {
      setIsContinuing(false);
    }
  };

  const startVoiceRecording = () => {
    if (!ASRService.isAvailable()) {
      setVoiceError('您的浏览器不支持语音识别功能');
      setShowVoiceError(true);
      return;
    }

    setVoiceError('');
    setIsListening(true);

    const language = character?.language === 'en' ? 'en-US' : 'zh-CN';

    ASRService.startRecording(
      (transcript) => {
        setInputMessage(transcript);
        setIsListening(false);
      },
      () => {
        setIsListening(false);
      },
      (error) => {
        setVoiceError(error);
        setShowVoiceError(true);
        setIsListening(false);
      },
      language
    );
  };

  const stopVoiceRecording = () => {
    ASRService.stopRecording();
    setIsListening(false);
  };

  const playTTS = async (text: string) => {
    if (!character) return;

    try {
      setIsPlaying(true);
      await AdvancedVoiceService.speakAsCharacter(text, character.id);
    } catch (error) {
      console.error('TTS Error:', error);
      setVoiceError('语音播放失败');
    } finally {
      setIsPlaying(false);
    }
  };

  // 开始编辑消息
  const startEditMessage = (messageId: string, content: string) => {
    setEditingMessageId(messageId);
    setEditingContent(content);
  };

  // 取消编辑
  const cancelEdit = () => {
    setEditingMessageId(null);
    setEditingContent('');
  };

  // 保存编辑并从该消息重新对话
  const saveEditAndContinue = async (messageId: string) => {
    if (!editingContent.trim() || !character) return;

    try {
      setIsLoading(true);

      // 找到要编辑的消息在数组中的位置
      const messageIndex = messages.findIndex(msg => msg.id === messageId);
      if (messageIndex === -1) return;

      // 更新消息内容
      const updatedMessage: ChatMessage = {
        ...messages[messageIndex],
        content: editingContent.trim(),
        timestamp: new Date() // 更新时间戳
      };

      // 截断到这条消息，移除后续所有消息
      const newMessages = messages.slice(0, messageIndex);
      newMessages.push(updatedMessage);

      // 更新UI
      setMessages(newMessages);

      // 更新会话存储
      if (currentSession) {
        const updatedSession = { ...currentSession };
        updatedSession.messages = newMessages;
        SessionStorageService.saveSession(updatedSession);
        setCurrentSession(updatedSession);
      }

      // 结束编辑状态
      setEditingMessageId(null);
      setEditingContent('');

      // 准备重新生成AI回复
      const conversationHistory = newMessages.slice(-6).map(msg => ({
        role: msg.type === 'user' ? 'user' as const : 'assistant' as const,
        content: msg.content
      }));

      const currentMode = 'smart';

      // 调用聊天API重新生成回复
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          characterId: character.id,
          character: character.isCustom ? character : undefined,
          message: updatedMessage.content,
          conversationHistory: conversationHistory.slice(0, -1), // 不包含刚编辑的消息
          imageUrl: updatedMessage.attachedImage,
          mode: currentMode
        })
      });

      if (!response.ok) {
        throw new Error('API request failed');
      }

      const data = await response.json();

      const aiMessageId = generateMessageId('ai');
      const aiResponse: ChatMessage = {
        id: aiMessageId,
        type: 'character',
        content: data.content,
        timestamp: new Date(),
        isComplete: data.isComplete !== false,
        canContinue: data.isComplete === false && data.finishReason === 'length'
      };

      setMessages(prev => [...prev, aiResponse]);
      saveCurrentMessage(aiResponse);

    } catch (error) {
      console.error('Edit and continue error:', error);
      // 如果出错，生成fallback回复
      const fallbackMessageId = generateMessageId('fallback');
      const fallbackResponse: ChatMessage = {
        id: fallbackMessageId,
        type: 'character',
        content: generateMockResponse(editingContent, character),
        timestamp: new Date(),
        isComplete: true,
        canContinue: false
      };
      setMessages(prev => [...prev, fallbackResponse]);
      saveCurrentMessage(fallbackResponse);
    } finally {
      setIsLoading(false);
    }
  };

  // 重新生成最新回复
  const regenerateLastResponse = async () => {
    if (!character || messages.length === 0) return;

    // 找到最后一条AI消息
    const lastAiMessageIndex = messages.findLastIndex(msg => msg.type === 'character');
    if (lastAiMessageIndex === -1) return;

    // 找到对应的用户消息
    const userMessageIndex = lastAiMessageIndex - 1;
    if (userMessageIndex < 0 || messages[userMessageIndex].type !== 'user') return;

    const userMessage = messages[userMessageIndex];

    try {
      setIsLoading(true);

      // 移除最后一条AI回复
      const newMessages = messages.slice(0, lastAiMessageIndex);
      setMessages(newMessages);

      // 更新会话存储
      if (currentSession) {
        const updatedSession = { ...currentSession };
        updatedSession.messages = newMessages;
        SessionStorageService.saveSession(updatedSession);
        setCurrentSession(updatedSession);
      }

      // 准备对话历史（不包含要重新生成的消息）
      const conversationHistory = newMessages.slice(-6).map(msg => ({
        role: msg.type === 'user' ? 'user' as const : 'assistant' as const,
        content: msg.content
      }));
      // 重新调用API
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          characterId: character.id,
          character: character.isCustom ? character : undefined,
          message: userMessage.content,
          conversationHistory: conversationHistory.slice(0, -1) // 不包含最后的用户消息
        })
      });

      if (!response.ok) {
        throw new Error('API request failed');
      }

      const data = await response.json();

      const aiMessageId = generateMessageId('ai');
      const aiResponse: ChatMessage = {
        id: aiMessageId,
        type: 'character',
        content: data.content,
        timestamp: new Date(),
        isComplete: data.isComplete !== false,
        canContinue: data.isComplete === false && data.finishReason === 'length'
      };

      setMessages(prev => [...prev, aiResponse]);
      saveCurrentMessage(aiResponse);

    } catch (error) {
      console.error('Regenerate error:', error);
      // 恢复原消息并添加错误提示
      setMessages(messages);
      const fallbackMessageId = generateMessageId('fallback');
      const fallbackResponse: ChatMessage = {
        id: fallbackMessageId,
        type: 'character',
        content: '抱歉，重新生成失败。请稍后重试。',
        timestamp: new Date(),
        isComplete: true,
        canContinue: false
      };
      setMessages(prev => [...prev, fallbackResponse]);
      saveCurrentMessage(fallbackResponse);
    } finally {
      setIsLoading(false);
    }
  };

  if (!character) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="text-6xl mb-4">🔍</div>
          <h3 className="text-lg font-medium">角色未找到</h3>
          <p className="text-gray-600 dark:text-gray-300 mb-4">抱歉，无法找到指定的角色</p>
          <Button onClick={() => router.push('/')}>返回首页</Button>
        </div>
      </div>
    );
  }

  // 输入框组件
  const inputComponent = (
    //背景色透明
    <div className="pb-6 px-8">
      {/* 主输入框 */}
      <div className="relative bg-gray-50 rounded-2xl focus-within:border-blue-500 transition-colors">
        <div className="flex items-start p-4 gap-3">

          {/* 文本输入 */}
          <div className="flex-1 relative">
            <textarea
              value={inputMessage}
              onChange={(e) => setInputMessage(e.target.value)}
              placeholder={isLoading ? "正在处理中，请稍候..." : "输入消息..."}
              disabled={isLoading || isContinuing}
              onCompositionStart={() => setIsComposing(true)}
              onCompositionEnd={() => setIsComposing(false)}
              onKeyDown={(e) => {
                // 组合输入中（中文拼音等）不触发发送
                const nativeEvt = e.nativeEvent as unknown as KeyboardEvent & { isComposing?: boolean; keyCode?: number };
                const composing = nativeEvt?.isComposing || isComposing || nativeEvt?.keyCode === 229;
                if (e.key === 'Enter' && !e.shiftKey) {
                  if (composing) return; // 仅确认候选，不发送
                  e.preventDefault();
                  if (!isLoading && !isContinuing) handleSendMessage();
                }
              }}
              className="w-full bg-transparent border-none outline-none resize-none text-sm leading-6 placeholder-gray-500 min-h-[24px] max-h-32 disabled:cursor-not-allowed disabled:opacity-50 pr-20"
              rows={1}
              style={{
                height: 'auto',
                minHeight: '24px'
              }}
              onInput={(e) => {
                const target = e.target as HTMLTextAreaElement;
                target.style.height = 'auto';
                target.style.height = target.scrollHeight + 'px';
              }}
            />
            
            {/* 输入框右侧的提示信息 - 绝对定位，紧跟文字 */}
            {inputMessage.length > 0 && (
              <div className="absolute right-0 bottom-0 flex items-end gap-2 pointer-events-none">
                {/* 文本长度提示 */}
                {inputMessage.length > 0 && (
                  <span className={`text-xs px-1.5 py-0.5 rounded text-nowrap ${inputMessage.length > 2000
                    ? 'bg-orange-100 text-orange-700'
                    : inputMessage.length > 1000
                      ? 'bg-yellow-100 text-yellow-700'
                      : 'bg-gray-100 text-gray-600'
                    }`}>
                    {inputMessage.length}字符
                    {inputMessage.length > 2000 && ' (建议分段)'}
                    {inputMessage.length > 1000 && inputMessage.length <= 2000 && ' (较长)'}
                  </span>
                )}

              </div>
            )}
          </div>

          {/* 右侧按钮组 */}
          <div className="flex items-center gap-2">
            {/* 语音按钮 */}
            <button
              onClick={isListening ? stopVoiceRecording : startVoiceRecording}
              disabled={isLoading || isContinuing}
              className={`p-2 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${isListening
                ? 'text-red-500 bg-red-50 hover:bg-red-100'
                : 'text-gray-500 hover:text-gray-700 hover:bg-gray-200'
                }`}
              title={isListening ? '停止录音' : '语音输入'}
            >
              {isListening ? (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                  <rect x="6" y="6" width="12" height="12" rx="2" />
                </svg>
              ) : (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
                  <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                  <line x1="12" y1="19" x2="12" y2="22" />
                  <line x1="8" y1="22" x2="16" y2="22" />
                </svg>
              )}
            </button>

            {/* 发送按钮 */}
            <button
              onClick={handleSendMessage}
              disabled={!inputMessage.trim() || !character || isLoading || isContinuing || isComposing}
              className="p-2 bg-black text-white rounded-lg hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              title="发送消息"
            >
              {isLoading || isContinuing ? (
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="m22 2-7 20-4-9-9-4Z" />
                  <path d="M22 2 11 13" />
                </svg>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* 错误提示 */}
      {voiceError && showVoiceError && (
        <div className="mt-2 text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg flex items-start justify-between">
          <div className="pr-4 flex-1">{voiceError}</div>
          <button
            onClick={() => setShowVoiceError(false)}
            className="ml-2 text-sm text-red-600 opacity-80 hover:opacity-100"
            aria-label="关闭语音错误提示"
          >
            ×
          </button>
        </div>
      )}
    </div>
  );

  return (
    <ChatLayout
      currentCharacter={character}
      currentSessionId={currentSession?.id}
      footer={inputComponent}
    >
      {/* 聊天区域 */}
      <main className="flex-1 flex flex-col">
        <div className="flex-1 overflow-y-auto px-6 py-6 space-y-4">
          {!currentSession && messages.length === 0 ? (
            /* 欢迎界面 */
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center max-w-md">
                <div className="text-6xl mb-4">{character.avatar}</div>
                <h2 className="text-2xl font-bold mb-2">{character.name}</h2>
                <p className="text-gray-600 dark:text-gray-300 mb-6">{character.description}</p>
                <div className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded-lg p-4 mb-6">
                  <p className="text-sm text-gray-800 dark:text-gray-200">
                    你好！我是{character.name}。很高兴与你对话！你想聊什么呢？
                  </p>
                </div>
                <p className="text-sm text-gray-600 dark:text-gray-300">
                  在下方输入框开始对话
                </p>
              </div>
            </div>
          ) : (
            /* 消息列表 */
            <>
              {messages.map((message) => (
                <div
                  key={message.id}
                  className={`flex group w-full min-w-0 ${message.type === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  {/* 编辑模式时占满宽度 */}
                  {editingMessageId === message.id && message.type === 'user' ? (
                    <div className="w-full">
                      <div className="space-y-2">
                        <textarea
                          value={editingContent}
                          onChange={(e) => setEditingContent(e.target.value)}
                          className="w-full p-4 border rounded-lg resize-none bg-white text-gray-800 border-gray-300 min-h-[100px]"
                          rows={Math.max(3, editingContent.split('\n').length)}
                          autoFocus
                          placeholder="编辑您的消息..."
                        />
                        <div className="flex gap-2 justify-end">
                          <Button
                            size="sm"
                            onClick={() => saveEditAndContinue(message.id)}
                            disabled={!editingContent.trim() || isLoading || isContinuing}
                          >
                            确认
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={cancelEdit}
                            disabled={isLoading || isContinuing}
                          >
                            取消
                          </Button>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="max-w-[70%] min-w-0 break-words overflow-hidden">
                      {/* 消息框 */}
                      <div
                        className={`message-container chat-message rounded-lg p-4 min-w-0 ${message.type === 'user'
                          ? 'bg-gray-100 text-gray-800 border border-gray-200'
                          : 'bg-slate-50 text-slate-800 border border-slate-200 dark:bg-slate-800 dark:text-slate-100 dark:border-slate-600'
                          }`}
                      >
                        <div className="flex items-start gap-2">
                          {message.type === 'character' && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => playTTS(message.content)}
                              className="flex-shrink-0 p-1 h-6 w-6"
                              disabled={isPlaying}
                            >
                              <Volume2 className={`h-3 w-3 ${isPlaying ? 'animate-pulse' : ''}`} />
                            </Button>
                          )}
                          <div className="flex-1">
                            {message.type === 'character' ? (
                              <>
                                <div className="prose prose-sm max-w-full min-w-0 dark:prose-invert message-content break-words break-all whitespace-pre-wrap overflow-x-auto">
                                  <ReactMarkdown
                                    remarkPlugins={[remarkGfm]}
                                    components={{
                                      p: ({ children }) => <p className="mb-2 leading-snug last:mb-0">{children}</p>,
                                      ul: ({ children }) => <ul className="mb-2 pl-6 space-y-1 list-disc">{children}</ul>,
                                      ol: ({ children }) => <ol className="mb-2 pl-6 space-y-1 list-decimal">{children}</ol>,
                                      li: ({ children }) => <li className="leading-snug">{children}</li>,
                                      strong: ({ children }) => <strong className="font-semibold text-gray-900 dark:text-gray-100">{children}</strong>,
                                      em: ({ children }) => <em className="italic">{children}</em>,
                                      code: ({ children }) => (
                                        <code className="bg-gray-100 dark:bg-gray-800 px-1.5 py-0.5 rounded text-sm font-mono border border-gray-200 dark:border-gray-600 text-purple-700 dark:text-purple-400 break-words break-all whitespace-pre-wrap">
                                          {children}
                                        </code>
                                      ),
                                      pre: ({ children }) => (
                                        <pre className="bg-gray-100 dark:bg-gray-800 p-2 rounded-lg overflow-x-auto text-sm border border-gray-200 dark:border-gray-600 my-2 text-purple-700 dark:text-purple-400">
                                          {children}
                                        </pre>
                                      ),
                                      blockquote: ({ children }) => (
                                        <blockquote className="border-l-4 border-blue-300 dark:border-blue-600 pl-4 my-2 italic text-gray-600 dark:text-gray-300">
                                          {children}
                                        </blockquote>
                                      ),
                                      h1: ({ children }) => <h1 className="text-lg font-bold mb-2 text-gray-900 dark:text-gray-100">{children}</h1>,
                                      h2: ({ children }) => <h2 className="text-base font-semibold mb-2 text-gray-900 dark:text-gray-100">{children}</h2>,
                                      h3: ({ children }) => <h3 className="text-sm font-semibold mb-1 text-gray-900 dark:text-gray-100">{children}</h3>,
                                      br: () => <br className="my-1" />,
                                    }}
                                  >
                                    {message.content}
                                  </ReactMarkdown>
                                </div>
                              </>
                            ) : (
                              // 用户消息内容 - 非编辑状态
                              <p className="whitespace-pre-wrap break-words break-all">{message.content}</p>
                            )}
                          </div>
                        </div>

                        {/* 继续按钮 - 保留在消息框内 */}
                        {message.type === 'character' && message.canContinue && (
                          <div className="mt-2 flex justify-end">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleContinueMessage(message.id)}
                              disabled={isContinuing || isLoading}
                              className="text-xs"
                            >
                              {isContinuing ? (
                                <>
                                  <div className="animate-spin rounded-full h-3 w-3 border-b border-current mr-1"></div>
                                  继续生成中...
                                </>
                              ) : (
                                <>
                                  <MoreHorizontal className="h-3 w-3 mr-1" />
                                  {message.isComplete === false ? '继续' : '重试'}
                                </>
                              )}
                            </Button>
                          </div>
                        )}

                        {/* 状态信息 - 仅显示AI消息的状态 */}
                        {message.type === 'character' && (
                          <div className="text-xs opacity-50 mt-2">
                            {message.isComplete === false && (
                              <span className="text-purple-700 dark:text-purple-400">
                                回复被截断
                              </span>
                            )}
                          </div>
                        )}
                      </div>

                      {/* 消息框外的操作按钮 */}
                      {!editingMessageId && (
                        <div className={`flex gap-2 mt-1 opacity-0 group-hover:opacity-100 transition-opacity ${message.type === 'user' ? 'justify-end' : 'justify-start'
                          }`}>
                          {message.type === 'user' && (
                            <button
                              onClick={() => startEditMessage(message.id, message.content)}
                              disabled={isLoading || isContinuing}
                              className="px-2 py-1 text-xs text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1"
                              title="编辑消息"
                            >
                              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                                <path d="m18.5 2.5 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                              </svg>
                              编辑
                            </button>
                          )}
                          {message.type === 'character' && messages[messages.length - 1]?.id === message.id && (
                            <button
                              onClick={regenerateLastResponse}
                              className="px-2 py-1 text-xs text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1"
                              title="重新生成回复"
                              disabled={isLoading || isContinuing}
                            >
                              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" />
                                <path d="M21 3v5h-5" />
                                <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16" />
                                <path d="M3 21v-5h5" />
                              </svg>
                              重新生成
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}

            </>
          )}

          <div ref={messagesEndRef} />
        </div>
      </main>
    </ChatLayout>
  );
}