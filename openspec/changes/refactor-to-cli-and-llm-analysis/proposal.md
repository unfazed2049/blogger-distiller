## Why

The current implementation has two major pain points that limit maintainability and analysis quality:

1. **Crawling layer**: Direct Python script calls to TikHub API create tight coupling, making it difficult to extend to new platforms or reuse crawling logic across different tools. Each platform requires duplicating similar HTTP client code.

2. **Analysis layer**: Keyword-based pattern matching in `analyze.py` produces low-precision results (e.g., content classification, opinion extraction, writing structure analysis). This leads to noisy data that requires manual filtering and misses nuanced insights that LLM-based analysis could capture.

Refactoring now enables: (a) cleaner platform extensibility through CLI-builder skills, (b) higher-quality analysis through LLM consolidation, and (c) reduced token costs by batching analysis dimensions into single prompts.

## What Changes

- **Crawling Architecture Refactor**
  - Replace `scripts/crawl_xhs.py` direct API calls with a CLI-builder skill-based approach
  - Create unified `media-crawler` CLI tool with platform subcommands (xhs, douyin, etc.)
  - Implement pluggable provider system (tikhub as default, extensible to other data sources)
  - Built with Commander.js + TypeScript + Bun for type safety and performance
  - Maintain platform extensibility: design allows adding new platforms and providers independently
  - Keep existing `scripts/utils/tikhub_client.py` as the underlying API client (no changes to endpoint routing logic)

- **Analysis Engine Upgrade**
  - Replace keyword-based analysis functions in `scripts/analyze.py` with LLM-based analysis
  - Consolidate multiple analysis dimensions into a single prompt to reduce API calls:
    - Content classification (currently uses tag clustering + keyword matching)
    - Opinion sentence extraction (currently uses regex patterns)
    - Writing structure analysis (opening/ending patterns)
    - Value word extraction (currently uses frequency counting)
  - Use OpenAI-compatible API (configurable endpoint + model)
  - Maintain backward compatibility: output same JSON structure as current `analyze.py`

- **Platform Abstraction**
  - Create platform-agnostic interfaces for both crawling and analysis
  - Design distillation pipeline to work with any platform's data format
  - Keep platform-specific logic isolated in respective modules

## Capabilities

### New Capabilities

- `unified-media-crawler`: Unified CLI tool (`media-crawler`) with platform subcommands and pluggable provider system, replacing platform-specific Python scripts
- `llm-based-analysis`: LLM-powered content analysis engine that replaces keyword-based pattern matching with consolidated multi-dimensional prompts
- `platform-provider-abstraction`: Two-layer abstraction (Platform + Provider) that enables independent extension of platforms and data sources

### Modified Capabilities

- `existing-crawl-workflow`: Crawling workflow changes from Python script execution to CLI tool invocation (breaking change for direct script users, but maintains same data output format)
- `existing-analysis-output`: Analysis output structure remains the same, but internal implementation switches from regex/keywords to LLM (non-breaking for downstream consumers)

## Impact

**Affected Code:**
- `scripts/crawl_xhs.py` → Refactored to invoke `media-crawler xhs` CLI commands
- `scripts/analyze.py` → Functions `classify_content`, `extract_opinion_sentences`, `analyze_writing_structure`, `extract_value_words` replaced with LLM calls
- `scripts/crawl_blogger.py` → Update to invoke new CLI tool instead of importing Python module
- `run.py` → Update orchestration to use new CLI tools
- New: `clis/media-crawler/` directory with TypeScript implementation

**Affected APIs:**
- TikHub API client (`scripts/utils/tikhub_client.py`) remains unchanged
- New OpenAI-compatible API dependency for analysis

**Dependencies:**
- Add: Bun runtime, Commander.js, TypeScript toolchain for CLI
- Add: OpenAI SDK or compatible HTTP client for LLM analysis
- Keep: All existing Python dependencies for other phases

**Systems:**
- Data output format remains compatible (JSON structure unchanged)
- Existing `data/` directory structure preserved
- HTML report generation (`deep_analyze.py`) unaffected
