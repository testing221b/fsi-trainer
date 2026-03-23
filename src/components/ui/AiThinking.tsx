// src/components/ui/AiThinking.tsx
interface AiThinkingProps {
  variant: 'wave' | 'dots'
  label?: string
  className?: string
}

export function AiThinking({ variant, label, className = '' }: AiThinkingProps) {
  return (
    <div className={`flex flex-col items-center gap-2 ${className}`}>
      {variant === 'wave' ? <WaveAnimation /> : <DotsAnimation />}
      {label && <p className="text-xs text-slate-400">{label}</p>}
    </div>
  )
}

function WaveAnimation() {
  return (
    <>
      <style>{`
        @media (prefers-reduced-motion: no-preference) {
          .fsi-wave {
            background: linear-gradient(90deg, #3b82f6, #8b5cf6, #06b6d4, #3b82f6);
            background-size: 300% 100%;
            animation: fsiWave 2s linear infinite;
          }
          @keyframes fsiWave {
            0%   { background-position: 100% 0 }
            100% { background-position: -100% 0 }
          }
        }
        @media (prefers-reduced-motion: reduce) {
          .fsi-wave { opacity: 0.6; animation: fsiPulse 1.5s ease-in-out infinite; }
          @keyframes fsiPulse { 0%,100%{opacity:0.4} 50%{opacity:0.8} }
        }
      `}</style>
      <div className="fsi-wave w-40 h-8 rounded-full" />
    </>
  )
}

function DotsAnimation() {
  return (
    <>
      <style>{`
        @media (prefers-reduced-motion: no-preference) {
          .fsi-dot { animation: fsiDot 1.2s infinite ease-in-out; }
          .fsi-dot:nth-child(2) { animation-delay: 0.2s; }
          .fsi-dot:nth-child(3) { animation-delay: 0.4s; }
          @keyframes fsiDot {
            0%,80%,100% { transform: scale(0.6); opacity: 0.4; }
            40%          { transform: scale(1);   opacity: 1; }
          }
        }
        @media (prefers-reduced-motion: reduce) {
          .fsi-dot { opacity: 0.6; }
        }
      `}</style>
      <div className="flex items-center gap-1.5">
        {[0, 1, 2].map(i => (
          <div key={i} className="fsi-dot w-2.5 h-2.5 rounded-full bg-blue-400" />
        ))}
      </div>
    </>
  )
}
