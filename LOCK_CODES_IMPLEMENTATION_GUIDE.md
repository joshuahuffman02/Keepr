# Lock Codes Feature - Backend Implementation Guide

## Overview
The frontend lock codes page has been secured and now requires backend API implementation. This guide provides step-by-step instructions for implementing the secure backend.

---

## Database Schema

### Table: `lock_codes`

```sql
CREATE TABLE lock_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campground_id UUID NOT NULL REFERENCES campgrounds(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  code_encrypted TEXT NOT NULL,  -- AES-256 encrypted
  code_iv TEXT NOT NULL,          -- Initialization vector for encryption
  type VARCHAR(50) NOT NULL CHECK (type IN ('gate', 'cabin', 'amenity', 'wifi', 'master')),
  applies_to JSONB DEFAULT '[]',
  rotation_schedule VARCHAR(50) NOT NULL DEFAULT 'none' 
    CHECK (rotation_schedule IN ('none', 'daily', 'weekly', 'monthly', 'per-guest')),
  show_on_confirmation BOOLEAN DEFAULT true,
  show_at_checkin BOOLEAN DEFAULT true,
  is_active BOOLEAN DEFAULT true,
  last_rotated TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_by UUID REFERENCES users(id),
  
  INDEX idx_lock_codes_campground (campground_id),
  INDEX idx_lock_codes_type (type),
  INDEX idx_lock_codes_active (is_active)
);

-- Audit table for tracking all access and modifications
CREATE TABLE lock_codes_audit (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lock_code_id UUID REFERENCES lock_codes(id) ON DELETE CASCADE,
  campground_id UUID NOT NULL,
  action VARCHAR(50) NOT NULL, -- 'created', 'updated', 'deleted', 'viewed', 'rotated'
  user_id UUID REFERENCES users(id),
  user_ip VARCHAR(45),
  user_agent TEXT,
  old_values JSONB,
  new_values JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

---

## API Endpoints

### 1. GET /api/campgrounds/:campgroundId/lock-codes

**Description**: Fetch all lock codes for a campground

**Authentication**: Required (JWT)

**Authorization**: User must have access to the campground

**Response**:
```json
[
  {
    "id": "uuid",
    "name": "Main Gate",
    "code": "1234",
    "type": "gate",
    "appliesTo": ["All Sites"],
    "rotationSchedule": "monthly",
    "showOnConfirmation": true,
    "showAtCheckin": true,
    "isActive": true,
    "lastRotated": "2025-12-01T00:00:00Z"
  }
]
```

**Implementation Notes**:
- Decrypt codes before sending to client
- Log access in audit table
- Filter by user permissions (staff may not see master codes)
- Use HTTPS only

---

### 2. POST /api/campgrounds/:campgroundId/lock-codes

**Description**: Create a new lock code

**Authentication**: Required (JWT)

**Authorization**: User must have 'manage_access' permission

**Request Body**:
```json
{
  "name": "Pool Gate",
  "code": "5678",
  "type": "amenity",
  "appliesTo": ["Pool"],
  "rotationSchedule": "weekly",
  "showOnConfirmation": false,
  "showAtCheckin": true,
  "isActive": true
}
```

**Validation**:
- `name`: Required, 1-255 characters
- `code`: Required, 1-100 characters
- `type`: Required, must be one of enum values
- `rotationSchedule`: Required, must be one of enum values
- Sanitize all inputs to prevent XSS

**Implementation Notes**:
- Encrypt code before storing
- Generate unique IV for encryption
- Validate user has permission
- Log in audit table
- Return decrypted code in response

---

### 3. PATCH /api/campgrounds/:campgroundId/lock-codes/:id

**Description**: Update an existing lock code

**Authentication**: Required (JWT)

**Authorization**: User must have 'manage_access' permission

**Request Body**: (all fields optional)
```json
{
  "name": "Updated Name",
  "code": "9999",
  "isActive": false
}
```

**Implementation Notes**:
- Log old and new values in audit table
- Re-encrypt if code is changed
- Validate all inputs
- Return updated record

---

### 4. DELETE /api/campgrounds/:campgroundId/lock-codes/:id

**Description**: Delete a lock code

**Authentication**: Required (JWT)

**Authorization**: User must have 'manage_access' permission

**Implementation Notes**:
- Soft delete preferred (set is_active = false)
- Log in audit table
- Consider cascade implications
- Notify if code was in use

---

### 5. POST /api/campgrounds/:campgroundId/lock-codes/:id/rotate

**Description**: Generate a new code and update

**Authentication**: Required (JWT)

**Authorization**: User must have 'manage_access' permission

**Response**:
```json
{
  "id": "uuid",
  "name": "Main Gate",
  "code": "3456",  // New code
  "lastRotated": "2025-12-26T15:30:00Z"
}
```

**Implementation Notes**:
- Generate cryptographically secure random code
- Update last_rotated timestamp
- Log old and new codes in audit
- Optionally notify users of change

---

## Security Implementation

### 1. Encryption at Rest

**Recommended**: Use AES-256-GCM encryption

```typescript
// Example using Node.js crypto
import crypto from 'crypto';

const ENCRYPTION_KEY = process.env.LOCK_CODES_ENCRYPTION_KEY; // 32 bytes

