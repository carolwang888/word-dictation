import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { WordsProvider } from './context/WordsContext';
import Layout from './components/Layout';
import Home from './pages/Home';
import GroupDetail from './pages/GroupDetail';
import StudyPage from './pages/StudyPage';
import DictationPage from './pages/DictationPage';
import ErrorWords from './pages/ErrorWords';
import ErrorDictationPage from './pages/ErrorDictationPage';
import ManageWords from './pages/ManageWords';

function App() {
  return (
    <WordsProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Layout />}>
            <Route index element={<Home />} />
            <Route path="group/:id" element={<GroupDetail />} />
            <Route path="study/:id" element={<StudyPage />} />
            <Route path="dictation/:id" element={<DictationPage />} />
            <Route path="error-words" element={<ErrorWords />} />
            <Route path="dictation-error" element={<ErrorDictationPage />} />
            <Route path="manage" element={<ManageWords />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </WordsProvider>
  );
}

export default App;
