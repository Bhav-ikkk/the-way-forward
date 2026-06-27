import { z } from "zod";

import {
  dataFileSchemas,
  type DataFileName,
  type Portfolio,
  type Schema,
} from "./schema";

/**
 * A structured validation error. Every error names both the offending/missing
 * field and the source Data_File so an Adopter can locate the problem.
 *
 * See design.md "Data_Loader" -> ValidationError.
 */
export interface ValidationError {
  /** Source Data_File name (e.g. "profile"). */
  file: string;
  /** Offending/missing field path (e.g. "techStack.0", or the file name for a missing file). */
  field: string;
  kind: "missing_required" | "type_mismatch";
  message: string;
}

/**
 * Result of validating a single file: either the typed value or the list of
 * every violation found (validation never throws).
 */
export type ValidateResult<T> =
  | { ok: true; value: T }
  | { ok: false; errors: ValidationError[] };

/**
 * Result of loading the whole portfolio: either a fully typed Portfolio or the
 * aggregated list of every violation across every Data_File.
 *
 * See design.md "Data_Loader" -> LoadResult.
 */
export type LoadResult =
  | { ok: true; portfolio: Portfolio }
  | { ok: false; errors: ValidationError[] };

/**
 * Raw, unparsed Data_File contents keyed by file name. A value of `undefined`
 * (or a missing key) represents an absent file, which the loader reports as a
 * `missing_required` error. Content is supplied exclusively through this map;
 * no portfolio content is hardcoded in source.
 */
export type RawDataFiles = Partial<Record<DataFileName, unknown>>;

/**
 * Translates a Zod issue into a located ValidationError. A missing required
 * value (an `invalid_type` issue whose received value is `undefined`) is
 * classified as `missing_required`; everything else is a `type_mismatch`.
 */
function toValidationError(file: string, issue: z.ZodIssue): ValidationError {
  const field = issue.path.length > 0 ? issue.path.join(".") : file;
  const isMissingRequired =
    issue.code === z.ZodIssueCode.invalid_type &&
    issue.received === z.ZodParsedType.undefined;

  return {
    file,
    field,
    kind: isMissingRequired ? "missing_required" : "type_mismatch",
    message: isMissingRequired
      ? `Missing required field "${field}" in ${file}.`
      : `Invalid value for field "${field}" in ${file}: ${issue.message}`,
  };
}

/**
 * Validate one Data_File's raw content against its schema. Aggregates ALL
 * violations rather than failing on the first, and never throws.
 *
 * See design.md "Data_Loader" -> validateFile.
 */
export function validateFile<T>(
  name: string,
  raw: unknown,
  schema: Schema<T>,
): ValidateResult<T> {
  const result = schema.safeParse(raw);
  if (result.success) {
    return { ok: true, value: result.data };
  }
  const errors = result.error.issues.map((issue) =>
    toValidationError(name, issue),
  );
  return { ok: false, errors };
}

/**
 * Read, validate, and expose all Data_Files. Reads content exclusively from the
 * supplied `files` map; hardcodes no portfolio content. Aggregates every
 * violation across every file. A missing required file produces a
 * `missing_required` error naming the file.
 *
 * See design.md "Data_Loader" -> loadPortfolio.
 */
export function loadPortfolio(files: RawDataFiles): LoadResult {
  const errors: ValidationError[] = [];
  const parsed: Partial<Record<DataFileName, unknown>> = {};

  for (const name of Object.keys(dataFileSchemas) as DataFileName[]) {
    const raw = files[name];

    // A missing required file is treated the same as a missing required field
    // at the document root.
    if (raw === undefined) {
      errors.push({
        file: name,
        field: name,
        kind: "missing_required",
        message: `Missing required Data_File "${name}".`,
      });
      continue;
    }

    const schema = dataFileSchemas[name] as Schema<unknown>;
    const result = validateFile(name, raw, schema);
    if (result.ok) {
      parsed[name] = result.value;
    } else {
      errors.push(...result.errors);
    }
  }

  if (errors.length > 0) {
    return { ok: false, errors };
  }

  // Every file validated; assemble the typed Portfolio.
  return {
    ok: true,
    portfolio: parsed as unknown as Portfolio,
  };
}
