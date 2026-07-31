/**
 * Zod-to-OpenAPI Schema mapper.
 *
 * Walks a Zod schema and returns a JSON Schema 2020-12 fragment that is
 * compatible with OpenAPI 3.1. We intentionally hand-roll this instead of
 * pulling in `zod-to-openapi` — the schemas we use are not crazy and a
 * custom mapper gives us full control over discriminated unions, defaults,
 * and string formats (email, url).
 *
 * Only the parts of Zod that the Kody schemas actually use are mapped.
 * Unmapped cases throw so a future schema change is loud, not silent.
 */
import { z } from "zod";

/** OpenAPI 3.1 / JSON Schema 2020-12 fragment. */
export type OasSchema = Record<string, unknown> & { description?: string };

interface MapContext {
  /** Path to the current property, used for clearer error messages. */
  path: string;
}

function ctxError(path: string, message: string): Error {
  return new Error(`Zod→OpenAPI: ${message} at \`${path || "<root>"}\``);
}

function applyDescription(
  def: { description?: string },
  out: OasSchema,
): OasSchema {
  if (def.description) out.description = def.description;
  return out;
}

function unwrap(schema: z.ZodTypeAny): z.ZodTypeAny {
  // ZodEffects (e.g. .transform / .refine) — keep going.
  if (schema instanceof z.ZodEffects) return unwrap(schema._def.schema);
  // ZodLazy — keep going.
  if (schema instanceof z.ZodLazy) return unwrap((schema as unknown as { _def: { getter: () => z.ZodTypeAny } })._def.getter());
  return schema;
}

/**
 * Map a Zod schema to an OpenAPI/JSON-Schema fragment.
 *
 * @param schema  The Zod schema.
 * @param ctx     Optional context (used for error messages).
 */
