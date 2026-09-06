---
# STUB ARTICLE — replaces nothing, demonstrates the pipeline.
# Real articles are written one-per-keyword from the KEYWORDS plan.
title: "Email subject line length: what Gmail actually shows"
slug: email-subject-line-length
description: "How many characters of a subject line Gmail shows on desktop and mobile, and how to write subjects that survive truncation."
keyword: email subject line length
secondaryKeywords:
  - gmail subject line character limit
  - subject line truncation
tags:
  - email
  - gmail
  - writing
category: Email basics
date: 2026-09-06
updated: null
author: Inbox Wingman
status: published
featuredImage: /logo.png
featuredImageAlt: Inbox Wingman logo
canonical: null
faq:
  - q: How many characters can an email subject line be?
    a: Technically a subject can be very long (the RFC allows hundreds of characters), but email clients cut it off much earlier. Gmail on desktop typically shows around 60–70 characters in the list view, and mobile apps often show 30–40. Anything past the cutoff is invisible until the email is opened.
  - q: What is a good subject line length for Gmail?
    a: Keep the part that matters inside the first 40 characters. That way the core message survives both desktop and mobile truncation. Most practical guides recommend staying under about 60 characters overall.
  - q: Does subject line length affect deliverability?
    a: Length by itself is not a spam signal. What hurts is what often comes with long subjects — all caps, repeated punctuation, and clickbait phrasing. Write a plain, specific subject and length takes care of itself.
relatedSlugs: []
relatedToolSlugs:
  - email-subject-line-tester
cta:
  headline: Spend less time in Gmail, not more
  body: Inbox Wingman triages every incoming email, drafts replies in your voice, and sends you one daily brief — so subject lines are the least of your worries.
  href: /login
  label: Start free trial
---

You wrote a clear subject line, hit send, and on your recipient's phone it reads "Quick question about the invoice fo…". The part that mattered got cut.

There is no single "maximum subject line length" — the limit that matters is not what email allows, but what inboxes *display*. This short guide covers what the major clients show, and how to write subjects that survive the cut.

## The technical limit is not the real limit

The email standard (RFC 5322) recommends keeping each header line under 78 characters and allows up to 998. In practice you could send a 500-character subject and it would deliver fine.

But nobody reads subjects in raw form. They read them in an inbox list, squeezed between a sender name and a timestamp. That's where the real limit lives.

## What Gmail and other clients typically display

Exact numbers depend on screen width, font settings, and whether a preview snippet is shown, so treat these as working ranges rather than hard rules:

| Client | Approximate visible characters |
| --- | --- |
| Gmail desktop (list view) | ~60–70 |
| Gmail app (phone) | ~30–40 |
| Apple Mail (phone) | ~35–45 |
| Outlook desktop | ~50–70 |

Two things follow from the table:

1. **Mobile is the constraint.** A large share of email is opened on phones, and phones show roughly half of what desktop shows.
2. **The first ~40 characters are the only part you control.** Everything after that may or may not be seen.

## How to write subjects that survive truncation

**Front-load the point.** Put the noun that matters first: "Invoice #218 — payment due Friday" beats "Just following up regarding the outstanding invoice #218".

**One subject, one topic.** If you need two topics, send two emails. Combined subjects are the first to become meaningless when truncated.

**Skip the filler openers.** "Quick question about…", "Following up on…", "Checking in re:…" burn 20+ characters before saying anything. Cut straight to the content.

**Use numbers and names.** "Staging deploy blocked by failing auth test" is specific and scannable. "Problem with the deployment" is not.

**Don't shout.** All caps and stacked punctuation ("URGENT!!!") don't buy attention in 2026 — they pattern-match to spam, for both filters and humans.

You can check any subject against these rules with our free [subject line tester](/tools/email-subject-line-tester) — it shows live desktop and mobile previews and flags common issues.

## When the subject line isn't the problem

If you're optimizing subject lines because your own inbox is unmanageable — clients buried under newsletters, bots, and notification noise — the fix usually isn't better subjects, it's better triage on the receiving side. That's the problem [Inbox Wingman](/features) solves: it classifies every incoming email inside Gmail, drafts replies in your voice, and sends one daily brief with everything you owe an answer to.
