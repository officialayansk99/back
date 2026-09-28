import { Mt5Account } from "../model/mt5Account.model.js";

class Mt5AccountRepository {
  async create(payload) {
    return Mt5Account.create(payload);
  }

  async findByUserId(userId) {
    return Mt5Account.find({ userId }).sort({ createdAt: -1 });
  }

  async findByLogin(login) {
    return Mt5Account.findOne({ login });
  }

  async updateByLogin(login, payload) {
    return Mt5Account.findOneAndUpdate({ login }, payload, { new: true });
  }
}

export { Mt5AccountRepository };
