# Third-party notices and reuse register

This first release reuses published libraries. The dependency lockfile pins actual versions. Direct-package licence declarations were read from the installed package metadata; copies of available top-level licence notices are included under `legal/dependencies`. This register is not a complete transitive legal or security clearance.

| Dependency | Version | Declared licence |
| --- | --- | --- |
| @axe-core/playwright | 4.13.0 | MPL-2.0 |
| @better-auth/drizzle-adapter | 1.7.5 | MIT |
| @electric-sql/pglite | 0.5.8 | Apache-2.0 |
| @google-cloud/storage | 8.2.0 | Apache-2.0 |
| @hono/node-server | 2.1.1 | MIT |
| @playwright/test | 1.63.0 | Apache-2.0 |
| @tanstack/react-query | 5.103.2 | MIT |
| @types/node | 22.20.4 | MIT |
| @types/pg | 8.23.1 | MIT |
| @types/react | 19.3.0 | MIT |
| @types/react-dom | 19.3.0 | MIT |
| better-auth | 1.7.5 | MIT |
| drizzle-orm | 0.45.3 | Apache-2.0 |
| hono | 4.13.9 | MIT |
| lucide-react | 1.47.0 | ISC |
| pg | 8.23.0 | MIT |
| react | 19.3.0 | MIT |
| react-dom | 19.3.0 | MIT |
| react-router-dom | 7.18.4 | MIT |
| tsx | 4.23.15 | MIT |
| typescript | 5.9.3 | Apache-2.0 |
| vite | 7.3.6 | MIT |
| zod | 4.6.5 | MIT |

## Reference application source

No application code from Roost, OpenCircle, ClassroomIO, LearnHouse, Frappe Learning or HumHub has been included in the shipped runtime. Their product/architecture patterns informed the research and requirements. This is not a rule against reuse: any future copied/adapted component needs its actual upstream commit, applicable licence, attribution, modifications and compliance decision recorded before shipping. Researching source does not grant permission to remove its notices or present it as our original work.

AGPL-compatible commercial deployment or a negotiated commercial licence remains a valid direction. Package metadata that disagrees with a repository-level licence needs resolution. Roost licence clearance must not be inferred from the README alone.

## Visual assets

The supplied approved v4 HTML reference contains the mountain image and sample portrait JPEGs. Those bytes were extracted for this integration, with the hero crop trimmed to remove baked-in text. Seven portraits are used only for explicit demo fixture IDs; live accounts use their actual avatar or a neutral icon fallback. These are sample visual assets, not evidence of a verified real-world identity or a completed image-rights clearance. Approve production photography before external launch. Existing geometric course/project placeholder art remains where no original image is available. No third-party font files are included. Inter is preferred when installed; system sans-serif fallbacks and a system editorial serif are used. All demonstration people/content are fictional.

## Distribution

The product owner has not selected the final licence for the original REUNIR application. Third-party packages retain their respective licences. Do not infer an MIT licence for the complete application from an MIT dependency. Source is provided to the project owner for development and review.

## Alpha 05 provenance

No donor application's source file or new runtime dependency is added by the project workboard. Behavioural references and exact source pins are recorded in ../research/reuse-register.json. REUNIR's existing contribution review UI/domain, database transaction and idempotency mechanisms are reused. Referencing a project's licence here does not relicense this workspace or clear a future source import.


## Alpha 07: actual shadcn component source

Three scoped component files adapt the official `new-york-v4` registry source, rather than merely imitating its CSS. The complete shadcn MIT notice is preserved in `legal/shadcn-MIT.txt`. Source blobs retrieved on 2 October 2026:

| File | Upstream blob | Local adaptation |
| --- | --- | --- |
| button.tsx | e3345d985d14c33e3cb9d8c45cf973807326c944 | cva variants, Slot composition, semantic data attributes; neutral v4 tokens |
| avatar.tsx | 561f04be186f94896ec31e618fee6818c7fcc6c8 | Radix image/fallback primitives, existing REUNIR sizes; fixture-safe photo wrapper |
| dropdown-menu.tsx | 1f9742d6783223126a3b91e91b7a230243ddf23d | Used Root/Trigger/Content/Item/Label/Separator subset; account menu configured non-modal |

Repository: https://github.com/shadcn-ui/ui
Source directory: `apps/v4/registry/new-york-v4/ui/`. The upstream `cn` import is mapped to REUNIR's `lib/utils.ts`. Individual pinned Radix packages provide the corresponding primitives instead of adopting the entire unified package. Unused badge/submenu/radio helpers are omitted. The existing native-dialog forms have not been falsely labelled as shadcn components.

### Added dependency notices

- `@radix-ui/react-avatar` 1.1.10: MIT. legal/dependencies/radix-ui__react-avatar-LICENSE.txt
- `@radix-ui/react-dropdown-menu` 2.1.16: MIT. legal/dependencies/radix-ui__react-dropdown-menu-LICENSE.txt
- `@radix-ui/react-slot` 1.2.3: MIT. legal/dependencies/radix-ui__react-slot-LICENSE.txt
- `@tailwindcss/vite` 4.1.14: MIT. legal/dependencies/tailwindcss__vite-LICENSE.txt
- `tailwindcss` 4.1.14: MIT. legal/dependencies/tailwindcss-LICENSE.txt
- `class-variance-authority` 0.7.1: Apache-2.0. legal/dependencies/class-variance-authority-LICENSE.txt
- `clsx` 2.1.1: MIT. legal/dependencies/clsx-license.txt
- `tailwind-merge` 3.3.1: MIT. legal/dependencies/tailwind-merge-LICENSE.md.txt

