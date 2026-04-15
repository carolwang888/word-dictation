import { useState, useEffect, useRef, useCallback } from 'react';

export function useTTS() {
  const abortRef = useRef(false);
  const speakingRef = useRef(false);
  const [availableVoices, setAvailableVoices] = useState([]);
  const [selectedVoice, setSelectedVoice] = useState(null);
  
  // rateRef 和 intervalRef 用于在播放过程中动态获取最新值
  const rateRef = useRef(0.8);
  const intervalRef = useRef(5000);
  
  useEffect(() => {
    const loadVoices = () => {
      let voices = window.speechSynthesis.getVoices();
      
      if (voices.length === 0) {
        setTimeout(() => {
          voices = window.speechSynthesis.getVoices();
          setAvailableVoices(voices);
        }, 100);
      } else {
        setAvailableVoices(voices);
      }
      
      const savedVoiceName = localStorage.getItem('selected-voice');
      let voiceToUse = null;
      
      if (savedVoiceName) {
        voiceToUse = voices.find(v => v.name === savedVoiceName);
      }
      
      if (!voiceToUse) {
        voiceToUse = voices.find(v => 
          !v.localService && v.lang.startsWith('en-GB')
        ) || voices.find(v => 
          !v.localService && v.lang.startsWith('en')
        );
        
        if (!voiceToUse) {
          voiceToUse = voices.find(v => v.lang.startsWith('en-GB')) 
            || voices.find(v => v.lang.startsWith('en'))
            || voices[0];
        }
      }
      
      setSelectedVoice(voiceToUse);
    };
    
    loadVoices();
    window.speechSynthesis.onvoiceschanged = loadVoices;
    
    return () => {
      window.speechSynthesis.onvoiceschanged = null;
    };
  }, []);
  
  const speakWord = useCallback((text, rate = 1.0) => {
    return new Promise((resolve) => {
      if (abortRef.current) {
        resolve();
        return;
      }
      
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = 'en-GB';
      utterance.rate = rate;
      utterance.pitch = 1.0;
      utterance.volume = 1.0;
      
      if (selectedVoice) {
        utterance.voice = selectedVoice;
        utterance.lang = selectedVoice.lang;
      }
      
      const isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);
      if (isSafari && !selectedVoice) {
        const voices = window.speechSynthesis.getVoices();
        const siriVoice = voices.find(v => 
          v.name.toLowerCase().includes('siri') || 
          v.name.toLowerCase().includes('daniel') ||
          v.name.toLowerCase().includes('karen')
        );
        if (siriVoice) {
          utterance.voice = siriVoice;
          utterance.lang = siriVoice.lang;
        }
      }
      
      utterance.onend = () => resolve();
      utterance.onerror = () => resolve();
      
      speakingRef.current = true;
      window.speechSynthesis.speak(utterance);
    });
  }, [selectedVoice]);
  
  const speakWordTwice = useCallback(async (text, rate = 1.0, gap = 300) => {
    await speakWord(text, rate);
    if (abortRef.current) return;
    await new Promise(r => setTimeout(r, gap));
    if (abortRef.current) return;
    await speakWord(text, rate);
  }, [speakWord]);
  
  // 更新播放参数（在播放中也立即生效，因为 playDictation 每次循环都从 ref 读取）
  const updatePlaybackParams = useCallback((rate, interval) => {
    rateRef.current = rate;
    intervalRef.current = interval;
  }, []);
  
  const playDictation = useCallback(async (words, rate, interval, onWordChange) => {
    // 重置 abort 标志
    abortRef.current = false;
    // 初始化 ref 值
    rateRef.current = rate;
    intervalRef.current = interval;
    
    for (let i = 0; i < words.length; i++) {
      if (abortRef.current) break;
      
      onWordChange?.(i);
      // 每次播放时从 rateRef 读取最新速度（支持播放中调整）
      await speakWord(words[i].word, rateRef.current);
      
      if (i < words.length - 1 && !abortRef.current) {
        // 分段等待，每100ms检查一次 abort 和最新间隔
        const startTime = Date.now();
        while (!abortRef.current) {
          const elapsed = Date.now() - startTime;
          if (elapsed >= intervalRef.current) break;
          await new Promise(r => setTimeout(r, 100));
        }
      }
    }
    
    speakingRef.current = false;
  }, [speakWord]);
  
  const stop = useCallback(() => {
    abortRef.current = true;
    window.speechSynthesis.cancel();
    speakingRef.current = false;
  }, []);
  
  const isSpeaking = useCallback(() => {
    return speakingRef.current;
  }, []);
  
  return { 
    speakWord, 
    speakWordTwice, 
    playDictation, 
    stop, 
    isSpeaking, 
    abortRef,
    availableVoices,
    selectedVoice,
    setSelectedVoice,
    updatePlaybackParams
  };
}
