import { useEffect, useState } from "react";

// The time now (epoch ms), updated every second while mounted: countdowns.
export const useNow = (ms = 1000) => {
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), ms);
    return () => clearInterval(t);
  }, [ms]);
  return now;
};
