---
name: create-screener
description: Run a structured sourcing sprint to turn a vague target market into a testable company screener with inclusion signals, exclusion rules, and firmographic filters. Use when user wants to create a screener, build a sourcing spec, define company screening criteria, or mentions "sourcing sprint".
---

# Create Screener

Run a sourcing sprint that converts a vague company category into a detailed screening spec saved as `screener.md`.

## Interview protocol

CRITICAL: Ask exactly ONE question per message. Never ask two or more questions in the same message. Wait for the user to answer before asking the next question. Resolve each answer fully before moving on.

Do not jump ahead. If the user answers a future-stage question early, capture it, acknowledge you captured it, and skip that question later.

Do not repeat progress after every turn. Only reflect the full picture back at two moments: (1) after all questions are answered and before searching for examples, and (2) at the very end when presenting the finished spec.

Do not use jargon unless the user introduces it first. Do not use emojis.

## Stages

### Stage 1: Industry, company type, and business model

Ask what industry or sector they are targeting, what type of company, what the company sells or provides, who the customer is, and how value is delivered. A label like "fintech" is not enough -- understand the commercial model.

### Stage 2: Fit signals

Ask what evidence suggests a company is a match. Push for observable, verifiable traits: website language, product claims, customer segments, technologies used, regulatory positioning, proof points, recent activity. When the user gives a vague or non-observable signal (e.g. "they care about enterprise readiness"), push back in real time and work with them to translate it into something a researcher or AI agent could actually verify (e.g. "they mention SOC 2 compliance on their website").

### Stage 3: Disqualifiers

Based on everything learned in Stages 1-2, propose likely disqualifiers and ask the user to confirm, reject, or add to them. Do not ask an open-ended "what should rule a company out?" -- suggest specific exclusions and let the user react.

### Stage 4: Firmographic filters

Lock in hard constraints: geography (default US unless specified), employee count, funding stage or ownership type, and any other firmographic boundaries. Never suggest ARR, revenue, or any revenue-based filters -- these numbers are not reliably available for private companies.

### Stage 5: Gap fill

Review everything collected so far. If there are contradictions, missing specificity, or gaps, surface them and suggest refinements. If prior stages were thorough, this may be a no-op -- do not invent issues where none exist.

## Example companies

After completing all stages, use web search to find 3 real companies that match the spec. Do this automatically without asking permission.

Present companies ONE at a time. For each company, include:
- The company name with a clickable URL to their website
- A brief explanation of why it appears to match the spec

Wait for the user's PASS/FAIL response on the current company before presenting the next one.

## Feedback loop

Ask the user to rate each example company as **PASS** or **FAIL**.

On a FAIL, ask specifically what made it a bad fit. Use that reasoning to tighten the spec.

On a PASS, no further explanation needed.

After feedback, revise the spec, search for 3 new example companies, and repeat. Maximum 2 feedback rounds. After round 2, present the final spec.

## Final output

Ask the user where to save the file (default: `screener.md` in the current directory).

Write the final screening spec as a markdown file with the following structure:

```markdown
# [Target Company Category] Screener

## Target definition
[Clear description of the target company in 2-3 sentences]

## Inclusion signals
[Bulleted list of observable, verifiable signals that indicate a match]

## Exclusion rules
[Bulleted list of disqualifiers that automatically rule a company out]

## Firmographic filters
- **Geography:** ...
- **Employee count:** ...
- **Funding/ownership:** ...
- [Any other hard constraints]

## Screening instructions
[Step-by-step instructions detailed enough for someone or an AI agent to pick up cold and screen a company to PASS/FAIL. Include what to look for, where to look, and how to make the call.]
```

Once the file is saved, state that the screener is built. Do not ask additional questions.
