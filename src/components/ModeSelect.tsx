'use client';

import { Button } from '@/components/ui/button';
import { Brain, Eye, Sparkles, MessageSquare } from 'lucide-react';

interface ModeSelectProps {
  selectedMode: 'standard' | 'smart' | 'thinking' | 'vision';
  onModeChange: (mode: 'standard' | 'smart' | 'thinking' | 'vision') => void;
  disabled?: boolean;
  hasImage?: boolean;
}

const modes = [
  {
    key: 'standard' as const,
    label: '标准',
    icon: MessageSquare,
    description: '普通对话模式',
    color: 'text-gray-600'
  },
  {
    key: 'smart' as const,
    label: '智能',
    icon: Sparkles,
    description: '智能分析，自动选择最佳模式',
    color: 'text-blue-600'
  },
  {
    key: 'thinking' as const,
    label: '深度思考',
    icon: Brain,
    description: 'GLM-4.5 深度思考模式',
    color: 'text-purple-600'
  },
  {
    key: 'vision' as const,
    label: '视觉理解',
    icon: Eye,
    description: 'GLM-4.5V 图像理解模式',
    color: 'text-green-600'
  }
];

export function ModeSelect({ selectedMode, onModeChange, disabled, hasImage }: ModeSelectProps) {
  return (
    <div className="flex items-center gap-1 p-1 bg-gray-100 rounded-lg">
      {modes.map((mode) => {
        const Icon = mode.icon;
        const isSelected = selectedMode === mode.key;
        const isDisabled = disabled || (mode.key === 'vision' && !hasImage);
        
        return (
          <Button
            key={mode.key}
            variant={isSelected ? "default" : "ghost"}
            size="sm"
            onClick={() => onModeChange(mode.key)}
            disabled={isDisabled}
            className={`
              h-8 px-2 text-xs transition-all
              ${isSelected 
                ? 'bg-white shadow-sm' 
                : 'hover:bg-white/50'
              }
              ${isDisabled 
                ? 'opacity-40 cursor-not-allowed' 
                : ''
              }
            `}
            title={mode.description}
          >
            <Icon className={`w-3 h-3 mr-1 ${isSelected ? 'text-current' : mode.color}`} />
            <span>{mode.label}</span>
          </Button>
        );
      })}
    </div>
  );
}