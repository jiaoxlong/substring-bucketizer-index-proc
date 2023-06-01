"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createProperty = exports.transformMetadata = exports.quad = exports.literal = exports.blankNode = exports.namedNode = void 0;
const n3_1 = require("n3");
const types_1 = require("@treecg/types");
exports.namedNode = n3_1.DataFactory.namedNode, exports.blankNode = n3_1.DataFactory.blankNode, exports.literal = n3_1.DataFactory.literal, exports.quad = n3_1.DataFactory.quad;
function getLatestStream(store) {
    const streams = store.getSubjects(types_1.RDF.terms.type, types_1.SDS.terms.Stream, null)
        .filter(sub => store.getQuads(null, types_1.PROV.terms.used, sub, null).length === 0);
    if (streams.length != 1) {
        console.error(`Couldn't determine previous stream, extected one got ${streams.length}`);
        return undefined;
    }
    return streams[0];
}
function getLatestShape(streamId, store) {
    console.log("Found predicates for stream", streamId, store.getPredicates(streamId, null, null));
    const shapes = store.getObjects(streamId, types_1.SDS.terms.carries, new n3_1.DefaultGraph());
    if (shapes.length !== 1) {
        console.error(`A sds:stream should carry one type of members, not ${shapes.length}`);
        if (shapes.length == 0)
            return;
    }
    const shapeIds = shapes.flatMap(id => store.getObjects(id, types_1.SDS.terms.shape, null));
    if (shapeIds.length !== 1) {
        console.error(`A sds:stream can only carry one specified shape, not ${shapeIds.length}`);
        return;
    }
    console.log("Found valid stream", shapeIds[0]);
    return shapeIds[0];
}
function getLatestDataset(streamId, store) {
    const datasets = store.getObjects(streamId, types_1.SDS.terms.dataset, null);
    if (datasets.length !== 1) {
        console.error(`A sds:stream should be derived from one dataset, not ${datasets.length}`);
        if (datasets.length == 0)
            return;
    }
    return datasets[0];
}
function transformMetadata(streamId, sourceStream, itemType, gp, shT, datasetT) {
    return (quads) => {
        const store = new n3_1.Store();
        console.log("handling metadata transform");
        store.addQuads(quads);
        const latest = sourceStream || getLatestStream(store);
        const latestShape = !!latest ? getLatestShape(latest, store) : undefined;
        const activityId = gp(latest, store);
        const newShape = shT && shT(latestShape, store) || undefined;
        let datasetId = !!latest ? getLatestDataset(latest, store) : undefined;
        if (datasetId && datasetT) {
            datasetId = datasetT(datasetId, store);
        }
        const blank = store.createBlankNode();
        store.addQuad(streamId, types_1.RDF.terms.type, types_1.SDS.terms.Stream);
        if (datasetId) {
            store.addQuad(streamId, types_1.SDS.terms.dataset, datasetId);
        }
        store.addQuad(streamId, types_1.SDS.terms.carries, blank);
        store.addQuad(streamId, types_1.PROV.terms.wasGeneratedBy, activityId);
        store.addQuad(blank, types_1.RDF.terms.type, (0, exports.namedNode)(itemType));
        if (newShape)
            store.addQuad(blank, types_1.SDS.terms.shape, newShape);
        const out = [];
        for (let q of store)
            out.push(q);
        console.log("returning new metadata");
        return out;
    };
}
exports.transformMetadata = transformMetadata;
function createProperty(store, path, dataType, nodeKind, minCount, maxCount) {
    const newId = store.createBlankNode();
    store.addQuad(newId, types_1.SHACL.terms.path, path);
    if (dataType)
        store.addQuad(newId, types_1.SHACL.terms.datatype, dataType);
    if (nodeKind)
        store.addQuad(newId, types_1.SHACL.terms.nodeKind, nodeKind);
    if (minCount !== undefined)
        store.addQuad(newId, types_1.SHACL.terms.minCount, (0, exports.literal)(minCount));
    if (maxCount !== undefined)
        store.addQuad(newId, types_1.SHACL.terms.maxCount, (0, exports.literal)(maxCount));
    return newId;
}
exports.createProperty = createProperty;
