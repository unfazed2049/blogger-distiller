## 1. Project Setup

- [x] 1.1 Create cli-tools/media-crawler directory structure
- [x] 1.2 Initialize package.json with Bun and TypeScript dependencies
- [x] 1.3 Configure tsconfig.json with strict type checking
- [x] 1.4 Add Commander.js and required dependencies
- [x] 1.5 Create src/ directory with index.ts entry point
- [x] 1.6 Set up build script and bin/media-crawler executable configuration

## 2. Provider Abstraction Layer

- [x] 2.1 Create src/providers/base.ts with DataProvider interface
- [x] 2.2 Define provider registry module for dynamic provider loading
- [x] 2.3 Implement TikHub provider (src/providers/tikhub.ts)
- [x] 2.4 Add provider utility functions (authentication, rate limiting, retry logic)
- [x] 2.5 Add provider-agnostic error types and error handling utilities

## 3. Platform Abstraction Layer

- [x] 3.1 Create src/platforms/base.ts with PlatformAdapter interface
- [x] 3.2 Define BloggerInfo, Profile, NotesList, NoteDetail common TypeScript types
- [x] 3.3 Create platform registry module for dynamic platform loading
- [x] 3.4 Implement adapter utility functions (extractData, PaginationHelper, translateError)
- [x] 3.5 Add platform-agnostic error types

## 4. TikHub Provider Implementation

- [x] 4.1 Implement TikHub authentication (token from env or CLI flag)
- [x] 4.2 Add rate limiting with configurable RPS (TIKHUB_RPS env var)
- [x] 4.3 Implement retry logic with exponential backoff
- [x] 4.4 Add TypeScript interfaces for all TikHub API responses
- [ ] 4.5 Implement endpoint fallback logic (reuse Python router patterns)
- [x] 4.6 Add platform parameter to all provider methods

## 5. XHS Platform Adapter Implementation

- [x] 5.1 Create XHSAdapter class implementing PlatformAdapter interface
- [x] 5.2 Implement normalizeProfile method for XHS-specific profile structure
- [x] 5.3 Implement normalizeNote method for XHS noteCard structure
- [x] 5.4 Implement normalizeComments method for XHS comment structure
- [x] 5.5 Handle XHS-specific fields (xsecToken, interactInfo, etc.)
- [x] 5.6 Add XHS-specific error handling and translation

## 6. CLI Commands - XHS Platform

- [x] 6.1 Implement `media-crawler xhs search` command with keyword and provider options
- [x] 6.2 Implement `media-crawler xhs profile` command with user-id, token, and max-notes options
- [x] 6.3 Implement `media-crawler xhs notes` command with user-id, keywords, and search supplement
- [x] 6.4 Implement `media-crawler xhs details` command with notes-file input and checkpoint support
- [x] 6.5 Add --provider flag with tikhub as default for all commands
- [x] 6.6 Add JSON output formatting for all commands
- [x] 6.7 Implement error handling and stderr JSON error output

## 7. Checkpoint and Resume

- [x] 7.1 Implement checkpoint file creation every 10 notes in details command
- [x] 7.2 Add resume logic to skip already-fetched notes
- [x] 7.3 Handle content-restricted notes with title preservation
- [x] 7.4 Clean up checkpoint file on successful completion

## 8. Python Integration Layer

- [ ] 8.1 Refactor scripts/crawl_xhs.py to invoke `media-crawler xhs` commands via subprocess
- [ ] 8.2 Add subprocess error handling and logging
- [ ] 8.3 Implement JSON parsing from CLI stdout
- [ ] 8.4 Maintain backward compatibility with existing function signatures
- [ ] 8.5 Add deprecation warnings for direct function imports
- [ ] 8.6 Update scripts/crawl_blogger.py to use refactored crawl_xhs.py

## 8. LLM Analysis - Prompt Engineering

- [ ] 8.1 Create scripts/utils/llm_analyzer.py module
- [ ] 8.2 Design consolidated prompt template for all analysis dimensions
- [ ] 8.3 Add few-shot examples for content classification
- [ ] 8.4 Add few-shot examples for opinion extraction
- [ ] 8.5 Add few-shot examples for writing structure analysis
- [ ] 8.6 Add few-shot examples for value word extraction
- [ ] 8.7 Define JSON schema for structured LLM output

## 9. LLM Analysis - API Integration

- [ ] 9.1 Implement OpenAI API client with configurable endpoint
- [ ] 9.2 Add support for OPENAI_API_KEY and OPENAI_API_BASE env vars
- [ ] 9.3 Implement structured output mode (response_format: json_object)
- [ ] 9.4 Add retry logic for API failures
- [ ] 9.5 Implement token usage tracking and logging
- [ ] 9.6 Add model configuration (default: gpt-4o-mini)

## 10. LLM Analysis - Output Processing

- [ ] 10.1 Implement JSON schema validation for LLM output
- [ ] 10.2 Create transformer to convert LLM output to legacy format
- [ ] 10.3 Handle partial responses (missing sections)
- [ ] 10.4 Add confidence score processing for classifications
- [ ] 10.5 Implement fallback to keyword-based analysis on validation failure

