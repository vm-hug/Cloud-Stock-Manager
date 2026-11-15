import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { io, Socket } from 'socket.io-client';
import { Role, StockDocStatus } from '@cloud-stock/shared';
import { api, GlobalToastEventDetail } from '../../lib/api';
import { useAuth } from '../auth/AuthContext';
import { useI18n } from '../i18n/I18nContext';
import { inventoryApi } from '../inventory/inventory.api';
import {
  CheckCircle2,
  AlertOctagon,
  AlertTriangle,
  Info,
  X,
} from 'lucide-react';
import './NotificationToast.scss';

export interface AppNotificationItem {
  id: string;
  type:
    | 'PENDING_APPROVAL'
    | 'DOCUMENT_APPROVED'
    | 'DOCUMENT_REJECTED'
    | 'LOW_STOCK_ALERT'
    | 'SYSTEM_INFO';
  titleVi: string;
  titleEn: string;
  messageVi: string;
  messageEn: string;
  documentId?: string;
  documentCode?: string;
  link: string;
  actorName?: string;
  createdAt: string;
  read: boolean;
}

interface ToastItem {
  id: string;
  type: 'success' | 'error' | 'warning' | 'info';
  title?: string;
  message: string;
  durationMs: number;
}

interface NotificationContextValue {
  notifications: AppNotificationItem[];
  unreadCount: number;
  markAsRead: (id: string) => void;
  markAllAsRead: () => void;
  clearNotifications: () => void;
  showToast: (toast: GlobalToastEventDetail) => void;
  refreshNotifications: () => Promise<void>;
}

const NotificationContext = createContext<NotificationContextValue | undefined>(undefined);

