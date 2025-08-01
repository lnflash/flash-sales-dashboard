import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex items-center justify-center rounded-lg text-sm font-medium ring-offset-background transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 shadow-sm",
  {
    variants: {
      variant: {
        default: "bg-flash-green text-white hover:bg-flash-green-dark",
        destructive:
          "bg-red-500 text-white hover:bg-red-600",
        outline:
          "border border-light-border bg-white hover:bg-light-bg-secondary hover:text-light-text-primary",
        secondary:
          "bg-light-bg-secondary text-light-text-primary hover:bg-light-bg-tertiary",
        ghost: "hover:bg-light-bg-secondary hover:text-light-text-primary shadow-none",
        link: "text-flash-green underline-offset-4 hover:underline shadow-none",
        btcOrange: "bg-btc-orange text-white hover:bg-btc-orange/90",
      },
      size: {
        default: "h-10 px-4 py-2",
        sm: "h-9 rounded-md px-3",
        lg: "h-11 rounded-md px-8",
        icon: "h-10 w-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    return (
      <button
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    )
  }
)
Button.displayName = "Button"

export { Button, buttonVariants }