## 11. Refactor analyze.py

- [ ] 11.1 Replace classify_content with LLM-based classification
- [ ] 11.2 Replace extract_opinion_sentences with LLM extraction
- [ ] 11.3 Replace analyze_writing_structure with LLM analysis
- [ ] 11.4 Replace extract_value_words with LLM extraction
- [ ] 11.5 Keep keyword-based functions as fallback implementations
- [ ] 11.6 Add USE_LLM_ANALYSIS environment variable flag
- [ ] 11.7 Maintain exact same output JSON structure

## 12. Testing - Provider and Platform Layers

- [ ] 12.1 Add unit tests for TikHub provider methods
- [ ] 12.2 Add unit tests for XHS platform adapter methods
- [ ] 12.3 Test provider registry and dynamic loading
- [ ] 12.4 Test platform registry and dynamic loading
- [ ] 12.5 Test provider-platform integration (TikHub + XHS)
- [ ] 12.6 Mock TikHub API responses for unit tests
- [ ] 12.7 Test error handling and translation in both layers

## 13. Testing - CLI Commands

- [ ] 13.1 Add unit tests for CLI command handlers
- [ ] 13.2 Add integration test for `media-crawler xhs search` command
- [ ] 13.3 Add integration test for `media-crawler xhs profile` command
- [ ] 13.4 Add integration test for `media-crawler xhs notes` command
- [ ] 13.5 Add integration test for `media-crawler xhs details` command with checkpoint
- [ ] 13.6 Test --provider flag with default and explicit values
- [ ] 13.7 Test error handling and JSON error output

## 14. Testing - LLM Analysis

- [ ] 14.1 Add unit tests for prompt builder
- [ ] 14.2 Add unit tests for output validator
- [ ] 14.3 Add unit tests for output transformer
- [ ] 14.4 Mock LLM API responses for integration tests
- [ ] 14.5 Test fallback to keyword-based analysis
- [ ] 14.6 Verify output format matches legacy structure

## 15. Testing - End-to-End

- [ ] 15.1 Test full crawl workflow with media-crawler CLI
- [ ] 15.2 Test full analysis workflow with LLM
- [ ] 15.3 Verify data output format compatibility with deep_analyze.py
- [ ] 15.4 Test with real TikHub API (small dataset)
- [ ] 15.5 Compare LLM analysis quality vs keyword-based
- [ ] 15.6 Test checkpoint resume after interruption

## 16. Installation and Configuration

- [ ] 16.1 Update install.py to check for Bun installation
- [ ] 16.2 Add Bun installation instructions to install.py
- [ ] 16.3 Add media-crawler CLI tool dependency installation to install.py
- [ ] 16.4 Update README.md with new dependencies (Bun, OpenAI API)
- [ ] 16.5 Add configuration examples for OPENAI_API_KEY and provider selection
- [ ] 16.6 Document --skip-llm-analysis flag for cost-sensitive users

## 17. Migration and Backward Compatibility

- [ ] 17.1 Copy original crawl_xhs.py to crawl_xhs_legacy.py
- [ ] 17.2 Add USE_LEGACY_CRAWLER feature flag to run.py
- [ ] 17.3 Create migration guide in CHANGELOG.md
- [ ] 17.4 Add deprecation warnings to old function imports
- [ ] 17.5 Test rollback to legacy crawler
- [ ] 17.6 Document breaking changes for direct script users

## 18. Documentation

- [ ] 18.1 Add media-crawler CLI usage examples to README.md
- [ ] 18.2 Document two-layer abstraction (provider + platform) for extensibility
- [ ] 18.3 Add guide for adding new platforms
- [ ] 18.4 Add guide for adding new providers
- [ ] 18.5 Add LLM analysis configuration guide
- [ ] 18.6 Document cost comparison (keyword vs LLM)
- [ ] 18.7 Create troubleshooting guide for common issues
- [ ] 18.8 Update architecture diagram with provider and platform layers

## 19. Performance and Optimization

- [ ] 19.1 Benchmark media-crawler CLI vs Python script performance
- [ ] 19.2 Optimize LLM prompt length to reduce token costs
- [ ] 19.3 Add caching for LLM analysis results
- [ ] 19.4 Profile memory usage for large datasets
- [ ] 19.5 Add progress indicators for long-running operations

## 20. Error Handling and Logging

- [ ] 20.1 Implement structured logging in CLI tool
- [ ] 20.2 Add debug mode with verbose output
- [ ] 20.3 Improve error messages with actionable suggestions
- [ ] 20.4 Add telemetry for tracking common failure modes
- [ ] 20.5 Implement graceful degradation for partial failures

## 21. Final Validation

- [ ] 21.1 Run full test suite and verify all tests pass
- [ ] 21.2 Test with multiple bloggers across different domains
- [ ] 21.3 Verify HTML report generation works with new data
- [ ] 21.4 Check data quality metrics (completeness, accuracy)
- [ ] 21.5 Validate cost estimates match actual usage
- [ ] 21.6 Get user feedback on analysis quality improvement
