import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
// only the subsets the site needs (uz/en latin + ru cyrillic); fonts load lazily via unicode-range
import '@fontsource/lora/latin-600.css';
import '@fontsource/lora/latin-600-italic.css';
import '@fontsource/lora/latin-700.css';
import '@fontsource/manrope/latin-500.css';
import '@fontsource/manrope/latin-600.css';
import '@fontsource/manrope/latin-700.css';
import '@fontsource/manrope/latin-800.css';
import '@fontsource/lora/latin-ext-600.css';
import '@fontsource/lora/latin-ext-600-italic.css';
import '@fontsource/lora/latin-ext-700.css';
import '@fontsource/manrope/latin-ext-500.css';
import '@fontsource/manrope/latin-ext-600.css';
import '@fontsource/manrope/latin-ext-700.css';
import '@fontsource/manrope/latin-ext-800.css';
import '@fontsource/lora/cyrillic-600.css';
import '@fontsource/lora/cyrillic-600-italic.css';
import '@fontsource/lora/cyrillic-700.css';
import '@fontsource/manrope/cyrillic-500.css';
import '@fontsource/manrope/cyrillic-600.css';
import '@fontsource/manrope/cyrillic-700.css';
import '@fontsource/manrope/cyrillic-800.css';
import './styles/tokens.css';
import './styles/base.css';
import './styles/ui.css';
import './styles/layout.css';
import './styles/home.css';
import App from './App';

const mount = () =>
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );

// If index.html painted the static hero shell, let its image paint first (it is the LCP), then mount.
const shellImg = document.querySelector<HTMLImageElement>('#root .hero__archimg img');
if (shellImg && !shellImg.complete) {
  let done = false;
  const go = () => {
    if (done) return;
    done = true;
    shellImg.decode().catch(() => undefined).then(() => requestAnimationFrame(() => requestAnimationFrame(() => setTimeout(mount, 0))));
  };
  shellImg.addEventListener('load', go, { once: true });
  shellImg.addEventListener('error', go, { once: true });
  setTimeout(go, 2500);
} else if (shellImg) shellImg.decode().catch(() => undefined).then(() => requestAnimationFrame(() => requestAnimationFrame(() => setTimeout(mount, 0))));
else mount();
