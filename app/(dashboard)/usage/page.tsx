import type { Metadata } from "next"
import { auth } from "@clerk/nextjs/server"
import { GaugeIcon } from "lucide-react"
import Link from "next/link"

import { ResetCountdown } from "@/components/reset-countdown"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty"
import { Progress, ProgressLabel } from "@/components/ui/progress"
import { getUsage } from "@/lib/usage"

export const metadata: Metadata = { title: "Usage" }

const tokenFormat = new Intl.NumberFormat("en", { notation: "compact" })

function percent(used: number, limit: number) {
  // A turn that started under the limit can finish a little over it
  return Math.min(100, Math.round((used / limit) * 100))
}

function hours(seconds: number) {
  return Math.round((seconds / 3600) * 10) / 10
}

function UsageMeter({
  label,
  value,
  summary,
  detail,
}: {
  label: string
  value: number
  summary: string
  detail: string
}) {
  return (
    <div className="flex flex-col gap-2">
      <Progress value={value}>
        <ProgressLabel>{label}</ProgressLabel>
        <span className="ml-auto text-sm text-muted-foreground tabular-nums">
          {summary}
        </span>
      </Progress>
      <p className="text-sm text-muted-foreground">
        {value >= 100 ? (
          <span className="text-destructive">
            Limit reached. This resumes when the period resets.
          </span>
        ) : (
          detail
        )}
      </p>
    </div>
  )
}

export default async function Page() {
  const { userId } = await auth.protect()
  const usage = await getUsage(userId)

  if (!usage) {
    return (
      <div className="flex min-h-svh">
        <Empty>
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <GaugeIcon />
            </EmptyMedia>
            <EmptyTitle>No usage allowance yet</EmptyTitle>
            <EmptyDescription>
              The Pro plan comes with a monthly allowance of AI usage and
              sandbox time for your bots.
            </EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            <Button nativeButton={false} render={<Link href="/pricing" />}>
              View plans
            </Button>
          </EmptyContent>
        </Empty>
      </div>
    )
  }

  const { ai, sandbox, period } = usage
  const aiPercent = percent(ai.usedMicros, ai.limitMicros)
  const sandboxPercent = percent(sandbox.seconds, sandbox.limitSeconds)

  return (
    <div className="mx-auto flex min-h-svh w-full max-w-2xl flex-col gap-6 px-4 py-12">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">Usage</h1>
        <p className="text-muted-foreground">
          <ResetCountdown resetsAt={period.end.toISOString()} />
        </p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>This period</CardTitle>
          <CardDescription>
            Your Pro plan&apos;s allowance. Everything your bots do counts
            towards it, in every chat.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-6">
          <UsageMeter
            label="AI usage"
            value={aiPercent}
            summary={`${aiPercent}%`}
            detail={`${tokenFormat.format(ai.tokens)} tokens used by your bots' replies.`}
          />
          <UsageMeter
            label="Sandbox time"
            value={sandboxPercent}
            summary={`${hours(sandbox.seconds)} of ${hours(sandbox.limitSeconds)} hours`}
            detail="Time your bots' computers are running, including idle minutes before they shut down."
          />
        </CardContent>
      </Card>
    </div>
  )
}
