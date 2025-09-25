// Simple environment-sensitive logger
const isDev = process.env.NODE_ENV !== 'production';

type LogArguments = Parameters<typeof console.log>;

export const logger = {
  debug: (...args: LogArguments) => {
    if (isDev) {
      console.debug(...args);
    }
  },
  info: (...args: LogArguments) => {
    if (isDev) {
      console.info(...args);
    }
  },
  warn: (...args: LogArguments) => {
    console.warn(...args);
  },
  error: (...args: LogArguments) => {
    console.error(...args);
  }
};

export default logger;
