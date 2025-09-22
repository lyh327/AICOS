'use client';

import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { useState, useEffect, useRef } from 'react';
import { getCharacterById } from '@/data/characters';
import { Character, ChatMessage, ChatSession } from '@/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ChatLayout } from '@/components/ChatLayout';
import { SessionStorageService } from '@/services/session-storage';
import { Mic, MicOff, Send, Volume2, ArrowLeft, MoreHorizontal } from 'lucide-react';
import { ASRService, AdvancedVoiceService, TTSService } from '@/services/voice';
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
      timestamp: new Date()
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
    setInputMessage('');
    setIsLoading(true);

    try {
      // 准备对话历史
      const conversationHistory = messages.slice(-6).map(msg => ({
        role: msg.type === 'user' ? 'user' as const : 'assistant' as const,
        content: msg.content
      }));

      // 调用聊天API
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          characterId: character.id,
          character: character.isCustom ? character : undefined, // 如果是自定义角色，传递完整角色数据
          message: currentInput,
          conversationHistory
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
        isComplete: data.isComplete !== false, // 默认为完整，除非明确标记为不完整
        canContinue: data.isComplete === false && data.finishReason === 'length'
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
        isComplete: true, // 模拟回复总是完整的
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

  return (
    <ChatLayout 
      currentCharacter={character} 
      currentSessionId={currentSession?.id}
    >
      {/* 聊天区域 */}
      <main className="flex-1 flex flex-col overflow-hidden">
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
                        {message.type === 'character' ? (
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
                    </div>
                  </div>
                </div>
              ))}
              
              {isLoading && (
                <div className="flex justify-start">
                  <div className="bg-muted rounded-lg p-4">
                    <div className="flex items-center gap-2">
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary"></div>
                      <span className="text-sm">正在思考...</span>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
          
          <div ref={messagesEndRef} />
        </div>

        {/* 输入区域 */}
        <div className="p-6">
          <div className="flex gap-2">
            <Input
              value={inputMessage}
              onChange={(e) => setInputMessage(e.target.value)}
              placeholder="输入消息或使用语音..."
              onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
              className="flex-1"
            />
            <Button
              variant={isListening ? "destructive" : "outline"}
              size="icon"
              onClick={isListening ? stopVoiceRecording : startVoiceRecording}
              disabled={isLoading}
            >
              {isListening ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
            </Button>
            <Button onClick={handleSendMessage} disabled={!inputMessage.trim() || !character}>
              <Send className="h-4 w-4" />
            </Button>
          </div>
          
          {(isListening || voiceError) && (
            <div className="mt-2 text-sm flex items-center gap-2">
              {isListening && (
                <>
                  <div className="animate-pulse w-2 h-2 bg-red-500 rounded-full"></div>
                  <span className="text-muted-foreground">正在录音...</span>
                </>
              )}
              {voiceError && (
                <span className="text-destructive">{voiceError}</span>
              )}
            </div>
          )}
        </div>
      </main>
    </ChatLayout>
  );
}