import { Chip } from './Chip'

export function Hero({ kicker, titulo, subtitulo, insignias = [] }) {
  return (
    <header className="relative flex flex-wrap items-end justify-between gap-x-6 gap-y-4 overflow-hidden rounded-hero bg-ink px-7 py-6 text-white max-sm:rounded-[14px] max-sm:px-[18px] max-sm:py-[18px]">
      <div className="pointer-events-none absolute -right-[60px] -top-20 h-[260px] w-[260px] rounded-full border-[40px] border-emerald-500/10" />
      <div className="relative">
        <div className="text-[11px] font-bold tracking-[.1em] text-[#7DD3FC]">{kicker}</div>
        <h1 className="my-1.5 text-[clamp(24px,3.2vw,32px)] font-extrabold text-white">{titulo}</h1>
        {subtitulo && <p className="max-w-[720px] text-sm leading-normal text-slate-300 max-sm:text-[13px]">{subtitulo}</p>}
      </div>
      {insignias.length > 0 && (
        <div className="relative z-10 flex flex-wrap gap-2">
          {insignias.map(([texto, tono]) => (
            <Chip key={texto} tono={tono} punto>
              {texto}
            </Chip>
          ))}
        </div>
      )}
    </header>
  )
}
