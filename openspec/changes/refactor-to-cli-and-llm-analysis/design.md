## Context

**Current State:**
- Crawling: `scripts/crawl_xhs.py` (1342 lines) directly calls TikHub API via `utils/tikhub_client.py`
- Analysis: `scripts/analyze.py` uses regex patterns and keyword matching for content classification, opinion extraction, writing structure, and value words
- Platform support: Xiaohongshu (XHS) and Douyin, with separate crawl scripts but shared analysis logic
- Data flow: `run.py` → `crawl_blogger.py` → platform-specific crawl script → `analyze.py` → `deep_analyze.py` (AI distillation)

**Constraints:**
- Must maintain existing data output format (JSON structure) for backward compatibility with `deep_analyze.py`
- TikHub API client (`tikhub_client.py`) and endpoint routing logic must remain unchanged (proven stable)
- Cannot break existing user workflows that depend on `run.py` orchestration
- Must support both XHS and Douyin platforms with extensibility for future platforms

**Stakeholders:**
- End users: Expect same CLI experience and output quality
- Downstream: `deep_analyze.py` depends on analysis JSON structure
- Maintainers: Need cleaner architecture for adding new platforms

## Goals / Non-Goals

**Goals:**
- Create reusable CLI tool for XHS crawling using cli-builder skill pattern
- Replace keyword-based analysis with LLM-based analysis for higher precision
- Consolidate multiple analysis dimensions into single LLM prompt to reduce token costs
- Design platform-agnostic interfaces that make adding new platforms straightforward
- Maintain 100% backward compatibility with existing data output formats

**Non-Goals:**
- Not refactoring Douyin crawler in this change (XHS only, Douyin follows same pattern later)
- Not changing TikHub API client or endpoint routing logic (already stable)
- Not modifying `deep_analyze.py` or HTML report generation
- Not changing user-facing CLI commands in `run.py` (internal refactor only)

## Decisions

### Decision 1: CLI Tool Architecture - TypeScript + Bun + Commander.js

**Choice:** Build unified `media-crawler` CLI with platform subcommands and pluggable provider system

**Rationale:**
- **Why TypeScript over Python:** Better type safety for API contracts, easier to package as standalone binary, aligns with cli-builder skill pattern
- **Why Bun over Node:** Faster startup time (critical for CLI tools), built-in TypeScript support, single executable distribution
- **Why Commander.js:** Standard CLI framework with subcommand support, matches cli-builder skill conventions
- **Why unified CLI:** Single entry point for all platforms (xhs, douyin, etc.) with consistent interface
- **Why provider abstraction:** Allows switching between TikHub (default), direct API, or other data sources

**CLI Design:**
```bash
# Basic usage (tikhub is default provider)
media-crawler xhs search "博主名"
media-crawler xhs profile --user-id <id>

# Explicit provider
media-crawler xhs search "博主名" --provider tikhub
media-crawler douyin search "博主名" --provider tikhub

# Future: support other providers
media-crawler xhs search "博主名" --provider direct-api
```

**Alternatives Considered:**
- Keep Python: Rejected because it doesn't solve the coupling problem and makes cross-tool reuse harder
- Use Go: Rejected due to steeper learning curve and less ecosystem support for API clients
- Separate CLI per platform (xhs-crawler, douyin-crawler): Rejected because it duplicates common logic and creates inconsistent UX

**Implementation:**
```
clis/
└── media-crawler/
    ├── package.json
    ├── tsconfig.json
    ├── src/
    │   ├── index.ts              # CLI entry point
    │   ├── commands/
    │   │   ├── xhs/              # Xiaohongshu subcommands
    │   │   │   ├── search.ts
    │   │   │   ├── profile.ts
    │   │   │   ├── notes.ts
    │   │   │   └── details.ts
    │   │   └── douyin/           # Douyin subcommands (future)
    │   ├── providers/
    │   │   ├── base.ts           # Provider interface
    │   │   ├── tikhub.ts         # TikHub provider (default)
    │   │   └── registry.ts       # Provider registry
    │   ├── platforms/
    │   │   ├── base.ts           # Platform interface
    │   │   ├── xhs.ts            # XHS implementation
    │   │   └── douyin.ts         # Douyin implementation (future)
    │   └── types/
    │       └── index.ts          # Type definitions
    └── bin/
        └── media-crawler         # Bun executable
```

### Decision 2: Python-TypeScript Bridge - Subprocess Invocation

