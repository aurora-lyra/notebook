import { useState, useCallback, useMemo, useEffect } from 'react';
import Sidebar from './components/Sidebar';
import EntryList from './components/EntryList';
import EntryEditor from './components/EntryEditor';
import EmptyState from './components/EmptyState';
import DiaryPage from './components/DiaryPage';
import MemoPage from './components/MemoPage';
import AuthScreen from './components/AuthScreen';
import MobileHeader from './components/MobileHeader';
import MobileDrawer from './components/MobileDrawer';
import FAB from './components/FAB';
import ChangePasswordModal from './components/ChangePasswordModal';
import YearInPixels from './components/YearInPixels';
import SettingsPage from './components/SettingsPage';
import { useEntries, useEntry } from './hooks/useEntries';
import { useAuth } from './hooks/useAuth';
import { useSync } from './hooks/useSync';
import { useTheme } from './hooks/useTheme';
import { supabase } from './lib/supabase';
import * as db from './lib/db';

/**
 * Derive a db filter object from the sidebar view id.
 */
function viewToFilter(view) {
  if (view === 'all') return {};
  if (view === 'diary') return { type: 'diary' };
  if (view === 'memo') return { type: 'memo' };
  if (view === 'pinned') return {};
  if (view === 'favorited') return {};
  if (view.startsWith('tag:')) return { tag: view.slice(4) };
  if (view.startsWith('folder:')) return { folder: view.slice(7) };
  return {};
}

