// Adapted from shadcn/ui new-york-v4 Textarea, MIT. See THIRD_PARTY_NOTICES.md.
import * as React from 'react';
import { cn } from '../../lib/utils';
// Without field-sizing-content, so each form's rows attribute still sets the starting height.
export function Textarea({className,...props}:React.ComponentProps<'textarea'>){return <textarea data-slot="textarea" className={cn('min-h-16 w-full rounded-md border border-input bg-transparent px-3 py-2 text-base shadow-xs transition-[color,box-shadow] outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive md:text-sm',className)} {...props}/>;}
