import { useState, useEffect } from 'react';
import { Volume2, X, Check } from 'lucide-react';

export default function VoiceSettings({ onClose }) {
  const [voices, setVoices] = useState([]);
  const [selectedVoice, setSelectedVoice] = useState(null);
  const [previewText, setPreviewText] = useState('Hello');
  
  useEffect(() => {
    const loadVoices = () => {
      const allVoices = window.speechSynthesis.getVoices();
      setVoices(allVoices);
      
      // 尝试恢复保存的选择
      const savedVoiceName = localStorage.getItem('selected-voice');
      if (savedVoiceName) {
        const saved = allVoices.find(v => v.name === savedVoiceName);
        if (saved) setSelectedVoice(saved);
      }
      
      // 默认选择
      if (!selectedVoice) {
        const brit = allVoices.find(v => v.lang.startsWith('en-GB'));
        const english = allVoices.find(v => v.lang.startsWith('en'));
        setSelectedVoice(brit || english || allVoices[0]);
      }
    };
    
    loadVoices();
    window.speechSynthesis.onvoiceschanged = loadVoices;
    
    return () => {
      window.speechSynthesis.onvoiceschanged = null;
    };
  }, []);
  
  const handlePreview = () => {
    if (!selectedVoice) return;
    
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(previewText);
    utterance.voice = selectedVoice;
    utterance.lang = selectedVoice.lang;
    window.speechSynthesis.speak(utterance);
  };
  
  const handleSelectVoice = (voice) => {
    setSelectedVoice(voice);
    localStorage.setItem('selected-voice', voice.name);
  };
  
  const englishVoices = voices.filter(v => v.lang.startsWith('en'));
  const allVoices = englishVoices.length > 0 ? englishVoices : voices;
  
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[80vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b">
          <div className="flex items-center gap-2">
            <Volume2 className="text-coral-500" />
            <h2 className="font-handwritten text-xl text-coral-600">语音设置</h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg"
          >
            <X size={20} />
          </button>
        </div>
        
        {/* Content */}
        <div className="p-4 space-y-4 overflow-y-auto max-h-[60vh]">
          {/* Preview */}
          <div className="bg-coral-50 rounded-xl p-4">
            <p className="text-sm text-gray-500 mb-2">语音预览</p>
            <div className="flex gap-2">
              <input
                type="text"
                value={previewText}
                onChange={(e) => setPreviewText(e.target.value)}
                placeholder="输入预览文本"
                className="flex-1 px-3 py-2 rounded-lg border border-gray-200"
              />
              <button
                onClick={handlePreview}
                className="btn-primary px-4"
              >
                试听
              </button>
            </div>
          </div>
          
          {/* Voice List */}
          <div>
            <p className="text-sm text-gray-500 mb-2">
              可用语音 ({allVoices.length})
            </p>
            <div className="space-y-2">
              {allVoices.map((voice, idx) => (
                <button
                  key={idx}
                  onClick={() => handleSelectVoice(voice)}
                  className={`w-full text-left p-3 rounded-xl transition-all ${
                    selectedVoice?.name === voice.name
                      ? 'bg-coral-100 ring-2 ring-coral-400'
                      : 'bg-gray-50 hover:bg-gray-100'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="font-medium text-gray-800 truncate">
                          {voice.name}
                        </p>
                        {!voice.localService && (
                          <span className="text-xs bg-green-100 text-green-600 px-2 py-0.5 rounded-full">
                            云端
                          </span>
                        )}
                        {voice.localService && (
                          <span className="text-xs bg-gray-200 text-gray-500 px-2 py-0.5 rounded-full">
                            本地
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-gray-500">
                        {voice.lang}
                      </p>
                    </div>
                    {selectedVoice?.name === voice.name && (
                      <Check className="text-coral-500 flex-shrink-0" size={20} />
                    )}
                  </div>
                </button>
              ))}
            </div>
            
            {allVoices.length === 0 && (
              <div className="text-center py-8 text-gray-500">
                <p>正在加载语音...</p>
                <p className="text-sm mt-2">如果长时间无响应，请刷新页面</p>
              </div>
            )}
          </div>
          
          {/* Tips */}
          <div className="bg-green-50 rounded-xl p-4">
            <p className="text-sm text-green-700">
              💡 <strong>云端语音</strong> 音质更好，与 Chrome 效果一致。
              如果没有云端语音选项，说明网络未连接或浏览器不支持。
            </p>
          </div>
          
          <div className="bg-pink-50 rounded-xl p-4">
            <p className="text-sm text-pink-600">
              💡 Safari 用户：确保网络连接，首次使用可能需要下载语音。
              也可以在「系统设置 → 辅助功能 → 语音」中下载更多英语语音。
            </p>
          </div>
        </div>
        
        {/* Footer */}
        <div className="p-4 border-t bg-gray-50">
          <button
            onClick={onClose}
            className="w-full btn-primary"
          >
            保存并关闭
          </button>
        </div>
      </div>
    </div>
  );
}
