// Adapted from shadcn/ui new-york-v4 Label, MIT. See THIRD_PARTY_NOTICES.md.
import * as React from 'react';
import * as Primitive from '@radix-ui/react-label';
import { cn } from '../../lib/utils';
// Layout stays with REUNIR's label rule (a column of text, hint and field), and label text stays selectable.
export function Label({className,...props}:React.ComponentProps<typeof Primitive.Root>){return <Primitive.Root data-slot="label" className={cn('group-data-[disabled=true]:pointer-events-none group-data-[disabled=true]:opacity-50 peer-disabled:cursor-not-allowed peer-disabled:opacity-50',className)} {...props}/>;}
