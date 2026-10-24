export function extractValidEmails(content: string): string[] {
  // Regex to extract all valid email patterns
  const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
  const matches = content.match(emailRegex) || [];

  // Normalize, deduplicate and trim
  const uniqueEmails = Array.from(
    new Set(matches.map((e) => e.trim().toLowerCase()))
  );

  return uniqueEmails;
}

export default extractValidEmails;