**Choice:** Python scripts invoke TypeScript CLI via subprocess, parse JSON output

**Rationale:**
- **Why subprocess over FFI:** Simpler, no ABI compatibility issues, easier to debug
- **Why JSON over stdout parsing:** Structured data, handles errors cleanly, supports progress updates

**Implementation Pattern:**
```python
# scripts/crawl_xhs.py (refactored)
import subprocess
import json

def crawl_blogger(keyword, user_id, output_dir, token):
    cmd = [
        "media-crawler", "xhs", "crawl",
        "--keyword", keyword,
        "--output", output_dir,
        "--token", token,
        "--provider", "tikhub",  # Default, can be omitted
        "--format", "json"
    ]
    result = subprocess.run(cmd, capture_output=True, text=True)
    return json.loads(result.stdout)
```

**Alternatives Considered:**
- Rewrite entire pipeline in TypeScript: Rejected due to high migration risk and loss of proven Python analysis code
- Use Python-to-TS bridge library: Rejected due to added complexity and maintenance burden

### Decision 3: LLM Analysis Architecture - Consolidated Prompt Strategy

**Choice:** Single LLM call with structured output for all analysis dimensions

**Rationale:**
- **Why single prompt:** Reduces API calls from 4+ to 1, shares context across dimensions, lower latency
- **Why structured output:** Ensures consistent JSON format, easier to validate, matches existing output schema
- **Why OpenAI-compatible API:** Flexibility to use OpenAI, Azure, local models, or other providers

**Prompt Structure:**
```
Analyze the following notes and provide:
1. Content classification for each note (category + confidence)
2. Opinion sentences (sentence + source_note_id + match_type)
3. Writing structure patterns (opening_types + ending_types with counts)
4. High-frequency value words (word + count, top 15)

Input: [JSON array of notes with title, desc, tags]
Output: {
  "classifications": [...],
  "opinions": [...],
  "structure": {...},
  "value_words": [...]
}
```

**Alternatives Considered:**
- Keep keyword-based for some dimensions: Rejected because mixing approaches creates inconsistent quality
- Separate LLM calls per dimension: Rejected due to higher token costs and slower execution
- Use embeddings + clustering: Rejected because it doesn't solve opinion extraction and requires vector DB

**Implementation:**
```python
# scripts/analyze.py (refactored)
def analyze_notes_with_llm(notes, api_key, model="gpt-4o-mini"):
    prompt = build_consolidated_prompt(notes)
    response = openai.ChatCompletion.create(
        model=model,
        messages=[{"role": "user", "content": prompt}],
        response_format={"type": "json_object"}
    )
    result = json.loads(response.choices[0].message.content)
    return transform_to_legacy_format(result)  # Maintains backward compatibility
```

### Decision 4: Platform and Provider Abstraction - Two-Layer Design

**Choice:** Define platform-agnostic interfaces with pluggable provider system

**Rationale:**
- **Why two layers:** Platform (xhs/douyin) defines data structure, Provider (tikhub/direct-api) defines data source
- **Why interfaces:** Makes adding new platforms/providers a matter of implementing known contracts
- **Why adapters:** Isolates platform-specific and provider-specific quirks from core logic

**Architecture Design:**
```typescript
// clis/media-crawler/src/providers/base.ts
interface DataProvider {
  name: string;
  searchBlogger(platform: string, keyword: string): Promise<BloggerInfo>;
  getProfile(platform: string, userId: string): Promise<Profile>;
  getNotesList(platform: string, userId: string, cursor?: string): Promise<NotesList>;
  getNoteDetail(platform: string, noteId: string): Promise<NoteDetail>;
}

// clis/media-crawler/src/providers/tikhub.ts
class TikHubProvider implements DataProvider {
  name = "tikhub";
  // TikHub-specific implementation for all platforms
}

// clis/media-crawler/src/platforms/base.ts
interface PlatformAdapter {
  platform: string;
  normalizeProfile(raw: any): Profile;
  normalizeNote(raw: any): Note;
  normalizeComments(raw: any): Comment[];
}

// clis/media-crawler/src/platforms/xhs.ts
class XHSAdapter implements PlatformAdapter {
  platform = "xhs";
  // XHS-specific data normalization
}

// clis/media-crawler/src/platforms/douyin.ts
class DouyinAdapter implements PlatformAdapter {
  platform = "douyin";
  // Douyin-specific data normalization
}
```

