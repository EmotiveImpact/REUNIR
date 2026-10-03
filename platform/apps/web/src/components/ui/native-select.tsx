// Adapted from shadcn/ui new-york-v4 Native Select, MIT. See THIRD_PARTY_NOTICES.md.
import * as React from 'react';
import { cn } from '../../lib/utils';
// The browser's own select and picker, so keyboard, phone and assistive technology behaviour is the platform's.
// No wrapper or drawn chevron: the field keeps its place in the existing grid and flex rows.
export function NativeSelect({className,size='default',...props}:Omit<React.ComponentProps<'select'>,'size'>&{size?:'sm'|'default'}){return <select data-slot="native-select" data-size={size} className={cn('w-full min-w-0 rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs transition-[color,box-shadow] outline-none disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50','focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50','aria-invalid:border-destructive',className)} {...props}/>;}
