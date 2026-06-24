import { describe, it, expect } from "vitest";
import { isFieldComplete, type SignaturePlacement, type FieldType } from "@/lib/pdfSigner";

function makeSig(overrides: Partial<SignaturePlacement> = {}): SignaturePlacement {
  return {
    id: "test",
    x: 0,
    y: 0,
    width: 100,
    height: 50,
    page: 1,
    fieldType: "signature",
    ...overrides,
  };
}

describe("isFieldComplete", () => {
  const cases: Array<{
    name: string;
    fieldType: FieldType;
    overrides?: Partial<SignaturePlacement>;
    expected: boolean;
  }> = [
    { name: "signature is always complete", fieldType: "signature", expected: true },
    { name: "date is always complete (default format)", fieldType: "date", expected: true },
    { name: "typed is incomplete when typedText is empty", fieldType: "typed", expected: false },
    { name: "typed is incomplete when typedText is whitespace", fieldType: "typed", overrides: { typedText: "   " }, expected: false },
    { name: "typed is complete when typedText is non-empty", fieldType: "typed", overrides: { typedText: "John Smith" }, expected: true },
    { name: "initials is incomplete when typedText is empty", fieldType: "initials", expected: false },
    { name: "initials is complete when typedText is non-empty", fieldType: "initials", overrides: { typedText: "JS" }, expected: true },
    { name: "checkbox is incomplete when unchecked", fieldType: "checkbox", overrides: { checked: false }, expected: false },
    { name: "checkbox is complete when checked", fieldType: "checkbox", overrides: { checked: true }, expected: true },
  ];

  for (const c of cases) {
    it(c.name, () => {
      const sig = makeSig({ fieldType: c.fieldType, ...c.overrides });
      expect(isFieldComplete(sig)).toBe(c.expected);
    });
  }

  it("treats undefined fieldType as signature (backwards compat)", () => {
    const sig = makeSig({ fieldType: undefined });
    expect(isFieldComplete(sig)).toBe(true);
  });
});

describe("SignaturePlacement shape", () => {
  // Pure structural sanity — catches accidental field renames early. If
  // these get out of sync with the type, this test will fail very loudly.
  it("field types include the five Phase 1 surface values", () => {
    const sig = makeSig({
      fieldType: "checkbox",
      typedText: "optional",
      dateFormat: "MM/DD/YYYY",
      checked: true,
      recipientId: "r-1",
    });
    expect(sig.fieldType).toBe("checkbox");
    expect(sig.typedText).toBe("optional");
    expect(sig.dateFormat).toBe("MM/DD/YYYY");
    expect(sig.checked).toBe(true);
    expect(sig.recipientId).toBe("r-1");
  });
});
