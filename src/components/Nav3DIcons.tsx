import type { FC, SVGProps } from 'react'

export interface NavIconProps extends SVGProps<SVGSVGElement> {
  active?: boolean
}

/**
 * 🏠 3D House Emoji Sticker (Asl holicha 3D Uy)
 * Volumetric cozy cottage with terracotta/coral roof, cream walls, timber arched door & windows.
 */
export const Home3DIcon: FC<NavIconProps> = ({ active = false, className, ...props }) => (
  <svg
    viewBox="0 0 64 64"
    width="34"
    height="34"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={className}
    style={{
      transform: active ? 'translateY(-3px) scale(1.1)' : 'scale(1)',
      transition: 'all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)',
    }}
    {...props}
  >
    <defs>
      {/* Roof 3D Gradient */}
      <linearGradient id="emojiRoof" x1="12" y1="8" x2="52" y2="34" gradientUnits="userSpaceOnUse">
        <stop offset="0%" stopColor="#ff7a59" />
        <stop offset="40%" stopColor="#ea580c" />
        <stop offset="85%" stopColor="#c2410c" />
        <stop offset="100%" stopColor="#9a3412" />
      </linearGradient>
      {/* Roof Left Slope Bevel Light */}
      <linearGradient id="emojiRoofLight" x1="32" y1="8" x2="16" y2="28" gradientUnits="userSpaceOnUse">
        <stop offset="0%" stopColor="#ffffff" stopOpacity="0.8" />
        <stop offset="100%" stopColor="#ffffff" stopOpacity="0.05" />
      </linearGradient>
      {/* House Front Wall */}
      <linearGradient id="emojiWallFront" x1="20" y1="26" x2="48" y2="56" gradientUnits="userSpaceOnUse">
        <stop offset="0%" stopColor="#ffffff" />
        <stop offset="50%" stopColor="#fef3f2" />
        <stop offset="100%" stopColor="#fee2e2" />
      </linearGradient>
      {/* Door 3D Wood */}
      <linearGradient id="emojiDoor" x1="26" y1="36" x2="38" y2="54" gradientUnits="userSpaceOnUse">
        <stop offset="0%" stopColor="#b45309" />
        <stop offset="100%" stopColor="#78350f" />
      </linearGradient>
      {/* Chimney Gradient */}
      <linearGradient id="emojiChimney" x1="42" y1="12" x2="48" y2="24" gradientUnits="userSpaceOnUse">
        <stop offset="0%" stopColor="#f97316" />
        <stop offset="100%" stopColor="#9a3412" />
      </linearGradient>
      {/* Window Sky Glow */}
      <linearGradient id="emojiWindow" x1="28" y1="18" x2="36" y2="26" gradientUnits="userSpaceOnUse">
        <stop offset="0%" stopColor="#e0f2fe" />
        <stop offset="100%" stopColor="#7dd3fc" />
      </linearGradient>
      {/* Base Foundation / Grass */}
      <linearGradient id="emojiGrass" x1="10" y1="52" x2="54" y2="58" gradientUnits="userSpaceOnUse">
        <stop offset="0%" stopColor="#4ade80" />
        <stop offset="100%" stopColor="#16a34a" />
      </linearGradient>
      {/* Ambient Floor Shadow */}
      <radialGradient id="emojiFloorShadow" cx="32" cy="57" r="22" gradientUnits="userSpaceOnUse">
        <stop offset="0%" stopColor="#1e1b4b" stopOpacity="0.3" />
        <stop offset="100%" stopColor="#1e1b4b" stopOpacity="0" />
      </radialGradient>
    </defs>

    {/* Ambient shadow */}
    <ellipse cx="32" cy="57.5" rx="21" ry="4" fill="url(#emojiFloorShadow)" />

    {/* Chimney with 3D cap */}
    <rect x="42" y="13" width="6.5" height="13" rx="2" fill="url(#emojiChimney)" />
    <path d="M41 13.5C41 12.7 41.7 12 42.5 12H48C48.8 12 49.5 12.7 49.5 13.5C49.5 14.3 48.8 15 48 15H42.5C41.7 15 41 14.3 41 13.5Z" fill="#fed7aa" />

    {/* House Body Base */}
    <rect x="15" y="27" width="34" height="27" rx="5" fill="url(#emojiWallFront)" stroke="#fecaca" strokeWidth="0.8" />

    {/* Base Green Lawn / Step Accent */}
    <rect x="12" y="53" width="40" height="4" rx="2" fill="url(#emojiGrass)" />

    {/* 3D Roof Gable */}
    <path
      d="M32 7.5L9 26C8 26.8 8.5 28.5 9.8 28.5H54.2C55.5 28.5 56 26.8 55 26L32 7.5Z"
      fill="url(#emojiRoof)"
    />
    {/* Roof Gloss Bevel */}
    <path
      d="M32 9L11.5 25.5H52.5L32 9Z"
      fill="url(#emojiRoofLight)"
    />

    {/* Attic Round Window */}
    <circle cx="32" cy="20.5" r="4.5" fill="#ffffff" />
    <circle cx="32" cy="20.5" r="3.5" fill="url(#emojiWindow)" />
    <path d="M32 17.5V23.5M29 20.5H35" stroke="#ffffff" strokeWidth="0.9" strokeLinecap="round" />

    {/* Arched Timber Door */}
    <path
      d="M26.5 53V39.5C26.5 36.8 28.9 34.5 32 34.5C35.1 34.5 37.5 36.8 37.5 39.5V53H26.5Z"
      fill="url(#emojiDoor)"
    />
    {/* Door highlight */}
    <path
      d="M27.5 40V52H30.5V37C28.8 37.5 27.5 38.6 27.5 40Z"
      fill="#ffffff"
      fillOpacity="0.22"
    />
    {/* Door Gold Knob */}
    <circle cx="35.5" cy="45.5" r="1.1" fill="#fef08a" />
    <circle cx="35.5" cy="45.5" r="0.5" fill="#ffffff" />

    {/* Side Square Windows */}
    <rect x="18" y="34" width="6" height="7" rx="1.5" fill="url(#emojiWindow)" stroke="#ffffff" strokeWidth="0.8" />
    <rect x="40" y="34" width="6" height="7" rx="1.5" fill="url(#emojiWindow)" stroke="#ffffff" strokeWidth="0.8" />
  </svg>
)

