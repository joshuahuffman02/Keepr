# 🤖 OpenAI Integration & AI-Powered Features

**Status:** ✅ **FULLY IMPLEMENTED - Semantic Search Live!**
**Completion Date:** January 2025
**Coverage:** 5,176 campgrounds with embeddings (100%)

---

## ✅ Phase 1-3: COMPLETED

### What's Already Working

#### 1. **pgvector Setup** ✅

- PostgreSQL vector extension enabled in Supabase
- Embedding column added directly to Campground model
- 1536-dimension vectors (OpenAI text-embedding-3-small)

#### 2. **Backend Implementation** ✅

- **OpenAI Service** (`src/openai/openai.service.ts`)
  - Embedding generation
  - Batch processing (100 items at once)
  - Error handling with retries

- **Semantic Search Service** (`src/semantic-search/semantic-search.service.ts`)
  - `generateCampgroundEmbedding()` - Single campground
  - `generateAllCampgroundEmbeddings()` - Batch processing
  - `searchCampgrounds()` - Cosine similarity search
  - `getEmbeddingStats()` - Coverage tracking

- **API Endpoints** (`src/semantic-search/semantic-search.controller.ts`)
  - `POST /api/semantic-search/campgrounds/:id/embedding` - Generate single
  - `POST /api/semantic-search/campgrounds/embeddings/generate-all` - Batch generate
  - `POST /api/semantic-search/search` - Semantic search
  - `GET /api/semantic-search/stats` - Embedding coverage

#### 3. **Frontend Implementation** ✅

- **Search Page** (`/app/(public)/search/page.tsx`)
  - Dedicated semantic search results page
  - AI branding with Sparkles icon

- **Search Component** (`SemanticSearchResults.tsx`)
  - Real-time semantic search
  - Loading states
  - Similarity score display (% match)

- **Main Search Form** (`CampingSearchForm.tsx`)
  - Routes to `/search?q=query`
  - Natural language placeholders
  - AI-powered badge

#### 4. **Current Status** ✅

- **5,176 campgrounds** have embeddings (100% coverage)
- Semantic search fully functional
- Working queries:
  - "RV camping near lakes with full hookups" → 61% match
  - "primitive tent camping in mountains" → 52% match
  - "family friendly campground with playground" → 47% match

#### 5. **Key Files** 📁

**Backend:**

- `platform/apps/api/src/openai/openai.service.ts` - OpenAI integration
- `platform/apps/api/src/semantic-search/semantic-search.service.ts` - Search logic
- `platform/apps/api/src/semantic-search/semantic-search.controller.ts` - API endpoints
- `platform/apps/api/src/semantic-search/semantic-search.module.ts` - Module config
- `platform/apps/api/prisma/schema.prisma` - Campground.embedding field

**Frontend:**

- `platform/apps/web/app/(public)/search/page.tsx` - Search results page
- `platform/apps/web/app/(public)/search/SemanticSearchResults.tsx` - Search component
- `platform/apps/web/app/(public)/camping/CampingSearchForm.tsx` - Main search form
- `platform/apps/web/lib/api-client.ts` - API client with `searchCampgroundsSemantic()`

---

## 📋 Phase 4: Optional Advanced Features (Not Yet Implemented)

These are **optional enhancements** you can add when needed:

---

## 📚 Implementation Reference

**Note:** The following sections document how semantic search was implemented. Keep as reference for:

- Understanding the architecture
- Adding new AI features
- Onboarding new developers

---

## How Semantic Search Was Built

### 1. Enable pgvector in Railway

**Via Railway Dashboard:**

1. Go to your PostgreSQL service
2. Settings → Extensions
3. Enable "pgvector"

**Or via SQL:**

```sql
CREATE EXTENSION IF NOT EXISTS vector;
```

### 2. Add to Prisma Schema

Add this to `platform/apps/api/prisma/schema.prisma`:

```prisma
model CampgroundEmbedding {
  id            String   @id @default(cuid())
  campgroundId  String
  campground    Campground @relation(fields: [campgroundId], references: [id])

  // Vector embedding (1536 dimensions for OpenAI text-embedding-3-small)
  embedding     Unsupported("vector(1536)")

  // Text that was embedded
  content       String

  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt

  @@map("campground_embeddings")
}
```

### 3. Generate Migration

```bash
cd platform/apps/api
npx prisma migrate dev --name add_vector_embeddings
```

### 4. Create Embeddings Service

Create `platform/apps/api/src/embeddings/embeddings.service.ts`:

