class BaseRepository {
  constructor(model) {
    this.model = model;
  }

  async create(payload) {
    return this.model.create(payload);
  }

  async findById(id) {
    return this.model.findById(id);
  }

  async updateById(id, payload, options = { new: true }) {
    return this.model.findByIdAndUpdate(id, payload, options);
  }

  async deleteById(id) {
    return this.model.findByIdAndDelete(id);
  }
}

export { BaseRepository };
