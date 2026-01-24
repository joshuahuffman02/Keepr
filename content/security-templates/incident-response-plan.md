# Incident Response Plan Template

**[CAMPGROUND NAME]**
**Version: 1.0**
**Effective Date: [DATE]**
**Last Updated: [DATE]**

---

## 1. Purpose

This plan provides step-by-step procedures for responding to security incidents affecting [Campground Name]. A security incident is any event that compromises the confidentiality, integrity, or availability of our systems or data.

---

## 2. Incident Response Team

### Primary Contacts

| Role                | Name              | Phone | Email |
| ------------------- | ----------------- | ----- | ----- |
| Incident Commander  | [Owner/GM]        |       |       |
| Technical Lead      | [IT Admin/Vendor] |       |       |
| Communications Lead | [Manager]         |       |       |
| Legal Contact       | [Attorney]        |       |       |

### External Contacts

| Resource                        | Contact      | Phone |
| ------------------------------- | ------------ | ----- |
| IT Support Vendor               |              |       |
| Cyber Insurance                 |              |       |
| Law Enforcement (non-emergency) | Local Police |       |
| FBI Cyber (major incidents)     | ic3.gov      |       |

---

## 3. Incident Categories

### Severity Levels

| Level        | Description                            | Response Time   | Examples                           |
| ------------ | -------------------------------------- | --------------- | ---------------------------------- |
| **Critical** | Active breach, data exposed            | Immediate       | Ransomware, confirmed data theft   |
| **High**     | Likely compromise, needs investigation | Within 1 hour   | Suspicious login, malware detected |
| **Medium**   | Potential issue, contained             | Within 4 hours  | Phishing attempt, lost device      |
| **Low**      | Minor issue, no data at risk           | Within 24 hours | Policy violation, spam             |

---

## 4. Incident Response Phases

### Phase 1: Detection & Identification

**Goal: Confirm an incident has occurred**

When you suspect an incident:

1. [ ] Do NOT turn off affected systems (preserves evidence)
2. [ ] Document what you observed (time, symptoms, affected systems)
3. [ ] Contact Incident Commander immediately
4. [ ] Do not discuss with others until instructed

**Initial Questions to Answer:**

- What systems are affected?
- What type of data may be involved?
- Is the incident ongoing or contained?
- How was it discovered?

### Phase 2: Containment

**Goal: Stop the incident from spreading**

**Immediate Actions (within first hour):**

| Action                                        | Responsible        | Completed |
| --------------------------------------------- | ------------------ | --------- |
| [ ] Disconnect affected systems from network  | IT Lead            |           |
| [ ] Change passwords for compromised accounts | IT Lead            |           |
| [ ] Block suspicious IP addresses             | IT Lead            |           |
| [ ] Preserve logs and evidence                | IT Lead            |           |
| [ ] Notify key team members                   | Incident Commander |           |

**Do NOT:**

- Delete files or logs
- Contact the attacker
- Pay ransoms without legal/insurance guidance
- Make public statements

### Phase 3: Eradication

**Goal: Remove the threat**

| Action                                          | Responsible | Completed |
| ----------------------------------------------- | ----------- | --------- |
| [ ] Identify root cause                         | IT Lead     |           |
| [ ] Remove malware/unauthorized access          | IT Lead     |           |
| [ ] Patch vulnerabilities that were exploited   | IT Lead     |           |
| [ ] Reset all potentially compromised passwords | IT Lead     |           |
| [ ] Scan all systems for additional compromise  | IT Lead     |           |

### Phase 4: Recovery

**Goal: Restore normal operations**

| Action                                      | Responsible        | Completed |
| ------------------------------------------- | ------------------ | --------- |
| [ ] Restore systems from clean backups      | IT Lead            |           |
| [ ] Verify systems are functioning properly | IT Lead            |           |
| [ ] Monitor for signs of re-compromise      | IT Lead            |           |
| [ ] Re-enable network connections           | IT Lead            |           |
| [ ] Confirm business operations can resume  | Incident Commander |           |

### Phase 5: Post-Incident

**Goal: Learn and improve**

Within 1 week of resolution:

| Action                                    | Responsible         | Completed |
| ----------------------------------------- | ------------------- | --------- |
| [ ] Conduct post-incident review meeting  | Incident Commander  |           |
| [ ] Document timeline of events           | Communications Lead |           |
| [ ] Identify what worked and what didn't  | Team                |           |
| [ ] Update security controls as needed    | IT Lead             |           |
| [ ] Update this plan with lessons learned | Incident Commander  |           |

---

## 5. Communication Templates

### Internal Notification (to staff)

Subject: Security Incident - Action Required

Team,

We have identified a security incident affecting [brief description].

**Immediate actions required:**

- [Action 1]
- [Action 2]

**Do not:**

- Discuss this outside the team
- Post on social media
- Respond to media inquiries (direct to [name])

We will provide updates as more information is available.

[Incident Commander Name]

---

### Customer Notification (if data breach)

_See Breach Notification Template for detailed letters_

---

## 6. Legal & Regulatory Requirements

### Breach Notification Deadlines

| Jurisdiction        | Timeframe                     | Authority            |
| ------------------- | ----------------------------- | -------------------- |
| California (CCPA)   | 72 hours                      | CA Attorney General  |
| Other states        | Varies (typically 30-60 days) | State AG             |
| Payment cards (PCI) | Immediately                   | Card brands/acquirer |

### When to Notify Law Enforcement

Contact law enforcement if:

- Ransomware demands payment
- Known criminal activity (theft, fraud)
- Threats of violence
- Large-scale data theft

---

## 7. Documentation Requirements

For every incident, document:

- [ ] Date/time of discovery
- [ ] How incident was detected
- [ ] Systems and data affected
- [ ] Actions taken and timeline
- [ ] Personnel involved in response
- [ ] Root cause (if determined)
- [ ] Remediation steps taken
- [ ] Cost/impact assessment
- [ ] Lessons learned

**Store documentation for:** 7 years

---

## 8. Annual Testing

This plan should be tested annually:

| Test Type                 | Frequency | Last Completed | Next Due |
| ------------------------- | --------- | -------------- | -------- |
| Tabletop exercise         | Annual    |                |          |
| Backup restoration test   | Annual    |                |          |
| Contact list verification | Quarterly |                |          |
| Plan review/update        | Annual    |                |          |

---

## 9. Approval

**Approved by:** **********\_\_\_\_**********

**Title:** **********\_\_\_\_**********

**Date:** **********\_\_\_\_**********

---

_This template is provided for informational purposes. Consult with legal counsel and cybersecurity professionals to customize for your specific needs._
