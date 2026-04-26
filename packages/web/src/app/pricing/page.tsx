const SELF_HOSTED_FEATURES = [
  "Unlimited sites",
  "All ticket providers",
  "Full API access",
  "Community support",
  "MIT License",
];

const MANAGED_FEATURES = [
  "Everything in Self-Hosted, plus:",
  "Hosted infrastructure",
  "Automatic updates",
  "Priority support",
  "Analytics dashboard",
];

const FAQS = [
  {
    question: "Is Kody really free?",
    answer:
      "Yes. Kody is open source under the MIT license and will remain free forever. You can self-host it on your own infrastructure at no cost.",
  },
  {
    question: "Can I use it commercially?",
    answer:
      "Absolutely. The MIT license permits commercial use with no restrictions. Use it for client projects, SaaS products, or internal tools.",
  },
  {
    question: "Do I need my own AI?",
    answer:
      "Yes. Kody requires an OpenAI-compatible endpoint. You can use any provider: OpenAI, Ollama, vLLM, llama.cpp, or any other compatible backend.",
  },
  {
    question: "What about data privacy?",
    answer:
      "With the self-hosted plan, your data stays entirely on your servers. Kody never phones home. You have full control over where conversations are stored and processed.",
  },
];

function CheckIcon() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="shrink-0 text-primary"
    >
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

export default function PricingPage() {
  return (
    <main className="mx-auto max-w-5xl px-4 py-16 sm:px-6">
      {/* ── Header ──────────────────────────────────────────── */}
      <div className="mb-14 text-center">
        <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">Pricing</h1>
        <p className="mx-auto mt-4 max-w-xl text-lg text-muted-foreground">
          Simple, transparent pricing. Start for free, upgrade when you need managed infrastructure.
        </p>
      </div>

      {/* ── Cards ───────────────────────────────────────────── */}
      <div className="grid gap-8 md:grid-cols-2">
        {/* Self-Hosted */}
        <div className="flex flex-col rounded-xl border border-border bg-background p-8">
          <h2 className="mb-2 text-2xl font-bold">Self-Hosted</h2>
          <p className="mb-6 text-3xl font-bold text-primary">Free</p>
          <p className="mb-8 text-muted-foreground">
            Open source under MIT license. Host on your own infrastructure with full control.
          </p>
          <ul className="mb-8 flex flex-col gap-3">
            {SELF_HOSTED_FEATURES.map((feature) => (
              <li key={feature} className="flex items-center gap-3 text-sm">
                <CheckIcon />
                {feature}
              </li>
            ))}
          </ul>
          <div className="mt-auto">
            <a
              href="/docs"
              className="block rounded-lg bg-primary px-6 py-3 text-center text-base font-semibold text-white shadow-lg shadow-primary/25 transition-colors hover:bg-primary-dark"
            >
              Get Started
            </a>
          </div>
        </div>

        {/* Managed */}
        <div className="flex flex-col rounded-xl border-2 border-primary bg-background p-8">
          <div className="mb-2 flex items-center gap-3">
            <h2 className="text-2xl font-bold">Managed</h2>
            <span className="rounded-full bg-primary/10 px-3 py-0.5 text-xs font-semibold text-primary">
              Coming Soon
            </span>
          </div>
          <p className="mb-6 text-3xl font-bold text-primary">Coming Soon</p>
          <p className="mb-8 text-muted-foreground">
            We host everything for you. Zero infrastructure to manage.
          </p>
          <ul className="mb-8 flex flex-col gap-3">
            {MANAGED_FEATURES.map((feature, i) => (
              <li
                key={feature}
                className={`flex items-center gap-3 text-sm ${i === 0 ? "font-medium text-muted-foreground" : ""}`}
              >
                {i === 0 ? <span className="w-5" /> : <CheckIcon />}
                {feature}
              </li>
            ))}
          </ul>
          <div className="mt-auto">
            <button
              type="button"
              disabled
              className="block w-full cursor-not-allowed rounded-lg border border-border px-6 py-3 text-center text-base font-semibold text-muted-foreground opacity-60"
            >
              Notify Me
            </button>
          </div>
        </div>
      </div>

      {/* ── FAQ ─────────────────────────────────────────────── */}
      <section className="mt-24">
        <h2 className="mb-10 text-center text-3xl font-bold tracking-tight">
          Frequently Asked Questions
        </h2>
        <div className="mx-auto max-w-3xl divide-y divide-border">
          {FAQS.map((faq) => (
            <div key={faq.question} className="py-6">
              <h3 className="mb-2 text-lg font-semibold">{faq.question}</h3>
              <p className="leading-relaxed text-muted-foreground">{faq.answer}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Bottom CTA ──────────────────────────────────────── */}
      <section className="mt-20 text-center">
        <p className="text-lg text-muted-foreground">
          Have more questions?{" "}
          <a
            href="https://github.com/chafficui/kody/discussions"
            target="_blank"
            rel="noopener noreferrer"
            className="font-medium text-primary underline decoration-primary/30 underline-offset-4 transition-colors hover:text-primary-dark"
          >
            Join the discussion on GitHub
          </a>
        </p>
      </section>
    </main>
  );
}
