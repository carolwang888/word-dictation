import { useParams, Link } from 'react-router-dom';
import { useWords } from '../context/WordsContext';
import { BookOpen, PenTool, ArrowLeft, Minus, Plus } from 'lucide-react';

export default function GroupDetail() {
  const { id } = useParams();
  const { getGroup, setErrorCount, initialized } = useWords();
  
  if (!initialized) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-coral-200 border-t-coral-500"></div>
      </div>
    );
  }
  
  const group = getGroup(id);
  
  if (!group) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">词组未找到</p>
        <Link to="/" className="text-coral-500 hover:underline mt-2 inline-block">
          返回首页
        </Link>
      </div>
    );
  }
  
  const errorCount = group.words.filter(w => w.errorCount > 0).length;
  
  return (
    <div className="space-y-6">
      {/* Back */}
      <Link 
        to="/" 
        className="inline-flex items-center gap-2 text-gray-500 hover:text-coral-500 transition-colors"
      >
        <ArrowLeft size={20} />
        <span>返回</span>
      </Link>
      
      {/* Header */}
      <div className="bg-white rounded-2xl shadow-lg p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="font-handwritten text-3xl text-coral-600">{group.name}</h1>
            <p className="text-gray-500 mt-1">
              Chapter {group.chapter} · Section {group.section}
            </p>
          </div>
          <div className="text-right">
            <p className="font-handwritten text-4xl text-pink-500">{group.words.length}</p>
            <p className="text-sm text-gray-400">单词</p>
          </div>
        </div>
        
        {errorCount > 0 && (
          <div className="bg-red-50 rounded-xl p-3 flex items-center gap-2">
            <span className="text-red-400">⚠️</span>
            <span className="text-red-600 text-sm">
              有 {errorCount} 个单词曾出错
            </span>
          </div>
        )}
      </div>
      
      {/* Action Buttons */}
      <div className="grid grid-cols-2 gap-4">
        <Link
          to={`/study/${id}`}
          className="bg-gradient-to-br from-pink-400 to-pink-500 text-white rounded-2xl p-6 flex flex-col items-center gap-3 shadow-lg hover:shadow-xl transition-all card-hover"
        >
          <BookOpen size={48} />
          <div className="text-center">
            <p className="font-medium text-lg">学习模式</p>
            <p className="text-sm text-pink-100"> flashcards</p>
          </div>
        </Link>
        
        <Link
          to={`/dictation/${id}`}
          className="bg-gradient-to-br from-coral-400 to-coral-500 text-white rounded-2xl p-6 flex flex-col items-center gap-3 shadow-lg hover:shadow-xl transition-all card-hover"
        >
          <PenTool size={48} />
          <div className="text-center">
            <p className="font-medium text-lg">听写模式</p>
            <p className="text-sm text-coral-100"> dictation</p>
          </div>
        </Link>
      </div>
      
      {/* Word Preview */}
      <div className="bg-white rounded-2xl shadow-lg p-4">
        <h2 className="font-medium text-gray-700 mb-3">单词预览</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-64 overflow-y-auto">
          {group.words.slice(0, 20).map(word => (
            <div key={word.id} className="flex items-center gap-2 p-2 bg-gray-50 rounded-lg">
              <div className="flex-1 min-w-0">
                <span className="font-medium text-gray-800">{word.word}</span>
                {word.phonetic && (
                  <span className="text-xs text-gray-400 phonetic ml-1">[{word.phonetic}]</span>
                )}
                {word.meaning && (
                  <span className="text-xs text-gray-500 ml-1">{word.meaning}</span>
                )}
              </div>
              {word.errorCount > 0 ? (
                <div className="flex items-center gap-1 flex-shrink-0">
                  <button
                    onClick={() => setErrorCount(word.id, word.errorCount - 1)}
                    className="w-5 h-5 flex items-center justify-center rounded-full bg-gray-200 hover:bg-red-100 hover:text-red-500 transition-colors text-gray-500"
                  >
                    <Minus size={10} />
                  </button>
                  <span className="text-xs bg-red-100 text-red-600 px-1.5 py-0.5 rounded-full min-w-[24px] text-center">
                    {word.errorCount}
                  </span>
                  <button
                    onClick={() => setErrorCount(word.id, word.errorCount + 1)}
                    className="w-5 h-5 flex items-center justify-center rounded-full bg-gray-200 hover:bg-coral-100 hover:text-coral-500 transition-colors text-gray-500"
                  >
                    <Plus size={10} />
                  </button>
                </div>
              ) : null}
            </div>
          ))}
        </div>
        {group.words.length > 20 && (
          <p className="text-center text-gray-400 text-sm mt-2">
            还有 {group.words.length - 20} 个单词...
          </p>
        )}
      </div>
    </div>
  );
}