## Alpha 08 rich lesson editing

`@tiptap/core`, `@tiptap/pm`, `@tiptap/react`, and `@tiptap/starter-kit` are pinned to 3.31.4. Tiptap is MIT licensed; the installed licence is retained in `legal/tiptap-MIT.txt`. Complete licence notices for all 47 newly added packages, including ProseMirror, are retained in `legal/rich-editor-dependencies.txt`. The source and lockfile preserve package integrity hashes. No Tiptap cloud service, commercial extension or donor LMS application is required. Our editor integration, bounded schema and React renderer are local application code.

## Alpha 09: private lesson resources

No new runtime dependency and no donor application source. Lesson files extend REUNIR's existing upload-intent API and `@google-cloud/storage` 8.2.0 adapter (Apache-2.0, notice in `legal/dependencies`). LearnHouse, Frappe Learning and ClassroomIO were read at pinned commits as behavioural references only; all three are AGPL at their repository roots, and ClassroomIO's root package metadata conflicts with its licence file. Exact files, blobs and what was learned are in `../research/reuse-register.json` and `../research/notes/14_LESSON_RESOURCES.md`. The fictional sample PDF in the demo is generated by REUNIR code at runtime.

## Alpha 10: knowledge checks

No new runtime dependency and no donor application source. Knowledge checks are local application code built on REUNIR's existing lesson draft, publication and review model, Zod schemas and shadcn Button. Frappe Learning, LearnHouse and ClassroomIO were read at pinned commits as behavioural references only; all three are AGPL at their repository roots. Exact files, blobs and what was learned are in `../research/reuse-register.json` and `../research/notes/15_ASSESSMENTS.md`. The demo's questions and Sofia Chen's sample answer are fictional and written for REUNIR.

## Alpha 30: shared shadcn form components

Seven more component files adapt the official `new-york-v4` registry source, under the same retained MIT notice (`legal/shadcn-MIT.txt`). Each blob is the Git object id of the file fetched from the `main` branch on 3 October 2026 (the same method gives Alpha 07's recorded button.tsx blob, which is unchanged upstream):

| File | Upstream blob | Local adaptation |
| --- | --- | --- |
| input.tsx | ddb9b315e34245addded54b1848bb32c80c418cc | No fixed `h-9` and no `dark:` variants: REUNIR's field padding sets the height and the interface is always dark |
| textarea.tsx | bf23f6c255978311c3069f5da3fa10c1d896e8cf | No `field-sizing-content` or `flex`, so each form's `rows` still sets the starting height |
| label.tsx | 5aff7469c384001a3f1b49cc5cf8871b10f10386 | Radix Label kept; the row layout, `leading-none` and `select-none` classes dropped so labels keep REUNIR's text, hint and field column |
| native-select.tsx | 9ddba6b7fcddda52d9c4fc969cd910b929e7aec7 | The `select` element and its classes only: no wrapper or drawn chevron, so the field keeps its place in existing grid and flex rows; options stay plain `option` elements |
| checkbox.tsx | 9aaa1baace43e42aba6ee7c3b04adb8ff7e99ea2 | Unchanged apart from the `cn` path, the dropped `dark:` variants and `aria-hidden` on the icon |
| radio-group.tsx | 2dc7ec59fa0af08a9274410db47b03cb78f629eb | No `grid gap-3` on the group; an arrow key checks the choice it moves to even when released at once; `OptionalRadioGroup` helper |
| switch.tsx | c45932afe4e484c900aa916e81d0e0d67137bedc | Unchanged apart from the `cn` path and the dropped `dark:` variants |

The upstream `radix-ui` unified import is replaced by the individual pinned packages below. `forms.css` restores borders and fills that the global `button` reset would otherwise remove from the Radix controls, in neutral greys. The shadcn Dialog (blob ccadf4a85bf6398d52314b112600f796fc97db97) was read but not adopted: `Modal` stays a native modal `dialog` (see `docs/FORMS.md`).

### Added dependency notices

- `@radix-ui/react-checkbox` 1.3.3: MIT. legal/dependencies/radix-ui__react-checkbox-LICENSE.txt
- `@radix-ui/react-label` 2.1.7: MIT. legal/dependencies/radix-ui__react-label-LICENSE.txt
- `@radix-ui/react-radio-group` 1.3.8: MIT. legal/dependencies/radix-ui__react-radio-group-LICENSE.txt
- `@radix-ui/react-switch` 1.2.6: MIT. legal/dependencies/radix-ui__react-switch-LICENSE.txt
- `@radix-ui/react-use-previous` 1.1.1 (transitive, new to the lockfile): MIT declared in its package metadata; the package ships no licence file, and the Radix licence text above covers the same repository.

Every other transitive Radix package these need was already in the lockfile at the same version.
