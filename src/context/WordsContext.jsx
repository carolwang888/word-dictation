import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { DEFAULT_WORDS_DATA } from '../data/wordsData';

const CHAPTER_MAP = {
  '3': '听力特别名词语料库',
  '4': '形容词、副词语料库',
  '5': '动词语料库',
  '11': '综合语料库',
};

const STORAGE_KEY = 'ielts-dictation-words';
// 数据版本号 - 每次修改数据后递增
const DATA_VERSION = 'v3';
// 检查数据是否包含新的分组格式
const EXPECTED_GROUPS = ['11-1-1', '11-1-2', '11-1-3', '11-1-4'];

function parseChapters(data) {
  const chapterMap = {};
  
  Object.entries(data).forEach(([groupName, words]) => {
    const parts = groupName.split('-');
    const chapterPart = parts[0];
    const paperNum = parts[1] || '1';
    
    let chapterId;
    let sectionNum = '1';
    
    if (chapterPart.includes('.')) {
      const [ch, sec] = chapterPart.split('.');
      chapterId = ch;
      sectionNum = sec;
    } else {
      chapterId = chapterPart;
    }
    
    if (!chapterMap[chapterId]) {
      chapterMap[chapterId] = {
        id: chapterId,
        title: `Chapter ${chapterId}`,
        subtitle: CHAPTER_MAP[chapterId] || '',
        groups: []
      };
    }
    
    const groupWords = words.map((w, idx) => ({
      id: `${groupName}-${idx}`,
      word: w.word,
      phonetic: w.phonetic,
      meaning: w.meaning,
      errorCount: 0
    }));
    
    chapterMap[chapterId].groups.push({
      id: groupName,
      name: groupName,
      words: groupWords,
      chapter: chapterId,
      section: sectionNum,
      paper: paperNum
    });
  });
  
  return Object.values(chapterMap).sort((a, b) => parseInt(a.id) - parseInt(b.id));
}

const initialChapters = parseChapters(DEFAULT_WORDS_DATA);

const WordsContext = createContext(null);

export function WordsProvider({ children }) {
  const [chapters, setChapters] = useState([]);
  const [initialized, setInitialized] = useState(false);
  
  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    
    if (stored) {
      try {
        const parsedData = JSON.parse(stored);
        
        // 检查有多少个有错误计数的单词
        let errorWordCount = 0;
        let totalWords = 0;
        parsedData.forEach(ch => {
          ch.groups.forEach(grp => {
            grp.words.forEach(w => {
              totalWords++;
              if (w.errorCount > 0) errorWordCount++;
            });
          });
        });
        console.log('WordsContext loaded: total:', totalWords, 'errors:', errorWordCount);
        
        // 直接使用存储的数据，保留用户的错误计数
        setChapters(parsedData);
        setInitialized(true);
        return;
      } catch (e) {
        console.log('Parse error:', e);
      }
    }
    
    // 没有数据，使用初始数据
    console.log('WordsContext: using initial data');
    setChapters(initialChapters);
    setInitialized(true);
  }, []);
  
  // 保存数据到 localStorage - 只要有数据就保存，不管 initialized 状态
  // 监听 chapters 变化，立即保存到 localStorage
  useEffect(() => {
    if (chapters.length > 0) {
      console.log('Saving chapters to localStorage, chapters count:', chapters.length);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(chapters));
    }
  }, [chapters]);
  
  const getGroup = useCallback((groupId) => {
    const group = chapters.find(ch => 
      ch.groups.some(g => g.id === groupId)
    )?.groups.find(g => g.id === groupId);
    
    if (group) {
      console.log('getGroup:', groupId, 'found', group.words.length, 'words');
    } else {
      console.log('getGroup:', groupId, 'NOT FOUND');
    }
    return group || null;
  }, [chapters]);
  
  const incrementErrorCount = (wordId) => {
    console.log('incrementErrorCount:', wordId);
    setChapters(prev => {
      const updated = prev.map(chapter => ({
        ...chapter,
        groups: chapter.groups.map(group => ({
          ...group,
          words: group.words.map(word => 
            word.id === wordId 
              ? { ...word, errorCount: word.errorCount + 1 }
              : word
          )
        }))
      }));
      // 立即保存
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
      return updated;
    });
  };
  
  const setErrorCount = useCallback((wordId, count) => {
    const newCount = Math.max(0, Math.round(count)); // 不允许负数
    setChapters(prev => {
      const updated = prev.map(chapter => ({
        ...chapter,
        groups: chapter.groups.map(group => ({
          ...group,
          words: group.words.map(word =>
            word.id === wordId
              ? { ...word, errorCount: newCount }
              : word
          )
        }))
      }));
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
      return updated;
    });
  }, []);

  const resetErrorCounts = useCallback(() => {
    setChapters(prev => prev.map(chapter => ({
      ...chapter,
      groups: chapter.groups.map(group => ({
        ...group,
        words: group.words.map(word => ({ ...word, errorCount: 0 }))
      }))
    })));
  }, []);
  
  const addWord = useCallback((groupId, word) => {
    setChapters(prev => prev.map(chapter => ({
      ...chapter,
      groups: chapter.groups.map(group => {
        if (group.id === groupId) {
          const newWord = {
            id: `${groupId}-${group.words.length}`,
            word: word.word,
            phonetic: word.phonetic || '',
            meaning: word.meaning || '',
            errorCount: 0
          };
          return { ...group, words: [...group.words, newWord] };
        }
        return group;
      })
    })));
  }, []);
  
  const deleteWord = useCallback((groupId, wordId) => {
    setChapters(prev => prev.map(chapter => ({
      ...chapter,
      groups: chapter.groups.map(group => {
        if (group.id === groupId) {
          return { ...group, words: group.words.filter(w => w.id !== wordId) };
        }
        return group;
      })
    })));
  }, []);
  
  const updateWord = useCallback((groupId, wordId, updates) => {
    setChapters(prev => prev.map(chapter => ({
      ...chapter,
      groups: chapter.groups.map(group => {
        if (group.id === groupId) {
          return {
            ...group,
            words: group.words.map(word =>
              word.id === wordId ? { ...word, ...updates } : word
            )
          };
        }
        return group;
      })
    })));
  }, []);
  
  const getAllWords = useCallback(() => {
    const words = [];
    chapters.forEach(chapter => {
      chapter.groups.forEach(group => {
        words.push(...group.words);
      });
    });
    return words;
  }, [chapters]);
  
  const value = {
    chapters,
    initialized,
    getGroup,
    incrementErrorCount,
    setErrorCount,
    resetErrorCounts,
    addWord,
    deleteWord,
    updateWord,
    getAllWords
  };
  
  return (
    <WordsContext.Provider value={value}>
      {children}
    </WordsContext.Provider>
  );
}

export function useWords() {
  const context = useContext(WordsContext);
  if (!context) {
    throw new Error('useWords must be used within WordsProvider');
  }
  return context;
}
