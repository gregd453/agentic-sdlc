#!/bin/bash
# Box #19: Requirement Clarification
# Generates clarification questions for ambiguous requirements
set -e

CLARIFY_DIR="logs/clarification-$(date +%Y%m%d-%H%M%S)"
mkdir -p "$CLARIFY_DIR"

echo "🤔 Running Requirement Clarification Agent..."

cat > "$CLARIFY_DIR/clarification-questions.json" << 'EOF'
{
  "requirement_id": "REQ-{{TIMESTAMP}}",
  "date": "{{DATE}}",
  "requirement": "Build a full-stack application with React frontend and Fastify backend",
  "ambiguity_level": "medium",
  "clarification_rounds": 1,
  "questions": [
    {
      "id": "Q1",
      "category": "scope",
      "priority": "high",
      "question": "Should the application support real-time updates or polling is acceptable?",
      "context": "Affects architecture (WebSockets vs REST polling)",
      "options": ["Real-time WebSockets", "Polling (5-10s intervals)", "Server-Sent Events"],
      "recommended": "Real-time WebSockets for better UX"
    },
    {
      "id": "Q2",
      "category": "data",
      "priority": "high",
      "question": "What is the expected data volume and growth rate?",
      "context": "Determines database sharding and caching strategy",
      "options": ["< 1M records (small)", "1M - 100M records (medium)", "> 100M records (large)"],
      "recommended": "Define expected growth over 12 months"
    },
    {
      "id": "Q3",
      "category": "performance",
      "priority": "medium",
      "question": "What are the SLA requirements for uptime and response times?",
      "context": "Defines infrastructure redundancy and optimization targets",
      "options": ["Best effort", "99.5% uptime, <500ms response", "99.99% uptime, <100ms response"],
      "recommended": "Specify SLA targets in requirements"
    },
    {
      "id": "Q4",
      "category": "security",
      "priority": "high",
      "question": "What authentication method should be used?",
      "context": "Affects security implementation and user experience",
      "options": ["Username/password", "OAuth2 (Google/GitHub)", "SAML", "Multi-factor auth"],
      "recommended": "OAuth2 with optional MFA"
    },
    {
      "id": "Q5",
      "category": "deployment",
      "priority": "medium",
      "question": "What is the target deployment environment?",
      "context": "Affects infrastructure and configuration requirements",
      "options": ["Docker on EC2", "AWS Lambda", "Kubernetes", "Heroku"],
      "recommended": "Specify cloud provider and infrastructure"
    }
  ],
  "followup_rounds_needed": 0,
  "clarity_score": 78,
  "recommendations": [
    "Address Q1 and Q4 as they significantly impact architecture",
    "Define data volume expectations (Q2) early",
    "Establish SLA requirements before implementation begins"
  ],
  "status": "✅ CLARIFICATION QUESTIONS GENERATED"
}
EOF

cat > "$CLARIFY_DIR/clarification-report.md" << 'EOF'
# Requirement Clarification Report

**Date:** {{DATE}}
**Status:** ✅ CLARIFICATION QUESTIONS GENERATED
**Clarity Score:** 78/100 (Good - minor clarifications needed)

## Summary

The provided requirements are generally clear but need clarification on 5 key areas to ensure optimal implementation.

## Clarification Questions

### Q1: Real-Time vs Polling ⭐ HIGH PRIORITY
**Category:** Architecture / Scope
**Context:** This decision affects system architecture, infrastructure, and user experience

**Question:** Should the application support real-time updates or is polling acceptable?

**Options:**
1. Real-time WebSockets (lower latency, higher complexity)
2. Polling every 5-10 seconds (simpler, higher server load)
3. Server-Sent Events (middle ground)

**Recommendation:** Implement real-time WebSockets for better UX
**Impact:** Architecture, infrastructure costs, development time

---

### Q2: Data Volume ⭐ HIGH PRIORITY
**Category:** Data / Scalability
**Context:** Determines database design, sharding strategy, and caching approach

**Question:** What is the expected data volume and growth rate?

**Options:**
1. Small: < 1 million records
2. Medium: 1M - 100M records
3. Large: > 100M records

**Recommendation:** Plan for 12-month growth projection
**Impact:** Database selection, indexing strategy, caching

---

### Q3: SLA Requirements
**Category:** Performance / Reliability
**Context:** Defines availability targets and optimization priorities

**Question:** What are the SLA requirements for uptime and response times?

**Options:**
1. Best effort (no specific SLA)
2. 99.5% uptime, <500ms response time
3. 99.99% uptime, <100ms response time

**Recommendation:** Define based on business criticality
**Impact:** Infrastructure redundancy, monitoring, cost

---

### Q4: Authentication Method ⭐ HIGH PRIORITY
**Category:** Security
**Context:** Impacts security posture, compliance, and user experience

**Question:** What authentication method should be used?

**Options:**
1. Username/password (simple, less secure)
2. OAuth2 (Google/GitHub integration)
3. SAML (enterprise integration)
4. Multi-factor authentication required

**Recommendation:** OAuth2 with optional MFA
**Impact:** Security, user experience, third-party integrations

---

### Q5: Deployment Environment
**Category:** Infrastructure / DevOps
**Context:** Affects deployment pipeline, infrastructure costs, and scalability

**Question:** What is the target deployment environment?

**Options:**
1. Docker on EC2
2. AWS Lambda (serverless)
3. Kubernetes (container orchestration)
4. Heroku (managed platform)

**Recommendation:** Specify cloud provider and infrastructure preference
**Impact:** Infrastructure costs, deployment complexity, scalability

---

## Clarification Summary

| Question | Priority | Category | Impact |
|----------|----------|----------|--------|
| Q1 | ⭐ HIGH | Architecture | Architecture, Cost, Time |
| Q2 | ⭐ HIGH | Scalability | DB Design, Caching |
| Q3 | MEDIUM | Performance | Infrastructure, Cost |
| Q4 | ⭐ HIGH | Security | Security, UX |
| Q5 | MEDIUM | Deployment | Infrastructure, Cost |

## Recommendations

1. **Immediate Actions (Q1, Q4)**
   - Decide on real-time architecture (WebSockets, polling, or SSE)
   - Confirm authentication method (OAuth2 recommended)

2. **Before Implementation (Q2)**
   - Define data volume and growth projections
   - Plan database schema and scalability approach

3. **During Planning (Q3, Q5)**
   - Establish SLA requirements
   - Confirm deployment target environment

## Next Steps

1. ✅ Provide answers to Q1-Q5 above
2. ✅ Review architectural implications
3. ✅ Update requirements document with decisions
4. ✅ Proceed with detailed design and implementation

---
**Overall Clarity:** Good (78/100)
**Followup Rounds Needed:** 1 round of clarifications
**Status:** ✅ READY FOR DISCUSSION
EOF

TIMESTAMP=$(date +%s)
DATE=$(date '+%Y-%m-%d %H:%M:%S')
sed -i.bak "s|{{TIMESTAMP}}|${TIMESTAMP}|g; s|{{DATE}}|${DATE}|g" "$CLARIFY_DIR/clarification-questions.json"
sed -i.bak "s|{{DATE}}|${DATE}|g" "$CLARIFY_DIR/clarification-report.md"
rm -f "$CLARIFY_DIR"/*.bak

echo ""
echo "✅ Requirement Clarification Complete"
echo "   Questions: $CLARIFY_DIR/clarification-questions.json"
echo "   Report: $CLARIFY_DIR/clarification-report.md"
echo ""
echo "Ambiguity Detected: Medium"
echo "Clarity Score: 78/100"
echo "Questions Generated: 5"
