"use client"

import { useAuth } from "@clerk/nextjs"
import { useRouter } from "next/navigation"

import { toast } from "@/components/ui/toast"
import type { Feature } from "@/lib/billing"

// The pricing page isn't in the sidebar; this toast is the way there
function useUpgrade() {
  const { has } = useAuth()
  const router = useRouter()

  function showUpgradeToast(title: string) {
    const id = toast.add({
      type: "error",
      title,
      description: "This needs the Pro plan.",
      actionProps: {
        children: "View plans",
        onClick: () => {
          toast.close(id)
          router.push("/pricing")
        },
      },
    })
  }

  // For a plan that has the feature but has used up this period's allowance
  function showUsageLimitToast(title: string, description: string) {
    const id = toast.add({
      type: "error",
      title,
      description,
      actionProps: {
        children: "View usage",
        onClick: () => {
          toast.close(id)
          router.push("/usage")
        },
      },
    })
  }

  // True when the user's plan has every feature; otherwise shows the toast.
  // Before Clerk loads there's nothing to check, so the server decides
  function requireFeatures(features: Feature[], title: string) {
    if (!has || features.every((feature) => has({ feature }))) return true
    showUpgradeToast(title)
    return false
  }

  return { requireFeatures, showUpgradeToast, showUsageLimitToast }
}

export { useUpgrade }
