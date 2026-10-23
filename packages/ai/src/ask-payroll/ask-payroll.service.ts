import { z } from 'zod';
import { LLMProvider } from '../llm/types.js';
import {
  AskPayrollResponse,
  ParsedQuery,
  ParsedQuerySchema,
  PayrollQueryExecutor,
  SourceRowCitation,
  WhitelistedQueryName,
  WhitelistedQueryNameSchema,
} from './types.js';
import { checkPromptSecurity } from './security.js';
import { QUERY_DEFINITIONS } from './query-definitions.js';

export class AskPayrollService {
  constructor(
    private readonly llm: LLMProvider,
    private readonly executor: PayrollQueryExecutor,
  ) {}

  public async ask(companyId: string, question: string): Promise<AskPayrollResponse> {
    const trimmedQuestion = question.trim();

    // 1. Layer 1 Security Guard: Prompt Injection Inspection
    const securityCheck = checkPromptSecurity(trimmedQuestion);
    if (securityCheck.isSuspicious) {
      return {
        question: trimmedQuestion,
        answer: `I cannot fulfill this request. The query was flagged by PayPilot's security filter (${securityCheck.reason}).`,
        queryExecuted: 'ANOMALIES_SUMMARY',
        parameters: {},
        rowCount: 0,
        sourceCitations: [],
        isSecurityBlocked: true,
      };
    }

    // 2. Layer 2: Convert NL to Whitelisted Parameterized Query using LLM
    const parsedQuery = await this.parseNaturalLanguageIntent(trimmedQuestion);

    // 3. Layer 3: Enforce Query Whitelist and Schema Validation
    const definition = QUERY_DEFINITIONS[parsedQuery.queryName];
    if (!definition) {
      throw new Error(`Unauthorized query '${parsedQuery.queryName}' not present in whitelist.`);
    }

    const validatedParams = definition.schema.parse(parsedQuery.parameters);

    // 4. Layer 4: Execute Safe Parameterized Query
    const queryResult = await this.executor.execute(companyId, parsedQuery.queryName, validatedParams);

    // 5. Layer 5: Build Source Citations
    const citations: SourceRowCitation[] = queryResult.rows.slice(0, 10).map((row, idx) => ({
      id: row.id ?? `row-${idx + 1}`,
      entityType: queryResult.entityType,
      label: row.invoiceNumber ?? row.contractorName ?? row.name ?? row.summary ?? `Record #${idx + 1}`,
      keyValues: row,
    }));

    // 6. Layer 6: Synthesize Natural Language Summary with Source Row Citations
    const answer = await this.synthesizeSummary(trimmedQuestion, parsedQuery.queryName, queryResult.rows);

    return {
      question: trimmedQuestion,
      answer,
      queryExecuted: parsedQuery.queryName,
      parameters: validatedParams,
      rowCount: queryResult.totalCount,
      sourceCitations: citations,
      isSecurityBlocked: false,
    };
  }

  private async parseNaturalLanguageIntent(question: string): Promise<ParsedQuery> {
    // Fast heuristic match for deterministic testing or offline mode
    const lower = question.toLowerCase();

    // Check offline heuristics first if using MockLLMProvider
    if (this.llm.name === 'mock') {
      if (lower.includes('invoice') || lower.includes('unpaid') || lower.includes('bill')) {
        return { queryName: 'OPEN_INVOICES', parameters: { status: 'SUBMITTED' } };
      }
      if (lower.includes('spend') || lower.includes('total payroll') || lower.includes('cost')) {
        return { queryName: 'TOTAL_PAYROLL_SPEND', parameters: {} };
      }
      if (lower.includes('contractor') && (lower.includes('elena') || lower.includes('paid') || lower.includes('history'))) {
        return { queryName: 'CONTRACTOR_PAYOUT_HISTORY', parameters: { contractorName: 'Elena' } };
      }
      if (lower.includes('anomal') || lower.includes('flag') || lower.includes('risk') || lower.includes('suspicious')) {
        return { queryName: 'ANOMALIES_SUMMARY', parameters: { status: 'OPEN' } };
      }
      if (lower.includes('upcoming') || lower.includes('next run') || lower.includes('schedule')) {
        return { queryName: 'UPCOMING_PAYROLL_RUNS', parameters: {} };
      }
      // Country-specific contractor queries must be checked before generic contractor directory
      if (lower.includes('india') || lower.includes('portugal') || lower.includes('ireland') || lower.includes('country')) {
        const country =
          lower.includes('india') ? 'IN' :
          lower.includes('portugal') ? 'PT' :
          lower.includes('ireland') ? 'IE' : undefined;
        return { queryName: 'CONTRACTOR_DIRECTORY', parameters: country ? { country } : {} };
      }
      if (lower.includes('contractor') || lower.includes('directory') || lower.includes('team') || lower.includes('who')) {
        return { queryName: 'CONTRACTOR_DIRECTORY', parameters: {} };
      }
    }

    const availableQueriesList = Object.entries(QUERY_DEFINITIONS)
      .map(([name, def]) => `- ${name}: ${def.description}`)
      .join('\n');

    const systemPrompt = `
You are PayPilot's natural language to query translator.
Translate the user's payroll question into exactly ONE of the following whitelisted queries:
${availableQueriesList}

CRITICAL RULES:
1. NEVER output raw SQL, shell commands, or arbitrary statements.
2. You must select one queryName from: ${WhitelistedQueryNameSchema.options.join(', ')}.
3. Extract relevant parameters (names, dates, statuses, currencies).
4. Output RFC 8259 JSON matching schema: {"queryName": "...", "parameters": {...}}
`.trim();

    try {
      const result = await this.llm.generateStructured({
        prompt: `User Question: "${question}"`,
        systemPrompt,
        schema: ParsedQuerySchema,
        schemaName: 'ParsedQuery',
        temperature: 0.1,
      });

      return result.data;
    } catch {
      // Safe fallback default query
      return {
        queryName: 'ANOMALIES_SUMMARY',
        parameters: { status: 'OPEN' },
      };
    }
  }

