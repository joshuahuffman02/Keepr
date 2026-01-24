# Incident Response Plan Template

**[Campground Name]**
**Effective Date:** [Date]
**Last Updated:** [Date]
**Plan Owner:** [Name/Title]

---

## 1. Purpose

This plan establishes procedures for responding to security incidents including data breaches, cyberattacks, physical security breaches, and other events that may compromise guest data or business operations.

## 2. Incident Response Team

### 2.1 Team Roles

| Role                | Name | Phone | Email | Backup |
| ------------------- | ---- | ----- | ----- | ------ |
| Incident Commander  |      |       |       |        |
| IT/Technical Lead   |      |       |       |        |
| Communications Lead |      |       |       |        |
| Legal Contact       |      |       |       |        |
| Insurance Contact   |      |       |       |        |

### 2.2 External Contacts

| Resource                     | Contact Info          | Account # |
| ---------------------------- | --------------------- | --------- |
| Local Police (non-emergency) |                       |           |
| Cyber Insurance Provider     |                       |           |
| IT Support/MSP               |                       |           |
| Legal Counsel                |                       |           |
| PR/Communications Firm       |                       |           |
| Campreserv Support           | support@keeprstay.com |           |

---

## 3. Incident Categories

### 3.1 Severity Levels

| Level        | Description                           | Examples                                               | Response Time   |
| ------------ | ------------------------------------- | ------------------------------------------------------ | --------------- |
| **Critical** | Active breach, immediate guest impact | Ransomware, active intrusion, stolen devices with data | Immediate       |
| **High**     | Potential breach, significant risk    | Suspicious activity, malware detected, lost laptop     | Within 1 hour   |
| **Medium**   | Limited impact, contained risk        | Phishing attempt, policy violation                     | Within 4 hours  |
| **Low**      | Minor issue, minimal risk             | Failed login attempts, spam                            | Within 24 hours |

### 3.2 Incident Types

- [ ] Data breach (guest information exposed)
- [ ] Ransomware/malware attack
- [ ] Unauthorized system access
- [ ] Lost or stolen devices
- [ ] Physical break-in
- [ ] Insider threat
- [ ] Payment card fraud
- [ ] Vendor/third-party breach
- [ ] Phishing attack success
- [ ] Website defacement
- [ ] DDoS attack

---

## 4. Incident Response Phases

### Phase 1: Detection & Identification

**Immediate Actions (First 15 minutes):**

| Step | Action                                               | Responsible        | Completed |
| ---- | ---------------------------------------------------- | ------------------ | --------- |
| 1    | Document how incident was discovered                 | First responder    | [ ]       |
| 2    | Note exact time of discovery                         | First responder    | [ ]       |
| 3    | Do NOT turn off affected systems (preserve evidence) | First responder    | [ ]       |
| 4    | Contact Incident Commander                           | First responder    | [ ]       |
| 5    | Begin Incident Log (see Section 6)                   | Incident Commander | [ ]       |

**Key Questions to Answer:**

- What type of incident is this?
- What systems/data are affected?
- Is the incident ongoing or contained?
- How many guests may be affected?
- What is the potential business impact?

### Phase 2: Containment

**Short-term Containment (First Hour):**

| Action                                   | Notes                   |
| ---------------------------------------- | ----------------------- |
| Disconnect affected systems from network | Do not power off        |
| Change compromised passwords             | All affected accounts   |
| Block suspicious IP addresses            | Document all blocks     |
| Disable compromised user accounts        | Document which accounts |
| Preserve evidence                        | Do not delete logs      |

**Long-term Containment:**

| Action                       | Notes                   |
| ---------------------------- | ----------------------- |
| Implement temporary fixes    | Document all changes    |
| Increase monitoring          | Focus on affected areas |
| Prepare clean backup systems | Verify backup integrity |

### Phase 3: Eradication

| Step | Action                             | Completed |
| ---- | ---------------------------------- | --------- |
| 1    | Identify root cause                | [ ]       |
| 2    | Remove malware/unauthorized access | [ ]       |
| 3    | Close exploited vulnerabilities    | [ ]       |
| 4    | Update all passwords               | [ ]       |
| 5    | Patch affected systems             | [ ]       |
| 6    | Verify removal of threat           | [ ]       |

