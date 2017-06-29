"use strict";
exports.__esModule = true;
var _ = require("underscore");
function relationalPublish(args) {
    var publication = this;
    var nextLayerId = 1;
    // where value is an array of ids of layers that have published the document
    // stops us from calling 'added' on the same doc twice (if that's even a problem)
    var docsPublishedByLayerMap = {};
    function makeRelationalLayer(args, layer) {
        var relationalLayerId = (nextLayerId++).toString();
        var currCursor;
        var currObserver;
        var currSelector = args.selector;
        var prevForeignKeysById = {};
        var requiredIdsPerRelation = {};
        var argRelations = args.relations || [];
        function resetRequiredIdsPerRelation() {
            (argRelations || []).forEach(function (relation) {
                requiredIdsPerRelation[relation.foreignKeyName] = {};
            });
        }
        resetRequiredIdsPerRelation();
        var relations = argRelations.map(function (relation) {
            return makeRelationalLayer(relation, layer + 1);
        });
        function incrementRequiredId(relation, id) {
            requiredIdsPerRelation[relation.foreignKeyName][id] = (requiredIdsPerRelation[relation.foreignKeyName][id] || 0) + 1;
            if (requiredIdsPerRelation[relation.foreignKeyName][id] === 1) {
                // newly required, ids have changed
                updateChildRelationSelectors();
            }
        }
        function decrementRequiredId(relation, id) {
            requiredIdsPerRelation[relation.foreignKeyName][id] = (requiredIdsPerRelation[relation.foreignKeyName][id] || 0) - 1;
            if (requiredIdsPerRelation[relation.foreignKeyName][id] <= 0) {
                delete requiredIdsPerRelation[relation.foreignKeyName][id];
                // no longer required, ids have changed
                updateChildRelationSelectors();
            }
        }
        function onDocumentRemoved(collectionName, id) {
            argRelations.forEach(function (relation) {
                var idsNoLongerNeeded = prevForeignKeysById[id][relation.foreignKeyName];
                idsNoLongerNeeded.forEach(function (id) {
                    decrementRequiredId(relation, id);
                });
            });
            // delete this so we know we're no longer tracking this doc
            delete prevForeignKeysById[id];
            publication.remove(collectionName, id);
            // remove any evidence of this layer having published that document
            if (Array.isArray(docsPublishedByLayerMap[id])) {
                docsPublishedByLayerMap[id] = docsPublishedByLayerMap[id].filter(function (layerId) {
                    return layerId !== relationalLayerId;
                });
                if (docsPublishedByLayerMap[id].length === 0) {
                    delete docsPublishedByLayerMap[id];
                }
            }
        }
        var makeNewCursorWithSelector = _.debounce(Meteor.bindEnvironment(function () {
            if (currObserver) {
                currObserver.stop();
            }
            currCursor = args.collection.find(currSelector, args.options);
            var newIds = _.indexBy(currCursor.fetch(), '_id');
            Object.keys(prevForeignKeysById).forEach(function (id) {
                // these are ids of documents we had published before
                if (!newIds[id]) {
                    onDocumentRemoved(args.collection._name, id);
                }
            });
            currObserver = currCursor.observeChanges({
                added: function (id, fields) {
                    if (docsPublishedByLayerMap[id] && docsPublishedByLayerMap[id].length > 0) {
                        publication.changed(args.collection._name, id, fields);
                    }
                    else {
                        publication.added(args.collection._name, id, fields);
                    }
                    // add ourselves as having published the doc
                    docsPublishedByLayerMap[id] = _.uniq((docsPublishedByLayerMap[id] || []).concat(relationalLayerId));
                    // check dem relations
                    updateRelationsForCurrentFields(Object.assign(fields, { _id: id }));
                },
                changed: function (id, fields) {
                    publication.changed(id, fields);
                    // add back any fields from our cached layer, fields won't have everything
                    var allFields = Object.assign(prevForeignKeysById[id], fields, { _id: id });
                    // check dem relations
                    updateRelationsForCurrentFields(allFields);
                },
                removed: function (id) {
                    onDocumentRemoved(args.collection._name, id);
                }
            });
        }), 100);
        var updateChildRelationSelectors = _.debounce(Meteor.bindEnvironment(function () {
            // let each child relationship know about all the docs we currently require
            relations.forEach(function (relation, index) {
                var originalRelation = argRelations[index];
                var requiredIdsForRelation = Object.keys(requiredIdsPerRelation[originalRelation.foreignKeyName]);
                relation.update({ _id: { $in: requiredIdsForRelation } });
            });
        }), 100);
        function forceArray(val) {
            if (val instanceof Array) {
                return val;
            }
            else {
                return [val];
            }
        }
        function updateRelationsForCurrentFields(document) {
            argRelations.forEach(function (relation) {
                var ids = forceArray(document[relation.foreignKeyName] || []);
                var idsBefore = prevForeignKeysById[document._id] && prevForeignKeysById[document._id][relation.foreignKeyName] || [];
                var addedIds = _.difference(ids, idsBefore);
                var removedIds = _.difference(idsBefore, ids);
                if (!prevForeignKeysById[document._id]) {
                    prevForeignKeysById[document._id] = {};
                }
                prevForeignKeysById[document._id][relation.foreignKeyName] = ids;
                addedIds.forEach(function (id) {
                    incrementRequiredId(relation, id);
                });
                removedIds.forEach(function (id) {
                    decrementRequiredId(relation, id);
                });
            });
        }
        if (layer === 0) {
            // kick things off at the top layer
            makeNewCursorWithSelector();
        }
        return {
            stop: function () {
                // stop all children
                relations.forEach(function (relation) {
                    relation.stop();
                });
                // stop observing changes                
                currObserver.stop();
            },
            update: function (selector) {
                // this won't ever get called for the top layer, but for lower layers,
                // will get called with a new {_id: {$in : []}} selector
                currSelector = selector;
                makeNewCursorWithSelector();
            }
        };
    }
    makeRelationalLayer(args, 0);
}
exports.relationalPublish = relationalPublish;
