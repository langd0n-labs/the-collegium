# Why I Renamed My Multi-Agent System

One of the most surprising parts of designing software is discovering how much the names matter.

The first version of my architecture had a mythology theme. Expert personas were called Gods. Execution workers were called Dwarves. The overall system was called the Pantheon.

At first, it seemed clever. The metaphor was easy to remember and gave the project some personality.

But over time I noticed a problem.

The names were becoming the story.

Whenever I explained the architecture, I spent more time explaining the mythology than explaining the system.

The actual design is not about gods, power, or hierarchy.

It is about expertise.

A group of specialized personas observe a conversation, contribute when appropriate, and occasionally request that some concrete work be performed. A separate execution layer produces artifacts such as reports, notebooks, PDFs, presentations, or software deliverables.

The architecture itself is event-driven. There is no central planner. There is no rigid workflow graph. There is simply a community of expertise interacting through shared context and a messaging system.

Once I recognized that, the naming started to change.

The platform became The Collegium.

A topic-specific collection of experts became a Collegium.

The collection of all such communities became the Collegia.

Individual expert personas became Fellows.

The execution infrastructure became the Foundry.

Specialized execution capabilities became Forges.

Requests for work became Commissions.

The outputs became Artifacts.

What I find interesting is that these names did more than improve branding. They clarified the architecture.

A Fellow does not build a PDF.

A Fellow commissions an artifact.

A Forge does not make decisions.

A Forge fulfills commissions.

The Foundry coordinates production.

The Collegium contributes expertise.

The naming system became a description of the architecture itself.

That was the real lesson.

Software names are often treated as decoration applied after the design is complete. In practice, the opposite is frequently true. A good naming system reveals the underlying model. A bad one obscures it.

The more accurately the names reflected the behavior of the system, the easier the architecture became to explain.

In the end, the goal was not to find more impressive names.

The goal was to find names that told the truth.

