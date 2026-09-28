import { User } from "../model/user.model.js";

class UserRepository {
  async create(payload) {
    return User.create(payload);
  }

  async findByEmail(email) {
    return User.findOne({ email: email.toLowerCase() });
  }

  async findById(userId) {
    return User.findById(userId);
  }

  async findAllClients({ page, limit, search, kycStatus }) {
    const skip = (page - 1) * limit;
    // Escape regex metacharacters so user input (e.g. a "+" in a phone number)
    // is matched literally instead of being interpreted as a regex operator,
    // which would otherwise throw and 500 the request.
    const safeSearch = search
      ? search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
      : "";
    const filter = {
      role: "client",
      ...(kycStatus && kycStatus !== "all" ? { kycStatus } : {}),
      ...(safeSearch
        ? {
            $or: [
              { name: { $regex: safeSearch, $options: "i" } },
              { email: { $regex: safeSearch, $options: "i" } },
              { phone: { $regex: safeSearch, $options: "i" } },
            ],
          }
        : {}),
    };

    const [items, total] = await Promise.all([
      User.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .select("-password"),
      User.countDocuments(filter),
    ]);

    return { items, total };
  }

  async updateById(userId, payload) {
    return User.findByIdAndUpdate(userId, payload, { new: true }).select(
      "-password",
    );
  }

  async deleteById(userId) {
    return User.findByIdAndDelete(userId);
  }

  async appendMt5Account(userId, mt5Ref) {
    return User.findByIdAndUpdate(
      userId,
      { $push: { mt5Accounts: mt5Ref } },
      { new: true },
    ).select("-password");
  }

  async removeMt5AccountRef(userId, accountId) {
    return User.findByIdAndUpdate(
      userId,
      { $pull: { mt5Accounts: { accountId } } },
      { new: true },
    ).select("-password");
  }
}

export { UserRepository };