```typescript
import { Injectable } from "@nestjs/common";
import OpenAI from "openai";
import { PrismaService } from "../prisma/prisma.service";

@Injectable()
export class EmbeddingsService {
  private openai: OpenAI;

  constructor(private prisma: PrismaService) {
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
  }

  // Generate embedding for text
  async generateEmbedding(text: string): Promise<number[]> {
    const response = await this.openai.embeddings.create({
      model: "text-embedding-3-small", // $0.02 per 1M tokens
      input: text,
    });
    return response.data[0].embedding;
  }

  // Store campground embedding
  async embedCampground(campgroundId: string) {
    const campground = await this.prisma.campground.findUnique({
      where: { id: campgroundId },
      include: { sites: true, amenities: true },
    });

    // Create searchable text
    const content = `
      ${campground.name}
      ${campground.description}
      ${campground.amenities.map((a) => a.name).join(", ")}
      ${campground.location}
    `.trim();

    // Generate embedding
    const embedding = await this.generateEmbedding(content);

    // Store in database
    await this.prisma.$executeRaw`
      INSERT INTO campground_embeddings (id, campground_id, embedding, content)
      VALUES (
        gen_random_uuid(),
        ${campgroundId},
        ${JSON.stringify(embedding)}::vector,
        ${content}
      )
      ON CONFLICT (campground_id)
      DO UPDATE SET embedding = EXCLUDED.embedding, content = EXCLUDED.content
    `;
  }

  // Semantic search
  async searchCampgrounds(query: string, limit: number = 10) {
    // Generate query embedding
    const queryEmbedding = await this.generateEmbedding(query);

    // Search for similar campgrounds
    const results = await this.prisma.$queryRaw`
      SELECT
        c.id,
        c.name,
        c.description,
        ce.content,
        1 - (ce.embedding <=> ${JSON.stringify(queryEmbedding)}::vector) as similarity
      FROM campground_embeddings ce
      JOIN campgrounds c ON c.id = ce.campground_id
      WHERE c.is_active = true
      ORDER BY ce.embedding <=> ${JSON.stringify(queryEmbedding)}::vector
      LIMIT ${limit}
    `;

    return results;
  }
}
```

### 5. Use Semantic Search

```typescript
// In your search controller
@Get('search')
async search(@Query('q') query: string) {
  return this.embeddingsService.searchCampgrounds(query);
}
```

**Example queries that now work:**

- "campground near water with WiFi" ✅
- "quiet spot for families" ✅
- "pet-friendly with full hookups" ✅

---

## 💡 AI-Powered Features You Can Build

### 1. **Smart Search** (Implemented above)

- Semantic search instead of keyword matching
- Understands user intent
- "quiet family campground" finds right results

### 2. **Personalized Recommendations**

```typescript
async getRecommendations(userId: string) {
  // Get user's past reservations
  const history = await this.getUserReservationHistory(userId);

  // Create user preference profile
  const preferences = `
    User prefers: ${history.map(r => r.campground.name).join(', ')}
    Amenities used: ${history.map(r => r.amenities).flat().join(', ')}
  `;

  // Find similar campgrounds
  return this.searchCampgrounds(preferences);
}
```

### 3. **AI Chat Support**

```typescript
async chatSupport(message: string, conversationHistory: Message[]) {
  // RAG: Retrieve relevant campground info
  const context = await this.searchCampgrounds(message, 3);

  // Generate response with context
  const response = await this.openai.chat.completions.create({
    model: 'gpt-4',
    messages: [
      {
        role: 'system',
        content: `You are a helpful campground assistant.
        Here's relevant campground info: ${JSON.stringify(context)}`,
      },
      ...conversationHistory,
      { role: 'user', content: message },
    ],
  });

  return response.choices[0].message.content;
}
```

### 4. **Auto-Generated Descriptions**

```typescript
async generateCampgroundDescription(campgroundId: string) {
  const campground = await this.prisma.campground.findUnique({
    where: { id: campgroundId },
    include: { amenities: true, reviews: true },
  });

  const response = await this.openai.chat.completions.create({
    model: 'gpt-4',
    messages: [{
      role: 'user',
      content: `Write a compelling campground description for:
      Name: ${campground.name}
      Amenities: ${campground.amenities.map(a => a.name).join(', ')}
      Reviews: ${campground.reviews.slice(0, 5).map(r => r.text).join('. ')}

      Make it 2-3 paragraphs, highlight unique features.`,
    }],
  });

  return response.choices[0].message.content;
}
```

### 5. **Smart Pricing Suggestions**

```typescript
async suggestPricing(campgroundId: string, date: Date) {
  // Get historical data
  const historicalData = await this.getHistoricalOccupancy(campgroundId);

  // Get competitor pricing
  const competitors = await this.searchCampgrounds(
    `similar to ${campground.name}`,
    5
  );

  const response = await this.openai.chat.completions.create({
    model: 'gpt-4',
    messages: [{
      role: 'user',
      content: `Suggest pricing for:
      Campground: ${campground.name}
      Date: ${date}
      Historical occupancy: ${JSON.stringify(historicalData)}
      Competitor prices: ${JSON.stringify(competitors)}

      Respond with: { suggested_price_cents: number, reasoning: string }`,
    }],
  });

  return JSON.parse(response.choices[0].message.content);
}
```

---

## 💰 OpenAI API Costs

| Model                  | Cost               | Use Case                 |
| ---------------------- | ------------------ | ------------------------ |
| text-embedding-3-small | $0.02 / 1M tokens  | Embeddings (recommended) |
| text-embedding-3-large | $0.13 / 1M tokens  | Higher quality           |
| gpt-4-turbo            | $0.01 / 1K tokens  | Chat, descriptions       |
| gpt-4                  | $0.03 / 1K tokens  | Complex reasoning        |
| gpt-3.5-turbo          | $0.001 / 1K tokens | Simple tasks             |

**Cost estimate for 1000 campgrounds:**

- Generate embeddings: ~$0.10 (one-time)
- 1000 searches/day: ~$1/month
- Total: **~$2-5/month** for AI features

---

## 🚀 Implementation Roadmap

### Phase 1: Add pgvector (Now - 15 min)

- [ ] Enable pgvector extension
- [ ] Add Prisma schema
- [ ] Run migration

### Phase 2: Basic Embeddings (1 hour)

- [ ] Create embeddings service
- [ ] Embed all campgrounds
- [ ] Add cron job to embed new campgrounds

### Phase 3: Semantic Search (2 hours)

- [ ] Implement search endpoint
- [ ] Update frontend search UI
- [ ] Test with real queries

### Phase 4: Advanced Features (Optional)

- [ ] Personalized recommendations
- [ ] AI chat support
- [ ] Auto-generated descriptions
- [ ] Smart pricing

---

## 📊 Monitoring AI Features

**Track these metrics in Sentry:**

```typescript
// Track OpenAI API calls
Sentry.addBreadcrumb({
  message: "OpenAI API call",
  data: {
    model: "text-embedding-3-small",
    tokens: response.usage.total_tokens,
    cost: calculateCost(response.usage),
  },
});

