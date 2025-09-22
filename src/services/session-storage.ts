import { ChatSession, ChatMessage, SessionSummary } from '@/types';

export class SessionStorageService {
  private static readonly STORAGE_KEY = 'ai-roleplay-sessions';
  private static readonly MAX_SESSIONS = 50; // 最大保存会话数

  // 获取所有会话
  static getAllSessions(): ChatSession[] {
    if (typeof window === 'undefined') return [];
    
    try {
      const stored = localStorage.getItem(this.STORAGE_KEY);
      if (!stored) return [];
      
      const sessions = JSON.parse(stored);
      return sessions.map((session: any) => ({
        ...session,
        createdAt: new Date(session.createdAt),
        lastActiveAt: new Date(session.lastActiveAt),
        messages: session.messages.map((msg: any) => ({
          ...msg,
          timestamp: new Date(msg.timestamp)
        }))
      }));
    } catch (error) {
      console.error('Failed to load sessions:', error);
      return [];
    }
  }

  // 获取指定角色的会话
  static getSessionsByCharacter(characterId: string): ChatSession[] {
    return this.getAllSessions()
      .filter(session => session.characterId === characterId)
      .sort((a, b) => b.lastActiveAt.getTime() - a.lastActiveAt.getTime());
  }

  // 获取会话摘要列表
  static getSessionSummaries(): SessionSummary[] {
    const sessions = this.getAllSessions();
    const characters = this.getCharacterNames();
    
    return sessions
      .sort((a, b) => b.lastActiveAt.getTime() - a.lastActiveAt.getTime())
      .map(session => {
        const lastMessage = session.messages[session.messages.length - 1];
        return {
          id: session.id,
          characterId: session.characterId,
          characterName: characters[session.characterId] || '未知角色',
          title: session.title,
          lastMessage: lastMessage?.content || '',
          messageCount: session.messages.length,
          createdAt: session.createdAt,
          lastActiveAt: session.lastActiveAt
        };
      });
  }

  // 获取单个会话
  static getSession(sessionId: string): ChatSession | null {
    const sessions = this.getAllSessions();
    return sessions.find(session => session.id === sessionId) || null;
  }

  // 创建新会话
  static createSession(characterId: string, title?: string): ChatSession {
    const sessionId = this.generateSessionId();
    const now = new Date();
    
    const newSession: ChatSession = {
      id: sessionId,
      characterId,
      title: title || this.generateSessionTitle(characterId),
      messages: [],
      createdAt: now,
      lastActiveAt: now,
      isActive: true
    };

    this.saveSession(newSession);
    return newSession;
  }

  // 保存单个会话
  static saveSession(session: ChatSession): void {
    if (typeof window === 'undefined') return;

    try {
      const sessions = this.getAllSessions();
      const existingIndex = sessions.findIndex(s => s.id === session.id);
      
      // 更新最后活动时间
      session.lastActiveAt = new Date();
      
      if (existingIndex >= 0) {
        sessions[existingIndex] = session;
      } else {
        sessions.push(session);
      }

      // 限制会话数量，删除最旧的会话
      if (sessions.length > this.MAX_SESSIONS) {
        sessions.sort((a, b) => b.lastActiveAt.getTime() - a.lastActiveAt.getTime());
        sessions.splice(this.MAX_SESSIONS);
      }

      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(sessions));
    } catch (error) {
      console.error('Failed to save session:', error);
    }
  }

  // 添加消息到会话
  static addMessage(sessionId: string, message: ChatMessage): ChatSession | null {
    const session = this.getSession(sessionId);
    if (!session) return null;

    session.messages.push(message);
    session.lastActiveAt = new Date();
    
    // 如果是第一条用户消息，根据内容生成更好的标题
    if (session.messages.length === 1 && message.type === 'user') {
      session.title = this.generateSessionTitleFromMessage(message.content, session.characterId);
    }

    this.saveSession(session);
    return session;
  }

  // 删除会话
  static deleteSession(sessionId: string): void {
    if (typeof window === 'undefined') return;

    try {
      const sessions = this.getAllSessions();
      const filteredSessions = sessions.filter(session => session.id !== sessionId);
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(filteredSessions));
    } catch (error) {
      console.error('Failed to delete session:', error);
    }
  }

  // 重命名会话
  static renameSession(sessionId: string, newTitle: string): void {
    const session = this.getSession(sessionId);
    if (session) {
      session.title = newTitle;
      this.saveSession(session);
    }
  }

  // 清空所有会话
  static clearAllSessions(): void {
    if (typeof window === 'undefined') return;
    localStorage.removeItem(this.STORAGE_KEY);
  }

  // 生成会话ID
  private static generateSessionId(): string {
    return `session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  // 生成会话标题
  private static generateSessionTitle(characterId: string): string {
    const characters = this.getCharacterNames();
    const characterName = characters[characterId] || '未知角色';
    const now = new Date();
    const timeStr = now.toLocaleString('zh-CN', { 
      month: 'short', 
      day: 'numeric', 
      hour: '2-digit', 
      minute: '2-digit' 
    });
    return `与${characterName}的对话 - ${timeStr}`;
  }

  // 根据消息内容生成标题
  private static generateSessionTitleFromMessage(message: string, characterId: string): string {
    const characters = this.getCharacterNames();
    const characterName = characters[characterId] || '未知角色';
    
    // 截取消息前20个字符作为标题
    const shortMessage = message.length > 20 ? message.substring(0, 20) + '...' : message;
    return `${characterName}: ${shortMessage}`;
  }

  // 获取角色名称映射
  private static getCharacterNames(): Record<string, string> {
    const builtInCharacters = {
      'harry-potter': '哈利波特',
      'socrates': '苏格拉底',
      'shakespeare': '莎士比亚',
      'confucius': '孔子',
      'einstein': '爱因斯坦'
    };

    // 检查浏览器环境
    if (typeof window === 'undefined') {
      return builtInCharacters;
    }

    // 获取自定义角色
    try {
      const customCharacters = localStorage.getItem('custom_characters');
      if (customCharacters) {
        const characters = JSON.parse(customCharacters);
        const customCharacterNames: Record<string, string> = {};
        
        characters.forEach((character: any) => {
          if (character.id && character.name) {
            customCharacterNames[character.id] = character.name;
          }
        });
        
        console.log('Loaded custom characters for session titles:', customCharacterNames);
        return { ...builtInCharacters, ...customCharacterNames };
      }
    } catch (error) {
      console.error('Failed to load custom characters for session titles:', error);
    }

    return builtInCharacters;
  }

  // 导出会话数据
  static exportSessions(): string {
    const sessions = this.getAllSessions();
    return JSON.stringify(sessions, null, 2);
  }

  // 导入会话数据
  static importSessions(data: string): boolean {
    try {
      const sessions = JSON.parse(data);
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(sessions));
      return true;
    } catch (error) {
      console.error('Failed to import sessions:', error);
      return false;
    }
  }

  // 获取存储使用情况
  static getStorageInfo(): { used: number; total: number; sessionCount: number } {
    if (typeof window === 'undefined') {
      return { used: 0, total: 0, sessionCount: 0 };
    }

    const sessions = this.getAllSessions();
    const dataSize = new Blob([localStorage.getItem(this.STORAGE_KEY) || '']).size;
    
    // 估算localStorage的大小限制（通常是5-10MB）
    const totalSize = 5 * 1024 * 1024; // 5MB

    return {
      used: dataSize,
      total: totalSize,
      sessionCount: sessions.length
    };
  }
}