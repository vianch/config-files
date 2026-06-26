# Naming

- No single-letter identifiers and no abbreviated stubs in `const`, `let`/`var` (banned anyway), function parameters, destructured bindings, or arrow parameters. Spell the word out.
- Bad: `s`, `e`, `b`, `i`, `cx`, `cy`, `lng`, `ns`, `err`, `cb`, `fn`, `el`, `idx`, `acc`, `cur`.
- Good: `store`, `event`, `blob`, `index`, `centerX`, `centerY`, `language`, `namespace`, `error`, `callback`, `handler`, `element`, `accumulator`, `current`.
- Selectors into store hooks: write `(store) => store.field`, never `(s) => s.field`.
- React event handlers: `(event) => …`, never `(e) => …`.
- The only unused-binding placeholder allowed is `_` on its own (and `_unused` if more than one is needed in the same scope). Never use single letters to mean "ignored".
- Iteration locals: `(item, index) => …`, not `(x, i) => …`.
- i18next library API (`t`, `i18n`) keeps its conventional names — those come from the library, not us.
- Constants follow the rule in `enums-and-constants.md` (PascalCase for literal-valued constants).
