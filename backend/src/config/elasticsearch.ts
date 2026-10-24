import { Client } from '@elastic/elasticsearch';

const esNode = process.env.ELASTICSEARCH_NODE || 'http://localhost:9200';

export const esClient = new Client({
  node: esNode,
  // Single node local dev without TLS verification
  tls: { rejectUnauthorized: false },
});

export const EMAIL_INDEX = 'emails';

export async function initElasticsearch(): Promise<boolean> {
  try {
    const isAlive = await esClient.ping();
    if (!isAlive) {
      console.warn('[Elasticsearch] Ping failed, search may be running in fallback mode.');
      return false;
    }

    const indexExists = await esClient.indices.exists({ index: EMAIL_INDEX });
    if (!indexExists) {
      await esClient.indices.create({
        index: EMAIL_INDEX,
        body: {
          mappings: {
            properties: {
              id: { type: 'keyword' },
              userId: { type: 'keyword' },
              senderEmail: { type: 'keyword' },
              recipientEmail: { type: 'text', fields: { keyword: { type: 'keyword' } } },
              subject: { type: 'text' },
              body: { type: 'text' },
              status: { type: 'keyword' },
              scheduledAt: { type: 'date' },
              sentAt: { type: 'date' },
              etherealPreviewUrl: { type: 'keyword' },
              createdAt: { type: 'date' },
            },
          },
        },
      });
      console.log(`[Elasticsearch] Created index: ${EMAIL_INDEX}`);
    } else {
      console.log(`[Elasticsearch] Index verified: ${EMAIL_INDEX}`);
    }
    return true;
  } catch (error: any) {
    console.warn(`[Elasticsearch] Warning: Could not initialize index (${error.message}). DB fallback will be used.`);
    return false;
  }
}

export default esClient;
