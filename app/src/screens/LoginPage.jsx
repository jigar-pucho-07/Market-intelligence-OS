'use client';
import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from '../lib/router';
import Input from '../components/ui/Input';
import { Select } from 'antd';
import { AUTH } from '../config/os.config';
import { useRevealStagger, useEntrance } from '../hooks/useGsapMotion';

// Template Icons
import puchoLogo from '../assets/brand/logo.png';
import { OS } from '../config/os.config';
import { homeFor } from '../config/roles';
import UserIcon from '../assets/icons/user.png';
import LockIcon from '../assets/icons/lock.png';
import ArrowRightIcon from '../assets/icons/arrow-right.png';
import { ThemeToggle } from '../components/Header';
import { PoweredBy } from '../components/BrandMark';
import SparklesIcon from '../assets/icons/sparkles.png';
import CircleIcon from '../assets/icons/agent.png';

import mascot1 from '../assets/mascot_1.png';
import mascot3 from '../assets/mascot_3.png';
import mascot4 from '../assets/mascot_4.png';
import mascot5 from '../assets/mascot_5.png';

// Floating Mascot Component (Individual Images) with Gaze Tracking
const Mascot = ({ imageSrc, delay, x, y, size = "w-16 h-16", cursorColor = "text-info", cursorRotation = "0deg" }) => {
  return (
    <div
      className={`absolute ${x} ${y} z-20 animate-float transition-all duration-300 hover:scale-110 hover:rotate-6 cursor-pointer pointer-events-auto`}
      style={{
        animationDelay: `${delay}s`
      }}
    >
      <div className={`${size} rounded-full overflow-hidden shadow-lg relative bg-white/50 backdrop-blur-sm border border-white/40`}>
        <img
          src={imageSrc}
          alt="User"
          className="w-full h-full object-cover"
        />
      </div>
      <div
        className={`absolute -bottom-3 -right-3 ${cursorColor} drop-shadow-md`}
        style={{ transform: `rotate(${cursorRotation})` }}
      >
        <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
          <path d="M3.5 3.5L10.5 20.5L13.5 13.5L20.5 10.5L3.5 3.5Z" stroke="white" strokeWidth="2" strokeLinejoin="round" />
        </svg>
      </div>
    </div>
  );
};

