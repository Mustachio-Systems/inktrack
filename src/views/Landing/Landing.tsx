import { Link } from 'react-router-dom';
import {
  Layers,
  Percent,
  TrendingUp,
  Smartphone,
  ShieldCheck,
  Clock,
  Receipt,
  ArrowRight,
} from 'lucide-react';

// Flash-sheet-style feature entries. Design numbers are decorative
// (mirroring how real flash sheets are numbered in a shop binder),
// not a sequence, so they don't need to run 01/02/03.
const FEATURES = [
  {
    tag: 'No. 014',
    icon: Layers,
    title: 'Walk-ins & appointments',
    body: 'Keep flash walk-ins, multi-session backpieces, and deposits separate so nothing gets lumped together at tax time.',
    rotate: '-rotate-2',
  },
  {
    tag: 'No. 027',
    icon: Percent,
    title: 'Automatic shop splits',
    body: "Set your chair's cut once — 40/60, hourly rent, whatever your shop runs — and every session nets out correctly on its own.",
    rotate: 'rotate-1',
  },
  {
    tag: 'No. 038',
    icon: TrendingUp,
    title: 'Real-time rollups',
    body: "Hour, day, week, month, year — know what you've made without opening a spreadsheet between clients.",
    rotate: '-rotate-1',
  },
  {
    tag: 'No. 041',
    icon: Smartphone,
    title: 'Built for the chair',
    body: 'Big touch targets and high contrast so you can log a session one-handed, gloves still half on.',
    rotate: 'rotate-2',
  },
];

