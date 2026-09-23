import { Button } from "@zeno-lib/ui/button"
import Link from "next/link"
import { CopyCommand } from "@/components/home/copy-command"
import { RuleJunction } from "@/components/home/rule-dot"
import { Shell } from "@/components/home/section"
import { TodoBlock } from "@/components/home/todo-block"

const INSTALL_COMMAND = "pnpm dlx shadcn@latest add zeno-lib/zeno/theme"

export function Hero() {
  return (
    <section>
      {/* The navbar is fixed and its separator sits at 3.5rem + 1px, so the
          grid starts there and the vertical rule meets it. */}
      <Shell className="pt-[calc(3.5rem+1px)]">
        <div className="grid lg:grid-cols-[1.45fr_1fr] lg:gap-16">
          <h1 className="relative pt-10 font-medium text-[clamp(2rem,4.3vw,3.75rem)] uppercase leading-[0.94] tracking-[-0.035em] lg:border-r lg:py-10 lg:pr-16">
            The whole stack,
            <br />
            already wired.
            {/* The rule ends on the visual block below, so the junction only
                reaches back up into the hero. */}
            <RuleJunction
              className="-right-[0.5px] -bottom-[0.5px] translate-x-1/2 translate-y-1/2 max-lg:hidden"
              side="above"
            />
          </h1>

          <div className="mt-8 flex flex-col gap-6 pb-10 lg:mt-0 lg:py-10">
            <p className="zeno-justify zeno-label">
              An opinionated React and Next.js framework
            </p>
            <p className="max-w-md text-fd-muted-foreground text-sm leading-relaxed lg:ml-auto lg:text-right">
              Database, authentication, forms, UI and CI arrive assembled, and
              the source lands in your repository.
            </p>
            <div className="flex flex-wrap items-center gap-3 lg:justify-end">
              <Button
                className="zeno-label h-8 px-10"
                nativeButton={false}
                render={
                  <Link href="/docs/foundation/getting-started/installation" />
                }
                size="lg"
              >
                Get started
              </Button>
              <Button
                className="zeno-label h-8 px-10"
                nativeButton={false}
                render={<Link href="/docs/foundation" />}
                size="lg"
                variant="outline"
              >
                What is Zeno
              </Button>
            </div>
          </div>
        </div>
      </Shell>

      <TodoBlock
        bleed
        className="h-[clamp(16rem,32vw,28rem)]"
        label="Hero visual"
      />

      <Shell className="pt-6 pb-10 md:pb-12">
        <div className="flex justify-end">
          <CopyCommand command={INSTALL_COMMAND} />
        </div>
      </Shell>
    </section>
  )
}
