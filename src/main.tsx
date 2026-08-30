import { StrictMode, useState } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import Onboarding from './Onboarding.tsx'

const ONBOARDING_KEY = 'devsmith-onboarding-complete';

function Root() {
  // Checked once on load. If onboarding was already completed in a
  // previous session, this skips straight to the dashboard instead of
  // showing the intro screen again every time the app opens.
  const [onboardingComplete, setOnboardingComplete] = useState(
    () => localStorage.getItem(ONBOARDING_KEY) === 'true'
  );

  if (!onboardingComplete) {
    return <Onboarding onComplete={() => setOnboardingComplete(true)} />;
  }

  return <App />;
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Root />
  </StrictMode>,
)