export default function App() {
  /* ---- Theme ---- */
  const { isDark, toggleTheme } = useTheme();

  /* ---- Auth ---- */
  const {
    user,
    loading: authLoading,
    signIn,
    signUp,
    signOut,
    isSupabaseConfigured,
    connectionError,
  } = useAuth();

  const [skipAuth, setSkipAuth] = useState(false);
  const [showChangePassword, setShowChangePassword] = useState(false);
  const isAuthed = !!user || skipAuth;

  /* ---- Sync ---- */
  const [syncVersion, setSyncVersion] = useState(0);
  const handleRemoteChange = useCallback(() => {
    setSyncVersion((v) => v + 1);
  }, []);

  const { onLocalChange } = useSync(user, handleRemoteChange);

  /* ---- Sidebar state ---- */
  const [activeView, setActiveView] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [activeEntryId, setActiveEntryId] = useState(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [isDiaryEditing, setIsDiaryEditing] = useState(false);

  // Close drawer when view changes
  useEffect(() => {
    setDrawerOpen(false);
  }, [activeView]);

  /* ---- Data ---- */
  const filter = useMemo(
    () => ({ ...viewToFilter(activeView), search: searchQuery }),
    [activeView, searchQuery],
  );

  // syncVersion forces re-read from localStorage when remote changes arrive
  const { entries, create, update, remove, refresh } = useEntries(filter, syncVersion);

  // All diary entries for Year in Pixels (unfiltered)
  const { entries: allDiaryEntries } = useEntries({ type: 'diary' }, syncVersion);

  const filteredEntries = useMemo(() => {
    if (activeView === 'pinned') return entries.filter((e) => e.pinned);
    if (activeView === 'favorited') return entries.filter((e) => e.favorited);
    return entries;
  }, [entries, activeView]);

  const tags = useMemo(() => db.getAllTags(), [entries, syncVersion]);
  const folders = useMemo(() => db.getAllFolders(), [entries, syncVersion]);

  const { entry: activeEntry, save } = useEntry(activeEntryId, syncVersion);

  /* ---- Handlers (with sync notification) ---- */
  const handleNewEntry = useCallback(() => {
    const type = activeView === 'diary' ? 'diary' : 'memo';
    const folder = activeView.startsWith('folder:')
      ? activeView.slice(7)
      : '';
    const entry = create({ type, folder });
    setActiveEntryId(entry.id);
    onLocalChange();
  }, [activeView, create, onLocalChange]);

  const handleSelectEntry = useCallback((id) => {
    setActiveEntryId(id);
  }, []);

  const handleSave = useCallback(
    (patch) => {
      if (activeEntryId) {
        save(patch);
        refresh();
        onLocalChange();
      }
    },
    [activeEntryId, save, refresh, onLocalChange],
  );

  const handleClose = useCallback(() => {
    setActiveEntryId(null);
  }, []);

  const handleTogglePin = useCallback(
    (id) => {
      const entry = db.getEntry(id);
      if (entry) {
        update(id, { pinned: !entry.pinned });
        onLocalChange();
      }
    },
    [update, onLocalChange],
  );

  const handleToggleFav = useCallback(
    (id) => {
      const entry = db.getEntry(id);
      if (entry) {
        update(id, { favorited: !entry.favorited });
        onLocalChange();
      }
    },
    [update, onLocalChange],
  );

  const handleDelete = useCallback(
    (id) => {
      remove(id);
      if (activeEntryId === id) setActiveEntryId(null);
      onLocalChange();
    },
    [remove, activeEntryId, onLocalChange],
  );

  const handleChangePassword = useCallback(async (currentPassword, newPassword) => {
    // First verify current password by re-authenticating
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: user.email,
      password: currentPassword,
    });
    if (signInError) {
      return { error: '当前密码不正确' };
    }
    // Update password
    const { error: updateError } = await supabase.auth.updateUser({
      password: newPassword,
    });
    if (updateError) {
      return { error: updateError.message || '密码修改失败' };
    }
    return {};
  }, [user]);

  /* ---- Shared sidebar props ---- */
  const sidebarProps = {
    activeView,
    onViewChange: setActiveView,
    onNewEntry: handleNewEntry,
    tags,
    folders,
    searchQuery,
    onSearchChange: setSearchQuery,
    user,
    onSignOut: signOut,
    onNavigateSettings: () => setActiveView('settings'),
    isDark,
    onToggleTheme: toggleTheme,
  };

  /* ---- Loading state ---- */
  if (authLoading) {
    return (
      <div className="h-screen flex items-center justify-center bg-surface">
        <div className="text-sm text-ink-tertiary">加载中…</div>
      </div>
    );
  }

  /* ---- Auth gate ---- */
  if (!isAuthed && isSupabaseConfigured) {
    return (
      <AuthScreen
        onSignIn={signIn}
        onSignUp={signUp}
        onSkip={() => setSkipAuth(true)}
        connectionError={connectionError}
      />
    );
  }

  /* ---- Settings page ---- */
  if (activeView === 'settings') {
    return (
      <div className="flex h-screen bg-surface">
        <div className="hidden md:block">
          <Sidebar {...sidebarProps} />
        </div>
        <MobileDrawer
          open={drawerOpen}
          onClose={() => setDrawerOpen(false)}
          {...sidebarProps}
        />
        <div className="flex-1 flex flex-col min-w-0">
          <MobileHeader
            activeView={activeView}
            onMenuOpen={() => setDrawerOpen(true)}
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
          />
          <SettingsPage
            user={user}
            isDark={isDark}
            onToggleTheme={toggleTheme}
            onChangePassword={() => setShowChangePassword(true)}
            onClose={() => setActiveView('all')}
            syncVersion={syncVersion}
          />
        </div>
        <ChangePasswordModal
          open={showChangePassword}
          onClose={() => setShowChangePassword(false)}
          onSubmit={handleChangePassword}
          onSignOut={signOut}
        />
      </div>
    );
  }

  /* ---- Diary mode ---- */
  if (activeView === 'diary') {
    return (
      <div className="flex h-screen bg-surface">
        {/* Desktop sidebar — collapses when editing for immersive mode */}
        <div className={`hidden md:block immersive-sidebar ${isDiaryEditing ? 'collapsed' : ''}`}>
          <Sidebar {...sidebarProps} />
        </div>

        {/* Mobile drawer */}
        <MobileDrawer
          open={drawerOpen}
          onClose={() => setDrawerOpen(false)}
          {...sidebarProps}
        />

        {/* Mobile header — hidden during immersive editing */}
        <div className="flex-1 flex flex-col min-w-0">
          {!isDiaryEditing && (
            <MobileHeader
              activeView={activeView}
              onMenuOpen={() => setDrawerOpen(true)}
              searchQuery={searchQuery}
              onSearchChange={setSearchQuery}
            />
          )}
          <DiaryPage onLocalChange={onLocalChange} onEditingChange={setIsDiaryEditing} syncVersion={syncVersion} />
        </div>

        <ChangePasswordModal
          open={showChangePassword}
          onClose={() => setShowChangePassword(false)}
          onSubmit={handleChangePassword}
          onSignOut={signOut}
        />
      </div>
    );
  }

  /* ---- Memo mode ---- */
  if (activeView === 'memo') {
    return (
      <div className="flex h-screen bg-surface">
        <div className={`hidden md:block immersive-sidebar ${isDiaryEditing ? 'collapsed' : ''}`}>
          <Sidebar {...sidebarProps} />
        </div>

        <MobileDrawer
          open={drawerOpen}
          onClose={() => setDrawerOpen(false)}
          {...sidebarProps}
        />

        <div className="flex-1 flex flex-col min-w-0">
          {!isDiaryEditing && (
            <MobileHeader
              activeView={activeView}
              onMenuOpen={() => setDrawerOpen(true)}
              searchQuery={searchQuery}
              onSearchChange={setSearchQuery}
            />
          )}
          <MemoPage onLocalChange={onLocalChange} syncVersion={syncVersion} />
        </div>

        <FAB
          onNewDiary={() => {
            setActiveView('diary');
            setTimeout(() => handleNewEntry(), 50);
          }}
          onNewTask={() => {
            // Focus handled by MemoPage internally
          }}
        />

        <ChangePasswordModal
          open={showChangePassword}
          onClose={() => setShowChangePassword(false)}
          onSubmit={handleChangePassword}
          onSignOut={signOut}
        />
      </div>
    );
  }

  /* ---- Default mode ---- */
  return (
    <div className="flex h-screen bg-surface">
      {/* Desktop sidebar */}
      <div className="hidden md:block">
        <Sidebar {...sidebarProps} />
      </div>

      {/* Mobile drawer */}
      <MobileDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        {...sidebarProps}
      />

      {/* Main content area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Mobile header */}
        <MobileHeader
          activeView={activeView}
          onMenuOpen={() => setDrawerOpen(true)}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
        />

        <div className="flex-1 flex overflow-hidden">
          {/* Entry list — desktop: fixed width, mobile: full width */}
          <div className={`${activeEntryId ? 'hidden md:flex' : 'flex'} w-full md:w-72 shrink-0 border-r border-border flex-col h-full overflow-hidden`}>
            <div className="px-4 py-3 border-b border-border shrink-0">
              <h2 className="text-sm font-medium text-ink">
                {activeView === 'all' && '全部记录'}
                {activeView === 'pinned' && '置顶'}
                {activeView === 'favorited' && '收藏'}
                {activeView.startsWith('tag:') && `标签: ${activeView.slice(4)}`}
                {activeView.startsWith('folder:') && `文件夹: ${activeView.slice(7)}`}
              </h2>
              <p className="text-xs text-ink-tertiary mt-0.5">
                {filteredEntries.length} 条记录
              </p>
            </div>
            <EntryList
              entries={filteredEntries}
              activeId={activeEntryId}
              onSelect={handleSelectEntry}
              onTogglePin={handleTogglePin}
              onToggleFav={handleToggleFav}
              onDelete={handleDelete}
            />
          </div>

          {/* Editor — desktop: fill remaining, mobile: full screen */}
          <div className={`${activeEntryId ? 'flex' : 'hidden md:flex'} flex-1 flex-col`}>
            {activeEntry ? (
              <EntryEditor
                key={activeEntry.id}
                entry={activeEntry}
                onSave={handleSave}
                onClose={handleClose}
              />
            ) : (
              <div className="hidden md:block overflow-y-auto">
                {(activeView === 'all' || activeView === 'diary') ? (
                  <YearInPixels entries={allDiaryEntries} />
                ) : (
                  <EmptyState onNewEntry={handleNewEntry} />
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* FAB — default mode */}
      <FAB
        onNewDiary={() => {
          setActiveView('diary');
          setTimeout(() => handleNewEntry(), 50);
        }}
        onNewTask={() => {
          setActiveView('memo');
        }}
      />

      <ChangePasswordModal
        open={showChangePassword}
        onClose={() => setShowChangePassword(false)}
        onSubmit={handleChangePassword}
        onSignOut={signOut}
      />
    </div>
  );
}
