import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl text-sm font-medium transition-all duration-300 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 shrink-0 [&_svg]:shrink-0 outline-none focus-visible:ring-2 focus-visible:ring-purple-500/50 active:scale-95",
  {
    variants: {
      variant: {
        default:
          "bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-lg hover:from-purple-700 hover:to-indigo-700 hover:shadow-xl hover:-translate-y-0.5",
        destructive:
          "bg-gradient-to-r from-red-500 to-pink-600 text-white shadow-lg hover:from-red-600 hover:to-pink-700 hover:shadow-xl hover:-translate-y-0.5",
        outline:
          "border-2 border-slate-200 dark:border-slate-700 bg-white/50 dark:bg-slate-800/50 backdrop-blur-sm hover:bg-white/80 dark:hover:bg-slate-800/80 hover:border-purple-300 dark:hover:border-purple-600",
        secondary:
          "bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-slate-100 hover:bg-slate-200 dark:hover:bg-slate-700",
        ghost:
          "hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-slate-100",
        link: "text-purple-600 dark:text-purple-400 underline-offset-4 hover:underline",
      },
      size: {
        default: "h-10 px-6 py-2 has-[>svg]:px-4",
        sm: "h-8 rounded-lg gap-1.5 px-4 has-[>svg]:px-3",
        lg: "h-12 rounded-xl px-8 has-[>svg]:px-6 text-base",
        icon: "size-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

function Button({
  className,
  variant,
  size,
  asChild = false,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean
  }) {
  const Comp = asChild ? Slot : "button"

  return (
    <Comp
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Button, buttonVariants }