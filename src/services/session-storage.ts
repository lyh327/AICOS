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

  // 根据对话上下文生成智能标题
  static generateSmartSessionTitle(sessionId: string): string | null {
    const session = this.getSession(sessionId);
    if (!session || session.messages.length < 2) return null;

    const characters = this.getCharacterNames();
    const characterName = characters[session.characterId] || '未知角色';
    
    // 获取用户消息内容，用于分析对话主题
    const userMessages = session.messages
      .filter(msg => msg.type === 'user')
      .map(msg => msg.content)
      .slice(0, 3); // 只分析前3条用户消息

    if (userMessages.length === 0) return null;

    // 分析对话主题的关键词
    const keywords = this.extractKeywords(userMessages.join(' '));
    
    if (keywords.length > 0) {
      const mainKeyword = keywords[0];
      // 生成更自然的标题
      const titleFormats = [
        `关于${mainKeyword}的讨论`,
        `${characterName}谈${mainKeyword}`,
        `探讨${mainKeyword}`,
        `${mainKeyword}话题`
      ];
      
      // 根据角色选择合适的标题格式
      if (session.characterId === 'socrates' || session.characterId === 'confucius') {
        return titleFormats[0]; // 哲学家更适合"讨论"
      } else if (session.characterId === 'einstein') {
        return titleFormats[2]; // 科学家更适合"探讨"
      } else {
        return titleFormats[1]; // 其他角色用"谈"
      }
    }

    // 降级方案：使用第一条用户消息
    const firstUserMessage = userMessages[0];
    
    // 如果消息太短，直接使用
    if (firstUserMessage.length <= 10) {
      return `${characterName}: ${firstUserMessage}`;
    }
    
    // 尝试智能截断（在标点符号处截断）
    const punctuations = ['。', '？', '！', ',', '，'];
    let cutPoint = -1;
    
    for (let i = 8; i < Math.min(15, firstUserMessage.length); i++) {
      if (punctuations.includes(firstUserMessage[i])) {
        cutPoint = i;
        break;
      }
    }
    
    if (cutPoint > 0) {
      return `${characterName}: ${firstUserMessage.substring(0, cutPoint + 1)}`;
    }
    
    // 默认截断
    const shortMessage = firstUserMessage.length > 12 ? firstUserMessage.substring(0, 12) + '...' : firstUserMessage;
    return `${characterName}: ${shortMessage}`;
  }

  // 提取对话关键词
  private static extractKeywords(text: string): string[] {
    // 移除标点符号和多余空格
    const cleanText = text.replace(/[^\w\s\u4e00-\u9fff]/g, ' ').replace(/\s+/g, ' ').trim().toLowerCase();
    
    // 常见主题关键词映射
    const topicMaps: Record<string, string[]> = {
      '学习知识': ['学习', '学', '教', '知识', '了解', '明白', '懂', '课', '书', '读书', '研究', '学会'],
      '工作职场': ['工作', '职业', '事业', '公司', '老板', '同事', '项目', '任务', '职场', '上班'],
      '日常生活': ['生活', '日常', '每天', '平时', '习惯', '家', '家人', '朋友', '生活方式'],
      '爱情感情': ['爱', '爱情', '恋爱', '男友', '女友', '伴侣', '约会', '感情', '喜欢', '恋人'],
      '健康养生': ['健康', '身体', '锻炼', '运动', '饮食', '睡眠', '医生', '病', '养生', '保健'],
      '编程技术': ['编程', '代码', '程序', '软件', '网站', 'app', '算法', '开发', '技术', 'python', 'javascript'],
      '艺术文化': ['艺术', '画', '音乐', '歌', '电影', '书', '文学', '创作', '文化', '绘画'],
      '旅行游玩': ['旅行', '旅游', '去', '地方', '城市', '国家', '景点', '风景', '游玩', '度假'],
      '美食烹饪': ['吃', '美食', '菜', '餐厅', '做饭', '烹饪', '味道', '食物', '料理', '厨房'],
      '科学探索': ['科学', '研究', '实验', '理论', '发现', '数学', '物理', '化学', '宇宙', '自然'],
      '哲学思考': ['哲学', '思考', '人生', '意义', '存在', '思想', '智慧', '真理', '人性', '思辨'],
      '历史文化': ['历史', '古代', '过去', '朝代', '事件', '人物', '文化', '传统', '古典'],
      '心理情感': ['心理', '情感', '情绪', '压力', '焦虑', '开心', '难过', '心情', '感受'],
      '未来规划': ['未来', '计划', '目标', '梦想', '希望', '规划', '打算', '想要', '理想'],
      '兴趣爱好': ['兴趣', '爱好', '喜欢', '游戏', '运动', '收集', '娱乐', '休闲', '玩']
    };

    // 查找匹配的主题，使用更智能的匹配
    const matchedTopics: { topic: string; count: number }[] = [];
    
    for (const [topic, keywords] of Object.entries(topicMaps)) {
      let matchCount = 0;
      for (const keyword of keywords) {
        if (cleanText.includes(keyword.toLowerCase())) {
          matchCount++;
        }
      }
      if (matchCount > 0) {
        matchedTopics.push({ topic, count: matchCount });
      }
    }

    // 按匹配度排序，返回最相关的主题
    if (matchedTopics.length > 0) {
      matchedTopics.sort((a, b) => b.count - a.count);
      return [matchedTopics[0].topic];
    }

    // 如果没有匹配到预定义主题，尝试提取重要词汇
    const words = cleanText.split(' ').filter(word => word.length > 1);
    const chineseWords = words.filter(word => /[\u4e00-\u9fff]/.test(word) && word.length >= 2);
    
    if (chineseWords.length > 0) {
      // 过滤常见停用词
      const stopWords = ['什么', '怎么', '为什么', '这个', '那个', '可以', '应该', '觉得', '认为', '关于'];
      const meaningfulWords = chineseWords.filter(word => !stopWords.includes(word));
      
      if (meaningfulWords.length > 0) {
        // 返回最长的有意义词汇
        meaningfulWords.sort((a, b) => b.length - a.length);
        return [meaningfulWords[0].substring(0, 4)]; // 限制长度
      }
    }

    return [];
  }

  // 更新会话标题（仅在首次生成，不覆盖已有的智能标题）
  static updateSessionTitle(sessionId: string): void {
    const session = this.getSession(sessionId);
    if (!session) return;

    // 检查是否是默认标题格式（包含时间戳的标题）
    const isDefaultTitle = session.title.includes('的对话 -') || session.title.includes(': ');
    
    // 只有当前是默认标题时才更新为智能标题
    if (isDefaultTitle) {
      const smartTitle = this.generateSmartSessionTitle(sessionId);
      if (smartTitle) {
        this.renameSession(sessionId, smartTitle);
      }
    }
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