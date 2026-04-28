import { describe, test, expect } from "vitest";
import { parseRoadmap } from "./roadmap-parser";
import { PipelineError } from "./types";

describe("parseRoadmap", () => {
  test("returns array of PhaseNode objects from ROADMAP.md content", () => {
    const roadmapContent = `# Roadmap: Test Project

## Phases

- [ ] **Phase 1: First Phase** - Description here
- [ ] **Phase 2: Second Phase** - Another description

## Phase Details

### Phase 1: First Phase
**Goal**: Test goal
**Depends on**: Nothing (first phase)
**Requirements**: REQ-01, REQ-02
**Plans**: 3 plans

### Phase 2: Second Phase
**Goal**: Another goal
**Depends on**: Phase 1
**Requirements**: REQ-03
**Plans**: 2 plans

## Progress

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. First Phase | 0/3 | Not started | - |
| 2. Second Phase | 0/2 | Not started | - |
`;

    const result = parseRoadmap(roadmapContent);

    expect(result).toHaveLength(2);
    expect(result[0]).toMatchObject({
      number: 1,
      name: "First Phase",
      slug: "first-phase",
      dependencies: [],
      requirements: ["REQ-01", "REQ-02"],
      status: "not_started",
      planCount: 3,
    });
    expect(result[1]).toMatchObject({
      number: 2,
      name: "Second Phase",
      slug: "second-phase",
      dependencies: [1],
      requirements: ["REQ-03"],
      status: "not_started",
      planCount: 2,
    });
  });

  test("extracts dependencies from single dependency", () => {
    const roadmapContent = `# Roadmap

## Phases

- [ ] **Phase 1: First** - Test
- [ ] **Phase 2: Second** - Test

## Phase Details

### Phase 1: First
**Goal**: Test
**Depends on**: Nothing (first phase)
**Plans**: 1 plans

### Phase 2: Second
**Goal**: Test
**Depends on**: Phase 1
**Plans**: 1 plans

## Progress

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. First | 0/1 | Not started | - |
| 2. Second | 0/1 | Not started | - |
`;

    const result = parseRoadmap(roadmapContent);
    expect(result[1].dependencies).toEqual([1]);
  });

  test("extracts dependencies from multiple dependencies", () => {
    const roadmapContent = `# Roadmap

## Phases

- [ ] **Phase 1: First** - Test
- [ ] **Phase 2: Second** - Test
- [ ] **Phase 3: Third** - Test

## Phase Details

### Phase 1: First
**Goal**: Test
**Depends on**: Nothing
**Plans**: 1 plans

### Phase 2: Second
**Goal**: Test
**Depends on**: Phase 1
**Plans**: 1 plans

### Phase 3: Third
**Goal**: Test
**Depends on**: Phase 1, Phase 2
**Plans**: 1 plans

## Progress

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. First | 0/1 | Not started | - |
| 2. Second | 0/1 | Not started | - |
| 3. Third | 0/1 | Not started | - |
`;

    const result = parseRoadmap(roadmapContent);
    expect(result[2].dependencies).toEqual([1, 2]);
  });

  test("handles empty dependencies when no Depends on line", () => {
    const roadmapContent = `# Roadmap

## Phases

- [ ] **Phase 1: First** - Test

## Phase Details

### Phase 1: First
**Goal**: Test
**Plans**: 1 plans

## Progress

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. First | 0/1 | Not started | - |
`;

    const result = parseRoadmap(roadmapContent);
    expect(result[0].dependencies).toEqual([]);
  });

  test("extracts status from Progress table", () => {
    const roadmapContent = `# Roadmap

## Phases

- [x] **Phase 1: First** - Test

## Phase Details

### Phase 1: First
**Goal**: Test
**Plans**: 2 plans

## Progress

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. First | 2/2 | Complete | 2026-04-23 |
`;

    const result = parseRoadmap(roadmapContent);
    expect(result[0].status).toBe("complete");
  });

  test("handles decimal phase numbers", () => {
    const roadmapContent = `# Roadmap

## Phases

- [ ] **Phase 30: Base Phase** - Test
- [ ] **Phase 30.5: Inserted Phase** - Test

## Phase Details

### Phase 30: Base Phase
**Goal**: Test
**Plans**: 1 plans

### Phase 30.5: Inserted Phase
**Goal**: Test
**Depends on**: Phase 30
**Plans**: 2 plans

## Progress

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 30. Base Phase | 0/1 | Not started | - |
| 30.5. Inserted Phase | 0/2 | Not started | - |
`;

    const result = parseRoadmap(roadmapContent);
    expect(result).toHaveLength(2);
    expect(result[0].number).toBe(30);
    expect(result[1].number).toBe(30.5);
    expect(result[1].dependencies).toEqual([30]);
  });

  test("throws PipelineError on invalid ROADMAP format", () => {
    const invalidContent = `This is not a valid roadmap format`;

    expect(() => parseRoadmap(invalidContent)).toThrow(PipelineError);

    try {
      parseRoadmap(invalidContent);
      expect.fail("Should have thrown PipelineError");
    } catch (error) {
      expect(error).toBeInstanceOf(PipelineError);
      expect((error as PipelineError).code).toBe("INVALID_ROADMAP");
    }
  });

  test("extracts requirements from Requirements line", () => {
    const roadmapContent = `# Roadmap

## Phases

- [ ] **Phase 1: First** - Test

## Phase Details

### Phase 1: First
**Goal**: Test
**Requirements**: AUTO-01, AUTO-02, AUTO-03
**Plans**: 1 plans

## Progress

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. First | 0/1 | Not started | - |
`;

    const result = parseRoadmap(roadmapContent);
    expect(result[0].requirements).toEqual(["AUTO-01", "AUTO-02", "AUTO-03"]);
  });

  test("handles empty requirements when no Requirements line", () => {
    const roadmapContent = `# Roadmap

## Phases

- [ ] **Phase 1: First** - Test

## Phase Details

### Phase 1: First
**Goal**: Test
**Plans**: 1 plans

## Progress

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. First | 0/1 | Not started | - |
`;

    const result = parseRoadmap(roadmapContent);
    expect(result[0].requirements).toEqual([]);
  });
});