### Phase 4: Recovery

| Step | Action                             | Completed |
| ---- | ---------------------------------- | --------- |
| 1    | Restore systems from clean backups | [ ]       |
| 2    | Verify system integrity            | [ ]       |
| 3    | Monitor for re-infection           | [ ]       |
| 4    | Return to normal operations        | [ ]       |
| 5    | Document recovery steps            | [ ]       |

### Phase 5: Post-Incident

| Step | Action                                     | Timeline         |
| ---- | ------------------------------------------ | ---------------- |
| 1    | Conduct post-incident review               | Within 1 week    |
| 2    | Update this plan based on lessons learned  | Within 2 weeks   |
| 3    | Provide additional training if needed      | Within 1 month   |
| 4    | Report to insurance/regulators if required | Per requirements |
| 5    | Archive incident documentation             | Retain 7 years   |

---

## 5. Communication Procedures

### 5.1 Internal Communication

| Audience      | When to Notify                | Method              | Who Notifies       |
| ------------- | ----------------------------- | ------------------- | ------------------ |
| All staff     | After initial containment     | Staff meeting/email | Incident Commander |
| Ownership     | Immediately for Critical/High | Phone call          | Incident Commander |
| Legal counsel | If breach involves guest data | Phone call          | Incident Commander |

### 5.2 External Communication

| Audience               | When to Notify                   | Legal Requirement                  |
| ---------------------- | -------------------------------- | ---------------------------------- |
| Affected guests        | Within timeframe required by law | See state breach notification laws |
| State Attorney General | If threshold met                 | Varies by state                    |
| Credit bureaus         | If SSN exposed                   | Federal law                        |
| Law enforcement        | If criminal activity             | Recommended                        |
| Media                  | Only if necessary                | Through designated spokesperson    |

**Spokesperson:** Only [Name/Title] is authorized to speak to media.

---

## 6. Incident Log Template

**Incident #:** ******\_****** **Date/Time Opened:** ******\_******

| Time | Action Taken | By Whom | Notes |
| ---- | ------------ | ------- | ----- |
|      |              |         |       |
|      |              |         |       |
|      |              |         |       |
|      |              |         |       |
|      |              |         |       |

---

## 7. Breach Notification Requirements

### 7.1 State Requirements

Research and document requirements for your state:

| State        | Notification Deadline | AG Notification Required | Threshold |
| ------------ | --------------------- | ------------------------ | --------- |
| [Your State] |                       |                          |           |

### 7.2 Notification Checklist

| Task                               | Completed | Date |
| ---------------------------------- | --------- | ---- |
| Determine if notification required | [ ]       |      |
| Draft notification letter          | [ ]       |      |
| Legal review of notification       | [ ]       |      |
| Send notifications                 | [ ]       |      |
| Document proof of notification     | [ ]       |      |
| Notify state AG (if required)      | [ ]       |      |

---

## 8. Resources

### 8.1 Quick Reference

- **FBI Internet Crime Complaint Center:** ic3.gov
- **CISA (Cybersecurity):** cisa.gov/report
- **FTC Identity Theft:** identitytheft.gov
- **State AG Office:** [Your state contact]

### 8.2 Insurance Information

| Coverage Type         | Provider | Policy # | Phone |
| --------------------- | -------- | -------- | ----- |
| Cyber liability       |          |          |       |
| General liability     |          |          |       |
| Business interruption |          |          |       |

---

## 9. Testing & Training

| Activity                  | Frequency                | Last Completed | Next Due |
| ------------------------- | ------------------------ | -------------- | -------- |
| Plan review               | Annually                 |                |          |
| Tabletop exercise         | Annually                 |                |          |
| Staff training            | Upon hire, then annually |                |          |
| Contact list verification | Quarterly                |                |          |

---

## 10. Document Control

| Version | Date | Changes         | Approved By |
| ------- | ---- | --------------- | ----------- |
| 1.0     |      | Initial version |             |
|         |      |                 |             |

---

**Plan Approved By:** ************\_************ **Date:** ******\_******

---

_This template is provided by Campreserv for guidance purposes. Consult with legal counsel and cybersecurity professionals to customize for your specific needs._
