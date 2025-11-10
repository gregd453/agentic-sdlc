# Branch Protection Rules Setup
## Protect Main Branch with CI/CD Checks

**Date:** 2025-11-09
**Status:** Setup Instructions

---

## Quick Setup (3 minutes)

### Step 1: Navigate to Branch Protection Settings

1. Go to your repository on GitHub
2. Click **Settings** tab
3. In left sidebar, click **Branches**
4. Under "Branch protection rules", click **Add rule**

---

## Configuration

### Step 2: Add Branch Protection Rule

**Pattern to protect:** `main`

---

### Step 3: Enable Required Settings

#### 1. **Require a pull request before merging** ✅
- ✅ Require approvals (set to: 1)
- ✅ Dismiss stale pull request approvals when new commits are pushed
- ✅ Require review from code owners

```
Why: Ensures code review before merge
```

---

#### 2. **Require status checks to pass before merging** ✅

**Required status checks:**

```
☑️ tests/e2e-complete
☑️ tests/performance-baseline
☑️ build (if using build workflows)
```

**Configuration:**
1. Check: "Require branches to be up to date before merging"
2. Add each status check:
   - Click "Add status check"
   - Search for "tests/e2e-complete"
   - Repeat for other checks

```
Why: Blocks merge if tests fail
```

---

#### 3. **Require conversation resolution before merging** ✅
- ✅ Enable

```
Why: Requires team to resolve all discussions
```

---

#### 4. **Require signed commits** (Optional)
- Leave unchecked (unless org policy requires)

```
Why: Sign commits with GPG key
```

---

#### 5. **Require linear history** (Recommended)
- ✅ Enable

```
Why: Clean git history, easier to bisect
```

---

#### 6. **Include administrators** ✅
- ✅ Do not allow bypassing the above settings

```
Why: Admins must also follow rules
```

---

#### 7. **Restrict who can push to matching branches**
- Optional: Add teams/people who can force push

```
Why: Emergency access for critical fixes
```

---

## Complete Checklist

```
☑️ Require a pull request before merging
   ☑️ 1 approval required
   ☑️ Dismiss stale reviews
   ☑️ Require code owner review

☑️ Require status checks to pass
   ☑️ tests/e2e-complete
   ☑️ tests/performance-baseline
   ☑️ Require up-to-date branches

☑️ Require conversation resolution

☑️ Require linear history

☑️ Include administrators
```

---

## What This Means

### For Developers

**Before you can merge to main:**

1. ✅ Create a pull request (can't push directly to main)
2. ✅ Wait for CI/CD workflows to complete
   - E2E tests must pass (96 tests)
   - Performance baseline must complete
3. ✅ Get 1 approval from code owner
4. ✅ Resolve all conversations/comments
5. ✅ Branch must be up-to-date with main

### Workflow Example

```
1. Developer pushes to branch: feature/new-api
2. GitHub auto-triggers: generate-and-test.yml
   ├─ Generates app
   ├─ Runs 96 E2E tests
   └─ Posts results to PR
3. If tests fail:
   - Status check shows ❌ FAILED
   - Cannot merge (blocked by rule)
   - Developer fixes code, pushes again
4. If tests pass:
   - Status check shows ✅ PASSED
   - Developer gets code review approval
   - Can click "Merge pull request"
```

---

## Status Checks Reference

### `tests/e2e-complete`

**What it does:**
```
Setup: Generate app via orchestrator
Test: Run 32 tests × 3 browsers = 96 tests
Report: Post results to PR comment
Status: ✅ PASSED or ❌ FAILED
```

**Expected duration:** 3-5 minutes

**Failure reasons:**
- API test failed
- UI test failed
- Integration test failed
- Performance regression detected

---

### `tests/performance-baseline`

**What it does:**
```
Run daily at 2 AM UTC
Extract performance metrics
Store baseline in repo
Detect regressions
```

**Note:** May not always run on every PR (depends on schedule)

---

## Bypassing (Emergency Only)

### If you MUST merge without approval

1. You must be a **repository administrator**
2. Go to branch protection rule
3. Temporarily disable rule
4. Merge
5. **Re-enable rule immediately**

**⚠️ WARNING:** This bypasses safety checks - only for critical emergencies!

---

## Testing Your Setup

### Test 1: Verify Rules Apply

1. Create a test branch: `git checkout -b test/rules`
2. Make a dummy change: `echo "test" >> README.md`
3. Push to GitHub: `git push origin test/rules`
4. Create a PR
5. Verify:
   - ✅ Cannot merge without approval
   - ✅ Cannot merge until tests pass
   - ✅ Status checks appear in PR

### Test 2: Verify Workflows Trigger

1. In your PR, go to **Checks** tab
2. Should see: `generate-and-test` workflow running
3. Should see status: "In progress..."
4. Wait 3-5 minutes
5. Should see result: ✅ PASSED or ❌ FAILED

---

## Troubleshooting

### Status Check Missing

**Problem:** "Status check not found"

**Solution:**
1. Workflow must run at least once
2. Push a commit to any branch
3. Let workflow complete
4. Then status check appears in dropdown

### Cannot Merge Despite Passing Tests

**Problem:** Still seeing "Merge blocked"

**Reasons:**
1. Not approved (need code owner approval)
2. Branch not up-to-date (need to pull latest main)
3. Unresolved conversations
4. Require code owner review not satisfied

**Solution:**
```bash
# Pull latest main
git fetch origin
git rebase origin/main

# Push updated branch
git push origin feature/your-feature --force-with-lease
```

### Accidentally Pushed to Main

**If branch protection is set up correctly:**
- This should be impossible
- Branch protection prevents it

**If it happened:**
1. Revert commit: `git revert <commit-hash>`
2. Push revert: `git push origin main`
3. Create PR for the revert (for visibility)

---

## FAQ

**Q: Can I push directly to main?**
A: No - branch protection prevents it. Use PR workflow.

**Q: What if tests fail?**
A: Status check shows FAILED, PR blocks merge. Fix code, push again.

**Q: How long do tests take?**
A: 3-5 minutes for E2E tests (32 × 3 browsers).

**Q: Can I skip status checks?**
A: Not without being admin and disabling rule (emergency only).

**Q: What about develop branch?**
A: Same rules apply if you want consistency. Optional.

---

## Next Steps

1. ✅ Follow steps above to create branch protection rule
2. ✅ Save rule
3. ✅ Test with a feature branch PR
4. ✅ Verify status checks appear
5. ✅ Verify PR blocks merge until tests pass

---

**Status:** Ready for configuration
**Time required:** ~3-5 minutes
**Difficulty:** Easy ⭐

**Once complete:** Your main branch is protected! 🛡️
