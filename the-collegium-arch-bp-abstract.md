Title: The Collegium: An Event-Driven Architecture for Communities of AI Expertise

Abstract:

Most multi-agent frameworks assume work should be represented as a directed graph of predefined steps. That approach works well for deterministic workflows but often struggles with exploratory, collaborative, and creative knowledge work.

The Collegium takes a different approach. Instead of orchestrating agents through rigid DAGs, it organizes expertise into topic-specific Collegia connected through an event bus. Fellows observe conversations, contribute when relevant, and commission work from a separate execution layer known as the Foundry.

Within the Foundry, specialized Forges produce artifacts such as reports, notebooks, presentations, datasets, and software deliverables. By separating deliberation from execution, the architecture allows lightweight expert personas to collaborate asynchronously while keeping heavyweight tooling isolated and scalable.

This article introduces the core concepts behind Collegia, Fellows, Foundries, Forges, Commissions, and Artifacts, and explains why event-driven systems may provide a better foundation for educational, research, and knowledge-work AI platforms than traditional workflow graphs.