export default function Landing() {
  return (
    <div className="bg-[#16130F] text-[#EFE7D8] min-h-screen font-[Inter,sans-serif] selection:bg-[#A83A2C] selection:text-[#EFE7D8]">
      {/* Local font + keyframe setup.
          NOTE: for production, move these Google Fonts <link> tags into index.html:
          Rye | IBM Plex Sans (400,500,600,700) | IBM Plex Mono (400,500,600) */}
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Rye&family=IBM+Plex+Sans:wght@400;500;600;700&family=IBM+Plex+Mono:wght@400;500;600&display=swap');
        .font-display { font-family: 'Rye', serif; }
        .font-mono-ledger { font-family: 'IBM Plex Mono', monospace; }
        .font-body { font-family: 'IBM Plex Sans', sans-serif; }
        @keyframes printOut {
          from { clip-path: inset(0 0 100% 0); opacity: 0; transform: translateY(-8px); }
          to { clip-path: inset(0 0 0% 0); opacity: 1; transform: translateY(0); }
        }
        @keyframes stampIn {
          0% { transform: rotate(-14deg) scale(1.6); opacity: 0; }
          60% { transform: rotate(-10deg) scale(0.94); opacity: 1; }
          100% { transform: rotate(-12deg) scale(1); opacity: 1; }
        }
        .motion-safe-print { animation: printOut 700ms ease-out both; }
        .motion-safe-stamp { animation: stampIn 500ms 650ms cubic-bezier(0.34, 1.56, 0.64, 1) both; }
        @media (prefers-reduced-motion: reduce) {
          .motion-safe-print, .motion-safe-stamp { animation: none; }
        }
      `}</style>

      <div className="font-body">
        {/* Navigation */}
        <nav className="max-w-6xl mx-auto px-6 py-6 flex justify-between items-center border-b border-[#EFE7D8]/10">
          <div className="flex items-center gap-2.5">
            <div className="h-9 w-9 rounded-full border-2 border-[#C39A48] bg-[#A83A2C] flex items-center justify-center font-display text-lg text-[#EFE7D8]">
              i
            </div>
            <span className="text-xl font-display tracking-wide text-[#EFE7D8]">
              inktrack<span className="text-[#C39A48]">.</span>
            </span>
          </div>
          <div className="flex items-center gap-5">
            <Link
              to="/login"
              className="text-sm font-semibold text-[#EFE7D8]/70 hover:text-[#EFE7D8] transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#C39A48] rounded"
            >
              Sign In
            </Link>
            <Link
              to="/signup"
              className="text-sm font-bold bg-[#EFE7D8] hover:bg-white text-[#16130F] px-4 py-2.5 rounded-md transition-colors shadow-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#C39A48]"
            >
              Start Your Ledger
            </Link>
          </div>
        </nav>

        {/* Hero */}
        <header className="max-w-6xl mx-auto px-6 pt-16 pb-20 grid grid-cols-1 lg:grid-cols-[1.1fr,0.9fr] gap-14 items-center">
          <div>
            <div className="inline-flex items-center gap-2 border border-[#C39A48]/40 px-3 py-1.5 rounded-full text-[11px] font-mono-ledger font-medium text-[#C39A48] mb-7 tracking-[0.15em] uppercase">
              For artists who run their own books
            </div>
            <h1 className="font-display text-5xl md:text-6xl leading-[1.05] mb-6 text-[#EFE7D8]">
              Track every session.
              <br />
              Keep every dollar<br className="hidden md:block" /> you're owed.
            </h1>
            <p className="text-base md:text-lg text-[#EFE7D8]/70 max-w-lg mb-9 leading-relaxed">
              No more napkin math after a six-hour sleeve. Log walk-ins,
              appointments, and deposits, split the shop's cut automatically,
              and see exactly what's yours — in cash, card, or ATH Móvil.
            </p>
            <div className="flex flex-col sm:flex-row gap-4">
              <Link
                to="/signup"
                className="group inline-flex items-center justify-center gap-2 bg-[#A83A2C] hover:bg-[#c04430] text-[#EFE7D8] font-bold px-7 py-4 rounded-md text-base transition-all shadow-lg shadow-[#A83A2C]/20 active:scale-[0.97] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#C39A48]"
              >
                Start Your Ledger — Free
                <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5" />
              </Link>
              <a
                href="#flash-sheet"
                className="inline-flex items-center justify-center bg-transparent border border-[#EFE7D8]/25 hover:border-[#EFE7D8]/50 text-[#EFE7D8]/85 font-semibold px-7 py-4 rounded-md text-base transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#C39A48]"
              >
                See how it works
              </a>
            </div>
          </div>

          {/* Signature element: printed session receipt */}
          <div className="relative flex justify-center lg:justify-end">
            <div className="motion-safe-print relative w-full max-w-[320px] bg-[#EFE7D8] text-[#16130F] rounded-sm shadow-2xl shadow-black/50 px-6 pt-7 pb-10 -rotate-1">
              <div className="absolute -top-3 -right-3 motion-safe-stamp">
                <div className="h-16 w-16 rounded-full border-[3px] border-[#A83A2C] flex items-center justify-center rotate-[-12deg] bg-[#EFE7D8]/90">
                  <span className="font-display text-[10px] leading-tight text-center text-[#A83A2C] tracking-wide">
                    TRACKED
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-2 mb-4 text-[#16130F]/60">
                <Receipt className="w-3.5 h-3.5" />
                <span className="font-mono-ledger text-[10px] tracking-[0.2em] uppercase">
                  Session Receipt
                </span>
              </div>

              <p className="font-mono-ledger text-xs font-semibold mb-1">
                M. Ortiz — Half Sleeve
              </p>
              <p className="font-mono-ledger text-[10px] text-[#16130F]/50 mb-5">
                Session 3 of 5 · Today, 4:12 PM
              </p>

              <div className="border-t border-dashed border-[#16130F]/25 pt-4 space-y-2.5 font-mono-ledger text-sm">
                <div className="flex justify-between">
                  <span className="text-[#16130F]/60">Gross collected</span>
                  <span className="font-semibold">$220.00</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#16130F]/60">Shop cut (40%)</span>
                  <span className="font-semibold text-[#A83A2C]">
                    &minus;$88.00
                  </span>
                </div>
              </div>

              <div className="border-t-2 border-[#16130F] mt-4 pt-4 flex justify-between items-end">
                <span className="font-mono-ledger text-[10px] uppercase tracking-[0.15em] text-[#16130F]/60 mb-0.5">
                  Take-home
                </span>
                <span className="font-mono-ledger text-2xl font-bold">
                  $132.00
                </span>
              </div>

              {/* Barcode flourish */}
              <div className="flex items-end gap-[3px] h-6 mt-6 mb-1 opacity-70">
                {[3, 1, 2, 1, 4, 1, 2, 3, 1, 1, 2, 4, 1, 3, 2, 1, 1, 4, 2, 1].map(
                  (w, i) => (
                    <div
                      key={i}
                      className="bg-[#16130F]"
                      style={{ width: `${w}px`, height: '100%' }}
                    />
                  )
                )}
              </div>
              <p className="font-mono-ledger text-[9px] text-center text-[#16130F]/40 tracking-widest">
                LOGGED IN 9 SEC · ATH MÓVIL
              </p>
            </div>

            {/* Perforated tear edge */}
            <div
              className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-full max-w-[320px] h-4"
              style={{
                backgroundImage:
                  'radial-gradient(circle at 8px 0, #16130F 6px, transparent 6.5px)',
                backgroundSize: '16px 16px',
                backgroundPosition: 'top center',
                backgroundRepeat: 'repeat-x',
              }}
            />
          </div>
        </header>

        {/* Torn-edge section divider */}
        <div className="relative h-6 bg-[#EFE7D8]">
          <svg
            viewBox="0 0 1200 24"
            preserveAspectRatio="none"
            className="absolute -top-px left-0 w-full h-6"
          >
            <polygon
              points="0,0 1200,0 1200,24 1176,4 1152,24 1128,4 1104,24 1080,4 1056,24 1032,4 1008,24 984,4 960,24 936,4 912,24 888,4 864,24 840,4 816,24 792,4 768,24 744,4 720,24 696,4 672,24 648,4 624,24 600,4 576,24 552,4 528,24 504,4 480,24 456,4 432,24 408,4 384,24 360,4 336,24 312,4 288,24 264,4 240,24 216,4 192,24 168,4 144,24 120,4 96,24 72,4 48,24 24,4 0,24"
              fill="#16130F"
            />
          </svg>
        </div>

        {/* Feature "flash wall" */}
        <section
          id="flash-sheet"
          className="bg-[#EFE7D8] text-[#16130F] py-20"
        >
          <div className="max-w-6xl mx-auto px-6">
            <div className="text-center mb-16 max-w-xl mx-auto">
              <h2 className="font-display text-3xl md:text-4xl mb-4 text-[#16130F]">
                Everything that used to live on a sticky note
              </h2>
              <p className="text-[#16130F]/65 leading-relaxed">
                inktrack replaces the notebook, the calculator, and the
                guesswork with one ledger built for the way shops actually
                get paid.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              {FEATURES.map((f) => {
                const Icon = f.icon;
                return (
                  <div
                    key={f.tag}
                    className={`group relative bg-white ${f.rotate} hover:rotate-0 border border-[#16130F]/10 rounded-sm p-7 shadow-md hover:shadow-xl transition-all duration-300`}
                  >
                    {/* tape strip */}
                    <div className="absolute -top-2.5 left-8 w-14 h-5 bg-[#C39A48]/25 border border-[#C39A48]/30 -rotate-3" />

                    <div className="flex items-start justify-between mb-5">
                      <div className="h-11 w-11 rounded-full bg-[#16130F] flex items-center justify-center text-[#EFE7D8]">
                        <Icon className="w-5 h-5" />
                      </div>
                      <span className="font-mono-ledger text-[10px] text-[#16130F]/40 tracking-widest mt-1">
                        {f.tag}
                      </span>
                    </div>
                    <h3 className="text-lg font-bold mb-2 text-[#16130F]">
                      {f.title}
                    </h3>
                    <p className="text-[#16130F]/65 text-sm leading-relaxed">
                      {f.body}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* Closing CTA — ink stamp */}
        <section className="bg-[#16130F] py-20 text-center px-6">
          <h2 className="font-display text-3xl md:text-4xl mb-5 text-[#EFE7D8]">
            Close tonight's till in under a minute.
          </h2>
          <p className="text-[#EFE7D8]/65 max-w-md mx-auto mb-8">
            Free while you're building your book. No card required to start.
          </p>
          <Link
            to="/signup"
            className="inline-flex items-center gap-2 border-[3px] border-[#C39A48] text-[#C39A48] font-display text-lg tracking-wide px-8 py-4 rounded-full hover:bg-[#C39A48] hover:text-[#16130F] transition-all active:scale-[0.95] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#C39A48]"
          >
            Start Your Ledger
          </Link>
        </section>

        {/* Footer signage */}
        <footer className="border-t border-[#EFE7D8]/10 bg-[#16130F]">
          <div className="max-w-6xl mx-auto px-6 py-10 flex flex-col md:flex-row justify-between items-center gap-6">
            <p className="text-xs text-[#EFE7D8]/40 font-mono-ledger text-center md:text-left">
              &copy; 2026 inktrack. Built on Cloudflare. Your numbers, your
              ledger, always yours.
            </p>
            <div className="flex justify-center gap-6 text-xs text-[#EFE7D8]/50 font-mono-ledger uppercase tracking-wide">
              <span className="flex items-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5 text-[#C39A48]" /> Encrypted
              </span>
              <span className="flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-[#C39A48]" /> Real-time sync
              </span>
            </div>
          </div>
        </footer>
      </div>
    </div>
  );
}