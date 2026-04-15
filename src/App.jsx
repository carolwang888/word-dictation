function App() {
    return (
        <WordsProvider>
            <BrowserRouter basename="/word-dictation">
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
