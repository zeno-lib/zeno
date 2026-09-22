import { Button, buttonVariants } from "@zeno-lib/ui/button"
import { cn } from "@zeno-lib/ui/lib/utils"
import Link from "next/link"
import { Shell } from "@/components/home/section"
import { TodoBlock } from "@/components/home/todo-block"

export function ClosingCta() {
  return (
    <section className="zeno-surface border-t">
      <Shell className="pt-[clamp(4.5rem,9vw,9rem)] pb-14">
        <div className="grid gap-8 md:grid-cols-2 md:gap-16">
          <h2 className="max-w-lg text-balance font-medium text-3xl leading-[1.06] tracking-[-0.02em] sm:text-4xl md:text-[2.75rem]">
            Clone it, read it, keep it.
          </h2>
          <div className="zeno-prose max-w-xl text-fd-muted-foreground text-sm leading-relaxed sm:text-base">
            <p>
              The installation guide takes you from an empty machine to the full
              pipeline running locally.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Button
                className="zeno-label h-8 px-10"
                nativeButton={false}
                render={
                  <Link href="/docs/foundation/getting-started/installation" />
                }
                size="lg"
              >
                Installation guide
              </Button>
              <a
                className={cn(
                  buttonVariants({ size: "lg", variant: "outline" }),
                  "zeno-label h-8 px-10"
                )}
                href="https://github.com/zeno-lib/zeno"
                rel="noreferrer"
                target="_blank"
              >
                View on GitHub
              </a>
            </div>
          </div>
        </div>
      </Shell>
      <TodoBlock
        className="h-[clamp(15rem,27vw,24rem)]"
        label="Closing visual"
      />
    </section>
  )
}
