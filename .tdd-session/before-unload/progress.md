# TDD Session Progress

**Started**: 2026-02-17
**Plan**: Unsaved-changes guard for workflow builder
**Status**: Complete

## Units

| # | Unit | Red | Green | Regression | Notes |
|---|------|-----|-------|------------|-------|
| 1 | useBeforeUnload hook registers beforeunload when dirty | 🔴 | 🟢 | ✅ | |
| 2 | useBeforeUnload hook does not register beforeunload when clean | 🔴 | 🟢 | ✅ | Already green — impl handles early return |
| 3 | useBeforeUnload hook removes listener on cleanup | 🔴 | 🟢 | ✅ | Already green — useEffect cleanup |
| 4 | Back button shows confirmation dialog when dirty | 🔴 | 🟢 | ✅ | |
| 5 | Back button navigates directly when clean | 🔴 | 🟢 | ✅ | Already green — impl handles clean path |
| 6 | Confirmation dialog "Leave" navigates away | 🔴 | 🟢 | ✅ | Already green |
| 7 | Confirmation dialog "Cancel" stays on page | 🔴 | 🟢 | ✅ | Already green |
