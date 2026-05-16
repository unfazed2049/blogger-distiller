## ADDED Requirements

### Requirement: CLI tool provides unified command structure
The CLI tool SHALL provide a unified `media-crawler` command with platform subcommands (xhs, douyin, etc.).

#### Scenario: XHS search command
- **WHEN** user runs `media-crawler xhs search --keyword "博主名"`
- **THEN** system searches Xiaohongshu and returns blogger information in JSON format

#### Scenario: Douyin search command (future)
- **WHEN** user runs `media-crawler douyin search --keyword "博主名"`
- **THEN** system searches Douyin and returns blogger information in JSON format

#### Scenario: Invalid platform
- **WHEN** user runs `media-crawler invalid-platform search`
- **THEN** system exits with error "Unknown platform: invalid-platform" and lists available platforms

### Requirement: CLI tool supports pluggable provider system
The CLI tool SHALL support multiple data providers with tikhub as the default.

#### Scenario: Use default provider
- **WHEN** user runs `media-crawler xhs search "博主名"` without --provider flag
- **THEN** system uses tikhub provider

#### Scenario: Explicit provider selection
- **WHEN** user runs `media-crawler xhs search "博主名" --provider tikhub`
- **THEN** system uses specified tikhub provider

#### Scenario: Invalid provider
- **WHEN** user runs `media-crawler xhs search "博主名" --provider unknown`
- **THEN** system exits with error "Unknown provider: unknown" and lists available providers

### Requirement: CLI tool provides profile command for each platform
The CLI tool SHALL provide platform-specific profile commands that fetch blogger profile and notes list.

#### Scenario: Fetch XHS profile by user_id
- **WHEN** user runs `media-crawler xhs profile --user-id <id> --token <token>`
- **THEN** system returns XHS profile JSON with userBasicInfo, interactions, and feeds array

#### Scenario: Fetch profile with pagination
- **WHEN** user runs `media-crawler xhs profile --user-id <id> --max-notes 100`
- **THEN** system fetches up to 100 notes across multiple pages

#### Scenario: Profile fetch with API error
- **WHEN** TikHub API returns error during profile fetch
- **THEN** system retries with fallback endpoint and logs warning

### Requirement: CLI tool provides notes supplement command
The CLI tool SHALL provide notes command that supplements notes list through keyword search.

#### Scenario: Search supplement with custom keywords
- **WHEN** user runs `media-crawler xhs notes --user-id <id> --keywords "烘焙,食谱"`
- **THEN** system searches with each keyword and returns new notes not in existing list

#### Scenario: Search supplement with generic keywords
- **WHEN** user runs `media-crawler xhs notes --user-id <id>` without --keywords flag
- **THEN** system uses generic suffixes (教程, 推荐, 分享, 测评, 攻略, 合集)

#### Scenario: Search reaches max notes limit
- **WHEN** notes list reaches max-notes + 10 buffer
- **THEN** system stops searching and returns current list

### Requirement: CLI tool provides details command
The CLI tool SHALL provide a details command that fetches full note details with comments.

#### Scenario: Fetch details for note list
- **WHEN** user runs `media-crawler xhs details --notes-file <path> --output <dir>`
- **THEN** system fetches each note's detail and saves to output directory

#### Scenario: Checkpoint and resume
- **WHEN** details fetch is interrupted after 10 notes
- **THEN** system saves checkpoint file and resumes from last position on restart

#### Scenario: Content restricted note
- **WHEN** API returns "not found" or empty note object
- **THEN** system marks note as content_restricted and preserves title for analysis

### Requirement: CLI tool supports JSON output format
The CLI tool SHALL output all data in JSON format compatible with existing Python analysis scripts.

#### Scenario: Profile output format
- **WHEN** profile command completes successfully
- **THEN** output JSON matches structure: `{ userBasicInfo: {...}, interactions: [...], feeds: [...], _source: "tikhub" }`

#### Scenario: Details output format
- **WHEN** details command completes successfully
- **THEN** output JSON array matches structure: `[{ note: {...}, comments: {list: [...]}, _meta: {...}, _feed_id: "..." }]`

#### Scenario: Error output format
- **WHEN** any command fails
- **THEN** stderr contains JSON with `{ error: "...", code: "...", details: {...} }`

### Requirement: CLI tool supports authentication
The CLI tool SHALL accept TikHub API token via command line flag or environment variable.

#### Scenario: Token via command line
- **WHEN** user runs command with `--token <token>`
- **THEN** system uses provided token for API authentication

#### Scenario: Token via environment variable
- **WHEN** user sets TIKHUB_API_TOKEN environment variable
- **THEN** system uses environment token if --token flag not provided

#### Scenario: Missing token
- **WHEN** user runs command without token
- **THEN** system exits with error code 1 and message "TIKHUB_API_TOKEN required"

### Requirement: CLI tool implements rate limiting
The CLI tool SHALL respect TikHub API rate limits with configurable delay between requests.

#### Scenario: Default rate limiting
- **WHEN** CLI tool makes sequential API requests
- **THEN** system waits 0.3 seconds between detail requests and 0.5 seconds between search requests

#### Scenario: Custom RPS configuration
- **WHEN** user sets TIKHUB_RPS environment variable to 20
- **THEN** system adjusts delay to maintain 20 requests per second

#### Scenario: Adaptive delay on errors
- **WHEN** API returns rate limit error (429)
- **THEN** system increases delay exponentially and retries

### Requirement: CLI tool supports TypeScript type safety
The CLI tool SHALL use TypeScript with strict type checking for all API contracts and data structures.

#### Scenario: API response types
- **WHEN** TikHub API returns response
- **THEN** system validates response against TypeScript interface before processing

#### Scenario: Command argument types
- **WHEN** user provides command arguments
- **THEN** Commander.js validates types match defined schema

#### Scenario: Type mismatch error
- **WHEN** API response doesn't match expected type
- **THEN** system throws TypeScript error with detailed type information