export default function LoginPage({ otpAvailable = false }) {
  // `otpAvailable` comes from the server (login/page.tsx): true only when WEBHOOK_AUTH_OTP is set — a code nobody can
  // deliver is never offered (audit S6). AUTH.otp is the OS-level switch from os.yaml; both must hold.
  const offerOtp = AUTH.otp && otpAvailable;
  const { login, loginAsPersona, sendOtp, verifyOtp } = useAuth();
  const [otp, setOtp] = useState({ on: false, sent: false, code: '', simulated: false });
  const [personas, setPersonas] = useState([]);   // the demo picker: served only when the server runs with DEMO_LOGINS=true (step 5), never in the bundle
  useEffect(() => { fetch('/api/personas').then((r) => (r.ok ? r.json() : { personas: [] })).then((j) => setPersonas(j.personas || [])).catch(() => {}); }, []);   // one-time code by email: the server generates and checks it; a workflow delivers it
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const marketingRef = useRevealStagger([], { y: 22, stagger: 0.1, duration: 0.7 });
  const cardRef = useEntrance([], { y: 32, duration: 0.7, delay: 0.35 });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    if (otp.on) {
      if (!email) { setError('Enter your email'); setLoading(false); return; }
      if (!otp.sent) { const r = await sendOtp(email); setLoading(false); if (!r.success) return setError(r.message); setOtp({ ...otp, sent: true, simulated: r.delivery === 'simulated' }); return; }
      const r = await verifyOtp(email, otp.code.trim()); if (!r.success) { setError(r.message); setLoading(false); return; }
      navigate(homeFor(r.user?.role)); return;
    }
    if (!email || !password) {
      setError('Please enter email and password');
      setLoading(false);
      return;
    }

    const result = await login(email, password);

    if (result.success) {
      navigate(new URLSearchParams(window.location.search).get('next') || homeFor(result.user?.role));
    } else {
      setError(result.message || 'Login failed');
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full bg-[color:var(--bg)] text-ink relative flex items-center justify-center p-4 pb-20 lg:p-8 overflow-x-hidden font-sans">
      {/* Full Screen Grid Pattern - Base */}
      <div className="absolute inset-0 z-0 opacity-100 pointer-events-none"
        style={{
          backgroundImage: `linear-gradient(var(--line) 1px, transparent 1px), linear-gradient(90deg, var(--line) 1px, transparent 1px)`,
          backgroundSize: '64px 64px',
          maskImage: 'linear-gradient(to bottom, rgba(0,0,0,1) 0%, rgba(0,0,0,0.8) 40%, rgba(0,0,0,0) 100%)',
          WebkitMaskImage: 'linear-gradient(to bottom, rgba(0,0,0,1) 0%, rgba(0,0,0,0.8) 40%, rgba(0,0,0,0) 100%)'
        }}>
      </div>

      {/* One soft brand wash — the login is the only marketing-scale surface in the OS, and even here the tint is the client's colour, never a literal. */}
      <div className="absolute top-0 left-0 w-[500px] lg:w-[800px] h-[500px] lg:h-[800px] bg-brand-500/15 rounded-full blur-[80px] lg:blur-[120px] pointer-events-none -translate-x-1/2 -translate-y-1/2"></div>
      <div className="absolute bottom-0 right-0 w-[500px] lg:w-[800px] h-[500px] lg:h-[800px] bg-brand-500/10 rounded-full blur-[80px] lg:blur-[120px] pointer-events-none translate-x-1/2 translate-y-1/2"></div>

      {/* Theme toggle (v4.9) — the same control as the header's; persists `pucho-theme` */}
      <div className="absolute top-5 right-24 md:right-28 z-30">
        <ThemeToggle className="bg-surface border border-[color:var(--line)] rounded-full" />
      </div>

      {/* Floating Mascots - Individual Images */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden h-full w-full">
        {/* Top Left - Woman Green Beanie */}
        <Mascot
          imageSrc={mascot1.src}
          x="top-[4%] left-4 md:top-[2%] md:left-[1%]"
          delay={0}
          size="w-12 h-12 md:w-16 md:h-16"
          cursorColor="text-info"
          cursorRotation="-10deg"
        />

        {/* Top Center-Right - Man Cap */}
        <Mascot
          imageSrc={mascot5.src}
          x="top-[4%] right-4 md:top-[2%] md:right-[1%]"
          delay={1.5}
          size="w-12 h-12 md:w-16 md:h-16"
          cursorColor="text-brand-500"
          cursorRotation="15deg"
        />

        {/* Bottom Center-Left - Man Turban */}
        <Mascot
          imageSrc={mascot3.src}
          x="bottom-[4%] left-2 md:bottom-[2%] md:left-[2%]"
          delay={0.8}
          size="w-10 h-10 md:w-16 md:h-16"
          cursorColor="text-warn"
          cursorRotation="-5deg"
        />

        {/* Bottom Right - Woman Hijab */}
        <Mascot
          imageSrc={mascot4.src}
          x="bottom-[4%] right-2 md:bottom-[2%] md:right-[2%]"
          delay={2.2}
          size="w-10 h-10 md:w-16 md:h-16"
          cursorColor="text-ok"
          cursorRotation="10deg"
        />
      </div>

      {/* Mobile Logo - Absolute Top Center */}
      <div className="absolute top-6 left-0 right-0 flex justify-center md:hidden z-20">
        <img src={puchoLogo.src} alt="Pucho.ai" className="h-6 logo-adapt" />
      </div>

      {/* below md the Pucho logo sits in a band at the top; the content starts under it (pt-14), never beneath it (Haresh UI 12) */}
      <div className="w-full max-w-7xl mx-auto grid md:grid-cols-2 gap-6 md:gap-12 lg:gap-24 relative z-10 items-center pt-14 md:pt-0 content-center">

        {/* Left Side: Marketing Content */}
        <div ref={marketingRef} className="text-center md:text-left space-y-4 md:space-y-8 md:pl-8 lg:pl-16">
          {/* Desktop/Tablet Logo */}
          <div className="hidden md:flex justify-start mb-8 lg:mb-16">
            <img src={puchoLogo.src} alt="Pucho.ai" className="h-7 lg:h-9 logo-adapt" />
          </div>

          <div className="space-y-2 md:space-y-4 lg:space-y-6">
            <div className="space-y-1 md:space-y-2">
              <div className="font-semibold text-ink text-sm md:text-base lg:text-lg">{OS.name}</div>
              <div className="text-[10px] md:text-[11px] lg:text-xs font-semibold text-brand-600 tracking-wider uppercase drop-shadow-sm">BUILT ON PUCHO.AI</div>
            </div>

            <h1 className="font-display text-3xl md:text-5xl lg:text-[70px] font-semibold leading-[1.1] md:leading-[1] lg:leading-[0.95] tracking-[-0.03em] text-ink">
              Build.<br />
              <span className="text-brand-500">Automate.</span><br />
              Scale.
            </h1>

            <p className="text-ink text-xs md:text-sm lg:text-base leading-relaxed max-w-md mx-auto md:mx-0 opacity-70 hidden md:block">
              {OS.tagline}
            </p>
          </div>

          {/* Badges */}
          <div className="hidden md:flex flex-wrap justify-center md:justify-start gap-2 md:gap-3 lg:gap-4 pt-2 md:pt-3 lg:pt-4">
            <div className="flex items-center gap-2 px-3 lg:px-4 py-1.5 lg:py-2 bg-brand-50 border border-brand-100/50 rounded-full text-[10px] lg:text-xs font-semibold text-brand-700">
              <img src={SparklesIcon.src} alt="Sparkles" className="w-4 h-4" />
              AI-Powered Intelligence
            </div>
            <div className="flex items-center gap-2 px-3 lg:px-4 py-1.5 lg:py-2 bg-ok-soft border border-[color:var(--ok-edge)] rounded-full text-[10px] lg:text-xs font-semibold text-ok-text">
              <img src={CircleIcon.src} alt="Operational" className="w-3 h-3" />
              System Operational
            </div>
          </div>
        </div>

        {/* Right Side: Floating Login Card with Glassmorphism */}
        <div className="flex flex-col items-center justify-center md:justify-end w-full">
          <div ref={cardRef} className="bg-white p-6 md:p-8 lg:p-12 rounded-2xl shadow-overlay w-full max-w-sm md:max-w-md border border-[color:var(--hair-5)] relative overflow-hidden group">
            <div className="space-y-2 mb-6 md:mb-8">
              <h2 className="text-2xl font-semibold text-ink">Welcome back</h2>
              <p className="text-ink-3 text-sm">Sign in to {OS.name}.</p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-5">
              <Input
                label="Email"
                type="email"
                icon={UserIcon.src}
                placeholder="you@company.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />

              {!otp.on && <Input
                label="Password"
                type="password"
                icon={LockIcon.src}
                placeholder="Your Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />}
              {otp.on && otp.sent && <Input label="One-time code" type="text" icon={LockIcon.src} placeholder="6-digit code from your email" value={otp.code} onChange={(e) => setOtp({ ...otp, code: e.target.value })} />}
              {offerOtp && (
                <button type="button" data-os-otp-toggle className="text-xs font-medium text-brand-600 hover:underline" onClick={() => { setOtp({ on: !otp.on, sent: false, code: '' }); setError(''); }}>
                  {otp.on ? 'Use my password instead' : 'Email me a one-time code instead'}
                </button>
              )}

              {error && (
                <div className="p-3 rounded-lg bg-bad-soft text-bad-text text-sm">
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="relative w-full h-[52px] flex items-center justify-center gap-3 rounded-full bg-brand-500 hover:bg-brand-600 transition-colors duration-200 font-semibold text-[17px] text-white disabled:bg-brand-300 disabled:cursor-not-allowed"
              >
                {/* Label & Icon */}
                <span className="relative z-10 flex items-center gap-2">
                  {loading ? 'Signing in…' : otp.on && !otp.sent ? 'Send code' : 'Sign in'}
                  {!loading && <img src={ArrowRightIcon.src} alt="Arrow" className="w-5 h-5 -rotate-45 invert brightness-0" />}
                </span>
              </button>
            </form>

            {personas.length > 0 && <div className="mt-6 pt-4 border-t border-[color:var(--line-soft)]" data-os-demo-logins>
              <p className="text-xs text-ink-3 font-semibold uppercase tracking-wider mb-2">Demo Credentials</p>
              <Select
                value={undefined}
                onChange={async (value) => {
                  const p = personas.find((x) => x.key === value); if (!p) return;
                  setEmail(p.email); setPassword(''); setError(''); setLoading(true);
                  const r = await loginAsPersona(p.key); setLoading(false);   // the server creates the session; no persona password reaches the browser (audit S3)
                  if (!r.success) return setError(r.message);
                  navigate(homeFor(r.user?.role));
                }}
                placeholder="Select an account..."
                popupMatchSelectWidth={false}
                options={personas.map((p) => ({ value: p.key, label: p.label }))}
                className="w-full"
                getPopupContainer={(trigger) => trigger.parentElement}
                style={{ position: 'relative' }}
                classNames={{ popup: { root: 'login-cred-dropdown' } }}
              />
            </div>}
          </div>

          {/* Mobile Only: Description and Badges moved below form */}
          <div className="block md:hidden text-center mt-8 space-y-4">
            <p className="text-ink text-xs leading-relaxed max-w-xs mx-auto opacity-70">
              {OS.tagline}
            </p>
            <div className="flex flex-wrap justify-center gap-2">
              <div className="flex items-center gap-2 px-3 py-1.5 bg-brand-50 border border-brand-100/50 rounded-full text-[10px] font-medium text-brand-700">
                <img src={SparklesIcon.src} alt="Sparkles" className="w-4 h-4" />
                AI-Powered Intelligence
              </div>
              <div className="flex items-center gap-2 px-3 py-1.5 bg-ok-soft border border-[color:var(--ok-edge)] rounded-full text-[10px] font-medium text-ok-text">
                <img src={CircleIcon.src} alt="Operational" className="w-3 h-3" />
                System Operational
              </div>
            </div>
          </div>
        </div>

      </div>
      <PoweredBy />
    </div>
  );
}
