import { useState, useEffect, useRef, useCallback } from 'react';
import { useSearchParams, Link, useNavigate } from 'react-router-dom';
import { useWords } from '../context/WordsContext';
import { useTTS } from '../hooks/useTTS';
import { ArrowLeft, Play, Pause, Square, RotateCcw, Check, AlertCircle, Save, Clock, ChevronLeft, ChevronRight } from 'lucide-react';

const STORAGE_KEY = 'error-dictation-progress';

function normalizeForCompare(str) {
  return str.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
}

export default function ErrorDictationPage() {
  const [searchParams] = useSearchParams();
  const { incrementErrorCount, initialized, chapters } = useWords();
  const { playDictation, stop } = useTTS();
  const navigate = useNavigate();
  
  const [phase, setPhase] = useState('setup');
  const [speedMode, setSpeedMode] = useState('normal');
  const [currentWordIndex, setCurrentWordIndex] = useState(-1);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [answers, setAnswers] = useState({});
  const [results, setResults] = useState([]);
  const [errorWords, setErrorWords] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [hasSavedProgress, setHasSavedProgress] = useState(false);
  const [savedProgressInfo, setSavedProgressInfo] = useState(null);
  const [decodeError, setDecodeError] = useState(false);
  
  const inputRefs = useRef({});
  const playPromiseRef = useRef(null);
  const abortRef = useRef(false);
  
  // 用于跟踪 localStorage 读取状态的 ref，防止 StrictMode 下 useEffect 执行两次导致数据丢失
  const loadAttemptRef = useRef(false);
  // 缓存从 localStorage 读取的原始数据，防止 StrictMode 第二次执行时数据已被删除
  const cachedStorageRef = useRef(null);
  // 记录上一次加载时的 t 参数，用于检测是否需要重新加载（第二轮听写）
  const lastTRef = useRef(null);

  const rate = speedMode === 'normal' ? 0.8 : 1.28;
  const interval = speedMode === 'normal' ? 5000 : 2000;

  // 当 URL 的 t 参数变化时（第二轮听写），重置所有状态以重新加载数据
  const currentT = searchParams.get('t');
  useEffect(() => {
    if (lastTRef.current !== null && lastTRef.current !== currentT) {
      // t 参数变化，说明是新一轮听写，重置所有状态
      loadAttemptRef.current = false;
      cachedStorageRef.current = null;
      setLoaded(false);
      setDecodeError(false);
      setErrorWords([]);
      setPhase('setup');
      setAnswers({});
      setResults([]);
      setCurrentWordIndex(-1);
    }
    lastTRef.current = currentT;
  }, [currentT]);

  useEffect(() => {
    // 等 chapters 加载完成后再解析 word ID
    if (chapters.length === 0) return;
    // loaded 已完成则跳过（防止 chapters 变化触发重复执行）
    if (loaded) return;
    // 防止重复执行（React StrictMode 会执行两次）
    if (loadAttemptRef.current) return;
    loadAttemptRef.current = true;

    // 优先使用缓存的数据（StrictMode 第二次执行时 localStorage 已被清除）
    let storedWords = cachedStorageRef.current?.words || localStorage.getItem('error-dictation-words');
    let storedTime = cachedStorageRef.current?.time || localStorage.getItem('error-dictation-words-time');

    // 第一次读取时缓存数据
    if (!cachedStorageRef.current && storedWords) {
      cachedStorageRef.current = { words: storedWords, time: storedTime };
    }

    if (storedWords) {
      const isRecent = storedTime && (Date.now() - parseInt(storedTime)) < 5 * 60 * 1000;
      if (isRecent) {
        try {
          const decoded = JSON.parse(storedWords);
          if (Array.isArray(decoded) && decoded.length > 0) {
            // 向下兼容：可能是 word 对象数组（旧格式）或 word ID 数组（新格式）
            if (typeof decoded[0] === 'string') {
              // 新格式：word ID 数组，从 chapters 查实时 errorCount
              const allWords = [];
              chapters.forEach(ch => ch.groups.forEach(g => allWords.push(...g.words)));
              const resolved = decoded
                .map(id => allWords.find(w => w.id === id))
                .filter(Boolean);
              setErrorWords(resolved);
            } else {
              // 旧格式：直接使用对象
              setErrorWords(decoded);
            }
            setDecodeError(false);
            setLoaded(true);
            localStorage.removeItem('error-dictation-words');
            localStorage.removeItem('error-dictation-words-time');
            return;
          }
        } catch (e) {
          console.error('Parse error:', e);
        }
      }
    }

    localStorage.removeItem('error-dictation-words');
    localStorage.removeItem('error-dictation-words-time');
    setDecodeError(true);
    setLoaded(true);
  }, [chapters, loaded]); // chapters 加载完成且 loaded 为 false 时才执行

  // 保存进度
  const saveProgress = useCallback(() => {
    if (errorWords.length === 0) return;
    const data = {
      words: errorWords.map(w => w.id),
      answers,
      currentWordIndex,
      speedMode,
      completedCount: Object.keys(answers).length,
      savedAt: new Date().toISOString()
    };
    localStorage.setItem(`${STORAGE_KEY}-custom`, JSON.stringify(data));
    setSavedProgressInfo({
      completed: Object.keys(answers).length,
      total: errorWords.length,
      date: data.savedAt
    });
  }, [errorWords, answers, currentWordIndex, speedMode]);

  // 加载进度
  const loadProgress = useCallback(() => {
    const saved = localStorage.getItem(`${STORAGE_KEY}-custom`);
    if (saved) {
      try {
        const data = JSON.parse(saved);
        setAnswers(data.answers || {});
        setCurrentWordIndex(data.currentWordIndex || 0);
        setSpeedMode(data.speedMode || 'normal');
        return data;
      } catch (e) {
        return null;
      }
    }
    return null;
  }, []);

  // 清除保存的进度
  const clearProgress = useCallback(() => {
    localStorage.removeItem(`${STORAGE_KEY}-custom`);
    setHasSavedProgress(false);
    setSavedProgressInfo(null);
  }, []);

  const startDictation = useCallback((fromIndex = 0, existingAnswers = {}) => {
    setPhase('playing');
    setCurrentWordIndex(fromIndex);
    setIsPlaying(true);
    setIsPaused(false);
    setAnswers(existingAnswers);
    
    playPromiseRef.current = playDictation(
      errorWords.slice(fromIndex),
      rate,
      interval,
      (idx) => {
        const actualIdx = idx + fromIndex;
        setCurrentWordIndex(actualIdx);
        inputRefs.current[actualIdx]?.focus();
      }
    );
    
    playPromiseRef.current.then(() => {
      setIsPlaying(false);
    });
  }, [errorWords, rate, interval, playDictation]);

  const handleStart = useCallback(() => {
    clearProgress();
    startDictation(0, {});
  }, [clearProgress, startDictation]);

  const handleResume = useCallback(() => {
    const data = loadProgress();
    if (data) {
      startDictation(data.currentWordIndex, data.answers);
    }
  }, [loadProgress, startDictation]);

  const handlePause = useCallback(() => {
    window.speechSynthesis.pause();
    if (playPromiseRef.current) {
      playPromiseRef.current.cancel?.();
    }
    setIsPaused(true);
    setIsPlaying(false);
  }, []);

  const handleContinue = useCallback(() => {
    window.speechSynthesis.resume();
    setIsPaused(false);
    setIsPlaying(true);
    
    playPromiseRef.current = playDictation(
      errorWords.slice(currentWordIndex),
      rate,
      interval,
      (idx) => {
        const actualIdx = idx + currentWordIndex;
        setCurrentWordIndex(actualIdx);
        inputRefs.current[actualIdx]?.focus();
      }
    );
    
    playPromiseRef.current.then(() => {
      setIsPlaying(false);
    });
  }, [errorWords, currentWordIndex, rate, interval, playDictation]);

  const handleStop = useCallback(() => {
    stop();
    setIsPlaying(false);
    setIsPaused(false);
    setPhase('setup');
  }, [stop]);

  const handleSubmit = useCallback(() => {
    if (isPlaying) {
      stop();
      setIsPlaying(false);
    }
    
    const newResults = errorWords.map((word, idx) => {
      const userAnswer = answers[idx] || '';
      const isCorrect = normalizeForCompare(userAnswer) === normalizeForCompare(word.word);
      const isEmpty = !userAnswer.trim();
      
      if (!isCorrect) {
        incrementErrorCount(word.id);
      }
      
      return {
        word,
        userAnswer,
        isCorrect,
        isEmpty
      };
    });
    
    setResults(newResults);
    setPhase('result');
    clearProgress();
  }, [errorWords, answers, isPlaying, stop, incrementErrorCount, clearProgress]);

  const handlePlayAgain = useCallback(() => {
    clearProgress();
    setAnswers({});
    setResults([]);
    setCurrentWordIndex(-1);
    setPhase('setup');
  }, [clearProgress]);

  const handleDictateErrors = useCallback(() => {
    const wrongWordIds = results.filter(r => !r.isCorrect).map(r => r.word.id);
    if (wrongWordIds.length === 0) return;
    // 只存 word IDs，保证 errorCount 与 chapters 同步
    localStorage.setItem('error-dictation-words', JSON.stringify(wrongWordIds));
    localStorage.setItem('error-dictation-words-time', Date.now().toString());
    navigate(`/dictation-error?t=${Date.now()}`);
  }, [results, navigate]);

  useEffect(() => {
    return () => {
      stop();
    };
  }, [stop]);

  useEffect(() => {
    const handleBeforeUnload = () => {
      stop();
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [stop]);

  if (!loaded) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-coral-200 border-t-coral-500"></div>
      </div>
    );
  }

  const correctCount = results.filter(r => r.isCorrect).length;
  const wrongCount = results.filter(r => !r.isCorrect && !r.isEmpty).length;
  const emptyCount = results.filter(r => r.isEmpty).length;

  return (
    <div className="space-y-4">
      {/* Back */}
      <Link 
        to="/error-words"
        className="inline-flex items-center gap-2 text-gray-500 hover:text-coral-500 transition-colors"
      >
        <ArrowLeft size={20} />
        <span>返回错题本</span>
      </Link>
      
      {/* Decode Error */}
      {decodeError && (
        <div className="bg-red-50 rounded-2xl shadow-lg p-6 text-center">
          <div className="text-5xl mb-4">⚠️</div>
          <h2 className="font-handwritten text-2xl text-red-600 mb-4">无法加载错词数据</h2>
          <p className="text-gray-500 mb-6">
            请从听写结果页面或错题本重新进入
          </p>
          <div className="flex gap-3 justify-center">
            <button
              onClick={() => window.history.back()}
              className="btn-secondary"
            >
              返回上一页
            </button>
            <Link
              to="/"
              className="btn-primary inline-block"
            >
              返回首页
            </Link>
          </div>
        </div>
      )}
      
      {/* Setup Phase */}
      {!decodeError && phase === 'setup' && (
        <div className="space-y-6">
          <div className="bg-gradient-to-br from-coral-50 to-pink-50 rounded-2xl shadow-lg p-6 text-center">
            <div className="text-5xl mb-4">📝</div>
            <h1 className="font-handwritten text-3xl text-coral-600 mb-2">错词听写</h1>
            <p className="text-gray-500 mb-6">
              共 {errorWords.length} 个易错单词待复习
            </p>
            
            {/* Saved Progress Alert */}
            {hasSavedProgress && savedProgressInfo && (
              <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4 mb-6">
                <div className="flex items-center justify-center gap-2 text-yellow-700 mb-2">
                  <Clock size={18} />
                  <span className="font-medium">发现未完成的听写</span>
                </div>
                <p className="text-sm text-yellow-600 mb-3">
                  已完成 {savedProgressInfo.completed}/{savedProgressInfo.total} 个单词
                </p>
                <div className="flex gap-3 justify-center">
                  <button
                    onClick={handleResume}
                    className="px-4 py-2 bg-yellow-500 text-white rounded-lg hover:bg-yellow-600 transition-colors"
                  >
                    继续听写
                  </button>
                  <button
                    onClick={clearProgress}
                    className="px-4 py-2 bg-gray-200 text-gray-600 rounded-lg hover:bg-gray-300 transition-colors"
                  >
                    重新开始
                  </button>
                </div>
              </div>
            )}
            
            {/* Error Stats */}
            {errorWords.length > 0 && (
              <div className="bg-white/60 rounded-xl p-4 mb-6">
                <p className="text-sm text-gray-500 mb-2">错误次数分布</p>
                <div className="flex justify-center gap-4 text-sm">
                  <span className="text-red-500">
                    最高: {Math.max(...errorWords.map(w => w.errorCount))} 次
                  </span>
                  <span className="text-coral-500">
                    平均: {(errorWords.reduce((a, w) => a + w.errorCount, 0) / errorWords.length).toFixed(1)} 次
                  </span>
                </div>
              </div>
            )}
            
            {/* Speed Mode */}
            <div className="mb-6">
              <p className="text-sm text-gray-500 mb-3">选择速度</p>
              <div className="flex gap-3 justify-center">
                <button
                  onClick={() => setSpeedMode('normal')}
                  className={`px-6 py-3 rounded-xl transition-all ${
                    speedMode === 'normal'
                      ? 'bg-coral-500 text-white shadow-lg'
                      : 'bg-white text-gray-600 hover:bg-gray-100'
                  }`}
                >
                  <p className="font-medium">1倍速</p>
                  <p className="text-xs opacity-75">5秒间隔</p>
                </button>
                
                <button
                  onClick={() => setSpeedMode('fast')}
                  className={`px-6 py-3 rounded-xl transition-all ${
                    speedMode === 'fast'
                      ? 'bg-coral-500 text-white shadow-lg'
                      : 'bg-white text-gray-600 hover:bg-gray-100'
                  }`}
                >
                  <p className="font-medium">1.6倍速</p>
                  <p className="text-xs opacity-75">2秒间隔</p>
                </button>
              </div>
            </div>
            
            {!hasSavedProgress && (
              <button onClick={handleStart} className="btn-primary text-lg px-12">
                <Play className="inline mr-2" size={20} />
                开始听写
              </button>
            )}
          </div>
          
          {/* Word Preview */}
          {errorWords.length > 0 && (
            <div className="bg-white rounded-2xl shadow-lg p-4">
              <h2 className="font-medium text-gray-700 mb-3">待听写单词预览</h2>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-48 overflow-y-auto">
                {errorWords.map((word, idx) => (
                  <div key={idx} className="flex items-center gap-2 p-2 bg-red-50 rounded-lg">
                    <span className="font-handwritten text-lg text-gray-400">#{idx + 1}</span>
                    <div className="flex-1 min-w-0">
                      <span className="font-medium text-gray-800 text-sm truncate block">{word.word}</span>
                    </div>
                    <span className="text-xs bg-red-100 text-red-600 px-1.5 py-0.5 rounded-full">
                      {word.errorCount}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
      
      {/* Playing Phase */}
      {!decodeError && phase === 'playing' && (
        <div className="space-y-4">
          {/* Progress with Controls */}
          <div className="bg-white rounded-2xl shadow-lg p-4">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    stop();
                    setCurrentWordIndex(prev => Math.max(0, prev - 1));
                    setIsPlaying(false);
                    setIsPaused(true);
                  }}
                  disabled={currentWordIndex === 0}
                  className="p-2 text-gray-500 hover:text-coral-500 disabled:opacity-30 disabled:cursor-not-allowed bg-gray-100 rounded-lg"
                >
                  <ChevronLeft size={20} />
                </button>
                <button
                  onClick={() => {
                    stop();
                    setCurrentWordIndex(prev => Math.min(errorWords.length - 1, prev + 1));
                    setIsPlaying(false);
                    setIsPaused(true);
                  }}
                  disabled={currentWordIndex === errorWords.length - 1}
                  className="p-2 text-gray-500 hover:text-coral-500 disabled:opacity-30 disabled:cursor-not-allowed bg-gray-100 rounded-lg"
                >
                  <ChevronRight size={20} />
                </button>
              </div>
              <span className="text-sm text-gray-500">
                {currentWordIndex + 1} / {errorWords.length}
              </span>
              {isPaused ? (
                <button
                  onClick={handleContinue}
                  className="flex items-center gap-1 px-3 py-1 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors text-sm"
                >
                  <Play size={16} />
                  继续
                </button>
              ) : (
                <button
                  onClick={handlePause}
                  className="flex items-center gap-1 px-3 py-1 bg-coral-500 text-white rounded-lg hover:bg-coral-600 transition-colors text-sm"
                >
                  <Pause size={16} />
                  暂停
                </button>
              )}
            </div>
            <div className="bg-gray-100 rounded-full h-2 overflow-hidden">
              <div 
                className="h-full bg-gradient-to-r from-coral-400 to-pink-400 transition-all duration-300"
                style={{ width: `${((currentWordIndex + 1) / errorWords.length) * 100}%` }}
              />
            </div>
            {isPaused && (
              <p className="text-center text-sm text-yellow-600 mt-2">
                已暂停 · 点击继续从当前单词播放
              </p>
            )}
          </div>
          
          {/* Input Fields */}
          <div className="bg-white rounded-2xl shadow-lg p-4">
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {errorWords.map((word, idx) => (
                <div
                  key={idx}
                  className={`relative rounded-xl p-3 transition-all ${
                    idx === currentWordIndex
                      ? 'bg-coral-50 ring-2 ring-coral-400'
                      : answers[idx]
                      ? 'bg-green-50'
                      : 'bg-gray-50'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <p className="font-handwritten text-xl text-gray-400">
                      #{idx + 1}
                    </p>
                    <span className="text-xs bg-red-100 text-red-500 px-1.5 rounded">
                      {word.errorCount}错
                    </span>
                  </div>
                  <input
                    ref={el => inputRefs.current[idx] = el}
                    type="text"
                    defaultValue={answers[idx] || ''}
                    onChange={(e) => setAnswers(prev => ({ ...prev, [idx]: e.target.value }))}
                    className="w-full bg-transparent border-none outline-none text-center font-medium text-gray-800"
                    placeholder="..."
                    autoComplete="off"
                    autoCorrect="off"
                    autoCapitalize="off"
                    spellCheck="false"
                  />
                </div>
              ))}
            </div>
          </div>
          
          {/* Controls */}
          <div className="flex gap-3">
            <button
              onClick={handleStop}
              className="flex-1 btn-secondary flex items-center justify-center gap-2"
            >
              <Square size={20} />
              退出
            </button>
            
            <button
              onClick={handleSubmit}
              className="flex-1 btn-primary flex items-center justify-center gap-2"
            >
              <Check size={20} />
              提交答案
            </button>
          </div>
          
          {/* Save Progress */}
          <div className="flex justify-center">
            <button
              onClick={saveProgress}
              className="inline-flex items-center gap-2 text-gray-500 hover:text-coral-500 transition-colors"
            >
              <Save size={16} />
              <span className="text-sm">保存进度</span>
            </button>
          </div>
        </div>
      )}
      
      {/* Result Phase */}
      {!decodeError && phase === 'result' && (
        <div className="space-y-4">
          {/* Stats */}
          <div className="bg-gradient-to-br from-coral-50 to-pink-50 rounded-2xl shadow-lg p-6">
            <h2 className="font-handwritten text-2xl text-coral-600 text-center mb-4">答题结果</h2>
            
            <div className="grid grid-cols-3 gap-4 text-center mb-6">
              <div className="bg-green-50 rounded-xl p-3">
                <p className="font-handwritten text-3xl text-green-500">{correctCount}</p>
                <p className="text-xs text-green-600">正确</p>
              </div>
              <div className="bg-red-50 rounded-xl p-3">
                <p className="font-handwritten text-3xl text-red-500">{wrongCount}</p>
                <p className="text-xs text-red-600">错误</p>
              </div>
              <div className="bg-gray-50 rounded-xl p-3">
                <p className="font-handwritten text-3xl text-gray-500">{emptyCount}</p>
                <p className="text-xs text-gray-600">未答</p>
              </div>
            </div>
            
            <div className="text-center">
              <p className="text-lg text-gray-600">
                正确率: <span className="font-handwritten text-2xl text-coral-500">
                  {Math.round((correctCount / errorWords.length) * 100)}%
                </span>
              </p>
            </div>
          </div>
          
          {/* Results List - Two Columns */}
          <div className="grid grid-cols-2 gap-4">
            {/* Correct Words */}
            <div className="bg-green-50 rounded-2xl shadow-lg p-4">
              <h3 className="font-medium text-green-600 mb-3 flex items-center gap-2">
                <Check size={18} />
                正确 ({correctCount})
              </h3>
              <div className="space-y-2 max-h-80 overflow-y-auto">
                {results.filter(r => r.isCorrect).map((result, idx) => (
                  <div key={idx} className="bg-white rounded-lg p-2">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-gray-800">{result.word.word}</span>
                      {result.word.phonetic && (
                        <span className="text-xs text-gray-400 phonetic">[{result.word.phonetic}]</span>
                      )}
                    </div>
                    <p className="text-xs text-gray-500">{result.word.meaning}</p>
                  </div>
                ))}
                {correctCount === 0 && (
                  <p className="text-sm text-gray-400 text-center py-4">无</p>
                )}
              </div>
            </div>
            
            {/* Wrong Words */}
            <div className="bg-red-50 rounded-2xl shadow-lg p-4">
              <h3 className="font-medium text-red-600 mb-3 flex items-center gap-2">
                <AlertCircle size={18} />
                错误 ({wrongCount + emptyCount})
              </h3>
              <div className="space-y-2 max-h-80 overflow-y-auto">
                {results.filter(r => !r.isCorrect).map((result, idx) => (
                  <div key={idx} className="bg-white rounded-lg p-2">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-gray-800">{result.word.word}</span>
                      {result.word.phonetic && (
                        <span className="text-xs text-gray-400 phonetic">[{result.word.phonetic}]</span>
                      )}
                    </div>
                    <p className="text-xs text-gray-500">{result.word.meaning}</p>
                    {!result.isCorrect && !result.isEmpty && (
                      <p className="text-xs text-red-500">
                        你的答案: {result.userAnswer}
                      </p>
                    )}
                    {result.isEmpty && (
                      <p className="text-xs text-gray-400 italic">未作答</p>
                    )}
                  </div>
                ))}
                {wrongCount + emptyCount === 0 && (
                  <p className="text-sm text-gray-400 text-center py-4">无</p>
                )}
              </div>
            </div>
          </div>
          
          {/* Actions */}
          <div className="flex gap-3">
            <button
              onClick={handlePlayAgain}
              className="flex-1 btn-secondary flex items-center justify-center gap-2"
            >
              <RotateCcw size={20} />
              重新听写
            </button>
            
            {wrongCount + emptyCount > 0 && (
              <button
                onClick={handleDictateErrors}
                className="flex-1 flex items-center justify-center gap-2 bg-gradient-to-r from-red-500 to-pink-500 text-white rounded-xl py-3 hover:shadow-lg transition-all"
              >
                <AlertCircle size={20} />
                听写错词 ({wrongCount + emptyCount})
              </button>
            )}
            
            <Link
              to="/error-words"
              className="flex-1 btn-primary text-center"
            >
              返回错题本
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