/**
 * 🔍 3D Magnifying Glass Emoji Sticker (Asl holicha 3D Lupa)
 * Optical crystal lens with sky-blue reflection, specular sparkle, and ergonomic 3D tilted handle.
 */
export const Search3DIcon: FC<NavIconProps> = ({ active = false, className, ...props }) => (
  <svg
    viewBox="0 0 64 64"
    width="34"
    height="34"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={className}
    style={{
      transform: active ? 'translateY(-3px) scale(1.1)' : 'scale(1)',
      transition: 'all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)',
    }}
    {...props}
  >
    <defs>
      {/* Metallic Rim Gradient */}
      <linearGradient id="emojiLensRim" x1="10" y1="10" x2="42" y2="42" gradientUnits="userSpaceOnUse">
        <stop offset="0%" stopColor="#94a3b8" />
        <stop offset="35%" stopColor="#475569" />
        <stop offset="70%" stopColor="#1e293b" />
        <stop offset="100%" stopColor="#0f172a" />
      </linearGradient>
      {/* Crystal Glass Gradient */}
      <radialGradient id="emojiGlassOrb" cx="24" cy="22" r="16" gradientUnits="userSpaceOnUse">
        <stop offset="0%" stopColor="#ffffff" stopOpacity="0.95" />
        <stop offset="30%" stopColor="#e0f2fe" stopOpacity="0.9" />
        <stop offset="70%" stopColor="#7dd3fc" stopOpacity="0.8" />
        <stop offset="100%" stopColor="#0284c7" stopOpacity="0.85" />
      </radialGradient>
      {/* Specular Curved Reflection */}
      <linearGradient id="emojiLensReflection" x1="16" y1="14" x2="30" y2="24" gradientUnits="userSpaceOnUse">
        <stop offset="0%" stopColor="#ffffff" stopOpacity="0.95" />
        <stop offset="100%" stopColor="#ffffff" stopOpacity="0.1" />
      </linearGradient>
      {/* 3D Handle */}
      <linearGradient id="emojiHandle" x1="36" y1="36" x2="56" y2="56" gradientUnits="userSpaceOnUse">
        <stop offset="0%" stopColor="#64748b" />
        <stop offset="30%" stopColor="#334155" />
        <stop offset="100%" stopColor="#0f172a" />
      </linearGradient>
      {/* Shadow */}
      <radialGradient id="emojiSearchShadow" cx="38" cy="51" r="18" gradientUnits="userSpaceOnUse">
        <stop offset="0%" stopColor="#0f172a" stopOpacity="0.32" />
        <stop offset="100%" stopColor="#0f172a" stopOpacity="0" />
      </radialGradient>
    </defs>

    {/* Ambient shadow */}
    <ellipse cx="38" cy="52" rx="16" ry="4.5" fill="url(#emojiSearchShadow)" />

    {/* Tilted Ergonomic Handle */}
    <rect
      x="35"
      y="35"
      width="9"
      height="23"
      rx="4.5"
      transform="rotate(-45 35 35)"
      fill="url(#emojiHandle)"
    />
    {/* Handle Metallic Ring */}
    <rect
      x="36"
      y="35"
      width="9"
      height="3.5"
      rx="1.7"
      transform="rotate(-45 36 35)"
      fill="#cbd5e1"
    />
    <rect
      x="47"
      y="46"
      width="9"
      height="3.5"
      rx="1.7"
      transform="rotate(-45 47 46)"
      fill="#94a3b8"
    />

    {/* Outer 3D Metallic Lens Bezel */}
    <circle cx="26" cy="26" r="18" fill="url(#emojiLensRim)" />
    {/* Inner Rim Depth */}
    <circle cx="26" cy="26" r="14.5" fill="#0f172a" fillOpacity="0.45" />

    {/* Crystal Glass Orb */}
    <circle cx="26" cy="26" r="13" fill="url(#emojiGlassOrb)" />

    {/* Specular Curved Reflection Streak */}
    <path
      d="M17 22C18.5 17 22.5 14.5 27 14.5C28 14.5 27.5 13.5 26 13.5C20.5 13.5 15.5 17 14.5 23C14.2 24.2 16.2 24 17 22Z"
      fill="url(#emojiLensReflection)"
    />

    {/* Sparkle Glint */}
    <circle cx="29" cy="21" r="2.2" fill="#ffffff" />
    <circle cx="33.5" cy="27" r="1.1" fill="#ffffff" fillOpacity="0.85" />
  </svg>
)