export function zodToOas(schema: z.ZodTypeAny, ctx: MapContext = { path: "" }): OasSchema {
  const node = unwrap(schema);
  const def = node._def as { typeName: string; description?: string; [k: string]: unknown };

  switch (def.typeName) {
    case "ZodString": {
      const out: OasSchema = { type: "string" };
      applyDescription(def, out);
      for (const check of (def.checks as Array<{ kind: string; value?: unknown; regex?: RegExp }>) ?? []) {
        switch (check.kind) {
          case "min":
            out.minLength = check.value;
            break;
          case "max":
            out.maxLength = check.value;
            break;
          case "email":
            out.format = "email";
            break;
          case "url":
            out.format = "uri";
            break;
          case "uuid":
            out.format = "uuid";
            break;
          case "regex":
            if (check.regex) out.pattern = check.regex.source;
            break;
          default:
            // Other string checks (startsWith, endsWith, etc.) have no
            // OpenAPI equivalent — skip silently to avoid noise.
            break;
        }
      }
      return out;
    }

    case "ZodNumber": {
      const out: OasSchema = { type: "number" };
      applyDescription(def, out);
      for (const check of (def.checks as Array<{ kind: string; value?: number; isInt?: boolean }>) ?? []) {
        switch (check.kind) {
          case "min":
            out.minimum = check.value;
            break;
          case "max":
            out.maximum = check.value;
            break;
          case "int":
            out.type = "integer";
            break;
          default:
            break;
        }
      }
      return out;
    }

    case "ZodBoolean": {
      const out: OasSchema = { type: "boolean" };
      applyDescription(def, out);
      return out;
    }

    case "ZodNull": {
      const out: OasSchema = { type: "null" };
      applyDescription(def, out);
      return out;
    }

    case "ZodEnum": {
      const values = (def.values as ReadonlyArray<string | number>) ?? [];
      const out: OasSchema = {
        type: typeof values[0] === "number" ? "number" : "string",
        enum: [...values],
      };
      applyDescription(def, out);
      return out;
    }

    case "ZodLiteral": {
      const value = def.value as string | number | boolean | null;
      const out: OasSchema = {
        type: value === null ? "null" : typeof value,
        enum: [value],
      };
      applyDescription(def, out);
      return out;
    }

    case "ZodArray": {
      const inner = def.type as z.ZodTypeAny;
      const out: OasSchema = {
        type: "array",
        items: zodToOas(inner, { path: `${ctx.path}[]` }),
      };
      applyDescription(def, out);
      for (const check of (def.checks as Array<{ kind: string; value?: number }>) ?? []) {
        switch (check.kind) {
          case "min":
            out.minItems = check.value;
            break;
          case "max":
            out.maxItems = check.value;
            break;
          default:
            break;
        }
      }
      return out;
    }

    case "ZodObject": {
      // zod 3.x exposes the shape as a getter function; call it.
      const shapeFn = def.shape as unknown as (() => Record<string, z.ZodTypeAny>) | Record<string, z.ZodTypeAny>;
      const shape = typeof shapeFn === "function" ? shapeFn() : shapeFn;
      const properties: Record<string, OasSchema> = {};
      const required: string[] = [];
      for (const [key, value] of Object.entries(shape ?? {})) {
        const child = value as z.ZodTypeAny;
        // A property is "not required" if it is optional OR has a default
        // value (Zod fills in the default when the field is missing, so
        // OpenAPI consumers should treat it as optional too).
        const { schema, optional } = unwrapOptional(child);
        const hasDefault = hasZodDefault(child);
        const mapped = zodToOas(schema, { path: `${ctx.path}.${key}` });
        if (hasDefault) {
          try {
            mapped.default = (getZodDefaultValue(child) as () => unknown)();
          } catch {
            // Some defaults throw (e.g. random IDs) — skip them.
          }
        }
        properties[key] = mapped;
        if (!optional && !hasDefault) required.push(key);
      }
      const out: OasSchema = {
        type: "object",
        properties,
        additionalProperties: false,
      };
      applyDescription(def, out);
      if (required.length > 0) out.required = required;
      return out;
    }

    case "ZodRecord": {
      const valueType = def.valueType as z.ZodTypeAny;
      const out: OasSchema = {
        type: "object",
        additionalProperties: zodToOas(valueType, { path: `${ctx.path}{value}` }),
      };
      applyDescription(def, out);
      return out;
    }

    case "ZodUnion":
    case "ZodDiscriminatedUnion": {
      const options = ((def.options as z.ZodTypeAny[]) ?? []).map((opt) =>
        zodToOas(opt, { path: `${ctx.path}|` }),
      );
      const out: OasSchema = { oneOf: options };
      applyDescription(def, out);
      // For discriminated unions, add the discriminator hint so Swagger UI
      // renders the right picker.
      const discriminator = (def.discriminator as string | undefined) ??
        (def.typeName === "ZodDiscriminatedUnion"
          ? ((def as unknown as { discriminator?: string }).discriminator ?? null)
          : null);
      if (discriminator) out.discriminator = { propertyName: discriminator };
      return out;
    }

    case "ZodOptional": {
      const inner = def.innerType as z.ZodTypeAny;
      const mapped = zodToOas(inner, ctx);
      // OpenAPI 3.1 supports type arrays for optionality.
      const t = mapped.type;
      if (typeof t === "string") mapped.type = [t, "null"];
      return mapped;
    }

    case "ZodNullable": {
      const inner = def.innerType as z.ZodTypeAny;
      const mapped = zodToOas(inner, ctx);
      const t = mapped.type;
      if (typeof t === "string") mapped.type = [t, "null"];
      return mapped;
    }

    case "ZodDefault": {
      const inner = def.innerType as z.ZodTypeAny;
      const mapped = zodToOas(inner, ctx);
      try {
        mapped.default = (def.defaultValue as () => unknown)();
      } catch {
        // defaults that compute (e.g. random slugs) — skip.
      }
      return mapped;
    }

    default:
      throw ctxError(ctx.path, `unhandled Zod type "${def.typeName}"`);
  }
}

function unwrapOptional(schema: z.ZodTypeAny): { schema: z.ZodTypeAny; optional: boolean } {
  if (schema instanceof z.ZodOptional) {
    return { schema: schema._def.innerType as z.ZodTypeAny, optional: true };
  }
  return { schema, optional: false };
}

/**
 * Walk through ZodOptional / ZodDefault wrappers and report whether any
 * `ZodDefault` is present. Properties that carry a default are
 * effectively optional — Zod supplies the default when the field is
 * missing — so they should not appear in the OpenAPI `required` array.
 */
function hasZodDefault(schema: z.ZodTypeAny): boolean {
  let cur: z.ZodTypeAny = schema;
  // We may see ZodOptional(ZodDefault(...)) — check both wrapper kinds.
  // (Zod never nests ZodDefault under ZodDefault.)
  for (let i = 0; i < 3; i++) {
    const t = (cur._def as { typeName: string }).typeName;
    if (t === "ZodDefault") return true;
    if (t === "ZodOptional") {
      cur = (cur._def as { innerType: z.ZodTypeAny }).innerType;
      continue;
    }
    return false;
  }
  return false;
}

/** Return the ZodDefault's `defaultValue` function if one is present. */
function getZodDefaultValue(schema: z.ZodTypeAny): (() => unknown) | undefined {
  const { defaultValue } = schema._def as { defaultValue?: () => unknown };
  return defaultValue;
}
