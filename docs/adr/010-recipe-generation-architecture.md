# ADR-010: Recipe Generation Architecture

**Date:** 2025-07-24  
**Status:** Accepted  
**Context:** VSCode Moderne Extension - Phase 3 Advanced Recipe Features

## Context

The extension needs to generate OpenRewrite recipes from user code selections. This involves pattern analysis, template processing, and intelligent code generation while maintaining proper OpenRewrite structure and conventions.

## Decision

We will implement a template-based recipe generation system with AI-assisted pattern detection:

### 1. Recipe Template System
- **RecipeTemplateService**: Core template processing and generation
- **Template Repository**: Predefined templates for common recipe patterns
- **Dynamic Placeholders**: Context-aware placeholder replacement
- **Code Structure Analysis**: Parse and understand code patterns

### 2. Pattern Detection Engine
- **PatternDetectionService**: AI-assisted pattern recognition
- **Rule-Based Matching**: Deterministic pattern matching for common cases
- **Context Analysis**: Understand code context and intent
- **Framework Detection**: Identify framework-specific patterns

### 3. Recipe Types Support
- **Refaster Templates**: Simple before/after transformations
- **Visitor Recipes**: Complex imperative transformation logic
- **YAML Recipes**: Configuration-based transformations
- **Composite Recipes**: Multi-step recipe compositions

### 4. Code Generation Pipeline
```
User Selection → Pattern Analysis → Template Selection → 
Context Extraction → Code Generation → Validation → File Creation
```

## Template Architecture

### Template Structure
```typescript
interface RecipeTemplate {
    type: RecipeType;
    category: RecipeCategory;
    name: string;
    description: string;
    placeholders: TemplatePlaceholder[];
    template: string;
    validation: ValidationRule[];
    dependencies: string[];
}
```

### Context Extraction
- **Syntax Analysis**: Parse code structure and semantics
- **Type Information**: Extract type information from workspace
- **Import Resolution**: Determine required imports and dependencies
- **Framework Context**: Detect Spring, Jackson, etc. frameworks

### Smart Placeholders
- `{{PACKAGE_NAME}}`: Auto-detect from file location
- `{{CLASS_NAME}}`: Generate appropriate class names
- `{{BEFORE_PATTERN}}`: Extract before transformation code
- `{{AFTER_PATTERN}}`: Generate after transformation code
- `{{IMPORTS}}`: Auto-generate required imports

## Rationale

**User Experience**: Simplifies recipe creation for developers
- No need to understand OpenRewrite template syntax
- Automatic boilerplate generation
- Intelligent defaults based on code context

**Code Quality**: Generated recipes follow best practices
- Proper OpenRewrite annotations and structure
- Appropriate imports and dependencies
- Validation ensures correctness

**Extensibility**: Template system supports customization
- Custom templates for organization-specific patterns
- Plugin architecture for new recipe types
- Community template sharing capabilities

## Implementation Strategy

### Phase 1: Basic Templates
- Refaster templates for simple transformations
- Basic visitor recipes for method calls
- Fixed placeholder replacement

### Phase 2: Smart Context
- Workspace analysis for type information
- Framework detection and specialized templates
- Dynamic import generation

### Phase 3: AI Integration
- Pattern recognition for complex transformations
- Suggested improvements and optimizations
- Learning from user behavior and corrections

## Validation and Quality

### Template Validation
- Syntax validation for generated OpenRewrite code
- Compilation checking with workspace dependencies
- Runtime validation where possible

### User Feedback Integration
- Template usage analytics
- User correction tracking
- Iterative template improvement

## Configuration

```json
{
  "moderne.recipes.defaultType": "refaster",
  "moderne.recipes.templatePath": "/custom/templates",
  "moderne.recipes.enableAIPatterns": true,
  "moderne.recipes.validateGenerated": true,
  "moderne.generation.includeTests": true,
  "moderne.generation.autoImports": true
}
```

## Consequences

**Positive:**
- Dramatically lowers barrier to recipe creation
- Consistent, high-quality generated recipes
- Extensible template system for customization
- Integration with existing development workflows

**Negative:**
- Complex pattern analysis and template processing
- Potential for incorrect pattern detection
- Template maintenance overhead
- Dependency on workspace context accuracy

## Security Considerations

- Generated code is sandboxed during validation
- No execution of user code during analysis
- Template injection prevention
- Safe placeholder replacement

## Related ADRs

- ADR-007: Multi-Repository Search Architecture
- ADR-001: Service Layer Architecture
- ADR-009: Caching and Performance Strategy