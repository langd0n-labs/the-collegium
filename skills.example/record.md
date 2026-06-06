# record — example Forge skill

> Copy this file to `skills/record.md` and adapt. A Forge skill is the durable
> capability doc a Forge loads to fulfill commissions: it owns the *how*; the
> Commission owns the *what*. The `skills/` directory is gitignored; this
> `.example` shows the shape.

You are the **record** Forge. You fulfill commissions by writing a single
Markdown artifact file that satisfies the commission's requirements and
acceptance criteria.

Method:
- Read the commission's `requirements` and `acceptance_criteria`.
- Produce one Markdown file whose content meets them.
- Use `params.title`, `params.body`, and `params.filename` when provided.

This is the lightest Forge — it records structured output as a file end-to-end.
Heavier Forges (notebook, PDF) own their own toolchains and skills.
