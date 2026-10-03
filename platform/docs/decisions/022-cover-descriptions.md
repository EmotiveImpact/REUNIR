# Decision 022: descriptions for cover pictures

Status: implemented in Alpha 22, verified locally; not deployed. Date: 3 October 2026.

## Problem

Covers were always decorative. That is right on cards, where the title sits beside the picture, but on a track's or project's own page the picture is large and may show something that matters, such as the people or place a project is about. Screen reader users heard nothing about it.

## Decision

- **An optional description per cover.** The cover dialogue has **Describe the picture (optional)**. It holds up to 150 characters of plain text on one line, stored with the cover itself, so no migration is needed. The stored cover keeps within its existing 1,000-byte check even when every character takes four bytes.
- **Read aloud where the picture is the subject.** The large cover on a track's or project's own page is announced as an image with that description. Cards, lists and thumbnails stay decorative, because their titles are real text beside them. An empty description keeps the large cover decorative too.
- **It belongs to the picture.** Moving the focal point keeps the description, and choosing a new picture starts without one, so a description never outlives what it described. Removing a cover removes it.
- **The same people edit it.** Whoever may change the cover may describe it: administrators, a track's instructors and a project's own owner.

## Not decided here

Descriptions for library pictures themselves (each use is described where it is used), automatic descriptions and descriptions in more than one language.
