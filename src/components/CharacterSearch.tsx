'use client';

import { useState, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Search, Loader2 } from 'lucide-react';

interface CharacterSearchProps {
  onSearch: (query: string) => void;
  onCategoryFilter: (category: string) => void;
  categories: string[];
  currentCategory: string;
  isSearching?: boolean;
}

export function CharacterSearch({ 
  onSearch, 
  onCategoryFilter, 
  categories, 
  currentCategory,
  isSearching = false
}: CharacterSearchProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [isTyping, setIsTyping] = useState(false);

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const query = e.target.value;
    setSearchQuery(query);
    setIsTyping(true);
    // 实时触发搜索
    onSearch(query);
  };

  // 监听搜索状态变化，重置输入状态
  useEffect(() => {
    if (!isSearching) {
      setIsTyping(false);
    }
  }, [isSearching]);

  return (
    <div className="space-y-6">
      {/* 搜索框 */}
      <div className="relative">
        <Input
          type="text"
          placeholder="搜索角色名称、描述、标签、技能..."
          value={searchQuery}
          onChange={handleSearchChange}
          className="pl-10 pr-10"
        />
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
        
        {/* 搜索状态指示器 */}
        {searchQuery && isTyping && (
          <Loader2 className="absolute right-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4 animate-spin" />
        )}
        
        {/* 搜索结果计数 */}
        {searchQuery && !isTyping && (
          <div className="absolute right-3 top-1/2 transform -translate-y-1/2 text-xs text-muted-foreground">
            实时搜索
          </div>
        )}
      </div>

      {/* 分类筛选 */}
      <div className="flex flex-wrap gap-2">
        {categories.map((category) => (
          <Button
            key={category}
            variant={currentCategory === category ? "default" : "outline"}
            size="sm"
            onClick={() => onCategoryFilter(category)}
          >
            {category}
          </Button>
        ))}
      </div>
    </div>
  );
}