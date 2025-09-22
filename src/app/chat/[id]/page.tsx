'use client';

import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { useState, useEffect, useRef } from 'react';
import { getCharacterById } from '@/data/characters';
import { Character, ChatMessage, ChatSession } from '@/types';
import { Button } from '@/components/ui/button';
import { ChatLayout } from '@/components/ChatLayout';
import { SessionStorageService } from '@/services/session-storage';
import { Volume2, MoreHorizontal } from 'lucide-react';
import { ASRService, AdvancedVoiceService, TTSService } from '@/services/voice';
import { ThinkingProcess } from '@/components/ThinkingProcess';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

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
  // GLM-4.5 新功能状态
  const [enableThinking, setEnableThinking] = useState<boolean>(false);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // 初始化语音服务
    TTSService.initialize();
  }, []);

  // 监听消息变化，在有足够内容时更新会话标题（仅首次）
  useEffect(() => {
    if (currentSession && messages.length >= 4) { // 至少2轮对话后更新标题
      const userMessageCount = messages.filter(msg => msg.type === 'user').length;
      if (userMessageCount >= 2) {
        // 检查是否已经生成过智能标题
        const hasSmartTitle = !currentSession.title.includes('的对话 -'); // 默认标题包含时间戳
        if (!hasSmartTitle) {
          // 延迟更新标题，避免频繁更新，并且只更新一次
          const timer = setTimeout(() => {
            SessionStorageService.updateSessionTitle(currentSession.id);
          }, 2000);
          return () => clearTimeout(timer);
        }
      }
    }
  }, [messages, currentSession]);

  // 移除页面卸载时的标题更新逻辑
  // useEffect(() => {
  //   const handleBeforeUnload = () => {
  //     if (currentSession && messages.length >= 4) {
  //       SessionStorageService.updateSessionTitle(currentSession.id);
  //     }
  //   };

  //   const handleVisibilityChange = () => {
  //     if (document.hidden && currentSession && messages.length >= 4) {
  //       SessionStorageService.updateSessionTitle(currentSession.id);
  //     }
  //   };

  //   window.addEventListener('beforeunload', handleBeforeUnload);
  //   document.addEventListener('visibilitychange', handleVisibilityChange);

  //   return () => {
  //     window.removeEventListener('beforeunload', handleBeforeUnload);
  //     document.removeEventListener('visibilitychange', handleVisibilityChange);
  //   };
  // }, [currentSession, messages.length]);

  useEffect(() => {
    if (params.id) {
      const char = getCharacterById(params.id as string);
      if (char) {
        setCharacter(char);
        
        // 检查是否有指定的会话ID
        const sessionId = searchParams.get('session');
        if (sessionId) {
          loadSession(sessionId);
        } else {
          // 尝试加载最近的会话，但不自动创建新会话
          const recentSessions = SessionStorageService.getSessionsByCharacter(char.id);
          if (recentSessions.length > 0) {
            loadSession(recentSessions[0].id);
          } else {
            // 不自动创建会话，用户需要主动开始对话
            setCurrentSession(null);
            setMessages([]);
          }
        }
      } else {
        router.push('/');
      }
    }
  }, [params.id, searchParams, router]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const loadSession = async (sessionId: string) => {
    try {
      const session = await SessionStorageService.getSession(sessionId);
      if (session) {
        setCurrentSession(session);
        setMessages(session.messages || []);
      }
    } catch (error) {
      console.error('Failed to load session:', error);
    }
  };

  const createNewSession = (characterId: string, existingMessages: ChatMessage[] = []): ChatSession => {
    const newSession = SessionStorageService.createSession(characterId);
    
    // 添加欢迎消息
    const welcomeMessageId = `welcome-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const welcomeMessage: ChatMessage = {
      id: welcomeMessageId,
      type: 'character',
      content: character ? `你好！我是${character.name}。${character.description}。很高兴与你对话！你想聊什么呢？` : '你好！很高兴与你对话！',
      timestamp: new Date()
    };

    // 如果有现有消息，将欢迎消息放在最前面，然后添加现有消息
    newSession.messages = [welcomeMessage, ...existingMessages];
    SessionStorageService.saveSession(newSession);
    
    setCurrentSession(newSession);
    setMessages(newSession.messages);
    
    // 更新URL
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

  const handleSendMessage = async () => {
    if (!inputMessage.trim() || !character) return;

    const userMessageId = `user-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const userMessage: ChatMessage = {
      id: userMessageId,
      type: 'user',
      content: inputMessage,
      timestamp: new Date(),
      attachedImage: selectedImage,
      mode: selectedImage ? 'vision' : enableThinking ? 'thinking' : 'smart'
    };

    // 如果没有当前会话，创建新会话并包含用户消息
    let session = currentSession;
    if (!session) {
      // 创建新会话，包含用户消息
      session = createNewSession(character.id, [userMessage]);
    } else {
      // 如果已有会话，正常添加消息
      setMessages(prev => [...prev, userMessage]);
      saveCurrentMessage(userMessage);
    }
    
    const currentInput = inputMessage;
    const currentImageUrl = selectedImage;
    const currentMode = selectedImage ? 'vision' : enableThinking ? 'thinking' : 'smart';
    
    // 清理输入状态
    setInputMessage('');
    setSelectedImage(null);
    setIsLoading(true);

    try {
      // 准备对话历史
      const conversationHistory = messages.slice(-6).map(msg => ({
        role: msg.type === 'user' ? 'user' as const : 'assistant' as const,
        content: msg.content
      }));

      // 调用聊天API - 支持GLM-4.5新功能
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          characterId: character.id,
          character: character.isCustom ? character : undefined,
          message: currentInput,
          conversationHistory,
          // GLM-4.5 新功能参数
          enableThinking: currentMode === 'thinking',
          imageUrl: currentImageUrl,
          mode: currentMode
        })
      });


      if (!response.ok) {
        throw new Error('API request failed');
      }

      const data = await response.json();
      
      const aiMessageId = `ai-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      const aiResponse: ChatMessage = {
        id: aiMessageId,
        type: 'character',
        content: data.content,
        timestamp: new Date(),
        isComplete: data.isComplete !== false,
        canContinue: data.isComplete === false && data.finishReason === 'length',
        // GLM-4.5 新功能字段
        thinkingProcess: data.thinkingProcess,
        imageAnalysis: data.imageAnalysis,
        mode: currentMode
      };
      
      setMessages(prev => [...prev, aiResponse]);
      saveCurrentMessage(aiResponse);
    } catch (error) {
      console.error('Chat error:', error);
      // 降级到模拟回复
      const fallbackMessageId = `fallback-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      const fallbackResponse: ChatMessage = {
        id: fallbackMessageId,
        type: 'character',
        content: generateMockResponse(currentInput, character),
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
      let newContent = data.content.trim();
      
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

  if (!character) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="text-6xl mb-4">🔍</div>
          <h3 className="text-lg font-medium">角色未找到</h3>
          <p className="text-muted-foreground mb-4">抱歉，无法找到指定的角色</p>
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
          {/* 图像上传预览 */}
          {selectedImage && (
            <div className="relative">
              <div className="w-12 h-12 rounded-lg overflow-hidden bg-white">
                <img
                  src={selectedImage}
                  alt="上传的图片"
                  className="w-full h-full object-cover"
                />
              </div>
              <button
                onClick={() => setSelectedImage(null)}
                className="absolute -top-1 -right-1 w-4 h-4 bg-gray-500 text-white rounded-full text-xs flex items-center justify-center hover:bg-gray-600"
              >
                ×
              </button>
            </div>
          )}
          
          {/* 文本输入 */}
          <div className="flex-1">
            <textarea
              value={inputMessage}
              onChange={(e) => setInputMessage(e.target.value)}
              placeholder="输入消息..."
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSendMessage();
                }
              }}
              className="w-full bg-transparent border-none outline-none resize-none text-sm leading-6 placeholder-gray-500 min-h-[24px] max-h-32"
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
          </div>

          {/* 右侧按钮组 */}
          <div className="flex items-center gap-2">
            {/* 图像上传按钮 */}
            <button
              onClick={() => document.getElementById('image-upload')?.click()}
              disabled={isLoading}
              className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-200 rounded-lg transition-colors disabled:opacity-50"
              title="上传图片"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
                <circle cx="9" cy="9" r="2"/>
                <path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/>
              </svg>
            </button>

            {/* 语音按钮 */}
            <button
              onClick={isListening ? stopVoiceRecording : startVoiceRecording}
              disabled={isLoading}
              className={`p-2 rounded-lg transition-colors disabled:opacity-50 ${
                isListening 
                  ? 'text-red-500 bg-red-50 hover:bg-red-100' 
                  : 'text-gray-500 hover:text-gray-700 hover:bg-gray-200'
              }`}
              title={isListening ? '停止录音' : '语音输入'}
            >
              {isListening ? (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                  <rect x="6" y="6" width="12" height="12" rx="2"/>
                </svg>
              ) : (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"/>
                  <path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
                  <line x1="12" y1="19" x2="12" y2="22"/>
                  <line x1="8" y1="22" x2="16" y2="22"/>
                </svg>
              )}
            </button>

            {/* 发送按钮 */}
            <button
              onClick={handleSendMessage}
              disabled={!inputMessage.trim() || !character || isLoading}
              className="p-2 bg-black text-white rounded-lg hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              title="发送消息"
            >
              {isLoading ? (
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="m22 2-7 20-4-9-9-4Z"/>
                  <path d="M22 2 11 13"/>
                </svg>
              )}
            </button>
          </div>
        </div>

        {/* 底部工具栏 */}
        <div className="flex items-center justify-between px-4 pb-3">
          {/* 深度思考开关 */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                if (selectedImage) {
                  alert('有图片时不能使用深度思考，请移除图片后再开启深度思考模式');
                  return;
                }
                setEnableThinking(!enableThinking);
              }}
              disabled={!!selectedImage}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                enableThinking
                  ? 'bg-purple-100 text-purple-700'
                  : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              深度思考
            </button>
          </div>

          {/* 状态提示 */}
          <div className="text-xs text-gray-500">
            {isListening && '正在录音...'}
            {enableThinking && !isListening && !selectedImage && '使用GLM-4.5深度思考'}
            {selectedImage && !isListening && '使用GLM-4.5V视觉理解'}
            {!isListening && !enableThinking && !selectedImage && '智能模式，自动选择最佳AI能力'}
          </div>
        </div>
      </div>

      {/* 隐藏的文件输入 */}
      <input
        id="image-upload"
        type="file"
        accept="image/*"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) {
            if (file.size > 10 * 1024 * 1024) {
              alert('图片文件大小不能超过10MB');
              return;
            }
            const reader = new FileReader();
            reader.onload = (e) => {
              setSelectedImage(e.target?.result as string);
              // 有图片时自动禁用深度思考
              if (enableThinking) {
                setEnableThinking(false);
              }
            };
            reader.readAsDataURL(file);
          }
        }}
        className="hidden"
      />

      {/* 错误提示 */}
      {voiceError && (
        <div className="mt-2 text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">
          {voiceError}
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
                <p className="text-muted-foreground mb-6">{character.description}</p>
                <div className="bg-muted rounded-lg p-4 mb-6">
                  <p className="text-sm">
                    你好！我是{character.name}。很高兴与你对话！你想聊什么呢？
                  </p>
                </div>
                <p className="text-sm text-muted-foreground">
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
                  className={`flex ${message.type === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-[70%] rounded-lg p-4 ${
                      message.type === 'user'
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-muted'
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
                        {/* 显示用户附加的图片 */}
                        {message.type === 'user' && message.attachedImage && (
                          <div className="mb-3">
                            <div className="relative w-32 h-32 rounded-lg overflow-hidden border border-white/20">
                              <img
                                src={message.attachedImage}
                                alt="用户上传的图片"
                                className="w-full h-full object-cover"
                              />
                            </div>
                          </div>
                        )}

                        {/* 显示附加的图片 */}
                        {message.type === 'character' && message.attachedImage && (
                          <div className="mb-3">
                            <div className="relative w-32 h-32 rounded-lg overflow-hidden border">
                              <img
                                src={message.attachedImage}
                                alt="用户上传的图片"
                                className="w-full h-full object-cover"
                              />
                            </div>
                          </div>
                        )}
                        
                        {message.type === 'character' ? (
                          <>
                            {/* 思考过程 */}
                            {message.thinkingProcess && (
                              <ThinkingProcess 
                                thinkingProcess={message.thinkingProcess}
                                className="mb-3"
                              />
                            )}
                            
                            {/* 图像分析结果 */}
                            {message.imageAnalysis && (
                              <div className="mb-3 p-2 bg-green-50 rounded-lg">
                                <div className="flex items-center gap-2 mb-1">
                                  <span className="text-sm font-medium text-green-700">图像分析</span>
                                </div>
                                <p className="text-sm text-green-600">{message.imageAnalysis}</p>
                              </div>
                            )}
                            
                            <div className="prose prose-sm max-w-none dark:prose-invert">
                              <ReactMarkdown 
                                remarkPlugins={[remarkGfm]}
                                components={{
                                  p: ({ children }) => <p className="mb-3 leading-relaxed last:mb-0">{children}</p>,
                                  ul: ({ children }) => <ul className="mb-3 pl-6 space-y-1 list-disc">{children}</ul>,
                                  ol: ({ children }) => <ol className="mb-3 pl-6 space-y-1 list-decimal">{children}</ol>,
                                  li: ({ children }) => <li className="leading-relaxed">{children}</li>,
                                  strong: ({ children }) => <strong className="font-semibold text-foreground">{children}</strong>,
                                  em: ({ children }) => <em className="italic">{children}</em>,
                                  code: ({ children }) => (
                                    <code className="bg-muted px-1.5 py-0.5 rounded text-sm font-mono border text-purple-700 dark:text-purple-400">
                                      {children}
                                    </code>
                                  ),
                                  pre: ({ children }) => (
                                    <pre className="bg-muted p-3 rounded-lg overflow-x-auto text-sm border my-3 text-purple-700 dark:text-purple-400">
                                      {children}
                                    </pre>
                                  ),
                                  blockquote: ({ children }) => (
                                    <blockquote className="border-l-4 border-primary/40 pl-4 my-3 italic text-muted-foreground">
                                      {children}
                                    </blockquote>
                                  ),
                                  h1: ({ children }) => <h1 className="text-lg font-bold mb-2 text-foreground">{children}</h1>,
                                  h2: ({ children }) => <h2 className="text-base font-semibold mb-2 text-foreground">{children}</h2>,
                                  h3: ({ children }) => <h3 className="text-sm font-semibold mb-1 text-foreground">{children}</h3>,
                                  br: () => <br className="my-1" />,
                                }}
                              >
                                {message.content}
                              </ReactMarkdown>
                            </div>
                          </>
                        ) : (
                          <p className="whitespace-pre-wrap">{message.content}</p>
                        )}
                      </div>
                    </div>
                    
                    {/* 继续按钮 */}
                    {message.type === 'character' && message.canContinue && (
                      <div className="mt-2 flex justify-end">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleContinueMessage(message.id)}
                          disabled={isContinuing}
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
                    
                    <div className="text-xs opacity-70 mt-2">
                      {message.timestamp.toLocaleTimeString()}
                      {message.type === 'character' && message.isComplete === false && (
                        <span className="ml-2 text-purple-700 dark:text-purple-400">
                          • 回复被截断
                        </span>
                      )}
                      {message.mode && message.mode !== 'standard' && (
                        <span className="ml-2 text-blue-600 dark:text-blue-400">
                          • {message.mode === 'smart' ? '智能模式' : 
                              message.mode === 'thinking' ? '深度思考' : 
                              message.mode === 'vision' ? '视觉理解' : '标准模式'}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
              
              {isLoading && (
                <div className="flex justify-start">
                  <div className="bg-muted rounded-lg p-4 max-w-[70%]">
                    <div className="flex items-center gap-3">
                      <div className="flex space-x-1">
                        <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
                        <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{animationDelay: '0.1s'}}></div>
                        <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{animationDelay: '0.2s'}}></div>
                      </div>
                      <span className="text-sm text-gray-600">
                        {enableThinking ? '正在深度思考...' : 
                         selectedImage ? '正在分析图像...' : 
                         '正在思考...'}
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
          
          <div ref={messagesEndRef} />
        </div>
      </main>
    </ChatLayout>
  );
}