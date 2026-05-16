## ADDED Requirements

### Requirement: System defines two-layer abstraction architecture
The system SHALL implement a two-layer architecture separating platform logic from provider logic.

#### Scenario: Platform layer defines data structure
- **WHEN** system processes XHS or Douyin data
- **THEN** platform adapter normalizes data to common structure regardless of provider

#### Scenario: Provider layer defines data source
- **WHEN** system fetches data
- **THEN** provider (tikhub, direct-api, etc.) handles API communication independently of platform

#### Scenario: Independent extension
- **WHEN** developer adds new platform or new provider
- **THEN** system supports all combinations without cross-modification

### Requirement: System defines DataProvider interface
The system SHALL define a DataProvider interface that all data source implementations MUST implement.

#### Scenario: Interface defines search method
- **WHEN** provider is implemented
- **THEN** it MUST provide searchBlogger(platform: string, keyword: string) method

#### Scenario: Interface defines profile method
- **WHEN** provider is implemented
- **THEN** it MUST provide getProfile(platform: string, userId: string) method

#### Scenario: Interface defines notes list method
- **WHEN** provider is implemented
- **THEN** it MUST provide getNotesList(platform: string, userId: string, cursor?: string) method

#### Scenario: Interface defines note detail method
- **WHEN** provider is implemented
- **THEN** it MUST provide getNoteDetail(platform: string, noteId: string) method

### Requirement: System defines PlatformAdapter interface
The system SHALL define a PlatformAdapter interface for normalizing platform-specific data structures.

#### Scenario: Adapter normalizes profile data
- **WHEN** provider returns raw XHS profile data
- **THEN** XHS adapter transforms it to common Profile format

#### Scenario: Adapter normalizes note data
- **WHEN** provider returns raw Douyin video data
- **THEN** Douyin adapter transforms it to common Note format

#### Scenario: Adapter normalizes comments
- **WHEN** provider returns raw comment data
- **THEN** platform adapter transforms it to common Comment[] format

### Requirement: TikHub provider implements DataProvider interface
The TikHub provider SHALL implement DataProvider interface for all supported platforms.

#### Scenario: TikHub supports XHS
- **WHEN** TikHub provider receives XHS request
- **THEN** it calls appropriate TikHub XHS endpoints and returns raw data

#### Scenario: TikHub supports Douyin
- **WHEN** TikHub provider receives Douyin request
- **THEN** it calls appropriate TikHub Douyin endpoints and returns raw data

#### Scenario: TikHub handles errors
- **WHEN** TikHub API returns error
- **THEN** provider translates to common error format with retry logic

### Requirement: XHS and Douyin adapters implement PlatformAdapter interface
The system SHALL provide XHS and Douyin adapters that normalize platform-specific data.

#### Scenario: XHS adapter handles XHS-specific fields
- **WHEN** XHS adapter receives raw XHS data with noteCard structure
- **THEN** it extracts and normalizes to common Note format

#### Scenario: Douyin adapter handles video-specific fields
- **WHEN** Douyin adapter receives raw video data with aweme structure
- **THEN** it extracts and normalizes to common Note format

#### Scenario: Adapters preserve platform metadata
- **WHEN** adapter normalizes data
- **THEN** it includes platform identifier and original structure reference

### Requirement: System supports adding new platforms
The system SHALL allow adding new platforms by implementing PlatformAdapter without modifying core code.

#### Scenario: Add new platform adapter
- **WHEN** developer creates new platform adapter implementing PlatformAdapter
- **THEN** system can use it without changes to provider or command logic

#### Scenario: Platform registry
- **WHEN** new platform adapter is added
- **THEN** developer registers it in platform registry with platform identifier

#### Scenario: Platform selection in commands
- **WHEN** user specifies platform in command (e.g., `media-crawler xhs`)
- **THEN** system loads appropriate adapter from registry

### Requirement: System supports adding new providers
The system SHALL allow adding new providers by implementing DataProvider without modifying platform code.

#### Scenario: Add direct API provider
- **WHEN** developer creates DirectAPIProvider implementing DataProvider
- **THEN** system can use it with `--provider direct-api` flag

#### Scenario: Provider registry
- **WHEN** new provider is added
- **THEN** developer registers it in provider registry with provider identifier

#### Scenario: Provider selection in commands
- **WHEN** user specifies `--provider <name>` or uses default
- **THEN** system loads appropriate provider from registry

### Requirement: Analysis layer works with normalized data
The analysis layer SHALL process normalized data without platform or provider awareness.

#### Scenario: Analyze XHS notes from TikHub
- **WHEN** analysis receives normalized XHS notes
- **THEN** it produces analysis results without checking platform or provider fields

#### Scenario: Analyze Douyin videos from TikHub
- **WHEN** analysis receives normalized Douyin videos
- **THEN** it produces same analysis structure as XHS notes

#### Scenario: Analyze data from different providers
- **WHEN** analysis receives data from TikHub or direct-api provider
- **THEN** it processes identically after normalization

### Requirement: System provides utility functions for adapters
The system SHALL provide utility functions for common adapter and provider tasks.

#### Scenario: Response normalization utility
- **WHEN** adapter needs to normalize nested response structure
- **THEN** it uses extractData(response, path) utility function

#### Scenario: Pagination utility
- **WHEN** provider needs to handle pagination
- **THEN** it uses PaginationHelper class with hasMore/nextCursor methods

#### Scenario: Error translation utility
- **WHEN** provider needs to translate API error
- **THEN** it uses translateError(apiError) utility function

### Requirement: System enforces interface contracts at compile time
The system SHALL use TypeScript to enforce interface implementation at compile time.

#### Scenario: Provider missing required method
- **WHEN** developer creates provider without implementing required method
- **THEN** TypeScript compiler raises error before runtime

#### Scenario: Adapter missing required method
- **WHEN** developer creates adapter without implementing required method
- **THEN** TypeScript compiler raises error before runtime

#### Scenario: Type-safe method signatures
- **WHEN** developer implements interface method with wrong signature
- **THEN** TypeScript compiler raises type mismatch error
