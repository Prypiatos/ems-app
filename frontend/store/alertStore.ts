import { create } from 'zustand';
import { devtools } from 'zustand/middleware';

export type AlertStatus = 'new' | 'acknowledged' | 'resolved';
export type AlertSeverity = 'critical' | 'warning' | 'info';

export interface AlertItem {
  id: string;
  node_id: string;
  type: string;
  severity: AlertSeverity;
  timestamp: number;
  message: string;
  status: AlertStatus;
}

interface AlertStore {
  alerts: AlertItem[];
  unreadCount: number;
  addAlert: (alert: Omit<AlertItem, 'status'> & { status?: AlertStatus }) => void;
  acknowledge: (id: string) => void;
  resolve: (id: string) => void;
}

export const useAlertStore = create<AlertStore>()(
  devtools(
    (set) => ({
      alerts: [],
      unreadCount: 0,
      addAlert: (alert) =>
        set(
          (state) => {
            const nextAlert: AlertItem = {
              ...alert,
              status: alert.status ?? 'new',
            };
            const isUnread = nextAlert.status === 'new' ? 1 : 0;
            return {
              alerts: [...state.alerts, nextAlert],
              unreadCount: state.unreadCount + isUnread,
            };
          },
          false,
          'alert/addAlert'
        ),
      acknowledge: (id) =>
        set(
          (state) => {
            let delta = 0;
            const alerts = state.alerts.map((alert) => {
              if (alert.id !== id) return alert;
              if (alert.status === 'new') delta = -1;
              return { ...alert, status: 'acknowledged' as const };
            });
            return {
              alerts,
              unreadCount: Math.max(0, state.unreadCount + delta),
            };
          },
          false,
          'alert/acknowledge'
        ),
      resolve: (id) =>
        set(
          (state) => {
            let delta = 0;
            const alerts = state.alerts.map((alert) => {
              if (alert.id !== id) return alert;
              if (alert.status === 'new') delta = -1;
              return { ...alert, status: 'resolved' as const };
            });
            return {
              alerts,
              unreadCount: Math.max(0, state.unreadCount + delta),
            };
          },
          false,
          'alert/resolve'
        ),
    }),
    {
      name: 'alert-store',
    }
  )
);