export const NotificationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, isAuthenticated } = useAuth();
  const { lang } = useI18n();
  const [notifications, setNotifications] = useState<AppNotificationItem[]>([]);
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const socketRef = useRef<Socket | null>(null);
  const readIdsRef = useRef<Set<string>>(new Set());

  const storageKey = user ? `cloudstock_notifs_${user.id}` : null;
  const readStorageKey = user ? `cloudstock_read_notifs_${user.id}` : null;

  // Load persisted read IDs and notifications for current user
  useEffect(() => {
    if (!storageKey || !readStorageKey) {
      setNotifications([]);
      readIdsRef.current = new Set();
      return;
    }
    try {
      const savedRead = localStorage.getItem(readStorageKey);
      if (savedRead) {
        readIdsRef.current = new Set(JSON.parse(savedRead));
      } else {
        readIdsRef.current = new Set();
      }

      const savedList = localStorage.getItem(storageKey);
      if (savedList) {
        const parsed: AppNotificationItem[] = JSON.parse(savedList);
        setNotifications(parsed);
      } else {
        setNotifications([]);
      }
    } catch {
      setNotifications([]);
    }
  }, [storageKey, readStorageKey]);

  const persistNotifications = useCallback(
    (next: AppNotificationItem[]) => {
      if (!storageKey) return;
      try {
        localStorage.setItem(storageKey, JSON.stringify(next.slice(0, 40)));
      } catch {
        // Ignore quota errors
      }
    },
    [storageKey]
  );

  const persistReadIds = useCallback(() => {
    if (!readStorageKey) return;
    try {
      localStorage.setItem(readStorageKey, JSON.stringify(Array.from(readIdsRef.current)));
    } catch {
      // Ignore
    }
  }, [readStorageKey]);

  const showToast = useCallback((detail: GlobalToastEventDetail) => {
    const id = `toast-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const durationMs = detail.durationMs || 3000;
    const item: ToastItem = {
      id,
      type: detail.type,
      title: detail.title,
      message: detail.message,
      durationMs,
    };

    setToasts((prev) => [item, ...prev].slice(0, 4));

    window.setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, durationMs);
  }, []);

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  // Listen to global `cloudstock:toast` events dispatched by api.ts or pages
  useEffect(() => {
    const handler = (event: Event) => {
      const custom = event as CustomEvent<GlobalToastEventDetail>;
      if (custom.detail && custom.detail.message) {
        showToast(custom.detail);
      }
    };
    window.addEventListener('cloudstock:toast', handler);
    return () => window.removeEventListener('cloudstock:toast', handler);
  }, [showToast]);

  const upsertNotification = useCallback(
    (incoming: Omit<AppNotificationItem, 'read'>) => {
      setNotifications((prev) => {
        const alreadyExists = prev.some((n) => n.id === incoming.id);
        if (alreadyExists) return prev;
        const isRead = readIdsRef.current.has(incoming.id);
        const nextItem: AppNotificationItem = {
          ...incoming,
          read: isRead,
        };
        const next = [nextItem, ...prev].slice(0, 40);
        persistNotifications(next);
        return next;
      });
    },
    [persistNotifications]
  );

  // Hydrate initial notifications from live backend state (pending approvals, approved/rejected docs, low stock)
  const refreshNotifications = useCallback(async () => {
    if (!isAuthenticated || !user) return;

    try {
      if (user.role === Role.ADMIN || user.role === Role.MANAGER) {
        const [pendingRes, lowStockRes] = await Promise.all([
          inventoryApi.getDocuments({ status: StockDocStatus.PENDING, limit: 15 }),
          inventoryApi.getLowStock({ limit: 8 }),
        ]);

        const hydrated: AppNotificationItem[] = [];

        if (pendingRes.success && pendingRes.data) {
          pendingRes.data.forEach((doc) => {
            const notifId = `pending-doc-${doc.id}`;
            const creatorName = doc.createdBy?.name || 'Staff';
            hydrated.push({
              id: notifId,
              type: 'PENDING_APPROVAL',
              titleVi: `Phiếu kho ${doc.documentCode} chờ phê duyệt`,
              titleEn: `Voucher ${doc.documentCode} awaiting approval`,
              messageVi: `${creatorName} đã gửi yêu cầu duyệt phiếu ${doc.documentCode} (${doc.type}).`,
              messageEn: `${creatorName} submitted voucher ${doc.documentCode} (${doc.type}) for approval.`,
              documentId: doc.id,
              documentCode: doc.documentCode,
              link: `/stock-documents/${doc.id}`,
              actorName: creatorName,
              createdAt: doc.updatedAt || doc.createdAt,
              read: readIdsRef.current.has(notifId),
            });
          });
        }

        if (lowStockRes.success && lowStockRes.data) {
          lowStockRes.data.slice(0, 5).forEach((bal) => {
            const notifId = `lowstock-${bal.warehouseId}-${bal.variantId}`;
            const sku = bal.variant?.sku || 'SKU';
            const whCode = bal.warehouse?.code || 'WH';
            hydrated.push({
              id: notifId,
              type: 'LOW_STOCK_ALERT',
              titleVi:
                bal.quantity === 0
                  ? `Hết hàng trong kho: ${sku}`
                  : `Sắp chạm định mức: ${sku}`,
              titleEn:
                bal.quantity === 0
                  ? `Out of stock: ${sku}`
                  : `Low stock threshold: ${sku}`,
              messageVi: `Mã ${sku} tại ${whCode} hiện còn ${bal.quantity} (định mức tối thiểu: ${bal.minThreshold}).`,
              messageEn: `SKU ${sku} at ${whCode} has ${bal.quantity} units left (min: ${bal.minThreshold}).`,
              link: '/inventory/low-stock',
              createdAt: bal.updatedAt,
              read: readIdsRef.current.has(notifId),
            });
          });
        }

        setNotifications((prev) => {
          const map = new Map<string, AppNotificationItem>();
          prev.forEach((item) => map.set(item.id, item));
          hydrated.forEach((item) => {
            if (!map.has(item.id)) {
              map.set(item.id, item);
            }
          });
          const merged = Array.from(map.values())
            .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
            .slice(0, 40);
          persistNotifications(merged);
          return merged;
        });
      } else {
        // STAFF: Hydrate recent approved or rejected documents created by this user
        const docsRes = await inventoryApi.getDocuments({
          createdById: user.id,
          limit: 15,
        });
        if (docsRes.success && docsRes.data) {
          const hydrated: AppNotificationItem[] = [];
          docsRes.data.forEach((doc) => {
            if (doc.status === StockDocStatus.POSTED) {
              const notifId = `posted-doc-${doc.id}`;
              const approverName = doc.approvedBy?.name || 'Quản lý kho';
              hydrated.push({
                id: notifId,
                type: 'DOCUMENT_APPROVED',
                titleVi: `Phiếu ${doc.documentCode} đã được phê duyệt`,
                titleEn: `Voucher ${doc.documentCode} approved`,
                messageVi: `${approverName} đã duyệt và ghi sổ phiếu ${doc.documentCode} (POSTED).`,
                messageEn: `${approverName} approved and posted voucher ${doc.documentCode}.`,
                documentId: doc.id,
                documentCode: doc.documentCode,
                link: `/stock-documents/${doc.id}`,
                actorName: approverName,
                createdAt: doc.postedAt || doc.updatedAt || doc.createdAt,
                read: readIdsRef.current.has(notifId),
              });
            } else if (doc.status === StockDocStatus.REJECTED) {
              const notifId = `rejected-doc-${doc.id}`;
              hydrated.push({
                id: notifId,
                type: 'DOCUMENT_REJECTED',
                titleVi: `Phiếu ${doc.documentCode} bị từ chối`,
                titleEn: `Voucher ${doc.documentCode} rejected`,
                messageVi: `Phiếu kho ${doc.documentCode} đã bị từ chối phê duyệt.`,
                messageEn: `Voucher ${doc.documentCode} was rejected during review.`,
                documentId: doc.id,
                documentCode: doc.documentCode,
                link: `/stock-documents/${doc.id}`,
                createdAt: doc.updatedAt || doc.createdAt,
                read: readIdsRef.current.has(notifId),
              });
            }
          });

          setNotifications((prev) => {
            const map = new Map<string, AppNotificationItem>();
            prev.forEach((item) => map.set(item.id, item));
            hydrated.forEach((item) => {
              if (!map.has(item.id)) {
                map.set(item.id, item);
              }
            });
            const merged = Array.from(map.values())
              .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
              .slice(0, 40);
            persistNotifications(merged);
            return merged;
          });
        }
      }
    } catch {
      // Non-blocking
    }
  }, [isAuthenticated, user, persistNotifications]);

  useEffect(() => {
    refreshNotifications();
  }, [refreshNotifications]);

  // Connect Socket.io for instant real-time notifications & live page synchronization
  useEffect(() => {
    if (!isAuthenticated || !user) {
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
      }
      return;
    }

    const token = api.getAccessToken();
    if (!token) return;

    const socket = io(api.getSocketOrigin(), {
      path: '/socket.io',
      auth: { token },
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionDelay: 1000,
    });

    socketRef.current = socket;

    socket.on('notification:new', (payload: Omit<AppNotificationItem, 'read'>) => {
      upsertNotification(payload);

      const isVi = (localStorage.getItem('cloud_stock_lang') || 'vi') === 'vi';
      const toastType =
        payload.type === 'DOCUMENT_APPROVED'
          ? 'success'
          : payload.type === 'DOCUMENT_REJECTED'
          ? 'error'
          : payload.type === 'LOW_STOCK_ALERT'
          ? 'warning'
          : 'info';

      showToast({
        type: toastType,
        title: isVi ? payload.titleVi : payload.titleEn,
        message: isVi ? payload.messageVi : payload.messageEn,
        durationMs: 3500,
      });
    });

    socket.on('stock-document:changed', (payload: unknown) => {
      window.dispatchEvent(
        new CustomEvent('cloudstock:stock-document-changed', { detail: payload })
      );
      refreshNotifications();
    });

    socket.on('inventory:changed', (payload: unknown) => {
      window.dispatchEvent(new CustomEvent('cloudstock:inventory-changed', { detail: payload }));
    });

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, [isAuthenticated, user, upsertNotification, showToast, refreshNotifications]);

  const markAsRead = useCallback(
    (id: string) => {
      readIdsRef.current.add(id);
      persistReadIds();
      setNotifications((prev) => {
        const next = prev.map((n) => (n.id === id ? { ...n, read: true } : n));
        persistNotifications(next);
        return next;
      });
    },
    [persistNotifications, persistReadIds]
  );

  const markAllAsRead = useCallback(() => {
    setNotifications((prev) => {
      prev.forEach((n) => readIdsRef.current.add(n.id));
      persistReadIds();
      const next = prev.map((n) => ({ ...n, read: true }));
      persistNotifications(next);
      return next;
    });
  }, [persistNotifications, persistReadIds]);

  const clearNotifications = useCallback(() => {
    setNotifications((prev) => {
      prev.forEach((n) => readIdsRef.current.add(n.id));
      persistReadIds();
      persistNotifications([]);
      return [];
    });
  }, [persistNotifications, persistReadIds]);

  const unreadCount = useMemo(
    () => notifications.filter((n) => !n.read).length,
    [notifications]
  );

  const value = useMemo<NotificationContextValue>(
    () => ({
      notifications,
      unreadCount,
      markAsRead,
      markAllAsRead,
      clearNotifications,
      showToast,
      refreshNotifications,
    }),
    [
      notifications,
      unreadCount,
      markAsRead,
      markAllAsRead,
      clearNotifications,
      showToast,
      refreshNotifications,
    ]
  );

  return (
    <NotificationContext.Provider value={value}>
      {children}

      {/* Fixed 3-Second Top-Right Alert Toast Container */}
      <div className="global-toast-stack" aria-live="polite">
        {toasts.map((item) => (
          <div key={item.id} className={`toast-alert-card ${item.type}`}>
            <div className="toast-icon-wrap">
              {item.type === 'success' && <CheckCircle2 size={19} />}
              {item.type === 'error' && <AlertOctagon size={19} />}
              {item.type === 'warning' && <AlertTriangle size={19} />}
              {item.type === 'info' && <Info size={19} />}
            </div>
            <div className="toast-body">
              <div className="toast-title">
                {item.title ||
                  (item.type === 'error'
                    ? lang === 'vi'
                      ? 'Cảnh báo lỗi thao tác'
                      : 'Operation Error'
                    : item.type === 'success'
                    ? lang === 'vi'
                      ? 'Thành công'
                      : 'Success'
                    : item.type === 'warning'
                    ? lang === 'vi'
                      ? 'Cảnh báo kho'
                      : 'Inventory Warning'
                    : lang === 'vi'
                    ? 'Thông báo thời gian thực'
                    : 'Real-time Notification')}
              </div>
              <div className="toast-msg">{item.message}</div>
            </div>
            <button
              type="button"
              className="toast-close-btn"
              onClick={() => dismissToast(item.id)}
              aria-label="Close"
            >
              <X size={15} />
            </button>
            <div
              className="toast-progress-bar"
              style={{ animationDuration: `${item.durationMs}ms` }}
            />
          </div>
        ))}
      </div>
    </NotificationContext.Provider>
  );
};

export function useNotifications(): NotificationContextValue {
  const ctx = useContext(NotificationContext);
  if (!ctx) {
    throw new Error('useNotifications must be used within a NotificationProvider');
  }
  return ctx;
}

