// Adapted from shadcn/ui new-york-v4 Button, MIT. See THIRD_PARTY_NOTICES.md.
import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '../../lib/utils';
export const buttonVariants = cva(
 'inline-flex shrink-0 items-center justify-center gap-2 rounded-md text-sm font-medium whitespace-nowrap transition-colors disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0',
 { variants: { variant: {
  default:'bg-primary text-primary-foreground hover:bg-primary/90',
  outline:'border bg-background text-foreground hover:bg-secondary',
  secondary:'bg-secondary text-secondary-foreground hover:bg-secondary/80',
  ghost:'hover:bg-secondary hover:text-foreground',
  link:'text-primary underline-offset-4 hover:underline',
  destructive:'border border-destructive text-foreground hover:bg-secondary'
 },size:{default:'h-9 px-4 py-2',sm:'h-8 rounded-md px-3',lg:'h-10 rounded-md px-6',icon:'size-9'}},defaultVariants:{variant:'default',size:'default'} }
);
export function Button({className,variant='default',size='default',asChild=false,...props}:React.ComponentProps<'button'>&VariantProps<typeof buttonVariants>&{asChild?:boolean}){
 const Comp=asChild?Slot:'button';
 return <Comp data-slot="button" data-variant={variant} data-size={size} className={cn(buttonVariants({variant,size,className}))} {...props}/>;
}
