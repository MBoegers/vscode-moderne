# ADR-008: Debug Protocol Integration

**Date:** 2025-07-24  
**Status:** Accepted  
**Context:** VSCode Moderne Extension - Phase 3 Recipe Debugging

## Context

The extension needs to provide debugging capabilities for OpenRewrite recipes. This requires integration with VSCode's Debug Adapter Protocol (DAP) and coordination with the Moderne CLI's JVM debug capabilities.

## Decision

We will implement debug support using VSCode's native debug protocol with custom debug configuration:

### 1. Debug Configuration Provider
- **Custom Debug Type**: `moderne-recipe` debug configuration
- **Launch Configurations**: Direct recipe debugging from VSCode
- **Attach Configurations**: Connect to running CLI debug sessions
- **Dynamic Configuration**: Auto-configure based on workspace context

### 2. Debug Service Architecture
- **DebugService**: Core debugging logic and state management
- **BreakpointManager**: Handle breakpoint setting and synchronization
- **DebugAdapterFactory**: Create debug adapters for recipe sessions
- **SessionTracker**: Track active debug sessions and their states

### 3. CLI Debug Integration
- **JVM Debug Bridge**: Interface with CLI's `--jvm-debug` option
- **Debug Port Management**: Automatic port allocation and management
- **Process Lifecycle**: Handle debug process startup and cleanup
- **Output Streaming**: Capture and display debug output

### 4. UI Integration
- **Debug Commands**: Standard debug controls (continue, step, pause)
- **Variable Inspection**: View recipe state and variables
- **Call Stack Display**: Show recipe execution flow
- **Debug Console**: Interactive debug REPL integration

## Rationale

**VSCode Integration**: Using native debug protocol provides familiar UX
- Users can use standard debug keybindings and UI
- Integrates with existing debug panels and views
- Supports standard debug features (breakpoints, stepping, etc.)

**CLI Compatibility**: Bridge design maintains CLI independence
- No modifications required to Moderne CLI
- Uses existing JVM debug capabilities
- Preserves CLI's recipe execution model

**Extensibility**: Service architecture supports future debug features
- Custom debug adapters for specialized scenarios
- Support for different recipe types and frameworks
- Integration with recipe testing workflows

## Consequences

**Positive:**
- Familiar debug experience for VSCode users
- Full debugging capabilities for recipe development
- No CLI modifications required
- Extensible for future debugging scenarios

**Negative:**
- Complex integration with debug protocol
- Additional state management for debug sessions
- Platform-specific considerations for JVM debugging
- Dependency on CLI's debug capabilities

## Implementation Notes

- Debug sessions are tracked by unique session IDs
- Breakpoints are synchronized between VSCode and JVM debugger
- Debug configurations support both launch and attach modes
- Output streaming uses VSCode's debug console integration
- Process cleanup ensures no orphaned debug processes

## Security Considerations

- Debug ports are allocated from safe ranges
- Debug sessions are isolated per workspace
- No sensitive information exposed in debug output
- Debug processes inherit appropriate security context

## Related ADRs

- ADR-002: CLI Integration Strategy
- ADR-001: Service Layer Architecture
- ADR-004: Error Handling Strategy