# ADR-007: Multi-Repository Search Architecture

**Date:** 2025-07-24  
**Status:** Accepted  
**Context:** VSCode Moderne Extension - Phase 3 Advanced Features

## Context

The extension needs to support searching across multiple repositories efficiently. This involves complex coordination between the CLI, result aggregation, UI updates, and performance optimization.

## Decision

We will implement a layered search architecture with the following components:

### 1. Search Service Layer
- **SearchService**: Base search functionality
- **OptimizedSearchService**: Extended search with caching and pagination
- **PatternDetectionService**: AI-assisted pattern matching

### 2. Result Management
- **Streaming Results**: Progressive result loading for large datasets
- **Repository Grouping**: Organize results by repository for better UX
- **Export Functionality**: Allow users to export search results

### 3. CLI Integration Strategy
- **Command Composition**: Build complex CLI commands dynamically
- **Output Parsing**: Parse structured CLI output into typed models
- **Error Recovery**: Handle CLI failures gracefully

### 4. UI Integration
- **Custom Tree Provider**: Dedicated search results panel
- **VSCode Search Integration**: Leverage native search UI patterns
- **Progress Indicators**: Show search progress and cancellation support

## Rationale

**Performance**: Layered architecture allows for optimizations at each level
- Caching frequently accessed results
- Lazy loading of large result sets
- Background processing with cancellation

**User Experience**: Clear separation of concerns enables better UX
- Progressive result display
- Repository organization
- Export and filtering capabilities

**Maintainability**: Service separation enables easier testing and modification
- Each service has clear responsibilities
- Mock-friendly interfaces for testing
- Extensible for future search strategies

## Consequences

**Positive:**
- Scalable search across large numbers of repositories
- Responsive UI during long-running searches
- Clear separation of search logic from presentation
- Extensible architecture for new search types

**Negative:**
- Increased complexity compared to simple search
- More memory usage for caching and result management
- Additional abstraction layers to maintain

## Implementation Notes

- Search results are cached using a combination of query hash and repository state
- UI updates use VSCode's built-in progress and cancellation APIs
- CLI command timeouts are configurable per search type
- Result streaming prevents blocking the UI thread

## Related ADRs

- ADR-002: CLI Integration Strategy
- ADR-001: Service Layer Architecture
- ADR-004: Error Handling Strategy