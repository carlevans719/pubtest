import { Meteor } from 'meteor/meteor'
import { WebApp } from 'meteor/webapp'

import { Model } from '@webantic/meteor-models'
import { Publication } from '@webantic/meteor-publications'
import { HTTP } from '@webantic/meteor-http'
import { Mongo } from 'meteor/mongo'
import { relationalPublish } from './rp'

const http = new HTTP({
  base: 'v1',
  WebApp
})

Publication.configure({
  Meteor,
  Mongo,
  HTTP: http
})

Model.configure({
  Mongo,
  HTTP: http
})

const pub = new Publication({
  name: 'stationary',
  action () {

    // Pens.find({}).observeChanges({
    //   added: (id, fields) => {

    //   },
    //   changed: (id, fields) => {
    //     console.log(fields)
    //   },
    //   removed: (id) => {

    //   }
    // })

    relationalPublish.call(this, {
      collection: Stationary,
      selector: {},

      relations: [{
        collection: Pens,
        selector: {unavailable: {$ne: true}},
        foreignKeyName: 'type',

        relations: [{
          collection: Inks,
          foreignKeyName: 'ink'
        }, {
          collection: Inks,
          foreignKeyName: 'otherInk'
        }]
      }]
    })

    // this.relationalPublish(
    // {
    //   collection: Stationary,
    //   selector: {},

    //   relations: [{
    //     collection: Pens,
    //     selector: {unavailable: {$ne: true}},
    //     foreignKeyName: 'type',

    //     relations: [{
    //       collection: Inks,
    //       foreignKeyName: 'ink'
    //     }, {
    //       collection: Inks,
    //       foreignKeyName: 'otherInk'
    //     }]
    //   }]
    // }
    // )

    this.ready()
  },
  rest: false
})


// const published = {
//   ['stationary']: {
//     '_idA': [],
//     '_idB': []
//   },
//   ['stationary/pens@type']: {
//     '_idV': ['_idA', '_idB']
//   },
//   ['stationary/pens@type/ink@ink']: {
//     '_id1': ['_idV']
//   },
//   ['stationary/pens@secondaryType']: {
//     '_idV': ['_idA']
//   },
//   ['stationary/pens@secondaryType/ink@ink']: {
//     '_id2': ['_idV']
//   },
//   ['stationary/pencils@type']: {
    
//   },
//   ['stationary/pencils@type/weights@weight']: {
    
//   }
// }

// const treeProto = {
//   add (key, id, parent) {
//     if (!(key in this)) {
//       return false
//     }

//     if (id in this[key].items) {
//       if (parent && this[key].items[id].includes(parent)) {
//         return false
//       } else if (parent) {
//         this[key].items[id].push(parent)
//         return true
//       }
//       return false
//     } else {
//       if (parent) {
//         this[key].items[id] = [parent]
//       } else {
//         this[key].items[id] = []
//       }
//       return true
//     }
//   },
//   remove (key, id, parent) {
//     if (parent) {
//       if (key in this && id in this[key].items && this[key].items[id].includes(parent)) {
//         this[key].items[id].splice(this[key].items[id].indexOf(parent), 1)
//         if (!this[key].items[id].length) {
//           delete this[key].items[id]
//           return true
//         }

//         return 
//       }
//     }
//   },
//   getIds (collectionName) {
//     const res = {}
//     for (let key in this) {
//       const coll = this[key].collectionName
//       if (coll && (!collectionName || coll === collectionName)) {
//         if (!(coll in res)) {
//           res[coll] = Object.keys(this[key].items)
//         } else {
//           res[coll] = res[coll].concat(Object.keys(this[key].items))
//         }
//       }
//     }

//     return collectionName ? res[collectionName] : res
//   }
// }

// /**
//  * Build a flat(ish) object to track published docs
//  *
//  * @example 
//  *   var params = {
//  *     collection: Stationary,
//  *
//  *     relations: [{
//  *       collection: Pens,
//  *       foreignKeyName: 'type',
//  * 
//  *       relations: [{
//  *         collection: Inks,
//  *         foreignKeyName: 'ink'
//  *       }, {
//  *         collection: Inks,
//  *         foreignKeyName: 'otherInk'
//  *       }]
//  *     }]
//  *   }
//  *
//  * var response = buildTree(params)
//  * // response:
//  * {
//  *   'stationary': {items: {}, collectionName: null, observer: null, cursor: null},
//  *   'stationary/pens@type': {items: {}, collectionName: null, observer: null, cursor: null},
//  *   'stationary/pens@type/inks@ink': {items: {}, collectionName: null, observer: null, cursor: null},
//  *   'stationary/pens@type/inks@otherInk': {items: {}, collectionName: null, observer: null, cursor: null}
//  * }
//  */
// function buildTree (params, obj = Object.create(treeProto), prefix = '') {
//   if ('collection' in params) {
//     let key = prefix + params.collection._name
//     if ('foreignKeyName' in params) {
//       key = key + '@' + params.foreignKeyName
//     }

//     if (key in obj) {
//       throw new Error(`Key "${key}" already in tree. Has a relation been specified twice?`)
//     }

//     obj[key] = {items: {}, collectionName: null, observer: null, cursor: null}

//     if ('relations' in params) {
//       for (relation of params.relations) {
//         obj = buildTree(relation, obj, key + '/')
//       }
//     }
//   }

//   return obj
// }

// function publishTopLevel (context, params, tree = buildTree(params), prefix = '') {
//   const cursor = params.collection.find(params.selector, params.options)
//   let isReady = false
//   const observer = cursor.observeChanges({
//     added: (id, fields) => {
//       if ('relations' in params) {
//         for (let relation of params.relations) {
//           if (relation.foreignKey && relation.foreignKey in fields) {
//             const key = params.collection._name + '/' + relation.collection._id + '@' + relation.foreignKeyName

//             if (fields[relation.foreignKey] instanceof Array) {
//               // for each id in the array, map to true/false depending on whether it differs
//               if (fields[relation.foreignKey].some((_id) => tree.add(key, _id, id)) && isReady) {

//               }
//             // } else if (typeof fields[relation.foreignKey] === 'object' && fields[relation.foreignKey] !== null) {
//             //   Object.keys(fields[relation.foreignKey]).forEach((_id) => {
//             //     tree.add(key, _id, id)
//             //   })
//             // } else {
//             //   if (tree.add(key, fields[relation.foreignKey], id)) {}
//             }
//           }
//         }
//       }
//     }
//   })
//   isReady = true

//   if ('relations' in params) {
//     for (let relation of params.relations) {
      
//     }
//   }

//   context.onStop(() => {
//     observer.stop()
//     tree = null
//   })


// }


// function publishDocs (context, params) {
//   params.collection.find(params.selector)
  
// }









// Pens.insert({
//   ink: Inks.insert({color: 'black'}),
//   style: 'marker'
// })
