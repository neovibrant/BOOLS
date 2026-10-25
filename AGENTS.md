# Agent rules

Be brief and to the point. When generating documents, make all the possible effort to keep them **short**.

When asked a question, don't rush to conclusions, prefer to search the web for things you're not sure of. Validate your own knowledge whenever possible and practical.

Think before you answer, but make sure you don't think for too long or go in circles before coming back with an answer, use a tool or ask a question.

## Interaction

Before making changes, engage in discussion upfront. Do not rush into changing files, code, or documents.

Think and brainstorm before touching files. Make a plan, clarify open questions, provide feedback on the request, challenge assumptions when needed, and ask as many questions as needed upfront.

### Feedback and challenge

You are expected to give direct feedback on requests, not just execute them. Challenge assumptions, point out real risks, suggest simpler alternatives, and say when a requested direction seems unnecessary, unsafe, overcomplicated, or inconsistent with existing project decisions.

Do this respectfully and briefly. If the request is clearly safe and straightforward, proceed without over-discussing it.

If the task is a design, planning, product, architecture, or brainstorming session:
- do not use todo lists unless explicitly requested
- do not create or edit files unless explicitly requested
- discuss tradeoffs first
- ask clarifying questions before proposing conclusions
- document only decisions that were explicitly agreed

### Pragmatism

Pragmatism and simplicity are core values. Act like a pragmatic senior developer, considering carefully aspects and problems that really matter and avoid as much as possible to add code or complicate solutions in order to fix non-existent problems or improbable edge cases. When in doubt ask, but if the user doesn't appreciate the problem, move on.

Avoid premature optimisation.

## Folders

This folder contains materials for the project. Subfolders worth noting:
- Product - information about the product we're building
- Design - visual design files (usually made with Affinity)
- Tech - architecture and technical decisions
- Another.Bot.* - application code: Another.Bot.BE (backend), Another.Bot.FE (frontend), both in Another.Bot.slnx

This is a monorepo: documentation and application code live in the same Another.Bot repository.

## Code

Read and follow the current technical decisions in @Tech/tech-stack.md

### Comments

Prefer self-explanatory code over comments. Design rationale belongs in md docs, not code. Comment only where a reader would be surprised at that exact line (workarounds, warnings, non-obvious constraints). Don't remove existing comments unless your change makes them wrong.

### Backend coding practices

In the backend, try not to create interfaces unless specifically stated for the feature you're working on. We find them unnecessary noise in most cases, like old C header files. We don't want that unless there are clear reasons to introduce an interface.

### Tests

Follow @Tech/testing-strategy.md. Rely heavily on BE API functional tests; create unit or component tests only in extreme cases where the code cannot be tested otherwise.

## Git

GitHub repo: https://github.com/anotherbotai/Another.Bot (using ssh: git@github.com:anotherbotai/Another.Bot.git)

You have gh installed locally and can use it, as well as the git command.

### Issues, tickets, tracking

Create GitHub issues in this repository.
