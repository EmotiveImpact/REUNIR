// Adapted from shadcn/ui new-york-v4 Checkbox, MIT. See THIRD_PARTY_NOTICES.md.
import * as React from 'react';
import * as Primitive from '@radix-ui/react-checkbox';
import { CheckIcon } from 'lucide-react';
import { cn } from '../../lib/utils';
export function Checkbox({className,...props}:React.ComponentProps<typeof Primitive.Root>){return <Primitive.Root data-slot="checkbox" className={cn('peer size-4 shrink-0 rounded-[4px] border border-input shadow-xs transition-shadow outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive data-[state=checked]:border-primary data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground',className)} {...props}><Primitive.Indicator data-slot="checkbox-indicator" className="grid place-content-center text-current transition-none"><CheckIcon className="size-3.5" aria-hidden="true"/></Primitive.Indicator></Primitive.Root>;}
