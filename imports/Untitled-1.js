class Publisher {
  constructor (params, relations) {
    this.cursor = params.cursor
    this.collection = params.collection
    this.collectionName = this.collection._name
    this.addObserver(cursor, relations)
  }

  addObserver (cursor, relations) {
    this.observer = cursor.observeChanges({
      added: this.getOnAddedCallback()
    })

    for (let relation of relations) {
      const newCursor = this.getCursor(relation)
      this.published[collection._name + '@' + name].cursor

    }
  }

  getCursor (relation) {
    const { foreignKeyName: name, collection } = relation
    return collection.find(
      Object.assign(
        relation.selector,
        {_id: {$in: Object.keys(this.published[collection._name + '@' + name].items)}}
      ),
      relation.options
    )
  }

  getOnAddedCallback (relations) {
    const self = this
    return function (id, fields) {
      this.added(self.collectionName, id, fields)

      self.addRelations(relations, fields, id)
    }
  }

  addRelations (relations, fields, id) {
    for (let relation of relations) {
      const { foreignKeyName: name, collection } = relation
      if (name in fields) {
        this.eachId(fields, name, (foreignId) => {
          this.addToPublished(collection._name + '@' + name, id, foreignId)
        })
      }
    }
  }

  addToPublished (key, parent, id) {
    if (!this.published[key].items[id].includes(parent)) {
      this.published[key].items[id].push(parent)
      return true
    }
  } 

  eachId (obj, key, cb) {
    if (obj && key && key in obj && obj[key]) {
      if (obj[key] instanceof Array) {
        obj[key].forEach(cb)
      } else if (typeof obj[key] === 'object') {
        Object.keys(obj[key]).forEach(cb)
      } else {
        [obj[key]].forEach(cb)
      }
    } else {
      [].forEach(cb)
    }
  }
  
  stop () {
    this.observer.stop()
  }
}