/**
 * 💖 3D Sparkling Pink Heart Emoji Sticker (Asl holicha 3D Sevimli Yurak)
 * Volumetric glossy pink heart with layered 3D depth and golden/white sparkle stars.
 */
export const Heart3DIcon: FC<NavIconProps> = ({ active = false, className, ...props }) => (
  <svg
    viewBox="0 0 64 64"
    width="34"
    height="34"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={className}
    style={{
      transform: active ? 'translateY(-3px) scale(1.1)' : 'scale(1)',
      transition: 'all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)',
    }}
    {...props}
  >
    <defs>
      {/* 3D Volumetric Heart Gradient */}
      <linearGradient id="emojiHeartMain" x1="16" y1="10" x2="48" y2="52" gradientUnits="userSpaceOnUse">
        <stop offset="0%" stopColor="#ff4d79" />
        <stop offset="35%" stopColor="#f43f5e" />
        <stop offset="75%" stopColor="#e11d48" />
        <stop offset="100%" stopColor="#9f1239" />
      </linearGradient>
      {/* Soft Lobe Specular Radial */}
      <radialGradient id="emojiHeartSpecular" cx="24" cy="20" r="14" gradientUnits="userSpaceOnUse">
        <stop offset="0%" stopColor="#ffffff" stopOpacity="0.9" />
        <stop offset="40%" stopColor="#fecdd3" stopOpacity="0.6" />
        <stop offset="100%" stopColor="#f43f5e" stopOpacity="0" />
      </radialGradient>
      {/* Ambient shadow */}
      <radialGradient id="emojiHeartShadow" cx="32" cy="56" r="20" gradientUnits="userSpaceOnUse">
        <stop offset="0%" stopColor="#9f1239" stopOpacity="0.35" />
        <stop offset="100%" stopColor="#9f1239" stopOpacity="0" />
      </radialGradient>
      {/* Star sparkle glow */}
      <linearGradient id="emojiSparkle" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stopColor="#ffffff" />
        <stop offset="100%" stopColor="#fef08a" />
      </linearGradient>
    </defs>

    {/* Ambient shadow */}
    <ellipse cx="32" cy="56.5" rx="18" ry="4.5" fill="url(#emojiHeartShadow)" />

    {/* Main 3D Volumetric Heart Shape */}
    <path
      d="M32 52.5C30.4 51 11.5 36.5 11.5 23.5C11.5 15.5 17.5 10.5 24.8 10.5C28.8 10.5 31.8 12.8 32 14.8C32.2 12.8 35.2 10.5 39.2 10.5C46.5 10.5 52.5 15.5 52.5 23.5C52.5 36.5 33.6 51 32 52.5Z"
      fill="url(#emojiHeartMain)"
    />

    {/* Left Lobe Specular Soft Light */}
    <path
      d="M32 52.5C30.4 51 11.5 36.5 11.5 23.5C11.5 15.5 17.5 10.5 24.8 10.5C28.8 10.5 31.8 12.8 32 14.8C32.2 12.8 35.2 10.5 39.2 10.5C46.5 10.5 52.5 15.5 52.5 23.5C52.5 36.5 33.6 51 32 52.5Z"
      fill="url(#emojiHeartSpecular)"
    />

    {/* Specular Curved Highlight on Left Lobe */}
    <ellipse cx="23.5" cy="18.5" rx="5.5" ry="3.2" transform="rotate(-30 23.5 18.5)" fill="#ffffff" fillOpacity="0.65" />
    <ellipse cx="40.5" cy="18.5" rx="4" ry="2.2" transform="rotate(30 40.5 18.5)" fill="#ffffff" fillOpacity="0.45" />

    {/* 4-Point Golden Sparkle (Top Right 💖) */}
    <path
      d="M48 11C48 14.5 50.5 17 54 17C50.5 17 48 19.5 48 23C48 19.5 45.5 17 42 17C45.5 17 48 14.5 48 11Z"
      fill="url(#emojiSparkle)"
      filter="drop-shadow(0 0 3px rgba(253,224,71,0.8))"
    />

    {/* Mini Sparkle (Bottom Left) */}
    <path
      d="M14 36C14 38 15.5 39.5 17.5 39.5C15.5 39.5 14 41 14 43C14 41 12.5 39.5 10.5 39.5C12.5 39.5 14 38 14 36Z"
      fill="url(#emojiSparkle)"
    />
  </svg>
)

