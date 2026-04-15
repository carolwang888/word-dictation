import { useState } from 'react';
import { Outlet, Link, useLocation } from 'react-router-dom';
import { Home, BookOpen, AlertCircle, Settings, Volume2 } from 'lucide-react';
import VoiceSettings from './VoiceSettings';

const navItems = [
  { path: '/', icon: Home, label: '首页' },
  { path: '/error-words', icon: AlertCircle, label: '错题本' },
  { path: '/manage', icon: Settings, label: '管理' },
];

export default function Layout() {
  const location = useLocation();
  const [showVoiceSettings, setShowVoiceSettings] = useState(false);
  
  return (
    <div className="min-h-screen bg-gradient-to-br from-coral-50 via-sakura-50 to-pink-100">
      {/* Header */}
      <header className="bg-white/80 backdrop-blur-sm shadow-sm sticky top-0 z-50">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <Link to="/" className="flex items-center gap-2">
              <span className="text-3xl">🎧</span>
              <div>
                <h1 className="font-handwritten text-2xl text-coral-600">雅思听力</h1>
                <p className="text-xs text-gray-500">IELTS Dictation</p>
              </div>
            </Link>
            
            <nav className="flex gap-2">
              {navItems.map(({ path, icon: Icon, label }) => (
                <Link
                  key={path}
                  to={path}
                  className={`flex items-center gap-1.5 px-3 py-2 rounded-lg transition-all ${
                    location.pathname === path
                      ? 'bg-coral-100 text-coral-600'
                      : 'text-gray-600 hover:bg-gray-100'
                  }`}
                >
                  <Icon size={18} />
                  <span className="text-sm">{label}</span>
                </Link>
              ))}
              <button
                onClick={() => setShowVoiceSettings(true)}
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-gray-600 hover:bg-gray-100 transition-all"
                title="语音设置"
              >
                <Volume2 size={18} />
              </button>
            </nav>
          </div>
        </div>
      </header>
      
      {/* Main Content */}
      <main className="max-w-4xl mx-auto px-4 py-6">
        <Outlet />
      </main>
      
      {/* Footer */}
      <footer className="text-center py-6 text-gray-400 text-sm">
        <p className="font-handwritten text-lg text-coral-400">Learning with Love 💕</p>
      </footer>
      
      {/* Voice Settings Modal */}
      {showVoiceSettings && (
        <VoiceSettings onClose={() => setShowVoiceSettings(false)} />
      )}
    </div>
  );
}