**Usage Flow:**
```typescript
// In command handler
const provider = ProviderRegistry.get(options.provider || "tikhub");
const adapter = PlatformRegistry.get("xhs");

const rawProfile = await provider.getProfile("xhs", userId);
const normalizedProfile = adapter.normalizeProfile(rawProfile);
```

**Alternatives Considered:**
- Monolithic multi-platform CLI: Rejected because it creates tight coupling and harder testing
- No abstraction, duplicate code: Rejected because it defeats the purpose of this refactor
- Single-layer abstraction: Rejected because mixing platform logic with provider logic reduces flexibility

## Risks / Trade-offs

### Risk 1: Bun Runtime Dependency
**Risk:** Users may not have Bun installed, adds new runtime to project
**Mitigation:** 
- Add Bun installation check to `install.py`
- Provide fallback to Node.js if Bun unavailable (slower but functional)
- Document Bun installation in README

### Risk 2: LLM API Costs
**Risk:** LLM analysis may cost more than keyword matching (though more accurate)
**Mitigation:**
- Use cost-effective model (gpt-4o-mini or compatible)
- Batch notes in single prompt (already designed)
- Add `--skip-llm-analysis` flag to fall back to keyword-based for cost-sensitive users
- Cache analysis results to avoid re-analyzing same notes

### Risk 3: LLM Output Consistency
**Risk:** LLM may produce inconsistent JSON structure or miss fields
**Mitigation:**
- Use structured output mode (OpenAI's `response_format`)
- Add validation layer that checks output schema
- Fall back to keyword-based analysis if LLM output invalid
- Include few-shot examples in prompt for consistency

### Risk 4: Migration Complexity
**Risk:** Existing users may have scripts that directly import `crawl_xhs.py` functions
**Mitigation:**
- Keep `crawl_xhs.py` as wrapper that calls CLI tool (maintains import compatibility)
- Add deprecation warnings for direct function calls
- Provide migration guide in CHANGELOG

### Risk 5: TypeScript-Python Data Type Mismatches
**Risk:** Type conversions between TS and Python may introduce bugs
**Mitigation:**
- Define strict JSON schemas for all data exchanges
- Add integration tests that verify end-to-end data flow
- Use Pydantic models in Python for validation

## Migration Plan

**Phase 1: CLI Tool Development (Week 1)**
1. Set up `clis/media-crawler/` project structure
2. Implement provider interface and TikHub provider
3. Implement platform adapters (XHS first)
4. Implement CLI commands (xhs search, profile, notes, details)
5. Add unit tests for each command
6. Test CLI tool standalone (without Python integration)

**Phase 2: Python Integration (Week 1)**
1. Refactor `scripts/crawl_xhs.py` to invoke CLI tool
2. Add subprocess error handling and logging
3. Verify data output format matches original
4. Run integration tests with existing `analyze.py`

**Phase 3: LLM Analysis (Week 2)**
1. Implement consolidated LLM prompt builder
2. Add OpenAI API client with structured output
3. Implement backward-compatible output transformer
4. Add fallback to keyword-based analysis
5. Test with real data and compare quality

**Phase 4: Platform Abstraction (Week 2)**
1. Extract platform interfaces
2. Refactor XHS crawler to implement interface
3. Update documentation for adding new platforms
4. Create example stub for Douyin crawler

**Rollback Strategy:**
- Keep original `crawl_xhs.py` as `crawl_xhs_legacy.py`
- Add feature flag `USE_LEGACY_CRAWLER=1` to switch back
- If critical bugs found, revert to legacy in `run.py`

**Deployment:**
- Update `install.py` to install Bun and CLI dependencies
- Add environment variable `OPENAI_API_KEY` for LLM analysis
- Update README with new dependencies and configuration

## Open Questions

1. **LLM Model Selection:** Should we default to `gpt-4o-mini` or allow users to configure? 
   - Proposal: Default to `gpt-4o-mini`, add `--analysis-model` flag for power users

2. **CLI Tool Distribution:** Should we bundle CLI as single executable or require Bun runtime?
   - Proposal: Start with Bun runtime requirement, consider bundling in future if users request

3. **Douyin Timeline:** Should we refactor Douyin crawler in same change or separate?
   - Proposal: Separate change after XHS proven stable (reduces risk)

4. **Keyword Fallback:** Should keyword-based analysis remain as permanent fallback or temporary?
   - Proposal: Keep as permanent fallback for cost-sensitive users and offline scenarios
