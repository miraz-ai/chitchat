import React from 'react';
import { ThemeProvider } from './context/ThemeContext';
import { CallProvider } from './context/CallContext';
import { ChatProvider } from './context/ChatContext';
import { AuthProvider, useAuth } from './context/AuthContext';
import { Sidebar } from './components/Sidebar/Sidebar';
import { ChatArea } from './components/ChatArea/ChatArea';
import { InfoPanel } from './components/InfoPanel/InfoPanel';
import { CallModal } from './components/Modals/CallModal';
import { SettingsModal } from './components/Modals/SettingsModal';
import { NewChatModal } from './components/Modals/NewChatModal';
import { MediaLightbox } from './components/Modals/MediaLightbox';
import { ProfileModal } from './components/Modals/ProfileModal';
import { Login } from './components/Login/Login';

export const AppContent: React.FC = () => {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div style={{ display: 'flex', height: '100vh', alignItems: 'center', justifyContent: 'center' }}>
        <div className="spinner"></div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Login />;
  }

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
      <ProfileModal />
    </div>
  );
};

export const App: React.FC = () => {
  return (
    <AuthProvider>
      <ThemeProvider>
        <CallProvider>
          <ChatProvider>
            <AppContent />
          </ChatProvider>
        </CallProvider>
      </ThemeProvider>
    </AuthProvider>
  );
};

export default App;
