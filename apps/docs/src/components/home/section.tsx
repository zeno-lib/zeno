import { cn } from "@zeno-lib/ui/lib/utils"
import type { ComponentProps, ComponentType, ReactNode, SVGProps } from "react"
import { RuleDot } from "@/components/home/rule-dot"

/** The centred column every section shares. */
export function Shell({ children, className }: ComponentProps<"div">) {
  return (
    <div
      className={cn(
        "relative mx-auto w-full max-w-[90rem] border-x px-6 md:px-12 lg:px-16",
        className
      )}
    >
      {children}
    </div>
  )
}

export function Section({
  children,
  className,
  topRule = true,
  ...props
}: ComponentProps<"section"> & { topRule?: boolean }) {
  return (
    <section className={cn(topRule && "border-t", className)} {...props}>
      <Shell className="py-[clamp(4.5rem,9vw,9rem)]">
        {topRule && (
          <>
            {/* The column rules meet the section rule here. */}
            <RuleDot className="-top-px -left-px -translate-x-1/2 -translate-y-1/2" />
            <RuleDot className="-top-px -right-px translate-x-1/2 -translate-y-1/2" />
          </>
        )}
        {children}
      </Shell>
    </section>
  )
}

/**
 * Heading on the left with a mono label tucked underneath it, body on the
 * right, set justified. Every section below the fold uses this shape.
 */
export function SectionHeader({
  body,
  icon: Icon,
  label,
  title,
}: {
  body: ReactNode
  icon: ComponentType<SVGProps<SVGSVGElement>>
  label: string
  title: ReactNode
}) {
  return (
    <div className="md:grid md:grid-cols-2 md:gap-x-16">
      <p className="zeno-label mb-2.5 flex items-center gap-2 text-fd-muted-foreground md:col-start-1 md:row-start-1">
        <Icon className="size-3.5" />
        {label}
      </p>
      <h2 className="max-w-lg text-balance font-medium text-3xl leading-[1.06] tracking-[-0.02em] sm:text-4xl md:col-start-1 md:row-start-2 md:text-[2.75rem]">
        {title}
      </h2>
      <div className="zeno-prose mt-8 max-w-xl text-fd-muted-foreground text-sm leading-relaxed sm:text-base md:col-start-2 md:row-start-2 md:mt-0">
        {body}
      </div>
    </div>
  )
}
