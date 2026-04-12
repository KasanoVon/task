import { useState, useEffect } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { TaskProvider, useTask } from './context/TaskContext';
import { AuthPage } from './components/AuthPage';
import { FocusScreen } from './components/FocusScreen';
import { ListScreen } from './components/ListScreen';
import { CalendarScreen } from './components/CalendarScreen';
import { DoneScreen } from './components/DoneScreen';
import { TabBar } from './components/TabBar';
import './styles/main.css';

// ローディング画面
function LoadingScreen() {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      minHeight: '100vh', fontSize: '14px', color: 'var(--t2)',
    }}>
      よみこみ中...
    </div>
  );
}

type Screen = 'focus' | 'list' | 'cal' | 'done';

// アプリ本体（認証済みユーザー向け）
function AppMain() {
  const { authState, logout } = useAuth();
  const { state, loadTasks } = useTask();
  const [screen, setScreen] = useState<Screen>('focus');

  useEffect(() => {
    // タスク取得失敗（401・通信エラー等）時はログアウトしてログイン画面へ
    loadTasks().catch(() => logout());
  }, [loadTasks, logout]);

  if (!state.loaded) return <LoadingScreen />;

  return (
    <div className="app">
      {/* エラートースト */}
      <div className="err-toast" id="err-toast" />

      <div style={{ flex: 1, minHeight: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        {screen === 'focus' && (
          <FocusScreen
            username={authState.currentUser?.username ?? ''}
            onLogout={logout}
            onShowList={() => setScreen('list')}
            onShowCal={() => setScreen('cal')}
            onShowDone={() => setScreen('done')}
          />
        )}
        {screen === 'list' && (
          <ListScreen
            onShowFocus={() => setScreen('focus')}
            username={authState.currentUser?.username ?? ''}
            onLogout={logout}
          />
        )}
        {screen === 'cal' && (
          <CalendarScreen
            onShowFocus={() => setScreen('focus')}
            onShowList={() => setScreen('list')}
            username={authState.currentUser?.username ?? ''}
            onLogout={logout}
          />
        )}
        {screen === 'done' && (
          <DoneScreen
            onShowFocus={() => setScreen('focus')}
            onShowList={() => setScreen('list')}
            onShowCal={() => setScreen('cal')}
          />
        )}
      </div>

      <TabBar
        active={screen}
        onFocus={() => setScreen('focus')}
        onList={() => setScreen('list')}
        onCal={() => setScreen('cal')}
      />
    </div>
  );
}

// ルーティング（認証保護）
function AppRoutes() {
  const { authState } = useAuth();

  if (!authState.initialized) return <LoadingScreen />;

  return (
    <Routes>
      <Route
        path="/login"
        element={authState.currentUser ? <Navigate to="/app" replace /> : <AuthPage />}
      />
      <Route
        path="/app"
        element={
          authState.currentUser
            ? <TaskProvider><AppMain /></TaskProvider>
            : <Navigate to="/login" replace />
        }
      />
      <Route
        path="*"
        element={<Navigate to={authState.currentUser ? '/app' : '/login'} replace />}
      />
    </Routes>
  );
}

export function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <AppRoutes />
      </BrowserRouter>
    </AuthProvider>
  );
}
