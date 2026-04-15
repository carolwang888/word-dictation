import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useWords } from '../context/WordsContext';
import { ChevronDown, ChevronRight, BookOpen, FileText } from 'lucide-react';

export default function Home() {
  const { chapters, initialized } = useWords();
  const [expandedChapters, setExpandedChapters] = useState({});
  
  if (!initialized) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-coral-200 border-t-coral-500"></div>
      </div>
    );
  }
  
  const toggleChapter = (chapterId) => {
    setExpandedChapters(prev => ({
      ...prev,
      [chapterId]: !prev[chapterId]
    }));
  };
  
  const totalWords = chapters.reduce((acc, ch) => 
    acc + ch.groups.reduce((gacc, g) => gacc + g.words.length, 0), 0
  );
  
  return (
    <div className="space-y-4">
      {/* Stats */}
      <div className="bg-white rounded-2xl shadow-lg p-6">
        <div className="flex items-center justify-between">
          <div className="text-center">
            <p className="font-handwritten text-4xl text-coral-500">{chapters.length}</p>
            <p className="text-sm text-gray-500">章节</p>
          </div>
          <div className="text-center">
            <p className="font-handwritten text-4xl text-pink-500">
              {chapters.reduce((acc, ch) => acc + ch.groups.length, 0)}
            </p>
            <p className="text-sm text-gray-500">词组</p>
          </div>
          <div className="text-center">
            <p className="font-handwritten text-4xl text-coral-600">{totalWords}</p>
            <p className="text-sm text-gray-500">单词</p>
          </div>
        </div>
      </div>
      
      {/* Chapter List */}
      <div className="space-y-3">
        {chapters.map(chapter => (
          <div key={chapter.id} className="bg-white rounded-2xl shadow-lg overflow-hidden">
            <button
              onClick={() => toggleChapter(chapter.id)}
              className="w-full flex items-center justify-between p-4 hover:bg-coral-50 transition-colors"
            >
              <div className="flex items-center gap-3">
                <BookOpen className="text-coral-500" size={24} />
                <div className="text-left">
                  <h3 className="font-medium text-gray-800">{chapter.title}</h3>
                  <p className="text-sm text-gray-500">{chapter.subtitle}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-sm text-gray-400">
                  {chapter.groups.length} 个词组
                </span>
                {expandedChapters[chapter.id] 
                  ? <ChevronDown className="text-gray-400" />
                  : <ChevronRight className="text-gray-400" />
                }
              </div>
            </button>
            
            {expandedChapters[chapter.id] && (
              <div className="border-t border-gray-100 p-3 bg-gray-50/50">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {chapter.groups.map(group => (
                    <Link
                      key={group.id}
                      to={`/group/${group.id}`}
                      className="flex items-center justify-between p-3 bg-white rounded-xl hover:bg-coral-50 transition-colors card-hover"
                    >
                      <div className="flex items-center gap-2">
                        <FileText className="text-pink-400" size={18} />
                        <div>
                          <span className="font-medium text-gray-700">{group.name}</span>
                          <span className="text-xs text-gray-400 ml-2">
                            Section {group.section}
                          </span>
                        </div>
                      </div>
                      <span className="font-handwritten text-lg text-coral-500">
                        {group.words.length}
                      </span>
                    </Link>
                  ))}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
