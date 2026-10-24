import { esClient, EMAIL_INDEX } from '../config/elasticsearch';
import prisma from '../config/db';

export interface EmailDocument {
  id: string;
  userId: string;
  senderEmail: string;
  recipientEmail: string;
  subject: string;
  body: string;
  status: string;
  scheduledAt: string | Date;
  sentAt?: string | Date | null;
  etherealPreviewUrl?: string | null;
  createdAt: string | Date;
}

export interface SearchEmailsParams {
  userId: string;
  query?: string;
  status?: string;
  page?: number;
  limit?: number;
}

export class ElasticsearchService {
  /**
   * Indexes a new or updated email document into Elasticsearch.
   */
  public static async indexEmail(doc: EmailDocument): Promise<void> {
    try {
      await esClient.index({
        index: EMAIL_INDEX,
        id: doc.id,
        document: {
          id: doc.id,
          userId: doc.userId,
          senderEmail: doc.senderEmail,
          recipientEmail: doc.recipientEmail,
          subject: doc.subject,
          body: doc.body,
          status: doc.status,
          scheduledAt: new Date(doc.scheduledAt).toISOString(),
          sentAt: doc.sentAt ? new Date(doc.sentAt).toISOString() : null,
          etherealPreviewUrl: doc.etherealPreviewUrl || null,
          createdAt: new Date(doc.createdAt).toISOString(),
        },
      });
    } catch (error: any) {
      console.warn(`[Elasticsearch] Indexing failed for email ${doc.id}: ${error.message}`);
    }
  }

  /**
   * Updates fields of an indexed email document (e.g., status, sentAt, previewUrl).
   */
  public static async updateEmailDoc(id: string, updates: Partial<EmailDocument>): Promise<void> {
    try {
      const docUpdates: any = { ...updates };
      if (updates.scheduledAt) docUpdates.scheduledAt = new Date(updates.scheduledAt).toISOString();
      if (updates.sentAt) docUpdates.sentAt = new Date(updates.sentAt).toISOString();

      await esClient.update({
        index: EMAIL_INDEX,
        id,
        doc: docUpdates,
        doc_as_upsert: true,
      });
    } catch (error: any) {
      console.warn(`[Elasticsearch] Doc update failed for email ${id}: ${error.message}`);
    }
  }

  /**
   * Performs full-text search across indexed emails.
   * Falls back to PostgreSQL if Elasticsearch cluster is unavailable.
   */
  public static async searchEmails(params: SearchEmailsParams): Promise<{ items: any[]; total: number }> {
    const { userId, query, status, page = 1, limit = 20 } = params;
    const from = (page - 1) * limit;

    try {
      const mustClauses: any[] = [{ term: { userId } }];

      if (status && status !== 'ALL') {
        mustClauses.push({ term: { status } });
      }

      if (query && query.trim().length > 0) {
        mustClauses.push({
          multi_match: {
            query: query.trim(),
            fields: ['recipientEmail^3', 'subject^2', 'body', 'senderEmail'],
            fuzziness: 'AUTO',
          },
        });
      }

      const response = await esClient.search({
        index: EMAIL_INDEX,
        from,
        size: limit,
        query: {
          bool: {
            must: mustClauses,
          },
        },
        sort: [{ scheduledAt: { order: 'desc' } }],
      });

      const total = typeof response.hits.total === 'number' 
        ? response.hits.total 
        : (response.hits.total?.value || 0);

      const items = response.hits.hits.map((hit: any) => hit._source);

      return { items, total };
    } catch (err: any) {
      console.warn(`[Elasticsearch] Search query failed (${err.message}). Using database fallback.`);

      // Database fallback
      const whereClause: any = { userId };
      if (status && status !== 'ALL') {
        whereClause.status = status;
      }
      if (query && query.trim().length > 0) {
        whereClause.OR = [
          { recipientEmail: { contains: query, mode: 'insensitive' } },
          { subject: { contains: query, mode: 'insensitive' } },
          { body: { contains: query, mode: 'insensitive' } },
          { senderEmail: { contains: query, mode: 'insensitive' } },
        ];
      }

      const [items, total] = await Promise.all([
        prisma.emailJob.findMany({
          where: whereClause,
          skip: from,
          take: limit,
          orderBy: { scheduledAt: 'desc' },
        }),
        prisma.emailJob.count({ where: whereClause }),
      ]);

      return { items, total };
    }
  }
}

export default ElasticsearchService;
