// Adapted from shadcn/ui new-york-v4 Input, MIT. See THIRD_PARTY_NOTICES.md.
import * as React from 'react';
import { cn } from '../../lib/utils';
// No fixed height: REUNIR's field padding sets it, so larger text sizes are not clipped.
export function Input({className,type,...props}:React.ComponentProps<'input'>){return <input type={type} data-slot="input" className={cn('w-full min-w-0 rounded-md border border-input bg-transparent px-3 py-1 text-base shadow-xs transition-[color,box-shadow] outline-none selection:bg-primary selection:text-primary-foreground placeholder:text-muted-foreground disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 md:text-sm','focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50','aria-invalid:border-destructive',className)} {...props}/>;}
