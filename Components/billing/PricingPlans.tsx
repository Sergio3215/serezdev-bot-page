"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { PLAN_LIST, amountFor, currencyForProvider } from "@/lib/plans";
import type { BillingCycle, Currency, PaymentProvider, PlanId, SubscriptionView } from "@/types/Billing";

function formatPrice(amount: number, currency: Currency): string {
    if (currency === "usd") {
        return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(amount);
    }
    return new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 }).format(amount);
}

export default function PricingPlans() {
    const params = useParams();
    const searchParams = useSearchParams();
    const idServer = (params?.server as string) || "";

    const [provider, setProvider] = useState<PaymentProvider>("mercadopago");
    const [cycle, setCycle] = useState<BillingCycle>("monthly");
    const [email, setEmail] = useState("");

    const [current, setCurrent] = useState<SubscriptionView | null>(null);
    const [loadingPlan, setLoadingPlan] = useState(true);

    const [submitting, setSubmitting] = useState<PlanId | null>(null);
    const [error, setError] = useState<string | null>(null);

    const currency = currencyForProvider(provider);
    const checkoutResult = searchParams.get("checkout"); // "success" | "cancel"

    useEffect(() => {
        if (!idServer) return;
        let cancelled = false;

        fetch(`/api/billing/${idServer}`)
            .then((res) => (res.ok ? res.json() : null))
            .then((data) => {
                if (!cancelled && data?.subscription) setCurrent(data.subscription);
            })
            .catch(() => { /* la UI funciona igual sin el estado actual */ })
            .finally(() => {
                if (!cancelled) setLoadingPlan(false);
            });

        return () => { cancelled = true; };
    }, [idServer]);

    const handleCheckout = useCallback(
        async (plan: PlanId) => {
            setError(null);

            if (provider === "mercadopago" && cycle === "monthly" && !email.trim()) {
                setError("MercadoPago necesita tu email para las suscripciones mensuales.");
                return;
            }

            setSubmitting(plan);
            try {
                const res = await fetch("/api/billing/checkout", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ provider, plan, cycle, serverId: idServer, email: email.trim() || undefined }),
                });
                const data = await res.json();

                if (!res.ok || !data.url) {
                    setError(data.error || "No se pudo iniciar el pago.");
                    setSubmitting(null);
                    return;
                }

                window.location.href = data.url; // al checkout del proveedor
            } catch {
                setError("Error de conexión al iniciar el pago.");
                setSubmitting(null);
            }
        },
        [provider, cycle, email, idServer]
    );

    const activePlan = current?.plan ?? "free";

    const segBtn = (active: boolean) =>
        `flex-1 rounded-lg px-3 py-2 text-xs font-semibold transition-colors cursor-pointer ${active ? "bg-[#5865F2] text-white" : "bg-white/5 text-zinc-300 hover:bg-white/10"
        }`;

    const cards = useMemo(() => PLAN_LIST, []);

    return (
        <div className="mt-6 space-y-6">
            {checkoutResult === "success" && (
                <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3 text-xs text-emerald-300">
                    ¡Pago recibido! El plan se activa apenas el proveedor confirme el cobro (puede tardar unos segundos).
                </div>
            )}
            {checkoutResult === "cancel" && (
                <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-300">
                    Cancelaste el pago. No se cobró nada.
                </div>
            )}

            {/* Estado actual */}
            <div className="text-xs text-zinc-400">
                {loadingPlan ? (
                    "Cargando tu plan..."
                ) : (
                    <>
                        Plan actual del servidor:{" "}
                        <span className="font-semibold capitalize text-white">{activePlan}</span>
                        {activePlan !== "free" && current?.currentPeriodEnd && (
                            <span> · vence el {new Date(current.currentPeriodEnd).toLocaleDateString("es-AR")}</span>
                        )}
                    </>
                )}
            </div>

            <div className="flex flex-col gap-4 sm:flex-row">
                <div className="flex-1">
                    <label className="mb-1.5 block text-[11px] font-semibold text-zinc-400">Medio de pago</label>
                    <div className="flex gap-2">
                        <button className={segBtn(provider === "mercadopago")} onClick={() => setProvider("mercadopago")}>
                            MercadoPago (ARS)
                        </button>
                        <button className={segBtn(provider === "lemonsqueezy")} onClick={() => setProvider("lemonsqueezy")}>
                            Tarjeta internacional (USD)
                        </button>
                    </div>
                </div>
                <div className="flex-1">
                    <label className="mb-1.5 block text-[11px] font-semibold text-zinc-400">Modalidad</label>
                    <div className="flex gap-2">
                        <button className={segBtn(cycle === "monthly")} onClick={() => setCycle("monthly")}>
                            Mensual
                        </button>
                        <button className={segBtn(cycle === "onetime")} onClick={() => setCycle("onetime")}>
                            1 mes sin renovación
                        </button>
                    </div>
                </div>
            </div>

            {provider === "mercadopago" && cycle === "monthly" && (
                <div>
                    <label className="mb-1.5 block text-[11px] font-semibold text-zinc-400">
                        Email para la suscripción de MercadoPago
                    </label>
                    <input
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="tu@email.com"
                        className="w-full rounded-xl border border-white/15 bg-[#111214] px-3.5 py-2.5 text-sm text-white placeholder-zinc-500 focus:border-[#5865F2] focus:outline-none focus:ring-1 focus:ring-[#5865F2]"
                    />
                </div>
            )}

            {error && (
                <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-2.5 text-xs text-red-300">{error}</div>
            )}

            {/* Tarjetas de planes */}
            <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
                {cards.map((plan) => {
                    const price = amountFor(plan.id, currency, cycle);
                    const isCurrent = activePlan === plan.id;
                    const isPaid = plan.rank > 0;

                    return (
                        <div
                            key={plan.id}
                            className={`flex flex-col rounded-2xl border p-5 shadow-xl ${plan.id === "premium"
                                ? "border-[#5865F2]/50 bg-[#151827]"
                                : "border-white/10 bg-[#1e1f22]"
                                }`}
                        >
                            <div className="mb-1 flex items-center justify-between">
                                <h3 className="text-lg font-bold text-white">{plan.name}</h3>
                                {isCurrent && (
                                    <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-semibold text-emerald-300">
                                        Actual
                                    </span>
                                )}
                            </div>
                            <p className="mb-4 text-xs text-zinc-400">{plan.tagline}</p>

                            <div className="mb-4">
                                {price == null ? (
                                    <span className="text-2xl font-extrabold text-white">Gratis</span>
                                ) : (
                                    <>
                                        <span className="text-2xl font-extrabold text-white">{formatPrice(price, currency)}</span>
                                        <span className="text-xs text-zinc-400">{cycle === "monthly" ? " / mes" : " por 1 mes"}</span>
                                    </>
                                )}
                            </div>

                            <ul className="mb-5 space-y-2 text-xs text-zinc-300">
                                {plan.features.map((f) => (
                                    <li key={f} className="flex items-start gap-2">
                                        <span className="mt-0.5 text-emerald-400">✓</span>
                                        <span>{f}</span>
                                    </li>
                                ))}
                            </ul>

                            <div className="mt-auto">
                                {!isPaid ? (
                                    <div className="rounded-xl bg-white/5 py-2.5 text-center text-xs font-semibold text-zinc-400">
                                        Incluido
                                    </div>
                                ) : (
                                    <button
                                        onClick={() => handleCheckout(plan.id)}
                                        disabled={submitting !== null}
                                        className="w-full rounded-xl bg-[#5865F2] py-2.5 text-xs font-semibold text-white shadow-lg shadow-[#5865F2]/25 transition-all hover:bg-[#4752c4] disabled:opacity-50 cursor-pointer"
                                    >
                                        {submitting === plan.id ? "Redirigiendo..." : `Elegir ${plan.name}`}
                                    </button>
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
