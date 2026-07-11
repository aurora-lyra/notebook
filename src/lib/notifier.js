/**
 * Notification system — browser Notification API + in-page bubble fallback.
 */

/* ---- Permission ---- */

/** Request browser notification permission. Returns 'granted' | 'denied' | 'default'. */
export async function requestPermission() {
  if (!('Notification' in window)) return 'denied';
  if (Notification.permission === 'granted') return 'granted';
  return await Notification.requestPermission();
}

/** Check if browser notifications are available and permitted */
export function canNotify() {
  return 'Notification' in window && Notification.permission === 'granted';
}

/* ---- Browser Notification ---- */

/** Send a browser system notification */
export function sendBrowserNotification(title, body, { tag, onclick } = {}) {
  if (!canNotify()) return false;

  const n = new Notification(title, {
    body,
    icon: '/favicon.svg',
    tag: tag || `notebook-${Date.now()}`,
    silent: false,
  });

  if (onclick) {
    n.onclick = () => {
      window.focus();
      onclick();
      n.close();
    };
  }

  // Auto-close after 8 seconds
  setTimeout(() => n.close(), 8000);
  return true;
}

/* ---- In-Page Bubble ---- */

let bubbleContainer = null;

function getContainer() {
  if (bubbleContainer) return bubbleContainer;

  bubbleContainer = document.createElement('div');
  bubbleContainer.id = 'notebook-bubbles';
  Object.assign(bubbleContainer.style, {
    position: 'fixed',
    top: '20px',
    right: '20px',
    zIndex: '9999',
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
    pointerEvents: 'none',
  });
  document.body.appendChild(bubbleContainer);
  return bubbleContainer;
}

/**
 * Show an in-page bubble notification (fallback).
 * Auto-dismisses after `duration` ms.
 */
export function showBubble(title, body, { duration = 5000, onclick } = {}) {
  const container = getContainer();

  const el = document.createElement('div');
  Object.assign(el.style, {
    background: '#ffffff',
    border: '1px solid #e8e8e5',
    borderRadius: '10px',
    padding: '12px 16px',
    maxWidth: '320px',
    boxShadow: '0 8px 24px rgba(0,0,0,0.08), 0 0 1px rgba(0,0,0,0.06)',
    fontFamily: 'ui-sans-serif, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    cursor: onclick ? 'pointer' : 'default',
    pointerEvents: 'auto',
    transform: 'translateX(120%)',
    transition: 'transform 0.3s cubic-bezier(0.25,0.46,0.45,0.94), opacity 0.3s ease',
    opacity: '0',
  });

  el.innerHTML = `
    <div style="font-size:13px;font-weight:600;color:#191919;margin-bottom:2px;">${escapeHtml(title)}</div>
    <div style="font-size:12px;color:#6b6b6b;line-height:1.4;">${escapeHtml(body)}</div>
  `;

  if (onclick) {
    el.onclick = () => {
      onclick();
      dismiss();
    };
  }

  container.appendChild(el);

  // Animate in
  requestAnimationFrame(() => {
    el.style.transform = 'translateX(0)';
    el.style.opacity = '1';
  });

  function dismiss() {
    el.style.transform = 'translateX(120%)';
    el.style.opacity = '0';
    setTimeout(() => el.remove(), 300);
  }

  // Auto-dismiss
  const timer = setTimeout(dismiss, duration);

  // Hover to pause
  el.onmouseenter = () => clearTimeout(timer);
  el.onmouseleave = () => setTimeout(dismiss, duration);

  return dismiss;
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

/* ---- Unified notify ---- */

/**
 * Send a notification: tries browser first, falls back to bubble.
 */
export function notify(title, body, options = {}) {
  const sent = sendBrowserNotification(title, body, options);
  if (!sent) {
    showBubble(title, body, options);
  }
}
