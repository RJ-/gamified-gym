"use client";

import { useEffect, useState } from "react";
import { GYM_TIME_ZONE } from "@/lib/rules/time";

const fmt = new Intl.DateTimeFormat("en-PH", {
  timeZone: GYM_TIME_ZONE,
  weekday: "long",
  hour: "numeric",
  minute: "2-digit",
});

/** Gym-time clock; also shows the TV page is alive and not frozen. */
export function ManilaClock({ className }: { className?: string }) {
  const [now, setNow] = useState<Date | null>(null);

  useEffect(() => {
    const tick = () => setNow(new Date());
    tick();
    const id = setInterval(tick, 10_000);
    return () => clearInterval(id);
  }, []);

  return <p className={className}>{now ? fmt.format(now) : " "}</p>;
}