// Track search quality
Sentry.addBreadcrumb({
  message: "Semantic search",
  data: {
    query: query,
    results: results.length,
    avgSimilarity: avgSimilarity,
  },
});
```

**Cost tracking:**

```typescript
// Track monthly OpenAI spend
const costPerToken = 0.00000002; // $0.02 per 1M tokens
const monthlyCost = totalTokensUsed * costPerToken;

if (monthlyCost > 100) {
  // Alert if spending too much
  Sentry.captureMessage("High OpenAI API costs", {
    level: "warning",
    extra: { monthlyCost },
  });
}
```

---

## 🔐 Security Best Practices

**1. Never expose API key to frontend:**

```typescript
// ❌ WRONG
const openai = new OpenAI({ apiKey: process.env.NEXT_PUBLIC_OPENAI_KEY });

// ✅ RIGHT - only in backend
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
```

**2. Rate limit AI endpoints:**

```typescript
@UseGuards(ThrottlerGuard)
@Throttle({ default: { limit: 10, ttl: 60000 } }) // 10 requests per minute
@Get('search')
async search(@Query('q') query: string) {
  return this.embeddingsService.searchCampgrounds(query);
}
```

**3. Validate inputs:**

```typescript
const SearchSchema = z.object({
  query: z.string().min(1).max(500), // Max 500 chars
  limit: z.number().min(1).max(50), // Max 50 results
});

const { query, limit } = SearchSchema.parse(req.query);
```

---

## 🎓 Resources

**pgvector:**

- Docs: https://github.com/pgvector/pgvector
- Prisma + pgvector: https://www.prisma.io/docs/orm/prisma-schema/data-model/unsupported-types

**OpenAI:**

- Embeddings guide: https://platform.openai.com/docs/guides/embeddings
- API docs: https://platform.openai.com/docs/api-reference

**RAG (Retrieval Augmented Generation):**

- Guide: https://platform.openai.com/docs/guides/retrieval-augmented-generation
- Best practices: Ask Claude!

---

## 💡 Pro Tips

1. **Cache embeddings** - Don't regenerate for same text
2. **Batch embed** - Process multiple items at once
3. **Use smaller model** - text-embedding-3-small is 85% as good for 1/6 the price
4. **Monitor costs** - Set up budget alerts in OpenAI dashboard
5. **Test locally first** - Use small dataset to validate before scaling

---

## Summary

### Completed (Phase 1-3) ✅

- ✅ OpenAI integrated with API key
- ✅ pgvector enabled in Supabase PostgreSQL
- ✅ Semantic search fully implemented (backend + frontend)
- ✅ 5,176 campgrounds with embeddings (100% coverage)
- ✅ Natural language search working in production

### Optional Next Steps (Phase 4)

- 🔲 Personalized recommendations based on user history
- 🔲 AI chat support with RAG
- 🔲 Auto-generated campground descriptions
- 🔲 Smart pricing suggestions
- 🔲 Automated cron job for new campground embeddings

### Cost Monitoring 💰

- **Current usage:** ~$0.10 for 5,176 embeddings (one-time)
- **Ongoing:** ~$0.000002 per search query
- **Model:** text-embedding-3-small (most cost-effective)
- **Budget:** Monitor via OpenAI dashboard

**Your AI-powered semantic search is live and operational!** 🚀
