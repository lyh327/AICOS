'use client';

import { useState, useMemo } from 'react';
import { characters, categories, getCharactersByCategory } from '@/data/characters';
import { CharacterCard } from '@/components/CharacterCard';
import { CharacterSearch } from '@/components/CharacterSearch';

export default function HomePage() {
  const [currentCategory, setCurrentCategory] = useState('全部');
  const [searchQuery, setSearchQuery] = useState('');

  const filteredCharacters = useMemo(() => {
    let result = getCharactersByCategory(currentCategory);
    
    if (searchQuery.trim()) {
      result = result.filter(character =>
        character.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        character.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
        character.category.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }
    
    return result;
  }, [currentCategory, searchQuery]);

  return (
    <div className="min-h-screen bg-background">
      {/* 头部 */}
      <header className="border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container mx-auto px-4 py-6">
          <div className="text-center space-y-4">
            <h1 className="text-4xl font-bold tracking-tight">AI 角色扮演聊天</h1>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              与历史人物、文学角色进行智能语音对话，体验沉浸式角色扮演
            </p>
          </div>
        </div>
      </header>

      {/* 主要内容 */}
      <main className="container mx-auto px-4 py-8">
        <div className="space-y-8">
          {/* 搜索和筛选 */}
          <CharacterSearch
            onSearch={setSearchQuery}
            onCategoryFilter={setCurrentCategory}
            categories={categories}
            currentCategory={currentCategory}
          />

          {/* 角色网格 */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {filteredCharacters.map((character) => (
              <CharacterCard key={character.id} character={character} />
            ))}
          </div>

          {/* 无结果提示 */}
          {filteredCharacters.length === 0 && (
            <div className="text-center py-12">
              <div className="text-6xl mb-4">🔍</div>
              <h3 className="text-lg font-medium text-foreground mb-2">未找到匹配的角色</h3>
              <p className="text-muted-foreground">尝试使用其他关键词或选择不同的分类</p>
            </div>
          )}
        </div>
      </main>

      {/* 页脚 */}
      <footer className="border-t border-border mt-16">
        <div className="container mx-auto px-4 py-8">
          <div className="text-center text-muted-foreground">
            <p>&copy; 2024 AI 角色扮演聊天平台. 探索无限可能的对话体验.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
