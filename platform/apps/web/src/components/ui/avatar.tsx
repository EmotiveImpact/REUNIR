// Adapted from shadcn/ui new-york-v4 Avatar, MIT. See THIRD_PARTY_NOTICES.md.
import * as React from 'react';
import * as Primitive from '@radix-ui/react-avatar';
import { cn } from '../../lib/utils';
export function Avatar({className,...props}:React.ComponentProps<typeof Primitive.Root>){return <Primitive.Root data-slot="avatar" className={cn('relative flex size-8 shrink-0 overflow-hidden rounded-full select-none',className)} {...props}/>;}
export function AvatarImage({className,...props}:React.ComponentProps<typeof Primitive.Image>){return <Primitive.Image data-slot="avatar-image" className={cn('aspect-square size-full object-cover',className)} {...props}/>;}
export function AvatarFallback({className,...props}:React.ComponentProps<typeof Primitive.Fallback>){return <Primitive.Fallback data-slot="avatar-fallback" className={cn('flex size-full items-center justify-center rounded-full bg-secondary text-xs text-muted-foreground',className)} {...props}/>;}
