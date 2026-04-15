import { useState, useEffect, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useWords } from '../context/WordsContext';
import { ArrowLeft, RotateCcw, Check } from 'lucide-react';

export default function StudyPage() {
  const { id } = useParams();
  const { getGroup, initialized } = useWords();
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  
  const group = initialized ? getGroup(id) : null;
  
  const totalCards = group?.words.length || 0;
  
  const goNext = useCallback(() => {
    setIsFlipped(false);
    setTimeout(() => {
      setCurrentIndex(prev => (prev + 1) % totalCards);
    }, 150);
  }, [totalCards]);
  
  const goPrev = useCallback(() => {
    setIsFlipped(false);
    setTimeout(() => {
      setCurrentIndex(prev => (prev - 1 + totalCards) % totalCards);
    }, 150);
  }, [totalCards]);
  
  const shuffle = useCallback(() => {
    setIsFlipped(false);
    setCurrentIndex(Math.floor(Math.random() * totalCards));
  }, [totalCards]);
  
  useEffect(() => {
    const handleKey = (e) => {
      if (e.key === ' ' || e.key === 'Enter') {
        e.preventDefault();
        setIsFlipped(prev => !prev);
      } else if (e.key === 'ArrowRight') {
        goNext();
      } else if (e.key === 'ArrowLeft') {
        goPrev();
      }
    };
    
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [goNext, goPrev]);
  
  if (!initialized || !group) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-coral-200 border-t-coral-500"></div>
      </div>
    );
  }
  
  const currentWord = group.words[currentIndex];
  
  return (
    <div className="space-y-6">
      {/* Back */}
      <Link 
        to={`/group/${id}`}
        className="inline-flex items-center gap-2 text-gray-500 hover:text-coral-500 transition-colors"
      >
        <ArrowLeft size={20} />
        <span>返回</span>
      </Link>
      
      {/* Header */}
      <div className="text-center">
        <h1 className="font-handwritten text-2xl text-coral-600 mb-2">学习模式</h1>
        <p className="text-gray-500">
          {currentIndex + 1} / {totalCards}
        </p>
      </div>
      
      {/* Progress */}
      <div className="bg-white rounded-full h-2 overflow-hidden">
        <div 
          className="h-full bg-gradient-to-r from-pink-400 to-coral-400 transition-all duration-300"
          style={{ width: `${((currentIndex + 1) / totalCards) * 100}%` }}
        />
      </div>
      
      {/* Flashcard */}
      <div 
        className="flip-card h-80 cursor-pointer mx-auto w-full max-w-md"
        onClick={() => setIsFlipped(!isFlipped)}
      >
        <div className={`flip-card-inner w-full h-full ${isFlipped ? 'flipped' : ''}`}>
          {/* Front */}
          <div className="flip-card-front absolute w-full h-80 bg-gradient-to-br from-white to-pink-50 rounded-3xl shadow-xl flex flex-col items-center justify-center p-6 border-2 border-pink-100">
            <p className="text-3xl font-bold text-gray-800 mb-2">{currentWord.word}</p>
            {currentWord.phonetic && (
              <p className="text-lg text-gray-400 phonetic">[{currentWord.phonetic}]</p>
            )}
            <p className="text-sm text-pink-400 mt-4">点击翻转</p>
          </div>
          
          {/* Back */}
          <div className="flip-card-back absolute w-full h-80 bg-gradient-to-br from-coral-50 to-white rounded-3xl shadow-xl flex flex-col items-center justify-center p-6 border-2 border-coral-100">
            <p className="text-2xl text-coral-600 text-center">{currentWord.meaning}</p>
          </div>
        </div>
      </div>
      
      {/* Controls */}
      <div className="flex items-center justify-center gap-4">
        <button
          onClick={goPrev}
          className="btn-secondary"
        >
          上一个
        </button>
        
        <button
          onClick={() => setIsFlipped(!isFlipped)}
          className="btn-primary px-8"
        >
          翻转
        </button>
        
        <button
          onClick={goNext}
          className="btn-secondary"
        >
          下一个
        </button>
      </div>
      
      {/* Shuffle */}
      <div className="text-center">
        <button
          onClick={shuffle}
          className="inline-flex items-center gap-2 text-pink-500 hover:text-pink-600"
        >
          <RotateCcw size={18} />
          <span>随机跳转</span>
        </button>
      </div>
      
      {/* Tips */}
      <div className="bg-pink-50 rounded-xl p-4 text-center">
        <p className="text-sm text-pink-600">
          💡 按空格键或点击卡片翻转 · 左右箭头切换
        </p>
      </div>
    </div>
  );
}
