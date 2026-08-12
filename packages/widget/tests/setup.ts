// Test setup: jsdom does not implement constructed stylesheets
// (CSSStyleSheet + replaceSync), but our widget uses them to host the
// shadow DOM styles. The polyfill below is enough for our tests; the
// browser already has the real implementation.

if (typeof globalThis.CSSStyleSheet === "undefined" || !globalThis.CSSStyleSheet.prototype.replaceSync) {
  class FakeCSSStyleSheet {
    cssText = "";
    replaceSync(text: string) {
      this.cssText = text;
    }
  }
  // jsdom does provide a stub CSSStyleSheet class, but no replaceSync.
  // We patch the prototype instead of replacing the global.
  const proto = (globalThis as any).CSSStyleSheet?.prototype;
  if (proto && !proto.replaceSync) {
    proto.replaceSync = function (text: string) {
      this.cssText = text;
    };
  } else {
    (globalThis as any).CSSStyleSheet = FakeCSSStyleSheet;
  }
}
