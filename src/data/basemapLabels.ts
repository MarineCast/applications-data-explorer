import type { DataDrivenPropertyValueSpecification } from "@maplibre/maplibre-gl-style-spec";

type LabelSize = DataDrivenPropertyValueSpecification<number>;

/** Scale outputs, preserving the top-level zoom curve required by MapLibre. */
export function scaleLabelSize(value: LabelSize = 16, factor = 0.87): LabelSize {
  if (typeof value === "number") return value * factor;
  if (Array.isArray(value)) {
    if (value[0] === "interpolate" || value[0] === "step") {
      const firstOutput = value[0] === "step" ? 2 : 4;
      return value.map((part, index) => index >= firstOutput && (index - firstOutput) % 2 === 0
        ? scaleLabelSize(part as LabelSize, factor) : part) as LabelSize;
    }
    if (value[0] === "let") {
      return [...value.slice(0, -1), scaleLabelSize(value.at(-1) as LabelSize, factor)] as LabelSize;
    }
    return ["*", factor, value];
  }
  if ("stops" in value) {
    return { ...value, stops: value.stops.map(([stop, size]) => [stop, size * factor]),
      ...("default" in value && value.default !== undefined ? { default: value.default * factor } : {}) } as LabelSize;
  }
  return ["*", factor, ["number", ["get", value.property], value.default ?? 16]];
}
