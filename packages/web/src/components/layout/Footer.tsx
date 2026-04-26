import Link from "next/link";

export default function Footer() {
  return (
    <footer className="border-t border-border bg-muted/50">
      <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-4 py-8 sm:flex-row sm:px-6">
        <div className="text-center sm:text-left">
          <p className="text-sm font-medium text-foreground">
            Kody &mdash; Open source AI assistant
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            MIT License &middot; &copy; 2026 Felix Bein&szlig;en
          </p>
        </div>

        <div className="flex items-center gap-4">
          <a
            href="https://github.com/chafficui/kody"
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            GitHub
          </a>
          <Link
            href="/docs"
            className="text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            Docs
          </Link>
          <Link
            href="#"
            className="text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            Privacy
          </Link>
        </div>
      </div>
    </footer>
  );
}
