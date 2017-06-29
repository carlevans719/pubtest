import * as _ from 'underscore'
declare var Meteor

function relationalPublish<T>(args: any) {
    
    const publication = this
    let nextLayerId = 1

    // where value is an array of ids of layers that have published the document
    // stops us from calling 'added' on the same doc twice (if that's even a problem)
    const docsPublishedByLayerMap: { [_id: string]: string[] } = {}

    function makeRelationalLayer(args: any, layer: number) {

        let relationalLayerId = (nextLayerId++).toString()
        let currCursor: any
        let currObserver: any
        let currSelector = args.selector

        let prevForeignKeysById: { [_id: string]: { [foreignKey: string]: string[] } } = {}
        let requiredIdsPerRelation = {}
        let argRelations = args.relations || []

        function resetRequiredIdsPerRelation() {
            (argRelations || []).forEach(function (relation) {
                requiredIdsPerRelation[relation.foreignKeyName] = {}
            })
        }
        resetRequiredIdsPerRelation()

        const relations = argRelations.map(function (relation: any) {
            return makeRelationalLayer(relation, layer + 1)
        })

        function incrementRequiredId(relation: any, id: string) {
            requiredIdsPerRelation[relation.foreignKeyName][id] = (requiredIdsPerRelation[relation.foreignKeyName][id] || 0) + 1
            if (requiredIdsPerRelation[relation.foreignKeyName][id] === 1) {
                // newly required, ids have changed
                updateChildRelationSelectors()
            }
        }

        function decrementRequiredId(relation: any, id: string) {
            requiredIdsPerRelation[relation.foreignKeyName][id] = (requiredIdsPerRelation[relation.foreignKeyName][id] || 0) - 1
            if (requiredIdsPerRelation[relation.foreignKeyName][id] <= 0) {
                delete requiredIdsPerRelation[relation.foreignKeyName][id]
                // no longer required, ids have changed
                updateChildRelationSelectors()
            }
        }

        function onDocumentRemoved(collectionName, id) {
            argRelations.forEach(function (relation) {
                const idsNoLongerNeeded = prevForeignKeysById[id][relation.foreignKeyName]
                idsNoLongerNeeded.forEach(function (id) {
                    decrementRequiredId(relation, id)
                })
            })
            // delete this so we know we're no longer tracking this doc
            delete prevForeignKeysById[id]
            publication.remove(collectionName, id)

            // remove any evidence of this layer having published that document
            if (Array.isArray(docsPublishedByLayerMap[id])) {
                docsPublishedByLayerMap[id] = docsPublishedByLayerMap[id].filter(function (layerId: string) {
                    return layerId !== relationalLayerId
                })
                if (docsPublishedByLayerMap[id].length === 0) {
                    delete docsPublishedByLayerMap[id]
                }
            }
        }

        const makeNewCursorWithSelector = _.debounce((Meteor as any).bindEnvironment(function () {

            if (currObserver) {
              currObserver.stop()
            }
            currCursor = args.collection.find(currSelector, args.options)
            const newIds = _.indexBy(currCursor.fetch(), '_id')

            Object.keys(prevForeignKeysById).forEach(function (id) {
                // these are ids of documents we had published before
                if (!newIds[id]) {
                    onDocumentRemoved(args.collection._name, id)
                }
            })
            currObserver = (currCursor as any).observeChanges({
                added(id: string, fields: any) {
                    if (docsPublishedByLayerMap[id] && docsPublishedByLayerMap[id].length > 0) {
                      publication.changed(args.collection._name, id, fields)
                    }
                    else { 
                      publication.added(args.collection._name, id, fields)
                    }

                    // add ourselves as having published the doc
                    docsPublishedByLayerMap[id] = _.uniq((docsPublishedByLayerMap[id] || []).concat(relationalLayerId))

                    // check dem relations
                    updateRelationsForCurrentFields((Object as any).assign(fields, {_id: id}))
                },
                changed(id: string, fields: any) {
                    publication.changed(id, fields)

                    // add back any fields from our cached layer, fields won't have everything
                    const allFields = (Object as any).assign(prevForeignKeysById[id], fields, {_id: id})

                    // check dem relations
                    updateRelationsForCurrentFields(allFields)
                },
                removed(id: string) {
                    onDocumentRemoved(args.collection._name, id)
                }
            })
        }), 100)

        const updateChildRelationSelectors = _.debounce((Meteor as any).bindEnvironment(function () {
            // let each child relationship know about all the docs we currently require
            relations.forEach(function (relation, index) {
                const originalRelation = argRelations[index]
                const requiredIdsForRelation = Object.keys(requiredIdsPerRelation[originalRelation.foreignKeyName])
                relation.update({ _id: {$in: requiredIdsForRelation }})
            })
        }), 100)

        function forceArray (val: any) {
          if (val instanceof Array) {
            return val
          } else {
            return [val]
          }
        }

        function updateRelationsForCurrentFields(document: any) {
            argRelations.forEach(function (relation) {
                const ids = forceArray(document[relation.foreignKeyName] || [])
                const idsBefore = prevForeignKeysById[document._id] && prevForeignKeysById[document._id][relation.foreignKeyName] || []
                const addedIds = _.difference(ids, idsBefore)
                const removedIds = _.difference(idsBefore, ids)

                if (!prevForeignKeysById[document._id]) {
                    prevForeignKeysById[document._id] = {}
                }
                prevForeignKeysById[document._id][relation.foreignKeyName] = ids
                addedIds.forEach(function (id) {
                    incrementRequiredId(relation, id)
                })
                removedIds.forEach(function (id) {
                    decrementRequiredId(relation, id)
                })
            })
        }

        if (layer === 0) {
            // kick things off at the top layer
            makeNewCursorWithSelector()
        }

        return {
            stop() {
                // stop all children
                relations.forEach(function (relation) {
                    relation.stop()
                })
                // stop observing changes                
                currObserver.stop()
            },
            update(selector: any) {
                // this won't ever get called for the top layer, but for lower layers,
                // will get called with a new {_id: {$in : []}} selector
                currSelector = selector
                makeNewCursorWithSelector()
            }
        }
    }

    makeRelationalLayer(args, 0)
}


export {
  relationalPublish
}