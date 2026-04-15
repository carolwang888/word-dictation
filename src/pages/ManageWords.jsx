import { useState } from 'react';
import { useWords } from '../context/WordsContext';
import { Settings, Plus, Trash2, Edit2, Check, X } from 'lucide-react';

export default function ManageWords() {
  const { chapters, addWord, deleteWord, updateWord, initialized } = useWords();
  const [selectedGroup, setSelectedGroup] = useState(null);
  const [editingWord, setEditingWord] = useState(null);
  const [newWord, setNewWord] = useState({ word: '', phonetic: '', meaning: '' });
  const [showAddForm, setShowAddForm] = useState(false);
  
  if (!initialized) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-coral-200 border-t-coral-500"></div>
      </div>
    );
  }
  
  const currentGroup = selectedGroup 
    ? chapters.flatMap(c => c.groups).find(g => g.id === selectedGroup)
    : null;
  
  const handleAddWord = () => {
    if (!newWord.word.trim()) return;
    
    addWord(selectedGroup, {
      word: newWord.word.trim(),
      phonetic: newWord.phonetic.trim(),
      meaning: newWord.meaning.trim()
    });
    
    setNewWord({ word: '', phonetic: '', meaning: '' });
    setShowAddForm(false);
  };
  
  const handleDeleteWord = (wordId) => {
    if (confirm('确定要删除这个单词吗？')) {
      deleteWord(selectedGroup, wordId);
    }
  };
  
  const handleUpdateWord = (wordId, updates) => {
    updateWord(selectedGroup, wordId, updates);
    setEditingWord(null);
  };
  
  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="bg-white rounded-2xl shadow-lg p-6">
        <div className="flex items-center gap-3 mb-4">
          <Settings className="text-coral-500" size={28} />
          <div>
            <h1 className="font-handwritten text-2xl text-coral-600">单词管理</h1>
            <p className="text-sm text-gray-500">添加、编辑或删除单词</p>
          </div>
        </div>
        
        {/* Group Selector */}
        <div>
          <label className="block text-sm text-gray-500 mb-2">选择词组</label>
          <select
            value={selectedGroup || ''}
            onChange={(e) => setSelectedGroup(e.target.value || null)}
            className="w-full bg-gray-100 rounded-xl px-4 py-3"
          >
            <option value="">-- 选择词组 --</option>
            {chapters.map(chapter => (
              <optgroup key={chapter.id} label={chapter.title}>
                {chapter.groups.map(group => (
                  <option key={group.id} value={group.id}>
                    {group.name} ({group.words.length})
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
        </div>
      </div>
      
      {/* Word List */}
      {currentGroup && (
        <div className="bg-white rounded-2xl shadow-lg p-4">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-medium text-gray-700">
              {currentGroup.name} - {currentGroup.words.length} 个单词
            </h2>
            
            <button
              onClick={() => setShowAddForm(!showAddForm)}
              className="flex items-center gap-1 text-coral-500 hover:text-coral-600"
            >
              <Plus size={18} />
              <span>添加单词</span>
            </button>
          </div>
          
          {/* Add Form */}
          {showAddForm && (
            <div className="bg-coral-50 rounded-xl p-4 mb-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-3">
                <input
                  type="text"
                  placeholder="单词"
                  value={newWord.word}
                  onChange={(e) => setNewWord(prev => ({ ...prev, word: e.target.value }))}
                  className="px-3 py-2 rounded-lg border border-gray-200"
                />
                <input
                  type="text"
                  placeholder="音标"
                  value={newWord.phonetic}
                  onChange={(e) => setNewWord(prev => ({ ...prev, phonetic: e.target.value }))}
                  className="px-3 py-2 rounded-lg border border-gray-200"
                />
                <input
                  type="text"
                  placeholder="中文释义"
                  value={newWord.meaning}
                  onChange={(e) => setNewWord(prev => ({ ...prev, meaning: e.target.value }))}
                  className="px-3 py-2 rounded-lg border border-gray-200"
                />
              </div>
              <div className="flex gap-2 justify-end">
                <button
                  onClick={() => setShowAddForm(false)}
                  className="px-4 py-2 text-gray-500 hover:bg-gray-200 rounded-lg"
                >
                  取消
                </button>
                <button
                  onClick={handleAddWord}
                  className="px-4 py-2 bg-coral-500 text-white rounded-lg hover:bg-coral-600"
                >
                  添加
                </button>
              </div>
            </div>
          )}
          
          {/* Words */}
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {currentGroup.words.map((word, idx) => (
              <div
                key={word.id}
                className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl group"
              >
                <span className="font-handwritten text-lg text-gray-400 w-8">
                  {idx + 1}
                </span>
                
                {editingWord === word.id ? (
                  <>
                    <input
                      type="text"
                      defaultValue={word.word}
                      id={`edit-word-${word.id}`}
                      className="flex-1 px-2 py-1 rounded border"
                    />
                    <input
                      type="text"
                      defaultValue={word.phonetic}
                      id={`edit-phonetic-${word.id}`}
                      className="w-24 px-2 py-1 rounded border text-sm"
                    />
                    <input
                      type="text"
                      defaultValue={word.meaning}
                      id={`edit-meaning-${word.id}`}
                      className="flex-1 px-2 py-1 rounded border"
                    />
                    <button
                      onClick={() => handleUpdateWord(word.id, {
                        word: document.getElementById(`edit-word-${word.id}`).value,
                        phonetic: document.getElementById(`edit-phonetic-${word.id}`).value,
                        meaning: document.getElementById(`edit-meaning-${word.id}`).value
                      })}
                      className="p-1 text-green-500 hover:bg-green-100 rounded"
                    >
                      <Check size={18} />
                    </button>
                    <button
                      onClick={() => setEditingWord(null)}
                      className="p-1 text-gray-400 hover:bg-gray-200 rounded"
                    >
                      <X size={18} />
                    </button>
                  </>
                ) : (
                  <>
                    <div className="flex-1">
                      <span className="font-medium text-gray-800">{word.word}</span>
                      {word.phonetic && (
                        <span className="text-xs text-gray-400 ml-2 phonetic">[{word.phonetic}]</span>
                      )}
                      <span className="text-sm text-gray-500 ml-3">{word.meaning}</span>
                    </div>
                    
                    <button
                      onClick={() => setEditingWord(word.id)}
                      className="p-1 text-gray-400 hover:text-coral-500 opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <Edit2 size={16} />
                    </button>
                    <button
                      onClick={() => handleDeleteWord(word.id)}
                      className="p-1 text-gray-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <Trash2 size={16} />
                    </button>
                  </>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
      
      {!selectedGroup && (
        <div className="bg-white rounded-2xl shadow-lg p-12 text-center">
          <p className="text-4xl mb-4">📝</p>
          <p className="text-gray-500">请选择要管理的词组</p>
        </div>
      )}
    </div>
  );
}
