# Learnings (FieldSoli / Figma / tooling)

> Historical tooling notes: as of 2026-10-24, design work happens in ChatGPT and Figma Pro is cancelled. The Figma-first workflow below is superseded. Do not automatically sync, maintain, or verify Figma; follow `AGENTS.md` and `CONTEXT.md` for current product-context maintenance.


Short, durable notes from integration work so we do not repeat slow failures.

## Figma MCP (`use_figma`)
- **Always use autolayout** Autolayout should be used wherever possible. Only use vertical and horizontal layouts for different containers.
- **Dynamic code execution is unreliable.** The plugin runtime used by MCP often blocks **`new Function(...)`** and **`eval(...)`**. Patterns that decode Base64 and then run the string through either API tend to fail with errors like **`TypeError: not a function`**.
- **Prefer inline plugin code.** Put the actual Plugin API script in the `code` field (or a small static wrapper that does not use `Function`/`eval`). Keep payload under the documented size limit (e.g. ~50k).
- **`setPluginData` / `clientStorage`** may be unavailable or restricted in this environment; do not rely on them for multi-step staging across MCP calls.
- **Text node color variables:** use **`figma.variables.setBoundVariableForPaint`** on the text layer’s **fill paint** (`node.fills = [newPaint]`). Calling **`node.setBoundVariable('fills', variable)`** for color can error; paints expect bindings on the paint object.
- **`combineAsVariants`:** if **`Grouped nodes must be in the same page as the parent`** appears when using a **frame** (e.g. Components) as parent, pass the **page** as the combine parent, then **`insertChild`** the resulting component set back into the frame at the desired index.

## Figma Plugin API (layout)

- **`primaryAxisSizingMode` / `counterAxisSizingMode`** accept **`FIXED`** or **`AUTO`** only. Do not assign **`FILL`** or **`HUG`** to those properties; use the correct layout sizing APIs (`layoutSizingHorizontal` / `layoutSizingVertical`, etc.) where the design tool expects “hug” or “fill” behavior.
- **`minHeight` / `minWidth`:** do not set numeric **`0`** to mean “no minimum” — the API rejects it (`use null` to unset, or omit the property). This shows up when trying to let a frame shrink freely inside auto layout.
- **`layoutSizingHorizontal` / `layoutSizingVertical`:** set **`FILL`** / **`HUG`** **after** the node is **`appendChild`**’d; setting before can throw (same family of rule as the Figma MCP skill doc).

## Layout: optional chrome + main content (same parent)

Prefer **auto layout** over mixing **absolute** children back in once a subtree is layout-driven.

- **Pin one block to the start and another to the end** of the same vertical parent: make them **siblings**, put the **small / fixed chrome first** in child order, use **`primaryAxisAlignItems = 'SPACE_BETWEEN'`**, and keep both sides **`layoutGrow` 0** with vertical **HUG** on the main block where appropriate. When the chrome **is not present**, a single main block can be **end-aligned** with **`'MAX'`** so it still sits on the same edge as in the two-child case.
- **Group inner UI as one unit:** wrap related pieces (e.g. icon + text) in a **child frame** so **internal** alignment (gap, centering) is separate from **where** that group sits relative to sibling chrome. Use **stable structural names** (e.g. consistent **`kebab-case`**) that match the repo spec so handoff stays searchable.
- **Clipping:** if padding does not fix clipping, walk **ancestors** and set **`clipsContent = false`** on frames that should not crop children.
- **Automation:** if nodes are **already flattened** in the file, avoid calling **`flatten()`** in scripts; preserve **`VECTOR`** children unless you intend a deliberate merge.

## Component sets on the canvas

- Variant masters default to a **horizontal** / **wrap** arrangement; for fewer variants or clearer scanning, switch the **`COMPONENT_SET`** to **`VERTICAL`** + **`NO_WRAP`** with comfortable **`itemSpacing`** (e.g. **16**). Purely organizational—does not change props or instances.

## Workflow: components in Figma

- **Creating the base frame in Figma first**, then having the assistant **polish, tokenize, and add variants**, is often **faster and more reliable** than long loops of generated plugin code over MCP—especially when the sandbox blocks dynamic execution.
- **Variants** are usually straightforward to add once a single solid master exists.

## Repo artifacts

- One-off MCP/plugin scripts under `design-system/scripts/` were **removed** (2026-03-28). Prefer inline `use_figma` code or manual Figma work; see notes above on `eval` / `Function`.
- **`design-system/components/<name>/spec.json`:** append dated bullets to **`qualityAudit.findings`** when layout or token behavior is easy to misread from the canvas (e.g. `SPACE_BETWEEN` vs `MAX`, wrapper frames, clipping). Keeps the next component pass honest without rereading Figma history.
