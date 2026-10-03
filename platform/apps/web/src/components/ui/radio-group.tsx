// Adapted from shadcn/ui new-york-v4 Radio Group, MIT. See THIRD_PARTY_NOTICES.md.
import * as React from 'react';
import * as Primitive from '@radix-ui/react-radio-group';
import { CircleIcon } from 'lucide-react';
import { cn } from '../../lib/utils';
const ARROWS = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'];
const ArrowMove = React.createContext<React.RefObject<boolean> | null>(null);
// The group adds no grid of its own: each form already lays out its choices.
// REUNIR addition: an arrow key checks the choice it moves to even when the key is released at once
// (assistive switches and automation), as a native radio does; Radix alone needs the key still held.
export function RadioGroup({className,onKeyDown,onBlur,onPointerDown,...props}:React.ComponentProps<typeof Primitive.Root>){const arrow=React.useRef(false);return <ArrowMove.Provider value={arrow}><Primitive.Root data-slot="radio-group" className={cn(className)} onKeyDown={e=>{arrow.current=ARROWS.includes(e.key)&&(e.target as HTMLElement).getAttribute('role')==='radio';onKeyDown?.(e);}} onBlur={e=>{if(!e.currentTarget.contains(e.relatedTarget as Node|null))arrow.current=false;onBlur?.(e);}} onPointerDown={e=>{arrow.current=false;onPointerDown?.(e);}} {...props}/></ArrowMove.Provider>;}
export function RadioGroupItem({className,onFocus,...props}:React.ComponentProps<typeof Primitive.Item>){const arrow=React.useContext(ArrowMove);return <Primitive.Item data-slot="radio-group-item" className={cn('aspect-square size-4 shrink-0 rounded-full border border-input text-primary shadow-xs transition-[color,box-shadow] outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive',className)} onFocus={e=>{onFocus?.(e);if(arrow?.current){arrow.current=false;if(e.currentTarget.getAttribute('aria-checked')!=='true')e.currentTarget.click();}}} {...props}><Primitive.Indicator data-slot="radio-group-indicator" className="relative flex items-center justify-center"><CircleIcon className="absolute top-1/2 left-1/2 size-2 -translate-x-1/2 -translate-y-1/2 fill-primary" aria-hidden="true"/></Primitive.Indicator></Primitive.Item>;}
/** REUNIR addition: makes its single child the radio group when only one answer is allowed, and leaves it unchanged when several are. */
export function OptionalRadioGroup({when,children,...props}:React.ComponentProps<typeof Primitive.Root>&{when:boolean;children:React.ReactElement}){return when?<RadioGroup asChild {...props}>{children}</RadioGroup>:children;}
