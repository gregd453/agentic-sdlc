#!/bin/bash
# E2E Test for Box #4: Sprint Completion Handler

set -e

echo "═══════════════════════════════════════════════════"
echo "E2E TEST: BOX #4 - SPRINT COMPLETION HANDLER"
echo "═══════════════════════════════════════════════════"
echo ""

WORKFLOW_ID="test-workflow-$(date +%s)"

# Run sprint completion handler
echo "Executing sprint completion handler..."
bash scripts/complete-sprint.sh "$WORKFLOW_ID"

echo ""
echo "🔍 Validating sprint completion..."
echo ""

# Check log file was created
log_file="logs/sprint-completion-${WORKFLOW_ID}.log"
echo "  ✓ Checking for completion log..."
if [ ! -f "$log_file" ]; then
    echo "  ❌ FAILED: Completion log not created"
    exit 1
fi
echo "    ✅ Log file exists: $log_file"

echo "  ✓ Checking log file content..."
if ! grep -q "SPRINT COMPLETION HANDLER" "$log_file"; then
    echo "  ❌ FAILED: Missing completion header"
    exit 1
fi
echo "    ✅ Log has proper header"

echo "  ✓ Checking for workflow ID..."
if ! grep -q "Workflow ID: $WORKFLOW_ID" "$log_file"; then
    echo "  ❌ FAILED: Workflow ID not in log"
    exit 1
fi
echo "    ✅ Workflow ID recorded"

echo "  ✓ Checking for completion status..."
if ! grep -q "Status: COMPLETED" "$log_file"; then
    echo "  ❌ FAILED: Completion status not found"
    exit 1
fi
echo "    ✅ Status marked as COMPLETED"

echo "  ✓ Checking for metrics..."
if ! grep -q "COMPLETION METRICS" "$log_file"; then
    echo "  ❌ FAILED: Metrics section missing"
    exit 1
fi
echo "    ✅ Metrics section found"

echo "  ✓ Checking for quality gates..."
if ! grep -q "QUALITY GATES" "$log_file"; then
    echo "  ❌ FAILED: Quality gates section missing"
    exit 1
fi
echo "    ✅ Quality gates section found"

echo "  ✓ Checking timestamp..."
if ! grep -q "Completed At:" "$log_file"; then
    echo "  ❌ FAILED: Timestamp missing"
    exit 1
fi
echo "    ✅ Timestamp recorded"

# Check JSON file was created
json_file="logs/sprint-completion-${WORKFLOW_ID}.json"
echo "  ✓ Checking for JSON summary..."
if [ ! -f "$json_file" ]; then
    echo "  ❌ FAILED: JSON summary not created"
    exit 1
fi
echo "    ✅ JSON file exists: $json_file"

echo "  ✓ Validating JSON format..."
if ! grep -q '"workflowId"' "$json_file"; then
    echo "  ❌ FAILED: Invalid JSON structure"
    exit 1
fi
echo "    ✅ JSON has valid structure"

echo "  ✓ Checking JSON metrics..."
if ! grep -q '"complianceScore"' "$json_file"; then
    echo "  ❌ FAILED: JSON missing compliance score"
    exit 1
fi
echo "    ✅ JSON includes compliance metrics"

echo ""
echo "📄 Completion Summary:"
echo "═══════════════════════════════════════════════════"
cat "$log_file"
echo ""

echo "📊 JSON Summary:"
echo "═══════════════════════════════════════════════════"
cat "$json_file" | grep -E '(workflowId|status|boxesExecuted|complianceScore)' || true
echo ""

echo "✅ BOX #4 E2E TEST PASSED"
echo ""
echo "═══════════════════════════════════════════════════"
exit 0
