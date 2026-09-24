import { Boxes } from "@zeno-lib/ui/icons"
import { PackageIndex } from "@/components/home/packages"
import { Section, SectionHeader } from "@/components/home/section"
import { TodoBlock } from "@/components/home/todo-block"

export function Ships() {
  return (
    <Section topRule={false}>
      <SectionHeader
        body={
          <p>
            Each piece is a workspace package or a registry item you can add on
            its own. Nothing is hidden behind a runtime you cannot read, and
            nothing here is a wrapper you have to unwrap later.
          </p>
        }
        icon={Boxes}
        label="What ships"
        title="Batteries included, and every wire visible."
      />

      <TodoBlock
        className="mt-6 h-[clamp(7rem,13vw,11rem)]"
        label="Package diagram"
      />

      <div className="mt-6">
        <PackageIndex />
      </div>
    </Section>
  )
}
