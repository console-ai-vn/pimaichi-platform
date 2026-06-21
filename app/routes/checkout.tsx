import { Button, Loader } from "@cloudflare/kumo"
import { ArrowLeft, CheckIcon, XIcon } from "@phosphor-icons/react"
import { useEffect, useState, useCallback } from "react"
import { useNavigate, useSearchParams } from "react-router"
import PaymentQR from "~/components/PaymentQR"
import TierCard from "~/components/TierCard"
import { useCheckout, useInvoice } from "~/queries/payments"

const TIERS = [
  {
    name: "basic",
    price: 190000,
    features: ["1 mailbox", "5GB storage", "Basic features", "Standard support"],
  },
  {
    name: "pro",
    price: 490000,
    features: [
      "5 mailboxes",
      "50GB storage",
      "Media upload",
      "Custom domain",
      "Priority support",
    ],
    highlighted: true,
  },
  {
    name: "premium",
    price: 990000,
    features: [
      "20 mailboxes",
      "200GB storage",
      "All features",
      "Priority support",
      "AI-powered replies",
      "Advanced analytics",
    ],
  },
] as const

const CHECKOUT_STEPS = [
  { id: "select", label: "Select Plan" },
  { id: "payment", label: "Payment" },
  { id: "complete", label: "Complete" },
] as const

function fireConfetti() {
  const colors = ["#4f7cff", "#1ed6a0", "#f59e0b", "#ef4444", "#8b5cf6"]
  const container = document.createElement("div")
  container.className = "fixed inset-0 pointer-events-none z-50"
  document.body.appendChild(container)

  for (let i = 0; i < 60; i++) {
    const confetti = document.createElement("div")
    const color = colors[Math.floor(Math.random() * colors.length)]
    const left = Math.random() * 100
    const delay = Math.random() * 2
    const size = 6 + Math.random() * 8

    confetti.style.cssText = `position:absolute;left:${left}%;top:-20px;width:${size}px;height:${size}px;background:${color};border-radius:2px;animation:confetti-fall ${2 + Math.random() * 3}s ease-in ${delay}s forwards;opacity:0`
    container.appendChild(confetti)
  }

  setTimeout(() => container.remove(), 6000)
}