function encryptCode(code: string): { encrypted: string, iv: string } {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv('aes-256-gcm', Buffer.from(ENCRYPTION_KEY, 'hex'), iv);
  
  let encrypted = cipher.update(code, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  
  const authTag = cipher.getAuthTag().toString('hex');
  
  return {
    encrypted: encrypted + authTag,
    iv: iv.toString('hex')
  };
}

function decryptCode(encrypted: string, iv: string): string {
  const authTag = Buffer.from(encrypted.slice(-32), 'hex');
  const encryptedText = encrypted.slice(0, -32);
  
  const decipher = crypto.createDecipheriv(
    'aes-256-gcm',
    Buffer.from(ENCRYPTION_KEY, 'hex'),
    Buffer.from(iv, 'hex')
  );
  
  decipher.setAuthTag(authTag);
  
  let decrypted = decipher.update(encryptedText, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  
  return decrypted;
}
```

### 2. Environment Variables

Add to `.env`:
```bash
# Generate with: openssl rand -hex 32
LOCK_CODES_ENCRYPTION_KEY=your-64-character-hex-key-here

# Never commit this key to version control!
```

### 3. Role-Based Access Control

```typescript
const permissions = {
  'admin': ['view', 'create', 'update', 'delete', 'rotate'],
  'manager': ['view', 'create', 'update', 'rotate'],
  'staff': ['view'],
  'guest': [] // No access
};

function checkPermission(user: User, action: string): boolean {
  const userPermissions = permissions[user.role] || [];
  return userPermissions.includes(action);
}
```

### 4. Rate Limiting

```typescript
// Example using express-rate-limit
import rateLimit from 'express-rate-limit';

const lockCodesLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again later.'
});

app.use('/api/campgrounds/:campgroundId/lock-codes', lockCodesLimiter);
```

### 5. Input Validation

```typescript
import { z } from 'zod';

const CreateLockCodeSchema = z.object({
  name: z.string().min(1).max(255).trim(),
  code: z.string().min(1).max(100).trim(),
  type: z.enum(['gate', 'cabin', 'amenity', 'wifi', 'master']),
  appliesTo: z.array(z.string()).default([]),
  rotationSchedule: z.enum(['none', 'daily', 'weekly', 'monthly', 'per-guest']),
  showOnConfirmation: z.boolean().default(true),
  showAtCheckin: z.boolean().default(true),
  isActive: z.boolean().default(true),
});

// In route handler:
const validated = CreateLockCodeSchema.parse(req.body);
```

### 6. Audit Logging

```typescript
async function logAudit(params: {
  lockCodeId?: string,
  campgroundId: string,
  action: string,
  userId: string,
  userIp: string,
  userAgent: string,
  oldValues?: any,
  newValues?: any
}) {
  await db.lockCodesAudit.create({
    data: {
      lockCodeId: params.lockCodeId,
      campgroundId: params.campgroundId,
      action: params.action,
      userId: params.userId,
      userIp: params.userIp,
      userAgent: params.userAgent,
      oldValues: params.oldValues,
      newValues: params.newValues,
    }
  });
}

// Usage:
await logAudit({
  lockCodeId: lockCode.id,
  campgroundId: campgroundId,
  action: 'viewed',
  userId: req.user.id,
  userIp: req.ip,
  userAgent: req.headers['user-agent'],
});
```

---

## Testing Checklist

- [ ] Unit tests for encryption/decryption
- [ ] API endpoint tests (create, read, update, delete)
- [ ] Authentication tests (unauthorized access blocked)
- [ ] Authorization tests (role-based access)
- [ ] Input validation tests (SQL injection, XSS)
- [ ] Rate limiting tests
- [ ] Audit logging tests
- [ ] Integration tests with frontend
- [ ] Performance tests (encryption overhead)
- [ ] Security penetration testing

---

## Deployment Checklist

- [ ] Environment variables configured
- [ ] Encryption key generated and secured
- [ ] Database migrations run
- [ ] HTTPS enforced
- [ ] Rate limiting configured
- [ ] Monitoring and alerting set up
- [ ] Backup and recovery tested
- [ ] Documentation updated
- [ ] Security review completed
- [ ] Compliance review (if required)

---

## Monitoring and Alerting

**Key Metrics to Monitor**:
- Number of lock code accesses per day
- Failed authentication attempts
- Unusual access patterns (e.g., mass downloads)
- Audit log anomalies
- API response times
- Error rates

**Alerts to Configure**:
- Alert on >10 failed auth attempts from same IP
- Alert on access from unusual locations
- Alert on bulk operations (>50 codes at once)
- Alert on master code access
- Alert on encryption/decryption failures

---

## Compliance Notes

**PCI DSS**: If handling payment card data, ensure lock codes storage meets PCI requirements

**SOC 2**: Implement access controls, audit logging, and encryption as required

**GDPR/Privacy**: Lock codes may be considered personal data if associated with guests

**Industry Standards**:
- NIST SP 800-53 (Security Controls)
- OWASP Top 10 (Web Application Security)
- CIS Controls (Cybersecurity Best Practices)

---

## Support and Maintenance

**Regular Tasks**:
- Review audit logs weekly
- Rotate encryption keys annually
- Update dependencies monthly
- Review access permissions quarterly
- Test backup restoration quarterly
- Security assessment annually

**Incident Response**:
1. Detect: Monitor alerts and logs
2. Contain: Disable affected codes immediately
3. Eradicate: Fix vulnerability
4. Recover: Rotate all affected codes
5. Lessons Learned: Update procedures

---

## Questions?

For technical support or security concerns, contact:
- Security Team: security@example.com
- DevOps Team: devops@example.com

**Emergency**: If you suspect a security breach, immediately contact the security team and follow the incident response plan.

