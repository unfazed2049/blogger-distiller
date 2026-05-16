## ADDED Requirements

### Requirement: LLM analyzes content classification
The system SHALL use LLM to classify each note into content categories based on title, description, and tags.

#### Scenario: Classify note with clear category
- **WHEN** LLM analyzes note with title "手把手教你做蛋糕" and tags ["烘焙", "教程"]
- **THEN** system returns category "教程/实操" with confidence >= 0.8

#### Scenario: Classify note with ambiguous content
- **WHEN** LLM analyzes note without clear category signals
- **THEN** system returns best-fit category with confidence score and fallback to "其他" if confidence < 0.5

#### Scenario: Batch classification
- **WHEN** system analyzes 50 notes in single request
- **THEN** LLM returns classification array with 50 entries matching input order

### Requirement: LLM extracts opinion sentences
The system SHALL use LLM to extract opinion sentences from note descriptions with source attribution.

#### Scenario: Extract judgment opinions
- **WHEN** LLM analyzes note containing "我觉得这个方法最重要的是..."
- **THEN** system returns opinion sentence with match_type "判断词" and source_note_id

#### Scenario: Extract contrarian opinions
- **WHEN** LLM analyzes note containing "但其实大家都误解了..."
- **THEN** system returns opinion sentence with match_type "转折" and source_note_id

#### Scenario: No opinions found
- **WHEN** LLM analyzes note with only factual descriptions
- **THEN** system returns empty array for that note's opinions

### Requirement: LLM analyzes writing structure
The system SHALL use LLM to identify opening and ending patterns across all notes.

#### Scenario: Identify story opening
- **WHEN** LLM analyzes notes starting with "那天我在咖啡店..."
- **THEN** system increments "故事开头" count in opening_types

#### Scenario: Identify CTA ending
- **WHEN** LLM analyzes notes ending with "关注我获取更多..."
- **THEN** system increments "行动号召" count in ending_types

#### Scenario: Multiple pattern types
- **WHEN** LLM analyzes 50 notes with various patterns
- **THEN** system returns opening_types and ending_types with counts for each detected pattern

### Requirement: LLM extracts value words
The system SHALL use LLM to extract high-frequency meaningful words (2-4 characters) from note descriptions.

#### Scenario: Extract domain-specific terms
- **WHEN** LLM analyzes cooking notes
- **THEN** system returns words like "烘焙", "食材", "技巧" with frequency counts

#### Scenario: Filter stopwords
- **WHEN** LLM processes notes containing common words like "这个", "那个", "可以"
- **THEN** system excludes these from value_words output

#### Scenario: Return top 15 words
- **WHEN** LLM extracts 100+ unique words
- **THEN** system returns only top 15 by frequency in descending order

### Requirement: LLM uses consolidated prompt
The system SHALL consolidate all analysis dimensions into a single LLM prompt to reduce API calls.

#### Scenario: Single API call for all dimensions
- **WHEN** system analyzes 50 notes
- **THEN** system makes exactly 1 LLM API call (not 4+ separate calls)

#### Scenario: Structured output format
- **WHEN** LLM completes analysis
- **THEN** system returns JSON with keys: classifications, opinions, structure, value_words

#### Scenario: Partial failure handling
- **WHEN** LLM returns incomplete response (e.g., missing value_words)
- **THEN** system fills missing sections with empty arrays/objects and logs warning

### Requirement: System supports OpenAI-compatible APIs
The system SHALL work with any OpenAI-compatible API endpoint (OpenAI, Azure, local models).

#### Scenario: Use OpenAI API
- **WHEN** user sets OPENAI_API_KEY environment variable
- **THEN** system uses api.openai.com endpoint

#### Scenario: Use custom endpoint
- **WHEN** user sets OPENAI_API_BASE to custom URL
- **THEN** system uses custom endpoint with same request format

#### Scenario: Configure model
- **WHEN** user sets ANALYSIS_MODEL to "gpt-4o-mini"
- **THEN** system uses specified model for analysis

### Requirement: System maintains backward compatibility
The system SHALL output analysis results in same JSON structure as keyword-based analysis.

#### Scenario: Category stats format
- **WHEN** LLM analysis completes
- **THEN** output contains category_stats with keys: count, pct, avg_likes, top_note

#### Scenario: Opinion candidates format
- **WHEN** LLM extracts opinions
- **THEN** output contains opinion_candidates array with keys: sentence, source_note_id, source_title, source_likes, match_type

#### Scenario: Writing structure format
- **WHEN** LLM analyzes structure
- **THEN** output contains writing_structure with keys: opening_types, ending_types (each with pattern counts)

### Requirement: System provides fallback to keyword-based analysis
The system SHALL fall back to keyword-based analysis if LLM analysis fails or is disabled.

#### Scenario: LLM API unavailable
- **WHEN** LLM API returns 500 error or times out
- **THEN** system logs warning and uses keyword-based analysis

#### Scenario: User disables LLM
- **WHEN** user sets USE_LLM_ANALYSIS=false
- **THEN** system skips LLM and uses keyword-based analysis

#### Scenario: Invalid LLM output
- **WHEN** LLM returns malformed JSON
- **THEN** system validates output, logs error, and falls back to keyword-based analysis

### Requirement: System validates LLM output schema
The system SHALL validate LLM output against expected schema before using results.

#### Scenario: Valid output passes validation
- **WHEN** LLM returns properly structured JSON
- **THEN** system validates all required fields present and proceeds

#### Scenario: Missing required field
- **WHEN** LLM output missing "classifications" key
- **THEN** system raises validation error and triggers fallback

#### Scenario: Type mismatch
- **WHEN** LLM returns string instead of array for opinions
- **THEN** system raises validation error and triggers fallback
