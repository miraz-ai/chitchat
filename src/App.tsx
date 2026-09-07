import React from 'react';
import { ThemeProvider } from './context/ThemeContext';
import { CallProvider } from './context/CallContext';
import { ChatProvider } from './context/ChatContext';
import { Sidebar } from './components/Sidebar/Sidebar';
import { ChatArea } from './components/ChatArea/ChatArea';
import { InfoPanel } from './components/InfoPanel/InfoPanel';
import { CallModal } from './components/Modals/CallModal';
import { SettingsModal } from './components/Modals/SettingsModal';
import { NewChatModal } from './components/Modals/NewChatModal';
import { MediaLightbox } from './components/Modals/MediaLightbox';

export const AppContent: React.FC = () => {
  return (
    <div className="app-container">
      <Sidebar />
      <ChatArea />
      <InfoPanel />

      {/* Global Interactive Modals */}
      <CallModal />
      <SettingsModal />
      <NewChatModal />
      <MediaLightbox />
    </div>
  );
};

export const App: React.FC = () => {
  return (
    <ThemeProvider>
      <CallProvider>
        <ChatProvider>
          <AppContent />
        </ChatProvider>
      </CallProvider>
    </ThemeProvider>
  );
};

export default App;
