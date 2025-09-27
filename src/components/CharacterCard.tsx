'use client';

import { Character } from '@/types';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import Link from 'next/link';

interface CharacterCardProps {
  character: Character;
}

export function CharacterCard({ character }: CharacterCardProps) {
  return (
    <Card className="h-full flex flex-col transition-all hover:shadow-lg">
      <CardHeader className="text-center">
        <div className="text-6xl mb-4">{character.avatar}</div>
        <CardTitle className="text-xl">{character.name}</CardTitle>
        <CardDescription className="text-sm text-muted-foreground">
          {character.category}
        </CardDescription>
      </CardHeader>
      
      <CardContent className="flex-1">
        <p className="text-sm text-muted-foreground leading-relaxed mb-4">
          {character.description}
        </p>
        
        {/* 技能和标签显示 */}
        <div className="space-y-3">
          {/* 核心技能 */}
          {character.skills && character.skills.length > 0 && (
            <div className="space-y-2">
              <div className="text-xs text-muted-foreground">核心技能:</div>
              <div className="flex flex-wrap gap-1">
                {character.skills.slice(0, 3).map((skill, index) => (
                  <span
                    key={index}
                    className="px-2 py-1 bg-secondary text-secondary-foreground rounded-md text-xs"
                  >
                    {skill}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* 特色标签 */}
          {character.tags && character.tags.length > 0 && (
            <div className="space-y-2">
              <div className="text-xs text-muted-foreground">特色标签:</div>
              <div className="flex flex-wrap gap-1">
                {character.tags.slice(0, 4).map((tag, index) => (
                  <span
                    key={index}
                    className="px-2 py-1 bg-primary/10 text-primary border border-primary/20 rounded-md text-xs"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
        
        <div className="mt-4 text-xs text-muted-foreground">
          语言: {character.language === 'zh' ? '中文' : character.language === 'en' ? 'English' : '中文/English'}
        </div>
      </CardContent>
      
      <CardFooter>
        <Link href={`/chat/${character.id}`} className="w-full">
          <Button className="w-full">开始对话</Button>
        </Link>
      </CardFooter>
    </Card>
  );
}