export default function CheckoutRoute() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const mailboxId = searchParams.get("mailboxId") || ""
  const preselectedTier = searchParams.get("tier") || ""

  const [currentStep, setCurrentStep] = useState(0)
  const [selectedTier, setSelectedTier] = useState<string | null>(
    preselectedTier || null,
  )
  const [invoiceId, setInvoiceId] = useState<string | null>(null)
  const [qrCode, setQrCode] = useState<string | null>(null)
  const [checkoutUrl, setCheckoutUrl] = useState<string | null>(null)
  const [checkoutAmount, setCheckoutAmount] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [paymentComplete, setPaymentComplete] = useState(false)

  const checkout = useCheckout()
  const invoiceQuery = useInvoice(invoiceId || "", mailboxId)

  const handleSelectTier = useCallback(
    async (tierName: string) => {
      setError(null)
      setSelectedTier(tierName)

      try {
        const result = await checkout.mutateAsync({
          mailboxId: mailboxId || "pending@onyx.com.vn",
          tier: tierName,
        })

        setInvoiceId(result.invoice.id)
        setQrCode(result.qrCode)
        setCheckoutUrl(result.checkoutUrl)
        setCheckoutAmount(result.amount)
        setCurrentStep(1)
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Failed to create checkout",
        )
        setSelectedTier(null)
      }
    },
    [checkout, mailboxId],
  )

  const invoice = invoiceQuery.data?.invoice
  const subscription = invoiceQuery.data?.subscription

  useEffect(() => {
    if (
      invoice?.status === "paid" &&
      subscription?.status === "active" &&
      !paymentComplete
    ) {
      setPaymentComplete(true)
      setCurrentStep(2)
      fireConfetti()
    }
  }, [invoice?.status, subscription?.status, paymentComplete])

  const steps = CHECKOUT_STEPS

  if (!mailboxId) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-kumo-recessed">
        <div className="rounded-xl border border-kumo-line bg-kumo-base p-8 text-center mx-4">
          <p className="text-kumo-subtle">
            Missing mailbox parameter. Please go through the signup flow.
          </p>
          <Button
            variant="primary"
            className="mt-4"
            onClick={() => navigate("/signup")}
          >
            Go to Signup
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-kumo-recessed flex flex-col">
      {/* Header */}
      <header className="flex items-center justify-between border-b border-kumo-line bg-kumo-base px-4 py-3 md:px-10 md:py-4">
        <a href="/" className="flex items-center gap-3 no-underline">
          <div className="grid h-9 w-9 place-items-center rounded-xl bg-kumo-brand text-sm font-black text-white">
            O
          </div>
          <span className="text-lg font-bold text-kumo-default">ONYX</span>
        </a>
        {currentStep > 0 && (
          <button
            type="button"
            onClick={() => {
              setCurrentStep(0)
              setQrCode(null)
              setCheckoutUrl(null)
              setInvoiceId(null)
              setSelectedTier(null)
              setError(null)
            }}
            className="text-sm text-kumo-subtle hover:text-kumo-default transition-colors"
          >
            Change plan
          </button>
        )}
      </header>

      {/* Main content */}
      <div className="flex-1 flex flex-col">
        {/* Desktop layout: centered card */}
        <div className="hidden md:flex md:flex-1 md:items-center md:justify-center md:p-8">
          <div className="w-full max-w-5xl">
            {/* Progress - desktop */}
            <div className="mb-10">
              <div className="flex items-center justify-center gap-1">
                {steps.map((s, i) => (
                  <div key={s.id} className="flex items-center gap-1">
                    <div
                      className={`flex size-10 items-center justify-center rounded-full text-sm font-semibold transition-all ${
                        i < currentStep
                          ? "bg-kumo-brand text-white"
                          : i === currentStep
                            ? "bg-kumo-brand text-white ring-4 ring-kumo-brand/20"
                            : "bg-kumo-fill text-kumo-subtle"
                      }`}
                    >
                      {i < currentStep ? (
                        <CheckIcon size={16} weight="bold" />
                      ) : (
                        i + 1
                      )}
                    </div>
                    {i < steps.length - 1 && (
                      <div
                        className={`h-px w-16 ${i < currentStep ? "bg-kumo-brand" : "bg-kumo-line"}`}
                      />
                    )}
                  </div>
                ))}
              </div>
              <p className="mt-3 text-center text-sm text-kumo-subtle">
                {steps[currentStep].label}
              </p>
            </div>

            {/* Error */}
            {error && (
              <div className="mx-auto mb-6 max-w-lg rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 text-center">
                {error}
              </div>
            )}

            {/* Step 0: Select */}
            {currentStep === 0 && (
              <div>
                <div className="mb-8 text-center">
                  <h1 className="text-3xl font-bold text-kumo-default">
                    Choose Your Plan
                  </h1>
                  <p className="mt-2 text-kumo-subtle">
                    Select the tier that fits your needs. Upgrade anytime.
                  </p>
                </div>
                {checkout.isPending ? (
                  <div className="flex justify-center py-16">
                    <Loader size="lg" />
                  </div>
                ) : (
                  <div className="grid gap-6 md:grid-cols-3">
                    {TIERS.map((tier) => (
                      <TierCard
                        key={tier.name}
                        name={tier.name}
                        price={tier.price}
                        features={tier.features as unknown as string[]}
                        highlighted={
                          "highlighted" in tier &&
                          (tier.highlighted as boolean) === true
                        }
                        onSelect={() => handleSelectTier(tier.name)}
                      />
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Step 1: Payment */}
            {currentStep === 1 && qrCode && (
              <div className="mx-auto max-w-md text-center">
                <h1 className="mb-2 text-2xl font-bold text-kumo-default">
                  Complete Your Payment
                </h1>
                <p className="mb-6 text-sm text-kumo-subtle">
                  Choose how to pay for your{" "}
                  <span className="font-semibold capitalize text-kumo-default">
                    {selectedTier}
                  </span>{" "}
                  plan.
                </p>

                {checkoutUrl && (
                  <a
                    href={checkoutUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mb-4 flex w-full items-center justify-center gap-2 rounded-xl bg-kumo-brand px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-kumo-brand/90"
                  >
                    Pay Online — {new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND", maximumFractionDigits: 0 }).format(checkoutAmount)}
                  </a>
                )}

                <div className="mb-2 text-xs text-kumo-subtle">Or scan VietQR with your banking app</div>

                <PaymentQR
                  qrCode={qrCode}
                  amount={checkoutAmount}
                  description={`PIMAICHI ${selectedTier} subscription`}
                  onExpired={() => {
                    setQrCode(null)
                    setCheckoutUrl(null)
                    setInvoiceId(null)
                    setSelectedTier(null)
                    setCurrentStep(0)
                    setError("QR code expired. Please try again.")
                  }}
                />
                {invoiceQuery.isFetching && (
                  <div className="mt-4 flex items-center justify-center gap-2 text-sm text-kumo-subtle">
                    <Loader size="sm" />
                    <span>Waiting for payment confirmation...</span>
                  </div>
                )}
                <Button
                  variant="secondary"
                  size="sm"
                  className="mt-4"
                  onClick={() => {
                    setQrCode(null)
                    setCheckoutUrl(null)
                    setInvoiceId(null)
                    setSelectedTier(null)
                    setCurrentStep(0)
                    setError(null)
                  }}
                >
                  Choose Different Plan
                </Button>
              </div>
            )}

            {/* Step 2: Complete */}
            {currentStep === 2 && (
              <div className="mx-auto max-w-md text-center">
                <div className="rounded-2xl border border-kumo-line bg-kumo-base p-8 shadow-lg">
                  <div className="mx-auto mb-4 flex size-20 items-center justify-center rounded-full bg-emerald-100">
                    <CheckIcon
                      size={36}
                      className="text-emerald-500"
                      weight="bold"
                    />
                  </div>
                  <h1 className="text-2xl font-bold text-kumo-default">
                    Payment Complete!
                  </h1>
                  <p className="mt-2 text-kumo-subtle">
                    Your{" "}
                    <span className="font-semibold capitalize text-kumo-default">
                      {selectedTier}
                    </span>{" "}
                    plan is now active. Welcome to ONYX!
                  </p>
                  <div className="mt-6 rounded-xl border border-kumo-line bg-kumo-recessed p-4 text-left text-sm">
                    <div className="flex justify-between">
                      <span className="text-kumo-subtle">Plan:</span>
                      <span className="font-medium text-kumo-default capitalize">
                        {selectedTier}
                      </span>
                    </div>
                    <div className="mt-1 flex justify-between">
                      <span className="text-kumo-subtle">Mailbox:</span>
                      <span className="font-medium text-kumo-default">
                        {mailboxId}
                      </span>
                    </div>
                    <div className="mt-1 flex justify-between">
                      <span className="text-kumo-subtle">Amount:</span>
                      <span className="font-medium text-kumo-default">
                        {new Intl.NumberFormat("vi-VN", {
                          style: "currency",
                          currency: "VND",
                          maximumFractionDigits: 0,
                        }).format(checkoutAmount)}
                      </span>
                    </div>
                  </div>
                  <Button
                    variant="primary"
                    size="lg"
                    className="mt-6 w-full"
                    onClick={() => navigate("/app", { replace: true })}
                  >
                    Go to Dashboard
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Mobile layout: bottom sheet */}
        <div className="md:hidden flex-1 flex flex-col bg-kumo-recessed p-4 overflow-auto">
          {/* Mobile progress dots */}
          <div className="flex items-center justify-center gap-2 mb-6">
            {steps.map((_, i) => (
              <div
                key={steps[i].id}
                className={`h-1.5 rounded-full transition-all ${
                  i === currentStep
                    ? "w-6 bg-kumo-brand"
                    : i < currentStep
                      ? "w-1.5 bg-kumo-brand"
                      : "w-1.5 bg-kumo-line"
                }`}
              />
            ))}
          </div>

          {/* Error */}
          {error && (
            <div className="mb-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700 text-center">
              {error}
            </div>
          )}

          {/* Step 0: Select Plan */}
          {currentStep === 0 && (
            <div className="flex-1 flex flex-col">
              <div className="mb-4 text-center">
                <h1 className="text-xl font-bold text-kumo-default">
                  Choose Your Plan
                </h1>
                <p className="mt-1 text-sm text-kumo-subtle">
                  Select the tier that fits your needs.
                </p>
              </div>

              {checkout.isPending ? (
                <div className="flex justify-center py-16">
                  <Loader size="lg" />
                </div>
              ) : (
                <div className="flex-1 space-y-3">
                  {TIERS.map((tier) => (
                    <button
                      key={tier.name}
                      type="button"
                      onClick={() => handleSelectTier(tier.name)}
                      className={`w-full flex items-center justify-between rounded-xl border p-4 text-left transition-all active:scale-[0.98] ${
                        "highlighted" in tier && tier.highlighted
                          ? "border-kumo-brand bg-kumo-brand/5 ring-1 ring-kumo-brand"
                          : "border-kumo-line bg-kumo-base"
                      }`}
                    >
                      <div>
                        <p className="text-sm font-bold text-kumo-default capitalize">
                          {tier.name}
                          {("highlighted" in tier && tier.highlighted) && (
                            <span className="ml-2 rounded-full bg-kumo-brand px-2 py-0.5 text-[10px] text-white">
                              Popular
                            </span>
                          )}
                        </p>
                        <p className="mt-0.5 text-xs text-kumo-subtle">
                          {tier.features.length} features
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-lg font-bold text-kumo-default">
                          {new Intl.NumberFormat("vi-VN", {
                            style: "currency",
                            currency: "VND",
                            maximumFractionDigits: 0,
                          }).format(tier.price)}
                        </p>
                        <p className="text-[10px] text-kumo-subtle">/mo</p>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Step 1: Payment QR */}
          {currentStep === 1 && qrCode && (
            <div className="flex-1 flex flex-col items-center justify-center px-4">
              <h1 className="mb-2 text-lg font-bold text-kumo-default text-center">
                Complete Your Payment
              </h1>
              <p className="mb-4 text-sm text-kumo-subtle text-center">
                Choose how to pay for your{" "}
                <span className="font-semibold capitalize text-kumo-default">{selectedTier}</span> plan
              </p>

              {checkoutUrl && (
                <a
                  href={checkoutUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mb-4 flex w-full items-center justify-center gap-2 rounded-xl bg-kumo-brand px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-kumo-brand/90"
                >
                  Pay Online — {new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND", maximumFractionDigits: 0 }).format(checkoutAmount)}
                </a>
              )}

              <div className="mb-3 text-xs text-kumo-subtle text-center">Or scan VietQR with your banking app</div>

              <PaymentQR
                qrCode={qrCode}
                amount={checkoutAmount}
                description={`PIMAICHI ${selectedTier} subscription`}
                onExpired={() => {
                  setQrCode(null)
                  setCheckoutUrl(null)
                  setInvoiceId(null)
                  setSelectedTier(null)
                  setCurrentStep(0)
                  setError("QR code expired. Please try again.")
                }}
              />

              {invoiceQuery.isFetching && (
                <div className="mt-3 flex items-center justify-center gap-2 text-xs text-kumo-subtle">
                  <Loader size="sm" />
                  <span>Waiting for confirmation...</span>
                </div>
              )}

              <button
                type="button"
                className="mt-4 text-sm text-kumo-brand font-medium hover:underline"
                onClick={() => {
                  invoiceQuery.refetch()
                }}
              >
                I've paid
              </button>
            </div>
          )}

          {/* Step 2: Complete */}
          {currentStep === 2 && (
            <div className="flex-1 flex flex-col items-center justify-center text-center">
              <div className="mx-auto mb-4 flex size-16 items-center justify-center rounded-full bg-emerald-100">
                <CheckIcon size={28} className="text-emerald-500" weight="bold" />
              </div>
              <h1 className="text-xl font-bold text-kumo-default">
                Payment Complete!
              </h1>
              <p className="mt-2 text-sm text-kumo-subtle">
                Your{" "}
                <span className="font-semibold capitalize text-kumo-default">
                  {selectedTier}
                </span>{" "}
                plan is now active.
              </p>
              <div className="mt-5 w-full rounded-xl border border-kumo-line bg-kumo-recessed p-3 text-sm space-y-1">
                <div className="flex justify-between">
                  <span className="text-kumo-subtle">Plan</span>
                  <span className="font-medium text-kumo-default capitalize">{selectedTier}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-kumo-subtle">Amount</span>
                  <span className="font-medium text-kumo-default">
                    {new Intl.NumberFormat("vi-VN", {
                      style: "currency",
                      currency: "VND",
                      maximumFractionDigits: 0,
                    }).format(checkoutAmount)}
                  </span>
                </div>
              </div>
              <Button
                variant="primary"
                size="lg"
                className="mt-6 w-full"
                onClick={() => navigate("/app", { replace: true })}
              >
                Go to Dashboard
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
