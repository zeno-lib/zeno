import { cn } from "@zeno-lib/ui/lib/utils"
import Image from "next/image"
import Link from "next/link"

interface WelcomeProps {
  className?: string
  imageUrl: string
  Logo?: React.ComponentType<{ className?: string }>
  title: string
}

export const Welcome = ({ className, imageUrl, title, Logo }: WelcomeProps) => (
  <div
    className={cn(
      "dark relative flex flex-1 flex-col justify-between gap-6 bg-primary-900 p-8",
      className
    )}
  >
    <div className="pointer-events-none absolute inset-0 bg-linear-to-b from-gray-600 via-gray-700 to-gray-800" />
    <Image
      alt="Welcome Background"
      className="pointer-events-none object-cover opacity-50"
      fill
      priority
      sizes="(max-width: 1024px) 50vw, 100vw"
      src={imageUrl}
    />
    <div className="z-10 flex items-center">
      {Logo && <Logo className="hidden h-8 lg:block" />}
      <div className="hidden font-title text-muted-foreground lg:block">
        &nbsp;&nbsp;/&nbsp;&nbsp;
      </div>
      <div className="hidden font-title text-black lg:block dark:text-white">
        {title}
      </div>
    </div>
    <div className="flex flex-col items-center gap-8 self-center text-center sm:max-w-md" />
    <div className="z-10 text-center text-muted-foreground text-sm italic lg:text-left">
      In partnership with&nbsp;
      <Link className="link" href="https://resolve.ch">
        Resolve
      </Link>
    </div>
  </div>
)
