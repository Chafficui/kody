export const BASE_STYLES = /* css */ `
*,
*::before,
*::after {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}

:host {
  --kody-position: right;
  --kody-shadow: 0 4px 24px rgba(0, 0, 0, 0.12);
  --kody-shadow-lg: 0 8px 40px rgba(0, 0, 0, 0.18);
  font-family: var(--kody-font, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif);
  font-size: 14px;
  line-height: 1.5;
  color: var(--kody-fg);
}

/* ── Floating bubble button ── */

.kody-bubble {
  position: fixed;
  bottom: 20px;
  right: 20px;
  left: auto;
  width: 56px;
  height: 56px;
  border-radius: 50%;
  border: none;
  background: var(--kody-primary);
  color: var(--kody-primary-fg);
  cursor: pointer;
  z-index: 9999;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: var(--kody-shadow);
  transition: transform 0.2s ease, box-shadow 0.2s ease;
}

:host([position="left"]) .kody-bubble,
.kody-bubble[data-position="left"] {
  right: auto;
  left: 20px;
}

.kody-bubble:hover {
  transform: scale(1.08);
  box-shadow: var(--kody-shadow-lg);
}

.kody-bubble:active {
  transform: scale(0.96);
}

.kody-bubble svg {
  width: 24px;
  height: 24px;
  fill: currentColor;
}

/* ── Bubble attention animations ── */

.kody-bubble--wiggle {
  animation: kody-wiggle 0.6s ease-in-out;
}

@keyframes kody-wiggle {
  0% { transform: rotate(0deg) scale(1); }
  15% { transform: rotate(-12deg) scale(1.1); }
  30% { transform: rotate(10deg) scale(1.1); }
  45% { transform: rotate(-8deg) scale(1.05); }
  60% { transform: rotate(6deg) scale(1.05); }
  75% { transform: rotate(-3deg) scale(1); }
  100% { transform: rotate(0deg) scale(1); }
}

.kody-tooltip {
  position: fixed;
  bottom: 84px;
  right: 20px;
  left: auto;
  background: var(--kody-bg, #fff);
  color: var(--kody-fg, #1a1a2e);
  padding: 10px 32px 10px 14px;
  border-radius: 12px;
  font-size: 14px;
  font-family: inherit;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
  z-index: 9998;
  opacity: 0;
  transform: translateY(8px) scale(0.95);
  transition: opacity 0.2s ease, transform 0.2s ease;
  pointer-events: none;
  white-space: nowrap;
}

.kody-tooltip--left {
  right: auto;
  left: 20px;
}

.kody-tooltip--visible {
  opacity: 1;
  transform: translateY(0) scale(1);
  pointer-events: auto;
}

.kody-tooltip::after {
  content: "";
  position: absolute;
  bottom: -6px;
  right: 24px;
  width: 12px;
  height: 12px;
  background: var(--kody-bg, #fff);
  transform: rotate(45deg);
  border-radius: 2px;
}

.kody-tooltip--left::after {
  right: auto;
  left: 24px;
}

.kody-tooltip-close {
  position: absolute;
  top: 4px;
  right: 6px;
  background: none;
  border: none;
  color: var(--kody-fg, #1a1a2e);
  opacity: 0.4;
  font-size: 16px;
  cursor: pointer;
  padding: 2px 6px;
  line-height: 1;
  transition: opacity 0.15s;
}

.kody-tooltip-close:hover {
  opacity: 0.8;
}

/* ── Chat window ── */

.kody-window {
  position: fixed;
  bottom: 88px;
  right: 20px;
  left: auto;
  width: 380px;
  max-height: 520px;
  height: 520px;
  border-radius: var(--kody-radius);
  background: var(--kody-bg);
  box-shadow: var(--kody-shadow-lg);
  display: flex;
  flex-direction: column;
  overflow: hidden;
  z-index: 9999;
  opacity: 0;
  transform: translateY(12px);
  transition: opacity 0.2s ease, transform 0.2s ease;
  pointer-events: none;
}

:host([position="left"]) .kody-window,
.kody-window[data-position="left"] {
  right: auto;
  left: 20px;
}

.kody-window--open {
  opacity: 1;
  transform: translateY(0);
  pointer-events: auto;
}

/* ── Header ── */

.kody-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 16px;
  background: var(--kody-primary);
  color: var(--kody-primary-fg);
  flex-shrink: 0;
}

.kody-header-info {
  display: flex;
  flex-direction: column;
  gap: 1px;
}

.kody-header-name {
  font-size: 15px;
  font-weight: 600;
  line-height: 1.3;
}

.kody-header-tagline {
  font-size: 12px;
  opacity: 0.85;
  line-height: 1.3;
}

.kody-header-actions {
  display: flex;
  align-items: center;
  gap: 4px;
}

.kody-header-btn {
  background: none;
  border: none;
  color: inherit;
  cursor: pointer;
  padding: 5px;
  border-radius: 6px;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background 0.15s ease;
  opacity: 0.85;
}

.kody-header-btn:hover {
  background: rgba(255, 255, 255, 0.15);
  opacity: 1;
}

.kody-header-btn svg {
  width: 16px;
  height: 16px;
}

/* ── Messages area ── */

.kody-messages {
  flex: 1 1 auto;
  overflow-y: auto;
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 10px;
  scroll-behavior: smooth;
}

.kody-messages::-webkit-scrollbar {
  width: 5px;
}

.kody-messages::-webkit-scrollbar-track {
  background: transparent;
}

.kody-messages::-webkit-scrollbar-thumb {
  background: rgba(0, 0, 0, 0.15);
  border-radius: 3px;
}

.kody-messages::-webkit-scrollbar-thumb:hover {
  background: rgba(0, 0, 0, 0.25);
}

/* ── Message bubbles ── */

.kody-message {
  max-width: 85%;
  padding: 10px 14px;
  border-radius: 14px;
  word-wrap: break-word;
  overflow-wrap: break-word;
  animation: kody-msg-in 0.2s ease;
}

.kody-message--assistant {
  align-self: flex-start;
  background: var(--kody-bubble-bg);
  color: var(--kody-fg);
  border-bottom-left-radius: 4px;
}

.kody-message--user {
  align-self: flex-end;
  background: var(--kody-user-bubble-bg);
  color: var(--kody-user-bubble-fg);
  border-bottom-right-radius: 4px;
}

@keyframes kody-msg-in {
  from {
    opacity: 0;
    transform: translateY(6px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

/* ── Message content (markdown) ── */

.kody-message-content {
  font-size: 14px;
  line-height: 1.55;
}

.kody-message-content p {
  margin: 0 0 8px;
}

.kody-message-content p:last-child {
  margin-bottom: 0;
}

.kody-message-content strong {
  font-weight: 600;
}

.kody-message-content em {
  font-style: italic;
}

.kody-message-content code {
  font-family: "SF Mono", SFMono-Regular, Consolas, "Liberation Mono", Menlo, monospace;
  font-size: 0.9em;
  background: rgba(0, 0, 0, 0.06);
  padding: 2px 5px;
  border-radius: 4px;
}

.kody-message--user .kody-message-content code {
  background: rgba(255, 255, 255, 0.18);
}

.kody-message-content pre {
  background: rgba(0, 0, 0, 0.06);
  border-radius: 8px;
  padding: 10px 12px;
  overflow-x: hidden;
  white-space: pre-wrap;
  word-break: break-word;
  margin: 8px 0;
}

.kody-message--user .kody-message-content pre {
  background: rgba(255, 255, 255, 0.12);
}

.kody-message-content pre code {
  background: none;
  padding: 0;
  font-size: 13px;
}

.kody-message-content a {
  color: var(--kody-primary);
  text-decoration: underline;
  text-underline-offset: 2px;
}

.kody-citation {
  display: inline;
  font-size: 10px;
  font-weight: 600;
  color: var(--kody-primary);
  text-decoration: none;
  vertical-align: super;
  line-height: 1;
  margin: 0 1px;
  transition: opacity 0.15s ease;
}

.kody-citation:hover {
  opacity: 0.7;
  text-decoration: underline;
}

.kody-message--user .kody-message-content a {
  color: inherit;
  opacity: 0.9;
}

.kody-message-content ul,
.kody-message-content ol {
  margin: 6px 0;
  padding-left: 20px;
}

.kody-message-content li {
  margin: 3px 0;
}

.kody-message-content br {
  content: "";
  display: block;
  margin-top: 4px;
}

/* ── Typing indicator ── */

.kody-typing {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 10px 14px;
  align-self: flex-start;
  background: var(--kody-bubble-bg);
  border-radius: 14px;
  border-bottom-left-radius: 4px;
}

.kody-typing span {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: var(--kody-fg);
  opacity: 0.4;
  animation: kody-bounce 1.2s ease-in-out infinite;
}

.kody-typing span:nth-child(2) {
  animation-delay: 0.15s;
}

.kody-typing span:nth-child(3) {
  animation-delay: 0.3s;
}

@keyframes kody-bounce {
  0%, 60%, 100% {
    transform: translateY(0);
  }
  30% {
    transform: translateY(-5px);
  }
}

/* ── Input bar ── */

.kody-input-bar {
  padding: 10px 12px;
  border-top: 1px solid rgba(0, 0, 0, 0.08);
  flex-shrink: 0;
  background: var(--kody-bg);
}

.kody-input-row {
  display: grid;
  grid-template-columns: 1fr 36px;
  align-items: end;
  gap: 8px;
}

.kody-input {
  display: block;
  width: 100%;
  min-width: 0;
  max-width: 100%;
  border: none;
  outline: none;
  background: transparent;
  color: var(--kody-fg);
  font-size: 16px;
  font-family: inherit;
  line-height: 1.4;
  padding: 6px 4px;
  resize: none;
  overflow: hidden;
  min-height: 28px;
  max-height: 120px;
  box-sizing: border-box;
  white-space: pre-wrap;
  word-break: break-word;
}

.kody-input::placeholder {
  color: var(--kody-fg);
  opacity: 0.45;
}

.kody-send-btn {
  flex-shrink: 0;
  width: 36px;
  height: 36px;
  border-radius: 50%;
  border: none;
  background: var(--kody-primary);
  color: var(--kody-primary-fg);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: opacity 0.15s ease, transform 0.15s ease;
}

.kody-send-btn:hover {
  transform: scale(1.06);
}

.kody-send-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
  transform: none;
}

.kody-send-btn svg {
  width: 18px;
  height: 18px;
  fill: currentColor;
}

/* ── Ticket form ── */

.kody-ticket-form {
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.kody-ticket-form label {
  display: flex;
  flex-direction: column;
  gap: 4px;
  font-size: 13px;
  font-weight: 500;
  color: var(--kody-fg);
}

.kody-ticket-form input,
.kody-ticket-form textarea {
  border: 1px solid rgba(0, 0, 0, 0.12);
  border-radius: 8px;
  padding: 8px 10px;
  font-size: 14px;
  font-family: inherit;
  color: var(--kody-fg);
  background: var(--kody-bg);
  outline: none;
  transition: border-color 0.15s ease;
}

.kody-ticket-form input:focus,
.kody-ticket-form textarea:focus {
  border-color: var(--kody-primary);
}

.kody-ticket-form textarea {
  min-height: 80px;
  resize: vertical;
}

.kody-ticket-form button {
  padding: 10px 16px;
  border: none;
  border-radius: 8px;
  background: var(--kody-primary);
  color: var(--kody-primary-fg);
  font-size: 14px;
  font-weight: 500;
  font-family: inherit;
  cursor: pointer;
  transition: opacity 0.15s ease;
}

.kody-ticket-form button:hover {
  opacity: 0.9;
}

.kody-ticket-form button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

/* ── Welcome ── */

.kody-welcome {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
  padding: 32px 24px;
  flex: 1 1 auto;
  gap: 12px;
  color: var(--kody-fg);
  opacity: 0.7;
}

.kody-welcome-title {
  font-size: 16px;
  font-weight: 600;
  opacity: 1;
}

.kody-welcome-text {
  font-size: 13px;
  line-height: 1.5;
}

/* ── AI Disclosure (Article 50) ── */

.kody-ai-disclosure {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 14px;
  background: rgba(0, 0, 0, 0.04);
  border-radius: 10px;
  font-size: 12px;
  line-height: 1.4;
  opacity: 1;
  color: var(--kody-fg);
  text-align: left;
  width: 100%;
}

.kody-ai-disclosure-icon {
  flex-shrink: 0;
  font-size: 14px;
}

/* ── Conversation starters ── */

.kody-starters {
  display: flex;
  flex-direction: column;
  gap: 6px;
  width: 100%;
  margin-top: 4px;
}

.kody-starter-btn {
  display: block;
  width: 100%;
  padding: 8px 12px;
  background: var(--kody-bg);
  border: 1px solid rgba(0, 0, 0, 0.1);
  border-radius: 10px;
  font-size: 13px;
  font-family: inherit;
  color: var(--kody-fg);
  cursor: pointer;
  text-align: left;
  transition: border-color 0.15s ease, background 0.15s ease;
  opacity: 1;
}

.kody-starter-btn:hover {
  border-color: var(--kody-primary);
  background: rgba(0, 0, 0, 0.02);
}

/* ── Follow-up suggestions ── */

.kody-suggestions {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  padding: 4px 14px 8px;
}

.kody-suggestion-btn {
  padding: 6px 12px;
  background: var(--kody-bg);
  border: 1px solid rgba(0, 0, 0, 0.1);
  border-radius: 16px;
  font-size: 12px;
  font-family: inherit;
  color: var(--kody-primary);
  cursor: pointer;
  transition: border-color 0.15s ease, background 0.15s ease;
  white-space: nowrap;
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
}

.kody-suggestion-btn:hover {
  border-color: var(--kody-primary);
  background: rgba(0, 0, 0, 0.02);
}

/* ── Feedback buttons ── */

.kody-feedback {
  display: flex;
  align-items: center;
  gap: 2px;
  margin-top: 4px;
  opacity: 0;
  transition: opacity 0.15s ease;
}

.kody-message:hover .kody-feedback,
.kody-feedback--voted {
  opacity: 1;
}

.kody-feedback-btn {
  background: none;
  border: none;
  padding: 3px 5px;
  cursor: pointer;
  color: var(--kody-fg);
  opacity: 0.35;
  border-radius: 4px;
  display: flex;
  align-items: center;
  transition: opacity 0.15s ease, background 0.15s ease;
}

.kody-feedback-btn:hover {
  opacity: 0.7;
  background: rgba(0, 0, 0, 0.05);
}

.kody-feedback-btn:disabled {
  cursor: default;
}

.kody-feedback-btn--active {
  opacity: 1 !important;
  color: var(--kody-primary);
}

/* ── Source citations ── */

.kody-sources {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 4px;
  margin-top: 6px;
  font-size: 11px;
}

.kody-sources-label {
  color: var(--kody-fg);
  opacity: 0.5;
  font-weight: 500;
}

.kody-source-link {
  color: var(--kody-primary);
  text-decoration: none;
  padding: 1px 6px;
  background: rgba(0, 0, 0, 0.04);
  border-radius: 4px;
  font-size: 11px;
  transition: background 0.15s ease;
}

a.kody-source-link:hover {
  background: rgba(0, 0, 0, 0.08);
  text-decoration: underline;
}

/* ── Tool indicator ── */

.kody-tool-indicator {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 14px;
  font-size: 12px;
  color: var(--kody-fg);
  opacity: 0.6;
  animation: kody-fade-in 0.2s ease;
}

.kody-tool-indicator--done {
  opacity: 0.4;
}

.kody-tool-spinner {
  width: 12px;
  height: 12px;
  border: 2px solid var(--kody-fg);
  border-top-color: transparent;
  border-radius: 50%;
  animation: kody-spin 0.8s linear infinite;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0;
}

.kody-tool-spinner--done {
  border: none;
  animation: none;
  font-size: 10px;
  color: var(--kody-fg);
}

@keyframes kody-spin {
  to { transform: rotate(360deg); }
}

/* ── Animations ── */

.kody-fade-in {
  animation: kody-fade-in 0.2s ease;
}

@keyframes kody-fade-in {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}

/* ── Chat sidebar ── */

.kody-sidebar {
  position: absolute;
  top: 0;
  left: 0;
  bottom: 0;
  width: 260px;
  background: var(--kody-bg);
  border-right: 1px solid rgba(0, 0, 0, 0.1);
  display: flex;
  flex-direction: column;
  z-index: 10;
  transform: translateX(-100%);
  transition: transform 0.2s ease;
  border-radius: var(--kody-radius) 0 0 var(--kody-radius);
}

.kody-sidebar--open {
  transform: translateX(0);
}

.kody-sidebar-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 14px;
  border-bottom: 1px solid rgba(0, 0, 0, 0.08);
  font-size: 14px;
  font-weight: 600;
}

.kody-sidebar-close {
  background: none;
  border: none;
  color: var(--kody-fg);
  cursor: pointer;
  padding: 4px;
  opacity: 0.5;
  font-size: 16px;
  line-height: 1;
}

.kody-sidebar-close:hover { opacity: 1; }

.kody-sidebar-new {
  margin: 10px 12px;
  padding: 8px 12px;
  background: var(--kody-primary);
  color: var(--kody-primary-fg);
  border: none;
  border-radius: 8px;
  font-size: 13px;
  font-family: inherit;
  cursor: pointer;
  font-weight: 500;
  transition: opacity 0.15s;
}

.kody-sidebar-new:hover { opacity: 0.9; }

.kody-sidebar-list {
  flex: 1;
  overflow-y: auto;
  padding: 4px 0;
}

.kody-sidebar-item {
  display: flex;
  align-items: center;
  padding: 10px 14px;
  cursor: pointer;
  transition: background 0.15s;
  gap: 8px;
  border-left: 3px solid transparent;
}

.kody-sidebar-item:hover { background: rgba(0, 0, 0, 0.04); }

.kody-sidebar-item--active {
  border-left-color: var(--kody-primary);
  background: rgba(0, 0, 0, 0.03);
}

.kody-sidebar-item-content {
  flex: 1;
  min-width: 0;
}

.kody-sidebar-item-title {
  font-size: 13px;
  font-weight: 500;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.kody-sidebar-item-time {
  font-size: 11px;
  opacity: 0.5;
  margin-top: 2px;
}

.kody-sidebar-item-delete {
  background: none;
  border: none;
  color: var(--kody-fg);
  opacity: 0;
  cursor: pointer;
  padding: 4px;
  font-size: 14px;
  line-height: 1;
  flex-shrink: 0;
  transition: opacity 0.15s;
}

.kody-sidebar-item:hover .kody-sidebar-item-delete { opacity: 0.4; }
.kody-sidebar-item-delete:hover { opacity: 0.8 !important; }

.kody-sidebar-empty {
  padding: 24px 14px;
  text-align: center;
  font-size: 13px;
  opacity: 0.5;
}

/* ── Responsive: full screen on mobile ── */

@media (max-width: 480px) {
  .kody-window {
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    width: 100vw;
    height: 100vh;
    height: 100dvh;
    max-height: 100vh;
    max-height: 100dvh;
    border-radius: 0;
  }

  .kody-bubble {
    bottom: calc(16px + env(safe-area-inset-bottom, 0px));
    right: calc(16px + env(safe-area-inset-right, 0px));
  }

  :host([position="left"]) .kody-bubble,
  .kody-bubble[data-position="left"] {
    left: calc(16px + env(safe-area-inset-left, 0px));
  }

  .kody-input-bar {
    padding-bottom: calc(10px + env(safe-area-inset-bottom, 0px));
  }

  .kody-send-btn {
    width: 44px;
    height: 44px;
  }

  .kody-header-btn {
    padding: 10px;
    min-width: 44px;
    min-height: 44px;
  }

  .kody-messages {
    -webkit-overflow-scrolling: touch;
    overscroll-behavior: contain;
  }
}

@media (max-width: 480px) and (orientation: landscape) {
  .kody-window {
    width: 380px;
    height: auto;
    max-height: 100dvh;
    top: 0;
    bottom: 0;
    right: 0;
    left: auto;
    border-radius: var(--kody-radius) 0 0 var(--kody-radius);
  }
}

/* ── Reduced motion ── */

@media (prefers-reduced-motion: reduce) {
  .kody-bubble,
  .kody-window,
  .kody-message,
  .kody-tooltip {
    transition: none;
    animation: none;
  }

  .kody-typing span {
    animation: none;
    opacity: 0.6;
  }

  .kody-tool-spinner {
    animation: none;
    border-style: dotted;
  }

  .kody-bubble--wiggle {
    animation: none;
  }

  .kody-bubble--pulse {
    animation: none;
  }
}

/* ── Bubble sizes ── */

.kody-bubble[data-size="sm"] { width: 48px; height: 48px; }
.kody-bubble[data-size="sm"] svg { width: 20px; height: 20px; }
.kody-bubble[data-size="lg"] { width: 64px; height: 64px; }
.kody-bubble[data-size="lg"] svg { width: 28px; height: 28px; }

/* ── Pulse animation on bubble ── */

@keyframes kody-pulse {
  0% { box-shadow: 0 0 0 0 var(--kody-primary); }
  70% { box-shadow: 0 0 0 12px transparent; }
  100% { box-shadow: 0 0 0 0 transparent; }
}
.kody-bubble--pulse { animation: kody-pulse 1.5s ease-out; }

/* ── Unread badge ── */

.kody-badge { position: absolute; top: -4px; right: -4px; min-width: 18px; height: 18px; border-radius: 9px; background: #ef4444; color: white; font-size: 11px; font-weight: 600; display: flex; align-items: center; justify-content: center; padding: 0 5px; border: 2px solid white; animation: kody-msg-in 0.2s ease; }
.kody-badge:empty { display: none; }

/* ── Custom icon in bubble ── */

.kody-bubble img { width: 28px; height: 28px; border-radius: 50%; object-fit: cover; }

/* ── Code block copy button ── */

.kody-message-content pre { position: relative; }
.kody-copy-btn { position: absolute; top: 6px; right: 6px; padding: 2px 8px; font-size: 11px; font-family: inherit; background: rgba(0,0,0,0.1); border: none; border-radius: 4px; color: inherit; cursor: pointer; opacity: 0; transition: opacity 0.15s; }
.kody-message-content pre:hover .kody-copy-btn { opacity: 1; }

/* ── Table styling ── */

.kody-message-content table { border-collapse: collapse; width: 100%; margin: 8px 0; font-size: 13px; }
.kody-message-content th, .kody-message-content td { border: 1px solid rgba(0,0,0,0.1); padding: 6px 10px; text-align: left; }
.kody-message-content th { background: rgba(0,0,0,0.04); font-weight: 600; }

/* ── Dark theme overrides ── */

:host([data-theme="dark"]) { --kody-bg: #1a1a2e; --kody-fg: #e4e4e7; --kody-bubble-bg: #2a2a3e; }
:host([data-theme="dark"]) .kody-message-content code { background: rgba(255,255,255,0.1); }
:host([data-theme="dark"]) .kody-message-content pre { background: rgba(255,255,255,0.08); }
:host([data-theme="dark"]) .kody-input-bar { border-top-color: rgba(255,255,255,0.1); }
:host([data-theme="dark"]) .kody-ticket-form input, :host([data-theme="dark"]) .kody-ticket-form textarea { border-color: rgba(255,255,255,0.15); }
:host([data-theme="dark"]) .kody-starter-btn { border-color: rgba(255,255,255,0.15); }
:host([data-theme="dark"]) .kody-starter-btn:hover { background: rgba(255,255,255,0.05); }
:host([data-theme="dark"]) .kody-suggestion-btn { border-color: rgba(255,255,255,0.15); }
:host([data-theme="dark"]) .kody-suggestion-btn:hover { background: rgba(255,255,255,0.05); }
:host([data-theme="dark"]) .kody-copy-btn { background: rgba(255,255,255,0.15); }
:host([data-theme="dark"]) .kody-message-content th { background: rgba(255,255,255,0.08); }
:host([data-theme="dark"]) .kody-message-content th, :host([data-theme="dark"]) .kody-message-content td { border-color: rgba(255,255,255,0.15); }
`;

export function createStyleSheet(themeVars: string): CSSStyleSheet {
  const sheet = new CSSStyleSheet();
  sheet.replaceSync(themeVars + BASE_STYLES);
  return sheet;
}
