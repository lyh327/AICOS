import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// 生成唯一ID的工具函数（只在客户端执行）
let messageIdCounter = 0;

export function generateMessageId(prefix: string = 'msg'): string {
  // 在服务端渲染时返回临时ID，客户端会重新生成
  if (typeof window === 'undefined') {
    return `${prefix}-ssr-${messageIdCounter++}`;
  }
  
  // 客户端使用时间戳和计数器确保唯一性
  return `${prefix}-${Date.now()}-${messageIdCounter++}`;
}