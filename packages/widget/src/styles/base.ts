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
  --kody-radius: 12px;
  --kody-shadow: 0 4px 24px rgba(0, 0, 0, 0.12);
  --kody-shadow-lg: 0 8px 40px rgba(0, 0, 0, 0.18);
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
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
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
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

.kody-close-btn {
  background: none;
  border: none;
  color: inherit;
  cursor: pointer;
  padding: 4px;
  border-radius: 6px;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background 0.15s ease;
}

.kody-close-btn:hover {
  background: rgba(255, 255, 255, 0.15);
}

.kody-close-btn svg {
  width: 18px;
  height: 18px;
  fill: currentColor;
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
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 11px;
  font-weight: 600;
  min-width: 18px;
  height: 18px;
  padding: 0 4px;
  border-radius: 4px;
  background: var(--kody-primary);
  color: var(--kody-primary-fg);
  text-decoration: none;
  vertical-align: super;
  line-height: 1;
  margin: 0 1px;
  transition: opacity 0.15s ease;
}

.kody-citation:hover {
  opacity: 0.8;
  text-decoration: none;
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
  gap: 8px;
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

/* ── Responsive: full screen on mobile ── */

@media (max-width: 480px) {
  .kody-window {
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    width: 100vw;
    height: 100vh;
    max-height: 100vh;
    border-radius: 0;
  }

  .kody-bubble {
    bottom: 16px;
    right: 16px;
  }

  :host([position="left"]) .kody-bubble,
  .kody-bubble[data-position="left"] {
    left: 16px;
  }
}
`;

export function createStyleSheet(themeVars: string): CSSStyleSheet {
  const sheet = new CSSStyleSheet();
  sheet.replaceSync(themeVars + BASE_STYLES);
  return sheet;
}
