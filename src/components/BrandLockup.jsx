import { BRAND } from '../brand.js'

const SIZES = {
  hero: { mark: 'h-16', text: 'text-5xl', img: 'h-20' },
  nav: { mark: 'h-10', text: 'text-2xl', img: 'h-12' },
  topbar: { mark: 'h-8', text: 'text-lg', img: 'h-8' },
}

// Renders the active brand's lockup. Mitten = cub mark + "Mitten" wordmark;
// Pacific Coast = its full logo image.
export default function BrandLockup({ variant = 'nav', className = '' }) {
  const s = SIZES[variant]
  if (BRAND.mitten) {
    return (
      <div className={`flex items-center gap-2.5 ${className}`}>
        <img src={BRAND.mark} alt="Mitten" className={`${s.mark} w-auto`} />
        <span className={`font-display ${s.text} leading-none text-brand-700`}>Mitten</span>
      </div>
    )
  }
  return <img src={BRAND.logo} alt={BRAND.name} className={`${s.img} w-auto object-contain ${className}`} />
}
