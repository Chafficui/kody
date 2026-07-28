# @kody/widget

The customer-facing chat widget. Ships as three bundles:

| File             | Format | Use it when…                                                  |
| ---------------- | ------ | ------------------------------------------------------------- |
| `dist/kody.js`   | IIFE   | You want a drop-in `<script src="…/kody.js">` and `window.Kody`. |
| `dist/kody.esm.js` | ESM | You import it from a bundler (React, Vue, Next.js, etc.).    |
| `dist/kody.umd.js` | UMD  | You're on a CommonJS/AMD/legacy bundler.                     |

`dist/kody.d.ts` is the public TypeScript declaration for all three.

---

## Quick start — IIFE

```html
<script
  src="https://your-cdn.example.com/kody.js"
  data-site-id="site_123"
  data-server-url="https://api.example.com"
  defer
></script>
```

The widget reads the `data-site-id` / `data-server-url` attributes
and sets `window.Kody` once the bubble is mounted.

You can also configure it via `window.KodyConfig` before the script
runs:

```html
<script>
  window.KodyConfig = {
    siteId: "site_123",
    serverUrl: "https://api.example.com",
    locale: "en",
    openOnLoad: false,
    prefillMessage: "Hi!",
    userId: "u_42",
    userTraits: { plan: "pro" },
    theme: "light",
    keyboardShortcut: "cmd+k,/",
  };
</script>
<script src="https://your-cdn.example.com/kody.js" defer></script>
```

### `data-*` attributes

| Attribute                | Type                          | Notes                                       |
| ------------------------ | ----------------------------- | ------------------------------------------- |
| `data-site-id`           | string (required)             |                                             |
| `data-server-url`        | URL                           | Overrides the script origin.                |
| `data-locale`            | string                        | Falls back to `en` for unknown locales.     |
| `data-open-on-load`      | `"true"` / `"false"`          | Auto-open after first paint.                |
| `data-prefill-message`   | string                        | Pre-fills the input, doesn't send.          |
| `data-user-id`           | string                        | Sent as `x-kody-user-id`.                   |
| `data-user-traits`       | JSON                          | Sent as `x-kody-user-traits`.               |
| `data-theme`             | `light` / `dark` / `auto`     | Runtime override.                           |
| `data-user-context`      | JSON                          | Sent as `x-kody-user-context`.              |
| `data-keyboard-shortcut` | chord list / `false`          | e.g. `cmd+k,/`. `false` disables.           |

`window.KodyConfig` always wins on conflict with `data-*`.

## Quick start — ESM

```bash
pnpm add @kody/widget
```

```ts
import { mount } from "@kody/widget";

const api = mount({
  siteId: "site_123",
  serverUrl: "https://api.example.com",
  userId: currentUser.id,
  userTraits: { plan: currentUser.plan },
});

await api.ready;

api.on("message", (msg) => {
  if (msg.role === "assistant") trackSupportAnswer(msg.content);
});

document.querySelector("#open-chat")?.addEventListener("click", () => {
  api.open();
});
```

## Quick start — React / Next.js

```tsx
// components/KodyWidget.tsx
import { useEffect, useRef } from "react";
import { mount, type KodyPublicAPI } from "@kody/widget";

export interface KodyWidgetProps {
  siteId: string;
  serverUrl: string;
  userId?: string;
  userTraits?: Record<string, unknown>;
  onOpen?: () => void;
  onMessage?: (msg: { role: "user" | "assistant"; content: string }) => void;
}

export function KodyWidget(props: KodyWidgetProps) {
  const apiRef = useRef<KodyPublicAPI | null>(null);

  useEffect(() => {
    const api = mount({
      siteId: props.siteId,
      serverUrl: props.serverUrl,
      userId: props.userId,
      userTraits: props.userTraits,
    });
    apiRef.current = api;
    const offs: Array<() => void> = [];
    if (props.onOpen) offs.push(api.on("open", props.onOpen));
    if (props.onMessage) offs.push(api.on("message", props.onMessage as any));
    return () => {
      offs.forEach((off) => off());
      api.destroy();
      apiRef.current = null;
    };
  }, [props.siteId, props.serverUrl, props.userId]);

  return null;
}
```

```tsx
// pages/_app.tsx
import { KodyWidget } from "@/components/KodyWidget";

export default function App({ Component, pageProps }) {
  return (
    <>
      <Component {...pageProps} />
      <KodyWidget
        siteId={process.env.NEXT_PUBLIC_KODY_SITE_ID!}
        serverUrl={process.env.NEXT_PUBLIC_KODY_SERVER_URL!}
        userId={pageProps.currentUser?.id}
        onOpen={() => console.log("opened")}
      />
    </>
  );
}
```

## Programmatic API

`window.Kody` and the object returned from `mount()` expose the
same surface:

| Method                              | What it does                                       |
| ----------------------------------- | -------------------------------------------------- |
| `open()` / `close()` / `toggle()`   | Show or hide the chat.                             |
| `destroy()`                         | Tear down the widget, remove the host element.    |
| `onOpen(cb)` / `onClose(cb)`        | Subscribe to legacy open/close callbacks.          |
| `sendMessage(text)`                 | Send a message as if the user typed it.            |
| `prefillInput(text)`                | Put text in the input without sending.             |
| `setUserContext(ctx)`               | Attach metadata to all future messages.            |
| `setLocale(locale)`                 | Switch the string table (falls back to `en`).      |
| `setTheme("light" | "dark" | "auto")` | Runtime override of the theme.                |
| `identify(userId, traits?)`         | Mark a known user — sent as `x-kody-user-id`.      |
| `on(event, cb) -> unsubscribe`      | Typed event emitter: `message`, `open`, `close`, `error`, `feedback`. |
| `version`                           | The widget version string.                         |
| `ready`                             | `Promise<void>` that resolves when init() is done. |

### Events

```ts
api.on("message", (e) => console.log(e.role, e.content));
api.on("open", () => analytics.track("chat_opened"));
api.on("close", () => analytics.track("chat_closed"));
api.on("error", ({ message }) => console.error(message));
api.on("feedback", ({ rating, messageIndex }) => analytics.track("feedback", { rating, messageIndex }));
```

## Accessibility

- `role="dialog"` + `aria-modal="true"` on the chat window.
- Focus moves to the input on open. Tab cycles through the dialog
  controls; Shift+Tab wraps from the first to the last; `Escape`
  closes the chat.
- `Cmd/Ctrl+K` (or any chord list you pass in
  `data-keyboard-shortcut`) toggles the chat. The handler is skipped
  when focus is in a text input, so the host page's own shortcuts
  still fire.
- `prefers-reduced-motion: reduce` disables transitions, the wiggle,
  and the pulse. `prefers-contrast: more` upgrades the bubble and
  dialog border to a 2px outline.

## Bundle size

The IIFE bundle is **~30.9 KB gzipped** (under the 35 KB cap).
The ESM and UMD bundles are larger because they expose the full
`mount()` / `KodyWidget` surface.
