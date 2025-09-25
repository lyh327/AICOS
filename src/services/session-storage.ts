import { ChatSession, ChatMessage, SessionSummary } from '@/types';
import logger from '@/lib/logger';

type RawChatMessage = Omit<Partial<ChatMessage>, 'timestamp'> & {
  timestamp?: string | number | Date;
};

type RawSession = Omit<Partial<ChatSession>, 'createdAt' | 'lastActiveAt' | 'messages'> & {
  id?: string;
  createdAt?: string | number | Date;
  lastActiveAt?: string | number | Date;
  messages?: RawChatMessage[];
};

export class SessionStorageService {
  private static readonly STORAGE_KEY = 'ai-roleplay-sessions';
  private static readonly MAX_SESSIONS = 50; // 最大保存会话数

  // 获取所有会话
  static getAllSessions(): ChatSession[] {
    if (typeof window === 'undefined') return [];
    
    try {
      const stored = localStorage.getItem(this.STORAGE_KEY);
      if (!stored) return [];
      
      const raw = JSON.parse(stored);
      const sessionsArray = this.normalizeSessions(raw);

      return this.deserializeSessions(sessionsArray);
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
      .slice(0, 5); // 分析前5条用户消息，增加样本

    if (userMessages.length === 0) return null;

    // 合并所有用户消息进行分析
    const combinedText = userMessages.join(' ');

    // 首先尝试提取实体和动作
    const entityAndAction = this.extractEntityAndAction(combinedText);
    if (entityAndAction) {
      return this.formatTitleWithEntityAction(entityAndAction, characterName, session.characterId);
    }

    // 其次尝试主题分析
    const topics = this.extractTopicsAdvanced(combinedText);
    if (topics.length > 0) {
      return this.formatTitleWithTopic(topics[0], characterName, session.characterId);
    }

    // 降级方案：智能摘要第一条消息
    return this.generateFallbackTitle(userMessages[0], characterName);
  }

  // 提取实体和动作的更高级方法
  private static extractEntityAndAction(text: string): { entity: string; action: string } | null {
    const cleanText = text.replace(/[^\w\s\u4e00-\u9fff]/g, ' ').replace(/\s+/g, ' ').trim();
    
    // 实体模式匹配
    const entityPatterns = [
      // 具体人物或概念
      /关于(.{2,8}?)的/g,
      /(.{2,8}?)是什么/g,
      /(.{2,8}?)怎么/g,
      /如何(.{2,8})/g,
      /(.{2,8}?)的.*问题/g,
      /讨论(.{2,8})/g,
      /学习(.{2,8})/g,
      /了解(.{2,8})/g,
    ];

    // 动作模式匹配
    const actionPatterns = [
      /想要?(.{2,6})/g,
      /需要(.{2,6})/g,
      /希望(.{2,6})/g,
      /打算(.{2,6})/g,
      /计划(.{2,6})/g,
      /准备(.{2,6})/g,
    ];

    let bestEntity = '';
    let bestAction = '';
    let maxScore = 0;

    // 查找实体
    for (const pattern of entityPatterns) {
      const matches = Array.from(cleanText.matchAll(pattern));
      for (const match of matches) {
        if (match[1] && match[1].length >= 2 && match[1].length <= 8) {
          const score = this.calculateEntityScore(match[1], cleanText);
          if (score > maxScore) {
            maxScore = score;
            bestEntity = match[1];
          }
        }
      }
    }

    // 查找动作
    for (const pattern of actionPatterns) {
      const matches = Array.from(cleanText.matchAll(pattern));
      for (const match of matches) {
        if (match[1] && match[1].length >= 2 && match[1].length <= 6) {
          bestAction = match[1];
          break;
        }
      }
    }

    if (bestEntity && maxScore > 1) {
      return { entity: bestEntity, action: bestAction || '讨论' };
    }

    return null;
  }

  // 计算实体得分
  private static calculateEntityScore(entity: string, text: string): number {
    let score = 0;
    
    // 出现频率
    const occurrences = (text.match(new RegExp(entity, 'g')) || []).length;
    score += occurrences;

    // 长度合适性
    if (entity.length >= 2 && entity.length <= 4) score += 2;
    else if (entity.length <= 6) score += 1;

    // 避免常见停用词
    const stopWords = ['什么', '怎么', '为什么', '这个', '那个', '问题', '事情', '东西'];
    if (!stopWords.includes(entity)) score += 1;

    return score;
  }

  // 根据实体和动作格式化标题
  private static formatTitleWithEntityAction(
    entityAction: { entity: string; action: string }, 
    characterName: string, 
    characterId: string
  ): string {
    const { entity, action } = entityAction;
    
    // 根据角色特性选择标题格式
    const formats = this.getTitleFormatsForCharacter(characterId);
    
    if (action === '讨论' || action === '谈论') {
      return formats.discussion.replace('{topic}', entity);
    } else if (action === '学习' || action === '了解') {
      return formats.learning.replace('{topic}', entity);
    } else if (action === '解决' || action === '处理') {
      return formats.solving.replace('{topic}', entity);
    } else {
      return formats.general.replace('{topic}', entity).replace('{action}', action);
    }
  }

  // 根据主题格式化标题
  private static formatTitleWithTopic(topic: string, characterName: string, characterId: string): string {
    const formats = this.getTitleFormatsForCharacter(characterId);
    return formats.discussion.replace('{topic}', topic);
  }

  // 获取角色专属的标题格式
  private static getTitleFormatsForCharacter(characterId: string): Record<string, string> {
    const baseFormats = {
      discussion: '关于{topic}的讨论',
      learning: '学习{topic}',
      solving: '解决{topic}问题',
      general: '{action}{topic}'
    };

    switch (characterId) {
      case 'socrates':
        return {
          discussion: '探讨{topic}的本质',
          learning: '认识{topic}',
          solving: '思辨{topic}',
          general: '哲思：{topic}'
        };
      case 'confucius':
        return {
          discussion: '论{topic}',
          learning: '学{topic}之道',
          solving: '解{topic}之惑',
          general: '师说：{topic}'
        };
      case 'einstein':
        return {
          discussion: '探索{topic}',
          learning: '理解{topic}',
          solving: '研究{topic}',
          general: '科学：{topic}'
        };
      case 'shakespeare':
        return {
          discussion: '{topic}的诗篇',
          learning: '感悟{topic}',
          solving: '咏{topic}',
          general: '文学：{topic}'
        };
      case 'harry-potter':
        return {
          discussion: '魔法世界的{topic}',
          learning: '霍格沃茨：{topic}',
          solving: '冒险：{topic}',
          general: '魔法：{topic}'
        };
      default:
        return baseFormats;
    }
  }

  // 生成降级标题
  private static generateFallbackTitle(firstMessage: string, characterName: string): string {
    if (!firstMessage || firstMessage.length === 0) {
      return `与${characterName}的对话`;
    }

    // 如果消息很短，直接使用
    if (firstMessage.length <= 12) {
      return `${characterName}：${firstMessage}`;
    }
    
    // 智能截断：优先在句号、问号、感叹号处截断
    const primaryPuncts = ['。', '？', '！'];
    for (const punct of primaryPuncts) {
      const index = firstMessage.indexOf(punct);
      if (index > 6 && index <= 20) {
        return `${characterName}：${firstMessage.substring(0, index + 1)}`;
      }
    }
    
    // 次级截断：在逗号处截断
    const secondaryPuncts = ['，', ','];
    for (const punct of secondaryPuncts) {
      const index = firstMessage.indexOf(punct);
      if (index > 8 && index <= 18) {
        return `${characterName}：${firstMessage.substring(0, index)}`;
      }
    }
    
    // 最后截断：按字符长度
    const maxLength = 15;
    if (firstMessage.length > maxLength) {
      return `${characterName}：${firstMessage.substring(0, maxLength)}...`;
    }
    
    return `${characterName}：${firstMessage}`;
  }

  // 改进的主题提取
  private static extractTopicsAdvanced(text: string): string[] {
    const cleanText = text.replace(/[^\w\s\u4e00-\u9fff]/g, ' ').replace(/\s+/g, ' ').trim().toLowerCase();
    
    // 扩展和优化的主题关键词映射
    const topicMaps: Record<string, { keywords: string[]; weight: number }> = {
      '编程开发': { 
        keywords: ['编程', '代码', '程序', '软件', '开发', 'python', 'javascript', 'java', 'react', 'vue', 'ai', '算法', '数据结构', 'bug', '调试', '前端', '后端'], 
        weight: 2 
      },
      '学习教育': { 
        keywords: ['学习', '教育', '知识', '课程', '考试', '学校', '老师', '学生', '书籍', '阅读', '研究', '论文', '学位'], 
        weight: 2 
      },
      '工作职场': { 
        keywords: ['工作', '职业', '事业', '公司', '面试', '简历', '同事', '老板', '项目', '管理', '创业', '职场'], 
        weight: 2 
      },
      '生活日常': { 
        keywords: ['生活', '日常', '家庭', '朋友', '饮食', '睡眠', '健康', '运动', '购物', '旅行'], 
        weight: 1 
      },
      '情感关系': { 
        keywords: ['爱情', '恋爱', '感情', '关系', '婚姻', '家人', '友情', '社交', '沟通'], 
        weight: 2 
      },
      '科学技术': { 
        keywords: ['科学', '技术', '研究', '实验', '理论', '物理', '化学', '生物', '数学', '医学'], 
        weight: 2 
      },
      '文化艺术': { 
        keywords: ['艺术', '文化', '音乐', '电影', '文学', '绘画', '设计', '创作', '美学'], 
        weight: 1 
      },
      '哲学思考': { 
        keywords: ['哲学', '思考', '人生', '意义', '存在', '价值', '道德', '伦理', '真理', '智慧'], 
        weight: 2 
      }
    };

    const matchedTopics: { topic: string; score: number }[] = [];
    
    for (const [topic, { keywords, weight }] of Object.entries(topicMaps)) {
      let score = 0;
      let matchedKeywords = 0;
      
      for (const keyword of keywords) {
        const regex = new RegExp(keyword.toLowerCase(), 'g');
        const matches = cleanText.match(regex);
        if (matches) {
          score += matches.length * weight;
          matchedKeywords++;
        }
      }
      
      // 奖励多关键词匹配
      if (matchedKeywords > 1) {
        score += matchedKeywords * 0.5;
      }
      
      if (score > 0) {
        matchedTopics.push({ topic, score });
      }
    }

    // 按得分排序并返回前几个主题
    matchedTopics.sort((a, b) => b.score - a.score);
    return matchedTopics.slice(0, 2).map(item => item.topic);
  }

  // 提取关键词用于生成标题（改进版）
  private static extractKeywords(text: string): string[] {
    if (!text || text.trim().length === 0) return [];
    
    // 预处理文本
    const cleanText = text.replace(/[^\w\s\u4e00-\u9fff]/g, ' ').replace(/\s+/g, ' ').trim();
    
    // 扩展停用词列表
    const stopWords = new Set([
      '的', '了', '在', '是', '我', '你', '他', '她', '它', '们', '这', '那', '有', '和', '或', '但', '所以', 
      '因为', '如果', '虽然', '什么', '怎么', '为什么', '哪里', '什么时候', '怎样', '多少', '哪个', '哪些',
      '一个', '一些', '很多', '非常', '比较', '特别', '真的', '确实', '可能', '应该', '需要', '想要', '希望',
      '可以', '能够', '会', '要', '不', '没', '没有', '不是', '不会', '不能', '问题', '事情', '东西', '方面',
      '时候', '地方', '人', '大家', '我们', '你们', '他们', '自己', '别人', '其他', '还有', '也', '都',
      '更', '最', '第一', '现在', '以前', '以后', '今天', '明天', '昨天'
    ]);

    // 分词并过滤
    const words = cleanText.split(' ').filter(word => 
      word.length >= 2 && 
      word.length <= 8 && 
      !stopWords.has(word) &&
      /[\u4e00-\u9fff]/.test(word) // 包含中文字符
    );

    // 计算词频和权重
    const wordFreq = new Map<string, number>();
    const wordPositions = new Map<string, number[]>();
    
    words.forEach((word, index) => {
      wordFreq.set(word, (wordFreq.get(word) || 0) + 1);
      if (!wordPositions.has(word)) {
        wordPositions.set(word, []);
      }
      wordPositions.get(word)!.push(index);
    });

    // 计算综合得分
    const scoredWords = Array.from(wordFreq.entries()).map(([word, freq]) => {
      let score = freq; // 基础频率得分
      
      // 位置权重（靠前的词得分更高）
      const positions = wordPositions.get(word)!;
      const avgPosition = positions.reduce((sum, pos) => sum + pos, 0) / positions.length;
      const positionWeight = Math.max(0, 1 - (avgPosition / words.length)) * 0.5;
      score += positionWeight;
      
      // 长度权重（3-4字的词更有意义）
      if (word.length === 3 || word.length === 4) {
        score += 0.3;
      } else if (word.length === 2) {
        score += 0.1;
      }
      
      // 特殊加权（技术词汇、专业术语等）
      if (this.isImportantWord(word)) {
        score += 0.5;
      }
      
      return { word, score };
    });

    // 排序并返回前几个关键词
    scoredWords.sort((a, b) => b.score - a.score);
    return scoredWords.slice(0, 5).map(item => item.word);
  }

  // 判断是否为重要词汇
  private static isImportantWord(word: string): boolean {
    const importantCategories = [
      // 技术类
      ['编程', '代码', '算法', '数据', '系统', '网络', '软件', '硬件', '互联网', '人工智能', '机器学习'],
      // 学术类
      ['研究', '理论', '实验', '分析', '方法', '模型', '假设', '结论', '证明', '论文'],
      // 商业类
      ['商业', '市场', '产品', '客户', '营销', '管理', '战略', '投资', '创业', '品牌'],
      // 生活类
      ['健康', '教育', '文化', '艺术', '音乐', '运动', '旅行', '美食', '时尚', '家庭'],
      // 抽象概念类
      ['创新', '发展', '变化', '趋势', '挑战', '机会', '价值', '意义', '目标', '梦想']
    ];
    
    return importantCategories.some(category => category.includes(word));
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

        if (Array.isArray(characters)) {
          characters.forEach(character => {
            if (
              this.isRecord(character) &&
              typeof character.id === 'string' &&
              typeof character.name === 'string'
            ) {
              customCharacterNames[character.id] = character.name;
            }
          });
        }

  logger.debug('Loaded custom characters for session titles:', customCharacterNames);
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
      const raw = JSON.parse(data);
      const sessionsArray = this.normalizeSessions(raw);
      const importedSessions = this.deserializeSessions(sessionsArray);
      const existingSessions = this.getAllSessions();

      const sessionMap = new Map<string, ChatSession>();

      existingSessions.forEach(session => {
        sessionMap.set(session.id, this.cloneSession(session));
      });

      importedSessions.forEach(session => {
        sessionMap.set(session.id, this.cloneSession(session));
      });

      const mergedSessions = Array.from(sessionMap.values())
        .sort((a, b) => b.lastActiveAt.getTime() - a.lastActiveAt.getTime());

      if (mergedSessions.length > this.MAX_SESSIONS) {
        mergedSessions.splice(this.MAX_SESSIONS);
      }

      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(mergedSessions));
      return true;
    } catch (error) {
      console.error('Failed to import sessions:', error);
      return false;
    }
  }

  // 规范化会话数据，兼容不同导入格式
  private static normalizeSessions(raw: unknown): unknown[] {
    if (!raw) return [];

    // 情况1：已经是数组
    if (Array.isArray(raw)) {
      return raw;
    }

    // 情况2：对象包装 { sessions: [...] }
    if (this.isRecord(raw)) {
      const record = raw as Record<string, unknown>;
      const maybeSessions = record['sessions'];
      if (Array.isArray(maybeSessions)) {
        return maybeSessions;
      }

      // 情况3：对象以 id 为 key 的 map
      const values = Object.values(record);
      if (values.every(value => this.isRecord(value))) {
        return values;
      }
    }

    throw new Error('Invalid session data format');
  }

  private static deserializeSessions(sessionsArray: unknown[]): ChatSession[] {
    if (!Array.isArray(sessionsArray)) return [];

    return sessionsArray
      .filter((session): session is RawSession => this.isRecord(session))
      .map(session => {
        const id = typeof session.id === 'string' && session.id.trim() ? session.id : this.generateSessionId();
        const createdAt = session.createdAt ? new Date(session.createdAt) : new Date();
        const lastActiveAt = session.lastActiveAt ? new Date(session.lastActiveAt) : createdAt;
        const messagesSource = Array.isArray(session.messages) ? session.messages : [];
        const messages: ChatMessage[] = messagesSource.map((msg): ChatMessage => {
          const timestamp = msg?.timestamp ? new Date(msg.timestamp) : lastActiveAt;
          return {
            ...msg,
            timestamp
          } as ChatMessage;
        });

        const characterId = typeof session.characterId === 'string' && session.characterId
          ? session.characterId
          : 'unknown';
        const title = typeof session.title === 'string' && session.title
          ? session.title
          : '未命名会话';
        const isActive = typeof session.isActive === 'boolean' ? session.isActive : true;

        return {
          id,
          characterId,
          title,
          messages,
          createdAt,
          lastActiveAt,
          isActive
        };
      });
  }

  private static cloneSession(session: ChatSession): ChatSession {
    return {
      ...session,
      createdAt: new Date(session.createdAt),
      lastActiveAt: new Date(session.lastActiveAt),
      messages: session.messages.map(message => ({
        ...message,
        timestamp: new Date(message.timestamp)
      }))
    };
  }

  private static isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null;
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