import { Character, OnlineCharacter, OnlineCharacterResult, CharacterApiSource } from '@/types';

type StoredCharacter = Omit<Partial<Character>, 'createdAt' | 'updatedAt' | 'skills' | 'tags' | 'language'> & {
  id?: string;
  createdAt?: string | number | Date;
  updatedAt?: string | number | Date;
  skills?: unknown;
  tags?: unknown;
  language?: unknown;
};

type CharacterTemplate = {
  name: string;
  description: string;
  personality: string;
  background: string;
  category: string;
  avatar: string;
  tags: string[];
};

interface CharacterSuggestionGroup {
  source: string;
  suggestions: CharacterTemplate[];
}

interface CharacterApiResponse {
  characters?: OnlineCharacter[];
}

type CharacterStats = {
  total: number;
  userCreated: number;
  apiImported: number;
  categories: Record<string, number>;
};

export class CharacterManager {
  private static readonly STORAGE_KEY = 'custom_characters';
  private static readonly API_SOURCES_KEY = 'character_api_sources';

  // 获取所有自定义角色
  static getCustomCharacters(): Character[] {
    try {
      const data = localStorage.getItem(this.STORAGE_KEY);
      if (!data) return [];
      
      const raw = JSON.parse(data) as unknown;
      if (!Array.isArray(raw)) {
        return [];
      }

      return raw
        .filter((item): item is StoredCharacter => this.isRecord(item))
        .map((char, index) => this.deserializeStoredCharacter(char, index));
    } catch (error) {
      console.error('Error loading custom characters:', error);
      return [];
    }
  }

