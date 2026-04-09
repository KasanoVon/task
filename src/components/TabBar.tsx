type Tab = 'focus' | 'list' | 'cal' | 'done';

interface Props {
  active: Tab;
  onFocus: () => void;
  onList: () => void;
  onCal: () => void;
  onDone: () => void;
}

export function TabBar({ active, onFocus, onList, onCal, onDone }: Props) {
  return (
    <div className="tab-bar">
      <button className={`tab-item${active === 'focus' ? ' active' : ''}`} onClick={onFocus}>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="3"/><circle cx="12" cy="12" r="9"/>
        </svg>
        <span>フォーカス</span>
      </button>
      <button className={`tab-item${active === 'list' ? ' active' : ''}`} onClick={onList}>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/>
          <circle cx="3" cy="6" r="1" fill="currentColor"/><circle cx="3" cy="12" r="1" fill="currentColor"/><circle cx="3" cy="18" r="1" fill="currentColor"/>
        </svg>
        <span>リスト</span>
      </button>
      <button className={`tab-item${active === 'cal' ? ' active' : ''}`} onClick={onCal}>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
        </svg>
        <span>カレンダー</span>
      </button>
      <button className={`tab-item${active === 'done' ? ' active' : ''}`} onClick={onDone}>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="9"/><polyline points="9,12 11,14 15,10"/>
        </svg>
        <span>完了</span>
      </button>
    </div>
  );
}
