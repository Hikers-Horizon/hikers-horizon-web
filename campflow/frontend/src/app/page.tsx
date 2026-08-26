import Link from "next/link";

const PLANS = [
  { name: "Starter", price: 499, features: ["1 user", "500 leads", "3 active trips", "Follow-up reminders"] },
  { name: "Growth", price: 999, features: ["5 users", "Unlimited leads", "Unlimited trips", "WhatsApp integration", "Payment tracking", "Analytics"], highlight: true },
  { name: "Pro", price: 1999, features: ["10 users", "WhatsApp automation", "Advanced analytics", "Lead scoring", "Priority support"] },
];

export default function LandingPage() {
  return (
    <main>
      <nav className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
        <span className="text-xl font-bold text-brand-700">CampFlow</span>
        <div className="flex gap-3">
          <Link href="/login" className="btn-secondary">Log in</Link>
          <Link href="/signup" className="btn-primary">Start Managing Your Leads</Link>
        </div>
      </nav>

      <section className="mx-auto max-w-4xl px-6 py-20 text-center">
        <h1 className="text-4xl font-extrabold tracking-tight sm:text-5xl">Turn Trek Enquiries Into Confirmed Bookings.</h1>
        <p className="mt-6 text-lg text-gray-600 dark:text-gray-400">
          CampFlow helps trekking operators manage leads, follow-ups, bookings and payments from one simple dashboard.
        </p>
        <div className="mt-8">
          <Link href="/signup" className="btn-primary px-6 py-3 text-base">Start Managing Your Leads</Link>
        </div>
      </section>

      <section className="mx-auto max-w-5xl px-6 py-16">
        <h2 className="text-center text-2xl font-bold">The Problem</h2>
        <p className="mx-auto mt-4 max-w-2xl text-center text-gray-600 dark:text-gray-400">
          Enquiries pour in through WhatsApp, Instagram, phone calls and your website — and most get forgotten before they ever become a booking.
        </p>
      </section>

      <section className="mx-auto max-w-5xl px-6 py-16">
        <h2 className="text-center text-2xl font-bold">How It Works</h2>
        <div className="mt-8 grid grid-cols-1 gap-4 text-center sm:grid-cols-4">
          {["Capture the lead", "Follow up automatically", "Confirm the booking", "Track the payment"].map((step, i) => (
            <div key={step} className="card">
              <div className="text-brand-600 text-2xl font-bold">{i + 1}</div>
              <div className="mt-2 font-medium">{step}</div>
            </div>
          ))}
        </div>
      </section>

      <section id="pricing" className="mx-auto max-w-5xl px-6 py-16">
        <h2 className="text-center text-2xl font-bold">Pricing</h2>
        <div className="mt-8 grid grid-cols-1 gap-6 sm:grid-cols-3">
          {PLANS.map((plan) => (
            <div key={plan.name} className={`card ${plan.highlight ? "ring-2 ring-brand-500" : ""}`}>
              <div className="text-lg font-bold">{plan.name}</div>
              <div className="mt-2 text-3xl font-extrabold">₹{plan.price}<span className="text-sm font-normal">/month</span></div>
              <ul className="mt-4 space-y-2 text-sm text-gray-600 dark:text-gray-400">
                {plan.features.map((f) => <li key={f}>✓ {f}</li>)}
              </ul>
            </div>
          ))}
        </div>
      </section>

      <footer className="border-t border-gray-200 py-8 text-center text-sm text-gray-500 dark:border-gray-800">
        © {new Date().getFullYear()} CampFlow. Built for trekking operators.
      </footer>
    </main>
  );
}
