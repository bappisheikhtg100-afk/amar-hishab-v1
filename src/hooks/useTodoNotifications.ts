import { useCallback, useEffect, useState } from 'react';
import { Capacitor } from '@capacitor/core';
import { LocalNotifications } from '@capacitor/local-notifications';
import { ScheduledTodo } from '../types/finance';

const CHANNEL_ID = 'amar_hisab_reminders';

function toNativeNotificationId(todoId: number): number {
  return (Math.abs(Math.trunc(Number(todoId))) % 2147480000) + 1;
}

function mapCapPerm(
  display: 'prompt' | 'prompt-with-rationale' | 'granted' | 'denied'
): NotificationPermission {
  if (display === 'granted') return 'granted';
  if (display === 'denied') return 'denied';
  return 'default';
}

function playSoftReminderChime() {
  try {
    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext })
        .webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const notes = [587.33, 880];
    notes.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.001, ctx.currentTime + idx * 0.16);
      gain.gain.exponentialRampToValueAtTime(
        0.12,
        ctx.currentTime + idx * 0.16 + 0.03
      );
      gain.gain.exponentialRampToValueAtTime(
        0.001,
        ctx.currentTime + idx * 0.16 + 0.45
      );
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(ctx.currentTime + idx * 0.16);
      osc.stop(ctx.currentTime + idx * 0.16 + 0.5);
    });
  } catch {
    // Audio autoplay blocked or unsupported
  }
}

async function dispatchSystemNotification(todo: ScheduledTodo) {
  const title = `রিমাইন্ডার: ${todo.title}`;
  const body = todo.note || 'আপনার নির্ধারিত কাজের সময় হয়েছে।';

  if (Capacitor.isNativePlatform()) {
    try {
      await LocalNotifications.schedule({
        notifications: [
          {
            id: toNativeNotificationId(todo.id),
            title,
            body,
            channelId: CHANNEL_ID,
            schedule: {
              at: new Date(Date.now() + 500),
              allowWhileIdle: true,
            },
          },
        ],
      });
    } catch {
      // Handled by in-app alert banner
    }
    return;
  }

  if (
    typeof Notification === 'undefined' ||
    Notification.permission !== 'granted'
  ) {
    return;
  }

  const options: NotificationOptions = {
    body,
    icon: './pwa-192x192.png',
    badge: './pwa-192x192.png',
    tag: `todo-${todo.id}`,
  };

  try {
    if ('serviceWorker' in navigator) {
      const reg = await navigator.serviceWorker.getRegistration();
      if (reg && reg.showNotification) {
        await reg.showNotification(title, options);
        return;
      }
    }
    new Notification(title, options);
  } catch {
    // Fallback handled by in-app alert banner
  }
}

export function useTodoNotifications(
  todos: ScheduledTodo[],
  markTodoNotified: (id: number) => void
) {
  const [activeDueTodo, setActiveDueTodo] = useState<ScheduledTodo | null>(
    null
  );
  const [permissionState, setPermissionState] =
    useState<NotificationPermission>(() => {
      if (Capacitor.isNativePlatform()) return 'default';
      return typeof Notification !== 'undefined'
        ? Notification.permission
        : 'default';
    });

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;

    let mounted = true;
    void (async () => {
      try {
        await LocalNotifications.createChannel({
          id: CHANNEL_ID,
          name: 'আমার হিসাব রিমাইন্ডার',
          description: 'শিডিউল টাস্ক ও জরুরি কাজের অফলাইন নোটিফিকেশন',
          importance: 5,
          visibility: 1,
          vibration: true,
        });
      } catch {
        // Channel creation only needed on Android 8+
      }

      try {
        const status = await LocalNotifications.checkPermissions();
        if (mounted) {
          setPermissionState(mapCapPerm(status.display));
          if (status.display === 'prompt') {
            const req = await LocalNotifications.requestPermissions();
            if (mounted) setPermissionState(mapCapPerm(req.display));
          }
        }
      } catch {
        // Ignore
      }
    })();

    return () => {
      mounted = false;
    };
  }, []);

  const requestNotificationPermission = useCallback(async () => {
    if (Capacitor.isNativePlatform()) {
      try {
        const res = await LocalNotifications.requestPermissions();
        const mapped = mapCapPerm(res.display);
        setPermissionState(mapped);
        return mapped;
      } catch {
        return 'denied' as NotificationPermission;
      }
    }

    if (typeof Notification === 'undefined') {
      return 'denied' as NotificationPermission;
    }
    try {
      const res = await Notification.requestPermission();
      setPermissionState(res);
      return res;
    } catch {
      return 'denied' as NotificationPermission;
    }
  }, []);

  // Sync upcoming pending todos to Native Android AlarmManager (works offline & while idle)
  useEffect(() => {
    if (!Capacitor.isNativePlatform() || permissionState !== 'granted') return;

    void (async () => {
      try {
        const pending = await LocalNotifications.getPending();
        if (pending.notifications.length > 0) {
          await LocalNotifications.cancel({
            notifications: pending.notifications.map((n) => ({ id: n.id })),
          });
        }

        const now = Date.now();
        const upcoming = todos.filter((t) => {
          if (t.completed || t.notified || !t.scheduledAt) return false;
          const due = new Date(t.scheduledAt).getTime();
          return !Number.isNaN(due) && due > now + 2000;
        });

        if (upcoming.length > 0) {
          await LocalNotifications.schedule({
            notifications: upcoming.map((todo) => ({
              id: toNativeNotificationId(todo.id),
              title: `রিমাইন্ডার: ${todo.title}`,
              body: todo.note || 'আপনার নির্ধারিত কাজের সময় হয়েছে।',
              channelId: CHANNEL_ID,
              schedule: {
                at: new Date(todo.scheduledAt),
                allowWhileIdle: true,
              },
            })),
          });
        }
      } catch {
        // Ignore native scheduling errors
      }
    })();
  }, [todos, permissionState]);

  useEffect(() => {
    const checkDueTasks = () => {
      const now = Date.now();
      for (const todo of todos) {
        if (todo.completed || todo.notified || !todo.scheduledAt) continue;
        const dueTime = new Date(todo.scheduledAt).getTime();
        if (!Number.isNaN(dueTime) && dueTime <= now) {
          markTodoNotified(todo.id);
          setActiveDueTodo(todo);
          playSoftReminderChime();
          void dispatchSystemNotification(todo);
          break;
        }
      }
    };

    checkDueTasks();
    const timer = window.setInterval(checkDueTasks, 10000);
    return () => window.clearInterval(timer);
  }, [todos, markTodoNotified]);

  return {
    activeDueTodo,
    dismissDueTodo: () => setActiveDueTodo(null),
    permissionState,
    requestNotificationPermission,
  };
}