  private async synthesizeSummary(
    question: string,
    queryName: WhitelistedQueryName,
    rows: Array<Record<string, any>>,
  ): Promise<string> {
    if (rows.length === 0) {
      return `No records found matching your query for "${question}".`;
    }

    if (this.llm.name === 'mock') {
      switch (queryName) {
        case 'TOTAL_PAYROLL_SPEND': {
          const totalGross = rows.reduce((acc, r) => acc + (r.grossMinor ?? 0), 0);
          const currency = rows[0]?.currency ?? 'USD';
          return `Total payroll spend across ${rows.length} runs is ${(totalGross / 100).toLocaleString('en-US', {
            style: 'currency',
            currency,
          })}. Source runs cited below.`;
        }
        case 'CONTRACTOR_PAYOUT_HISTORY': {
          const first = rows[0];
          return `Found ${rows.length} historical payouts for ${first?.contractorName ?? 'contractor'}. The most recent payout was ${(
            (first?.grossMinor ?? 0) / 100
          ).toFixed(2)} ${first?.currency} on ${first?.paidAt ?? 'recent period'}.`;
        }
        case 'OPEN_INVOICES': {
          const total = rows.reduce((acc, r) => acc + (r.amountMinor ?? 0), 0);
          return `There are ${rows.length} open invoices totaling ${(total / 100).toLocaleString('en-US', {
            style: 'currency',
            currency: rows[0]?.currency ?? 'USD',
          })}.`;
        }
        case 'ANOMALIES_SUMMARY': {
          return `There are currently ${rows.length} flagged payroll anomalies requiring review. Highest severity items are cited below.`;
        }
        case 'UPCOMING_PAYROLL_RUNS': {
          return `Identified ${rows.length} upcoming scheduled payroll runs.`;
        }
        case 'CONTRACTOR_DIRECTORY': {
          // If all rows are from the same country and have netMinor amounts, compute the total
          const countries = [...new Set(rows.map((r) => r.country).filter(Boolean))];
          const hasAmounts = rows.some((r) => r.netMinor !== undefined || r.amountFormatted !== undefined);
          if (countries.length === 1 && hasAmounts && rows.length > 0) {
            const countryName = rows[0]?.country === 'IN' ? 'India'
              : rows[0]?.country === 'PT' ? 'Portugal'
              : rows[0]?.country === 'IE' ? 'Ireland'
              : rows[0]?.country;
            const totalMinor = rows.reduce((acc, r) => acc + (r.netMinor ?? 0), 0);
            const currency = rows[0]?.currency ?? 'USD';
            const totalFormatted = `**$${(totalMinor / 100).toLocaleString('en-US', { minimumFractionDigits: 2 })} ${currency}**`;
            return `This month, you paid ${rows.length} contractors in ${countryName} a total of ${totalFormatted}.`;
          }
          return `Found ${rows.length} active contractors matching your search criteria.`;
        }
      }
    }

    // With a real LLM provider, synthesize with prompt:
    const systemPrompt = `
You are a concise financial assistant at PayPilot.
Summarize the answer to the user's question using the retrieved database rows.
Cite specific numbers, dates, and contractor names. Keep the summary under 3 sentences.
`.trim();

    try {
      const summaryResult = await this.llm.generateText({
        prompt: `User Question: ${question}\nRetrieved Rows:\n${JSON.stringify(rows.slice(0, 8), null, 2)}`,
        systemPrompt,
        maxTokens: 250,
        temperature: 0.2,
      });
      return summaryResult.text.trim();
    } catch {
      return `Retrieved ${rows.length} matching records from the payroll database. Details cited below.`;
    }
  }
}
