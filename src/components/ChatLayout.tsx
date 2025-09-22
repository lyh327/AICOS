import React, { useState, useEffect } from 'react';
import { Sidebar } from '@/components/Sidebar';
import { Character } from '@/types';

interface ChatLayoutProps {
  children: React.ReactNode;
  currentCharacter?: Character;
  currentSessionId?: string;
  showSidebar?: boolean;
  footer?: React.ReactNode;
}

export const ChatLayout: React.FC<ChatLayoutProps> = ({
  children,
  currentCharacter,
  currentSessionId,
  showSidebar = true,
  footer
}) => {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    // 从 localStorage 读取状态，默认为 false（展开）
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('sidebarCollapsed');
      return saved === 'true';
    }
    return false;
  });

  // 当状态改变时保存到 localStorage
  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('sidebarCollapsed', sidebarCollapsed.toString());
    }
  }, [sidebarCollapsed]);

  if (!showSidebar) {
    return (
      <div className="h-screen flex flex-col">
        <div className="flex-1 overflow-auto">
          {children}
        </div>
        {footer && (
          <div className="flex-shrink-0">
            {footer}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="h-screen flex">
      {/* 侧边栏 - 固定定位 */}
      <div className="flex-shrink-0 h-full">
        <Sidebar
          currentCharacter={currentCharacter}
          currentSessionId={currentSessionId}
          isCollapsed={sidebarCollapsed}
          onToggleCollapse={() => setSidebarCollapsed(!sidebarCollapsed)}
        />
      </div>
      
      {/* 主内容区域 - 可独立滚动 */}
      <div className="flex-1 h-full flex flex-col">
        <div className="flex-1 overflow-auto">
          {children}
        </div>
        {footer && (
          <div className="flex-shrink-0">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
};