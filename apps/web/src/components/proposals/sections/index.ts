/**
 * Custom section components for proposals.
 * Phase 57-05: Custom Sections + Add Section Menu
 */

// Section type components
export { TextSection } from "./TextSection";
export type { TextSectionData, TextSectionProps } from "./TextSection";

export { ImageSection } from "./ImageSection";
export type { ImageSectionData, ImageSectionProps } from "./ImageSection";

export { TestimonialSection } from "./TestimonialSection";
export type {
  TestimonialSectionData,
  TestimonialSectionProps,
} from "./TestimonialSection";

export { CaseStudySection } from "./CaseStudySection";
export type {
  CaseStudyMetric,
  CaseStudySectionData,
  CaseStudySectionProps,
} from "./CaseStudySection";

export { VideoSection } from "./VideoSection";
export type {
  VideoPlatform,
  VideoSectionData,
  VideoSectionProps,
} from "./VideoSection";

export { ComparisonSection } from "./ComparisonSection";
export type {
  ComparisonItem,
  ComparisonSectionData,
  ComparisonSectionProps,
} from "./ComparisonSection";

export { TimelineSection } from "./TimelineSection";
export type {
  TimelinePhase,
  TimelineSectionData,
  TimelineSectionProps,
} from "./TimelineSection";

// Union type for all section data types
export type CustomSectionData =
  | { type: "text"; data: import("./TextSection").TextSectionData }
  | { type: "image"; data: import("./ImageSection").ImageSectionData }
  | { type: "testimonial"; data: import("./TestimonialSection").TestimonialSectionData }
  | { type: "case_study"; data: import("./CaseStudySection").CaseStudySectionData }
  | { type: "video"; data: import("./VideoSection").VideoSectionData }
  | { type: "comparison"; data: import("./ComparisonSection").ComparisonSectionData }
  | { type: "timeline"; data: import("./TimelineSection").TimelineSectionData }
  | { type: "custom"; data: Record<string, unknown> };

/**
 * Default data for each section type.
 */
export const DEFAULT_SECTION_DATA: Record<string, unknown> = {
  text: { content: "" },
  image: { url: "", caption: "", alt: "" },
  testimonial: { quote: "", author: "", company: "", image: "" },
  case_study: { title: "", metrics: [], description: "" },
  video: { url: "", platform: "unknown" },
  comparison: { items: [] },
  timeline: { phases: [] },
  custom: {},
};
