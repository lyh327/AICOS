// 简单的内存式速率限制器
interface RateLimitEntry {
  requests: number;
  resetTime: number;
}

class RateLimiter {
  private store = new Map<string, RateLimitEntry>();
  private readonly requestsPerMinute: number;
  private readonly requestsPerHour: number;

  constructor() {
    this.requestsPerMinute = parseInt(process.env.RATE_LIMIT_REQUESTS_PER_MINUTE || '30');
    this.requestsPerHour = parseInt(process.env.RATE_LIMIT_REQUESTS_PER_HOUR || '500');
  }

  // 检查是否超过速率限制
  checkRateLimit(identifier: string): { allowed: boolean; retryAfter?: number } {
    const now = Date.now();
    
    // 检查分钟级限制
    const minuteKey = `${identifier}:minute:${Math.floor(now / 60000)}`;
    const minuteEntry = this.store.get(minuteKey);
    
    if (minuteEntry && minuteEntry.requests >= this.requestsPerMinute) {
      const retryAfter = Math.ceil((minuteEntry.resetTime - now) / 1000);
      return { allowed: false, retryAfter };
    }

    // 检查小时级限制
    const hourKey = `${identifier}:hour:${Math.floor(now / 3600000)}`;
    const hourEntry = this.store.get(hourKey);
    
    if (hourEntry && hourEntry.requests >= this.requestsPerHour) {
      const retryAfter = Math.ceil((hourEntry.resetTime - now) / 1000);
      return { allowed: false, retryAfter };
    }

    return { allowed: true };
  }

  // 记录请求
  recordRequest(identifier: string): void {
    const now = Date.now();
    
    // 记录分钟级请求
    const minuteKey = `${identifier}:minute:${Math.floor(now / 60000)}`;
    const minuteEntry = this.store.get(minuteKey);
    
    if (minuteEntry) {
      minuteEntry.requests++;
    } else {
      this.store.set(minuteKey, {
        requests: 1,
        resetTime: Math.floor(now / 60000) * 60000 + 60000
      });
    }

    // 记录小时级请求
    const hourKey = `${identifier}:hour:${Math.floor(now / 3600000)}`;
    const hourEntry = this.store.get(hourKey);
    
    if (hourEntry) {
      hourEntry.requests++;
    } else {
      this.store.set(hourKey, {
        requests: 1,
        resetTime: Math.floor(now / 3600000) * 3600000 + 3600000
      });
    }
  }

  // 清理过期条目
  cleanup(): void {
    const now = Date.now();
    for (const [key, entry] of this.store.entries()) {
      if (entry.resetTime < now) {
        this.store.delete(key);
      }
    }
  }
}

// 全局速率限制器实例
const rateLimiter = new RateLimiter();

// 定期清理过期条目
setInterval(() => rateLimiter.cleanup(), 60000); // 每分钟清理一次

export { rateLimiter };