// 语音识别 (ASR) 服务
export class ASRService {
  private static recognition: any = null;
  private static isSupported = typeof window !== 'undefined' && 
    ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window);

  static isAvailable(): boolean {
    return this.isSupported;
  }

  static async startRecording(
    onResult: (text: string) => void,
    onEnd: () => void,
    onError: (error: string) => void,
    language: 'zh-CN' | 'en-US' = 'zh-CN'
  ): Promise<void> {
    if (!this.isSupported) {
      onError('此浏览器不支持语音识别功能');
      return;
    }

    try {
      // 创建语音识别实例
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      this.recognition = new SpeechRecognition();
      
      // 配置识别参数
      this.recognition.continuous = false;
      this.recognition.interimResults = false;
      this.recognition.lang = language;
      this.recognition.maxAlternatives = 1;

      // 设置事件处理器
      this.recognition.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript;
        onResult(transcript);
      };

      this.recognition.onend = () => {
        onEnd();
      };

      this.recognition.onerror = (event: any) => {
        let errorMessage = '语音识别出错';
        switch (event.error) {
          case 'no-speech':
            errorMessage = '未检测到语音，请重试';
            break;
          case 'audio-capture':
            errorMessage = '无法捕获音频，请检查麦克风权限';
            break;
          case 'not-allowed':
            errorMessage = '语音识别权限被拒绝';
            break;
          case 'network':
            errorMessage = '网络错误，请检查网络连接';
            break;
          default:
            errorMessage = `语音识别错误: ${event.error}`;
        }
        onError(errorMessage);
      };

      // 开始识别
      this.recognition.start();
    } catch (error) {
      onError('启动语音识别失败');
    }
  }

  static stopRecording(): void {
    if (this.recognition) {
      this.recognition.stop();
      this.recognition = null;
    }
  }
}

// 文本转语音 (TTS) 服务
export class TTSService {
  private static synthesis = typeof window !== 'undefined' ? window.speechSynthesis : null;
  private static isSupported = typeof window !== 'undefined' && 'speechSynthesis' in window;
  private static voices: SpeechSynthesisVoice[] = [];

  static isAvailable(): boolean {
    return this.isSupported;
  }

  static async initialize(): Promise<void> {
    if (!this.isSupported || !this.synthesis) return;

    return new Promise((resolve) => {
      const loadVoices = () => {
        this.voices = this.synthesis!.getVoices();
        resolve();
      };

      if (this.voices.length > 0) {
        resolve();
      } else {
        if (this.synthesis) {
          this.synthesis.onvoiceschanged = loadVoices;
        }
        // 触发加载
        setTimeout(loadVoices, 100);
      }
    });
  }

  static getAvailableVoices(language: 'zh' | 'en' | 'both' = 'both'): SpeechSynthesisVoice[] {
    if (!this.isSupported) return [];

    return this.voices.filter(voice => {
      if (language === 'zh') {
        return voice.lang.startsWith('zh');
      } else if (language === 'en') {
        return voice.lang.startsWith('en');
      }
      return true;
    });
  }

  static speak(
    text: string,
    options: {
      voice?: SpeechSynthesisVoice;
      rate?: number;
      pitch?: number;
      volume?: number;
      language?: 'zh' | 'en';
    } = {}
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.isSupported || !this.synthesis) {
        reject(new Error('浏览器不支持语音合成'));
        return;
      }

      // 停止当前播放
      this.synthesis.cancel();

      const utterance = new SpeechSynthesisUtterance(text);
      
      // 设置语音参数
      utterance.rate = options.rate || 1;
      utterance.pitch = options.pitch || 1;
      utterance.volume = options.volume || 1;

      // 选择合适的语音
      let selectedVoice = options.voice;
      if (!selectedVoice) {
        const preferredLang = options.language || 'zh';
        const availableVoices = this.getAvailableVoices(preferredLang);
        
        if (availableVoices.length > 0) {
          // 优先选择自然音色
          selectedVoice = availableVoices.find(voice => 
            voice.name.includes('Neural') || 
            voice.name.includes('Premium') ||
            voice.name.includes('Enhanced')
          ) || availableVoices[0];
        }
      }

      if (selectedVoice) {
        utterance.voice = selectedVoice;
        utterance.lang = selectedVoice.lang;
      }

      // 设置事件处理器
      utterance.onend = () => resolve();
      utterance.onerror = (event) => reject(new Error(`TTS错误: ${event.error}`));

      // 开始播放
      this.synthesis.speak(utterance);
    });
  }

  static stop(): void {
    if (this.synthesis) {
      this.synthesis.cancel();
    }
  }

  static pause(): void {
    if (this.synthesis) {
      this.synthesis.pause();
    }
  }

  static resume(): void {
    if (this.synthesis) {
      this.synthesis.resume();
    }
  }

  static isSpeaking(): boolean {
    return this.synthesis ? this.synthesis.speaking : false;
  }
}

// 角色语音配置
export const CharacterVoiceProfiles = {
  'harry-potter': {
    language: 'en' as const,
    rate: 1.0,
    pitch: 1.1,
    preferredVoices: ['Google UK English Male', 'Microsoft David', 'Alex']
  },
  'socrates': {
    language: 'en' as const,
    rate: 0.9,
    pitch: 0.9,
    preferredVoices: ['Google UK English Male', 'Microsoft George', 'Daniel']
  },
  'shakespeare': {
    language: 'en' as const,
    rate: 0.8,
    pitch: 0.95,
    preferredVoices: ['Google UK English Male', 'Microsoft George', 'Oliver']
  },
  'confucius': {
    language: 'zh' as const,
    rate: 0.9,
    pitch: 0.8,
    preferredVoices: ['Google 中文（普通话，中国大陆）', 'Microsoft Kangkang', 'Ting-Ting']
  },
  'einstein': {
    language: 'en' as const,
    rate: 1.0,
    pitch: 0.9,
    preferredVoices: ['Google US English', 'Microsoft David', 'Alex']
  }
};

// 高级语音服务类
export class AdvancedVoiceService {
  static async speakAsCharacter(
    text: string,
    characterId: string,
    customOptions?: Partial<typeof CharacterVoiceProfiles['harry-potter']>
  ): Promise<void> {
    await TTSService.initialize();
    
    const profile = CharacterVoiceProfiles[characterId as keyof typeof CharacterVoiceProfiles];
    if (!profile) {
      return TTSService.speak(text);
    }

    const options = { ...profile, ...customOptions };
    const availableVoices = TTSService.getAvailableVoices(options.language);
    
    // 尝试找到首选语音
    let selectedVoice = availableVoices.find(voice =>
      options.preferredVoices.some(preferred => voice.name.includes(preferred))
    );

    if (!selectedVoice) {
      selectedVoice = availableVoices[0];
    }

    return TTSService.speak(text, {
      voice: selectedVoice,
      rate: options.rate,
      pitch: options.pitch,
      language: options.language
    });
  }
}

// 为浏览器兼容性声明类型
declare global {
  interface Window {
    SpeechRecognition: any;
    webkitSpeechRecognition: any;
  }
}