  // 保存自定义角色
  static saveCustomCharacter(character: Omit<Character, 'id' | 'createdAt' | 'updatedAt'>): Character {
    const characters = this.getCustomCharacters();
    const now = new Date();
    
    const newCharacter: Character = {
      ...character,
      id: `custom_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      isCustom: true,
      source: 'user-created',
      createdAt: now,
      updatedAt: now
    };

    characters.push(newCharacter);
    localStorage.setItem(this.STORAGE_KEY, JSON.stringify(characters));
    
    return newCharacter;
  }

  // 更新自定义角色
  static updateCustomCharacter(id: string, updates: Partial<Character>): Character | null {
    const characters = this.getCustomCharacters();
    const index = characters.findIndex(char => char.id === id);
    
    if (index === -1) return null;

    characters[index] = {
      ...characters[index],
      ...updates,
      updatedAt: new Date()
    };

    localStorage.setItem(this.STORAGE_KEY, JSON.stringify(characters));
    return characters[index];
  }

  // 删除自定义角色
  static deleteCustomCharacter(id: string): boolean {
    const characters = this.getCustomCharacters();
    const filteredCharacters = characters.filter(char => char.id !== id);
    
    if (filteredCharacters.length === characters.length) {
      return false; // 角色不存在
    }

    localStorage.setItem(this.STORAGE_KEY, JSON.stringify(filteredCharacters));
    return true;
  }

  // 从在线角色创建自定义角色
  static importOnlineCharacter(onlineChar: OnlineCharacter): Character {
    const character: Omit<Character, 'id' | 'createdAt' | 'updatedAt'> = {
      name: onlineChar.name,
      description: onlineChar.description || '',
      personality: onlineChar.personality || '',
      background: onlineChar.background || '',
      category: onlineChar.category || '导入角色',
      image: onlineChar.image || '',
      avatar: onlineChar.avatar || '🎭',
      skills: onlineChar.tags || [],
      language: onlineChar.language || 'zh',
      isCustom: true,
      source: 'api-imported',
      tags: onlineChar.tags || []
    };

    return this.saveCustomCharacter(character);
  }

  // 获取API源配置
  static getApiSources(): CharacterApiSource[] {
    try {
      const data = localStorage.getItem(this.API_SOURCES_KEY);
      if (!data) {
        // 返回默认API源
        return this.getDefaultApiSources();
      }
      const raw = JSON.parse(data) as unknown;
      if (!Array.isArray(raw)) {
        return this.getDefaultApiSources();
      }

  const normalizedSources = raw.filter((item): item is CharacterApiSource => this.isCharacterApiSource(item));
      return normalizedSources.length > 0 ? normalizedSources : this.getDefaultApiSources();
    } catch (error) {
      console.error('Error loading API sources:', error);
      return this.getDefaultApiSources();
    }
  }

  // 保存API源配置
  static saveApiSources(sources: CharacterApiSource[]): void {
    localStorage.setItem(this.API_SOURCES_KEY, JSON.stringify(sources));
  }

  // 获取默认API源
  private static getDefaultApiSources(): CharacterApiSource[] {
    return [
      {
        name: '模拟角色库',
        url: '/api/characters/search',
        description: '搜索模拟角色数据',
        enabled: true
      },
      {
        name: 'Character.AI',
        url: 'https://character.ai/api/characters',
        description: '从 Character.AI 搜索角色',
        enabled: false
      },
      {
        name: 'OpenAI GPT角色库',
        url: 'https://api.openai.com/characters',
        description: '开放的GPT角色设定库',
        enabled: false
      }
    ];
  }

  // 从互联网搜索角色
  static async searchOnlineCharacters(query: string): Promise<OnlineCharacterResult[]> {
    const sources = this.getApiSources().filter(source => source.enabled);
    const results: OnlineCharacterResult[] = [];

    for (const source of sources) {
      try {
        const result = await this.fetchFromSource(source, query);
        if (result.characters && result.characters.length > 0) {
          results.push(result);
        }
      } catch (error) {
        console.error(`Error fetching from ${source.name}:`, error);
        // 继续处理其他源
      }
    }

    return results;
  }

  // 从指定源获取角色数据
  private static async fetchFromSource(source: CharacterApiSource, query: string): Promise<OnlineCharacterResult> {
    // 这里实现具体的API调用逻辑
    if (source.url.includes('/api/characters/search')) {
      // 调用本地API，使用GET方法搜索角色
      try {
        const response = await fetch(`${source.url}?q=${encodeURIComponent(query)}`);
        
        if (!response.ok) throw new Error('API request failed');
        
        const data = (await response.json()) as CharacterApiResponse;
        return {
          source: source.name,
          characters: Array.isArray(data.characters) ? data.characters : []
        };
      } catch (error) {
        console.error('Local API call failed:', error);
        // 如果本地API失败，返回模拟数据
        return {
          source: source.name,
          characters: this.getMockSearchResults(query)
        };
      }
    } else {
      // 对于外部API，返回模拟数据（实际项目中需要实现具体的API调用）
      return {
        source: source.name,
        characters: this.getMockSearchResults(query)
      };
    }
  }

    // 根据关键词生成角色设定建议
  static async generateCharacterSuggestions(query: string): Promise<CharacterSuggestionGroup[]> {
    try {
      // 实际项目中可以调用AI API来生成建议
      // 这里提供基于关键词的模板建议
      const suggestions = this.getCharacterTemplates(query);
      
      return [{
        source: '智能建议',
        suggestions
      }];
    } catch (error) {
      console.error('Error generating suggestions:', error);
      return [];
    }
  }

  // 基于关键词获取角色模板
  private static getCharacterTemplates(query: string): CharacterTemplate[] {
    const lowerQuery = query.toLowerCase();
    const templates: Record<string, CharacterTemplate[]> = {
      '历史': [
        {
          name: '历史学者',
          description: '对历史有深入研究的专业学者',
          personality: '博学、严谨、客观、善于分析',
          background: '专攻某个历史时期，对史料有深入了解',
          category: '学术',
          avatar: '📚',
          tags: ['历史', '学术', '研究', '教育']
        },
        {
          name: '古代文人',
          description: '来自古代的文人墨客',
          personality: '文雅、深沉、富有诗意、思想深邃',
          background: '熟悉古典文学和历史文化',
          category: '文化',
          avatar: '📜',
          tags: ['古代', '文学', '文化', '诗歌']
        }
      ],
      '科技': [
        {
          name: '科技专家',
          description: '前沿科技领域的研究专家',
          personality: '理性、创新、好奇心强、逻辑思维清晰',
          background: '专注于人工智能、机器学习等技术领域',
          category: '科技',
          avatar: '🔬',
          tags: ['科技', 'AI', '创新', '研究']
        },
        {
          name: '程序员',
          description: '经验丰富的软件开发工程师',
          personality: '严谨、专注、问题解决能力强、持续学习',
          background: '擅长多种编程语言和技术栈',
          category: '技术',
          avatar: '💻',
          tags: ['编程', '开发', '技术', '软件']
        }
      ],
      '艺术': [
        {
          name: '艺术家',
          description: '富有创造力的艺术创作者',
          personality: '感性、富有想象力、追求美感、情感丰富',
          background: '专注于绘画、雕塑或其他艺术形式',
          category: '艺术',
          avatar: '🎨',
          tags: ['艺术', '创作', '美学', '设计']
        }
      ],
      '商业': [
        {
          name: '商业顾问',
          description: '经验丰富的商业策略专家',
          personality: '理性、分析能力强、决策果断、前瞻性思维',
          background: '在商业管理和战略规划方面有丰富经验',
          category: '商业',
          avatar: '💼',
          tags: ['商业', '管理', '策略', '咨询']
        }
      ]
    };

    // 查找匹配的模板
    for (const [key, templateList] of Object.entries(templates)) {
      if (lowerQuery.includes(key)) {
        return templateList;
      }
    }

    // 如果没有匹配的模板，返回通用建议
    return [
      {
        name: `${query}专家`,
        description: `在${query}领域有专业知识的专家`,
        personality: '专业、耐心、乐于分享知识',
        background: `拥有丰富的${query}相关经验和知识`,
        category: '专业人士',
        avatar: '🎯',
        tags: [query, '专家', '专业', '知识']
      }
    ];
  }

  // 模拟搜索结果（用于演示）
  private static getMockSearchResults(query: string): OnlineCharacter[] {
    const mockCharacters: OnlineCharacter[] = [
      {
        id: 'online_1',
        name: '智能助手小艾',
        description: '专业的AI助手，擅长解答各种问题',
        personality: '友善、专业、耐心',
        background: '拥有丰富的知识库和学习能力',
        avatar: '🤖',
        category: '助手',
        tags: ['AI', '助手', '智能'],
        language: 'zh'
      },
      {
        id: 'online_2', 
        name: '历史学者',
        description: '对历史有深度研究的学者',
        personality: '博学、严谨、思辨',
        background: '专攻中国古代史，对各个朝代都有深入了解',
        avatar: '📚',
        category: '学者',
        tags: ['历史', '学术', '研究'],
        language: 'zh'
      },
      {
        id: 'online_3',
        name: '创意作家',
        description: '富有想象力的创意写作专家',
        personality: '创新、感性、富有想象力',
        background: '擅长各种文体创作，有丰富的创作经验',
        avatar: '✍️',
        category: '创作',
        tags: ['写作', '创意', '文学'],
        language: 'zh'
      }
    ];

    // 简单的模糊搜索
    const lowerQuery = query.toLowerCase();
    return mockCharacters.filter(char => 
      char.name.toLowerCase().includes(lowerQuery) ||
      char.description.toLowerCase().includes(lowerQuery) ||
      char.tags?.some(tag => tag.toLowerCase().includes(lowerQuery))
    );
  }

  // 获取角色统计信息
  static getCharacterStats(): CharacterStats {
    const customCharacters = this.getCustomCharacters();
    const userCreated = customCharacters.filter(char => char.source === 'user-created').length;
    const apiImported = customCharacters.filter(char => char.source === 'api-imported').length;

    return {
      total: customCharacters.length,
      userCreated,
      apiImported,
      categories: this.getCharacterCategories(customCharacters)
    };
  }

  // 获取角色分类统计
  private static getCharacterCategories(characters: Character[]): Record<string, number> {
    const categories: Record<string, number> = {};
    
    characters.forEach(char => {
      const category = char.category || '未分类';
      categories[category] = (categories[category] || 0) + 1;
    });

    return categories;
  }

  private static deserializeStoredCharacter(char: StoredCharacter, fallbackIndex: number): Character {
    const createdAt = char.createdAt ? new Date(char.createdAt) : new Date();
    const updatedAt = char.updatedAt ? new Date(char.updatedAt) : createdAt;
    const idCandidate = typeof char.id === 'string' && char.id.trim().length > 0 ? char.id : undefined;
    const id = idCandidate ?? `custom_${createdAt.getTime()}_${fallbackIndex}`;

    const languageCandidate = typeof char.language === 'string' ? char.language : undefined;
    const sourceCandidate = typeof char.source === 'string' ? char.source : undefined;

    return {
      id,
      name: typeof char.name === 'string' ? char.name : '未命名角色',
      description: typeof char.description === 'string' ? char.description : '',
      personality: typeof char.personality === 'string' ? char.personality : '',
      background: typeof char.background === 'string' ? char.background : '',
      category: typeof char.category === 'string' ? char.category : '自定义角色',
      image: typeof char.image === 'string' ? char.image : '',
      avatar: typeof char.avatar === 'string' ? char.avatar : '🎭',
      skills: this.normalizeStringArray(char.skills),
      language: this.isValidLanguage(languageCandidate) ? languageCandidate : 'zh',
      isCustom: true,
      source: this.isCharacterSource(sourceCandidate) ? sourceCandidate : 'user-created',
      createdAt,
      updatedAt,
      tags: this.normalizeStringArray(char.tags),
      prompt: typeof char.prompt === 'string' ? char.prompt : undefined
    };
  }

  private static normalizeStringArray(value: unknown): string[] {
    if (!Array.isArray(value)) {
      return [];
    }
    return value.filter((item): item is string => typeof item === 'string');
  }

  private static isValidLanguage(value: unknown): value is Character['language'] {
    return value === 'zh' || value === 'en' || value === 'both';
  }

  private static isCharacterSource(value: unknown): value is NonNullable<Character['source']> {
    return value === 'user-created' || value === 'api-imported' || value === 'built-in';
  }

  private static isCharacterApiSource(value: unknown): value is CharacterApiSource {
    if (!this.isRecord(value)) return false;
    return (
      typeof value.name === 'string' &&
      typeof value.url === 'string' &&
      typeof value.description === 'string' &&
      typeof value.enabled === 'boolean'
    );
  }

  private static isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null;
  }
}