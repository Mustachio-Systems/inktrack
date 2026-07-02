import { Link } from 'react-router-dom';
import { 
  TrendingUp, 
  DollarSign, 
  Zap, 
  Smartphone, 
  Layers, 
  ShieldCheck, 
  Clock, 
  Percent 
} from 'lucide-react';

export default function Landing() {
  return (
    <div className="bg-zinc-950 text-zinc-50 min-h-screen selection:bg-emerald-500 selection:text-zinc-950">
      
      {/* Navigation Header */}
      <nav className="max-w-7xl mx-auto px-6 py-6 flex justify-between items-center border-b border-zinc-900">
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 bg-emerald-500 rounded-lg flex items-center justify-center font-black text-zinc-950 text-xl tracking-tighter">
            i
          </div>
          <span className="text-xl font-black tracking-tight text-zinc-100">inktrack<span className="text-emerald-400">.</span></span>
        </div>
        <div className="flex items-center gap-4">
          <Link to="/login" className="text-sm font-semibold text-zinc-400 hover:text-zinc-200 transition-colors">
            Sign In
          </Link>
          <Link to="/signup" className="text-sm font-bold bg-zinc-100 hover:bg-zinc-200 text-zinc-950 px-4 py-2 rounded-xl transition-all shadow-md">
            Get Started Free
          </Link>
        </div>
      </nav>

      {/* Hero Section */}
      <header className="max-w-5xl mx-auto px-6 pt-20 pb-16 text-center">
        <div className="inline-flex items-center gap-2 bg-zinc-900 border border-zinc-800 px-3 py-1.5 rounded-full text-xs font-semibold text-emerald-400 mb-6 tracking-wide uppercase">
          <Zap className="w-3.5 h-3.5 animate-pulse" /> Forged For Tattoo Artists & Shop Owners
        </div>
        <h1 className="text-5xl md:text-7xl font-black tracking-tight leading-none mb-6 bg-gradient-to-b from-zinc-50 to-zinc-400 bg-clip-text text-transparent">
          Track every session.<br />Keep every dollar accounted for.
        </h1>
        <p className="text-lg md:text-xl text-zinc-400 max-w-2xl mx-auto mb-10 font-normal leading-relaxed">
          Stop calculating percentages on grease-stained sketchbooks. Run your custom studio, walk-ins, deposits, and split shop rates from one high-performance dashboard.
        </p>
        <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
          <Link to="/signup" className="w-full sm:w-auto text-center bg-emerald-500 hover:bg-emerald-600 text-zinc-950 font-black px-8 py-4 rounded-xl text-lg transition-all transform hover:-translate-y-0.5 shadow-lg shadow-emerald-500/10">
            Claim Your Ledger
          </Link>
          <a href="#features" className="w-full sm:w-auto text-center bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-300 font-bold px-8 py-4 rounded-xl text-lg transition-colors">
            See Feature Suite
          </a>
        </div>
      </header>

      {/* Interactive Value Grid */}
      <section id="features" className="max-w-7xl mx-auto px-6 py-20 border-t border-zinc-900">
        <div className="text-center mb-16">
          <h2 className="text-3xl font-bold tracking-tight mb-4">Built for the real-world shop workflow</h2>
          <p className="text-zinc-400 max-w-lg mx-auto">No corporate bloating. Just the raw utility you need between line-work and shading sessions.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          
          {/* Card 1: Multi-Type Logging */}
          <div className="bg-zinc-900/50 border border-zinc-900 p-6 rounded-2xl hover:border-zinc-800 transition-colors group">
            <div className="h-12 w-12 bg-zinc-900 border border-zinc-800 rounded-xl flex items-center justify-center mb-5 text-emerald-400 group-hover:bg-emerald-500 group-hover:text-zinc-950 transition-all">
              <Layers className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-bold mb-2 text-zinc-100">Walk-Ins & Appts</h3>
            <p className="text-zinc-400 text-sm leading-relaxed">Separate custom hourly flash work, multi-session backpieces, and quick walk-ins for crystal clear categorization.</p>
          </div>

          {/* Card 2: Micro Analytics */}
          <div className="bg-zinc-900/50 border border-zinc-900 p-6 rounded-2xl hover:border-zinc-800 transition-colors group">
            <div className="h-12 w-12 bg-zinc-900 border border-zinc-800 rounded-xl flex items-center justify-center mb-5 text-emerald-400 group-hover:bg-emerald-500 group-hover:text-zinc-950 transition-all">
              <TrendingUp className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-bold mb-2 text-zinc-100">Granular Analytics</h3>
            <p className="text-zinc-400 text-sm leading-relaxed">Instantly view metrics compiled by current hour, day, week, bi-weekly, month, and trailing 3-month/annual trends.</p>
          </div>

          {/* Card 3: Mobile First Optimization */}
          <div className="bg-zinc-900/50 border border-zinc-900 p-6 rounded-2xl hover:border-zinc-800 transition-colors group">
            <div className="h-12 w-12 bg-zinc-900 border border-zinc-800 rounded-xl flex items-center justify-center mb-5 text-emerald-400 group-hover:bg-emerald-500 group-hover:text-zinc-950 transition-all">
              <Smartphone className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-bold mb-2 text-zinc-100">Glove-Friendly UI</h3>
            <p className="text-zinc-400 text-sm leading-relaxed">Designed with massive touch targets and high-contrast visuals tailored to fast inputting directly from your station.</p>
          </div>

          {/* Card 4: Rate Splits & Cuts */}
          <div className="bg-zinc-900/50 border border-zinc-900 p-6 rounded-2xl hover:border-zinc-800 transition-colors group">
            <div className="h-12 w-12 bg-zinc-900 border border-zinc-800 rounded-xl flex items-center justify-center mb-5 text-emerald-400 group-hover:bg-emerald-500 group-hover:text-zinc-950 transition-all">
              <Percent className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-bold mb-2 text-zinc-100">Shop Split Rules</h3>
            <p className="text-zinc-400 text-sm leading-relaxed">Calculate exact breakdowns dynamically based on traditional 60/40 splits, hourly chair rentals, or material fees.</p>
          </div>

        </div>
      </section>

      {/* Footer Audit Baseline */}
      <footer className="max-w-7xl mx-auto px-6 py-12 border-t border-zinc-900 text-center md:flex md:justify-between md:items-center">
        <p className="text-xs text-zinc-600 mb-4 md:mb-0">&copy; 2026 inktrack. Cloudflare Architecture Tier. Audit-Ready Financial Security.</p>
        <div className="flex justify-center gap-6 text-xs text-zinc-500">
          <span className="flex items-center gap-1"><ShieldCheck className="w-3.5 h-3.5 text-emerald-500" /> Secure Encryption</span>
          <span className="flex items-center gap-1"><Clock className="w-3.5 h-3.5 text-emerald-500" /> Real-time Sync</span>
        </div>
      </footer>

    </div>
  );
}