import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useWords } from '../context/WordsContext';
import { useTTS } from '../hooks/useTTS';
import { ArrowLeft, Play, Pause, Square, RotateCcw, Check, AlertCircle, Save, Clock, ChevronLeft, ChevronRight, Settings } from 'lucide-react';

const STORAGE_KEY = 'dictation-progress';

function normalizeForCompare(str) {
  return str.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
}

export default function DictationPage() {
  const { id } = useParams();
  const { getGroup, incrementErrorCount, initialized, chapters } = useWords();
  const { playDictation, stop, updatePlaybackParams } = useTTS();
  
  const [phase, setPhase] = useState('setup'); // setup, playing, result
  const [playRate, setPlayRate] = useState(0.8);
  const [playInterval, setPlayInterval] = useState(5);
  const [currentWordIndex, setCurrentWordIndex] = useState(-1);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [answers, setAnswers] = useState({});
  const [results, setResults] = useState([]);
  const [hasSavedProgress, setHasSavedProgress] = useState(false);
  const [savedProgressInfo, setSavedProgressInfo] = useState(null);
  
  const inputRefs = useRef({});
  const navigate = useNavigate();
  // 使用 useMemo 确保 group 随 chapters 更新
  const group = useMemo(() => {
    return initialized ? getGroup(id) : null;
  }, [id, initialized, chapters]);
  const playPromiseRef = useRef(null);
  
  // 调试日志
  console.log('DictationPage render:', { id, initialized, groupFound: !!group });
  
  // 统计当前group中的错词
  const groupErrorWords = useMemo(() => {
    if (!group) return [];
    return group.words.filter(w => w.errorCount > 0);
  }, [group]);

  // 当速度/间隔改变时，实时更新 TTS 参数（在播放中也立即生效）
  useEffect(() => {
    updatePlaybackParams(playRate, playInterval * 1000);
  }, [playRate, playInterval, updatePlaybackParams]);
  
  // 检查保存的进度
  useEffect(() => {
    if (!group) return;
    const saved = localStorage.getItem(`${STORAGE_KEY}-${id}`);
    if (saved) {
      try {
        const data = JSON.parse(saved);
        if (data.groupId === id && data.words.length === group.words.length) {
          setHasSavedProgress(true);
          setSavedProgressInfo({
            completed: data.completedCount,
            total: data.words.length,
            date: data.savedAt
          });
        }
      } catch (e) {
        localStorage.removeItem(`${STORAGE_KEY}-${id}`);
      }
    }
  }, [group, id]);
  
  // 保存进度
  const saveProgress = useCallback(() => {
    if (!group) return;
    const data = {
      groupId: id,
      words: group.words.map(w => w.id),
      answers,
      currentWordIndex,
      playRate,
      playInterval,
      completedCount: Object.keys(answers).length,
      savedAt: new Date().toISOString()
    };
    localStorage.setItem(`${STORAGE_KEY}-${id}`, JSON.stringify(data));
    setSavedProgressInfo({
      completed: Object.keys(answers).length,
      total: group.words.length,
      date: data.savedAt
    });
  }, [group, id, answers, currentWordIndex, playRate, playInterval]);
  
  // 加载进度
  const loadProgress = useCallback(() => {
    const saved = localStorage.getItem(`${STORAGE_KEY}-${id}`);
    if (saved) {
      try {
        const data = JSON.parse(saved);
        setAnswers(data.answers || {});
        setCurrentWordIndex(data.currentWordIndex || 0);
        if (data.playRate) setPlayRate(data.playRate);
        if (data.playInterval) setPlayInterval(data.playInterval);
        return data;
      } catch (e) {
        return null;
      }
    }
    return null;
  }, [id]);
  
  // 清除保存的进度
  const clearProgress = useCallback(() => {
    localStorage.removeItem(`${STORAGE_KEY}-${id}`);
    setHasSavedProgress(false);
    setSavedProgressInfo(null);
  }, [id]);
  
  const startDictation = useCallback((fromIndex = 0, existingAnswers = {}) => {
    setPhase('playing');
    setCurrentWordIndex(fromIndex);
    setIsPlaying(true);
    setIsPaused(false);
    setAnswers(existingAnswers);
    
    playPromiseRef.current = playDictation(
      group.words.slice(fromIndex),
      playRate,
      playInterval * 1000,
      (idx) => {
        const actualIdx = idx + fromIndex;
        setCurrentWordIndex(actualIdx);
        // 不自动 focus，避免打断用户正在输入的光标
      }
    );
    
    playPromiseRef.current.then(() => {
      setIsPlaying(false);
    });
  }, [group, playRate, playInterval, playDictation]);
  
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
    // 停止当前播放（设置 abort 标志并取消语音）
    stop();
    setIsPaused(true);
    setIsPlaying(false);
  }, [stop]);
  
  const handleContinue = useCallback(() => {
    if (!group) return;
    setIsPaused(false);
    setIsPlaying(true);
    
    // playDictation 内部会重置 abortRef，所以可以直接调用
    playPromiseRef.current = playDictation(
      group.words.slice(currentWordIndex),
      playRate,
      playInterval * 1000,
      (idx) => {
        const actualIdx = idx + currentWordIndex;
        setCurrentWordIndex(actualIdx);
        // 不自动 focus，避免打断用户正在输入的光标
      }
    );
    
    playPromiseRef.current.then(() => {
      setIsPlaying(false);
    });
  }, [group, currentWordIndex, playRate, playInterval, playDictation]);
  
  const handleStop = useCallback(() => {
    stop();
    setIsPlaying(false);
    setIsPaused(false);
  }, [stop]);
  
  const handleSubmit = useCallback(() => {
    if (isPlaying) {
      stop();
      setIsPlaying(false);
    }
    
    console.log('handleSubmit: group has', group.words.length, 'words');
    let wrongCount = 0;
    const wrongWordIds = [];
    
    const newResults = group.words.map((word, idx) => {
      const userAnswer = answers[idx] || '';
      const isCorrect = normalizeForCompare(userAnswer) === normalizeForCompare(word.word);
      const isEmpty = !userAnswer.trim();
      
      if (!isCorrect) {
        console.log('Wrong word:', word.id, word.word, isEmpty ? '(empty)' : '');
        wrongWordIds.push(word.id);
        incrementErrorCount(word.id);
        wrongCount++;
      }
      
      return {
        word,
        userAnswer,
        isCorrect,
        isEmpty
      };
    });
    
    console.log('handleSubmit: total wrong', wrongCount, 'wordIds:', wrongWordIds);
    setResults(newResults);
    setPhase('result');
    clearProgress();
  }, [group, answers, isPlaying, stop, incrementErrorCount, clearProgress]);
  
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
    // 只存 word IDs，不存完整对象，保证 errorCount 与 chapters 同步
    localStorage.setItem('error-dictation-words', JSON.stringify(wrongWordIds));
    localStorage.setItem('error-dictation-words-time', Date.now().toString());
    navigate(`/dictation-error?t=${Date.now()}`);
  }, [results, navigate]);
  
  const handleReplay = useCallback(() => {
    if (!group) return;
    
    const currentWord = group.words[currentWordIndex];
    if (currentWord) {
      const utterance = new SpeechSynthesisUtterance(currentWord.word);
      utterance.lang = 'en-GB';
      utterance.rate = playRate;
      utterance.pitch = 1.0;
      utterance.volume = 1.0;
      
      // 使用保存的语音
      const savedVoiceName = localStorage.getItem('selected-voice');
      const voices = window.speechSynthesis.getVoices();
      const savedVoice = voices.find(v => v.name === savedVoiceName);
      if (savedVoice) {
        utterance.voice = savedVoice;
        utterance.lang = savedVoice.lang;
      }
      
      window.speechSynthesis.speak(utterance);
    }
  }, [group, currentWordIndex, playRate]);
  
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
  
  if (!initialized || !group) {
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
        to={`/group/${id}`}
        className="inline-flex items-center gap-2 text-gray-500 hover:text-coral-500 transition-colors"
      >
        <ArrowLeft size={20} />
        <span>返回</span>
      </Link>
      
      {/* Setup Phase */}
      {phase === 'setup' && (
        <div className="space-y-6">
          <div className="bg-white rounded-2xl shadow-lg p-6 text-center">
            <h1 className="font-handwritten text-3xl text-coral-600 mb-4">听写模式</h1>
            <p className="text-gray-500 mb-6">
              共 {group.words.length} 个单词
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
            
            {/* Speed & Interval Settings */}
            <div className="mb-6 bg-gray-50 rounded-xl p-4 text-left">
              <p className="text-sm font-medium text-gray-600 flex items-center gap-1 mb-3">
                <Settings size={14} />
                播报设置（可随时调整）
              </p>
              
              {/* Rate Slider */}
              <div className="mb-4">
                <div className="flex items-center justify-between mb-1">
                  <label className="text-sm text-gray-500">播报速度</label>
                  <span className="text-sm font-medium text-coral-600">{playRate.toFixed(1)}x</span>
                </div>
                <input
                  type="range"
                  min="0.5"
                  max="2.0"
                  step="0.1"
                  value={playRate}
                  onChange={(e) => setPlayRate(parseFloat(e.target.value))}
                  className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-coral-500"
                />
                <div className="flex justify-between text-xs text-gray-400 mt-1">
                  <span>0.5x 慢速</span>
                  <span>1.0x 正常</span>
                  <span>2.0x 快速</span>
                </div>
              </div>
              
              {/* Interval Slider */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-sm text-gray-500">单词间隔</label>
                  <span className="text-sm font-medium text-coral-600">{playInterval} 秒</span>
                </div>
                <input
                  type="range"
                  min="1"
                  max="15"
                  step="1"
                  value={playInterval}
                  onChange={(e) => setPlayInterval(parseInt(e.target.value))}
                  className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-coral-500"
                />
                <div className="flex justify-between text-xs text-gray-400 mt-1">
                  <span>1秒</span>
                  <span>8秒</span>
                  <span>15秒</span>
                </div>
              </div>
            </div>
            
            {!hasSavedProgress && (
              <button onClick={handleStart} className="btn-primary text-lg px-12">
                <Play className="inline mr-2" size={20} />
                开始听写
              </button>
            )}
          </div>
          
          <div className="bg-pink-50 rounded-xl p-4 text-center">
            <p className="text-sm text-pink-600">
              💡 音频会自动播放，请输入你听到的单词 · 可随时暂停并保存进度
            </p>
          </div>
        </div>
      )}
      
      {/* Playing Phase */}
      {phase === 'playing' && (
        <div className="space-y-4">
          {/* Progress with Controls */}
          <div className="bg-white rounded-2xl shadow-lg p-4">
            <div className="flex items-center justify-between mb-3">
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
                    setCurrentWordIndex(prev => Math.min(group.words.length - 1, prev + 1));
                    setIsPlaying(false);
                    setIsPaused(true);
                  }}
                  disabled={currentWordIndex === group.words.length - 1}
                  className="p-2 text-gray-500 hover:text-coral-500 disabled:opacity-30 disabled:cursor-not-allowed bg-gray-100 rounded-lg"
                >
                  <ChevronRight size={20} />
                </button>
              </div>
              <span className="text-sm text-gray-500">
                {currentWordIndex + 1} / {group.words.length}
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
            
            <div className="bg-gray-100 rounded-full h-2 overflow-hidden mb-2">
              <div 
                className="h-full bg-gradient-to-r from-coral-400 to-pink-400 transition-all duration-300"
                style={{ width: `${((currentWordIndex + 1) / group.words.length) * 100}%` }}
              />
            </div>
            
            {isPaused && (
              <p className="text-center text-sm text-yellow-600 mb-2">
                已暂停 · 点击继续从当前单词播放
              </p>
            )}
            
            {/* Inline Speed & Interval Controls */}
            <div className="pt-2 border-t border-gray-100">
              <div className="flex items-center gap-4">
                <div className="flex-1">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs text-gray-400">速度</span>
                    <span className="text-xs font-medium text-coral-500">{playRate.toFixed(1)}x</span>
                  </div>
                  <input
                    type="range"
                    min="0.5"
                    max="2.0"
                    step="0.1"
                    value={playRate}
                    onChange={(e) => setPlayRate(parseFloat(e.target.value))}
                    className="w-full h-1.5 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-coral-500"
                  />
                </div>
                <div className="flex-1">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs text-gray-400">间隔</span>
                    <span className="text-xs font-medium text-coral-500">{playInterval}s</span>
                  </div>
                  <input
                    type="range"
                    min="1"
                    max="15"
                    step="1"
                    value={playInterval}
                    onChange={(e) => setPlayInterval(parseInt(e.target.value))}
                    className="w-full h-1.5 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-coral-500"
                  />
                </div>
              </div>
            </div>
          </div>
          
          {/* Input Fields */}
          <div className="bg-white rounded-2xl shadow-lg p-4">
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {group.words.map((word, idx) => (
                <div
                  key={word.id}
                  className={`relative rounded-xl p-3 transition-all ${
                    idx === currentWordIndex
                      ? 'bg-coral-50 ring-2 ring-coral-400'
                      : answers[idx]
                      ? 'bg-green-50'
                      : 'bg-gray-50'
                  }`}
                >
                  <p className="font-handwritten text-xl text-gray-400 mb-1">
                    #{idx + 1}
                  </p>
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
      {phase === 'result' && (
        <div className="space-y-4">
          {/* Stats */}
          <div className="bg-white rounded-2xl shadow-lg p-6">
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
                  {Math.round((correctCount / group.words.length) * 100)}%
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
              to={`/group/${id}`}
              className="flex-1 btn-primary text-center"
            >
              返回词组
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
