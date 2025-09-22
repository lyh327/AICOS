'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Brain, ChevronDown, ChevronUp } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

interface ThinkingProcessProps {
  thinkingProcess: string;
  className?: string;
}

export function ThinkingProcess({ thinkingProcess, className = '' }: ThinkingProcessProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  if (!thinkingProcess) return null;

  return (
    <div className={`border rounded-lg bg-gray-50 ${className}`}>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full justify-between p-3 h-auto text-left"
      >
        <div className="flex items-center gap-2">
          <Brain className="w-4 h-4 text-purple-600" />
          <span className="text-sm font-medium text-gray-700">思考过程</span>
          <span className="text-xs text-gray-500">
            ({isExpanded ? '收起' : '展开'})
          </span>
        </div>
        {isExpanded ? (
          <ChevronUp className="w-4 h-4 text-gray-500" />
        ) : (
          <ChevronDown className="w-4 h-4 text-gray-500" />
        )}
      </Button>
      
      {isExpanded && (
        <div className="px-3 pb-3 border-t bg-white">
          <div className="mt-2 text-sm text-gray-600">
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              components={{
                h1: ({ children }) => <h1 className="text-lg font-semibold text-gray-800 mb-2">{children}</h1>,
                h2: ({ children }) => <h2 className="text-md font-medium text-gray-700 mb-1">{children}</h2>,
                h3: ({ children }) => <h3 className="text-sm font-medium text-gray-600 mb-1">{children}</h3>,
                p: ({ children }) => <p className="mb-2 leading-relaxed">{children}</p>,
                ul: ({ children }) => <ul className="list-disc list-inside mb-2 space-y-1">{children}</ul>,
                ol: ({ children }) => <ol className="list-decimal list-inside mb-2 space-y-1">{children}</ol>,
                li: ({ children }) => <li className="text-gray-600">{children}</li>,
                code: ({ children }) => (
                  <code className="px-1 py-0.5 bg-purple-100 text-purple-800 rounded text-xs font-mono">
                    {children}
                  </code>
                ),
                pre: ({ children }) => (
                  <pre className="bg-purple-100 p-2 rounded text-xs overflow-x-auto mb-2">
                    {children}
                  </pre>
                ),
                blockquote: ({ children }) => (
                  <blockquote className="border-l-4 border-purple-200 pl-3 italic text-gray-600 mb-2">
                    {children}
                  </blockquote>
                ),
              }}
            >
              {thinkingProcess}
            </ReactMarkdown>
          </div>
        </div>
      )}
    </div>
  );
}