// Scoped adaptation of shadcn/ui new-york-v4 Dropdown Menu, MIT.
import * as React from 'react';
import * as Primitive from '@radix-ui/react-dropdown-menu';
import { cn } from '../../lib/utils';
export const DropdownMenu=Primitive.Root;
export const DropdownMenuTrigger=Primitive.Trigger;
export function DropdownMenuContent({className,sideOffset=8,...props}:React.ComponentProps<typeof Primitive.Content>){return <Primitive.Portal><Primitive.Content data-slot="dropdown-menu-content" sideOffset={sideOffset} className={cn('z-50 min-w-56 overflow-hidden rounded-md border bg-popover p-1 text-popover-foreground shadow-md',className)} {...props}/></Primitive.Portal>;}
export function DropdownMenuItem({className,...props}:React.ComponentProps<typeof Primitive.Item>){return <Primitive.Item data-slot="dropdown-menu-item" className={cn('relative flex cursor-default select-none items-center gap-2 rounded-sm px-2 py-2 text-sm outline-none focus:bg-secondary data-[disabled]:pointer-events-none data-[disabled]:opacity-50',className)} {...props}/>;}
export function DropdownMenuLabel({className,...props}:React.ComponentProps<typeof Primitive.Label>){return <Primitive.Label data-slot="dropdown-menu-label" className={cn('px-2 py-2 text-sm font-medium',className)} {...props}/>;}
export function DropdownMenuSeparator({className,...props}:React.ComponentProps<typeof Primitive.Separator>){return <Primitive.Separator data-slot="dropdown-menu-separator" className={cn('my-1 h-px bg-border',className)} {...props}/>;}
