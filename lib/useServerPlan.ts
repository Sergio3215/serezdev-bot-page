"use client";

import { useEffect, useState } from "react";
import type { PlanId } from "@/types/Billing";

/** Plan efectivo del servidor; `null` mientras carga. Si no se puede leer, cuenta como Free. */
export function useServerPlan(serverId: string): PlanId | null {
    const [plan, setPlan] = useState<PlanId | null>(null);

    useEffect(() => {
        if (!serverId) return;
        let cancelled = false;
        fetch(`/api/billing/${serverId}`)
            .then((res) => (res.ok ? res.json() : null))
            .then((data) => {
                if (!cancelled) setPlan(data?.subscription?.plan ?? "free");
            })
            .catch(() => {
                if (!cancelled) setPlan("free");
            });
        return () => { cancelled = true; };
    }, [serverId]);

    return plan;
}
