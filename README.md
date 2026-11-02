# DESIDIYA SKY FIGHTER
**"DesiDiya - Naye Bhart ki Roshni"**

A 3D vertical-scrolling space shooter game built with **Three.js**, **React 19**, **TypeScript**, **Tailwind CSS**, and **Web Audio API**, featuring optional **Google Lyria 3 AI** soundtrack generation.

---

## Features
- **3D DesiDiya Sky Fighter Fleet**: 4 unlockable spacecraft (*DesiDiya Tejas Mk-I*, *Garuda Solar Wing*, *Vajra Astral Gunship*, *Surya Samrat Sovereign*) with golden Diya Core energy conduits, dual engines, and dynamic banking animations.
- **8-Tier Weapon Arsenal**: *Basic Laser Cannon*, *Double Laser Cannon*, *Triple Laser Cannon*, *Plasma Blaster*, *Homing Missiles*, *Mega Energy Beam*, *Solar Flame Cannon*, and *Ultimate Galaxy Blast*, plus dedicated Homing Missile Volleys (`[X]`) and the **Diya Solar Nova** (`[Shift]`) special blast.
- **Complete 8-Mission Solar System Campaign**:
  1. **Venus** — *Venus Inferno Destroyer*
  2. **Earth** — *Earth Shadow Commander*
  3. **Mars** — *Mars War Titan*
  4. **Jupiter** — *Jupiter Storm Colossus*
  5. **Saturn** — *Saturn Ring Destroyer*
  6. **Uranus** — *Uranus Ice Guardian*
  7. **Neptune** — *Neptune Abyss Titan*
  8. **Awaken The Sun** — *Solar Darkness Titan*
- **Solar System 100% Illumination Finale**: Interactive 3D Solar System diorama where the Sun and all seven planets ignite in sequence.

---

## Local Development & Build Instructions

```bash
# 1. Install dependencies
npm install

# 2. Run unit tests for game logic
npx --yes tsx --test src/game/rules.test.ts

# 3. Start development server (Port 3000)
npm run dev

# 4. Build production bundle
npm run build
```

## Cloudflare Pages Deployment Compatibility
- **Build Command**: `npm run build`
- **Build Output Directory**: `dist`
- **Node.js Version**: `20.x` or `22.x`
- All 3D models, textures, particle systems, and planetary soundtracks are 100% procedurally generated in-browser with zero external asset 404s, allowing instant static hosting on Cloudflare Pages or full-stack deployment on Cloud Run.
