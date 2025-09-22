'use client';

import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Search } from 'lucide-react';

interface CharacterSearchProps {
  onSearch: (query: string) => void;
  onCategoryFilter: (category: string) => void;
  categories: string[];
  currentCategory: string;
}

export function CharacterSearch({ 
  onSearch, 
  onCategoryFilter, 
  categories, 
  currentCategory 
}: CharacterSearchProps) {
  const [searchQuery, setSearchQuery] = useState('');

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    onSearch(searchQuery);
  };

  return (
    <div className="space-y-6">
      {/* 搜索框 */}
      <form onSubmit={handleSearch} className="relative">
        <Input
          type="text"
          placeholder="搜索角色..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-10"
        />
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
      </form>

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