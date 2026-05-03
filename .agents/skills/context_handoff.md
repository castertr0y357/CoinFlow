# Context Handoff Protocol

When you approach the limits of your context window (e.g., you receive generation limit errors, or you feel the conversation has become extremely long and complex), you must recommend a handoff to the user to start a new conversation. 

To ensure a seamless transition for the next agent, perform the following steps:

1. **Update the Status File**: Create or update a `status.md` file in the root of the workspace.
2. **Document State**: In `status.md`, comprehensively summarize:
   - The current state of the project (stable vs broken).
   - What tasks were completed in the current session.
   - Any unresolved errors, partial implementations, or context needed to understand the current code state.
   - The exact next steps the new agent should take.
3. **Instruct the User**: Inform the user to start a new chat and tell them the next agent will automatically read `status.md` to resume work.
