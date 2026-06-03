# HTTP status codes

- Never use a raw numeric HTTP status literal (`200`, `400`, `401`, `403`, `404`, `413`, `500`, `502`, `503`, …) anywhere — API routes (`app/api/**/route.ts`), pages, server actions, `AuthError`/error constructors, or `response.status` comparisons.
- Always use the `HttpStatusCode` `const enum` from `@/lib/constants/ui.constants`.

```ts
// Forbidden
return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
if (response.status === 503) { ... }

// Preferred
import { HttpStatusCode } from "@/lib/constants/ui.constants";

return NextResponse.json(
  { error: "Unauthorized" },
  { status: HttpStatusCode.Unauthorized }
);
if (response.status === HttpStatusCode.ServiceUnavailable) { ... }
```

- If a status code you need is missing, add it to the `HttpStatusCode` enum (members PascalCase, listed alphabetically) rather than inlining the number.
- This applies to both the value passed to `{ status: ... }` and any runtime comparison against a status. Interpolating `response.status` into a log/message string is fine — that is not a code literal.
