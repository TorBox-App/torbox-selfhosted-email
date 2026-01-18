# Template Editor Polish Backlog

Future polish improvements to implement when time permits.

## 8. Selection Feedback (Multi-Select & Bulk Actions)

**Priority**: Medium
**Effort**: High

### Features
- Multi-select blocks with `Cmd+click` or `Shift+click`
- Selection count badge showing "3 blocks selected"
- Bulk actions toolbar:
  - Delete selected
  - Duplicate selected
  - Align selected (left/center/right)
  - Group into section
- Visual selection highlight with handles

### Implementation Notes
- Extend TipTap selection to track multiple NodeSelections
- Add SelectionToolbar component that appears on multi-select
- Store selected node positions in template-store
- Handle bulk operations via editor transactions

---

## 10. Preview Improvements

**Priority**: Medium
**Effort**: Medium-High

### Features
- Dark mode preview toggle (simulate dark email clients)
- "View in actual email client" integration:
  - Litmus preview API
  - Email on Acid integration
  - Or build custom iframe-based previews
- Share preview link for stakeholder feedback:
  - Generate temporary public URL
  - Password protection option
  - Expiration settings

### Implementation Notes
- Add dark mode CSS inversion in PreviewPanel
- Create SharePreviewModal with link generation
- API route to create shareable preview tokens
- Consider third-party email testing service integration

---

## 13. Version History Enhancements

**Priority**: Low-Medium
**Effort**: High

### Features
- Visual diff between versions:
  - Side-by-side comparison
  - Inline diff highlighting (additions in green, deletions in red)
- Named checkpoints:
  - Allow custom names ("Before redesign", "Client feedback v2")
  - Auto-name based on changes ("Added header section")
- Compare any two versions side-by-side

### Implementation Notes
- Use diff-match-patch or similar for JSON diffing
- Extend version history API to support named checkpoints
- Create CompareVersionsModal with split view
- Consider using Monaco diff editor for code view comparison

---

## 14. Code View Polish

**Priority**: Low
**Effort**: Medium

### Features
- Syntax highlighting themes (light/dark/custom)
- Format/prettify button (auto-format HTML/JSON)
- Line numbers with click-to-copy
- Find/replace functionality
- Go to line shortcut (Cmd+G)
- Minimap toggle

### Implementation Notes
- Monaco editor already supports most features
- Add theme selector dropdown
- Implement prettier formatting on button click
- Enable Monaco's built-in find/replace (Cmd+F)
- Add line number click handler for copy

---

## Notes

These items were deferred from the initial polish pass to focus on higher-impact features. Revisit when:
- User feedback requests these features
- Building out collaboration features (selection feedback)
- Enterprise customers need preview sharing
- Power users request advanced code editing
