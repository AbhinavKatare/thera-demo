import Fastify, { type FastifyInstance } from 'fastify';

export interface NetSuiteMockServerOptions {
  port?: number;
  accountId?: string;
}

export class NetSuiteMockServer {
  public app: FastifyInstance;
  public accountId: string;
  private vendors = new Map<string, any>();
  private vendorBills = new Map<string, any>();
  private vendorPayments = new Map<string, any>();
  private accounts = new Map<string, any>();

  constructor(options: NetSuiteMockServerOptions = {}) {
    this.accountId = options.accountId ?? '7654321';
    this.app = Fastify({ logger: false });

    // Seed default chart of accounts
    this.accounts.set('101', {
      id: '101',
      acctNumber: '6010',
      acctName: 'Contractor Expense',
      acctType: { id: 'Expense', refName: 'Expense' },
    });
    this.accounts.set('120', {
      id: '120',
      acctNumber: '1010',
      acctName: 'Operating Checking',
      acctType: { id: 'Bank', refName: 'Bank' },
    });

    this.registerRoutes();
  }

  private registerRoutes(): void {
    const basePath = `/services/rest/record/v1`;

    // Auth verification hook
    this.app.addHook('onRequest', async (req, reply) => {
      const auth = req.headers['authorization'];
      if (!auth) {
        return reply.status(401).send({
          type: 'https://www.w3.org/Protocols/rfc2616/rfc2616-sec10.html#sec10.4.2',
          title: 'Unauthorized',
          status: 401,
          'o:errorDetails': [{ detail: 'Invalid or missing NetSuite TBA Authorization header.' }],
        });
      }
    });

    // 1. Vendors
    this.app.get(`${basePath}/vendor`, async (req) => {
      const { q } = (req.query as any) ?? {};
      let list = Array.from(this.vendors.values());
      if (q) {
        const match = q.match(/companyName IS "([^"]+)"/);
        if (match && match[1]) {
          const searchName = match[1].toLowerCase();
          list = list.filter((v) => v.companyName?.toLowerCase().includes(searchName));
        }
      }

      return {
        links: [{ rel: 'self', href: `${basePath}/vendor` }],
        count: list.length,
        hasMore: false,
        items: list.map((v) => ({
          id: v.id,
          links: [{ rel: 'self', href: `${basePath}/vendor/${v.id}` }],
          companyName: v.companyName,
          email: v.email,
          comments: v.comments,
        })),
      };
    });

    this.app.get(`${basePath}/vendor/:id`, async (req, reply) => {
      const { id } = req.params as { id: string };
      const vendor = this.vendors.get(id);
      if (!vendor) {
        return reply.status(404).send({ title: 'Not Found', status: 404 });
      }
      return vendor;
    });

    this.app.post(`${basePath}/vendor`, async (req, reply) => {
      const body = req.body as any;
      const id = String(this.vendors.size + 101);
      const record = {
        id,
        companyName: body.companyName,
        legalName: body.legalName ?? body.companyName,
        email: body.email,
        currency: body.currency ?? { id: '1', refName: 'USD' },
        comments: body.comments,
        isInactive: false,
      };
      this.vendors.set(id, record);

      reply.header('Location', `${basePath}/vendor/${id}`);
      return reply.status(201).send(record);
    });

    this.app.patch(`${basePath}/vendor/:id`, async (req, reply) => {
      const { id } = req.params as { id: string };
      const existing = this.vendors.get(id);
      if (!existing) {
        return reply.status(404).send({ title: 'Not Found', status: 404 });
      }
      Object.assign(existing, req.body);
      return reply.status(204).send();
    });

    // 2. Vendor Bills
    this.app.post(`${basePath}/vendorBill`, async (req, reply) => {
      const body = req.body as any;
      const id = String(this.vendorBills.size + 501);
      const record = {
        id,
        entity: body.entity,
        tranId: body.tranId,
        tranDate: body.tranDate,
        dueDate: body.dueDate,
        currency: body.currency ?? { refName: 'USD' },
        memo: body.memo,
        item: body.item,
        status: { id: 'open', refName: 'Open' },
        total: (body.item?.items ?? []).reduce((acc: number, cur: any) => acc + (cur.amount ?? 0), 0),
      };
      this.vendorBills.set(id, record);

      reply.header('Location', `${basePath}/vendorBill/${id}`);
      return reply.status(201).send(record);
    });

    this.app.get(`${basePath}/vendorBill/:id`, async (req, reply) => {
      const { id } = req.params as { id: string };
      const bill = this.vendorBills.get(id);
      if (!bill) {
        return reply.status(404).send({ title: 'Not Found', status: 404 });
      }
      return bill;
    });

    // 3. Vendor Payments
    this.app.post(`${basePath}/vendorPayment`, async (req, reply) => {
      const body = req.body as any;
      const id = String(this.vendorPayments.size + 801);
      const record = {
        id,
        entity: body.entity,
        tranDate: body.tranDate,
        account: body.account,
        apply: body.apply,
        status: { id: 'paid', refName: 'Paid' },
      };
      this.vendorPayments.set(id, record);

      reply.header('Location', `${basePath}/vendorPayment/${id}`);
      return reply.status(201).send(record);
    });

    // 4. Accounts
    this.app.get(`${basePath}/account`, async () => {
      return {
        items: Array.from(this.accounts.values()),
      };
    });
  }

  public async start(): Promise<string> {
    const address = await this.app.listen({ port: 0, host: '127.0.0.1' });
    return address;
  }

  public async close(): Promise<void> {
    await this.app.close();
  }
}
