import { NextRequest, NextResponse } from 'next/server';
import { OnlineCharacter } from '@/types';

// 模拟的角色数据库
const MOCK_CHARACTERS: OnlineCharacter[] = [
  {
    id: 'char_1',
    name: '智能助手小艾',
    description: '专业的AI助手，擅长解答各种问题和提供帮助',
    personality: '友善、专业、耐心、细致',
    background: '拥有丰富的知识库和学习能力，专注于为用户提供准确有用的信息',
    avatar: '🤖',
    category: '助手',
    tags: ['AI', '助手', '智能', '问答'],
    language: 'zh'
  },
  {
    id: 'char_2',
    name: '历史学者陈教授',
    description: '对中国历史有深度研究的资深学者',
    personality: '博学、严谨、思辨、谦逊',
    background: '专攻中国古代史，对各个朝代的政治、文化、经济都有深入了解',
    avatar: '📚',
    category: '学者',
    tags: ['历史', '学术', '研究', '教育'],
    language: 'zh'
  },
  {
    id: 'char_3',
    name: '创意作家林小雨',
    description: '富有想象力的创意写作专家',
    personality: '创新、感性、富有想象力、浪漫',
    background: '擅长各种文体创作，有丰富的创作经验，特别擅长诗歌和小说',
    avatar: '✍️',
    category: '创作',
    tags: ['写作', '创意', '文学', '诗歌'],
    language: 'zh'
  },
  {
    id: 'char_4',
    name: '心理咨询师温暖',
    description: '专业的心理健康咨询专家',
    personality: '温暖、耐心、善于倾听、专业',
    background: '拥有多年心理咨询经验，擅长情绪管理和心理疏导',
    avatar: '🧠',
    category: '咨询',
    tags: ['心理', '咨询', '情感', '健康'],
    language: 'zh'
  },
  {
    id: 'char_5',
    name: '科技极客阿尔法',
    description: '对前沿科技充满热情的技术专家',
    personality: '理性、逻辑性强、创新、求知欲旺盛',
    background: '专注于人工智能、区块链、量子计算等前沿技术研究',
    avatar: '🔬',
    category: '科技',
    tags: ['科技', '编程', 'AI', '创新'],
    language: 'zh'
  },
  {
    id: 'char_6',
    name: '旅行达人小马',
    description: '走遍世界的旅行博主',
    personality: '开朗、冒险、乐观、分享精神强',
    background: '游历过50多个国家，对各地文化和美食都有深入了解',
    avatar: '🎒',
    category: '旅行',
    tags: ['旅行', '文化', '美食', '摄影'],
    language: 'zh'
  },
  {
    id: 'char_7',
    name: '美食大师老王',
    description: '传统中华料理的烹饪大师',
    personality: '热情、严谨、传统、乐于传承',
    background: '从事烹饪行业30多年，精通各大菜系，致力于传统美食的传承',
    avatar: '👨‍🍳',
    category: '美食',
    tags: ['烹饪', '美食', '传统', '文化'],
    language: 'zh'
  },
  {
    id: 'char_8',
    name: '健身教练力量',
    description: '专业的健身指导和营养顾问',
    personality: '积极、专业、励志、耐心',
    background: '拥有多项健身认证，擅长制定个性化训练和饮食计划',
    avatar: '💪',
    category: '健康',
    tags: ['健身', '运动', '营养', '健康'],
    language: 'zh'
  },
  {
    id: 'char_9',
    name: '艺术家梵高再现',
    description: '充满激情的现代艺术创作者',
    personality: '热情、敏感、富有创造力、情感丰富',
    background: '专注于油画和数字艺术创作，对色彩和构图有独特见解',
    avatar: '🎨',
    category: '艺术',
    tags: ['艺术', '绘画', '创作', '美学'],
    language: 'zh'
  },
  {
    id: 'char_10',
    name: '商业顾问思维',
    description: '经验丰富的商业策略和管理顾问',
    personality: '理性、分析能力强、决策果断、具有前瞻性',
    background: '在多家500强企业担任过高管，擅长战略规划和团队管理',
    avatar: '💼',
    category: '商业',
    tags: ['商业', '策略', '管理', '咨询'],
    language: 'zh'
  }
];

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const query = searchParams.get('q') || '';
    const category = searchParams.get('category') || '';
    const limit = parseInt(searchParams.get('limit') || '10');

    let filteredCharacters = MOCK_CHARACTERS;

    // 根据查询词过滤
    if (query) {
      const lowerQuery = query.toLowerCase();
      filteredCharacters = filteredCharacters.filter(char => 
        char.name.toLowerCase().includes(lowerQuery) ||
        char.description.toLowerCase().includes(lowerQuery) ||
        char.personality?.toLowerCase().includes(lowerQuery) ||
        char.background?.toLowerCase().includes(lowerQuery) ||
        char.tags?.some(tag => tag.toLowerCase().includes(lowerQuery))
      );
    }

    // 根据分类过滤
    if (category) {
      filteredCharacters = filteredCharacters.filter(char => 
        char.category?.toLowerCase() === category.toLowerCase()
      );
    }

    // 限制结果数量
    filteredCharacters = filteredCharacters.slice(0, limit);

    return NextResponse.json({
      success: true,
      characters: filteredCharacters,
      total: filteredCharacters.length,
      query: query,
      category: category
    });

  } catch (error) {
    console.error('Character search API error:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Internal server error',
        characters: [],
        total: 0
      },
      { status: 500 }
    );
  }
}

// 获取角色分类
export async function POST(request: NextRequest) {
  try {
    const categories = [...new Set(MOCK_CHARACTERS.map(char => char.category).filter(Boolean))];
    
    const categoriesWithCount = categories.map(category => ({
      name: category,
      count: MOCK_CHARACTERS.filter(char => char.category === category).length
    }));

    return NextResponse.json({
      success: true,
      categories: categoriesWithCount
    });

  } catch (error) {
    console.error('Categories API error:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Internal server error',
        categories: []
      },
      { status: 500 }
    );
  }
}