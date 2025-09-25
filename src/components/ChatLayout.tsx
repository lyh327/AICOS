"use client";

import React, { useState, useEffect } from 'react';

// augment window types for defensive assignments
declare global {
  interface Window {
    syncDownloadState?: () => void;
    downProgCallback?: () => void;
    downProg?: { progress: number };
  }
}
import { Sidebar } from '@/components/Sidebar';
import { Character } from '@/types';
import logger from '@/lib/logger';

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
  // 初始渲染时不要访问 localStorage，以避免 SSR/CSR 不一致导致的 hydration 错误。
  // 先使用一个确定的初始值（false），在客户端挂载后再读取保存的偏好并更新。
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  useEffect(() => {
    // 仅在客户端读取 localStorage
    try {
      const saved = localStorage.getItem('sidebarCollapsed');
      if (saved === 'true') {
        setSidebarCollapsed(true);
      }
    } catch (err) {
      logger.error('读取 sidebarCollapsed 失败:', err);
      // ignore
    }
  }, []);

  // 防御性占位：某些浏览器插件或宿主环境可能会尝试调用页面上不存在的全局函数
  //（例如 syncDownloadState、downProgCallback 等）导致控制台报错并中断脚本。
  //在客户端挂载后定义安全的 no-op 占位，避免这些未定义引用抛错。
  useEffect(() => {
    if (typeof window === 'undefined') return;

    try {
      const w = window as unknown as Record<string, unknown>;
      if (typeof w['syncDownloadState'] === 'undefined') {
        (w as Record<string, (...args: unknown[]) => void>)['syncDownloadState'] = () => { /* no-op placeholder */ };
      }
      if (typeof w['downProgCallback'] === 'undefined') {
        (w as Record<string, (...args: unknown[]) => void>)['downProgCallback'] = () => { /* no-op placeholder */ };
      }
      if (typeof w['downProg'] === 'undefined') {
        (w as Record<string, unknown>)['downProg'] = { progress: 0 };
      }
    } catch (err) {
      logger.error('防御性全局函数占位失败:', err);
      // ignore defensive assignment errors
    }
  }, []);
 

  // 当状态改变时保存到 localStorage（客户端）
  useEffect(() => {
    try {
      localStorage.setItem('sidebarCollapsed', sidebarCollapsed.toString());
    } catch (e) {
      logger.error('保存 sidebarCollapsed 失败:', e);
      // ignore
    }
  }, [sidebarCollapsed]);

  // mobile sidebar overlay state
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

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
      {/* Desktop / tablet sidebar - hidden on small screens */}
      <div className="hidden sm:flex flex-shrink-0 h-full">
        <Sidebar
          currentCharacter={currentCharacter}
          currentSessionId={currentSessionId}
          isCollapsed={sidebarCollapsed}
          onToggleCollapse={() => setSidebarCollapsed(!sidebarCollapsed)}
        />
      </div>

      {/* Mobile floating toggle button */}
      <button
        aria-label="打开侧边栏"
        className="sm:hidden fixed left-3 top-4 z-40 p-2 bg-white/90 dark:bg-slate-900/90 rounded-lg shadow-md"
        onClick={() => setMobileSidebarOpen(true)}
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M3 6h18M3 12h18M3 18h18" />
        </svg>
      </button>

      {/* Mobile overlay sidebar */}
      {mobileSidebarOpen && (
        <div className="sm:hidden fixed inset-0 z-50 flex">
          {/* backdrop */}
          <div
            className="absolute inset-0 bg-black/30"
            onClick={() => setMobileSidebarOpen(false)}
          />

          <div className="relative w-80 h-full bg-background">
            <Sidebar
              currentCharacter={currentCharacter}
              currentSessionId={currentSessionId}
              isCollapsed={false}
              onToggleCollapse={() => setMobileSidebarOpen(false)}
            />
          </div>
        </div>
      )}

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