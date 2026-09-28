import { Transaction } from "../model/transaction.model.js";

class TransactionRepository {
  async create(payload) {
    return Transaction.create(payload);
  }

  /**
   * Paginated listing scoped to a single user. Required because long-tenured
   * clients accumulate many transactions and the unbounded version was
   * shipping multi-MB payloads on every history page load.
   */
  async findByUserIdPaged(userId, { page, limit, type, search }) {
    const skip = (page - 1) * limit;
    const filter = { userId };

    if (type && type !== "all") {
      filter.type = type;
    }
    if (search) {
      const re = new RegExp(search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
      filter.$or = [{ note: re }];
    }

    const [items, total] = await Promise.all([
      Transaction.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit),
      Transaction.countDocuments(filter),
    ]);

    return { items, total };
  }

  async findById(transactionId) {
    return Transaction.findById(transactionId);
  }
}

export { TransactionRepository };
