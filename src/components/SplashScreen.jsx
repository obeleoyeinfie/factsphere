import { ArrowRight, Sparkles } from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useEffect, useState } from "react";

function wasShown() {
  try {
    return sessionStorage.getItem("factsphere:splash-seen") === "1";
  } catch (error) {
    console.error("Could not read splash-screen state.", error);
    return false;
  }
}

export default function SplashScreen() {
  const [visible, setVisible] = useState(() => !wasShown());
  const reduceMotion = useReducedMotion();

  function dismiss() {
    setVisible(false);
    try {
      sessionStorage.setItem("factsphere:splash-seen", "1");
    } catch (error) {
      console.error("Could not store splash-screen state.", error);
    }
  }

  useEffect(() => {
    if (!visible) return undefined;
    const timeout = window.setTimeout(dismiss, reduceMotion ? 450 : 1600);
    return () => {
      window.clearTimeout(timeout);
    };
  }, [visible, reduceMotion]);

  return (
    <AnimatePresence>
      {visible && <motion.div className="splash-screen" role="status" aria-label="Welcome to FactSphere" initial={reduceMotion ? false : { opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: reduceMotion ? 0.1 : 0.45, ease: "easeOut" }}>
        <motion.span className="splash-glow" animate={reduceMotion ? undefined : { x: [0, 24, 0], y: [0, -16, 0] }} transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }} />
        <motion.div className="splash-orbit splash-orbit-one" animate={reduceMotion ? undefined : { rotate: 360 }} transition={{ duration: 24, repeat: Infinity, ease: "linear" }} />
        <motion.div className="splash-orbit splash-orbit-two" animate={reduceMotion ? undefined : { rotate: -360 }} transition={{ duration: 32, repeat: Infinity, ease: "linear" }} />
        <motion.div className="splash-content" initial={reduceMotion ? false : { opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: reduceMotion ? 0 : 0.5, ease: "easeOut" }}>
          <div className="splash-mark" aria-hidden="true"><Sparkles size={25} /></div>
          <div className="splash-wordmark">FactSphere<span>.</span></div>
          <span className="splash-tagline">A little wonder goes a long way.</span>
          <div className="splash-progress" aria-hidden="true"><motion.span initial={reduceMotion ? false : { scaleX: 0 }} animate={{ scaleX: 1 }} transition={{ duration: reduceMotion ? 0 : 1.35, ease: "easeInOut" }} /></div>
          <button type="button" className="splash-skip" onClick={dismiss}>Skip intro <ArrowRight size={14} /></button>
        </motion.div>
      </motion.div>}
    </AnimatePresence>
  );
}
