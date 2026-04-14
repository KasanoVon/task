import { useState, useEffect } from 'react';

const API_BASE = import.meta.env.VITE_API_BASE ?? '';

function urlBase64ToUint8Array(base64String: string): ArrayBuffer {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = atob(base64);
  const arr = new Uint8Array([...rawData].map((c) => c.charCodeAt(0)));
  return arr.buffer;
}

export function usePush() {
  const supported =
    typeof Notification !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window;

  const [permission, setPermission] = useState<NotificationPermission>(() =>
    supported ? Notification.permission : 'denied'
  );
  const [subscribed, setSubscribed] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!supported) return;

    navigator.serviceWorker.ready.then((reg) => {
      reg.pushManager.getSubscription().then(async (sub) => {
        if (!sub) { setSubscribed(false); return; }
        setSubscribed(true);
        // ブラウザに購読があればサーバーへ再同期（スキーマ移行後の復旧対応）
        try {
          await fetch(`${API_BASE}/api/push/subscribe`, {
            method: 'POST',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ subscription: sub }),
          });
        } catch { /* 無視 */ }
      });
    });

    let permissionStatus: PermissionStatus | null = null;
    navigator.permissions.query({ name: 'notifications' as PermissionName }).then((ps) => {
      permissionStatus = ps;
      ps.onchange = () => {
        setPermission(ps.state as NotificationPermission);
        if (ps.state !== 'granted') setSubscribed(false);
      };
    }).catch(() => {});

    return () => { if (permissionStatus) permissionStatus.onchange = null; };
  }, [supported]);

  async function enable() {
    if (!supported || loading) return;
    setLoading(true);
    try {
      const perm = await Notification.requestPermission();
      setPermission(perm);
      if (perm !== 'granted') return;

      const reg = await navigator.serviceWorker.ready;
      const res = await fetch(`${API_BASE}/api/push/vapid-public-key`, { credentials: 'include' });
      if (!res.ok) return;
      const { publicKey } = await res.json() as { publicKey: string };

      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey),
      });

      await fetch(`${API_BASE}/api/push/subscribe`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subscription: sub }),
      });

      setSubscribed(true);
    } catch (e) {
      console.error('Push subscribe error:', e);
    } finally {
      setLoading(false);
    }
  }

  async function disable() {
    if (!supported || loading) return;
    setLoading(true);
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) await sub.unsubscribe();

      await fetch(`${API_BASE}/api/push/subscribe`, {
        method: 'DELETE',
        credentials: 'include',
      });

      setSubscribed(false);
    } catch (e) {
      console.error('Push unsubscribe error:', e);
    } finally {
      setLoading(false);
    }
  }

  return { supported, permission, subscribed, loading, enable, disable };
}
