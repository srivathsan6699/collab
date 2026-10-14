<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Git

-Never create branches, worktrees, or commits automatically. Only do so when the user explicitly asks for that specific action in the current request.
-Leave changes uncommitted in the working tree on the current branch and let the user decide when and how to commit

## Database

This is a development project. There is no backwards compatibility and the data is worthless. Prefer data loss: never backfill, migrate, or preserve exisitng rows, and never spend effort on keeping old data working. Every schema change means a clean slate.

-Apply schema changes only with `npm run db:push` (`drizzle-kit push`). Never generate or run migrations (`drizzle-kit generate`, `drizzle-kit migrate`, migration files, or migration scripts).

## Forms

Reference implementation: `components/bot-dialog.tsx` + `actions/bot.ts` + `insertBotSchema` in `lib/db/schema.ts`.

-One schema, both sides. Derive the validation schema from the Drizzle table with `drizzle-zod` (`createInsertSchema`, `createUpdateSchema`) in `lib/db/schema.ts`, next to the table. Never hand-write a parallel zod schema. drizzle-orm 0.45 has no built-in zod export; use the `drizzle-zod` package.
-Put trimming, length limits, and user-facing error messages in the refinement callbacks (`name: (s) => s.trim().min(1, "...")`). Refinements run before drizzle-zod adds `.nullable()`/`.optional()`, so refine the base string.
-`.pick()` only the columns the user may set. Never accept `id`, `userId`, timestamps, or other server-owned columns from the client. Use `.required()` for columns that have a `$defaultFn` but must come from the form. Export the inferred type (`z.infer`) alongside the schema.
-Server actions live in `actions/<entity>.ts` with `"use server"`. Each one: `await auth()` from `@clerk/nextjs/server` first, then `schema.safeParse(input)` again on the server, then the DB write with `userId` from the session, then `revalidatePath`.
-Actions return a result union instead of throwing for expected failures: `{ ok: true, ... } | { ok: false, error, fieldErrors? }`, with `fieldErrors` from `z.flattenError(parsed.error).fieldErrors`. Store empty optional text as `null`.
-Client forms use `react-hook-form` with `zodResolver(schema)` from `@hookform/resolvers/zod` and the exported inferred type. Submit by calling the action from `form.handleSubmit`; use `formState.isSubmitting` for pending state.
-Lay out forms with shadcn `FieldGroup` + `Field`. Each input is a `Controller` rendering `Field data-invalid={fieldState.invalid}` > `FieldLabel htmlFor` > control with `aria-invalid={fieldState.invalid}` > `FieldError errors={[fieldState.error]}`. Nullable text fields need `value={field.value ?? ""}`.
-Map server `fieldErrors` back onto the form with `form.setError`, and report the overall result with `toast.add({ type, title, description })` from `@/components/ui/toast` (Base UI, not sonner).
-Read live values with `useWatch({ control, name })`, not `form.watch()`; the React Compiler lint rule rejects `watch`.
-Buttons inside a form that are not the submit button need `type="button"`. A submit button outside the `<form>` (for example in `DialogFooter`) uses `form="<form id>"`. Show pending with `<Spinner data-icon="inline-start" />` + `disabled`, since Button has no loading prop.
-Forms in dialogs: open the dialog from a `trigger` element prop (`<DialogTrigger render={trigger} />`) so server pages can pass their own button. Put the form in a child component rendered inside `DialogContent`, so it mounts on open and resets each time; generate random defaults (like `nanoid()` seeds) there, never during SSR. Control `open` and close it from an `onCreated` callback on success. Cancel is `<DialogClose render={<Button variant="outline" />}>`.



## DiceBear

Use DiceBear 10. Documentation: https://www.dicebear.com/llms.txt

There are seven native cores with identical output, not one library with
wrappers. Use the one matching this project's language. Do not reach for the
JavaScript core when the project is written in something else:

    JavaScript  @dicebear/core + @dicebear/styles
    PHP         dicebear/core + dicebear/styles
    Python      dicebear-core + dicebear-styles
    Rust        dicebear-core + dicebear-styles
    Go          github.com/dicebear/dicebear-go/v10 + github.com/dicebear/styles/v10
    Dart        dicebear_core + dicebear_styles
    C#          DiceBear.Core + DiceBear.Styles

Every style page carries a loading snippet for all seven, for example
https://www.dicebear.com/styles/lorelei/index.md

HTTP API: https://api.dicebear.com/10.x/<style>/svg?seed=<seed> The seed is a
query parameter, not a path segment. Options are query parameters too; array
values are separated by commas.

Options named after a component end in Variant: eyesVariant, not eyes. This
holds in all seven cores and in the HTTP API. Look up the options of a style at
https://api.dicebear.com/10.x/<style>/options.json

Write these forms, not the ones on the left. The left column is pre-10 and the
API does not reject it, so an outdated call runs and silently does the wrong
thing:

    avatars.dicebear.com/api/<style>/<seed>.svg  ->  api.dicebear.com/10.x/<style>/svg?seed=<seed>
    api.dicebear.com/9.x/<style>/svg             ->  api.dicebear.com/10.x/<style>/svg
    npm install @dicebear/collection             ->  npm install @dicebear/styles
    npm install @dicebear/lorelei                ->  npm install @dicebear/styles
    createAvatar(lorelei, { seed })              ->  new Avatar(new Style(definition), { seed })
    { eyes: ['variant01'] }                      ->  { eyesVariant: ['variant01'] }
    ?radius=50                                   ->  ?borderRadius=50

Only JavaScript and the HTTP API have a pre-10 form. The other six cores were
released in 2026 and never had one, so any older-looking PHP, Python, Rust, Go,
Dart or C# API attributed to DiceBear is invented rather than outdated.

<!-- TRIGGER.DEV SKILLS START -->
## Trigger.dev agent skills

This project has Trigger.dev agent skills installed in `.agents/skills/`. Before writing or changing Trigger.dev code (background tasks, scheduled tasks, realtime, or chat.agent AI agents), load the most relevant skill: `trigger-authoring-chat-agent`, `trigger-authoring-tasks`, `trigger-cost-savings`, `trigger-chat-agent-advanced`, `trigger-getting-started`, `trigger-realtime-and-frontend`.
<!-- TRIGGER.DEV SKILLS END -->