/**
 * 🛍️ 3D Dual Shopping Bags Emoji Sticker (Asl holicha 3D Xarid Sumkalari)
 * Dual volumetric shopping bags: Coral/rose front tote + turquoise/teal back bag with handles.
 */
export const Bag3DIcon: FC<NavIconProps> = ({ active = false, className, ...props }) => (
  <svg
    viewBox="0 0 64 64"
    width="34"
    height="34"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={className}
    style={{
      transform: active ? 'translateY(-3px) scale(1.1)' : 'scale(1)',
      transition: 'all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)',
    }}
    {...props}
  >
    <defs>
      {/* Front Pink Bag */}
      <linearGradient id="emojiFrontBag" x1="22" y1="22" x2="52" y2="56" gradientUnits="userSpaceOnUse">
        <stop offset="0%" stopColor="#ff708f" />
        <stop offset="40%" stopColor="#f43f5e" />
        <stop offset="85%" stopColor="#e11d48" />
        <stop offset="100%" stopColor="#9f1239" />
      </linearGradient>
      {/* Back Teal Bag */}
      <linearGradient id="emojiBackBag" x1="10" y1="18" x2="36" y2="52" gradientUnits="userSpaceOnUse">
        <stop offset="0%" stopColor="#2dd4bf" />
        <stop offset="40%" stopColor="#14b8a6" />
        <stop offset="85%" stopColor="#0d9488" />
        <stop offset="100%" stopColor="#115e59" />
      </linearGradient>
      {/* Front Handle */}
      <linearGradient id="emojiBagHandle" x1="26" y1="10" x2="44" y2="26" gradientUnits="userSpaceOnUse">
        <stop offset="0%" stopColor="#fed7aa" />
        <stop offset="50%" stopColor="#fb7185" />
        <stop offset="100%" stopColor="#be123c" />
      </linearGradient>
      {/* Shadow */}
      <radialGradient id="emojiBagShadow" cx="32" cy="56" r="22" gradientUnits="userSpaceOnUse">
        <stop offset="0%" stopColor="#0f172a" stopOpacity="0.3" />
        <stop offset="100%" stopColor="#0f172a" stopOpacity="0" />
      </radialGradient>
    </defs>

    {/* Ambient shadow */}
    <ellipse cx="32" cy="56.5" rx="20" ry="4.5" fill="url(#emojiBagShadow)" />

    {/* BACK TEAL BAG (🛍️ dual bag motif) */}
    {/* Teal Back Handle */}
    <path
      d="M17 22V15C17 11.5 20 8.5 24 8.5C28 8.5 31 11.5 31 15V22"
      stroke="#0f766e"
      strokeWidth="2.8"
      strokeLinecap="round"
    />
    {/* Teal Bag Body */}
    <path
      d="M11.5 22C10.5 22 9.6 23 9.8 24.2L12.8 49C13.1 51 14.8 52.5 16.8 52.5H32.5C34.5 52.5 36.2 51 36.5 49L39 24.2C39.2 23 38.3 22 37.3 22H11.5Z"
      fill="url(#emojiBackBag)"
    />
    {/* Teal Bag Rim */}
    <rect x="10.5" y="21" width="27.5" height="2.5" rx="1.2" fill="#5eead4" />

    {/* FRONT CORAL/ROSE BAG */}
    {/* Back Handle for front bag (depth) */}
    <path
      d="M29 25V18C29 13.5 32.5 10 37 10C41.5 10 45 13.5 45 18V25"
      stroke="#881337"
      strokeWidth="3.2"
      strokeLinecap="round"
    />
    {/* Front Bag Body */}
    <path
      d="M23 25C21.8 25 20.8 26.1 21 27.4L24.4 51.5C24.7 53.6 26.5 55.2 28.6 55.2H45.4C47.5 55.2 49.3 53.6 49.6 51.5L53 27.4C53.2 26.1 52.2 25 51 25H23Z"
      fill="url(#emojiFrontBag)"
    />
    {/* Front Bag Rim Bevel */}
    <rect x="22" y="24" width="30" height="2.8" rx="1.4" fill="#fda4af" />

    {/* Front Bag Handle with Specular Highlight */}
    <path
      d="M29.5 25V18.5C29.5 14.2 33 11 37 11C41 11 44.5 14.2 44.5 18.5V25"
      stroke="url(#emojiBagHandle)"
      strokeWidth="3"
      strokeLinecap="round"
    />

    {/* Left Gloss Sheen on Front Bag */}
    <path
      d="M24 28L26.5 51H30.5L27 28H24Z"
      fill="#ffffff"
      fillOpacity="0.32"
    />

    {/* Front Bag Center Sparkle Star */}
    <path
      d="M37 36L38.5 39.5L42 41L38.5 42.5L37 46L35.5 42.5L32 41L35.5 39.5L37 36Z"
      fill="#ffffff"
      fillOpacity="0.9"
    />
  </svg>
)

/**
 * 👤 3D User Silhouette Emoji Sticker (Asl holicha 3D Foydalanuvchi)
 * Volumetric avatar with spherical head and contoured smooth shoulders in rich 3D royal blue.
 */
export const User3DIcon: FC<NavIconProps> = ({ active = false, className, ...props }) => (
  <svg
    viewBox="0 0 64 64"
    width="34"
    height="34"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={className}
    style={{
      transform: active ? 'translateY(-3px) scale(1.1)' : 'scale(1)',
      transition: 'all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)',
    }}
    {...props}
  >
    <defs>
      {/* 3D Head Sphere */}
      <linearGradient id="emojiUserHead" x1="24" y1="9" x2="40" y2="33" gradientUnits="userSpaceOnUse">
        <stop offset="0%" stopColor="#38bdf8" />
        <stop offset="35%" stopColor="#0284c7" />
        <stop offset="85%" stopColor="#0369a1" />
        <stop offset="100%" stopColor="#075985" />
      </linearGradient>
      {/* 3D Shoulders / Bust */}
      <linearGradient id="emojiUserBody" x1="16" y1="33" x2="48" y2="56" gradientUnits="userSpaceOnUse">
        <stop offset="0%" stopColor="#38bdf8" />
        <stop offset="35%" stopColor="#0284c7" />
        <stop offset="85%" stopColor="#0369a1" />
        <stop offset="100%" stopColor="#0c4a6e" />
      </linearGradient>
      {/* Head Gloss Highlight */}
      <linearGradient id="emojiHeadGloss" x1="28" y1="11" x2="35" y2="20" gradientUnits="userSpaceOnUse">
        <stop offset="0%" stopColor="#ffffff" stopOpacity="0.9" />
        <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
      </linearGradient>
      {/* Ambient shadow */}
      <radialGradient id="emojiUserShadow" cx="32" cy="56" r="20" gradientUnits="userSpaceOnUse">
        <stop offset="0%" stopColor="#0c4a6e" stopOpacity="0.32" />
        <stop offset="100%" stopColor="#0c4a6e" stopOpacity="0" />
      </radialGradient>
    </defs>

    {/* Ambient shadow */}
    <ellipse cx="32" cy="56.5" rx="19" ry="4.5" fill="url(#emojiUserShadow)" />

    {/* 3D Contoured Shoulders */}
    <path
      d="M16 53.5C16 44.2 23.2 36.8 32 36.8C40.8 36.8 48 44.2 48 53.5C48 54.8 46.8 56 45.4 56H18.6C17.2 56 16 54.8 16 53.5Z"
      fill="url(#emojiUserBody)"
    />

    {/* Shoulder Specular Light Rim */}
    <path
      d="M18.5 53.5C18.5 46.5 24.5 40 32 40C32.7 40 31.5 38 29.5 38.5C23 39.8 17.5 45.8 17.5 54C17.5 55 18.2 55 18.5 53.5Z"
      fill="#ffffff"
      fillOpacity="0.38"
    />

    {/* 3D Spherical Head */}
    <circle cx="32" cy="21.5" r="11" fill="url(#emojiUserHead)" />

    {/* Head Gloss Highlight */}
    <ellipse cx="29.5" cy="16.5" rx="4.5" ry="3" transform="rotate(-25 29.5 16.5)" fill="url(#emojiHeadGloss)" />
  </svg>
)
